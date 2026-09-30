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


