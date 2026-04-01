import React, { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import LoginButton from './LoginButton';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { search, setSearch } = useContext(AppContext);
  
  // Extract lang from URL e.g. /de/weapon/123 -> de
  const pathParts = location.pathname.split('/');
  const lang = (pathParts[1] === 'en' || pathParts[1] === 'de') ? pathParts[1] : 'de';

  const setLang = (newLang) => {
    if (lang === newLang) return;
    const newPath = location.pathname.replace(`/${lang}`, `/${newLang}`);
    navigate(newPath);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    // If not on home page, navigate to home immediately so they can see the search results
    if (location.pathname !== `/${lang}`) {
      navigate(`/${lang}`);
    }
  };

  return (
    <header className="header">
      <div className="header-top">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div 
            className="header-logo" 
            onClick={() => { setSearch(''); navigate(`/${lang}`); }}
            style={{ cursor: 'pointer' }}
          >
            <span style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '1.5rem', letterSpacing: '2px' }}>
              DESTINY 2 <span style={{ color: 'var(--accent-pve)' }}>GOD ROLLS</span>
            </span>
          </div>
          <p style={{ marginTop: '0.2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {lang === 'de' ? 'Entdecke die besten Waffen-Rolls für PVE und PVP.' : 'Discover the best weapon rolls for PVE and PVP.'}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            className="search-input" 
            placeholder={lang === 'de' ? "Nach Waffe suchen..." : "Search weapon..."} 
            value={search}
            onChange={handleSearchChange}
            style={{ width: '250px', marginBottom: 0 }}
          />

          <LoginButton />

          <div className="lang-toggle">
            <button 
              className={`lang-btn ${lang === 'de' ? 'active' : ''}`}
              onClick={() => setLang('de')}
            >DE</button>
            <button 
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
            >EN</button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
