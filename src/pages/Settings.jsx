import React, { useState, useEffect } from 'react';
import { getWords, getFolders, addWord, addFolder } from '../db/database';
import { fetchGeminiModels } from '../api/geminiApi';
import { convertToCSV, parseCSV } from '../api/csvApi';
import { uploadBackupToDrive, downloadBackupFromDrive, searchBackupFile } from '../api/driveApi';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchGoogleVoices } from '../api/ttsApi';
import { useAuth } from '../contexts/AuthContext';

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

  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isJsonImporting, setIsJsonImporting] = useState(false);
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
        const filtered = voices.filter(v => 
            v.languageCodes.some(lc => lc.startsWith('ko') || lc.startsWith('id') || lc.startsWith('en'))
        );
        setGoogleVoiceList(filtered);
        localStorage.setItem('google_voice_list', JSON.stringify(filtered));
        alert(t('msg_fetch_voices_done', { count: filtered.length }));
    } catch (err) { alert(t('msg_fetch_voices_fail')); }
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
    } catch (err) { alert("CSV 내보내기 중 오류 발생"); }
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
      if (!backupFile) { alert("백업 파일을 찾을 수 없습니다."); return; }
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
    if (!keyToUse) return;
    setLoadingModels(true);
    try {
      const models = await fetchGeminiModels(keyToUse);
      setModelList(models);
      localStorage.setItem('geminiModelList', JSON.stringify(models));
      alert(t('msg_model_fetch_done'));
    } catch (e) { alert(t('msg_model_fetch_fail')); }
    finally { setLoadingModels(false); }
  };

    const saveApiKeys = () => {
      localStorage.setItem('geminiApiKey', geminiKey);
      localStorage.setItem('selectedGeminiModel', selectedGeminiModel);
      alert(t('set_save_success'));
    };
  
    const handleJsonImport = async () => {
      if (!jsonInput.trim()) return;
      setIsJsonImporting(true);
      try {
          const words = JSON.parse(jsonInput);
          if (!Array.isArray(words)) throw new Error("JSON must be an array of word objects.");
          
          let added = 0;
          for (const w of words) {
              const { id, created_at, ...cleanWord } = w;
              // 누락된 기본 필드 보충
              if (!cleanWord.user_lang) cleanWord.user_lang = userLang;
              if (!cleanWord.study_lang) cleanWord.study_lang = studyLang;
              
              await addWord(cleanWord);
              added++;
          }
          alert(t('msg_restore_done', { count: added }));
          setIsJsonModalOpen(false);
          setJsonInput('');
      } catch (err) {
          alert("Import fail: " + err.message);
      } finally {
          setIsJsonImporting(false);
      }
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
                            {loadingVoices ? "갱신 중..." : t('set_google_update')}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                        {[ {id: 'id', label: '🇮🇩 Indonesia', val: googleTtsModelId, set: setGoogleTtsModelId, list: idVoices, key: 'google_tts_model_id'},
                           {id: 'ko', label: '🇰🇷 Korean', val: googleTtsModelKo, set: setGoogleTtsModelKo, list: krVoices, key: 'google_tts_model_ko'},
                           {id: 'en', label: '🇺🇸 English', val: googleTtsModelEn, set: setGoogleTtsModelEn, list: enVoices, key: 'google_tts_model_en'}
                        ].map(m => (
                            <div key={m.id} style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '15px' }}>
                                <label style={{ fontSize: '0.85rem', color: '#718096', display: 'block', marginBottom: '8px', fontWeight: '900' }}>{m.label}</label>
                                <select value={m.val} onChange={e => { m.set(e.target.value); localStorage.setItem(m.key, e.target.value); }}
                                    style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '2px solid #eee', outline: 'none', fontWeight: '700', color: '#444' }}>
                                    {m.list.length > 0 ? m.list.map(v => (
                                        <option key={v.name} value={v.name}>{v.name.split('-').slice(-2).join('-')} ({v.ssmlGender[0]})</option>
                                    )) : <option value="">업데이트 필요</option>}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* (3) API 설정 */}
      <div className="settings-card" style={{ background: '#fff', padding: '2.5rem', borderRadius: '35px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', fontWeight: '900', color: '#1a1a1a' }}>
            <span style={{ fontSize: '1.8rem' }}>🤖</span> {t('set_api_title')}
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.2rem', fontWeight: '600' }}>AI 단어 생성을 위한 Gemini API 키와 모델을 관리합니다.</p>
        
        <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder={t('set_ai_placeholder')} 
            style={{ width: '100%', padding: '1.2rem', border: '2.5px solid #f0f0f0', borderRadius: '18px', marginBottom: '1.2rem', outline: 'none', fontSize: '1rem' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem', gap: '1.2rem' }}>
            <select value={selectedGeminiModel} onChange={e => setSelectedGeminiModel(e.target.value)}
                style={{ flex: 1, padding: '1rem', border: '2.5px solid #f0f0f0', borderRadius: '18px', outline: 'none', fontWeight: '700', color: '#555' }}>
                {modelList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={handleFetchModels} disabled={loadingModels} style={{ padding: '1rem 1.4rem', background: '#feca57', color: '#fff', border: 'none', borderRadius: '18px', cursor: 'pointer', boxShadow: '0 4px 0 #e67e22' }}>
                <Sparkles size={20} />
            </button>
        </div>
        
        <button onClick={saveApiKeys} style={{ width: '100%', padding: '1.3rem', background: 'var(--nana-dark)', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: '900', fontSize: '1.2rem', boxShadow: '0 6px 0 #000' }}>
            {t('set_btn_save')}
        </button>
      </div>

      {/* (4) 데이터 관리 및 클라우드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="settings-card" style={{ background: '#fff', padding: '2.5rem', borderRadius: '35px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontWeight: '900', color: '#1a1a1a', marginBottom: '1.5rem' }}>📁 {t('set_backup_title')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button onClick={handleExportCSV} style={{ width: '100%', padding: '1.2rem', background: '#f0fdf4', color: '#166534', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1rem' }}>{t('set_backup_export')}</button>
                <button onClick={() => setIsJsonModalOpen(true)} style={{ width: '100%', padding: '1.2rem', background: '#fffbeb', color: '#92400e', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1rem' }}>{t('set_json_paste')}</button>
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
                    <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '1.5rem', fontWeight: '600' }}>구글 계정을 연결하여 안전하게 클라우드 백업을 시작하세요.</p>
                    <button onClick={() => handleGoogleLogin()} style={{ width: '100%', padding: '1.3rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: '900', fontSize: '1.1rem', boxShadow: '0 6px 0 #1c66d1' }}>{t('set_cloud_login')}</button>
                </div>
            )}
        </div>
      </div>

      {/* 진단 섹션 */}
      <div className="settings-card" style={{ background: '#fff5f5', padding: '1.8rem', borderRadius: '30px', border: '2px dashed #feb2b2', textAlign: 'center' }}>
        <h4 style={{ color: '#c53030', margin: '0 0 0.8rem 0', fontWeight: '900' }}>⚠️ {t('set_diagnosa')}</h4>
        <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '1.2rem', fontWeight: '600' }}>앱이 정상적으로 작동하지 않을 때만 사용하세요. (음성 엔진 초기화)</p>
        <button onClick={() => { localStorage.removeItem('gcp_access_token'); window.location.reload(); }}
            style={{ padding: '0.8rem 2rem', background: '#fff', border: '2px solid #718096', borderRadius: '15px', color: '#4a5568', fontWeight: '900', cursor: 'pointer' }}>{t('set_reset_btn')}</button>
      </div>

      {isJsonModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div className="modal-content" style={{ background: '#fff', padding: '2.5rem', borderRadius: '40px', width: '90%', maxWidth: '650px', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: '900', marginBottom: '1rem' }}>{t('set_json_import_title')}</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem', fontWeight: '600' }}>복사한 JSON 단어 리스트를 아래에 붙여넣으세요.</p>
            <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} placeholder="[ { 'word': '...', 'meaning': '...' } ]" style={{ width: '100%', height: '300px', borderRadius: '20px', border: '2.5px solid #f0f0f0', padding: '1.2rem', outline: 'none', fontSize: '0.9rem', fontFamily: 'monospace' }} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={handleJsonImport} disabled={isJsonImporting} style={{ flex: 2, padding: '1.2rem', background: '#ff9f43', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 5px 0 #e67e22' }}>{t('set_json_confirm')}</button>
              <button onClick={() => setIsJsonModalOpen(false)} style={{ flex: 1, padding: '1.2rem', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer' }}>{t('set_json_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
