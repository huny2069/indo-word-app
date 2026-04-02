import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Flag, Sparkles } from 'lucide-react';

const Onboarding = () => {
  const { completeOnboarding, user } = useAuth();
  const { t } = useLanguage();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fffcf0 0%, #fff5d5 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: '#fff',
        borderRadius: '30px',
        padding: '2.5rem',
        boxShadow: '0 20px 50px rgba(254, 202, 87, 0.2)',
        textAlign: 'center'
      }}>
        <div style={{
          background: '#fef9e7',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 8px 15px rgba(254, 202, 87, 0.3)'
        }}>
          <Sparkles size={30} color="#feca57" />
        </div>

        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--nana-dark)', margin: '0 0 0.5rem 0' }}>
          환영합니다, <span style={{ color: '#feca57' }}>{user?.name}!</span>
        </h2>
        
        <p style={{ color: '#666', fontSize: '1.1rem', fontWeight: '600', margin: '0 0 2rem 0' }}>
          국적을 선택해 주세요.<br/>
          Pilih kewarganegaraan Anda.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
          {/* 한국인 모드 */}
          <button 
            onClick={() => completeOnboarding('KR')}
            style={{
              padding: '2.5rem 1.5rem',
              background: '#fff',
              border: '4px solid #f0f0f0',
              borderRadius: '25px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#feca57';
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 15px 30px rgba(254, 202, 87, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#f0f0f0';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.02)';
            }}
          >
            <span style={{ fontSize: '4.5rem', lineHeight: '1' }}>🇰🇷</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--nana-dark)' }}>한국인</span>
            <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 'bold' }}>Korean</span>
          </button>

          {/* 인도네시아인 모드 */}
          <button 
            onClick={() => completeOnboarding('ID')}
            style={{
              padding: '2.5rem 1.5rem',
              background: '#fff',
              border: '4px solid #f0f0f0',
              borderRadius: '25px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#ff7675';
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 15px 30px rgba(255, 118, 117, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#f0f0f0';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.02)';
            }}
          >
            <span style={{ fontSize: '4.5rem', lineHeight: '1' }}>🇮🇩</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--nana-dark)' }}>Indonesian</span>
            <span style={{ fontSize: '0.8rem', color: '#999', fontWeight: 'bold' }}>인도네시아인</span>
          </button>
        </div>

        <div style={{ marginTop: '3rem', fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>
          * 이 설정은 나중에 설정 탭에서 변경할 수 있습니다. 🍌
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
