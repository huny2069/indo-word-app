/**
 * 인도네시아어/한국어/영어 TTS(음성 합성) 통합 모듈 (v19.9)
 * AI 선생님 강의에서도 프리미엄 모델이 확실하게 적용되도록 수정했습니다.
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

/**
 * 단일 텍스트 재생 (단어장 등에서 사용)
 */
export const playAudio = async (text, lang = null, voiceName = null) => {
  if (!text) return;
  isTtsCancelled = false;
  
  const isAudioEnabled = localStorage.getItem('is_audio_enabled') !== 'false';
  if (!isAudioEnabled) return;

  const targetLang = getLangType(text, lang);
  const preferredEngine = localStorage.getItem('tts_engine') || 'google';

  console.log(`[TTS] playAudio 호출 | 엔진: ${preferredEngine} | 언어: ${targetLang} | 텍스트: "${text.substring(0, 30)}..."`);

  try {
    if (preferredEngine === 'google') {
      await playGoogleCloudTTS(text, targetLang, voiceName);
    } else if (preferredEngine === 'gemini') {
      await playGeminiTTS(text, targetLang, voiceName);
    } else {
      await playWebSpeechTTS(text, targetLang);
    }
  } catch (error) {
    console.error(`[TTS] ❌ ${preferredEngine} 엔진 실패:`, error.message);
    // 프리미엄 엔진이 실패하면 브라우저 기본 TTS로 폴백
    if (!isTtsCancelled) {
      console.warn(`[TTS] ⚠️ 기본 Web Speech 폴백 실행`);
      await playWebSpeechTTS(text, targetLang);
    }
  }
};

/**
 * 혼합 언어(AI 선생님 강의)를 문장 단위로 나누어 순차 재생
 * 각 문장마다 언어를 자동 감지하여 해당 언어의 프리미엄 모델로 재생합니다.
 */
