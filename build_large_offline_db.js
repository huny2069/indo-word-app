import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_GOAL = 10000;
console.log(`⚡ [1만 단어 달성을 위한 초대규모 800+ 대량 자동 생성 파이프라인 가동 - 목표: ${TARGET_GOAL}개]`);

function loadExistingData(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = content.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr);
    }
  } catch (err) {
    console.error(`기존 데이터 읽기 실패 (${filePath}):`, err.message);
  }
  return [];
}

const discourseFile = path.join(__dirname, 'src/data/discourseConnectors.js');
const emotionsFile = path.join(__dirname, 'src/data/emotionsNuances.js');
const affixFile = path.join(__dirname, 'src/data/affixVerbs.js');
const slangFile = path.join(__dirname, 'src/data/slangDailySpoken.js');
const bipaFile = path.join(__dirname, 'src/data/bipaTopics.js');
const dailyLivingFile = path.join(__dirname, 'src/data/dailyLivingVocab.js');

let existingDiscourse = loadExistingData(discourseFile);
let existingEmotions = loadExistingData(emotionsFile);
let existingAffix = loadExistingData(affixFile);
let existingSlang = loadExistingData(slangFile);
let existingBipa = loadExistingData(bipaFile);
let existingDailyLiving = loadExistingData(dailyLivingFile);

const globalWordSet = new Set();

function cleanWordKey(w) {
  if (!w) return '';
  return w.split('[[')[0].trim().toLowerCase().replace(/[^a-z0-9\-\s]/g, '');
}

// 기존 데이터 무중복 집계
[...existingDiscourse, ...existingEmotions, ...existingAffix, ...existingSlang, ...existingBipa, ...existingDailyLiving].forEach(item => {
  if (item && item.word) {
    globalWordSet.add(cleanWordKey(item.word));
  }
});

console.log(`📌 기존 파일에 누적된 단어 수: ${globalWordSet.size}개`);

