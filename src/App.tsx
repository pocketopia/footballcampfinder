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
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
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

  useEffect(() => {
    setLocalName(profile.name);
    setLocalImage(profile.image);
  }, [profile, isOpen]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      setLocalImage(base64String);
      onSave({ name: localName, image: base64String });
    };
    reader.readAsDataURL(file);
  };

  const handleNameBlur = () => {
    onSave({ name: localName, image: localImage });
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
          className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm relative"
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
              onBlur={handleNameBlur}
              placeholder="Enter your name"
              className="w-full mt-6 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-center font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all box-border"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

type ViewType = 'search' | 'guide' | 'locker' | 'reviews';

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

function CampTypesGuide() {
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

function ReviewsView() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-5 py-10 text-center">
      <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-4 text-stone-300">
        <Users className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-stone-900 mb-2 text-lg">Reviews</h3>
      <p className="text-sm text-stone-500 max-w-xs">No reviews yet.</p>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxDistance, setMaxDistance] = useState(50); // km
  const [dateRange, setDateRange] = useState({ 
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addDays(new Date(), 90), 'yyyy-MM-dd')
  });
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [selectedCamp, setSelectedCamp] = useState<FootballCamp | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [camps, setCamps] = useState<FootballCamp[]>([]);
  const [profile, setProfile] = useState<LockerRoomProfile>({ name: '', image: '' });
  const [isLockerRoomOpen, setIsLockerRoomOpen] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const profileSnap = await getDoc(doc(db, 'users', 'current-user'));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setProfile({ name: data.name || '', image: data.image || '' });
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
        { name: updatedProfile.name, image: updatedProfile.image },
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
    return camps.filter(camp => {
      // Search query filter
      const matchesSearch = camp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           camp.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Distance filter
      let matchesDistance = true;
      if (userLocation) {
        const dist = getDistance(userLocation.lat, userLocation.lng, camp.location.lat, camp.location.lng);
        matchesDistance = dist <= maxDistance;
      }

      // Date range filter
      const campStart = parseISO(camp.startDate);
      const campEnd = parseISO(camp.endDate);
      const filterStart = parseISO(dateRange.start);
      const filterEnd = parseISO(dateRange.end);

      const matchesDate = (
        isWithinInterval(campStart, { start: filterStart, end: filterEnd }) ||
        isWithinInterval(campEnd, { start: filterStart, end: filterEnd })
      );

      return matchesSearch && matchesDistance && matchesDate;
    });
  }, [camps, searchQuery, maxDistance, dateRange, userLocation]);

  if (!hasValidKey) {
    return <SplashScreen />;
  }

  return (
    <div className="h-screen w-screen max-w-full overflow-hidden flex flex-col bg-stone-50 font-sans">
    <div className="flex-1 min-h-0 overflow-hidden">
    {currentView === 'search' && (
    <div className="flex h-full w-full max-w-full bg-stone-50 font-sans overflow-hidden overflow-x-hidden">
      {/* Sidebar */}
      <motion.div 
        initial={false}
        animate={{ width: isSidebarOpen ? '100%' : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="w-full max-w-full md:max-w-[400px] bg-white border-r border-stone-200 flex flex-col z-20 relative shadow-2xl overflow-x-hidden shrink-0 box-border"
      >
        <div className="p-6 border-b border-stone-100 shrink-0 overflow-x-hidden">
          <div className="flex items-center justify-between mb-6 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 shrink-0">
                <Trophy className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-stone-900 truncate">Football Camp Finder</h1>
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6 w-full">
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
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                  <Navigation className="w-3 h-3" /> Distance ({maxDistance}km)
                </label>
              </div>
              <input 
                type="range"
                min="5"
                max="200"
                step="5"
                value={maxDistance}
                onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                className="w-full h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-green-700"
              />
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
            </div>
          </div>
        </div>

        {/* Camp List */}
        <div className="flex-1 w-full max-w-full overflow-y-auto overflow-x-hidden p-4 pb-24 space-y-4 custom-scrollbar box-border">
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
                          camp.type === 'Elite' && "bg-amber-100 text-amber-900", // Brownish
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

                <div className="pt-6 border-t border-stone-100">
                  <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 px-2">Sample Academy Preview</h4>
                  <div className="p-4 rounded-2xl border bg-white border-stone-200 shadow-sm opacity-70 grayscale-[0.5]">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-stone-100">
                    <img 
                      src="https://picsum.photos/seed/football-preview/800/600" 
                      alt="Preview Academy" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-green-100 text-green-700">
                            Elite
                          </span>
                          <span className="text-xs font-bold text-amber-900 ml-auto">$499</span>
                        </div>
                        <h3 className="font-bold text-stone-900 truncate">Championship Prep Academy</h3>
                        <div className="flex items-center gap-1 text-stone-500 text-xs mt-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">555 Victory Lane, Stadium City</span>
                        </div>
                        <div className="flex items-center gap-1 text-stone-500 text-xs mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>Jul 12 - Jul 18, 2026</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-stone-50">
                      <p className="text-[10px] text-stone-400 italic">This is a preview showing how camp details appear in the list.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Main Content (Map) */}
      <div className="flex-1 relative overflow-hidden min-w-0">
        {!isSidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-6 left-6 z-10 p-3 bg-white rounded-xl shadow-xl border border-stone-100 text-stone-600 hover:text-green-700 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
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
    </div>
    )}

    {currentView === 'guide' && <CampTypesGuide />}

    {currentView === 'reviews' && <ReviewsView />}
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
