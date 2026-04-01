import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContext } from '../App';
import { startLogin, logout as bungieLogout } from '../utils/bungieAuth';

const LoginButton = () => {
  const { bungieUser, setBungieUser } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/');
  const lang = (pathParts[1] === 'en' || pathParts[1] === 'de') ? pathParts[1] : 'de';

  const handleLogin = () => {
    startLogin();
  };

  const handleLogout = () => {
    bungieLogout();
    setBungieUser(null);
    navigate(`/${lang}`);
  };

  if (bungieUser) {
    const avatarUrl = bungieUser.bungieNetUser?.profilePicturePath
      ? `https://www.bungie.net${bungieUser.bungieNetUser.profilePicturePath}`
      : null;
    const displayName = bungieUser.bungieNetUser?.uniqueName
      || bungieUser.bungieNetUser?.displayName
      || 'Guardian';

    return (
      <div className="login-user-area">
        <div
          className="user-badge"
          onClick={() => navigate(`/${lang}/profile`)}
          title={lang === 'de' ? 'Profil anzeigen' : 'View Profile'}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </div>
          )}
          <span className="user-name">{displayName}</span>
        </div>
        <button
          className="logout-btn"
          onClick={handleLogout}
          title="Logout"
          aria-label="Logout"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button className="bungie-login-btn" onClick={handleLogin} id="bungie-login-btn">
      <svg className="bungie-logo-icon" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <span>{lang === 'de' ? 'Bungie Login' : 'Bungie Login'}</span>
    </button>
  );
};

export default LoginButton;
