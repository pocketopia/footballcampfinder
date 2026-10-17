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
    slug: 'specialty',
    name: 'Specialty',
    targetAge: 'Kickers / Punters / Long-Snappers',
    description:
      'Specifically designed for kickers, punters and long-snappers. Each camp site will have its own specifics, be sure to check their website.These camps are a great way for high school kickers & punters and special-teamers to receive intensive, position-specific training by college coaches. Players will gain exposure, be able to evaluate and perform against competition, and improve their skills in the off-season.',
  },
  {
    slug: 'youth',
    name: 'Youth',
    targetAge: 'Ages 6-12',
    description:
      'Typically consists of ages 6-12, or elementary school age. Each camp site will have its own specifics, be sure to check their website. Entry-level camps designed to teach basic fundamentals and rules of the game in a fun low-pressure environment. These camps should be based on athletic and mental development and sportsmanship, not competition.',
  },
  {
    slug: 'lineman-big-man',
    name: 'Lineman / Big-Man',
    targetAge: 'High School',
    description:
      'Camps specifically designed for offensive & defensive lineman. Each camp site will have its own specifics, be sure to check their website.These camps are a great way for high school linemen to receive intensive, position-specific training by college coaches or former professional players. Athletes will gain exposure, be able to evaluate and perform against competition, and improve their skills, agility, techniques and conditioning in the off-season.',
  },
  {
    slug: 'prospect',
    name: 'Prospect',
    targetAge: 'High School',
    description:
      'Advanced 1-day camps held by colleges or private companies to evaluate high school players. Athletes will display their skills through combine testing, metrics, drills and competition to gain high exposure and experience. These camps are also used as a legal way for colleges to recruit specific talent and talk to underclassmen they have interest in. They are typically run and coached by the hosting college coaching staff or a private company may rent a field at a local high school for the day.',
  },
  {
    slug: 'team',
    name: 'Team',
    targetAge: 'High School Teams',
    description:
      'For high school teams. Each camp site will have its own specifics, be sure to check their website.These camps are a great way for high school teams to train together, condition, improve team chemistry, evaluate new or young players in action against competition, and install new plays and schemes. Team camps are typically held at colleges or universities and run by college coaching staffs.',
  },
  {
    slug: '7on7',
    name: '7on7',
    targetAge: 'High School Teams',
    description:
      'These camps are passing-focused, non-contact, highly-competitive tournaments for team play. 7 on 7 camps held at colleges are typically run by the hosting coaching staff and can be used as a platform to evaluate prospects and talent. However, exposure is not as high as a Mega camp, Showcase or Prospect camp.Most of these events typically conclude with bracket-stye playoffs and awarded champions.',
  },
  {
    slug: 'qb-passing',
    name: 'QB/Passing',
    targetAge: 'Quarterbacks / Receivers',
    description:
      'Camps specifically dedicated for quarterbacks, but are usually accompanied with receivers. Each camp site will have its own specifics, be sure to check their website.These camps are a great way for high school quarterbacks to receive intensive, position-specific training by college coaches. Expect drills with a high-focus on mechanics, footwork, accuracy and route throwing, typically ending with competition. Athletes will gain exposure and good preparation for the upcoming season.',
  },
  {
    slug: 'mega-showcase',
    name: 'Mega/Showcase',
    targetAge: 'High School',
    description:
      'MEGA CAMPS: Large-scale advanced camps typically held at colleges. They often feature combine-style testing (40-Yard dash, Pro Agility, Broad Jump). Players will perform through drills and competition in front of various visiting colleges to gain high exposure and experience. Expect hundreds of athletes in attendance. SHOWCASES: Open or invite-only advanced camps that may be hosted by a single college or feature several colleges, with media and metrics to evaluate players through combine testing, drills and competition. Players gain exposure and experience. Expect large numbers of athletes in attendance.',
  },
  {
    slug: 'middle-school',
    name: 'Middle School',
    targetAge: 'Grades 6-8',
    description:
      'Typically consists of 6th-8th grade. Each camp site will have its own specifics, be sure to check their website.These camps will teach fundamentals and be somewhat competitive. Coaches will begin to teach more position-specific drills. They are a great way to learn the game before the season or polish/improve skills for more advanced players. These camps can be more award and goal-oriented.',
  },
  {
    slug: 'flag',
    name: 'Flag',
    targetAge: 'All Ages',
    description:
      'Camps can be exclusively for girls, boys or coed. Each camp site will have its own specifics, be sure to check their website.Look for these camps to teach game rules and fundamental skills. They are non-contact and can help beginner, intermediate or advanced players. They can be competitive, depending upon age requirements. Coaches will begin to teach more position-specific drills, plays and schemes while focusing on development.',
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
