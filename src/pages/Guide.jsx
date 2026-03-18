import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BookOpen, Sparkles, FolderHeart, CloudLightning, Info } from 'lucide-react';

const Guide = () => {
  const { t, isIndoMode } = useLanguage();

  const steps = [
    {
      id: 1,
      icon: <Sparkles size={32} color="#feca57" />,
      title: t('guide_step1'),
      desc: isIndoMode 
        ? "Ketik topik apa saja (misal: 'Di Restoran'), dan AI Nana akan membuat daftar kata bahasa Korea yang sesuai situasi tersebut lengkap dengan contoh kalimat!"
        : "원하는 주제(예: '공항에서', '비즈니스 미팅')를 입력하면 AI 나나가 상황에 딱 맞는 한국어/인도네시아어 단어와 예문을 즉시 생성해줍니다.",
    },
    {
      id: 2,
      icon: <FolderHeart size={32} color="#ff7675" />,
      title: t('guide_step2'),
      desc: isIndoMode
        ? "Simpan kata-kata favorit Anda dalam folder khusus. Anda bisa memindahkan, mengedit, atau menghapus kata kapan saja untuk menjaga kerapian kosakata."
        : "생성된 단어들을 폴더별로 자유롭게 분류하고 관리하세요. 나만의 단어장을 만들고 중요도에 따라 정리할 수 있습니다.",
    },
    {
      id: 3,
      icon: <BookOpen size={32} color="#48dbfb" />,
      title: t('guide_step3'),
      desc: isIndoMode
        ? "Gunakan flashcard, kuis pilihan ganda, dan latihan mengeja. Algoritma ilmiah kami akan memprioritaskan kata yang sulit Anda hafal agar belajar lebih efisien."
        : "플래시카드, 객관식 퀴즈, 주관식 스펠링 연습을 통해 입체적으로 학습하세요. 망각 곡선 알고리즘이 당신이 틀린 단어를 기억할 때까지 반복해줍니다.",
    },
    {
      id: 4,
      icon: <CloudLightning size={32} color="#4285f4" />,
      title: t('guide_step4'),
      desc: isIndoMode
        ? "Hubungkan dengan Google Drive untuk mencadangkan data Anda. Jangan khawatir kehilangan data saat mengganti perangkat atau menghapus browser!"
        : "구글 드라이브와 연동하여 소중한 학습 데이터를 안전하게 백업하세요. 기기를 변경해도 로그인 한 번으로 모든 데이터를 복구할 수 있습니다.",
    }
  ];

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '1rem' }}>
          {t('guide_title')}
        </h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>
          {isIndoMode 
            ? "Selamat datang! Mari belajar bahasa Korea dengan cara yang sangat cerdas bersama AI Nana. 🍌"
            : "나나와 함께하는 스마트한 언어 학습 여행에 오신 것을 환영합니다! 서비스를 100% 활용하는 방법을 알아보세요."}
        </p>
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {steps.map(step => (
          <div key={step.id} style={{ 
            display: 'flex', 
            gap: '1.5rem', 
            background: '#fff', 
            padding: '2rem', 
            borderRadius: '20px', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
            alignItems: 'flex-start',
            border: '1px solid #f1f2f6'
          }}>
            <div style={{ 
              background: '#f8f9fa', 
              padding: '1rem', 
              borderRadius: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {step.icon}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.8rem 0', color: '#2d3436', fontSize: '1.2rem' }}>{step.title}</h3>
              <p style={{ margin: 0, color: '#636e72', lineHeight: '1.6', fontSize: '1rem' }}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ 
        marginTop: '3rem', 
        padding: '2rem', 
        background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', 
        borderRadius: '25px', 
        color: '#fff',
        textAlign: 'center',
        boxShadow: '0 15px 30px rgba(108, 92, 231, 0.3)'
      }}>
        <Info style={{ marginBottom: '1rem' }} />
        <h3 style={{ margin: '0 0 0.5rem 0' }}>
            {t('guide_questions_title')}
        </h3>
        <p style={{ margin: 0, opacity: 0.9 }}>
            {t('guide_questions_desc')}
        </p>
      </div>
    </div>
  );
};

export default Guide;
