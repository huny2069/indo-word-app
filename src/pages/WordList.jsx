import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getWords, getCartWords, toggleCartItem, addWordsToCart, removeWordsFromCart, updateWord, deleteWords, getFolders, moveWordsToFolder, clearCart } from '../db/database';
import { playAudio } from '../api/ttsApi';
import { Filter, Search, Plus, Trash2, FolderPlus, Folder, Move, MoreVertical, Volume2, CheckSquare, Square, ShoppingCart, ChevronDown, ChevronUp, Sparkles, HelpCircle, List, X, ChevronLeft, CornerUpRight, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import InteractiveSentence from '../components/InteractiveSentence';
const WordList = () => {
  const { isIndoMode, t } = useLanguage();
  const [words, setWords] = useState([]);
  const [cartIds, setCartIds] = useState(new Set());
  const [viewMode, setViewMode] = useState('folder'); 
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedPos, setSelectedPos] = useState(null);
  const [sortOption, setSortOption] = useState('latest');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState('');
  const [folders, setFolders] = useState([]);
  const [editingWord, setEditingWord] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // --- 암기 모드 및 페이지네이션 상태 ---
  const [hideWords, setHideWords] = useState(false);
  const [hideMeanings, setHideMeanings] = useState(false);
  const [revealedIds, setRevealedIds] = useState(new Set()); // 가려진 항목 중 클릭해서 보여줄 ID들
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const navigate = useNavigate();

  // 필터나 보기 모드가 바뀌면 1페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
    setRevealedIds(new Set());
  }, [viewMode, selectedDate, selectedTopic, selectedPos, sortOption, searchTerm]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [w, cw, f] = await Promise.all([getWords(), getCartWords(), getFolders()]);
    setWords(w);
    setCartIds(new Set(cw.map(item => item.id)));
    setFolders(f);
  };

  const handleClearCart = async () => {
    if (window.confirm(t('msg_clear_cart_confirm'))) {
      await clearCart();
      setCartIds(new Set());
      alert(t('msg_clear_cart_done'));
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim().length > 0) {
      const filtered = words.filter(w => 
        w.word.toLowerCase().includes(value.toLowerCase()) || 
        w.meaning.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8); // 최대 8개 제안
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (word) => {
    setSearchTerm('');
    setSuggestions([]);
    setViewMode('list');
    setExpandedId(word.id);
    // 선택한 단어로 스크롤 이동
    setTimeout(() => {
      const element = document.getElementById(`word-card-${word.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleToggleCart = async (word) => {
    const isAdded = await toggleCartItem(word.id);
    setCartIds(prev => {
        const next = new Set(prev);
        if (isAdded) next.add(word.id);
        else next.delete(word.id);
        return next;
    });
  };

  const groupedByDate = useMemo(() => {
    const groups = {};
    words.forEach(w => {
      const date = w.created_at ? w.created_at.substring(0, 10) : t('list_no_date');
      if (!groups[date]) groups[date] = [];
      groups[date].push(w);
    });
    return Object.fromEntries(Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0])));
  }, [words]);

  // 카테고리별(주제별) 그룹핑
  const groupedByTopic = useMemo(() => {
    const groups = {};
    words.forEach(w => {
      // 기존 단어나 topic이 없는 단어는 '기본 단어'로 분류
      const tp = (w.topic && w.topic.trim()) ? w.topic.trim() : t('list_no_topic');
      if (!groups[tp]) groups[tp] = [];
      groups[tp].push(w);
    });
    return Object.fromEntries(Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])));
  }, [words]);

  // 문법별(품사별) 그룹핑
  const groupedByPos = useMemo(() => {
    const groups = {};
    words.forEach(w => {
      const p = (w.pos && w.pos.trim()) ? w.pos.trim() : t('list_no_pos');
      if (!groups[p]) groups[p] = [];
      groups[p].push(w);
    });
    return Object.fromEntries(Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])));
  }, [words]);

  const displayedWords = useMemo(() => {
    let list = [];
    if (viewMode === 'folder' && selectedDate) {
      list = groupedByDate[selectedDate] || [];
    } else if (viewMode === 'topic' && selectedTopic) {
      list = groupedByTopic[selectedTopic] || [];
    } else if (viewMode === 'pos' && selectedPos) {
      list = groupedByPos[selectedPos] || [];
    } else if (viewMode === 'list') {
      list = [...words];
    }

    if (sortOption === 'latest') {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortOption === 'oldest') {
      list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sortOption === 'alphabetical') {
      list.sort((a, b) => a.word.localeCompare(b.word));
    } else if (sortOption === 'pos') {
      list.sort((a, b) => (a.pos || '').localeCompare(b.pos || ''));
    }
    return list;
  }, [words, viewMode, selectedDate, selectedTopic, selectedPos, sortOption, groupedByDate, groupedByTopic, groupedByPos]);

  // 페이지네이션 적용된 단어 목록
  const paginatedWords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return displayedWords.slice(start, start + itemsPerPage);
  }, [displayedWords, currentPage]);

  const totalPages = Math.ceil(displayedWords.length / itemsPerPage);

  const allDisplayedIds = displayedWords.map(w => w.id);
  const isAllSelected = allDisplayedIds.length > 0 && allDisplayedIds.every(id => selectedIds.has(id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allDisplayedIds));
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('이 단어를 정말 삭제하시겠습니까?')) {
      await deleteWords([id]);
      await removeWordsFromCart([id]);
      loadData();
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingWord) return;
    await updateWord(editingWord);
    setEditingWord(null);
    loadData();
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`선택한 ${selectedIds.size}개의 단어를 단어장에서 완전히 삭제하시겠습니까?`)) {
      try {
        await deleteWords(Array.from(selectedIds));
        await removeWordsFromCart(Array.from(selectedIds)); // Also remove from cart if selected
        setSelectedIds(new Set());
        loadData(); // Use loadData to refresh
        alert(t('msg_delete_done'));
      } catch (err) {
        alert(t('msg_delete_error'));
      }
    }
  };

  const handleAddToCart = async () => {
    if (selectedIds.size === 0) return;
    await addWordsToCart(Array.from(selectedIds));
    setCartIds(prev => {
      const next = new Set(prev);
      selectedIds.forEach(id => next.add(id));
      return next;
    });
    setSelectedIds(new Set()); // Clear selection after adding to cart
    alert(t('msg_cart_added', { count: selectedIds.size }));
  };



  const handleToggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleToggleReveal = (e, id, type) => {
    e.stopPropagation();
    setRevealedIds(prev => {
        const next = new Set(prev);
        const key = `${id}-${type}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMoveSelected = async () => {
    if (!moveFolderId) {
      alert(t('msg_move_no_folder'));
      return;
    }
    try {
      await moveWordsToFolder(Array.from(selectedIds), moveFolderId);
      setSelectedIds(new Set());
      setIsMoveModalOpen(false);
      loadData();
      alert(t('msg_move_done'));
    } catch (err) {
      alert(t('msg_move_error'));
    }
  };

  return (
    <div className="page" style={{ position: 'relative', paddingBottom: '3rem' }}>
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <img src="/assets/img/nana.png" className="nana-character" style={{ width: '80px', marginBottom: '0.5rem' }} alt="Nana" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '2rem', color: 'var(--nana-dark)', margin: 0, fontWeight: '900' }}>{t('list_title')}</h2>
           <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
             <button 
                onClick={() => { setViewMode('folder'); setSelectedDate(null); setSelectedTopic(null); setSelectedPos(null); setExpandedId(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.8rem', background: viewMode === 'folder' ? 'var(--primary-color)' : '#eee', color: viewMode === 'folder' ? '#fff' : '#555', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
               <Folder size={18} /> {t('list_sort_date')}
             </button>
             <button 
                onClick={() => { setViewMode('topic'); setSelectedDate(null); setSelectedTopic(null); setSelectedPos(null); setExpandedId(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.8rem', background: viewMode === 'topic' ? 'var(--primary-color)' : '#eee', color: viewMode === 'topic' ? '#fff' : '#555', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
               <Folder size={18} /> {t('list_sort_topic')}
             </button>
             <button 
                onClick={() => { setViewMode('pos'); setSelectedDate(null); setSelectedTopic(null); setSelectedPos(null); setExpandedId(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.8rem', background: viewMode === 'pos' ? 'var(--primary-color)' : '#eee', color: viewMode === 'pos' ? '#fff' : '#555', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
               <Folder size={18} /> {t('list_sort_pos')}
             </button>
             <button 
                onClick={() => { setViewMode('list'); setExpandedId(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.8rem', background: viewMode === 'list' ? 'var(--primary-color)' : '#eee', color: viewMode === 'list' ? '#fff' : '#555', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
               <List size={18} /> {t('list_all_view')}
             </button>
           </div>
        </div>

        {cartIds.size > 0 && (
            <div style={{ background: '#fff9db', padding: '1.2rem', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '3px solid #feca57', boxShadow: '0 4px 0 #feca57', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <p style={{ margin: 0, color: '#856404', fontWeight: 'bold' }}>{t('list_cart_summary', { count: cartIds.size })}</p>
                    <button 
                        onClick={handleClearCart}
                        style={{ background: '#fff', border: '1px solid #feca57', padding: '0.3rem 0.6rem', borderRadius: '15px', fontSize: '0.75rem', cursor: 'pointer', color: '#856404', fontWeight: 'bold' }}>
                        {t('learn_cart_clear_btn')}
                    </button>
                </div>
                <button 
                    onClick={() => navigate('/learn')}
                    style={{ background: 'linear-gradient(135deg, #feca57, #ff9f43)', color: '#fff', border: 'none', padding: '0.7rem 1.4rem', borderRadius: '30px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 0 #e67e22' }}>
                    {t('dash_review_btn')} <ArrowRight size={18} />
                </button>
            </div>
        )}

        <div style={{ position: 'relative', maxWidth: '500px', margin: '0 auto 2rem' }}>
            <div style={{ 
                display: 'flex', alignItems: 'center', background: '#fff', padding: '0.7rem 1.2rem', borderRadius: suggestions.length > 0 ? '24px 24px 0 0' : '24px', 
                boxShadow: suggestions.length > 0 ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #eee'
            }}>
                <Search size={20} color="#9aa0a6" style={{ marginRight: '1rem' }} />
                <input 
                    type="text" 
                    placeholder={t('search_placeholder')} 
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={() => setIsSearchFocused(true)}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem' }}
                />
                {searchTerm && (
                    <X size={18} color="#9aa0a6" style={{ cursor: 'pointer' }} onClick={() => {setSearchTerm(''); setSuggestions([]);}} />
                )}
            </div>

            {suggestions.length > 0 && (
                <ul style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', margin: 0, padding: '0.5rem 0', 
                    listStyle: 'none', borderRadius: '0 0 24px 24px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', 
                    border: '1px solid #eee', borderTop: 'none', zIndex: 1000
                }}>
                    {suggestions.map((s) => (
                        <li 
                            key={s.id} 
                            onClick={() => handleSelectSuggestion(s)}
                            style={{ padding: '0.6rem 1.2rem', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                        >
                            <div>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{s.word}</span>
                                <span style={{ marginLeft: '0.8rem', color: '#5f6368', fontSize: '0.9rem' }}>{s.meaning}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button 
                onClick={() => setHideWords(!hideWords)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', borderRadius: '30px', border: '2px solid #3498db', cursor: 'pointer', fontWeight: 'bold', background: hideWords ? '#3498db' : '#fff', color: hideWords ? '#fff' : '#3498db', boxShadow: hideWords ? '0 4px 0 #2980b9' : '0 4px 0 #eee' }}
            >
                {t(hideWords ? 'list_show_word' : 'list_hide_word')}
            </button>
            <button 
                onClick={() => setHideMeanings(!hideMeanings)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', borderRadius: '30px', border: '2px solid #e67e22', cursor: 'pointer', fontWeight: 'bold', background: hideMeanings ? '#e67e22' : '#fff', color: hideMeanings ? '#fff' : '#e67e22', boxShadow: hideMeanings ? '0 4px 0 #d35400' : '0 4px 0 #eee' }}
            >
                {t(hideMeanings ? 'list_show_meaning' : 'list_hide_meaning')}
            </button>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
           <button 
              disabled={selectedIds.size === 0}
              onClick={handleDeleteSelected}
              style={{ background: selectedIds.size > 0 ? '#ff4d4f' : '#f5f5f5', color: selectedIds.size > 0 ? '#fff' : '#ccc', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '30px', fontWeight: 'bold', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trash2 size={16} /> {t('btn_delete_selected')} ({selectedIds.size})
           </button>
           <button 
              disabled={selectedIds.size === 0}
              onClick={() => setIsMoveModalOpen(true)}
              style={{ background: selectedIds.size > 0 ? '#1890ff' : '#f5f5f5', color: selectedIds.size > 0 ? '#fff' : '#ccc', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '30px', fontWeight: 'bold', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CornerUpRight size={16} /> {t('btn_move_folder')}
           </button>
           <button 
              disabled={selectedIds.size === 0}
              onClick={handleAddToCart}
              style={{ background: selectedIds.size > 0 ? '#52c41a' : '#f5f5f5', color: selectedIds.size > 0 ? '#fff' : '#ccc', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '30px', fontWeight: 'bold', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShoppingCart size={16} /> {t('btn_add_to_cart')}
           </button>
       </div>
      </header>
      
      {words.length === 0 ? (
        <div style={{ background: '#fff', padding: '3rem 2rem', textAlign: 'center', borderRadius: '8px', color: '#888', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          {isIndoMode ? "Belum ada kosakata yang disimpan." : "저장된 인도네시아어 단어가 없습니다."}<br/>
          <strong>✨ {t('nav_generate')}</strong> {isIndoMode ? "Pindah ke tab Buat Kata untuk membuat kata baru!" : "탭으로 이동하여 새로운 단어를 만들어보세요!"}
        </div>
      ) : (
        <>
          {viewMode === 'folder' && !selectedDate && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {Object.keys(groupedByDate).map(dateStr => (
                 <div 
                   key={dateStr}
                   onClick={() => setSelectedDate(dateStr)}
                   style={{ background: '#fff', border: '3px solid #feca57', padding: '1.5rem 1rem', borderRadius: '25px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 6px 0 #feca57' }}
                 >
                    <Folder size={48} color="#feca57" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--nana-dark)', fontWeight: '900' }}>{dateStr}</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#f39c12', fontWeight: 'bold' }}>{t('list_word_count', { count: groupedByDate[dateStr].length })}</p>
                 </div>
              ))}
            </div>
          )}

          {viewMode === 'topic' && !selectedTopic && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {Object.keys(groupedByTopic).map(topicStr => (
                 <div 
                   key={topicStr}
                   onClick={() => setSelectedTopic(topicStr)}
                   style={{ background: '#fff', border: '3px solid #55efc4', padding: '1.5rem 1rem', borderRadius: '25px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 6px 0 #55efc4' }}
                 >
                    <Folder size={48} color="#00b894" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--nana-dark)', fontWeight: '900', wordBreak: 'keep-all' }}>{topicStr}</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#00b894', fontWeight: 'bold' }}>{t('list_word_count', { count: groupedByTopic[topicStr].length })}</p>
                 </div>
              ))}
            </div>
          )}

          {viewMode === 'pos' && !selectedPos && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {Object.keys(groupedByPos).map(posStr => (
                 <div 
                   key={posStr}
                   onClick={() => setSelectedPos(posStr)}
                   style={{ background: '#fff', border: '3px solid #74b9ff', padding: '1.5rem 1rem', borderRadius: '25px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 6px 0 #74b9ff' }}
                 >
                    <Folder size={48} color="#0984e3" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--nana-dark)', fontWeight: '900', wordBreak: 'keep-all' }}>{posStr}</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#0984e3', fontWeight: 'bold' }}>{t('list_word_count', { count: groupedByPos[posStr].length })}</p>
                 </div>
              ))}
            </div>
          )}

          {((viewMode === 'folder' && selectedDate) || (viewMode === 'topic' && selectedTopic) || (viewMode === 'pos' && selectedPos) || viewMode === 'list') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                 {viewMode === 'folder' && selectedDate && (
                     <button onClick={() => setSelectedDate(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontWeight: 'bold' }}>
                         <ChevronLeft size={20} /> 뒤로가기 ({selectedDate})
                     </button>
                 )}
                 {viewMode === 'topic' && selectedTopic && (
                     <button onClick={() => setSelectedTopic(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontWeight: 'bold' }}>
                         <ChevronLeft size={20} /> 뒤로가기 ({selectedTopic})
                     </button>
                 )}
                 {viewMode === 'pos' && selectedPos && (
                     <button onClick={() => setSelectedPos(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontWeight: 'bold' }}>
                         <ChevronLeft size={20} /> {t('btn_back')} ({selectedPos})
                     </button>
                 )}
                 {viewMode === 'list' && (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>{t('list_sort_label')}</label>
                        <select value={sortOption} onChange={e => {setSortOption(e.target.value); setExpandedId(null);}} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                           <option value="latest">{t('list_sort_latest')}</option>
                           <option value="oldest">{t('list_sort_oldest')}</option>
                           <option value="alphabetical">{t('list_sort_abc')}</option>
                           <option value="pos">{t('list_sort_pos_group')}</option>
                        </select>
                     </div>
                 )}
                 
                 <button 
                    onClick={handleToggleSelectAll}
                    style={{ background: '#fff', border: '1px solid #ccc', padding: '0.5rem 1rem', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#333' }}>
                    {isAllSelected ? <CheckSquare size={18} color="var(--primary-color)" /> : <Square size={18} />} 
                    {isAllSelected ? t('list_all_deselect') : t('list_all_select')}
                 </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {paginatedWords.map(w => {
                  const isCarted = cartIds.has(w.id);
                  const isExpanded = expandedId === w.id;
                  const isWordHidden = hideWords && !revealedIds.has(`${w.id}-word`);
                  const isMeaningHidden = hideMeanings && !revealedIds.has(`${w.id}-meaning`);

                  return (
                    <div id={`word-card-${w.id}`} key={w.id} style={{ 
                        background: '#fff', 
                        border: isExpanded ? '2px solid var(--primary-color)' : (isCarted ? '1px solid #ffeaa7' : '1px solid #eee'),
                        borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                        transition: 'all 0.3s ease', transform: isExpanded ? 'scale(1.02)' : 'none'
                    }}>
                      <div 
                        onClick={() => handleToggleExpand(w.id)}
                        style={{ padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '1rem', background: isExpanded ? '#f9f9f9' : '#fff' }}
                      >
                         <div onClick={(e) => { e.stopPropagation(); handleToggleSelect(w.id); }} style={{ color: selectedIds.has(w.id) ? 'var(--primary-color)' : '#ccc', cursor: 'pointer' }}>
                             {selectedIds.has(w.id) ? <CheckSquare size={22} /> : <Square size={22} />}
                         </div>
                         <div onClick={(e) => { e.stopPropagation(); handleToggleCart(w); }} style={{ background: isCarted ? '#fff9db' : 'none', padding: '0.2rem', borderRadius: '4px', cursor: 'pointer', color: isCarted ? '#f39c12' : '#eee' }}>
                             <ShoppingCart size={18} />
                         </div>
                        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '0.2rem', minWidth: 0, justifyContent: 'center' }}>
                            <span onClick={(e) => hideWords && handleToggleReveal(e, w.id, 'word')} style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary-color)', filter: isWordHidden ? 'blur(8px)' : 'none', transition: 'filter 0.3s', lineHeight: '1.2' }}>
                                {w.word}
                            </span>
                            <span onClick={(e) => hideMeanings && handleToggleReveal(e, w.id, 'meaning')} style={{ fontWeight: '500', fontSize: '1rem', color: '#555', filter: isMeaningHidden ? 'blur(8px)' : 'none', transition: 'filter 0.3s', wordBreak: 'keep-all', lineHeight: '1.4' }}>
                                {w.meaning}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                           <button onClick={(e) => { e.stopPropagation(); playAudio(w.word); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2' }}>
                              <Volume2 size={20} />
                           </button>
                           <span style={{ fontSize: '0.75rem', background: '#f0f0f0', padding: '0.2rem 0.4rem', borderRadius: '4px', color: '#777', minWidth: '40px', textAlign: 'center' }}>{t('pos_' + (w.pos === '명사'?'noun':w.pos === '동사'?'verb':w.pos === '형용사'?'adj':w.pos === '부사'?'adv':w.pos === '대명사'?'pronoun':w.pos === '수사'?'numeral':w.pos === '전치사'?'preposition':w.pos === '접속사'?'conjunction':w.pos === '감탄사'?'interjection':w.pos === '한정사'?'determiner':'noun'))}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '1.2rem', background: '#fdfdfd', borderTop: '1px solid #f0f0f0' }}>
                          <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                {w.context && <div style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}><b style={{ color: '#2e7d32', display: 'inline-block', width: '110px', flexShrink: 0 }}>{t('label_context')}:</b> <span style={{ flex: 1 }}>{w.context}</span></div>}
                                {w.caution && <div style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}><b style={{ color: '#c62828', display: 'inline-block', width: '110px', flexShrink: 0 }}>{t('label_caution')}:</b> <span style={{ flex: 1 }}>{w.caution}</span></div>}
                                {w.related && <div style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}><b style={{ color: '#1565c0', display: 'inline-block', width: '110px', flexShrink: 0 }}>{t('label_related')}:</b> <span style={{ flex: 1 }}>{w.related}</span></div>}
                                {w.root && <div style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}><b style={{ color: '#666', display: 'inline-block', width: '110px', flexShrink: 0 }}>{t('label_root')}:</b> <span style={{ flex: 1 }}>{w.root}</span></div>}
                                {w.grammar_rule && <div style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}><b style={{ color: '#8e44ad', display: 'inline-block', width: '110px', flexShrink: 0 }}>{t('label_grammar')}:</b> <span style={{ flex: 1 }}>{w.grammar_rule}</span></div>}
                             </div>

                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                {w.example_formal && (
                                    <div style={{ background: '#f5f7f9', padding: '1rem', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                            <span style={{ color: '#2c3e50', fontWeight: 'bold', width: '110px', flexShrink: 0 }}>🌟 {t('label_formal')}:</span>
                                            <div style={{ flex: 1 }}><InteractiveSentence sentence={w.example_formal} wordBreakdown={w.word_breakdown} /></div>
                                            <button onClick={() => playAudio(w.example_formal)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2' }}><Volume2 size={18} /></button>
                                        </div>
                                        <p style={{ margin: '0 0 0 calc(110px + 0.5rem)', fontSize: '0.9rem', color: '#666' }}>{w.example_formal_kr}</p>
                                    </div>
                                )}
                                {w.example_casual && (
                                    <div style={{ background: '#fff3e0', padding: '1rem', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                            <span style={{ color: '#d35400', fontWeight: 'bold', width: '110px', flexShrink: 0 }}>🗣️ {t('label_casual')}:</span>
                                            <div style={{ flex: 1 }}><InteractiveSentence sentence={w.example_casual} wordBreakdown={w.word_breakdown} /></div>
                                            <button onClick={() => playAudio(w.example_casual)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d35400' }}><Volume2 size={18} /></button>
                                        </div>
                                        <p style={{ margin: '0 0 0 calc(110px + 0.5rem)', fontSize: '0.9rem', color: '#666' }}>{w.example_casual_kr}</p>
                                    </div>
                                )}
                             </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.2rem', marginTop: '1.2rem', paddingTop: '0.8rem', borderTop: '1px solid #eee' }}>
                             <button onClick={(e) => handleDelete(w.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Trash2 size={16} /> 삭제</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>처음</button>
                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>이전</button>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {[...Array(totalPages)].map((_, i) => {
                            const p = i + 1;
                            if (p < currentPage - 2 || p > currentPage + 2) return null;
                            return (
                                <button key={p} onClick={() => setCurrentPage(p)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: p === currentPage ? 'none' : '1px solid #eee', background: p === currentPage ? 'var(--primary-color)' : '#fff', color: p === currentPage ? '#fff' : '#333', fontWeight: 'bold' }}>{p}</button>
                            );
                        })}
                    </div>
                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>다음</button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>끝</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button onClick={scrollToTop} style={{ position: 'fixed', bottom: '2rem', right: '2rem', width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-color)', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 1000, fontWeight: '900' }}>TOP</button>

      {editingWord && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', width: '92%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
               <h3 style={{ marginTop: 0, textAlign: 'center' }}>✏️ 단어 상세 편집</h3>
               <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div><label>{t('label_indonesian')}</label><input type="text" value={editingWord.word} onChange={e => setEditingWord({...editingWord, word: e.target.value})} style={{ width: '100%', padding: '0.7rem', border: '1px solid #ddd', borderRadius: '6px' }} required /></div>
                    <div><label>{t('label_korean_meaning')}</label><input type="text" value={editingWord.meaning} onChange={e => setEditingWord({...editingWord, meaning: e.target.value})} style={{ width: '100%', padding: '0.7rem', border: '1px solid #ddd', borderRadius: '6px' }} required /></div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem' }}>
                     <button type="submit" style={{ flex: 1, padding: '0.9rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>저장</button>
                     <button type="button" onClick={() => setEditingWord(null)} style={{ flex: 1, padding: '0.9rem', background: '#eee', border: 'none', borderRadius: '8px' }}>취소</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {isMoveModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '25px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0, textAlign: 'center' }}>📦 폴더 이동</h3>
            <select value={moveFolderId} onChange={e => setMoveFolderId(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #eee', marginBottom: '1.5rem' }}>
              <option value="">이동할 폴더 선택...</option>
              {folders.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={handleMoveSelected} style={{ flex: 1, padding: '0.9rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '30px', fontWeight: '900' }}>이동</button>
              <button onClick={() => setIsMoveModalOpen(false)} style={{ flex: 1, padding: '0.9rem', background: '#eee', border: 'none', borderRadius: '30px' }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordList;
