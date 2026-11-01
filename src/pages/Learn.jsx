import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getWords, getCartWords, updateWord, clearCart } from '../db/database';
import { playAudio } from '../api/ttsApi';
import { Volume2, VolumeX, RotateCcw, ChevronLeft, Lightbulb, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import InteractiveSentence from '../components/InteractiveSentence';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../translations';
import { ALL_OFFLINE_WORDS } from '../data/offlineDatabase';
import { trackActivity } from '../utils/activityLogger';

const Learn = () => {
  const { userLang, studyLang, t } = useLanguage();
  const [words, setWords] = useState([]);
  const wordsRef = useRef([]);
  const [mode, setMode] = useState(null); // 'flashcard', 'quiz', 'spelling'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSessionFinished, setIsSessionFinished] = useState(false);
  const [autoAudio, setAutoAudio] = useState(() => localStorage.getItem('learn_auto_audio') !== 'false');

  // For quiz
  const [options, setOptions] = useState([]);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [isAnswering, setIsAnswering] = useState(false);
  const [quizDirectionMode, setQuizDirectionMode] = useState('wordToMeaning'); // 'wordToMeaning' | 'meaningToWord' | 'mixed'
  const [activeQuestionType, setActiveQuestionType] = useState('wordToMeaning'); // 현재 문항의 실제 방향
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // For spelling
  const [spellInput, setSpellInput] = useState('');
  const [spellingResult, setSpellingResult] = useState(null); // null | { isCorrect: boolean, targetWord: string }
  const inputRef = useRef(null);

  // 타이머 정리용 Ref (중복 실행 및 옵션 증가 버그 원천 차단)
  const nextCardTimeoutRef = useRef(null);

  // Cart Info
  const [isCartMode, setIsCartMode] = useState(false);

  // For life/feedback (Nano Theme)
  const [feedback, setFeedback] = useState(null); // 'correct', 'wrong'
  const [allWordsCache, setAllWordsCache] = useState([]);

  // 발음 표기([[...]]) 제거 순수 단어 반환 헬퍼
  const cleanWordText = useCallback((str) => {
    if (!str || typeof str !== 'string') return '';
    return str.split('[[')[0].trim();
  }, []);

  // 품사 번역 키 정규화 헬퍼
  const getNormalizedPosLabel = useCallback((posValue) => {
    if (!posValue || typeof posValue !== 'string') return t('pos_noun');
    const clean = posValue.trim().toLowerCase();
    if (/(동사|verb|verba|타동사|자동사)/i.test(clean)) return t('pos_verb');
    if (/(형용사|adjective|adjektiva)/i.test(clean)) return t('pos_adj');
    if (/(명사|noun|nomina)/i.test(clean)) return t('pos_noun');
    if (/(부사|adverb|adverbia)/i.test(clean)) return t('pos_adv');
    if (/(대명사|pronoun|pronomina)/i.test(clean)) return t('pos_pronoun');
    if (/(전치사|preposition|preposisi)/i.test(clean)) return t('pos_preposition');
    if (/(접속사|conjunction|konjungsi)/i.test(clean)) return t('pos_conjunction');
    if (/(수사|numeral|numeralia)/i.test(clean)) return t('pos_numeral');
    if (/(감탄사|interjection|interjeksi)/i.test(clean)) return t('pos_interjection');
    if (/(관형사|한정사|determiner)/i.test(clean)) return t('pos_determiner');
    return posValue.trim();
  }, [t]);

  // 단어 구조 분석 함수 (발음 기호 [[...]] 제거 후 힌트 문자와 빈칸 문자 구분)
  const parseSpellingStructure = useCallback((rawWord) => {
    const word = cleanWordText(rawWord);
    if (!word) return [];
    let structure = [];
    let blankIndex = 0;
    const parts = word.split(' ');

    parts.forEach((part, partIdx) => {
      const isLetterOrNum = (ch) => /[a-zA-Z0-9가-힣]/.test(ch);
      if (part.length <= 2) {
        for (let i = 0; i < part.length; i++) {
          if (isLetterOrNum(part[i])) {
            structure.push({ type: 'blank', char: part[i], bIdx: blankIndex++ });
          } else {
            structure.push({ type: 'hint', char: part[i] });
          }
        }
      } else {
        // 첫 글자 힌트
        structure.push({ type: 'hint', char: part[0] });
        // 중간 글자들 빈칸
        for (let i = 1; i < part.length - 1; i++) {
          if (isLetterOrNum(part[i])) {
            structure.push({ type: 'blank', char: part[i], bIdx: blankIndex++ });
          } else {
            structure.push({ type: 'hint', char: part[i] });
          }
        }
        // 마지막 글자 힌트
        structure.push({ type: 'hint', char: part[part.length - 1] });
      }
      if (partIdx < parts.length - 1) {
        structure.push({ type: 'space', char: ' ' });
      }
    });
    return structure;
  }, [cleanWordText]);

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    return () => {
      if (nextCardTimeoutRef.current) clearTimeout(nextCardTimeoutRef.current);
    };
  }, []);

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

  const toggleAutoAudio = () => {
    setAutoAudio(prev => {
      const next = !prev;
      localStorage.setItem('learn_auto_audio', next ? 'true' : 'false');
      return next;
    });
  };

  // 가볍고 명쾌한 나노 효과음 (Web Audio API)
  const playSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.03, audioCtx.currentTime);

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110.0, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(55.0, audioCtx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.error('Sound error', e);
    }
  };

  const loadLearningWords = async () => {
    let targetWords = await getCartWords();
    setIsCartMode(targetWords.length > 0);
    
    if (targetWords.length === 0) {
      targetWords = [];
    } else {
      const now = new Date();
      let filtered = targetWords.filter(w => !w.next_review_date || new Date(w.next_review_date) <= now);
      if (filtered.length === 0) filtered = [...targetWords];
      filtered.sort((a, b) => {
        const dateA = a.next_review_date ? new Date(a.next_review_date) : new Date(0);
        const dateB = b.next_review_date ? new Date(b.next_review_date) : new Date(0);
        return dateA - dateB;
      });
      targetWords = filtered.slice(0, 30).map((w, idx) => ({ ...w, _sessionKey: `${w.id}_${idx}` }));
    }
    
    // 셔플
    for (let i = targetWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [targetWords[i], targetWords[j]] = [targetWords[j], targetWords[i]];
    }

    setWords(targetWords);
    wordsRef.current = targetWords;
  };

  const currentWord = words[currentIndex];

  // 플래시카드 진입 또는 카드 이동 시 음성 자동 재생
  useEffect(() => {
    if (mode === 'flashcard' && currentWord && !isFlipped && autoAudio && !isSessionFinished) {
      playAudio(cleanWordText(currentWord.word), currentWord.study_lang || studyLang);
    }
  }, [mode, currentIndex, isFlipped, autoAudio, currentWord, isSessionFinished, cleanWordText, studyLang]);

  // 객관식 퀴즈 보기(Options) 생성: 항상 정확히 4개의 중복 없는 선택지 보장
  const buildQuizOptions = useCallback((targetWord, dirMode) => {
    if (!targetWord) {
      setOptions([]);
      return;
    }

    const resolvedType = dirMode === 'mixed'
      ? (Math.random() < 0.5 ? 'wordToMeaning' : 'meaningToWord')
      : dirMode;
    setActiveQuestionType(resolvedType);

    const targetCleanWord = cleanWordText(targetWord.word).toLowerCase();
    const targetCleanMeaning = (targetWord.meaning || '').trim().toLowerCase();

    // 오답 후보 풀 구성: 1순위 내 단어장 -> 2순위 현재 학습 단어 -> 3순위 1만 단어 오프라인 사전
    const combinedPool = [
      ...allWordsCache,
      ...wordsRef.current,
      ...(ALL_OFFLINE_WORDS ? ALL_OFFLINE_WORDS.slice(0, 120) : [])
    ];

    const usedWords = new Set([targetCleanWord]);
    const usedMeanings = new Set([targetCleanMeaning]);
    const samePosCandidates = [];
    const diffPosCandidates = [];

    for (const item of combinedPool) {
      if (!item || !item.word || !item.meaning) continue;
      const cWord = cleanWordText(item.word).toLowerCase();
      const cMeaning = item.meaning.trim().toLowerCase();

      if (!cWord || !cMeaning) continue;
      if (item.id === targetWord.id || usedWords.has(cWord) || usedMeanings.has(cMeaning)) {
        continue;
      }

      usedWords.add(cWord);
      usedMeanings.add(cMeaning);

      const cleanCandidate = {
        ...item,
        id: item.id || `cand_${cWord}`,
        word: cleanWordText(item.word),
        meaning: item.meaning.trim()
      };

      if (item.pos && targetWord.pos && item.pos === targetWord.pos) {
        samePosCandidates.push(cleanCandidate);
      } else {
        diffPosCandidates.push(cleanCandidate);
      }
    }

    // Fisher-Yates 셔플 헬퍼
    const shuffleArray = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const shuffledSamePos = shuffleArray(samePosCandidates);
    const shuffledDiffPos = shuffleArray(diffPosCandidates);
    const distractors = [...shuffledSamePos, ...shuffledDiffPos].slice(0, 3);

    const correctItem = {
      ...targetWord,
      word: cleanWordText(targetWord.word),
      meaning: (targetWord.meaning || '').trim()
    };

    // 정확히 4개만 조합 및 셔플 (절대 4개를 초과하지 않도록 보장)
    const finalFour = shuffleArray([correctItem, ...distractors]).slice(0, 4);
    setOptions(finalFour);
  }, [allWordsCache, cleanWordText]);

  // 퀴즈 모드이거나 문항 인덱스/출제방향이 바뀔 때마다 4개 보기 새로 생성
  useEffect(() => {
    if (mode === 'quiz' && words[currentIndex] && !isSessionFinished) {
      buildQuizOptions(words[currentIndex], quizDirectionMode);
    }
  }, [mode, currentIndex, quizDirectionMode, isSessionFinished, buildQuizOptions]);

  const getDynamicFontSize = (text) => {
    const clean = cleanWordText(text);
    if (!clean) return '2.6rem';
    const len = clean.length;
    if (len > 22) return '1.35rem';
    if (len > 15) return '1.65rem';
    if (len > 10) return '2.05rem';
    return '2.6rem';
  };

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
    
    setTimeout(() => setFeedback(null), 900);

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);

    const newIncorrectCount = quality === 'hard'
      ? (word.incorrectCount || 0) + 1
      : (word.incorrectCount || 0);

    const { _sessionKey, _requeued, ...dbWordFields } = word;
    const updatedWord = {
      ...dbWordFields,
      level: newLevel,
      next_review_date: nextDate.toISOString(),
      memory_status: newLevel >= 5 ? 'long_term' : (newLevel >= 1 ? 'short_term' : 'unlearned'),
      incorrectCount: newIncorrectCount
    };
    
    await updateWord(updatedWord);

    // 틀린 단어는 이번 세션 끝에 1회 다시 복습하도록 큐에 안전하게 추가
    if (quality === 'hard' && !word._requeued) {
      const requeuedItem = {
        ...updatedWord,
        _requeued: true,
        _sessionKey: `${updatedWord.id}_retry_${Date.now()}`
      };
      setWords(prev => {
        const nextList = [...prev, requeuedItem];
        wordsRef.current = nextList;
        return nextList;
      });
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

  const nextCard = useCallback(() => {
    if (nextCardTimeoutRef.current) {
      clearTimeout(nextCardTimeoutRef.current);
      nextCardTimeoutRef.current = null;
    }

    setIsFlipped(false);
    setSpellInput('');
    setSpellingResult(null);
    setIsAnswering(false);
    setSelectedOption(null);
    setShowFeedback(false);
    
    setCurrentIndex(prevIdx => {
      const totalLen = wordsRef.current.length;
      if (prevIdx < totalLen - 1) {
        return prevIdx + 1;
      } else {
        setIsSessionFinished(true);
        return prevIdx;
      }
    });
  }, []);

  const prevCard = () => {
    if (currentIndex > 0) {
      if (nextCardTimeoutRef.current) {
        clearTimeout(nextCardTimeoutRef.current);
        nextCardTimeoutRef.current = null;
      }
      setIsFlipped(false);
      setSpellInput('');
      setSpellingResult(null);
      setIsAnswering(false);
      setSelectedOption(null);
      setShowFeedback(false);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const startMode = (m) => {
    if (words.length === 0) {
      alert(t('learn_no_words'));
      return;
    }

    if (nextCardTimeoutRef.current) {
      clearTimeout(nextCardTimeoutRef.current);
      nextCardTimeoutRef.current = null;
    }

    setIsSessionFinished(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSpellInput('');
    setSpellingResult(null);
    setSelectedOption(null);
    setShowFeedback(false);
    setIsAnswering(false);
    setQuizScore({ correct: 0, total: 0 });
    setMode(m);

    const modeNames = { flashcard: '단어 플래시카드', quiz: '객관식 퀴즈', spelling: '주관식 스펠링' };
    trackActivity('STUDY_START', {
      topic: modeNames[m] || m,
      detail: `[${modeNames[m] || m}] 학습 시작 (대상 단어 ${words.length}개)`
    });
  };

  useEffect(() => {
    if (isSessionFinished && mode) {
      const modeNames = { flashcard: '단어 플래시카드', quiz: '객관식 퀴즈', spelling: '주관식 스펠링' };
      const acc = quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 100;
      trackActivity('STUDY_COMPLETE', {
        topic: modeNames[mode] || mode,
        detail:
          mode === 'flashcard'
            ? `[${modeNames[mode]}] 학습 완주 (총 ${words.length}장)`
            : `[${modeNames[mode]}] 완료 — 점수: ${quizScore.correct}/${quizScore.total} (정답률 ${acc}%)`
      });
    }
  }, [isSessionFinished]);

  const handleCardClick = () => {
    setIsFlipped(prev => !prev);
  };

  const handleQuizAnswer = async (selected) => {
    if (isAnswering || showFeedback || !currentWord) return;
    setIsAnswering(true);
    setSelectedOption(selected);
    setShowFeedback(true);
    
    const isCorrect = selected.id === currentWord.id ||
      cleanWordText(selected.word).toLowerCase() === cleanWordText(currentWord.word).toLowerCase();

    // 정답 단어 음성 들려주기
    if (autoAudio) {
      playAudio(cleanWordText(currentWord.word), currentWord.study_lang || studyLang);
    }

    if (isCorrect) {
      setQuizScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      await handleSRSUpdate(currentWord, 'good');
    } else {
      setQuizScore(prev => ({ ...prev, total: prev.total + 1 }));
      await handleSRSUpdate(currentWord, 'hard');
    }

    if (nextCardTimeoutRef.current) clearTimeout(nextCardTimeoutRef.current);
    nextCardTimeoutRef.current = setTimeout(() => {
      nextCard();
    }, 1200);
  };

  // 스펠링 힌트 1글자 채우기
  const handleSpellingHint = () => {
    if (!currentWord || spellingResult) return;
    const structure = parseSpellingStructure(currentWord.word);
    const blanks = structure.filter(s => s.type === 'blank');
    if (spellInput.length < blanks.length) {
      const nextBlank = blanks[spellInput.length];
      if (nextBlank) {
        setSpellInput(prev => prev + nextBlank.char.toLowerCase());
        inputRef.current?.focus();
      }
    }
  };

  const handleSpellingSubmit = async (forceSkip = false) => {
    if (!currentWord || spellingResult) return;

    const targetClean = cleanWordText(currentWord.word);
    const structure = parseSpellingStructure(targetClean);

    // 1) 빈칸 채우기 방식으로 조합된 단어
    let assembledWord = '';
    structure.forEach(item => {
      if (item.type === 'space') assembledWord += ' ';
      else if (item.type === 'hint') assembledWord += item.char;
      else if (item.type === 'blank') {
        assembledWord += spellInput[item.bIdx] || '';
      }
    });

    // 2) 사용자가 전체 단어를 직접 입력한 경우까지 모두 허용
    const cleanInput = spellInput.trim().toLowerCase();
    const isAssembledMatch = assembledWord.trim().toLowerCase() === targetClean.toLowerCase();
    const isDirectMatch = cleanInput === targetClean.toLowerCase() ||
      cleanInput === targetClean.replace(/\s+/g, '').toLowerCase();

    const isCorrect = !forceSkip && (isAssembledMatch || isDirectMatch);

    setSpellingResult({ isCorrect, targetWord: targetClean });
    setQuizScore(prev => ({
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      total: prev.total + 1
    }));

    playAudio(targetClean, currentWord.study_lang || studyLang);

    if (isCorrect) {
      await handleSRSUpdate(currentWord, 'good');
    } else {
      await handleSRSUpdate(currentWord, 'hard');
    }

    if (nextCardTimeoutRef.current) clearTimeout(nextCardTimeoutRef.current);
    nextCardTimeoutRef.current = setTimeout(() => {
      nextCard();
    }, isCorrect ? 1100 : 1800);
  };

  if (loading) return <div className="page" style={{ textAlign: 'center', marginTop: '5rem' }}>{t('learn_loading_msg')}</div>;

  // 모드 미선택 시 메인 학습 선택 화면
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
              t('learn_cart_session', { count: words.length })
            ) : (
              t('learn_recommend_session', { count: words.length })
            )}
          </p>
        </div>
        
        <div style={{ display: 'grid', gap: '1.2rem' }}>
          <button onClick={() => startMode('flashcard')} className="learning-card-select" style={{ border: '3px solid #feca57', background: '#fff' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#f39c12', marginBottom: '4px' }}>{t('learn_flashcard_title')}</div>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>{t('learn_flashcard_desc')}</div>
            </div>
            <span style={{ fontSize: '2.5rem' }}>🎴</span>
          </button>

          <button onClick={() => startMode('quiz')} className="learning-card-select" style={{ border: '3px solid #ff9f43', background: '#fff' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#e67e22', marginBottom: '4px' }}>{t('learn_quiz_title')}</div>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>{t('learn_quiz_desc')}</div>
            </div>
            <span style={{ fontSize: '2.5rem' }}>📝</span>
          </button>

          <button onClick={() => startMode('spelling')} className="learning-card-select" style={{ border: '3px solid #1dd1a1', background: '#fff' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#10ac84', marginBottom: '4px' }}>{t('learn_spelling_title')}</div>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>{t('learn_spelling_desc')}</div>
            </div>
            <span style={{ fontSize: '2.5rem' }}>⌨️</span>
          </button>
        </div>

        {isCartMode && (
          <button
            onClick={async () => {
              if (window.confirm(t('learn_cart_clear_confirm'))) {
                await clearCart();
                loadLearningWords();
              }
            }}
            style={{ width: '100%', marginTop: '2.5rem', padding: '1rem', background: '#f1f3f5', border: 'none', color: '#adb5bd', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {t('learn_cart_clear_btn')}
          </button>
        )}
      </div>
    );
  }

  // 학습 세션 완료 요약 화면
  if (isSessionFinished) {
    const accuracy = quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 100;
    return (
      <div className="page" style={{ textAlign: 'center', paddingBottom: '3rem' }}>
        <div style={{ background: '#fff', padding: '3rem 2rem', borderRadius: '35px', border: '4px solid #feca57', boxShadow: '0 10px 0 #feca57', maxWidth: '520px', margin: '2rem auto' }}>
          <img src="/assets/img/nana.png" className="nana-character" style={{ width: '110px', marginBottom: '1rem' }} alt="Nana" />
          <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--nana-dark)', margin: '0 0 0.5rem' }}>
            🎉 {t('quiz_finish')}
          </h2>
          <p style={{ color: '#666', fontWeight: '700', marginBottom: '1.8rem' }}>
            {t('learn_session_total_words', { count: words.length })}
          </p>

          {(mode === 'quiz' || mode === 'spelling') && quizScore.total > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: '#fff9db', padding: '1rem', borderRadius: '20px', border: '2px solid #feca57' }}>
                <div style={{ fontSize: '0.8rem', color: '#856404', fontWeight: '800' }}>{t('learn_score_label')}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#d97706', marginTop: '4px' }}>
                  {quizScore.correct} / {quizScore.total}
                </div>
              </div>
              <div style={{ background: '#e8f8f5', padding: '1rem', borderRadius: '20px', border: '2px solid #1dd1a1' }}>
                <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: '800' }}>{t('learn_accuracy_label')}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#10ac84', marginTop: '4px' }}>
                  {accuracy}%
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.8rem', flexDirection: 'column' }}>
            <button
              onClick={() => startMode(mode)}
              style={{ padding: '1.1rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: '900', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 5px 0 #e67e22', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <RotateCcw size={18} /> {t('learn_retry_btn')}
            </button>
            <button
              onClick={() => {
                setMode(null);
                setIsSessionFinished(false);
                setCurrentIndex(0);
                loadLearningWords();
              }}
              style={{ padding: '1rem', background: '#f1f3f5', color: '#495057', border: 'none', borderRadius: '25px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer' }}
            >
              {t('learn_back_to_modes')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${feedback === 'wrong' ? 'wrong-shake' : ''}`} style={{ paddingBottom: '2rem' }}>
      {feedback === 'correct' && <div className="correct-celebration">🍌✨</div>}
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', gap: '0.6rem' }}>
        <button
          onClick={() => {
            if (nextCardTimeoutRef.current) clearTimeout(nextCardTimeoutRef.current);
            setMode(null);
          }}
          style={{ padding: '0.5rem 1rem', background: '#f8f9fa', color: '#64748b', border: '2px solid #e9ecef', borderRadius: '12px', cursor: 'pointer', fontWeight: '800', flexShrink: 0 }}
        >
          {t('learn_end_btn')}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '900', color: '#64748b', padding: '0 4px' }}>
            <span>{currentIndex + 1} / {words.length}</span>
            {(mode === 'quiz' || mode === 'spelling') && (
              <span style={{ color: '#10b981' }}>✅ {quizScore.correct} / {quizScore.total}</span>
            )}
          </div>
          <div style={{ background: '#e9ecef', height: '10px', borderRadius: '6px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ width: `${((currentIndex + 1) / words.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #feca57, #ff9f43)', transition: 'width 0.4s ease' }}></div>
          </div>
        </div>

        <button
          onClick={toggleAutoAudio}
          title={t('learn_auto_audio_toggle')}
          style={{
            background: autoAudio ? '#fff9db' : '#f1f3f5',
            border: autoAudio ? '2px solid #feca57' : '2px solid #e9ecef',
            color: autoAudio ? '#d97706' : '#94a3b8',
            padding: '0.45rem 0.7rem',
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: '800',
            fontSize: '0.75rem',
            flexShrink: 0
          }}
        >
          {autoAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </header>

      {/* 1. 플래시카드 모드 */}
      {mode === 'flashcard' && currentWord && (
        <>
          <div
            onClick={handleCardClick}
            className={`flashcard-container ${isFlipped ? 'flipped' : ''}`}
            style={{ minHeight: '390px', perspective: '1000px', cursor: 'pointer', marginBottom: '1.5rem' }}
          >
            <div
              className="flashcard-inner"
              style={{
                position: 'relative',
                width: '100%',
                minHeight: '390px',
                textAlign: 'center',
                transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'none'
              }}
            >
              {/* 앞면 */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  background: '#fff',
                  borderRadius: '30px',
                  border: '4px solid #feca57',
                  boxShadow: '0 10px 0 #feca57',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '1.5rem'
                }}
              >
                {currentIndex > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); prevCard(); }}
                    style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', background: '#f8f9fa', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '0.5rem 0.8rem', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '800', fontSize: '0.8rem' }}
                  >
                    <ChevronLeft size={16} /> {t('btn_back')}
                  </button>
                )}
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); playAudio(cleanWordText(currentWord.word), currentWord.study_lang || studyLang); }}
                    style={{ background: '#feca57', border: 'none', color: '#fff', padding: '0.8rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(254, 202, 87, 0.3)' }}
                  >
                    <Volume2 size={24} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ background: '#fff9db', color: '#f39c12', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '900', border: '2px solid #feca57' }}>
                    {getNormalizedPosLabel(currentWord.pos)}
                  </span>
                  {currentWord.topic && (
                    <span style={{ background: '#e6fffa', color: '#00b894', padding: '0.4rem 0.9rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '800', border: '1.5px solid #b2f5ea' }}>
                      🏷️ {currentWord.topic}
                    </span>
                  )}
                </div>

                <div style={{ width: '100%', textAlign: 'center', padding: '0 0.5rem' }}>
                  <h1 style={{
                    fontSize: getDynamicFontSize(currentWord.word),
                    margin: 0,
                    color: 'var(--nana-dark)',
                    wordBreak: 'keep-all',
                    overflowWrap: 'break-word',
                    fontWeight: '900',
                    lineHeight: '1.25'
                  }}>
                    {cleanWordText(currentWord.word)}
                  </h1>
                  {currentWord.pronunciation && (
                    <div style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: '700', marginTop: '0.5rem' }}>
                      [{currentWord.pronunciation}]
                    </div>
                  )}
                </div>
                <p style={{ color: '#adb5bd', marginTop: '2rem', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  👆 {t('learn_touch_card')}
                </p>
              </div>

              {/* 뒷면 */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  background: '#fff',
                  borderRadius: '30px',
                  border: '4px solid #ff9f43',
                  boxShadow: '0 10px 0 #ff9f43',
                  transform: 'rotateY(180deg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.3rem 1.4rem',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.6rem', width: '100%', justifyContent: 'center' }}>
                  <h2 style={{ fontSize: '1.9rem', margin: 0, color: '#e67e22', fontWeight: '900', wordBreak: 'keep-all' }}>
                    {currentWord.meaning}
                  </h2>
                  <button
                    onClick={(e) => { e.stopPropagation(); playAudio(currentWord.meaning, currentWord.user_lang || userLang); }}
                    style={{ background: '#ff9f43', border: 'none', color: '#fff', padding: '0.55rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <Volume2 size={18} />
                  </button>
                </div>

                {currentWord.root && (
                  <div style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: '800', marginBottom: '0.5rem', background: '#f0fdf4', padding: '3px 12px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    🌱 {t('label_root')}: {currentWord.root}
                  </div>
                )}

                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '100%', overflowY: 'auto', flex: 1, cursor: 'default' }}
                >
                  <div style={{ textAlign: 'left', background: '#fffaf0', padding: '1rem', borderRadius: '20px', border: '2px dashed #ff9f43' }}>
                    {currentWord.example_formal && (
                      <div style={{ marginBottom: currentWord.example_casual ? '0.9rem' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#ff9f43', fontWeight: 'bold' }}>🌟 {t('label_formal')}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); playAudio(currentWord.example_formal, currentWord.study_lang || studyLang); }}
                            style={{ background: 'none', border: 'none', color: '#e67e22', cursor: 'pointer', padding: '2px' }}
                          >
                            <Volume2 size={15} />
                          </button>
                        </div>
                        <InteractiveSentence
                          sentence={currentWord.example_formal}
                          wordBreakdown={currentWord.word_breakdown}
                        />
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem', fontWeight: '600' }}>
                          {currentWord.example_formal_kr}
                        </div>
                      </div>
                    )}
                    {currentWord.example_casual && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#d35400', fontWeight: 'bold' }}>🗣️ {t('label_casual')}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); playAudio(currentWord.example_casual, currentWord.study_lang || studyLang); }}
                            style={{ background: 'none', border: 'none', color: '#d35400', cursor: 'pointer', padding: '2px' }}
                          >
                            <Volume2 size={15} />
                          </button>
                        </div>
                        <InteractiveSentence
                          sentence={currentWord.example_casual}
                          wordBreakdown={currentWord.word_breakdown}
                        />
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem', fontWeight: '600' }}>
                          {currentWord.example_casual_kr}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isFlipped ? (
            <button
              onClick={handleCardClick}
              style={{
                width: '100%',
                padding: '1.1rem',
                background: 'linear-gradient(135deg, #feca57, #ff9f43)',
                color: '#fff',
                border: 'none',
                borderRadius: '25px',
                fontSize: '1.05rem',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 5px 0 #e67e22'
              }}
            >
              🔄 {t('learn_touch_card')}
            </button>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem' }}>
              <button onClick={(e) => { e.stopPropagation(); handleSRSUpdate(currentWord, 'hard'); nextCard(); }} className="srs-btn hard" style={{ border: '3px solid #ff7675', boxShadow: '0 5px 0 #ff7675' }}>{t('learn_srs_wrong')}</button>
              <button onClick={(e) => { e.stopPropagation(); handleSRSUpdate(currentWord, 'good'); nextCard(); }} className="srs-btn good" style={{ border: '3px solid #feca57', boxShadow: '0 5px 0 #feca57' }}>{t('learn_srs_memorized')}</button>
              <button onClick={(e) => { e.stopPropagation(); handleSRSUpdate(currentWord, 'mastered'); nextCard(); }} className="srs-btn master" style={{ border: '3px solid #1dd1a1', boxShadow: '0 5px 0 #1dd1a1' }}>{t('learn_srs_master')}</button>
            </div>
          )}
        </>
      )}

      {/* 2. 객관식 퀴즈 모드 (항상 정확히 4지선다 보장 + 출제 방향 선택) */}
      {mode === 'quiz' && currentWord && (
        <div style={{ background: '#fff', padding: '1.8rem 1.4rem', borderRadius: '35px', border: '4px solid #ff9f43', boxShadow: '0 12px 0 #ff9f43' }}>
          {/* 출제 방향 전환 탭 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'wordToMeaning', label: t('quiz_dir_word_to_meaning') },
              { id: 'meaningToWord', label: t('quiz_dir_meaning_to_word') },
              { id: 'mixed', label: t('quiz_dir_mixed') }
            ].map(dir => (
              <button
                key={dir.id}
                onClick={() => !showFeedback && setQuizDirectionMode(dir.id)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '18px',
                  border: quizDirectionMode === dir.id ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                  background: quizDirectionMode === dir.id ? '#fff7ed' : '#f8fafc',
                  color: quizDirectionMode === dir.id ? '#ea580c' : '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: '900',
                  cursor: showFeedback ? 'default' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {dir.label}
              </button>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ background: '#fff7ed', color: '#ea580c', padding: '0.5rem 1.1rem', borderRadius: '25px', fontSize: '0.82rem', fontWeight: '900', border: '2px solid #fed7aa', display: 'inline-block' }}>
              {activeQuestionType === 'wordToMeaning'
                ? `${translations[studyLang]?.name || studyLang} ➔ ${translations[userLang]?.name || userLang}`
                : `${translations[userLang]?.name || userLang} ➔ ${translations[studyLang]?.name || studyLang}`}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', marginTop: '1.5rem' }}>
              <h2 style={{
                margin: 0,
                fontSize: activeQuestionType === 'wordToMeaning'
                  ? getDynamicFontSize(currentWord.word)
                  : getDynamicFontSize(currentWord.meaning),
                color: 'var(--nana-dark)',
                fontWeight: '900',
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
                lineHeight: '1.25'
              }}>
                {activeQuestionType === 'wordToMeaning'
                  ? cleanWordText(currentWord.word)
                  : currentWord.meaning}
              </h2>
              {activeQuestionType === 'wordToMeaning' && (
                <button
                  onClick={() => playAudio(cleanWordText(currentWord.word), currentWord.study_lang || studyLang)}
                  style={{ background: '#ff9f43', border: 'none', color: '#fff', padding: '0.75rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <Volume2 size={22} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {options.slice(0, 4).map((opt, i) => {
              let btnStyle = {
                border: '3px solid #f1f3f5',
                borderRadius: '20px',
                padding: '1.1rem 1.2rem',
                fontSize: '1.1rem',
                fontWeight: '800',
                background: '#fff',
                color: '#334155',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: showFeedback ? 'default' : 'pointer',
                transition: 'all 0.2s'
              };
              let badgeText = `${i + 1}`;
              let badgeBg = '#f1f5f9';
              let badgeColor = '#64748b';
              
              if (showFeedback) {
                const isCorrectAnswer = opt.id === currentWord.id ||
                  cleanWordText(opt.word).toLowerCase() === cleanWordText(currentWord.word).toLowerCase();
                const isSelected = selectedOption && (selectedOption.id === opt.id && selectedOption.word === opt.word);
                
                if (isSelected && isCorrectAnswer) {
                  btnStyle = { ...btnStyle, background: '#e8f8f5', borderColor: '#1dd1a1', color: '#047857' };
                  badgeText = '✓';
                  badgeBg = '#10b981';
                  badgeColor = '#fff';
                } else if (isSelected && !isCorrectAnswer) {
                  btnStyle = { ...btnStyle, background: '#ffeeee', borderColor: '#ff7675', color: '#d63031' };
                  badgeText = '✕';
                  badgeBg = '#ef4444';
                  badgeColor = '#fff';
                } else if (isCorrectAnswer) {
                  btnStyle = { ...btnStyle, borderStyle: 'dashed', borderColor: '#1dd1a1', background: '#f0fdf4', color: '#047857' };
                  badgeText = '✓';
                  badgeBg = '#10b981';
                  badgeColor = '#fff';
                }
              }

              const optionLabel = activeQuestionType === 'wordToMeaning'
                ? opt.meaning
                : cleanWordText(opt.word);

              return (
                <button
                  key={`${opt.id}_${i}`}
                  onClick={() => handleQuizAnswer(opt)}
                  disabled={showFeedback}
                  className="quiz-option-btn"
                  style={btnStyle}
                >
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: badgeBg,
                    color: badgeColor,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: '900',
                    flexShrink: 0
                  }}>
                    {badgeText}
                  </span>
                  <span style={{ flex: 1, wordBreak: 'keep-all', lineHeight: '1.35' }}>
                    {optionLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 주관식 스펠링 모드 */}
      {mode === 'spelling' && currentWord && (() => {
        const targetClean = cleanWordText(currentWord.word);
        const structure = parseSpellingStructure(targetClean);
        const blanksCount = structure.filter(s => s.type === 'blank').length;
        
        return (
          <div style={{ background: '#fff', padding: '2.2rem 1.5rem', borderRadius: '35px', border: '4px solid #1dd1a1', boxShadow: '0 12px 0 #1dd1a1', textAlign: 'center', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ background: '#e8f8f5', color: '#047857', padding: '0.35rem 0.9rem', borderRadius: '15px', fontSize: '0.8rem', fontWeight: '900' }}>
                {getNormalizedPosLabel(currentWord.pos)}
              </span>
              <button
                onClick={handleSpellingHint}
                disabled={!!spellingResult || spellInput.length >= blanksCount}
                style={{
                  background: '#fff9db',
                  color: '#d97706',
                  border: '2px solid #feca57',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '15px',
                  fontSize: '0.8rem',
                  fontWeight: '900',
                  cursor: (spellingResult || spellInput.length >= blanksCount) ? 'default' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: (spellingResult || spellInput.length >= blanksCount) ? 0.5 : 1
                }}
              >
                <Lightbulb size={15} /> {t('learn_spelling_hint_btn')}
              </button>
            </div>

            <img src="/assets/img/nana.png" className="nana-character" style={{ width: '80px', marginBottom: '0.8rem' }} alt="nana-spelling" />
            <h2 style={{ marginBottom: '1.2rem', fontSize: '1.9rem', fontWeight: '900', color: 'var(--nana-dark)', wordBreak: 'keep-all' }}>
              "{currentWord.meaning}"
            </h2>
            
            {/* 빈칸 가이드 박스 */}
            <div
              onClick={() => inputRef.current?.focus()}
              style={{
                marginBottom: '1.2rem',
                padding: '1.2rem',
                background: '#f8f9fa',
                borderRadius: '25px',
                border: '3px dashed #1dd1a1',
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                cursor: 'text'
              }}
            >
              {structure.map((item, idx) => {
                if (item.type === 'space') return <div key={idx} style={{ width: '16px' }}></div>;
                if (item.type === 'hint') return (
                  <span key={idx} style={{ fontSize: '2.1rem', fontWeight: '900', color: '#94a3b8' }}>{item.char}</span>
                );
                const char = spellInput[item.bIdx];
                return (
                  <span
                    key={idx}
                    style={{
                      fontSize: '2.1rem',
                      fontWeight: '900',
                      minWidth: '30px',
                      borderBottom: char ? '4px solid #1dd1a1' : '4px solid #cbd5e1',
                      color: char ? '#059669' : '#cbd5e1'
                    }}
                  >
                    {char || '_'}
                  </span>
                );
              })}
            </div>

            {/* 모바일 및 데스크톱 완벽 호환 입력창 */}
            <div style={{ marginBottom: '1.2rem' }}>
              <input
                ref={inputRef}
                type="text"
                value={spellInput}
                disabled={!!spellingResult}
                placeholder={t('learn_spelling_ph')}
                onChange={e => {
                  const val = e.target.value;
                  setSpellInput(val);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSpellingSubmit(false);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.9rem 1.2rem',
                  fontSize: '1.15rem',
                  fontWeight: '800',
                  textAlign: 'center',
                  borderRadius: '18px',
                  border: '2.5px solid #cbd5e1',
                  outline: 'none',
                  background: spellingResult ? '#f1f5f9' : '#fff',
                  color: '#1e293b'
                }}
                autoFocus
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {/* 정답/오답 인라인 피드백 */}
            {spellingResult && (
              <div style={{
                marginBottom: '1.2rem',
                padding: '0.9rem 1.2rem',
                borderRadius: '18px',
                background: spellingResult.isCorrect ? '#ecfdf5' : '#fef2f2',
                border: spellingResult.isCorrect ? '2px solid #10b981' : '2px solid #ef4444',
                color: spellingResult.isCorrect ? '#047857' : '#b91c1c',
                fontWeight: '900',
                fontSize: '1.05rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                {spellingResult.isCorrect ? (
                  <>
                    <CheckCircle2 size={20} /> {t('quiz_correct')} ({spellingResult.targetWord})
                  </>
                ) : (
                  <>
                    <XCircle size={20} /> {t('msg_spelling_answer')}: <span style={{ textDecoration: 'underline' }}>{spellingResult.targetWord}</span>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => playAudio(targetClean, currentWord.study_lang || studyLang)}
                style={{ flex: 1, minWidth: '110px', padding: '1rem', background: '#f0f4ff', color: '#2563eb', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '900', fontSize: '0.95rem' }}
              >
                🔊 {t('learn_spelling_listen')}
              </button>
              <button
                onClick={() => handleSpellingSubmit(false)}
                disabled={!!spellingResult}
                style={{ flex: 2, minWidth: '150px', padding: '1rem', background: '#1dd1a1', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '1.1rem', cursor: spellingResult ? 'default' : 'pointer', fontWeight: '900', boxShadow: '0 6px 0 #10ac84' }}
              >
                {t('learn_spelling_submit')}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Learn;
