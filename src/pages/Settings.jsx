import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWords, getFolders, addWord, addFolder } from '../db/database';
import { fetchGeminiModels, CURATED_MODELS } from '../api/geminiApi';
import { convertToCSV, parseCSV } from '../api/csvApi';
import { uploadBackupToDrive, downloadBackupFromDrive, searchBackupFile } from '../api/driveApi';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchGoogleVoices, playAudio } from '../api/ttsApi';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Eye, EyeOff, Volume2, BookOpen, CheckCircle, XCircle, Cloud, CreditCard, Key as KeyIcon, Monitor, RefreshCw, FileDown, FileUp, LogIn, Info } from 'lucide-react';

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

  // API를 통해 동적으로 가져온 modelList가 있는 경우 이를 우선 렌더링 대상으로 지정 (하이브리드 방식)
  const displayModels = React.useMemo(() => {
    if (modelList && modelList.length > 0) {
      return modelList.map(modelId => {
        // 이미 큐레이션된 고정 모델 정보가 매칭되는지 확인
        const curated = CURATED_MODELS.find(m => m.id === modelId);
        if (curated) return curated;

        // 매칭되지 않는 새로운 미래형 모델이 들어왔을 때 동적으로 안전하게 리스트 요소를 제조
        const cleanName = modelId.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
        const t_key = modelId.replace(/[^a-zA-Z0-9]/g, '_');
        return {
          id: modelId,
          t_key: t_key,
          name: cleanName,
          speed: modelId.includes('pro') ? '🏃 보통' : '⚡ 빠름',
          speed_key: modelId.includes('pro') ? 'normal' : 'fast',
          tokens: modelId.includes('pro') ? '📈 높음' : '📉 낮음',
          tokens_key: modelId.includes('pro') ? 'high' : 'low',
          pros: t('model_dynamic_pros') || 'API를 통해 실시간 활성화되어 즉시 사용 가능한 구글 제미나이 모델입니다.',
          cons: t('model_dynamic_cons') || '인코의 공식 프리미엄 설명 큐레이션은 준비 중입니다.'
        };
      });
    }
    // API 갱신 전이거나 목록이 없는 경우 최신 추천 목록(CURATED_MODELS)을 디폴트로 표시
    return CURATED_MODELS;
  }, [modelList, userLang]);

  // 번역 키가 없을 때 원래 문자열이 그대로 노출되지 않도록 가드해 주는 헬퍼 함수
  const getTranslation = (key, fallback) => {
    const val = t(key);
    // 다국어 사전에 리소스가 없어 번역 키 문자열이 그대로 리턴된 경우 fallback 텍스트 반환
    if (val === key) return fallback;
    return val;
  };

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
    setGeminiKey(localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY || '');
    setIsAudioEnabled(localStorage.getItem('is_audio_enabled') !== 'false');
    setTtsEngine(localStorage.getItem('tts_engine') || 'gemini');
    const savedModel = localStorage.getItem('selectedGeminiModel');
    if (savedModel) setSelectedGeminiModel(savedModel);
    const savedList = localStorage.getItem('geminiModelList');
    if (savedList) setModelList(JSON.parse(savedList));
    if (localStorage.getItem('geminiApiKey')) setApiStatus('valid');

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
    const keyToUse = geminiKey;
    if (!keyToUse) return;
    setLoadingModels(true);
    setApiStatus('verifying');
    try {
      const models = await fetchGeminiModels(keyToUse);
      setModelList(models);
      localStorage.setItem('geminiModelList', JSON.stringify(models));
      localStorage.setItem('geminiApiKey', keyToUse.trim());
      setApiStatus('valid');
      if (models.length > 0 && (!selectedGeminiModel || !models.includes(selectedGeminiModel))) {
        setSelectedGeminiModel(models[0]);
        localStorage.setItem('selectedGeminiModel', models[0]);
      }
      alert(t('msg_api_key_valid')); 
    } catch (e) { 
      setApiStatus('invalid');
      alert(t('msg_model_fetch_fail') + "\n\n" + e.message); 
    }
    finally { setLoadingModels(false); }
  };

  const saveApiKeys = () => {
    localStorage.setItem('geminiApiKey', geminiKey);
    localStorage.setItem('selectedGeminiModel', selectedGeminiModel);
    alert(t('set_save_success'));
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
                버전 정보: v19.40 (최신 릴리즈)
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
                    {displayModels.map(m => (
                        <option key={m.id} value={m.id}>
                            {getTranslation(`model_${m.t_key}_name`, m.name)}
                        </option>
                    ))}
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
                    
                    <div style={{ fontWeight: '900', fontSize: '1.05rem', marginBottom: '6px', color: 'var(--nana-dark)' }}>
                        {getTranslation(`model_${selectedModelInfo.t_key}_name`, selectedModelInfo.name)}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', color: '#475569' }}>
                            {t(`model_speed_${selectedModelInfo.speed_key}`) || selectedModelInfo.speed}
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', color: '#475569' }}>
                            {t(`model_tokens_${selectedModelInfo.tokens_key}`) || selectedModelInfo.tokens}
                        </span>
                    </div>
                    
                    <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: '1.6', background: '#fff', padding: '0.9rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                        <div style={{ marginBottom: '6px' }}>
                            <strong style={{ color: '#059669', marginRight: '4px' }}>
                                {t('model_label_pros') || '장점'}:
                            </strong> 
                            {getTranslation(`model_${selectedModelInfo.t_key}_pros`, selectedModelInfo.pros)}
                        </div>
                        <div>
                            <strong style={{ color: '#e11d48', marginRight: '4px' }}>
                                {t('model_label_cons') || '단점'}:
                            </strong> 
                            {getTranslation(`model_${selectedModelInfo.t_key}_cons`, selectedModelInfo.cons)}
                        </div>
                    </div>
                </div>
            )}
        </div>

        <button onClick={saveApiKeys} style={{ width: '100%', padding: '1rem', background: 'var(--nana-dark)', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1rem', boxShadow: '0 4px 0 #000', cursor: 'pointer' }}>
            {t('set_btn_save')}
        </button>
      </div>

      {/* 4. 데이터 및 클라우드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div className="settings-card" style={{ marginBottom: 0 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '900', marginBottom: '1rem' }}>📁 {t('set_backup_title')}</h4>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
                <button onClick={handleExportCSV} style={{ padding: '0.7rem', background: '#f0fdf4', color: '#166534', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FileDown size={14} /> CSV</button>
                <label style={{ padding: '0.7rem', background: '#fffbeb', color: '#92400e', borderRadius: '12px', fontWeight: '800', fontSize: '0.8rem', textAlign: 'center', cursor: 'pointer' }}>
                    <FileUp size={14} /> Import <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
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