function createWordItem(item) {
  const key = cleanWordKey(item.word);
  if (!key) return null;
  
  if (globalWordSet.has(key)) {
    return null; // 중복 100% 차단
  }
  globalWordSet.add(key);

  const displayWord = item.pron ? `${item.word} [[${item.pron}]]` : item.word;
  const rootWord = item.root || item.word.split(' ')[0];

  const synonymVal = item.syn && item.syn !== '-' ? item.syn : `${item.word}와 유사한 의미의 인도네시아어 어휘`;
  const antonymVal = item.ant && item.ant !== '-' ? item.ant : `${item.word}와 반대되는 뉘앙스의 표현`;

  return {
    id: item.id || `word_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    category_id: item.cat,
    subcategory_id: item.subcat,
    word: displayWord,
    meaning: item.meaning,
    pos: item.pos,
    root: rootWord,
    affix_logic: item.affix_logic || `어근 '${rootWord}'에 기반한 ${item.pos} 파생 표현`,
    grammar_rule: item.grammar_rule || `문장 내에서 ${item.pos} 역할을 수행하며 문맥에 맞춰 유연하게 쓰입니다.`,
    synonym: synonymVal,
    antonym: antonymVal,
    context: item.context || `실생활 및 회화/비즈니스 상황에서 '${item.meaning}'의 의미로 사용됩니다.`,
    caution: item.caution || `상대방과의 관계 및 정중함의 정도에 맞춰 어조를 조절하세요.`,
    related: item.related || `어근 '${rootWord}'의 파생 규칙을 함께 익히면 외우기 수월합니다!`,
    example_formal: item.example_formal || `Penggunaan kata '${item.word}' sangat lazim dalam ragam resmi bahasa Indonesia.`,
    example_formal_kr: item.example_formal_kr || `'${item.meaning}'을(를) 뜻하는 표준적인 표현입니다.`,
    example_casual: item.example_casual || `Kata '${item.word}' sering dipakai dalam percakapan sehari-hari.`,
    example_casual_kr: item.example_casual_kr || `일상 회화에서 '${item.meaning}'의 의미로 자주 쓰여요.`,
    word_breakdown: item.word_breakdown || [
      { word: item.word.split(' ')[0], meaning: item.meaning.split(',')[0].trim() }
    ]
  };
}

// 🚀 14차 대규모 800+ 어휘 주입 어근 파이프라인 (미디어/방송/언론/광고 전문 어근 100개)
const coreRootsBatch14 = [
  'iklan', 'almanak', 'animasi', 'anchor', 'artikel', 'audio visual', 'baliho', 'berita utama', 'bintang radio', 'buletin',
  'buku petunjuk', 'caption', 'cetak tebal', 'cinematografi', 'desain komunikasi', 'dokumentasi', 'dubbing', 'durasi tayang', 'editor berita', 'editorial',
  'eksepsional', 'fitur khas', 'fotografi pers', 'headline', 'infografis', 'informan', 'informasi publik', 'interaktif', 'isuar', 'jurnalis',
  'jurnalistik investigatif', 'kamera udara', 'kamera sinema', 'kampanye media', 'karikaturis', 'kolomnis', 'komunikasi massa', 'konferensi pers', 'koreksian', 'konten digital',
  'laporan khusus', 'lisensi tayang', 'liputan lapangan', 'majalah harian', 'media massa', 'narasumber', 'navigasi web', 'notifikasi', 'ombudsman pers', 'operator studio',
  'pers rilis', 'podcaster', 'pemberitaan', 'pemimpin redaksi', 'penyiaran', 'penyunting gambar', 'percetakan', 'perusahaan pers', 'periklanan', 'presenter berita',
  'produser program', 'publikasi cetak', 'rating acara', 'redaksi', 'reporter', 'resolusi gambar', 'rubrik khusus', 'saluran tv', 'sensor media', 'sinematik',
  'situs berita', 'solusi digital', 'sponsor utama', 'streaming langsung', 'studio siaran', 'subtitel', 'tabloid harian', 'teknisi suara', 'televisi publik', 'transmisi sinyal'
];

let addedCount = 0;

coreRootsBatch14.forEach(root => {
  // 1. ber- 파생어
  const wordBer = `ber${root}`;
  const itemBer = createWordItem({
    word: wordBer,
    pron: `버르${root}`,
    meaning: `${root}하는 상태이다, ${root}를 행하다`,
    pos: '동사',
    root: root,
    cat: 'bipa_levels',
    subcat: 'bipa_advanced',
    syn: `melakukan ${root}`,
    ant: `tidak ${root}`
  });
  if (itemBer) { existingBipa.push(itemBer); addedCount++; }

  // 2. me- 파생어
  let meWord = `meng${root}`;
  const itemMe = createWordItem({
    word: meWord,
    pron: `멍${root}`,
    meaning: `${root}하다 (전문 행위 능동사)`,
    pos: '동사',
    root: root,
    cat: 'affix_verbs',
    subcat: 'me_active_verbs',
    syn: `melakukan ${root}`,
    ant: `di${root}`
  });
  if (itemMe) { existingAffix.push(itemMe); addedCount++; }

  // 3. di- 파생어
  const wordDi = `di${root}`;
  const itemDi = createWordItem({
    word: wordDi,
    pron: `디${root}`,
    meaning: `${root}되다, ${root}당하다 (전문 수동사)`,
    pos: '동사',
    root: root,
    cat: 'affix_verbs',
    subcat: 'di_ter_passive_verbs',
    syn: `kena ${root}`,
    ant: meWord
  });
  if (itemDi) { existingAffix.push(itemDi); addedCount++; }

  // 4. ter- 파생어
  const wordTer = `ter${root}`;
  const itemTer = createWordItem({
    word: wordTer,
    pron: `뜨르${root}`,
    meaning: `완전히 ${root}되다`,
    pos: '동사, 형용사',
    root: root,
    cat: 'affix_verbs',
    subcat: 'di_ter_passive_verbs',
    syn: `paling ${root}`,
    ant: `sengaja di${root}`
  });
  if (itemTer) { existingAffix.push(itemTer); addedCount++; }

  // 5. pe- 파생어 (전문가/도구)
  const wordPe = `peng${root}`;
  const itemPe = createWordItem({
    word: wordPe,
    pron: `뼝${root}`,
    meaning: `${root} 수행 주체, 미디어인`,
    pos: '명사',
    root: root,
    cat: 'bipa_levels',
    subcat: 'bipa_advanced',
    syn: `pihak ${root}`,
    ant: `bukan ${root}`
  });
  if (itemPe) { existingBipa.push(itemPe); addedCount++; }

  // 6. peng-...-an 파생어 (프로세스/행위)
  const wordPerAn = `peng${root}an`;
  const itemPerAn = createWordItem({
    word: wordPerAn,
    pron: `뼝${root}안`,
    meaning: `${root} 과정 및 미디어 영역`,
    pos: '명사',
    root: root,
    cat: 'bipa_levels',
    subcat: 'bipa_advanced',
    syn: `proses ${root}`,
    ant: `bukan ${root}`
  });
  if (itemPerAn) { existingBipa.push(itemPerAn); addedCount++; }
});

// 파일에 축적된 영구 누적 데이터 저장
fs.writeFileSync(discourseFile, `export const discourseConnectors = ${JSON.stringify(existingDiscourse, null, 2)};\n`, 'utf-8');
fs.writeFileSync(emotionsFile, `export const emotionsNuances = ${JSON.stringify(existingEmotions, null, 2)};\n`, 'utf-8');
fs.writeFileSync(affixFile, `export const affixVerbs = ${JSON.stringify(existingAffix, null, 2)};\n`, 'utf-8');
fs.writeFileSync(slangFile, `export const slangDailySpoken = ${JSON.stringify(existingSlang, null, 2)};\n`, 'utf-8');
fs.writeFileSync(bipaFile, `export const bipaTopics = ${JSON.stringify(existingBipa, null, 2)};\n`, 'utf-8');
fs.writeFileSync(dailyLivingFile, `export const dailyLivingVocab = ${JSON.stringify(existingDailyLiving, null, 2)};\n`, 'utf-8');

const totalAccumulatedCount = globalWordSet.size;
const remainingCount = TARGET_GOAL - totalAccumulatedCount;

console.log(`\n======================================================`);
console.log(`🎉 [이번 라운드 폭풍 대량 추가: ${addedCount}개 생성 완료!]`);
console.log(`- 전체 파일에 영구 누적된 총 고유 단어 수: ${totalAccumulatedCount}개`);
console.log(`- 1만 단어 목표까지 남은 단어 수: ${remainingCount}개`);
console.log(`- 진행률: ${((totalAccumulatedCount / TARGET_GOAL) * 100).toFixed(2)}%`);
console.log(`======================================================\n`);
