import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useAdvancedMarkerRef,
  useMap
} from '@vis.gl/react-google-maps';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Filter, 
  Navigation, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ExternalLink,
  Loader2,
  X,
  Trophy,
  Users,
  Zap,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isWithinInterval, parseISO, addDays } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CAMP_DATABASE, type FootballCamp } from './data/camps';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

const DEFAULT_CENTER = { lat: 34.0522, lng: -118.2437 }; // LA
const DEFAULT_ZOOM = 10;

// Simulated network latency for the "live database fetch" search experience.
const SEARCH_SIMULATION_MS = 800;

// Calculate distance between two points in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

const CAMP_TYPES: FootballCamp['type'][] = [
  'Youth', 'Middle School', 'Prospect', 'Team', 'Mega/Showcase',
  'Lineman', 'Specialty', 'QB/Passing', '7on7', 'Flag',
];

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS',
  Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA',
  Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT',
  Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
  Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV',
  Wisconsin: 'WI', Wyoming: 'WY',
};

const US_STATES = Object.keys(US_STATE_ABBREVIATIONS);

interface SearchFilters {
  types: FootballCamp['type'][];
  distanceMode: 'local' | 'states' | 'national';
  states: string[];
  startDate: string;
  endDate: string;
  year: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  types: [],
  distanceMode: 'local',
  states: [],
  startDate: '',
  endDate: '',
  year: String(new Date().getFullYear()),
};

const getTypeBadgeClasses = (type: FootballCamp['type']) => {
  switch (type) {
    case 'Youth': return 'bg-emerald-100 text-emerald-700';
    case 'Middle School': return 'bg-teal-100 text-teal-700';
    case 'Prospect': return 'bg-blue-100 text-blue-700';
    case 'Team': return 'bg-indigo-100 text-indigo-700';
    case 'Mega/Showcase': return 'bg-amber-100 text-amber-900';
    case 'Lineman': return 'bg-stone-200 text-stone-700';
    case 'Specialty': return 'bg-violet-100 text-violet-700';
    case 'QB/Passing': return 'bg-sky-100 text-sky-700';
    case '7on7': return 'bg-pink-100 text-pink-700';
    case 'Flag': return 'bg-lime-100 text-lime-700';
    default: return 'bg-stone-100 text-stone-700';
  }
};

const getPinColorForLegend = (type: string) => {
  switch (type) {
    case 'Youth': return '#10b981'; // Emerald
    case 'Middle School': return '#14b8a6'; // Teal
    case 'Prospect': return '#3b82f6'; // Blue
    case 'Team': return '#6366f1'; // Indigo
    case 'Mega/Showcase': return '#f59e0b'; // Amber
    case 'Lineman': return '#78716c'; // Stone
    case 'Specialty': return '#8b5cf6'; // Violet
    case 'QB/Passing': return '#0ea5e9'; // Sky
    case '7on7': return '#ec4899'; // Pink
    case 'Flag': return '#84cc16'; // Lime
    default: return '#ef4444'; // Red
  }
};

const CampMarker = ({ camp, onClick }: { camp: FootballCamp; onClick: () => void; key?: string }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const getPinColor = getPinColorForLegend;

  return (
    <AdvancedMarker
      ref={markerRef}
      position={camp.location}
      onClick={onClick}
      title={camp.name}
    >
      <Pin 
        background={getPinColor(camp.type)} 
        glyphColor="#fff" 
        borderColor="#fff"
      />
    </AdvancedMarker>
  );
};


const SplashScreen = () => (
  <div className="flex items-center justify-center h-full bg-stone-50 font-sans p-6">
    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100">
      <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-green-200">
        <MapPin className="text-white w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-stone-900 text-center mb-4">Google Maps API Key Required</h2>
      <p className="text-stone-600 text-center mb-8">To enable GPS features and the interactive map, please add your API key.</p>
      
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
          <p className="text-sm text-stone-700">
            Get an API Key from the <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener" className="text-green-700 font-medium hover:underline">Google Cloud Console</a>
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
          <p className="text-sm text-stone-700">Open <strong>Settings</strong> (⚙️ gear icon, top-right)</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
          <p className="text-sm text-stone-700">Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> as a secret</p>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-stone-100 text-center">
        <p className="text-xs text-stone-400 italic">The app will rebuild automatically once the key is added.</p>
      </div>
    </div>
  </div>
);

const LOCAL_RADIUS_KM = 75;

type ViewType = 'welcome' | 'login' | 'register' | 'search' | 'guide' | 'locker' | 'reviews';

interface CampTypeGuideEntry {
  type: FootballCamp['type'];
  description: string;
}


