import React, { useState } from 'react';

const InteractiveSentence = ({ sentence, wordBreakdown, breakdown }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [clickedIdx, setClickedIdx] = useState(null);

  if (!sentence) return null;

  const actualBreakdown = wordBreakdown || breakdown || [];

  const clean = (str) => {
    if (!str) return '';
    return str.replace(/[.,!?()[\]{}"'/-]/g, '').toLowerCase().trim();
  };

  // 단어장 맵 생성
  const breakdownMap = {};
  if (actualBreakdown && Array.isArray(actualBreakdown)) {
    actualBreakdown.forEach(item => {
      if (!item || !item.word) return;
      const cleanKey = clean(item.word);
      if (cleanKey) {
        breakdownMap[cleanKey] = item.meaning;
      }
    });
  }

  // 단일 단어/토큰 전용 지능형 의미 매칭 헬퍼 (공백 없는 1개 단어 대상)
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

  // 문장을 매칭된 부분과 매칭되지 않은 부분으로 나눔
  const renderInteractiveText = () => {
    let result = [];
    const tokens = sentence.split(/(\s+)/); // 공백 보존하며 분할

    let i = 0;
    while (i < tokens.length) {
      const currentToken = tokens[i];
      if (/\s+/.test(currentToken)) {
        result.push(currentToken);
        i++;
        continue;
      }

      // 1. 다어절(2단어 이상) 숙어/연어 매칭 시도
      // (주의: 반드시 breakdownMap에 정확히 일치하는 다어절 키가 있을 때만 한정 매칭!)
      let foundMatch = null;
      for (let j = 5; j >= 2; j--) {
        if (i + (j * 2) - 1 <= tokens.length) {
          const potentialPhraseTokens = tokens.slice(i, i + (j * 2) - 1);
          const potentialPhrase = potentialPhraseTokens.join('').trim();
          const cleanP = clean(potentialPhrase);

          if (cleanP && breakdownMap[cleanP]) {
            foundMatch = {
              text: potentialPhrase,
              meaning: breakdownMap[cleanP],
              originalIndex: i
            };
            i += (j * 2) - 1;
            break;
          }
        }
      }

      if (foundMatch) {
        const idx = foundMatch.originalIndex;
        const isShow = hoveredIdx === idx || clickedIdx === idx;
        result.push(
          <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
            <span 
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={(e) => { e.stopPropagation(); setClickedIdx(clickedIdx === idx ? null : idx); }}
              style={{ 
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                textDecorationColor: '#ff9f43',
                color: '#d35400',
                padding: '1px 3px',
                borderRadius: '4px',
                background: isShow ? '#ffeaa7' : '#fff3e0',
                transition: 'all 0.2s',
                fontWeight: '700'
              }}
            >
              {foundMatch.text}
            </span>
            {isShow && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                marginBottom: '6px', background: '#2d3436', color: '#fff', padding: '6px 12px',
                borderRadius: '8px', fontSize: '0.85rem', whiteSpace: 'normal', maxWidth: '280px',
                textAlign: 'center', lineHeight: '1.4', zIndex: 999,
                boxShadow: '0 4px 15px rgba(0,0,0,0.25)', fontWeight: 'bold'
              }}>
                {foundMatch.meaning}
                <div style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  borderWidth: '5px', borderStyle: 'solid', borderColor: '#2d3436 transparent transparent transparent'
                }} />
              </div>
            )}
          </div>
        );
      } else {
        // 2. 단일 단어 개별 지능형 의미 매칭 (단어 하나하나 독립 분리 매칭)
        const tokenMeaning = findSingleWordMeaning(currentToken);
        const idx = i;
        const isShow = tokenMeaning && (hoveredIdx === idx || clickedIdx === idx);

        if (tokenMeaning) {
          result.push(
            <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
              <span 
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={(e) => { e.stopPropagation(); setClickedIdx(clickedIdx === idx ? null : idx); }}
                style={{ 
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                  textDecorationColor: '#74b9ff',
                  color: '#0984e3',
                  padding: '1px 3px',
                  borderRadius: '4px',
                  background: isShow ? '#dff9fb' : '#f0f9ff',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                {currentToken}
              </span>
              {isShow && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginBottom: '6px', background: '#2d3436', color: '#fff', padding: '6px 12px',
                  borderRadius: '8px', fontSize: '0.85rem', whiteSpace: 'normal', maxWidth: '280px',
                  textAlign: 'center', lineHeight: '1.4', zIndex: 999,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.25)', fontWeight: 'bold'
                }}>
                  {tokenMeaning}
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                    borderWidth: '5px', borderStyle: 'solid', borderColor: '#2d3436 transparent transparent transparent'
                  }} />
                </div>
              )}
            </div>
          );
        } else {
          result.push(currentToken);
        }
        i++;
      }
    }
    return result;
  };

  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px', alignItems: 'center' }}>
      {renderInteractiveText()}
    </div>
  );
};

export default InteractiveSentence;
