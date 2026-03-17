import React, { useState } from 'react';

const InteractiveSentence = ({ sentence, wordBreakdown }) => {
  const [activeWordId, setActiveWordId] = useState(null);

  if (!sentence) return null;

  // 단어장 맵 생성 (소문자로 변환하여 매핑)
  const breakdownMap = {};
  if (wordBreakdown && Array.isArray(wordBreakdown)) {
    wordBreakdown.forEach(item => {
      // API가 가끔 앞뒤 공백이나 특수문자를 포함할 수 있으므로 정리
      const cleanKey = item.word.replace(/[.,!?()[\]{}"']/g, '').toLowerCase().trim();
      breakdownMap[cleanKey] = item.meaning;
    });
  }

  const words = sentence.split(' ');

  const handleWordClick = (index) => {
    setActiveWordId(activeWordId === index ? null : index);
  };

  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
      {words.map((w, index) => {
        // 현재 단어에서 구두점 제거 후 검색
        const cleanWord = w.replace(/[.,!?()[\]{}"']/g, '').toLowerCase().trim();
        const meaning = breakdownMap[cleanWord];
        
        return (
          <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
            <span 
              onClick={() => meaning ? handleWordClick(index) : null}
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
