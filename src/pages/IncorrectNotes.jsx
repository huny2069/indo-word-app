import React, { useState, useEffect } from 'react';
import { getWords, deleteWords, addWordsToCart, getCartItemIds, clearCart, toggleCartItem } from '../db/database';
import { playAudio } from '../api/ttsApi';
import { AlertCircle, Trash2, ArrowUpDown, Volume2, ShoppingCart, CheckCircle2 } from 'lucide-react';
import InteractiveSentence from '../components/InteractiveSentence';

const IncorrectNotes = () => {
  const [incorrectWords, setIncorrectWords] = useState([]);
  const [sortBy, setSortBy] = useState('countDesc'); // countDesc, countAsc, dateDesc
  const [loading, setLoading] = useState(true);
  const [cartIds, setCartIds] = useState(new Set());
  
  // 자세히 보기 토글용 상태 (WordList.jsx 참고)
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadData();
  }, [sortBy]);

  const loadData = async () => {
    setLoading(true);
    try {
        const allWords = await getWords();
        // incorrectCount가 1 이상인 단어만 필터링
        let filtered = allWords.filter(w => w.incorrectCount && w.incorrectCount > 0);

        // 정렬
        if (sortBy === 'countDesc') {
            filtered.sort((a, b) => b.incorrectCount - a.incorrectCount);
        } else if (sortBy === 'countAsc') {
            filtered.sort((a, b) => a.incorrectCount - b.incorrectCount);
        } else if (sortBy === 'dateDesc') {
            filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }

        setIncorrectWords(filtered);

        const currentCart = await getCartItemIds();
        setCartIds(new Set(currentCart));
    } catch (e) {
        console.error("오답노트 로딩 실패:", e);
    } finally {
        setLoading(false);
    }
  };

  const handleToggleCart = async (e, id) => {
    e.stopPropagation();
    const isAdded = await toggleCartItem(id);
    setCartIds(prev => {
      const next = new Set(prev);
      if (isAdded) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const clearAllIncorrect = async () => {
    if (!window.confirm('정말 모든 오답노트 기록을 삭제하시겠습니까? (틀린 횟수만 초기화되며 단어는 삭제되지 않습니다)')) {
        return;
    }
    
    // 이 기능은 추후 확장성을 위해 남겨둠.
    alert('이 기능은 준비 중입니다.');
  };

  if (loading) {
      return (
          <div className="page" style={{textAlign: 'center', marginTop: '5rem'}}>
              나나가 오답 노트를 뒤적이고 있어요... 🍌
          </div>
      );
  }

  return (
    <div className="page fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#d63031', margin: 0 }}>
                <AlertCircle size={32} />
                나나의 오답 노트
            </h1>
        </div>

        <div style={{ background: '#fff0f0', padding: '1.2rem', borderRadius: '20px', border: '3px solid #ff7675', marginBottom: '1.5rem', boxShadow: '0 4px 0 #ff7675' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#c0392b', fontWeight: 'bold' }}>
                🍌 총 <b>{incorrectWords.length}</b>개의 취약 단어가 있어요. 많이 틀린 단어일수록 윗부분에 나타납니다!
            </p>
        </div>

        <div className="toolbar" style={{ justifyContent: 'flex-start', gap: '1rem', background: '#f8f9fa', padding: '1rem', borderRadius: '15px' }}>
            <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="select-input"
                style={{ background: '#fff' }}
            >
                <option value="countDesc">🔻 많이 틀린 순</option>
                <option value="countAsc">🔺 적게 틀린 순</option>
                <option value="dateDesc">📅 최근 추가된 순</option>
            </select>
        </div>

        {incorrectWords.length === 0 ? (
            <div className="empty-state" style={{ padding: '4rem 2rem', background: '#f1f8e9', borderRadius: '20px', border: '3px dashed #7bed9f' }}>
                <CheckCircle2 size={64} color="#1dd1a1" style={{ marginBottom: '1rem' }} />
                <h3 style={{ color: '#10ac84' }}>훌륭해요! 오답이 하나도 없네요!</h3>
                <p style={{ color: '#2ed573' }}>학습 탭에 가서 나나와 함께 퀴즈를 풀어보세요.</p>
            </div>
        ) : (
            <div className="word-list" style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
                {incorrectWords.map((word) => (
                    <div 
                        key={word.id} 
                        className="word-item glass-effect" 
                        onClick={() => toggleExpand(word.id)}
                        style={{ cursor: 'pointer', borderLeft: '6px solid #ff7675', position: 'relative' }}
                    >
                        <div className="word-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                    <span className={`pos-tag ${word.pos === '명사' ? 'noun' : word.pos === '동사' ? 'verb' : word.pos === '형용사' ? 'adj' : 'other'}`}>
                                        {word.pos}
                                    </span>
                                    <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--nana-dark)' }}>{word.word}</h3>
                                    {/* 횟수 뱃지를 단어 제목 우측으로 자연스럽게 이동 */}
                                    <span style={{ background: '#ff7675', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '15px', fontWeight: '900', fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(255,118,117,0.3)' }}>
                                        {word.incorrectCount}회 오답 💦
                                    </span>
                                </div>
                                <p style={{ margin: 0, fontSize: '1.1rem', color: '#555', fontWeight: 'bold' }}>{word.meaning}</p>
                            </div>
                            
                            <div className="word-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                    className={`icon-btn ${cartIds.has(word.id) ? 'active' : ''}`}
                                    onClick={(e) => handleToggleCart(e, word.id)}
                                    title="장바구니 담기"
                                >
                                    <ShoppingCart size={20} fill={cartIds.has(word.id) ? "currentColor" : "none"} />
                                </button>
                                <button 
                                    className="icon-btn" 
                                    onClick={(e) => { e.stopPropagation(); playAudio(word.word); }}
                                    title="발음 듣기"
                                >
                                    <Volume2 size={20} />
                                </button>
                            </div>
                        </div>

                        {expandedId === word.id && (
                            <div className="word-details" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px dashed #ffeaa7' }}>
                                {/* 기존 WordList의 디테일 렌더링 방식 차용 */}
                                {word.example_formal && (
                                    <div className="detail-section">
                                        <h4 style={{ color: '#e17055', marginBottom: '0.5rem', fontSize: '0.9rem' }}>🌟 예문 (격식)</h4>
                                        <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #ffeaa7' }}>
                                            <InteractiveSentence sentence={word.example_formal} breakdown={word.word_breakdown} fontSize="1.05rem" />
                                            <p style={{ margin: '0.4rem 0 0 0', color: '#636e72', fontSize: '0.95rem' }}>{word.example_formal_kr}</p>
                                        </div>
                                    </div>
                                )}
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                    {word.synonym && (
                                    <div style={{ background: '#f8f9fa', padding: '0.8rem', borderRadius: '10px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#a4b0be', display: 'block', marginBottom: '0.3rem' }}>유의어</span>
                                        <strong>{word.synonym}</strong>
                                    </div>
                                    )}
                                    {word.antonym && (
                                    <div style={{ background: '#f8f9fa', padding: '0.8rem', borderRadius: '10px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#a4b0be', display: 'block', marginBottom: '0.3rem' }}>반의어</span>
                                        <strong>{word.antonym}</strong>
                                    </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

export default IncorrectNotes;
