import React, { useState, useEffect } from 'react';
import { X, ChevronRight, GraduationCap, Volume2, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { generateWordLecture } from '../api/geminiApi';
import { playMixedAudio, stopTTS } from '../api/ttsApi';
import { updateWord } from '../db/database';
import { useLanguage } from '../contexts/LanguageContext';

const AiTeacherModal = ({ wordData, onClose, apiKey, modelName, userLang, studyLang, onUpdateWord }) => {
  const { t } = useLanguage();
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLecture = async (forceRegenerate = false) => {
    try {
      setIsLoading(true);
      setError(null);
      setCurrentIndex(0);

      // 캐싱된 대본이 있으면 사용 (재생성 요청이 아닐 경우)
      if (!forceRegenerate && wordData.ai_lecture && Array.isArray(wordData.ai_lecture)) {
        setSlides(wordData.ai_lecture);
        setIsLoading(false);
        return;
      }

      const data = await generateWordLecture(wordData, apiKey, modelName, userLang, studyLang);
      if (data && Array.isArray(data)) {
        setSlides(data);
        
        // DB에 새 대본 캐싱
        const updatedWord = { ...wordData, ai_lecture: data };
        await updateWord(updatedWord);
        if (onUpdateWord) onUpdateWord(updatedWord);
      } else {
        throw new Error('Invalid data format received from AI.');
      }
    } catch (err) {
      setError(err.message || t('ai_teacher_error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLecture(false);

    return () => {
      stopTTS();
    };
  }, [wordData, apiKey, modelName, userLang, studyLang]);

  const handleRegenerate = () => {
    stopTTS();
    fetchLecture(true);
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      stopTTS();
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      stopTTS();
      setCurrentIndex(prev => prev - 1);
    }
  };

  const currentSlide = slides[currentIndex];

  const getTypeLabel = (type) => {
    switch(type) {
      case 'intro': return `👋 ${t('ai_teacher_type_intro')}`;
      case 'grammar': return `📘 ${t('ai_teacher_type_grammar')}`;
      case 'usage': return `💡 ${t('ai_teacher_type_usage')}`;
      case 'nuance': return `🎭 ${t('ai_teacher_type_nuance')}`;
      case 'question': return `🚨 ${t('ai_teacher_type_question')}`;
      case 'answer': return `🎉 ${t('ai_teacher_type_answer')}`;
      default: return `📝 ${t('ai_teacher_type_default')}`;
    }
  };

  const stripEmojis = (str) => {
    if (!str) return '';
    return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
  };

  const handlePlayAudio = () => {
    if (currentSlide && currentSlide.content) {
       stopTTS();
       // AI 선생님 전용 초고음질 모델 적용
       playMixedAudio(stripEmojis(currentSlide.content), userLang, studyLang, 'gemini-2.5-pro-preview-tts');
    }
  };

  const renderTextWithTarget = (text) => {
    const parts = text.split(/(<target>.*?<\/target>)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('<target>') && part.endsWith('</target>')) {
        const innerText = part.replace(/<\/?target>/g, '');
        return <span key={idx} style={{ color: '#1890ff', fontWeight: '900', background: '#e6f7ff', padding: '0 4px', borderRadius: '4px' }}>{innerText}</span>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
    }}>
      <div style={{
        background: '#fff', width: '100%', maxWidth: '800px', height: '90vh',
        borderRadius: '24px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden', position: 'relative',
        border: '8px solid #f0f0f0'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '1.2rem 1.8rem', borderBottom: '2px solid #f0f0f0', display: 'flex', 
          justifyContent: 'space-between', alignItems: 'center', background: '#fff' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ background: '#1890ff', padding: '10px', borderRadius: '50%' }}>
              <GraduationCap size={28} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#333', fontWeight: '900' }}>
                {t('ai_teacher_title')}: <span style={{ color: '#1890ff' }}>{wordData.word}</span>
              </h2>
              <p style={{ margin: '0.2rem 0 0 0', color: '#666', fontSize: '0.95rem', fontWeight: 'bold' }}>
                {wordData.meaning}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button onClick={handleRegenerate} title={t('ai_teacher_regenerate')} style={{
              background: '#f0f0f0', border: 'none', borderRadius: '50%', padding: '10px',
              cursor: 'pointer', color: '#555', transition: '0.2s', display: 'flex', alignItems: 'center'
            }} onMouseOver={e => e.currentTarget.style.background = '#e0e0e0'} onMouseOut={e => e.currentTarget.style.background = '#f0f0f0'}>
              <RefreshCw size={20} />
            </button>
            <button onClick={onClose} style={{
              background: '#fee', border: 'none', borderRadius: '50%', padding: '10px',
              cursor: 'pointer', color: '#ff4d4f', transition: '0.2s'
            }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content Area (Whiteboard) */}
        <div 
          style={{
          flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center',
          background: 'linear-gradient(to bottom, #ffffff, #fdfdfd)',
          overflowY: 'auto', position: 'relative', paddingTop: '3rem'
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', color: '#1890ff' }}>
              <Loader2 size={64} className="spin" />
              <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.5rem' }}>{t('ai_teacher_preparing')}</h3>
              <p style={{ color: '#666', fontWeight: 'bold' }}>{t('ai_teacher_wait')}</p>
            </div>
          ) : error ? (
            <div style={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: '1.2rem' }}>
              ⚠️ {error}
            </div>
          ) : currentSlide ? (
            <div style={{ width: '100%', maxWidth: '650px', animation: 'fadeInUp 0.5s ease-out' }}>
              <div style={{ 
                display: 'inline-block', background: '#e6f7ff', color: '#1890ff', 
                padding: '8px 16px', borderRadius: '20px', fontWeight: '900', fontSize: '1.1rem', marginBottom: '1.5rem',
                border: '2px solid #91d5ff'
              }}>
                {getTypeLabel(currentSlide.type)}
              </div>
              <div style={{ 
                fontSize: '1.8rem', lineHeight: '1.6', fontWeight: '800', color: '#222', wordBreak: 'keep-all',
                textShadow: '1px 1px 0px rgba(0,0,0,0.05)', marginBottom: '3rem'
              }}>
                {currentSlide.content.split('\n').map((line, i) => (
                  <p key={i} style={{ margin: '0.5rem 0' }}>{renderTextWithTarget(stripEmojis(line))}</p>
                ))}
              </div>
              
              {/* 메인 네비게이션 바 (하단 바와 합침) */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }} 
                  disabled={currentIndex === 0}
                  style={{
                    flex: 1, padding: '1.2rem', background: '#f5f5f5', border: 'none', borderRadius: '20px',
                    fontWeight: 'bold', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentIndex === 0 ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.1rem',
                    transition: '0.2s', boxShadow: '0 4px 0 #ddd'
                  }}
                >
                  {t('ai_teacher_prev')}
                </button>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePlayAudio(); }}
                  style={{
                    width: '70px', height: '70px', borderRadius: '50%', background: '#1890ff',
                    border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 6px 15px rgba(24, 144, 255, 0.4)', transition: '0.2s', zIndex: 10
                  }}
                  title={t('ai_teacher_play')}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Volume2 size={32} />
                </button>

                <button 
                  onClick={(e) => { e.stopPropagation(); handleNext(); }} 
                  disabled={currentIndex === slides.length - 1}
                  style={{
                    flex: 1, padding: '1.2rem', background: '#1890ff', border: 'none', borderRadius: '20px',
                    color: '#fff', fontWeight: '900', cursor: currentIndex === slides.length - 1 ? 'not-allowed' : 'pointer', 
                    opacity: currentIndex === slides.length - 1 ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.1rem',
                    transition: '0.2s', boxShadow: '0 4px 0 #0050b3'
                  }}
                >
                  {t('ai_teacher_next')} <ChevronRight size={22} />
                </button>
              </div>

              {/* 페이지 도트 (하단에 배치) */}
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem', justifyContent: 'center' }}>
                {slides.map((_, idx) => (
                  <div key={idx} style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: idx === currentIndex ? '#1890ff' : '#ddd',
                    transition: '0.3s'
                  }} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer removed to avoid redundancy */}
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AiTeacherModal;
