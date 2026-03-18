/**
 * Google Drive API 연동 전용 모듈
 * 인가(OAuth 2.0)된 Access Token을 사용하여 백업 및 복원을 수행합니다.
 */

const BACKUP_FILE_NAME = 'indo-word-app-backup.json';

/**
 * 구글 드라이브에서 이전 백업 파일이 있는지 검색합니다.
 */
export const searchBackupFile = async (accessToken) => {
  const query = `name = '${BACKUP_FILE_NAME}' and trashed = false`;
  const endpoint = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, modifiedTime)`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`드라이브 파일 검색 실패 (${response.status}): ${errorData.error?.message || '알 수 없는 오류'}`);
  }

  const data = await response.json();
  return data.files.length > 0 ? data.files[0] : null;
};

/**
 * 구글 드라이브에 데이터를 업로드(백업)합니다.
 * 파일이 이미 있으면 업데이트하고, 없으면 새로 만듭니다.
 */
export const uploadBackupToDrive = async (accessToken, backupData) => {
  const existingFile = await searchBackupFile(accessToken);
  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
  };

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append(
    'file',
    new Blob([JSON.stringify(backupData)], { type: 'application/json' })
  );

  let endpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';

  if (existingFile) {
    // 기존 파일 업데이트용 주소
    endpoint = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
    method = 'PATCH';
  }

  const response = await fetch(endpoint, {
    method: method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`드라이브 업로드 실패 (${response.status}): ${errorData.error?.message || '알 수 없는 오류'}`);
  }

  return await response.json();
};

/**
 * 구글 드라이브에서 백업 파일을 다운로드하여 데이터를 파싱합니다.
 */
export const downloadBackupFromDrive = async (accessToken, fileId) => {
  const endpoint = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`드라이브 파일 다운로드 실패 (${response.status}): ${errorData.error?.message || '알 수 없는 오류'}`);
  }

  return await response.json();
};
