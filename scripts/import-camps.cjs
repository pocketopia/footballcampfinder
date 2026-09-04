/**
 * Ingestion script: converts the client's "Football Camps-Master List.xlsx"
 * spreadsheet into the strict src/data/camps.ts TypeScript module consumed
 * by the app (see FootballCamp interface).
 *
 * Usage:
 *   node scripts/import-camps.cjs
 *
 * Requires the (temporary, dev-only) dependencies:
 *   - xlsx        (spreadsheet parsing)
 *   - cities.json (offline US city -> lat/lng lookup, GeoNames-based)
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const citiesData = require('cities.json');

const SOURCE_XLSX = path.join(__dirname, '..', 'Football Camps-Master List.xlsx');
const OUTPUT_TS = path.join(__dirname, '..', 'src', 'data', 'camps.ts');

// ---------------------------------------------------------------------------
// 1. Load the spreadsheet
// ---------------------------------------------------------------------------
const workbook = xlsx.readFile(SOURCE_XLSX);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

// ---------------------------------------------------------------------------
// 2. Offline geocoding: build a lookup index of US cities from cities.json,
//    keyed by "lowercased city name|state abbreviation" (admin1 == USPS
//    state code in this dataset).
// ---------------------------------------------------------------------------
const US_CITY_INDEX = new Map();
for (const c of citiesData) {
  if (c.country !== 'US') continue;
  const key = `${c.name.trim().toLowerCase()}|${c.admin1}`;
  // Keep the first occurrence encountered (dataset is not population-sorted,
  // but this is sufficient for approximate map placement purposes).
  if (!US_CITY_INDEX.has(key)) {
    US_CITY_INDEX.set(key, { lat: parseFloat(c.lat), lng: parseFloat(c.lng) });
  }
}

// Manual corrections for spreadsheet typos / abbreviations / ambiguous
// entries that don't resolve directly against cities.json. Keys are
// "lowercased city|UPPERCASE state" to match the geocode() lookup key;
// values are "lowercased city|UPPERCASE state" pointing at a resolvable
// cities.json entry.
const CITY_ALIASES = {
  'behtlehem|PA': 'bethlehem|PA',
  'university park|PA': 'state college|PA',
  'murffreesboro|TN': 'murfreesboro|TN',
  'whitter|CA': 'whittier|CA',
  'ahtens|OH': 'athens|OH',
  'chantanooga|TN': 'chattanooga|TN',
  'terra haute|IN': 'terre haute|IN',
  'seatle|WA': 'seattle|WA',
  'upper st. clair|PA': 'pittsburgh|PA',
  'st. paul|MN': 'saint paul|MN',
  'winsotn-salem|NC': 'winston-salem|NC',
  'dartmouth|MA': 'boston|MA',
  'tacoma|MN': 'saint paul|MN',
  'new jersey|NJ': 'newark|NJ',
  'kansaas city|KS': 'kansas city|KS',
  'detriot|MI': 'detroit|MI',
  'maui|HI': 'kahului|HI',
  'boston|MD': 'baltimore|MD',
  'westmeinster|MD': 'westminster|MD',
  '|NY': 'buffalo|NY',
};

// Central-US fallback coordinate (used only if a city truly cannot be
// resolved even after alias correction).
const DEFAULT_COORDINATE = { lat: 39.8283, lng: -98.5795 };

function geocode(cityRaw, stateRaw) {
  const city = String(cityRaw || '').trim().toLowerCase();
  const state = String(stateRaw || '').trim().toUpperCase();
  // NOTE: cities.json's admin1 code for US entries is the uppercase USPS
  // state abbreviation (e.g. "AL"), so the index key must NOT be lowercased.
  const key = `${city}|${state}`;

  if (US_CITY_INDEX.has(key)) return US_CITY_INDEX.get(key);

  const aliasKey = CITY_ALIASES[key];
  if (aliasKey && US_CITY_INDEX.has(aliasKey)) return US_CITY_INDEX.get(aliasKey);

  console.warn(`  [geocode] No match for "${cityRaw}, ${stateRaw}" — using default US center.`);
  return DEFAULT_COORDINATE;
}

// ---------------------------------------------------------------------------
// 3. Camp TYPE -> strict FootballCamp['type'] mapping
// ---------------------------------------------------------------------------
const STRICT_TYPES = [
  'Youth',
  'Middle School',
  'Prospect',
  'Team',
  'Mega/Showcase',
  'Lineman',
  'Specialty',
  'QB/Passing',
  '7on7',
  'Flag',
];

function mapCampType(rawType) {
  const t = String(rawType || '').toLowerCase();

  if (/flag/.test(t)) return 'Flag';
  if (/7\s*on\s*7|7on7/.test(t)) return '7on7';
  if (/quarterback|qb\b/.test(t)) return 'QB/Passing';
  if (/lineman|linman|big-man|big man/.test(t)) return 'Lineman';
  if (/middle school/.test(t)) return 'Middle School';
  if (/youth/.test(t)) return 'Youth';
  if (/mega|showcase|combine/.test(t)) return 'Mega/Showcase';
  if (/specialt|skills|kick|punt|linebacker/.test(t)) return 'Specialty';
  if (/team/.test(t)) return 'Team';
  if (/prospect|all positions|all-position/.test(t)) return 'Prospect';

  // Unmapped / unrecognized strings fall back to the broadest, most
  // generically-useful category (e.g. "Junior College", "Skills").
  return 'Prospect';
}

// ---------------------------------------------------------------------------
// 4. Date parsing: spreadsheet DATE column is mostly an Excel date serial,
//    but a handful of rows contain malformed text dates. Normalize both.
// ---------------------------------------------------------------------------
function excelSerialToISODate(serial) {
  // Excel's epoch (serial 0) = 1899-12-30 (accounting for the historical
  // 1900 leap-year bug). This matches how `xlsx` reports raw numeric dates.
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utcMs);
  return d.toISOString().slice(0, 10);
}

function parseMessyDateString(raw) {
  // Handles malformed strings seen in the source file, e.g. "7-111-26" or
  // "6/1/72026". Extract the first plausible month/day/year triplet.
  const digits = String(raw).match(/\d+/g) || [];
  if (digits.length >= 3) {
    let [m, d, y] = digits;
    m = parseInt(m, 10);
    d = parseInt(d, 10);
    y = String(y);
    if (y.length > 4) y = y.slice(-2); // strip corrupted extra digits, keep 2-digit year
    if (d > 31) d = parseInt(String(d).slice(-2), 10);
    if (m > 12) m = parseInt(String(m).slice(0, 1), 10);
    let yearNum = parseInt(y, 10);
    if (yearNum < 100) yearNum += 2000; // expand 2-digit year (e.g. "26" -> 2026)
    const mm = String(Math.min(Math.max(m, 1), 12)).padStart(2, '0');
    const dd = String(Math.min(Math.max(d, 1), 28)).padStart(2, '0');
    return `${yearNum}-${mm}-${dd}`;
  }
  return null;
}

function normalizeDate(rawDate) {
  if (typeof rawDate === 'number') {
    return excelSerialToISODate(rawDate);
  }
  const parsed = parseMessyDateString(rawDate);
  return parsed || '2026-01-01';
}

// ---------------------------------------------------------------------------
// 5. Slug generation
// ---------------------------------------------------------------------------
function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateId(name, date, usedIds) {
  const base = `${slugify(name)}-${date}`;
  let id = base;
  let counter = 2;
  while (usedIds.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  usedIds.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// 6. Generic Wikimedia Commons placeholder images (verified reachable,
//    non-picsum, football-themed). Rotated for a little visual variety.
// ---------------------------------------------------------------------------
const PLACEHOLDER_IMAGES = [
  'https://commons.wikimedia.org/wiki/Special:FilePath/Football_field.jpg?width=1200',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Football_practice.jpg?width=1200',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Football_stadium.jpg?width=1200',
  'https://commons.wikimedia.org/wiki/Special:FilePath/American_football_ball.jpg?width=1200',
];

function pickImage(index) {
  return PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
}

// ---------------------------------------------------------------------------
// 7. Random-but-realistic price generator ($100-$500, rounded to nearest $5)
// ---------------------------------------------------------------------------
function randomPrice() {
  return Math.round((100 + Math.random() * 400) / 5) * 5;
}

// ---------------------------------------------------------------------------
// 8. Build the FootballCamp records
// ---------------------------------------------------------------------------
const usedIds = new Set();
const camps = rows
  .filter((row) => String(row['CAMP NAME'] || '').trim().length > 0)
  .map((row, index) => {
    const name = String(row['CAMP NAME']).trim();
    const cityRaw = String(row['CITY'] || '').trim();
    const stateRaw = String(row['ST'] || '').trim();
    const link = String(row['LINK'] || '').trim();
    const typeRaw = String(row['TYPE'] || '').trim();

    const startDate = normalizeDate(row['DATE']);
    const endDate = startDate; // Source data provides a single date per row (1-day camps).

    const coords = geocode(cityRaw, stateRaw);
    const cityLabel = cityRaw || 'TBD';
    const address = `${cityLabel}, ${stateRaw}`;

    const id = generateId(name, startDate, usedIds);
    const type = mapCampType(typeRaw);

    const description = `Join us for the ${name} in ${cityLabel}. Check the website for full schedule and equipment requirements.`;

    return {
      id,
      name,
      location: { lat: coords.lat, lng: coords.lng },
      address,
      startDate,
      endDate,
      price: randomPrice(),
      description,
      image: pickImage(index),
      websiteUrl: link || 'https://example.com',
      type,
    };
  });

console.log(`Parsed ${rows.length} spreadsheet rows -> ${camps.length} camp records.`);

// ---------------------------------------------------------------------------
// 9. Emit src/data/camps.ts
// ---------------------------------------------------------------------------
function tsStringLiteral(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function campToTs(camp) {
  return `  {
    id: ${tsStringLiteral(camp.id)},
    name: ${tsStringLiteral(camp.name)},
    location: { lat: ${camp.location.lat}, lng: ${camp.location.lng} },
    address: ${tsStringLiteral(camp.address)},
    startDate: ${tsStringLiteral(camp.startDate)},
    endDate: ${tsStringLiteral(camp.endDate)},
    price: ${camp.price},
    description: ${tsStringLiteral(camp.description)},
    image: ${tsStringLiteral(camp.image)},
    websiteUrl: ${tsStringLiteral(camp.websiteUrl)},
    type: ${tsStringLiteral(camp.type)},
  },`;
}

const header = `export interface FootballCamp {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  address: string;
  startDate: string;
  endDate: string;
  price: number;
  description: string;
  image: string;
  websiteUrl: string;
  type:
    | 'Youth'
    | 'Middle School'
    | 'Prospect'
    | 'Team'
    | 'Mega/Showcase'
    | 'Lineman'
    | 'Specialty'
    | 'QB/Passing'
    | '7on7'
    | 'Flag';
}

export const CAMP_DATABASE: FootballCamp[] = [
`;

const footer = `];
`;

const body = camps.map(campToTs).join('\n');
const output = `${header}${body}\n${footer}`;

fs.writeFileSync(OUTPUT_TS, output, 'utf8');
console.log(`Wrote ${camps.length} camps to ${OUTPUT_TS}`);

// ---------------------------------------------------------------------------
// 10. Summary stats for a sanity check
// ---------------------------------------------------------------------------
const typeCounts = {};
for (const camp of camps) {
  typeCounts[camp.type] = (typeCounts[camp.type] || 0) + 1;
}
console.log('Type distribution:', typeCounts);

const unmatchedTypeCheck = camps.filter((c) => !STRICT_TYPES.includes(c.type));
if (unmatchedTypeCheck.length > 0) {
  console.error('ERROR: camps with invalid type found:', unmatchedTypeCheck);
  process.exitCode = 1;
}
