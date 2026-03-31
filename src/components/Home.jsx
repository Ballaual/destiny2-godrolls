import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import GodRollCard from './GodRollCard';

const Home = ({ lang }) => {
  const { rolls, destinyData, search } = useContext(AppContext);
  const [filter, setFilter] = useState('all');
  const [ammoFilter, setAmmoFilter] = useState('all');

  const filteredRolls = useMemo(() => {
    return rolls.filter(roll => {
      let enName = roll.baseName;
      let deName = roll.baseName;
      
      if (destinyData['en'] && destinyData['en'][roll.hash] && destinyData['en'][roll.hash].name) {
        enName = destinyData['en'][roll.hash].name;
      }
      if (destinyData['de'] && destinyData['de'][roll.hash] && destinyData['de'][roll.hash].name) {
        deName = destinyData['de'][roll.hash].name;
      }
      
      const searchLower = search.toLowerCase();
      const matchesSearch = enName.toLowerCase().includes(searchLower) || 
                            deName.toLowerCase().includes(searchLower) ||
                            roll.baseName.toLowerCase().includes(searchLower);
      
      let matchesFilter = true;
      if (filter !== 'all') {
        matchesFilter = roll.tags && roll.tags.includes(filter);
      }
      
      let matchesAmmo = true;
      if (ammoFilter !== 'all') {
        // Find ammo type from manifest using the weapon's hash
        const manifestWeapon = destinyData[lang] ? destinyData[lang][roll.hash] : null;
        if (manifestWeapon && manifestWeapon.equippingBlock) {
          const wAmmo = manifestWeapon.equippingBlock.ammoType;
          if (ammoFilter === 'primary') matchesAmmo = wAmmo === 1;
          else if (ammoFilter === 'special') matchesAmmo = wAmmo === 2;
          else if (ammoFilter === 'heavy') matchesAmmo = wAmmo === 3;
        } else {
          matchesAmmo = false;
        }
      }

      return matchesSearch && matchesFilter && matchesAmmo;
    });
  }, [rolls, search, filter, ammoFilter, destinyData, lang]);

  return (
    <>
      <div className="controls-container">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            className={`filter-btn all ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {lang === 'de' ? 'Alle Modi' : 'All Modes'}
          </button>
          <button 
            className={`filter-btn GodPVE ${filter === 'GodPVE' ? 'active' : ''}`}
            onClick={() => setFilter('GodPVE')}
          >
            PVE
          </button>
          <button 
            className={`filter-btn GodPVP ${filter === 'GodPVP' ? 'active' : ''}`}
            onClick={() => setFilter('GodPVP')}
          >
            PVP
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderLeft: '1px solid var(--border-light)', paddingLeft: '1rem' }}>
          <button 
            className={`filter-btn all ${ammoFilter === 'all' ? 'active' : ''}`}
            onClick={() => setAmmoFilter('all')}
          >
            {lang === 'de' ? 'Alle Ammo' : 'All Ammo'}
          </button>
          <button 
            className={`filter-btn ${ammoFilter === 'primary' ? 'active white-text' : ''}`}
            onClick={() => setAmmoFilter('primary')}
          >
            Primary
          </button>
          <button 
            className={`filter-btn ${ammoFilter === 'special' ? 'active green-text' : ''}`}
            onClick={() => setAmmoFilter('special')}
          >
            Special
          </button>
          <button 
            className={`filter-btn ${ammoFilter === 'heavy' ? 'active purple-text' : ''}`}
            onClick={() => setAmmoFilter('heavy')}
          >
            Heavy
          </button>
        </div>
      </div>

      <div className="rolls-grid">
        {filteredRolls.length > 0 ? (
          filteredRolls.map((roll, idx) => (
            <GodRollCard 
              key={`${roll.hash || roll.baseName}-${idx}`} 
              roll={roll} 
              lang={lang}
            />
          ))
        ) : (
          <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>
            {lang === 'de' ? 'Keine God Rolls gefunden.' : 'No God Rolls found.'}
          </div>
        )}
      </div>
    </>
  );
};

export default Home;
