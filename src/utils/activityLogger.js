/**
 * Inko Nana Pro — 통합 접속(IP/국가/도시/시간) 및 전체 사용자 활동 로거 & 백업 엔진
 * - 100% 무료 동작:
 *   1) Vercel 내장 Geo-IP (/api/geo) + ipwho.is + ipapi.co + Cloudflare Trace 4중 폴백
 *   2) 내 컴퓨터(PC) 실시간 로그 서버 (로컬 4000 포트 & Cloudflare HTTPS 터널 자동 발견)
 *   3) Google 스프레드시트 무료 24시간 웹훅 서버 동시 전송 지원
 *   4) 오프라인/서버 미가동 시 브라우저 대기열(Queue) 보관 후 서버 연결 시 자동 일괄 백업 전송
 */

import {
  DEFAULT_ADMIN_KEY,
  DEFAULT_GOOGLE_SCRIPT_URL,
  DEFAULT_PC_SERVER_URL,
  LIVE_ENDPOINT_DISCOVERY_URL
} from '../config/logConfig';
import { supabase } from '../api/supabase';

const LOCAL_LOGS_KEY = 'inko_local_activity_logs';
const PENDING_LOGS_KEY = 'inko_pending_logs';
const GEO_CACHE_KEY = 'inko_geo_cache_v2';
const ENDPOINT_CACHE_KEY = 'inko_discovered_endpoints_v1';

const MAX_LOCAL_LOGS = 1000;
const MAX_PENDING_LOGS = 500;

let geoPromise = null;
let flushTimer = null;
let isFlushing = false;

export const ACTION_META = {
  LOGIN: { label: '로그인', category: 'auth', color: '#059669', bg: '#ecfdf5' },
  LOGOUT: { label: '로그아웃', category: 'auth', color: '#64748b', bg: '#f1f5f9' },
  ONBOARDING: { label: '초기 언어 설정', category: 'auth', color: '#0284c7', bg: '#e0f2fe' },
  SESSION_START: { label: '앱 접속(방문)', category: 'auth', color: '#10b981', bg: '#f0fdf4' },
  PAGE_VIEW: { label: '메뉴 이동', category: 'nav', color: '#6366f1', bg: '#eef2ff' },
  WORD_GENERATE_AI: { label: 'AI 단어 생성', category: 'ai', color: '#7c3aed', bg: '#f5f3ff' },
  WORD_REGENERATE: { label: 'AI 단어 재생성', category: 'ai', color: '#9333ea', bg: '#faf5ff' },
  AI_LECTURE: { label: 'AI 스타강사 특강', category: 'ai', color: '#c026d3', bg: '#fdf4ff' },
  TRANSLATE: { label: 'AI 실시간 번역', category: 'ai', color: '#0d9488', bg: '#f0fdfa' },
  TRANSLATE_SAVE_WORD: { label: '번역 단어 저장', category: 'word', color: '#0f766e', bg: '#ccfbf1' },
  WORD_ADD_OFFLINE: { label: '사전 단어 담기', category: 'word', color: '#d97706', bg: '#fffbeb' },
  WORD_ADD_MANUAL: { label: '수동 단어 추가', category: 'word', color: '#b45309', bg: '#fef3c7' },
  WORD_DELETE: { label: '단어 삭제', category: 'word', color: '#e11d48', bg: '#fff1f2' },
  STUDY_START: { label: '학습 시작', category: 'study', color: '#2563eb', bg: '#eff6ff' },
  STUDY_COMPLETE: { label: '학습 완료', category: 'study', color: '#1d4ed8', bg: '#dbeafe' },
  DATA_BACKUP_RESTORE: { label: '백업 / 복원', category: 'system', color: '#475569', bg: '#f8fafc' },
  LANGUAGE_CHANGE: { label: '언어 변경', category: 'system', color: '#0369a1', bg: '#e0f2fe' }
};