export const playMixedAudio = async (text) => {
  if (!text) return;
  isTtsCancelled = false;

  const preferredEngine = localStorage.getItem('tts_engine') || 'google';
  console.log(`[TTS-MIX] === AI 선생님 재생 시작 === 엔진: ${preferredEngine}`);

  // 문장 단위 분리 (마침표, 물음표, 느낌표 기준)
  const sentences = text.split(/(?<=[.?!。])\s*/g).filter(s => s.trim().length > 1);

  console.log(`[TTS-MIX] 총 ${sentences.length}개 문장으로 분리됨`);

  for (let i = 0; i < sentences.length; i++) {
    if (isTtsCancelled) break;
    const sentence = sentences[i].trim();
    const lang = getLangType(sentence);
    console.log(`[TTS-MIX] [${i+1}/${sentences.length}] 언어: ${lang} | "${sentence.substring(0, 40)}..."`);

    try {
      if (preferredEngine === 'google') {
        await playGoogleCloudTTS(sentence, lang, null);
      } else if (preferredEngine === 'gemini') {
        await playGeminiTTS(sentence, lang, null);
      } else {
        await playWebSpeechTTS(sentence, lang);
      }
    } catch (error) {
      console.error(`[TTS-MIX] ❌ 문장 ${i+1} 실패:`, error.message);
      // 실패 시에도 기본 TTS로 해당 문장은 읽어줌
      if (!isTtsCancelled) {
        await playWebSpeechTTS(sentence, lang);
      }
    }
  }
  console.log(`[TTS-MIX] === AI 선생님 재생 완료 ===`);
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

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Gemini 실패(${response.status}): ${errData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (audioBase64) {
    return playBase64Audio(audioBase64);
  } else {
    throw new Error("Gemini가 오디오를 반환하지 않음");
  }
}

/**
 * 엔진 2: Google Cloud TTS (Premium)
 * 상세 로깅 추가 - 어디서 실패하는지 정확히 파악 가능
 */
async function playGoogleCloudTTS(text, lang, overrideModel = null) {
  const accessToken = localStorage.getItem('gcp_access_token');
  const expiry = localStorage.getItem('gcp_token_expiry');
  const isExpired = expiry && (parseInt(expiry, 10) - Date.now() < 10000);

  if (!accessToken || isExpired) {
    if (accessToken) localStorage.removeItem('gcp_access_token');
    throw new Error("Google Cloud 세션이 만료되었습니다. 설정에서 다시 로그인해주세요.");
  }

  const langCodes = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
  const langCode = langCodes[lang] || 'id-ID';
  const modelKey = `google_tts_model_${lang}`;
  const savedModel = localStorage.getItem(modelKey);
  let effectiveModel = overrideModel || savedModel;

  // 모델 검증 강화: localStorage에 잘못 저장된 Gemini 모델명 등을 차단
  // 유효한 Google Cloud TTS 모델은 반드시 'ko-KR-', 'id-ID-', 'en-US-' 등으로 시작함
  const isValidGcpVoice = (name) => {
    if (!name) return false;
    // 'gemini'가 포함된 이름은 Gemini AI 모델이지 TTS 음성이 아님
    if (name.toLowerCase().includes('gemini')) return false;
    // 언어코드-국가코드- 형식이어야 함 (예: ko-KR-Neural2-A)
    return /^[a-z]{2}-[A-Z]{2}-/.test(name);
  };

  if (!isValidGcpVoice(effectiveModel)) {
    // 잘못된 값이 localStorage에 있으면 정리
    if (savedModel && !isValidGcpVoice(savedModel)) {
      console.warn(`[GCP-TTS] ⚠️ localStorage에 잘못된 모델명 발견: "${savedModel}" → 삭제 후 기본값 사용`);
      localStorage.removeItem(modelKey);
    }
    const defaultModels = { 'ko': 'ko-KR-Neural2-A', 'id': 'id-ID-Chirp3-HD-Alnilam', 'en': 'en-US-Neural2-F' };
    effectiveModel = defaultModels[lang] || defaultModels['id'];
  }

  console.log(`[GCP-TTS] 요청 | 모델: ${effectiveModel} | 언어: ${langCode} | 텍스트길이: ${text.length}`);

  const requestBody = {
    input: { text },
    voice: { languageCode: langCode, name: effectiveModel },
    audioConfig: { audioEncoding: 'MP3' }
  };

  const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const errMsg = errJson.error?.message || response.statusText;
    console.error(`[GCP-TTS] ❌ 실패 (HTTP ${response.status}): ${errMsg}`);
    console.error(`[GCP-TTS] 요청 본문:`, JSON.stringify(requestBody, null, 2));

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('gcp_access_token');
      localStorage.removeItem('gcp_token_expiry');
    }
    throw new Error(`Google Cloud TTS 실패 (HTTP ${response.status}): ${errMsg}`);
  }

  const data = await response.json();
  if (data.audioContent) {
    console.log(`[GCP-TTS] ✅ 성공 | 모델: ${effectiveModel} | 오디오 크기: ${data.audioContent.length}`);
    return playBase64Audio(data.audioContent);
  } else {
    throw new Error("오디오 데이터가 반환되지 않았습니다.");
  }
}

/**
 * 음성 목록 조회
 */
export async function fetchGoogleVoices(accessToken) {
  if (!accessToken) return [];
  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/voices`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      console.error("Fetch Voices Error:", response.status);
      return [];
    }
    const data = await response.json();
    return data.voices || [];
  } catch (e) {
    console.error("Fetch Voices Exception:", e);
    return [];
  }
}

/**
 * 엔진 3: Web Speech API (브라우저 기본)
 */
export function playWebSpeechTTS(text, lang) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || isTtsCancelled) return resolve();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langCodes = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
    utterance.lang = langCodes[lang] || 'id-ID';
    utterance.rate = 0.95;

    let voices = window.speechSynthesis.getVoices();
    const findVoice = () => {
      const targetVoices = voices.filter(v => v.lang.startsWith(lang));
      const premiumVoice = targetVoices.find(v => v.name.includes('Google')) || targetVoices[0];
      if (premiumVoice) utterance.voice = premiumVoice;
    };

    if (voices.length > 0) findVoice();

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    if (!isTtsCancelled) window.speechSynthesis.speak(utterance);
    else resolve();
  });
}

/**
 * Base64 오디오 재생 (비동기, 재생 완료까지 대기)
 */
function playBase64Audio(base64Data) {
  return new Promise((resolve) => {
    if (isTtsCancelled) return resolve();
    const cleanData = base64Data.replace(/\s/g, '');
    const audio = new Audio("data:audio/mp3;base64," + cleanData);
    currentAudioElement = audio;
    audio.onended = () => { currentAudioElement = null; resolve(); };
    audio.onerror = () => { currentAudioElement = null; resolve(); };
    audio.play().catch(() => { currentAudioElement = null; resolve(); });
  });
}
