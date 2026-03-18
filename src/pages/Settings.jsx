import React, { useState, useEffect } from 'react';
import { getWords, getFolders, addWord, addFolder } from '../db/database';
import { fetchGeminiModels } from '../api/geminiApi';
import { convertToCSV, parseCSV } from '../api/csvApi';
import { uploadBackupToDrive, downloadBackupFromDrive, searchBackupFile } from '../api/driveApi';
import { useLanguage } from '../contexts/LanguageContext';

// 구글 드라이브 백업/복원용 설정 객체
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// 드라이브 파일 권한과 더불어 Google Cloud 서비스 연동(TTS) 권한을 추가합니다.
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/cloud-platform';

const Settings = () => {
  const { isIndoMode, t } = useLanguage();
  const [googleClientId, setGoogleClientId] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [ttsKey, setTtsKey] = useState('');

  // 모델 동적 선택용
  const [modelList, setModelList] = useState([]);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);

  const [totalTokens, setTotalTokens] = useState(0); // [추가] 토큰 사용량 상태
  const [totalCostUsd, setTotalCostUsd] = useState(0); // [추가] 누적 비용(USD)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true); // [추가] 음성 토글 상태
  const [ttsEngine, setTtsEngine] = useState('gemini'); // [추가] 음성 엔진 선택 상태 (gemini, google, browser)
  const defaultGoogleModel = isIndoMode ? 'ko-KR-Neural2-A' : 'id-ID-Standard-C';
  const [googleTtsModel, setGoogleTtsModel] = useState(localStorage.getItem('google_tts_model') || defaultGoogleModel);

  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isJsonImporting, setIsJsonImporting] = useState(false);

  const [gcpAccessToken, setGcpAccessToken] = useState(localStorage.getItem('gcp_access_token') || '');

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const GCP_SCOPES = 'https://www.googleapis.com/auth/cloud-platform';

  const handleGoogleLogin = () => {
    if (!window.google) {
      alert(isIndoMode ? "Skrip Login Google belum dimuat. Silakan coba lagi nanti." : "구글 로그인 스크립트가 완전히 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES, // GCP_SCOPES 대신 모든 권한이 포함된 SCOPES 사용
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          localStorage.setItem('gcp_access_token', tokenResponse.access_token);
          setGcpAccessToken(tokenResponse.access_token);
          setTtsEngine('google');
          localStorage.setItem('tts_engine', 'google');
          alert(isIndoMode ? "Koneksi Google Berhasil! 🍌" : "구글 연동 완료! 🍌 압도적인 음질의 구글 클라우드 TTS가 활성화되었습니다.");
        }
      },
      error_callback: (err) => {
        console.error("Google Login Error:", err);
        alert("구글 로그인 중 취소되거나 오류가 발생했습니다.");
      }
    });

    client.requestAccessToken();
  };

  useEffect(() => {
    // 저장된 키들 (없으면 환경변수에서 불러옴)
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
  }, []);

  // --- CSV Export/Import 로직 ---
  const handleExportCSV = async () => {
    try {
      const words = await getWords();
      if (words.length === 0) {
        alert("내보낼 단어가 없습니다.");
        return;
      }

      const csvContent = convertToCSV(words);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const fileName = `IndoLearn_${month}${day}${hours}.csv`;

      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert("CSV 단어장 내보내기 성공! 저장된 파일을 확인해주세요.");
    } catch (err) {
      console.error("CSV 내보내기 에러:", err);
      alert("CSV 내보내기 중 오류가 발생했습니다.");
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvText = event.target.result;
        const parsedWords = parseCSV(csvText);
        
        if (parsedWords.length === 0) {
          alert("불러올 수 있는 단어 데이터가 없습니다.");
          return;
        }

        if (!window.confirm(`총 ${parsedWords.length}개의 단어를 불러오시겠습니까? (중복 단어는 제외됩니다)`)) return;

        let addCount = 0;
        let skipCount = 0;
        
        for (const w of parsedWords) {
          try {
            // id 속성이 있으면 제거하여 신규 추가로 인식하게 함
            const { id, ...data } = w;
            await addWord(data);
            addCount++;
          } catch (error) {
            skipCount++;
          }
        }
        
        alert(`가져오기 완료!\n- 새로 추가됨: ${addCount}개\n- 중복 스킵됨: ${skipCount}개`);
        e.target.value = ''; // input 초기화
      } catch (err) {
        console.error("CSV 가져오기 에러:", err);
        alert("CSV 파일을 읽는 중 오류가 발생했습니다. 형식을 확인해주세요.");
      }
    };
    reader.readAsText(file);
  };

  // --- Google Drive Cloud Backup 로직 ---
  const [isDriveOperating, setIsDriveOperating] = useState(false);

  const handleBackupToDrive = async () => {
    if (!gcpAccessToken) {
      alert("먼저 구글 로그인을 완료해주세요.");
      handleGoogleLogin();
      return;
    }

    if (!window.confirm("현재 단어장 데이터를 구글 드라이브에 백업하시겠습니까? (기존 백업은 덮어씌워집니다)")) return;

    setIsDriveOperating(true);
    try {
      const words = await getWords();
      const folders = await getFolders();
      const backupData = {
        words,
        folders,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      await uploadBackupToDrive(gcpAccessToken, backupData);
      alert("구글 드라이브 백업 완료! 🍌☁️");
    } catch (err) {
      console.error("Drive Backup Error:", err);
      if (err.message.includes('401') || err.message.includes('403')) {
          localStorage.removeItem('gcp_access_token');
          setGcpAccessToken('');
          alert("로그인 세션이 만료되었습니다. 다시 로그인 해주세요.");
      } else {
          alert("백업 중 오류가 발생했습니다: " + err.message);
      }
    } finally {
      setIsDriveOperating(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    if (!gcpAccessToken) {
      alert("먼저 구글 로그인을 완료해주세요.");
      handleGoogleLogin();
      return;
    }

    setIsDriveOperating(true);
    try {
      const backupFile = await searchBackupFile(gcpAccessToken);
      if (!backupFile) {
        alert("구글 드라이브에서 백업 파일을 찾을 수 없습니다.");
        return;
      }

      if (!window.confirm(`${new Date(backupFile.modifiedTime).toLocaleString()}에 생성된 백업 데이터가 있습니다. 지금 복원하시겠습니까? (기본 데이터와 합쳐집니다)`)) return;

      const backupData = await downloadBackupFromDrive(gcpAccessToken, backupFile.id);
      
      // 복원 로직
      let addCount = 0;
      let skipCount = 0;

      // 1. 단어 복원
      if (backupData.words && Array.isArray(backupData.words)) {
        for (const w of backupData.words) {
          try {
            const { id, ...data } = w;
            await addWord(data);
            addCount++;
          } catch (e) {
            skipCount++;
          }
        }
      }

      // 2. 폴더 복원 (폴더는 중복 방지 로직이 약하므로 이름 기반 체크 권장되지만, 
      // 현재 DB 구조상 간단히 추가 처리하거나 필요시 고도화)
      if (backupData.folders && Array.isArray(backupData.folders)) {
        for (const f of backupData.folders) {
          try {
            await addFolder(f.name);
          } catch (e) {}
        }
      }

      alert(`복원 완료! 🍌🚀\n- 새로 추가됨: ${addCount}개\n- 중복 스킵됨: ${skipCount}개`);
    } catch (err) {
      console.error("Drive Restore Error:", err);
      if (err.message.includes('401') || err.message.includes('403')) {
          localStorage.removeItem('gcp_access_token');
          setGcpAccessToken('');
          alert("로그인 세션이 만료되었습니다. 다시 로그인 해주세요.");
      } else {
          alert("복원 중 오류가 발생했습니다: " + err.message);
      }
    } finally {
      setIsDriveOperating(false);
    }
  };

  const handleJsonImport = async () => {
    let input = jsonInput.trim();
    if (!input) {
      alert('가져올 JSON 내용을 입력해주세요.');
      return;
    }
    
    setIsJsonImporting(true);
    try {
      // --- [스마트 클리닝 로직] ---
      // 1. 마크다운 백틱 제거 (```json 또는 ```)
      input = input.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      
      // 2. 만약 앞뒤에 불필요한 텍스트가 있다면 첫 '['와 마지막 ']' 사이만 추출
      const firstBracket = input.indexOf('[');
      const lastBracket = input.lastIndexOf(']');
      
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          input = input.substring(firstBracket, lastBracket + 1);
      }
      
      let data = JSON.parse(input);
      if (!Array.isArray(data)) data = [data];
      
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      
      for (const item of data) {
        try {
          // 필드 매핑 보강
          const wordData = {
            word: item.word?.toLowerCase().trim() || '',
            meaning: item.meaning || '',
            pos: item.pos || '명사',
            root: item.root || '',
            // 예전 필드명과 새 필드명 모두 지원
            example_id: item.example_formal || item.example_id || '',
            example_kr: item.example_formal_kr || item.example_kr || '',
            example_formal: item.example_formal || '',
            example_formal_kr: item.example_formal_kr || '',
            example_casual: item.example_casual || '',
            example_casual_kr: item.example_casual_kr || '',
            antonym: item.antonym || '',
            synonym: item.synonym || '',
            grammar_rule: item.grammar_rule || '',
            context: item.context || '',
            caution: item.caution || '',
            related: item.related || '',
            word_breakdown: item.word_breakdown || [],
            folderId: null
          };

          if (!wordData.word) {
              errorCount++;
              continue;
          }

          await addWord(wordData);
          successCount++;
        } catch (err) {
          if (err.message && err.message.includes('이미 존재하는')) {
            skipCount++;
          } else {
            console.error('JSON Import Item Error:', err);
            errorCount++;
          }
        }
      }
      
      alert(`가져오기 완료!\n✅ 성공: ${successCount}개\n⏭️ 중복 건너뜀: ${skipCount}개\n❌ 실패: ${errorCount}개`);
      setJsonInput('');
      setIsJsonModalOpen(false);
    } catch (err) {
      console.error('JSON Parse Error:', err);
      alert('JSON 형식이 올바르지 않습니다. 제미나이가 준 내용을 그대로 복사했는지 확인해 주세요.\n\n오류 내용: ' + err.message);
    } finally {
      setIsJsonImporting(false);
    }
  };


  const handleFetchModels = async () => {
    const keyToUse = geminiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!keyToUse) {
      alert("먼저 Gemini API Key를 위 입력란에 작성해주세요.");
      return;
    }
    setLoadingModels(true);
    try {
      const models = await fetchGeminiModels(keyToUse);
      setModelList(models);
      localStorage.setItem('geminiModelList', JSON.stringify(models));
      
      if (models.length > 0 && !models.includes(selectedGeminiModel)) {
        setSelectedGeminiModel(models[0]);
        localStorage.setItem('selectedGeminiModel', models[0]);
      }
      alert(`총 ${models.length}개의 사용 가능한 모델을 불러왔습니다.`);
    } catch (e) {
      alert("모델 조회 실패: " + e.message);
    } finally {
      setLoadingModels(false);
    }
  };

  const saveApiKeys = () => {
    localStorage.setItem('geminiApiKey', geminiKey);
    if (selectedGeminiModel) localStorage.setItem('selectedGeminiModel', selectedGeminiModel);
    alert(t('set_save_success'));
  };

  return (
    <div className="page">
      <h2>{t('set_title')}</h2>
      
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', marginTop: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h3 style={{color: 'var(--primary-color)', marginBottom: '1rem'}}>{t('set_audio_title')}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <div>
                <span style={{ fontWeight: 'bold' }}>{t('set_audio_label')}</span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>{t('set_audio_desc')}</p>
            </div>
            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                <input 
                    type="checkbox" 
                    checked={isAudioEnabled} 
                    onChange={e => {
                        const val = e.target.checked;
                        setIsAudioEnabled(val);
                        localStorage.setItem('is_audio_enabled', val.toString());
                    }}
                    style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: isAudioEnabled ? 'var(--primary-color)' : '#ccc',
                    transition: '.4s', borderRadius: '34px'
                }}>
                    <span style={{
                        position: 'absolute', content: '""', height: '20px', width: '20px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                        transform: isAudioEnabled ? 'translateX(24px)' : 'none'
                    }}></span>
                </span>
            </label>
        </div>

        {/* 음성 엔진 선택 영역 추가 */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0f4f8', borderRadius: '8px', border: '1px solid #d1d9e0' }}>
            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.8rem' }}>{t('set_engine_title')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
                <button 
                    onClick={() => {
                        if(!gcpAccessToken) {
                            handleGoogleLogin();
                        } else {
                            setTtsEngine('google'); 
                            localStorage.setItem('tts_engine', 'google');
                        }
                    }}
                    style={{ 
                        padding: '0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                        background: ttsEngine === 'google' ? '#ea4335' : '#fff',
                        color: ttsEngine === 'google' ? '#fff' : '#666',
                        boxShadow: ttsEngine === 'google' ? '0 4px 8px rgba(0,0,0,0.1)' : 'none'
                    }}
                >
                    Google Cloud<br/><span style={{fontSize: '0.65rem', fontWeight: 'normal'}}>{gcpAccessToken ? t('set_google_premium') : t('set_google_login')}</span>
                </button>
                <button 
                    onClick={() => { setTtsEngine('gemini'); localStorage.setItem('tts_engine', 'gemini'); }}
                    style={{ 
                        padding: '0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                        background: ttsEngine === 'gemini' ? 'var(--primary-color)' : '#fff',
                        color: ttsEngine === 'gemini' ? '#fff' : '#666',
                        boxShadow: ttsEngine === 'gemini' ? '0 4px 8px rgba(0,0,0,0.1)' : 'none'
                    }}
                >
                    Gemini AI<br/><span style={{fontSize: '0.65rem', fontWeight: 'normal'}}>(Default)</span>
                </button>
                <button 
                    onClick={() => { setTtsEngine('browser'); localStorage.setItem('tts_engine', 'browser'); }}
                    style={{ 
                        padding: '0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                        background: ttsEngine === 'browser' ? '#333' : '#fff',
                        color: ttsEngine === 'browser' ? '#fff' : '#666',
                        boxShadow: ttsEngine === 'browser' ? '0 4px 8px rgba(0,0,0,0.1)' : 'none'
                    }}
                >
                    {isIndoMode ? 'Browser' : '브라우저 기본'}<br/><span style={{fontSize: '0.65rem', fontWeight: 'normal'}}>(Offline)</span>
                </button>
            </div>
            
            {/* Google Cloud 엔진이 선택되었을 때만 모델 선택 메뉴 노출 */}
            {ttsEngine === 'google' && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#ffeaa7', borderRadius: '8px', border: '2px dashed #fdcb6e' }}>
                    <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.6rem', color: '#d35400' }}>{t('set_google_model_title')}</span>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input 
                                type="radio" 
                                name="googleModel" 
                                value={isIndoMode ? "ko-KR-Neural2-A" : "id-ID-Chirp3-HD-Schedar"}
                                checked={googleTtsModel.includes('Neural2') || googleTtsModel.includes('Chirp')}
                                onChange={(e) => {
                                    setGoogleTtsModel(e.target.value);
                                    localStorage.setItem('google_tts_model', e.target.value);
                                }}
                            />
                            <b>{t('set_google_model_high')}</b> ({isIndoMode ? 'Neural2' : 'Chirp3-HD'})
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input 
                                type="radio" 
                                name="googleModel" 
                                value={isIndoMode ? "ko-KR-Standard-A" : "id-ID-Standard-C"}
                                checked={googleTtsModel.includes('Standard')}
                                onChange={(e) => {
                                    setGoogleTtsModel(e.target.value);
                                    localStorage.setItem('google_tts_model', e.target.value);
                                }}
                            />
                            <b>{t('set_google_model_std')}</b> (Standard)
                        </label>
                    </div>
                </div>
            )}

            <p style={{ margin: '0.8rem 0 0', fontSize: '0.75rem', color: '#666', lineHeight: '1.4' }}>
                * <b>Google Cloud:</b> {isIndoMode ? 'Kualitas suara terbaik (memerlukan login satu kali).' : '최고의 음질을 제공합니다 (앱 사용 시 로그인 연동 최초 1회 필요).'}<br/>
                * <b>Gemini AI:</b> {isIndoMode ? 'Berjalan otomatis tanpa prosedur tambahan, namun kecepatan mungkin bervariasi.' : '별도의 절차 없이 작동하지만 속도가 불규칙할 수 있습니다.'}<br/>
                * <b>{isIndoMode ? 'Browser Default' : '브라우저 기본'}:</b> {isIndoMode ? 'Bekerja secara offline di mana saja.' : '언제 어디서나 오프라인에서도 보장된 소리를 냅니다.'}
            </p>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', marginTop: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{color: 'var(--primary-color)', margin: 0}}>{t('set_api_title')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                <span style={{ background: '#f0fdf4', color: '#2e7d32', padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    💡 {t('set_api_tokens')}: {totalTokens.toLocaleString()} Token
                </span>
                <span style={{ background: '#fff7ed', color: '#c2410c', padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #fed7aa' }}>
                    💰 {t('set_api_cost')}: {isIndoMode ? `${t('set_api_cost_unit')} ${totalCostUsd.toFixed(4)}` : `${Math.round(totalCostUsd * 1500).toLocaleString()}${t('set_api_cost_unit')}`}
                </span>
            </div>
        </div>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>{t('set_api_desc')}</p>
        
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('set_gemini_key_label')}</label>
        <input 
          type="password" 
          value={geminiKey}
          onChange={e => setGeminiKey(e.target.value)}
          placeholder={t('set_ai_placeholder')} 
          style={{ width: '100%', padding: '0.9rem', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '1.5rem' }} 
        />

        <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #eee' }}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>💡 {t('set_gemini_model_select')}</h4>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
               <select 
                  value={selectedGeminiModel} 
                  onChange={e => {
                      setSelectedGeminiModel(e.target.value);
                      localStorage.setItem('selectedGeminiModel', e.target.value);
                  }}
                  style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', border: '1px solid #ccc' }}
               >
                 {modelList.length === 0 && <option value="">{isIndoMode ? "Daftar model kosong" : "모델 리스트가 비어있습니다."}</option>}
                 {modelList.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
               <button 
                  onClick={handleFetchModels} disabled={loadingModels}
                  style={{ padding: '0.8rem 1rem', background: '#fff', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {loadingModels ? (isIndoMode ? 'Memuat...' : '조회중...') : (isIndoMode ? 'Update' : '모델 조회 갱신')}
               </button>
            </div>
        </div>
        
        <button onClick={saveApiKeys} style={{ padding: '0.8rem 1.5rem', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
          {t('set_btn_save')}
        </button>
      </div>

      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', marginTop: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '5rem' }}>
        <h3 style={{color: '#2e7d32'}}>{t('set_backup_title')}</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0 1.5rem' }}>{isIndoMode ? 'Cadangkan kosakata ke file atau pindahkan antar perangkat.' : '구글 로그인 없이도 파일을 통해 기기 간에 단어장을 자유롭게 옮길 수 있습니다.'}</p>
        
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <button 
                onClick={handleExportCSV}
                style={{ flex: 1, minWidth: '150px', padding: '0.9rem', background: '#f0fdf4', color: '#2e7d32', border: '1px solid #b7e4c7', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {t('set_backup_export')}
            </button>
            
            <div style={{ flex: 1, minWidth: '150px' }}>
                <input 
                    type="file" 
                    id="csvImport" 
                    accept=".csv" 
                    onChange={handleImportCSV} 
                    style={{ display: 'none' }} 
                />
                <button 
                    onClick={() => document.getElementById('csvImport').click()}
                    style={{ width: '100%', padding: '0.9rem', background: '#e8f5e9', color: '#1b5e20', border: '1px solid #c8e6c9', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {t('set_backup_import')}
                </button>
            </div>
            
            <button 
                onClick={() => setIsJsonModalOpen(true)}
                style={{ width: '100%', marginTop: '0.8rem', padding: '1rem', background: '#fff9db', color: '#856404', border: '3px solid #feca57', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 0 #feca57' }}>
                {t('set_json_paste')}
            </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '1rem', textAlign: 'center' }}>{t('set_backup_tip')}</p>
      </div>

      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', marginTop: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '5rem', border: '2px solid #4285f4' }}>
        <h3 style={{color: '#4285f4', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Gdrive" style={{width: '24px'}} />
            {t('set_cloud_title')}
        </h3>
        <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0 1.5rem' }}>{t('set_cloud_desc')}</p>
        
        {!gcpAccessToken ? (
            <button 
                onClick={handleGoogleLogin}
                style={{ width: '100%', padding: '1rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                {t('set_cloud_login')}
            </button>
        ) : (
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <button 
                    onClick={handleBackupToDrive}
                    disabled={isDriveOperating}
                    style={{ flex: 1, minWidth: '150px', padding: '1rem', background: '#34a853', color: '#fff', border: 'none', borderRadius: '8px', cursor: isDriveOperating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                    {isDriveOperating ? (isIndoMode ? 'Backing up...' : '백업 중...') : t('set_cloud_backup_btn')}
                </button>
                <button 
                    onClick={handleRestoreFromDrive}
                    disabled={isDriveOperating}
                    style={{ flex: 1, minWidth: '150px', padding: '1rem', background: '#fbbc05', color: '#fff', border: 'none', borderRadius: '8px', cursor: isDriveOperating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                    {isDriveOperating ? (isIndoMode ? 'Restoring...' : '복원 중...') : t('set_cloud_restore_btn')}
                </button>
            </div>
        )}
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1rem', background: '#f8f9fa', padding: '0.5rem', borderRadius: '4px' }}>
            * {isIndoMode ? 'Data cadangan disimpan sebagai' : '백업 데이터는 사용자 본인의 구글 드라이브에'} <b>'indo-word-app-backup.json'</b> {isIndoMode ? 'di Google Drive Anda.' : '파일로 저장됩니다.'}
        </p>
      </div>

      {isJsonModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '25px', width: '100%', maxWidth: '600px', boxShadow: '0 15px 35px rgba(0,0,0,0.2)', animation: 'popIn 0.3s ease-out', position: 'relative' }}>
            <h3 style={{ marginTop: 0, color: '#856404', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{isIndoMode ? '🍌 Impor Data (JSON)' : '🍌 데이터 보따리 풀기 (JSON)'}</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.2rem' }}>{isIndoMode ? 'Tempelkan list kata (JSON) dari Gemini di bawah ini!' : '제미나이가 만들어준 단어 리스트(JSON)를 아래에 붙여넣어 주세요!'}</p>
            <textarea 
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder='[{ "word": "menginjak", "meaning": "밟다", ... }, ...]'
              style={{ width: '100%', height: '350px', padding: '1.2rem', border: '3px solid #fdf2f2', borderRadius: '20px', outline: 'none', background: '#fffcfc', fontFamily: 'monospace', fontSize: '0.85rem', color: '#444' }}
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button 
                onClick={handleJsonImport}
                disabled={isJsonImporting}
                style={{ flex: 1, padding: '1.2rem', background: 'linear-gradient(135deg, #feca57, #ff9f43)', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '1.1rem', cursor: isJsonImporting ? 'not-allowed' : 'pointer', boxShadow: '0 6px 0 #e67e22' }}>
                {t('btn_confirm')}
              </button>
              <button 
                onClick={() => setIsJsonModalOpen(false)}
                style={{ padding: '0 1.5rem', background: '#eee', color: '#666', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                {t('btn_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
