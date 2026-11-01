/**
 * Inko Nana Pro — 내 컴퓨터(PC) 무료 실시간 접속/활동 로그 백업 서버 (Zero-Dependency Node.js)
 *
 * 주요 기능:
 * 1) 모든 사용자 접속 IP, 국가/도시, 로그인 시각, 앱 내 모든 행동을 실시간 수신 및 영구 백업
 * 2) PC 하드디스크 이중 백업:
 *    - pc-log-server/logs/activity_logs.jsonl (마스터 원본 DB, 중복 자동 제거)
 *    - pc-log-server/logs/daily/YYYY-MM-DD.csv (엑셀 즉시 열람용 날짜별 UTF-8 BOM CSV)
 * 3) 무료 Cloudflare HTTPS 터널(--tunnel) 자동 실행 및 GitHub log-endpoint 브랜치 자동 연결(--publish)
 *    -> 공유기 포트포워딩이나 유료 서버 없이 전 세계 Vercel 접속자의 로그가 내 PC로 실시간 백업됨!
 * 4) Google 스프레드시트(무료 24시간 웹훅) URL 연동 시, 내 PC가 꺼져 있던 동안 쌓인 로그까지 자동 다운로드 병합!
 * 5) http://localhost:4000 접속 시 실시간 한국어 모니터링 웹 대시보드 제공
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4000);
const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_DIR = __dirname;
const LOGS_DIR = path.join(SERVER_DIR, 'logs');
const DAILY_DIR = path.join(LOGS_DIR, 'daily');
const ARCHIVE_DIR = path.join(LOGS_DIR, 'archive');
const MASTER_JSONL = path.join(LOGS_DIR, 'activity_logs.jsonl');
const CONFIG_FILE = path.join(SERVER_DIR, 'config.json');

const args = process.argv.slice(2);
const AUTO_TUNNEL = args.includes('--tunnel');
const AUTO_PUBLISH = args.includes('--publish');

// 디렉토리 자동 생성
[LOGS_DIR, DAILY_DIR, ARCHIVE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 기본 설정 로드/저장
const DEFAULT_CONFIG = {
  adminKey: 'inko-admin-2026',
  googleScriptUrl: '',
  autoPublishEndpoint: true,
  lastTunnelUrl: '',
  lastPublishedAt: ''
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_CONFIG, ...raw };
    }
  } catch (e) {
    console.warn('[Config] 설정 로드 실패, 기본값 사용:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('[Config] 설정 저장 실패:', e.message);
  }
}

let config = loadConfig();
let liveTunnelUrl = '';
let tunnelProcess = null;
let tunnelStatus = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'
let publishStatus = { ok: false, message: '미발행', updatedAt: config.lastPublishedAt || '' };

// 메모리 인덱스 (빠른 조회 및 중복 방지)
const logIdSet = new Set();
let allLogs = [];
const ipGeoCache = new Map();

// 국가 코드 -> 국기 이모지 및 한국어 국가명
function countryCodeToFlag(cc) {
  if (!cc || typeof cc !== 'string' || cc.length !== 2) return '🌐';
  const code = cc.toUpperCase();
  if (code === 'XX' || code === 'T1') return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

function getCountryName(cc) {
  if (!cc || typeof cc !== 'string' || cc.length !== 2) return '';
  const code = cc.toUpperCase();
  const map = {
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
  if (map[code]) return map[code];
  try {
    const ko = new Intl.DisplayNames(['ko'], { type: 'region' }).of(code);
    const en = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    return ko && en && ko !== en ? `${ko} (${en})` : ko || en || code;
  } catch {
    return code;
  }
}

function formatKstTime(isoStr) {
  try {
    const d = isoStr ? new Date(isoStr) : new Date();
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d);
    return parts;
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
}

// 기존 저장된 로그 로드
function loadExistingLogs() {
  allLogs = [];
  logIdSet.clear();
  if (!fs.existsSync(MASTER_JSONL)) return;

  try {
    const lines = fs.readFileSync(MASTER_JSONL, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.id && !logIdSet.has(parsed.id)) {
          logIdSet.add(parsed.id);
          allLogs.push(parsed);
        }
      } catch {
        // 손상된 라인 무시
      }
    }
    allLogs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    console.log(`[PC 로그서버] 기존 백업 로그 ${allLogs.length.toLocaleString()}건 로드 완료.`);
  } catch (e) {
    console.error('[PC 로그서버] 로그 파일 읽기 오류:', e.message);
  }
}

loadExistingLogs();

// CSV 행 포맷팅
const CSV_HEADERS = [
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
  '로그ID'
];

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${str}"`;
}

function logToCsvRow(log) {
  return [
    log.kst_time || formatKstTime(log.created_at),
    log.created_at || '',
    log.email || '익명(미로그인)',
    log.user_name || '',
    log.user_id || '',
    log.country || '',
    log.country_code || '',
    log.city || '',
    log.isp || '',
    log.ip || '',
    log.action_type || '',
    log.action_label || '',
    log.detail || '',
    log.topic || '',
    log.user_lang || '',
    log.study_lang || '',
    log.tokens_used || 0,
    log.cost_usd || 0,
    log.device || '',
    log.path || '',
    log.id || ''
  ]
    .map(escapeCsvCell)
    .join(',');
}

function appendDailyCsv(log) {
  try {
    const kst = log.kst_time || formatKstTime(log.created_at);
    const datePart = (kst.slice(0, 10) || new Date().toISOString().slice(0, 10)).replace(/[^0-9-]/g, '');
    const dailyFile = path.join(DAILY_DIR, `${datePart}.csv`);
    const exists = fs.existsSync(dailyFile);
    const prefix = exists ? '' : '\uFEFF' + CSV_HEADERS.map(escapeCsvCell).join(',') + '\n';
    fs.appendFileSync(dailyFile, prefix + logToCsvRow(log) + '\n', 'utf8');
  } catch (e) {
    console.error('[CSV 백업 오류]:', e.message);
  }
}

// 간단한 HTTPS JSON GET 헬퍼
function fetchJson(targetUrl, timeoutMs = 4500) {
  return new Promise((resolve) => {
    try {
      const client = targetUrl.startsWith('https') ? https : http;
      const req = client.get(targetUrl, { timeout: timeoutMs }, (res) => {
        // Google Apps Script 리다이렉트(302) 자동 추적
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchJson(res.headers.location, timeoutMs));
          return;
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

// 서버 사이드 IP 기반 국가/도시 보강 (클라이언트에서 누락된 경우 자동 조회)
async function enrichGeoOnServer(ip, cfCountryCode = '') {
  const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
  const isPrivate =
    !cleanIp ||
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'unknown' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('172.16.');

  if (isPrivate) {
    // 로컬 네트워크 접속 시 서버의 공인 IP 정보 조회 (1회 캐시)
    if (ipGeoCache.has('__SELF__')) return ipGeoCache.get('__SELF__');
    const data = await fetchJson('https://ipwho.is/', 3500);
    if (data && data.success !== false && data.ip) {
      const info = {
        ip: data.ip,
        country_code: (data.country_code || '').toUpperCase(),
        country: getCountryName(data.country_code) || data.country || '',
        flag: countryCodeToFlag(data.country_code),
        city: data.city || data.region || '',
        region: data.region || '',
        isp: data.connection?.isp || data.connection?.org || ''
      };
      ipGeoCache.set('__SELF__', info);
      return info;
    }
    return {
      ip: cleanIp || '127.0.0.1',
      country_code: cfCountryCode || 'LOCAL',
      country: cfCountryCode ? getCountryName(cfCountryCode) : '로컬 네트워크 (LAN)',
      flag: cfCountryCode ? countryCodeToFlag(cfCountryCode) : '🖥️',
      city: '',
      region: '',
      isp: ''
    };
  }

  if (ipGeoCache.has(cleanIp)) return ipGeoCache.get(cleanIp);

  const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(cleanIp)}`, 3500);
  if (data && data.success !== false) {
    const cc = (data.country_code || cfCountryCode || '').toUpperCase();
    const info = {
      ip: cleanIp,
      country_code: cc,
      country: getCountryName(cc) || data.country || '',
      flag: countryCodeToFlag(cc),
      city: data.city || data.region || '',
      region: data.region || '',
      isp: data.connection?.isp || data.connection?.org || ''
    };
    ipGeoCache.set(cleanIp, info);
    return info;
  }

  const fallbackCc = (cfCountryCode || '').toUpperCase();
  const fallback = {
    ip: cleanIp,
    country_code: fallbackCc,
    country: fallbackCc ? getCountryName(fallbackCc) : '알 수 없음',
    flag: countryCodeToFlag(fallbackCc),
    city: '',
    region: '',
    isp: ''
  };
  ipGeoCache.set(cleanIp, fallback);
  return fallback;
}

// 단일 로그 정규화 및 디스크 저장
async function saveLogItem(raw, reqHeaders = {}, remoteAddr = '') {
  if (!raw || typeof raw !== 'object') return false;

  const id =
    raw.id ||
    `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (logIdSet.has(id)) return false; // 중복 저장 방지

  const cfIp = reqHeaders['cf-connecting-ip'] || '';
  const fwdIp = typeof reqHeaders['x-forwarded-for'] === 'string'
    ? reqHeaders['x-forwarded-for'].split(',')[0].trim()
    : '';
  const cfCountry = (reqHeaders['cf-ipcountry'] || '').toString().toUpperCase().trim();

  let ip = raw.ip && raw.ip !== 'unknown' && raw.ip !== '0.0.0.0' ? raw.ip : (cfIp || fwdIp || remoteAddr || '');
  ip = String(ip).replace(/^::ffff:/, '').trim();

  let countryCode = (raw.country_code || cfCountry || '').toUpperCase().trim();
  let country = raw.country || (countryCode ? getCountryName(countryCode) : '');
  let flag = raw.flag || countryCodeToFlag(countryCode);
  let city = raw.city || '';
  let region = raw.region || '';
  let isp = raw.isp || '';

  if (!ip || !countryCode || countryCode === 'UNKNOWN') {
    const geo = await enrichGeoOnServer(ip, cfCountry);
    ip = ip || geo.ip;
    countryCode = countryCode || geo.country_code;
    country = country || geo.country;
    flag = (!flag || flag === '🌐') ? geo.flag : flag;
    city = city || geo.city;
    region = region || geo.region;
    isp = isp || geo.isp;
  } else if (!country) {
    country = getCountryName(countryCode);
  }

  const createdAt = raw.created_at || new Date().toISOString();
  const normalized = {
    id,
    created_at: createdAt,
    kst_time: raw.kst_time || formatKstTime(createdAt),
    user_id: String(raw.user_id || 'anonymous').slice(0, 120),
    email: raw.email ? String(raw.email).slice(0, 160) : null,
    user_name: raw.user_name ? String(raw.user_name).slice(0, 120) : '',
    ip: String(ip || 'unknown').slice(0, 80),
    country_code: String(countryCode || '').slice(0, 10),
    country: String(country || '미확인').slice(0, 100),
    flag: flag || countryCodeToFlag(countryCode),
    city: String(city || '').slice(0, 100),
    region: String(region || '').slice(0, 100),
    isp: String(isp || '').slice(0, 140),
    action_type: String(raw.action_type || 'ACTIVITY').slice(0, 60),
    action_label: String(raw.action_label || raw.action_type || '활동').slice(0, 100),
    detail: String(raw.detail || '').slice(0, 1000),
    topic: String(raw.topic || '').slice(0, 200),
    tokens_used: Number(raw.tokens_used || 0) || 0,
    cost_usd: Number(raw.cost_usd || 0) || 0,
    user_lang: String(raw.user_lang || '').slice(0, 10),
    study_lang: String(raw.study_lang || '').slice(0, 10),
    device: String(raw.device || '').slice(0, 120),
    user_agent: String(raw.user_agent || reqHeaders['user-agent'] || '').slice(0, 400),
    path: String(raw.path || '').slice(0, 200),
    source: raw.source || 'pc-server'
  };

  logIdSet.add(id);
  allLogs.unshift(normalized);

  // 디스크 영구 기록 (JSONL + 일별 CSV)
  fs.appendFileSync(MASTER_JSONL, JSON.stringify(normalized) + '\n', 'utf8');
  appendDailyCsv(normalized);

  return true;
}

// GitHub log-endpoint 브랜치에 현재 서버 주소 자동 발행 (main 작업 트리를 절대 건드리지 않음)
function publishEndpointToGitHub() {
  const payload = {
    pcServerUrl: liveTunnelUrl || '',
    googleScriptUrl: config.googleScriptUrl || '',
    updatedAt: new Date().toISOString()
  };

  if (!payload.pcServerUrl && !payload.googleScriptUrl) {
    publishStatus = { ok: false, message: '발행할 외부 URL이 없습니다.', updatedAt: '' };
    return publishStatus;
  }

  try {
    const jsonBytes = JSON.stringify(payload, null, 2) + '\n';

    const hashRes = spawnSync('git', ['hash-object', '-w', '--stdin'], {
      cwd: ROOT_DIR,
      input: jsonBytes,
      encoding: 'utf8'
    });
    if (hashRes.status !== 0) throw new Error(hashRes.stderr || 'git hash-object 실패');
    const blobSha = hashRes.stdout.trim();

    const treeInput = `100644 blob ${blobSha}\tendpoint.json\n`;
    const treeRes = spawnSync('git', ['mktree'], {
      cwd: ROOT_DIR,
      input: treeInput,
      encoding: 'utf8'
    });
    if (treeRes.status !== 0) throw new Error(treeRes.stderr || 'git mktree 실패');
    const treeSha = treeRes.stdout.trim();

    const commitRes = spawnSync(
      'git',
      ['commit-tree', treeSha, '-m', `chore: update live log endpoint (${new Date().toISOString()})`],
      { cwd: ROOT_DIR, encoding: 'utf8' }
    );
    if (commitRes.status !== 0) throw new Error(commitRes.stderr || 'git commit-tree 실패');
    const commitSha = commitRes.stdout.trim();

    const pushRes = spawnSync(
      'git',
      ['push', '-f', 'origin', `${commitSha}:refs/heads/log-endpoint`],
      { cwd: ROOT_DIR, encoding: 'utf8', timeout: 25000 }
    );
    if (pushRes.status !== 0) throw new Error(pushRes.stderr || 'git push 실패');

    config.lastTunnelUrl = liveTunnelUrl;
    config.lastPublishedAt = payload.updatedAt;
    saveConfig(config);

    publishStatus = {
      ok: true,
      message: 'GitHub 글로벌 엔드포인트 자동 연결 완료 (전 세계 접속자 로그 실시간 수신 중)',
      updatedAt: payload.updatedAt
    };
    console.log(`[GitHub 자동연결 완료] ${payload.pcServerUrl || payload.googleScriptUrl}`);
    return publishStatus;
  } catch (err) {
    publishStatus = {
      ok: false,
      message: `GitHub 자동 연결 실패: ${err.message}`,
      updatedAt: ''
    };
    console.warn('[GitHub 자동연결 경고]:', err.message);
    return publishStatus;
  }
}

// Cloudflare 무료 HTTPS 터널 시작 (포트포워딩·회원가입 불필요)
function startCloudflareTunnel(shouldPublish = true) {
  if (tunnelProcess) {
    return { ok: true, status: tunnelStatus, url: liveTunnelUrl };
  }

  tunnelStatus = 'starting';
  console.log('[HTTPS 터널] 무료 Cloudflare 보안 터널을 시작합니다... (최초 실행 시 자동 다운로드로 10~20초 소요될 수 있습니다)');

  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  tunnelProcess = spawn(cmd, ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], {
    cwd: ROOT_DIR,
    shell: process.platform === 'win32'
  });

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && match[0] && liveTunnelUrl !== match[0]) {
      liveTunnelUrl = match[0];
      tunnelStatus = 'running';
      console.log('==============================================================');
      console.log(`[외부 접속 HTTPS 주소 생성 완료] ${liveTunnelUrl}`);
      console.log('==============================================================');
      if (shouldPublish || config.autoPublishEndpoint) {
        publishEndpointToGitHub();
      }
    }
  };

  tunnelProcess.stdout.on('data', handleOutput);
  tunnelProcess.stderr.on('data', handleOutput);

  tunnelProcess.on('close', (code) => {
    console.log(`[HTTPS 터널 종료] 코드: ${code}`);
    tunnelProcess = null;
    liveTunnelUrl = '';
    tunnelStatus = 'stopped';
  });

  tunnelProcess.on('error', (err) => {
    console.error('[HTTPS 터널 실행 오류]:', err.message);
    tunnelStatus = 'error';
  });

  return { ok: true, status: tunnelStatus };
}

// Google 스프레드시트(무료 24시간 웹훅)에서 누락 로그 자동 동기화 백업
async function syncFromGoogleSheets() {
  if (!config.googleScriptUrl || !config.googleScriptUrl.startsWith('https://script.google.com/')) {
    return { synced: 0 };
  }
  try {
    const sep = config.googleScriptUrl.includes('?') ? '&' : '?';
    const target = `${config.googleScriptUrl}${sep}action=list&limit=1500&adminKey=${encodeURIComponent(config.adminKey || '')}`;
    const res = await fetchJson(target, 10000);
    if (res && Array.isArray(res.logs)) {
      let added = 0;
      // 오래된 순서부터 추가하여 최신 정렬 유지
      const chronological = [...res.logs].reverse();
      for (const item of chronological) {
        const saved = await saveLogItem({ ...item, source: 'google-sheets-sync' });
        if (saved) added++;
      }
      if (added > 0) {
        allLogs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        console.log(`[구글시트 자동백업] PC가 꺼져있던 동안 기록된 신규 로그 ${added}건을 내 PC 하드디스크로 백업 완료!`);
      }
      return { synced: added, totalRemote: res.logs.length };
    }
  } catch (e) {
    console.warn('[구글시트 동기화 경고]:', e.message);
  }
  return { synced: 0 };
}

// 1분마다 구글 시트 백업 자동 동기화
setInterval(() => {
  syncFromGoogleSheets();
}, 60000);

// 로컬 접속 또는 관리자 키 인증 확인
function isAuthorizedRead(req, urlObj) {
  const remote = (req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const isLocal =
    (remote === '127.0.0.1' || remote === '::1' || remote === 'localhost') &&
    !req.headers['cf-connecting-ip'];

  if (isLocal) return true;

  const headerKey = req.headers['x-admin-key'] || '';
  const queryKey = urlObj.searchParams.get('adminKey') || '';
  const provided = String(headerKey || queryKey).trim();
  return Boolean(provided && provided === (config.adminKey || 'inko-admin-2026'));
}

// 요약 통계 계산
function buildSummary(logs) {
  const users = new Set();
  const countries = {};
  const actions = {};
  let totalTokens = 0;
  let totalCost = 0;
  let loginCount = 0;

  for (const l of logs) {
    const uid = l.email || l.user_id || l.ip;
    if (uid) users.add(uid);

    const cKey = l.country || '미확인';
    countries[cKey] = (countries[cKey] || 0) + 1;

    const aKey = l.action_label || l.action_type || '기타';
    actions[aKey] = (actions[aKey] || 0) + 1;

    if (l.action_type === 'LOGIN') loginCount++;
    totalTokens += Number(l.tokens_used || 0);
    totalCost += Number(l.cost_usd || 0);
  }

  return {
    totalLogs: logs.length,
    uniqueUsers: users.size,
    loginCount,
    totalTokens,
    totalCost,
    countries,
    actions
  };
}

// 로컬 LAN IP 조회
function getLocalLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// 요청 바디 읽기 (최대 512KB 제한)
function readBody(req, maxBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// 내장 웹 대시보드 HTML (http://localhost:4000)
function renderLocalDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inko 내 컴퓨터(PC) 실시간 로그 백업 서버</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
    .wrap { max-width: 1320px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; border-radius: 24px; padding: 24px 28px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 800; background: #064e3b; color: #34d399; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 18px 20px; }
    .card .label { font-size: 13px; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
    .card .val { font-size: 26px; font-weight: 900; color: #f8fafc; }
    .panel { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 20px 24px; margin-bottom: 20px; }
    .btn { border: none; border-radius: 12px; padding: 10px 16px; font-weight: 800; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-green { background: #10b981; color: #fff; }
    .btn-amber { background: #f59e0b; color: #0f172a; }
    .btn-outline { background: #0f172a; color: #e2e8f0; border: 1px solid #475569; }
    code { background: #0f172a; color: #38bdf8; padding: 4px 8px; border-radius: 8px; font-size: 13px; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    th, td { padding: 11px 10px; border-bottom: 1px solid #334155; text-align: left; }
    th { color: #94a3b8; font-weight: 800; background: #0f172a; position: sticky; top: 0; }
    .tag { display: inline-block; padding: 3px 9px; border-radius: 8px; font-weight: 800; font-size: 12px; background: #334155; color: #f8fafc; }
    .tag-login { background: #065f46; color: #6ee7b7; }
    .tag-ai { background: #3b0764; color: #d8b4fe; }
    .tag-study { background: #78350f; color: #fde68a; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div>
        <div class="badge">● 실시간 백업 서버 가동 중 (Port ${PORT})</div>
        <h1 style="margin: 10px 0 4px; font-size: 24px;">🖥️ Inko 내 컴퓨터(PC) 실시간 접속·활동 로그 서버</h1>
        <div style="color: #94a3b8; font-size: 14px;">하드디스크 자동 백업 경로: <code>${LOGS_DIR}</code></div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-amber" onclick="startTunnel()">🌐 외부 HTTPS 터널 켜기 & 앱 자동연결</button>
        <a class="btn btn-green" href="/api/export/csv">📥 엑셀(CSV) 전체 다운로드</a>
        <a class="btn btn-outline" href="/api/export/json">📦 JSON 원본 백업</a>
        <button class="btn btn-primary" onclick="loadLogs()">🔄 새로고침</button>
      </div>
    </div>

    <div class="panel" id="connBox">연결 상태 불러오는 중...</div>

    <div class="grid">
      <div class="card"><div class="label">총 백업된 활동 로그</div><div class="val" id="stTotal">0</div></div>
      <div class="card"><div class="label">고유 사용자 (이메일/기기)</div><div class="val" id="stUsers">0</div></div>
      <div class="card"><div class="label">총 로그인 횟수</div><div class="val" id="stLogins">0</div></div>
      <div class="card"><div class="label">누적 AI 토큰 / 비용</div><div class="val" id="stTokens">0 T</div></div>
    </div>

    <div class="panel">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0;">📋 실시간 수신 로그 (최근 200건 · 5초마다 자동 갱신)</h3>
      </div>
      <div style="overflow-x:auto; max-height: 620px; overflow-y:auto;">
        <table>
          <thead>
            <tr>
              <th>시간 (KST)</th>
              <th>사용자</th>
              <th>국가 / 도시</th>
              <th>IP 주소</th>
              <th>행동</th>
              <th>상세 내역</th>
              <th>접속 기기</th>
            </tr>
          </thead>
          <tbody id="logBody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    function esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    async function startTunnel() {
      const res = await fetch('/api/tunnel/start', { method: 'POST' });
      const data = await res.json();
      alert(data.message || '터널 시작 요청 완료! 5~15초 후 주소가 표시됩니다.');
      setTimeout(loadLogs, 3000);
    }
    async function publishNow() {
      const res = await fetch('/api/tunnel/publish', { method: 'POST' });
      const data = await res.json();
      alert(data.message || '완료');
      loadLogs();
    }
    async function loadLogs() {
      try {
        const res = await fetch('/api/logs?limit=200');
        const data = await res.json();
        if (!data.ok) return;

        document.getElementById('stTotal').textContent = (data.total || 0).toLocaleString() + '건';
        document.getElementById('stUsers').textContent = (data.summary?.uniqueUsers || 0).toLocaleString() + '명';
        document.getElementById('stLogins').textContent = (data.summary?.loginCount || 0).toLocaleString() + '회';
        document.getElementById('stTokens').textContent = (data.summary?.totalTokens || 0).toLocaleString() + ' T ($' + Number(data.summary?.totalCost || 0).toFixed(4) + ')';

        const connHtml = \`
          <div style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
            <div>🏠 <b>내 PC 로컬 주소:</b> <code>http://localhost:${PORT}</code> (같은 공유기 Wi-Fi: <code>http://${getLocalLanIp()}:${PORT}</code>)</div>
            <div>🌍 <b>전 세계 외부 접속 HTTPS 터널:</b> \${data.tunnelUrl ? \`<code>\${esc(data.tunnelUrl)}</code> <button class="btn btn-outline" style="padding:4px 10px; font-size:12px;" onclick="publishNow()">GitHub 앱에 주소 다시 동기화</button>\` : '<span style="color:#fbbf24;">미실행 (우측 상단 [외부 HTTPS 터널 켜기] 버튼 클릭 또는 1_내PC_외부연결_로그서버_시작.bat 실행)</span>'}</div>
            <div>🔗 <b>Vercel 웹앱 자동 연동 상태:</b> <span>\${esc(data.publishStatus?.message || '대기 중')}</span></div>
          </div>\`;
        document.getElementById('connBox').innerHTML = connHtml;

        const rows = (data.logs || []).map(l => {
          const cls = l.action_type === 'LOGIN' ? 'tag tag-login' : (l.action_type?.includes('AI') || l.action_type?.includes('WORD') ? 'tag tag-ai' : (l.action_type?.includes('STUDY') ? 'tag tag-study' : 'tag'));
          return \`<tr>
            <td style="white-space:nowrap; color:#94a3b8;">\${esc(l.kst_time || l.created_at)}</td>
            <td><b>\${esc(l.email || '익명 방문자')}</b><div style="font-size:11px; color:#64748b;">\${esc(l.user_name || l.user_id)}</div></td>
            <td>\${esc(l.flag || '🌐')} <b>\${esc(l.country || '미확인')}</b>\${l.city ? ' · ' + esc(l.city) : ''}</td>
            <td><code>\${esc(l.ip)}</code></td>
            <td><span class="\${cls}">\${esc(l.action_label || l.action_type)}</span></td>
            <td style="max-width:360px;">\${esc(l.detail || l.topic || '-')}</td>
            <td style="color:#94a3b8; font-size:12px;">\${esc(l.device || '-')}</td>
          </tr>\`;
        }).join('');
        document.getElementById('logBody').innerHTML = rows || '<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">아직 수신된 로그가 없습니다. 앱에서 로그인하거나 활동하면 즉시 이곳에 기록됩니다!</td></tr>';
      } catch (e) {}
    }
    loadLogs();
    setInterval(loadLogs, 5000);
  </script>
</body>
</html>`;
}

// HTTP 서버 생성
const server = http.createServer(async (req, res) => {
  // CORS 및 Chrome Private Network Access 완벽 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, Bypass-Tunnel-Reminder');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlObj = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  const sendJson = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };

  try {
    // 1. 로컬 실시간 대시보드 웹 UI
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderLocalDashboardHtml());
    }

    // 2. 서버 상태 확인 (Health Check)
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(200, {
        ok: true,
        service: 'inko-pc-log-server',
        totalLogs: allLogs.length,
        tunnelStatus,
        tunnelUrl: liveTunnelUrl,
        hasGoogleSheetsSync: Boolean(config.googleScriptUrl),
        publishStatus,
        diskPath: LOGS_DIR,
        uptimeSec: Math.round(process.uptime())
      });
    }

    // 3. 로그 수집 (단일 객체 또는 { logs: [...] } 배치 모두 수용 - 모든 방문자 전송 허용)
    if (req.method === 'POST' && pathname === '/api/logs') {
      const rawBody = await readBody(req);
      let parsed;
      try {
        parsed = JSON.parse(rawBody || '{}');
      } catch {
        return sendJson(400, { ok: false, error: 'Invalid JSON' });
      }

      const incoming = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.logs)
          ? parsed.logs
          : [parsed];

      let savedCount = 0;
      const sliced = incoming.slice(0, 300);
      for (const item of sliced) {
        const ok = await saveLogItem(item, req.headers, req.socket?.remoteAddress || '');
        if (ok) savedCount++;
      }

      if (savedCount > 1) {
        allLogs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }

      return sendJson(200, { ok: true, saved: savedCount, total: allLogs.length });
    }

    // 4. 로그 조회 (관리자 키 또는 로컬호스트 전용)
    if (req.method === 'GET' && pathname === '/api/logs') {
      if (!isAuthorizedRead(req, urlObj)) {
        return sendJson(401, { ok: false, error: '관리자 인증 키(Admin Key)가 일치하지 않습니다.' });
      }

      const limit = Math.min(Number(urlObj.searchParams.get('limit') || 1000), 5000);
      const search = (urlObj.searchParams.get('search') || '').toLowerCase().trim();
      const country = (urlObj.searchParams.get('country') || '').trim();
      const action = (urlObj.searchParams.get('action') || '').trim();

      let filtered = allLogs;
      if (country && country !== 'ALL') {
        filtered = filtered.filter((l) => l.country === country || l.country_code === country);
      }
      if (action && action !== 'ALL') {
        filtered = filtered.filter((l) => l.action_type === action);
      }
      if (search) {
        filtered = filtered.filter(
          (l) =>
            (l.email || '').toLowerCase().includes(search) ||
            (l.user_name || '').toLowerCase().includes(search) ||
            (l.ip || '').toLowerCase().includes(search) ||
            (l.country || '').toLowerCase().includes(search) ||
            (l.city || '').toLowerCase().includes(search) ||
            (l.detail || '').toLowerCase().includes(search) ||
            (l.topic || '').toLowerCase().includes(search)
        );
      }

      return sendJson(200, {
        ok: true,
        total: allLogs.length,
        filteredCount: filtered.length,
        logs: filtered.slice(0, limit),
        summary: buildSummary(allLogs),
        tunnelStatus,
        tunnelUrl: liveTunnelUrl,
        googleScriptUrl: config.googleScriptUrl || '',
        publishStatus,
        diskPath: LOGS_DIR
      });
    }

    // 5. 엑셀(CSV) 전체 내보내기
    if (req.method === 'GET' && pathname === '/api/export/csv') {
      if (!isAuthorizedRead(req, urlObj)) {
        return sendJson(401, { ok: false, error: 'Unauthorized' });
      }
      const csvRows = [CSV_HEADERS.map(escapeCsvCell).join(',')];
      for (const l of allLogs) {
        csvRows.push(logToCsvRow(l));
      }
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const fileName = `Inko_Activity_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`
      });
      return res.end(csvContent);
    }

    // 6. JSON 원본 전체 내보내기
    if (req.method === 'GET' && pathname === '/api/export/json') {
      if (!isAuthorizedRead(req, urlObj)) {
        return sendJson(401, { ok: false, error: 'Unauthorized' });
      }
      const fileName = `Inko_Activity_Logs_${new Date().toISOString().slice(0, 10)}.json`;
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`
      });
      return res.end(JSON.stringify({ exportedAt: new Date().toISOString(), total: allLogs.length, logs: allLogs }, null, 2));
    }

    // 7. 서버 설정 업데이트 & 구글 시트 동기화
    if (req.method === 'POST' && pathname === '/api/config') {
      if (!isAuthorizedRead(req, urlObj)) {
        return sendJson(401, { ok: false, error: 'Unauthorized' });
      }
      const body = JSON.parse((await readBody(req)) || '{}');
      if (typeof body.googleScriptUrl === 'string') {
        config.googleScriptUrl = body.googleScriptUrl.trim();
      }
      if (typeof body.adminKey === 'string' && body.adminKey.trim()) {
        config.adminKey = body.adminKey.trim();
      }
      saveConfig(config);

      let syncRes = { synced: 0 };
      if (config.googleScriptUrl) {
        syncRes = await syncFromGoogleSheets();
      }
      if (body.publishToGitHub) {
        publishEndpointToGitHub();
      }
      return sendJson(200, { ok: true, config: { googleScriptUrl: config.googleScriptUrl }, syncRes, publishStatus });
    }

    // 8. 터널 시작 및 GitHub 엔드포인트 발행 제어
    if (req.method === 'POST' && pathname === '/api/tunnel/start') {
      if (!isAuthorizedRead(req, urlObj)) return sendJson(401, { ok: false, error: 'Unauthorized' });
      startCloudflareTunnel(true);
      return sendJson(200, { ok: true, status: tunnelStatus, url: liveTunnelUrl, message: 'Cloudflare 무료 HTTPS 터널을 시작했습니다.' });
    }

    if (req.method === 'POST' && pathname === '/api/tunnel/publish') {
      if (!isAuthorizedRead(req, urlObj)) return sendJson(401, { ok: false, error: 'Unauthorized' });
      const pub = publishEndpointToGitHub();
      return sendJson(200, { ...pub });
    }

    // 9. 구글 시트 즉시 동기화
    if (req.method === 'POST' && pathname === '/api/sync-sheets') {
      if (!isAuthorizedRead(req, urlObj)) return sendJson(401, { ok: false, error: 'Unauthorized' });
      const syncRes = await syncFromGoogleSheets();
      return sendJson(200, { ok: true, ...syncRes, total: allLogs.length });
    }

    // 10. 안전한 아카이브 백업 후 활성 로그 비우기 (절대 데이터 유실 없음)
    if ((req.method === 'POST' || req.method === 'DELETE') && pathname === '/api/archive-clear') {
      if (!isAuthorizedRead(req, urlObj)) {
        return sendJson(401, { ok: false, error: 'Unauthorized' });
      }
      let archivePath = '';
      if (fs.existsSync(MASTER_JSONL) && allLogs.length > 0) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        archivePath = path.join(ARCHIVE_DIR, `activity_logs_archived_${stamp}.jsonl`);
        fs.copyFileSync(MASTER_JSONL, archivePath);
        fs.writeFileSync(MASTER_JSONL, '', 'utf8');
      }
      allLogs = [];
      logIdSet.clear();
      return sendJson(200, {
        ok: true,
        archivedTo: archivePath,
        message: archivePath
          ? `기존 로그를 [${archivePath}]에 안전하게 보관한 뒤 목록을 비웠습니다.`
          : '비울 로그가 없습니다.'
      });
    }

    return sendJson(404, { ok: false, error: 'Not Found' });
  } catch (err) {
    console.error('[PC 로그서버 오류]:', err);
    return sendJson(500, { ok: false, error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================================');
  console.log(`🚀 [Inko 내 PC 로그 백업 서버] 가동 시작!`);
  console.log(`🏠 로컬 모니터 대시보드 : http://localhost:${PORT}`);
  console.log(`📱 동일 Wi-Fi 접속 주소 : http://${getLocalLanIp()}:${PORT}`);
  console.log(`💾 자동 백업 저장 폴더  : ${LOGS_DIR}`);
  console.log('==============================================================');

  if (config.googleScriptUrl) {
    syncFromGoogleSheets();
  }
  if (AUTO_TUNNEL) {
    startCloudflareTunnel(AUTO_PUBLISH || config.autoPublishEndpoint);
  } else if (AUTO_PUBLISH && config.googleScriptUrl) {
    publishEndpointToGitHub();
  }
});

