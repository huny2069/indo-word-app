import React, { createContext, useState, useEffect, useContext } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // 사용자의 모국어 (UI 언어) - 기본값: ko
  const [userLang, setUserLang] = useState(() => {
    return localStorage.getItem('userLang') || 'ko';
  });

  // 사용자가 배우려는 타겟 언어 - 기본값: id
  const [studyLang, setStudyLang] = useState(() => {
    return localStorage.getItem('studyLang') || 'id';
  });

  useEffect(() => {
    localStorage.setItem('userLang', userLang);
  }, [userLang]);

  useEffect(() => {
    localStorage.setItem('studyLang', studyLang);
  }, [studyLang]);

  // UI 번역 함수 (translations.js 사용)
  const t = (key, params = {}) => {
    let str = translations[userLang]?.[key] || translations['ko']?.[key] || key;
    
    // {count} 등의 플레이스홀더 치환
    Object.keys(params).forEach(p => {
      str = str.replace(`{${p}}`, params[p]);
    });
    
    return str;
  };

  const changeUserLang = (langCode) => setUserLang(langCode);
  const changeStudyLang = (langCode) => setStudyLang(langCode);

  return (
    <LanguageContext.Provider value={{ 
      lang: userLang, 
      userLang, 
      studyLang, 
      isIndoMode: studyLang === 'id',
      changeUserLang, 
      changeStudyLang,
      setLanguage: changeUserLang, // Layout.jsx 호환용 별칭
      t 
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
