/**
 * 인도네시아어/한국어/영어 TTS(음성 합성) 통합 모듈 (v19.6 - Legacy Structure Restored)
 * 백업본 v9.6의 안정적인 구조를 기반으로 3개국어 기능을 완벽하게 이식했습니다.
 */

// 한글 포함 여부 체크 함수
const containsHangul = (text) => /[\u3131-\uD79D]/.test(text);

/**
 * 텍스트 언어 판별 (백업본의 이분법 구조 유지 + 영어 확장)
 */
const getLangType = (text, langOverride = null) => {
  if (langOverride) return langOverride;
  if (containsHangul(text)) return 'ko';
  // 기본적으로 영어와 인도네시아어는 알파벳을 공유하므로, 
  // 여기서는 백업본처럼 기본을 'id'로 하되 나중에 명시적 선택을 존중함
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
      playWebSpeechTTS(text, targetLang);
    }
  } catch (error) {
    console.error(`[TTS] ${preferredEngine} engine failed:`, error);
    // 최후의 수단: Web Speech API 폴백
    if (!isTtsCancelled) {
      playWebSpeechTTS(text, targetLang);
    }
  }
};

/**
 * 엔진 1: Gemini AI 멀티모달 오디오 재생 (백업본 v9.6 기반)
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
      contents: [{
        parts: [{
          text: `Read the following ${langLabel} text accurately with a native accent. Output ONLY audio: "${text}"`
        }]
      }],
      generationConfig: { response_modalities: ["AUDIO"] }
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
 * 엔진 2: Google Cloud TTS (Premium) (백업본 v9.6 구조 완벽 복원)
 */
async function playGoogleCloudTTS(text, lang, overrideModel = null) {
  const accessToken = localStorage.getItem('gcp_access_token');
  const expiry = localStorage.getItem('gcp_token_expiry');
  
  const isExpired = expiry && (parseInt(expiry, 10) - Date.now() < 10000);

  if (!accessToken || isExpired) {
    if (accessToken) localStorage.removeItem('gcp_access_token');
    throw new Error("Google Cloud 세션이 만료되었습니다. 설정에서 다시 로그인해주세요.");
  }

  // 백업본의 언어 코드 매핑 방식 복원
  const langCodes = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
  const langCode = langCodes[lang] || 'id-ID';
  
  const modelKey = `google_tts_model_${lang}`;
  const savedModel = localStorage.getItem(modelKey);
  
  let effectiveModel = overrideModel || savedModel;
  
  // 백업본의 엄격한 모델 검증 로직 복원
  if (!effectiveModel || !effectiveModel.startsWith(langCode.substring(0,2))) {
      const defaultModels = {
        'ko': 'ko-KR-Neural2-A',
        'id': 'id-ID-Chirp3-HD-Alnilam',
        'en': 'en-US-Neural2-F'
      };
      effectiveModel = defaultModels[lang] || defaultModels['id'];
  }

  const endpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: langCode, name: effectiveModel },
        audioConfig: { audioEncoding: 'MP3' }
      })
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('gcp_access_token');
            localStorage.removeItem('gcp_token_expiry');
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`Google Cloud TTS 실패 (HTTP ${response.status}): ${errJson.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    if (data.audioContent) {
      return playBase64Audio(data.audioContent);
    } else {
      throw new Error("오디오 데이터가 반환되지 않았습니다.");
    }
  } catch (error) {
    if (error.message.includes('billing')) {
        const billingUrl = `https://console.cloud.google.com/billing/enable?project=1002533566733`;
        alert(`❌ [GCP 결제 연동 필요]\n\n이 기능을 사용하려면 구글 클라우드 콘솔에서 결제 계정이 연동되어 있어야 합니다.\n\n링크: ${billingUrl}`);
        window.open(billingUrl, '_blank');
    }
    throw error;
  }
}

/**
 * 백업본 v9.6의 fetchGoogleVoices 완벽 복원
 */
export async function fetchGoogleVoices(accessToken) {
  if (!accessToken) return [];
  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/voices`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Fetch Voices Error Response:", err);
      // 사용자 알림 추가 (디버깅용)
      if (response.status === 403 || response.status === 401) {
          alert("구글 서비스 권한이 없습니다. 다시 로그인하거나 결제 계정을 확인해주세요.");
      }
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
 * 엔진 3: Web Speech API (백업본 v9.6 복원)
 */
export function playWebSpeechTTS(text, lang) {
  if (!('speechSynthesis' in window)) return;
  if (isTtsCancelled) return;

  window.speechSynthesis.cancel();

  const langCodes = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCodes[lang] || 'id-ID';
  utterance.rate = 0.95;
  
  let voices = window.speechSynthesis.getVoices();
  const findVoice = () => {
    const targetVoices = voices.filter(v => v.lang.startsWith(lang));
    const premiumVoice = targetVoices.find(v => v.name.includes('Google')) || targetVoices[0];
    if (premiumVoice) utterance.voice = premiumVoice;
    if (!isTtsCancelled) window.speechSynthesis.speak(utterance);
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
}

function playBase64Audio(base64Data) {
  if (isTtsCancelled) return Promise.resolve();
  // 데이터 정제
  const cleanData = base64Data.replace(/\s/g, '');
  const audio = new Audio("data:audio/mp3;base64," + cleanData);
  currentAudioElement = audio;
  return audio.play();
}
