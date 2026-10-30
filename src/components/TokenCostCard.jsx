import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  isTokenCostVisible, 
  getEstimatedTokensAndCost, 
  calculateActualTokenCost, 
  calculateActualTtsCost 
} from '../utils/tokenCostTracker';

/**
 * [v20.17] AI 모델별 예상 토큰 & 실제 결과값 및 화폐(KRW/IDR) 환산 카드 컴포넌트 (3개 국어 지원)
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
  const { userLang } = useLanguage();
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
    displayData = getEstimatedTokensAndCost(actionType, currentModel, { count, ttsEngine: currentEngine });
  }

  if (!displayData) return null;

  const badgeLabel = mode === 'actual'
    ? (userLang === 'id' ? '✨ Aktual' : userLang === 'en' ? '✨ Actual' : '✨ 실제 사용')
    : (userLang === 'id' ? '📊 Estimasi' : userLang === 'en' ? '📊 Estimate' : '📊 예상 견적');

  const defaultTitle = mode === 'actual'
    ? (userLang === 'id' ? 'Hasil Token & Biaya AI' : userLang === 'en' ? 'AI Token & Cost Result' : 'AI 토큰 & 비용 결과')
    : (userLang === 'id' ? 'Estimasi Token & Biaya' : userLang === 'en' ? 'Estimated Tokens & Cost' : '예상 토큰 및 비용');

  const labels = {
    input: userLang === 'id' ? 'Token Input:' : userLang === 'en' ? 'Input Tokens:' : '입력 토큰:',
    output: userLang === 'id' ? 'Token Output:' : userLang === 'en' ? 'Output Tokens:' : '출력 토큰:',
    total: userLang === 'id' ? 'Total Token:' : userLang === 'en' ? 'Total Tokens:' : '총 토큰:',
    usd: userLang === 'id' ? 'Dolar USD:' : userLang === 'en' ? 'USD Dollar:' : 'USD 달러:',
    ttsPremium: userLang === 'id' ? 'Suara Premium TTS:' : userLang === 'en' ? 'TTS Premium Voice:' : 'TTS 프리미엄 음성:',
    ttsChars: userLang === 'id' ? 'Jumlah Karakter Suara:' : userLang === 'en' ? 'Audio Characters:' : '음성 글자 수:',
    charUnit: userLang === 'id' ? 'karakter' : userLang === 'en' ? 'chars' : '자 합성',
    detailBtn: userLang === 'id' ? 'Lihat Detail' : userLang === 'en' ? 'View Details' : '상세 내역 보기'
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '900', flexWrap: 'wrap' }}>
          <div style={{ 
            background: mode === 'actual' ? '#10b981' : '#6366f1', 
            color: '#fff', padding: '2px 6px', borderRadius: '6px', fontSize: '0.72rem' 
          }}>
            {badgeLabel}
          </div>
          <span style={{ color: '#1e293b' }}>
            {title || displayData.title || defaultTitle}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
            ({displayData.modelName})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            title={labels.detailBtn}
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
                <strong style={{ color: '#059669' }}>{labels.input}</strong>{' '}
                {mode === 'actual' ? displayData.promptTokens?.toLocaleString() : displayData.inputTokens?.toLocaleString()} tokens
              </div>
              <div>
                <strong style={{ color: '#2563eb' }}>{labels.output}</strong>{' '}
                {mode === 'actual' ? displayData.candidatesTokens?.toLocaleString() : displayData.outputTokens?.toLocaleString()} tokens
              </div>
              <div>
                <strong style={{ color: '#7c3aed' }}>{labels.total}</strong>{' '}
                {displayData.totalTokens?.toLocaleString()} tokens
              </div>
              <div>
                <strong style={{ color: '#475569' }}>{labels.usd}</strong>{' '}
                {displayData.usdText}
              </div>
            </>
          )}

          {displayData.tts && (
            <div style={{ gridColumn: '1 / -1', background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              🎙️ <strong>{labels.ttsPremium}</strong> {displayData.tts.charCount} {labels.charUnit} |{' '}
              <span style={{ color: '#047857', fontWeight: '800' }}>🇰🇷 {displayData.tts.krwText}</span>{' '}
              <span style={{ color: '#1d4ed8', fontWeight: '800' }}>🇮🇩 ({displayData.tts.idrText})</span>{' '}
              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>({displayData.tts.freeTierNotice})</span>
            </div>
          )}

          {displayData.isTtsOnly && (
            <div style={{ gridColumn: '1 / -1' }}>
              🎙️ <strong>{labels.ttsChars}</strong> {displayData.charCount} {labels.charUnit} ({displayData.ttsEngine === 'google' ? 'Google HD' : 'Basic TTS'}) |{' '}
              <span style={{ color: '#64748b' }}>{displayData.freeTierNotice}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TokenCostCard;
