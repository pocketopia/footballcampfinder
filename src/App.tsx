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
  ExternalLink,
  Loader2,
  X,
  Trophy,
  Users,
  Zap,
  Target,
  User,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isWithinInterval, parseISO, addDays } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type FootballCamp } from './data/camps';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './lib/firebase';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

const DEFAULT_CENTER = { lat: 34.0522, lng: -118.2437 }; // LA
const DEFAULT_ZOOM = 10;

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

const CampMarker = ({ camp, onClick }: { camp: FootballCamp; onClick: () => void; key?: string }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  
  const getPinColor = (type: string) => {
    switch (type) {
      case 'Youth': return '#10b981'; // Emerald
      case 'High School': return '#3b82f6'; // Blue
      case 'Elite': return '#f59e0b'; // Amber
      case 'Specialist': return '#8b5cf6'; // Violet
      default: return '#ef4444'; // Red
    }
  };

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
  <div className="flex items-center justify-center h-screen bg-stone-50 font-sans p-6">
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

interface LockerRoomProfile {
  name: string;
  image: string;
  email: string;
  bio: string;
}

const LockerRoomModal = ({
  isOpen,
  onClose,
  profile,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: LockerRoomProfile;
  onSave: (profile: LockerRoomProfile) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localName, setLocalName] = useState(profile.name);
  const [localImage, setLocalImage] = useState(profile.image);
  const [localEmail, setLocalEmail] = useState(profile.email);
  const [localBio, setLocalBio] = useState(profile.bio);

  useEffect(() => {
    setLocalName(profile.name);
    setLocalImage(profile.image);
    setLocalEmail(profile.email);
    setLocalBio(profile.bio);
  }, [profile, isOpen]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setLocalImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveChanges = () => {
    onSave({ name: localName, image: localImage, email: localEmail, bio: localBio });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm relative max-h-[85vh] overflow-y-auto custom-scrollbar"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-stone-100 rounded-lg text-stone-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-xl font-bold text-stone-900 text-center mb-6">Locker Room</h2>

          <div className="flex flex-col items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative w-28 h-28 rounded-full bg-stone-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center group mx-auto"
            >
              {localImage ? (
                <img
                  src={localImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-12 h-12 text-stone-300" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>

            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Enter your name"
              className="w-full mt-6 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-center font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all box-border"
            />

            <input
              type="email"
              value={localEmail}
              onChange={(e) => setLocalEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full mt-4 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all box-border"
            />

            <div className="w-full mt-6 space-y-3">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block text-center">Subscription Plan</label>
              <p className="text-center text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg py-2 px-3">
                Currently FREE for App Store launch!
              </p>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <p className="font-extrabold text-stone-900">“BALLER” Full-Access:</p>
                <p className="text-sm text-stone-600">Unlimited Camp Search, Read & Leave Camp reviews, Find & promote player reviews. Hyper-links to camps & registration.</p>
                <p className="text-sm font-semibold text-stone-800 mt-1">Monthly $8.99&nbsp;&nbsp;Yearly $89.00</p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <p className="font-extrabold text-stone-900">“STARTER”</p>
                <p className="text-sm text-stone-600">Unlimited Camp Search. Hyper-links to camps & registration.</p>
                <p className="text-sm font-semibold text-stone-800 mt-1">Monthly $5.99&nbsp;&nbsp;Yearly $59.00</p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <p className="font-extrabold text-stone-900">“Walk-on”</p>
                <p className="text-sm text-stone-600">One-time 5-State search. Hyper-links to camps & registration.</p>
                <p className="text-sm font-semibold text-stone-800 mt-1">One-time fee $1.99</p>
              </div>
            </div>

            <div className="w-full mt-6">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Bio</label>
              <textarea
                value={localBio}
                onChange={(e) => setLocalBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={4}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all box-border resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveChanges}
              className="w-full mt-6 py-3 bg-green-700 text-white rounded-xl font-bold uppercase text-sm hover:bg-green-800 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

type ViewType = 'welcome' | 'login' | 'register' | 'search' | 'guide' | 'locker' | 'reviews';

function WelcomeScreen({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div className="relative h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-[url('/cover.png')] bg-cover bg-center flex flex-col items-center justify-end pt-[max(env(safe-area-inset-top),3rem)]">
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
  onSuccess: (email: string) => void;
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
          onSuccess(email);
        } else {
          setAuthError('Invalid credentials');
        }
      } else {
        // Placeholder auth flow — no backend is wired up yet.
        // Any valid-looking submission proceeds straight to the search view.
        onSuccess(email);
      }
      setIsAuthenticating(false);
    }, 1200);
  };
  return (
    <div className="flex items-center justify-center h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-[url('/skin.png')] bg-cover bg-center bg-fixed p-5 pt-[max(env(safe-area-inset-top),3rem)]">
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

function BottomNav({
  currentView,
  onNavigate,
}: {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-[100] bg-green-700 flex justify-around p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.2)] sm:hidden">
      <button
        type="button"
        onClick={() => onNavigate('search')}
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-1 transition-opacity',
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
          'flex-1 flex flex-col items-center justify-center gap-1 transition-opacity',
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
          'flex-1 flex flex-col items-center justify-center gap-1 transition-opacity',
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
          'flex-1 flex flex-col items-center justify-center gap-1 transition-opacity',
          currentView === 'locker' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
        )}
      >
        <img src="/locker.png" alt="Locker Room" className="w-8 h-8 object-contain" />
        <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Locker Room</span>
      </button>
    </nav>
  );
}

interface CampType {
  id: string;
  name: string;
  description: string;
  targetAge: string;
}

// Canonical client-drafted camp type categories & descriptions (verbatim).
// This is the single source of truth and overwrites the Firestore 'campTypes'
// collection on load so stale/altered copies are never shown.
const CANONICAL_CAMP_TYPES: { id: string; name: string; description: string }[] = [
  {
    id: 'specialty',
    name: 'SPECIALTY',
    description: "Specifically designed for kickers, punters and long-snappers. Each camp site will have its own specifics, be sure to check their website.These camps are a great way for high school kickers & punters and special-teamers to receive intensive, position-specific training by college coaches. Players will gain exposure, be able to evaluate and perform against competition, and improve their skills in the off-season.",
  },
  {
    id: 'youth',
    name: 'YOUTH',
    description: "Typically consists of ages 6-12, or elementary school age. Each camp site will have its own specifics, be sure to check their website. Entry-level camps designed to teach basic fundamentals and rules of the game in a fun low-pressure environment. These camps should be based on athletic and mental development and sportsmanship, not competition.",
  },
  {
    id: 'lineman-big-man',
    name: 'LINEMAN / BIG-MAN',
    description: "Camps specifically designed for offensive & defensive lineman. Each camp site will have its own specifics, be sure to check their website.These camps are a great way for high school linemen to receive intensive, position-specific training by college coaches or former professional players. Athletes will gain exposure, be able to evaluate and perform against competition, and improve their skills, agility, techniques and conditioning in the off-season.",
  },
  {
    id: 'prospect',
    name: 'PROSPECT',
    description: "Advanced 1-day camps held by colleges or private companies to evaluate high school players. Athletes will display their skills through combine testing, metrics, drills and competition to gain high exposure and experience. These camps are also used as a legal way for colleges to recruit specific talent and talk to underclassmen they have interest in. They are typically run and coached by the hosting college coaching staff or a private company may rent a field at a local high school for the day.",
  },
  {
    id: 'team',
    name: 'TEAM',
    description: "For high school teams. Each camp site will have its own specifics, be sure to check their website.These camps are a great way for high school teams to train together, condition, improve team chemistry, evaluate new or young players in action against competition, and install new plays and schemes. Team camps are typically held at colleges or universities and run by college coaching staffs.",
  },
  {
    id: '7on7',
    name: '7on7',
    description: "These camps are passing-focused, non-contact, highly-competitive tournaments for team play. 7 on 7 camps held at colleges are typically run by the hosting coaching staff and can be used as a platform to evaluate prospects and talent. However, exposure is not as high as a Mega camp, Showcase or Prospect camp.Most of these events typically conclude with bracket-stye playoffs and awarded champions.",
  },
  {
    id: 'qb-passing',
    name: 'QB / PASSING',
    description: "Camps specifically dedicated for quarterbacks, but are usually accompanied with receivers. Each camp site will have its own specifics, be sure to check their website.These camps are a great way for high school quarterbacks to receive intensive, position-specific training by college coaches. Expect drills with a high-focus on mechanics, footwork, accuracy and route throwing, typically ending with competition. Athletes will gain exposure and good preparation for the upcoming season.",
  },
  {
    id: 'mega-camps',
    name: 'MEGA CAMPS',
    description: "Large-scale advanced camps typically held at colleges. They often feature combine-style testing (40-Yard dash, Pro Agility, Broad Jump). Players will perform through drills and competition in front of various visiting colleges to gain high exposure and experience. Expect hundreds of athletes in attendance.",
  },
  {
    id: 'showcases',
    name: 'SHOWCASES',
    description: "Open or invite-only advanced camps that may be hosted by a single college or feature several colleges, with media and metrics to evaluate players through combine testing, drills and competition. Players gain exposure and experience. Expect large numbers of athletes in attendance.",
  },
  {
    id: 'middle-school',
    name: 'MIDDLE SCHOOL',
    description: "Typically consists of 6th-8th grade. Each camp site will have its own specifics, be sure to check their website.These camps will teach fundamentals and be somewhat competitive. Coaches will begin to teach more position-specific drills. They are a great way to learn the game before the season or polish/improve skills for more advanced players. These camps can be more award and goal-oriented.",
  },
  {
    id: 'flag',
    name: 'FLAG',
    description: "Camps can be exclusively for girls, boys or coed. Each camp site will have its own specifics, be sure to check their website.Look for these camps to teach game rules and fundamental skills. They are non-contact and can help beginner, intermediate or advanced players. They can be competitive, depending upon age requirements. Coaches will begin to teach more position-specific drills, plays and schemes while focusing on development.",
  },
];

function CampTypesGuide() {
  const [campTypes, setCampTypes] = useState<CampType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function syncCampTypes() {
      try {
        // One-time overwrite: wipe whatever exists in Firestore and replace it
        // with the canonical 11 client-drafted camp types verbatim, so any
        // previously altered copies are never shown again.
        const snapshot = await getDocs(collection(db, 'campTypes'));
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        CANONICAL_CAMP_TYPES.forEach((campType) => {
          batch.set(doc(db, 'campTypes', campType.id), {
            name: campType.name,
            description: campType.description,
            targetAge: '',
          });
        });
        await batch.commit();
        setCampTypes(CANONICAL_CAMP_TYPES.map((c) => ({ ...c, targetAge: '' })));
      } catch (error) {
        console.error('Failed to sync camp types to Firestore:', error);
        // Fall back to rendering the canonical copy locally even if the write failed.
        setCampTypes(CANONICAL_CAMP_TYPES.map((c) => ({ ...c, targetAge: '' })));
      } finally {
        setIsLoading(false);
      }
    }
    syncCampTypes();
  }, []);

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center px-5 py-10 text-center">
        <p className="text-sm text-stone-500">Loading camp types...</p>
      </div>
    );
  }

  if (campTypes.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center px-5 py-10 text-center">
        <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-4 text-stone-300">
          <Trophy className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-stone-900 mb-2 text-lg">Camp Types</h3>
        <p className="text-sm text-stone-500 max-w-xs">No camp type information available yet.</p>
      </div>
    );
  }

  const CAMP_TYPE_ACCENT_COLORS = [
    '#10b981', '#14b8a6', '#3b82f6', '#6366f1', '#f59e0b',
    '#78716c', '#8b5cf6', '#0ea5e9', '#ec4899', '#84cc16',
  ];
  const CAMP_TYPE_BADGE_CLASSES = [
    'bg-emerald-100 text-emerald-700', 'bg-teal-100 text-teal-700', 'bg-blue-100 text-blue-700',
    'bg-indigo-100 text-indigo-700', 'bg-amber-100 text-amber-900', 'bg-stone-200 text-stone-700',
    'bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700', 'bg-pink-100 text-pink-700',
    'bg-lime-100 text-lime-700',
  ];

  return (
    <div className="h-full w-full max-w-[100vw] flex flex-row overflow-x-auto overflow-y-hidden snap-x snap-mandatory custom-scrollbar bg-[url('/skin.png')] bg-cover bg-center bg-fixed pt-[max(env(safe-area-inset-top),3rem)]">
      {campTypes.map((campType, index) => (
        <div
          key={campType.id}
          className="shrink-0 w-full h-full snap-center flex flex-col items-center justify-center px-5 py-10 text-center"
        >
          <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/40 p-5">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/helmet.png" alt="" className="w-10 h-10 object-contain" />
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
                Camp Type {index + 1} / {campTypes.length}
              </span>
            </div>
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg"
              style={{ backgroundColor: CAMP_TYPE_ACCENT_COLORS[index % CAMP_TYPE_ACCENT_COLORS.length] }}
            >
              <Trophy className="text-white w-8 h-8" />
            </div>
            {campType.targetAge && (
              <span
                className={cn(
                  'inline-block text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4',
                  CAMP_TYPE_BADGE_CLASSES[index % CAMP_TYPE_BADGE_CLASSES.length]
                )}
              >
                {campType.targetAge}
              </span>
            )}
            <h3 className="text-xl font-extrabold text-stone-900 mb-3">{campType.name}</h3>
            <p className="text-sm text-stone-600 leading-relaxed">{campType.description}</p>
            <img src="/helmet-logo.png" alt="FCF Helmet" className="w-24 h-24 object-contain mx-auto mt-6" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface Review {
  id: string;
  name: string;
  campName: string;
  rating: number;
  comment: string;
  createdAt?: any;
}

function ReviewsView({ profileName, isAdmin }: { profileName: string; isAdmin: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campName, setCampName] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [campReviewSearch, setCampReviewSearch] = useState('');
  const [playerReviewSearch, setPlayerReviewSearch] = useState('');
  const [hasSearchedPlayerReviews, setHasSearchedPlayerReviews] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, 'reviews'));
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        return {
          id: doc.id,
          name: docData.name || 'Anonymous',
          campName: docData.campName || '',
          rating: docData.rating || 0,
          comment: docData.comment || '',
          createdAt: docData.createdAt,
        } as Review;
      });
      data.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
      setReviews(data);
    } catch (err) {
      console.error('Failed to fetch reviews from Firestore:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!campName.trim()) {
      setError('Please enter the camp name you are reviewing.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setError('Please select a rating between 1 and 5 stars.');
      return;
    }
    if (!comment.trim()) {
      setError('Please write a comment before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        name: profileName?.trim() || 'Anonymous',
        campName: campName.trim(),
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });
      setCampName('');
      setRating(0);
      setComment('');
      await fetchReviews();
    } catch (err) {
      console.error('Failed to submit review to Firestore:', err);
      setError('Something went wrong submitting your review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCampReviews = useMemo(() => {
    const query = campReviewSearch.trim().toLowerCase();
    if (!query) return reviews;
    return reviews.filter((review) => review.campName.toLowerCase().includes(query));
  }, [reviews, campReviewSearch]);

  return (
    <div className="h-full w-full max-w-[100vw] overflow-x-hidden overflow-y-auto custom-scrollbar bg-[url('/skin.png')] bg-cover bg-center bg-fixed pt-[max(env(safe-area-inset-top),3rem)]">
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-32 space-y-6">
        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-green-700" />
            <h2 className="text-lg font-extrabold text-stone-900">Camp Reviews</h2>
          </div>
          <p className="text-sm text-stone-500">
            Share your experience and see what other players and parents are saying.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">
            Search for a Camp
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              value={campReviewSearch}
              onChange={(e) => setCampReviewSearch(e.target.value)}
              placeholder="Search for a particular camp..."
              className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-green-600 transition-colors"
            />
          </div>
        </div>

        {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-xl p-5 border border-stone-100 space-y-4"
        >
          <h3 className="font-bold text-stone-900 text-lg">Leave a Review</h3>

          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">
              Camp Name
            </label>
            <input
              type="text"
              value={campName}
              onChange={(e) => setCampName(e.target.value)}
              placeholder="Which camp are you reviewing?"
              className="w-full px-4 py-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:border-green-600 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">
              Your Rating
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Trophy
                    className={cn(
                      'w-6 h-6 transition-colors',
                      (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-stone-200'
                    )}
                    fill={(hoverRating || rating) >= star ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">
              Your Review
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell other parents and players about your experience at this camp..."
              rows={4}
              className="w-full px-4 py-3 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:border-green-600 transition-colors resize-none"
            />
          </div>

          {error && <p className="text-sm font-semibold text-red-600 text-center -mt-1">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || rating === 0}
            className={cn(
              "w-full py-3 text-white text-sm font-extrabold uppercase tracking-wider rounded-2xl shadow-lg transition-all",
              isSubmitting || rating === 0
                ? "bg-red-300 shadow-red-100 cursor-not-allowed"
                : "bg-red-600 shadow-red-300/50 hover:bg-red-700 active:bg-red-800 hover:-translate-y-0.5"
            )}
          >
            {isSubmitting ? 'Submitting...' : `Submit Review${profileName ? ` as ${profileName}` : ''}`}
          </button>
        </form>
        )}

        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-md p-8 border border-stone-100 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 text-stone-300 animate-spin mb-3" />
            <p className="text-sm text-stone-500">Loading reviews...</p>
          </div>
        ) : filteredCampReviews.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 border border-stone-100 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-4 mx-auto text-stone-300">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-stone-900 mb-2 text-lg">No Reviews Yet</h3>
            <p className="text-sm text-stone-500 max-w-xs">
              {campReviewSearch.trim()
                ? 'No camp reviews match your search.'
                : 'Be the first to leave a review for this camp.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCampReviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-2xl shadow-md p-4 border border-stone-100"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <span className="font-bold text-stone-900 text-sm truncate block">{review.name}</span>
                    {review.campName && (
                      <span className="text-xs font-semibold text-green-700 truncate block">{review.campName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Trophy
                        key={star}
                        className={cn('w-4 h-4', review.rating >= star ? 'text-yellow-400' : 'text-stone-200')}
                        fill={review.rating >= star ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap mt-1">{review.comment}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-green-700" />
            <h2 className="text-lg font-extrabold text-stone-900">Player Reviews</h2>
          </div>
          <p className="text-sm text-stone-500">
            Search for a camp to see player reviews.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-4 border border-stone-100">
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">
            Search for a Camp
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              value={playerReviewSearch}
              onChange={(e) => {
                setPlayerReviewSearch(e.target.value);
                setHasSearchedPlayerReviews(e.target.value.trim().length > 0);
              }}
              placeholder="Search for a particular camp's player reviews..."
              className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-green-600 transition-colors"
            />
          </div>
        </div>

        {hasSearchedPlayerReviews && (
          <div className="bg-white rounded-2xl shadow-md p-8 border border-stone-100 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-4 mx-auto text-stone-300">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm text-stone-500 max-w-xs">No player reviews left for this camp</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('welcome');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxDistance, setMaxDistance] = useState(50); // km
  const [distanceTier, setDistanceTier] = useState<'LOCAL' | 'STATES' | 'NATIONAL'>('LOCAL');
  const [selectedCampTypes, setSelectedCampTypes] = useState<string[]>([]);
  const CAMP_TYPE_FILTER_OPTIONS = ['Youth', 'High School', 'Elite', 'Specialist'];
  const toggleCampType = (type: string) => {
    setSelectedCampTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };
  const [year, setYear] = useState(format(new Date(), 'yyyy'));
  const [dateRange, setDateRange] = useState({
    start: `${format(new Date(), 'yyyy')}-01-01`,
    end: `${format(new Date(), 'yyyy')}-12-31`
  });
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [selectedCamp, setSelectedCamp] = useState<FootballCamp | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [camps, setCamps] = useState<FootballCamp[]>([]);
  const [profile, setProfile] = useState<LockerRoomProfile>({ name: '', image: '', email: '', bio: '' });
  const [isLockerRoomOpen, setIsLockerRoomOpen] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState('');
  const resultsPanelRef = useRef<HTMLDivElement>(null);
  const handleFindMyCamps = useCallback(() => {
    resultsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const profileSnap = await getDoc(doc(db, 'users', 'current-user'));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setProfile({ name: data.name || '', image: data.image || '', email: data.email || '', bio: data.bio || '' });
        }
      } catch (error) {
        console.error('Failed to fetch profile from Firestore:', error);
      }
    }
    fetchProfile();
  }, []);

  const handleProfileSave = useCallback(async (updatedProfile: LockerRoomProfile) => {
    setProfile(updatedProfile);
    try {
      await setDoc(
        doc(db, 'users', 'current-user'),
        { name: updatedProfile.name, image: updatedProfile.image, email: updatedProfile.email, bio: updatedProfile.bio },
        { merge: true }
      );
    } catch (error) {
      console.error('Failed to save profile to Firestore:', error);
    }
  }, []);

  useEffect(() => {
    async function fetchCamps() {
      try {
        const snapshot = await getDocs(collection(db, 'camps'));
        const data = snapshot.docs.map(doc => {
          const docData = doc.data();
          return {
            ...docData,
            id: doc.id,
          } as FootballCamp;
        });
        setCamps(data);
      } catch (error) {
        console.error('Failed to fetch camps from Firestore:', error);
      }
    }
    fetchCamps();
  }, []);

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

  const filteredCamps = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return camps.filter(camp => {
      // Search query filter — matches across name, city, state, address, and description
      const campExtra = camp as FootballCamp & { city?: string; state?: string };
      const matchesSearch = !query ||
        camp.name.toLowerCase().includes(query) ||
        (campExtra.city || '').toLowerCase().includes(query) ||
        (campExtra.state || '').toLowerCase().includes(query) ||
        camp.address.toLowerCase().includes(query) ||
        camp.description.toLowerCase().includes(query);

      // Distance filter — skip entirely when NATIONAL is selected or no user location is known
      let matchesDistance = true;
      if (distanceTier !== 'NATIONAL' && userLocation) {
        const dist = getDistance(userLocation.lat, userLocation.lng, camp.location.lat, camp.location.lng);
        matchesDistance = dist <= maxDistance;
      }

      // Camp type filter
      const matchesType = selectedCampTypes.length === 0 || selectedCampTypes.includes(camp.type);

      // Date range filter
      const campStart = parseISO(camp.startDate);
      const campEnd = parseISO(camp.endDate);
      const filterStart = parseISO(dateRange.start);
      const filterEnd = parseISO(dateRange.end);

      const matchesDate = (
        isWithinInterval(campStart, { start: filterStart, end: filterEnd }) ||
        isWithinInterval(campEnd, { start: filterStart, end: filterEnd })
      );

      return matchesSearch && matchesDistance && matchesType && matchesDate;
    });
  }, [camps, searchQuery, maxDistance, distanceTier, selectedCampTypes, dateRange, userLocation]);

  if (currentView === 'welcome') {
    return (
      <WelcomeScreen
        onLogin={() => setCurrentView('login')}
        onRegister={() => setCurrentView('register')}
      />
    );
  }

  if (currentView === 'login' || currentView === 'register') {
    return (
      <AuthScreen
        mode={currentView}
        onBack={() => setCurrentView('welcome')}
        onSuccess={(email) => { setLoggedInEmail(email); setCurrentView('search'); }}
      />
    );
  }

  if (!hasValidKey) {
    return <SplashScreen />;
  }


  return (
    <div className="h-screen w-screen max-w-[100vw] overflow-hidden flex flex-col bg-stone-50 font-sans">
    <div className="flex-1 min-h-0 overflow-hidden">
    {currentView === 'search' && (
    <div className="relative h-full w-full max-w-[100vw] overflow-hidden bg-stone-50 font-sans">
    <div className="flex flex-row h-full w-full max-w-[100vw]">

      {/* Search Form (left side) */}
      <div className="w-1/2 h-full max-w-[100vw] border-r border-stone-200 bg-white flex flex-col shadow-2xl overflow-x-hidden overflow-y-auto">
        <div className="p-4 border-b border-stone-100 shrink-0 overflow-y-auto overflow-x-hidden">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 shrink-0">
                <Trophy className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-stone-900 truncate">Football Camp Finder</h1>
            </div>
            <button
              onClick={() => setIsLockerRoomOpen(true)}
              title="Locker Room"
              className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center hover:border-green-400 transition-colors shrink-0"
            >
              {profile.image ? (
                <img
                  src={profile.image}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-4 h-4 text-stone-400" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsLockerRoomOpen(true)}
            className="text-red-600 font-extrabold text-xs uppercase tracking-wide mb-4 text-left hover:text-red-700 active:text-red-800 transition-colors underline underline-offset-2"
          >
            Create LOCKER ROOM profile to access camps
          </button>

          {/* Search */}
          <div className="relative mb-4 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search camps, positions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full box-border pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all text-sm"
            />
          </div>


          {/* Filters */}
          <div className="space-y-6">
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 block">
                Camp Types
              </label>
              <div className="flex flex-col gap-2">
                {CAMP_TYPE_FILTER_OPTIONS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleCampType(type)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors',
                      selectedCampTypes.includes(type)
                        ? 'bg-green-700 border-green-700 text-white'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-green-400'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Navigation className="w-3 h-3" /> Distance
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['LOCAL', 'STATES', 'NATIONAL'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      setDistanceTier(tier);
                      setMaxDistance(tier === 'LOCAL' ? 97 : tier === 'STATES' ? 500 : 10000);
                    }}
                    className={cn(
                      'py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wide transition-colors',
                      distanceTier === tier
                        ? 'bg-green-700 border-green-700 text-white'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-green-400'
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-stone-400 mt-2">(Up to 60 Miles)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3 h-3" />
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full max-w-full box-border pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-green-600"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3 h-3" />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full max-w-full box-border pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-green-600"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Year</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3 h-3" />
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="Year"
                    className="w-full max-w-full box-border pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-green-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFindMyCamps}
            className="w-full mt-4 py-4 bg-green-700 text-white rounded-xl font-extrabold uppercase text-base shadow-lg shadow-green-200 hover:bg-green-800 transition-colors"
          >
            Find My Camps
          </button>

          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="w-full mt-4 py-3 bg-stone-800 text-white rounded-xl font-bold uppercase text-sm flex items-center justify-center gap-2 hover:bg-stone-900 transition-colors"
          >
            View on Map
          </button>
        </div>
      </div>

      {/* Camp List (right side) */}
      <div ref={resultsPanelRef} className="w-1/2 h-full max-w-[100vw] overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar bg-stone-50 box-border">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-sm font-medium text-stone-500">{filteredCamps.length} camps found</span>
          </div>


          <AnimatePresence mode="popLayout">
            {filteredCamps.length > 0 ? (
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
                          camp.type === 'Youth' && "bg-emerald-100 text-emerald-700",
                          camp.type === 'High School' && "bg-green-100 text-green-700",
                          camp.type === 'Elite' && "bg-amber-100 text-amber-900",
                          camp.type === 'Specialist' && "bg-stone-100 text-stone-700",
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
                  {camp.websiteUrl && (
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
                  )}
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
                    <Target className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-stone-900 mb-1">No camps found</h3>
                  <p className="text-sm text-stone-500">Try adjusting your filters or search query to find more results.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
    </div>

    {/* Full-screen Map modal — only shown when the user taps "View on Map" */}
    {showMap && (
      <div className="absolute inset-0 z-50 bg-stone-50">
        <button
          type="button"
          onClick={() => setShowMap(false)}
          className="absolute top-[max(env(safe-area-inset-top),1.5rem)] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-xl border border-stone-100 text-stone-700 font-bold text-sm hover:text-green-700 transition-colors"
        >
          <X className="w-4 h-4" /> Close Map
        </button>

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
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-900">${selectedCamp.price}</span>
                    <button className="px-3 py-1.5 bg-green-700 text-white text-[10px] font-bold rounded-lg hover:bg-green-800 transition-colors">
                      VIEW DETAILS
                    </button>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>


        {/* Map Overlays */}
        <div className="absolute bottom-[max(5.5rem,env(safe-area-inset-bottom))] right-4 sm:bottom-10 sm:right-10 flex flex-col items-end gap-3">
          <button
            onClick={() => setIsLockerRoomOpen(true)}
            className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-white/20 text-stone-700 font-bold text-xs uppercase tracking-wider hover:bg-white transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-stone-100 overflow-hidden flex items-center justify-center shrink-0">
              {profile.image ? (
                <img
                  src={profile.image}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-3 h-3 text-stone-400" />
              )}
            </div>
            Locker Room
          </button>
          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-stone-600 uppercase tracking-tighter">Youth</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <span className="text-[10px] font-bold text-stone-600 uppercase tracking-tighter">High School</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-900" />
              <span className="text-[10px] font-bold text-stone-600 uppercase tracking-tighter">Elite</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-stone-500" />
              <span className="text-[10px] font-bold text-stone-600 uppercase tracking-tighter">Specialist</span>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
    )}

    {currentView === 'guide' && <CampTypesGuide />}

    {currentView === 'reviews' && <ReviewsView profileName={profile.name} isAdmin={loggedInEmail === 'CoachChris51'} />}
    </div>

      <BottomNav
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'locker') {
            setIsLockerRoomOpen(true);
          } else {
            setCurrentView(view);
          }
        }}
      />


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

      <LockerRoomModal
        isOpen={isLockerRoomOpen}
        onClose={() => setIsLockerRoomOpen(false)}
        profile={profile}
        onSave={handleProfileSave}
      />
    </div>
  );
}


