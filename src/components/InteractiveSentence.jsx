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
      const cleanKey = clean(item.word);
      if (cleanKey) breakdownMap[cleanKey] = item.meaning;
    });
  }

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

      // 숙어 및 단어 매칭 시도 (최대 5단어까지 확인)
      let foundMatch = null;
      for (let j = 5; j >= 1; j--) {
        const potentialPhraseTokens = tokens.slice(i, i + (j * 2) - 1);
        const potentialPhrase = potentialPhraseTokens.join('').trim();
        const cleanPhrase = clean(potentialPhrase);

        if (breakdownMap[cleanPhrase]) {
          foundMatch = {
            text: potentialPhrase,
            meaning: breakdownMap[cleanPhrase],
            originalIndex: i
          };
          i += (j * 2) - 1;
          break;
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
              onClick={() => setClickedIdx(clickedIdx === idx ? null : idx)}
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
                borderRadius: '8px', fontSize: '0.85rem', whiteSpace: 'nowrap', zIndex: 999,
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontWeight: 'bold'
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
        // 매칭되지 않은 일반 단어도 호버 시 단어/어근 의미 표출 시도 (단어 그대로 보여주기)
        const tokenClean = clean(currentToken);
        const tokenMeaning = breakdownMap[tokenClean];
        const idx = i;
        const isShow = tokenMeaning && (hoveredIdx === idx || clickedIdx === idx);

        if (tokenMeaning) {
          result.push(
            <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
              <span 
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setClickedIdx(clickedIdx === idx ? null : idx)}
                style={{ 
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                  textDecorationColor: '#74b9ff',
                  color: '#0984e3',
                  padding: '1px 2px',
                  borderRadius: '4px',
                  background: isShow ? '#dff9fb' : 'transparent',
                  fontWeight: '600'
                }}
              >
                {currentToken}
              </span>
              {isShow && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginBottom: '6px', background: '#2d3436', color: '#fff', padding: '6px 12px',
                  borderRadius: '8px', fontSize: '0.85rem', whiteSpace: 'nowrap', zIndex: 999,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontWeight: 'bold'
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