export function countryCodeToFlag(cc) {
  if (!cc || typeof cc !== 'string' || cc.length !== 2) return '🌐';
  const code = cc.toUpperCase();
  if (code === 'XX' || code === 'T1') return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

export function getCountryDisplayName(cc, fallbackName = '') {
  if (!cc || typeof cc !== 'string' || cc.length !== 2) return fallbackName || '미확인';
  const code = cc.toUpperCase();
  const common = {
    KR: '대한민국 (South Korea)',
    ID: '인도네시아 (Indonesia)',
    US: '미국 (United States)',
    JP: '일본 (Japan)',
    SG: '싱가포르 (Singapore)',
    MY: '말레이시아 (Malaysia)',
    VN: '베트남 (Vietnam)',
    TH: '태국 (Thailand)',
    PH: '필리핀 (Philippines)',
    AU: '호주 (Australia)',
    CN: '중국 (China)',
    TW: '대만 (Taiwan)',
    HK: '홍콩 (Hong Kong)',
    GB: '영국 (United Kingdom)',
    CA: '캐나다 (Canada)',
    DE: '독일 (Germany)'
  };
  if (common[code]) return common[code];
  try {
    const ko = new Intl.DisplayNames(['ko'], { type: 'region' }).of(code);
    const en = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    return ko && en && ko !== en ? `${ko} (${en})` : ko || en || fallbackName || code;
  } catch {
    return fallbackName || code;
  }
}

export function formatKstTimestamp(dateInput = new Date()) {
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d);
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
}

export function parseDeviceInfo(uaString = '') {
  const ua = uaString || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return '알 수 없는 기기';

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const formFactor = isMobile ? '모바일' : 'PC';

  let os = '기타 OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = '브라우저';
  if (/SamsungBrowser/i.test(ua)) browser = 'Samsung';
  else if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Whale\//i.test(ua)) browser = 'Whale';
  else if (/KAKAOTALK/i.test(ua)) browser = 'KakaoTalk';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  return `${formFactor} · ${os} · ${browser}`;
}

function getOrCreateDeviceId() {
  try {
    let deviceId = localStorage.getItem('user_device_id');
    if (!deviceId) {
      deviceId = 'user_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('user_device_id', deviceId);
    }
    return deviceId;
  } catch {
    return 'anonymous';
  }
}

function getCurrentAuthUser() {
  try {
    const raw = localStorage.getItem('auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        email: parsed?.email || null,
        name: parsed?.name || ''
      };
    }
    const fallbackEmail = localStorage.getItem('user_email');
    return { email: fallbackEmail || null, name: '' };
  } catch {
    return { email: null, name: '' };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * 4단계 무료 Geo-IP 감지 (세션 캐시 적용)
 * 1) Vercel Edge (/api/geo) -> 광고차단기 무시, 초고속
 * 2) ipwho.is -> 도시 및 ISP 상세 제공
 * 3) ipapi.co -> 백업 Geo-IP
 * 4) Cloudflare cdn-cgi/trace -> 초안정 IP + 국가코드
 */
