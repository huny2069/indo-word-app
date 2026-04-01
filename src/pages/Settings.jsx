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
  const [ttsEngine, setTtsEngine] = useState('gemini'); // [추가] 음성 엔진 선택 상태 (gemini, google, browser)
  const defaultGoogleModel = isIndoMode ? 'ko-KR-Neural2-A' : 'id-ID-Chirp3-HD-Achernar'; // 여성 고음질 기본
  const [googleTtsModel, setGoogleTtsModel] = useState(localStorage.getItem('google_tts_model') || defaultGoogleModel);
  const [googleVoiceList, setGoogleVoiceList] = useState(JSON.parse(localStorage.getItem('google_voice_list') || '[]'));
  const [gcpAccessToken, setGcpAccessToken] = useState(localStorage.getItem('gcp_access_token') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('user_email') || '');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isJsonImporting, setIsJsonImporting] = useState(false);

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
              const email = userInfo.email.toLowerCase().trim();
              localStorage.setItem('user_email', email);
              if (setUserEmail) setUserEmail(email); // context 함수가 있다면 호출
              console.log("Logged in as:", email);
            }
          } catch (userInfoErr) {
            console.warn("Failed to fetch user info:", userInfoErr);
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

  // [수정] 프리미엄 음성 테스트 함수
  const handleTestTts = async () => {
    if (!gcpAccessToken) {
      alert("먼저 구글 로그인을 완료해주세요.");
      handleGoogleLogin();
      return;
    }
    try {
      const testText = isIndoMode ? "안녕하세요, 나나입니다. 반갑습니다." : "Halo, saya Nana. Senang bertemu dengan Anda.";
      const isKorean = !isIndoMode; 
      const langCode = isKorean ? 'ko-KR' : 'id-ID';
      
      const endpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gcpAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { text: testText },
          voice: { languageCode: langCode, name: googleTtsModel },
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
      alert(`❌ 테스트 실패: ${err.message}`);
    }
  };

  const handleFetchGoogleVoicesList = async () => {
    if (!gcpAccessToken) {
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
        setIsVoiceModalOpen(true);
    } catch (err) {
        alert("음성 목록을 가져오지 못했습니다.");
    } finally {
        setLoadingVoices(false);
    }
  };

  // [추가] Google Cloud TTS 가용 음성 목록 가져오기
  const handleFetchGoogleVoices = async () => {
    if (!gcpAccessToken) {
      alert("먼저 구글 로그인을 완료해주세요.");
      handleGoogleLogin();
      return;
    }
    setLoadingVoices(true);
    try {
      // v1beta1 엔드포인트 사용 (성능 및 호환성 강화)
      const response = await fetch('https://texttospeech.googleapis.com/v1beta1/voices', {
        headers: { 'Authorization': `Bearer ${gcpAccessToken}` }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('gcp_access_token');
            setGcpAccessToken('');
        }
        throw new Error("음성 목록을 가져오지 못했습니다. 다시 로그인해 주세요.");
      }
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
    <div className="page" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '5rem' }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '2rem', textAlign: 'center' }}>{t('set_title')}</h2>
      
      {/* --- 섹션 1: AI 음성 및 학습 엔진 --- */}
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
                    style={{ padding: '1rem', borderRadius: '14px', border: ttsEngine === 'google' ? '2px solid #4285f4' : '1px solid #eee', background: ttsEngine === 'google' ? '#e8f0fe' : '#fff', color: ttsEngine === 'google' ? '#1967d2' : '#666', fontWeight: 'bold', transition: 'all 0.3s' }}>
                    Google Cloud<br/><small style={{fontWeight: 'normal'}}>Premium</small>
                </button>
                <button onClick={() => { setTtsEngine('gemini'); localStorage.setItem('tts_engine', 'gemini'); }}
                    style={{ padding: '1rem', borderRadius: '14px', border: ttsEngine === 'gemini' ? '2px solid #8e44ad' : '1px solid #eee', background: ttsEngine === 'gemini' ? '#f3e5f5' : '#fff', color: ttsEngine === 'gemini' ? '#6a1b9a' : '#666', fontWeight: 'bold', transition: 'all 0.3s' }}>
                    Gemini AI<br/><small style={{fontWeight: 'normal'}}>Deep Learning</small>
                </button>
                <button onClick={() => { setTtsEngine('browser'); localStorage.setItem('tts_engine', 'browser'); }}
                    style={{ padding: '1rem', borderRadius: '14px', border: ttsEngine === 'browser' ? '2px solid #2d3436' : '1px solid #eee', background: ttsEngine === 'browser' ? '#f5f5f5' : '#fff', color: ttsEngine === 'browser' ? '#2d3436' : '#666', fontWeight: 'bold', transition: 'all 0.3s' }}>
                    Browser Default<br/><small style={{fontWeight: 'normal'}}>Offline</small>
                </button>
            </div>

            {ttsEngine === 'google' && (
                <div style={{ background: '#fff', padding: '1.2rem', borderRadius: '16px', border: '1px solid #eee', animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: 'bold', color: '#1a1a1a' }}>선택된 음성 모델</span>
                        <button onClick={handleFetchGoogleVoicesList} disabled={loadingVoices}
                            style={{ background: '#4285f4', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}>
                            {loadingVoices ? '로딩 중...' : '음성 리스트 갱신'}
                        </button>
                    </div>
                    <div style={{ background: '#f0f4f8', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: '600', color: '#2d3748', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{googleTtsModel || '선택된 모델 없음'}</span>
                        <button onClick={handleTestTts} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>🔉</button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* --- 섹션 2: Gemini API 및 AI 모델 설정 --- */}
      <div className="settings-card" style={{ background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span> {t('set_api_title')}
        </h3>
        <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: '600' }}>{t('set_gemini_key_label')}</label>
            <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIza..." 
                style={{ width: '100%', padding: '1rem', border: '1px solid #eee', borderRadius: '12px', background: '#fafafa', fontSize: '1rem' }} />
        </div>
        <div style={{ background: '#fcfcfc', padding: '1.2rem', borderRadius: '16px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: '600' }}>Gemini 모델 선택</span>
                <button onClick={handleFetchModels} disabled={loadingModels}
                    style={{ background: '#fff', border: '1px solid #8e44ad', color: '#8e44ad', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700' }}>
                    {loadingModels ? '조회 중...' : '목록 갱신'}
                </button>
            </div>
            <select value={selectedGeminiModel} onChange={e => setSelectedGeminiModel(e.target.value)}
                style={{ width: '100%', padding: '1rem', border: '1px solid #eee', borderRadius: '12px', background: '#fff' }}>
                {modelList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        </div>
        <button onClick={saveApiKeys} style={{ marginTop: '1.5rem', width: '100%', padding: '1.1rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '800', cursor: 'pointer' }}>
            설정 저장하기
        </button>
      </div>

      {/* --- 섹션 3: 데이터 관리 및 클라우드 백업 --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="settings-card" style={{ background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.2rem' }}>📁 파일 백업/복원</h3>
            <button onClick={handleExportCSV} style={{ width: '100%', padding: '1rem', background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', borderRadius: '12px', marginBottom: '1rem', fontWeight: '700' }}>
                CSV로 내보내기
            </button>
            <button onClick={() => document.getElementById('csvImport').click()} style={{ width: '100%', padding: '1rem', background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '1rem', fontWeight: '700' }}>
                CSV 불러오기
            </button>
            <input type="file" id="csvImport" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            <button onClick={() => setIsJsonModalOpen(true)} style={{ width: '100%', padding: '1rem', background: '#fffbeb', color: '#92400e', border: '1px solid #fef3c7', borderRadius: '12px', fontWeight: '700' }}>
                AI 생성 데이터(JSON) 붙여넣기
            </button>
        </div>

        <div className="settings-card" style={{ background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '2px solid #e8f0fe' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" style={{width: '20px'}} alt="Gdrive"/> 구글 드라이브 클라우드
            </h3>
            {gcpAccessToken ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#4285f4', background: '#e8f0fe', padding: '0.8rem', borderRadius: '10px', wordBreak: 'break-all' }}>
                        연동됨: <strong>{userEmail}</strong>
                    </div>
                    <button onClick={handleBackupToDrive} disabled={isDriveOperating} style={{ width: '100%', padding: '1rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', opacity: isDriveOperating ? 0.7 : 1 }}>
                        {isDriveOperating ? '백업 중...' : '클라우드에 지금 백업'}
                    </button>
                    <button onClick={handleRestoreFromDrive} disabled={isDriveOperating} style={{ width: '100%', padding: '1rem', background: '#34a853', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', opacity: isDriveOperating ? 0.7 : 1 }}>
                        {isDriveOperating ? '복원 중...' : '클라우드에서 데이터 복원'}
                    </button>
                </div>
            ) : (
                <button onClick={handleGoogleLogin} style={{ width: '100%', padding: '1.2rem', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
                    <img src="https://www.google.com/favicon.ico" style={{width: '18px', filter: 'brightness(2)'}} alt="G"/> 구글 계정으로 시작하기
                </button>
            )}
        </div>
      </div>

      {/* --- 섹션 4: 관리자 진단 도구 --- */}
      <div className="settings-card" style={{ background: '#fff5f5', padding: '1.5rem', borderRadius: '20px', border: '1px solid #feb2b2' }}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#c53030' }}>🛠️ 관리자 진단 및 오동작 해결 도구</h4>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={handleTestTts} style={{ flex: 1, padding: '0.8rem', background: '#fff', border: '2px solid #feb2b2', borderRadius: '10px', fontWeight: 'bold', color: '#c53030' }}>
                프리미엄 음성 테스트
            </button>
            <button onClick={() => { localStorage.removeItem('user_email'); localStorage.removeItem('gcp_access_token'); window.location.reload(); }}
                style={{ flex: 1, padding: '0.8rem', background: '#fff', border: '1px solid #718096', borderRadius: '10px', fontWeight: 'bold', color: '#718096' }}>
                로그인 세션 초기화
            </button>
        </div>
      </div>

      {/* --- 모달들 --- */}
      {isVoiceModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', width: '90%', maxWidth: '500px', height: '80vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>프리미엄 음성 선택</h3>
                    <button onClick={() => setIsVoiceModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {googleVoiceList.map(v => (
                        <div key={v.name} 
                            onClick={() => {
                                setGoogleTtsModel(v.name);
                                localStorage.setItem('google_tts_model', v.name);
                                setIsVoiceModalOpen(false);
                            }}
                            style={{ 
                                padding: '1.2rem', borderRadius: '16px', border: '1px solid #eee', marginBottom: '0.8rem', cursor: 'pointer', transition: 'all 0.2s',
                                background: googleTtsModel === v.name ? '#f0f7ff' : '#fff',
                                borderColor: googleTtsModel === v.name ? '#4285f4' : '#eee'
                            }}>
                            <div style={{ fontWeight: '700', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{v.name.includes('Chirp') ? '✨ ' : ''}{v.name}</span>
                                <span style={{ fontSize: '0.75rem', color: '#4285f4', background: '#e8f0fe', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                    {v.ssmlGender === 'FEMALE' ? '여성' : '남성'}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                                {v.languageCodes.join(', ')} | {v.name.split('-')[2]}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

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
