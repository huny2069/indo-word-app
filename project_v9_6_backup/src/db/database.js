import { openDB } from 'idb';

const DB_NAME = 'indo_learn_db';
const DB_VERSION = 1;

export const initDB = async () => {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('words')) {
        const wordStore = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
        wordStore.createIndex('word', 'word', { unique: false });
        wordStore.createIndex('folderId', 'folderId', { unique: false });
        wordStore.createIndex('created_at', 'created_at', { unique: false });
        wordStore.createIndex('level', 'level', { unique: false });
      }
      if (!db.objectStoreNames.contains('folders')) {
        const folderStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
        folderStore.createIndex('name', 'name', { unique: true });
      }
      if (!db.objectStoreNames.contains('stats')) {
        db.createObjectStore('stats', { keyPath: 'date' }); // YYYY-MM-DD
      }
      if (!db.objectStoreNames.contains('cart')) {
        db.createObjectStore('cart', { keyPath: 'wordId' });
      }
    },
  });
};

// --- Folders API ---
export const addFolder = async (name) => {
  const db = await initDB();
  return db.add('folders', { name, created_at: new Date().toISOString() });
};

export const getFolders = async () => {
  const db = await initDB();
  return db.getAll('folders');
};

export const deleteFolder = async (id) => {
  const db = await initDB();
  return db.delete('folders', id);
};

// --- Words API ---
export const addWord = async (wordData) => {
  const db = await initDB();
  // 중복 단어 검증: 대소문자 무시하고 찾음
  const existingWords = await db.getAllFromIndex('words', 'word');
  const isDuplicate = existingWords.some(w => w.word.toLowerCase() === wordData.word.toLowerCase());
  
  if (isDuplicate) {
    throw new Error(`이미 존재하는 단어입니다: ${wordData.word}`);
  }

  const wordEntry = {
    ...wordData,
    created_at: new Date().toISOString(),
    level: 0, // 라이트너 초기 레벨 (0: 미암기)
    next_review_date: new Date().toISOString(),
  };

  return db.add('words', wordEntry);
};

export const getWords = async (folderId = null) => {
  const db = await initDB();
  if (folderId) {
    return db.getAllFromIndex('words', 'folderId', folderId);
  }
  return db.getAll('words');
};

export const deleteWords = async (ids) => {
  const db = await initDB();
  const tx = db.transaction('words', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
};

export const updateWord = async (wordData) => {
  const db = await initDB();
  return db.put('words', wordData);
};

export const moveWordsToFolder = async (wordIds, newFolderId) => {
  const db = await initDB();
  const tx = db.transaction('words', 'readwrite');
  for (const id of wordIds) {
    const word = await tx.store.get(id);
    if (word) {
      word.folderId = newFolderId;
      await tx.store.put(word);
    }
  }
  await tx.done;
};

// --- Cart API (장바구니) ---
export const toggleCartItem = async (wordId) => {
  const db = await initDB();
  const existing = await db.get('cart', wordId);
  if (existing) {
    await db.delete('cart', wordId);
    return false; // 표시 해제
  } else {
    await db.put('cart', { wordId });
    return true; // 담김
  }
};

export const getCartItemIds = async () => {
  const db = await initDB();
  const items = await db.getAll('cart');
  return items.map(item => item.wordId);
};

export const getCartWords = async () => {
  const db = await initDB();
  const cartEntries = await db.getAll('cart');
  const wordIds = cartEntries.map(entry => entry.wordId);
  
  const words = [];
  const tx = db.transaction('words', 'readonly');
  for (const id of wordIds) {
    const w = await tx.store.get(id);
    if (w) words.push(w);
  }
  return words;
};

export const clearCart = async () => {
  const db = await initDB();
  await db.clear('cart');
};

export const addWordsToCart = async (wordIds) => {
  const db = await initDB();
  const tx = db.transaction('cart', 'readwrite');
  for (const id of wordIds) {
    await tx.store.put({ wordId: id });
  }
  await tx.done;
};

export const removeWordsFromCart = async (wordIds) => {
  const db = await initDB();
  const tx = db.transaction('cart', 'readwrite');
  for (const id of wordIds) {
    await tx.store.delete(id);
  }
  await tx.done;
};
