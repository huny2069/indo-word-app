import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getWords, getCartWords, toggleCartItem, addWordsToCart, removeWordsFromCart, updateWord, deleteWords, getFolders, moveWordsToFolder, clearCart } from '../db/database';
import { playAudio } from '../api/ttsApi';
import { Filter, Search, Plus, Trash2, FolderPlus, Folder, Move, MoreVertical, Volume2, CheckSquare, Square, ShoppingCart, ChevronDown, ChevronUp, Sparkles, HelpCircle, List, X, ChevronLeft, CornerUpRight, ArrowRight, FileText, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import InteractiveSentence from '../components/InteractiveSentence';
import AiTeacherModal from '../components/AiTeacherModal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const WordList = () => {
  const { userLang, studyLang, t } = useLanguage();
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
  const [filterLang, setFilterLang] = useState('all'); // 'all', 'id', 'en', 'ko'

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  const [hideWords, setHideWords] = useState(false);
  const [hideMeanings, setHideMeanings] = useState(false);
  const [revealedIds, setRevealedIds] = useState(new Set()); 
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTeacherWord, setSelectedTeacherWord] = useState(null);
  const itemsPerPage = 20;

  const navigate = useNavigate();

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
      ).slice(0, 8);
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

  const getPosTranslation = (posValue) => {
    if (!posValue) return t('list_no_pos');
    const p = posValue.trim();
    const map = {
      '명사': 'pos_noun',
      '동사': 'pos_verb',
      '형용사': 'pos_adj',
      '부사': 'pos_adv',
      '대명사': 'pos_pronoun',
      '수사': 'pos_numeral',
      '전치사': 'pos_preposition',
      '접속사': 'pos_conjunction',
      '감탄사': 'pos_interjection',
      '관형사': 'pos_determiner',
      '한정사': 'pos_determiner'
    };
    return map[p] ? t(map[p]) : p;
  };

  const filteredWords = useMemo(() => {
    if (filterLang === 'all') return words;
    return words.filter(w => w.study_lang === filterLang);
  }, [words, filterLang]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredWords.forEach(w => {
      const date = w.created_at ? w.created_at.substring(0, 10) : t('list_no_date');
      if (!groups[date]) groups[date] = [];
      groups[date].push(w);
    });
    return Object.fromEntries(Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0])));
  }, [filteredWords, t]);

  const groupedByTopic = useMemo(() => {
    const groups = {};
    filteredWords.forEach(w => {
      const tp = (w.topic && w.topic.trim()) ? w.topic.trim() : t('list_no_topic');
      if (!groups[tp]) groups[tp] = [];
      groups[tp].push(w);
    });
    return Object.fromEntries(Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])));
  }, [filteredWords, t]);

  const groupedByPos = useMemo(() => {
    const groups = {};
    filteredWords.forEach(w => {
      const p = getPosTranslation(w.pos);
      if (!groups[p]) groups[p] = [];
      groups[p].push(w);
    });
    return Object.fromEntries(Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])));
  }, [filteredWords, t]);

  const displayedWords = useMemo(() => {
    let list = [];
    if (viewMode === 'folder' && selectedDate) {
      list = groupedByDate[selectedDate] || [];
    } else if (viewMode === 'topic' && selectedTopic) {
      list = groupedByTopic[selectedTopic] || [];
    } else if (viewMode === 'pos' && selectedPos) {
      list = groupedByPos[selectedPos] || [];
    } else if (viewMode === 'list') {
      list = [...filteredWords];
    }

    if (sortOption === 'latest') {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortOption === 'oldest') {
      list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sortOption === 'alphabetical') {
      list.sort((a, b) => a.word.localeCompare(b.word));
    } else if (sortOption === 'pos') {
      list.sort((a, b) => (getPosTranslation(a.pos) || '').localeCompare(getPosTranslation(b.pos) || ''));
    }
    return list;
  }, [filteredWords, viewMode, selectedDate, selectedTopic, selectedPos, sortOption, groupedByDate, groupedByTopic, groupedByPos]);

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
    if (window.confirm(t('msg_delete_confirm_single'))) {
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
    if (window.confirm(t('msg_delete_confirm_multi', { count: selectedIds.size }))) {
      try {
        await deleteWords(Array.from(selectedIds));
        await removeWordsFromCart(Array.from(selectedIds));
        setSelectedIds(new Set());
        loadData();
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
    setSelectedIds(new Set());
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const handleExportPDF = async () => {
    if (selectedIds.size === 0) return;
    
    const selectedWordsList = words.filter(w => selectedIds.has(w.id));
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const imgWidth = pageWidth - (margin * 2);
    let currentY = margin;

    const headerElement = document.createElement('div');
    headerElement.style.padding = '5px 15px';
    headerElement.style.width = '700px'; 
    headerElement.style.position = 'fixed';
    headerElement.style.top = '0';
    headerElement.style.left = '-2000px';
    headerElement.style.zIndex = '-999';
    headerElement.style.background = '#fff';
    headerElement.style.borderBottom = '1px solid #feca57';
    headerElement.style.display = 'flex';
    headerElement.style.justifyContent = 'space-between';
    headerElement.style.alignItems = 'baseline';
    headerElement.style.fontFamily = 'Arial, sans-serif';

    headerElement.innerHTML = `
      <h1 style="color: #ff9f43; margin: 0; font-size: 14px;">${t('list_pdf_title')}</h1>
      <span style="color: #888; font-weight: bold; font-size: 10px;">
        ${new Date().toLocaleDateString()} | 총 ${selectedWordsList.length}개
      </span>
    `;
    document.body.appendChild(headerElement);

    const headerCanvas = await html2canvas(headerElement, { scale: 2, useCORS: true });
    const headerHeightMm = (headerCanvas.height * imgWidth) / headerCanvas.width;
    pdf.addImage(headerCanvas.toDataURL('image/png'), 'PNG', margin, currentY, imgWidth, headerHeightMm);
    currentY += headerHeightMm + 5;
    document.body.removeChild(headerElement);

    for (let i = 0; i < selectedWordsList.length; i++) {
        const w = selectedWordsList[i];
        const element = document.createElement('div');
        element.style.padding = '10px 15px';
        element.style.width = '700px'; 
        element.style.position = 'fixed';
        element.style.top = '0';
        element.style.left = '-2000px';
        element.style.zIndex = '-999';
        element.style.background = '#fff';
        element.style.border = '1px solid #eee';
        element.style.borderTop = '3px solid #ff9f43';
        element.style.borderRadius = '8px';
        element.style.fontFamily = 'Arial, sans-serif';

        element.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <div style="font-size: 1.2rem; font-weight: 900; color: #1a1a1a;">${w.word}</div>
              <div style="font-size: 1rem; color: #555; font-weight: 700;">: ${w.meaning}</div>
            </div>
            <div style="background: #f8f9fa; padding: 2px 8px; border-radius: 5px; font-size: 0.75rem; color: #666; font-weight: bold; border: 1px solid #eee;">
              ${getPosTranslation(w.pos)}
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.8rem; margin-top: 5px;">
             ${w.example_formal ? `<div><b>격식:</b> ${w.example_formal}<br/><small color="#888">${w.example_formal_kr}</small></div>` : ''}
             ${w.example_casual ? `<div><b>구어:</b> ${w.example_casual}<br/><small color="#888">${w.example_casual_kr}</small></div>` : ''}
          </div>
        `;
        document.body.appendChild(element);

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const cardHeightMm = (canvas.height * imgWidth) / canvas.width;

        if (currentY + cardHeightMm > (pageHeight - margin)) {
            pdf.addPage();
            currentY = margin;
        }

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, currentY, imgWidth, cardHeightMm);
        currentY += cardHeightMm + 5;
        document.body.removeChild(element);
    }
    
    pdf.save(`Wordbook_Backup_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="page" style={{ position: 'relative', paddingBottom: '3rem' }}>
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <img src="/assets/img/nana.png" className="nana-character" style={{ width: '80px', marginBottom: '0.5rem' }} alt="Nana" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '2.2rem', color: 'var(--nana-dark)', margin: 0, fontWeight: '900' }}>{t('list_title')}</h2>
           <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
             {[
                {id: 'folder', icon: <Folder size={18}/>, label: t('list_sort_date')},
                {id: 'topic', icon: <Folder size={18}/>, label: t('list_sort_topic')},
                {id: 'pos', icon: <Folder size={18}/>, label: t('list_sort_pos')},
                {id: 'list', icon: <List size={18}/>, label: t('list_all_view')}
             ].map(mode => (
                <button key={mode.id}
                    onClick={() => { setViewMode(mode.id); setSelectedDate(null); setSelectedTopic(null); setSelectedPos(null); setExpandedId(null); }}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', 
                        background: viewMode === mode.id ? 'var(--primary-color)' : '#eee', 
                        color: viewMode === mode.id ? '#fff' : '#555', 
                        border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: '800', transition: '0.3s'
                    }}>
                   {mode.icon} {mode.label}
                </button>
             ))}
           </div>
        </div>

        {/* 언어별 필터 탭 (v18.0 추가) */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center', background: '#f8f9fa', padding: '0.4rem', borderRadius: '20px', width: 'fit-content', margin: '0 auto 1.5rem auto' }}>
            {[
                { id: 'all', label: t('lang_all') },
                { id: 'id', label: t('lang_id') },
                { id: 'en', label: t('lang_en') },
                { id: 'ko', label: t('lang_ko') }
            ].map(lang => (
                <button 
                    key={lang.id}
                    onClick={() => setFilterLang(lang.id)}
                    style={{ 
                        padding: '0.6rem 1.2rem', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: '800', transition: '0.3s',
                        background: filterLang === lang.id ? 'var(--nana-dark)' : 'transparent',
                        color: filterLang === lang.id ? '#fff' : '#888'
                    }}>
                    {lang.label}
                </button>
            ))}
        </div>

        {cartIds.size > 0 && (
            <div style={{ background: '#fff9db', padding: '1.2rem', borderRadius: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '3px solid #feca57', boxShadow: '0 4px 0 #feca57', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <p style={{ margin: 0, color: '#856404', fontWeight: '900' }}>{t('list_cart_summary', { count: cartIds.size })}</p>
                    <button 
                        onClick={handleClearCart}
                        style={{ background: '#fff', border: '1px solid #feca57', padding: '0.4rem 0.8rem', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer', color: '#856404', fontWeight: '900' }}>
                        {t('learn_cart_clear_btn')}
                    </button>
                </div>
                <button 
                    onClick={() => navigate('/learn')}
                    style={{ background: 'linear-gradient(135deg, #feca57, #ff9f43)', color: '#fff', border: 'none', padding: '0.8rem 1.6rem', borderRadius: '35px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 0 #e67e22' }}>
                    {t('dash_review_btn')} <ArrowRight size={18} />
                </button>
            </div>
        )}

        <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
            <div style={{ 
                display: 'flex', alignItems: 'center', background: '#fff', padding: '0.9rem 1.4rem', borderRadius: suggestions.length > 0 ? '25px 25px 0 0' : '30px', 
                boxShadow: suggestions.length > 0 ? '0 8px 16px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.05)',
                border: '2px solid #eee', transition: '0.3s'
            }}>
                <Search size={22} color="#9aa0a6" style={{ marginRight: '1rem' }} />
                <input 
                    type="text" 
                    placeholder={t('search_placeholder')} 
                    value={searchTerm}
                    onChange={handleSearchChange}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.1rem', fontWeight: '600' }}
                />
                {searchTerm && (
                    <X size={20} color="#9aa0a6" style={{ cursor: 'pointer' }} onClick={() => {setSearchTerm(''); setSuggestions([]);}} />
                )}
            </div>

            {suggestions.length > 0 && (
                <ul style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', margin: 0, padding: '0.5rem 0', 
                    listStyle: 'none', borderRadius: '0 0 25px 25px', boxShadow: '0 12px 24px rgba(0,0,0,0.1)', 
                    border: '2px solid #eee', borderTop: 'none', zIndex: 1000
                }}>
                    {suggestions.map((s) => (
                        <li key={s.id} onClick={() => handleSelectSuggestion(s)} style={{ padding: '0.8rem 1.5rem', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }}>
                            <div>
                                <span style={{ fontWeight: '900', color: 'var(--primary-color)', fontSize: '1rem' }}>{s.word}</span>
                                <span style={{ marginLeft: '1rem', color: '#666', fontSize: '0.95rem', fontWeight: '600' }}>{s.meaning}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.5rem' }}>
           <button 
              disabled={selectedIds.size === 0}
              onClick={handleDeleteSelected}
              style={{ background: selectedIds.size > 0 ? '#ff4d4f' : '#f5f5f5', color: selectedIds.size > 0 ? '#fff' : '#ccc', border: 'none', padding: '0.8rem 1.4rem', borderRadius: '30px', fontWeight: '900', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: '0.3s' }}>
              <Trash2 size={18} /> {t('btn_delete_selected')} ({selectedIds.size})
           </button>
           <button 
              disabled={selectedIds.size === 0}
              onClick={() => setIsMoveModalOpen(true)}
              style={{ background: selectedIds.size > 0 ? '#1890ff' : '#f5f5f5', color: selectedIds.size > 0 ? '#fff' : '#ccc', border: 'none', padding: '0.8rem 1.4rem', borderRadius: '30px', fontWeight: '900', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: '0.3s' }}>
              <Move size={18} /> {t('btn_move_folder')}
           </button>
           <button 
              disabled={selectedIds.size === 0}
              onClick={handleExportPDF}
              style={{ background: selectedIds.size > 0 ? '#722ed1' : '#f5f5f5', color: selectedIds.size > 0 ? '#fff' : '#ccc', border: 'none', padding: '0.8rem 1.4rem', borderRadius: '30px', fontWeight: '900', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: '0.3s' }}>
              <FileText size={18} /> {t('btn_export_pdf')}
           </button>
           <button 
              disabled={selectedIds.size === 0}
              onClick={handleAddToCart}
              style={{ background: selectedIds.size > 0 ? '#52c41a' : '#f5f5f5', color: selectedIds.size > 0 ? '#fff' : '#ccc', border: 'none', padding: '0.8rem 1.4rem', borderRadius: '30px', fontWeight: '900', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: '0.3s' }}>
              <ShoppingCart size={18} /> {t('btn_add_to_cart')}
           </button>
        </div>
      </header>
      
      {words.length === 0 ? (
        <div style={{ background: '#fff', padding: '4rem 2rem', textAlign: 'center', borderRadius: '35px', color: '#999', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontWeight: '700' }}>
          {t('list_no_words_msg')}<br/>
          {t('list_no_words_desc')}
        </div>
      ) : (
        <>
          {viewMode === 'folder' && !selectedDate && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
              {Object.keys(groupedByDate).map(dateStr => (
                 <div key={dateStr} onClick={() => setSelectedDate(dateStr)}
                   style={{ background: '#fff', border: '3px solid #feca57', padding: '2rem 1rem', borderRadius: '35px', textAlign: 'center', cursor: 'pointer', transition: '0.2s', boxShadow: '0 8px 0 #feca57' }}
                   onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <Folder size={56} color="#feca57" style={{ marginBottom: '0.8rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--nana-dark)', fontWeight: '900' }}>{dateStr}</h3>
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: '#f39c12', fontWeight: '800' }}>{t('list_word_count', { count: groupedByDate[dateStr].length })}</p>
                 </div>
              ))}
            </div>
          )}

          {/* ... (Topic/Pos folders omitted for brevity, assuming same pattern) ... */}
          {(viewMode === 'topic' && !selectedTopic) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
              {Object.keys(groupedByTopic).map(topicStr => (
                 <div key={topicStr} onClick={() => setSelectedTopic(topicStr)}
                   style={{ background: '#fff', border: '3px solid #55efc4', padding: '2rem 1rem', borderRadius: '35px', textAlign: 'center', cursor: 'pointer', transition: '0.2s', boxShadow: '0 8px 0 #55efc4' }}>
                    <Folder size={56} color="#00b894" style={{ marginBottom: '0.8rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--nana-dark)', fontWeight: '900' }}>{topicStr}</h3>
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: '#00b894', fontWeight: '800' }}>{t('list_word_count', { count: groupedByTopic[topicStr].length })}</p>
                 </div>
              ))}
            </div>
          )}

          {((viewMode === 'folder' && selectedDate) || (viewMode === 'topic' && selectedTopic) || (viewMode === 'pos' && selectedPos) || viewMode === 'list') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1.2rem' }}>
                 <button onClick={() => { setSelectedDate(null); setSelectedTopic(null); setSelectedPos(null); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#eee', border: 'none', cursor: 'pointer', color: '#555', fontWeight: '900', padding: '0.6rem 1.2rem', borderRadius: '20px' }}>
                     <ChevronLeft size={20} /> {t('list_back')}
                 </button>
                 
                 <button onClick={handleToggleSelectAll}
                    style={{ background: '#fff', border: '2.5px solid #eee', padding: '0.6rem 1.2rem', borderRadius: '30px', cursor: 'pointer', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#333' }}>
                    {isAllSelected ? <CheckSquare size={20} color="var(--primary-color)" /> : <Square size={20} color="#ccc" />} 
                    {isAllSelected ? t('list_all_deselect') : t('list_all_select')}
                 </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {paginatedWords.map(w => {
                  const isCarted = cartIds.has(w.id);
                  const isExpanded = expandedId === w.id;
                  
                  return (
                    <div id={`word-card-${w.id}`} key={w.id} style={{ 
                        background: '#fff', border: isExpanded ? '3px solid var(--primary-color)' : (isCarted ? '1px solid #ffeaa7' : '1.5px solid #eee'),
                        borderRadius: '25px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                        transition: 'all 0.3s'
                    }}>
                      <div onClick={() => handleToggleExpand(w.id)} style={{ padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '1.2rem', background: isExpanded ? '#fbfbfb' : '#fff' }}>
                         <div onClick={(e) => { e.stopPropagation(); handleToggleSelect(w.id); }} style={{ color: selectedIds.has(w.id) ? 'var(--primary-color)' : '#eee' }}>
                             {selectedIds.has(w.id) ? <CheckSquare size={26} /> : <Square size={26} />}
                         </div>
                         <div onClick={(e) => { e.stopPropagation(); handleToggleCart(w); }} style={{ background: isCarted ? '#fff9db' : 'none', padding: '0.4rem', borderRadius: '10px', color: isCarted ? '#f39c12' : '#eee' }}>
                             <ShoppingCart size={20} />
                         </div>
                        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ fontWeight: '900', fontSize: '1.3rem', color: 'var(--primary-color)', lineHeight: '1.2' }}>{w.word}</span>
                                {w.pronunciation && <span style={{ color: '#aaa', fontSize: '0.95rem', fontWeight: '600' }}>[{w.pronunciation}]</span>}
                            </div>
                            <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#444', lineHeight: '1.4' }}>{w.meaning}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                           <button onClick={(e) => { e.stopPropagation(); setSelectedTeacherWord(w); }} style={{ background: '#fff1f0', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#ff4d4f', padding: '12px' }} title="AI 선생님 강의 듣기">
                              <GraduationCap size={22} />
                           </button>
                           <button onClick={(e) => { e.stopPropagation(); playAudio(w.word, w.study_lang); }} style={{ background: '#f0f7ff', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#1976d2', padding: '12px' }}>
                              <Volume2 size={22} />
                           </button>
                              <span style={{ fontSize: '0.8rem', background: '#f5f5f5', padding: '5px 12px', borderRadius: '50px', color: '#666', minWidth: '45px', textAlign: 'center', fontWeight: '800' }}>{getPosTranslation(w.pos)}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '2rem', background: '#fff', borderTop: '2px solid #f0f0f0' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.8rem' }}>
                             <div style={{ 
                                  display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '1rem', 
                                  background: '#fff', padding: '1.8rem', borderRadius: '25px', 
                                  border: '2px solid #feca57', position: 'relative', boxShadow: 'inset 0 0 20px rgba(254, 202, 87, 0.05)'
                              }}>
                                <div style={{ position: 'absolute', top: '-12px', left: '20px', background: '#feca57', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '900' }}>
                                    {t('list_teacher_secret_note')}
                                </div>
                                {w.etymology && <div><b style={{ color: '#e67e22' }}>📜 {t('label_etymology')}:</b> {w.etymology}</div>}
                                {w.nuance && <div><b style={{ color: '#8e44ad' }}>🎭 {t('label_nuance')}:</b> {w.nuance}</div>}
                                {w.honorifics && <div><b style={{ color: '#2980b9' }}>🙇‍♂️ {t('label_honorifics')}:</b> {w.honorifics}</div>}
                                {w.hanja_info && <div><b style={{ color: '#c2410c' }}>🈯 {t('label_hanja')}:</b> {w.hanja_info}</div>}
                                {w.root && <div><b style={{ color: '#27ae60' }}>🌱 {t('label_root')}:</b> {w.root}</div>}
                                {w.grammar_rule && <div><b style={{ color: '#c0392b' }}>📘 {t('label_grammar')}:</b> {w.grammar_rule}</div>}
                                {w.context && <div><b style={{ color: '#1565c0' }}>📌 {t('label_context')}:</b> {w.context}</div>}
                                {w.caution && (
                                    <div style={{ background: '#fff0f0', padding: '10px', borderRadius: '12px', borderLeft: '4px solid #ff4d4f', marginTop: '5px' }}>
                                        <b style={{ color: '#ff4d4f' }}>⚠️ {t('label_caution')} (학습 주의):</b> {w.caution}
                                    </div>
                                )}
                                <span>
                                    {getPosTranslation(w.pos)} | {new Date(w.created_at).toLocaleDateString()}
                                </span>
                                {w.related && (
                                    <div style={{ background: '#f0f9ff', padding: '10px', borderRadius: '12px', borderLeft: '4px solid #1890ff', marginTop: '5px' }}>
                                        <b style={{ color: '#1890ff' }}>{t('list_teacher_tip')}</b> {w.related}
                                    </div>
                                )}
                             </div>

                             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                {w.example_formal && (
                                    <div style={{ background: '#fdfcfe', padding: '1.5rem', borderRadius: '20px', border: '1px solid #eee' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', marginBottom: '0.6rem' }}>
                                            <span style={{ color: '#2c3e50', fontWeight: '900', minWidth: '70px' }}>🌟 {t('label_formal')}</span>
                                            <div style={{ flex: 1, fontSize: '1rem', color: '#1a1a1a', lineHeight: '1.5' }}>
                                                <InteractiveSentence sentence={w.example_formal} wordBreakdown={w.word_breakdown} />
                                            </div>
                                            <button onClick={() => playAudio(w.example_formal, w.study_lang)} style={{ color: '#777', border: 'none', background: 'none' }}><Volume2 size={18} /></button>
                                        </div>
                                        <p style={{ margin: '0 0 0 4.8rem', fontSize: '0.9rem', color: '#888', fontWeight: '700' }} onClick={() => playAudio(w.example_formal_kr, w.user_lang)}>{w.example_formal_kr}</p>
                                    </div>
                                )}
                                {w.example_casual && (
                                    <div style={{ background: '#fff9f0', padding: '1.5rem', borderRadius: '20px', border: '1px solid #fff3e0' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', marginBottom: '0.6rem' }}>
                                            <span style={{ color: '#d35400', fontWeight: '900', minWidth: '70px' }}>🗣️ {t('label_casual')}</span>
                                            <div style={{ flex: 1, fontSize: '1rem', color: '#1a1a1a', lineHeight: '1.5' }}>
                                                <InteractiveSentence sentence={w.example_casual} wordBreakdown={w.word_breakdown} />
                                            </div>
                                            <button onClick={() => playAudio(w.example_casual, w.study_lang)} style={{ color: '#777', border: 'none', background: 'none' }}><Volume2 size={18} /></button>
                                        </div>
                                        <p style={{ margin: '0 0 0 4.8rem', fontSize: '0.9rem', color: '#888', fontWeight: '700' }} onClick={() => playAudio(w.example_casual_kr, w.user_lang)}>{w.example_casual_kr}</p>
                                    </div>
                                )}
                             </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', marginTop: '2rem', paddingTop: '1.2rem', borderTop: '2px solid #f0f0f0' }}>
                             <button onClick={(e) => handleDelete(w.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '900', fontSize: '1rem' }}><Trash2 size={18} /> {t('btn_delete')}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', marginTop: '2.5rem' }}>
                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '0.8rem 1.2rem', borderRadius: '15px', border: '2px solid #eee', background: '#fff', cursor: 'pointer', fontWeight: '800' }}>{t('list_prev_page')}</button>
                    <span style={{ fontWeight: '900', color: '#666' }}>{currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '0.8rem 1.2rem', borderRadius: '15px', border: '2px solid #eee', background: '#fff', cursor: 'pointer', fontWeight: '800' }}>{t('list_next_page')}</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button onClick={scrollToTop} style={{ position: 'fixed', bottom: '6.5rem', right: '2rem', width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary-color)', color: '#fff', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', cursor: 'pointer', zIndex: 1000, fontWeight: '900', fontSize: '1rem' }}>TOP</button>

      {isMoveModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div className="modal-content" style={{ background: '#fff', padding: '2.5rem', borderRadius: '35px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, textAlign: 'center', fontWeight: '900', fontSize: '1.4rem' }}>{t('list_move_modal_title')}</h3>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '1.5rem', fontWeight: '600' }}>{t('list_move_modal_desc')}</p>
            <select value={moveFolderId} onChange={e => setMoveFolderId(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '18px', border: '2.5px solid #eee', marginBottom: '2rem', outline: 'none', fontWeight: '700', fontSize: '1rem' }}>
              <option value="">{t('list_move_select_folder')}</option>
              {folders.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleMoveSelected} style={{ flex: 2, padding: '1.2rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 5px 0 #e67e22' }}>{t('btn_move_folder')}</button>
              <button onClick={() => setIsMoveModalOpen(false)} style={{ flex: 1, padding: '1.2rem', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer' }}>{t('btn_cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {selectedTeacherWord && (
        <AiTeacherModal
          wordData={selectedTeacherWord}
          onClose={() => setSelectedTeacherWord(null)}
          apiKey={localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY}
          modelName={localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash'}
          userLang={localStorage.getItem('inko_native_lang') || 'ko'}
          studyLang={selectedTeacherWord.study_lang}
        />
      )}
    </div>
  );
};

export default WordList;
