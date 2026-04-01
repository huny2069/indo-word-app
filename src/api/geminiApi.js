import { logUsage } from './supabase';

export const generateWords = async (topic, count, apiKey, modelName = 'gemini-1.5-flash-latest', excludeWords = [], isIndoMode = false) => {
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정 탭에서 Gemini API 키를 입력해주세요.');
  if (count <= 0 || count > 30) throw new Error('단어 개수는 1에서 30 사이여야 합니다.');

  // 동적 모델 이름 적용 (예: gemini-2.0-pro)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const role = isIndoMode ? "최고의 한국어 교육 전문가" : "최고의 인도네시아어 교육 전문가";
  const targetLang = isIndoMode ? "한국어(Korean)" : "인도네시아어(Indonesian)";
  const explanationLang = isIndoMode ? "인도네시아어(Indonesian)" : "한국어(Korean)";

  const promptText = `
당신은 ${role}입니다.
사용자가 요청한 주제 "${topic}"에 관련된 ${targetLang} 단어 ${count}개를 생성해주세요.

[중요 지침]
1. 반드시 아래의 정해진 JSON 배열 형식에 맞춰 순수한 JSON 문자열로만 응답하세요.
2. JSON 표준을 엄격히 준수하세요.
3. 모든 설명(context, caution, related, grammar_rule, breakdown 등)은 반드시 **${explanationLang}**로 작성하세요.
4. 마크다운 백틱(\`\`\`)을 포함하지 마세요. 오직 JSON 데이터만 반환하세요.

배열 각 요소의 JSON 구조:
{
  "word": "${targetLang} 단어",
  "meaning": "${explanationLang} 뜻",
  "pos": "품사 (명사, 동사, 형용사, 부사, 대명사, 수사, 전치사, 접속사, 감탄사, 한정사 중 택1 - ${explanationLang}로 표기)",
  "root": "어근 (Kata Dasar 또는 한국어 표제어)",
  "example_formal": "${targetLang} 격식체(존댓말) 예문",
  "example_formal_kr": "위 격식체 예문의 ${explanationLang} 번역",
  "example_casual": "${targetLang} 일상 구어체(반말) 예문",
  "example_casual_kr": "위 구어체 예문의 ${explanationLang} 번역",
  "antonym": "반대어 (${targetLang} 단어)",
  "synonym": "유사어 (${targetLang} 단어)",
  "context": "이 단어를 실제로 '언제, 어떤 상황에서' 사용하는 것이 가장 자연스러운지 구체적인 사용 맥락 설명 (${explanationLang}로 1문장)",
  "caution": "사용 시 주의사항이나 문화적 배경 (${explanationLang}로 1문장)",
  "related": "학습 팁이나 관련 표현 (${explanationLang}로 1문장)",
  "grammar_rule": "문법적 특징이나 변형 규칙 설명 (${explanationLang}로 1문장)",
  "word_breakdown": [{"word": "단어/토큰", "meaning": "뜻"}] // 두 예문(formal, casual)에 등장하는 **모든 개별 단어(조사, 접두사/접미사가 붙은 변형태, 관용구 포함)**의 뜻을 ${explanationLang}로 하나도 빠짐없이 제공하세요.
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

        // [추가] Supabase 중앙 통계 서버로 로그 전송
        try {
            logUsage({
                user_id: localStorage.getItem('user_device_id') || 'anonymous',
                tokens_used: totalTokenCount,
                cost_usd: costNow,
                topic: topic
            });
        } catch (err) {
            console.warn("Logging to Supabase failed:", err);
        }
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
