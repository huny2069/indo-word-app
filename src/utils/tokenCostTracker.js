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
