import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Key, MousePointer2, Copy, ShieldAlert, ExternalLink, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ApiKeyGuide = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '5rem' }}>
      <button 
        onClick={() => navigate(-1)} 
        style={{ 
          display: 'flex', alignItems: 'center', gap: '8px', 
          background: 'none', border: 'none', color: '#666', 
          fontWeight: '800', cursor: 'pointer', marginBottom: '2rem',
          padding: '0.5rem 0'
        }}
      >
        <ArrowLeft size={20} /> {t('btn_back')}
      </button>

      <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <div style={{ 
          display: 'inline-flex', background: '#fff3e0', 
          padding: '1rem', borderRadius: '24px', marginBottom: '1.5rem' 
        }}>
          <Key size={40} color="#e67e22" />
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--primary-color)', marginBottom: '1rem' }}>
          {t('api_guide_title')}
        </h1>
        <p style={{ color: '#666', fontSize: '1.1rem', fontWeight: '500' }}>
          {t('api_guide_subtitle')}
        </p>
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Step 1 */}
        <section style={{ 
          background: '#fff', padding: '2rem', borderRadius: '30px', 
          border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', background: '#4285f4' }} />
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.3rem', fontWeight: '800', marginBottom: '1rem' }}>
            <MousePointer2 size={24} color="#4285f4" /> {t('api_guide_step1_title')}
          </h3>
          <p style={{ color: '#555', lineHeight: '1.6', marginBottom: '1.5rem' }}>{t('api_guide_step1_desc')}</p>
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '8px', 
              background: '#4285f4', color: '#fff', padding: '1rem 1.8rem', 
              borderRadius: '18px', fontWeight: '900', textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(66, 133, 244, 0.3)'
            }}
          >
            {t('btn_go_ai_studio')} <ExternalLink size={18} />
          </a>
        </section>

        {/* Step 2 */}
        <section style={{ 
          background: '#fff', padding: '2rem', borderRadius: '30px', 
          border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', background: '#34a853' }} />
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.3rem', fontWeight: '800', marginBottom: '1rem' }}>
            <Sparkles size={24} color="#34a853" /> {t('api_guide_step2_title')}
          </h3>
          <p style={{ color: '#555', lineHeight: '1.6' }}>{t('api_guide_step2_desc')}</p>
          <div style={{ marginTop: '1rem', background: '#f8f9fa', padding: '1rem', borderRadius: '15px', border: '1px solid #f0f0f0' }}>
            <img src="https://lh3.googleusercontent.com/pw/AP1GczPrV8S8xUqVf... (placeholder)" alt="Guide Step" style={{ width: '100%', borderRadius: '10px', display: 'none' }} />
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.9rem', border: '2px dashed #ddd', borderRadius: '10px' }}>
              [AI Studio 화면의 "Create API key" 버튼 클릭 이미지]
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section style={{ 
          background: '#fff', padding: '2rem', borderRadius: '30px', 
          border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', background: '#feca57' }} />
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.3rem', fontWeight: '800', marginBottom: '1rem' }}>
            <Copy size={24} color="#feca57" /> {t('api_guide_step3_title')}
          </h3>
          <p style={{ color: '#555', lineHeight: '1.6' }}>{t('api_guide_step3_desc')}</p>
        </section>

        {/* Caution */}
        <section style={{ 
          marginTop: '1rem', background: '#fff1f2', padding: '2rem', 
          borderRadius: '30px', border: '1px solid #fecaca' 
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.2rem', fontWeight: '900', color: '#e11d48', marginBottom: '1rem' }}>
            <ShieldAlert size={24} /> {t('api_guide_caution_title')}
          </h3>
          <p style={{ color: '#9f1239', fontSize: '0.95rem', lineHeight: '1.6', margin: 0, fontWeight: '600' }}>
            {t('api_guide_caution_desc')}
          </p>
        </section>
      </div>

      <div style={{ marginTop: '4rem', textAlign: 'center' }}>
        <button 
          onClick={() => navigate('/settings')}
          style={{ 
            background: 'var(--nana-dark)', color: '#fff', 
            padding: '1.2rem 3rem', borderRadius: '25px', 
            border: 'none', fontWeight: '900', fontSize: '1.1rem',
            cursor: 'pointer', boxShadow: '0 6px 0 #000'
          }}
        >
          {t('btn_confirm')}
        </button>
      </div>
    </div>
  );
};

export default ApiKeyGuide;
