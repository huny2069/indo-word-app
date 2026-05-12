import React, { useState, useEffect } from 'react';
import { getWords, getFolders, addWord, addFolder } from '../db/database';
import { fetchGeminiModels } from '../api/geminiApi';
import { convertToCSV, parseCSV } from '../api/csvApi';
import { uploadBackupToDrive, downloadBackupFromDrive, searchBackupFile } from '../api/driveApi';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchGoogleVoices, playAudio } from '../api/ttsApi';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Eye, EyeOff, Volume2, BookOpen, CheckCircle, XCircle } from 'lucide-react';

// 구글 드라이브 백업/복원용 설정 객체
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/cloud-platform';

const Settings = () => {
  const { userLang, studyLang, changeUserLang, changeStudyLang, t } = useLanguage();
  const { user } = useAuth();
  
  const [geminiKey, setGeminiKey] = useState('');
  const [modelList, setModelList] = useState([]);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false); 
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle'); // 'idle', 'verifying', 'valid', 'invalid', 'changed'

  const [isAudioEnabled, setIsAudioEnabled] = useState(true); 
  const [ttsEngine, setTtsEngine] = useState('gemini');
  
  const defaultKrModel = 'ko-KR-Neural2-A';
  const defaultIdModel = 'id-ID-Chirp3-HD-Achernar';
  const defaultEnModel = 'en-US-Neural2-F';
  
  const [googleTtsModelId, setGoogleTtsModelId] = useState(localStorage.getItem('google_tts_model_id') || defaultIdModel);
  const [googleTtsModelKo, setGoogleTtsModelKo] = useState(localStorage.getItem('google_tts_model_ko') || defaultKrModel);
  const [googleTtsModelEn, setGoogleTtsModelEn] = useState(localStorage.getItem('google_tts_model_en') || defaultEnModel);
  
  const [googleVoiceList, setGoogleVoiceList] = useState(JSON.parse(localStorage.getItem('google_voice_list') || '[]'));
  const [gcpAccessToken, setGcpAccessToken] = useState(localStorage.getItem('gcp_access_token') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('user_email') || '');
  
  // 보이스 목록 분리 필터링
  const idVoices = React.useMemo(() => googleVoiceList.filter(v => v.languageCodes.some(lc => lc.startsWith('id'))), [googleVoiceList]);
  const krVoices = React.useMemo(() => googleVoiceList.filter(v => v.languageCodes.some(lc => lc.startsWith('ko'))), [googleVoiceList]);
  const enVoices = React.useMemo(() => googleVoiceList.filter(v => v.languageCodes.some(lc => lc.startsWith('en'))), [googleVoiceList]);

  const [isDriveOperating, setIsDriveOperating] = useState(false);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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
          const now = Date.now();
          const expiresIn = (tokenResponse.expires_in || 3600) * 1000;
          const expiryTime = now + expiresIn;
          
          localStorage.setItem('gcp_access_token', tokenResponse.access_token);
          localStorage.setItem('gcp_token_expiry', expiryTime.toString());
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
    setGeminiKey(localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY || '');
    setIsAudioEnabled(localStorage.getItem('is_audio_enabled') !== 'false');
    setTtsEngine(localStorage.getItem('tts_engine') || 'gemini');

    const savedModel = localStorage.getItem('selectedGeminiModel');
    if (savedModel) setSelectedGeminiModel(savedModel);
    const savedList = localStorage.getItem('geminiModelList');
    if (savedList) setModelList(JSON.parse(savedList));

    // 기존 키가 있으면 초기 상태를 valid로 가정 (혹은 idle)
    if (localStorage.getItem('geminiApiKey')) setApiStatus('valid');

    const handleStorageChange = (e) => {
      if (e.key === 'gcp_access_token') setGcpAccessToken(e.newValue);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleFetchGoogleVoicesList = async () => {
    if (!gcpAccessToken) { handleGoogleLogin(); return; }
    setLoadingVoices(true);
    try {
        const voices = await fetchGoogleVoices(gcpAccessToken);
        if (!voices || voices.length === 0) {
          alert(t('msg_fetch_voices_expired'));
          return;
        }
        const filtered = voices.filter(v => 
            v.languageCodes.some(lc => {
              const lowerLc = lc.toLowerCase();
              return lowerLc.startsWith('ko') || lowerLc.startsWith('id') || lowerLc.startsWith('en');
            })
        );
        setGoogleVoiceList(filtered);
        localStorage.setItem('google_voice_list', JSON.stringify(filtered));
        alert(t('msg_fetch_voices_all_done'));
    } catch (err) { 
      alert(t('msg_fetch_voices_fail') + ": " + err.message); 
    }
    finally { setLoadingVoices(false); }
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

    const handleFetchModels = async () => {
      const keyToUse = geminiKey || import.meta.env.VITE_GEMINI_API_KEY;
      if (!keyToUse) { setApiStatus('idle'); return; }
      
      setLoadingModels(true);
      setApiStatus('verifying');
      
      try {
        const models = await fetchGeminiModels(keyToUse);
        setModelList(models);
        localStorage.setItem('geminiModelList', JSON.stringify(models));
        
        // 검증 성공 시 즉시 자동 저장 및 모델 자동 선택
        localStorage.setItem('geminiApiKey', keyToUse.trim());
        setGeminiKey(keyToUse.trim());
        setApiStatus('valid');

        // 현재 선택된 모델이 목록에 없으면 첫 번째 모델 자동 선택
        if (models.length > 0 && (!selectedGeminiModel || !models.includes(selectedGeminiModel))) {
          const firstModel = models[0];
          setSelectedGeminiModel(firstModel);
          localStorage.setItem('selectedGeminiModel', firstModel);
        }
        
        alert(t('msg_api_key_valid')); 
      } catch (e) { 
        setApiStatus('invalid');
        alert(t('msg_model_fetch_fail') + "\n\n" + t('set_reason') + " " + e.message); 
      }
      finally { setLoadingModels(false); }
    };

    const saveApiKeys = () => {
      localStorage.setItem('geminiApiKey', geminiKey);
      localStorage.setItem('selectedGeminiModel', selectedGeminiModel);
      alert(t('set_save_success'));
    };
  
    const handleTestVoice = async (lang, modelName) => {
      const testTexts = {
        id: "Halo, apa kabar? Saya senang membantu Anda belajar bahasa.",
        ko: "안녕하세요! 여러분의 언어 학습을 돕게 되어 기쁩니다.",
        en: "Hello! It is a pleasure to help you learn a new language."
      };
      try {
        await playAudio(testTexts[lang] || testTexts.en, lang, modelName);
      } catch (e) {
        alert(t('msg_test_voice_fail') + " " + e.message);
      }
    };

    const handleImportCSV = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvText = event.target.result;
          const words = parseCSV(csvText);
          if (words.length === 0) {
            alert(t('msg_restore_no_file'));
            return;
          }

          let addCount = 0;
          for (const w of words) {
            try {
              const { id, created_at, ...cleanWord } = w;
              // 누락된 기본 필드 보충
              if (!cleanWord.study_lang) cleanWord.study_lang = studyLang;
              if (!cleanWord.user_lang) cleanWord.user_lang = userLang;
              
              await addWord(cleanWord);
              addCount++;
            } catch (err) {
              console.error("Single word import error:", err);
            }
          }
          alert(t('msg_restore_done', { count: addCount }));
          e.target.value = ''; // 초기화
        } catch (err) {
          alert(t('msg_restore_fail') + ": " + err.message);
        }
      };
      reader.readAsText(file);
    };

  return (
    <div className="page" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '5rem' }}>
      <h2 style={{ fontSize: '2.4rem', fontWeight: '900', marginBottom: '2.5rem', textAlign: 'center', color: 'var(--nana-dark)' }}>{t('set_title')}</h2>
      
      {/* (1) 언어 설정 섹션 - 3개국어 상호 학습 대응 */}
      <div className="settings-card" style={{ background: '#fff', padding: '2.5rem', borderRadius: '35px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)', border: '2px solid #feca57', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.8rem', color: '#1a1a1a', fontWeight: '900' }}>
            <span style={{ fontSize: '1.8rem' }}>🌍</span> {t('set_lang_title')}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {/* 모국어 선택 */}
            <div style={{ padding: '1.8rem', background: '#fafafa', borderRadius: '25px', border: '1px solid #eee' }}>
                <label style={{ display: 'block', fontWeight: '900', marginBottom: '1.2rem', color: '#666', fontSize: '1rem' }}>{t('onboarding_native')}</label>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                    {[
                        {code: 'ko', flag: '🇰🇷'}, 
                        {code: 'id', flag: '🇮🇩'}, 
                        {code: 'en', flag: '🇺🇸'}
                    ].map(lang => (
                        <button key={lang.code} onClick={() => changeUserLang(lang.code)} 
                            style={{ 
                                flex: 1, padding: '1.2rem 0.5rem', borderRadius: '18px', 
                                border: userLang === lang.code ? '4px solid #feca57' : '2px solid #eee', 
                                background: userLang === lang.code ? '#fff9e7' : '#fff', cursor: 'pointer', 
                                transition: '0.2s', fontSize: '2rem'
                            }}>
                            {lang.flag}
                        </button>
                    ))}
                </div>
            </div>

            {/* 학습 언어 선택 */}
            <div style={{ padding: '1.8rem', background: '#fafafa', borderRadius: '25px', border: '1px solid #eee' }}>
                <label style={{ display: 'block', fontWeight: '900', marginBottom: '1.2rem', color: '#666', fontSize: '1rem' }}>{t('onboarding_study')}</label>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                    {[
                        {code: 'ko', flag: '🇰🇷'}, 
                        {code: 'id', flag: '🇮🇩'}, 
                        {code: 'en', flag: '🇺🇸'}
                    ].map(lang => (
                        <button key={lang.code} 
                            onClick={() => changeStudyLang(lang.code)} 
                            disabled={userLang === lang.code} 
                            style={{ 
                                flex: 1, padding: '1.2rem 0.5rem', borderRadius: '18px', 
                                border: studyLang === lang.code ? '4px solid #feca57' : '2px solid #eee', 
                                background: studyLang === lang.code ? '#fff9e7' : '#fff', 
                                cursor: userLang === lang.code ? 'not-allowed' : 'pointer', 
                                opacity: userLang === lang.code ? 0.2 : 1, transition: '0.2s', fontSize: '2rem'
                            }}>
                            {lang.flag}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* (2) 음성 엔진 설정 */}
      <div className="settings-card" style={{ background: '#fff', padding: '2.5rem', borderRadius: '35px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.8rem', color: '#1a1a1a', fontWeight: '900' }}>
            <span style={{ fontSize: '1.8rem' }}>🔊</span> {t('set_audio_title')}
        </h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: '#f5f7f9', borderRadius: '25px', border: '1px solid #eee', marginBottom: '1.5rem' }}>
            <div>
                <span style={{ fontWeight: '900', fontSize: '1.1rem', color: 'var(--nana-dark)' }}>{t('set_audio_label')}</span>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#777', fontWeight: '600' }}>{t('set_audio_desc')}</p>
            </div>
            <label className="switch">
                <input type="checkbox" checked={isAudioEnabled} onChange={e => {
                    localStorage.setItem('is_audio_enabled', e.target.checked);
                    setIsAudioEnabled(e.target.checked);
                }}/>
                <span className="slider round"></span>
            </label>
        </div>

        <div style={{ background: '#fafafa', padding: '2rem', borderRadius: '30px', border: '1px solid #eee' }}>
            <span style={{ fontWeight: '900', fontSize: '1.1rem', display: 'block', marginBottom: '1.5rem', color: '#555' }}>{t('set_engine_all')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1.2rem', marginBottom: '1.8rem' }}>
                {[
                    {id: 'google', label: 'Google Premium'},
                    {id: 'gemini', label: 'Gemini AI'},
                    {id: 'browser', label: 'Offline Default'}
                ].map(engine => (
                    <button key={engine.id} onClick={() => { if(engine.id === 'google' && !gcpAccessToken) handleGoogleLogin(); setTtsEngine(engine.id); localStorage.setItem('tts_engine', engine.id); }}
                        style={{ padding: '1.2rem', borderRadius: '20px', border: ttsEngine === engine.id ? '4px solid #feca57' : '2px solid #eee', background: ttsEngine === engine.id ? '#fff' : '#fff', color: ttsEngine === engine.id ? 'var(--nana-dark)' : '#999', fontWeight: '900', transition: '0.3s', fontSize: '1rem' }}>
                        {engine.label}
                    </button>
                ))}
            </div>

            {ttsEngine === 'google' && (
                <div style={{ background: '#fff', padding: '1.8rem', borderRadius: '25px', border: '1px solid #eee', boxShadow: '0 5px 15px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem' }}>
                        <span style={{ fontWeight: '900', color: '#333' }}>{t('set_lang_model')}</span>
                        <button onClick={handleFetchGoogleVoicesList} disabled={loadingVoices} style={{ background: '#feca57', color: '#fff', border: 'none', padding: '0.7rem 1.4rem', borderRadius: '15px', fontSize: '0.85rem', fontWeight: '900', boxShadow: '0 4px 0 #e67e22', cursor: 'pointer' }}>
                            {loadingVoices ? t('set_google_updating') : t('set_google_update')}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                        {[ {id: 'id', label: '🇮🇩 Indonesia', val: googleTtsModelId, set: setGoogleTtsModelId, list: idVoices, key: 'google_tts_model_id'},
                           {id: 'ko', label: '🇰🇷 Korean', val: googleTtsModelKo, set: setGoogleTtsModelKo, list: krVoices, key: 'google_tts_model_ko'},
                           {id: 'en', label: '🇺🇸 English', val: googleTtsModelEn, set: setGoogleTtsModelEn, list: enVoices, key: 'google_tts_model_en'}
                        ].map(m => (
                            <div key={m.id} style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '15px' }}>
                                <label style={{ fontSize: '0.85rem', color: '#718096', display: 'block', marginBottom: '8px', fontWeight: '900' }}>{m.label}</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select value={m.val} onChange={e => { m.set(e.target.value); localStorage.setItem(m.key, e.target.value); }}
                                        style={{ flex: 1, padding: '0.9rem', borderRadius: '12px', border: '2px solid #eee', outline: 'none', fontWeight: '700', color: '#444' }}>
                                        {m.list.length > 0 ? m.list.map(v => {
                                            const parts = v.name.split('-');
                                            const region = parts[1] || '??';
                                            const engine = parts.slice(2).join('-');
                                            return (
                                                <option key={v.name} value={v.name}>
                                                    {region.toUpperCase()}: {engine} ({v.ssmlGender[0]})
                                                </option>
                                            );
                                        }) : <option value="">{t('set_google_update_needed')}</option>}
                                    </select>
                                    <button onClick={() => handleTestVoice(m.id, m.val)} disabled={!m.val} title={t('set_test_voice')}
                                        style={{ background: '#fff', border: '2px solid #eee', borderRadius: '12px', padding: '0 12px', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onMouseOver={e => e.currentTarget.style.borderColor = '#feca57'}
                                        onMouseOut={e => e.currentTarget.style.borderColor = '#eee'}>
                                        <Volume2 size={20} color="#feca57" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* (3) API 설정 - 직관적 개선 */}
      <div className="settings-card" style={{ background: '#fff', padding: '2.5rem', borderRadius: '35px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)', marginBottom: '2rem', border: '3px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontWeight: '900', color: '#1a1a1a', margin: 0 }}>
                <span style={{ fontSize: '1.8rem' }}>🤖</span> {t('set_api_title')}
            </h3>
            <div style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', 
                background: apiStatus === 'valid' ? '#f0fdf4' : (apiStatus === 'invalid' ? '#fff1f2' : '#fefce8'), 
                padding: '6px 12px', borderRadius: '12px', 
                border: `1px solid ${apiStatus === 'valid' ? '#bcf0da' : (apiStatus === 'invalid' ? '#fecaca' : '#fef08a')}` 
            }}>
                {apiStatus === 'valid' ? <CheckCircle size={16} color="#059669" /> : 
                 (apiStatus === 'invalid' ? <XCircle size={16} color="#dc2626" /> : <Sparkles size={16} color="#ca8a04" />)}
                <span style={{ fontSize: '0.85rem', fontWeight: '900', color: apiStatus === 'valid' ? '#059669' : (apiStatus === 'invalid' ? '#dc2626' : '#ca8a04') }}>
                    {apiStatus === 'valid' ? t('set_api_status_ok') : 
                     (apiStatus === 'verifying' ? t('set_api_status_verifying') : 
                      (apiStatus === 'invalid' ? t('set_api_status_invalid') : 
                       (geminiKey ? t('set_api_status_changed') : t('set_api_status_none'))))}
                </span>
            </div>
        </div>
        
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem', fontWeight: '600' }}>{t('set_api_desc')}</p>
        
        <div style={{ position: 'relative', marginBottom: '1.2rem' }}>
            <input type={showApiKey ? "text" : "password"} value={geminiKey} 
                onChange={e => { setGeminiKey(e.target.value); setApiStatus('changed'); }} 
                placeholder={t('set_ai_placeholder')} 
                style={{ width: '100%', padding: '1.3rem', paddingRight: '3.5rem', border: '2.5px solid #f0f0f0', borderRadius: '20px', outline: 'none', fontSize: '1.1rem', fontWeight: '600', transition: '0.3s' }} 
                onFocus={e => e.target.style.borderColor = '#feca57'}
                onBlur={e => e.target.style.borderColor = '#f0f0f0'}
            />
            <button onClick={() => setShowApiKey(!showApiKey)} 
                style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                {showApiKey ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
        </div>

        <button onClick={() => window.location.hash = "#guide"} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '0.8rem', background: '#fafafa', color: '#666', border: '2px solid #eee', borderRadius: '15px', marginBottom: '1.8rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer' }}>
            <BookOpen size={18} /> {t('set_guide_btn')}
        </button>
        
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', marginBottom: '1.8rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '900' }}>{t('set_gemini_model_select')}</label>
                <button onClick={handleFetchModels} disabled={loadingModels} 
                    style={{ 
                        padding: '0.5rem 1rem', background: '#feca57', color: '#fff', border: 'none', 
                        borderRadius: '12px', cursor: 'pointer', boxShadow: '0 3px 0 #e67e22', 
                        fontSize: '0.8rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' 
                    }}>
                    <Sparkles size={14} /> {t('set_api_verify_btn')}
                </button>
            </div>
            <select value={selectedGeminiModel} onChange={e => { 
                const val = e.target.value;
                setSelectedGeminiModel(val);
                localStorage.setItem('selectedGeminiModel', val);
            }}
                style={{ width: '100%', padding: '1rem', border: '2px solid #e2e8f0', borderRadius: '15px', outline: 'none', fontWeight: '700', color: '#334155', background: '#fff' }}>
                {modelList.length > 0 ? modelList.map(m => <option key={m} value={m}>{m}</option>) : <option>{t('set_model_update_needed')}</option>}
            </select>
            {selectedGeminiModel && (
                <p style={{ marginTop: '8px', fontSize: '0.8rem', color: '#059669', fontWeight: '800' }}>
                    {t('set_model_applied').replace('{model}', selectedGeminiModel)}
                </p>
            )}
        </div>
        
        <button onClick={saveApiKeys} style={{ width: '100%', padding: '1.3rem', background: 'var(--nana-dark)', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: '900', fontSize: '1.2rem', boxShadow: '0 6px 0 #000', cursor: 'pointer', transition: '0.2s' }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
            {t('set_btn_save')}
        </button>
      </div>

      {/* (4) 데이터 관리 및 클라우드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="settings-card" style={{ background: '#fff', padding: '2.5rem', borderRadius: '35px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontWeight: '900', color: '#1a1a1a', marginBottom: '1.5rem' }}>📁 {t('set_backup_title')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button onClick={handleExportCSV} style={{ width: '100%', padding: '1.2rem', background: '#f0fdf4', color: '#166534', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer' }}>{t('set_backup_export')}</button>
                <label style={{ width: '100%', padding: '1.2rem', background: '#fffbeb', color: '#92400e', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1rem', textAlign: 'center', cursor: 'pointer', display: 'block' }}>
                    {t('set_backup_import')}
                    <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
                </label>
            </div>
        </div>

        <div className="settings-card" style={{ background: '#fff', padding: '2.5rem', borderRadius: '35px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)', border: '3px solid #e8f0fe' }}>
            <h3 style={{ fontWeight: '900', color: '#1a1a1a', marginBottom: '1.5rem' }}>☁️ {t('set_cloud_title')}</h3>
            {gcpAccessToken ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '0.8rem', background: '#eef2ff', borderRadius: '15px', fontSize: '0.95rem', color: '#4285f4', fontWeight: '800', textAlign: 'center' }}>{userEmail}</div>
                    <button onClick={handleBackupToDrive} disabled={isDriveOperating} style={{ width: '100%', padding: '1.2rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1rem', boxShadow: '0 5px 0 #1c66d1' }}>{t('set_cloud_backup_btn')}</button>
                    <button onClick={handleRestoreFromDrive} disabled={isDriveOperating} style={{ width: '100%', padding: '1.2rem', background: '#34a853', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1rem', boxShadow: '0 5px 0 #288141' }}>{t('set_cloud_restore_btn')}</button>
                </div>
            ) : (
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '1.5rem', fontWeight: '600' }}>{t('set_cloud_connect_desc')}</p>
                    <button onClick={() => handleGoogleLogin()} style={{ width: '100%', padding: '1.3rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: '900', fontSize: '1.1rem', boxShadow: '0 6px 0 #1c66d1' }}>{t('set_cloud_login')}</button>
                </div>
            )}
        </div>
      </div>

      {/* 진단 섹션 */}
      <div className="settings-card" style={{ background: '#fff5f5', padding: '1.8rem', borderRadius: '30px', border: '2px dashed #feb2b2', textAlign: 'center' }}>
        <h4 style={{ color: '#c53030', margin: '0 0 0.8rem 0', fontWeight: '900' }}>⚠️ {t('set_diagnosa')}</h4>
        <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '1.2rem', fontWeight: '600' }}>{t('set_diagnosa_desc')}</p>
        <button onClick={() => { localStorage.removeItem('gcp_access_token'); window.location.reload(); }}
            style={{ padding: '0.8rem 2rem', background: '#fff', border: '2px solid #718096', borderRadius: '15px', color: '#4a5568', fontWeight: '900', cursor: 'pointer' }}>{t('set_reset_btn')}</button>
      </div>


    </div>
  );
};

export default Settings;
