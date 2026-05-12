import React, { useEffect, useState } from 'react';
import { getWords, clearCart, addWordsToCart, getCartItemIds } from '../db/database';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { BarChart3, TrendingUp, AlertTriangle, Clock, X, ChevronRight, Award } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    total: 0,
    memorized: 0,
    learning: 0,
    reviewNeeded: 0
  });

  const [streak, setStreak] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [levelMap, setLevelMap] = useState({});
  const [hardWords, setHardWords] = useState([]);
  const [recentWords, setRecentWords] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      const words = await getWords();
      const now = new Date();

      let memorized = 0;
      let reviewNeeded = 0;
      let learning = 0;
      const levels = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      words.forEach(w => {
        const nextReview = new Date(w.next_review_date);
        const isMastered = w.memory_status === 'long_term' || w.level >= 5;
        const isReviewNeeded = nextReview <= now && w.level > 0 && !isMastered;

        if (isMastered) memorized++;
        else if (isReviewNeeded) reviewNeeded++;
        else learning++;

        const lv = Math.min(w.level || 0, 5);
        levels[lv] = (levels[lv] || 0) + 1;
      });

      setStats({ total: words.length, memorized, learning, reviewNeeded });
      setLevelMap(levels);
      setStreak(parseInt(localStorage.getItem('study_streak') || '0', 10));

      // Top 5 Hard Words
      const hard = [...words]
        .filter(w => w.incorrectCount > 0)
        .sort((a, b) => (b.incorrectCount || 0) - (a.incorrectCount || 0))
        .slice(0, 5);
      setHardWords(hard);

      // Recent Words (based on updated_at or similar, using last 5 words in list as proxy if no timestamp)
      const recent = [...words].slice(-5).reverse();
      setRecentWords(recent);
    };

    fetchStats();
  }, []);

  const handleReviewNow = async () => {
    const words = await getWords();
    const now = new Date();
    const reviewWords = words.filter(w => {
      const nextReview = new Date(w.next_review_date);
      return nextReview <= now && w.level > 0 && w.level < 4;
    });

    if (reviewWords.length > 0) {
      const cartItems = await getCartItemIds();
      if (cartItems.size > 0) {
        if (!window.confirm(t('msg_clear_cart_confirm'))) return;
      }
      await clearCart();
      await addWordsToCart(reviewWords.map(w => w.id));
      navigate('/learn');
    }
  };

  return (
    <div className="page" style={{ paddingBottom: '3rem', textAlign: 'center' }}>
      <img src="/assets/img/nana.png" className="nana-character" style={{ width: '100px', marginBottom: '1rem' }} alt="Nana" />
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{fontSize: '2rem', color: 'var(--nana-dark)', marginBottom: '0.4rem', marginTop: 0, fontWeight: '900'}}>{t('dash_title')}</h2>
        <p style={{color: '#666', margin: 0, fontWeight: '500'}}>{t('dash_desc')}</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div style={{ padding: '2rem', background: 'linear-gradient(135deg, #feca57, #ff9f43)', color: '#fff', borderRadius: '30px', boxShadow: '0 8px 0 #e67e22', position: 'relative', overflow: 'hidden', textAlign: 'left' }}>
          <h3 style={{margin: 0, fontWeight: '900', opacity: 0.9, fontSize: '1rem'}}>{t('dash_streak_title')}</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: '900' }}>{streak}</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{t('dash_streak_suffix')}</span>
          </div>
          <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '6rem', opacity: 0.2 }}>🍌</div>
        </div>

        <div style={{ padding: '2rem', background: '#fff', border: '3px solid #feca57', borderRadius: '30px', boxShadow: '0 8px 0 #fff7ed', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{margin: 0, fontWeight: '900', color: '#feca57', fontSize: '1rem'}}>{t('dash_wordbook_size')}</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: '900', color: 'var(--nana-dark)' }}>{stats.total}</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#666' }}>{t('dash_word_unit')}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#333', fontWeight: '900' }}>{t('dash_report_title')}</h3>
          <button 
            onClick={() => setShowDetail(true)}
            style={{ background: '#f8f9fa', color: '#666', border: '2px solid #eee', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {t('dash_report_detail_btn')} <ChevronRight size={14} />
          </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderTop: '4px solid #1976d2', borderRadius: '20px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{fontSize: '2.2rem', fontWeight: '900', color: '#1976d2'}}>{stats.learning}</div>
          <div style={{color: '#555', marginTop: '0.4rem', fontWeight: '800', fontSize: '0.9rem'}}>{t('dash_status_learning')}</div>
        </div>
        
        <div style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderTop: '4px solid #c2185b', borderRadius: '20px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', position: 'relative' }}>
          <div style={{fontSize: '2.2rem', fontWeight: '900', color: '#c2185b'}}>{stats.reviewNeeded}</div>
          <div style={{color: '#555', marginTop: '0.4rem', fontWeight: '800', fontSize: '0.9rem'}}>{t('dash_status_review')}</div>
          {stats.reviewNeeded > 0 && (
            <button onClick={handleReviewNow} style={{ marginTop: '0.8rem', background: '#c2185b', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '900', cursor: 'pointer' }}>
                {t('dash_review_btn').split(' ')[0]}
            </button>
          )}
        </div>
        
        <div style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderTop: '4px solid #388e3c', borderRadius: '20px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{fontSize: '2.2rem', fontWeight: '900', color: '#388e3c'}}>{stats.memorized}</div>
          <div style={{color: '#555', marginTop: '0.4rem', fontWeight: '800', fontSize: '0.9rem'}}>{t('dash_status_master')}</div>
        </div>
      </div>

      {/* Detailed Report Modal */}
      {showDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1rem' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '30px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', animation: 'modalIn 0.3s ease-out' }}>
            <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={20} color="var(--primary-color)" /> {t('dash_report_detail_btn')}
                </h3>
                <button onClick={() => setShowDetail(false)} style={{ background: '#f8f9fa', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
                    <X size={20} color="#999" />
                </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
                {/* 1. Level Distribution */}
                <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ textAlign: 'left', marginBottom: '1rem', fontSize: '1rem', fontWeight: '900', color: '#444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={18} color="#4facfe" /> {t('dash_detail_level_stat')}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '120px', gap: '8px', padding: '0 10px' }}>
                        {[0, 1, 2, 3, 4, 5].map(lv => {
                            const count = levelMap[lv] || 0;
                            const height = stats.total > 0 ? (count / stats.total) * 100 : 0;
                            return (
                                <div key={lv} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#999' }}>{count}</div>
                                    <div style={{ 
                                        width: '100%', 
                                        height: `${Math.max(height, 5)}%`, 
                                        background: lv >= 5 ? '#388e3c' : lv === 0 ? '#eee' : '#feca57', 
                                        borderRadius: '6px 6px 0 0',
                                        transition: 'height 1s ease-out'
                                    }}></div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '900', color: '#666' }}>Lv.{lv}{lv===5?'+':''}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Top Hard Words */}
                <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ textAlign: 'left', marginBottom: '1rem', fontSize: '1rem', fontWeight: '900', color: '#444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={18} color="#ff7675" /> {t('dash_detail_hard_words')}
                    </h4>
                    <div style={{ display: 'grid', gap: '0.8rem' }}>
                        {hardWords.length > 0 ? hardWords.map((w, i) => (
                            <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#fff5f5', borderRadius: '15px', border: '1px solid #ffebeb' }}>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: '900', color: '#d63031' }}>{w.word}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>{w.meaning}</div>
                                </div>
                                <div style={{ background: '#ff7675', color: '#fff', padding: '4px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '900' }}>
                                    {w.incorrectCount}{t('inc_suffix')}
                                </div>
                            </div>
                        )) : (
                            <div style={{ color: '#ccc', padding: '1rem' }}>기록이 없습니다.</div>
                        )}
                    </div>
                </div>

                {/* 3. Recent Activity */}
                <div>
                    <h4 style={{ textAlign: 'left', marginBottom: '1rem', fontSize: '1rem', fontWeight: '900', color: '#444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={18} color="#a29bfe" /> {t('dash_detail_recent_activity')}
                    </h4>
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                        {recentWords.map(w => (
                            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.8rem', background: '#f8f9fa', borderRadius: '12px', textAlign: 'left' }}>
                                <Award size={16} color={w.level >= 5 ? '#388e3c' : '#ccc'} />
                                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{w.word}</span>
                                <span style={{ fontSize: '0.8rem', color: '#999' }}>({w.meaning})</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
