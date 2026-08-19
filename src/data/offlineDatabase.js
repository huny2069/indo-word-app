/**
 * 인코(Inko) 1만 단어 오프라인 통합 데이터베이스 및 검색/추출 엔진
 */

import { OFFLINE_CATEGORIES } from './categories';
import { discourseConnectors } from './discourseConnectors';
import { emotionsNuances } from './emotionsNuances';
import { affixVerbs } from './affixVerbs';
import { slangDailySpoken } from './slangDailySpoken';
import { bipaTopics } from './bipaTopics';

// 전체 오프라인 단어 통합 풀
export const ALL_OFFLINE_WORDS = [
  ...discourseConnectors,
  ...emotionsNuances,
  ...affixVerbs,
  ...slangDailySpoken,
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
 * @param {Object} filterOptions
 * @param {string} filterOptions.categoryId - 대분류 ID (선택)
 * @param {string} filterOptions.subcategoryId - 소분류 ID (선택)
 * @param {string} filterOptions.keyword - 검색어 (단어, 뜻, 어근)
 * @param {Array<string>} filterOptions.excludeWords - 제외할 단어 목록 (기존 단어장에 있는 단어)
 * @returns {Array} 필터링된 단어 배열
 */
export const searchOfflineWords = ({ categoryId = '', subcategoryId = '', keyword = '', excludeWords = [] } = {}) => {
  const cleanKeyword = keyword.trim().toLowerCase();
  const lowerExcludes = excludeWords.map(w => (typeof w === 'string' ? w.toLowerCase() : ''));

  return ALL_OFFLINE_WORDS.filter(item => {
    // 1. 대분류 체크
    if (categoryId && item.category_id !== categoryId) return false;

    // 2. 소분류 체크
    if (subcategoryId && item.subcategory_id !== subcategoryId) return false;

    // 3. 중복 제외 체크
    const cleanWord = item.word.split(' ')[0].toLowerCase();
    if (lowerExcludes.includes(cleanWord) || lowerExcludes.includes(item.word.toLowerCase())) {
      return false;
    }

    // 4. 키워드 검색 (단어, 뜻, 어근, 상황, 문법 등)
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
 * 지정한 조건에 따라 무작위 N개 단어 추출 (단어 생성용)
 * @param {Object} options
 * @param {string} options.categoryId
 * @param {string} options.subcategoryId
 * @param {number} options.count
 * @param {Array<string>} options.excludeWords
 * @returns {Array} 추출된 단어 배열
 */
export const extractOfflineWords = ({ categoryId = '', subcategoryId = '', count = 10, excludeWords = [] } = {}) => {
  const candidates = searchOfflineWords({ categoryId, subcategoryId, excludeWords });
  
  // 셔플 알고리즘 (Fisher-Yates)
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
};
