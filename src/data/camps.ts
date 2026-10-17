export interface FootballCamp {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  address: string;
  startDate: string;
  endDate: string;
  price: number;
  description: string;
  image: string;
  type: 'Youth' | 'High School' | 'Elite' | 'Specialist';
  websiteUrl?: string;
}

export const INITIAL_CAMPS: FootballCamp[] = [
  {
    id: 'camp-1',
    name: 'USC Trojans Mega Prospect Showcase Camp',
    location: { lat: 34.0224, lng: -118.2851 },
    address: 'Los Angeles, CA',
    startDate: '2026-06-06',
    endDate: '2026-06-07',
    price: 125,
    description: 'High School Prospect, Mega & Showcase evaluation camp hosted at USC with combine metrics, position drills, and 1-on-1 competition.',
    image: '/cover.png',
    type: 'Elite',
    websiteUrl: 'https://usctrojans.com',
  },
  {
    id: 'camp-2',
    name: 'UCLA Bruins QB / Passing & 7on7 Tournament',
    location: { lat: 34.0689, lng: -118.4452 },
    address: 'Los Angeles, CA',
    startDate: '2026-06-13',
    endDate: '2026-06-14',
    price: 99,
    description: 'Quarterback, Receiver passing academy and high school 7 on 7 non-contact tournament play.',
    image: '/cover.png',
    type: 'Specialist',
    websiteUrl: 'https://uclabruins.com',
  },
  {
    id: 'camp-3',
    name: 'Texas Longhorns Trench Lineman / Big-Man Camp',
    location: { lat: 30.2836, lng: -97.7325 },
    address: 'Austin, TX',
    startDate: '2026-06-15',
    endDate: '2026-06-16',
    price: 110,
    description: 'Offensive & Defensive Lineman / Big-Man camp focused on pass protection, hand placement, footwork, and trench competition.',
    image: '/cover.png',
    type: 'High School',
    websiteUrl: 'https://texassports.com',
  },
  {
    id: 'camp-4',
    name: 'Ohio State Buckeyes High School Team & Prospect Camp',
    location: { lat: 40.0017, lng: -83.0197 },
    address: 'Columbus, OH',
    startDate: '2026-06-18',
    endDate: '2026-06-20',
    price: 115,
    description: 'High School Team and College Prospect camp featuring full-team periods, 7on7, and individual position coaching.',
    image: '/cover.png',
    type: 'High School',
    websiteUrl: 'https://ohiostatebuckeyes.com',
  },
  {
    id: 'camp-5',
    name: 'Georgia Bulldogs Youth & Middle School Fundamentals Camp',
    location: { lat: 33.9498, lng: -83.3734 },
    address: 'Athens, GA',
    startDate: '2026-06-08',
    endDate: '2026-06-10',
    price: 85,
    description: 'Youth and Middle School football development camp (ages 6-14) teaching fundamentals, non-contact Flag drills, and sportsmanship.',
    image: '/cover.png',
    type: 'Youth',
    websiteUrl: 'https://georgiadogs.com',
  },
  {
    id: 'camp-6',
    name: 'Kohl’s National Kicking, Punting & Long-Snapping Specialty Camp',
    location: { lat: 32.7357, lng: -97.1081 },
    address: 'Arlington, TX',
    startDate: '2026-06-22',
    endDate: '2026-06-23',
    price: 150,
    description: 'Specialty camp for kickers, punters, and long-snappers with charting, video breakdown, and college exposure.',
    image: '/cover.png',
    type: 'Specialist',
    websiteUrl: 'https://kohlskicking.com',
  },
  {
    id: 'camp-7',
    name: 'SoCal NextGen Coed Flag & Youth Skills Camp',
    location: { lat: 33.8003, lng: -117.8827 },
    address: 'Anaheim, CA',
    startDate: '2026-07-11',
    endDate: '2026-07-12',
    price: 75,
    description: 'All-ages Flag football and Youth/Middle School skills camp focused on speed, route running, defensive coverage, and schemes.',
    image: '/cover.png',
    type: 'Youth',
    websiteUrl: 'https://nflflag.com',
  },
  {
    id: 'camp-8',
    name: 'Alabama Crimson Tide Elite Prospect & Showcase Camp',
    location: { lat: 33.2084, lng: -87.5504 },
    address: 'Tuscaloosa, AL',
    startDate: '2026-06-25',
    endDate: '2026-06-26',
    price: 120,
    description: 'Elite College Prospect & Showcase camp with 40-yard dash testing, pro agility, position drills, and recruiting evaluation.',
    image: '/cover.png',
    type: 'Elite',
    websiteUrl: 'https://rolltide.com',
  },
];



