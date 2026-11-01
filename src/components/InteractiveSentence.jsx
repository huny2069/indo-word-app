import React, { useState } from 'react';

const InteractiveSentence = ({ sentence, wordBreakdown, breakdown }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [clickedIdx, setClickedIdx] = useState(null);

  if (!sentence) return null;

  const actualBreakdown = wordBreakdown || breakdown || [];

  const clean = (str) => {
    if (!str) return '';
    return str.replace(/[.,!?()[\]{}"'“”‘’/–—~-]/g, '').toLowerCase().trim();
  };

  // 단어장 맵 생성: 2단어 이상의 문장/구문은 절대 키로 등록하지 않고 100% 낱단어(1단어)만 등록
  const breakdownMap = {};
  if (actualBreakdown && Array.isArray(actualBreakdown)) {
    actualBreakdown.forEach(item => {
      if (!item || !item.word || !item.meaning) return;
      const rawWord = item.word.trim();
      const rawMeaning = item.meaning.trim();
      
      const words = rawWord.split(/\s+/);
      // 공백이 포함된 2단어 이상의 구문이나 문장 전체는 통째 뭉침 원천 차단을 위해 제외
      if (words.length > 1) {
        return;
      }

      const cleanKey = clean(rawWord);
      if (cleanKey && cleanKey.length >= 1) {
        breakdownMap[cleanKey] = rawMeaning;
      }
    });
  }

  // 단일 단어/어절 전용 지능형 의미 매칭 헬퍼 (공백 없는 1개 단어 대상)
  const findSingleWordMeaning = (token) => {
    if (!token) return null;
    const cleanQ = clean(token);
    if (!cleanQ) return null;

    // 1. 단어 정확 일치
    if (breakdownMap[cleanQ]) return breakdownMap[cleanQ];

    // 2. 한국어 조사(Josa) 접미사 분리 매칭
    const koreanParticles = [
      '에게서', '한테서', '에서', '에게', '한테', '으로', '부터', '까지',
      '처럼', '만큼', '마저', '조차', '보다', '하고', '이랑', '께', '로',
      '와', '과', '랑', '은', '는', '이', '가', '을', '를', '의', '에', '도', '만', '요'
    ];
    for (const p of koreanParticles) {
      if (cleanQ.endsWith(p) && cleanQ.length > p.length) {
        const stem = cleanQ.slice(0, -p.length);
        if (breakdownMap[stem]) return breakdownMap[stem];
      }
    }

    // 3. 한국어 동사/형용사 종결 및 연결어미 분리 매칭
    const verbEndings = [
      '했습니다', '합니다', '됩니다', '입니다',
      '했어요', '해요', '돼요', '이에요', '예요',
      '했다', '한다', '된다', '이다',
      '하고', '하며', '하면', '하니', '해서',
      '습니다', 'ㅂ니다', '어서', '아서', '거나', '지만', '는데', '은데', 'ㄴ데', '었어', '았어', '었다', '았다'
    ];
    for (const e of verbEndings) {
      if (cleanQ.endsWith(e) && cleanQ.length > e.length) {
        const stem = cleanQ.slice(0, -e.length);
        if (breakdownMap[stem]) return breakdownMap[stem];
        if (breakdownMap[stem + '하다']) return breakdownMap[stem + '하다'];
        if (breakdownMap[stem + '다']) return breakdownMap[stem + '다'];
      }
    }

    // 4. 영어 접미사 분리 매칭 (복수형, 과거형, 진행형 등)
    const englishSuffixes = ['ies', 'ing', 'ed', 'es', 'ly', 's'];
    for (const s of englishSuffixes) {
      if (cleanQ.endsWith(s) && cleanQ.length > s.length + 2) {
        const stem = cleanQ.slice(0, -s.length);
        if (breakdownMap[stem]) return breakdownMap[stem];
        if (s === 'ies' && breakdownMap[stem + 'y']) return breakdownMap[stem + 'y'];
      }
    }

    // 5. 인도네시아어 접미사 분리 매칭
    const indoSuffixes = ['nya', 'kan', 'lah', 'kah', 'ku', 'mu'];
    for (const s of indoSuffixes) {
      if (cleanQ.endsWith(s) && cleanQ.length > s.length + 2) {
        const stem = cleanQ.slice(0, -s.length);
        if (breakdownMap[stem]) return breakdownMap[stem];
      }
    }

    // 6. 단일 단어 내에서만 어근이나 원형이 시작하는 경우 (공백이 없는 단어에 한해 1~3글자 조사 결합 등)
    for (const key of Object.keys(breakdownMap)) {
      if (!key.includes(' ') && cleanQ.startsWith(key) && key.length >= 2 && cleanQ.length <= key.length + 3) {
        return breakdownMap[key];
      }
    }

    return null;
  };

  // 문장을 단어 단위로 1:1 개별 분리하여 렌더링
  const renderInteractiveText = () => {
    let result = [];
    // 띄어쓰기(공백)를 보존하여 단어별 분할
    const tokens = sentence.split(/(\s+)/);

    for (let i = 0; i < tokens.length; i++) {
      const currentToken = tokens[i];

      // 공백은 그대로 출력
      if (/\s+/.test(currentToken)) {
        result.push(currentToken);
        continue;
      }

      // 앞뒤 구두점(.,!? 등) 분리하여 핵심 단어만 툴팁 대상화
      const punctMatch = currentToken.match(/^([.,!?()[\]{}"'“”‘’/–—~]*)(.*?)([.,!?()[\]{}"'“”‘’/–—~]*)$/);
      let leadPunct = '';
      let coreWord = currentToken;
      let trailPunct = '';
      if (punctMatch && punctMatch[2]) {
        leadPunct = punctMatch[1];
        coreWord = punctMatch[2];
        trailPunct = punctMatch[3];
      }

      // 각 낱단어별 개별 의미 매칭 (어떤 경우에도 여러 단어를 하나로 묶지 않음)
      const tokenMeaning = findSingleWordMeaning(coreWord);
      const idx = i;
      const isShow = tokenMeaning && (hoveredIdx === idx || clickedIdx === idx);

      if (tokenMeaning) {
        result.push(
          <React.Fragment key={idx}>
            {leadPunct}
            <span 
              style={{ 
                position: 'relative', 
                display: 'inline-block',
                margin: '0 1px'
              }}
            >
              <span 
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={(e) => { e.stopPropagation(); setClickedIdx(clickedIdx === idx ? null : idx); }}
                style={{ 
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                  textDecorationColor: '#f59e0b',
                  color: isShow ? '#b45309' : 'inherit',
                  padding: '2px 4px',
                  borderRadius: '6px',
                  background: isShow ? '#fef08a' : 'transparent',
                  fontWeight: isShow ? '800' : '600',
                  transition: 'all 0.15s ease'
                }}
              >
                {coreWord}
              </span>
              {isShow && (
                <div style={{
                  position: 'absolute', 
                  bottom: '100%', 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  marginBottom: '8px', 
                  background: '#1e293b', 
                  color: '#ffffff', 
                  padding: '6px 12px',
                  borderRadius: '8px', 
                  fontSize: '0.82rem', 
                  whiteSpace: 'nowrap',
                  maxWidth: '280px',
                  textAlign: 'center', 
                  lineHeight: '1.4', 
                  zIndex: 9999,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.25)', 
                  fontWeight: 'bold',
                  pointerEvents: 'none'
                }}>
                  {tokenMeaning}
                  <div style={{
                    position: 'absolute', 
                    top: '100%', 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    borderWidth: '5px', 
                    borderStyle: 'solid', 
                    borderColor: '#1e293b transparent transparent transparent'
                  }} />
                </div>
              )}
            </span>
            {trailPunct}
          </React.Fragment>
        );
      } else {
        result.push(currentToken);
      }
    }
    return result;
  };

  return (
    <div style={{ display: 'inline', flexWrap: 'wrap', alignItems: 'center', lineHeight: '1.8' }}>
      {renderInteractiveText()}
    </div>
  );
};

export default InteractiveSentence;