export async function getGeoIpInfo() {
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.ip && parsed.ip !== 'unknown') return parsed;
    }
  } catch {
    // ignore
  }

  if (geoPromise) return geoPromise;

  geoPromise = (async () => {
    let result = {
      ip: '',
      country_code: '',
      country: '',
      flag: '🌐',
      city: '',
      region: '',
      isp: '',
      timezone: ''
    };

    // 1. Vercel Serverless Geo-IP (/api/geo)
    try {
      const res = await fetchWithTimeout('/api/geo', {}, 2500);
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        const isLocalIp = !data.ip || data.ip === '127.0.0.1' || data.ip === '::1';
        if (!isLocalIp && data.countryCode) {
          result = {
            ip: data.ip,
            country_code: data.countryCode,
            country: data.country || getCountryDisplayName(data.countryCode),
            flag: data.flag || countryCodeToFlag(data.countryCode),
            city: data.city || '',
            region: data.region || '',
            isp: '',
            timezone: data.timezone || ''
          };
        }
      }
    } catch {
      // 로컬 vite 개발 서버에서는 2단계로 진행
    }

    // 2. ipwho.is (ISP 정보 보강 또는 1단계 미확인 시 조회)
    if (!result.ip || !result.isp) {
      try {
        const res = await fetchWithTimeout('https://ipwho.is/', {}, 3500);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success !== false && data.ip) {
            const cc = (data.country_code || result.country_code || '').toUpperCase();
            result = {
              ip: result.ip || data.ip,
              country_code: cc,
              country: getCountryDisplayName(cc, data.country) || result.country,
              flag: countryCodeToFlag(cc),
              city: result.city || data.city || data.region || '',
              region: result.region || data.region || '',
              isp: data.connection?.isp || data.connection?.org || '',
              timezone: result.timezone || data.timezone?.id || ''
            };
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. ipapi.co 폴백
    if (!result.ip || !result.country_code) {
      try {
        const res = await fetchWithTimeout('https://ipapi.co/json/', {}, 3500);
        if (res.ok) {
          const data = await res.json();
          if (data && data.ip) {
            const cc = (data.country_code || '').toUpperCase();
            result = {
              ip: data.ip,
              country_code: cc,
              country: getCountryDisplayName(cc, data.country_name),
              flag: countryCodeToFlag(cc),
              city: data.city || '',
              region: data.region || '',
              isp: data.org || '',
              timezone: data.timezone || ''
            };
          }
        }
      } catch {
        // ignore
      }
    }

    // 4. Cloudflare Trace 최종 폴백
    if (!result.ip || !result.country_code) {
      try {
        const res = await fetchWithTimeout('https://www.cloudflare.com/cdn-cgi/trace', {}, 3000);
        if (res.ok) {
          const text = await res.text();
          const lines = Object.fromEntries(
            text
              .split('\n')
              .filter((l) => l.includes('='))
              .map((l) => l.split('='))
          );
          const cc = (lines.loc || '').toUpperCase().trim();
          if (lines.ip) {
            result = {
              ...result,
              ip: result.ip || lines.ip.trim(),
              country_code: result.country_code || cc,
              country: result.country || getCountryDisplayName(cc),
              flag: countryCodeToFlag(result.country_code || cc)
            };
          }
        }
      } catch {
        // ignore
      }
    }

    if (!result.ip) result.ip = 'unknown';
    if (!result.country) result.country = '미확인';

    try {
      if (result.ip !== 'unknown') {
        sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(result));
      }
    } catch {
      // ignore
    }

    geoPromise = null;
    return result;
  })();

  return geoPromise;
}

/**
 * 저장된 서버 연결 설정 조회 / 변경
 */
export function getConfiguredLogSettings() {
  try {
    return {
      pcServerUrl: (localStorage.getItem('inko_pc_server_url') || DEFAULT_PC_SERVER_URL || '').trim().replace(/\/+$/, ''),
      googleScriptUrl: (localStorage.getItem('inko_google_script_url') || DEFAULT_GOOGLE_SCRIPT_URL || '').trim(),
      adminKey: (localStorage.getItem('inko_log_admin_key') || DEFAULT_ADMIN_KEY || 'inko-admin-2026').trim()
    };
  } catch {
    return {
      pcServerUrl: DEFAULT_PC_SERVER_URL,
      googleScriptUrl: DEFAULT_GOOGLE_SCRIPT_URL,
      adminKey: DEFAULT_ADMIN_KEY
    };
  }
}

