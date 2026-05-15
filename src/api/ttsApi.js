/**
 * 인도네시아어/한국어/영어 TTS(음성 합성) 통합 모듈 (v19.7)
 * 백업본 v9.6의 안정적인 구조를 기반으로 AI 선생님 순차 재생 기능을 추가했습니다.
 */

// 한글 포함 여부 체크 함수
const containsHangul = (text) => /[\u3131-\uD79D]/.test(text);

/**
 * 텍스트 언어 판별
 */
const getLangType = (text, langOverride = null) => {
  if (langOverride) return langOverride;
  if (containsHangul(text)) return 'ko';
  return 'id';
};

let currentAudioElement = null;
let isTtsCancelled = false;

export const stopTTS = () => {
  isTtsCancelled = true;
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

export const playAudio = async (text, lang = null, voiceName = null) => {
  if (!text) return;
  isTtsCancelled = false;
  
  const isAudioEnabled = localStorage.getItem('is_audio_enabled') !== 'false';
  if (!isAudioEnabled) return;

  const targetLang = getLangType(text, lang);
  const preferredEngine = localStorage.getItem('tts_engine') || 'google';

  try {
    if (preferredEngine === 'google') {
      await playGoogleCloudTTS(text, targetLang, voiceName);
    } else if (preferredEngine === 'gemini') {
      await playGeminiTTS(text, targetLang, voiceName);
    } else {
      await playWebSpeechTTS(text, targetLang);
    }
  } catch (error) {
    console.error(`[TTS] ${preferredEngine} engine failed:`, error);
    if (!isTtsCancelled) {
      await playWebSpeechTTS(text, targetLang);
    }
  }
};

/**
 * 혼합 언어(예: AI 선생님 강의)를 문장 단위로 나누어 순차 재생합니다.
 */
export const playMixedAudio = async (text) => {
  if (!text) return;
  isTtsCancelled = false;

  // 문장 단위 분리
  const sentences = text.split(/([.?!])/g).reduce((acc, part, i) => {
    if (i % 2 === 0) acc.push(part);
    else if (acc.length > 0) acc[acc.length - 1] += part;
    return acc;
  }, []).filter(s => s.trim().length > 0);

  for (const sentence of sentences) {
    if (isTtsCancelled) break;
    await playAudio(sentence.trim());
  }
};

/**
 * 엔진 1: Gemini AI
 */
async function playGeminiTTS(text, lang, modelOverride = null) {
  const apiKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY;
  const model = modelOverride || localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash-latest';
  if (!apiKey) throw new Error("Gemini API Key가 없습니다.");

  const langNames = { 'ko': '한국어(Korean)', 'id': '인도네시아어(Indonesian)', 'en': '영어(English)' };
  const langLabel = langNames[lang] || "인도네시아어(Indonesian)";

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Read: "${text}" in ${langLabel}` }] }],
      generationConfig: { response_modalities: ["AUDIO"] }
    })
  });

  if (!response.ok) throw new Error("Gemini 오디오 생성 실패");
  const data = await response.json();
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (audioBase64) return playBase64Audio(audioBase64);
}

/**
 * 엔진 2: Google Cloud TTS (Premium)
 */
async function playGoogleCloudTTS(text, lang, overrideModel = null) {
  const accessToken = localStorage.getItem('gcp_access_token');
  const expiry = localStorage.getItem('gcp_token_expiry');
  const isExpired = expiry && (parseInt(expiry, 10) - Date.now() < 10000);

  if (!accessToken || isExpired) throw new Error("Google Cloud 세션 만료");

  const langCodes = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
  const langCode = langCodes[lang] || 'id-ID';
  const modelKey = `google_tts_model_${lang}`;
  const savedModel = localStorage.getItem(modelKey);
  let effectiveModel = overrideModel || savedModel;

  if (!effectiveModel || !effectiveModel.startsWith(langCode.substring(0,2))) {
      const defaultModels = { 'ko': 'ko-KR-Neural2-A', 'id': 'id-ID-Chirp3-HD-Alnilam', 'en': 'en-US-Neural2-F' };
      effectiveModel = defaultModels[lang] || defaultModels['id'];
  }

  const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: langCode, name: effectiveModel },
      audioConfig: { audioEncoding: 'MP3' }
    })
  });

  if (!response.ok) throw new Error("Google Cloud TTS 요청 실패");
  const data = await response.json();
  if (data.audioContent) return playBase64Audio(data.audioContent);
}

export async function fetchGoogleVoices(accessToken) {
  if (!accessToken) return [];
  const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/voices`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.voices || [];
}

export function playWebSpeechTTS(text, lang) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || isTtsCancelled) return resolve();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langCodes = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
    utterance.lang = langCodes[lang] || 'id-ID';
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function playBase64Audio(base64Data) {
  return new Promise((resolve) => {
    if (isTtsCancelled) return resolve();
    const audio = new Audio("data:audio/mp3;base64," + base64Data.replace(/\s/g, ''));
    currentAudioElement = audio;
    audio.onended = () => { currentAudioElement = null; resolve(); };
    audio.onerror = () => { currentAudioElement = null; resolve(); };
    audio.play().catch(() => { currentAudioElement = null; resolve(); });
  });
}
