/**
 * [v20.12] AI 모델별 토큰 및 비용 계산기 (KRW ₩, IDR Rp 환산 유틸리티)
 * - 각 Gemini 모델별 고유 단가(입력/출력 1M 토큰당 가격) 정밀 적용
 * - Google Cloud TTS 프리미엄(글자당 단가) 및 기본 브라우저 TTS(무료) 계산
 * - 작업별(단어생성, 재생성, 스타강사특강, TTS) 예상치 & 실제 결과치 계산
 * - 사용자 온/오프(On/Off) 토글 설정 연동
 */

export const EXCHANGE_RATES = {
  KRW: 1380,   // 1 USD = 1,380 KRW
  IDR: 16000   // 1 USD = 16,000 IDR
};

// 1백만(1M) 토큰당 구글 공식 문서(https://ai.google.dev/gemini-api/docs/pricing) Standard USD ($) 단가표
export const MODEL_PRICING = {
  'gemini-3.8-flash':      { input: 0.75,  output: 3.75, name: 'Gemini 3.8 Flash' },
  'gemini-3.7-flash':      { input: 0.75,  output: 3.75, name: 'Gemini 3.7 Flash' },
  'gemini-3.5-pro':        { input: 2.00,  output: 12.00, name: 'Gemini 3.5 Pro' },
  'gemini-3.5-flash':      { input: 1.50,  output: 9.00, name: 'Gemini 3.5 Flash' },
  'gemini-3.5-flash-lite': { input: 0.30,  output: 2.50, name: 'Gemini 3.5 Flash-Lite' },
  'gemini-3.1-pro':        { input: 2.00,  output: 12.00, name: 'Gemini 3.1 Pro' },
  'gemini-3.1-flash-lite': { input: 0.25,  output: 1.50, name: 'Gemini 3.1 Flash-Lite' },
  'gemini-3.0-flash':      { input: 0.30,  output: 2.50, name: 'Gemini 3.0 Flash' },
  'gemini-2.5-pro':        { input: 1.25,  output: 10.00, name: 'Gemini 2.5 Pro' },
  'gemini-2.5-flash':      { input: 0.30,  output: 2.50, name: 'Gemini 2.5 Flash' },
  'gemini-2.5-flash-lite': { input: 0.15,  output: 0.60, name: 'Gemini 2.5 Flash-Lite' },
  'gemini-2.0-flash':      { input: 0.10,  output: 0.40, name: 'Gemini 2.0 Flash' },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30, name: 'Gemini 2.0 Flash-Lite' }
};

// 모델 ID 매칭 헬퍼
export const getModelRates = (modelId) => {
  if (!modelId) return MODEL_PRICING['gemini-3.8-flash'];
  const lower = modelId.toLowerCase().replace('models/', '');
  for (const [key, val] of Object.entries(MODEL_PRICING)) {
    if (lower === key || lower.includes(key) || key.includes(lower)) {
      return { ...val, modelId: key };
    }
  }
  if (lower.includes('pro')) return { ...MODEL_PRICING['gemini-3.5-pro'], modelId: 'gemini-3.5-pro' };
  if (lower.includes('lite')) return { ...MODEL_PRICING['gemini-3.1-flash-lite'], modelId: 'gemini-3.1-flash-lite' };
  return { ...MODEL_PRICING['gemini-3.8-flash'], modelId: 'gemini-3.8-flash' };
};

// 화폐 포맷 헬퍼 (USD -> KRW ₩, IDR Rp)
export const formatCost = (usd) => {
  if (usd === 0) {
    return {
      usdText: '$0.00',
      krwText: '0원',
      idrText: '0 Rp',
      rawUsd: 0,
      rawKrw: 0,
      rawIdr: 0
    };
  }

  const krw = usd * EXCHANGE_RATES.KRW;
  const idr = usd * EXCHANGE_RATES.IDR;

  return {
    usdText: `$${usd < 0.0001 ? usd.toFixed(6) : usd.toFixed(4)}`,
    krwText: krw < 0.01 ? '약 0.01원 미만' : krw < 1 ? `약 ${krw.toFixed(2)}원` : `약 ${krw.toFixed(1)}원`,
    idrText: idr < 0.1 ? '약 0.1 Rp 미만' : idr < 10 ? `약 ${idr.toFixed(1)} Rp` : `약 ${Math.round(idr).toLocaleString()} Rp`,
    rawUsd: usd,
    rawKrw: krw,
    rawIdr: idr
  };
};

/**
 * 1. 작업별 예상 토큰 및 비용 계산기 (사전 견적)
 * @param {'generate' | 'regenerate' | 'lecture' | 'tts_word' | 'tts_lecture'} actionType 
 * @param {string} modelId 
 * @param {Object} options { count: 단어수, ttsEngine: 'google' | 'browser' }
 */
