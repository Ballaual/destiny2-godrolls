import React, { useContext, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { AmmoTypeLabel } from './GodRollCard';

const WeaponDetail = () => {
  const { lang, id } = useParams();
  const navigate = useNavigate();
  const { rolls, destinyData } = useContext(AppContext);
  const [isImageEnlarged, setIsImageEnlarged] = useState(false);

  // find grouped weapon
  const weaponGroup = rolls.find(r => r.id === id);

  if (!weaponGroup) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>{lang === 'de' ? 'Waffe nicht gefunden.' : 'Weapon not found.'}</h2>
        <button className="filter-btn active all" onClick={() => navigate(`/${lang}`)}>
          {lang === 'de' ? 'Zurück zur Übersicht' : 'Back to Home'}
        </button>
      </div>
    );
  }

  const { baseName, hash, rolls: childRolls } = weaponGroup;
  const manifestLangData = destinyData[lang] || {};
  const weaponData = manifestLangData[hash] || {};
  
  const weaponScreenshot = weaponData.screenshot;
  const weaponType = weaponData.itemTypeDisplayName;
  const ammoType = weaponData.equippingBlock?.ammoType;
  const description = weaponData.description;
  const source = weaponData.source;

  return (
    <div className="weapon-detail-page">
      {isImageEnlarged && weaponScreenshot && (
        <div className="image-modal-overlay" onClick={() => setIsImageEnlarged(false)}>
          <div className="image-modal-content">
            <span className="close-modal">&times;</span>
            <img src={weaponScreenshot} alt={baseName} />
          </div>
        </div>
      )}

      <button 
        className="filter-btn" 
        onClick={() => navigate(`/${lang}`)}
        style={{ marginBottom: '2rem' }}
      >
        &larr; {lang === 'de' ? 'Zurück' : 'Back'}
      </button>

      <div className="detail-hero">
        {weaponScreenshot && (
          <img 
            src={weaponScreenshot} 
            alt={baseName} 
            className="hero-screenshot interactive" 
            onClick={() => setIsImageEnlarged(true)}
            title={lang === 'de' ? "Bild vergrößern" : "Enlarge picture"}
          />
        )}
        <div className="hero-content">
          <h1>{weaponData.name || baseName}</h1>
          <div className="card-meta">
            {weaponType && <span className="weapon-type">{weaponType}</span>}
            <AmmoTypeLabel ammoType={ammoType} lang={lang} />
          </div>
          <p style={{ margin: '0.5rem 0', color: 'var(--text-main)', fontSize: '0.9rem', fontStyle: 'italic'}}>
             {lang === 'de' ? 'Quelle: ' : 'Source: '} 
             {source ? source : (lang === 'de' ? 'unbekannt' : 'unknown')}
          </p>
          {description && <p className="weapon-lore">"{description}"</p>}
        </div>
      </div>

      {childRolls.map((rollItem, idx) => {
        const rollTags = rollItem.tags || [];
        const isPve = rollTags.includes('GodPVE');
        const rollType = isPve ? 'PVE' : 'PVP';

        return (
          <div key={idx} className="detail-rolls-section">
            <h2 className={`roll-title ${rollType}`}>
               {rollType} God Roll
            </h2>
            <div className="perks-grid detailed-grid">
              {rollItem.plugs && rollItem.plugs.map((plugCol, colIndex) => {
                const seenPerkNames = new Set();
                const uniquePlugs = [];
                plugCol.forEach(plugHash => {
                  const pData = manifestLangData[plugHash] || { name: 'Unknown' };
                  if (!seenPerkNames.has(pData.name)) {
                     seenPerkNames.add(pData.name);
                     uniquePlugs.push(plugHash);
                  }
                });
                
                return (
                  <div key={colIndex} className="perk-column detailed">
                    {uniquePlugs.map((plugHash, plugIdx) => {
                      const perkData = manifestLangData[plugHash] || { name: `Unknown`, description: '' };
                      const isFirst = plugIdx === 0;
                      return (
                        <div key={plugHash} className={`perk-detail-card ${isFirst ? 'gold-perk' : ''}`}>
                          {perkData.icon && (
                            <div className="perk-icon-wrapper large">
                              <img src={perkData.icon} alt={perkData.name} className="perk-icon" />
                            </div>
                          )}
                          <div className="perk-text">
                            <strong>{perkData.name}</strong>
                            <p>{perkData.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )
      })}
    </div>
  );
};

export default WeaponDetail;
