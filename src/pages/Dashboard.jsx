import React, { useEffect, useState } from 'react';
import { getWords, clearCart, addWordsToCart } from '../db/database';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

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
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCostUsd, setTotalCostUsd] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const words = await getWords();
      const now = new Date();

      let memorized = 0;
      let reviewNeeded = 0;
      let learning = 0;

      // 에빙하우스 이론 적용 (Level 5 이상 시 장기기억/Mastered로 간주)
      words.forEach(w => {
        const nextReview = new Date(w.next_review_date);
        
        // memory_status 필드가 있으면 우선 활용, 없으면 레벨 기반 판정
        const isMastered = w.memory_status === 'long_term' || w.level >= 5;
        const isUnlearned = !w.level || w.level === 0;
        const isReviewNeeded = nextReview <= now && w.level > 0 && !isMastered;

        if (isMastered) {
          memorized++;
        } else if (isReviewNeeded) {
          reviewNeeded++;
        } else {
          learning++;
        }
      });

      setStats({
        total: words.length,
        memorized,
        learning,
        reviewNeeded
      });
      
      // 스트릭 계산 로직 (로컬스토리지 기반 간이 판정)
      const currentStreak = parseInt(localStorage.getItem('study_streak') || '0', 10);
      setStreak(currentStreak);
      
      // 토큰 사용량 및 비용 적용
      setTotalTokens(parseInt(localStorage.getItem('total_gemini_tokens') || '0', 10));
      setTotalCostUsd(parseFloat(localStorage.getItem('total_gemini_cost_usd') || '0'));
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
      await clearCart();
      await addWordsToCart(reviewWords.map(w => w.id));
      navigate('/learn');
    }
  };

  return (
    <div className="page" style={{ paddingBottom: '3rem', textAlign: 'center' }}>
      <img src="/assets/img/nana.png" className="nana-character" style={{ width: '100px', marginBottom: '1rem' }} alt="Nana" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', textAlign: 'left' }}>
         <div>
            <h2 style={{fontSize: '2rem', color: 'var(--nana-dark)', marginBottom: '0.4rem', marginTop: 0, fontWeight: '900'}}>{t('dash_title')}</h2>
            <p style={{color: '#666', margin: 0, fontWeight: '500'}}>{t('dash_desc')}</p>
         </div>
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #c8e6c9', padding: '0.4rem 1rem', borderRadius: '30px', color: '#2e7d32', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                💡 {t('dash_tokens')}: {totalTokens.toLocaleString()}
            </div>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '0.4rem 1rem', borderRadius: '30px', color: '#c2410c', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                💰 {t('dash_cost')}: 約 {Math.round(totalCostUsd * 1503.31).toLocaleString()}원
            </div>
         </div>
      </div>
      
      {/* 주요 통계 카드 (스트릭, 총 단어수, 복습 필요) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        {/* Streak Card */}
        <div style={{ padding: '2.5rem', background: 'linear-gradient(135deg, #feca57, #ff9f43)', color: '#fff', borderRadius: '30px', boxShadow: '0 10px 0 #e67e22', position: 'relative', overflow: 'hidden', textAlign: 'left' }}>
          <h3 style={{margin: 0, fontWeight: '900', opacity: 0.9, fontSize: '1.1rem'}}>{t('dash_streak_title')}</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.8rem' }}>
            <span style={{ fontSize: '4rem', fontWeight: '900' }}>{streak}</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{t('dash_streak_suffix')}</span>
          </div>
          <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '7rem', opacity: 0.2 }}>🍌</div>
        </div>

        {/* Total Words Card */}
        <div style={{ padding: '2rem', background: '#fff', borderRadius: '30px', border: '3px solid #f1f3f5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', boxShadow: '0 8px 0 #f1f3f5' }}>
          <h3 style={{margin: 0, color: '#666', fontWeight: 'bold'}}>{t('dash_wordbook_size')}</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.8rem' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: '900', color: 'var(--nana-dark)' }}>{stats.total}</span>
            <span style={{ fontSize: '1.2rem', color: '#888', fontWeight: 'bold' }}>{t('dash_word_unit')}</span>
          </div>
          <div style={{ width: '100%', height: '12px', background: '#f1f3f5', borderRadius: '6px', overflow: 'hidden', marginTop: '1.2rem' }}>
             <div style={{ width: `${stats.total > 0 ? (stats.memorized / stats.total) * 100 : 0}%`, background: 'linear-gradient(90deg, #feca57, #1dd1a1)', height: '100%', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}></div>
          </div>
          <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.85rem', color: '#f39c12', textAlign: 'right', fontWeight: 'bold' }}>{t('dash_master_prob')}: {stats.total > 0 ? Math.round((stats.memorized / stats.total) * 100) : 0}%</p>
        </div>

      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, color: '#333' }}>{t('dash_report_title')}</h3>
          {stats.reviewNeeded > 0 && (
             <button 
                onClick={handleReviewNow}
                style={{ background: '#c2185b', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 8px rgba(194, 24, 91, 0.3)', transition: 'transform 0.2s, box-shadow 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(194, 24, 91, 0.4)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(194, 24, 91, 0.3)'; }}
             >
                ▶ {t('dash_review_btn')} ({stats.reviewNeeded}{t('dash_word_unit')})
             </button>
          )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '2rem 1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderTop: '4px solid #1976d2', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{fontSize: '2.5rem', fontWeight: '800', color: '#1976d2'}}>{stats.learning}</div>
          <div style={{color: '#555', marginTop: '0.5rem', fontWeight: 'bold'}}>{t('dash_status_learning')}</div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>{t('dash_learning_detail')}</div>
        </div>
        
        <div style={{ padding: '2rem 1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderTop: '4px solid #c2185b', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', position: 'relative' }}>
          {stats.reviewNeeded > 0 && <span className="pulse-dot" style={{ position: 'absolute', top: '15px', right: '15px', width: '12px', height: '12px', background: '#c2185b', borderRadius: '50%' }}></span>}
          <div style={{fontSize: '2.5rem', fontWeight: '800', color: '#c2185b'}}>{stats.reviewNeeded}</div>
          <div style={{color: '#555', marginTop: '0.5rem', fontWeight: 'bold'}}>{t('dash_status_review')}</div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>{t('dash_review_detail')}</div>
        </div>
        
        <div style={{ padding: '2rem 1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderTop: '4px solid #388e3c', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{fontSize: '2.5rem', fontWeight: '800', color: '#388e3c'}}>{stats.memorized}</div>
          <div style={{color: '#555', marginTop: '0.5rem', fontWeight: 'bold'}}>{t('dash_status_master')}</div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>{t('dash_master_detail')}</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
