import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_GOAL = 10000;
console.log(`⚡ [1만 단어 영구 누적 데이터베이스 생성 엔진 가동 - 목표: ${TARGET_GOAL}개]`);

// 1. 기존 데이터 파일들 읽어오기 (덮어쓰지 않고 기존 데이터 보존!)
function loadExistingData(filePath, exportName) {
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

let existingDiscourse = loadExistingData(discourseFile, 'discourseConnectors');
let existingEmotions = loadExistingData(emotionsFile, 'emotionsNuances');
let existingAffix = loadExistingData(affixFile, 'affixVerbs');
let existingSlang = loadExistingData(slangFile, 'slangDailySpoken');
let existingBipa = loadExistingData(bipaFile, 'bipaTopics');
let existingDailyLiving = loadExistingData(dailyLivingFile, 'dailyLivingVocab');

const globalWordSet = new Set();

function cleanWordKey(w) {
  if (!w) return '';
  return w.split('[[')[0].trim().toLowerCase().replace(/[^a-z0-9\-\s]/g, '');
}

// 기존 데이터들을 globalWordSet에 등록
[...existingDiscourse, ...existingEmotions, ...existingAffix, ...existingSlang, ...existingBipa, ...existingDailyLiving].forEach(item => {
  if (item && item.word) {
    globalWordSet.add(cleanWordKey(item.word));
  }
});

console.log(`📌 기존 파일에서 로드된 고유 단어 수: ${globalWordSet.size}개`);

function createWordItem(item) {
  const key = cleanWordKey(item.word);
  if (!key) return null;
  
  if (globalWordSet.has(key)) {
    return null; // 중복 100% 차단
  }
  globalWordSet.add(key);

  const displayWord = item.pron ? `${item.word} [[${item.pron}]]` : item.word;
  const rootWord = item.root || item.word.split(' ')[0];

  const synonymVal = item.syn && item.syn !== '-' ? item.syn : `${item.word}와 유사한 의미의 인도네시아어 표현`;
  const antonymVal = item.ant && item.ant !== '-' ? item.ant : `${item.word}와 반대되는 뉘앙스의 표현`;

  return {
    id: item.id || `word_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    category_id: item.cat,
    subcategory_id: item.subcat,
    word: displayWord,
    meaning: item.meaning,
    pos: item.pos,
    root: rootWord,
    affix_logic: item.affix_logic || `어근 '${rootWord}'에 기반한 ${item.pos} 파생 어휘`,
    grammar_rule: item.grammar_rule || `문장 내에서 ${item.pos}의 역할을 하며 유연하게 활용됩니다.`,
    synonym: synonymVal,
    antonym: antonymVal,
    context: item.context || `실생활 대화 및 비즈니스 상황에서 '${item.meaning}'의 의미로 쓰입니다.`,
    caution: item.caution || `상대방과의 관계에 따라 어조를 조절하세요.`,
    related: item.related || `어근 '${rootWord}'와 관련된 어휘 파생어를 함께 공부해보세요.`,
    example_formal: item.example_formal || `Penggunaan kata '${item.word}' sangat lazim dalam ragam resmi bahasa Indonesia.`,
    example_formal_kr: item.example_formal_kr || `'${item.meaning}'을(를) 뜻하는 표준적인 표현입니다.`,
    example_casual: item.example_casual || `Kata '${item.word}' sering dipakai dalam percakapan sehari-hari.`,
    example_casual_kr: item.example_casual_kr || `일상 회화에서 '${item.meaning}'의 의미로 자주 쓰여요.`,
    word_breakdown: item.word_breakdown || [
      { word: item.word.split(' ')[0], meaning: item.meaning.split(',')[0].trim() }
    ]
  };
}

// 2. 대규모 신규 단어 데이터셋 계속 추가!
const newDiscourseList = [
  { word: 'pada dasarnya', pron: '빠다 다사르냐', meaning: '기본적으로', pos: '부사구', root: 'dasar', cat: 'discourse', subcat: 'logic_connectors', syn: 'secara umum', ant: 'khususnya' },
  { word: 'pada hakikatnya', pron: '빠다 하끼깟냐', meaning: '본질적으로는', pos: '부사구', root: 'hakikat', cat: 'discourse', subcat: 'logic_connectors', syn: 'sebenarnya', ant: 'tampaknya' },
  { word: 'secara umum', pron: '스짜라 우뭄', meaning: '일반적으로', pos: '부사구', root: 'umum', cat: 'discourse', subcat: 'logic_connectors', syn: 'pada umumnya', ant: 'khususnya' },
  { word: 'terlebih lagi', pron: '뜨르러비 라기', meaning: '하물며, 더군다나', pos: '부사구', root: 'lebih', cat: 'discourse', subcat: 'logic_connectors', syn: 'lagipula', ant: 'hanya saja' },
  { word: 'sebagaimana', pron: '스바가이마나', meaning: '~인 바와 같이', pos: '접속사', root: 'bagaimana', cat: 'discourse', subcat: 'logic_connectors', syn: 'seperti halnya', ant: 'berbeda dari' }
];

const newEmotionsList = [
  { word: 'mabuk kepayang', pron: '마북 끄빠양', meaning: '상사병에 걸리다', pos: '형용사구', root: 'mabuk', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'bucin parah', ant: 'benci' },
  { word: 'berbunga-bunga', pron: '버르붕아붕아', meaning: '가슴이 설레다', pos: '형용사', root: 'bunga', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'senang sekali', ant: 'gundah' },
  { word: 'malu-malu kucing', pron: '말루말루 꿀찡', meaning: '내숭 떨다', pos: '형용사구', root: 'malu', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'jaim', ant: 'blak-blakan' },
  { word: 'iri dengki', pron: '이리 덩끼', meaning: '시기 질투하다', pos: '형용사구', root: 'iri', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'cemburu', ant: 'tulus' }
];

const newAffixList = [
  { word: 'mendorong', pron: '믄도롱', meaning: '밀다, 촉진하다', pos: '동사', root: 'dorong', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'memotivasi', ant: 'menarik' },
  { word: 'menarik', pron: '머나릭', meaning: '끌다, 매력적이다', pos: '동사', root: 'tarik', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'memikat', ant: 'mendorong' },
  { word: 'mengunjungi', pron: '멍운중이', meaning: '방문하다', pos: '동사', root: 'kunjung', cat: 'affix_verbs', subcat: 'causative_locative_verbs', syn: 'mendatangi', ant: 'meninggalkan' },
  { word: 'merawat', pron: '머라왓', meaning: '돌보다, 가꾸다', pos: '동사', root: 'rawat', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'menjaga', ant: 'merusak' }
];

const newSlangList = [
  { word: 'tedeng aling-aling', pron: '뜨등 알링알링', meaning: '숨김없이 솔직한', pos: '형용사구', root: 'aling', cat: 'slang_daily_spoken', subcat: 'slang_abbreviations', syn: 'blak-blakan', ant: 'jaim' },
  { word: 'anak nongkrong', pron: '아낙 농끄롱', meaning: '카페/길거리 수다족', pos: '명사구', root: 'nongkrong', cat: 'slang_daily_spoken', subcat: 'daily_life_survival', syn: 'penggemar kumpul', ant: 'rumahan' }
];

const newBipaList = [
  { word: 'pemerintahan', pron: '쁘머린따한', meaning: '정부 행정', pos: '명사', root: 'perintah', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'kabinet', ant: 'oposisi' },
  { word: 'kemerdekaan', pron: '끄머르데까안', meaning: '독립, 자주', pos: '명사', root: 'merdeka', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'kebebasan', ant: 'penjajahan' }
];

const newDailyLivingList = [
  { word: 'ayam bakar', pron: '아얌 바까르', meaning: '숯불 닭구이', pos: '명사', root: 'bakar', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'ayam panggang', ant: 'ayam rebus' },
  { word: 'ikan goreng', pron: '이깐 고렝', meaning: '생선 튀김', pos: '명사', root: 'ikan', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'ikan krispi', ant: 'ikan kukus' },
  { word: 'jus alpukat', pron: '주스 알뿌깟', meaning: '아보카도 주스', pos: '명사', root: 'jus', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'olahan alpukat', ant: 'air putih' },
  { word: 'bandara', pron: '반다라', meaning: '공항', pos: '명사', root: 'udara', cat: 'daily_living_themes', subcat: 'transport_travel_map', syn: 'bandar udara', ant: 'stasiun' },
  { word: 'halte bus', pron: '할뜨 버스', meaning: '버스 정류장', pos: '명사', root: 'halte', cat: 'daily_living_themes', subcat: 'transport_travel_map', syn: 'stasiun bus', ant: 'terminal' }
];

// 신규 단어들 추가 누적
newDiscourseList.forEach((item, i) => {
  const wordObj = createWordItem({ ...item, id: `disc_${existingDiscourse.length + i + 1}` });
  if (wordObj) existingDiscourse.push(wordObj);
});

newEmotionsList.forEach((item, i) => {
  const wordObj = createWordItem({ ...item, id: `emo_${existingEmotions.length + i + 1}` });
  if (wordObj) existingEmotions.push(wordObj);
});

newAffixList.forEach((item, i) => {
  const wordObj = createWordItem({ ...item, id: `aff_${existingAffix.length + i + 1}` });
  if (wordObj) existingAffix.push(wordObj);
});

newSlangList.forEach((item, i) => {
  const wordObj = createWordItem({ ...item, id: `slang_${existingSlang.length + i + 1}` });
  if (wordObj) existingSlang.push(wordObj);
});

newBipaList.forEach((item, i) => {
  const wordObj = createWordItem({ ...item, id: `bipa_${existingBipa.length + i + 1}` });
  if (wordObj) existingBipa.push(wordObj);
});

newDailyLivingList.forEach((item, i) => {
  const wordObj = createWordItem({ ...item, id: `life_${existingDailyLiving.length + i + 1}` });
  if (wordObj) existingDailyLiving.push(wordObj);
});

// 파일에 누적 데이터 저장
fs.writeFileSync(discourseFile, `export const discourseConnectors = ${JSON.stringify(existingDiscourse, null, 2)};\n`, 'utf-8');
fs.writeFileSync(emotionsFile, `export const emotionsNuances = ${JSON.stringify(existingEmotions, null, 2)};\n`, 'utf-8');
fs.writeFileSync(affixFile, `export const affixVerbs = ${JSON.stringify(existingAffix, null, 2)};\n`, 'utf-8');
fs.writeFileSync(slangFile, `export const slangDailySpoken = ${JSON.stringify(existingSlang, null, 2)};\n`, 'utf-8');
fs.writeFileSync(bipaFile, `export const bipaTopics = ${JSON.stringify(existingBipa, null, 2)};\n`, 'utf-8');
fs.writeFileSync(dailyLivingFile, `export const dailyLivingVocab = ${JSON.stringify(existingDailyLiving, null, 2)};\n`, 'utf-8');

const totalAccumulatedCount = globalWordSet.size;
const remainingCount = TARGET_GOAL - totalAccumulatedCount;

console.log(`\n======================================================`);
console.log(`🎉 [누적 단어 카운트 검증 및 저장 성공]`);
console.log(`- 전체 파일에 영구 누적된 총 고유 단어 수: ${totalAccumulatedCount}개`);
console.log(`- 1만 단어 목표까지 남은 단어 수: ${remainingCount}개`);
console.log(`- 진행률: ${((totalAccumulatedCount / TARGET_GOAL) * 100).toFixed(2)}%`);
console.log(`======================================================\n`);
