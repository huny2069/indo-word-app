/**
 * [100% 평생 무료 · 24시간 무중단] Inko Nana Pro — Google 스프레드시트 활동 로그 서버 (Google Apps Script)
 *
 * [1분 설치 방법]
 * 1. 새 구글 스프레드시트(https://sheets.new)를 하나 만듭니다.
 * 2. 상단 메뉴 [확장 프로그램] -> [Apps Script]를 클릭합니다.
 * 3. 기존 코드를 모두 지우고 아래 코드를 붙여넣은 뒤 저장(Ctrl+S)합니다.
 * 4. 우측 상단 [배포] -> [새 배포] -> 유형 선택(⚙️)에서 [웹 앱]을 선택합니다.
 * 5. [다음 사용자 인증 정보로 실행]: "나" / [액세스 권한이 있는 사용자]: "모든 사용자" 로 설정 후 [배포] 클릭!
 * 6. 생성된 웹 앱 URL (https://script.google.com/macros/s/.../exec)을 복사하여
 *    앱의 [중앙 통계] -> [서버 연결 설정]에 붙여넣으면 내 PC가 꺼져 있을 때도 24시간 모든 로그가 기록되며,
 *    내 PC 서버를 켜면 자동으로 내 컴퓨터 하드디스크(CSV/JSONL)로도 동기화 백업됩니다!
 */

const SHEET_NAME = 'ActivityLogs';
const ADMIN_KEY = 'inko-admin-2026'; // 필요 시 원하는 관리자 비밀번호로 변경하세요

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

    // 최근 500개 ID 중복 검사
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

      rowsToAppend.push(HEADERS.map(key => {
        if (key === 'id') return id;
        const val = log[key];
        return (val === undefined || val === null) ? '' : val;
      }));
    });

    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, HEADERS.length).setValues(rowsToAppend);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, saved: rowsToAppend.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    if (ADMIN_KEY && params.adminKey && params.adminKey !== ADMIN_KEY) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, total: 0, logs: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const limit = Math.min(Number(params.limit || 1000), 3000);
    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - startRow + 1;
    const values = sheet.getRange(startRow, 1, numRows, HEADERS.length).getValues();

    const logs = values.map(row => {
      const obj = {};
      HEADERS.forEach((h, idx) => {
        obj[h] = row[idx];
      });
      obj.tokens_used = Number(obj.tokens_used || 0);
      obj.cost_usd = Number(obj.cost_usd || 0);
      obj.source = 'google-sheets';
      return obj;
    }).reverse();

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, total: lastRow - 1, logs: logs }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
