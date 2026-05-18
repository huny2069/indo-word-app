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

// [v19.20] 비동기 오디오 미리받기(Prefetch & Buffering)를 위한 전역 메모리 맵
let prefetchedAudioMap = {};

/**
 * [v19.20] 다음 문장의 Google Cloud TTS 음성을 백그라운드에서 비동기(Non-blocking)로 미리 다운로드하여 버퍼링합니다.
 * 이로써 네트워크 레이턴시에 따른 재생 간격 끊김 딜레이를 100% 소멸시킵니다.
 */
export async function prefetchGoogleAudio(text, lang) {
  if (!text || prefetchedAudioMap[text] || isTtsCancelled) return;
  
  const accessToken = localStorage.getItem('gcp_access_token');
  const expiry = localStorage.getItem('gcp_token_expiry');
  const isExpired = expiry && (parseInt(expiry, 10) - Date.now() < 10000);
  if (!accessToken || isExpired) return;

  try {
    const langCodes = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
    const langCode = langCodes[lang] || 'id-ID';
    const modelKey = `google_tts_model_${lang}`;
    const savedModel = localStorage.getItem(modelKey);
    let effectiveModel = savedModel;

    const isValidGcpVoice = (name, targetLangCode) => {
      if (!name) return false;
      if (name.toLowerCase().includes('gemini')) return false;
      return name.startsWith(targetLangCode);
    };

    if (!isValidGcpVoice(effectiveModel, langCode)) {
      const defaultModels = { 'ko': 'ko-KR-Neural2-A', 'id': 'id-ID-Chirp3-HD-Alnilam', 'en': 'en-US-Neural2-F' };
      effectiveModel = defaultModels[lang] || defaultModels['id'];
    }

    const savedRate = localStorage.getItem('tts_speed') || '1.0';
    const speakingRate = parseFloat(savedRate);

    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: langCode, name: effectiveModel },
        audioConfig: { 
          audioEncoding: 'MP3',
          speakingRate: speakingRate
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.audioContent) {
        // 성공적으로 미리 받아온 Base64 오디오 컨텐츠를 메모리 맵에 보관
        prefetchedAudioMap[text] = data.audioContent;
        console.log(`[TTS-PREFETCH] 🚀 백그라운드 미리선점 완료: "${text.substring(0, 15)}..."`);
      }
    }
  } catch (err) {
    console.warn(`[TTS-PREFETCH] 미리선점 중 가벼운 오류 발생:`, err.message);
  }
}

