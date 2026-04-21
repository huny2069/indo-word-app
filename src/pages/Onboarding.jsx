import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Flag, Sparkles, ChevronRight, Languages } from 'lucide-react';

const Onboarding = () => {
  const { completeOnboarding, user } = useAuth();
  const { t, changeUserLang, changeStudyLang, userLang } = useLanguage();
  
  // 1: 모국어 선택, 2: 학습 언어 선택
  const [step, setStep] = useState(1);

  const languages = [
    { code: 'ko', name: '한국어', flag: '🇰🇷', label: 'Korean' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', label: 'Indonesian' },
    { code: 'en', name: 'English', flag: '🇺🇸', label: 'English' }
  ];

  const handleSelectNative = (code) => {
    changeUserLang(code);
    setStep(2);
  };

  const handleSelectStudy = (code) => {
    changeStudyLang(code);
    completeOnboarding(code); 
  };

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
        maxWidth: '550px',
        width: '100%',
        background: '#fff',
        borderRadius: '40px',
        padding: '3rem',
        boxShadow: '0 25px 60px rgba(254, 202, 87, 0.25)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '4rem', opacity: 0.1, transform: 'rotate(15deg)' }}>🍌</div>

        <div style={{
          background: '#fef9e7',
          width: '70px',
          height: '70px',
          borderRadius: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
          boxShadow: '0 10px 20px rgba(254, 202, 87, 0.2)',
          transform: 'rotate(-5deg)'
        }}>
          <Languages size={36} color="#feca57" />
        </div>

        <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--nana-dark)', margin: '0 0 0.5rem 0' }}>
          {t('onboarding_title')}
        </h2>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '2.5rem' }}>
            <div style={{ width: '40px', height: '6px', borderRadius: '10px', background: step === 1 ? '#feca57' : '#eee', transition: 'all 0.3s' }}></div>
            <div style={{ width: '40px', height: '6px', borderRadius: '10px', background: step === 2 ? '#feca57' : '#eee', transition: 'all 0.3s' }}></div>
        </div>

        <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: '700', margin: '0 0 2.5rem 0', lineHeight: '1.5' }}>
          {step === 1 ? t('onboarding_native') : t('onboarding_study')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          {languages.map((lang) => {
            if (step === 2 && lang.code === userLang) return null;

            return (
              <button 
                key={lang.code}
                onClick={() => step === 1 ? handleSelectNative(lang.code) : handleSelectStudy(lang.code)}
                style={{
                  padding: '1.2rem 2rem',
                  background: '#fff',
                  border: '3px solid #f0f0f0',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.01)',
                  textAlign: 'left',
                  width: '100%'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#feca57';
                  e.currentTarget.style.transform = 'translateX(10px)';
                  e.currentTarget.style.background = '#fffdf5';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#f0f0f0';
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <span style={{ fontSize: '2.5rem', lineHeight: '1' }}>{lang.flag}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--nana-dark)' }}>{lang.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#999', fontWeight: '600' }}>{lang.label}</div>
                </div>
                <ChevronRight size={20} color="#ccc" />
              </button>
            );
          })}
        </div>

        {step === 2 && (
            <button 
                onClick={() => setStep(1)}
                style={{ marginTop: '2rem', background: 'none', border: 'none', color: '#999', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}
            >
                {t('btn_back')}
            </button>
        )}

        <div style={{ marginTop: '3rem', fontSize: '0.85rem', color: '#bbb', fontWeight: '600' }}>
          * {t('guide_drive_step1').split(':')[0]} 🍌
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
