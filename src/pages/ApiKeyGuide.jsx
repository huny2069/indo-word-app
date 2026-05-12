import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Key, MousePointer2, Copy, ShieldAlert, ExternalLink, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ApiKeyGuide = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '5rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .guide-section {
          background: #fff;
          padding: 2rem;
          border-radius: 30px;
          border: 1px solid #eee;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          position: relative;
          overflow: hidden;
          margin-bottom: 2rem;
        }
        .guide-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          width: 6px;
          height: 100%;
        }
        @media (max-width: 600px) {
          .guide-section {
            padding: 1.5rem;
            border-radius: 20px;
            margin-bottom: 1.2rem;
          }
          .page {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }
          h1 {
            font-size: 1.6rem !important;
          }
          h3 {
            font-size: 1.1rem !important;
          }
          p {
            font-size: 0.9rem !important;
          }
        }
      `}</style>

      <button 
        onClick={() => navigate(-1)} 
        style={{ 
          display: 'flex', alignItems: 'center', gap: '8px', 
          background: 'none', border: 'none', color: '#666', 
          fontWeight: '800', cursor: 'pointer', marginBottom: '1.5rem',
          padding: '0.5rem 0'
        }}
      >
        <ArrowLeft size={20} /> {t('btn_back')}
      </button>

      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ 
          display: 'inline-flex', background: '#fff3e0', 
          padding: '0.8rem', borderRadius: '20px', marginBottom: '1rem' 
        }}>
          <Key size={32} color="#e67e22" />
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--primary-color)', marginBottom: '0.8rem' }}>
          {t('api_guide_title')}
        </h1>
        <p style={{ color: '#666', fontSize: '1.1rem', fontWeight: '500' }}>
          {t('api_guide_subtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Step 1 */}
        <section className="guide-section">
          <div className="guide-accent-bar" style={{ background: '#4285f4' }} />
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
              background: '#4285f4', color: '#fff', padding: '0.9rem 1.5rem', 
              borderRadius: '15px', fontWeight: '900', textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(66, 133, 244, 0.3)', fontSize: '0.95rem'
            }}
          >
            {t('btn_go_ai_studio')} <ExternalLink size={18} />
          </a>
        </section>

        {/* Step 2 */}
        <section className="guide-section">
          <div className="guide-accent-bar" style={{ background: '#34a853' }} />
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.3rem', fontWeight: '800', marginBottom: '1rem' }}>
            <Sparkles size={24} color="#34a853" /> {t('api_guide_step2_title')}
          </h3>
          <p style={{ color: '#555', lineHeight: '1.6' }}>{t('api_guide_step2_desc')}</p>
          <div style={{ marginTop: '1.2rem', background: '#f8f9fa', padding: '1.2rem', borderRadius: '15px', border: '1px solid #f0f0f0' }}>
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#999', fontSize: '0.85rem', border: '2px dashed #ddd', borderRadius: '10px', background: '#fff' }}>
                {t('api_guide_title')} Step 2 Illustration
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section className="guide-section">
          <div className="guide-accent-bar" style={{ background: '#feca57' }} />
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.3rem', fontWeight: '800', marginBottom: '1rem' }}>
            <Copy size={24} color="#feca57" /> {t('api_guide_step3_title')}
          </h3>
          <p style={{ color: '#555', lineHeight: '1.6' }}>{t('api_guide_step3_desc')}</p>
        </section>

        {/* Caution */}
        <section style={{ 
          marginTop: '0.5rem', background: '#fff1f2', padding: '1.5rem', 
          borderRadius: '25px', border: '1px solid #fecaca' 
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.1rem', fontWeight: '900', color: '#e11d48', marginBottom: '0.8rem' }}>
            <ShieldAlert size={22} /> {t('api_guide_caution_title')}
          </h3>
          <p style={{ color: '#9f1239', fontSize: '0.9rem', lineHeight: '1.6', margin: 0, fontWeight: '600' }}>
            {t('api_guide_caution_desc')}
          </p>
        </section>
      </div>

      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <button 
          onClick={() => navigate('/settings')}
          style={{ 
            background: 'var(--nana-dark)', color: '#fff', 
            padding: '1.1rem 2.5rem', borderRadius: '20px', 
            border: 'none', fontWeight: '900', fontSize: '1.1rem',
            cursor: 'pointer', boxShadow: '0 5px 0 #000', width: '100%', maxWidth: '300px'
          }}
        >
          {t('btn_confirm')}
        </button>
      </div>
    </div>
  );
};

export default ApiKeyGuide;
