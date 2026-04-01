import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContext } from '../App';
import { isLoggedIn, getFullProfileData, logout as bungieLogout } from '../utils/bungieAuth';

const PLATFORM_NAMES = {
  1: 'Xbox',
  2: 'PlayStation',
  3: 'Steam',
  4: 'Blizzard',
  5: 'Stadia',
  6: 'Epic Games',
  10: 'TigerDemon',
  254: 'BungieNext',
};

const PLATFORM_ICONS = {
  1: '🎮', // Xbox
  2: '🎮', // PlayStation
  3: '🖥️', // Steam
  6: '🎮', // Epic
};

const CLASS_NAMES = {
  0: 'Titan',
  1: 'Hunter',
  2: 'Warlock',
  3: 'Unknown',
};

const CLASS_NAMES_DE = {
  0: 'Titan',
  1: 'Jäger',
  2: 'Warlock',
  3: 'Unbekannt',
};

const RACE_NAMES = {
  0: 'Human',
  1: 'Awoken',
  2: 'Exo',
};

const RACE_NAMES_DE = {
  0: 'Mensch',
  1: 'Erwachte',
  2: 'Exo',
};

const GENDER_NAMES = {
  0: { en: 'Male', de: 'Männlich' },
  1: { en: 'Female', de: 'Weiblich' },
};

