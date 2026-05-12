import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BookOpen, Sparkles, FolderHeart, CloudLightning, Info, Key, Cloud, CreditCard, ExternalLink, GraduationCap } from 'lucide-react';

const Guide = () => {
  const { t } = useLanguage();

  const steps = [
    {
      id: 1,
      icon: <Sparkles size={28} color="#feca57" />,
      title: t('guide_step1_title'),
      desc: t('guide_step1_desc'),
    },
    {
      id: 2,
      icon: <FolderHeart size={28} color="#ff7675" />,
      title: t('guide_step2_title'),
      desc: t('guide_step2_desc'),
    },
    {
      id: 3,
      icon: <BookOpen size={28} color="#48dbfb" />,
      title: t('guide_step3_title'),
      desc: t('guide_step3_desc'),
    },
    {
      id: 4,
      icon: <GraduationCap size={28} color="#9b59b6" />,
      title: t('guide_step4_title'),
      desc: t('guide_step4_desc'),
    },
    {
      id: 5,
      icon: <CloudLightning size={28} color="#4285f4" />,
      title: t('guide_step5_title'),
      desc: t('guide_step5_desc'),
    }
  ];

  const renderLink = (text) => {
    if (!text) return '';
    // [Text](Link) 형식을 찾아서 a 태그로 변환
    const parts = text.split(/\[(.*?)\]\((.*?)\)/);
    if (parts.length > 1) {
        return (
            <>
                {parts[0]}
                <a href={parts[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    {parts[1]} <ExternalLink size={12} />
                </a>
                {parts[3]}
            </>
        );
    }
    return text;
  };

  return (
    <div className="page" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3.5rem', marginTop: '1rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--primary-color)', marginBottom: '1rem', letterSpacing: '-1px' }}>
          {t('nav_guide')}
        </h1>
        <p style={{ color: '#666', fontSize: '1.1rem', fontWeight: '500' }}>
          {t('guide_welcome_desc')}
        </p>
      </div>

      {/* 🚀 빠른 시작 가이드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
        {steps.map(step => (
          <div key={step.id} style={{ 
            background: '#fff', 
            padding: '1.5rem', 
            borderRadius: '24px', 
            boxShadow: '0 8px 25px rgba(0,0,0,0.04)',
            border: '1px solid #f0f0f0',
            display: 'flex',
            gap: '1.2rem',
            alignItems: 'center'
          }}>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '18px' }}>{step.icon}</div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 0.3rem 0', color: '#333', fontSize: '1.1rem', fontWeight: '800' }}>{step.title}</h4>
              <p style={{ margin: 0, color: '#777', fontSize: '0.9rem', lineHeight: '1.5' }}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 🔑 상세 가이드 섹션 */}
      <h2 style={{ fontSize: '1.6rem', fontWeight: '900', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <Info color="var(--primary-color)" /> {t('guide_detail_title')}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        {/* Gemini API Section */}
        <section style={{ background: '#fff', padding: '2rem', borderRadius: '30px', border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#e3f2fd', padding: '0.6rem', borderRadius: '12px' }}><Key size={24} color="#1976d2" /></div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800' }}>{t('guide_section_api')}</h3>
          </div>
          <div style={{ display: 'grid', gap: '1rem', fontSize: '0.95rem', color: '#444' }}>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{renderLink(t('guide_api_step1'))}</div>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{t('guide_api_step2')}</div>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{t('guide_api_step3')}</div>
          </div>
        </section>

        {/* Google Drive Section */}
        <section style={{ background: '#fff', padding: '2rem', borderRadius: '30px', border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#e8f5e9', padding: '0.6rem', borderRadius: '12px' }}><Cloud size={24} color="#2e7d32" /></div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800' }}>{t('guide_section_drive')}</h3>
          </div>
          <div style={{ display: 'grid', gap: '1rem', fontSize: '0.95rem', color: '#444' }}>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{t('guide_drive_step1')}</div>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{t('guide_drive_step2')}</div>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{t('guide_drive_step3')}</div>
          </div>
        </section>

        {/* Google Cloud TTS Section */}
        <section style={{ background: '#fff', padding: '2rem', borderRadius: '30px', border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#fff3e0', padding: '0.6rem', borderRadius: '12px' }}><CloudLightning size={24} color="#e67e22" /></div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800' }}>{t('guide_section_google_tts')}</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.92rem', color: '#444' }}>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{renderLink(t('guide_tts_step1'))}</div>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{t('guide_tts_step2')}</div>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{t('guide_tts_step3')}</div>
            <div style={{ background: '#fff9db', padding: '1rem', borderRadius: '15px', border: '1px solid #feca57', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={18} color="#e67e22" style={{minWidth: '18px'}} />
                <span>{t('guide_tts_step4')}</span>
            </div>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>{t('guide_tts_step5')}</div>
          </div>
        </section>
      </div>

      {/* 💰 비용 및 토큰 안내 */}
      <section style={{ marginTop: '3rem', background: '#fffdf0', padding: '2.5rem', borderRadius: '35px', border: '2px dashed #feca57' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: '#fff', padding: '0.8rem', borderRadius: '50%', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}><CreditCard size={28} color="#e67e22" /></div>
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', color: '#856404' }}>{t('guide_section_billing')}</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div>
            <h5 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#2d3436' }}>✨ {t('guide_billing_token_title')}</h5>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#636e72', lineHeight: '1.6' }}>{t('guide_billing_token_desc')}</p>
          </div>
          <div>
            <h5 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#2d3436' }}>💸 {t('guide_billing_cost_title')}</h5>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#636e72', lineHeight: '1.6' }}>{t('guide_billing_cost_desc')}</p>
          </div>
        </div>
      </section>

      <div style={{ 
        marginTop: '4rem', 
        padding: '2.5rem', 
        background: 'linear-gradient(135deg, #feca57, #ff9f43)', 
        borderRadius: '35px', 
        color: '#fff',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(254, 202, 87, 0.3)'
      }}>
        <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.5rem', fontWeight: '900' }}>
            {t('guide_questions_title')} 🍌
        </h3>
        <p style={{ margin: 0, opacity: 0.95, fontWeight: 'bold' }}>
            {t('guide_questions_desc')}
        </p>
      </div>
    </div>
  );
};

export default Guide;
