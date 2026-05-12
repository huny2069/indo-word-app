import React, { useState } from 'react';
import { addWord, getWords } from '../db/database';
import { generateWords } from '../api/geminiApi';
import { playAudio } from '../api/ttsApi';
import { fetchSharedWords, saveSharedWords, logUsage } from '../api/supabase';
import { Volume2, Sparkles } from 'lucide-react';
import InteractiveSentence from '../components/InteractiveSentence';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const WordGenerate = () => {
  const { userLang, studyLang, t } = useLanguage();
  const { user } = useAuth();

  const langNames = { ko: '한국어', id: '인도네시아어', en: '영어' };
  const targetLangName = langNames[studyLang] || '대상 언어';

  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [generatedWords, setGeneratedWords] = useState([]); // 방금 생성된 단어만 저장
  
  // 생성 모드 ('ai' 또는 'manual')
  const [genMode, setGenMode] = useState('ai');

  // 진행률 및 상태 메시지 ( v17.9 추가)
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  
  // 수동 입력용 단어 데이터
  const [manualWord, setManualWord] = useState({
    word: '', meaning: '', pos: 'Noun', topic: '', 
    etymology: '', nuance: '', pronunciation: '', root: '', honorifics: '', hanja_info: '',
    grammar_rule: '', context: '', caution: '', related: '',
    example_formal: '', example_formal_kr: '',
    example_casual: '', example_casual_kr: '',
    word_breakdown: [] 
  });

  const handleGenerate = async () => {
    let apiKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) apiKey = apiKey.trim();

    if (!apiKey) {
      alert(t('msg_ai_key_missing'));
      return;
    }
    if (!topic.trim()) {
      alert(t('msg_ai_topic_required'));
      return;
    }

    setLoading(true);
    setGeneratedWords([]);
    setProgress(0);
    
    // 로딩바 시뮬레이션 시작 (실제 로딩 느낌 제공)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 98) {
          const increment = (99 - prev) / 15;
          return prev + (increment < 0.1 ? 0.1 : increment);
        }
        return prev;
      });
    }, 200);
    
    try {
      // 로컬 스토리지에 저장된 모델이 있으면 사용, 없으면 gemini-1.5-flash 사용
      const savedModel = localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash';
      
      // 1. 로컬 단어장 불러오기 (중복 방지용)
      setProgressMsg(t('gen_ai_booting'));
      let localWords = await getWords();
      let existingWordStrings = localWords.map(w => w.word.toLowerCase());
      
      let finalAddedWords = [];

      // 2. 공유 캐시(Supabase) 조회 시도 (3개국어 대응)
      setProgressMsg(t('gen_ai_analyzing'));
      try {
        const sharedWords = await fetchSharedWords(topic.trim(), userLang, studyLang);
        const uniqueShared = sharedWords.filter(sw => !existingWordStrings.includes(sw.word.toLowerCase()));
        const fromCache = uniqueShared.slice(0, count);
        
        for (const w of fromCache) {
          const { id, created_at, ...cleanWord } = w;
          const newId = await addWord(cleanWord);
          finalAddedWords.push({ ...cleanWord, id: newId });
        }
        
        if (fromCache.length > 0) {
            logUsage({
                user_id: localStorage.getItem('user_device_id') || 'anonymous',
                email: user?.email,
                tokens_used: 0, cost_usd: 0,
                topic: `[CACHE] ${topic.trim()} (${userLang}->${studyLang})`
            });
        }
      } catch (cacheErr) { console.warn("Cache Fetch failed:", cacheErr); }

      // 3. 모자란 개수만큼 AI(Gemini) 생성
      const remainingCount = count - finalAddedWords.length;
      if (remainingCount > 0) {
        setProgressMsg(t('gen_ai_generating').replace('{targetLangName}', targetLangName));
        let currentTry = 0;
        const maxTries = 3;

        while (finalAddedWords.length < count && currentTry < maxTries) {
          currentTry++;
          const currentRemaining = count - finalAddedWords.length;
          const excludeList = [...existingWordStrings, ...finalAddedWords.map(w => w.word.toLowerCase())];
          
          try {
              const result = await generateWords(topic, currentRemaining, apiKey, savedModel, excludeList, userLang, studyLang, user?.email);
              const newAiResults = result.filter(w => {
                  const isDuplicateInLocal = existingWordStrings.includes(w.word.toLowerCase());
                  const isDuplicateInBatch = finalAddedWords.some(fw => fw.word.toLowerCase() === w.word.toLowerCase());
                  return !isDuplicateInLocal && !isDuplicateInBatch;
              });

              for (const w of newAiResults) {
                  w.topic = topic;
                  w.user_lang = userLang;
                  w.study_lang = studyLang;
                  const id = await addWord(w);
                  finalAddedWords.push({ ...w, id });
                  
                  // 새로 생성된 단어 공유 (userLang, studyLang 포함)
                  saveSharedWords([{ ...w, user_lang: userLang, study_lang: studyLang }]);
                  
                  if (finalAddedWords.length >= count) break;
              }
              if (newAiResults.length === 0) break;
          } catch (apiError) {
              if (currentTry >= maxTries) throw apiError;
              await new Promise(res => setTimeout(res, 1000));
          }
        }
      }
      
      clearInterval(progressInterval);
      setProgress(100);
      setProgressMsg(t('gen_ai_ready'));
      setGeneratedWords(finalAddedWords);
      
      if (finalAddedWords.length === 0) {
        alert(t('msg_ai_gen_fail'));
      } else {
        alert(t('msg_cart_added', { count: finalAddedWords.length }));
      }
    } catch (error) {
      clearInterval(progressInterval);
      alert(t('msg_ai_gen_error') + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async (e) => {
    e.preventDefault();
    if (!manualWord.word.trim() || !manualWord.meaning.trim()) {
        alert(t('msg_manual_required'));
        return;
    }

    try {
        const wordData = { ...manualWord, user_lang: userLang, study_lang: studyLang };
        const id = await addWord(wordData);
        setGeneratedWords([{ ...wordData, id }, ...generatedWords]);
        alert(t('msg_save_done'));
        // 폼 초기화 로직 생략 (유저 요청에 따라 유지 가능)
    } catch (err) { alert(t('msg_save_error') + ": " + err.message); }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0, color: 'var(--nana-dark)', fontWeight: '900' }}>{t('gen_title')}</h2>
        <div style={{ display: 'flex', background: '#eee', padding: '0.3rem', borderRadius: '30px' }}>
            <button 
                onClick={() => setGenMode('ai')}
                style={{ 
                    padding: '0.6rem 1.2rem', border: 'none', borderRadius: '25px', cursor: 'pointer', transition: '0.3s', fontWeight: 'bold',
                    background: genMode === 'ai' ? 'var(--primary-color)' : 'transparent', color: genMode === 'ai' ? '#fff' : '#666'
                }}>
                {t('gen_ai_mode')}
            </button>
            <button 
                onClick={() => setGenMode('manual')}
                style={{ 
                    padding: '0.6rem 1.2rem', border: 'none', borderRadius: '25px', cursor: 'pointer', transition: '0.3s', fontWeight: 'bold',
                    background: genMode === 'manual' ? 'var(--primary-color)' : 'transparent', color: genMode === 'manual' ? '#fff' : '#666'
                }}>
                {t('gen_manual_mode')}
            </button>
        </div>
      </div>

      {genMode === 'ai' ? (
        <div style={{ background: '#fff', padding: '2rem', borderRadius: '30px', boxShadow: '0 8px 16px rgba(0,0,0,0.05)', border: '2px solid #feca57' }}>
            <p style={{ color: '#666', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
                <Sparkles color="#feca57" /> {t('gen_ai_desc')}
            </p>
            
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('gen_topic_label')}</label>
            <input 
            type="text" 
            placeholder={t('gen_topic_placeholder')}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ width: '100%', padding: '1rem', border: '2px solid #f0f0f0', borderRadius: '15px', marginBottom: '1rem', outline: 'none', fontSize: '1rem' }}
            />

            <label style={{ display: 'block', margin: '1rem 0 0.5rem', fontWeight: 'bold' }}>{t('gen_count_label')}</label>
            <input 
            type="number" 
            min="1" max="30"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{ width: '100%', padding: '1rem', border: '2px solid #f0f0f0', borderRadius: '15px', outline: 'none', fontSize: '1rem' }}
            />

            <button 
            onClick={handleGenerate} 
            disabled={loading}
            style={{ width: '100%', padding: '1.2rem', marginTop: '2rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '35px', fontSize: '1.2rem', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '900', boxShadow: '0 6px 0 #e67e22' }}>
            {loading ? t('gen_btn_loading') : t('gen_btn_start')}
            </button>
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '2rem', borderRadius: '30px', boxShadow: '0 8px 16px rgba(0,0,0,0.05)', border: '2px solid #55efc4' }}>
            <form onSubmit={handleManualSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                    <div>
                        <label style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block' }}>{t('gen_manual_word')}</label>
                        <input type="text" value={manualWord.word} onChange={e => setManualWord({...manualWord, word: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '2px solid #eee', borderRadius: '12px' }} required />
                    </div>
                    <div>
                        <label style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block' }}>{t('gen_manual_meaning')}</label>
                        <input type="text" value={manualWord.meaning} onChange={e => setManualWord({...manualWord, meaning: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '2px solid #eee', borderRadius: '12px' }} required />
                    </div>
                </div>
                <button type="submit" style={{ width: '100%', padding: '1.1rem', background: '#00b894', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 0 #009677' }}>
                    {t('gen_manual_add_btn')}
                </button>
            </form>
        </div>
      )}

      {/* 로딩 프로그레스 오버레이 (v17.9 추가) */}
      {loading && (
        <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            zIndex: 9999, padding: '2rem', textAlign: 'center'
        }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '2rem' }}>
                <div style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                    border: '8px solid #f0f0f0', borderRadius: '50%' 
                }}></div>
                <div style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                    border: '8px solid #feca57', borderRadius: '50%',
                    borderTopColor: 'transparent', animation: 'spin 1.5s linear infinite'
                }}></div>
                <div style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    fontSize: '1.8rem', fontWeight: '900', color: 'var(--nana-dark)'
                }}>
                    {Math.floor(progress)}%
                </div>
            </div>

            <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--nana-dark)', marginBottom: '1rem' }}>
                {progressMsg}
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '2rem', fontWeight: '600' }}>
                {t('gen_ai_current_model')} <span style={{ color: '#feca57' }}>{localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash'}</span>
            </p>

            <div style={{ width: '100%', maxWidth: '400px', height: '18px', background: '#f5f5f5', borderRadius: '10px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ 
                    width: `${progress}%`, height: '100%', 
                    background: 'linear-gradient(90deg, #feca57, #ff9f43)',
                    transition: 'width 0.5s ease-out',
                    boxShadow: '0 0 10px rgba(254, 202, 87, 0.5)'
                }}></div>
            </div>

            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
      )}

      {generatedWords.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '900' }}>
            <span style={{ fontSize: '1.5rem' }}>🎉</span> {t('gen_result_title')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {generatedWords.map(w => (
              <div key={w.id || w.word} style={{ background: '#fff', padding: '1.5rem', borderRadius: '25px', boxShadow: '0 8px 15px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.4rem', fontWeight: '900' }}>{w.word}</h3>
                    <button onClick={() => playAudio(w.word, w.study_lang)} style={{ background: '#f0f7ff', border: 'none', borderRadius: '50%', color: '#1976d2', padding: '10px', cursor: 'pointer' }}>
                        <Volume2 size={22} />
                    </button>
                    {w.pronunciation && <span style={{ color: '#999', fontSize: '1rem', fontWeight: '500' }}>[{w.pronunciation}]</span>}
                  </div>
                  <span style={{ fontSize: '0.85rem', background: '#f5f5f5', padding: '4px 12px', borderRadius: '50px', color: '#666', fontWeight: '700' }}>{w.pos}</span>
                </div>
                
                <p style={{ fontSize: '1.2rem', color: 'var(--nana-dark)', fontWeight: '800', marginBottom: '1.5rem' }}>= {w.meaning}</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {w.example_formal && (
                            <div style={{ background: '#fdfcfe', padding: '1.2rem', borderRadius: '18px', border: '1px solid #eee' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: '#2c3e50', fontWeight: '900', minWidth: '65px' }}>🌟 {t('label_formal')}</span>
                                    <div style={{ flex: 1, fontSize: '0.95rem', color: '#333', lineHeight: '1.5' }}>
                                        <InteractiveSentence sentence={w.example_formal} wordBreakdown={w.word_breakdown} />
                                    </div>
                                    <button onClick={() => playAudio(w.example_formal, w.study_lang)} style={{ color: '#777', border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <Volume2 size={16} />
                                    </button>
                                </div>
                                <p style={{ margin: '0 0 0 4.5rem', fontSize: '0.85rem', color: '#888', fontWeight: '600' }} onClick={() => playAudio(w.example_formal_kr, w.user_lang)}>{w.example_formal_kr}</p>
                            </div>
                        )}
                        {w.example_casual && (
                            <div style={{ background: '#fff9f0', padding: '1.2rem', borderRadius: '18px', border: '1px solid #fff3e0' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: '#d35400', fontWeight: '900', minWidth: '65px' }}>🗣️ {t('label_casual')}</span>
                                    <div style={{ flex: 1, fontSize: '0.95rem', color: '#333', lineHeight: '1.5' }}>
                                        <InteractiveSentence sentence={w.example_casual} wordBreakdown={w.word_breakdown} />
                                    </div>
                                    <button onClick={() => playAudio(w.example_casual, w.study_lang)} style={{ color: '#777', border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <Volume2 size={16} />
                                    </button>
                                </div>
                                <p style={{ margin: '0 0 0 4.5rem', fontSize: '0.85rem', color: '#888', fontWeight: '600' }} onClick={() => playAudio(w.example_casual_kr, w.user_lang)}>{w.example_casual_kr}</p>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem', background: '#f8f9fa', padding: '1.5rem', borderRadius: '18px' }}>
                        {w.etymology && <div><b style={{ color: '#666' }}>📜 {t('label_etymology')}:</b> {w.etymology}</div>}
                        {w.nuance && <div><b style={{ color: '#8e44ad' }}>🎭 {t('label_nuance') || 'Nuance'}:</b> {w.nuance}</div>}
                        {w.honorifics && <div><b style={{ color: '#2980b9' }}>🙇‍♂️ {t('label_honorifics') || 'Honorifics'}:</b> {w.honorifics}</div>}
                        {w.hanja_info && <div><b style={{ color: '#c2410c' }}>🈯 {t('label_hanja') || 'Hanja/Root'}:</b> {w.hanja_info}</div>}
                        {w.root && <div><b style={{ color: '#27ae60' }}>🌱 {t('label_root')}:</b> {w.root}</div>}
                        {w.grammar_rule && <div><b style={{ color: '#c0392b' }}>📘 {t('label_grammar')}:</b> {w.grammar_rule}</div>}
                        {w.caution && <div><b style={{ color: '#d35400' }}>⚠️ {t('label_caution')}:</b> {w.caution}</div>}
                        {w.related && <div><b style={{ color: '#16a085' }}>💡 {t('label_tip')}:</b> {w.related}</div>}
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WordGenerate;
