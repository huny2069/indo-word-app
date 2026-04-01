import React, { useState, useEffect } from 'react';
import { getWords, getFolders, addWord, addFolder } from '../db/database';
import { fetchGeminiModels } from '../api/geminiApi';
import { convertToCSV, parseCSV } from '../api/csvApi';
import { uploadBackupToDrive, downloadBackupFromDrive, searchBackupFile } from '../api/driveApi';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchGoogleVoices } from '../api/ttsApi';

// 구글 드라이브 백업/복원용 설정 객체
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// 버전1과 동일한 스코프 설정
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/cloud-platform';

const Settings = () => {
  const { isIndoMode, t } = useLanguage();
  const [googleClientId, setGoogleClientId] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  // 모델 동적 선택용
  const [modelList, setModelList] = useState([]);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false); // [추가] 음성 로딩 상태

  const [totalTokens, setTotalTokens] = useState(0); 
  const [totalCostUsd, setTotalCostUsd] = useState(0); // [추가] 누적 비용(USD)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true); // [추가] 음성 토글 상태
  const [ttsEngine, setTtsEngine] = useState('gemini');
  const defaultKrModel = 'ko-KR-Neural2-A';
  const defaultIdModel = 'id-ID-Chirp3-HD-Achernar';
  
  const [googleTtsModelId, setGoogleTtsModelId] = useState(localStorage.getItem('google_tts_model_id') || defaultIdModel);
  const [googleTtsModelKo, setGoogleTtsModelKo] = useState(localStorage.getItem('google_tts_model_ko') || defaultKrModel);
  
  const [googleVoiceList, setGoogleVoiceList] = useState(JSON.parse(localStorage.getItem('google_voice_list') || '[]'));
  const [gcpAccessToken, setGcpAccessToken] = useState(localStorage.getItem('gcp_access_token') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('user_email') || '');
  
  // 보이스 목록 분리 필터링
  const idVoices = React.useMemo(() => googleVoiceList.filter(v => v.languageCodes.some(lc => lc.startsWith('id'))), [googleVoiceList]);
  const krVoices = React.useMemo(() => googleVoiceList.filter(v => v.languageCodes.some(lc => lc.startsWith('ko'))), [googleVoiceList]);

  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isJsonImporting, setIsJsonImporting] = useState(false);
  const [tokenClient, setTokenClient] = useState(null); // GIS 클라이언트 상태 저장

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const GCP_SCOPES = 'https://www.googleapis.com/auth/cloud-platform';

  // [수정] 구글 토큰 갱신 및 로그인 통합 함수 (v7.7)
  const handleGoogleLogin = (isSilent = false) => {
    if (!window.google) {
      if (!isSilent) alert(isIndoMode ? "Skrip Google belum 준비되지 않았습니다." : "구글 로그인 스크립트가 준비되지 않았습니다.");
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
          
          if (!isSilent) {
            alert(isIndoMode ? "Koneksi Google Berhasil! 🍌" : "구글 연동 완료! 🍌 세션이 1시간 동안 유지됩니다.");
            window.location.reload();
          }
        }
      },
      error_callback: (err) => {
        // [v7.8] 취소나 백그라운드 갱신 실패는 조용히 처리
        if (err.error === 'popup_closed' || isSilent) return;
        console.error("Google Login Error:", err);
        alert(isIndoMode ? "Terjadi kesalahan login Google." : "구글 로그인 중 오류가 발생했습니다.");
      }
    });

    if (isSilent) {
      client.requestAccessToken({ prompt: '' });
    } else {
      client.requestAccessToken();
    }
    setTokenClient(client);
  };

  useEffect(() => {
    // 저장된 키들
    setGeminiKey(localStorage.getItem('geminiApiKey') || import.meta.env.VITE_GEMINI_API_KEY || '');

    // 누적 데이터 불러오기
    setTotalTokens(parseInt(localStorage.getItem('total_gemini_tokens') || '0', 10));
    setTotalCostUsd(parseFloat(localStorage.getItem('total_gemini_cost_usd') || '0'));
    setIsAudioEnabled(localStorage.getItem('is_audio_enabled') !== 'false');
    setTtsEngine(localStorage.getItem('tts_engine') || 'gemini');

    // 모델 리스트 캐시 및 선택된 모델 로드
    const savedModel = localStorage.getItem('selectedGeminiModel');
    if (savedModel) setSelectedGeminiModel(savedModel);
    const savedList = localStorage.getItem('geminiModelList');
    if (savedList) setModelList(JSON.parse(savedList));

    // [v7.8] 스토리지 변경 이벤트 리스너 (다른 탭이나 App.jsx에서 갱신 시 동기화)
    const handleStorageChange = (e) => {
      if (e.key === 'gcp_access_token') setGcpAccessToken(e.newValue);
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
        clearInterval(timer);
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 프리미엄 음성 테스트 함수
  const handleTestTts = async (customModel = null) => {
    if (!gcpAccessToken) {
      alert(isIndoMode ? "Silakan login Google terlebih dahulu." : "먼저 구글 로그인을 완료해주세요.");
      handleGoogleLogin();
      return;
    }
    try {
      const modelToUse = customModel || (isIndoMode ? googleTtsModelKo : googleTtsModelId); 
      const langCode = modelToUse.split('-').slice(0, 2).join('-');
      const isKorean = langCode.startsWith('ko');
      
      const testText = isKorean 
        ? "안녕하세요, 나나입니다. 고품질 AI 음성 테스트 중입니다." 
        : "Halo, saya Nana. Sedang uji coba suara AI premium.";
      
      const endpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gcpAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { text: testText },
          voice: { languageCode: langCode, name: modelToUse },
          audioConfig: { audioEncoding: 'MP3' }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || response.statusText);
      }
      
      const data = await response.json();
      if (data.audioContent) {
        const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
        await audio.play();
      }
    } catch (err) {
      if (err.message.includes('billing')) {
          const billingUrl = `https://console.cloud.google.com/billing/enable?project=1002533566733`;
          alert(`❌ [GCP 결제 계정 연동 필요]\n\n이 기능을 사용하려면 구글 클라우드 콘솔에서 결제 계정이 연동되어 있어야 합니다.\n\n링크: ${billingUrl}`);
          window.open(billingUrl, '_blank');
      } else {
          alert(`❌ 테스트 실패: ${err.message}`);
      }
    }
  };

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
            v.languageCodes.some(lc => lc.startsWith('ko') || lc.startsWith('id'))
        );
        setGoogleVoiceList(filtered);
        localStorage.setItem('google_voice_list', JSON.stringify(filtered));
        alert(isIndoMode ? `Berhasil memuat ${filtered.length} suara premium!` : `총 ${filtered.length}개의 프리미엄 음성을 가져왔습니다!`);
    } catch (err) {
        alert(isIndoMode ? "Gagal memuat daftar suara." : "음성 목록을 가져오지 못했습니다.");
    } finally {
        setLoadingVoices(false);
    }
  };

  // --- CSV Export/Import 로직 ---
  const handleExportCSV = async () => {
    try {
      const words = await getWords();
      if (words.length === 0) {
          alert(isIndoMode ? "Tidak ada kata untuk diekspor." : "내보낼 단어가 없습니다.");
          return;
        }

      const csvContent = convertToCSV(words);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const fileName = `IndoLearn_${new Date().toISOString().slice(0,10)}.csv`;

      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert(isIndoMode ? "Berhasil ekspor CSV!" : "CSV 단어장 내보내기 성공!");
    } catch (err) {
      alert(isIndoMode ? "Terjadi kesalahan saat ekspor CSV." : "CSV 내보내기 중 오류가 발생했습니다.");
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedWords = parseCSV(event.target.result);
        if (parsedWords.length === 0) {
          alert(isIndoMode ? "Tidak ada data kata." : "불러올 단어가 없습니다.");
          return;
        }

        if (!window.confirm(isIndoMode ? `Impor ${parsedWords.length} kata?` : `총 ${parsedWords.length}개의 단어를 불러오시겠습니까?`)) return;

        let addCount = 0;
        let skipCount = 0;
        for (const w of parsedWords) {
          try {
            const { id, ...data } = w;
            await addWord(data);
            addCount++;
          } catch (e) { skipCount++; }
        }
        alert(isIndoMode ? `Selesai! (+${addCount})` : `가져오기 완료! (+${addCount})`);
        e.target.value = '';
      } catch (err) {
        alert(isIndoMode ? "Gagal membaca CSV." : "CSV 파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
  };

  // --- Google Drive Cloud Backup 로직 ---
  const [isDriveOperating, setIsDriveOperating] = useState(false);

  const handleBackupToDrive = async () => {
    const expiry = localStorage.getItem('gcp_token_expiry');
    const isExpired = expiry && (parseInt(expiry, 10) - Date.now() < 5000);

    if (!gcpAccessToken || isExpired) {
      alert(isIndoMode ? "Silakan login Google." : "먼저 구글 로그인을 해주세요.");
      handleGoogleLogin();
      return;
    }
    if (!window.confirm(isIndoMode ? "Cadangkan ke Cloud?" : "데이터를 구글 드라이브에 백업하시겠습니까?")) return;

    setIsDriveOperating(true);
    try {
      const words = await getWords();
      const folders = await getFolders();
      await uploadBackupToDrive(gcpAccessToken, { words, folders, timestamp: new Date().toISOString() });
      alert(isIndoMode ? "Pencadangan Berhasil!" : "구글 드라이브 백업 완료!");
    } catch (err) {
      alert(isIndoMode ? "Gagal mencadangkan." : "백업 중 오류 발생: " + err.message);
    } finally { setIsDriveOperating(false); }
  };

  const handleRestoreFromDrive = async () => {
    const expiry = localStorage.getItem('gcp_token_expiry');
    const isExpired = expiry && (parseInt(expiry, 10) - Date.now() < 5000);

    if (!gcpAccessToken || isExpired) {
      handleGoogleLogin();
      return;
    }
    setIsDriveOperating(true);
    try {
      const backupFile = await searchBackupFile(gcpAccessToken);
      if (!backupFile) {
        alert(isIndoMode ? "Cadangan tidak ditemukan." : "백업 파일을 찾을 수 없습니다.");
        return;
      }
      if (!window.confirm(isIndoMode ? "Pulihkan data?" : "데이터를 복원하시겠습니까?")) return;
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
      alert(isIndoMode ? `Pemulihan Selesai! (+${addCount})` : `복원 완료! (+${addCount})`);
    } catch (e) {
      alert(isIndoMode ? "Gagal memulihkan." : "복원 중 오류 발생.");
    } finally { setIsDriveOperating(false); }
  };

  const handleJsonImport = async () => {
    let input = jsonInput.trim();
    if (!input) return;
    setIsJsonImporting(true);
    try {
      input = input.replace(/```(?:json)?/g, '').trim();
      const firstBracket = input.indexOf('[');
      const lastBracket = input.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) input = input.substring(firstBracket, lastBracket + 1);
      
      let data = JSON.parse(input);
      if (!Array.isArray(data)) data = [data];
      
      let successCount = 0;
      for (const item of data) {
        try {
          await addWord({
            word: item.word?.toLowerCase().trim() || '',
            meaning: item.meaning || '',
            pos: item.pos || '명사',
            root: item.root || '',
            example_id: item.example_formal || item.example_id || '',
            example_kr: item.example_formal_kr || item.example_kr || '',
            folderId: null
          });
          successCount++;
        } catch (e) {}
      }
      alert(isIndoMode ? `Selesai! (+${successCount})` : `가져오기 완료! (+${successCount})`);
      setJsonInput(''); setIsJsonModalOpen(false);
    } catch (e) {
      alert(isIndoMode ? "Format JSON salah." : "JSON 형식이 올바르지 않습니다.");
    } finally { setIsJsonImporting(false); }
  };

  const handleFetchModels = async () => {
    const keyToUse = geminiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!keyToUse) return;
    setLoadingModels(true);
    try {
      const models = await fetchGeminiModels(keyToUse);
      setModelList(models);
      localStorage.setItem('geminiModelList', JSON.stringify(models));
      if (models.length > 0 && !models.includes(selectedGeminiModel)) {
        setSelectedGeminiModel(models[0]);
        localStorage.setItem('selectedGeminiModel', models[0]);
      }
      alert(isIndoMode ? "Berhasil memuat model." : "모델 조회를 성공했습니다.");
    } catch (e) { alert("Gagal memuat model."); }
    finally { setLoadingModels(false); }
  };

  const saveApiKeys = () => {
    localStorage.setItem('geminiApiKey', geminiKey);
    localStorage.setItem('selectedGeminiModel', selectedGeminiModel);
    alert(t('set_save_success'));
  };

  return (
    <div className="page" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '5rem' }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '2rem', textAlign: 'center' }}>{t('set_title')}</h2>
      
      <div className="settings-card" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', padding: '2rem', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #fff', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', color: '#1a1a1a' }}>
            <span style={{ fontSize: '1.5rem' }}>🔊</span> {t('set_audio_title')}
        </h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', background: '#fff', borderRadius: '16px', border: '1px solid #eee', marginBottom: '1.5rem' }}>
            <div>
                <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{t('set_audio_label')}</span>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#666' }}>{t('set_audio_desc')}</p>
            </div>
            <label className="switch">
                <input type="checkbox" checked={isAudioEnabled} onChange={e => {
                    localStorage.setItem('is_audio_enabled', e.target.checked);
                    setIsAudioEnabled(e.target.checked);
                }}/>
                <span className="slider round"></span>
            </label>
        </div>

        <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '20px', border: '1px solid #eee' }}>
            <span style={{ fontWeight: '700', fontSize: '1rem', display: 'block', marginBottom: '1rem' }}>{t('set_engine_title')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <button onClick={() => { if(!gcpAccessToken) handleGoogleLogin(); setTtsEngine('google'); localStorage.setItem('tts_engine', 'google'); }}
                    style={{ padding: '1rem', borderRadius: '14px', border: ttsEngine === 'google' ? '2px solid #4285f4' : '1px solid #eee', background: ttsEngine === 'google' ? '#e8f0fe' : '#fff', color: ttsEngine === 'google' ? '#1967d2' : '#666', fontWeight: 'bold' }}>
                    Google Cloud<br/><small style={{fontWeight: 'normal'}}>Premium</small>
                </button>
                <button onClick={() => { setTtsEngine('gemini'); localStorage.setItem('tts_engine', 'gemini'); }}
                    style={{ padding: '1rem', borderRadius: '14px', border: ttsEngine === 'gemini' ? '2px solid #8e44ad' : '1px solid #eee', background: ttsEngine === 'gemini' ? '#f3e5f5' : '#fff', color: ttsEngine === 'gemini' ? '#6a1b9a' : '#666', fontWeight: 'bold' }}>
                    Gemini AI<br/><small style={{fontWeight: 'normal'}}>Deep Learning</small>
                </button>
                <button onClick={() => { setTtsEngine('browser'); localStorage.setItem('tts_engine', 'browser'); }}
                    style={{ padding: '1rem', borderRadius: '14px', border: ttsEngine === 'browser' ? '2px solid #2d3436' : '1px solid #eee', background: ttsEngine === 'browser' ? '#f5f5f5' : '#fff', color: ttsEngine === 'browser' ? '#2d3436' : '#666', fontWeight: 'bold' }}>
                    Browser Default<br/><small style={{fontWeight: 'normal'}}>Offline</small>
                </button>
            </div>

            {ttsEngine === 'google' && (
                <div style={{ background: '#fff', padding: '1.2rem', borderRadius: '16px', border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{isIndoMode ? "Pilih Model Suara" : "음성 모델 선택"}</span>
                        <button onClick={handleFetchGoogleVoicesList} disabled={loadingVoices}
                            style={{ background: '#4285f4', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                            {loadingVoices ? "..." : t('set_google_update')}
                        </button>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#718096', display: 'block' }}>🇮🇩 Indonesia</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select value={googleTtsModelId} onChange={e => { setGoogleTtsModelId(e.target.value); localStorage.setItem('google_tts_model_id', e.target.value); }}
                                style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }}>
                                {idVoices.length > 0 ? idVoices.map(v => (
                                    <option key={v.name} value={v.name}>{v.name} ({v.ssmlGender})</option>
                                )) : <option value="">{t('set_google_update_needed')}</option>}
                            </select>
                            <button onClick={() => handleTestTts(googleTtsModelId)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', width: '45px' }}>🔉</button>
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85rem', color: '#718096', display: 'block' }}>🇰🇷 Korea</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select value={googleTtsModelKo} onChange={e => { setGoogleTtsModelKo(e.target.value); localStorage.setItem('google_tts_model_ko', e.target.value); }}
                                style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }}>
                                {krVoices.length > 0 ? krVoices.map(v => (
                                    <option key={v.name} value={v.name}>{v.name} ({v.ssmlGender})</option>
                                )) : <option value="">{t('set_google_update_needed')}</option>}
                            </select>
                            <button onClick={() => handleTestTts(googleTtsModelKo)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', width: '45px' }}>🔉</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="settings-card" style={{ background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span> {t('set_api_title')}
        </h3>
        <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder={t('set_ai_placeholder')} 
            style={{ width: '100%', padding: '1rem', border: '1px solid #eee', borderRadius: '12px', marginBottom: '1rem' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <select value={selectedGeminiModel} onChange={e => setSelectedGeminiModel(e.target.value)}
                style={{ flex: 1, padding: '1rem', border: '1px solid #eee', borderRadius: '12px' }}>
                {modelList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={handleFetchModels} disabled={loadingModels} style={{ marginLeft: '1rem', padding: '1rem' }}>🔄</button>
        </div>
        <button onClick={saveApiKeys} style={{ width: '100%', padding: '1.1rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '800' }}>
            {t('set_btn_save')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="settings-card" style={{ background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h3>📁 {t('set_backup_title')}</h3>
            <button onClick={handleExportCSV} style={{ width: '100%', padding: '1rem', background: '#f0fdf4', borderRadius: '12px', marginBottom: '1rem' }}>{t('set_backup_export')}</button>
            <button onClick={() => document.getElementById('csvImport').click()} style={{ width: '100%', padding: '1rem', background: '#f8fafc', borderRadius: '12px', marginBottom: '1rem' }}>{t('set_backup_import')}</button>
            <input type="file" id="csvImport" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            <button onClick={() => setIsJsonModalOpen(true)} style={{ width: '100%', padding: '1rem', background: '#fffbeb', borderRadius: '12px' }}>{t('set_json_paste')}</button>
        </div>

        <div className="settings-card" style={{ background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '2px solid #e8f0fe' }}>
            <h3>☁️ {t('set_cloud_title')}</h3>
            {gcpAccessToken ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#4285f4' }}>{userEmail}</div>
                    <button onClick={handleBackupToDrive} disabled={isDriveOperating} style={{ width: '100%', padding: '1rem', background: '#4285f4', color: '#fff', borderRadius: '12px' }}>{t('set_cloud_backup_btn')}</button>
                    <button onClick={handleRestoreFromDrive} disabled={isDriveOperating} style={{ width: '100%', padding: '1rem', background: '#34a853', color: '#fff', borderRadius: '12px' }}>{t('set_cloud_restore_btn')}</button>
                </div>
            ) : (
                <button onClick={() => handleGoogleLogin()} style={{ width: '100%', padding: '1.2rem', background: '#4285f4', color: '#fff', borderRadius: '14px' }}>{t('set_cloud_login')}</button>
            )}
        </div>
      </div>

      <div className="settings-card" style={{ background: '#fff5f5', padding: '1.5rem', borderRadius: '20px', border: '1px solid #feb2b2' }}>
        <h4 style={{ color: '#c53030' }}>{t('set_diagnosa')}</h4>
        <button onClick={() => { localStorage.removeItem('gcp_access_token'); window.location.reload(); }}
            style={{ width: '100%', padding: '0.8rem', background: '#fff', border: '1px solid #718096', borderRadius: '10px' }}>{t('set_reset_btn')}</button>
      </div>

      {isJsonModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '25px', width: '90%', maxWidth: '600px' }}>
            <h3>{t('set_json_import_title')}</h3>
            <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} style={{ width: '100%', height: '300px', borderRadius: '12px' }} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={handleJsonImport} disabled={isJsonImporting} style={{ flex: 1, padding: '1rem', background: '#ff9f43', color: '#fff', borderRadius: '12px' }}>{t('set_json_confirm')}</button>
              <button onClick={() => setIsJsonModalOpen(false)} style={{ padding: '0 1rem', borderRadius: '12px' }}>{t('set_json_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
