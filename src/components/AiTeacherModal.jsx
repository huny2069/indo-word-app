import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronRight, ChevronLeft, GraduationCap, Volume2, 
  Loader2, Sparkles, RefreshCw, Play, Square, SkipForward, SkipBack, Radio, Zap
} from 'lucide-react';
import { generateWordLecture } from '../api/geminiApi';
import { playMixedAudio, stopTTS } from '../api/ttsApi';
import { updateWord } from '../db/database';
import { useLanguage } from '../contexts/LanguageContext';

const AiTeacherModal = ({ 
  wordData, 
  wordList = null, 
  initialWordIndex = 0,
  initialAutoPlay = false,
  onClose, 
  apiKey, 
  modelName, 
  userLang, 
  studyLang, 
  onUpdateWord 
}) => {
  const { t } = useLanguage();

  // 플레이리스트 설정 (단일 단어 또는 선택한 복수 단어)
  const playlist = Array.isArray(wordList) && wordList.length > 0 ? wordList : (wordData ? [wordData] : []);
  const [currentWordIdx, setCurrentWordIdx] = useState(initialWordIndex);
  const activeWord = playlist[currentWordIdx] || wordData;

  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 음성 재생 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlayAll, setIsAutoPlayAll] = useState(false);
  const [currentEngine, setCurrentEngine] = useState(() => localStorage.getItem('tts_engine') || 'google');

  // 취소 및 비동기 상태 제어용 Ref
  const isCancelledRef = useRef(false);
  const currentSlideRef = useRef(0);
  const currentWordIdxRef = useRef(currentWordIdx);
  const slidesRef = useRef([]);
  const autoPlayNextWordRef = useRef(initialAutoPlay);

  useEffect(() => {
    currentSlideRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    currentWordIdxRef.current = currentWordIdx;
  }, [currentWordIdx]);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  // TTS 전용 텍스트 정제 함수
  const stripForTTS = (str) => {
    if (!str) return '';
    return str
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/<target>(.*?)<\/target>/gi, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const stripEmojis = (str) => {
    if (!str) return '';
    return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
  };

  // 강의 대본 로드 및 캐시/생성
  const fetchLecture = async (targetWord, forceRegenerate = false) => {
    if (!targetWord) return null;
    try {
      setIsLoading(true);
      setError(null);
      setCurrentIndex(0);

      // 이미 생성된 대본이 있는 경우 즉시 활용
      if (!forceRegenerate && targetWord.ai_lecture && Array.isArray(targetWord.ai_lecture) && targetWord.ai_lecture.length > 0) {
        setSlides(targetWord.ai_lecture);
        setIsLoading(false);
        return targetWord.ai_lecture;
      }

      // 새로 생성
      const data = await generateWordLecture(targetWord, apiKey, modelName, userLang, targetWord.study_lang || studyLang);
      if (data && Array.isArray(data)) {
        setSlides(data);
        const updatedWord = { ...targetWord, ai_lecture: data };
        await updateWord(updatedWord);
        if (onUpdateWord) onUpdateWord(updatedWord);
        setIsLoading(false);
        return data;
      } else {
        throw new Error('AI로부터 올바른 강의 데이터를 받지 못했습니다.');
      }
    } catch (err) {
      setError(err.message || t('ai_teacher_error'));
      setIsLoading(false);
      return null;
    }
  };

  // 단어 변경 시 강의 로드 및 필요시 자동 연속 재생 시작
  useEffect(() => {
    let isMounted = true;
    const loadWordData = async () => {
      stopPlayback();
      const loadedSlides = await fetchLecture(activeWord, false);
      
      // 연속 재생 모드가 켜져 있거나 진입 시 자동 재생 플래그가 있는 경우
      if (isMounted && autoPlayNextWordRef.current && loadedSlides && loadedSlides.length > 0) {
        startContinuousPlayback(0, loadedSlides);
      }
    };

    loadWordData();

    return () => {
      isMounted = false;
      stopPlayback();
    };
  }, [currentWordIdx, activeWord?.id]);

  // 모달 언마운트 시 TTS 안전 정지
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // 전체 슬라이드 자동 넘김 연속 재생 실행기
  const startContinuousPlayback = async (startSlideIdx = 0, customSlides = null) => {
    const targetSlides = customSlides || slidesRef.current;
    if (!targetSlides || targetSlides.length === 0) return;

    isCancelledRef.current = false;
    setIsPlaying(true);
    setIsAutoPlayAll(true);

    for (let sIdx = startSlideIdx; sIdx < targetSlides.length; sIdx++) {
      if (isCancelledRef.current) break;

      setCurrentIndex(sIdx);
      currentSlideRef.current = sIdx;

      const slideContent = targetSlides[sIdx]?.content;
      if (slideContent) {
        await playMixedAudio(stripForTTS(slideContent), currentEngine);
      }

      if (isCancelledRef.current) break;

      // 슬라이드 간 자연스러운 0.6초 호흡 휴지
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    // 슬라이드가 끝까지 정상 재생되었을 때
    if (!isCancelledRef.current) {
      // 다음 단어가 플레이리스트에 남아있다면 자동으로 다음 단어로 넘김
      if (currentWordIdxRef.current + 1 < playlist.length) {
        autoPlayNextWordRef.current = true;
        setCurrentWordIdx(prev => prev + 1);
      } else {
        // 모든 단어 및 슬라이드 완강
        setIsPlaying(false);
        setIsAutoPlayAll(false);
        autoPlayNextWordRef.current = false;
      }
    }
  };

  // 단일 슬라이드만 재생/정지
  const handlePlaySingle = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    const currentSlide = slides[currentIndex];
    if (!currentSlide || !currentSlide.content) return;

    isCancelledRef.current = false;
    setIsPlaying(true);
    setIsAutoPlayAll(false);

    try {
      await playMixedAudio(stripForTTS(currentSlide.content), currentEngine);
    } finally {
      if (!isAutoPlayAll) {
        setIsPlaying(false);
      }
    }
  };

  // 전체 연속 재생 버튼 토글 (한 번에 쭉 듣기)
  const handleToggleAutoPlayAll = () => {
    if (isPlaying && isAutoPlayAll) {
      stopPlayback();
    } else {
      stopPlayback();
      setTimeout(() => {
        startContinuousPlayback(currentIndex);
      }, 50);
    }
  };

  // 음성 정지 함수
  const stopPlayback = () => {
    isCancelledRef.current = true;
    autoPlayNextWordRef.current = false;
    stopTTS();
    setIsPlaying(false);
    setIsAutoPlayAll(false);
  };

  // 슬라이드 이동
  const handleNextSlide = () => {
    if (currentIndex < slides.length - 1) {
      stopPlayback();
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentIndex > 0) {
      stopPlayback();
      setCurrentIndex(prev => prev - 1);
    }
  };

  // 단어 이동 (플레이리스트 모드)
  const handleNextWord = () => {
    if (currentWordIdx < playlist.length - 1) {
      stopPlayback();
      setCurrentWordIdx(prev => prev + 1);
    }
  };

  const handlePrevWord = () => {
    if (currentWordIdx > 0) {
      stopPlayback();
      setCurrentWordIdx(prev => prev - 1);
    }
  };

  // 엔진 변경 (Google 프리미엄 vs 기본 브라우저 TTS)
  const handleSwitchEngine = (newEngine) => {
    setCurrentEngine(newEngine);
    localStorage.setItem('tts_engine', newEngine);
    if (isPlaying) {
      stopPlayback();
    }
  };

  const handleRegenerate = () => {
    stopPlayback();
    fetchLecture(activeWord, true);
  };

  const currentSlide = slides[currentIndex];

  const getTypeLabel = (type) => {
    switch(type) {
      case 'intro': return `👋 ${t('ai_teacher_type_intro') || '오프닝'}`;
      case 'grammar': return `📘 ${t('ai_teacher_type_grammar') || '핵심 문법'}`;
      case 'usage': return `💡 ${t('ai_teacher_type_usage') || '실전 예문'}`;
      case 'nuance': return `🎭 ${t('ai_teacher_type_nuance') || '미세한 뉘앙스'}`;
      case 'question': return `🚨 ${t('ai_teacher_type_question') || '돌발 퀴즈!'}`;
      case 'answer': return `🎉 ${t('ai_teacher_type_answer') || '정답 공개'}`;
      default: return `📝 ${t('ai_teacher_type_default') || '설명'}`;
    }
  };

  const renderTextWithTarget = (text) => {
    const parts = text.split(/(<target>.*?<\/target>)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('<target>') && part.endsWith('</target>')) {
        const innerText = part.replace(/<\/?target>/g, '');
        return (
          <span key={idx} style={{ 
            color: '#4f46e5', fontWeight: '900', background: '#e0e7ff', 
            padding: '2px 8px', borderRadius: '6px', margin: '0 2px' 
          }}>
            {innerText}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
    }}>
      <div style={{
        background: '#fff', width: '100%', maxWidth: '860px', height: '92vh',
        borderRadius: '28px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)', overflow: 'hidden', position: 'relative',
        border: '3px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '1.2rem 1.6rem', borderBottom: '1px solid #f1f5f9', display: 'flex', 
          justifyContent: 'space-between', alignItems: 'center', background: '#ffffff',
          flexWrap: 'wrap', gap: '0.8rem'
        }}>
          {/* 단어 정보 및 강사 배지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: '220px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)', 
              padding: '10px', borderRadius: '16px', display: 'flex', alignItems: 'center',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}>
              <GraduationCap size={26} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1e293b', fontWeight: '900' }}>
                  {t('ai_teacher_title') || 'AI 1타 강사 특강'}: <span style={{ color: '#4f46e5' }}>{activeWord.word}</span>
                </h2>
              </div>
              <p style={{ margin: '0.15rem 0 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '700' }}>
                = {activeWord.meaning}
              </p>
            </div>
          </div>

          {/* 중앙: 플레이리스트 단어 네비게이션 & TTS 엔진 선택기 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
            {/* 복수 단어 플레이리스트 컨트롤 */}
            {playlist.length > 1 && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', 
                padding: '4px 8px', borderRadius: '20px', border: '1px solid #e2e8f0' 
              }}>
                <button 
                  onClick={handlePrevWord} 
                  disabled={currentWordIdx === 0}
                  style={{
                    background: 'none', border: 'none', cursor: currentWordIdx === 0 ? 'not-allowed' : 'pointer',
                    color: currentWordIdx === 0 ? '#cbd5e1' : '#475569', padding: '4px', display: 'flex'
                  }}
                  title={t('ai_teacher_prev_word') || '이전 단어'}
                >
                  <SkipBack size={16} />
                </button>
                <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#334155', padding: '0 4px' }}>
                  {t('ai_teacher_playlist_word') || '선택 단어'} {currentWordIdx + 1}/{playlist.length}
                </span>
                <button 
                  onClick={handleNextWord} 
                  disabled={currentWordIdx === playlist.length - 1}
                  style={{
                    background: 'none', border: 'none', cursor: currentWordIdx === playlist.length - 1 ? 'not-allowed' : 'pointer',
                    color: currentWordIdx === playlist.length - 1 ? '#cbd5e1' : '#475569', padding: '4px', display: 'flex'
                  }}
                  title={t('ai_teacher_next_word') || '다음 단어'}
                >
                  <SkipForward size={16} />
                </button>
              </div>
            )}

            {/* TTS 엔진 선택 토글 버튼 (기본 브라우저 vs Google 프리미엄) */}
            <div style={{ 
              display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '14px', 
              border: '1px solid #e2e8f0' 
            }}>
              <button 
                onClick={() => handleSwitchEngine('browser')}
                style={{
                  padding: '5px 10px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: '800',
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: currentEngine === 'browser' ? '#10b981' : 'transparent',
                  color: currentEngine === 'browser' ? '#fff' : '#64748b',
                  boxShadow: currentEngine === 'browser' ? '0 2px 6px rgba(16, 185, 129, 0.3)' : 'none'
                }}
                title="Google 로그인 없이 모든 기기에서 즉시 들을 수 있는 기본 음성"
              >
                🎙️ {t('ai_teacher_engine_browser') || '기본 TTS'}
              </button>
              <button 
                onClick={() => handleSwitchEngine('google')}
                style={{
                  padding: '5px 10px', borderRadius: '10px', border: 'none', fontSize: '0.75rem', fontWeight: '800',
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: currentEngine === 'google' ? '#4f46e5' : 'transparent',
                  color: currentEngine === 'google' ? '#fff' : '#64748b',
                  boxShadow: currentEngine === 'google' ? '0 2px 6px rgba(79, 70, 229, 0.3)' : 'none'
                }}
                title="Google Cloud 최고 품질 자연어 음성 (미로그인 시 기본 음성 자동 대체)"
              >
                ✨ {t('ai_teacher_engine_google') || 'Google HD'}
              </button>
            </div>

            {/* 새로고침 & 닫기 */}
            <button onClick={handleRegenerate} title={t('ai_teacher_regenerate')} style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', padding: '8px',
              cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center'
            }}>
              <RefreshCw size={18} />
            </button>
            <button onClick={onClose} style={{
              background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '50%', padding: '8px',
              cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center'
            }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 강의실 칠판 본문 영역 */}
        <div style={{
          flex: 1, padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', textAlign: 'center',
          background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
          overflowY: 'auto', position: 'relative'
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', color: '#4f46e5' }}>
              <Loader2 size={56} className="spin" />
              <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.4rem' }}>{t('ai_teacher_preparing')}</h3>
              <p style={{ color: '#64748b', fontWeight: 'bold' }}>{t('ai_teacher_wait')}</p>
            </div>
          ) : error ? (
            <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.1rem', maxWidth: '500px' }}>
              ⚠️ {error}
            </div>
          ) : currentSlide ? (
            <div style={{ 
              width: '100%', maxWidth: '700px', 
              animation: 'fadeInUp 0.35s ease-out',
              padding: '2rem',
              background: '#ffffff',
              borderRadius: '24px',
              boxShadow: isPlaying ? '0 10px 30px rgba(79, 70, 229, 0.15)' : '0 4px 20px rgba(0, 0, 0, 0.04)',
              border: isPlaying ? '2.5px solid #6366f1' : '2px solid #e2e8f0',
              transition: 'all 0.3s ease'
            }}>
              {/* 슬라이드 태그 & 음성 출력 중 배지 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                <span style={{ 
                  display: 'inline-block', background: '#e0e7ff', color: '#4338ca', 
                  padding: '6px 16px', borderRadius: '30px', fontWeight: '900', fontSize: '0.95rem'
                }}>
                  {getTypeLabel(currentSlide.type)}
                </span>
                {isPlaying && (
                  <span style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: '#ecfdf5', color: '#059669', padding: '6px 14px', 
                    borderRadius: '30px', fontWeight: '900', fontSize: '0.85rem',
                    border: '1px solid #a7f3d0'
                  }}>
                    <span className="live-indicator"></span>
                    {isAutoPlayAll ? (t('ai_teacher_play_all') || '연속 낭독 중...') : '슬라이드 재생 중...'}
                  </span>
                )}
              </div>

              {/* 판서 본문 */}
              <div style={{ 
                fontSize: '1.65rem', lineHeight: '1.7', fontWeight: '800', color: '#1e293b', 
                wordBreak: 'keep-all', minHeight: '140px', display: 'flex', flexDirection: 'column', 
                justifyContent: 'center'
              }}>
                {currentSlide.content.split('\n').map((line, i) => (
                  <p key={i} style={{ margin: '0.4rem 0' }}>{renderTextWithTarget(stripEmojis(line))}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer: 재생 및 네비게이션 컨트롤 바 */}
        <div style={{ 
          padding: '1.2rem 2rem', background: '#ffffff', borderTop: '1px solid #f1f5f9',
          display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center'
        }}>
          {/* 메인 버튼 바 */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '720px' }}>
            {/* 이전 슬라이드 */}
            <button 
              onClick={handlePrevSlide} 
              disabled={currentIndex === 0 || isPlaying}
              style={{
                flex: 1, padding: '1rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '18px',
                fontWeight: '800', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', 
                opacity: currentIndex === 0 ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '1rem',
                color: '#475569', transition: 'all 0.2s'
              }}
            >
              <ChevronLeft size={20} /> {t('ai_teacher_prev') || '이전'}
            </button>
            
            {/* 현재 페이지만 듣기 */}
            <button 
              onClick={handlePlaySingle}
              disabled={isLoading || !currentSlide}
              style={{
                padding: '1rem 1.4rem', borderRadius: '18px', 
                background: isPlaying && !isAutoPlayAll ? '#ef4444' : '#f0fdf4',
                border: isPlaying && !isAutoPlayAll ? 'none' : '1.5px solid #bbf7d0',
                color: isPlaying && !isAutoPlayAll ? '#fff' : '#166534',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontWeight: '900', fontSize: '0.95rem', transition: 'all 0.2s'
              }}
              title="이 슬라이드의 내용만 읽어줍니다"
            >
              {isPlaying && !isAutoPlayAll ? <Square size={18} /> : <Volume2 size={18} />}
              <span>{isPlaying && !isAutoPlayAll ? (t('ai_teacher_stop') || '정지') : (t('ai_teacher_play_current') || '현재 페이지')}</span>
            </button>

            {/* 핵심: 전체 강의 한 번에 쭉 듣기 🚀 */}
            <button 
              onClick={handleToggleAutoPlayAll}
              disabled={isLoading || !currentSlide}
              style={{
                flex: 1.4, padding: '1.1rem 1.6rem', borderRadius: '18px',
                background: isPlaying && isAutoPlayAll 
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                  : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                border: 'none', color: '#ffffff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                fontWeight: '900', fontSize: '1.05rem',
                boxShadow: isPlaying && isAutoPlayAll 
                  ? '0 6px 20px rgba(239, 68, 68, 0.4)' 
                  : '0 6px 20px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.2s transform'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {isPlaying && isAutoPlayAll ? (
                <>
                  <Square size={20} />
                  <span>{t('ai_teacher_stop') || '재생 멈춤 ⏹️'}</span>
                </>
              ) : (
                <>
                  <Zap size={20} />
                  <span>{t('ai_teacher_play_all') || '한 번에 쭉 듣기 🚀'}</span>
                </>
              )}
            </button>

            {/* 다음 슬라이드 */}
            <button 
              onClick={handleNextSlide} 
              disabled={currentIndex === slides.length - 1 || isPlaying}
              style={{
                flex: 1, padding: '1rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '18px',
                fontWeight: '800', cursor: currentIndex === slides.length - 1 ? 'not-allowed' : 'pointer', 
                opacity: currentIndex === slides.length - 1 ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '1rem',
                color: '#475569', transition: 'all 0.2s'
              }}
            >
              {t('ai_teacher_next') || '다음'} <ChevronRight size={20} />
            </button>
          </div>

          {/* 슬라이드 페이지 도트 */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  stopPlayback();
                  setCurrentIndex(idx);
                }}
                style={{
                  width: idx === currentIndex ? '24px' : '10px',
                  height: '10px',
                  borderRadius: '10px',
                  background: idx === currentIndex ? '#4f46e5' : '#e2e8f0',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.3s ease'
                }}
                title={`슬라이드 ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .live-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};

export default AiTeacherModal;
