export const generateWords = async (topic, count, apiKey, modelName = 'gemini-1.5-flash', excludeWords = [], userLang = 'ko', studyLang = 'id', email = null) => {
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
    "antonym": "반대어",
    "synonym": "유사어",
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
 * Gemini API의 지원 가능한 모델 목록을 비동기로 불러오는 함수
 */
export const fetchGeminiModels = async (apiKey) => {
  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) throw new Error('API 키가 없습니다.');

  // 최신 및 실험적 모델까지 모두 가져오기 위해 v1beta 엔드포인트 사용
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'GET'
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`모델 조회 실패: ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    // generateContent 메서드를 지원하는 텍스트/멀티모달 모델만 필터링
    const supportedModels = data.models.filter(m => 
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
    );
    
    // 모델명 문자열 배열로 반환 ("models/" 접두사 제거)
    return supportedModels.map(m => m.name.replace('models/', ''));

  } catch (error) {
    console.error("fetchGeminiModels Error:", error);
    throw error;
  }
};

/**
 * 1타 강사 화이트보드 강의 대본을 JSON 배열(PPT 슬라이드) 형식으로 생성하는 함수
 */
export const generateWordLecture = async (wordData, apiKey, modelName = 'gemini-1.5-flash', userLang = 'ko', studyLang = 'id') => {
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
  
  친근하고 열정적인 강사 말투(해요체/하십시오체 혼용, 이모지 적극 사용, 학생에게 말 거는 듯한 말투)로 화이트보드에서 강의하듯 설명해주세요.
  시각적인 PPT처럼 한 단계씩 보여줄 수 있도록 배열(Array) 형태로 강의 슬라이드를 구성해주세요.
  모든 설명은 반드시 **${nativeLangName}**로 작성해야 하며, 예문은 ${targetLangName}와 해석을 함께 제공하세요.
  
  [중요 지침]
  설명이나 예문 중에 나타나는 ${targetLangName} 단어나 문장은 발음 구분을 위해 반드시 <target>단어</target> 태그로 감싸서 응답하세요. 
  예시: "<target>hampir</target>만 써도 '거의 ~할 뻔했다'는 뜻이 되지만, 뒤에 <target>saja</target>를 붙이면..."
  
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