export const getEstimatedTokensAndCost = (actionType, modelId, options = {}) => {
  const rates = getModelRates(modelId);
  const count = options.count || 1;
  const ttsEngine = options.ttsEngine || localStorage.getItem('tts_engine') || 'google';

  let inputTokens = 0;
  let outputTokens = 0;
  let textChars = 0;
  let usdCost = 0;
  let title = '';

  switch (actionType) {
    case 'generate':
      // 단어 생성: 기본 시스템 프롬프트 약 1,200 토큰 + 단어당 약 550 토큰 출력
      inputTokens = 1200;
      outputTokens = count * 550;
      usdCost = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;
      title = `단어 ${count}개 생성`;
      break;

    case 'regenerate':
      // 단어 정밀 재생성: 단어 1개 기준 입력 약 1,100 토큰 + 출력 약 500 토큰
      inputTokens = 1100 * count;
      outputTokens = 500 * count;
      usdCost = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;
      title = `단어 ${count}개 재생성`;
      break;

    case 'lecture':
      // 스타강사 특강 1편(7개 슬라이드): 입력 약 650 토큰 + 출력 약 950 토큰
      inputTokens = 650 * count;
      outputTokens = 950 * count;
      usdCost = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;
      title = `특강 ${count}편 대본 생성`;
      break;

    case 'tts_word':
      // 단어 1개 음성 재생: 평균 20자
      textChars = 20 * count;
      if (ttsEngine === 'google') {
        usdCost = (textChars / 1000000) * 16.00; // $16 / 1M chars
      } else {
        usdCost = 0; // 브라우저 TTS 무료
      }
      title = `단어 ${count}개 음성 청취 (${ttsEngine === 'google' ? 'Google HD' : '기본 TTS'})`;
      break;

    case 'tts_lecture':
      // 특강 1편 전체 음성 완강 (7개 슬라이드 합산 약 800자)
      textChars = 800 * count;
      if (ttsEngine === 'google') {
        usdCost = (textChars / 1000000) * 16.00;
      } else {
        usdCost = 0;
      }
      title = `특강 ${count}편 음성 완강 (${ttsEngine === 'google' ? 'Google HD' : '기본 TTS'})`;
      break;

    default:
      break;
  }

  const costFormatted = formatCost(usdCost);

  return {
    actionType,
    title,
    modelName: rates.name,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    textChars,
    ttsEngine,
    ...costFormatted
  };
};

/**
 * 2. 실제 API 응답 결과값(usageMetadata) 기반 정밀 계산기
 * @param {Object} usageMetadata { promptTokenCount, candidatesTokenCount, totalTokenCount }
 * @param {string} modelId 
 */
export const calculateActualTokenCost = (usageMetadata, modelId) => {
  if (!usageMetadata) return null;

  const rates = getModelRates(modelId);
  const promptTokens = usageMetadata.promptTokenCount || 0;
  const candidatesTokens = usageMetadata.candidatesTokenCount || 0;
  const totalTokens = usageMetadata.totalTokenCount || (promptTokens + candidatesTokens);

  const inputUsd = (promptTokens / 1000000) * rates.input;
  const outputUsd = (candidatesTokens / 1000000) * rates.output;
  const totalUsd = inputUsd + outputUsd;

  const formatted = formatCost(totalUsd);

  return {
    modelId: rates.modelId,
    modelName: rates.name,
    promptTokens,
    candidatesTokens,
    totalTokens,
    inputUsd,
    outputUsd,
    ...formatted
  };
};

/**
 * 3. 실제 TTS 음성 출력 글자 수 기반 비용 계산기
 * @param {number} charCount 합성된 문자 수
 * @param {'google' | 'browser' | 'gemini'} ttsEngine 
 */
export const calculateActualTtsCost = (charCount, ttsEngine = 'google') => {
  let totalUsd = 0;

  if (ttsEngine === 'google') {
    // 100만 글자당 $16
    totalUsd = (charCount / 1000000) * 16.00;
  } else {
    totalUsd = 0;
  }

  const formatted = formatCost(totalUsd);

  return {
    ttsEngine,
    charCount,
    isFree: ttsEngine === 'browser',
    freeTierNotice: ttsEngine === 'google' ? '매월 최초 100만 글자 무료 제공 대상' : '브라우저 기본 엔진 100% 무료',
    ...formatted
  };
};

/**
 * 4. 토큰 및 비용 표시 켜기/끄기 설정 헬퍼
 */
export const isTokenCostVisible = () => {
  return localStorage.getItem('show_token_cost') !== 'false';
};

