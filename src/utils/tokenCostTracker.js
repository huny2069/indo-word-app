/**
 * [v20.17] AI 모델별 토큰 및 비용 계산기 (KRW ₩, IDR Rp, USD $ 다국어 완벽 지원 유틸리티)
 * - 한국어(ko), 인도네시아어(id), 영어(en) UI 언어 자동 감지 및 번역 제공
 */

export const EXCHANGE_RATES = {
  KRW: 1380,   // 1 USD = 1,380 KRW
  IDR: 16000   // 1 USD = 16,000 IDR
};

const getCurrentUserLang = () => {
  try {
    return localStorage.getItem('userLang') || 'ko';
  } catch {
    return 'ko';
  }
};

// 1백만(1M) 토큰당 구글 공식 문서 Standard USD ($) 단가표
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

// 화폐 포맷 헬퍼 (USD -> KRW ₩, IDR Rp) - 다국어 지원
export const formatCost = (usd) => {
  const lang = getCurrentUserLang();
  if (usd === 0) {
    return {
      usdText: '$0.00',
      krwText: lang === 'ko' ? '0원' : '₩0',
      idrText: '0 Rp',
      rawUsd: 0,
      rawKrw: 0,
      rawIdr: 0
    };
  }

  const krw = usd * EXCHANGE_RATES.KRW;
  const idr = usd * EXCHANGE_RATES.IDR;

  const krwText = lang === 'ko'
    ? (krw < 0.01 ? '약 0.01원 미만' : krw < 1 ? `약 ${krw.toFixed(2)}원` : `약 ${krw.toFixed(1)}원`)
    : (krw < 0.01 ? '< ₩0.01' : krw < 1 ? `~₩${krw.toFixed(2)}` : `~₩${krw.toFixed(1)}`);

  const idrText = lang === 'ko'
    ? (idr < 0.1 ? '약 0.1 Rp 미만' : idr < 10 ? `약 ${idr.toFixed(1)} Rp` : `약 ${Math.round(idr).toLocaleString()} Rp`)
    : (idr < 0.1 ? '< 0.1 Rp' : idr < 10 ? `~${idr.toFixed(1)} Rp` : `~${Math.round(idr).toLocaleString()} Rp`);

  return {
    usdText: `$${usd < 0.0001 ? usd.toFixed(6) : usd.toFixed(4)}`,
    krwText,
    idrText,
    rawUsd: usd,
    rawKrw: krw,
    rawIdr: idr
  };
};

