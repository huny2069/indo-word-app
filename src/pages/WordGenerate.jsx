import React, { useState, useMemo } from 'react';
import { addWord, getWords } from '../db/database';
import { generateWords } from '../api/geminiApi';
import { playAudio } from '../api/ttsApi';
import { fetchSharedWords, saveSharedWords, logUsage } from '../api/supabase';
import { Volume2, Sparkles, Database, Plus, Search, CheckCircle2, BookmarkPlus } from 'lucide-react';
import InteractiveSentence from '../components/InteractiveSentence';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  getOfflineCategories, 
  searchOfflineWords, 
  extractOfflineWords,
  ALL_OFFLINE_WORDS 
} from '../data/offlineDatabase';

const WordGenerate = () => {
  const { userLang, studyLang, t } = useLanguage();
  const { user } = useAuth();

  const langNames = { ko: '한국어', id: '인도네시아어', en: '영어' };
  const targetLangName = langNames[studyLang] || '대상 언어';

  // 생성 모드 ('offline', 'ai', 'manual')
  const [genMode, setGenMode] = useState('offline');

  // 방금 생성/추가된 단어 목록 (결과 피드백용)
  const [generatedWords, setGeneratedWords] = useState([]);

  // --- [오프라인 모드 State] ---
  const categories = useMemo(() => getOfflineCategories(), []);
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || 'discourse');
  const selectedCategory = useMemo(() => categories.find(c => c.id === selectedCatId) || categories[0], [categories, selectedCatId]);
  const [selectedSubCatId, setSelectedSubCatId] = useState('');
  const [offlineCount, setOfflineCount] = useState(10);
  const [offlineSearchQuery, setOfflineSearchQuery] = useState('');
  const [offlineAdding, setOfflineAdding] = useState(false);

  // 실시간 검색 결과 (오프라인 사전 탐색)
  const searchResults = useMemo(() => {
    if (!offlineSearchQuery.trim()) return [];
    return searchOfflineWords({ keyword: offlineSearchQuery });
  }, [offlineSearchQuery]);

  // --- [온라인 AI 모드 State] ---
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');

  // --- [수동 입력 State] ---
  const [manualWord, setManualWord] = useState({
    word: '', meaning: '', pos: '명사', topic: '', 
    etymology: '', nuance: '', pronunciation: '', root: '', honorifics: '', hanja_info: '',
    grammar_rule: '', context: '', caution: '', related: '',
    example_formal: '', example_formal_kr: '',
    example_casual: '', example_casual_kr: '',
    word_breakdown: [] 
  });

  // ==========================================
  // [1. 오프라인 단어 추출 및 단어장 일괄 추가]
  // ==========================================
  const handleOfflineGenerate = async () => {
    setOfflineAdding(true);
    try {
      const localWords = await getWords();
      const existingWordStrings = localWords.map(w => w.word.toLowerCase());

      const extracted = extractOfflineWords({
        categoryId: selectedCatId,
        subcategoryId: selectedSubCatId,
        count: offlineCount,
        excludeWords: existingWordStrings
      });

      if (extracted.length === 0) {
        alert('선택한 카테고리의 모든 단어가 이미 단어장에 존재하거나 조건에 맞는 단어가 없습니다.');
        setOfflineAdding(false);
        return;
      }

      const addedList = [];
      for (const item of extracted) {
        const wordData = {
          ...item,
          user_lang: userLang,
          study_lang: studyLang,
          topic: selectedCategory?.name + (selectedSubCatId ? ` > ${selectedSubCatId}` : '')
        };
        const id = await addWord(wordData);
        addedList.push({ ...wordData, id });
      }

      setGeneratedWords(addedList);
      alert(`🎉 ${addedList.length}개의 실생활 필수 단어가 단어장에 성공적으로 추가되었습니다!`);
    } catch (err) {
      console.error('오프라인 단어 추가 오류:', err);
      alert('단어 추가 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setOfflineAdding(false);
    }
  };

  // ==========================================
  // [2. 오프라인 검색 결과에서 개별 단어 추가]
  // ==========================================
  const handleAddSingleOfflineWord = async (item) => {
    try {
      const localWords = await getWords();
      const isDuplicate = localWords.some(w => w.word.toLowerCase().includes(item.word.split(' ')[0].toLowerCase()));
      if (isDuplicate) {
        alert(`'${item.word}' 단어는 이미 단어장에 존재합니다.`);
        return;
      }

      const wordData = {
        ...item,
        user_lang: userLang,
        study_lang: studyLang,
        topic: '오프라인 사전'
      };
      const id = await addWord(wordData);
      setGeneratedWords(prev => [{ ...wordData, id }, ...prev]);
      alert(`'${item.word}' 단어가 단어장에 추가되었습니다! 🍌`);
    } catch (err) {
      alert('추가 실패: ' + err.message);
    }
  };

  // ==========================================
  // [3. 온라인 AI 생성 (Gemini API 100% 보존)]
  // ==========================================
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
      const savedModel = localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash';
      
      setProgressMsg(t('gen_ai_booting'));
      let localWords = await getWords();
      let existingWordStrings = localWords.map(w => w.word.toLowerCase());
      
      let finalAddedWords = [];

      // Supabase 캐시 조회
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

      // Gemini AI 실시간 생성
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

  // ==========================================
  // [4. 수동 입력]
  // ==========================================
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
    } catch (err) { alert(t('msg_save_error') + ": " + err.message); }
  };

  return (
    <div className="page" style={{ paddingBottom: '3rem' }}>
      {/* 상단 모드 스위처 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--nana-dark)', fontWeight: '900', fontSize: '1.8rem' }}>{t('gen_title')}</h2>
          <p style={{ margin: '0.3rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            {genMode === 'offline' ? '📱 API 키 없이 내장된 실생활 1만 단어에서 즉시 학습' : genMode === 'ai' ? '🌐 Gemini AI를 통한 자유 주제 맞춤 단어 생성' : '✍️ 나만의 커스텀 단어 직접 등록'}
          </p>
        </div>

        <div style={{ display: 'flex', background: '#f1f3f5', padding: '0.35rem', borderRadius: '35px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)' }}>
          <button 
            onClick={() => setGenMode('offline')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0.6rem 1.1rem', border: 'none', borderRadius: '30px', cursor: 'pointer', transition: 'all 0.25s ease', fontWeight: '800', fontSize: '0.9rem',
              background: genMode === 'offline' ? 'var(--primary-color)' : 'transparent', color: genMode === 'offline' ? '#fff' : '#666',
              boxShadow: genMode === 'offline' ? '0 4px 10px rgba(246, 185, 59, 0.4)' : 'none'
            }}>
            <Database size={16} /> 1만단어 사전
          </button>
          <button 
            onClick={() => setGenMode('ai')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0.6rem 1.1rem', border: 'none', borderRadius: '30px', cursor: 'pointer', transition: 'all 0.25s ease', fontWeight: '800', fontSize: '0.9rem',
              background: genMode === 'ai' ? 'var(--primary-color)' : 'transparent', color: genMode === 'ai' ? '#fff' : '#666',
              boxShadow: genMode === 'ai' ? '0 4px 10px rgba(246, 185, 59, 0.4)' : 'none'
            }}>
            <Sparkles size={16} /> AI 자동생성
          </button>
          <button 
            onClick={() => setGenMode('manual')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0.6rem 1.1rem', border: 'none', borderRadius: '30px', cursor: 'pointer', transition: 'all 0.25s ease', fontWeight: '800', fontSize: '0.9rem',
              background: genMode === 'manual' ? 'var(--primary-color)' : 'transparent', color: genMode === 'manual' ? '#fff' : '#666',
              boxShadow: genMode === 'manual' ? '0 4px 10px rgba(246, 185, 59, 0.4)' : 'none'
            }}>
            <Plus size={16} /> 수동입력
          </button>
        </div>
      </div>

      {/* ===================================== */}
      {/* 1. 오프라인 1만 단어 사전 모드 뷰 */}
      {/* ===================================== */}
      {genMode === 'offline' && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* 사전 검색 바 */}
          <div style={{ background: '#fff', padding: '1.2rem 1.5rem', borderRadius: '25px', boxShadow: '0 8px 20px rgba(0,0,0,0.03)', border: '2px solid #e9ecef' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <Search size={22} color="#f6b93b" />
              <input 
                type="text" 
                placeholder="1만 단어 사전 실시간 검색 (단어, 한국어 뜻, 어근, 뉘앙스)..." 
                value={offlineSearchQuery}
                onChange={(e) => setOfflineSearchQuery(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.05rem', fontWeight: '600' }}
              />
              {offlineSearchQuery && (
                <button 
                  onClick={() => setOfflineSearchQuery('')} 
                  style={{ background: '#f1f3f5', border: 'none', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', color: '#888' }}>
                  초기화
                </button>
              )}
            </div>

            {/* 검색 결과 리스트 */}
            {searchResults.length > 0 && (
              <div style={{ marginTop: '1.2rem', borderTop: '1px solid #f1f3f5', paddingTop: '1rem', display: 'grid', gap: '0.8rem', maxHeight: '320px', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.85rem', color: '#888', fontWeight: '700' }}>검색 결과 {searchResults.length}건</div>
                {searchResults.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: '#fdfbf7', borderRadius: '15px', border: '1px solid #faeccb' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontWeight: '900', color: 'var(--nana-dark)', fontSize: '1.1rem' }}>{item.word}</span>
                        <span style={{ fontSize: '0.75rem', background: '#fff', padding: '2px 8px', borderRadius: '10px', border: '1px solid #ddd', color: '#666' }}>{item.pos}</span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#555', marginTop: '2px' }}>= {item.meaning}</div>
                    </div>
                    <button 
                      onClick={() => handleAddSingleOfflineWord(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-color)', color: '#fff', border: 'none', padding: '0.5rem 0.9rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 3px 0 #e67e22' }}>
                      <BookmarkPlus size={14} /> 단어장 담기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 대분류 탭 셀렉터 */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '30px', boxShadow: '0 8px 20px rgba(0,0,0,0.03)', border: '2px solid #feca57' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '900', color: 'var(--nana-dark)' }}>
              🎯 카테고리 선택
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem', marginBottom: '1.5rem' }}>
              {categories.map(cat => {
                const isSelected = selectedCatId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCatId(cat.id); setSelectedSubCatId(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem', borderRadius: '20px', cursor: 'pointer',
                      border: isSelected ? '3px solid #f6b93b' : '2px solid #f1f3f5',
                      background: isSelected ? '#fffdf5' : '#fff',
                      textAlign: 'left', transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 6px 15px rgba(246, 185, 59, 0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>{cat.icon}</span>
                    <div>
                      <div style={{ fontWeight: '900', color: isSelected ? 'var(--nana-dark)' : '#555', fontSize: '0.95rem' }}>{cat.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>{cat.subcategories.length}개 소분류</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 소분류 선택 */}
            {selectedCategory && (
              <div style={{ background: '#fdfbf7', padding: '1.2rem', borderRadius: '20px', border: '1px dashed #feca57', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#856404', marginBottom: '0.8rem' }}>
                  📌 {selectedCategory.name} 상세 분류:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    onClick={() => setSelectedSubCatId('')}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '15px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer',
                      background: selectedSubCatId === '' ? '#f6b93b' : '#fff',
                      color: selectedSubCatId === '' ? '#fff' : '#666',
                      border: selectedSubCatId === '' ? 'none' : '1px solid #ddd'
                    }}
                  >
                    ✨ 전체 소분류
                  </button>
                  {selectedCategory.subcategories.map(sub => {
                    const isSubSelected = selectedSubCatId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubCatId(sub.id)}
                        style={{
                          padding: '0.5rem 1rem', borderRadius: '15px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer',
                          background: isSubSelected ? '#f6b93b' : '#fff',
                          color: isSubSelected ? '#fff' : '#666',
                          border: isSubSelected ? 'none' : '1px solid #ddd'
                        }}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 단어 개수 선택 & 단어장 담기 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <span style={{ fontWeight: '800', color: '#444' }}>추출할 단어 개수:</span>
                <select 
                  value={offlineCount} 
                  onChange={(e) => setOfflineCount(Number(e.target.value))}
                  style={{ padding: '0.6rem 1rem', borderRadius: '12px', border: '2px solid #ddd', fontSize: '1rem', fontWeight: '800', outline: 'none' }}
                >
                  <option value={5}>5개</option>
                  <option value={10}>10개 (추천)</option>
                  <option value={15}>15개</option>
                  <option value={20}>20개</option>
                  <option value={30}>30개 (최대)</option>
                </select>
              </div>

              <button
                onClick={handleOfflineGenerate}
                disabled={offlineAdding}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '1rem 2rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '1.1rem', fontWeight: '900', cursor: 'pointer',
                  boxShadow: '0 6px 0 #e67e22', transition: 'transform 0.1s ease'
                }}
              >
                <CheckCircle2 size={20} /> {offlineAdding ? '단어장에 추가 중...' : '단어장에 바로 담기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================== */}
      {/* 2. 온라인 AI 맞춤 생성 모드 (Gemini 100% 보존) */}
      {/* ===================================== */}
      {genMode === 'ai' && (
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
      )}

      {/* ===================================== */}
      {/* 3. 수동 직접 입력 모드 */}
      {/* ===================================== */}
      {genMode === 'manual' && (
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

      {/* 로딩 프로그레스 오버레이 (온라인 AI 생성 시) */}
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

      {/* ======================================================= */}
      {/* 방금 추가/생성된 단어 상세 렌더링 (사진과 100% 동일한 카드) */}
      {/* ======================================================= */}
      {generatedWords.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '900', fontSize: '1.4rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🎉</span> 방금 추가된 단어 ({generatedWords.length}개)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {generatedWords.map(w => (
              <div key={w.id || w.word} style={{ background: '#fff', padding: '1.8rem', borderRadius: '28px', boxShadow: '0 8px 24px rgba(0,0,0,0.04)', border: '2px solid #feca57' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.6rem', fontWeight: '900' }}>{w.word}</h3>
                    <button onClick={() => playAudio(w.word.split(' ')[0], w.study_lang || studyLang)} style={{ background: '#f0f7ff', border: 'none', borderRadius: '50%', color: '#1976d2', padding: '10px', cursor: 'pointer' }}>
                        <Volume2 size={22} />
                    </button>
                  </div>
                  <span style={{ fontSize: '0.85rem', background: '#f5f5f5', padding: '4px 14px', borderRadius: '50px', color: '#666', fontWeight: '800' }}>{w.pos}</span>
                </div>
                
                <p style={{ fontSize: '1.3rem', color: 'var(--nana-dark)', fontWeight: '900', marginBottom: '1.5rem' }}>= {w.meaning}</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.2rem' }}>
                    {/* 스타 강사의 시크릿 노트 */}
                    <div style={{ background: '#fdfbf7', padding: '1.4rem', borderRadius: '20px', border: '2px solid #feca57', display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.9rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#feca57', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '900', alignSelf: 'flex-start', marginBottom: '4px' }}>
                          🔥 스타 강사의 시크릿 노트
                        </div>
                        {w.root && <div><b style={{ color: '#27ae60' }}>어근:</b> {w.root}</div>}
                        {w.grammar_rule && <div><b style={{ color: '#c0392b' }}>문법:</b> {w.grammar_rule}</div>}
                        {w.synonym && <div><b style={{ color: '#00b894' }}>동의어:</b> {w.synonym}</div>}
                        {w.antonym && <div><b style={{ color: '#d63031' }}>반의어:</b> {w.antonym}</div>}
                        {w.context && <div><b style={{ color: '#2980b9' }}>상황:</b> {w.context}</div>}
                        {w.caution && (
                          <div style={{ background: '#fff5f5', padding: '0.8rem', borderRadius: '12px', borderLeft: '4px solid #ff7675' }}>
                            <b style={{ color: '#d63031' }}>주의 (학습 주의):</b> {w.caution}
                          </div>
                        )}
                        {w.related && (
                          <div style={{ background: '#f0faff', padding: '0.8rem', borderRadius: '12px', borderLeft: '4px solid #4facfe' }}>
                            <b style={{ color: '#0984e3' }}>💡 강사 비법 (공부 팁):</b> {w.related}
                          </div>
                        )}
                    </div>

                    {/* 격식체 / 구어체 예문 영역 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {w.example_formal && (
                            <div style={{ background: '#fdfcfe', padding: '1.2rem', borderRadius: '18px', border: '1px solid #eee' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: '#2c3e50', fontWeight: '900', minWidth: '65px' }}>{t('label_formal')}</span>
                                    <div style={{ flex: 1, fontSize: '0.95rem', color: '#333', lineHeight: '1.5' }}>
                                        <InteractiveSentence sentence={w.example_formal} breakdown={w.word_breakdown} />
                                    </div>
                                    <button onClick={() => playAudio(w.example_formal, w.study_lang || studyLang)} style={{ color: '#777', border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <Volume2 size={18} />
                                    </button>
                                </div>
                                <p style={{ margin: '0 0 0 4.5rem', fontSize: '0.85rem', color: '#888', fontWeight: '600' }}>{w.example_formal_kr}</p>
                            </div>
                        )}
                        {w.example_casual && (
                            <div style={{ background: '#fff9f0', padding: '1.2rem', borderRadius: '18px', border: '1px solid #fff3e0' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{ color: '#d35400', fontWeight: '900', minWidth: '65px' }}>{t('label_casual')}</span>
                                    <div style={{ flex: 1, fontSize: '0.95rem', color: '#333', lineHeight: '1.5' }}>
                                        <InteractiveSentence sentence={w.example_casual} breakdown={w.word_breakdown} />
                                    </div>
                                    <button onClick={() => playAudio(w.example_casual, w.study_lang || studyLang)} style={{ color: '#777', border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <Volume2 size={18} />
                                    </button>
                                </div>
                                <p style={{ margin: '0 0 0 4.5rem', fontSize: '0.85rem', color: '#888', fontWeight: '600' }}>{w.example_casual_kr}</p>
                            </div>
                        )}
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
