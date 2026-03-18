import React, { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, BookOpen, GraduationCap, Settings as SettingsIcon, Sparkles, AlertCircle, Info, Languages, ChevronDown, BarChart3 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Layout = () => {
  const location = useLocation();
  const { lang, setLanguage, t } = useLanguage();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { path: '/', label: t('nav_dashboard'), icon: <Home size={24} /> },
    { path: '/generate', label: t('nav_generate'), icon: <Sparkles size={24} /> },
    { path: '/words', label: t('nav_words'), icon: <BookOpen size={24} /> },
    { path: '/learn', label: t('nav_learn'), icon: <GraduationCap size={24} /> },
    { path: '/incorrect', label: t('nav_incorrect'), icon: <AlertCircle size={24} /> },
    { path: '/guide', label: t('nav_guide'), icon: <Info size={24} /> },
    { path: '/settings', label: t('nav_settings'), icon: <SettingsIcon size={24} /> },
    { path: '/statistics', label: t('nav_stats'), icon: <BarChart3 size={24} /> },
  ];

  const languages = [
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' }
  ];

  const currentLang = languages.find(l => l.code === lang) || languages[0];

  return (
    <div className="app-container">
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <h1 className="desktop-only" style={{ fontWeight: '900', letterSpacing: '-1px' }}>Inko</h1>
          
          <div className="lang-selector-container" ref={dropdownRef}>
            <button 
              className="lang-selector-btn" 
              onClick={() => setIsLangOpen(!isLangOpen)}
              aria-haspopup="true"
              aria-expanded={isLangOpen}
            >
              <span style={{ fontSize: '1.3rem' }}>{currentLang.flag}</span>
              <span className="desktop-only" style={{ fontSize: '0.9rem' }}>{currentLang.name}</span>
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
            >
              {item.label}
            </Link>
          ))}
        </nav>
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
