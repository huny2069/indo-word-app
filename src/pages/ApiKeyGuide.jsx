import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Key, MousePointer2, Copy, ShieldAlert, ExternalLink, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ApiKeyGuide = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <button 
        onClick={() => navigate(-1)} 
        style={{ 
          display: 'flex', alignItems: 'center', gap: '6px', 
          background: 'none', border: 'none', color: '#888', 
          fontWeight: '800', cursor: 'pointer', marginBottom: '1.5rem',
          padding: '0.5rem 0', fontSize: '0.9rem'
        }}
      >
        <ArrowLeft size={18} /> {t('btn_back')}
      </button>

      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ 
          display: 'inline-flex', background: '#fff3e0', 
          padding: '0.8rem', borderRadius: '20px', marginBottom: '1rem' 
        }}>
          <Key size={32} color="#e67e22" />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--nana-dark)', marginBottom: '0.5rem' }}>
          {t('api_guide_title')}
        </h1>
        <p style={{ color: '#777', fontSize: '0.95rem', fontWeight: '600' }}>
          {t('api_guide_subtitle')}
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Step 1 */}
        <section className="settings-card" style={{ position: 'relative', overflow: 'hidden', padding: '1.5rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#4285f4' }} />
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.8rem' }}>
            <MousePointer2 size={20} color="#4285f4" /> {t('api_guide_step1_title')}
          </h3>
          <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.2rem' }}>{t('api_guide_step1_desc')}</p>
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '8px', 
              background: '#4285f4', color: '#fff', padding: '0.8rem 1.2rem', 
              borderRadius: '12px', fontWeight: '900', textDecoration: 'none',
              fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(66, 133, 244, 0.2)'
            }}
          >
            {t('btn_go_ai_studio')} <ExternalLink size={16} />
          </a>
        </section>

        {/* Step 2 */}
        <section className="settings-card" style={{ position: 'relative', overflow: 'hidden', padding: '1.5rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#34a853' }} />
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.8rem' }}>
            <Sparkles size={20} color="#34a853" /> {t('api_guide_step2_title')}
          </h3>
          <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: '1.5' }}>{t('api_guide_step2_desc')}</p>
          <div style={{ marginTop: '0.8rem', background: '#f8f9fa', padding: '1rem', borderRadius: '15px', border: '1px solid #f0f0f0', textAlign: 'center', color: '#999', fontSize: '0.8rem', fontWeight: 'bold' }}>
             [ Google AI Studio - Create API Key ]
          </div>
        </section>

        {/* Step 3 */}
        <section className="settings-card" style={{ position: 'relative', overflow: 'hidden', padding: '1.5rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#feca57' }} />
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.8rem' }}>
            <Copy size={20} color="#feca57" /> {t('api_guide_step3_title')}
          </h3>
          <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: '1.5' }}>{t('api_guide_step3_desc')}</p>
        </section>

        {/* Caution */}
        <section style={{ 
          background: '#fff1f2', padding: '1.2rem', 
          borderRadius: '20px', border: '1px solid #fecaca' 
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: '900', color: '#e11d48', marginBottom: '0.5rem' }}>
            <ShieldAlert size={18} /> {t('api_guide_caution_title')}
          </h3>
          <p style={{ color: '#9f1239', fontSize: '0.85rem', lineHeight: '1.5', margin: 0, fontWeight: '700' }}>
            {t('api_guide_caution_desc')}
          </p>
        </section>
      </div>

      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <button 
          onClick={() => navigate('/settings')}
          style={{ 
            background: 'var(--nana-dark)', color: '#fff', 
            padding: '1rem 2.5rem', borderRadius: '15px', 
            border: 'none', fontWeight: '900', fontSize: '1rem',
            cursor: 'pointer', boxShadow: '0 4px 0 #000'
          }}
        >
          {t('btn_confirm')}
        </button>
      </div>
    </div>
  );
};

export default ApiKeyGuide;
