/**
 * 데이터를 CSV 문자열로 변환하는 유틸리티
 * @param {Array} words - DB에서 가져온 단어 배열
 * @returns {string} - CSV 형식의 문자열
 */
export const convertToCSV = (words) => {
  if (!words || words.length === 0) return '';

  // 헤더 정의 (전체 필드 포함)
  const headers = [
    'word', 'meaning', 'pos', 'root', 
    'example_id', 'example_kr', 
    'example_formal', 'example_formal_kr',
    'example_casual', 'example_casual_kr',
    'antonym', 'synonym', 'grammar_rule',
    'context', 'caution', 'related',
    'word_breakdown', 'folderId', 'created_at', 'level', 'next_review_date'
  ];
  
  // 데이터 행 생성
  const rows = words.map(w => {
    return headers.map(header => {
      let value = w[header];
      
      // 값이 객체나 배열인 경우 (word_breakdown 등) JSON 문자열로 변환
      if (value && typeof value === 'object') {
        value = JSON.stringify(value);
      } else {
        value = value || '';
      }

      // 따옴표 처리: 값 내부에 따옴표가 있으면 두 개("")로 이스케이프하고 전체를 따옴표로 감쌈
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  // 헤더와 데이터를 합침 (UTF-8 BOM 추가하여 엑셀 한글 깨짐 방지)
  const csvContent = [headers.join(','), ...rows].join('\n');
  return '\ufeff' + csvContent;
};

/**
 * CSV 문자열을 파싱하여 객체 배열로 변환
 * @param {string} csvText - 읽어온 CSV 파일 내용
 * @returns {Array} - 파싱된 단어 객체 배열
 */
export const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // BOM 제거 및 헤더 추출
  const headers = lines[0].replace(/^\ufeff/, '').split(',').map(h => h.trim().replace(/"/g, ''));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = [];
    let current = '';
    let inQuotes = false;
    
    // 단순 split이 아닌 CSV 규칙에 따른 파싱 (따옴표 내부 콤마 무시 및 이중 따옴표 복원)
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j+1] === '"') {
          // 이중 따옴표("") 처리
          current += '"';
          j++; 
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const obj = {};
    headers.forEach((header, index) => {
      let val = values[index] || '';
      
      // word_breakdown 유연한 파싱 (JSON 배열 또는 "단어: 뜻 | 단어: 뜻" 형태)
      if (header === 'word_breakdown') {
        val = parseWordBreakdown(val);
      } else if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        try {
          val = JSON.parse(val);
        } catch (e) {}
      }
      obj[header] = val;
    });
    result.push(obj);
  }

  return result;
};

/**
 * 다양한 형태의 word_breakdown 문자열을 [{ word, meaning }] 객체 배열로 정규화
 */
export const parseWordBreakdown = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    // "단어: 뜻 | 단어: 뜻" 또는 "단어 - 뜻" 형태 파싱
    if (trimmed.includes(':') || trimmed.includes('|')) {
      const items = trimmed.split('|').map(s => s.trim()).filter(Boolean);
      return items.map(item => {
        const parts = item.split(':');
        return {
          word: (parts[0] || '').trim(),
          meaning: (parts.slice(1).join(':') || '').trim()
        };
      }).filter(b => b.word);
    }
  }
  return [];
};

