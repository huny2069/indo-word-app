import React, { createContext, useState, useEffect, useContext } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // 인니인을 위한 한국어 학습 모드 여부 (기본값: false, 한국인 모드)
  const [isIndoMode, setIsIndoMode] = useState(() => {
    return localStorage.getItem('isIndoMode') === 'true';
  });

  const [lang, setLang] = useState(isIndoMode ? 'id' : 'ko');

  useEffect(() => {
    localStorage.setItem('isIndoMode', isIndoMode);
    setLang(isIndoMode ? 'id' : 'ko');
  }, [isIndoMode]);

  // UI 번역 함수 (translations.js 사용)
  const t = (key, params = {}) => {
    let str = translations[lang]?.[key] || key;
    
    // {count} 등의 플레이스홀더 치환
    Object.keys(params).forEach(p => {
      str = str.replace(`{${p}}`, params[p]);
    });
    
    return str;
  };

  const setLanguage = (newLang) => {
    if (newLang === 'id') setIsIndoMode(true);
    else if (newLang === 'ko') setIsIndoMode(false);
  };

  const toggleMode = () => setIsIndoMode(prev => !prev);

  return (
    <LanguageContext.Provider value={{ lang, isIndoMode, toggleMode, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
