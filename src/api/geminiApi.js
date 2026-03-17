export const generateWords = async (topic, count, apiKey, modelName = 'gemini-1.5-flash-latest', excludeWords = []) => {
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정 탭에서 Gemini API 키를 입력해주세요.');
  if (count <= 0 || count > 30) throw new Error('단어 개수는 1에서 30 사이여야 합니다.');

  // 동적 모델 이름 적용 (예: gemini-2.0-pro)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const promptText = `
당신은 최고의 인도네시아어 교육 전문가입니다.
사용자가 요청한 주제 "${topic}"에 관련된 인도네시아어 단어 ${count}개를 생성해주세요.

[중요 지침]
1. 반드시 아래의 정해진 JSON 배열 형식에 맞춰 순수한 JSON 문자열로만 응답하세요.
2. JSON 표준을 엄격히 준수하세요: 모든 키와 문자열 값은 반드시 "큰따옴표(Double Quotes)"를 사용해야 하며, '작은따옴표(Single Quotes)'는 절대 사용하지 마세요.
3. 문자열 내부에 따옴표가 필요한 경우 반드시 백슬래시(\)로 이스케이프 처리하세요.
4. 마크다운 백틱(\`\`\`)을 포함하지 마세요. 오직 JSON 데이터만 반환하세요.

배열 각 요소의 JSON 구조:
{
  "word": "인도네시아어 단어 (소문자 기준)",
  "meaning": "한국어 뜻",
  "pos": "품사 (명사, 동사, 형용사, 부사, 대명사, 수사, 전치사, 접속사, 감탄사, 한정사 중 택1)",
  "root": "어근 (Kata Dasar)",
  "example_formal": "격식체(존댓말) 예문",
  "example_formal_kr": "위 격식체 예문의 자연스러운 한국어 해석",
  "example_casual": "현지인들이 일상에서 쓰는 구어체(친근한/반말) 예문",
  "example_casual_kr": "위 구어체 예문의 한국어 해석",
  "antonym": "반대어 인도네시아어 단어 (없으면 빈 문자열)",
  "synonym": "유사어 인도네시아어 단어 (없으면 빈 문자열)",
  "context": "이 단어를 실제로 '언제, 어떤 상황에서, 어떤 용도로' 사용하는 것이 가장 적절하고 자연스러운지 구체적인 사용 맥락 설명 (단어의 사전적 뜻을 반복하지 말고, '식당에서 음식을 주문할 때', '처음 만난 사람에게 예의를 갖출 때'와 같이 상황 위주로 한국어 1문장 작성)",
  "caution": "이 단어를 사용할 때 한국인이 흔히 실수하기 쉬운 점이나 현지 문화적 배경과 관련된 특별한 주의사항 (한국어 1문장)",
  "related": "함께 쓰면 시너지 효과가 나는 단어나 현지인들이 자주 엮어서 사용하는 표현 팁 (한국어 1문장)",
  "grammar_rule": "어근(Kata Dasar)에서 접사가 붙어 파생어가 되면서 변형(예: me-N 접두사에 의한 알파벳 탈락 등)이 일어났다면 그 문법 규칙을 간단명료히 설명 (변형이 없거나 어근 자체라면 '변형 없음'으로 작성)",
  "word_breakdown": [{"word": "예문에 쓰인 단어1", "meaning": "단어1의 뜻"}, {"word": "예문에 쓰인 단어2", "meaning": "단어2의 뜻"}] // 두 예문에 쓰인 모든 핵심 단어들의 원형과 뜻풀이를 배열 객체 형태로 모두 제공하세요.
}

${excludeWords.length > 0 ? `반드시 다음 단어들은 이미 학습했으므로 제외하고 새로운 단어로만 생성하세요: [${excludeWords.join(', ')}]` : ''}
`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`API 요청 실패: ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // [추가] 토큰 사용량 및 예상 비용 트래킹 로직
    if (data.usageMetadata) {
        const { promptTokenCount = 0, candidatesTokenCount = 0, totalTokenCount = 0 } = data.usageMetadata;
        
        // 누적 토큰 저장
        const prevTokens = parseInt(localStorage.getItem('total_gemini_tokens') || '0', 10);
        localStorage.setItem('total_gemini_tokens', (prevTokens + totalTokenCount).toString());

        // 예상 비용 계산 (USD 기준, 2024-2025 Pay-as-you-go 가격 반영)
        // Flash: Input $0.075/1M, Output $0.3/1M
        // Pro: Input $1.25/1M, Output $5.0/1M
        const isPro = modelName.includes('pro');
        const inputRate = isPro ? 1.25 / 1000000 : 0.075 / 1000000;
        const outputRate = isPro ? 5.0 / 1000000 : 0.3 / 1000000;
        
        const costNow = (promptTokenCount * inputRate) + (candidatesTokenCount * outputRate);
        const prevCost = parseFloat(localStorage.getItem('total_gemini_cost_usd') || '0');
        localStorage.setItem('total_gemini_cost_usd', (prevCost + costNow).toFixed(6));
    }

    const textContent = data.candidates[0].content.parts[0].text;
    
    let parsedData = [];
    try {
        // 1. 기본 파싱 시도
        parsedData = JSON.parse(textContent.trim());
    } catch (e) {
        console.warn("JSON parsing failed, attempting cleanup...", e);
        try {
            // 2. 마크다운 및 불필요한 공백 제거
            let cleaned = textContent.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
            
            // 3. 문제의 싱글 쿼트(') 보정 시도 (값이 싱글 쿼트로 감싸진 경우)
            // 주의: 모든 '를 "로 바꾸면 문자열 내부의 작은따옴표가 깨질 수 있으므로, 
            // JSON 키:값 구조에서 값으로 쓰이는 '만 제한적으로 교체하는 정규식 사용
            cleaned = cleaned.replace(/:\s*'([^']*)'/g, ': "$1"');
            
            parsedData = JSON.parse(cleaned);
        } catch (e2) {
            console.error("JSON cleanup failed:", e2);
            throw new Error(`AI가 생성한 데이터의 형식이 올바르지 않습니다. (JSON Error): ${e2.message}`);
        }
    }
    
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
  if (!apiKey) throw new Error('API 키가 없습니다.');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
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