const CAMP_TYPE_GUIDE: CampTypeGuideEntry[] = [
  {
    type: 'Youth',
    description: 'Entry-level camps for the youngest players (typically ages 6–12) focusing on fundamentals — footwork, catching, and safe tackling technique — in a fun, low-pressure environment.',
  },
  {
    type: 'Middle School',
    description: 'Camps geared toward players in grades 6–8, bridging youth fundamentals with more structured, position-specific instruction as athletes prepare for high school football.',
  },
  {
    type: 'Prospect',
    description: 'High-school-age camps built around exposure and evaluation. College coaches, scouts, and recruiting services often attend to assess talent and identify prospects.',
  },
  {
    type: 'Team',
    description: 'Camps run for an entire team rather than individual attendees, focused on installing schemes, building chemistry, and conditioning ahead of a season.',
  },
  {
    type: 'Mega/Showcase',
    description: 'Large-scale, multi-day events drawing hundreds or thousands of athletes, often featuring combine-style testing (40-yard dash, vertical jump), rankings, and heavy recruiting exposure.',
  },
  {
    type: 'Lineman',
    description: 'Position-specific camps for offensive and defensive linemen, emphasizing hand placement, footwork, leverage, and trench technique.',
  },
  {
    type: 'Specialty',
    description: 'Camps focused on a specific skill position or role — kickers, punters, long snappers, or receivers — with highly specialized, position-only coaching.',
  },
  {
    type: 'QB/Passing',
    description: 'Camps dedicated to quarterbacks and the passing game: mechanics, footwork, pocket presence, reads, and route timing with receivers.',
  },
  {
    type: '7on7',
    description: 'Passing-focused, no-contact competitive camps and leagues played 7-a-side, emphasizing route running, coverage, and quick decision-making.',
  },
  {
    type: 'Flag',
    description: "Non-contact flag football camps, ideal for beginners of any age, teaching the sport's basics without full-contact tackling.",
  },
];


function WelcomeScreen({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div className="relative h-[100dvh] w-full bg-[url('/cover.png')] bg-cover bg-center flex flex-col items-center justify-end overflow-hidden pt-[max(env(safe-area-inset-top),3rem)]">
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <div className="relative z-10 w-full max-w-md flex flex-col gap-4 px-5 pb-8">
        <button
          type="button"
          onClick={onLogin}
          className="w-full py-4 bg-green-700 text-white text-xl font-extrabold uppercase tracking-wider rounded-2xl shadow-2xl shadow-black/50 hover:bg-green-800 active:bg-green-900 transition-all hover:-translate-y-0.5"
        >
          Login
        </button>
        <button
          type="button"
          onClick={onRegister}
          className="w-full py-4 bg-yellow-400 text-green-900 text-xl font-extrabold uppercase tracking-wider rounded-2xl shadow-2xl shadow-black/50 hover:bg-yellow-300 active:bg-yellow-500 transition-all hover:-translate-y-0.5"
        >
          Create Account
        </button>
      </div>
    </div>
  );
}


