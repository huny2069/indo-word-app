import React, { useState } from 'react';

const InteractiveSentence = ({ sentence, wordBreakdown }) => {
  const [activeWordId, setActiveWordId] = useState(null);

  if (!sentence) return null;

  const clean = (str) => {
    if (!str) return '';
    return str.replace(/[.,!?()[\]{}"'/-]/g, '').toLowerCase().trim();
  };

  // 단어장 맵 생성
  const breakdownMap = {};
  if (wordBreakdown && Array.isArray(wordBreakdown)) {
    wordBreakdown.forEach(item => {
      const cleanKey = clean(item.word);
      if (cleanKey) breakdownMap[cleanKey] = item.meaning;
    });
  }

  // 숙어 및 단어를 포함한 모든 매칭 가능한 키들 (길이 내림차순 정렬)
  const sortedKeys = Object.keys(breakdownMap).sort((a, b) => b.length - a.length);

  // 문장을 매칭된 부분과 매칭되지 않은 부분으로 나눔
  const renderInteractiveText = () => {
    let result = [];
    let remainingText = sentence;
    let keyIndex = 0;

    // 단순화를 위해 공백 기준으로 토큰화하되, 숙어 매칭 시도
    const tokens = sentence.split(/(\s+)/); // 공백 보존하며 분할

    let i = 0;
    while (i < tokens.length) {
      const currentToken = tokens[i];
      if (/\s+/.test(currentToken)) {
        result.push(currentToken);
        i++;
        continue;
      }

      // 숙어 매칭 시도 (최대 5단어까지 확인)
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
        result.push(
          <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
            <span 
              onClick={() => setActiveWordId(activeWordId === idx ? null : idx)}
              style={{ 
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                textDecorationColor: '#90caf9',
                color: '#0a58ca',
                padding: '1px 2px',
                borderRadius: '4px',
                background: activeWordId === idx ? '#e3f2fd' : 'transparent',
                transition: 'background 0.2s',
                fontWeight: '600'
              }}
            >
              {foundMatch.text}
            </span>
            {activeWordId === idx && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                marginBottom: '6px', background: '#333', color: '#fff', padding: '6px 12px',
                borderRadius: '8px', fontSize: '0.85rem', whiteSpace: 'nowrap', zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 'bold'
              }}>
                {foundMatch.meaning}
                <div style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  borderWidth: '5px', borderStyle: 'solid', borderColor: '#333 transparent transparent transparent'
                }} />
              </div>
            )}
          </div>
        );
      } else {
        // 매칭되지 않은 단어
        result.push(currentToken);
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
