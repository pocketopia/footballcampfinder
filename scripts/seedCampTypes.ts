/**
 * scripts/seedCampTypes.ts
 *
 * Standalone seeding script for the live `campTypes` Firestore collection.
 * This does NOT touch any frontend code — it connects directly to Firestore
 * using the same project credentials as the app (loaded from .env.local)
 * and writes real, production-ready camp type documents.
 *
 * Usage:
 *   npx tsx scripts/seedCampTypes.ts
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env.local at the project root (same source the app uses).
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
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
  console.error(
    `Missing required Firebase env vars: ${missingKeys
      .map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`)
      .join(', ')}\n` +
      'Make sure .env.local exists at the project root with your Firebase config.'
  );
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface CampTypeSeed {
  slug: string;
  name: string;
  description: string;
  targetAge: string;
}

const campTypes: CampTypeSeed[] = [
  {
    slug: 'youth-fundamentals',
    name: 'Youth Fundamentals',
    targetAge: 'Ages 8-12',
    description:
      'A fun, high-energy introduction to the game built around athletic development and core football fundamentals — proper stance, footwork, ball security, and basic route running. Coaches emphasize safety, sportsmanship, and building confidence through small-group drills and non-contact skill stations, giving young players a strong foundation before they step onto a competitive field.',
  },
  {
    slug: 'high-school-combine',
    name: 'High School Combine',
    targetAge: 'Ages 13-18',
    description:
      'A performance-based combine designed to benchmark and sharpen the athletic tools college and high school coaches look for. Athletes are timed and evaluated in the 40-yard dash, vertical jump, pro agility shuttle, and position-specific drills, then receive a personalized performance report with actionable feedback to guide their off-season training.',
  },
  {
    slug: 'elite-prospect',
    name: 'Elite Prospect',
    targetAge: 'Ages 16-18',
    description:
      'An invite-caliber camp for serious college prospects, featuring 1-on-1 and 7-on-7 competition in front of current and former college coaching staff. Sessions focus on advanced scheme reads, recruiting exposure, and film-backed feedback, giving top-tier juniors and seniors a genuine platform to showcase their game to recruiters.',
  },
  {
    slug: 'specialist-position',
    name: 'Specialist Position',
    targetAge: 'All Ages',
    description:
      'A focused technical camp for kickers, punters, and long snappers led by specialist coaches with collegiate and professional experience. Athletes work on mechanics, consistency, and mental approach through video breakdown, repetition-based drilling, and live-pressure reps, rounding out a skill set that is often overlooked at general camps.',
  },
];

async function seedCampTypes() {
  console.log(`Connecting to Firestore project: ${firebaseConfig.projectId}`);
  console.log(`Seeding ${campTypes.length} camp types into the "campTypes" collection...\n`);

  const campTypesRef = collection(db, 'campTypes');

  for (const campType of campTypes) {
    const { slug, ...data } = campType;
    await setDoc(doc(campTypesRef, slug), data, { merge: true });
    console.log(`  ✓ ${data.name} (${data.targetAge})`);
  }

  console.log('\nDone! The campTypes collection is now seeded with live data.');
}

seedCampTypes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed camp types:', error);
    process.exit(1);
  });
