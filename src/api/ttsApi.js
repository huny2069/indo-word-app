/**
 * 인도네시아어/한국어 TTS(음성 합성) 통합 모듈 (v3.3)
 * 언어 자동 감지(Hangul Detection) 기술을 적용하여 정확한 발음을 제공합니다.
 */

// 한글 포함 여부 체크 함수
const containsHangul = (text) => /[\u3131-\uD79D]/.test(text);

/**
 * 텍스트의 언어를 자동으로 판별합니다. (폴백용)
 */
const detectLanguage = (text) => {
    if (containsHangul(text)) return 'ko';
    // 알파벳 기반 언어 중 영어와 인도네시아어 구분은 어렵지만, 
    // 기본적으로 학습 언어를 따르도록 유도하는 것이 좋습니다.
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
  
  // 0. 글로벌 음성 설정 확인
  const isAudioEnabled = localStorage.getItem('is_audio_enabled') !== 'false';
  if (!isAudioEnabled) return;

  // 1. 언어 결정 (명시적 lang > 자동 감지)
  const targetLang = lang || detectLanguage(text);
  const preferredEngine = localStorage.getItem('tts_engine') || 'google';

  try {
    if (preferredEngine === 'google') {
      await playGoogleCloudTTS(text, targetLang, voiceName);
    } else if (preferredEngine === 'gemini') {
      // AI 선생님 전용 모델 혹은 기본 선택 모델 사용
      const geminiModel = voiceName || localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash-latest';
      await playGeminiTTS(text, targetLang, geminiModel);
    } else {
      await playWebSpeechTTS(text, targetLang);
    }
  } catch (error) {
    console.error(`[TTS Error] ${preferredEngine} engine failed:`, error);
    
    // 권한 문제인 경우 명확한 알림 제공
    const errorMsg = error.message || "";
    if (errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("세션")) {
        alert("Premium 음성 인증이 만료되었습니다. 설정에서 구글 로그인을 다시 진행해주세요.");
    } else {
        console.warn(`Fallback to Web Speech due to: ${errorMsg}`);
    }

    if (!isTtsCancelled) {
      await playWebSpeechTTS(text, targetLang);
    }
  }
};

/**
 * 엔진 1: Gemini AI 멀티모달 오디오 재생 (3개국어 지원)
 */
async function playGeminiTTS(text, lang, modelOverride = null) {
  const apiKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY;
  // AI 선생님 요청 시 gemini-2.5-pro-preview-tts 우선 사용
  const model = modelOverride || localStorage.getItem('selectedGeminiModel') || 'gemini-2.5-flash';

  if (!apiKey) throw new Error("Gemini API Key가 없습니다.");

  const langNames = { ko: '한국어(Korean)', id: '인도네시아어(Indonesian)', en: '영어(English)' };
  const langLabel = langNames[lang] || '인도네시아어(Indonesian)';

  // 최신 v1beta 엔드포인트 사용 (TTS 특화 모델 지원 가능성 높음)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Read the following ${langLabel} text accurately with a natural native accent. Output ONLY audio: "${text}"`
        }]
      }],
      generationConfig: {
        response_modalities: ["AUDIO"]
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Gemini 오디오 생성 실패: ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (audioBase64) {
    return playBase64Audio(audioBase64);
  } else {
    throw new Error("Gemini가 오디오 데이터를 반환하지 않았습니다.");
  }
}

/**
 * 엔진 2: Google Cloud TTS (Premium) (3개국어 지원)
 */
async function playGoogleCloudTTS(text, lang, overrideModel = null) {
  const accessToken = localStorage.getItem('gcp_access_token');
  const expiry = localStorage.getItem('gcp_token_expiry');
  const isExpired = expiry && (parseInt(expiry, 10) - Date.now() < 10000);

  if (!accessToken || isExpired) {
    if (accessToken) localStorage.removeItem('gcp_access_token');
    throw new Error("Google Cloud 세션이 만료되었습니다. 설정에서 다시 로그인해주세요.");
  }

  const langMap = {
      'ko': { code: 'ko-KR', defaultModel: 'ko-KR-Neural2-A', storageKey: 'google_tts_model_ko' },
      'id': { code: 'id-ID', defaultModel: 'id-ID-Chirp3-HD-Alnilam', storageKey: 'google_tts_model_id' },
      'en': { code: 'en-US', defaultModel: 'en-US-Neural2-F', storageKey: 'google_tts_model_en' }
  };

  const config = langMap[lang] || langMap['id'];
  const savedModel = localStorage.getItem(config.storageKey);
  
  // [v9.6 백업본 로직 적용] 선택된 모델이 현재 언어와 일치하는지 검증
  let effectiveModel = overrideModel || savedModel;
  if (!effectiveModel || !effectiveModel.startsWith(config.code.substring(0, 2))) {
      console.log(`[TTS] Model validation failed or missing. Using default: ${config.defaultModel}`);
      effectiveModel = config.defaultModel;
  }

  let effectiveLangCode = config.code;
  if (effectiveModel && effectiveModel.includes('-')) {
      const parts = effectiveModel.split('-');
      if (parts.length >= 2) {
          effectiveLangCode = `${parts[0]}-${parts[1]}`;
      }
  }

  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: { text },
        voice: { 
          languageCode: effectiveLangCode, 
          name: effectiveModel
        },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 }
      })
    });

    if (!response.ok) {
        const err = await response.json();
        if (response.status === 401) {
            alert("Premium 음성 인증이 만료되었습니다. 설정에서 구글 로그인을 다시 진행해주세요.");
        }
        throw new Error(err.error?.message || "TTS 요청 실패");
    }

    const data = await response.json();
    if (data.audioContent) {
        await playBase64Audio(data.audioContent);
    } else {
        throw new Error("오디오 데이터가 반환되지 않았습니다.");
    }
  } catch (e) {
    console.error("Premium TTS Error:", e);
    // 무음으로 넘어가는 것보다 사용자에게 에러를 알리는 것이 원인 파악에 도움이 됨
    if (!e.message.includes('만료')) {
        alert("Premium 음성 재생 중 오류가 발생했습니다. (" + e.message + ")");
    }
    throw e;
  }
}

