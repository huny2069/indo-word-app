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
  const { isIndoMode, t } = useLanguage();
  const { user } = useAuth();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [generatedWords, setGeneratedWords] = useState([]); // 방금 생성된 단어만 저장
  
  // 신규 상태: 생성 모드 ('ai' 또는 'manual')
  const [genMode, setGenMode] = useState('ai');
  
  // 신규 상태: 수동 입력용 단어 데이터
  const [manualWord, setManualWord] = useState({
    word: '', meaning: '', pos: '명사', topic: '', 
    root: '', grammar_rule: '', context: '', caution: '', related: '',
    example_formal: '', example_formal_kr: '',
    example_casual: '', example_casual_kr: '',
    word_breakdown: [] // 예문 단어 분해 정보 [{word: '', meaning: ''}]
  });

  const addBreakdown = () => {
    setManualWord(prev => ({
        ...prev,
        word_breakdown: [...prev.word_breakdown, { word: '', meaning: '' }]
    }));
  };

  const removeBreakdown = (index) => {
    setManualWord(prev => ({
        ...prev,
        word_breakdown: prev.word_breakdown.filter((_, i) => i !== index)
    }));
  };

  const updateBreakdown = (index, field, value) => {
    const newList = [...manualWord.word_breakdown];
    newList[index][field] = value;
    setManualWord(prev => ({ ...prev, word_breakdown: newList }));
  };

  const handleGenerate = async () => {
    const apiKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY;
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
    
    try {
      const savedModel = localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash-latest';
      
      // 1. 로컬 단어장 불러오기 (중복 방지용)
      let localWords = await getWords();
      let existingWordStrings = localWords.map(w => w.word.toLowerCase());
      
      let finalAddedWords = [];

      // 2. [V12.0] 공유 캐시(Supabase) 조회 시도
      try {
        const sharedWords = await fetchSharedWords(topic.trim(), isIndoMode);
        // 이미 내 단어장에 있는 것은 제외
        const uniqueShared = sharedWords.filter(sw => !existingWordStrings.includes(sw.word.toLowerCase()));
        
        // 필요한 개수만큼만 캐시에서 채움
        const fromCache = uniqueShared.slice(0, count);
        for (const w of fromCache) {
          const { id, created_at, ...cleanWord } = w; // ID 등 Supabase 필드 제거
          const newId = await addWord(cleanWord);
          finalAddedWords.push({ ...cleanWord, id: newId });
        }
        
        console.log(`Shared Cache found: ${fromCache.length} words from Supabase`);

        // [v13.6] 캐시 데이터 활용 시에도 로그 기록 (토큰/비용은 0)
        if (fromCache.length > 0) {
            logUsage({
                user_id: localStorage.getItem('user_device_id') || 'anonymous',
                email: user?.email,
                tokens_used: 0,
                cost_usd: 0,
                topic: `[CACHE] ${topic.trim()}`
            });
        }
      } catch (cacheErr) {
        console.warn("Shared Cache Fetch failed, proceeding with full AI generation.", cacheErr);
      }

      // 3. 모자란 개수만큼 AI(Gemini) 생성
      const remainingCount = count - finalAddedWords.length;
      
      if (remainingCount > 0) {
        let currentTry = 0;
        const maxTries = 3;

        while (finalAddedWords.length < count && currentTry < maxTries) {
          currentTry++;
          const currentRemaining = count - finalAddedWords.length;
          const excludeList = [...existingWordStrings, ...finalAddedWords.map(w => w.word.toLowerCase())];
          
          try {
              const result = await generateWords(topic, currentRemaining, apiKey, savedModel, excludeList, isIndoMode, user?.email);
              const newAiResults = result.filter(w => {
                  const isDuplicateInLocal = existingWordStrings.includes(w.word.toLowerCase());
                  const isDuplicateInBatch = finalAddedWords.some(fw => fw.word.toLowerCase() === w.word.toLowerCase());
                  return !isDuplicateInLocal && !isDuplicateInBatch;
              });

              for (const w of newAiResults) {
                  w.topic = topic;
                  const id = await addWord(w);
                  const wordWithId = { ...w, id };
                  finalAddedWords.push(wordWithId);
                  
                  // [V12.0] 새로 생성된 건강한 단어는 Supabase에도 공유
                  saveSharedWords([{ ...w, is_indo_mode: isIndoMode }]);
                  
                  if (finalAddedWords.length >= count) break;
              }
              if (newAiResults.length === 0) break;
          } catch (apiError) {
              if (currentTry >= maxTries) throw apiError;
              await new Promise(res => setTimeout(res, 1000));
          }
        }
      }
      
      setGeneratedWords(finalAddedWords);
      
      if (finalAddedWords.length === 0) {
        alert(t('msg_ai_gen_fail'));
      } else {
        alert(t('msg_cart_added', { count: finalAddedWords.length }));
      }
    } catch (error) {
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
        const id = await addWord(manualWord);
        const newWordWithId = { ...manualWord, id };
        setGeneratedWords([newWordWithId, ...generatedWords]);
        
        // 입력 폼 초기화 (주제는 유지하여 연속 입력 편의성 제공)
        setManualWord(prev => ({
            ...prev,
            word: '', meaning: '', root: '', grammar_rule: '',
            context: '', caution: '', related: '',
            example_formal: '', example_formal_kr: '',
            example_casual: '', example_casual_kr: '',
            word_breakdown: []
        }));
        
        alert(t('msg_save_done'));
    } catch (err) {
        alert(t('msg_save_error') + ": " + err.message);
    }
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
        <div style={{ background: '#fff', padding: '1.8rem', borderRadius: '20px', boxShadow: '0 8px 16px rgba(0,0,0,0.05)', border: '2px solid #feca57' }}>
            {/* Usage Limit Mockup (Commercialization) */}
            <div style={{ background: '#fff9e7', padding: '1rem', borderRadius: '15px', marginBottom: '1.5rem', border: '1px dashed #feca57' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#c2410c' }}>🔥 일일 AI 생성 한도 (무료 플랜)</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#c2410c' }}>12 / 20</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#fff', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '60%', height: '100%', background: '#feca57' }}></div>
                </div>
                <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.75rem', color: '#999' }}>Tip: Pro 플랜으로 업그레이드하고 무제한으로 생성하세요! 🚀</p>
            </div>

            <p style={{ color: '#666', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🤖</span> {t('gen_ai_desc')}
            </p>
            
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('gen_topic_label')}</label>
            <input 
            type="text" 
            placeholder={t('gen_topic_placeholder')}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ width: '100%', padding: '0.9rem', border: '2px solid #eee', borderRadius: '12px', marginBottom: '1rem', outline: 'none' }}
            />

            <label style={{ display: 'block', margin: '1rem 0 0.5rem', fontWeight: 'bold' }}>{t('gen_count_label')}</label>
            <input 
            type="number" 
            min="1" max="30"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{ width: '100%', padding: '0.9rem', border: '2px solid #eee', borderRadius: '12px', outline: 'none' }}
            />

            <button 
            onClick={handleGenerate} 
            disabled={loading}
            style={{ width: '100%', padding: '1.1rem', marginTop: '1.5rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '1.1rem', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '900', boxShadow: '0 4px 0 #e67e22' }}>
            {loading ? t('gen_btn_loading') : t('gen_btn_start')}
            </button>
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '2rem', borderRadius: '20px', boxShadow: '0 8px 16px rgba(0,0,0,0.05)', border: '2px solid #55efc4' }}>
            <p style={{ color: '#666', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>✍️</span> {t('gen_manual_desc')}
            </p>
            
            <form onSubmit={handleManualSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                    <div>
                        <label style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block', color: 'var(--nana-dark)' }}>{t('gen_manual_word')}*</label>
                        <input type="text" value={manualWord.word} onChange={e => setManualWord({...manualWord, word: e.target.value})} placeholder={t('gen_manual_ph_word')} style={{ width: '100%', padding: '0.8rem', border: '2px solid #eee', borderRadius: '10px', outline: 'none' }} required />
                    </div>
                    <div>
                        <label style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block', color: 'var(--nana-dark)' }}>{t('gen_manual_meaning')}*</label>
                        <input type="text" value={manualWord.meaning} onChange={e => setManualWord({...manualWord, meaning: e.target.value})} placeholder={t('gen_manual_ph_meaning')} style={{ width: '100%', padding: '0.8rem', border: '2px solid #eee', borderRadius: '10px', outline: 'none' }} required />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                    <div>
                        <label style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block', color: 'var(--nana-dark)' }}>{t('gen_manual_pos')}</label>
                        <select value={manualWord.pos} onChange={e => setManualWord({...manualWord, pos: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '2px solid #eee', borderRadius: '10px', outline: 'none' }}>
                            <option value="명사">{t('pos_noun')}</option>
                            <option value="동사">{t('pos_verb')}</option>
                            <option value="형용사">{t('pos_adj')}</option>
                            <option value="부사">{t('pos_adv')}</option>
                            <option value="대명사">{t('pos_pronoun')}</option>
                            <option value="수사">{t('pos_numeral')}</option>
                            <option value="전치사">{t('pos_preposition')}</option>
                            <option value="접속사">{t('pos_conjunction')}</option>
                            <option value="감탄사">{t('pos_interjection')}</option>
                            <option value="한정사">{t('pos_determiner')}</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block', color: 'var(--nana-dark)' }}>{t('gen_manual_topic')}</label>
                        <input type="text" value={manualWord.topic} onChange={e => setManualWord({...manualWord, topic: e.target.value})} placeholder={t('gen_manual_ph_topic')} style={{ width: '100%', padding: '0.8rem', border: '2px solid #eee', borderRadius: '10px', outline: 'none' }} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', background: '#f5f7f9', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: '#2c3e50', fontSize: '0.9rem' }}>{t('gen_manual_formal')}</strong></div>
                    <textarea value={manualWord.example_formal} onChange={e => setManualWord({...manualWord, example_formal: e.target.value})} placeholder={t('gen_manual_ph_ex_target')} style={{ width: '100%', padding: '0.7rem', border: '1px solid #ddd', borderRadius: '8px', minHeight: '60px', outline: 'none' }} />
                    <textarea value={manualWord.example_formal_kr} onChange={e => setManualWord({...manualWord, example_formal_kr: e.target.value})} placeholder={t('gen_manual_ph_ex_kr')} style={{ width: '100%', padding: '0.7rem', border: '1px solid #ddd', borderRadius: '8px', minHeight: '60px', outline: 'none' }} />
                    
                    <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}><strong style={{ color: '#d35400', fontSize: '0.9rem' }}>{t('gen_manual_casual')}</strong></div>
                    <textarea value={manualWord.example_casual} onChange={e => setManualWord({...manualWord, example_casual: e.target.value})} placeholder={t('gen_manual_ph_ex_target')} style={{ width: '100%', padding: '0.7rem', border: '1px solid #ddd', borderRadius: '8px', minHeight: '60px', outline: 'none' }} />
                    <textarea value={manualWord.example_casual_kr} onChange={e => setManualWord({...manualWord, example_casual_kr: e.target.value})} placeholder={t('gen_manual_ph_ex_kr')} style={{ width: '100%', padding: '0.7rem', border: '1px solid #ddd', borderRadius: '8px', minHeight: '60px', outline: 'none' }} />
                </div>

                <div style={{ background: '#eef2f7', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                        <strong style={{ color: '#2980b9', fontSize: '0.9rem' }}>{t('gen_manual_breakdown')}</strong>
                        <button type="button" onClick={addBreakdown} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ {t('gen_manual_breakdown_add')}</button>
                    </div>
                    {manualWord.word_breakdown.length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center', margin: '0.5rem 0' }}>{t('gen_manual_breakdown_tip')}</p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {manualWord.word_breakdown.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input 
                                    type="text" 
                                    placeholder={t('gen_manual_ph_br_word')} 
                                    value={item.word} 
                                    onChange={e => updateBreakdown(idx, 'word', e.target.value)}
                                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #eee', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} 
                                />
                                <input 
                                    type="text" 
                                    placeholder={t('gen_manual_ph_br_meaning')} 
                                    value={item.meaning} 
                                    onChange={e => updateBreakdown(idx, 'meaning', e.target.value)}
                                    style={{ flex: 1.5, padding: '0.5rem', border: '1px solid #eee', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }} 
                                />
                                <button type="button" onClick={() => removeBreakdown(idx)} style={{ background: '#ff7675', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '0.5rem 0.8rem', fontWeight: 'bold' }}>X</button>
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" style={{ width: '100%', padding: '1.1rem', background: '#00b894', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 0 #009677', marginTop: '1rem' }}>
                    {t('gen_manual_add_btn')}
                </button>
            </form>
        </div>
      )}

      {generatedWords.length > 0 && (
        <>
          <h3 style={{ margin: '2rem 0 1rem 0' }}>{t('gen_result_title')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {generatedWords.map(w => (
              <div key={w.id || w.word} style={{ background: '#fff', padding: '1.2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.2rem' }}>
                      {w.word}
                    </h3>
                    <button onClick={() => playAudio(w.word)} className="icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2', padding: '0.2rem' }}>
                        <Volume2 size={20} />
                    </button>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>: {w.meaning}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', background: '#eee', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#555' }}>{w.pos}</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {w.example_formal && (
                            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem', marginBottom: '0.4rem' }}>
                                    <span style={{ color: '#2c3e50', fontWeight: 'bold' }}>🌟 {t('label_formal')}:</span>
                                    <div style={{ flex: 1, fontSize: '0.95rem', color: '#333' }}>
                                        <InteractiveSentence 
                                            sentence={w.example_formal} 
                                            wordBreakdown={w.word_breakdown} 
                                        />
                                    </div>
                                    <button onClick={() => playAudio(w.example_formal)} className="icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2', padding: '0' }}>
                                        <Volume2 size={18} />
                                    </button>
                                </div>
                                <p style={{ margin: '0 0 0 4.5rem', fontSize: '0.85rem', color: '#888' }}>
                                  {w.example_formal_kr}
                                </p>
                            </div>
                        )}
                        {w.example_casual && (
                            <div style={{ background: '#fff3e0', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem', marginBottom: '0.4rem' }}>
                                    <span style={{ color: '#d35400', fontWeight: 'bold' }}>🗣️ {t('label_casual')}:</span>
                                    <div style={{ flex: 1, fontSize: '0.95rem', color: '#333' }}>
                                        <InteractiveSentence 
                                            sentence={w.example_casual} 
                                            wordBreakdown={w.word_breakdown} 
                                        />
                                    </div>
                                    <button onClick={() => playAudio(w.example_casual)} className="icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d35400', padding: '0' }}>
                                        <Volume2 size={18} />
                                    </button>
                                </div>
                                <p style={{ margin: '0 0 0 4.5rem', fontSize: '0.85rem', color: '#888' }}>
                                  {w.example_casual_kr}
                                </p>
                            </div>
                        )}
                        {w.example_id && !w.example_formal && !w.example_casual && (
                            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem', marginBottom: '0.4rem' }}>
                                    <span style={{ color: '#666', fontWeight: 'bold' }}>💬 일반예문:</span>
                                    <div style={{ flex: 1, fontSize: '0.95rem', color: '#333' }}>
                                        <InteractiveSentence sentence={w.example_id} wordBreakdown={w.word_breakdown} />
                                    </div>
                                    <button onClick={() => playAudio(w.example_id)} className="icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2', padding: '0' }}>
                                        <Volume2 size={18} />
                                    </button>
                                </div>
                                <p style={{ margin: '0 0 0 4.5rem', fontSize: '0.85rem', color: '#888' }}>{w.example_kr}</p>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                        {w.root && <div><b style={{ display: 'inline-block', width: '100px', whiteSpace: 'nowrap', color: '#666' }}>{t('label_root')}:</b> {w.root}</div>}
                        {w.grammar_rule && <div><b style={{ display: 'inline-block', width: '100px', whiteSpace: 'nowrap', color: '#8e44ad' }}>{t('label_grammar')}:</b> {w.grammar_rule}</div>}
                        {w.context && <div><b style={{ display: 'inline-block', width: '100px', whiteSpace: 'nowrap', color: '#2e7d32' }}>{t('label_context')}:</b> {w.context}</div>}
                        {w.caution && <div><b style={{ display: 'inline-block', width: '100px', whiteSpace: 'nowrap', color: '#c62828' }}>{t('label_caution')}:</b> {w.caution}</div>}
                        {w.related && <div><b style={{ display: 'inline-block', width: '100px', whiteSpace: 'nowrap', color: '#1565c0' }}>{t('label_tip')}:</b> {w.related}</div>}
                    </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default WordGenerate;
