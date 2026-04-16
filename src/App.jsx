import React, { createContext, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Home from './components/Home';
import WeaponDetail from './components/WeaponDetail';
import Header from './components/Header'; // We'll extract header to access params

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

        if (rollsData && rollsData.entries && manifestData && manifestData.en && manifestData.de) {
          const groupedMap = new Map();

          rollsData.entries.forEach((roll) => {
            const rawHash = roll.itemHash || roll.hash;
            const rawItemData = manifestData.en[rawHash] || {};
            const rawName = rawItemData.name || roll.name || "Unknown";
            const baseName = rawName.replace(/\s*\(Adept\)|\s*\(Harrowed\)|\s*\(Timelost\)|\s*\(Baroque\)/g, '').trim();

            if (!groupedMap.has(baseName)) {
              groupedMap.set(baseName, {
                id: baseName.toLowerCase().replace(/\s+/g, '-'),
                baseName,
                hash: rawHash,
                hashes: new Set(),
                sourcesMap: new Map(), // source -> maxVersion
                tags: new Set(),
                rolls: [],
                version: 0,
                versionScore: 0
              });
            }

            const weaponGroup = groupedMap.get(baseName);
            weaponGroup.hashes.add(rawHash);
            
            // Extract release version and category score for THIS item (Trait-ID based)
            let traitVersion = 0;
            let traitCategoryScore = 0;
            const traitIds = rawItemData.traitIds || [];
            traitIds.forEach(id => {
              const match = id.match(/releases\.v(\d+)\.?(\w+)?/);
              if (match) {
                const ver = parseInt(match[1]);
                if (ver > traitVersion) traitVersion = ver;
                
                const cat = match[2] || '';
                let catScore = 0;
                if (cat === 'dlc') catScore = 3000;
                else if (cat === 'season') catScore = 2000;
                else if (cat === 'annual') catScore = 1500;
                
                if (catScore > traitCategoryScore) traitCategoryScore = catScore;
              }
            });

            // Note-based version extraction (highest priority)
            let noteVersionScore = 0;
            const noteMatch = roll.notes?.match(/Version:\s*S(\d+)/i);
            if (noteMatch) {
              const sNum = parseInt(noteMatch[1]);
              // Assign a very high score for note-based versions to prioritize over trait-ids
              // 10000 base + (season count * 10)
              noteVersionScore = 10000 + (sNum * 10);
            }

            // Decide final score for this specific roll
            const currentItemScore = Math.max(noteVersionScore, traitCategoryScore + traitVersion);

            // Global group metadata (thumbnail, max score)
            if (currentItemScore > weaponGroup.versionScore) {
              weaponGroup.versionScore = currentItemScore;
              weaponGroup.version = traitVersion; // Keep internal trait version for other logic
              
              const isThisAdept = rawName.includes('(Adept)');
              const isCurrentAdept = manifestData.en[weaponGroup.hash]?.name.includes('(Adept)');
              if (isThisAdept || (!isCurrentAdept)) {
                 weaponGroup.hash = rawHash;
              }
            }

            // Collect Sources (Multilingual)
            ['en', 'de'].forEach(l => {
              const itemData = manifestData[l][rawHash];
              let sourceText = itemData?.source;
              if (sourceText) {
                if (!weaponGroup.sourcesMaps) weaponGroup.sourcesMaps = { en: new Map(), de: new Map() };
                const map = weaponGroup.sourcesMaps[l];
                
                // Split multi-sources (e.g. "Source A, Source B") to handle them individually
                const individualSources = sourceText.split(/,| und | and /).map(s => s.trim()).filter(Boolean);
                
                individualSources.forEach(s => {
                  const currentMax = map.get(s) || 0;
                  if (currentItemScore >= currentMax) {
                    map.set(s, currentItemScore);
                  }
                });
              }
            });

            roll.tags?.forEach(t => weaponGroup.tags.add(t));
            
            const normalizedRoll = {
              ...roll,
              hash: rawHash,
              versionScore: currentItemScore, // Capture final score for sorting within group
              plugs: roll.perkHashes || roll.plugs || []
            };

            if (!weaponGroup.rolls.some(r => 
              JSON.stringify(r.plugs) === JSON.stringify(normalizedRoll.plugs) && 
              r.notes === normalizedRoll.notes
            )) {
              weaponGroup.rolls.push(normalizedRoll);
            }
          });

          // Sort rolls within each group (Newest Version First, then PVE First)
          groupedMap.forEach(group => {
            group.rolls.sort((a, b) => {
              // 1. Sort by version score descending
              if (b.versionScore !== a.versionScore) {
                 return b.versionScore - a.versionScore;
              }
              // 2. Sort by tags (PVE first)
              const aIsPve = (a.tags || []).includes('GodPVE');
              const bIsPve = (b.tags || []).includes('GodPVE');
              if (aIsPve && !bIsPve) return -1;
              if (!aIsPve && bIsPve) return 1;
              return 0;
            });
            
            // Finalize sources list for both languages (Primary source first!)
            group.sources = { en: [], de: [] };
            ['en', 'de'].forEach(l => {
               if (group.sourcesMaps && group.sourcesMaps[l]) {
                 const primarySourceStr = manifestData[l][group.hash]?.source;
                 const primarySources = primarySourceStr ? primarySourceStr.split(/,| und | and /).map(s => s.trim()).filter(Boolean) : [];
                 
                 const otherSources = Array.from(group.sourcesMaps[l].entries())
                   .sort((a, b) => b[1] - a[1])
                   .map(entry => entry[0])
                   .filter(s => !primarySources.includes(s));
                 
                 group.sources[l] = [...primarySources, ...otherSources];
               }
            });
          });

          const finalWeapons = Array.from(groupedMap.values())
            .map(w => ({
              ...w,
              tags: Array.from(w.tags)
            }))
            .sort((a, b) => b.versionScore - a.versionScore); // Sort by weighted version score descending

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
    <AppContext.Provider value={{ rolls, destinyData, search, setSearch }}>
      <Router>
        <div className="app-container">
          <Header />
          {loading ? (
            <div className="loader-container">
              <div className="loader"></div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/de" replace />} />
              <Route path="/:lang" element={<AppRoutes />} />
              <Route path="/:lang/weapon/:id" element={<WeaponDetail />} />
            </Routes>
          )}
        </div>
      </Router>
    </AppContext.Provider>
  );
}

export default App;