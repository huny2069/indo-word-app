import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWords, getFolders, addWord, addFolder } from '../db/database';
import { fetchGeminiModels, CURATED_MODELS } from '../api/geminiApi';
import { convertToCSV, parseCSV } from '../api/csvApi';
import { ALL_OFFLINE_WORDS } from '../data/offlineDatabase';
import { uploadBackupToDrive, downloadBackupFromDrive, searchBackupFile } from '../api/driveApi';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchGoogleVoices, playAudio } from '../api/ttsApi';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Eye, EyeOff, Volume2, BookOpen, BookMarked, CheckCircle, XCircle, Cloud, CreditCard, Key as KeyIcon, Monitor, RefreshCw, FileDown, FileUp, LogIn, Info, Coins, Calculator } from 'lucide-react';
import TokenCostCard from '../components/TokenCostCard';
import { isTokenCostVisible, setTokenCostVisible, getModelRates } from '../utils/tokenCostTracker';

const Settings = () => {
  const { userLang, studyLang, changeUserLang, changeStudyLang, t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [geminiKey, setGeminiKey] = useState('');
  const [modelList, setModelList] = useState([]);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false); 
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle');
  const [showTokenCost, setShowTokenCost] = useState(isTokenCostVisible());

  const handleToggleTokenCost = (checked) => {
    setTokenCostVisible(checked);
    setShowTokenCost(checked);
  };

  const [isAudioEnabled, setIsAudioEnabled] = useState(true); 
  const [ttsEngine, setTtsEngine] = useState('gemini');
  
  const defaultKrModel = 'ko-KR-Neural2-A';
  const defaultIdModel = 'id-ID-Chirp3-HD-Alnilam';
  const defaultEnModel = 'en-US-Neural2-F';
  
  const [googleTtsModelId, setGoogleTtsModelId] = useState(localStorage.getItem('google_tts_model_id') || defaultIdModel);
  const [googleTtsModelKo, setGoogleTtsModelKo] = useState(localStorage.getItem('google_tts_model_ko') || defaultKrModel);
  const [googleTtsModelEn, setGoogleTtsModelEn] = useState(localStorage.getItem('google_tts_model_en') || defaultEnModel);
  
  const [googleVoiceList, setGoogleVoiceList] = useState(JSON.parse(localStorage.getItem('google_voice_list') || '[]'));
  const [gcpAccessToken, setGcpAccessToken] = useState(localStorage.getItem('gcp_access_token') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('user_email') || '');
  
  const idVoices = React.useMemo(() => googleVoiceList.filter(v => v.languageCodes.some(lc => lc.startsWith('id'))), [googleVoiceList]);
  const krVoices = React.useMemo(() => googleVoiceList.filter(v => v.languageCodes.some(lc => lc.startsWith('ko'))), [googleVoiceList]);
  const enVoices = React.useMemo(() => googleVoiceList.filter(v => v.languageCodes.some(lc => lc.startsWith('en'))), [googleVoiceList]);

  // 모델 ID를 translations.js 키 규격(예: 3_8_flash)으로 정규화하는 헬퍼
  const normalizeModelKey = (modelId) => {
    if (!modelId) return '3_8_flash';
    return modelId
      .replace('models/', '')
      .replace(/^gemini-/, '')
      .replace(/[^a-zA-Z0-9]/g, '_');
  };

  // 사용자 선택 언어(ko, id, en)에 맞는 모델 정보 필드를 가져오는 헬퍼
  const getModelField = (model, field) => {
    if (!model) return '';
    const normKey = normalizeModelKey(model.id);

    // 1. translations[userLang]에서 model_${normKey}_${field} 조회
    const transKey = `model_${normKey}_${field}`;
    const transVal = t(transKey);
    if (transVal && transVal !== transKey) return transVal;

    // 2. translations[userLang]에서 model_gemini_${normKey}_${field} 조회
    const transGeminiKey = `model_gemini_${normKey}_${field}`;
    const transGeminiVal = t(transGeminiKey);
    if (transGeminiVal && transGeminiVal !== transGeminiKey) return transGeminiVal;

    // 3. CURATED_MODELS 큐레이션 매칭
    const curated = CURATED_MODELS.find(c => c.id === model.id || model.id.includes(c.id));
    if (curated && curated[field]) return curated[field];

    // 4. 모델 자체 정의 필드
    if (model[field]) return model[field];

    return '';
  };

  // API를 통해 동적으로 가져온 modelList가 있는 경우 이를 우선 렌더링 대상으로 지정 (하이브리드 방식)
  const displayModels = React.useMemo(() => {
    if (modelList && modelList.length > 0) {
      return modelList.map(item => {
        const modelId = typeof item === 'string' ? item : item.id;
        const normKey = normalizeModelKey(modelId);
        const curated = CURATED_MODELS.find(m => m.id === modelId || modelId.includes(m.id) || m.id.includes(modelId));
        
        const isPro = modelId.includes('pro');
        const isLite = modelId.includes('lite') || modelId.includes('8b');
        const cleanName = typeof item === 'object' && item?.displayName 
          ? item.displayName 
          : modelId.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

        return {
          id: modelId,
          t_key: normKey,
          name: curated?.name || cleanName,
          shortDesc: curated?.shortDesc || (isPro ? '🧠 [최상위] 심층 추론 분석' : isLite ? '🚀 [가성비] 모바일 초고속 최저비용' : '⚡ [최신] 고속 표준 생성 모델'),
          speed: curated?.speed || (isPro ? '🐢 느림' : isLite ? '🚀 매우 빠름' : '⚡ 빠름'),
          speed_key: curated?.speed_key || (isPro ? 'slow' : isLite ? 'very_fast' : 'fast'),
          tokens: curated?.tokens || (isPro ? '💎 높음' : isLite ? '📉 매우 낮음' : '📉 낮음'),
          tokens_key: curated?.tokens_key || (isPro ? 'high' : isLite ? 'very_low' : 'low'),
          pros: curated?.pros || (userLang === 'id' ? 'Model AI generasi terbaru yang aktif via Google API.' : userLang === 'en' ? 'Latest official Google AI model available via API.' : '구글 API를 통해 실시간 활성화된 공식 최신 모델입니다.'),
          cons: curated?.cons || (userLang === 'id' ? 'Model standar.' : userLang === 'en' ? 'Standard model.' : '표준 모델입니다.')
        };
      });
    }
    // API 갱신 전이거나 목록이 없는 경우 최신 추천 목록(CURATED_MODELS)을 디폴트로 표시
    return CURATED_MODELS;
  }, [modelList, userLang]);

  // 선택된 모델의 상세 정보를 콤팩트 카드에 바인딩하기 위해 색출하는 훅
  const selectedModelInfo = React.useMemo(() => {
    if (!displayModels || displayModels.length === 0) return null;
    return displayModels.find(m => m.id === selectedGeminiModel) || displayModels[0];
  }, [displayModels, selectedGeminiModel]);

  const [isDriveOperating, setIsDriveOperating] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(localStorage.getItem('tts_speed') || '1.0');

  const handleTtsSpeedChange = (value) => {
    setTtsSpeed(value);
    localStorage.setItem('tts_speed', value);
  };
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/cloud-platform';

  const handleGoogleLogin = (isSilent = false) => {
    if (!window.google) {
      if (!isSilent) alert(t('msg_google_script_error') || "Google script not ready.");
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          localStorage.setItem('gcp_access_token', tokenResponse.access_token);
          setGcpAccessToken(tokenResponse.access_token);
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });
            const userInfo = await userInfoRes.json();
            if (userInfo.email) {
              localStorage.setItem('user_email', userInfo.email.toLowerCase().trim());
              setUserEmail(userInfo.email.toLowerCase().trim());
            }
          } catch(e) {}
          setTtsEngine('google');
          localStorage.setItem('tts_engine', 'google');
          alert(t('msg_google_login_done'));
          window.location.reload();
        }
      }
    });
    client.requestAccessToken(isSilent ? { prompt: '' } : {});
  };

  useEffect(() => {
    const savedKey = localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY || '';
    setGeminiKey(savedKey);
    setIsAudioEnabled(localStorage.getItem('is_audio_enabled') !== 'false');
    setTtsEngine(localStorage.getItem('tts_engine') || 'gemini');

    let savedModel = localStorage.getItem('selectedGeminiModel');
    // 사용 불가능한 1.x 및 2.x 전 기종 자동 마이그레이션
    if (!savedModel || savedModel.includes('1.') || savedModel.includes('2.') || savedModel === 'gemini-pro' || savedModel === 'gemini-ultra') {
      savedModel = 'gemini-3.8-flash';
      localStorage.setItem('selectedGeminiModel', savedModel);
    }
    setSelectedGeminiModel(savedModel);

    const savedList = localStorage.getItem('geminiModelList');
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList);
        // 캐시된 목록 중 사용 불가능한 1.x, 2.x 모델 완전 삭제
        const cleaned = parsed.filter(item => {
          const id = typeof item === 'string' ? item : item.id;
          return id && !id.startsWith('gemini-1.') && !id.startsWith('gemini-2.') && id !== 'gemini-pro' && id !== 'gemini-ultra';
        });
        setModelList(cleaned);
      } catch (e) {}
    }

    if (savedKey) {
      setApiStatus('valid');
      // 만약 모델 리스트가 아직 없으면 백그라운드에서 최신 구글 모델 자동 동기화
      if (!savedList) {
        syncModelsFromGoogle(savedKey, false);
      }
    }

    // [v19.5] 음성 리스트 자동 동기화 (토큰이 있고 리스트가 비었을 때)
    if (gcpAccessToken && (!googleVoiceList || googleVoiceList.length === 0)) {
        handleFetchGoogleVoicesList();
    }
  }, [gcpAccessToken]);

  const handleFetchGoogleVoicesList = async () => {
    const expiry = localStorage.getItem('gcp_token_expiry');
    const isExpired = expiry && (parseInt(expiry, 10) - Date.now() < 5000);

    if (!gcpAccessToken || isExpired) {
        handleGoogleLogin();
        return;
    }
    setLoadingVoices(true);
    try {
        const voices = await fetchGoogleVoices(gcpAccessToken);
        const filtered = voices.filter(v => 
            v.languageCodes.some(lc => lc.startsWith('ko') || lc.startsWith('id') || lc.startsWith('en'))
        );
        setGoogleVoiceList(filtered);
        localStorage.setItem('google_voice_list', JSON.stringify(filtered));
        alert(t('msg_fetch_voices_done', { count: filtered.length }));
    } catch (err) { 
        alert(t('msg_fetch_voices_fail') + ": " + err.message); 
    } finally { 
        setLoadingVoices(false); 
    }
  };

  const handleTestVoice = async (lang, voiceName) => {
    const testText = lang === 'ko' ? '안녕하세요, 인코 선생님입니다.' : lang === 'id' ? 'Halo, saya guru Inko.' : 'Hello, I am Inko teacher.';
    try {
        // 프리미엄 테스트 버튼이므로 명시적으로 엔진을 google로 설정하여 재생
        localStorage.setItem('tts_engine', 'google');
        await playAudio(testText, lang, voiceName);
    } catch (e) {
      if (e.message.includes('billing')) {
          const billingUrl = `https://console.cloud.google.com/billing/enable?project=1002533566733`;
          alert(`❌ [GCP 결제 계정 연동 필요]\n\n이 기능을 사용하려면 구글 클라우드 콘솔에서 결제 계정이 연동되어 있어야 합니다.\n\n링크: ${billingUrl}`);
          window.open(billingUrl, '_blank');
      } else {
          alert(`❌ 테스트 실패: ${e.message}`);
      }
    }
  };

  const handleExportCSV = async () => {
    try {
      const words = await getWords();
      if (words.length === 0) { alert(t('msg_export_no_words')); return; }
      const csvContent = convertToCSV(words);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Inko_Backup_${new Date().toISOString().slice(0,10)}.csv`);
      link.click();
    } catch (err) { alert(t('msg_export_csv_error')); }
  };

  // 1만단어 사전 단어명 정규화
  const normalizeDictWord = (str) => (str || '').split('[[')[0].trim().toLowerCase();

  // 1만단어 사전 전체 CSV 내보내기 (기본 1만단어 + 재생성/신규 단어)
  const handleExportDictCSV = () => {
    try {
      const overrides = JSON.parse(localStorage.getItem('inko_dict_overrides') || '{}');
      const mapped = ALL_OFFLINE_WORDS.map(item => {
        const key = normalizeDictWord(item.word);
        if (overrides[key]) return { ...item, ...overrides[key] };
        return item;
      });
      const existingKeys = new Set(ALL_OFFLINE_WORDS.map(item => normalizeDictWord(item.word)));
      const extraWords = Object.values(overrides).filter(w => w && w.word && !existingKeys.has(normalizeDictWord(w.word)));
      const fullList = [...mapped, ...extraWords];

      const csvContent = convertToCSV(fullList);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Inko_10K_Dictionary_Export_${new Date().toISOString().slice(0,10)}.csv`);
      link.click();
    } catch (err) {
      alert('1만단어 사전 CSV 내보내기 실패: ' + err.message);
    }
  };

  // 1만단어 사전 CSV 가져오기 (기존 중복 단어는 자동으로 건너뜀)
  const handleImportDictCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedWords = parseCSV(event.target.result);
        if (!parsedWords || parsedWords.length === 0) {
          alert('CSV 파일에서 유효한 단어 데이터를 찾을 수 없습니다.');
          return;
        }

        const overrides = JSON.parse(localStorage.getItem('inko_dict_overrides') || '{}');
        const existingKeys = new Set(ALL_OFFLINE_WORDS.map(item => normalizeDictWord(item.word)));
        Object.keys(overrides).forEach(k => existingKeys.add(k));

        let addedCount = 0;
        let skipCount = 0;

        parsedWords.forEach(w => {
          if (!w || !w.word || !w.word.trim()) return;
          const key = normalizeDictWord(w.word);
          if (existingKeys.has(key)) {
            skipCount++; // 기존에 있던 중복단어는 건너뜀!
          } else {
            overrides[key] = {
              ...w,
              isCustomAdded: true,
              addedAt: new Date().toISOString()
            };
            existingKeys.add(key);
            addedCount++;
          }
        });

        localStorage.setItem('inko_dict_overrides', JSON.stringify(overrides));
        alert(`🎉 1만 단어 사전 CSV 불러오기 완료!\n\n- 전체 분석된 단어: ${parsedWords.length}개\n- 이미 존재하여 건너뜀(Skip): ${skipCount}개\n- 신규로 사전에 추가됨: ${addedCount}개\n\n1만단어 사전 메뉴에서 바로 확인하실 수 있습니다.`);
        e.target.value = ''; // 동일 파일 재선택 가능하게 리셋
      } catch (err) {
        alert('1만단어 사전 CSV 파일 불러오기 오류: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleBackupToDrive = async () => {
    if (!gcpAccessToken) { handleGoogleLogin(); return; }
    if (!window.confirm(t('msg_backup_confirm'))) return;
    setIsDriveOperating(true);
    try {
      const words = await getWords();
      const folders = await getFolders();
      await uploadBackupToDrive(gcpAccessToken, { words, folders, timestamp: new Date().toISOString() });
      alert(t('msg_backup_done'));
    } catch (err) { alert(t('msg_backup_fail') + ": " + err.message); }
    finally { setIsDriveOperating(false); }
  };

  const handleRestoreFromDrive = async () => {
    if (!gcpAccessToken) { handleGoogleLogin(); return; }
    setIsDriveOperating(true);
    try {
      const backupFile = await searchBackupFile(gcpAccessToken);
      if (!backupFile) { alert(t('msg_restore_no_file')); return; }
      if (!window.confirm(t('msg_restore_confirm'))) return;
      const backupData = await downloadBackupFromDrive(gcpAccessToken, backupFile.id);
      let addCount = 0;
      if (backupData.words) {
        for (const w of backupData.words) {
          try {
            const { id, ...data } = w;
            await addWord(data);
            addCount++;
          } catch (e) {}
        }
      }
      alert(t('msg_restore_done', { count: addCount }));
    } catch (e) { alert(t('msg_restore_fail')); }
    finally { setIsDriveOperating(false); }
  };

  // 구글 API로부터 현재 실제로 사용되는 최신 모델 목록을 실시간 동기화하는 함수
  const syncModelsFromGoogle = async (apiKeyToTest, showSuccessAlert = true) => {
    const key = (apiKeyToTest || geminiKey || '').trim();
    if (!key) {
      alert(t('set_ai_placeholder') || 'Gemini API 키를 입력해주세요.');
      return false;
    }

    setLoadingModels(true);
    setApiStatus('verifying');
    try {
      const fetched = await fetchGeminiModels(key);
      if (!fetched || fetched.length === 0) {
        throw new Error('구글에서 사용 가능한 텍스트 생성 AI 모델을 찾지 못했습니다.');
      }

      setModelList(fetched);
      localStorage.setItem('geminiModelList', JSON.stringify(fetched));
      localStorage.setItem('geminiApiKey', key);
      setApiStatus('valid');

      // 선택 모델 유효성 체크 및 최신 모델 자동 승계
      const validIds = fetched.map(m => typeof m === 'string' ? m : m.id);
      let targetModel = selectedGeminiModel;
      
      // 구형 1.x 및 2.x 모델이거나 지원되지 않는 모델일 경우 최신 플래그십(3.8 Flash)으로 자동 교체
      const isOutdated = !targetModel || !validIds.includes(targetModel) || targetModel.includes('1.') || targetModel.includes('2.');
      if (isOutdated) {
        const bestModel = validIds.find(id => id.includes('3.8-flash')) ||
                          validIds.find(id => id.includes('3.7-flash')) ||
                          validIds.find(id => id.includes('3.5-flash')) ||
                          validIds[0] ||
                          'gemini-3.8-flash';
        targetModel = bestModel;
        setSelectedGeminiModel(targetModel);
      }
      localStorage.setItem('selectedGeminiModel', targetModel);

      if (showSuccessAlert) {
        alert(`✅ API 키가 저장되었습니다!\n구글에서 현재 실제로 사용 중인 최신 AI 모델 ${fetched.length}개를 성공적으로 불러왔습니다. ✨\n\n적용된 모델: ${targetModel}`);
      }
      return true;
    } catch (e) {
      setApiStatus('invalid');
      alert(`❌ 최신 모델 불러오기 실패:\n${e.message || 'API 키가 유효하지 않거나 구글 서버와 통신할 수 없습니다.'}`);
      return false;
    } finally {
      setLoadingModels(false);
    }
  };

  const handleFetchModels = () => syncModelsFromGoogle(geminiKey, true);

  const saveApiKeys = async () => {
    const cleanKey = (geminiKey || '').trim();
    if (!cleanKey) {
      localStorage.setItem('geminiApiKey', '');
      localStorage.setItem('selectedGeminiModel', '');
      setSelectedGeminiModel('');
      setModelList([]);
      localStorage.removeItem('geminiModelList');
      setApiStatus('idle');
      alert(t('set_save_success') || '설정이 저장되었습니다.');
      return;
    }

    // 설정탭에서 API 키를 넣고 저장했을 때 항상 구글에서 최신 실사용 모델을 즉시 호출하여 리스트 동기화
    await syncModelsFromGoogle(cleanKey, true);
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const words = parseCSV(event.target.result);
        let addCount = 0;
        for (const w of words) {
          try {
            const { id, created_at, ...cleanWord } = w;
            await addWord(cleanWord);
            addCount++;
          } catch (err) {}
        }
        alert(t('msg_restore_done', { count: addCount }));
      } catch (err) { alert(t('msg_restore_fail')); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--nana-dark)', marginBottom: '0.6rem' }}>{t('set_title')}</h2>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px', 
          padding: '6px 14px', 
          borderRadius: '20px', 
          background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', 
          border: '1px solid #cbd5e1',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.03)'
        }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '900', letterSpacing: '0.5px' }}>
                버전 정보: v20.12 (모델별 토큰 & 원화/루피아 실시간 비용 계산기 및 On/Off 토글 탑재)
            </span>
        </div>
      </header>

      {/* 1. UI 언어 설정 */}
      <div className="settings-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: '900', marginBottom: '1.2rem' }}>
            <Monitor size={20} color="#feca57" /> {t('set_lang_title')}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
            {[
                { code: 'ko', label: '한국어 🇰🇷' },
                { code: 'id', label: 'Indonesian 🇮🇩' },
                { code: 'en', label: 'English 🇺🇸' }
            ].map(langOption => (
                <button 
                    key={langOption.code} 
                    onClick={() => changeUserLang(langOption.code)}
                    style={{ 
                        padding: '0.8rem 0.4rem', 
                        borderRadius: '12px', 
                        fontSize: '0.85rem', 
                        fontWeight: '800',
                        border: userLang === langOption.code ? '2.5px solid var(--primary-color)' : '1px solid #eee', 
                        background: userLang === langOption.code ? '#fff9e7' : '#fff', 
                        color: userLang === langOption.code ? '#856404' : '#666',
                        cursor: 'pointer',
                        transition: '0.2s'
                    }}
                >
                    {langOption.label}
                </button>
            ))}
        </div>
      </div>

      {/* 2. 음성 설정 */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: '900' }}>
                <Volume2 size={20} color="#feca57" /> {t('set_audio_title')}
            </h3>
            <label className="switch" style={{ transform: 'scale(0.8)' }}>
                <input type="checkbox" checked={isAudioEnabled} onChange={e => {
                    localStorage.setItem('is_audio_enabled', e.target.checked);
                    setIsAudioEnabled(e.target.checked);
                }}/>
                <span className="slider round"></span>
            </label>
        </div>

        {/* [v19.40] 말하기 속도 조절 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', padding: '0.8rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#475569' }}>
                {t('set_audio_speed') || '말하기 속도 조절'}
            </span>
            <select value={ttsSpeed} onChange={e => handleTtsSpeedChange(e.target.value)}
                style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '800', color: '#1e293b', outline: 'none', background: '#fff', cursor: 'pointer' }}>
                <option value="1.0">{t('set_audio_speed_normal')}</option>
                <option value="0.7">{t('set_audio_speed_slow')}</option>
                <option value="0.5">{t('set_audio_speed_slower')}</option>
                <option value="0.3">{t('set_audio_speed_slowest')}</option>
            </select>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem', marginBottom: '1.2rem' }}>
            {[
                {id: 'google', label: 'Premium'},
                {id: 'gemini', label: 'AI Voice'},
                {id: 'browser', label: 'Basic'}
            ].map(engine => (
                <button key={engine.id} onClick={() => { if(engine.id === 'google' && !gcpAccessToken) handleGoogleLogin(); setTtsEngine(engine.id); localStorage.setItem('tts_engine', engine.id); }}
                    style={{ 
                        padding: '0.8rem 0.4rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800',
                        border: ttsEngine === engine.id ? '2px solid #feca57' : '1px solid #eee', 
                        background: ttsEngine === engine.id ? '#fff9e7' : '#fff', color: ttsEngine === engine.id ? '#856404' : '#666',
                        cursor: 'pointer'
                    }}>
                    {engine.label}
                </button>
            ))}
        </div>

        {ttsEngine === 'google' && (
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '18px', border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>{t('set_lang_model')}</span>
                    <button onClick={handleFetchGoogleVoicesList} disabled={loadingVoices} style={{ background: '#feca57', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '900', cursor: 'pointer' }}>
                        {loadingVoices ? <RefreshCw size={14} className="spin" /> : t('set_google_update') || 'Update'}
                    </button>
                </div>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                    {[ {id: 'id', label: '🇮🇩 ID', val: googleTtsModelId, set: setGoogleTtsModelId, list: idVoices, key: 'google_tts_model_id'},
                       {id: 'ko', label: '🇰🇷 KO', val: googleTtsModelKo, set: setGoogleTtsModelKo, list: krVoices, key: 'google_tts_model_ko'},
                       {id: 'en', label: '🇺🇸 EN', val: googleTtsModelEn, set: setGoogleTtsModelEn, list: enVoices, key: 'google_tts_model_en'}
                    ].map(m => (
                        <div key={m.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', minWidth: '40px' }}>{m.label}</span>
                            <select value={m.val} onChange={e => { m.set(e.target.value); localStorage.setItem(m.key, e.target.value); }}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.8rem', fontWeight: '600' }}>
                                {m.list.length > 0 ? m.list.map(v => (
                                    <option key={v.name} value={v.name}>
                                        {v.name.split('-').slice(2).join('-')} ({v.ssmlGender === 'FEMALE' ? '여' : '남'})
                                    </option>
                                )) : <option value="">{t('set_google_update_needed') || 'Update Needed'}</option>}
                            </select>
                            <button onClick={() => handleTestVoice(m.id, m.val)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
                                <Volume2 size={16} color="#feca57" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* 3. API 키 설정 */}
      <div className="settings-card" style={{ border: apiStatus === 'valid' ? '2px solid #bcf0da' : '2px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: '900' }}>
                <Sparkles size={20} color="#feca57" /> {t('set_api_title')}
            </h3>
            {apiStatus === 'valid' && <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#059669', background: '#f0fdf4', padding: '4px 10px', borderRadius: '20px' }}>{t('set_api_status_ok')}</div>}
        </div>
        
        <div style={{ position: 'relative', marginBottom: '0.8rem' }}>
            <input type={showApiKey ? "text" : "password"} value={geminiKey} 
                onChange={e => { setGeminiKey(e.target.value); setApiStatus('changed'); }} 
                placeholder={t('set_ai_placeholder')} 
                style={{ width: '100%', padding: '0.8rem', paddingRight: '2.5rem', border: '2px solid #eee', borderRadius: '12px', fontSize: '1rem', outline: 'none' }} 
            />
            <button onClick={() => setShowApiKey(!showApiKey)} style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ccc' }}>
                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>

        <button onClick={() => navigate('/api-guide')} 
            style={{ width: '100%', padding: '0.6rem', background: '#f8f9fa', color: '#666', border: '1px solid #eee', borderRadius: '10px', marginBottom: '1.2rem', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Info size={14} /> {t('set_guide_btn')}
        </button>

        <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '18px', marginBottom: '1.2rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '900', color: '#334155' }}>{t('set_gemini_model_select') || 'AI 모델 선택'}</span>
                <button onClick={handleFetchModels} disabled={loadingModels} style={{ background: '#feca57', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {loadingModels ? <RefreshCw size={12} className="spin" /> : t('set_api_verify_btn')}
                </button>
            </div>
            
            {/* 1. 모델 드롭다운 셀렉터 */}
            <div style={{ marginBottom: '1rem' }}>
                <select 
                    value={selectedGeminiModel} 
                    onChange={e => { setSelectedGeminiModel(e.target.value); localStorage.setItem('selectedGeminiModel', e.target.value); }}
                    style={{ 
                        width: '100%', 
                        padding: '0.8rem 1rem', 
                        borderRadius: '12px', 
                        border: '2px solid #cbd5e1', 
                        fontSize: '0.95rem', 
                        fontWeight: '800', 
                        color: '#1e293b', 
                        outline: 'none', 
                        background: '#fff', 
                        cursor: 'pointer',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                        transition: 'border-color 0.2s'
                    }}
                >
                    {displayModels.map(m => {
                        const name = getModelField(m, 'name') || m.name;
                        const shortDesc = getModelField(m, 'short') || m.shortDesc;
                        return (
                            <option key={m.id} value={m.id}>
                                {name} {shortDesc ? ` | ${shortDesc}` : ''}
                            </option>
                        );
                    })}
                </select>
            </div>

            {/* 2. 선택된 단일 모델의 콤팩트 스펙/장단점 카드 */}
            {selectedModelInfo && (
                <div style={{ 
                    padding: '1.2rem', 
                    borderRadius: '15px', 
                    border: '2px solid var(--primary-color)',
                    background: '#fffcf4', 
                    boxShadow: '0 4px 12px rgba(254, 202, 87, 0.06)',
                    position: 'relative', 
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--primary-color)', color: '#fff', padding: '3px 10px', fontSize: '0.7rem', fontWeight: '900', borderRadius: '0 0 0 10px' }}>
                        {t('model_label_selected') || 'SELECTED'}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <div style={{ fontWeight: '900', fontSize: '1.05rem', color: 'var(--nana-dark)' }}>
                            {getModelField(selectedModelInfo, 'name') || selectedModelInfo.name}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                            ({selectedModelInfo.id})
                        </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', color: '#475569' }}>
                            {t(`model_speed_${selectedModelInfo.speed_key}`) || selectedModelInfo.speed}
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', color: '#475569' }}>
                            {t(`model_tokens_${selectedModelInfo.tokens_key}`) || selectedModelInfo.tokens}
                        </span>
                        {selectedModelInfo.id.includes('3.8-flash') && (
                            <span style={{ fontSize: '0.75rem', background: '#fef3c7', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '6px', fontWeight: '900', color: '#b45309' }}>
                                ⭐ {userLang === 'id' ? 'Rekomendasi Utama' : userLang === 'en' ? 'Recommended' : '공식 추천'}
                            </span>
                        )}
                    </div>
                    
                    <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: '1.6', background: '#fff', padding: '0.9rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                        <div style={{ marginBottom: '6px' }}>
                            <strong style={{ color: '#059669', marginRight: '4px' }}>
                                💡 {t('model_label_pros') || '핵심 특징'}:
                            </strong> 
                            {getModelField(selectedModelInfo, 'pros')}
                        </div>
                        {getModelField(selectedModelInfo, 'cons') && (
                            <div>
                                <strong style={{ color: '#e11d48', marginRight: '4px' }}>
                                    ⚠️ {t('model_label_cons') || '주의점'}:
                                </strong> 
                                {getModelField(selectedModelInfo, 'cons')}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* 3. [신규] 토큰 및 실시간 예상/실제 비용(KRW ₩ / IDR Rp) 계산기 On/Off 및 단가 안내 */}
            <div style={{
                marginTop: '1.2rem',
                padding: '1.2rem',
                borderRadius: '16px',
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calculator size={20} color="#f59e0b" />
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1e293b' }}>
                                토큰 및 실시간 비용 계산기 (KRW ₩ / IDR Rp)
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                                모델별 토큰 소모량과 원화/루피아 환산 금액 사전·실시간 표시
                            </div>
                        </div>
                    </div>
                    <label className="switch" style={{ transform: 'scale(0.85)' }} title="토큰 및 환산 비용 표시 켜기/끄기">
                        <input 
                            type="checkbox" 
                            checked={showTokenCost} 
                            onChange={e => handleToggleTokenCost(e.target.checked)} 
                        />
                        <span className="slider round"></span>
                    </label>
                </div>

                {showTokenCost ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.6rem' }}>
                        {/* 현재 선택된 모델 단가 요약 */}
                        {(() => {
                            const rates = getModelRates(selectedGeminiModel);
                            const inKrw1M = Math.round(rates.input * 1380);
                            const outKrw1M = Math.round(rates.output * 1380);
                            const inIdr1M = Math.round(rates.input * 16000);
                            const outIdr1M = Math.round(rates.output * 16000);
                            return (
                                <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                                        <div style={{ fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Coins size={14} color="#f59e0b" />
                                            선택 모델 [{selectedGeminiModel || 'gemini-3.8-flash'}] 공식 단가표 (1M 토큰당):
                                        </div>
                                        <a 
                                            href="https://ai.google.dev/gemini-api/docs/pricing?hl=ko#standard" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '800', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                        >
                                            구글 공식 요금 문서 ↗
                                        </a>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', color: '#475569' }}>
                                        <div>
                                            📥 <strong>입력(Prompt):</strong> ${rates.input}/1M <span style={{ color: '#059669', fontWeight: '800' }}>(약 ₩{inKrw1M.toLocaleString()} / Rp {inIdr1M.toLocaleString()})</span>
                                        </div>
                                        <div>
                                            📤 <strong>출력(Response):</strong> ${rates.output}/1M <span style={{ color: '#059669', fontWeight: '800' }}>(약 ₩{outKrw1M.toLocaleString()} / Rp {outIdr1M.toLocaleString()})</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                                        * 구글 공식 표준(Standard) 요금제 기준 | 환율: 1 USD = 1,380 KRW(₩) = 16,000 IDR(Rp) | TTS: Basic(무료), Google HD($16/1M자, 월 100만자 무료)
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 작업별 사전 견적 예시 */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
                            <TokenCostCard 
                                mode="estimate" 
                                modelId={selectedGeminiModel || 'gemini-3.8-flash'} 
                                actionType="generate" 
                                count={10} 
                            />
                            <TokenCostCard 
                                mode="estimate" 
                                modelId={selectedGeminiModel || 'gemini-3.8-flash'} 
                                actionType="lecture" 
                            />
                        </div>
                    </div>
                ) : (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '10px' }}>
                        💡 계산기 표시가 꺼져 있습니다. 단어생성 화면 및 특강 창에서 토큰/비용 정보가 숨김 처리됩니다.
                    </div>
                )}
            </div>
        </div>

        <button onClick={saveApiKeys} style={{ width: '100%', padding: '1rem', background: 'var(--nana-dark)', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1rem', boxShadow: '0 4px 0 #000', cursor: 'pointer' }}>
            {t('set_btn_save')}
        </button>
      </div>

      {/* 4. 데이터 및 클라우드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
        <div className="settings-card" style={{ marginBottom: 0 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '900', marginBottom: '1rem' }}>📁 {t('set_backup_title')} (내 단어장)</h4>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
                <button onClick={handleExportCSV} style={{ padding: '0.7rem', background: '#f0fdf4', color: '#166534', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FileDown size={14} /> CSV 백업</button>
                <label style={{ padding: '0.7rem', background: '#fffbeb', color: '#92400e', borderRadius: '12px', fontWeight: '800', fontSize: '0.8rem', textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <FileUp size={14} /> CSV 복원 <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
                </label>
            </div>
        </div>
        <div className="settings-card" style={{ marginBottom: 0, background: '#e8f0fe' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '900', marginBottom: '1rem' }}>☁️ {t('set_cloud_title_label') || '구글 클라우드'}</h4>
            {gcpAccessToken ? (
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                    <button onClick={handleBackupToDrive} disabled={isDriveOperating} style={{ padding: '0.7rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '0.8rem' }}><FileUp size={14} /> Backup</button>
                    <button onClick={handleRestoreFromDrive} disabled={isDriveOperating} style={{ padding: '0.7rem', background: '#34a853', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '0.8rem' }}><FileDown size={14} /> Restore</button>
                </div>
            ) : (
                <button onClick={() => handleGoogleLogin()} style={{ width: '100%', padding: '0.8rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <LogIn size={18} /> {t('set_google_login') || 'Login'}
                </button>
            )}
        </div>
      </div>

      {/* 5. 1만 단어 사전 전용 데이터 관리 (신규) */}
      <div className="settings-card" style={{ marginBottom: '2rem', border: '2px solid #feca57', background: 'linear-gradient(135deg, #fffdf8 0%, #fff9ec 100%)', boxShadow: '0 4px 15px rgba(254, 202, 87, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: '900', margin: 0, color: 'var(--nana-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookMarked size={20} color="#f6b93b" /> 1만 단어 사전 데이터 관리 (CSV)
          </h4>
          <span style={{ fontSize: '0.75rem', background: '#6c5ce7', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontWeight: '800' }}>
            중복 자동 건너뛰기 지원
          </span>
        </div>
        
        <p style={{ margin: '0 0 1.2rem', fontSize: '0.85rem', color: '#666', lineHeight: '1.5', fontWeight: '600' }}>
          개인 단어장과 별개로 <b>1만단어 사전에 직접 신규 단어를 대량 추가</b>하거나, 전체 사전 데이터를 <b>CSV 파일로 백업(다운로드)</b>할 수 있습니다. 불러오기 시 이미 사전에 존재하는 단어는 자동으로 건너뜁니다(Skip).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <label style={{ 
            padding: '0.85rem 1rem', 
            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', 
            color: '#fff', borderRadius: '14px', fontWeight: '900', fontSize: '0.85rem', 
            textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 3px 8px rgba(108, 92, 231, 0.25)' 
          }}>
            <FileUp size={16} /> 1만단어 사전 CSV 가져오기
            <input type="file" accept=".csv" onChange={handleImportDictCSV} style={{ display: 'none' }} />
          </label>

          <button 
            onClick={handleExportDictCSV} 
            style={{ 
              padding: '0.85rem 1rem', 
              background: '#fff', 
              color: '#6c5ce7', 
              border: '2px solid #6c5ce7', 
              borderRadius: '14px', fontWeight: '900', fontSize: '0.85rem', 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)' 
            }}>
            <FileDown size={16} /> 1만단어 사전 CSV 다운로드
          </button>
        </div>
      </div>

      {/* 진단 버튼 */}
      <div style={{ textAlign: 'center', padding: '1rem' }}>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ background: 'none', border: 'none', color: '#ff4d4d', fontSize: '0.75rem', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer' }}>
            {t('set_diagnosa')} (Full Reset)
        </button>
      </div>
    </div>
  );
};

export default Settings;
