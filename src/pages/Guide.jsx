import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BookOpen, Sparkles, FolderHeart, CloudLightning, Info, Key, Cloud, CreditCard, ExternalLink } from 'lucide-react';

const Guide = () => {
  const { t, isIndoMode } = useLanguage();

  const steps = [
    {
      id: 1,
      icon: <Sparkles size={28} color="#feca57" />,
      title: t('guide_step1'),
      desc: isIndoMode 
        ? "Ketik topik apa saja (misal: 'Di Restoran'), dan AI Nana akan membuat daftar kata bahasa Korea yang sesuai situasi tersebut lengkap dengan contoh kalimat!"
        : "원하는 주제(예: '공항에서', '비즈니스 미팅')를 입력하면 AI 나나가 상황에 딱 맞는 한국어/인도네시아어 단어와 예문을 즉시 생성해줍니다.",
    },
    {
      id: 2,
      icon: <FolderHeart size={28} color="#ff7675" />,
      title: t('guide_step2'),
      desc: isIndoMode
        ? "Simpan kata-kata favorit Anda dalam folder khusus. Anda bisa memindahkan, mengedit, atau menghapus kata kapan saja untuk menjaga kerapian kosakata."
        : "생성된 단어들을 폴더별로 자유롭게 분류하고 관리하세요. 나만의 단어장을 만들고 중요도에 따라 정리할 수 있습니다.",
    },
    {
      id: 3,
      icon: <BookOpen size={28} color="#48dbfb" />,
      title: t('guide_step3'),
      desc: isIndoMode
        ? "Gunakan flashcard, kuis pilihan ganda, dan latihan mengeja. Algoritma ilmiah kami akan memprioritaskan kata yang sulit Anda hafal agar belajar lebih efisien."
        : "플래시카드, 객관식 퀴즈, 주관식 스펠링 연습을 통해 입체적으로 학습하세요. 망각 곡선 알고리즘이 당신이 틀린 단어를 기억할 때까지 반복해줍니다.",
    },
    {
      id: 4,
      icon: <CloudLightning size={28} color="#4285f4" />,
      title: t('guide_step4'),
      desc: isIndoMode
        ? "Hubungkan dengan Google Drive untuk mencadangkan data Anda. Jangan khawatir kehilangan data saat mengganti perangkat atau menghapus browser!"
        : "구글 드라이브와 연동하여 소중한 학습 데이터를 안전하게 백업하세요. 기기를 변경해도 로그인 한 번으로 모든 데이터를 복구할 수 있습니다.",
    }
  ];

  const renderLink = (text) => {
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
          {t('guide_title')}
        </h1>
        <p style={{ color: '#666', fontSize: '1.1rem', fontWeight: '500' }}>
          {isIndoMode 
            ? "Selamat datang! Mari belajar bahasa Korea dengan cara이 매우 cerdas bersama AI Nana. 🍌"
            : "나나와 함께하는 스마트한 언어 학습 여행에 오신 것을 환영합니다! 서비스를 100% 활용하는 방법을 알아보세요."}
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
        <Info color="var(--primary-color)" /> {isIndoMode ? 'Panduan Pengaturan Detail' : '상세 설정 가이드'}
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
