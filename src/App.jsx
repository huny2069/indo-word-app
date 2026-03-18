import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { logAccess } from './api/supabase';

import Dashboard from './pages/Dashboard';
import WordGenerate from './pages/WordGenerate';
import WordList from './pages/WordList';
import Learn from './pages/Learn';
import Settings from './pages/Settings';
import IncorrectNotes from './pages/IncorrectNotes';
import Guide from './pages/Guide';
import AdminStats from './pages/AdminStats';

function App() {
  useEffect(() => {
    // 1. 기기 식별을 위한 익명 ID 생성 및 저장
    let deviceId = localStorage.getItem('user_device_id');
    if (!deviceId) {
      deviceId = 'user_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('user_device_id', deviceId);
    }

    // 2. 접속 로그 전송 (Supabase 연동 시)
    logAccess(deviceId);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="generate" element={<WordGenerate />} />
          <Route path="words" element={<WordList />} />
          <Route path="learn" element={<Learn />} />
          <Route path="incorrect" element={<IncorrectNotes />} />
          <Route path="settings" element={<Settings />} />
          <Route path="guide" element={<Guide />} />
          <Route path="statistics" element={<AdminStats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
