import React, { useState, useEffect } from 'react';
import { X, ChevronRight, GraduationCap, Volume2, Loader2, Sparkles } from 'lucide-react';
import { generateWordLecture } from '../api/geminiApi';
import { playAudio } from '../api/ttsApi';
import { useLanguage } from '../contexts/LanguageContext';

const AiTeacherModal = ({ wordData, onClose, apiKey, modelName, userLang, studyLang }) => {
  const { t } = useLanguage();
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLecture = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await generateWordLecture(wordData, apiKey, modelName, userLang, studyLang);
        if (data && Array.isArray(data)) {
          setSlides(data);
        } else {
          throw new Error('Invalid data format received from AI.');
        }
      } catch (err) {
        setError(err.message || '강의를 불러오는 데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLecture();
  }, [wordData, apiKey, modelName, userLang, studyLang]);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const currentSlide = slides[currentIndex];

  const getTypeLabel = (type) => {
    switch(type) {
      case 'intro': return '👋 오프닝';
      case 'grammar': return '📘 핵심 문법';
      case 'usage': return '💡 실전 예문';
      case 'nuance': return '🎭 미세한 뉘앙스';
      case 'question': return '🚨 돌발 퀴즈!';
      case 'answer': return '🎉 정답 공개';
      default: return '📝 설명';
    }
  };

  const handlePlayAudio = () => {
    if (currentSlide && currentSlide.content) {
       // 강사의 말 전체를 읽어주거나, 특정 예문만 읽어줄 수 있음. 여기서는 전체 텍스트를 대상 언어(설명 언어인 nativeLang)로 읽도록 할 수 있으나, 
       // 혼합 언어이므로 한국어 TTS 엔진을 사용하는 것이 좋음.
       playAudio(currentSlide.content, userLang);
    }
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
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.5rem', borderBottom: '2px dashed #eee', background: '#fafafa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ background: '#1890ff', padding: '10px', borderRadius: '50%' }}>
              <GraduationCap size={28} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#333', fontWeight: '900' }}>
                1타 강사의 특강: <span style={{ color: '#1890ff' }}>{wordData.word}</span>
              </h2>
              <p style={{ margin: '0.2rem 0 0 0', color: '#666', fontSize: '0.95rem', fontWeight: 'bold' }}>
                {wordData.meaning}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#fee', border: 'none', borderRadius: '50%', padding: '10px',
            cursor: 'pointer', color: '#ff4d4f', transition: '0.2s'
          }}>
            <X size={24} />
          </button>
        </div>

        {/* Content Area (Whiteboard) */}
        <div 
          onClick={handleNext}
          style={{
          flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', textAlign: 'center',
          background: 'linear-gradient(to bottom, #ffffff, #fdfdfd)', cursor: currentIndex < slides.length - 1 ? 'pointer' : 'default',
          overflowY: 'auto'
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', color: '#1890ff' }}>
              <Loader2 size={64} className="spin" />
              <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.5rem' }}>선생님이 칠판을 닦고 판서를 준비 중입니다... 🧑‍🏫</h3>
              <p style={{ color: '#666', fontWeight: 'bold' }}>잠시만 기다려주세요!</p>
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
                textShadow: '1px 1px 0px rgba(0,0,0,0.05)'
              }}>
                {currentSlide.content.split('\n').map((line, i) => (
                  <p key={i} style={{ margin: '0.5rem 0' }}>{line}</p>
                ))}
              </div>
              
              <button 
                onClick={(e) => { e.stopPropagation(); handlePlayAudio(); }}
                style={{
                marginTop: '2rem', background: '#f5f5f5', border: 'none', borderRadius: '50px', 
                padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px',
                cursor: 'pointer', color: '#555', fontWeight: 'bold', fontSize: '1.1rem',
                boxShadow: '0 4px 10px rgba(0,0,0,0.05)', transition: '0.2s'
              }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                <Volume2 size={20} /> 선생님 목소리 듣기
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer / Navigation */}
        {!isLoading && !error && slides.length > 0 && (
          <div style={{
            padding: '1.5rem', background: '#fafafa', borderTop: '2px solid #eee',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {slides.map((_, idx) => (
                <div key={idx} style={{
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: idx === currentIndex ? '#1890ff' : '#ddd',
                  transition: '0.3s', transform: idx === currentIndex ? 'scale(1.3)' : 'scale(1)'
                }} />
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              {currentIndex > 0 && (
                <button onClick={handlePrev} style={{
                  padding: '12px 24px', borderRadius: '15px', border: '2px solid #ddd',
                  background: '#fff', color: '#666', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem'
                }}>
                  이전
                </button>
              )}
              {currentIndex < slides.length - 1 ? (
                <button onClick={handleNext} style={{
                  padding: '12px 30px', borderRadius: '15px', border: 'none',
                  background: '#1890ff', color: '#fff', fontWeight: '900', cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem',
                  boxShadow: '0 4px 15px rgba(24, 144, 255, 0.3)'
                }}>
                  다음 설명 듣기 <ChevronRight size={20} />
                </button>
              ) : (
                <button onClick={onClose} style={{
                  padding: '12px 30px', borderRadius: '15px', border: 'none',
                  background: '#52c41a', color: '#fff', fontWeight: '900', cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem',
                  boxShadow: '0 4px 15px rgba(82, 196, 26, 0.3)'
                }}>
                  <Sparkles size={20} /> 강의 완료!
                </button>
              )}
            </div>
          </div>
        )}
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
