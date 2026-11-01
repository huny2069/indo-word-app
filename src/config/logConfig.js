/**
 * 중앙 통계 및 무료 실시간 활동 로그 서버 설정
 * - 유료 DB 없이 내 컴퓨터(PC) 로컬/터널 서버 및 무료 Google 스프레드시트 웹훅과 자동 연동됩니다.
 */

export const DEFAULT_ADMIN_EMAILS = [
  'wkdehrkd2069@gmail.com',
  'wkdehrkd2069',
  'wkdehrkd2066@gmail.com',
  'wkdehrkd2066',
  'huny2065@gmail.com',
  ...((typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAIL) || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean)
];

export const DEFAULT_ADMIN_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOG_ADMIN_KEY) || 'inko-admin-2026';

// 내 PC 서버(1_내PC_외부연결_로그서버_시작.bat)가 자동 발행하는 글로벌 엔드포인트 디스커버리 주소
export const LIVE_ENDPOINT_DISCOVERY_URL =
  'https://raw.githubusercontent.com/huny2069/indo-word-app/log-endpoint/endpoint.json';

export const DEFAULT_PC_SERVER_URL =
  ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOG_SERVER_URL) || '').trim();
export const DEFAULT_GOOGLE_SCRIPT_URL =
  ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_SCRIPT_URL) || '').trim();

/**
 * 관리자 권한 확인 헬퍼
 * - 오직 지정된 구글 계정(wkdehrkd2066 / wkdehrkd2066@gmail.com / huny2065@gmail.com / VITE_ADMIN_EMAIL)으로
 *   로그인한 사용자만 접근 가능하도록 엄격히 제한합니다.
 */
export const isAdminUser = (user = null) => {
  try {
    let email = (user?.email || '').toLowerCase().trim();
    if (!email && typeof window !== 'undefined') {
      try {
        const savedAuth = JSON.parse(localStorage.getItem('auth_user') || 'null');
        email = (savedAuth?.email || localStorage.getItem('user_email') || '').toLowerCase().trim();
      } catch {
        email = (localStorage.getItem('user_email') || '').toLowerCase().trim();
      }
    }

    if (!email) return false;

    return DEFAULT_ADMIN_EMAILS.some((adm) => {
      const cleanAdm = adm.toLowerCase().trim();
      return email === cleanAdm || email.split('@')[0] === cleanAdm || cleanAdm.split('@')[0] === email;
    });
  } catch {
    return false;
  }
};

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `const SHEET_NAME = 'ActivityLogs';
const ADMIN_KEY = 'inko-admin-2026';

const HEADERS = [
  'kst_time', 'created_at', 'email', 'user_name', 'user_id',
  'country', 'country_code', 'flag', 'city', 'region', 'isp', 'ip',
  'action_type', 'action_label', 'detail', 'topic',
  'user_lang', 'study_lang', 'tokens_used', 'cost_usd',
  'device', 'path', 'user_agent', 'id'
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#fef3c7');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = getOrCreateSheet();
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const parsed = JSON.parse(raw);
    const logs = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.logs) ? parsed.logs : [parsed]);

    const lastRow = sheet.getLastRow();
    const existingIds = new Set();
    if (lastRow > 1) {
      const startRow = Math.max(2, lastRow - 500);
      const idColIdx = HEADERS.indexOf('id') + 1;
      const idVals = sheet.getRange(startRow, idColIdx, lastRow - startRow + 1, 1).getValues();
      idVals.forEach(r => { if (r[0]) existingIds.add(String(r[0])); });
    }

    const rowsToAppend = [];
    logs.forEach(log => {
      if (!log || typeof log !== 'object') return;
      const id = String(log.id || ('gs_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 7)));
      if (existingIds.has(id)) return;
      existingIds.add(id);
      rowsToAppend.push(HEADERS.map(key => key === 'id' ? id : (log[key] == null ? '' : log[key])));
    });

    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, HEADERS.length).setValues(rowsToAppend);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, saved: rowsToAppend.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    if (ADMIN_KEY && params.adminKey && params.adminKey !== ADMIN_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, total: 0, logs: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const limit = Math.min(Number(params.limit || 1000), 3000);
    const startRow = Math.max(2, lastRow - limit + 1);
    const values = sheet.getRange(startRow, 1, lastRow - startRow + 1, HEADERS.length).getValues();
    const logs = values.map(row => {
      const obj = {};
      HEADERS.forEach((h, idx) => { obj[h] = row[idx]; });
      obj.tokens_used = Number(obj.tokens_used || 0);
      obj.cost_usd = Number(obj.cost_usd || 0);
      obj.source = 'google-sheets';
      return obj;
    }).reverse();
    return ContentService.createTextOutput(JSON.stringify({ ok: true, total: lastRow - 1, logs: logs }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