export const setTokenCostVisible = (visible) => {
  localStorage.setItem('show_token_cost', visible ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('token_cost_toggle_changed', { detail: { visible } }));
};

const STATS_STORAGE_KEY = 'inko_token_usage_stats';

const DEFAULT_STATS = {
  total: { inputTokens: 0, outputTokens: 0, totalTokens: 0, usdCost: 0, count: 0 },
  byAction: {
    generate:   { name: '단어생성', inputTokens: 0, outputTokens: 0, totalTokens: 0, usdCost: 0, count: 0 },
    regenerate: { name: '단어 재생성', inputTokens: 0, outputTokens: 0, totalTokens: 0, usdCost: 0, count: 0 },
    lecture:    { name: '스타강사 특강', inputTokens: 0, outputTokens: 0, totalTokens: 0, usdCost: 0, count: 0 },
    tts:        { name: '음성엔진(TTS)', chars: 0, usdCost: 0, count: 0 }
  },
  updatedAt: new Date().toISOString()
};

/**
 * 5. 누적 토큰 및 비용 통계 조회
 */
export const getTokenUsageStats = () => {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw);
    return {
      total: { ...DEFAULT_STATS.total, ...(parsed.total || {}) },
      byAction: {
        generate:   { ...DEFAULT_STATS.byAction.generate,   ...(parsed.byAction?.generate || {}) },
        regenerate: { ...DEFAULT_STATS.byAction.regenerate, ...(parsed.byAction?.regenerate || {}) },
        lecture:    { ...DEFAULT_STATS.byAction.lecture,    ...(parsed.byAction?.lecture || {}) },
        tts:        { ...DEFAULT_STATS.byAction.tts,        ...(parsed.byAction?.tts || {}) }
      },
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch (e) {
    return { ...DEFAULT_STATS };
  }
};

/**
 * 6. 누적 토큰 및 비용 통계 저장 헬퍼
 */
const saveTokenUsageStats = (stats) => {
  try {
    stats.updatedAt = new Date().toISOString();
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    window.dispatchEvent(new CustomEvent('token_usage_updated', { detail: { stats } }));
  } catch (e) {
    console.error('Failed to save token stats:', e);
  }
};

/**
 * 7. AI 토큰 소모량 누적 기록
 */
export const recordTokenUsage = (actionKey, usageMetadata, modelId) => {
  if (!usageMetadata) return;
  const costData = calculateActualTokenCost(usageMetadata, modelId);
  if (!costData) return;

  const stats = getTokenUsageStats();
  const key = stats.byAction[actionKey] ? actionKey : 'generate';

  // 작업별 누적
  stats.byAction[key].inputTokens += costData.promptTokens;
  stats.byAction[key].outputTokens += costData.candidatesTokens;
  stats.byAction[key].totalTokens += costData.totalTokens;
  stats.byAction[key].usdCost += costData.rawUsd;
  stats.byAction[key].count += 1;

  // 총합 누적
  stats.total.inputTokens += costData.promptTokens;
  stats.total.outputTokens += costData.candidatesTokens;
  stats.total.totalTokens += costData.totalTokens;
  stats.total.usdCost += costData.rawUsd;
  stats.total.count += 1;

  saveTokenUsageStats(stats);
  return costData;
};

/**
 * 8. TTS 음성 사용량 누적 기록
 */
export const recordTtsUsage = (charCount, ttsEngine = 'google') => {
  if (!charCount || charCount <= 0) return;
  const ttsData = calculateActualTtsCost(charCount, ttsEngine);

  const stats = getTokenUsageStats();
  stats.byAction.tts.chars += charCount;
  stats.byAction.tts.usdCost += ttsData.rawUsd;
  stats.byAction.tts.count += 1;

  // 전체 요금 합산에 포함
  stats.total.usdCost += ttsData.rawUsd;
  stats.total.count += 1;

  saveTokenUsageStats(stats);
  return ttsData;
};

/**
 * 9. 누적 토큰 및 요금 전체 초기화 (리셋 기능)
 */
export const resetTokenUsageStats = () => {
  localStorage.removeItem(STATS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('token_usage_updated', { detail: { stats: DEFAULT_STATS } }));
};

/**
 * 10. [필수 팝업 1] 실행 전 예상 토큰 및 요금 확인 팝업 (진행하시겠습니까?)
 * - 토큰보기 기능이 켜져있을 때만 confirm 창을 띄우고, 꺼져있으면 즉시 true 반환
 */