const Profile = () => {
  const { bungieUser, setBungieUser } = useContext(AppContext);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/');
  const lang = (pathParts[1] === 'en' || pathParts[1] === 'de') ? pathParts[1] : 'de';

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate(`/${lang}`, { replace: true });
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getFullProfileData();
        setProfileData(data);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [lang, navigate]);

  const handleLogout = () => {
    bungieLogout();
    setBungieUser(null);
    navigate(`/${lang}`, { replace: true });
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loader-container">
          <div className="profile-loader">
            <div className="loader"></div>
            <p className="loader-text">{lang === 'de' ? 'Lade Profil...' : 'Loading Profile...'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <div className="error-icon">⚠️</div>
          <h2>{lang === 'de' ? 'Fehler beim Laden' : 'Loading Error'}</h2>
          <p>{error}</p>
          <button className="bungie-login-btn" onClick={() => window.location.reload()}>
            {lang === 'de' ? 'Erneut versuchen' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  const user = profileData?.bungieNetUser;
  const avatarUrl = user?.profilePicturePath
    ? `https://www.bungie.net${user.profilePicturePath}`
    : null;

  return (
    <div className="profile-page">
      {/* Hero Section */}
      <div className="profile-hero">
        <div className="profile-hero-bg"></div>
        <div className="profile-hero-content">
          <div className="profile-avatar-wrapper">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Bungie Avatar" className="profile-avatar" />
            ) : (
              <div className="profile-avatar profile-avatar-fallback">
                <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            )}
            <div className="profile-status-dot"></div>
          </div>
          <div className="profile-identity">
            <h1 className="profile-display-name">
              {user?.uniqueName || user?.displayName || 'Guardian'}
            </h1>
            {user?.about && (
              <p className="profile-about">{user.about}</p>
            )}
            <div className="profile-meta-row">
              <span className="profile-meta-chip">
                <span className="meta-icon">🆔</span>
                {user?.membershipId}
              </span>
              {user?.firstAccess && (
                <span className="profile-meta-chip">
                  <span className="meta-icon">📅</span>
                  {lang === 'de' ? 'Beigetreten: ' : 'Joined: '}
                  {new Date(user.firstAccess).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US')}
                </span>
              )}
            </div>
          </div>
          <button className="profile-logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Memberships Section */}
      {profileData?.memberships && profileData.memberships.length > 0 && (
        <section className="profile-section">
          <h2 className="section-title">
            <span className="section-icon">🔗</span>
            {lang === 'de' ? 'Verknüpfte Plattformen' : 'Linked Platforms'}
          </h2>
          <div className="memberships-grid">
            {profileData.memberships.map((m) => (
              <div key={m.membershipId} className="membership-card">
                <span className="membership-platform-icon">
                  {PLATFORM_ICONS[m.membershipType] || '🎮'}
                </span>
                <div className="membership-info">
                  <span className="membership-platform-name">
                    {PLATFORM_NAMES[m.membershipType] || `Platform ${m.membershipType}`}
                  </span>
                  <span className="membership-display-name">
                    {m.displayName || m.bungieGlobalDisplayName || '—'}
                  </span>
                  {m.bungieGlobalDisplayNameCode !== undefined && m.bungieGlobalDisplayNameCode > 0 && (
                    <span className="membership-code">#{String(m.bungieGlobalDisplayNameCode).padStart(4, '0')}</span>
                  )}
                </div>
                {m.crossSaveOverride > 0 && m.crossSaveOverride === m.membershipType && (
                  <span className="cross-save-badge" title="Cross Save Primary">
                    ⭐
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Characters Section */}
      {profileData?.profiles && profileData.profiles.some(p => Object.keys(p.characters).length > 0) && (
        <section className="profile-section">
          <h2 className="section-title">
            <span className="section-icon">⚔️</span>
            {lang === 'de' ? 'Destiny 2 Charaktere' : 'Destiny 2 Characters'}
          </h2>
          <div className="characters-grid">
            {profileData.profiles.flatMap((profile) =>
              Object.values(profile.characters).map((char) => {
                const emblemBg = char.emblemBackgroundPath
                  ? `https://www.bungie.net${char.emblemBackgroundPath}`
                  : null;
                const className = lang === 'de'
                  ? CLASS_NAMES_DE[char.classType] || CLASS_NAMES[char.classType]
                  : CLASS_NAMES[char.classType] || 'Unknown';
                const raceName = lang === 'de'
                  ? RACE_NAMES_DE[char.raceType] || RACE_NAMES[char.raceType]
                  : RACE_NAMES[char.raceType] || 'Unknown';
                const genderName = GENDER_NAMES[char.genderType]
                  ? GENDER_NAMES[char.genderType][lang] || GENDER_NAMES[char.genderType].en
                  : '—';

                return (
                  <div
                    key={char.characterId}
                    className={`character-card class-${char.classType}`}
                  >
                    {emblemBg && (
                      <div
                        className="character-emblem-bg"
                        style={{ backgroundImage: `url(${emblemBg})` }}
                      ></div>
                    )}
                    <div className="character-overlay"></div>
                    <div className="character-content">
                      <div className="character-header">
                        <h3 className="character-class">{className}</h3>
                        <span className="character-light">
                          <span className="light-icon">✦</span>
                          {char.light}
                        </span>
                      </div>
                      <div className="character-details">
                        <span className="character-detail-chip">
                          {raceName} · {genderName}
                        </span>
                        {char.dateLastPlayed && (
                          <span className="character-detail-chip muted">
                            {lang === 'de' ? 'Zuletzt: ' : 'Last: '}
                            {new Date(char.dateLastPlayed).toLocaleDateString(
                              lang === 'de' ? 'de-DE' : 'en-US',
                              { day: '2-digit', month: 'short', year: 'numeric' }
                            )}
                          </span>
                        )}
                      </div>
                      <div className="character-stats">
                        {char.stats && Object.entries(char.stats).slice(0, 6).map(([statHash, value]) => (
                          <div key={statHash} className="stat-pip">
                            <span className="stat-value">{value}</span>
                          </div>
                        ))}
                      </div>
                      <span className="character-platform-tag">
                        {PLATFORM_NAMES[profile.membership.membershipType] || 'Unknown'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Back Button */}
      <div className="profile-actions">
        <button
          className="back-to-rolls-btn"
          onClick={() => navigate(`/${lang}`)}
        >
          ← {lang === 'de' ? 'Zurück zu den God Rolls' : 'Back to God Rolls'}
        </button>
      </div>
    </div>
  );
};

export default Profile;
