/**
 * 인도네시아어 TTS(음성 합성) 통합 모듈
 * 1순위: Gemini AI (멀티모달 오디오 생성)
 * 2순위: Google Cloud Cloud TTS (전용 API)
 * 3순위: Web Speech API (브라우저 내장 Fallback)
 */

export const playAudio = async (text) => {
  // 0. 글로벌 음성 설정 확인
  const isAudioEnabled = localStorage.getItem('is_audio_enabled') !== 'false';
  if (!isAudioEnabled) return;

  const isIndoMode = localStorage.getItem('isIndoMode') === 'true';
  const preferredEngine = localStorage.getItem('tts_engine') || 'gemini';

  try {
    if (preferredEngine === 'google') {
      await playGoogleCloudTTS(text, isIndoMode);
    } else if (preferredEngine === 'gemini') {
      await playGeminiTTS(text, isIndoMode);
    } else {
      playWebSpeechTTS(text, isIndoMode);
    }
  } catch (error) {
    console.error(`${preferredEngine} 엔진 재생 실패, 폴백 시도:`, error);
    // 자동 폴백: Web Speech API는 항상 동작하므로 최후의 수단으로 사용
    playWebSpeechTTS(text, isIndoMode);
  }
};

/**
 * 엔진 1: Gemini AI 멀티모달 오디오 재생
 * 별도의 TTS 키 없이도 Gemini API Key만 있으면 동작합니다.
 */
async function playGeminiTTS(text, isIndoMode) {
  const apiKey = localStorage.getItem('geminiApiKey');
  const model = localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash';

  if (!apiKey) throw new Error("Gemini API Key가 없습니다.");

  const targetLangPrompt = isIndoMode ? "한국어(Korean)" : "인도네시아어(Indonesian)";

  // Gemini 1.5/2.0 멀티모달 오디오 생성 API 호출
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `다음 ${targetLangPrompt} 문장을 원어민 발음으로 읽어주세요. 오디오만 반환하세요: "${text}"`
        }]
      }],
      generationConfig: {
        response_modalities: ["AUDIO"]
      }
    })
  });

  if (!response.ok) {
    throw new Error("Gemini 오디오 생성 실패 (모델이 오디오를 지원하지 않을 수 있습니다)");
  }

  const data = await response.json();
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (audioBase64) {
    return playBase64Audio(audioBase64);
  } else {
    throw new Error("Gemini가 오디오 데이터를 반환하지 않았습니다.");
  }
}

async function playGoogleCloudTTS(text, isIndoMode) {
  const accessToken = localStorage.getItem('gcp_access_token');
  if (!accessToken) throw new Error("Google Cloud 액세스 토큰이 없습니다.");

  const langCode = isIndoMode ? 'ko-KR' : 'id-ID';
  const defaultModel = isIndoMode ? 'ko-KR-Neural2-A' : 'id-ID-Standard-C';
  const modelName = localStorage.getItem('google_tts_model') || defaultModel;

  // V1beta1 API를 사용하여 최신 음성 로드 시도
  const endpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: langCode, name: modelName },
      audioConfig: { audioEncoding: 'MP3' }
    })
  });

  if (!response.ok) {
     if (response.status === 401 || response.status === 403) {
         localStorage.removeItem('gcp_access_token');
     }
     throw new Error(`Google Cloud TTS 요청 실패 (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (data.audioContent) {
    return playBase64Audio(data.audioContent);
  } else {
    throw new Error("오디오 데이터가 반환되지 않았습니다.");
  }
}

/**
 * 엔진 3: Web Speech API (브라우저 내장)
 * 인터넷이 없어도, 키가 없어도 동작하는 최후의 보루
 */
function playWebSpeechTTS(text, isIndoMode) {
  if (!('speechSynthesis' in window)) {
    console.error("이 브라우저는 음성 합성을 지원하지 않습니다.");
    return;
  }

  // 기존 재생 중인 음성 중단
  window.speechSynthesis.cancel();

  const langCode = isIndoMode ? 'ko-KR' : 'id-ID';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  utterance.rate = 0.9;     // 학습을 위해 약간 천천히
  
  // 사용 가능한 목소리 중 해당 언어 찾기
  const voices = window.speechSynthesis.getVoices();
  const targetVoice = voices.find(v => v.lang.startsWith(isIndoMode ? 'ko' : 'id'));
  if (targetVoice) utterance.voice = targetVoice;

  window.speechSynthesis.speak(utterance);
}

// 오디오 재생 헬퍼
function playBase64Audio(base64Data) {
  const audioSrc = "data:audio/mp3;base64," + base64Data;
  const audio = new Audio(audioSrc);
  return audio.play();
}
