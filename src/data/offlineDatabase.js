/**
 * 인코(Inko) 1만 단어 오프라인 통합 데이터베이스 및 검색/추출 엔진
 */

import { OFFLINE_CATEGORIES } from './categories';
import { discourseConnectors } from './discourseConnectors';
import { emotionsNuances } from './emotionsNuances';
import { affixVerbs } from './affixVerbs';
import { slangDailySpoken } from './slangDailySpoken';
import { dailyLivingVocab } from './dailyLivingVocab';
import { bipaTopics } from './bipaTopics';

// 전체 오프라인 단어 통합 풀
export const ALL_OFFLINE_WORDS = [
  ...discourseConnectors,
  ...emotionsNuances,
  ...affixVerbs,
  ...slangDailySpoken,
  ...dailyLivingVocab,
  ...bipaTopics
];

/**
 * 카테고리 메타데이터 반환
 */
export const getOfflineCategories = () => {
  return OFFLINE_CATEGORIES;
};

/**
 * 조건에 맞는 오프라인 단어 목록 필터링
 */
export const searchOfflineWords = ({ categoryId = '', subcategoryId = '', keyword = '', excludeWords = [] } = {}) => {
  const cleanKeyword = keyword.trim().toLowerCase();
  const lowerExcludes = excludeWords.map(w => (typeof w === 'string' ? w.toLowerCase() : ''));

  return ALL_OFFLINE_WORDS.filter(item => {
    if (categoryId && item.category_id !== categoryId) return false;
    if (subcategoryId && item.subcategory_id !== subcategoryId) return false;

    const cleanWord = item.word.split(' ')[0].toLowerCase();
    if (lowerExcludes.includes(cleanWord) || lowerExcludes.includes(item.word.toLowerCase())) {
      return false;
    }

    if (cleanKeyword) {
      const matchWord = item.word.toLowerCase().includes(cleanKeyword);
      const matchMeaning = item.meaning.toLowerCase().includes(cleanKeyword);
      const matchRoot = item.root && item.root.toLowerCase().includes(cleanKeyword);
      const matchContext = item.context && item.context.toLowerCase().includes(cleanKeyword);
      if (!matchWord && !matchMeaning && !matchRoot && !matchContext) return false;
    }

    return true;
  });
};

/**
 * 지정한 조건에 따라 무작위 N개 단어 추출
 */
export const extractOfflineWords = ({ categoryId = '', subcategoryId = '', count = 10, excludeWords = [] } = {}) => {
  const candidates = searchOfflineWords({ categoryId, subcategoryId, excludeWords });
  
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
};