export const getEstimatedTokensAndCost = (actionType, modelId, options = {}) => {
  const lang = getCurrentUserLang();
  const rates = getModelRates(modelId);
  const count = options.count || 1;
  const ttsEngine = options.ttsEngine || localStorage.getItem('tts_engine') || 'google';

  let inputTokens = 0;
  let outputTokens = 0;
  let textChars = 0;
  let usdCost = 0;
  let title = '';

  const engineLabel = ttsEngine === 'google'
    ? 'Google HD'
    : (lang === 'id' ? 'TTS Dasar' : lang === 'en' ? 'Basic TTS' : '기본 TTS');

  switch (actionType) {
    case 'generate':
      inputTokens = 1200;
      outputTokens = count * 550;
      usdCost = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;
      title = lang === 'id' ? `Buat ${count} Kata` : lang === 'en' ? `Generate ${count} Words` : `단어 ${count}개 생성`;
      break;

    case 'regenerate':
      inputTokens = 1100 * count;
      outputTokens = 500 * count;
      usdCost = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;
      title = lang === 'id' ? `Regenerasi ${count} Kata` : lang === 'en' ? `Regenerate ${count} Words` : `단어 ${count}개 재생성`;
      break;

    case 'lecture':
      inputTokens = 650 * count;
      outputTokens = 950 * count;
      usdCost = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;
      title = lang === 'id' ? `Naskah Kuliah AI (${count})` : lang === 'en' ? `AI Lecture Script (${count})` : `특강 ${count}편 대본 생성`;
      break;

    case 'tts_word':
      textChars = 20 * count;
      usdCost = ttsEngine === 'google' ? (textChars / 1000000) * 16.00 : 0;
      title = lang === 'id' ? `Suara ${count} Kata (${engineLabel})` : lang === 'en' ? `Audio for ${count} Words (${engineLabel})` : `단어 ${count}개 음성 청취 (${engineLabel})`;
      break;

    case 'tts_lecture':
      textChars = 800 * count;
      usdCost = ttsEngine === 'google' ? (textChars / 1000000) * 16.00 : 0;
      title = lang === 'id' ? `Suara Kuliah AI (${engineLabel})` : lang === 'en' ? `Full Lecture Audio (${engineLabel})` : `특강 ${count}편 음성 완강 (${engineLabel})`;
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

export const calculateActualTtsCost = (charCount, ttsEngine = 'google') => {
  const lang = getCurrentUserLang();
  const totalUsd = ttsEngine === 'google' ? (charCount / 1000000) * 16.00 : 0;
  const formatted = formatCost(totalUsd);

  const freeTierNotice = ttsEngine === 'google'
    ? (lang === 'id' ? 'Gratis 1 juta karakter pertama/bulan' : lang === 'en' ? 'First 1M chars/month free tier' : '매월 최초 100만 글자 무료 제공 대상')
    : (lang === 'id' ? 'Mesin browser 100% gratis' : lang === 'en' ? 'Browser engine 100% free' : '브라우저 기본 엔진 100% 무료');

  return {
    ttsEngine,
    charCount,
    isFree: ttsEngine === 'browser',
    freeTierNotice,
    ...formatted
  };
};

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

const saveTokenUsageStats = (stats) => {
  try {
    stats.updatedAt = new Date().toISOString();
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    window.dispatchEvent(new CustomEvent('token_usage_updated', { detail: { stats } }));
  } catch (e) {
    console.error('Failed to save token stats:', e);
  }
};

export const recordTokenUsage = (actionKey, usageMetadata, modelId) => {
  if (!usageMetadata) return;
  const costData = calculateActualTokenCost(usageMetadata, modelId);
  if (!costData) return;

  const stats = getTokenUsageStats();
  const key = stats.byAction[actionKey] ? actionKey : 'generate';

  stats.byAction[key].inputTokens += costData.promptTokens;
  stats.byAction[key].outputTokens += costData.candidatesTokens;
  stats.byAction[key].totalTokens += costData.totalTokens;
  stats.byAction[key].usdCost += costData.rawUsd;
  stats.byAction[key].count += 1;

  stats.total.inputTokens += costData.promptTokens;
  stats.total.outputTokens += costData.candidatesTokens;
  stats.total.totalTokens += costData.totalTokens;
  stats.total.usdCost += costData.rawUsd;
  stats.total.count += 1;

  saveTokenUsageStats(stats);
  return costData;
};

export const recordTtsUsage = (charCount, ttsEngine = 'google') => {
  if (!charCount || charCount <= 0) return;
  const ttsData = calculateActualTtsCost(charCount, ttsEngine);

  const stats = getTokenUsageStats();
  stats.byAction.tts.chars += charCount;
  stats.byAction.tts.usdCost += ttsData.rawUsd;
  stats.byAction.tts.count += 1;

  stats.total.usdCost += ttsData.rawUsd;
  stats.total.count += 1;

  saveTokenUsageStats(stats);
  return ttsData;
};

export const resetTokenUsageStats = () => {
  localStorage.removeItem(STATS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('token_usage_updated', { detail: { stats: DEFAULT_STATS } }));
};

export const confirmActionWithTokenEstimate = (actionType, modelId, options = {}) => {
  if (!isTokenCostVisible()) return true;

  const lang = getCurrentUserLang();
  const est = getEstimatedTokensAndCost(actionType, modelId, options);
  const count = options.count || 1;

  if (lang === 'id') {
    const actionNamesId = {
      generate: `Buat Kata (${count} kata)`,
      regenerate: `Regenerasi Kata (${count} kata)`,
      lecture: `Buat Kuliah AI`,
      tts_word: `Putar Suara Kata`,
      tts_lecture: `Putar Suara Kuliah AI`
    };
    return window.confirm(
`🪙 [Konfirmasi Estimasi Token & Biaya]
━━━━━━━━━━━━━━━━━━━━
📌 Tugas: ${actionNamesId[actionType] || 'Tugas AI'}
🤖 Model: ${est.modelName}

📥 Estimasi Token Input: ~${est.inputTokens.toLocaleString()} T
📤 Estimasi Token Output: ~${est.outputTokens.toLocaleString()} T
📊 Total Estimasi Token: ~${est.totalTokens.toLocaleString()} T

💰 Estimasi Biaya: Rp ${est.idrText} / ₩${est.krwText} (${est.usdText})
━━━━━━━━━━━━━━━━━━━━
Lanjutkan proses ini?`
    );
  }

  if (lang === 'en') {
    const actionNamesEn = {
      generate: `Generate Words (${count})`,
      regenerate: `Regenerate Words (${count})`,
      lecture: `Generate AI Lecture`,
      tts_word: `Play Word Audio`,
      tts_lecture: `Play AI Lecture Audio`
    };
    return window.confirm(
`🪙 [Estimated Token & Cost Confirmation]
━━━━━━━━━━━━━━━━━━━━
📌 Action: ${actionNamesEn[actionType] || 'AI Task'}
🤖 Model: ${est.modelName}

📥 Est. Input Tokens: ~${est.inputTokens.toLocaleString()} T
📤 Est. Output Tokens: ~${est.outputTokens.toLocaleString()} T
📊 Total Est. Tokens: ~${est.totalTokens.toLocaleString()} T

💰 Est. Cost: ${est.usdText} (${est.krwText} / ${est.idrText})
━━━━━━━━━━━━━━━━━━━━
Do you want to proceed?`
    );
  }

  const actionNamesKo = {
    generate: `단어생성 (${count}개)`,
    regenerate: `단어 재생성 (${count}개)`,
    lecture: `스타강사 특강 생성`,
    tts_word: `단어 음성 재생`,
    tts_lecture: `특강 연속 음성 듣기`
  };
  return window.confirm(
`🪙 [예상 토큰 및 요금 사전 확인]
━━━━━━━━━━━━━━━━━━━━
📌 작업: ${actionNamesKo[actionType] || 'AI 작업'}
🤖 모델: ${est.modelName}

📥 예상 입력 토큰: 약 ${est.inputTokens.toLocaleString()} T
📤 예상 출력 토큰: 약 ${est.outputTokens.toLocaleString()} T
📊 총 예상 토큰: 약 ${est.totalTokens.toLocaleString()} T

💰 예상 요금: ₩${est.krwText} / Rp ${est.idrText} (${est.usdText})
━━━━━━━━━━━━━━━━━━━━
이 작업으로 진행하시겠습니까?`
  );
};

export const alertActualTokenCost = (actionType, usageMetadata, modelId) => {
  if (!isTokenCostVisible() || !usageMetadata) return;

  const lang = getCurrentUserLang();
  const costData = calculateActualTokenCost(usageMetadata, modelId);
  if (!costData) return;

  if (lang === 'id') {
    const actionNamesId = {
      generate: 'Pembuatan Kata Selesai! 🎉',
      regenerate: 'Regenerasi Kata Selesai! ✨',
      lecture: 'Kuliah AI Selesai Dibuat! 🎓'
    };
    window.alert(
`✅ [Hasil Penggunaan Token & Biaya Aktual]
━━━━━━━━━━━━━━━━━━━━
📌 Tugas: ${actionNamesId[actionType] || 'Selesai!'}
🤖 Model: ${costData.modelName}

📥 Token Input Aktual: ${costData.promptTokens.toLocaleString()} T
📤 Token Output Aktual: ${costData.candidatesTokens.toLocaleString()} T
📊 Total Token Terpakai: ${costData.totalTokens.toLocaleString()} T

💰 Biaya Aktual: Rp ${costData.idrText} / ₩${costData.krwText} (${costData.usdText})
━━━━━━━━━━━━━━━━━━━━
💡 Telah ditambahkan ke [Total Penggunaan Token & Biaya] di tab Pengaturan.`
    );
    return;
  }

  if (lang === 'en') {
    const actionNamesEn = {
      generate: 'Word Generation Complete! 🎉',
      regenerate: 'Word Regeneration Complete! ✨',
      lecture: 'AI Lecture Generated! 🎓'
    };
    window.alert(
`✅ [Actual Token & Cost Result]
━━━━━━━━━━━━━━━━━━━━
📌 Action: ${actionNamesEn[actionType] || 'Completed!'}
🤖 Model: ${costData.modelName}

📥 Actual Input Tokens: ${costData.promptTokens.toLocaleString()} T
📤 Actual Output Tokens: ${costData.candidatesTokens.toLocaleString()} T
📊 Total Tokens Used: ${costData.totalTokens.toLocaleString()} T

💰 Actual Cost: ${costData.usdText} (${costData.krwText} / ${costData.idrText})
━━━━━━━━━━━━━━━━━━━━
💡 Safely added to [Cumulative Token & Cost Usage] in Settings.`
    );
    return;
  }

  const actionNamesKo = {
    generate: '단어생성 완료! 🎉',
    regenerate: '단어 재생성 완료! ✨',
    lecture: '스타강사 특강 생성 완료! 🎓'
  };
  window.alert(
`✅ [실제 발생 토큰 및 요금 결과]
━━━━━━━━━━━━━━━━━━━━
📌 작업: ${actionNamesKo[actionType] || '작업 완료!'}
🤖 적용 모델: ${costData.modelName}

📥 실제 입력 토큰: ${costData.promptTokens.toLocaleString()} T
📤 실제 출력 토큰: ${costData.candidatesTokens.toLocaleString()} T
📊 총 소모 토큰: ${costData.totalTokens.toLocaleString()} T

💰 발생 요금: ₩${costData.krwText} / Rp ${costData.idrText} (${costData.usdText})
━━━━━━━━━━━━━━━━━━━━
💡 설정 탭의 [내 토큰 & 요금 누적 사용량]에 안전하게 합산되었습니다.`
  );
};

export const confirmTtsWithEstimate = (charCount, ttsEngine = 'google', label = '') => {
  if (!isTokenCostVisible()) return true;

  const lang = getCurrentUserLang();
  const ttsData = calculateActualTtsCost(charCount, ttsEngine);

  if (lang === 'id') {
    const engineName = ttsEngine === 'google' ? 'Google HD Premium' : 'Mesin Browser (Gratis)';
    return window.confirm(
`🎙️ [Konfirmasi Estimasi Biaya Suara TTS]
━━━━━━━━━━━━━━━━━━━━
📌 Tugas: ${label || 'Putar Suara'}
🔊 Mesin: ${engineName}
📝 Estimasi Karakter: ~${charCount.toLocaleString()} karakter

💰 Estimasi Biaya: Rp ${ttsData.idrText} / ₩${ttsData.krwText} (${ttsData.usdText})
ℹ️ ${ttsData.freeTierNotice}
━━━━━━━━━━━━━━━━━━━━
Putar suara sekarang?`
    );
  }

  if (lang === 'en') {
    const engineName = ttsEngine === 'google' ? 'Google HD Premium' : 'Browser Engine (Free)';
    return window.confirm(
`🎙️ [Estimated TTS Audio Cost Confirmation]
━━━━━━━━━━━━━━━━━━━━
📌 Action: ${label || 'Audio Playback'}
🔊 Engine: ${engineName}
📝 Est. Characters: ~${charCount.toLocaleString()} chars

💰 Est. Cost: ${ttsData.usdText} (${ttsData.krwText} / ${ttsData.idrText})
ℹ️ ${ttsData.freeTierNotice}
━━━━━━━━━━━━━━━━━━━━
Do you want to play the audio?`
    );
  }

  const engineName = ttsEngine === 'google' ? 'Google HD Premium' : '브라우저 기본 엔진 (무료)';
  return window.confirm(
`🎙️ [TTS 음성 재생 예상 비용 확인]
━━━━━━━━━━━━━━━━━━━━
📌 작업: ${label || '음성 재생'}
🔊 엔진: ${engineName}
📝 예상 글자수: 약 ${charCount.toLocaleString()} 자

💰 예상 요금: ₩${ttsData.krwText} / Rp ${ttsData.idrText} (${ttsData.usdText})
ℹ️ ${ttsData.freeTierNotice}
━━━━━━━━━━━━━━━━━━━━
음성을 재생하시겠습니까?`
  );
};

export const alertActualTtsCost = (charCount, ttsEngine = 'google', label = '') => {
  if (!isTokenCostVisible() || !charCount) return;

  const lang = getCurrentUserLang();
  const ttsData = calculateActualTtsCost(charCount, ttsEngine);

  if (lang === 'id') {
    window.alert(
`🔊 [Info Biaya Suara TTS]
━━━━━━━━━━━━━━━━━━━━
📌 Tugas: ${label || 'Putar Suara'} Selesai
📝 Karakter Disintesis: ${charCount.toLocaleString()} karakter
💰 Biaya Aktual: Rp ${ttsData.idrText} / ₩${ttsData.krwText} (${ttsData.usdText})
ℹ️ ${ttsData.freeTierNotice}
━━━━━━━━━━━━━━━━━━━━
💡 Telah ditambahkan ke [Total Penggunaan Token & Biaya] di Pengaturan.`
    );
    return;
  }

  if (lang === 'en') {
    window.alert(
`🔊 [TTS Audio Cost Summary]
━━━━━━━━━━━━━━━━━━━━
📌 Action: ${label || 'Audio Playback'} Complete
📝 Synthesized Characters: ${charCount.toLocaleString()} chars
💰 Actual Cost: ${ttsData.usdText} (${ttsData.krwText} / ${ttsData.idrText})
ℹ️ ${ttsData.freeTierNotice}
━━━━━━━━━━━━━━━━━━━━
💡 Safely added to [Cumulative Token & Cost Usage] in Settings.`
    );
    return;
  }

  window.alert(
`🔊 [TTS 음성 재생 요금 안내]
━━━━━━━━━━━━━━━━━━━━
📌 작업: ${label || '음성 재생'} 완료
📝 실제 합성 글자수: ${charCount.toLocaleString()} 자
💰 발생 요금: ₩${ttsData.krwText} / Rp ${ttsData.idrText} (${ttsData.usdText})
ℹ️ ${ttsData.freeTierNotice}
━━━━━━━━━━━━━━━━━━━━
💡 설정 탭의 [내 토큰 & 요금 누적 사용량]에 안전하게 합산되었습니다.`
  );
};
