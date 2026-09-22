import React, { useState, useEffect } from 'react';
import { Coins, Sparkles, Volume2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  isTokenCostVisible, 
  getEstimatedTokensAndCost, 
  calculateActualTokenCost, 
  calculateActualTtsCost 
} from '../utils/tokenCostTracker';

/**
 * [v20.12] AI 모델별 예상 토큰 & 실제 결과값 및 화폐(KRW/IDR) 환산 카드 컴포넌트
 */
const TokenCostCard = ({ 
  mode = 'actual', // 'actual' | 'estimate'
  actionType = 'generate', // 'generate' | 'regenerate' | 'lecture' | 'tts_word' | 'tts_lecture'
  modelId,
  count = 1,
  usageMetadata = null,
  ttsEngine = null,
  charCount = 0,
  title = null,
  compact = false
}) => {
  const [visible, setVisible] = useState(isTokenCostVisible());
  const [isExpanded, setIsExpanded] = useState(!compact);

  useEffect(() => {
    const handleToggle = (e) => {
      setVisible(e.detail?.visible ?? isTokenCostVisible());
    };
    window.addEventListener('token_cost_toggle_changed', handleToggle);
    return () => window.removeEventListener('token_cost_toggle_changed', handleToggle);
  }, []);

  if (!visible) return null;

  const currentModel = modelId || localStorage.getItem('selectedGeminiModel') || 'gemini-3.8-flash';
  const currentEngine = ttsEngine || localStorage.getItem('tts_engine') || 'google';

  let displayData = null;

  if (mode === 'actual') {
    if (usageMetadata) {
      displayData = calculateActualTokenCost(usageMetadata, currentModel);
    }
    if (charCount > 0) {
      const ttsData = calculateActualTtsCost(charCount, currentEngine);
      if (!displayData) {
        displayData = { ...ttsData, isTtsOnly: true };
      } else {
        displayData.tts = ttsData;
      }
    }
  } else {
    // estimate
    displayData = getEstimatedTokensAndCost(actionType, currentModel, { count, ttsEngine: currentEngine });
  }

  if (!displayData) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      border: '1.5px solid #cbd5e1',
      borderRadius: '16px',
      padding: compact ? '0.6rem 0.9rem' : '0.9rem 1.2rem',
      fontSize: '0.85rem',
      color: '#334155',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      margin: '0.6rem 0',
      transition: 'all 0.2s ease'
    }}>
      {/* 헤더 줄 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '900' }}>
          <div style={{ 
            background: mode === 'actual' ? '#10b981' : '#6366f1', 
            color: '#fff', padding: '2px 6px', borderRadius: '6px', fontSize: '0.72rem' 
          }}>
            {mode === 'actual' ? '✨ 실제 사용' : '📊 예상 견적'}
          </div>
          <span style={{ color: '#1e293b' }}>
            {title || displayData.title || (mode === 'actual' ? 'AI 토큰 & 비용 결과' : '예상 토큰 및 비용')}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
            ({displayData.modelName})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 주요 환산 비용 뱃지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ 
              background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', 
              padding: '2px 8px', borderRadius: '10px', fontWeight: '900', fontSize: '0.82rem' 
            }}>
              🇰🇷 {displayData.krwText}
            </span>
            <span style={{ 
              background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', 
              padding: '2px 8px', borderRadius: '10px', fontWeight: '900', fontSize: '0.82rem' 
            }}>
              🇮🇩 {displayData.idrText}
            </span>
          </div>

          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', display: 'flex' }}
            title="상세 내역 보기"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* 펼쳤을 때 상세 내역 */}
      {isExpanded && (
        <div style={{ 
          marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed #cbd5e1', 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem',
          fontSize: '0.78rem', color: '#475569'
        }}>
          {!displayData.isTtsOnly && (
            <>
              <div>
                <strong style={{ color: '#059669' }}>입력 토큰:</strong>{' '}
                {mode === 'actual' ? displayData.promptTokens?.toLocaleString() : displayData.inputTokens?.toLocaleString()} tokens
              </div>
              <div>
                <strong style={{ color: '#2563eb' }}>출력 토큰:</strong>{' '}
                {mode === 'actual' ? displayData.candidatesTokens?.toLocaleString() : displayData.outputTokens?.toLocaleString()} tokens
              </div>
              <div>
                <strong style={{ color: '#7c3aed' }}>총 토큰:</strong>{' '}
                {mode === 'actual' ? displayData.totalTokens?.toLocaleString() : displayData.totalTokens?.toLocaleString()} tokens
              </div>
              <div>
                <strong style={{ color: '#475569' }}>USD 달러:</strong>{' '}
                {displayData.usdText}
              </div>
            </>
          )}

          {displayData.tts && (
            <div style={{ gridColumn: '1 / -1', background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              🎙️ <strong>TTS 프리미엄 음성:</strong> {displayData.tts.charCount}자 합성 |{' '}
              <span style={{ color: '#047857', fontWeight: '800' }}>🇰🇷 {displayData.tts.krwText}</span>{' '}
              <span style={{ color: '#1d4ed8', fontWeight: '800' }}>🇮🇩 ({displayData.tts.idrText})</span>{' '}
              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>({displayData.tts.freeTierNotice})</span>
            </div>
          )}

          {displayData.isTtsOnly && (
            <div style={{ gridColumn: '1 / -1' }}>
              🎙️ <strong>음성 글자 수:</strong> {displayData.charCount}자 ({displayData.ttsEngine === 'google' ? 'Google HD' : '기본 TTS'}) |{' '}
              <span style={{ color: '#64748b' }}>{displayData.freeTierNotice}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TokenCostCard;
