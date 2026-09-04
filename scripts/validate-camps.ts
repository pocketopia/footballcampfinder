import { CAMP_DATABASE, type FootballCamp } from '../src/data/camps';

const STRICT_TYPES: FootballCamp['type'][] = [
  'Youth', 'Middle School', 'Prospect', 'Team', 'Mega/Showcase',
  'Lineman', 'Specialty', 'QB/Passing', '7on7', 'Flag',
];

let errors = 0;

if (CAMP_DATABASE.length !== 431) {
  console.error('Expected 431 camps, got', CAMP_DATABASE.length);
  errors++;
}

const ids = new Set<string>();
for (const camp of CAMP_DATABASE) {
  if (ids.has(camp.id)) { console.error('Duplicate id', camp.id); errors++; }
  ids.add(camp.id);

  if (!STRICT_TYPES.includes(camp.type)) { console.error('Bad type', camp.type, camp.id); errors++; }
  if (typeof camp.websiteUrl !== 'string' || !camp.websiteUrl.startsWith('http')) { console.error('Bad websiteUrl', camp.id, camp.websiteUrl); errors++; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(camp.startDate)) { console.error('Bad startDate', camp.id, camp.startDate); errors++; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(camp.endDate)) { console.error('Bad endDate', camp.id, camp.endDate); errors++; }
  if (camp.price < 100 || camp.price > 500) { console.error('Price out of range', camp.id, camp.price); errors++; }
  if (typeof camp.location.lat !== 'number' || typeof camp.location.lng !== 'number' || Number.isNaN(camp.location.lat) || Number.isNaN(camp.location.lng)) {
    console.error('Bad location', camp.id, camp.location); errors++;
  }
  if (!camp.image.startsWith('https://commons.wikimedia.org')) { console.error('Bad image', camp.id, camp.image); errors++; }
}

console.log('Total camps:', CAMP_DATABASE.length);
console.log('Unique ids:', ids.size);
console.log('Validation errors:', errors);
if (errors > 0) process.exit(1);
