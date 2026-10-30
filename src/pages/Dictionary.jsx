import React, { useState, useMemo, useEffect } from 'react';
import { addWord, updateWord, getWords } from '../db/database';
import { playAudio } from '../api/ttsApi';
import { regenerateWordData } from '../api/geminiApi';
import { convertToCSV } from '../api/csvApi';
import { 
  BookOpen, Search, Volume2, BookmarkPlus, CheckSquare, Square, 
  ChevronDown, ChevronUp, Sparkles, CheckCircle2, Layers, Loader2, ArrowRight, RotateCcw, FileDown
} from 'lucide-react';
import InteractiveSentence from '../components/InteractiveSentence';
import { 
  confirmActionWithTokenEstimate, 
  alertActualTokenCost, 
  recordTokenUsage 
} from '../utils/tokenCostTracker';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { 
  getOfflineCategories, 
  extractOfflineWords,
  ALL_OFFLINE_WORDS 
} from '../data/offlineDatabase';
import {
  getCategoryDisplayName,
  getSubcategoryDisplayName
} from '../data/categories';

const Dictionary = () => {
  const { userLang, studyLang, t } = useLanguage();
  const navigate = useNavigate();

  // 단어 정규화 헬퍼 (발음기호 [[...]], 대소문자, 공백 제거)
  const normalizeWord = (str) => (str || '').split('[[')[0].trim().toLowerCase();

  // 1만 단어 사전의 AI 재생성 오버라이드 맵 (localStorage 영구 보존)
  const [dictOverrides, setDictOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('inko_dict_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('오버라이드 로드 실패:', e);
      return {};
    }
  });

  // 오프라인 사전 카테고리 데이터
  const categories = useMemo(() => getOfflineCategories(), []);
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || 'discourse');
  const selectedCategory = useMemo(() => categories.find(c => c.id === selectedCatId) || categories[0], [categories, selectedCatId]);
  const [selectedSubCatId, setSelectedSubCatId] = useState('');
  const [offlineCount, setOfflineCount] = useState(10);
  const [offlineSearchQuery, setOfflineSearchQuery] = useState('');
  const [offlineAdding, setOfflineAdding] = useState(false);

  // 펼쳐진 단어 ID (상세 아코디언)
  const [expandedOfflineId, setExpandedOfflineId] = useState(null);

  // 다중 선택 체크박스 State
  const [selectedOfflineIds, setSelectedOfflineIds] = useState(new Set());

  // 로컬 단어장 ID/단어 셋 (이미 추가된 단어 표시용)
  const [existingWordMap, setExistingWordMap] = useState(new Map());

  // AI 재생성 State
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenStatus, setRegenStatus] = useState({ current: 0, total: 0, currentWord: '' });

  // 로컬 단어장 목록 로드
  const refreshLocalWords = async () => {
    try {
      const localWords = await getWords();
      const map = new Map();
      localWords.forEach(w => {
        map.set(normalizeWord(w.word), w);
      });
      setExistingWordMap(map);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshLocalWords();

    const handleOverridesUpdate = () => {
      try {
        const saved = localStorage.getItem('inko_dict_overrides');
        if (saved) {
          setDictOverrides(JSON.parse(saved));
        }
      } catch (e) {
        console.error('오버라이드 리로드 실패:', e);
      }
    };

    window.addEventListener('dict_overrides_updated', handleOverridesUpdate);
    window.addEventListener('storage', handleOverridesUpdate);
    return () => {
      window.removeEventListener('dict_overrides_updated', handleOverridesUpdate);
      window.removeEventListener('storage', handleOverridesUpdate);
    };
  }, []);

  // AI 재생성 오버라이드 및 CSV 신규 단어가 실시간으로 반영된 통합 단어 풀
  const effectiveWords = useMemo(() => {
    // 1. 기존 ALL_OFFLINE_WORDS에 오버라이드 매핑
    const mapped = ALL_OFFLINE_WORDS.map(item => {
      const key = normalizeWord(item.word);
      const override = dictOverrides[key];
      if (override) {
        return {
          ...item,
          ...override,
          isAiRegenerated: override.isAiRegenerated !== false,
          regeneratedAt: override.regeneratedAt
        };
      }
      return item;
    });

    // 2. ALL_OFFLINE_WORDS에 없는 순수 신규 추가 단어들(CSV 가져오기 단어 등)도 포함!
    const existingKeys = new Set(ALL_OFFLINE_WORDS.map(item => normalizeWord(item.word)));
    const extraWords = Object.values(dictOverrides).filter(w => {
      if (!w || !w.word) return false;
      return !existingKeys.has(normalizeWord(w.word));
    }).map((w, idx) => ({
      ...w,
      id: w.id || `custom_dict_${idx}_${normalizeWord(w.word)}`,
      category_id: w.category_id || selectedCatId || 'discourse',
      isCustomAdded: true
    }));

    return [...mapped, ...extraWords];
  }, [dictOverrides, selectedCatId]);

  // 선택된 카테고리/소분류에 해당하는 전체 오프라인 단어 목록 (오버라이드 적용)
  const currentCategoryWords = useMemo(() => {
    return effectiveWords.filter(item => {
      if (selectedCatId && item.category_id !== selectedCatId) return false;
      if (selectedSubCatId && item.subcategory_id !== selectedSubCatId) return false;
      return true;
    });
  }, [effectiveWords, selectedCatId, selectedSubCatId]);

  // 실시간 검색 결과 (오버라이드 적용)
  const searchResults = useMemo(() => {
    const cleanKeyword = offlineSearchQuery.trim().toLowerCase();
    if (!cleanKeyword) return [];

    return effectiveWords.filter(item => {
      const matchWord = item.word && item.word.toLowerCase().includes(cleanKeyword);
      const matchMeaning = item.meaning && item.meaning.toLowerCase().includes(cleanKeyword);
      const matchRoot = item.root && item.root.toLowerCase().includes(cleanKeyword);
      const matchContext = item.context && item.context.toLowerCase().includes(cleanKeyword);
      return matchWord || matchMeaning || matchRoot || matchContext;
    });
  }, [effectiveWords, offlineSearchQuery]);

  // 단어 단일 추가
  const handleAddSingleOfflineWord = async (item) => {
    try {
      const cleanKey = normalizeWord(item.word);
      if (existingWordMap.has(cleanKey)) {
        alert(t('dict_msg_already_exists', { word: item.word }));
        return;
      }

      const wordData = {
        ...item,
        user_lang: userLang,
        study_lang: studyLang,
        topic: getCategoryDisplayName(selectedCategory, userLang) || selectedCategory?.name || 'Offline Dictionary'
      };
      await addWord(wordData);
      await refreshLocalWords();
      alert(t('dict_msg_added_single', { word: item.word }));
    } catch (err) {
      alert((userLang === 'id' ? 'Gagal menambahkan: ' : userLang === 'en' ? 'Failed to add: ' : '추가 실패: ') + err.message);
    }
  };

  // 선택한 단어들 일괄 담기
  const handleAddSelectedOfflineWords = async () => {
    if (selectedOfflineIds.size === 0) {
      alert(t('dict_msg_check_first'));
      return;
    }

    try {
      const targetItems = currentCategoryWords.filter(w => selectedOfflineIds.has(w.id));
      let addedCount = 0;

      for (const item of targetItems) {
        const cleanKeyword = normalizeWord(item.word);
        if (existingWordMap.has(cleanKeyword)) continue;

        const wordData = {
          ...item,
          user_lang: userLang,
          study_lang: studyLang,
          topic: getCategoryDisplayName(selectedCategory, userLang) || selectedCategory?.name || 'Offline Dictionary'
        };
        await addWord(wordData);
        addedCount++;
      }

      await refreshLocalWords();
      setSelectedOfflineIds(new Set());
      alert(t('dict_msg_added_multi', { count: addedCount }));
    } catch (err) {
      alert((userLang === 'id' ? 'Gagal menambahkan: ' : userLang === 'en' ? 'Failed to add: ' : '추가 실패: ') + err.message);
    }
  };

  // 현재 카테고리 전체 단어 CSV 백업 다운로드
  const handleExportCurrentCategoryCSV = () => {
    try {
      if (!currentCategoryWords || currentCategoryWords.length === 0) {
        alert(t('dict_msg_no_export_words'));
        return;
      }
      const catName = getCategoryDisplayName(selectedCategory, userLang) || selectedCategory?.name || 'Category';
      const csvContent = convertToCSV(currentCategoryWords);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const safeCatId = selectedCategory?.id || 'category';
      link.setAttribute('download', `Inko_10K_${safeCatId}_Export_${new Date().toISOString().slice(0,10)}.csv`);
      link.click();
      alert(t('dict_msg_csv_exported', { name: catName, count: currentCategoryWords.length }));
    } catch (err) {
      alert('CSV Export Error: ' + err.message);
    }
  };

  // 랜덤 일괄 추출 담기
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
        alert(t('dict_msg_all_extracted'));
        setOfflineAdding(false);
        return;
      }

      for (const item of extracted) {
        // 혹시 오버라이드가 있다면 오버라이드 적용
        const key = normalizeWord(item.word);
        const dataToSave = dictOverrides[key] ? { ...item, ...dictOverrides[key] } : item;

        const wordData = {
          ...dataToSave,
          user_lang: userLang,
          study_lang: studyLang,
          topic: getCategoryDisplayName(selectedCategory, userLang) + (selectedSubCatId ? ` > ${selectedSubCatId}` : '')
        };
        await addWord(wordData);
      }

      await refreshLocalWords();
      alert(t('dict_msg_extracted_done', { count: extracted.length }));
    } catch (err) {
      console.error('오프라인 단어 추가 오류:', err);
      alert((userLang === 'id' ? 'Terjadi kesalahan saat menambahkan kata: ' : userLang === 'en' ? 'Error adding words: ' : '단어 추가 중 오류가 발생했습니다: ') + err.message);
    } finally {
      setOfflineAdding(false);
    }
  };

  // 전체 선택 토글
  const toggleSelectAllCategoryWords = () => {
    if (selectedOfflineIds.size === currentCategoryWords.length) {
      setSelectedOfflineIds(new Set());
    } else {
      setSelectedOfflineIds(new Set(currentCategoryWords.map(w => w.id)));
    }
  };

  // 단일 선택 토글
  const toggleSelectOfflineWord = (id) => {
    setSelectedOfflineIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ==========================================
  // [1만 단어 사전 내 AI 정밀 재생성 기능]
  // ==========================================
  const handleRegenerateSelected = async () => {
    if (selectedOfflineIds.size === 0 || isRegenerating) return;
    const apiKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      alert(t('msg_ai_key_missing'));
      navigate('/settings');
      return;
    }

    const targetWords = currentCategoryWords.filter(w => selectedOfflineIds.has(w.id));
    if (targetWords.length === 0) return;

    const modelName = localStorage.getItem('selectedGeminiModel') || 'gemini-3.8-flash';
    if (!confirmActionWithTokenEstimate('regenerate', modelName, { count: targetWords.length })) {
      return;
    }

    setIsRegenerating(true);
    let successCount = 0;
    let lastRegenUsage = null;
    const newOverrides = { ...dictOverrides };

    try {
      for (let i = 0; i < targetWords.length; i++) {
        const item = targetWords[i];
        setRegenStatus({ current: i + 1, total: targetWords.length, currentWord: item.word });

        try {
          const regenerated = await regenerateWordData(
            item, 
            apiKey, 
            modelName, 
            userLang, 
            item.study_lang || studyLang || 'id'
          );

          if (regenerated && regenerated._usageMetadata) {
            recordTokenUsage('regenerate', regenerated._usageMetadata, regenerated._modelUsed || modelName);
            lastRegenUsage = regenerated._usageMetadata;
          }

          const cleanKey = normalizeWord(item.word);
          newOverrides[cleanKey] = {
            ...regenerated,
            isAiRegenerated: true,
            regeneratedAt: new Date().toISOString()
          };

          // 로컬 단어장(IndexedDB)에도 동기화
          const existing = existingWordMap.get(cleanKey);
          if (existing && existing.id) {
            await updateWord({ ...regenerated, id: existing.id });
          } else {
            await addWord({ ...regenerated, topic: selectedCategory?.name || '1만단어 사전' });
          }
          successCount++;
        } catch (wordErr) {
          console.error(`사전 단어 ${item.word} 재생성 실패:`, wordErr);
        }
      }

      // 화면에 즉각 반영하기 위해 State 및 localStorage 업데이트
      setDictOverrides(newOverrides);
      localStorage.setItem('inko_dict_overrides', JSON.stringify(newOverrides));

      await refreshLocalWords();
      setSelectedOfflineIds(new Set());
      if (lastRegenUsage) {
        alertActualTokenCost('regenerate', lastRegenUsage, modelName);
      } else {
        alert(t('msg_regenerate_done', { count: successCount }));
      }
    } catch (err) {
      alert(t('msg_regenerate_error') + ' ' + (err.message || ''));
    } finally {
      setIsRegenerating(false);
      setRegenStatus({ current: 0, total: 0, currentWord: '' });
    }
  };

  // 단일 단어 AI 재생성
  const handleRegenerateSingle = async (item, e) => {
    if (e) e.stopPropagation();
    if (isRegenerating) return;
    const apiKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      alert(t('msg_ai_key_missing'));
      navigate('/settings');
      return;
    }

    const modelName = localStorage.getItem('selectedGeminiModel') || 'gemini-3.8-flash';
    if (!confirmActionWithTokenEstimate('regenerate', modelName, { count: 1 })) {
      return;
    }

    setIsRegenerating(true);
    setRegenStatus({ current: 1, total: 1, currentWord: item.word });

    try {
      const regenerated = await regenerateWordData(
        item, 
        apiKey, 
        modelName, 
        userLang, 
        item.study_lang || studyLang || 'id'
      );

      if (regenerated && regenerated._usageMetadata) {
        recordTokenUsage('regenerate', regenerated._usageMetadata, regenerated._modelUsed || modelName);
      }

      const cleanKey = normalizeWord(item.word);
      
      // 1. 사전 화면에 즉시 표시되도록 오버라이드 State와 localStorage 갱신
      const newOverrides = {
        ...dictOverrides,
        [cleanKey]: {
          ...regenerated,
          isAiRegenerated: true,
          regeneratedAt: new Date().toISOString()
        }
      };
      setDictOverrides(newOverrides);
      localStorage.setItem('inko_dict_overrides', JSON.stringify(newOverrides));

      // 2. 단어장 DB(IndexedDB)에도 동시 저장/업데이트
      const existing = existingWordMap.get(cleanKey);
      if (existing && existing.id) {
        await updateWord({ ...regenerated, id: existing.id });
      } else {
        await addWord({ ...regenerated, topic: selectedCategory?.name || '1만단어 사전' });
      }

      await refreshLocalWords();

      // 3. 사용자가 방금 새로 만들어진 어근, 문법, 예문 등을 즉시 볼 수 있게 카드 펼침
      setExpandedOfflineId(item.id);

      if (regenerated && regenerated._usageMetadata) {
        alertActualTokenCost('regenerate', regenerated._usageMetadata, regenerated._modelUsed || modelName);
      } else {
        alert(t('msg_regenerate_single_done', { word: item.word }));
      }
    } catch (err) {
      console.error(err);
      alert(t('msg_regenerate_error') + ' ' + (err.message || ''));
    } finally {
      setIsRegenerating(false);
      setRegenStatus({ current: 0, total: 0, currentWord: '' });
    }
  };

  // 재생성된 단어를 원래 사전 데이터로 되돌리기
  const handleResetOverride = (item, e) => {
    if (e) e.stopPropagation();
    const cleanKey = normalizeWord(item.word);
    if (!dictOverrides[cleanKey]) return;

    if (window.confirm(t('dict_msg_reset_confirm', { word: item.word }))) {
      const newOverrides = { ...dictOverrides };
      delete newOverrides[cleanKey];
      setDictOverrides(newOverrides);
      localStorage.setItem('inko_dict_overrides', JSON.stringify(newOverrides));
      alert(t('dict_msg_reset_done', { word: item.word }));
    }
  };

  return (
    <div className="page" style={{ paddingBottom: '3rem' }}>
      {/* 헤더 타이틀 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--nana-dark)', fontWeight: '900', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BookOpen size={28} color="#f6b93b" /> {t('dict_title')}
          </h2>
          <p style={{ margin: '0.3rem 0 0', color: '#666', fontSize: '0.95rem', fontWeight: '600' }}>
            {t('dict_subtitle')}
          </p>
        </div>

        <button 
          onClick={() => navigate('/words')}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '6px', 
            background: '#fff', border: '2px solid #eee', padding: '0.6rem 1.2rem', 
            borderRadius: '25px', fontWeight: '800', color: '#555', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)' 
          }}
        >
          {t('dict_goto_my_words')} <ArrowRight size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* 사전 실시간 검색 바 */}
        <div style={{ background: '#fff', padding: '1.2rem 1.5rem', borderRadius: '25px', boxShadow: '0 8px 20px rgba(0,0,0,0.03)', border: '2px solid #e9ecef' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <Search size={22} color="#f6b93b" />
            <input 
              type="text" 
              placeholder={t('dict_search_ph')} 
              value={offlineSearchQuery}
              onChange={(e) => setOfflineSearchQuery(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.05rem', fontWeight: '600' }}
            />
            {offlineSearchQuery && (
              <button 
                onClick={() => setOfflineSearchQuery('')} 
                style={{ background: '#f1f3f5', border: 'none', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', color: '#888' }}>
                {t('dict_search_reset')}
              </button>
            )}
          </div>

          {/* 검색 결과 리스트 */}
          {searchResults.length > 0 && (
            <div style={{ marginTop: '1.2rem', borderTop: '1px solid #f1f3f5', paddingTop: '1rem', display: 'grid', gap: '0.8rem', maxHeight: '360px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.85rem', color: '#888', fontWeight: '700' }}>{t('dict_search_count', { count: searchResults.length })}</div>
              {searchResults.map(item => {
                const cleanKey = normalizeWord(item.word);
                const isAdded = existingWordMap.has(cleanKey);
                return (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: item.isAiRegenerated ? '#faf5ff' : '#fdfbf7', borderRadius: '15px', border: item.isAiRegenerated ? '1.5px solid #d8b4fe' : '1px solid #faeccb' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '900', color: 'var(--nana-dark)', fontSize: '1.1rem' }}>{item.word}</span>
                        <span style={{ fontSize: '0.75rem', background: '#fff', padding: '2px 8px', borderRadius: '10px', border: '1px solid #ddd', color: '#666' }}>{item.pos}</span>
                        {item.isAiRegenerated && (
                          <span style={{ fontSize: '0.75rem', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: '900' }}>
                            {t('dict_badge_regenerated')}
                          </span>
                        )}
                        {isAdded && <span style={{ fontSize: '0.75rem', background: '#e8f8f5', color: '#10ac84', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>{t('dict_badge_in_my_words')}</span>}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#555', marginTop: '2px' }}>= {item.meaning}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        onClick={(e) => handleRegenerateSingle(item, e)}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '4px', 
                          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', 
                          color: '#fff', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '15px', fontSize: '0.75rem', fontWeight: '800', 
                          cursor: 'pointer', boxShadow: '0 2px 6px rgba(108, 92, 231, 0.2)' 
                        }}
                        title={t('dict_btn_regen_short')}
                      >
                        <Sparkles size={13} /> {t('dict_btn_regen_short')}
                      </button>
                      <button 
                        onClick={() => handleAddSingleOfflineWord(item)}
                        disabled={isAdded}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '4px', 
                          background: isAdded ? '#e9ecef' : 'var(--primary-color)', 
                          color: isAdded ? '#999' : '#fff', 
                          border: 'none', padding: '0.45rem 0.8rem', borderRadius: '15px', fontSize: '0.75rem', fontWeight: '800', 
                          cursor: isAdded ? 'default' : 'pointer' 
                        }}
                      >
                        <BookmarkPlus size={13} /> {isAdded ? t('dict_btn_added') : t('dict_btn_add')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 대분류 카테고리 탭 셀렉터 */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '30px', boxShadow: '0 8px 20px rgba(0,0,0,0.03)', border: '2px solid #feca57' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '900', color: 'var(--nana-dark)' }}>
            {t('dict_cat_select_title')}
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
                    <div style={{ fontWeight: '900', color: isSelected ? 'var(--nana-dark)' : '#555', fontSize: '0.95rem' }}>{getCategoryDisplayName(cat, userLang)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>{t('dict_subcat_count', { count: cat.subcategories.length })}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 소분류 선택 */}
          {selectedCategory && (
            <div style={{ background: '#fdfbf7', padding: '1.2rem', borderRadius: '20px', border: '1px dashed #feca57', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#856404', marginBottom: '0.8rem' }}>
                {t('dict_subcat_label', { name: getCategoryDisplayName(selectedCategory, userLang) })}
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
                  {t('dict_subcat_all')}
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
                      {getSubcategoryDisplayName(sub, userLang)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 빠른 일괄 자동 추출 컨트롤 바 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '1rem 1.2rem', background: '#f8f9fa', borderRadius: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontWeight: '800', color: '#444', fontSize: '0.95rem' }}>{t('dict_random_extract_label')}</span>
              <select 
                value={offlineCount} 
                onChange={(e) => setOfflineCount(Number(e.target.value))}
                style={{ padding: '0.5rem 0.8rem', borderRadius: '12px', border: '2px solid #ddd', fontSize: '0.95rem', fontWeight: '800', outline: 'none' }}
              >
                <option value={5}>5</option>
                <option value={10}>10 ⭐</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={30}>30 (MAX)</option>
              </select>
            </div>

            <button
              onClick={handleOfflineGenerate}
              disabled={offlineAdding}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0.8rem 1.5rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '25px', fontSize: '0.95rem', fontWeight: '900', cursor: 'pointer',
                boxShadow: '0 4px 0 #e67e22', transition: 'transform 0.1s ease'
              }}
            >
              <CheckCircle2 size={18} /> {offlineAdding ? t('dict_adding_loading') : t('dict_auto_add_btn', { count: offlineCount })}
            </button>
          </div>
        </div>

        {/* 1만 단어 목록 리스트 뷰어 */}
        <div style={{ background: '#fff', padding: '1.8rem', borderRadius: '30px', boxShadow: '0 8px 20px rgba(0,0,0,0.03)', border: '2px solid #e9ecef' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--nana-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} color="#f6b93b" /> 
                {t('dict_list_title', { name: getCategoryDisplayName(selectedCategory, userLang), count: currentCategoryWords.length })}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#888' }}>
                {t('dict_list_desc')}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleExportCurrentCategoryCSV}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '0.55rem 1rem', background: '#f0fdf4', border: '1.5px solid #86efac', 
                  borderRadius: '18px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '800', color: '#166534',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                }}
              >
                <FileDown size={16} /> {t('dict_export_cat_btn', { count: currentCategoryWords.length })}
              </button>

              <button
                onClick={toggleSelectAllCategoryWords}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '0.55rem 1rem', background: '#fff', border: '2px solid #ddd', borderRadius: '18px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '800', color: '#555'
                }}
              >
                {selectedOfflineIds.size === currentCategoryWords.length && currentCategoryWords.length > 0 ? (
                  <CheckSquare size={16} color="var(--primary-color)" />
                ) : (
                  <Square size={16} color="#aaa" />
                )}
                {t('list_all_select')} ({selectedOfflineIds.size}/{currentCategoryWords.length})
              </button>

              {selectedOfflineIds.size > 0 && (
                <>
                  <button
                    disabled={isRegenerating}
                    onClick={handleRegenerateSelected}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '0.55rem 1.2rem', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff', 
                      border: 'none', borderRadius: '18px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '900',
                      boxShadow: '0 3px 10px rgba(108, 92, 231, 0.3)'
                    }}
                  >
                    <Sparkles size={16} /> {t('dict_regen_selected_btn', { count: selectedOfflineIds.size })}
                  </button>

                  <button
                    onClick={handleAddSelectedOfflineWords}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '0.55rem 1.2rem', background: '#10ac84', color: '#fff', border: 'none', borderRadius: '18px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '900',
                      boxShadow: '0 3px 0 #009677'
                    }}
                  >
                    <BookmarkPlus size={16} /> {t('dict_add_selected_btn', { count: selectedOfflineIds.size })}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 단어 목록 아코디언 리스트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {currentCategoryWords.map((item, index) => {
              const isExpanded = expandedOfflineId === item.id;
              const cleanKey = normalizeWord(item.word);
              const isAlreadyInDb = existingWordMap.has(cleanKey);
              const isChecked = selectedOfflineIds.has(item.id);

              return (
                <div
                  key={item.id}
                  style={{
                    background: item.isAiRegenerated ? '#fbf8ff' : (isExpanded ? '#fffdf7' : '#fff'),
                    border: item.isAiRegenerated ? (isExpanded ? '2.5px solid #a855f7' : '1.5px solid #d8b4fe') : (isExpanded ? '2px solid #feca57' : '1.5px solid #eee'),
                    borderRadius: '20px',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    boxShadow: item.isAiRegenerated ? '0 4px 15px rgba(168, 85, 247, 0.12)' : (isExpanded ? '0 6px 15px rgba(254, 202, 87, 0.15)' : '0 2px 6px rgba(0,0,0,0.02)')
                  }}
                >
                  {/* 카드 요약 헤더 */}
                  <div 
                    onClick={() => setExpandedOfflineId(isExpanded ? null : item.id)}
                    style={{ 
                      padding: '1rem 1.2rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      cursor: 'pointer',
                      gap: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: 0 }}>
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSelectOfflineWord(item.id); }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        {isChecked ? <CheckSquare size={22} color="var(--primary-color)" /> : <Square size={22} color="#ccc" />}
                      </div>

                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#bbb', width: '28px' }}>
                        {index + 1}
                      </span>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '900', fontSize: '1.15rem', color: item.isAiRegenerated ? '#6b21a8' : 'var(--nana-dark)' }}>
                            {item.word}
                          </span>
                          <span style={{ fontSize: '0.75rem', background: '#f1f3f5', padding: '2px 8px', borderRadius: '8px', color: '#666', fontWeight: '800' }}>
                            {item.pos}
                          </span>
                          {item.isAiRegenerated && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', 
                              color: '#fff', 
                              padding: '2px 8px', 
                              borderRadius: '8px', 
                              fontWeight: '900',
                              boxShadow: '0 2px 5px rgba(108, 92, 231, 0.25)'
                            }}>
                              {t('dict_badge_regenerated')}
                            </span>
                          )}
                          {isAlreadyInDb && (
                            <span style={{ fontSize: '0.7rem', background: '#e8f8f5', color: '#10ac84', padding: '2px 8px', borderRadius: '8px', fontWeight: '900' }}>
                              {t('dict_badge_in_my_words')}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#555', fontWeight: '700', marginTop: '2px' }}>
                          = {item.meaning}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); playAudio(item.word, studyLang); }}
                        style={{ background: '#f0f7ff', border: 'none', borderRadius: '50%', color: '#1976d2', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Volume2 size={18} />
                      </button>

                      <button
                        onClick={(e) => handleRegenerateSingle(item, e)}
                        disabled={isRegenerating}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                          color: '#fff',
                          border: 'none', padding: '0.5rem 0.9rem', borderRadius: '15px', fontSize: '0.8rem', fontWeight: '900',
                          cursor: isRegenerating ? 'default' : 'pointer',
                          boxShadow: '0 2px 6px rgba(108, 92, 231, 0.25)'
                        }}
                      >
                        <Sparkles size={14} /> {t('dict_btn_regen_short')}
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddSingleOfflineWord(item); }}
                        disabled={isAlreadyInDb}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          background: isAlreadyInDb ? '#f1f3f5' : 'var(--primary-color)',
                          color: isAlreadyInDb ? '#aaa' : '#fff',
                          border: 'none', padding: '0.5rem 0.9rem', borderRadius: '15px', fontSize: '0.8rem', fontWeight: '800',
                          cursor: isAlreadyInDb ? 'default' : 'pointer',
                          boxShadow: isAlreadyInDb ? 'none' : '0 3px 0 #e67e22'
                        }}
                      >
                        <BookmarkPlus size={14} /> {isAlreadyInDb ? t('dict_btn_added') : t('dict_btn_add_short')}
                      </button>

                      <div style={{ color: '#aaa', padding: '4px' }}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* 아코디언 펼침 상세 내용 (재생성된 최신 필드가 즉시 렌더링됨) */}
                  {isExpanded && (
                    <div style={{ padding: '1.4rem 1.6rem', borderTop: item.isAiRegenerated ? '1px solid #e9d5ff' : '1px solid #faeccb', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.4rem' }}>
                      {/* 스타 강사의 시크릿 노트 */}
                      <div style={{ background: item.isAiRegenerated ? '#faf5ff' : '#fdfbf7', padding: '1.2rem', borderRadius: '18px', border: item.isAiRegenerated ? '1.5px solid #c084fc' : '1.5px solid #feca57', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: item.isAiRegenerated ? '#a855f7' : '#feca57', color: '#fff', padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '900' }}>
                            {item.isAiRegenerated ? t('dict_ai_secret_note') : t('list_teacher_secret_note')}
                          </div>
                          {item.isAiRegenerated && (
                            <button 
                              onClick={(e) => handleResetOverride(item, e)}
                              style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                            >
                              <RotateCcw size={12} /> {t('dict_btn_restore_orig')}
                            </button>
                          )}
                        </div>

                        {item.root && <div><b style={{ color: '#27ae60' }}>{t('label_root')}:</b> <span style={{ fontWeight: '800', color: '#2d3436' }}>{item.root}</span></div>}
                        {item.grammar_rule && <div><b style={{ color: '#c0392b' }}>{t('label_grammar')}:</b> {item.grammar_rule}</div>}
                        {item.synonym && <div><b style={{ color: '#00b894' }}>{t('label_synonym')}:</b> {item.synonym}</div>}
                        {item.antonym && <div><b style={{ color: '#d63031' }}>{t('label_antonym')}:</b> {item.antonym}</div>}
                        {item.context && <div><b style={{ color: '#2980b9' }}>{t('label_context')}:</b> {item.context}</div>}
                        {item.caution && (
                          <div style={{ background: '#fff5f5', padding: '0.6rem', borderRadius: '10px', borderLeft: '3px solid #ff7675' }}>
                            <b style={{ color: '#d63031' }}>{t('label_caution')}:</b> {item.caution}
                          </div>
                        )}
                        {item.related && (
                          <div style={{ background: '#f0faff', padding: '0.6rem', borderRadius: '10px', borderLeft: '3px solid #4facfe' }}>
                            <b style={{ color: '#0984e3' }}>{t('list_teacher_tip')}</b> {item.related}
                          </div>
                        )}
                      </div>

                      {/* 격식체 / 구어체 예문 영역 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {item.example_formal && (
                          <div style={{ background: '#fdfcfe', padding: '1rem', borderRadius: '16px', border: '1px solid #eee' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                              <span style={{ color: '#2c3e50', fontWeight: '900', fontSize: '0.8rem', minWidth: '55px' }}>{t('label_formal')}</span>
                              <div style={{ flex: 1, fontSize: '0.9rem', color: '#333', lineHeight: '1.4' }}>
                                <InteractiveSentence sentence={item.example_formal} wordBreakdown={item.word_breakdown} breakdown={item.word_breakdown} />
                              </div>
                              <button onClick={() => playAudio(item.example_formal, studyLang)} style={{ color: '#777', border: 'none', background: 'none', cursor: 'pointer' }}>
                                <Volume2 size={16} />
                              </button>
                            </div>
                            <p style={{ margin: '0 0 0 3.8rem', fontSize: '0.8rem', color: '#888', fontWeight: '600' }}>{item.example_formal_kr}</p>
                          </div>
                        )}

                        {item.example_casual && (
                          <div style={{ background: '#fff9f0', padding: '1rem', borderRadius: '16px', border: '1px solid #fff3e0' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                              <span style={{ color: '#d35400', fontWeight: '900', fontSize: '0.8rem', minWidth: '55px' }}>{t('label_casual')}</span>
                              <div style={{ flex: 1, fontSize: '0.9rem', color: '#333', lineHeight: '1.4' }}>
                                <InteractiveSentence sentence={item.example_casual} wordBreakdown={item.word_breakdown} breakdown={item.word_breakdown} />
                              </div>
                              <button onClick={() => playAudio(item.example_casual, studyLang)} style={{ color: '#777', border: 'none', background: 'none', cursor: 'pointer' }}>
                                <Volume2 size={16} />
                              </button>
                            </div>
                            <p style={{ margin: '0 0 0 3.8rem', fontSize: '0.8rem', color: '#888', fontWeight: '600' }}>{item.example_casual_kr}</p>
                          </div>
                        )}

                        {/* 카드 하단 액션 버튼 */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: 'auto', paddingTop: '0.8rem' }}>
                          <button
                            onClick={(e) => handleRegenerateSingle(item, e)}
                            disabled={isRegenerating}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff',
                              border: 'none', padding: '0.55rem 1.1rem', borderRadius: '18px', fontSize: '0.85rem', fontWeight: '900',
                              cursor: isRegenerating ? 'default' : 'pointer',
                              boxShadow: '0 3px 8px rgba(108, 92, 231, 0.25)'
                            }}
                          >
                            <Sparkles size={15} /> {t('btn_regenerate_single')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI 단어 정밀 재생성 실시간 모달 */}
      {isRegenerating && (
        <div className="modal-overlay" style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 
        }}>
          <div style={{ 
            background: '#fff', padding: '2.5rem 2rem', borderRadius: '32px', 
            width: '90%', maxWidth: '460px', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '2px solid #6c5ce7'
          }}>
            <div style={{ 
              display: 'inline-flex', padding: '16px', borderRadius: '50%', 
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff', 
              marginBottom: '1.2rem', boxShadow: '0 8px 16px rgba(108, 92, 231, 0.3)' 
            }}>
              <Loader2 size={36} style={{ animation: 'spin 1.5s linear infinite' }} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem', fontWeight: '900', fontSize: '1.35rem', color: '#2d3436' }}>
              {t('regen_modal_title')}
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: '#636e72', fontWeight: '700', fontSize: '0.95rem' }}>
              {t('regen_modal_desc')}
            </p>

            <div style={{ 
              background: '#f8f9fa', padding: '1rem', borderRadius: '18px', 
              marginBottom: '1.2rem', border: '1.5px solid #edf2f7' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '800', fontSize: '0.9rem', color: '#4a5568' }}>
                <span>{t('regen_modal_progress')}</span>
                <span style={{ color: '#6c5ce7' }}>{regenStatus.current} / {regenStatus.total}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${regenStatus.total > 0 ? (regenStatus.current / regenStatus.total) * 100 : 0}%`, 
                  background: 'linear-gradient(90deg, #6c5ce7, #a29bfe)', 
                  transition: 'width 0.4s ease' 
                }} />
              </div>
              {regenStatus.currentWord && (
                <div style={{ marginTop: '0.8rem', fontWeight: '900', color: '#2d3436', fontSize: '1.05rem' }}>
                  {t('regen_modal_current')} <span style={{ color: '#6c5ce7' }}>{regenStatus.currentWord}</span>
                </div>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a0aec0', fontWeight: '600' }}>
              {t('regen_modal_wait')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dictionary;
