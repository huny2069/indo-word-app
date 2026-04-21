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

export const playAudio = async (text, lang = null, voiceName = null) => {
  if (!text) return;
  
  // 0. 글로벌 음성 설정 확인
  const isAudioEnabled = localStorage.getItem('is_audio_enabled') !== 'false';
  if (!isAudioEnabled) return;

  // 1. 언어 결정 (명시적 lang > 자동 감지)
  const targetLang = lang || detectLanguage(text);
  const preferredEngine = localStorage.getItem('tts_engine') || 'gemini';

  try {
    if (preferredEngine === 'google') {
      await playGoogleCloudTTS(text, targetLang, voiceName);
    } else if (preferredEngine === 'gemini') {
      await playGeminiTTS(text, targetLang);
    } else {
      playWebSpeechTTS(text, targetLang);
    }
  } catch (error) {
    console.error(`${preferredEngine} 엔진 재생 실패, 브라우저 폴백 시도:`, error);
    playWebSpeechTTS(text, targetLang);
  }
};

/**
 * 엔진 1: Gemini AI 멀티모달 오디오 재생 (3개국어 지원)
 */
async function playGeminiTTS(text, lang) {
  const apiKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY;
  const model = localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash-latest';

  if (!apiKey) throw new Error("Gemini API Key가 없습니다.");

  const langNames = { ko: '한국어(Korean)', id: '인도네시아어(Indonesian)', en: '영어(English)' };
  const langLabel = langNames[lang] || '인도네시아어(Indonesian)';

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
      'id': { code: 'id-ID', defaultModel: 'id-ID-Chirp3-HD-Achernar', storageKey: 'google_tts_model_id' },
      'en': { code: 'en-US', defaultModel: 'en-US-Neural2-F', storageKey: 'google_tts_model_en' }
  };

    const config = langMap[lang] || langMap['id'];
    const savedModel = localStorage.getItem(config.storageKey);
    const effectiveModel = overrideModel || savedModel || config.defaultModel;

    // 모델명에서 언어 코드 동적 추출 (예: en-GB-Neural2-A -> en-GB)
    // 미국(en-US) 외에도 영국, 호주 등을 정확한 언어 코드로 요청하기 위함
    let effectiveLangCode = config.code;
    if (effectiveModel && effectiveModel.includes('-')) {
        const parts = effectiveModel.split('-');
        if (parts.length >= 2) {
            effectiveLangCode = `${parts[0]}-${parts[1]}`;
        }
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
          voice: { languageCode: effectiveLangCode, name: effectiveModel },
          audioConfig: { audioEncoding: 'MP3' }
        })
      });

     if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('gcp_access_token');
            localStorage.removeItem('gcp_token_expiry');
        }
       const errJson = await response.json().catch(() => ({}));
       throw new Error(`Google Cloud TTS 요청 실패 (HTTP ${response.status}): ${errJson.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();
    if (data.audioContent) {
      return playBase64Audio(data.audioContent);
    } else {
      throw new Error("오디오 데이터가 반환되지 않았습니다.");
    }
  } catch (error) {
    throw error;
  }
}

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
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const langMap = { 'ko': 'ko-KR', 'id': 'id-ID', 'en': 'en-US' };
  const langCode = langMap[lang] || 'id-ID';
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  utterance.rate = 0.95;
  
  let voices = window.speechSynthesis.getVoices();
  
  const findVoice = () => {
    const targetVoices = voices.filter(v => v.lang.startsWith(lang));
    const premiumVoice = targetVoices.find(v => v.name.includes('Google') || v.name.includes('Natural')) || targetVoices[0];
    if (premiumVoice) utterance.voice = premiumVoice;
    window.speechSynthesis.speak(utterance);
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
  const audioSrc = "data:audio/mp3;base64," + base64Data;
  const audio = new Audio(audioSrc);
  return audio.play();
}