export async function fetchGoogleVoices(accessToken) {
  if (!accessToken) return [];
  try {
    // [v9.6 백업본 로직 적용] v1beta1 엔드포인트 사용 (고급 모델 조회용)
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/voices`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.voices || [];
  } catch (e) {
    return [];
  }
}

/**
 * 엔진 3: Web Speech API (브라우저 내장 폴백) (3개국어 지원)
 */
export function playWebSpeechTTS(text, lang) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    if (isTtsCancelled) return resolve();

    window.speechSynthesis.cancel();

    const langMap = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
    const langCode = langMap[lang] || 'id-ID';
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.95;
    
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // 오류 시에도 다음 진행을 위해 resolve
    
    let voices = window.speechSynthesis.getVoices();
    
    const findVoice = () => {
      const targetVoices = voices.filter(v => v.lang.startsWith(lang));
      const premiumVoice = targetVoices.find(v => v.name.includes('Google') || v.name.includes('Natural')) || targetVoices[0];
      if (premiumVoice) utterance.voice = premiumVoice;
      if (!isTtsCancelled) window.speechSynthesis.speak(utterance);
      else resolve();
    };

    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        findVoice();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      findVoice();
    }
  });
}

function playBase64Audio(base64Data) {
  return new Promise((resolve, reject) => {
    if (isTtsCancelled) return resolve();
    
    // 데이터 정제 (공백 및 줄바꿈 제거)
    const cleanData = base64Data.replace(/\s/g, '');
    const audioSrc = "data:audio/mp3;base64," + cleanData;
    const audio = new Audio(audioSrc);
    currentAudioElement = audio;
    
    audio.onended = () => {
      currentAudioElement = null;
      resolve();
    };
    audio.onerror = () => {
      currentAudioElement = null;
      resolve(); // 오류 시에도 다음 재생을 위해 resolve
    };
    
    audio.play().catch(e => {
      currentAudioElement = null;
      resolve();
    });
  });
}

/**
 * 텍스트 내 <target> 태그를 감지하여 혼합 언어로 순차 재생합니다.
 */
export const playMixedAudio = async (text, nativeLang, targetLang, forceModel = null) => {
  if (!text) return;
  isTtsCancelled = false;

  // 1. 초기 분할 (태그 구간 vs 일반 구간)
  const regex = /<target>(.*?)<\/target>|([^<]+)/g;
  let match;
  let rawChunks = [];
  
  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined) {
      rawChunks.push({ text: match[1], lang: targetLang });
    } else if (match[2] !== undefined) {
      rawChunks.push({ text: match[2], lang: nativeLang });
    }
  }

  // 2. 특수 처리: 타겟 태그 사이의 공백/문장부호는 타겟 언어로 편입 (연속성 확보)
  for (let i = 1; i < rawChunks.length - 1; i++) {
    const prev = rawChunks[i-1];
    const curr = rawChunks[i];
    const next = rawChunks[i+1];
    
    if (prev.lang === targetLang && next.lang === targetLang && curr.lang === nativeLang) {
      // 공백이나 문장부호만 있는 경우 타겟 언어로 전환
      if (!/[^\s\p{P}]/u.test(curr.text)) {
        curr.lang = targetLang;
      }
    }
  }

  // 3. 동일 언어 청크 병합 (병합해야 한 문장으로 매끄럽게 읽음)
  const mergedChunks = [];
  if (rawChunks.length > 0) {
    let current = { ...rawChunks[0] };
    for (let i = 1; i < rawChunks.length; i++) {
      if (rawChunks[i].lang === current.lang) {
        current.text += rawChunks[i].text;
      } else {
        if (current.text.trim()) mergedChunks.push(current);
        current = { ...rawChunks[i] };
      }
    }
    if (current.text.trim()) mergedChunks.push(current);
  }

  // 4. 순차 재생
  for (const chunk of mergedChunks) {
    if (isTtsCancelled) break;
    // forceModel이 있으면 해당 모델로 재생 (AI 선생님 등)
    await playAudio(chunk.text, chunk.lang, forceModel);
  }
};
