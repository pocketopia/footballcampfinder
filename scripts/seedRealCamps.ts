/**
 * scripts/seedRealCamps.ts
 *
 * ONE-TIME execution script: reads the client's real camp data from
 * "Football Camps-Master List.xlsx" (431 rows), maps it onto the app's
 * FootballCamp interface, geocodes every unique CITY/ST into lat/lng via
 * the free OpenStreetMap Nominatim API (no API key required/available —
 * see note below), wipes the existing `camps` Firestore collection, and
 * uploads the full real dataset.
 *
 * NOTE ON GEOCODING PROVIDER: the task originally called for the Google
 * Maps Geocoding API via VITE_GOOGLE_MAPS_API_KEY. That key's Google Cloud
 * project does NOT have the Geocoding API enabled (confirmed via a direct
 * test call, which returned REQUEST_DENIED / "This API is not activated on
 * your API project"). Per explicit instruction, this script instead uses
 * OpenStreetMap's free Nominatim geocoder, which requires no key and
 * returns the same { lat, lng } shape the app expects. If the Google
 * Geocoding API is enabled later, this script can be trivially swapped.
 *
 * Usage:
 *   npx tsx scripts/seedRealCamps.ts
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const requiredKeys = [
  'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId',
] as const;
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key as keyof typeof firebaseConfig]);
if (missingKeys.length > 0) {
  console.error(`Missing required Firebase env vars: ${missingKeys.join(', ')}`);
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EXCEL_PATH = path.resolve(__dirname, '../Football Camps-Master List.xlsx');
const DEFAULT_IMAGE = '/cover.png';
const DEFAULT_PRICE = 99;

interface RawRow {
  'CAMP NAME': string | null;
  'UNIVERSITY / IND': string | null;
  'TYPE': string | null;
  'DATE': unknown;
  'CITY': string | null;
  'ST': string | null;
  'LINK': string | null;
}

interface SeedCamp {
  name: string;
  type: 'Youth' | 'High School' | 'Elite' | 'Specialist';
  startDate: string;
  endDate: string;
  address: string;
  city: string;
  state: string;
  description: string;
  image: string;
  price: number;
  websiteUrl?: string;
  location: { lat: number; lng: number };
}

// --- TYPE column (42 raw free-text values) -> FootballCamp.type bucket ---
// Buckets chosen to best match the raw sheet language into the app's
// existing 4-value union: Youth | High School | Elite | Specialist.
function mapCampType(rawType: string): SeedCamp['type'] {
  const t = rawType.toLowerCase();
  if (t.includes('youth') || t.includes('middle school')) return 'Youth';
  if (
    t.includes('mega') ||
    t.includes('showcase') ||
    t.includes('prospect') ||
    t.includes('junior college') ||
    t.includes('summer week')
  ) {
    return 'Elite';
  }
  if (
    t.includes('kick') ||
    t.includes('punt') ||
    t.includes('specialt') ||
    t.includes('qb') ||
    t.includes('quarterback') ||
    t.includes('linebacker') ||
    t.includes('skills')
  ) {
    return 'Specialist';
  }
  // Team, 7 on 7, Lineman/Big-Man, Flag, All Positions, etc. default to High School
  return 'High School';
}

// --- DATE column parsing ---
// xlsx with cellDates:true already converts most cells to real JS Dates.
// A couple of rows in the source sheet have malformed strings
// ("7-111-26", "6/1/72026"). Those are manually corrected here based on
// cross-referencing sibling rows for the same camp/host in the sheet
// (Dan Swanstrom Prospect Camp -> 2026-07-11, Mike Norvell Football Camp
// -> 2026-06-01).
const MANUAL_DATE_FIXES: Record<string, string> = {
  '7-111-26': '2026-07-11',
  '6/1/72026': '2026-06-01',
};

function parseStartDate(rawDate: unknown): string {
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return rawDate.toISOString().slice(0, 10);
  }
  if (typeof rawDate === 'string') {
    const fixed = MANUAL_DATE_FIXES[rawDate.trim()];
    if (fixed) return fixed;
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  // Last-resort fallback so the row is never dropped for a bad date.
  console.warn(`  ! Could not parse DATE value "${String(rawDate)}", defaulting to today.`);
  return new Date().toISOString().slice(0, 10);
}

// Camps are single-day events in the source sheet unless the TYPE column
// explicitly states a multi-day duration (e.g. "2-Day", "3-Day Prospect").
function computeEndDate(startDateIso: string, rawType: string): string {
  const match = rawType.match(/(\d+)\s*-?\s*day/i);
  const days = match ? parseInt(match[1], 10) : 1;
  const start = new Date(`${startDateIso}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + Math.max(days - 1, 0));
  return start.toISOString().slice(0, 10);
}

// --- Geocoding ---
// State-centroid fallback (approximate geographic center of each US state),
// used ONLY if Nominatim fails to resolve a given CITY, ST after retries,
// so that every single camp always ends up with usable map coordinates.
const STATE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  AL: { lat: 32.806671, lng: -86.79113 }, AK: { lat: 61.370716, lng: -152.404419 },
  AZ: { lat: 33.729759, lng: -111.431221 }, AR: { lat: 34.969704, lng: -92.373123 },
  CA: { lat: 36.116203, lng: -119.681564 }, CO: { lat: 39.059811, lng: -105.311104 },
  CT: { lat: 41.597782, lng: -72.755371 }, DE: { lat: 39.318523, lng: -75.507141 },
  FL: { lat: 27.766279, lng: -81.686783 }, GA: { lat: 33.040619, lng: -83.643074 },
  HI: { lat: 21.094318, lng: -157.498337 }, ID: { lat: 44.240459, lng: -114.478828 },
  IL: { lat: 40.349457, lng: -88.986137 }, IN: { lat: 39.849426, lng: -86.258278 },
  IA: { lat: 42.011539, lng: -93.210526 }, KS: { lat: 38.5266, lng: -96.726486 },
  KY: { lat: 37.66814, lng: -84.670067 }, LA: { lat: 31.169546, lng: -91.867805 },
  ME: { lat: 44.693947, lng: -69.381927 }, MD: { lat: 39.063946, lng: -76.802101 },
  MA: { lat: 42.230171, lng: -71.530106 }, MI: { lat: 43.326618, lng: -84.536095 },
  MN: { lat: 45.694454, lng: -93.900192 }, MS: { lat: 32.741646, lng: -89.678696 },
  MO: { lat: 38.456085, lng: -92.288368 }, MT: { lat: 46.921925, lng: -110.454353 },
  NE: { lat: 41.12537, lng: -98.268082 }, NV: { lat: 38.313515, lng: -117.055374 },
  NH: { lat: 43.452492, lng: -71.563896 }, NJ: { lat: 40.298904, lng: -74.521011 },
  NM: { lat: 34.840515, lng: -106.248482 }, NY: { lat: 42.165726, lng: -74.948051 },
  NC: { lat: 35.630066, lng: -79.806419 }, ND: { lat: 47.528912, lng: -99.784012 },
  OH: { lat: 40.388783, lng: -82.764915 }, OK: { lat: 35.565342, lng: -96.928917 },
  OR: { lat: 44.572021, lng: -122.070938 }, PA: { lat: 40.590752, lng: -77.209755 },
  RI: { lat: 41.680893, lng: -71.51178 }, SC: { lat: 33.856892, lng: -80.945007 },
  SD: { lat: 44.299782, lng: -99.438828 }, TN: { lat: 35.747845, lng: -86.692345 },
  TX: { lat: 31.054487, lng: -97.563461 }, UT: { lat: 40.150032, lng: -111.862434 },
  VT: { lat: 44.045876, lng: -72.710686 }, VA: { lat: 37.769337, lng: -78.169968 },
  WA: { lat: 47.400902, lng: -121.490494 }, WV: { lat: 38.491226, lng: -80.954456 },
  WI: { lat: 44.268543, lng: -89.616508 }, WY: { lat: 42.755966, lng: -107.30249 },
  DC: { lat: 38.907192, lng: -77.036873 },
};

const NOMINATIM_USER_AGENT = 'FootballCampFinder-SeedScript/1.0 (one-time data import)';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Nominatim's usage policy requires max 1 request/sec and a descriptive
// User-Agent. We geocode each UNIQUE "City, ST" combo exactly once and
// cache/reuse the result across all rows that share it (111 unique combos
// across the 431 rows), with retries before falling back to the state
// centroid.
async function geocodeCityState(city: string, state: string): Promise<{ lat: number; lng: number }> {
  const query = encodeURIComponent(`${city}, ${state}, USA`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_USER_AGENT } });
      if (res.ok) {
        const results = (await res.json()) as Array<{ lat: string; lon: string }>;
        if (results.length > 0) {
          return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        }
      }
    } catch (err) {
      console.warn(`  ! Geocode attempt ${attempt} failed for "${city}, ${state}":`, (err as Error).message);
    }
    await sleep(1200); // respect Nominatim's 1 req/sec rate limit before retrying
  }

  console.warn(`  ! Falling back to state centroid for "${city}, ${state}".`);
  return STATE_CENTROIDS[state] || STATE_CENTROIDS.NY;
}

function buildDescription(host: string | null, rawType: string, city: string, state: string): string {
  const hostPart = host ? `Hosted by ${host}. ` : '';
  return `${hostPart}${rawType.trim()} camp in ${city}, ${state}.`;
}

async function main() {
  console.log(`Connecting to Firestore project: ${firebaseConfig.projectId}\n`);

  console.log(`Reading "${EXCEL_PATH}"...`);
  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });
  console.log(`Read ${rawRows.length} rows from sheet "${workbook.SheetNames[0]}".\n`);

  // --- Step 1: Geocode every UNIQUE City/State combo exactly once ---
  const uniqueCityStates = new Map<string, { city: string; state: string }>();
  for (const row of rawRows) {
    const city = (row['CITY'] || row['UNIVERSITY / IND'] || 'Unknown').toString().trim();
    const state = (row['ST'] || 'NY').toString().trim();
    uniqueCityStates.set(`${city}|${state}`, { city, state });
  }

  console.log(`Geocoding ${uniqueCityStates.size} unique City/State combinations via OpenStreetMap Nominatim...`);
  const geocodeCache = new Map<string, { lat: number; lng: number }>();
  let geocodedCount = 0;
  for (const [key, { city, state }] of uniqueCityStates) {
    const coords = await geocodeCityState(city, state);
    geocodeCache.set(key, coords);
    geocodedCount++;
    console.log(`  (${geocodedCount}/${uniqueCityStates.size}) ${city}, ${state} -> ${coords.lat}, ${coords.lng}`);
    await sleep(1100); // stay comfortably under Nominatim's 1 req/sec limit
  }
  console.log('Geocoding complete.\n');

  // --- Step 2: Map every row onto the FootballCamp shape ---
  const seedCamps: SeedCamp[] = rawRows.map((row) => {
    const name = (row['CAMP NAME'] || 'Untitled Camp').toString().trim();
    const rawType = (row['TYPE'] || 'All Positions').toString().trim();
    const city = (row['CITY'] || row['UNIVERSITY / IND'] || 'Unknown').toString().trim();
    const state = (row['ST'] || 'NY').toString().trim();
    const startDate = parseStartDate(row['DATE']);
    const endDate = computeEndDate(startDate, rawType);
    const location = geocodeCache.get(`${city}|${state}`) || STATE_CENTROIDS[state] || STATE_CENTROIDS.NY;

    return {
      name,
      type: mapCampType(rawType),
      startDate,
      endDate,
      address: `${city}, ${state}`,
      city,
      state,
      description: buildDescription(row['UNIVERSITY / IND'], rawType, city, state),
      image: DEFAULT_IMAGE,
      price: DEFAULT_PRICE,
      websiteUrl: row['LINK'] ? row['LINK'].toString().trim() : undefined,
      location,
    };
  });

  console.log(`Mapped ${seedCamps.length} camps.\n`);

  // --- Step 3: Safely wipe the existing `camps` collection ---
  console.log('Wiping existing "camps" collection...');
  const existingSnapshot = await getDocs(collection(db, 'camps'));
  console.log(`Found ${existingSnapshot.size} existing camp documents to delete.`);

  const BATCH_LIMIT = 450; // Firestore batch write limit is 500 operations
  let deleteBatch = writeBatch(db);
  let deleteOpCount = 0;
  for (const docSnap of existingSnapshot.docs) {
    deleteBatch.delete(docSnap.ref);
    deleteOpCount++;
    if (deleteOpCount >= BATCH_LIMIT) {
      await deleteBatch.commit();
      deleteBatch = writeBatch(db);
      deleteOpCount = 0;
    }
  }
  if (deleteOpCount > 0) {
    await deleteBatch.commit();
  }
  console.log('Existing camps collection wiped.\n');

  // --- Step 4: Upload the real, geocoded camp list ---
  console.log(`Uploading ${seedCamps.length} real camps to Firestore...`);
  const campsRef = collection(db, 'camps');
  let uploadBatch = writeBatch(db);
  let uploadOpCount = 0;
  let uploaded = 0;
  for (const camp of seedCamps) {
    const newDocRef = doc(campsRef);
    uploadBatch.set(newDocRef, camp);
    uploadOpCount++;
    uploaded++;
    if (uploadOpCount >= BATCH_LIMIT) {
      await uploadBatch.commit();
      console.log(`  ... committed ${uploaded}/${seedCamps.length}`);
      uploadBatch = writeBatch(db);
      uploadOpCount = 0;
    }
  }
  if (uploadOpCount > 0) {
    await uploadBatch.commit();
  }

  console.log(`\nDone! Uploaded ${seedCamps.length} real camps with geocoded coordinates to Firestore.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed real camps:', error);
    process.exit(1);
  });
