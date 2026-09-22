export const generateWords = async (topic, count, apiKey, modelName = 'gemini-3.8-flash', excludeWords = [], userLang = 'ko', studyLang = 'id', email = null) => {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) throw new Error('API 키가 설정되지 않았습니다. 설정 탭에서 Gemini API 키를 입력해주세요.');
  if (count <= 0 || count > 30) throw new Error('단어 개수는 1에서 30 사이여야 합니다.');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`;

  // 언어 이름 매핑
  const langNames = { ko: '한국어(Korean)', id: '인도네시아어(Indonesian)', en: '영어(English)' };
  const targetLangName = langNames[studyLang];
  const nativeLangName = langNames[userLang];

  // 언어별 특화 스키마 및 가이드 정의
  let specificRules = '';
  let specificFields = '';

  if (studyLang === 'en') {
    specificRules = `
    - 영어 단어의 경우, 단순히 '어근' 대신 '어원(Etymology)'과 '뉘앙스(Nuance)' 정보를 풍부하게 제공하세요.
    - 해당 단어와 관련된 주요 '구동사(Phrasal Verbs)'나 '관용구(Idioms)'가 있다면 related 항목에 포함하세요.
    - 불규칙 동사나 명사의 복수형 등 '변칙적인 형태(Irregular Forms)'가 있다면 grammar_rule에 명시하세요.
    - 발음 기호(IPA)를 반드시 포함하세요.`;
    specificFields = `
    "etymology": "단어의 어원이나 역사적 배경 (1문장)",
    "nuance": "비슷한 단어와의 미세한 의미 차이나 어감 설명 (1문장)",
    "pronunciation": "국제 발음 기호(IPA) 표기",`;
  } else if (studyLang === 'id') {
    specificRules = `
    - 인도네시아어의 경우, '어근(Kata Dasar)' 정보를 반드시 정확하게 제공하세요.
    - 접사(Affix)가 붙은 상태라면 그 결합 원리를 grammar_rule에 설명하세요.`;
    specificFields = `
    "root": "인도네시아어 어근(Kata Dasar)",
    "affix_logic": "접사 결합 논리 및 변형 규칙 설명",`;
  } else if (studyLang === 'ko') {
    specificRules = `
    - 한국어의 경우, '높임말(Honorifics)' 수준과 '한자어(Hanja)' 정보를 풍부하게 제공하세요.
    - 상황별 종결어미의 차이를 context와 caution에 상세히 적어주세요.`;
    specificFields = `
    "honorifics": "해당 단어의 존댓말/반말 구분 및 높임말 형태",
    "hanja_info": "한자어인 경우 한자 및 각 글자의 의미 정보",`;
  }

  const promptText = `
  당신은 ${nativeLangName} 사용자를 대상으로 하는 ${targetLangName} 교육계의 **'1타 스타 강사'**입니다. 
  단순한 단어 나열이 아니라, 학생들이 열광하는 당신만의 독특하고 머리에 쏙쏙 들어오는 강의 기법을 JSON 데이터에 녹여내세요.
  사용자가 요청한 주제 "${topic}"에 관련된 전문적인 ${targetLangName} 단어 ${count}개를 생성해주세요.
  모든 설명과 번역은 반드시 **${nativeLangName}**로 작성하세요.

  [중요 지침]
  1. JSON 배열 형식으로만 응답하며, 마크다운 백틱(\`\`\`)을 포함하지 마세요.
  2. JSON 표준을 엄격히 준수하고, 모든 키와 값은 큰따옴표(")를 사용하세요.
  ${specificRules}

  [강사의 비밀 지침]
  - **caution (학습 주의점)**: "마늘은 맵다" 같은 일반 상식은 절대 금지! 대신 "이 단어는 s 발음이 묵음이라 주의해야 해!", "A 단어랑 모양이 비슷해서 시험에 자주 나와!" 같은 **학습 밀착형 주의점**을 적으세요.
  - **related (강사의 비법)**: 이 단어를 한 번에 외울 수 있는 **연상 암기법, 공부 전략, 혹은 해당 단어가 쓰이는 실전 꿀팁**을 적으세요.
  - **Interactivity (전수 분석)**: 예문(example_formal, example_casual)에 사용된 **모든 단어와 중요한 숙어**를 하나도 빠짐없이 word_breakdown에 포함시키세요. 클릭했을 때 뜻이 안 나오면 학생들이 화를 냅니다!

  [각 요소의 JSON 구조]
  {
    "word": "${targetLangName} 단어",
    "meaning": "${nativeLangName} 뜻",
    "pos": "품사 (명사, 동사, 형용사 등 - ${nativeLangName}로 표기)",
    ${specificFields}
    "example_formal": "${targetLangName} 격식체 예문",
    "example_formal_kr": "위 예문의 ${nativeLangName} 번역",
    "example_casual": "${targetLangName} 비격식체/구어체 예문",
    "example_casual_kr": "위 예문의 ${nativeLangName} 번역",
    "antonym": "해당 단어의 반대어 (반드시 '단어 (뜻)' 형식으로 작성)",
    "synonym": "해당 단어의 유사어 (반드시 '단어 (뜻)' 형식으로 작성)",
    "context": "이 단어가 쓰이는 구체적인 상황과 뉘앙스 설명 (강사 말투로 - ${nativeLangName})",
    "caution": "시험/학습 시 반드시 주의해야 할 점 (유사어 혼동, 발음, 예외 규칙 등 - ${nativeLangName})",
    "related": "유명 강사의 단어 암기 비법 및 실전 공부 팁 (${nativeLangName})",
    "grammar_rule": "이 단어와 관련된 핵심 문법 포인트 (${nativeLangName})",
    "word_breakdown": [{"word": "단어/숙어", "meaning": "뜻"}] // 예문에 사용된 모든 요소의 개별 분석 (중요!)
  }

  ${excludeWords.length > 0 ? `제외할 단어 목록: [${excludeWords.join(', ')}]` : ''}
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`API 요청 실패: ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // 사용량 트래킹 (내부 로직 유지)
    if (data.usageMetadata) {
        const { promptTokenCount = 0, candidatesTokenCount = 0, totalTokenCount = 0 } = data.usageMetadata;
        const prevTokens = parseInt(localStorage.getItem('total_gemini_tokens') || '0', 10);
        localStorage.setItem('total_gemini_tokens', (prevTokens + totalTokenCount).toString());

        const isPro = modelName.includes('pro');
        const inputRate = isPro ? 1.25 / 1000000 : 0.075 / 1000000;
        const outputRate = isPro ? 5.0 / 1000000 : 0.3 / 1000000;
        const costNow = (promptTokenCount * inputRate) + (candidatesTokenCount * outputRate);
        const prevCost = parseFloat(localStorage.getItem('total_gemini_cost_usd') || '0');
        localStorage.setItem('total_gemini_cost_usd', (prevCost + costNow).toFixed(6));

        try {
            logUsage({
                user_id: localStorage.getItem('user_device_id') || 'anonymous',
                email: email,
                tokens_used: totalTokenCount,
                cost_usd: costNow,
                topic: topic
            });
        } catch (err) { console.warn("Log failed:", err); }
    }

    const textContent = data.candidates[0].content.parts[0].text;
    let parsedData = JSON.parse(textContent.trim().replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    return parsedData;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * 인코 서비스에 최적화된 구글 공식 최신 AI 모델 라인업 (Gemini 3.x 제품군 및 차세대 플래그십)
 * 구글에서 이미 지원 중단/폐기된 구형 1.x 및 2.x 버전은 완전히 삭제 및 영구 배제되었습니다.
 */
export const CURATED_MODELS = [
  { 
    id: 'gemini-3.8-flash', 
    t_key: '3_8_flash',
    name: 'Gemini 3.8 Flash (최신 플래그십 추천)', 
    shortDesc: '⚡ [최신 추천] 차세대 플래그십 초고속 모델',
    speed: '🚀 압도적 빠름', speed_key: 'very_fast',
    tokens: '📉 매우 낮음', tokens_key: 'very_low',
    pros: '구글의 최신 플래그십 Flash 모델로, 긴 문맥과 멀티턴 추론 능력을 갖추어 인도네시아어 문법 논리, 어근 분석 및 1타 강사 강의 대본 생성에 극강의 속도와 정확성을 발휘합니다.',
    cons: '초고난도 심층 추론은 3.5 Pro와 병행하여 활용 가능합니다.'
  },
  { 
    id: 'gemini-3.7-flash', 
    t_key: '3_7_flash',
    name: 'Gemini 3.7 Flash (검증된 고성능)', 
    shortDesc: '⚡ [안정] 3.7세대 고속 개발자 표준',
    speed: '⚡ 빠름', speed_key: 'fast',
    tokens: '📉 낮음', tokens_key: 'low',
    pros: '소프트웨어 엔지니어링 및 다국어 언어 추론 능력이 뛰어난 3.7세대 표준 모델로 안정성이 입증되어 있습니다.',
    cons: '최신 3.8 Flash에 비해 에이전틱 복합 추론 처리 효율이 소폭 낮습니다.'
  },
  { 
    id: 'gemini-3.5-pro', 
    t_key: '3_5_pro',
    name: 'Gemini 3.5 Pro (최상위 심층 추론)', 
    shortDesc: '🧠 [최상위] 심층 추론 및 1타 강사 특화',
    speed: '🐢 느림', speed_key: 'slow',
    tokens: '💎 매우 높음', tokens_key: 'very_high',
    pros: '최상위 지능을 갖추어 복잡한 인도네시아어 문법 논리, 어근 분석 및 1타 강사 시크릿 노트 생성에 극강의 정확성을 발휘합니다.',
    cons: 'Pro 모델 특성상 생성 지연 대기 시간이 다소 발생하며, 토큰당 API 소모 비용이 가장 높습니다.'
  },
  { 
    id: 'gemini-3.5-flash', 
    t_key: '3_5_flash',
    name: 'Gemini 3.5 Flash (에이전트 고효율)', 
    shortDesc: '⚡ [고효율] 100만 컨텍스트 사고 보존',
    speed: '🚀 압도적 빠름', speed_key: 'very_fast',
    tokens: '📉 매우 낮음', tokens_key: 'very_low',
    pros: '100만 컨텍스트 및 사고 보존(Thinking Preservation)을 갖추어 멀티턴 대화의 추론을 자동 유지하며, 에이전트형 루프와 코딩 작업에서 최첨단 가성비를 제공합니다.',
    cons: 'Pro 기종에 비해 고난도 논리 추론 연산 능력이 미세하게 제한적입니다.'
  },
  { 
    id: 'gemini-3.5-flash-lite', 
    t_key: '3_5_flash_lite',
    name: 'Gemini 3.5 Flash-Lite (초고속 가성비)', 
    shortDesc: '🚀 [가성비] 모바일 초고속 최저비용',
    speed: '🚀 압도적 빠름', speed_key: 'very_fast',
    tokens: '📉 매우 낮음', tokens_key: 'very_low',
    pros: '단순 언어 변환 및 대규모 단어 퀴즈 생성 시 최적의 반응 속도와 사실상 비용 제로에 가까운 효율성을 제공합니다.',
    cons: '깊이 있는 핵심 어근 분해 및 유사어 뉘앙스 도출 시 설명 디테일이 생략되곤 합니다.'
  },
  { 
    id: 'gemini-3.1-pro', 
    t_key: '3_1_pro',
    name: 'Gemini 3.1 Pro (정밀 언어 분석)', 
    shortDesc: '🧠 [정밀] 다국어 번역 미세 감정 조율',
    speed: '🐢 느림', speed_key: 'slow',
    tokens: '💎 매우 높음', tokens_key: 'very_high',
    pros: '대규모 추론 지능을 탑재하여 다국어 번역 시 원어민의 감정과 종결어미 상황별 차이를 정밀 조율하는 강점이 있습니다.',
    cons: '최신 3.8 Flash에 비해 속도가 느리고 비용이 큽니다.'
  },
  { 
    id: 'gemini-3.0-flash', 
    t_key: '3_0_flash',
    name: 'Gemini 3.0 Flash (3.0 기본 속도형)', 
    shortDesc: '⚡ [기초] 3.0 세대 기본 속도형',
    speed: '⚡ 빠름', speed_key: 'fast',
    tokens: '⚖️ 보통', tokens_key: 'normal',
    pros: '빠른 응답성과 보편적인 다국어 번역 영역에서 높은 신뢰도를 갖춘 세대적 표준형 모델입니다.',
    cons: '최신 3.8 모델에 비해 토큰 효율과 대화 일관성이 떨어질 수 있습니다.'
  }
];

/**
 * 모델 ID 기반 우선순위 점수 계산 (최신 3.8 플래그십 모델이 최상단에 위치)
 */
const getModelPriority = (modelId) => {
  const id = modelId.toLowerCase();
  if (id === 'gemini-3.8-flash') return 100; // 최신 3.8 플래그십 (1순위 추천)
  if (id.includes('3.8-flash')) return 98;
  if (id === 'gemini-3.7-flash') return 95;
  if (id === 'gemini-3.5-pro') return 92;
  if (id === 'gemini-3.5-flash') return 90;
  if (id === 'gemini-3.5-flash-lite') return 88;
  if (id.includes('3.8')) return 96;
  if (id.includes('3.7')) return 94;
  if (id.includes('3.5')) return 87;
  if (id === 'gemini-3.1-pro') return 80;
  if (id === 'gemini-3.1-flash-lite') return 78;
  if (id === 'gemini-3.0-flash') return 75;
  if (id.includes('4.')) return 110; // 미래 4.x 세대 대응
  if (id.includes('3.')) return 70;
  return 10;
};

/**
 * Google Gemini API에서 현재 실제로 사용 가능한 최신 모델 목록을 비동기로 불러오는 함수
 * - 지원 중단/폐기된 구형 1.x 및 2.x 전 기종 완전 삭제
 * - 텍스트 생성(generateContent)을 지원하지 않거나 오디오/비전/임베딩 모델 철저히 배제
 * - 현재 공식 지원되는 최신 Gemini 3.x (및 차세대 4.x 이상) 모델만 엄격 선별
 */
export const fetchGeminiModels = async (apiKey) => {
  if (!apiKey || !apiKey.trim()) return [];
  const cleanKey = apiKey.trim();

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `구글 API 응답 에러 (${response.status})`);
    }
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) return [];

    // 1. 구글 최신 실사용 3.x 및 차세대 텍스트 생성 모델만 필터링
    const filtered = data.models.filter(m => {
      const id = (m.name || '').replace('models/', '').toLowerCase();

      // generateContent 미지원 모델 제외
      const supportsGen = Array.isArray(m.supportedGenerationMethods) && 
                          m.supportedGenerationMethods.includes('generateContent');
      if (!supportsGen) return false;

      // [핵심] 지원 종료/사용 불가능한 1.x 및 2.x 세대 모델 완전 삭제
      if (id.startsWith('gemini-1.') || id.startsWith('gemini-2.') || id === 'gemini-pro' || id === 'gemini-ultra') {
        return false;
      }

      // 비텍스트 / 음성 / 특수 목적 모델 제외
      const blacklist = [
        'vision', 'embedding', 'imagen', 'aqa', 'tts', 
        'whisper', 'audio', 'veo', 'learnlm', 'computer-use', 
        'bison', 'robotics', 'live', 'transcribe'
      ];
      if (blacklist.some(term => id.includes(term))) return false;

      // 현재 공식 서비스 중인 최신 Gemini 3.x 및 차세대 모델만 통과
      const isModern = id.startsWith('gemini-') && (
        id.includes('3.') || 
        id.includes('4.')
      );

      return isModern;
    });

    // 2. 모델 우선순위 정렬 (최신 3.8 Flash가 최상단에 노출)
    filtered.sort((a, b) => {
      const idA = a.name.replace('models/', '');
      const idB = b.name.replace('models/', '');
      return getModelPriority(idB) - getModelPriority(idA);
    });

    // 3. 모델 ID 및 구글 제공 메타데이터(displayName, description) 추출 및 특징 정비
    return filtered.map(m => {
      const id = m.name.replace('models/', '');
      const curated = CURATED_MODELS.find(c => c.id === id || id.startsWith(c.id));

      // 이미 큐레이션된 정보가 있으면 우선 활용
      if (curated) {
        return {
          ...curated,
          id, // 실제 반환된 id 유지 (버전 서픽스 포함 시 안전)
          displayName: m.displayName || curated.name,
          googleDescription: m.description || '',
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit
        };
      }

      // 3.x 신규 파생 모델의 경우 동적으로 스마트 특징 구성
      const isPro = id.includes('pro');
      const isLite = id.includes('lite') || id.includes('8b');
      const cleanName = m.displayName || id.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      const shortDesc = isPro ? '🧠 [고성능] 심층 추론 및 정밀 분석' : isLite ? '🚀 [가성비] 모바일 초고속 최저비용' : '⚡ [최신] 실시간 표준 모델';

      return {
        id,
        t_key: id.replace(/[^a-zA-Z0-9]/g, '_'),
        name: cleanName,
        shortDesc,
        displayName: m.displayName || cleanName,
        googleDescription: m.description || '',
        speed: isPro ? '🐢 느림' : isLite ? '🚀 매우 빠름' : '⚡ 빠름',
        speed_key: isPro ? 'slow' : isLite ? 'very_fast' : 'fast',
        tokens: isPro ? '💎 높음' : isLite ? '📉 매우 낮음' : '📉 낮음',
        tokens_key: isPro ? 'high' : isLite ? 'very_low' : 'low',
        pros: m.description || 'Google API를 통해 실시간 활성화되어 즉시 사용 가능한 공식 최신 모델입니다.',
        cons: isPro ? '정밀한 연산으로 대기 시간이 약간 발생할 수 있습니다.' : isLite ? '심화 어근 해설 시 설명이 축약될 수 있습니다.' : '표준적인 속도와 성능을 제공합니다.',
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit
      };
    });

  } catch (error) {
    console.error("fetchGeminiModels Error:", error);
    throw error;
  }
};

