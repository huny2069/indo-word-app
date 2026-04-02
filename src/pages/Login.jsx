import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Sparkles, Globe, ShieldCheck } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    /* global google */
    const initGoogle = () => {
      if (window.google) {
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCallbackResponse
        });

        google.accounts.id.renderButton(
          document.getElementById("signInDiv"),
          { theme: "outline", size: "large", width: "100%", shape: "pill" }
        );
      }
    };

    // 스크립트가 이미 로드되었는지 확인, 아니면 500ms마다 체크 (최대 10회)
    let retryCount = 0;
    const checkInterval = setInterval(() => {
      if (window.google) {
        initGoogle();
        clearInterval(checkInterval);
      } else if (retryCount > 10) {
        clearInterval(checkInterval);
      }
      retryCount++;
    }, 500);

    return () => clearInterval(checkInterval);
  }, []);

  const handleCallbackResponse = (response) => {
    const userObject = JSON.parse(atob(response.credential.split('.')[1]));
    login({
      name: userObject.name,
      email: userObject.email,
      picture: userObject.picture,
      token: response.credential
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fffcf0 0%, #fff5d5 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: '450px',
        width: '100%',
        background: '#fff',
        borderRadius: '40px',
        padding: '50px 40px',
        boxShadow: '0 25px 70px rgba(254, 202, 87, 0.25)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}><Sparkles size={80} color="#feca57" /></div>
        
        <img 
          src="/assets/img/nana.png" 
          alt="Nana Mascot" 
          style={{ width: '120px', marginBottom: '1.5rem', filter: 'drop-shadow(0 10px 15px rgba(254, 202, 87, 0.4))' }} 
        />

        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '900', 
          color: 'var(--nana-dark)', 
          margin: '0 0 10px 0',
          letterSpacing: '-0.5px'
        }}>
          Inko Nana <span style={{ color: '#feca57' }}>Pro</span>
        </h1>
        
        <p style={{ 
          color: '#666', 
          fontSize: '1rem', 
          lineHeight: '1.6', 
          margin: '0 0 40px 0',
          fontWeight: '500' 
        }}>
          당신만의 똑똑한 인도네시아어 단어장<br/>
          로그인하고 최고의 학습 도구를 만나보세요.
        </p>

        <div style={{ marginBottom: '40px' }}>
          <div id="signInDiv" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.05))' }}></div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '15px', 
          borderTop: '1px solid #f0f0f0', 
          paddingTop: '30px' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fef9e7', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <Globe size={18} color="#feca57" />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#999' }}>글로벌 학습</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fef9e7', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <ShieldCheck size={18} color="#feca57" />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#999' }}>안전한 동기화</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fef9e7', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <Sparkles size={18} color="#feca57" />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#999' }}>AI 단어 생성</span>
          </div>
        </div>

        <div style={{ marginTop: '40px', fontSize: '0.8rem', color: '#ccc' }}>
          By continuing, you agree to our Terms and Data Policy.
        </div>
      </div>
    </div>
  );
};

export default Login;