export const stopTTS = () => {
  isTtsCancelled = true;
  // 정지 시 대기 중인 모든 프리페치 캐시도 깨끗이 비워 꼬임 방지
  prefetchedAudioMap = {};
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
  const accessToken = localStorage.getItem('gcp_access_token');
  
  console.log(`[TTS-MIX] === AI 선생님 재생 시작 === 엔진: ${preferredEngine} | 토큰존재: ${!!accessToken}`);

  // 엔진이 google인데 토큰이 없으면 미리 경고
  if (preferredEngine === 'google' && !accessToken) {
    alert('⚠️ Google Cloud TTS 토큰이 없습니다.\n설정 → 구글 로그인을 해주세요.');
    return;
  }

  // [v19.20] 알파벳(영어/인도네시아어) 단어 조각과 한글 조각을 정교하게 분리하는 정규식
  const tokens = text.split(/([a-zA-Z]+[a-zA-Z\s]*[a-zA-Z]+|[a-zA-Z]+)/g).filter(t => t.trim().length > 0);
  console.log(`[TTS-MIX] 총 ${tokens.length}개 조각으로 세부 언어별 분리됨`);

  // [v19.20] 재생 시작 직전, 미리 앞서갈 다음 3개 조각을 비동기 프리페치 큐에 비동기 주입(선장전)
  for (let j = 0; j < Math.min(3, tokens.length); j++) {
    const nextToken = tokens[j].trim();
    if (!/^[0-9\s.,?!~:;*()'"-\/]+$/.test(nextToken)) {
      const nextLang = containsHangul(nextToken) ? 'ko' : 'id';
      prefetchGoogleAudio(nextToken, nextLang); // non-blocking 비동기 병렬 요청
    }
  }

  let hasShownError = false; // 첫 번째 에러만 알림 표시

  for (let i = 0; i < tokens.length; i++) {
    if (isTtsCancelled) break;
    const token = tokens[i].trim();
    
    // 무의미한 특수문자나 숫자 단독 조각은 건너뜁니다
    if (/^[0-9\s.,?!~:;*()'"-\/]+$/.test(token)) continue;

    // 한글이 단 한 글자라도 섞여 있다면 한국어로 재생, 알파벳으로만 구성되어 있다면 인도네시아어로 재생
    const lang = containsHangul(token) ? 'ko' : 'id';
    console.log(`[TTS-MIX] [${i+1}/${tokens.length}] 판별언어: ${lang} | "${token}"`);

    // [v19.20] 현재 낭독 중인 슬라이드 루프 속에서 2단계 뒤의 토큰을 연쇄적으로 계속 프리페치(슬라이딩 윈도우 프리페치)
    const nextPrefetchIdx = i + 3;
    if (nextPrefetchIdx < tokens.length) {
      const nextPrefetchToken = tokens[nextPrefetchIdx].trim();
      if (!/^[0-9\s.,?!~:;*()'"-\/]+$/.test(nextPrefetchToken)) {
        const nextPrefetchLang = containsHangul(nextPrefetchToken) ? 'ko' : 'id';
        prefetchGoogleAudio(nextPrefetchToken, nextPrefetchLang);
      }
    }

    try {
      // playAudio 함수를 그대로 연결하여 각 조각에 대한 완벽한 프리미엄 보이스 안전장치를 경유합니다.
      await playAudio(token, lang);
    } catch (error) {
      console.error(`[TTS-MIX] ❌ 조각 ${i+1} 실패:`, error.message);
      if (!hasShownError) {
        hasShownError = true;
        alert(`❌ AI 선생님 프리미엄 음성 실패\n\n원인: ${error.message}\n\n기본 음성으로 대체합니다.`);
      }
      if (!isTtsCancelled) {
        await playWebSpeechTTS(token, lang);
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
  // [v19.20] 초강력 캐시 프리페치 버퍼 히트 인터셉터 장착!
  // 이미 비동기로 백그라운드에서 다운로드받아 둔 오디오 데이터가 있다면 즉각 지연시간 0ms로 낭독합니다.
  if (prefetchedAudioMap[text]) {
    console.log(`[GCP-TTS] ⚡ 캐시(Prefetched Buffer) 히트! 네트워크 딜레이 0ms 즉시 재생: "${text.substring(0, 15)}..."`);
    const cachedAudio = prefetchedAudioMap[text];
    delete prefetchedAudioMap[text]; // 메모리 릭 방지를 위한 캐시 정리
    return playBase64Audio(cachedAudio);
  }

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

  // [수정] 모델 검증 강화: 백업본의 극강의 안정성 로직(startsWith)과 gemini 필터링을 결합
  // 1. 모델명이 비어있거나 'gemini'가 포함되어 있으면 차단
  // 2. 반드시 현재 재생할 언어코드(예: 'ko-KR', 'id-ID', 'en-US')로 시작해야 함
  const isValidGcpVoice = (name, targetLangCode) => {
    if (!name) return false;
    if (name.toLowerCase().includes('gemini')) return false;
    return name.startsWith(targetLangCode);
  };

  if (!isValidGcpVoice(effectiveModel, langCode)) {
    // 잘못된 값이 localStorage에 있으면 즉시 안전하게 정리
    if (savedModel && !isValidGcpVoice(savedModel, langCode)) {
      console.warn(`[GCP-TTS] ⚠️ localStorage 오염 검출: "${savedModel}" (언어: ${langCode}) → 제거 후 안전 모드로 재생`);
      localStorage.removeItem(modelKey);
    }
    const defaultModels = { 'ko': 'ko-KR-Neural2-A', 'id': 'id-ID-Chirp3-HD-Alnilam', 'en': 'en-US-Neural2-F' };
    effectiveModel = defaultModels[lang] || defaultModels['id'];
  }

  console.log(`[GCP-TTS] 요청 | 모델: ${effectiveModel} | 언어: ${langCode} | 텍스트길이: ${text.length}`);

  const savedRate = localStorage.getItem('tts_speed') || '1.0';
  const speakingRate = parseFloat(savedRate);

  const requestBody = {
    input: { text },
    voice: { languageCode: langCode, name: effectiveModel },
    audioConfig: { 
      audioEncoding: 'MP3',
      speakingRate: speakingRate
    }
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
    const savedRate = localStorage.getItem('tts_speed') || '1.0';
    utterance.rate = parseFloat(savedRate);

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
    const savedRate = localStorage.getItem('tts_speed') || '1.0';
    audio.playbackRate = parseFloat(savedRate);
    audio.onended = () => { currentAudioElement = null; resolve(); };
    audio.onerror = () => { currentAudioElement = null; resolve(); };
    audio.play().catch(() => { currentAudioElement = null; resolve(); });
  });
}
