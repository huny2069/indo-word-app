import React, { useState } from 'react';

const InteractiveSentence = ({ sentence, wordBreakdown }) => {
  const [activeWordId, setActiveWordId] = useState(null);

  if (!sentence) return null;

  const clean = (str) => {
    if (!str) return '';
    // 하이픈(-) 및 기타 특수문자 제거 필터 강화
    return str.replace(/[.,!?()[\]{}"'/-]/g, '').toLowerCase().trim();
  };

  // 단어장 맵 생성 (소문자로 변환하여 매핑)
  const breakdownMap = {};
  if (wordBreakdown && Array.isArray(wordBreakdown)) {
    wordBreakdown.forEach(item => {
      const cleanKey = clean(item.word);
      if (cleanKey) breakdownMap[cleanKey] = item.meaning;
    });
  }

  const getMeaning = (word) => {
    const cw = clean(word);
    if (!cw) return null;

    // 1. Exact Match (정밀 일치)
    if (breakdownMap[cw]) return breakdownMap[cw];

    // 2. Fuzzy Match (부분 일치 - 인도네시아어 접사 및 어근 고려)
    const keys = Object.keys(breakdownMap).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (key.length < 3) continue; // 너무 짧은 단어(조사 등)는 부분 일치 제외
      
      // 문장의 단어가 어근(key)을 포함하거나, 어근이 단어를 포함하는지 확인
      if (cw.includes(key) || key.includes(cw)) {
        return breakdownMap[key];
      }
    }
    return null;
  };

  const words = sentence.split(/\s+/); // 공백 여러 개 대응

  const handleWordClick = (index, meaning) => {
    if (!meaning) return;
    setActiveWordId(activeWordId === index ? null : index);
  };

  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
      {words.map((w, index) => {
        const meaning = getMeaning(w);
        
        return (
          <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
            <span 
              onClick={() => meaning ? handleWordClick(index, meaning) : null}
              style={{ 
                cursor: meaning ? 'pointer' : 'default',
                textDecoration: meaning ? 'underline' : 'none',
                textDecorationStyle: meaning ? 'dotted' : 'none',
                textDecorationColor: meaning ? '#90caf9' : 'transparent',
                color: meaning ? '#0a58ca' : 'inherit',
                padding: '1px 2px',
                borderRadius: '4px',
                background: activeWordId === index ? '#e3f2fd' : 'transparent',
                transition: 'background 0.2s',
                fontWeight: meaning ? '500' : 'normal'
              }}
            >
              {w}
            </span>
            
            {activeWordId === index && meaning && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '6px',
                background: '#333',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                zIndex: 10,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                {meaning}
                {/* 툴팁 꼬리 */}
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  borderWidth: '5px',
                  borderStyle: 'solid',
                  borderColor: '#333 transparent transparent transparent'
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default InteractiveSentence;
