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
}

export const CAMP_DATABASE: FootballCamp[] = [
  {
    id: '1',
    name: 'Elite Quarterback Academy',
    location: { lat: 34.0522, lng: -118.2437 }, // Los Angeles
    address: '123 Football Way, Los Angeles, CA',
    startDate: '2026-06-15',
    endDate: '2026-06-20',
    price: 450,
    description: 'Intensive training for aspiring quarterbacks focusing on mechanics and decision making.',
    image: 'https://picsum.photos/seed/qb/800/600',
    type: 'Elite'
  },
  {
    id: '2',
    name: 'Junior Gridiron Camp',
    location: { lat: 34.1478, lng: -118.1445 }, // Pasadena
    address: '456 Rose Bowl Dr, Pasadena, CA',
    startDate: '2026-07-10',
    endDate: '2026-07-14',
    price: 250,
    description: 'Fun and fundamental football skills for ages 8-12.',
    image: 'https://picsum.photos/seed/junior/800/600',
    type: 'Youth'
  },
  {
    id: '3',
    name: 'Lineman Strength & Technique',
    location: { lat: 33.8366, lng: -117.9143 }, // Anaheim
    address: '789 Stadium Rd, Anaheim, CA',
    startDate: '2026-06-25',
    endDate: '2026-06-28',
    price: 350,
    description: 'Focus on hand placement, footwork, and leverage for offensive and defensive linemen.',
    image: 'https://picsum.photos/seed/lineman/800/600',
    type: 'High School'
  },
  {
    id: '4',
    name: 'Speed & Agility Showcase',
    location: { lat: 34.0211, lng: -118.4817 }, // Santa Monica
    address: '101 Ocean Ave, Santa Monica, CA',
    startDate: '2026-08-05',
    endDate: '2026-08-07',
    price: 200,
    description: 'Combine-style testing and speed development for all positions.',
    image: 'https://picsum.photos/seed/speed/800/600',
    type: 'Elite'
  },
  {
    id: '5',
    name: 'Kicking & Punting Specialist Camp',
    location: { lat: 33.6846, lng: -117.8265 }, // Irvine
    address: '202 Campus Dr, Irvine, CA',
    startDate: '2026-07-20',
    endDate: '2026-07-22',
    price: 300,
    description: 'Expert coaching for kickers, punters, and long snappers.',
    image: 'https://picsum.photos/seed/kicking/800/600',
    type: 'Specialist'
  }
];