/**
 * 1타 강사 화이트보드 강의 대본을 JSON 배열(PPT 슬라이드) 형식으로 생성하는 함수
 */
export const generateWordLecture = async (wordData, apiKey, modelName = 'gemini-3.8-flash', userLang = 'ko', studyLang = 'id') => {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) throw new Error('API 키가 설정되지 않았습니다.');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`;

  // 언어 이름 매핑
  const langNames = { ko: '한국어(Korean)', id: '인도네시아어(Indonesian)', en: '영어(English)' };
  const targetLangName = langNames[studyLang];
  const nativeLangName = langNames[userLang];

  const promptText = `
  당신은 ${nativeLangName} 사용자를 대상으로 하는 ${targetLangName} 교육계의 **'1타 스타 강사 선생님'**입니다. 
  학생이 "${wordData.word}" (뜻: ${wordData.meaning}) 이라는 단어에 대해 자세하고 친절한 강의를 요청했습니다.
  
  친근하지만 전문적인 강사 말투(해요체/하십시오체 혼용, 학생에게 말 거는 듯한 말투)로 화이트보드에서 강의하듯 설명해주세요.
  시각적인 PPT처럼 한 단계씩 보여줄 수 있도록 배열(Array) 형태로 강의 슬라이드를 구성해주세요.
  모든 설명은 반드시 **${nativeLangName}**로 작성해야 하며, 예문은 ${targetLangName}와 해석을 함께 제공하세요.
  
  [중요 지침]
  1. **이모지 사용 절대 금지**: 대본의 어느 곳에도 이모지(Emoji)를 넣지 마세요.
  2. **특수기호 사용 주의**: TTS(음성 합성) 엔진이 읽을 것을 고려하여 '~', '?', '!' 등의 특수기호 남발을 자제하세요.
     특히 '~하다', '~에 가다' 같은 표현을 쓸 때 기호 '~'를 쓰지 말고, 문맥에 맞게 '무엇무엇을 하다', '어디어디에 가다', '누구누구와' 처럼 글자 그대로 자연스럽게 풀어서 작성하세요. (TTS가 '물결표'라고 어색하게 읽는 것을 방지하기 위함입니다)
  3. 설명이나 예문 중에 나타나는 ${targetLangName} 단어나 문장은 발음 구분을 위해 반드시 <target>단어</target> 태그로 감싸서 응답하세요. 
  예시: "<target>hampir</target>만 써도 거의 무엇무엇을 할 뻔했다는 뜻이 되지만, 뒤에 <target>saja</target>를 붙이면..."
  
  반드시 다음 형식의 JSON 배열로 반환해야 합니다. 배열 안에는 객체들이 들어가야 하며 마크다운 백틱(\`\`\`)을 쓰지 마세요:
  [
    {
      "type": "intro",
      "content": "선생님의 활기찬 인사말! 이 단어('${wordData.word}')의 핵심 펀치라인이나 흥미로운 사실 1문장"
    },
    {
      "type": "grammar",
      "content": "이 단어의 문법적인 형태(품사, 어근 등)에 대한 쉽고 재밌는 설명"
    },
    {
      "type": "usage",
      "content": "이 단어가 실제 어떻게 쓰이는지 보여주는 꿀팁! 격식체(존댓말)와 비격식체(반말) 예문을 각각 하나씩 들고 해석해주세요."
    },
    {
      "type": "nuance",
      "content": "이 단어만의 아주 미세한 뉘앙스, 주의할 점, 또는 원어민들이 자주 쓰는 비슷한 단어와의 차이점"
    },
    {
      "type": "question",
      "content": "자, 학생 집중! 이 단어를 활용한 객관식 또는 주관식 돌발 퀴즈 1개를 내주세요. (정답은 여기에 쓰면 안 됩니다)"
    },
    {
      "type": "answer",
      "content": "위 퀴즈의 정답 공개 및 폭풍 칭찬 한마디!"
    }
  ]
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`강의 생성 실패: ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const textContent = data.candidates[0].content.parts[0].text;
    
    // 마크다운 블록 제거
    let parsedData;
    try {
      parsedData = JSON.parse(textContent.trim().replace(/```(?:json)?/g, '').replace(/```/g, '').trim());
    } catch (e) {
      console.error("JSON 파싱 에러:", textContent);
      throw new Error("AI가 올바른 JSON 형식을 반환하지 않았습니다.");
    }
    
    return parsedData;

  } catch (error) {
    console.error("generateWordLecture Error:", error);
    throw error;
  }
};
/**
 * 단순 텍스트 번역 기능 (v19.21 - AbortController 및 초고성능 번역 특화 튜닝 적용)
 */
