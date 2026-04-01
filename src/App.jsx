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
    // 1. 기기 식별 및 로그 전송
    let deviceId = localStorage.getItem('user_device_id');
    if (!deviceId) {
      deviceId = 'user_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('user_device_id', deviceId);
    }
    logAccess(deviceId);

    // 2. [v7.8] 전역 구글 세션 관리 (Silent Refresh)
    const handleSilentRefresh = () => {
      if (!window.google) return;
      const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/cloud-platform';
      
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (res) => {
          if (res.access_token) {
            localStorage.setItem('gcp_access_token', res.access_token);
            const expiry = Date.now() + (res.expires_in || 3600) * 1000;
            localStorage.setItem('gcp_token_expiry', expiry.toString());
            console.log("Global session refreshed successfully.");
          }
        },
        error_callback: () => {} // Silent mode이므로 에러 무시
      });
      client.requestAccessToken({ prompt: '' });
    };

    const checkInterval = setInterval(() => {
      const expiry = localStorage.getItem('gcp_token_expiry');
      if (expiry) {
        const remaining = parseInt(expiry, 10) - Date.now();
        // 만료 10분 전이면 백그라운드 갱신
        if (remaining > 0 && remaining < 600000) {
          handleSilentRefresh();
        }
      }
    }, 60000); // 1분마다 체크

    return () => clearInterval(checkInterval);
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
