/**
 * 인도네시아어/한국어 TTS(음성 합성) 통합 모듈 (v3.3)
 * 언어 자동 감지(Hangul Detection) 기술을 적용하여 정확한 발음을 제공합니다.
 */

// 한글 포함 여부 체크 함수
const containsHangul = (text) => /[\u3131-\uD79D]/.test(text);

export const playAudio = async (text) => {
  if (!text) return;
  
  // 0. 글로벌 음성 설정 확인
  const isAudioEnabled = localStorage.getItem('is_audio_enabled') !== 'false';
  if (!isAudioEnabled) return;

  // 1. 실제 텍스트 언어 판별 (isIndoMode에 의존하지 않음)
  const isKorean = containsHangul(text);
  const preferredEngine = localStorage.getItem('tts_engine') || 'gemini';

  try {
    if (preferredEngine === 'google') {
      await playGoogleCloudTTS(text, isKorean);
    } else if (preferredEngine === 'gemini') {
      await playGeminiTTS(text, isKorean);
    } else {
      playWebSpeechTTS(text, isKorean);
    }
  } catch (error) {
    console.error(`${preferredEngine} 엔진 재생 실패, 브라우저 폴백 시도:`, error);
    // 최후의 수단: Web Speech API (오프라인 지원)
    playWebSpeechTTS(text, isKorean);
  }
};

/**
 * 엔진 1: Gemini AI 멀티모달 오디오 재생
 */
async function playGeminiTTS(text, isKorean) {
  const apiKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY;
  const model = localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash-latest';

  if (!apiKey) throw new Error("Gemini API Key가 없습니다.");

  const langLabel = isKorean ? "한국어(Korean)" : "인도네시아어(Indonesian)";

  // Gemini 오디오 생성 API 호출
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
 * 엔진 2: Google Cloud TTS (Premium)
 */
async function playGoogleCloudTTS(text, isKorean) {
  const accessToken = localStorage.getItem('gcp_access_token');
  
  if (!accessToken) throw new Error("Google Cloud 액세스 토큰이 없습니다. 구글 로그인을 먼저 진행해주세요.");

  const langCode = isKorean ? 'ko-KR' : 'id-ID';
  const savedModel = localStorage.getItem('google_tts_model');
  
  let effectiveModel = '';
  if (savedModel && savedModel.startsWith(langCode.substring(0,2))) {
      effectiveModel = savedModel;
  } else {
      // 보이스 리스트 기반 최적 모델 자동 선택 (Wavenet이 Chirp보다 호환성이 높음)
      effectiveModel = isKorean ? 'ko-KR-Neural2-A' : 'id-ID-Wavenet-A';
  }

  // v1beta1 엔드포인트 사용 (버전1 방식 복구)
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
    // v1beta1 엔드포인트 사용 (고급 모델 조회용)
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/voices`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const err = await response.json();
      console.error("Fetch Voices Error Response:", err);
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
 * 엔진 3: Web Speech API (브라우저 내장 폴백)
 */
export function playWebSpeechTTS(text, isKorean) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  const langCode = isKorean ? 'ko-KR' : 'id-ID';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  utterance.rate = 0.95;
  
  // 브라우저가 지원하는 목소리 목록에서 최적의 매칭 찾기
  let voices = window.speechSynthesis.getVoices();
  
  const findVoice = () => {
    const targetVoices = voices.filter(v => v.lang.startsWith(isKorean ? 'ko' : 'id'));
    // Google 목소리(대체로 품질 좋음)를 우선순위로 선택
    const premiumVoice = targetVoices.find(v => v.name.includes('Google')) || targetVoices[0];
    if (premiumVoice) utterance.voice = premiumVoice;
    window.speechSynthesis.speak(utterance);
  };

  if (voices.length === 0) {
    // 목소리가 아직 로드되지 않은 경우 이벤트 대기
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