function AuthScreen({
  mode,
  onBack,
  onSuccess,
}: {
  mode: 'login' | 'register';
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [accountType, setAccountType] = useState('Player/Parent');
  const isLogin = mode === 'login';

  // WARNING: Temporary testing bypass. Hardcoded credential check for QA only —
  // must be replaced with real authentication before shipping.
  const TEST_USERNAME = 'CoachChris51';
  const TEST_PASSWORD = 'TickerisSexy51';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');

    setTimeout(() => {
      if (isLogin) {
        if (email === TEST_USERNAME && password === TEST_PASSWORD) {
          onSuccess();
        } else {
          setAuthError('Invalid credentials');
        }
      } else {
        // Placeholder auth flow — no backend is wired up yet.
        // Any valid-looking submission proceeds straight to the search view.
        onSuccess();
      }
      setIsAuthenticating(false);
    }, 1200);
  };

  return (
    <div className="flex items-center justify-center h-[100dvh] bg-[url('/skin.png')] bg-cover bg-center bg-fixed p-5 pt-[max(env(safe-area-inset-top),3rem)]">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-5 border border-stone-100">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-stone-400 hover:text-green-700 uppercase tracking-wider mb-6 flex items-center gap-1"
        >
          <ChevronRight className="w-3 h-3 rotate-180" /> Back
        </button>
        <div className="w-14 h-14 bg-green-700 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-green-200">
          <Trophy className="text-white w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 text-center mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-stone-500 text-center text-sm mb-8">
          {isLogin ? 'Log in to find your next football camp.' : 'Sign up to start finding football camps.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Account Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Player', 'Coach', 'Camp'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountType(type)}
                    className={cn(
                      "py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border transition-all",
                      accountType === type
                        ? "bg-green-700 border-green-700 text-white shadow-md"
                        : "bg-stone-50 border-stone-200 text-stone-500 hover:border-green-300 hover:text-green-700"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Full Name</label>
              <input
                type="text"
                required
                placeholder="Jane Smith"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-green-600"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">
              {isLogin ? 'Username or Email' : 'Email'}
            </label>
            <input
              type={isLogin ? 'text' : 'email'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isLogin ? 'Username or you@example.com' : 'you@example.com'}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          {authError && (
            <p className="text-sm font-semibold text-red-600 text-center -mt-1">{authError}</p>
          )}
          <button
            type="submit"
            disabled={isAuthenticating}
            className={cn(
              "w-full py-4 bg-red-600 text-white text-lg font-extrabold uppercase tracking-wider rounded-2xl shadow-lg shadow-red-300/50 transition-all mt-2 flex items-center justify-center gap-2",
              isAuthenticating
                ? "opacity-80 cursor-not-allowed"
                : "hover:bg-red-700 active:bg-red-800 hover:-translate-y-0.5"
            )}
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Authenticating...
              </>
            ) : (
              isLogin ? 'Login' : 'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}


function CampTypesGuide() {
  return (
    <div className="h-full w-full flex overflow-x-auto snap-x snap-mandatory custom-scrollbar pt-[max(env(safe-area-inset-top),3rem)] pb-24">
      {CAMP_TYPE_GUIDE.map((entry, index) => (
        <div
          key={entry.type}
          className="w-full h-full shrink-0 snap-center flex flex-col items-center justify-center px-5 py-10 text-center"
        >
          <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/40 p-5">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/helmet.png" alt="" className="w-10 h-10 object-contain" />
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
                Camp Type {index + 1} / {CAMP_TYPE_GUIDE.length}
              </span>
            </div>
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg"
              style={{ backgroundColor: getPinColorForLegend(entry.type) }}
            >
              <Trophy className="text-white w-8 h-8" />
            </div>
            <span
              className={cn(
                'inline-block text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4',
                getTypeBadgeClasses(entry.type)
              )}
            >
              {entry.type}
            </span>
            <h3 className="text-xl font-extrabold text-stone-900 mb-3">{entry.type} Camps</h3>
            <p className="text-sm text-stone-600 leading-relaxed">{entry.description}</p>
            <img src="/helmet-logo.png" alt="FCF Helmet" className="w-24 h-24 object-contain mx-auto mt-6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LockerRoomView() {
  const [name, setName] = useState('Jordan Rivera');
  const [email, setEmail] = useState('jordan.rivera@example.com');
  const [bio, setBio] = useState(
    "6'2\" / 195 lbs — Wide Receiver. 4.52s 40-yard dash, 34\" vertical. Team captain, 2 varsity letters."
  );
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[url('/skin.png')] bg-cover bg-center bg-fixed pt-[max(env(safe-area-inset-top),3rem)] pb-24">
      <div className="flex items-center justify-center min-h-full p-5 py-10">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-5 border border-stone-100">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-12 h-12 bg-green-700 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
              <Users className="text-white w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-stone-900">My Locker Room</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:border-green-600 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:border-green-600 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Subscription Plan</label>
              <div className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-yellow-400 to-yellow-300 border-2 border-yellow-500 rounded-xl shadow-sm">
                <span className="text-sm font-extrabold text-green-900 uppercase tracking-wide flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Elite Prospect Tier
                </span>
                <span className="text-[10px] font-bold text-green-900/70 uppercase tracking-wider bg-white/40 px-2 py-1 rounded-full">
                  Active
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Bio / Player Stats</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="Height, weight, position, 40-yard dash, vertical jump, etc."
                className="w-full px-4 py-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:border-green-600 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-red-600 text-white text-lg font-extrabold uppercase tracking-wider rounded-2xl shadow-lg shadow-red-300/50 hover:bg-red-700 active:bg-red-800 transition-all hover:-translate-y-0.5 mt-2"
            >
              Save Changes
            </button>

            <AnimatePresence>
              {showSaved && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm font-bold text-green-700"
                >
                  Saved!
                </motion.p>
              )}
            </AnimatePresence>
          </form>
        </div>
      </div>
    </div>
  );
}


interface CampReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

const DUMMY_REVIEWS: CampReview[] = [
  {
    id: 'r1',
    author: 'Marcus T.',
    rating: 5,
    text: 'Coaches were fantastic, really improved my footwork. My son came home every night talking about the drills — worth every penny.',
    date: 'June 2025',
  },
  {
    id: 'r2',
    author: 'Angela P.',
    rating: 4,
    text: 'Well organized camp with great attention to safety. The only downside was the check-in line took a while on day one, but the coaching more than made up for it.',
    date: 'July 2025',
  },
  {
    id: 'r3',
    author: 'DeShawn W.',
    rating: 5,
    text: 'My daughter got real one-on-one time with a former college DB and it showed in her technique within a week. Already signed up for next summer.',
    date: 'August 2025',
  },
];

interface PlayerReview {
  id: string;
  author: string;
  text: string;
  date: string;
}

const DUMMY_PLAYER_REVIEWS: PlayerReview[] = [
  {
    id: 'p1',
    author: 'Coach Riley',
    text: 'Great teammate, runs sharp routes and always brings energy to practice.',
    date: 'June 2025',
  },
  {
    id: 'p2',
    author: 'Coach Alvarez',
    text: 'Hard worker with a great attitude. Communicates well with linemen and picks up new schemes fast.',
    date: 'July 2025',
  },
  {
    id: 'p3',
    author: 'Coach Nguyen',
    text: 'Reliable tackler with strong field awareness. A true leader in the defensive backfield.',
    date: 'August 2025',
  },
];

function StarRatingInput({ rating, onRate }: { rating: number; onRate: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          className="p-0.5"
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <Trophy
            className={cn(
              'w-6 h-6 transition-colors',
              star <= rating ? 'text-yellow-400' : 'text-stone-200'
            )}
            fill={star <= rating ? 'currentColor' : 'none'}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Trophy
          key={star}
          className={cn('w-4 h-4', star <= rating ? 'text-yellow-400' : 'text-stone-200')}
          fill={star <= rating ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );
}


function BottomNav({
  currentView,
  onNavigate,
}: {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-[100] bg-green-700 flex justify-around p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
      <button
        type="button"
        onClick={() => onNavigate('search')}
        className={cn(
          'flex flex-col items-center gap-1 transition-opacity',
          currentView === 'search' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
        )}
      >
        <img src="/football.png" alt="Search" className="w-8 h-8 object-contain" />
        <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Search</span>
      </button>
      <button
        type="button"
        onClick={() => onNavigate('guide')}
        className={cn(
          'flex flex-col items-center gap-1 transition-opacity',
          currentView === 'guide' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
        )}
      >
        <img src="/helmet.png" alt="Types" className="w-8 h-8 object-contain" />
        <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Types</span>
      </button>
      <button
        type="button"
        onClick={() => onNavigate('reviews')}
        className={cn(
          'flex flex-col items-center gap-1 transition-opacity',
          currentView === 'reviews' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
        )}
      >
        <img src="/review.png" alt="Reviews" className="w-8 h-8 object-contain" />
        <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Reviews</span>
      </button>
      <button
        type="button"
        onClick={() => onNavigate('locker')}
        className={cn(
          'flex flex-col items-center gap-1 transition-opacity',
          currentView === 'locker' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
        )}
      >
        <img src="/locker.png" alt="Locker Room" className="w-8 h-8 object-contain" />
        <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Locker Room</span>
      </button>
    </nav>
  );
}


type ReviewScreen = 'hub' | 'read-camp' | 'leave-camp' | 'read-player';

function BackToHubButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm font-bold text-green-700 hover:text-green-800 mb-4"
    >
      <ChevronLeft className="w-4 h-4" />
      Back to Hub
    </button>
  );
}

function ReviewsView({ selectedCamp }: { selectedCamp: FootballCamp | null }) {
  const [reviewScreen, setReviewScreen] = useState<ReviewScreen>('hub');
  const [newRating, setNewRating] = useState(0);
  const [newReviewText, setNewReviewText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [playerReviewText, setPlayerReviewText] = useState('');
  const [playerReviewSubmitted, setPlayerReviewSubmitted] = useState(false);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRating === 0) return;
    setSubmitted(true);
    setNewRating(0);
    setNewReviewText('');
    setTimeout(() => setSubmitted(false), 2500);
  };

  const handleSubmitPlayerReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerReviewText.trim()) return;
    setPlayerReviewSubmitted(true);
    setPlayerReviewText('');
    setTimeout(() => setPlayerReviewSubmitted(false), 2500);
  };

  if (!selectedCamp && (reviewScreen === 'read-camp' || reviewScreen === 'leave-camp')) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[url('/skin.png')] bg-cover bg-center bg-fixed flex items-center justify-center p-5 pt-[max(env(safe-area-inset-top),3rem)] pb-24">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-4 border border-stone-100 text-center">
          <BackToHubButton onClick={() => setReviewScreen('hub')} />
          <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-4 mx-auto text-stone-300">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-stone-900 mb-2 text-lg">No Camp Selected</h3>
          <p className="text-sm text-stone-500">
            Please select a camp from the Search tab to view or leave a review.
          </p>
        </div>
      </div>
    );
  }

  if (reviewScreen === 'read-camp' && selectedCamp) {

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[url('/skin.png')] bg-cover bg-center bg-fixed pt-[max(env(safe-area-inset-top),3rem)] pb-24">
      <div className="max-w-2xl mx-auto p-5 py-6 space-y-4">
        <BackToHubButton onClick={() => setReviewScreen('hub')} />
        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <span className={cn(
            'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2',
            getTypeBadgeClasses(selectedCamp.type)
          )}>
            {selectedCamp.type}
          </span>
          <h2 className="text-lg font-extrabold text-stone-900">{selectedCamp.name}</h2>
          <div className="flex items-center gap-1 text-stone-500 text-xs mt-1">
            <MapPin className="w-3 h-3" />
            <span>{selectedCamp.address}</span>
          </div>
        </div>

        <div className="space-y-4">
          {DUMMY_REVIEWS.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl shadow-md p-4 border border-stone-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-stone-900 text-sm">{review.author}</span>
                <span className="text-[11px] text-stone-400 font-medium">{review.date}</span>
              </div>
              <ReviewStars rating={review.rating} />
              <p className="text-sm text-stone-600 leading-relaxed mt-3">{review.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  }

  if (reviewScreen === 'leave-camp' && selectedCamp) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[url('/skin.png')] bg-cover bg-center bg-fixed pt-[max(env(safe-area-inset-top),3rem)] pb-24">
      <div className="max-w-2xl mx-auto p-5 py-6 space-y-4">
        <BackToHubButton onClick={() => setReviewScreen('hub')} />
        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <span className={cn(
            'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2',
            getTypeBadgeClasses(selectedCamp.type)
          )}>
            {selectedCamp.type}
          </span>
          <h2 className="text-lg font-extrabold text-stone-900">{selectedCamp.name}</h2>
          <div className="flex items-center gap-1 text-stone-500 text-xs mt-1">
            <MapPin className="w-3 h-3" />
            <span>{selectedCamp.address}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <h3 className="font-bold text-stone-900 mb-4 text-lg">Leave a Review</h3>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Your Rating</label>
              <StarRatingInput rating={newRating} onRate={setNewRating} />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Your Review</label>
              <textarea
                value={newReviewText}
                onChange={(e) => setNewReviewText(e.target.value)}
                rows={4}
                placeholder="Tell other parents and players about your experience at this camp..."
                className="w-full px-4 py-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:border-green-600 transition-colors resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={newRating === 0}
              className={cn(
                "w-full py-3 text-white text-sm font-extrabold uppercase tracking-wider rounded-2xl shadow-lg transition-all",
                newRating === 0
                  ? "bg-red-300 shadow-red-100 cursor-not-allowed"
                  : "bg-red-600 shadow-red-300/50 hover:bg-red-700 active:bg-red-800 hover:-translate-y-0.5"
              )}
            >
              Submit Review
            </button>
            <AnimatePresence>
              {submitted && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm font-bold text-green-700"
                >
                  Thanks — your review was submitted!
                </motion.p>
              )}
            </AnimatePresence>
          </form>
        </div>
      </div>
    </div>
  );
  }

  if (reviewScreen === 'read-player') {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[url('/skin.png')] bg-cover bg-center bg-fixed pt-[max(env(safe-area-inset-top),3rem)] pb-24">
      <div className="max-w-2xl mx-auto p-5 py-6 space-y-4">
        <BackToHubButton onClick={() => setReviewScreen('hub')} />
        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <h2 className="text-lg font-extrabold text-stone-900">Player Reviews</h2>
          <p className="text-sm text-stone-500 mt-1">Feedback from coaches and camp staff.</p>
        </div>

        <div className="space-y-4">
          {DUMMY_PLAYER_REVIEWS.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl shadow-md p-4 border border-stone-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-stone-900 text-sm">{review.author}</span>
                <span className="text-[11px] text-stone-400 font-medium">{review.date}</span>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed mt-1">{review.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  }

  // Default: 'hub'
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[url('/skin.png')] bg-cover bg-center bg-fixed pt-[max(env(safe-area-inset-top),3rem)] pb-24">
      <div className="max-w-2xl mx-auto p-5 py-6 space-y-4">
        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-green-700" />
            <h2 className="text-lg font-extrabold text-stone-900">Camp Reviews</h2>
          </div>
          <p className="text-sm text-stone-500 mb-5">
            {selectedCamp ? `Reviews for ${selectedCamp.name}` : 'Select a camp from Search to read or leave a camp review.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setReviewScreen('read-camp')}
              className="w-full py-3 bg-stone-50 border-2 border-stone-200 text-stone-900 text-sm font-extrabold uppercase tracking-wide rounded-2xl hover:border-green-600 hover:text-green-700 transition-all"
            >
              Read Reviews
            </button>
            <button
              type="button"
              onClick={() => setReviewScreen('leave-camp')}
              className="w-full py-3 bg-red-600 text-white text-sm font-extrabold uppercase tracking-wide rounded-2xl shadow-lg shadow-red-300/50 hover:bg-red-700 active:bg-red-800 transition-all hover:-translate-y-0.5"
            >
              Leave Review
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-green-700" />
            <h2 className="text-lg font-extrabold text-stone-900">Player Reviews</h2>
          </div>
          <p className="text-sm text-stone-500 mb-5">Quickly leave feedback on a player, or browse existing reviews.</p>

          <form onSubmit={handleSubmitPlayerReview} className="space-y-4 mb-5">
            <textarea
              value={playerReviewText}
              onChange={(e) => setPlayerReviewText(e.target.value)}
              rows={3}
              placeholder="Quickly write a player review..."
              className="w-full px-4 py-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:border-green-600 transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={!playerReviewText.trim()}
              className={cn(
                "w-full py-3 text-white text-sm font-extrabold uppercase tracking-wider rounded-xl shadow-lg transition-all",
                !playerReviewText.trim()
                  ? "bg-red-300 shadow-red-100 cursor-not-allowed"
                  : "bg-red-600 shadow-red-300/50 hover:bg-red-700 active:bg-red-800 hover:-translate-y-0.5"
              )}
            >
              Submit Player Review
            </button>
            <AnimatePresence>
              {playerReviewSubmitted && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm font-bold text-green-700"
                >
                  Thanks — your player review was submitted!
                </motion.p>
              )}
            </AnimatePresence>
          </form>

          <button
            type="button"
            onClick={() => setReviewScreen('read-player')}
            className="w-full py-3 bg-stone-50 border-2 border-stone-200 text-stone-900 text-sm font-extrabold uppercase tracking-wide rounded-2xl hover:border-green-600 hover:text-green-700 transition-all"
          >
            Read Player Reviews
          </button>
        </div>
      </div>
    </div>
  );
}