export function saveConfiguredLogSettings({ pcServerUrl, googleScriptUrl, adminKey }) {
  try {
    if (typeof pcServerUrl === 'string') {
      const clean = pcServerUrl.trim().replace(/\/+$/, '');
      if (clean) localStorage.setItem('inko_pc_server_url', clean);
      else localStorage.removeItem('inko_pc_server_url');
    }
    if (typeof googleScriptUrl === 'string') {
      const clean = googleScriptUrl.trim();
      if (clean) localStorage.setItem('inko_google_script_url', clean);
      else localStorage.removeItem('inko_google_script_url');
    }
    if (typeof adminKey === 'string' && adminKey.trim()) {
      localStorage.setItem('inko_log_admin_key', adminKey.trim());
    }
    sessionStorage.removeItem(ENDPOINT_CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * 원격 로그 수신 엔드포인트 자동 디스커버리
 * - GitHub log-endpoint 브랜치에 내 PC 서버가 발행한 최신 터널 URL / 구글 시트 URL을 자동 조회
 */
export async function discoverRemoteLogEndpoints(forceRefresh = false) {
  const localCfg = getConfiguredLogSettings();

  let discovered = { pcServerUrl: '', googleScriptUrl: '', updatedAt: '' };
  try {
    if (!forceRefresh) {
      const cachedRaw = sessionStorage.getItem(ENDPOINT_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && Date.now() - (cached._fetchedAt || 0) < 180000) {
          discovered = cached;
        }
      }
    }

    if (!discovered._fetchedAt) {
      const res = await fetchWithTimeout(
        `${LIVE_ENDPOINT_DISCOVERY_URL}?t=${Math.floor(Date.now() / 60000)}`,
        { cache: 'no-store' },
        3000
      );
      if (res.ok) {
        const json = await res.json();
        discovered = {
          pcServerUrl: (json.pcServerUrl || '').trim().replace(/\/+$/, ''),
          googleScriptUrl: (json.googleScriptUrl || '').trim(),
          updatedAt: json.updatedAt || '',
          _fetchedAt: Date.now()
        };
        sessionStorage.setItem(ENDPOINT_CACHE_KEY, JSON.stringify(discovered));
      } else {
        discovered = { pcServerUrl: '', googleScriptUrl: '', _fetchedAt: Date.now() };
        sessionStorage.setItem(ENDPOINT_CACHE_KEY, JSON.stringify(discovered));
      }
    }
  } catch {
    // 아직 log-endpoint 브랜치가 없을 수 있음 -> 정상 무시
  }

  const isLocalBrowser =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const resolvedPcUrl =
    localCfg.pcServerUrl ||
    discovered.pcServerUrl ||
    (isLocalBrowser ? 'http://localhost:4000' : '');

  const resolvedGoogleUrl = localCfg.googleScriptUrl || discovered.googleScriptUrl || '';

  return {
    pcServerUrl: resolvedPcUrl,
    googleScriptUrl: resolvedGoogleUrl,
    discoveredPcUrl: discovered.pcServerUrl || '',
    discoveredGoogleUrl: discovered.googleScriptUrl || '',
    updatedAt: discovered.updatedAt || ''
  };
}

/**
 * 로컬 브라우저 활동 로그 읽기 / 저장
 */
export function getLocalActivityLogs() {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalActivityLog(logEntry) {
  try {
    const prev = getLocalActivityLogs();
    const filtered = prev.filter((item) => item.id !== logEntry.id);
    const next = [logEntry, ...filtered].slice(0, MAX_LOCAL_LOGS);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(next));
  } catch {
    // 용량 초과 시 오래된 절반 정리
    try {
      const prev = getLocalActivityLogs().slice(0, 300);
      localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify([logEntry, ...prev]));
    } catch {
      // ignore
    }
  }
}

export function clearLocalActivityLogs() {
  try {
    localStorage.removeItem(LOCAL_LOGS_KEY);
    localStorage.removeItem(PENDING_LOGS_KEY);
  } catch {
    // ignore
  }
}

export function importActivityLogsToLocal(importedLogs = []) {
  if (!Array.isArray(importedLogs)) return 0;
  const existing = getLocalActivityLogs();
  const idMap = new Map();
  existing.forEach((l) => {
    if (l && l.id) idMap.set(l.id, l);
  });
  let added = 0;
  importedLogs.forEach((l) => {
    if (l && l.id && !idMap.has(l.id)) {
      idMap.set(l.id, l);
      added++;
    }
  });
  const merged = Array.from(idMap.values())
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, MAX_LOCAL_LOGS * 2);
  localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(merged));
  return added;
}

