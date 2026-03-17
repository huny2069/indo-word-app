import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, BookOpen, GraduationCap, Settings, Sparkles, FileWarning } from 'lucide-react';

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '대시보드', icon: <Home size={24} /> },
    { path: '/generate', label: '단어생성', icon: <Sparkles size={24} /> },
    { path: '/words', label: '단어장', icon: <BookOpen size={24} /> },
    { path: '/learn', label: '학습하기', icon: <GraduationCap size={24} /> },
    { path: '/incorrect', label: '오답노트', icon: <FileWarning size={24} /> },
    { path: '/settings', label: '설정', icon: <Settings size={24} /> },
  ];

  return (
    <div className="app-container">
      <header className="navbar desktop-only">
        <h1>인도네시아어 학습장</h1>
        <nav>
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
