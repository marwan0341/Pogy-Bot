import React, { useState, useRef, useEffect } from 'react';

export default function Sidebar({ user, selectedGuild, onSelectGuild, activePage, setActivePage, mobileMenuOpen, setMobileMenuOpen }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentGuild = user?.allowedGuilds?.find(g => g.id === selectedGuild);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('pogy_guild_id');
    window.location.href = '/api/auth/signout?callbackUrl=/login';
  };

  const closeMobileMenu = () => {
    if (typeof setMobileMenuOpen === 'function') setMobileMenuOpen(false);
  };

  return (
    <nav className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header dashboard-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div className="sidebar-brand-block">
          <p className="sidebar-kicker">CVX Platform</p>
          <h2 className="brand-text-glow">CVX VOID</h2>
        </div>
        <button 
          className="btn-icon mobile-only" 
          onClick={closeMobileMenu}
          style={{ background: 'none', border: 'none', color: '#DBDEE1', fontSize: '1.2rem', cursor: 'pointer' }}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="guild-selector" id="guild-selector" ref={dropdownRef} onClick={() => setDropdownOpen(!dropdownOpen)}>
        <img 
          src={currentGuild?.icon || 'https://cdn.discordapp.com/embed/avatars/0.png'} 
          alt="Guild" className="guild-icon" 
        />
        <span className="guild-name">{currentGuild?.name || 'Select Server'}</span>
        <i className="fa-solid fa-chevron-down"></i>
        
        <div className={`guild-dropdown ${dropdownOpen ? 'active' : ''}`}>
          {user?.allowedGuilds?.map(g => (
            <div 
              key={g.id} 
              className="guild-option" 
              onClick={(e) => { e.stopPropagation(); onSelectGuild(g.id); setDropdownOpen(false); closeMobileMenu(); }}
            >
              {g.icon ? (
                <img src={g.icon} className="guild-icon" alt="" />
              ) : (
                <div className="guild-icon" style={{ background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>#</div>
              )}
              <span className="guild-name">{g.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-section-label">Command Deck</div>
      <ul className="nav-links">
        <li className={activePage === 'overview' ? 'active' : ''} onClick={() => { setActivePage('overview'); closeMobileMenu(); }}>
          <i className="fa-solid fa-chart-pie"></i>
          <span>Overview</span>
        </li>
        <li className={activePage === 'moderation' ? 'active' : ''} onClick={() => { setActivePage('moderation'); closeMobileMenu(); }}>
          <i className="fa-solid fa-gavel"></i>
          <span>Moderation</span>
        </li>
        <li className={activePage === 'protection' ? 'active' : ''} onClick={() => { setActivePage('protection'); closeMobileMenu(); }}>
          <i className="fa-solid fa-shield-halved"></i>
          <span>Protection</span>
        </li>
        <li className={activePage === 'music' ? 'active' : ''} onClick={() => { setActivePage('music'); closeMobileMenu(); }}>
          <i className="fa-solid fa-music"></i>
          <span>Music</span>
        </li>
        <li className={activePage === 'logs' ? 'active' : ''} onClick={() => { setActivePage('logs'); closeMobileMenu(); }}>
          <i className="fa-solid fa-stream"></i>
          <span>Live Logs</span>
        </li>
        <li className={activePage === 'commands' ? 'active' : ''} onClick={() => { setActivePage('commands'); closeMobileMenu(); }}>
          <i className="fa-solid fa-terminal"></i>
          <span>Command Center</span>
        </li>
      </ul>

      <ul className="nav-links sidebar-docs-nav">
        <li className={activePage === 'docs' ? 'active' : ''} onClick={() => { setActivePage('docs'); closeMobileMenu(); }}>
          <i className="fa-solid fa-book"></i>
          <span>Docs & Guide</span>
        </li>
      </ul>

      <div className="user-profile" style={{ marginTop: 'auto' }}>
        <img 
          src={user?.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} 
          alt="User" className="user-avatar" 
        />
        <div className="user-info">
          <h4>{user?.username || 'Loading...'}</h4>
          <span className="logout-btn" onClick={handleLogout}>Log out</span>
        </div>
      </div>
    </nav>
  );
}

