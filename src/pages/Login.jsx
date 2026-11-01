import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Sparkles, Globe, ShieldCheck } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const { t, userLang, changeUserLang } = useLanguage();

  useEffect(() => {
    /* global google */
    const initGoogle = () => {
      try {
        if (window.google?.accounts?.id) {
          console.log("Initializing Google Identity...");
          google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleCallbackResponse,
            auto_select: false,
            cancel_on_tap_outside: false
          });
          const signInDiv = document.getElementById("signInDiv");
          if (signInDiv) {
            signInDiv.innerHTML = '';
            google.accounts.id.renderButton(
              signInDiv,
              { theme: "outline", size: "large", width: "100%", shape: "pill" }
            );
          }
        } else {
          console.warn("Google Accounts ID not found yet.");
        }
      } catch (err) {
        console.error("Google Init Error:", err);
      }
    };

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.google?.accounts?.id) {
        initGoogle();
        clearInterval(interval);
      } else if (attempts > 20) {
        console.error("Google Identity script failed to load after 10s.");
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [userLang]);

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
        
        {/* 언어 즉시 선택 바 (다국어 지원) */}
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          background: '#f8fafc', 
          padding: '4px', 
          borderRadius: '30px', 
          border: '1px solid #e2e8f0', 
          marginBottom: '1.2rem', 
          gap: '4px' 
        }}>
          {[
            { code: 'ko', flag: '🇰🇷', label: '한국어' },
            { code: 'id', flag: '🇮🇩', label: 'Indonesia' },
            { code: 'en', flag: '🇺🇸', label: 'English' }
          ].map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => changeUserLang(l.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: userLang === l.code ? '800' : '600',
                background: userLang === l.code ? '#feca57' : 'transparent',
                color: userLang === l.code ? '#000' : '#64748b',
                boxShadow: userLang === l.code ? '0 2px 6px rgba(254, 202, 87, 0.4)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        <div>
          <img 
            src="/assets/img/nana.png" 
            alt="Nana Mascot" 
            className="nana-character"
            style={{ width: '105px', marginBottom: '1rem', filter: 'drop-shadow(0 10px 15px rgba(254, 202, 87, 0.4))' }} 
          />
        </div>

        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '900', 
          color: 'var(--nana-dark)', 
          margin: '0 0 8px 0',
          letterSpacing: '-0.5px'
        }}>
          Inko Nana <span style={{ color: '#feca57' }}>Pro</span>
        </h1>
        
        {/* 다국어 서브타이틀 및 소개 */}
        <div style={{ margin: '0 0 28px 0' }}>
          <p style={{ 
            color: 'var(--nana-dark)', 
            fontSize: '1.02rem', 
            lineHeight: '1.5', 
            margin: '0 0 6px 0',
            fontWeight: '700' 
          }}>
            {t('login_subtitle_1')}<br/>
            {t('login_subtitle_2')}
          </p>
          <div style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: '600', lineHeight: '1.4' }}>
            Smart Multilingual Wordbook & AI Study Tools<br/>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Kosakata Multibahasa Pintar & Alat Belajar AI</span>
          </div>
        </div>

        {/* 구글 로그인 영역 */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ marginBottom: '10px', fontSize: '0.82rem', fontWeight: '700', color: '#475569' }}>
            Google 계정으로 로그인 • Sign in with Google • Masuk dengan Google
          </div>
          <div id="signInDiv" style={{ display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.05))' }}></div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px', 
          borderTop: '1px solid #f0f0f0', 
          paddingTop: '24px' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fef9e7', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <Globe size={18} color="#feca57" />
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#334155' }}>{t('login_feat_global')}</div>
            <div style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>Global Study</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fef9e7', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <ShieldCheck size={18} color="#feca57" />
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#334155' }}>{t('login_feat_sync')}</div>
            <div style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>Cloud Sync</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fef9e7', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
              <Sparkles size={18} color="#feca57" />
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#334155' }}>{t('login_feat_ai')}</div>
            <div style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>AI Word Gen</div>
          </div>
        </div>

        <div style={{ marginTop: '28px', fontSize: '0.76rem', color: '#94a3b8', lineHeight: '1.5' }}>
          <div>계속 진행하면 서비스 이용약관 및 데이터 정책에 동의하게 됩니다.</div>
          <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>By continuing, you agree to our Terms and Data Policy.</div>
        </div>
      </div>
    </div>
  );
};

export default Login;