function getPendingLogs() {
  try {
    const raw = localStorage.getItem(PENDING_LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getPendingLogsCount() {
  return getPendingLogs().length;
}

function enqueuePendingLog(logEntry) {
  try {
    const prev = getPendingLogs();
    const next = [...prev, logEntry].slice(-MAX_PENDING_LOGS);
    localStorage.setItem(PENDING_LOGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * 대기열에 쌓인 로그를 내 PC 서버 / Google 스프레드시트 / Supabase로 일괄 백업 전송
 */
export async function flushPendingLogs() {
  if (isFlushing) return { sent: 0 };
  const pending = getPendingLogs();
  if (pending.length === 0) return { sent: 0 };

  isFlushing = true;
  let deliveredRemotely = false;

  try {
    const endpoints = await discoverRemoteLogEndpoints();
    const batch = pending.slice(0, 150);

    // 1. 내 컴퓨터(PC) 실시간 로그 서버로 전송
    const pcTargets = new Set();
    if (endpoints.pcServerUrl) pcTargets.add(endpoints.pcServerUrl);

    for (const baseUrl of pcTargets) {
      try {
        const res = await fetchWithTimeout(
          `${baseUrl}/api/logs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs: batch })
          },
          4500
        );
        if (res.ok) {
          deliveredRemotely = true;
        }
      } catch {
        // PC 서버가 꺼져 있으면 대기열에 안전하게 유지됨
      }
    }

    // 2. Google 스프레드시트 무료 24시간 웹훅으로 전송 (text/plain으로 CORS Preflight 완벽 회피)
    if (endpoints.googleScriptUrl && endpoints.googleScriptUrl.startsWith('https://script.google.com/')) {
      try {
        const res = await fetchWithTimeout(
          endpoints.googleScriptUrl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ logs: batch })
          },
          7000
        );
        if (res.ok || res.type === 'opaque') {
          deliveredRemotely = true;
        }
      } catch {
        // ignore
      }
    }

    // 3. Supabase가 설정되어 있는 경우 호환 전송
    if (supabase) {
      for (const item of batch) {
        try {
          if (item.action_type === 'LOGIN' || item.action_type === 'SESSION_START') {
            await supabase.from('access_logs').insert([
              {
                user_id: item.user_id,
                email: item.email,
                user_agent: item.user_agent,
                ip: item.ip
              }
            ]);
          }
          if (item.tokens_used > 0 || item.action_type === 'WORD_GENERATE_AI') {
            await supabase.from('usage_logs').insert([
              {
                user_id: item.user_id,
                email: item.email,
                tokens_used: item.tokens_used || 0,
                cost_usd: item.cost_usd || 0,
                topic: item.topic || item.detail || item.action_label,
                ip: item.ip
              }
            ]);
          }
          deliveredRemotely = true;
        } catch {
          // ignore
        }
      }
    }

    if (deliveredRemotely) {
      const sentIds = new Set(batch.map((b) => b.id));
      const remaining = getPendingLogs().filter((p) => !sentIds.has(p.id));
      localStorage.setItem(PENDING_LOGS_KEY, JSON.stringify(remaining));
      return { sent: batch.length, remaining: remaining.length };
    }
  } finally {
    isFlushing = false;
  }

  return { sent: 0, remaining: pending.length };
}

/**
 * [핵심] 모든 사용자 로그인/접속/행동 기록 함수
 * @param {string} actionType - ACTION_META 키 (예: 'LOGIN', 'WORD_GENERATE_AI', 'STUDY_COMPLETE' 등)
 * @param {Object} options - { detail, topic, tokens, costUsd, email, userName, path, label }
 */
export async function trackActivity(actionType, options = {}) {
  try {
    const now = new Date();
    const authUser = getCurrentAuthUser();
    const meta = ACTION_META[actionType] || { label: options.label || actionType };

    const baseLog = {
      id: `act_${now.getTime()}_${Math.random().toString(36).substring(2, 8)}`,
      created_at: now.toISOString(),
      kst_time: formatKstTimestamp(now),
      user_id: getOrCreateDeviceId(),
      email: options.email || authUser.email || null,
      user_name: options.userName || authUser.name || '',
      ip: '조회중...',
      country_code: '',
      country: '확인중',
      flag: '🌐',
      city: '',
      region: '',
      isp: '',
      action_type: actionType,
      action_label: options.label || meta.label || actionType,
      detail: options.detail || '',
      topic: options.topic || '',
      tokens_used: Number(options.tokens || 0) || 0,
      cost_usd: Number(options.costUsd || 0) || 0,
      user_lang: localStorage.getItem('userLang') || 'ko',
      study_lang: localStorage.getItem('studyLang') || 'id',
      device: parseDeviceInfo(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      path: options.path || (typeof window !== 'undefined' ? window.location.pathname : '/'),
      source: 'client'
    };

    // Geo-IP 정보 결합
    const geo = await getGeoIpInfo();
    const fullLog = {
      ...baseLog,
      ip: geo.ip || 'unknown',
      country_code: geo.country_code || '',
      country: geo.country || '미확인',
      flag: geo.flag || countryCodeToFlag(geo.country_code),
      city: geo.city || '',
      region: geo.region || '',
      isp: geo.isp || ''
    };

    saveLocalActivityLog(fullLog);
    enqueuePendingLog(fullLog);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('inko_activity_logged', { detail: fullLog }));
    }

    // 로그인·로그아웃은 즉시 플러시, 일반 활동은 1.2초 배치 플러시
    if (actionType === 'LOGIN' || actionType === 'LOGOUT' || actionType === 'SESSION_START') {
      flushPendingLogs();
    } else {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushPendingLogs();
      }, 1200);
    }

    return fullLog;
  } catch (err) {
    console.warn('[ActivityLogger] 기록 중 예외 무시:', err);
    return null;
  }
}

// 탭 닫기 / 백그라운드 전환 시 잔여 로그 전송 시도
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingLogs();
    }
  });
}

/**
 * 서버 연결 테스트 도우미
 */
export async function testPcServerConnection(url, adminKey = '') {
  const cleanUrl = (url || '').trim().replace(/\/+$/, '');
  if (!cleanUrl) return { ok: false, error: '서버 주소를 입력해주세요.' };
  try {
    const res = await fetchWithTimeout(
      `${cleanUrl}/api/health`,
      {
        headers: adminKey ? { 'X-Admin-Key': adminKey } : {}
      },
      4000
    );
    if (!res.ok) return { ok: false, error: `응답 오류 (HTTP ${res.status})` };
    const data = await res.json();
    return { ok: Boolean(data.ok), ...data };
  } catch (err) {
    return { ok: false, error: err.message || '서버에 연결할 수 없습니다. PC 서버가 켜져 있는지 확인해주세요.' };
  }
}

export async function testGoogleScriptConnection(url, adminKey = '') {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl || !cleanUrl.startsWith('https://script.google.com/')) {
    return { ok: false, error: '올바른 Google Apps Script 웹 앱 URL(https://script.google.com/.../exec)을 입력해주세요.' };
  }
  try {
    const sep = cleanUrl.includes('?') ? '&' : '?';
    const res = await fetchWithTimeout(
      `${cleanUrl}${sep}action=list&limit=5&adminKey=${encodeURIComponent(adminKey)}`,
      {},
      7000
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: Boolean(data.ok), total: data.total || 0 };
  } catch (err) {
    return { ok: false, error: err.message || '구글 스크립트 연결 실패' };
  }
}

/**
 * [중앙 통계 전용] 모든 백엔드(내 PC 서버 + 로컬 localhost:4000 + 구글 스프레드시트 + Supabase + 로컬 브라우저)의 로그를 통합 병합 조회
 */
export async function fetchUnifiedLogs(forceEndpointRefresh = false) {
  // 조회 전 대기 중인 로컬 로그 먼저 플러시 시도
  await flushPendingLogs().catch(() => {});

  const cfg = getConfiguredLogSettings();
  const discovered = await discoverRemoteLogEndpoints(forceEndpointRefresh);
  const adminKey = cfg.adminKey;

  const sourcesStatus = {
    pcServer: { connected: false, url: '', total: 0, diskPath: '', tunnelUrl: '', error: '' },
    googleSheets: { connected: false, url: discovered.googleScriptUrl, total: 0, error: '' },
    supabase: { connected: Boolean(supabase), total: 0 },
    localBrowser: { total: 0, pending: getPendingLogsCount() }
  };

  const mergedMap = new Map();
  const addLog = (item, defaultSource) => {
    if (!item || typeof item !== 'object') return;
    const id = item.id || `${item.created_at}_${item.user_id}_${item.action_type}`;
    if (!mergedMap.has(id)) {
      const cc = (item.country_code || '').toUpperCase();
      mergedMap.set(id, {
        ...item,
        id,
        kst_time: item.kst_time || formatKstTimestamp(item.created_at),
        flag: item.flag || countryCodeToFlag(cc),
        country: item.country || (cc ? getCountryDisplayName(cc) : '미확인'),
        action_label: item.action_label || ACTION_META[item.action_type]?.label || item.action_type || '활동',
        source: item.source || defaultSource
      });
    }
  };

  // 1. 내 컴퓨터(PC) 로그 서버 조회 (설정된 주소 + 내 PC에서 보고 있을 경우 http://localhost:4000 자동 병행 탐색!)
  const candidatePcUrls = [];
  if (discovered.pcServerUrl) candidatePcUrls.push(discovered.pcServerUrl);
  if (!candidatePcUrls.includes('http://localhost:4000')) {
    candidatePcUrls.push('http://localhost:4000');
  }

  for (const baseUrl of candidatePcUrls) {
    try {
      const res = await fetchWithTimeout(
        `${baseUrl}/api/logs?limit=2500`,
        {
          headers: { 'X-Admin-Key': adminKey }
        },
        3500
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.logs)) {
          data.logs.forEach((l) => addLog(l, 'pc-server'));
          sourcesStatus.pcServer = {
            connected: true,
            url: baseUrl,
            total: data.total || data.logs.length,
            diskPath: data.diskPath || '',
            tunnelUrl: data.tunnelUrl || '',
            publishStatus: data.publishStatus || null,
            error: ''
          };
          break; // 연결 성공한 첫 PC 서버에서 전체 마스터 로그 수신 완료
        }
      }
    } catch (err) {
      if (baseUrl === discovered.pcServerUrl) {
        sourcesStatus.pcServer.url = baseUrl;
        sourcesStatus.pcServer.error = '미연결 (PC 서버 대기중)';
      }
    }
  }

  // 2. Google 스프레드시트 24시간 웹훅 조회
  if (discovered.googleScriptUrl && discovered.googleScriptUrl.startsWith('https://script.google.com/')) {
    try {
      const sep = discovered.googleScriptUrl.includes('?') ? '&' : '?';
      const res = await fetchWithTimeout(
        `${discovered.googleScriptUrl}${sep}action=list&limit=1500&adminKey=${encodeURIComponent(adminKey)}`,
        {},
        7000
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.logs)) {
          data.logs.forEach((l) => addLog(l, 'google-sheets'));
          sourcesStatus.googleSheets = {
            connected: true,
            url: discovered.googleScriptUrl,
            total: data.total || data.logs.length,
            error: ''
          };
        }
      }
    } catch (err) {
      sourcesStatus.googleSheets.error = err.message || '연결 실패';
    }
  }

  // 3. Supabase 기존 테이블 호환 병합 (설정되어 있는 경우)
  if (supabase) {
    try {
      const [{ data: access }, { data: usage }] = await Promise.all([
        supabase.from('access_logs').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('usage_logs').select('*').order('created_at', { ascending: false }).limit(500)
      ]);
      (access || []).forEach((a) =>
        addLog(
          {
            id: `sb_acc_${a.id}`,
            created_at: a.created_at,
            user_id: a.user_id,
            email: a.email,
            ip: a.ip || 'unknown',
            action_type: 'SESSION_START',
            action_label: '앱 접속',
            detail: 'Supabase 접속 기록',
            device: parseDeviceInfo(a.user_agent),
            user_agent: a.user_agent,
            source: 'supabase'
          },
          'supabase'
        )
      );
      (usage || []).forEach((u) =>
        addLog(
          {
            id: `sb_use_${u.id}`,
            created_at: u.created_at,
            user_id: u.user_id,
            email: u.email,
            ip: u.ip || 'unknown',
            action_type: 'WORD_GENERATE_AI',
            action_label: 'AI 사용',
            topic: u.topic,
            detail: `주제: ${u.topic || '-'} (${(u.tokens_used || 0).toLocaleString()} T)`,
            tokens_used: u.tokens_used || 0,
            cost_usd: Number(u.cost_usd || 0),
            source: 'supabase'
          },
          'supabase'
        )
      );
      sourcesStatus.supabase.total = (access?.length || 0) + (usage?.length || 0);
    } catch {
      // ignore
    }
  }

  // 4. 현재 브라우저 로컬 로그 병합
  const localLogs = getLocalActivityLogs();
  sourcesStatus.localBrowser.total = localLogs.length;
  localLogs.forEach((l) => addLog(l, 'local-browser'));

  const unifiedLogs = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );

  return {
    logs: unifiedLogs,
    sourcesStatus,
    discovered
  };
}

/**
 * 엑셀(CSV) 및 JSON 백업 파일 다운로드 헬퍼
 */
export function exportLogsToCSV(logs = [], filenamePrefix = 'Inko_Activity_Logs') {
  if (!logs || logs.length === 0) return false;
  const headers = [
    '한국시간(KST)',
    'UTC시간',
    '이메일',
    '이름',
    '기기ID',
    '국가',
    '국가코드',
    '도시',
    '통신사(ISP)',
    'IP주소',
    '행동코드',
    '행동분류',
    '상세내용',
    '주제/대상',
    '사용언어',
    '학습언어',
    '사용토큰',
    '예상비용(USD)',
    '접속환경',
    '경로',
    '수집출처',
    '로그ID'
  ];

  const esc = (v) => `"${String(v ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
  const rows = logs.map((l) =>
    [
      l.kst_time || formatKstTimestamp(l.created_at),
      l.created_at || '',
      l.email || '익명(미로그인)',
      l.user_name || '',
      l.user_id || '',
      l.country || '',
      l.country_code || '',
      l.city || '',
      l.isp || '',
      l.ip || '',
      l.action_type || '',
      l.action_label || '',
      l.detail || '',
      l.topic || '',
      l.user_lang || '',
      l.study_lang || '',
      l.tokens_used || 0,
      l.cost_usd || 0,
      l.device || '',
      l.path || '',
      l.source || '',
      l.id || ''
    ].map(esc).join(',')
  );

  const csvContent = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

export function exportLogsToJSON(logs = [], filenamePrefix = 'Inko_Activity_Logs') {
  if (!logs || logs.length === 0) return false;
  const payload = {
    type: 'inko_activity_logs_backup',
    exportedAt: new Date().toISOString(),
    total: logs.length,
    logs
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

