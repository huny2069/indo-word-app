import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, BookOpen, GraduationCap, Settings as SettingsIcon, Sparkles, AlertCircle, Info, Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Layout = () => {
  const location = useLocation();
  const { isIndoMode, toggleMode, t } = useLanguage();

  const navItems = [
    { path: '/', label: t('nav_dashboard'), icon: <Home size={24} /> },
    { path: '/generate', label: t('nav_generate'), icon: <Sparkles size={24} /> },
    { path: '/words', label: t('nav_words'), icon: <BookOpen size={24} /> },
    { path: '/learn', label: t('nav_learn'), icon: <GraduationCap size={24} /> },
    { path: '/incorrect', label: t('nav_incorrect'), icon: <AlertCircle size={24} /> },
    { path: '/guide', label: t('nav_guide'), icon: <Info size={24} /> },
    { path: '/settings', label: t('nav_settings'), icon: <SettingsIcon size={24} /> },
  ];

  return (
    <div className="app-container">
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="desktop-only">{isIndoMode ? 'Inko (Belajar B. Korea)' : 'Inko (인니의 정석)'}</h1>
          <button 
            onClick={toggleMode}
            className="mode-toggle-btn"
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '20px',
              border: '2px solid var(--primary-color)',
              background: isIndoMode ? 'var(--primary-color)' : 'transparent',
              color: isIndoMode ? 'white' : 'var(--primary-color)',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem'
            }}
          >
            <Languages size={16} />
            {isIndoMode ? 'B. Korea' : '인도네시아어'}
          </button>
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
