import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  RefreshCw,
  Download,
  Trash2,
  Users,
  Activity,
  Globe,
  Clock,
  Search,
  Server,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  FileSpreadsheet,
  FileJson,
  Upload,
  KeyRound,
  LogIn,
  Coins,
  Filter,
  X,
  HardDrive,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_ADMIN_KEY,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  isAdminUser
} from '../config/logConfig';
import {
  ACTION_META,
  clearLocalActivityLogs,
  exportLogsToCSV,
  exportLogsToJSON,
  fetchUnifiedLogs,
  flushPendingLogs,
  getConfiguredLogSettings,
  getGeoIpInfo,
  getPendingLogsCount,
  importActivityLogsToLocal,
  saveConfiguredLogSettings,
  testGoogleScriptConnection,
  testPcServerConnection
} from '../utils/activityLogger';
import {
  ACTIVITY_LOGS_BACKUP_FILE,
  downloadBackupFromDrive,
  searchBackupFile,
  uploadBackupToDrive
} from '../api/driveApi';

const AdminStats = () => {
  const { user } = useAuth();
  const authorized = isAdminUser(user);

  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'users' | 'server' | 'backup'
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [myGeo, setMyGeo] = useState(null);

  const [sourcesStatus, setSourcesStatus] = useState({
    pcServer: { connected: false, url: '', total: 0, diskPath: '', tunnelUrl: '' },
    googleSheets: { connected: false, url: '', total: 0 },
    supabase: { connected: false, total: 0 },
    localBrowser: { total: 0, pending: 0 }
  });
  const [discoveredInfo, setDiscoveredInfo] = useState({
    discoveredPcUrl: '',
    discoveredGoogleUrl: '',
    updatedAt: ''
  });

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL'); // 'ALL' | 'TODAY' | '7D' | '30D'
  const [selectedUserFilter, setSelectedUserFilter] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(150);

  // 서버 설정 입력 상태
  const initialCfg = useMemo(() => getConfiguredLogSettings(), []);
  const [pcServerUrlInput, setPcServerUrlInput] = useState(initialCfg.pcServerUrl || '');
  const [googleScriptUrlInput, setGoogleScriptUrlInput] = useState(initialCfg.googleScriptUrl || '');
  const [adminKeyInput, setAdminKeyInput] = useState(initialCfg.adminKey || DEFAULT_ADMIN_KEY);
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState(false);
  const [serverTestMsg, setServerTestMsg] = useState('');
  const [isDriveBusy, setIsDriveBusy] = useState(false);

  const loadAllLogs = useCallback(async (forceDiscovery = false, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [unified, geo] = await Promise.all([
        fetchUnifiedLogs(forceDiscovery),
        getGeoIpInfo()
      ]);
      setLogs(unified.logs || []);
      setSourcesStatus(unified.sourcesStatus);
      setDiscoveredInfo(unified.discovered || {});
      setMyGeo(geo);
    } catch (err) {
      console.error('[중앙 통계] 데이터 조회 오류:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadAllLogs(true, false);
  }, [authorized, loadAllLogs]);

  // 실시간 자동 새로고침 (10초 주기 + 현재 브라우저 신규 이벤트 즉시 반영)
  useEffect(() => {
    if (!authorized) return;
    const onNewLocalLog = () => loadAllLogs(false, true);
    window.addEventListener('inko_activity_logged', onNewLocalLog);

    let timer = null;
    if (autoRefresh) {
      timer = setInterval(() => {
        loadAllLogs(false, true);
      }, 10000);
    }
    return () => {
      window.removeEventListener('inko_activity_logged', onNewLocalLog);
      if (timer) clearInterval(timer);
    };
  }, [authorized, autoRefresh, loadAllLogs]);

  // 전체 KPI 및 국가별 / 사용자별 통계 집계
  const analytics = useMemo(() => {
    const userMap = new Map();
    const countryMap = new Map();
    const uniqueIps = new Set();
    let loginCount = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    for (const l of logs) {
      if (l.ip && l.ip !== 'unknown') uniqueIps.add(l.ip);
      if (l.action_type === 'LOGIN') loginCount++;
      totalTokens += Number(l.tokens_used || 0);
      totalCostUsd += Number(l.cost_usd || 0);

      // 국가 집계
      const cName = l.country || '미확인';
      if (!countryMap.has(cName)) {
        countryMap.set(cName, {
          country: cName,
          countryCode: l.country_code || '',
          flag: l.flag || '🌐',
          count: 0,
          logins: 0,
          ips: new Set(),
          users: new Set(),
          lastTime: l.kst_time || l.created_at
        });
      }
      const cStat = countryMap.get(cName);
      cStat.count++;
      if (l.action_type === 'LOGIN') cStat.logins++;
      if (l.ip && l.ip !== 'unknown') cStat.ips.add(l.ip);
      cStat.users.add(l.email || l.user_id || l.ip);

      // 사용자 집계
      const uKey = l.email || l.user_id || l.ip || 'anonymous';
      if (!userMap.has(uKey)) {
        userMap.set(uKey, {
          key: uKey,
          email: l.email || '',
          userName: l.user_name || '',
          userId: l.user_id || '',
          flag: l.flag || '🌐',
          country: l.country || '미확인',
          city: l.city || '',
          isp: l.isp || '',
          lastIp: l.ip || 'unknown',
          ips: new Set(),
          lastSeen: l.kst_time || l.created_at,
          lastLogin: l.action_type === 'LOGIN' ? (l.kst_time || l.created_at) : '',
          loginCount: 0,
          totalActions: 0,
          tokens: 0,
          costUsd: 0,
          device: l.device || '',
          actionBreakdown: {}
        });
      }
      const uStat = userMap.get(uKey);
      uStat.totalActions++;
      if (l.action_type === 'LOGIN') {
        uStat.loginCount++;
        if (!uStat.lastLogin) uStat.lastLogin = l.kst_time || l.created_at;
      }
      if (!uStat.email && l.email) uStat.email = l.email;
      if (!uStat.userName && l.user_name) uStat.userName = l.user_name;
      if ((uStat.country === '미확인' || !uStat.country) && l.country && l.country !== '미확인') {
        uStat.country = l.country;
        uStat.flag = l.flag || uStat.flag;
      }
      if (!uStat.city && l.city) uStat.city = l.city;
      if (l.ip && l.ip !== 'unknown') {
        if (uStat.lastIp === 'unknown') uStat.lastIp = l.ip;
        uStat.ips.add(l.ip);
      }
      uStat.tokens += Number(l.tokens_used || 0);
      uStat.costUsd += Number(l.cost_usd || 0);

      const actLabel = l.action_label || l.action_type || '활동';
      uStat.actionBreakdown[actLabel] = (uStat.actionBreakdown[actLabel] || 0) + 1;
    }

    const countryList = Array.from(countryMap.values()).sort((a, b) => b.count - a.count);
    const userList = Array.from(userMap.values());

    return {
      totalLogs: logs.length,
      uniqueUsers: userList.length,
      uniqueIps: uniqueIps.size,
      uniqueCountries: countryList.filter((c) => c.country !== '미확인').length || countryList.length,
      loginCount,
      totalTokens,
      totalCostUsd,
      countryList,
      userList
    };
  }, [logs]);

  // 필터링된 상세 타임라인 로그
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const q = searchQuery.toLowerCase().trim();

    return logs.filter((l) => {
      if (selectedUserFilter) {
        const uKey = l.email || l.user_id || l.ip || 'anonymous';
        if (uKey !== selectedUserFilter && l.ip !== selectedUserFilter) return false;
      }

      if (countryFilter !== 'ALL' && l.country !== countryFilter) return false;

      if (categoryFilter !== 'ALL') {
        const cat = ACTION_META[l.action_type]?.category || 'other';
        if (cat !== categoryFilter) return false;
      }

      if (dateRangeFilter !== 'ALL' && l.created_at) {
        const diffMs = now - new Date(l.created_at).getTime();
        if (dateRangeFilter === 'TODAY' && diffMs > 24 * 60 * 60 * 1000) return false;
        if (dateRangeFilter === '7D' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateRangeFilter === '30D' && diffMs > 30 * 24 * 60 * 60 * 1000) return false;
      }

      if (q) {
        const hay = [
          l.email,
          l.user_name,
          l.user_id,
          l.ip,
          l.country,
          l.city,
          l.isp,
          l.action_label,
          l.action_type,
          l.detail,
          l.topic,
          l.device
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [logs, selectedUserFilter, countryFilter, categoryFilter, dateRangeFilter, searchQuery]);

  // 서버 연결 설정 저장 & 테스트
  const handleSaveServerSettings = async () => {
    saveConfiguredLogSettings({
      pcServerUrl: pcServerUrlInput,
      googleScriptUrl: googleScriptUrlInput,
      adminKey: adminKeyInput
    });

    // 로컬 PC 서버가 연결되어 있으면 PC 서버의 config.json에도 구글 시트 URL 및 Admin Key 자동 반영
    const activePc = pcServerUrlInput.trim() || sourcesStatus.pcServer.url;
    if (activePc) {
      try {
        await fetch(`${activePc.replace(/\/+$/, '')}/api/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': adminKeyInput.trim() || DEFAULT_ADMIN_KEY
          },
          body: JSON.stringify({
            googleScriptUrl: googleScriptUrlInput.trim(),
            adminKey: adminKeyInput.trim() || DEFAULT_ADMIN_KEY,
            publishToGitHub: true
          })
        });
      } catch {
        // ignore
      }
    }

    setServerTestMsg('✅ 서버 연결 설정이 저장되었습니다. 데이터를 다시 불러옵니다...');
    await loadAllLogs(true, false);
  };

  const handleTestPc = async () => {
    const target = pcServerUrlInput.trim() || discoveredInfo.discoveredPcUrl || 'http://localhost:4000';
    setServerTestMsg(`🔌 PC 서버(${target}) 연결 확인 중...`);
    const res = await testPcServerConnection(target, adminKeyInput);
    if (res.ok) {
      setServerTestMsg(`🟢 PC 로그 서버 연결 성공! (현재 저장된 로그: ${(res.totalLogs || 0).toLocaleString()}건 · 백업 경로: ${res.diskPath || 'pc-log-server/logs'})`);
    } else {
      setServerTestMsg(`🔴 PC 서버 연결 실패: ${res.error}`);
    }
  };

  const handleTestGoogle = async () => {
    setServerTestMsg('🔌 Google 스프레드시트 웹훅 서버 연결 확인 중...');
    const res = await testGoogleScriptConnection(googleScriptUrlInput, adminKeyInput);
    if (res.ok) {
      setServerTestMsg(`🟢 Google 스프레드시트 24시간 로그 서버 연결 성공! (누적 시트 로그: ${(res.total || 0).toLocaleString()}건)`);
    } else {
      setServerTestMsg(`🔴 Google 스프레드시트 연결 실패: ${res.error}`);
    }
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    alert('📋 Google 스프레드시트 무료 24시간 로그 서버 코드가 클립보드에 복사되었습니다!\n\n새 구글 스프레드시트(sheets.new) -> [확장 프로그램] -> [Apps Script]에 붙여넣고 [웹 앱]으로 배포해 주세요.');
  };

  // JSON 파일 가져오기(복원)
  const handleImportJsonFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const arr = Array.isArray(parsed) ? parsed : (parsed.logs || []);
        if (!Array.isArray(arr) || arr.length === 0) {
          alert('유효한 활동 로그 데이터가 없습니다.');
          return;
        }
        const added = importActivityLogsToLocal(arr);
        // PC 서버가 연결되어 있으면 PC 서버 디스크에도 함께 백업 전송
        if (sourcesStatus.pcServer.connected && sourcesStatus.pcServer.url) {
          try {
            await fetch(`${sourcesStatus.pcServer.url}/api/logs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ logs: arr.slice(0, 300) })
            });
          } catch {
            // ignore
          }
        }
        await loadAllLogs(false, false);
        alert(`🎉 JSON 백업 파일 복원 완료! (분석된 로그 ${arr.length.toLocaleString()}건 중 신규 ${added.toLocaleString()}건 병합 완료)`);
      } catch (err) {
        alert('JSON 파일 파싱 오류: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // 구글 드라이브 클라우드 백업 & 복원
  const handleDriveBackupLogs = async () => {
    const token = localStorage.getItem('gcp_access_token');
    if (!token) {
      alert('구글 드라이브 백업을 위해 [설정] 탭에서 구글 클라우드 연동 로그인을 먼저 진행해주세요.');
      return;
    }
    if (logs.length === 0) {
      alert('백업할 로그 데이터가 없습니다.');
      return;
    }
    setIsDriveBusy(true);
    try {
      await uploadBackupToDrive(
        token,
        {
          type: 'inko_activity_logs_backup',
          exportedAt: new Date().toISOString(),
          total: logs.length,
          logs
        },
        ACTIVITY_LOGS_BACKUP_FILE
      );
      alert(`☁️ 구글 드라이브에 전체 활동 로그 ${logs.length.toLocaleString()}건이 안전하게 백업되었습니다!\n(파일명: ${ACTIVITY_LOGS_BACKUP_FILE})`);
    } catch (err) {
      alert('구글 드라이브 백업 실패: ' + err.message);
    } finally {
      setIsDriveBusy(false);
    }
  };

  const handleDriveRestoreLogs = async () => {
    const token = localStorage.getItem('gcp_access_token');
    if (!token) {
      alert('구글 드라이브 복원을 위해 [설정] 탭에서 구글 클라우드 연동 로그인을 먼저 진행해주세요.');
      return;
    }
    setIsDriveBusy(true);
    try {
      const found = await searchBackupFile(token, ACTIVITY_LOGS_BACKUP_FILE);
      if (!found) {
        alert(`구글 드라이브에서 활동 로그 백업 파일(${ACTIVITY_LOGS_BACKUP_FILE})을 찾을 수 없습니다.`);
        return;
      }
      const data = await downloadBackupFromDrive(token, found.id);
      const arr = Array.isArray(data?.logs) ? data.logs : [];
      const added = importActivityLogsToLocal(arr);
      await loadAllLogs(false, false);
      alert(`☁️ 구글 드라이브 복원 완료! (총 ${arr.length.toLocaleString()}건 중 신규 ${added.toLocaleString()}건 병합)`);
    } catch (err) {
      alert('구글 드라이브 복원 실패: ' + err.message);
    } finally {
      setIsDriveBusy(false);
    }
  };

  // 안전한 아카이브 후 로그 초기화
  const handleSafeArchiveClear = async () => {
    if (!window.confirm('현재 화면의 활동 로그 목록을 비우시겠습니까?\n\n※ 내 PC 로그 서버에 연결된 경우 기존 로그는 삭제되지 않고 pc-log-server/logs/archive 폴더에 안전하게 보관됩니다.')) {
      return;
    }
    try {
      if (sourcesStatus.pcServer.connected && sourcesStatus.pcServer.url) {
        const adminKey = getConfiguredLogSettings().adminKey;
        const res = await fetch(`${sourcesStatus.pcServer.url}/api/archive-clear`, {
          method: 'POST',
          headers: { 'X-Admin-Key': adminKey }
        });
        const data = await res.json().catch(() => ({}));
        if (data.message) alert(data.message);
      }
      clearLocalActivityLogs();
      await loadAllLogs(false, false);
    } catch (err) {
      alert('초기화 중 오류: ' + err.message);
    }
  };

  // 관리자 미인증 화면 (오직 등록된 구글 계정으로 로그인해야만 접근 허용)
  if (!authorized) {
    return (
      <div style={{ padding: '4rem 1.5rem', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', maxWidth: '480px', width: '100%', padding: '2.8rem 2.2rem', borderRadius: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', textAlign: 'center' }}>
          <div style={{ background: '#fff1f2', width: '76px', height: '76px', borderRadius: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <ShieldAlert size={38} color="#e11d48" />
          </div>
          <h2 style={{ color: '#0f172a', fontSize: '1.6rem', fontWeight: '900', margin: '0 0 0.7rem' }}>🔒 접근 권한 없음 (관리자 전용)</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.65', marginBottom: '1.8rem' }}>
            중앙 통계는 등록된 <b>관리자 구글 계정</b>으로 로그인한 사용자만 볼 수 있습니다.<br />
            현재 계정: <b style={{ color: '#e11d48' }}>{user?.email || '미로그인'}</b>
          </p>
          <button
            onClick={() => window.location.href = '/settings'}
            style={{ width: '100%', padding: '1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer' }}
          >
            설정에서 관리자 계정으로 로그인하기
          </button>
        </div>
      </div>
    );
  }

  const pendingCount = getPendingLogsCount();

  return (
    <div style={{ padding: '1.2rem', maxWidth: '1440px', margin: '0 auto', paddingBottom: '6rem' }}>
      {/* 상단 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#fff',
        padding: '1.8rem 2rem',
        borderRadius: '28px',
        marginBottom: '1.5rem',
        boxShadow: '0 15px 40px rgba(15, 23, 42, 0.18)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ background: 'rgba(254, 202, 87, 0.18)', color: '#feca57', padding: '5px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '900', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} /> 100% 무료 통합 보안 · 활동 로그 센터
            </span>
            <span style={{
              background: sourcesStatus.pcServer.connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
              color: sourcesStatus.pcServer.connected ? '#34d399' : '#cbd5e1',
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: '800'
            }}>
              {sourcesStatus.pcServer.connected ? '🟢 내 PC 로그 서버 실시간 연결됨' : '⚪ 내 PC 서버 대기중'}
            </span>
            {sourcesStatus.googleSheets.connected && (
              <span style={{ background: 'rgba(59, 130, 246, 0.22)', color: '#93c5fd', padding: '5px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '800' }}>
                🟢 구글 시트 24시간 서버 연결됨
              </span>
            )}
          </div>
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.75rem', fontWeight: '900', letterSpacing: '-0.5px' }}>
            중앙 통계 및 접속 IP · 국가 · 사용자 활동 로그
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>
            누가 어느 국가·IP에서 몇 시에 로그인했고 어떤 학습·생성·번역 활동을 했는지 실시간 기록하고 백업합니다.
            {myGeo?.ip && myGeo.ip !== 'unknown' && (
              <span style={{ marginLeft: '8px', color: '#e2e8f0', fontWeight: '700' }}>
                (현재 내 접속: {myGeo.flag} {myGeo.country} {myGeo.city ? `· ${myGeo.city}` : ''} · {myGeo.ip})
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '0.6rem 0.95rem', borderRadius: '14px', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ accentColor: '#10b981' }}
            />
            10초 자동갱신
          </label>
          <button
            onClick={() => exportLogsToCSV(filteredLogs.length > 0 ? filteredLogs : logs)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.68rem 1.05rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <Download size={16} /> 엑셀(CSV) 백업
          </button>
          <button
            onClick={() => loadAllLogs(true, false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.68rem 1.1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> 새로고침
          </button>
        </div>
      </div>

      {/* 상단 핵심 요약 카드 4개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard
          icon={<Activity size={22} color="#2563eb" />}
          bg="#eff6ff"
          title="총 기록된 활동 로그"
          value={`${analytics.totalLogs.toLocaleString()}건`}
          sub={pendingCount > 0 ? `미전송 대기열 ${pendingCount}건 보관중` : '모든 활동 실시간 기록 중'}
        />
        <KpiCard
          icon={<Users size={22} color="#059669" />}
          bg="#ecfdf5"
          title="고유 사용자 / 총 로그인"
          value={`${analytics.uniqueUsers.toLocaleString()}명`}
          sub={`누적 로그인 성공 ${analytics.loginCount.toLocaleString()}회`}
        />
        <KpiCard
          icon={<Globe size={22} color="#d97706" />}
          bg="#fffbeb"
          title="접속 국가 / 고유 IP"
          value={`${analytics.uniqueCountries.toLocaleString()}개국`}
          sub={`고유 접속 IP ${analytics.uniqueIps.toLocaleString()}개`}
        />
        <KpiCard
          icon={<Coins size={22} color="#7c3aed" />}
          bg="#f5f3ff"
          title="누적 AI 토큰 / 비용"
          value={`${analytics.totalTokens.toLocaleString()} T`}
          sub={`$${analytics.totalCostUsd.toFixed(4)} (약 ₩${Math.round(analytics.totalCostUsd * 1380).toLocaleString()})`}
        />
      </div>

      {/* 메인 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.3rem', flexWrap: 'wrap', background: '#f1f5f9', padding: '0.4rem', borderRadius: '18px' }}>
        {[
          { id: 'timeline', label: `📋 실시간 전체 활동 로그 (${filteredLogs.length.toLocaleString()})` },
          { id: 'users', label: `👥 사용자 · 국가 · IP별 분석 (${analytics.uniqueUsers})` },
          { id: 'server', label: `🖥️ 내 PC 서버 & 무료 24시간 서버 설정` },
          { id: 'backup', label: `💾 로그 백업 & 복원 센터` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '1 1 auto',
              padding: '0.78rem 1.1rem',
              border: 'none',
              borderRadius: '14px',
              fontWeight: '900',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#0f172a' : '#64748b',
              boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* 탭 1: 전체 활동 타임라인 테이블                                      */}
      {/* ================================================================= */}
      {activeTab === 'timeline' && (
        <div style={{ background: '#fff', borderRadius: '26px', padding: '1.5rem', boxShadow: '0 10px 35px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
          {/* 검색 & 필터 바 */}
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '1.2rem', alignItems: 'center' }}>
            <div style={{ flex: '1 1 260px', position: 'relative' }}>
              <Search size={17} color="#94a3b8" style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이메일, 이름, IP 주소, 국가, 도시, 생성 주제, 활동 내용 검색..."
                style={{ width: '100%', padding: '0.75rem 0.9rem 0.75rem 2.4rem', borderRadius: '14px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: '600', outline: 'none' }}
              />
            </div>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              style={{ padding: '0.75rem 0.9rem', borderRadius: '14px', border: '1.5px solid #cbd5e1', fontSize: '0.86rem', fontWeight: '800', background: '#fff', cursor: 'pointer' }}
            >
              <option value="ALL">🌍 전체 국가 ({analytics.countryList.length})</option>
              {analytics.countryList.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.flag} {c.country} ({c.count})
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '0.75rem 0.9rem', borderRadius: '14px', border: '1.5px solid #cbd5e1', fontSize: '0.86rem', fontWeight: '800', background: '#fff', cursor: 'pointer' }}
            >
              <option value="ALL">⚡ 전체 행동 유형</option>
              <option value="auth">🔐 로그인 / 접속</option>
              <option value="ai">🤖 AI 단어생성 / 번역 / 특강</option>
              <option value="word">📚 단어장 / 사전 추가·삭제</option>
              <option value="study">🎓 플래시카드 / 퀴즈 / 스펠링</option>
              <option value="nav">🧭 메뉴 이동</option>
              <option value="system">⚙️ 언어 변경 / 백업</option>
            </select>

            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              style={{ padding: '0.75rem 0.9rem', borderRadius: '14px', border: '1.5px solid #cbd5e1', fontSize: '0.86rem', fontWeight: '800', background: '#fff', cursor: 'pointer' }}
            >
              <option value="ALL">📅 전체 기간</option>
              <option value="TODAY">오늘 (24시간)</option>
              <option value="7D">최근 7일</option>
              <option value="30D">최근 30일</option>
            </select>

            {(searchQuery || countryFilter !== 'ALL' || categoryFilter !== 'ALL' || dateRangeFilter !== 'ALL' || selectedUserFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCountryFilter('ALL');
                  setCategoryFilter('ALL');
                  setDateRangeFilter('ALL');
                  setSelectedUserFilter('');
                }}
                style={{ padding: '0.72rem 0.95rem', borderRadius: '14px', border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: '800', fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={15} /> 필터 초기화
              </button>
            )}
          </div>

          {selectedUserFilter && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '14px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#1e40af' }}>
                🔍 선택된 대상 집중 조회 중: <b>{selectedUserFilter}</b> (총 {filteredLogs.length.toLocaleString()}건의 시간순 행동)
              </span>
              <button
                onClick={() => setSelectedUserFilter('')}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
              >
                전체 사용자 보기
              </button>
            </div>
          )}

          {/* 활동 로그 테이블 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc', color: '#475569' }}>
                  <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900', whiteSpace: 'nowrap' }}>일시 (한국시간 KST)</th>
                  <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>사용자 (이메일 / 이름)</th>
                  <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>접속 국가 · 도시</th>
                  <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>접속 IP</th>
                  <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>행동 구분</th>
                  <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>상세 활동 내역</th>
                  <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>접속 환경</th>
                  <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>출처</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, visibleLimit).map((log) => {
                  const meta = ACTION_META[log.action_type] || { label: log.action_label || log.action_type, color: '#334155', bg: '#f1f5f9' };
                  const userTargetKey = log.email || log.user_id || log.ip;
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 0.8rem', whiteSpace: 'nowrap', color: '#334155', fontWeight: '700', fontSize: '0.84rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={13} color="#64748b" />
                          {log.kst_time || new Date(log.created_at).toLocaleString('ko-KR')}
                        </div>
                      </td>

                      <td style={{ padding: '0.85rem 0.8rem' }}>
                        <button
                          onClick={() => setSelectedUserFilter(userTargetKey)}
                          title="클릭하면 이 사용자의 전체 행동을 모아봅니다"
                          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                        >
                          <div style={{ fontWeight: '800', color: log.email ? '#0f172a' : '#64748b', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}>
                            {log.email || '익명 방문자'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {log.user_name ? `${log.user_name} · ` : ''}{(log.user_id || '').slice(0, 14)}
                          </div>
                        </button>
                      </td>

                      <td style={{ padding: '0.85rem 0.8rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '800', color: '#1e293b' }}>
                          {log.flag || '🌐'} {log.country || '미확인'}
                        </div>
                        {(log.city || log.isp) && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {[log.city, log.isp].filter(Boolean).join(' · ').slice(0, 32)}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 0.8rem', whiteSpace: 'nowrap' }}>
                        <code
                          onClick={() => setSelectedUserFilter(log.ip)}
                          title="클릭하여 이 IP 활동만 필터링"
                          style={{ fontSize: '0.82rem', color: '#2563eb', background: '#eff6ff', padding: '4px 8px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          {log.ip || 'unknown'}
                        </code>
                      </td>

                      <td style={{ padding: '0.85rem 0.8rem', whiteSpace: 'nowrap' }}>
                        <span style={{ background: meta.bg, color: meta.color, padding: '4px 10px', borderRadius: '9px', fontWeight: '900', fontSize: '0.79rem' }}>
                          {log.action_label || meta.label}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 0.8rem', maxWidth: '380px', color: '#334155', fontWeight: '600', lineHeight: '1.45' }}>
                        <div>{log.detail || log.topic || '-'}</div>
                        {(log.tokens_used > 0 || log.cost_usd > 0) && (
                          <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: '800', marginTop: '2px' }}>
                            🪙 {Number(log.tokens_used || 0).toLocaleString()} T · ${Number(log.cost_usd || 0).toFixed(5)}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 0.8rem', whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#64748b', fontWeight: '700' }}>
                        <div>{log.device || '-'}</div>
                        {(log.user_lang || log.study_lang) && (
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            언어: {(log.user_lang || 'ko').toUpperCase()} ➔ {(log.study_lang || 'id').toUpperCase()}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 0.8rem', whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: '800' }}>
                        {log.source?.includes('pc') ? (
                          <span style={{ color: '#059669' }}>🖥️ PC서버</span>
                        ) : log.source?.includes('google') ? (
                          <span style={{ color: '#2563eb' }}>📊 구글시트</span>
                        ) : log.source === 'supabase' ? (
                          <span style={{ color: '#7c3aed' }}>⚡ DB</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>💾 로컬</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontWeight: '700' }}>
                      조건에 해당하는 활동 로그가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredLogs.length > visibleLimit && (
            <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
              <button
                onClick={() => setVisibleLimit((prev) => prev + 200)}
                style={{ padding: '0.75rem 1.8rem', borderRadius: '14px', border: '1.5px solid #cbd5e1', background: '#f8fafc', fontWeight: '800', color: '#334155', cursor: 'pointer' }}
              >
                더 보기 ({visibleLimit.toLocaleString()} / {filteredLogs.length.toLocaleString()}건)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 탭 2: 사용자 · 국가 · IP별 분석                                      */}
      {/* ================================================================= */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 국가별 통계 */}
          <div style={{ background: '#fff', borderRadius: '26px', padding: '1.6rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 1.1rem', fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={20} color="#2563eb" /> 🌍 접속 국가별 로그인 및 활동 분포
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.9rem' }}>
              {analytics.countryList.map((c) => (
                <div
                  key={c.country}
                  onClick={() => {
                    setCountryFilter(c.country);
                    setActiveTab('timeline');
                  }}
                  style={{ padding: '1.1rem 1.2rem', borderRadius: '18px', border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', transition: '0.15s' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#0f172a' }}>
                      {c.flag} {c.country}
                    </span>
                    <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '3px 9px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '900' }}>
                      {c.count.toLocaleString()}건
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: '700', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span>👤 사용자 {c.users.size}명</span>
                    <span>🔐 로그인 {c.logins}회</span>
                    <span>🌐 IP {c.ips.size}개</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '6px' }}>최근 활동: {c.lastTime}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 사용자별 요약 테이블 */}
          <div style={{ background: '#fff', borderRadius: '26px', padding: '1.6rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 1.1rem', fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="#059669" /> 👤 사용자별 접속 IP · 국가 · 로그인 시각 및 행동 요약
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc', color: '#475569' }}>
                    <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>사용자 (이메일 / 기기)</th>
                    <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>국가 · 도시</th>
                    <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>최근 접속 IP</th>
                    <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>최근 로그인 / 활동 시각</th>
                    <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>주요 행동 내역 요약</th>
                    <th style={{ padding: '0.9rem 0.8rem', fontWeight: '900' }}>상세 조회</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.userList.map((u) => (
                    <tr key={u.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.9rem 0.8rem' }}>
                        <div style={{ fontWeight: '900', color: '#0f172a' }}>{u.email || '익명 방문자'}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {u.userName ? `${u.userName} · ` : ''}{u.device}
                        </div>
                      </td>
                      <td style={{ padding: '0.9rem 0.8rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '800' }}>{u.flag} {u.country}</div>
                        {u.city && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.city}</div>}
                      </td>
                      <td style={{ padding: '0.9rem 0.8rem', whiteSpace: 'nowrap' }}>
                        <code style={{ background: '#f0fdf4', color: '#059669', padding: '4px 8px', borderRadius: '8px', fontWeight: '800', fontSize: '0.82rem' }}>
                          {u.lastIp}
                        </code>
                        {u.ips.size > 1 && (
                          <span style={{ marginLeft: '5px', fontSize: '0.73rem', color: '#94a3b8' }}>(외 {u.ips.size - 1}개)</span>
                        )}
                      </td>
                      <td style={{ padding: '0.9rem 0.8rem', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        <div style={{ fontWeight: '800', color: '#1e293b' }}>최근 활동: {u.lastSeen}</div>
                        {u.lastLogin && <div style={{ color: '#059669', fontWeight: '700' }}>최근 로그인: {u.lastLogin}</div>}
                      </td>
                      <td style={{ padding: '0.9rem 0.8rem' }}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {Object.entries(u.actionBreakdown)
                            .slice(0, 5)
                            .map(([act, cnt]) => (
                              <span key={act} style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800' }}>
                                {act} {cnt}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.9rem 0.8rem', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => {
                            setSelectedUserFilter(u.key);
                            setActiveTab('timeline');
                          }}
                          style={{ padding: '0.5rem 0.9rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          🔍 전체 행동 보기 ({u.totalActions})
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 탭 3: 내 PC 무료 서버 & Google 스프레드시트 24시간 서버 설정           */}
      {/* ================================================================= */}
      {activeTab === 'server' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 1. 내 컴퓨터(PC) 실시간 로그 서버 안내 및 설정 */}
          <div style={{ background: '#fff', borderRadius: '26px', padding: '1.8rem', border: '2px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={22} color="#2563eb" /> 1. 내 컴퓨터(PC) 무료 실시간 로그 백업 서버
              </h3>
              <span style={{
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: '900',
                background: sourcesStatus.pcServer.connected ? '#dcfce7' : '#f1f5f9',
                color: sourcesStatus.pcServer.connected ? '#15803d' : '#64748b'
              }}>
                {sourcesStatus.pcServer.connected
                  ? `🟢 연결됨 (${sourcesStatus.pcServer.url} · 총 ${sourcesStatus.pcServer.total.toLocaleString()}건 백업중)`
                  : '⚪ 현재 미연결 (PC 서버 실행 시 자동 연결)'}
              </span>
            </div>

            <div style={{ background: '#eff6ff', padding: '1.1rem 1.3rem', borderRadius: '16px', marginBottom: '1.2rem', fontSize: '0.88rem', lineHeight: '1.65', color: '#1e3a8a', fontWeight: '600' }}>
              <b>💡 유료 서버 비용 0원! 내 컴퓨터를 원클릭으로 로그 서버로 켜는 방법:</b>
              <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.3rem' }}>
                <li>내 컴퓨터의 프로젝트 폴더 안 <code>pc-log-server</code> 폴더로 이동합니다.</li>
                <li><b><code>1_내PC_외부연결_로그서버_시작.bat</code></b> 파일을 더블클릭합니다.</li>
                <li>공유기 포트포워딩 없이 무료 Cloudflare HTTPS 보안 주소가 생성되며, GitHub 채널을 통해 <b><code>indo-word-app.vercel.app</code>에 접속하는 전 세계 모든 사용자의 IP·국가·로그인 시간·활동 내역이 내 PC 하드디스크(<code>pc-log-server\logs</code> 폴더의 JSONL + 날짜별 엑셀 CSV)에 자동 백업</b>됩니다!</li>
              </ol>
              {discoveredInfo.discoveredPcUrl && (
                <div style={{ marginTop: '0.7rem', padding: '0.55rem 0.8rem', background: '#fff', borderRadius: '10px', fontSize: '0.82rem' }}>
                  🌐 현재 자동 감지된 내 PC 글로벌 터널 주소: <code>{discoveredInfo.discoveredPcUrl}</code>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.9rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '5px' }}>
                  내 PC 로그 서버 주소 (비워두면 자동 감지 주소 / localhost:4000 사용)
                </label>
                <input
                  type="text"
                  value={pcServerUrlInput}
                  onChange={(e) => setPcServerUrlInput(e.target.value)}
                  placeholder={discoveredInfo.discoveredPcUrl || '예: http://localhost:4000 또는 https://xxxx.trycloudflare.com'}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: '600' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '5px' }}>
                  관리자 보안 인증 키 (Admin Key - 외부에서 로그 열람 보호)
                </label>
                <input
                  type="text"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  placeholder="기본값: inko-admin-2026"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: '700' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleTestPc}
                style={{ padding: '0.75rem 1.2rem', borderRadius: '12px', border: '1.5px solid #2563eb', background: '#fff', color: '#2563eb', fontWeight: '800', fontSize: '0.86rem', cursor: 'pointer' }}
              >
                🔌 내 PC 서버 연결 테스트
              </button>
              <a
                href="http://localhost:4000"
                target="_blank"
                rel="noreferrer"
                style={{ padding: '0.75rem 1.2rem', borderRadius: '12px', border: '1.5px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: '800', fontSize: '0.86rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={15} /> 내 PC 로컬 서버 모니터 열기 (localhost:4000)
              </a>
            </div>
          </div>

          {/* 2. Google 스프레드시트 24시간 무료 클라우드 백업 서버 */}
          <div style={{ background: '#fff', borderRadius: '26px', padding: '1.8rem', border: '2px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '0.9rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={22} color="#10b981" /> 2. [내 PC가 꺼져 있을 때도 24시간 수집] 무료 Google 스프레드시트 서버
              </h3>
              <span style={{
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: '900',
                background: sourcesStatus.googleSheets.connected ? '#dcfce7' : '#f1f5f9',
                color: sourcesStatus.googleSheets.connected ? '#15803d' : '#64748b'
              }}>
                {sourcesStatus.googleSheets.connected ? `🟢 24시간 수집 가동중 (${sourcesStatus.googleSheets.total}건)` : '⚪ 선택 설정'}
              </span>
            </div>

            <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: '#475569', lineHeight: '1.6', fontWeight: '600' }}>
              내 컴퓨터를 꺼두는 밤/외출 시간에도 로그를 하나도 놓치지 않으려면, 무료 구글 스프레드시트 웹 앱 URL을 함께 등록해 두세요.
              <b> 평소엔 구글 시트에 24시간 실시간 저장되고, 나중에 내 PC 서버를 켜면 자동으로 내 PC 하드디스크(CSV/JSONL)로도 전부 다운로드 백업</b>됩니다!
            </p>

            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '5px' }}>
                Google Apps Script 웹 앱 URL (<code>https://script.google.com/macros/s/.../exec</code>)
              </label>
              <input
                type="text"
                value={googleScriptUrlInput}
                onChange={(e) => setGoogleScriptUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/......./exec"
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: '600' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                onClick={handleCopyAppsScript}
                style={{ padding: '0.75rem 1.2rem', borderRadius: '12px', border: 'none', background: '#059669', color: '#fff', fontWeight: '800', fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Copy size={15} /> 📋 구글 무료 24시간 서버 코드 원클릭 복사
              </button>
              <button
                onClick={() => setShowAppsScriptGuide((prev) => !prev)}
                style={{ padding: '0.75rem 1.2rem', borderRadius: '12px', border: '1.5px solid #10b981', background: '#ecfdf5', color: '#065f46', fontWeight: '800', fontSize: '0.86rem', cursor: 'pointer' }}
              >
                {showAppsScriptGuide ? '▲ 1분 설치 방법 닫기' : '▼ 1분 설치 방법 보기'}
              </button>
              <button
                onClick={handleTestGoogle}
                style={{ padding: '0.75rem 1.2rem', borderRadius: '12px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: '800', fontSize: '0.86rem', cursor: 'pointer' }}
              >
                🔌 구글 시트 연결 테스트
              </button>
            </div>

            {showAppsScriptGuide && (
              <div style={{ background: '#f8fafc', padding: '1.1rem 1.3rem', borderRadius: '16px', border: '1px solid #cbd5e1', fontSize: '0.85rem', lineHeight: '1.7', color: '#334155' }}>
                <b>📌 1분 설치 순서 (평생 100% 무료):</b>
                <ol style={{ margin: '0.4rem 0 0.8rem', paddingLeft: '1.2rem' }}>
                  <li>브라우저 주소창에 <a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: '800' }}>https://sheets.new</a> 를 입력해 새 구글 스프레드시트를 엽니다.</li>
                  <li>상단 메뉴 <b>[확장 프로그램] ➔ [Apps Script]</b>를 클릭합니다.</li>
                  <li>기존 코드를 지우고 위 <b>[구글 무료 24시간 서버 코드 원클릭 복사]</b> 버튼으로 복사한 코드를 붙여넣은 뒤 저장(Ctrl+S)합니다.</li>
                  <li>우측 상단 <b>[배포] ➔ [새 배포]</b> 클릭 ➔ 유형(⚙️)에서 <b>[웹 앱]</b> 선택!</li>
                  <li><b>다음 사용자 인증 정보로 실행: [나]</b>, <b>액세스 권한이 있는 사용자: [모든 사용자]</b>로 선택하고 <b>[배포]</b> 클릭!</li>
                  <li>화면에 나온 <code>https://script.google.com/macros/s/.../exec</code> 주소를 위 입력칸에 붙여넣고 아래 <b>[설정 저장 및 즉시 동기화]</b>를 누르면 끝!</li>
                </ol>
              </div>
            )}
          </div>

          {/* 저장 버튼 & 테스트 메시지 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {serverTestMsg && (
              <div style={{ padding: '0.95rem 1.2rem', borderRadius: '14px', background: '#0f172a', color: '#f8fafc', fontSize: '0.88rem', fontWeight: '700' }}>
                {serverTestMsg}
              </div>
            )}
            <button
              onClick={handleSaveServerSettings}
              style={{ padding: '1.05rem', borderRadius: '18px', border: 'none', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)' }}
            >
              💾 서버 연결 설정 저장 및 전체 로그 즉시 동기화
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 탭 4: 로그 영구 백업 & 복원 센터                                      */}
      {/* ================================================================= */}
      {activeTab === 'backup' && (
        <div style={{ background: '#fff', borderRadius: '26px', padding: '1.8rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 0.6rem', fontSize: '1.2rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={22} color="#2563eb" /> 💾 사용자 접속 · 활동 로그 백업 및 복원 센터
          </h3>
          <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>
            수집된 모든 접속 국가·IP·로그인 시간 및 행동 로그(현재 통합 <b>{logs.length.toLocaleString()}건</b>)를 엑셀(CSV), JSON 파일, 또는 내 구글 드라이브에 언제든 영구 백업하고 복원할 수 있습니다.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* 엑셀 CSV 다운로드 */}
            <div style={{ padding: '1.3rem', borderRadius: '20px', border: '1.5px solid #bbf7d0', background: '#f0fdf4' }}>
              <div style={{ fontWeight: '900', color: '#166534', fontSize: '1rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={19} /> 엑셀(CSV) 전체 백업
              </div>
              <p style={{ fontSize: '0.82rem', color: '#15803d', margin: '0 0 1rem', lineHeight: '1.5' }}>
                한글 깨짐 방지(UTF-8 BOM)가 적용되어 엑셀에서 즉시 열어 필터·정렬·보고서로 활용할 수 있습니다.
              </p>
              <button
                onClick={() => {
                  if (!exportLogsToCSV(logs)) alert('내보낼 로그가 없습니다.');
                }}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: '900', cursor: 'pointer' }}
              >
                📥 전체 로그 엑셀(CSV) 다운로드
              </button>
            </div>

            {/* JSON 백업 및 복원 */}
            <div style={{ padding: '1.3rem', borderRadius: '20px', border: '1.5px solid #bfdbfe', background: '#eff6ff' }}>
              <div style={{ fontWeight: '900', color: '#1e40af', fontSize: '1rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileJson size={19} /> JSON 원본 백업 & 복원
              </div>
              <p style={{ fontSize: '0.82rem', color: '#1d4ed8', margin: '0 0 1rem', lineHeight: '1.5' }}>
                전체 원본 로그 필드를 100% 보존하여 파일로 저장하거나 다른 PC/브라우저에서 다시 불러와 병합합니다.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (!exportLogsToJSON(logs)) alert('내보낼 로그가 없습니다.');
                  }}
                  style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '900', fontSize: '0.83rem', cursor: 'pointer' }}
                >
                  📦 JSON 저장
                </button>
                <label style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1.5px solid #2563eb', background: '#fff', color: '#2563eb', fontWeight: '900', fontSize: '0.83rem', cursor: 'pointer', textAlign: 'center' }}>
                  📂 JSON 복원
                  <input type="file" accept=".json" onChange={handleImportJsonFile} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* 구글 드라이브 클라우드 백업/복원 */}
            <div style={{ padding: '1.3rem', borderRadius: '20px', border: '1.5px solid #ddd6fe', background: '#f5f3ff' }}>
              <div style={{ fontWeight: '900', color: '#5b21b6', fontSize: '1rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cloud size={19} /> 구글 드라이브 클라우드 백업
              </div>
              <p style={{ fontSize: '0.82rem', color: '#6d28d9', margin: '0 0 1rem', lineHeight: '1.5' }}>
                내 구글 드라이브(<code>{ACTIVITY_LOGS_BACKUP_FILE}</code>)에 모든 활동 로그를 백업하고 언제든 복원합니다.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleDriveBackupLogs}
                  disabled={isDriveBusy}
                  style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: '900', fontSize: '0.83rem', cursor: 'pointer' }}
                >
                  ☁️ 드라이브 백업
                </button>
                <button
                  onClick={handleDriveRestoreLogs}
                  disabled={isDriveBusy}
                  style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1.5px solid #7c3aed', background: '#fff', color: '#7c3aed', fontWeight: '900', fontSize: '0.83rem', cursor: 'pointer' }}
                >
                  📥 드라이브 복원
                </button>
              </div>
            </div>
          </div>

          {/* 대기열 강제 동기화 및 안전 아카이브 초기화 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '1.2rem', borderTop: '1px solid #e2e8f0' }}>
            <button
              onClick={async () => {
                const res = await flushPendingLogs();
                await loadAllLogs(false, false);
                alert(`동기화 완료! (전송 완료: ${res.sent || 0}건 / 남은 대기 로그: ${res.remaining || 0}건)`);
              }}
              style={{ padding: '0.75rem 1.2rem', borderRadius: '12px', border: '1.5px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              📤 미전송 대기 로그 즉시 서버로 전송 ({pendingCount}건)
            </button>

            <button
              onClick={handleSafeArchiveClear}
              style={{ padding: '0.75rem 1.2rem', borderRadius: '12px', border: '1px solid #fecdd3', background: '#fff1f2', color: '#e11d48', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={15} /> 아카이브 안전 보관 후 현재 로그 목록 비우기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ icon, bg, title, value, sub }) => (
  <div style={{ background: '#fff', padding: '1.35rem 1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 8px 25px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <div style={{ background: bg, width: '50px', height: '50px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '800', marginBottom: '2px' }}>{title}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>{sub}</div>
    </div>
  </div>
);

export default AdminStats;