export const translateText = async (text, fromLang, toLang, apiKey, modelName = 'gemini-3.8-flash', style = 'formal', signal = null) => {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) throw new Error('API 키가 설정되지 않았습니다.');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`;
  const langNames = { ko: '한국어(Korean)', id: '인도네시아어(Indonesian)', en: '영어(English)' };

  const styleInstruction = style === 'casual' 
    ? "인위적인 번역투를 완전히 배제하고, 원어민들이 일상 대화나 SNS에서 쓰는 매우 친근하고 자연스러운 구어체(반말/친구 사이 어투)로 번역하세요." 
    : "비즈니스나 공식 석상에 어울리는 극도로 예의 바르고 공손한 격식체(존댓말/높임말 어투)로 번역하세요.";

  const promptText = `
  당신은 전 세계 최고의 전문 인공지능 번역 엔진입니다.
  다음 텍스트를 ${langNames[fromLang]}에서 ${langNames[toLang]}로 한 글자 한 글자의 단순 치환이 아닌, 언어 고유의 문화적 맥락과 뉘앙스를 100% 살려 완벽하게 번역하세요.
  
  [핵심 지침]
  1. ${styleInstruction}
  2. 인도네시아어와 한국어 번역 시 조사, 어근(Kata Dasar), 접사(Affix)의 결합 논리를 원어민 수준으로 매끄럽게 녹여내세요.
  3. 다른 부연 설명, 해석, 서론, 결론, 혹은 마크다운 백틱(\`\`\`) 등은 절대로 출력하지 마십시오. 오직 '번역된 최종 문장' 그 자체만 단 한 단어도 덧붙이지 말고 반환하십시오.
  
  텍스트: "${text}"
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.1, // 0.1로 극단적으로 낮추어 일관성과 최적의 번역 속도 확보
          topP: 0.95
          // maxOutputTokens 한도를 완전 제거하여 장문 번역도 절대 끊기지 않도록 보증합니다.
        }
      }),
      signal // 이전 네트워크 요청을 취소시킬 수 있는 신호 연동
    });

    // 1. HTTP 네트워크 응답에 실패한 경우 정교한 오류 분석
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson.error?.message || `번역 서버 요청 실패 (HTTP ${response.status})`;
      throw new Error(errMsg);
    }

    const data = await response.json();

    // 2. API가 명시적 에러를 담고 있는 경우 처리
    if (data.error) {
      throw new Error(data.error.message);
    }

    // 3. candidates 배열 존재 및 안전 필터 블록 검사
    if (!data.candidates || data.candidates.length === 0) {
      if (data.promptFeedback?.blockReason) {
        throw new Error(`AI 안전 필터에 의해 번역이 차단되었습니다. (사유: ${data.promptFeedback.blockReason})`);
      }
      throw new Error("AI가 해당 입력에 대한 번역 데이터를 생성하지 못했습니다. 입력값을 확인해주세요.");
    }

    const candidate = data.candidates[0];

    // 4. 생성된 content 및 parts 조각 안전성 검증
    // [v19.23 초유연성 패치] parts에 번역 데이터가 조금이라도 담겨 있다면, MAX_TOKENS나 STOP으로 조기 중단되었어도 에러를 던지지 않고 최대한 추출해 줍니다.
    const partText = candidate.content?.parts?.[0]?.text;
    if (partText && partText.trim()) {
      return partText.trim();
    }

    // parts가 진짜 100% 비어 있는 상황에서만 마감 사유를 엄격히 추적해 예외를 발생시킵니다.
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`답변 생성 중단 (사유: ${candidate.finishReason})`);
      }
      throw new Error("AI 번역 결과가 비어 있습니다.");
    }

    return "";

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`[Translate-API] ⚡ 이전 중복 요청 취소 완료: "${text.substring(0, 10)}..."`);
      return null;
    }
    console.error("translateText Error:", error);
    throw error;
  }
};

/**
 * 번역된 단어를 바탕으로 AI 단어장 데이터를 생성하는 기능
 */
export const enrichWordFromTranslation = async (word, meaning, userLang, studyLang, apiKey, modelName = 'gemini-3.8-flash') => {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) throw new Error('API 키가 설정되지 않았습니다.');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`;
  const langNames = { ko: '한국어(Korean)', id: '인도네시아어(Indonesian)', en: '영어(English)' };
  
  // 기존 generateWords의 프롬프트 로직을 재활용하여 단일 단어용으로 최적화
  const promptText = `
  당신은 ${langNames[userLang]} 사용자를 대상으로 하는 ${langNames[studyLang]} 1타 강사입니다.
  단어 "${word}" (뜻: ${meaning})에 대해 상세한 학습 정보를 생성해주세요.
  반드시 JSON 객체 형식으로만 응답하세요.
  
  [구조]
  {
    "word": "${word}",
    "meaning": "${meaning}",
    "pos": "품사 (한국어로)",
    "root": "인도네시아어인 경우 어근",
    "pronunciation": "발음 기호",
    "example_formal": "격식체 예문",
    "example_formal_kr": "격식체 예문 번역",
    "example_casual": "비격식체 예문",
    "example_casual_kr": "비격식체 예문 번역",
    "antonym": "반대어 (단어 (뜻) 형식)",
    "synonym": "유사어 (단어 (뜻) 형식)",
    "context": "단어의 상황/뉘앙스 설명",
    "caution": "학습 시 주의점",
    "related": "강사의 암기 비법",
    "grammar_rule": "핵심 문법",
    "word_breakdown": [{"word": "단어", "meaning": "뜻"}]
  }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!response.ok) throw new Error('데이터 고도화 실패');
    const data = await response.json();
    const textContent = data.candidates[0].content.parts[0].text;
    return JSON.parse(textContent.trim());
  } catch (error) {
    console.error("enrichWordFromTranslation Error:", error);
    throw error;
  }
};