export const confirmActionWithTokenEstimate = (actionType, modelId, options = {}) => {
  if (!isTokenCostVisible()) return true;

  const est = getEstimatedTokensAndCost(actionType, modelId, options);
  const actionNames = {
    generate: `단어생성 (${options.count || 1}개)`,
    regenerate: `단어 재생성 (${options.count || 1}개)`,
    lecture: `스타강사 특강 생성`,
    tts_word: `단어 음성 재생`,
    tts_lecture: `특강 연속 음성 듣기`
  };
  const actionName = actionNames[actionType] || 'AI 작업';

  const confirmMsg = 
`🪙 [예상 토큰 및 요금 사전 확인]
━━━━━━━━━━━━━━━━━━━━
📌 작업: ${actionName}
🤖 모델: ${est.modelName}

📥 예상 입력 토큰: 약 ${est.inputTokens.toLocaleString()} T
📤 예상 출력 토큰: 약 ${est.outputTokens.toLocaleString()} T
📊 총 예상 토큰: 약 ${est.totalTokens.toLocaleString()} T

💰 예상 요금: ₩${est.krwText} / Rp ${est.idrText} (${est.usdText})
━━━━━━━━━━━━━━━━━━━━
이 작업으로 진행하시겠습니까?`;

  return window.confirm(confirmMsg);
};

/**
 * 11. [필수 팝업 2] 작업 완료 후 실제 입력값, 출력값, 발생 요금 안내 팝업
 * - 토큰보기 기능이 켜져있을 때만 alert 안내
 */
export const alertActualTokenCost = (actionType, usageMetadata, modelId) => {
  if (!isTokenCostVisible() || !usageMetadata) return;

  const costData = calculateActualTokenCost(usageMetadata, modelId);
  if (!costData) return;

  const actionNames = {
    generate: '단어생성 완료! 🎉',
    regenerate: '단어 재생성 완료! ✨',
    lecture: '스타강사 특강 생성 완료! 🎓'
  };
  const actionName = actionNames[actionType] || '작업 완료!';

  const alertMsg = 
`✅ [실제 발생 토큰 및 요금 결과]
━━━━━━━━━━━━━━━━━━━━
📌 작업: ${actionName}
🤖 적용 모델: ${costData.modelName}

📥 실제 입력 토큰: ${costData.promptTokens.toLocaleString()} T
📤 실제 출력 토큰: ${costData.candidatesTokens.toLocaleString()} T
📊 총 소모 토큰: ${costData.totalTokens.toLocaleString()} T

💰 발생 요금: ₩${costData.krwText} / Rp ${costData.idrText} (${costData.usdText})
━━━━━━━━━━━━━━━━━━━━
💡 설정 탭의 [내 토큰 & 요금 누적 사용량]에 안전하게 합산되었습니다.`;

  window.alert(alertMsg);
};

/**
 * 12. TTS 음성 재생 전 예상 비용 확인 팝업
 */
export const confirmTtsWithEstimate = (charCount, ttsEngine = 'google', label = '음성 재생') => {
  if (!isTokenCostVisible()) return true;

  const ttsData = calculateActualTtsCost(charCount, ttsEngine);
  const engineName = ttsEngine === 'google' ? 'Google HD Premium' : '브라우저 기본 엔진 (무료)';

  const confirmMsg = 
`🎙️ [TTS 음성 재생 예상 비용 확인]
━━━━━━━━━━━━━━━━━━━━
📌 작업: ${label}
🔊 엔진: ${engineName}
📝 예상 글자수: 약 ${charCount.toLocaleString()} 자

💰 예상 요금: ₩${ttsData.krwText} / Rp ${ttsData.idrText} (${ttsData.usdText})
ℹ️ ${ttsData.freeTierNotice}
━━━━━━━━━━━━━━━━━━━━
음성을 재생하시겠습니까?`;

  return window.confirm(confirmMsg);
};

/**
 * 13. TTS 음성 재생 완료 후 실제 발생 요금 안내
 */
export const alertActualTtsCost = (charCount, ttsEngine = 'google', label = '음성 재생') => {
  if (!isTokenCostVisible() || !charCount) return;

  const ttsData = calculateActualTtsCost(charCount, ttsEngine);
  const alertMsg = 
`🔊 [TTS 음성 재생 요금 안내]
━━━━━━━━━━━━━━━━━━━━
📌 작업: ${label} 완료
📝 실제 합성 글자수: ${charCount.toLocaleString()} 자
💰 발생 요금: ₩${ttsData.krwText} / Rp ${ttsData.idrText} (${ttsData.usdText})
ℹ️ ${ttsData.freeTierNotice}
━━━━━━━━━━━━━━━━━━━━
💡 설정 탭의 [내 토큰 & 요금 누적 사용량]에 안전하게 합산되었습니다.`;

  window.alert(alertMsg);
};
