import React, { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, BookOpen, GraduationCap, Settings as SettingsIcon, Sparkles, AlertCircle, Info, Languages, ChevronDown, BarChart3, LogOut, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const location = useLocation();
  const { lang, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const dropdownRef = useRef(null);
  const userRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target)) {
        setIsUserOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().trim();
  const userEmail = (user?.email || '').toLowerCase().trim();
  const isAdmin = adminEmail && userEmail === adminEmail;

  const navItems = [
    { path: '/', label: t('nav_dashboard'), icon: <Home size={24} /> },
    { path: '/generate', label: t('nav_generate'), icon: <Sparkles size={24} /> },
    { path: '/words', label: t('nav_words'), icon: <BookOpen size={24} /> },
    { path: '/learn', label: t('nav_learn'), icon: <GraduationCap size={24} /> },
    { path: '/incorrect', label: t('nav_incorrect'), icon: <AlertCircle size={24} /> },
    { path: '/guide', label: t('nav_guide'), icon: <Info size={24} /> },
    { path: '/settings', label: t('nav_settings'), icon: <SettingsIcon size={24} /> },
    ...(isAdmin ? [{ path: '/statistics', label: t('nav_stats'), icon: <BarChart3 size={24} /> }] : []),
  ];

  const languages = [
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'en', name: 'English', flag: '🇺🇸' }
  ];

  const currentLang = languages.find(l => l.code === lang) || languages[0];

  return (
    <div className="app-container">
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className="desktop-only" style={{ fontWeight: '900', letterSpacing: '-1.5px', margin: 0, fontSize: '1.8rem', color: 'var(--primary-color)' }}>Inko</h1>
          </div>
          
          <div className="lang-selector-container" ref={dropdownRef}>
            <button 
              className="lang-selector-btn" 
              onClick={() => setIsLangOpen(!isLangOpen)}
              aria-haspopup="true"
              aria-expanded={isLangOpen}
            >
              <span style={{ fontSize: '1.3rem' }}>{currentLang.flag}</span>
              <ChevronDown size={14} style={{ opacity: 0.8, transform: isLangOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            </button>

            {isLangOpen && (
              <div className="lang-dropdown">
                {languages.map(l => (
                  <button 
                    key={l.code} 
                    className={`lang-option ${lang === l.code ? 'active' : ''}`}
                    onClick={() => {
                      setLanguage(l.code);
                      setIsLangOpen(false);
                    }}
                  >
                    <span className="flag-icon">{l.flag}</span>
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="desktop-only">
          {navItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path}
              className={location.pathname === item.path ? 'active' : ''}
              style={{ fontWeight: '700', fontSize: '0.95rem' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ position: 'relative' }} ref={userRef}>
          <button 
            onClick={() => setIsUserOpen(!isUserOpen)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.6rem', 
              background: '#f8f9fa', 
              border: '2px solid #eee', 
              padding: '4px 10px 4px 6px', 
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#feca57'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = '#eee'}
          >
            <img 
              src={user?.picture || '/assets/img/nana.png'} 
              alt="Profile" 
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} 
            />
            <span className="desktop-only" style={{ fontWeight: '700', fontSize: '0.85rem', color: '#555' }}>
              {user?.name?.split(' ')[0]}
            </span>
          </button>

          {isUserOpen && (
            <div style={{
              position: 'absolute',
              top: '120%',
              right: 0,
              background: '#fff',
              minWidth: '220px',
              borderRadius: '20px',
              boxShadow: '0 15px 40px rgba(0,0,0,0.12)',
              padding: '12px',
              zIndex: 1000,
              border: '1px solid #f0f0f0'
            }}>
              <div style={{ padding: '10px', textAlign: 'left', marginBottom: '8px', borderBottom: '1px solid #f8f9fa' }}>
                <div style={{ fontWeight: '900', color: '#333', fontSize: '0.95rem' }}>{user?.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>{user?.email}</div>
              </div>
              <button 
                onClick={logout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  border: 'none',
                  background: '#fff5f5',
                  color: '#ff4d4d',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#ffe5e5'}
                onMouseOut={(e) => e.currentTarget.style.background = '#fff5f5'}
              >
                <LogOut size={18} />
                {t('logout') || 'Log out'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav mobile-only">
        {navItems.map(item => (
          <Link 
            key={item.path} 
            to={item.path}
            className={location.pathname === item.path ? 'active' : ''}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