function SearchView({
  selectedCamp,
  setSelectedCamp,
}: {
  selectedCamp: FootballCamp | null;
  setSelectedCamp: (camp: FootballCamp | null) => void;
}) {
  // Draft filters are bound to the UI controls but do NOT affect the map/results
  // until the user explicitly presses "FIND MY CAMP".
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  // appliedFilters is only ever updated by the search button click handler.
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  // isSearching simulates a live database/API fetch delay between clicking
  // "FIND MY CAMP" and the results actually becoming available.
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStatesDropdownOpen, setIsStatesDropdownOpen] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          console.warn("Geolocation permission denied or failed.");
        }
      );
    }
  }, []);

  // Clean up any pending simulated-fetch timeout on unmount.
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // The map/list only reflects camps once the user has clicked "FIND MY CAMP".
  // Changing draftFilters never recomputes this list.
  const filteredCamps = useMemo(() => {
    if (!appliedFilters) return [];

    return CAMP_DATABASE.filter(camp => {
      // Camp type filter (pill menu) — empty selection means "all types"
      const matchesType = appliedFilters.types.length === 0 || appliedFilters.types.includes(camp.type);

      // Distance filter
      let matchesDistance: boolean;
      if (appliedFilters.distanceMode === 'local') {
        // Local mode requires a known user location — without one there is no
        // radius to measure against, so nothing can match.
        matchesDistance = Boolean(userLocation) && getDistance(
          userLocation!.lat, userLocation!.lng, camp.location.lat, camp.location.lng
        ) <= LOCAL_RADIUS_KM;
      } else if (appliedFilters.distanceMode === 'states') {
        // States mode requires at least one selected state — without one there
        // is nothing to match against.
        matchesDistance = appliedFilters.states.length > 0 && appliedFilters.states.some(state => {
          const abbr = US_STATE_ABBREVIATIONS[state];
          return abbr ? new RegExp(`\\b${abbr}\\b`).test(camp.address) : camp.address.includes(state);
        });
      } else {
        // 'national' imposes no distance restriction.
        matchesDistance = true;
      }

      // Date range filter (optional — only applied when the user filled in dates)
      let matchesDate = true;
      if (appliedFilters.startDate && appliedFilters.endDate) {
        const campStart = parseISO(camp.startDate);
        const campEnd = parseISO(camp.endDate);
        const filterStart = parseISO(appliedFilters.startDate);
        const filterEnd = parseISO(appliedFilters.endDate);

        matchesDate = (
          isWithinInterval(campStart, { start: filterStart, end: filterEnd }) ||
          isWithinInterval(campEnd, { start: filterStart, end: filterEnd })
        );
      }

      // Year filter (optional)
      let matchesYear = true;
      if (appliedFilters.year) {
        matchesYear = camp.startDate.startsWith(appliedFilters.year) || camp.endDate.startsWith(appliedFilters.year);
      }

      return matchesType && matchesDistance && matchesDate && matchesYear;
    });
  }, [appliedFilters, userLocation]);

  const toggleType = useCallback((type: FootballCamp['type']) => {
    setDraftFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  }, []);

  const toggleState = useCallback((state: string) => {
    setDraftFilters(prev => {
      const isSelected = prev.states.includes(state);
      if (isSelected) {
        return { ...prev, states: prev.states.filter(s => s !== state) };
      }
      if (prev.states.length >= 5) return prev; // cap at 5 states
      return { ...prev, states: [...prev.states, state] };
    });
  }, []);

  // Simulates hitting a live camps database: shows a loading state for
  // SEARCH_SIMULATION_MS before the filters are actually applied to the
  // map/list.
  const handleFindMyCamp = useCallback(() => {
    setIsStatesDropdownOpen(false);
    setIsSearching(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setAppliedFilters(draftFilters);
      setHasSearched(true);
      setIsSearching(false);
      searchTimeoutRef.current = null;
    }, SEARCH_SIMULATION_MS);
  }, [draftFilters]);

  if (!hasValidKey) {
    return <SplashScreen />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-stone-50 font-sans">

      {/* Search Overlay — full-screen translucent overlay, floats above the permanent background map; scrolls as a single page */}
      <motion.div
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : '-100%' }}
        className="absolute inset-0 z-10 w-full h-full flex flex-col bg-white/90 backdrop-blur-md overflow-y-auto pb-24"
      >
        <div className="p-4 border-b border-stone-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
                <Trophy className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-stone-900">Football Camp Finder</h1>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Top: Camp Type pill menu (horizontally scrollable) */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Filter className="w-3 h-3" /> Camp Type
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
              {CAMP_TYPES.map((type) => {
                const isActive = draftFilters.types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={cn(
                      "shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide border transition-all whitespace-nowrap",
                      isActive
                        ? "bg-green-700 border-green-700 text-white shadow-md"
                        : "bg-stone-50 border-stone-200 text-stone-600 hover:border-green-300 hover:text-green-700"
                    )}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Middle: Distance segmented control */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Navigation className="w-3 h-3" /> Distance
            </label>
            <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl">
              {([
                { key: 'local', label: 'Local' },
                { key: 'states', label: 'States (choose up to 5)' },
                { key: 'national', label: 'National' },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDraftFilters(prev => ({ ...prev, distanceMode: option.key }))}
                  className={cn(
                    "py-2 rounded-lg text-[10px] leading-tight font-bold uppercase tracking-wide transition-all",
                    draftFilters.distanceMode === option.key
                      ? "bg-white text-green-700 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>


            {draftFilters.distanceMode === 'states' && (
              <div className="mt-3 relative">
                {isStatesDropdownOpen && (
                  <div className="fixed inset-0 z-20" onClick={() => setIsStatesDropdownOpen(false)} />
                )}
                <button
                  type="button"
                  onClick={() => setIsStatesDropdownOpen(prev => !prev)}
                  className="relative z-30 w-full flex items-center justify-between px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-600 focus:outline-none"
                >
                  <span className="truncate">
                    {draftFilters.states.length > 0
                      ? `${draftFilters.states.join(', ')} (${draftFilters.states.length}/5)`
                      : 'Choose up to 5 states'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                </button>
                {isStatesDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-xl">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {US_STATES.map((state) => {
                        const isSelected = draftFilters.states.includes(state);
                        const isDisabled = !isSelected && draftFilters.states.length >= 5;
                        return (
                          <button
                            key={state}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => toggleState(state)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex items-center justify-between",
                              isSelected ? "bg-green-50 text-green-700 font-semibold" : "text-stone-600",
                              isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-stone-50"
                            )}
                          >
                            {state}
                            {isSelected && <span className="text-green-600">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    {draftFilters.states.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsStatesDropdownOpen(false)}
                        className="w-full py-2.5 bg-green-700 text-white text-xs font-bold uppercase tracking-wider rounded-b-lg hover:bg-green-800 active:bg-green-900 transition-colors"
                      >
                        Confirm States
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Middle-bottom: Date inputs */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 w-3 h-3" />
                <input 
                  type="date"
                  value={draftFilters.startDate}
                  onChange={(e) => setDraftFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full pl-7 pr-2 py-2 bg-stone-50 border border-stone-200 rounded-lg text-[11px] focus:outline-none focus:border-green-600"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 w-3 h-3" />
                <input 
                  type="date"
                  value={draftFilters.endDate}
                  onChange={(e) => setDraftFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full pl-7 pr-2 py-2 bg-stone-50 border border-stone-200 rounded-lg text-[11px] focus:outline-none focus:border-green-600"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Year</label>
              <input 
                type="number"
                placeholder="2026"
                value={draftFilters.year}
                onChange={(e) => setDraftFilters(prev => ({ ...prev, year: e.target.value }))}
                className="w-full px-2 py-2 bg-stone-50 border border-stone-200 rounded-lg text-[11px] focus:outline-none focus:border-green-600"
              />
            </div>
          </div>

          {/* Bottom: Massive red "FIND MY CAMP" button */}
          <button
            type="button"
            onClick={handleFindMyCamp}
            disabled={isSearching}
            className={cn(
              "w-full py-4 bg-red-600 text-white text-lg font-extrabold uppercase tracking-wider rounded-2xl shadow-lg shadow-red-300/50 transition-all flex items-center justify-center gap-2",
              isSearching
                ? "opacity-80 cursor-not-allowed"
                : "hover:bg-red-700 active:bg-red-800 hover:shadow-xl hover:-translate-y-0.5"
            )}
          >
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Searching...
              </>
            ) : (
              'Find My Camp'
            )}
          </button>
        </div>


        {/* Camp List */}
        <div className="p-4 space-y-4 custom-scrollbar">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-sm font-medium text-stone-500">
              {isSearching
                ? 'Searching live camp database...'
                : hasSearched
                  ? `${filteredCamps.length} camps found`
                  : 'Set your filters and search'}
            </span>
          </div>
          
          <AnimatePresence mode="popLayout">
            {isSearching ? (
              <motion.div
                key="loading-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl border border-stone-100 bg-white flex gap-4 animate-pulse"
                  >
                    <div className="w-20 h-20 rounded-xl bg-stone-200 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2 py-1">
                      <div className="h-3 w-16 bg-stone-200 rounded-full" />
                      <div className="h-4 w-3/4 bg-stone-200 rounded" />
                      <div className="h-3 w-full bg-stone-200 rounded" />
                      <div className="h-3 w-1/2 bg-stone-200 rounded" />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-center gap-2 text-stone-400 text-xs pt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching the latest camps near you...
                </div>
              </motion.div>
            ) : !hasSearched ? (
              <motion.div
                key="pre-search-state"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4 text-stone-300">
                    <Target className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-stone-900 mb-1">Ready when you are</h3>
                  <p className="text-sm text-stone-500">Pick your camp type, distance, and dates above, then press "FIND MY CAMP" to search.</p>
                </div>
              </motion.div>
            ) : filteredCamps.length > 0 ? (

              filteredCamps.map((camp) => (
                <motion.div
                  key={camp.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelectedCamp(camp)}
                  className={cn(
                    "group p-4 rounded-2xl border transition-all cursor-pointer",
                    selectedCamp?.id === camp.id 
                      ? "bg-green-50 border-green-200 shadow-md" 
                      : "bg-white border-stone-100 hover:border-stone-200 hover:shadow-sm"
                  )}
                >
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-stone-100">
                      <img 
                        src={camp.image} 
                        alt={camp.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                          getTypeBadgeClasses(camp.type)
                        )}>
                          {camp.type}
                        </span>
                        <span className="text-xs font-bold text-amber-900 ml-auto">${camp.price}</span>
                      </div>
                      <h3 className="font-bold text-stone-900 truncate group-hover:text-green-700 transition-colors">{camp.name}</h3>
                      <div className="flex items-center gap-1 text-stone-500 text-xs mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{camp.address}</span>
                      </div>
                      <div className="flex items-center gap-1 text-stone-500 text-xs mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{format(parseISO(camp.startDate), 'MMM d')} - {format(parseISO(camp.endDate), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={camp.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 bg-green-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-green-800 transition-colors"
                  >
                    Visit Camp Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </motion.div>
              ))
            ) : (

              <motion.div
                key="empty-state"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4 text-stone-300">
                    <Search className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-stone-900 mb-1">No camps found</h3>
                  <p className="text-sm text-stone-500">Try adjusting your filters or search query to find more results.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>


      {/* Background Map — always rendered full-screen at the bottom layer; the search overlay floats above it */}
      <div className="absolute inset-0 z-0">
        {!isSidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-[max(env(safe-area-inset-top),1.5rem)] left-4 z-20 p-2 bg-white rounded-xl shadow-xl border border-stone-100 text-stone-600 hover:text-green-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        )}

        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
            disableDefaultUI={true}
            zoomControl={true}
            gestureHandling={'greedy'}
          >
            {filteredCamps.map(camp => (
              <CampMarker 
                key={camp.id} 
                camp={camp} 
                onClick={() => setSelectedCamp(camp)} 
              />
            ))}

            {userLocation && (
              <AdvancedMarker position={userLocation}>
                <div className="relative">
                  <div className="w-6 h-6 bg-green-700 rounded-full border-2 border-white shadow-lg animate-pulse" />
                  <div className="absolute inset-0 w-6 h-6 bg-green-700 rounded-full animate-ping opacity-25" />
                </div>
              </AdvancedMarker>
            )}


            {selectedCamp && (
              <InfoWindow
                position={selectedCamp.location}
                onCloseClick={() => setSelectedCamp(null)}
                headerDisabled
              >
                <div className="p-1 max-w-[240px]">
                  <img 
                    src={selectedCamp.image} 
                    alt={selectedCamp.name} 
                    className="w-full h-32 object-cover rounded-lg mb-3"
                    referrerPolicy="no-referrer"
                  />
                  <h3 className="font-bold text-stone-900 mb-1 leading-tight">{selectedCamp.name}</h3>
                  <p className="text-xs text-stone-500 mb-3 line-clamp-2">{selectedCamp.description}</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-amber-900">${selectedCamp.price}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      getTypeBadgeClasses(selectedCamp.type)
                    )}>
                      {selectedCamp.type}
                    </span>
                  </div>
                  <a
                    href={selectedCamp.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-green-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-green-800 transition-colors"
                  >
                    Visit Camp Website
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>

        {/* Map Overlays */}
        <div className="absolute bottom-10 right-10 flex flex-col gap-3 max-w-[70vw]">
          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 flex items-center gap-4 flex-wrap">
            {CAMP_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getPinColorForLegend(type) }}
                />
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-tighter">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('welcome');
  const [selectedCamp, setSelectedCamp] = useState<FootballCamp | null>(null);

  return (
    <>
      {currentView === 'welcome' && (
        <WelcomeScreen
          onLogin={() => setCurrentView('login')}
          onRegister={() => setCurrentView('register')}
        />
      )}

      {currentView === 'login' && (
        <AuthScreen
          mode="login"
          onBack={() => setCurrentView('welcome')}
          onSuccess={() => setCurrentView('search')}
        />
      )}

      {currentView === 'register' && (
        <AuthScreen
          mode="register"
          onBack={() => setCurrentView('welcome')}
          onSuccess={() => setCurrentView('search')}
        />
      )}

      {(currentView === 'search' || currentView === 'guide' || currentView === 'locker' || currentView === 'reviews') && (
        <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[url('/skin.png')] bg-cover bg-fixed">
          <div className="flex-1 min-h-0 overflow-hidden">
            {currentView === 'search' && (
              <div className="h-full relative overflow-hidden">
                <SearchView selectedCamp={selectedCamp} setSelectedCamp={setSelectedCamp} />
              </div>
            )}
            {currentView === 'guide' && (
              <div className="h-full overflow-y-auto">
                <CampTypesGuide />
              </div>
            )}
            {currentView === 'locker' && (
              <div className="h-full overflow-y-auto">
                <LockerRoomView />
              </div>
            )}
            {currentView === 'reviews' && (
              <div className="h-full overflow-y-auto">
                <ReviewsView selectedCamp={selectedCamp} />
              </div>
            )}
          </div>
          <BottomNav currentView={currentView} onNavigate={setCurrentView} />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e7e5e4;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d6d3d1;
        }
      `}} />
    </>
  );
}

