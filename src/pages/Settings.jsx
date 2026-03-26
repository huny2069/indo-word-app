import React, { useState, useEffect } from 'react';
import { getWords, getFolders, addWord, addFolder } from '../db/database';
import { fetchGeminiModels } from '../api/geminiApi';
import { convertToCSV, parseCSV } from '../api/csvApi';
import { uploadBackupToDrive, downloadBackupFromDrive, searchBackupFile } from '../api/driveApi';
import { useLanguage } from '../contexts/LanguageContext';

// 구글 드라이브 백업/복원용 설정 객체
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
// 드라이브 파일 권한과 더불어 Google Cloud 서비스 연동(TTS) 및 이메일 정보를 요청합니다.
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email';

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
  const defaultGoogleModel = isIndoMode ? 'ko-KR-Neural2-A' : 'id-ID-Neural2-A';
  const [googleTtsModel, setGoogleTtsModel] = useState(localStorage.getItem('google_tts_model') || defaultGoogleModel);
  const [googleVoiceList, setGoogleVoiceList] = useState(JSON.parse(localStorage.getItem('google_voice_list') || '[]'));
  const [loadingVoices, setLoadingVoices] = useState(false);

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
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          localStorage.setItem('gcp_access_token', tokenResponse.access_token);
          setGcpAccessToken(tokenResponse.access_token);
          
          // [추가] 액세스 토큰을 사용하여 사용자 이메일 정보 가져오기
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });
            const userInfo = await userInfoRes.json();
            if (userInfo.email) {
              localStorage.setItem('user_email', userInfo.email.toLowerCase().trim());
              console.log("Logged in as:", userInfo.email);
            }
          } catch (userInfoErr) {
            console.error("Failed to fetch user info:", userInfoErr);
          }

          setTtsEngine('google');
          localStorage.setItem('tts_engine', 'google');
          alert(isIndoMode ? "Koneksi Google Berhasil! 🍌" : "구글 연동 완료! 🍌 관리자 권한이 확인되면 통계 메뉴가 활성화됩니다.");
          
          // 레이아웃 갱신을 위해 페이지 새로고침
          window.location.reload();
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

  // [추가] 프리미엄 음성 테스트 함수
  const handleTestTts = async () => {
    if (!gcpAccessToken) {
      alert("먼저 구글 로그인을 완료해주세요.");
      return;
    }
    try {
      // ttsApi.js의 playAudio를 직접 호출하기 위해 import가 필요할 수 있으나, 
      // 현재 모듈 구조상 playAudio가 전역으로 사용 가능한지 확인 필요.
      // 여기서는 직접 playGoogleCloudTTS 로직을 살짝 빌려와서 테스트합니다.
      const testText = isIndoMode ? "안녕하세요, 나나입니다. 반갑습니다." : "Halo, saya Nana. Senang bertemu dengan Anda.";
      const isKorean = !isIndoMode; // 인도네시아인이면 한국어 테스트, 한국인이면 인도어 테스트
      
      const langCode = isKorean ? 'ko-KR' : 'id-ID';
      const savedModel = localStorage.getItem('google_tts_model');
      const defaultModel = isKorean ? 'ko-KR-Neural2-A' : 'id-ID-Standard-C';
      const effectiveModel = (savedModel && savedModel.startsWith(langCode.substring(0,2))) ? savedModel : defaultModel;

      const endpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gcpAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { text: testText },
          voice: { languageCode: langCode, name: effectiveModel },
          audioConfig: { audioEncoding: 'MP3' }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`GCP API 오류 (HTTP ${response.status}): ${errJson.error?.message || '알 수 없는 오류'}\n\n*팁: Google Cloud Console에서 'Text-to-Speech API'가 활성화되어 있는지, 결제 수단이 등록되어 있는지 확인하세요.`);
      }
      
      const data = await response.json();
      if (data.audioContent) {
        const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
        await audio.play();
        alert("프리미엄 음성 재생 성공! 🍌🔊 만약 소리가 나지 않는다면 기기의 미디어 음량을 확인하세요.");
      }
    } catch (err) {
      alert(`❌ 고급 음성 테스트 실패:\n${err.message}`);
    }
  };

  // [추가] Google Cloud TTS 가용 음성 목록 가져오기
  const handleFetchGoogleVoices = async () => {
    if (!gcpAccessToken) {
      alert("먼저 구글 로그인을 완료해주세요.");
      return;
    }
    setLoadingVoices(true);
    try {
      const response = await fetch('https://texttospeech.googleapis.com/v1/voices', {
        headers: { 'Authorization': `Bearer ${gcpAccessToken}` }
      });
      if (!response.ok) throw new Error("음성 목록을 가져오지 못했습니다.");
      const data = await response.json();
      
      // 한국어와 인도네시아어 음성만 필터링
      const filtered = data.voices.filter(v => v.languageCodes.some(lc => lc.startsWith('ko') || lc.startsWith('id')));
      setGoogleVoiceList(filtered);
      localStorage.setItem('google_voice_list', JSON.stringify(filtered));
      alert(`총 ${filtered.length}개의 한국어/인도네시아어 프리미엄 음성을 찾았습니다! 🍌🔊`);
    } catch (err) {
      alert("음성 목록 가져오기 실패: " + err.message);
    } finally {
      setLoadingVoices(false);
    }
  };

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
                <div style={{ marginTop: '1rem', padding: '1.2rem', background: '#ffeaa7', borderRadius: '12px', border: '2px dashed #fdcb6e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                        <span style={{ fontWeight: 'bold', color: '#d35400' }}>⭐ {t('set_google_model_title')} {isIndoMode ? "(Target: B. Korea)" : "(Target: B. Indo)"}</span>
                        <button 
                            onClick={handleFetchGoogleVoices} 
                            disabled={loadingVoices}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#fff', border: '1px solid #d35400', borderRadius: '6px', cursor: 'pointer', color: '#d35400', fontWeight: 'bold' }}
                        >
                            {loadingVoices ? '...' : (isIndoMode ? 'Segarkan List' : '음성 목록 갱신')}
                        </button>
                    </div>

                    <select 
                        value={googleTtsModel}
                        onChange={(e) => {
                            setGoogleTtsModel(e.target.value);
                            localStorage.setItem('google_tts_model', e.target.value);
                        }}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #fab1a0', background: '#fff' }}
                    >
                        {googleVoiceList.length > 0 ? (
                            <>
                                <optgroup label="--- Recommendation ---">
                                    <option value={isIndoMode ? "ko-KR-Neural2-A" : "id-ID-Neural2-A"}>[Neural2] {isIndoMode ? 'Korean A' : 'Indonesian A'} (Best)</option>
                                    <option value={isIndoMode ? "ko-KR-Wavenet-A" : "id-ID-Wavenet-A"}>[Wavenet] {isIndoMode ? 'Korean A' : 'Indonesian A'} (Stable)</option>
                                </optgroup>
                                <optgroup label="--- All Available ---">
                                    {googleVoiceList
                                        .filter(v => v.languageCodes.some(lc => lc.startsWith(isIndoMode ? 'ko' : 'id')))
                                        .map(v => <option key={v.name} value={v.name}>{v.name} ({v.ssmlGender})</option>)
                                    }
                                </optgroup>
                            </>
                        ) : (
                            <>
                                <option value={isIndoMode ? "ko-KR-Neural2-A" : "id-ID-Neural2-A"}>Neural2 High (Default)</option>
                                <option value={isIndoMode ? "ko-KR-Wavenet-A" : "id-ID-Wavenet-A"}>Wavenet Stable</option>
                                <option value={isIndoMode ? "ko-KR-Standard-A" : "id-ID-Standard-A"}>Standard</option>
                            </>
                        )}
                    </select>

                    <p style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#856404' }}>
                        * {isIndoMode ? 'Jika suara tidak muncul, klik "Segarkan List"와 pilih 모델 표준(Standard).' : '소리가 나지 않는다면 "음성 목록 갱신" 후 표준(Standard) 모델을 선택해보세요.'}
                    </p>
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
                style={{ width: '100%', padding: '1rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
                <img src="https://www.google.com/favicon.ico" alt="google" style={{ width: '18px', height: '18px', filter: 'brightness(1.5)' }} />
                {t('set_cloud_login')}
            </button>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {localStorage.getItem('user_email') && (
                  <div style={{ padding: '0.8rem 1rem', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #cce3ff', fontSize: '0.9rem', color: '#0056b3', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold' }}>📧 {isIndoMode ? "Akun Terhubung:" : "연동된 계정:"}</span>
                    {localStorage.getItem('user_email')}
                  </div>
                )}
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
            </div>
        )}
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1rem', background: '#f8f9fa', padding: '0.5rem', borderRadius: '4px' }}>
            * {isIndoMode ? 'Data cadangan disimpan sebagai' : '백업 데이터는 사용자 본인의 구글 드라이브에'} <b>'indo-word-app-backup.json'</b> {isIndoMode ? 'di Google Drive Anda.' : '파일로 저장됩니다.'}
        </p>

        {/* [추가] 진단 및 디버그 도구 섹션 */}
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#fff5f5', borderRadius: '15px', border: '1px solid #feb2b2' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#c53030', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🛠️ {isIndoMode ? 'Diagnosis & Debug' : '관리자 진단 및 오동작 해결 도구'}
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.3rem' }}>{isIndoMode ? 'Email Ter로그인' : '현재 로그인된 이메일'}</div>
                    <div style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>{localStorage.getItem('user_email') || '(없음)'}</div>
                </div>
                <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.3rem' }}>{isIndoMode ? 'Status Admin' : '관리자 권한 상태'}</div>
                    <div style={{ fontWeight: 'bold', color: (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().trim() === (localStorage.getItem('user_email') || '').toLowerCase().trim() ? '#2f855a' : '#c53030' }}>
                        {(import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().trim() === (localStorage.getItem('user_email') || '').toLowerCase().trim() 
                          ? (isIndoMode ? '✅ Administrator' : '✅ 관리자 인증됨') 
                          : (isIndoMode ? '❌ User Biasa' : '❌ 일반 사용자')}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <button 
                    onClick={handleTestTts}
                    style={{ flex: 1, padding: '0.8rem', background: '#fff', border: '2px solid #feb2b2', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', color: '#c53030' }}
                >
                    🔉 {isIndoMode ? 'Tes Suara Premium' : '프리미엄 음성 테스트'}
                </button>
                <button 
                    onClick={() => {
                        localStorage.removeItem('user_email');
                        localStorage.removeItem('gcp_access_token');
                        window.location.reload();
                    }}
                    style={{ flex: 1, padding: '0.8rem', background: '#fff', border: '1px solid #718096', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', color: '#718096' }}
                >
                    🔄 {isIndoMode ? 'Reset Login & Keluar' : '로그인 세션 초기화'}
                </button>
            </div>
            
            <p style={{ margin: '1rem 0 0 0', fontSize: '0.75rem', color: '#718096', lineHeight: '1.4' }}>
                * {isIndoMode ? 'Jika menu admin tidak muncul, pastikan email di atas sama dengan VITE_ADMIN_EMAIL.' : '관리자 메일이 일치하는데도 메뉴가 안 보인다면 Vercel에서 Redeploy를 실행해 환경 변수를 갱신하세요.'}<br/>
                * {isIndoMode ? 'Jika suara premium gagal, periksa apakah Google Cloud Billing aktif.' : '프리미엄 음성 실패 시 Google Cloud Console에서 TTS API 활성화 및 결제 수단 등록 여부를 확인하세요.'}
            </p>
        </div>
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
