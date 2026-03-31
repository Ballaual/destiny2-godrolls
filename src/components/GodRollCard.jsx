import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';

export const AmmoTypeLabel = ({ ammoType, lang }) => {
  // Inline SVGs for Ammo Types to prevent 404s
  const PrimaryAmmoSVG = () => (
    <svg className="ammo-svg primary" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 22V6l5-4 5 4v16H7z" />
    </svg>
  );
  
  const SpecialAmmoSVG = () => (
    <svg className="ammo-svg special" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 22V5l3-3 3 3v17H5zm8 0V5l3-3 3 3v17h-6z" />
    </svg>
  );
  
  const HeavyAmmoSVG = () => (
    <svg className="ammo-svg heavy" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 21V6l3-3 3 3v15H3zm6 0V6l3-3 3 3v15H9zm6 0V6l3-3 3 3v15h-6z" />
    </svg>
  );

  if (ammoType === 1) return <span className="ammo-badge primary"><PrimaryAmmoSVG /> {lang === 'de' ? 'Primär' : 'Primary'}</span>;
  if (ammoType === 2) return <span className="ammo-badge special"><SpecialAmmoSVG /> {lang === 'de' ? 'Spezial' : 'Special'}</span>;
  if (ammoType === 3) return <span className="ammo-badge heavy"><HeavyAmmoSVG /> {lang === 'de' ? 'Schwer' : 'Heavy'}</span>;
  return null;
}

const GodRollCard = ({ roll, lang }) => {
  const { id, baseName, hash, tags } = roll;
  const { destinyData } = useContext(AppContext);
  const navigate = useNavigate();
  
  const isPve = tags.includes('GodPVE');
  const isPvp = tags.includes('GodPVP');
  const cardClass = isPve && isPvp ? 'both-card' : isPve ? 'pve-card' : isPvp ? 'pvp-card' : '';
  
  const manifestLangData = destinyData[lang] || {};
  const weaponData = manifestLangData[hash] || {};
  const weaponScreenshot = weaponData.screenshot;
  const weaponType = weaponData.itemTypeDisplayName;
  const ammoType = weaponData.equippingBlock?.ammoType;

  return (
    <div 
      className={`god-roll-card ${cardClass}`} 
      onClick={() => navigate(`/${lang}/weapon/${id}`)}
      style={{ cursor: 'pointer' }}
    >
      {weaponScreenshot && (
        <div 
          className="card-screenshot" 
          style={{ backgroundImage: `url(${weaponScreenshot})` }}
        />
      )}
      
      <div className="card-content">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <h2 className="weapon-name">{weaponData.name || baseName}</h2>
          <div className="card-meta" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem', marginTop: '0.2rem' }}>
            {weaponType && <span className="weapon-type" style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{weaponType}</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', overflow: 'hidden' }}>
              <AmmoTypeLabel ammoType={ammoType} lang={lang} />
              <span className="tag-badge grouped" style={{ flexShrink: 0 }}>
                {tags.map(t => t.replace('God', '')).join(', ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GodRollCard;
