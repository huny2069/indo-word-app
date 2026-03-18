import React, { useState, useEffect } from 'react';
import { getWords, getCartWords, updateWord, clearCart } from '../db/database';
import { playAudio } from '../api/ttsApi';
import { Volume2 } from 'lucide-react';
import InteractiveSentence from '../components/InteractiveSentence';
import { useLanguage } from '../contexts/LanguageContext';

const Learn = () => {
  const { isIndoMode, t } = useLanguage();
  const [words, setWords] = useState([]);
  const [mode, setMode] = useState(null); // 'flashcard', 'quiz', 'spelling'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  // For quiz
  const [options, setOptions] = useState([]);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [isAnswering, setIsAnswering] = useState(false);
  const [quizType, setQuizType] = useState('wordToMeaning'); // 'wordToMeaning' or 'meaningToWord'
  const [selectedOption, setSelectedOption] = useState(null); // 사용자가 선택한 보기
  const [showFeedback, setShowFeedback] = useState(false); // 피드백 표시 여부

  // For spelling
  const [spellInput, setSpellInput] = useState('');

  // Cart Info
  const [isCartMode, setIsCartMode] = useState(false);

  // For life/feedback (Nano Theme)
  const [feedback, setFeedback] = useState(null); // 'correct', 'wrong'
  const [allWordsCache, setAllWordsCache] = useState([]);

  useEffect(() => {
    const initPayload = async () => {
        setLoading(true);
        await loadAllWords();
        await loadLearningWords();
        setLoading(false);
    };
    initPayload();
  }, []);

  const loadAllWords = async () => {
    const list = await getWords();
    setAllWordsCache(list);
  };

  // 가볍고 명쾌한 나노 효과음 (Web Audio API)
  const playSound = (type) => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime); // 소리를 아주 작게 설정 (사용자 요청)

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.1); 
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110.00, audioCtx.currentTime); 
            osc.frequency.linearRampToValueAtTime(55.00, audioCtx.currentTime + 0.2); 
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) { console.error("Sound error", e); }
  };

  const loadLearningWords = async () => {
    let targetWords = await getCartWords();
    setIsCartMode(targetWords.length > 0);
    
    if (targetWords.length === 0) {
      // 장바구니가 비어있을 경우 전체 단어 중 랜덤하게 10개 추출
      const allList = await getWords();
      if (allList.length > 0) {
        targetWords = [...allList].sort(() => Math.random() - 0.5).slice(0, 10);
      }
    } else {
      // 장바구니가 있을 경우 과학적 출제 로직 적용
      const now = new Date();
      let filtered = targetWords.filter(w => !w.next_review_date || new Date(w.next_review_date) <= now);
      
      // 오늘 복습할 게 없으면 장바구니 전체
      if (filtered.length === 0) filtered = targetWords;

      filtered.sort((a, b) => {
        const dateA = a.next_review_date ? new Date(a.next_review_date) : new Date(0);
        const dateB = b.next_review_date ? new Date(b.next_review_date) : new Date(0);
        return dateA - dateB;
      });
      targetWords = filtered.slice(0, 25);
    }
    
    // 셔플
    for (let i = targetWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [targetWords[i], targetWords[j]] = [targetWords[j], targetWords[i]];
    }

    setWords(targetWords);
  };

  const currentWord = words[currentIndex];

  const handleSRSUpdate = async (word, quality) => {
    updateStreak();

    let newLevel = word.level || 0;
    let intervalDays = 0;

    if (quality === 'hard') {
      newLevel = 0;
      intervalDays = 0;
      setFeedback('wrong');
      playSound('wrong');
    } else {
      newLevel += (quality === 'mastered' ? 2 : 1);
      const intervals = [1, 3, 7, 14, 30, 90, 180]; 
      intervalDays = intervals[Math.min(newLevel, intervals.length - 1)];
      setFeedback('correct');
      playSound('correct');
    }
    
    setTimeout(() => setFeedback(null), 1000);

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);

    // 오답노트를 위한 incorrectCount 증가 로직 추가
    const newIncorrectCount = quality === 'hard' 
      ? (word.incorrectCount || 0) + 1 
      : (word.incorrectCount || 0);

    const updatedWord = { 
        ...word, 
        level: newLevel, 
        next_review_date: nextDate.toISOString(),
        memory_status: newLevel >= 5 ? 'long_term' : (newLevel >= 1 ? 'short_term' : 'unlearned'),
        incorrectCount: newIncorrectCount 
    };
    
    await updateWord(updatedWord);

    if (quality === 'hard') {
        setWords(prev => [...prev, updatedWord]);
    }
  };

  const updateStreak = () => {
    const today = new Date().toISOString().split('T')[0];
    const lastStudy = localStorage.getItem('last_study_date');
    if (lastStudy !== today) {
      let calcStreak = parseInt(localStorage.getItem('study_streak') || '0', 10);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastStudy === yesterday.toISOString().split('T')[0]) calcStreak += 1;
      else calcStreak = 1;
      localStorage.setItem('study_streak', calcStreak.toString());
      localStorage.setItem('last_study_date', today);
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setSpellInput('');
    setIsAnswering(false);
    setSelectedOption(null);
    setShowFeedback(false);
    
    if (currentIndex < words.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (mode === 'quiz') generateOptions(nextIdx);
    } else {
      alert(t('quiz_finish'));
      setMode(null);
      setCurrentIndex(0);
      loadLearningWords(); 
    }
  };

  const generateOptions = (index) => {
    const correct = words[index];
    const type = Math.random() > 0.5 ? 'wordToMeaning' : 'meaningToWord';
    setQuizType(type);

    const pool = allWordsCache.length >= 4 ? allWordsCache : words;
    const samePosWords = pool.filter(w => w.id !== correct.id && w.pos === correct.pos);
    const otherWords = pool.filter(w => w.id !== correct.id && w.pos !== correct.pos);
    
    let candidates = samePosWords.length >= 3 ? samePosWords : [...samePosWords, ...otherWords];
    candidates.sort(() => Math.random() - 0.5);
    const distillers = candidates.slice(0, 3);
    const opts = [correct, ...distillers].sort(() => Math.random() - 0.5);
    
    // Minimum 4 options safety - 기존 배열을 참조하지 않고 새로 할당하여 늘어남 방지
    const finalOpts = [...opts];
    while(finalOpts.length < 4) {
        finalOpts.push({ id: 'dummy' + finalOpts.length + Math.random(), word: '---', meaning: '데이터 부족' });
    }
    setOptions(finalOpts);
  };

  const startMode = (m) => {
    if (words.length === 0) {
      alert(t('learn_no_words'));
      return;
    }

    if (m === 'quiz' && words.length < 4 && allWordsCache.length < 4) {
      alert(t('learn_quiz_min_words'));
      return;
    }

    setMode(m);
    setCurrentIndex(0);
    setIsFlipped(false);
    setQuizScore({ correct: 0, total: 0 });
    if (m === 'quiz') generateOptions(0);
  };

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleQuizAnswer = async (selected) => {
    if (isAnswering) return;
    setIsAnswering(true);
    setSelectedOption(selected);
    setShowFeedback(true);
    
    const isCorrect = selected.id === currentWord.id;
    if (isCorrect) {
      setQuizScore(prev => ({ ...prev, correct: prev.correct + 1 }));
      await handleSRSUpdate(currentWord, 'good');
    } else {
      // alert은 이제 커스텀 피드백으로 대체하여 생략
      await handleSRSUpdate(currentWord, 'hard');
    }
    setQuizScore(prev => ({ ...prev, total: prev.total + 1 }));
    setTimeout(nextCard, 1200); // 사용자가 결과를 볼 수 있도록 대기 시간 연장
  };

  const handleSpellingSubmit = async () => {
    if (!spellInput.trim()) return;
    const targetWord = isIndoMode ? currentWord.word : currentWord.meaning;
    if (spellInput.trim().toLowerCase() === targetWord.toLowerCase()) {
      await handleSRSUpdate(currentWord, 'good');
    } else {
      alert(`${t('msg_spelling_answer')}: ${targetWord}`);
      await handleSRSUpdate(currentWord, 'hard');
    }
    nextCard();
  };

  if (loading) return <div className="page" style={{textAlign: 'center', marginTop: '5rem'}}>{t('learn_loading_msg')}</div>;

  if (!mode) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img src="/assets/img/nana.png" className="nana-character" style={{ width: '130px', marginBottom: '1rem' }} alt="Nana" />
            <h2 style={{ margin: 0, color: 'var(--secondary-color)' }}>{t('learn_title_main')}</h2>
        </div>
        
        <div style={{ background: '#fff9db', padding: '1.2rem', borderRadius: '20px', border: '3px solid #feca57', marginBottom: '1.5rem', boxShadow: '0 4px 0 #feca57' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#856404', fontWeight: 'bold' }}>
                {isCartMode ? (
                    t('learn_cart_session').replace('{count}', words.length)
                ) : (
                    t('learn_recommend_session').replace('{count}', words.length)
                )}
            </p>
        </div>
        
        <div style={{ display: 'grid', gap: '1.2rem' }}>
          <button onClick={() => startMode('flashcard')} className="learning-card-select" style={{ border: '3px solid #feca57', background: '#fff' }}>
            <div style={{textAlign: 'left'}}>
                <div style={{fontSize: '1.25rem', fontWeight: '900', color: '#f39c12', marginBottom: '4px'}}>{t('learn_flashcard_title')}</div>
                <div style={{fontSize: '0.85rem', color: '#888'}}>{t('learn_flashcard_desc')}</div>
            </div>
            <span style={{fontSize: '2.5rem'}}>🎴</span>
          </button>

          <button onClick={() => startMode('quiz')} className="learning-card-select" style={{ border: '3px solid #ff9f43', background: '#fff' }}>
             <div style={{textAlign: 'left'}}>
                <div style={{fontSize: '1.25rem', fontWeight: '900', color: '#e67e22', marginBottom: '4px'}}>{t('learn_quiz_title')}</div>
                <div style={{fontSize: '0.85rem', color: '#888'}}>{t('learn_quiz_desc')}</div>
            </div>
            <span style={{fontSize: '2.5rem'}}>📝</span>
          </button>

          <button onClick={() => startMode('spelling')} className="learning-card-select" style={{ border: '3px solid #1dd1a1', background: '#fff' }}>
            <div style={{textAlign: 'left'}}>
                <div style={{fontSize: '1.25rem', fontWeight: '900', color: '#10ac84', marginBottom: '4px'}}>{t('learn_spelling_title')}</div>
                <div style={{fontSize: '0.85rem', color: '#888'}}>{t('learn_spelling_desc')}</div>
            </div>
            <span style={{fontSize: '2.5rem'}}>⌨️</span>
          </button>
        </div>

        {isCartMode && (
          <button onClick={async () => { if(window.confirm(t('learn_cart_clear_confirm'))) { await clearCart(); loadLearningWords(); } }}
            style={{ width: '100%', marginTop: '2.5rem', padding: '1rem', background: '#f1f3f5', border: 'none', color: '#adb5bd', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' }}>
            {t('learn_cart_clear_btn')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`page ${feedback === 'wrong' ? 'wrong-shake' : ''}`} style={{paddingBottom: '2rem'}}>
        {feedback === 'correct' && <div className="correct-celebration">🍌✨</div>}
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button onClick={() => setMode(null)} style={{ padding: '0.5rem 1rem', background: '#f8f9fa', color: '#adb5bd', border: '2px solid #e9ecef', borderRadius: '12px', cursor: 'pointer', fontWeight: '800' }}>{t('learn_end_btn')}</button>
            <div style={{ flex: 1, margin: '0 1rem', background: '#e9ecef', height: '12px', borderRadius: '6px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ width: `${((currentIndex + 1) / words.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #feca57, #ff9f43)', transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}></div>
            </div>
            <img src="/assets/img/nana.png" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #feca57', background: '#fff', objectFit: 'contain' }} alt="Nana" />
        </header>

      {mode === 'flashcard' && currentWord && (
        <>
        <div onClick={handleCardClick} className={`flashcard-container ${isFlipped ? 'flipped' : ''}`} style={{ height: '380px', perspective: '1000px', cursor: 'pointer', marginBottom: '2rem' }}>
          <div className="flashcard-inner" style={{ position: 'relative', width: '100%', height: '100%', textAlign: 'center', transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)', transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'none' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', background: '#fff', borderRadius: '30px', border: '4px solid #feca57', boxShadow: '0 10px 0 #feca57', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                <span style={{background: '#fff9db', color: '#f39c12', padding: '0.5rem 1.2rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '900', marginBottom: '1.5rem', border: '2px solid #feca57'}}>{t('pos_' + (currentWord.pos === '명사'?'noun':currentWord.pos === '동사'?'verb':currentWord.pos === '형용사'?'adj':currentWord.pos === '부사'?'adv':currentWord.pos === '대명사'?'pronoun':currentWord.pos === '수사'?'numeral':currentWord.pos === '전치사'?'preposition':currentWord.pos === '접속사'?'conjunction':currentWord.pos === '감탄사'?'interjection':currentWord.pos === '한정사'?'determiner':'noun'))}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h1 style={{ fontSize: '3.8rem', margin: 0, color: 'var(--nana-dark)', wordBreak: 'break-all' }}>
                    {isIndoMode ? currentWord.meaning : currentWord.word}
                    </h1>
                    <button onClick={(e) => { e.stopPropagation(); playAudio(isIndoMode ? currentWord.meaning : currentWord.word); }} style={{ background: '#feca57', border: 'none', color: '#fff', padding: '0.8rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Volume2 size={24} />
                    </button>
                </div>
                <p style={{ color: '#ccc', marginTop: '2.5rem', fontSize: '0.95rem', fontWeight: 'bold' }}>{t('learn_touch_card')}</p>
            </div>
            <div style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', background: '#fff', borderRadius: '30px', border: '4px solid #ff9f43', boxShadow: '0 10px 0 #ff9f43', transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '1.5rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '2.5rem', margin: 0, color: '#e67e22', fontWeight: '900' }}>
                    {isIndoMode ? currentWord.word : currentWord.meaning}
                    </h2>
                    <button onClick={(e) => { e.stopPropagation(); playAudio(isIndoMode ? currentWord.word : currentWord.meaning); }} style={{ background: '#ff9f43', border: 'none', color: '#fff', padding: '0.6rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Volume2 size={20} />
                    </button>
                </div>
                <div style={{ width: '100%', overflowY: 'auto', marginBottom: '1rem' }}>
                    <div style={{ textAlign: 'left', background: '#fffaf0', padding: '1.2rem', borderRadius: '20px', border: '2px dashed #ff9f43' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{fontSize: '0.75rem', color: '#ff9f43', fontWeight: 'bold', marginBottom: '0.3rem'}}>🌟 {isIndoMode ? 'Contoh (Formal)' : '격식체 예문'}</div>
                            <InteractiveSentence 
                              sentence={isIndoMode ? currentWord.example_formal_kr : currentWord.example_formal} 
                              breakdown={currentWord.word_breakdown} 
                              fontSize="1rem" 
                            />
                            <div style={{fontSize: '0.85rem', color: '#888', marginTop: '0.3rem'}}>
                              {isIndoMode ? currentWord.example_formal : currentWord.example_formal_kr}
                            </div>
                        </div>
                        <div>
                            <div style={{fontSize: '0.75rem', color: '#ff9f43', fontWeight: 'bold', marginBottom: '0.3rem'}}>🗣️ {isIndoMode ? 'Contoh (Santai)' : '구어체 예문'}</div>
                            <InteractiveSentence 
                              sentence={isIndoMode ? currentWord.example_casual_kr : currentWord.example_casual} 
                              breakdown={currentWord.word_breakdown} 
                              fontSize="1rem" 
                            />
                            <div style={{fontSize: '0.85rem', color: '#888', marginTop: '0.3rem'}}>
                              {isIndoMode ? currentWord.example_casual : currentWord.example_casual_kr}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
        <div style={{ visibility: isFlipped ? 'visible' : 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <button onClick={(e) => { e.stopPropagation(); handleSRSUpdate(currentWord, 'hard'); nextCard(); }} className="srs-btn hard" style={{border: '3px solid #ff7675', boxShadow: '0 5px 0 #ff7675'}}>{t('learn_srs_wrong')}</button>
            <button onClick={(e) => { e.stopPropagation(); handleSRSUpdate(currentWord, 'good'); nextCard(); }} className="srs-btn good" style={{border: '3px solid #feca57', boxShadow: '0 5px 0 #feca57'}}>{t('learn_srs_memorized')}</button>
            <button onClick={(e) => { e.stopPropagation(); handleSRSUpdate(currentWord, 'mastered'); nextCard(); }} className="srs-btn master" style={{border: '3px solid #1dd1a1', boxShadow: '0 5px 0 #1dd1a1'}}>{t('learn_srs_master')}</button>
        </div>
        </>
      )}

      {mode === 'quiz' && currentWord && (
        <div style={{ background: '#fff', padding: '2.5rem 1.5rem', borderRadius: '35px', border: '4px solid #ff9f43', boxShadow: '0 12px 0 #ff9f43' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span style={{ background: '#fff7ed', color: '#ea580c', padding: '0.6rem 1.2rem', borderRadius: '25px', fontSize: '0.9rem', fontWeight: '900', border: '2px solid #fed7aa' }}>
                {quizType === 'wordToMeaning' ? t('quiz_direction_ko_id') : t('quiz_direction_id_ko')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                <h2 style={{ margin: 0, fontSize: '2.8rem', color: 'var(--nana-dark)', fontWeight: '900' }}>
                    {quizType === 'wordToMeaning' 
                    ? (isIndoMode ? currentWord.meaning : currentWord.word) 
                    : (isIndoMode ? currentWord.word : currentWord.meaning)
                    }
                </h2>
                <button onClick={() => playAudio(quizType === 'wordToMeaning' ? (isIndoMode ? currentWord.meaning : currentWord.word) : (isIndoMode ? currentWord.word : currentWord.meaning))} style={{ background: '#ff9f43', border: 'none', color: '#fff', padding: '0.8rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Volume2 size={24} />
                </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '1rem' }}>
                <img src="/assets/img/nana.png" style={{ width: '50px' }} alt="nana-quiz" />
            </div>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {options.map((opt, i) => {
              let btnStyle = { border: '3px solid #f1f3f5', borderRadius: '20px', padding: '1.2rem', fontSize: '1.2rem', fontWeight: 'bold', background: '#fff', color: '#444' };
              let icon = null;
              
              if (showFeedback) {
                  const isCorrectAnswer = opt.id === currentWord.id;
                  const isSelected = selectedOption && selectedOption.id === opt.id;
                  
                  if (isSelected && isCorrectAnswer) {
                      btnStyle = { ...btnStyle, background: '#e8f8f5', borderColor: '#1dd1a1', color: '#10ac84' };
                      icon = '✅ ';
                  } else if (isSelected && !isCorrectAnswer) {
                      btnStyle = { ...btnStyle, background: '#ffeeee', borderColor: '#ff7675', color: '#d63031' };
                      icon = '❌ ';
                  } else if (isCorrectAnswer) {
                      // 내가 안 골랐지만 정답인 것 표시
                      btnStyle = { ...btnStyle, borderStyle: 'dashed', borderColor: '#1dd1a1', color: '#10ac84' };
                      icon = '👉 ';
                  }
              }

              return (
                  <button 
                      key={opt.id + i} 
                      onClick={() => handleQuizAnswer(opt)} 
                      disabled={showFeedback}
                      className="quiz-option-btn" 
                      style={btnStyle}
                  >
                      {icon} {quizType === 'wordToMeaning' 
                               ? (isIndoMode ? opt.word : opt.meaning) 
                               : (isIndoMode ? opt.meaning : opt.word)}
                  </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'spelling' && currentWord && (
        <div style={{ background: '#fff', padding: '3rem 2rem', borderRadius: '35px', border: '4px solid #1dd1a1', boxShadow: '0 12px 0 #1dd1a1', textAlign: 'center' }}>
          <img src="/assets/img/nana.png" className="nana-character" style={{ width: '90px', marginBottom: '1.5rem' }} alt="nana-spelling" />
          <h2 style={{ marginBottom: '1rem', fontSize: '2.2rem', fontWeight: '900' }}>
            "{isIndoMode ? currentWord.meaning : currentWord.word}"
          </h2>
          <p style={{color: '#888', fontWeight: 'bold', marginBottom: '2rem'}}>
            {t('learn_spelling_hint')}
          </p>
          <input 
            type="text" 
            value={spellInput} 
            onChange={e => setSpellInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSpellingSubmit()} 
            placeholder={t('learn_spelling_ph')} 
            className="spelling-input" 
            style={{ border: '4px solid #eef2f7', borderRadius: '20px', fontSize: '2rem' }} 
            autoFocus 
            autoComplete="off" 
            spellCheck="false" 
          />
          <div style={{display: 'flex', gap: '1rem'}}>
            <button onClick={() => playAudio(isIndoMode ? currentWord.meaning : currentWord.word)} style={{ flex: 1, padding: '1.2rem', background: '#f0f4ff', color: '#4facfe', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '900' }}>
              🔊 {t('learn_spelling_listen')}
            </button>
            <button onClick={handleSpellingSubmit} style={{ flex: 2, padding: '1.2rem', background: '#1dd1a1', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: '900', boxShadow: '0 6px 0 #10ac84' }}>
              {t('learn_spelling_submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Learn;
