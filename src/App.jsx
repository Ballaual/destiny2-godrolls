import React, { createContext, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Home from './components/Home';
import WeaponDetail from './components/WeaponDetail';
import Profile from './components/Profile';
import Header from './components/Header';
import { handleCallback, isLoggedIn, getCurrentUser } from './utils/bungieAuth';

export const AppContext = createContext();

function AppRoutes() {
  const { lang } = useParams();
  if (lang !== 'de' && lang !== 'en') {
    return <Navigate to="/de" replace />;
  }
  return <Home lang={lang} />;
}

function App() {
  const [rolls, setRolls] = useState([]);
  const [destinyData, setDestinyData] = useState({ en: {}, de: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bungieUser, setBungieUser] = useState(null);
  const [authProcessing, setAuthProcessing] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Handle OAuth callback — the ?code= comes BEFORE the hash in the URL
  useEffect(() => {
    const processOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code) {
        setAuthProcessing(true);
        setAuthError(null);
        // Always clean up the URL so the code doesn't get re-used on refresh
        const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        try {
          await handleCallback(code, state);
          // Fetch user data
          const userData = await getCurrentUser();
          setBungieUser(userData);
        } catch (error) {
          console.error('OAuth callback error:', error);
          setAuthError(error.message);
        } finally {
          setAuthProcessing(false);
        }
      } else if (isLoggedIn()) {
        // Restore existing session
        try {
          const userData = await getCurrentUser();
          setBungieUser(userData);
        } catch (error) {
          console.error('Failed to restore session:', error);
        }
      }
    };

    processOAuthCallback();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch Godroll Database and Manifest Data
        const [rollsRes, manifestRes] = await Promise.all([
          fetch(import.meta.env.VITE_GODROLL_DATABASE_URL),
          fetch(`${import.meta.env.BASE_URL}destinyData.json`)
        ]);
        
        if (!rollsRes.ok) throw new Error(`Failed to fetch rolls: ${rollsRes.status}`);
        if (!manifestRes.ok) throw new Error(`Failed to fetch manifest: ${manifestRes.status}`);

        const rollsData = await rollsRes.json();
        const manifestData = await manifestRes.json();
        
        if (rollsData && rollsData.data && manifestData && manifestData.en && manifestData.de) {
          const groupedMap = new Map();
          
          rollsData.data.forEach((roll) => {
            const rawName = manifestData.en[roll.hash]?.name || roll.name || "Unknown";
            const baseName = rawName.replace(/\s*\(Adept\)|\s*\(Harrowed\)|\s*\(Timelost\)|\s*\(Baroque\)/g, '').trim();
            
            if (!groupedMap.has(baseName)) {
              groupedMap.set(baseName, {
                id: roll.hash.toString(), // The user wants the weapon ID (hash) in the url!
                baseName,
                hash: roll.hash,
                tags: new Set(),
                rolls: []
              });
            }
            
            const weaponGroup = groupedMap.get(baseName);
            const isCurrentAdept = manifestData.en[weaponGroup.hash]?.name.includes('(Adept)');
            const isThisAdept = rawName.includes('(Adept)');
            
            if (isCurrentAdept && !isThisAdept) {
               weaponGroup.hash = roll.hash;
               weaponGroup.id = roll.hash.toString(); // Update ID to match base weapon hash
            }
            
            roll.tags?.forEach(t => weaponGroup.tags.add(t));
            // Only add roll if it doesn't already exist to avoid redundancy
            if (!weaponGroup.rolls.some(r => JSON.stringify(r.plugs) === JSON.stringify(roll.plugs))) {
               weaponGroup.rolls.push(roll);
            }
          });
          
          const finalWeapons = Array.from(groupedMap.values()).map(w => ({
            ...w,
            tags: Array.from(w.tags)
          }));
          
          setRolls(finalWeapons);
          setDestinyData(manifestData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  return (
    <AppContext.Provider value={{ rolls, destinyData, search, setSearch, bungieUser, setBungieUser }}>
      <Router>
        <div className="app-container">
          <Header />
          {authError && (
            <div className="auth-error-banner" onClick={() => setAuthError(null)}>
              <span>⚠️ Login fehlgeschlagen: {authError}</span>
              <span className="auth-error-close">✕</span>
            </div>
          )}
          {(loading || authProcessing) ? (
            <div className="loader-container">
              <div className="loader"></div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/de" replace />} />
              <Route path="/:lang" element={<AppRoutes />} />
              <Route path="/:lang/weapon/:id" element={<WeaponDetail />} />
              <Route path="/:lang/profile" element={<Profile />} />
            </Routes>
          )}
        </div>
      </Router>
    </AppContext.Provider>
  );
}

export default App;
