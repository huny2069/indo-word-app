import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_GOAL = 10000;
console.log(`⚡ [1만 단어 도달을 위한 영구 누적 데이터베이스 확장 가동 - 목표: ${TARGET_GOAL}개]`);

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

console.log(`📌 기존 파일에 남아있는 고유 단어 수: ${globalWordSet.size}개`);

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
    affix_logic: item.affix_logic || `어근 '${rootWord}'에 기반한 ${item.pos} 어휘`,
    grammar_rule: item.grammar_rule || `문장 내에서 ${item.pos}의 역할을 하며 유연하게 활용됩니다.`,
    synonym: synonymVal,
    antonym: antonymVal,
    context: item.context || `실생활 및 회화/비즈니스 상황에서 '${item.meaning}'의 의미로 쓰입니다.`,
    caution: item.caution || `상대방과의 관계 및 문맥에 맞추어 사용하세요.`,
    related: item.related || `어근 '${rootWord}'의 파생 규칙을 함께 익히세요!`,
    example_formal: item.example_formal || `Penggunaan kata '${item.word}' sangat lazim dalam bahasa Indonesia standar.`,
    example_formal_kr: item.example_formal_kr || `'${item.meaning}'을(를) 뜻하는 격식체 표현입니다.`,
    example_casual: item.example_casual || `Kata '${item.word}' sering dipakai dalam percakapan sehari-hari.`,
    example_casual_kr: item.example_casual_kr || `일상 회화에서 '${item.meaning}'의 의미로 자주 쓰여요.`,
    word_breakdown: item.word_breakdown || [
      { word: item.word.split(' ')[0], meaning: item.meaning.split(',')[0].trim() }
    ]
  };
}

// 🚀 대규모 어휘 재충전 (실생활 20대 테마, BIPA, 슬랭, 접사파생동사, 연결어 등)
const newWordsBatch = [
  // 1. Discourse Connectors
  { word: 'dengan kata lain', pron: '등안 까따 라인', meaning: '다시 말해서', pos: '부사구', root: 'kata', cat: 'discourse', subcat: 'logic_connectors', syn: 'yaitu, yakni', ant: 'sebaliknya' },
  { word: 'singkat kata', pron: '싱깟 까따', meaning: '요약하자면, 한마디로', pos: '부사구', root: 'singkat', cat: 'discourse', subcat: 'logic_connectors', syn: 'ringkasnya', ant: 'panjang lebar' },
  { word: 'ringkasnya', pron: '링까스냐', meaning: '간단히 말해', pos: '부사', root: 'ringkas', cat: 'discourse', subcat: 'logic_connectors', syn: 'singkatnya', ant: 'secara mendetail' },
  { word: 'pada umumnya', pron: '빠다 우뭄냐', meaning: '일반적으로는', pos: '부사구', root: 'umum', cat: 'discourse', subcat: 'logic_connectors', syn: 'secara umum', ant: 'khususnya' },
  { word: 'khusus untuk', pron: '쿠수스 운뚝', meaning: '특별히 ~를 위해', pos: '전치사구', root: 'khusus', cat: 'discourse', subcat: 'logic_connectors', syn: 'terutama untuk', ant: 'secara acak' },

  // 2. Emotions & Nuances
  { word: 'cemburu buta', pron: '쩜부루 부따', meaning: '눈먼 질투를 하다', pos: '형용사구', root: 'cemburu', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'iri sekali', ant: 'percaya penuh' },
  { word: 'berjiwa besar', pron: '버르지와 브사르', meaning: '도량이 넓다', pos: '형용사구', root: 'jiwa', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'lapang dada', ant: 'sempit hati' },
  { word: 'sempit hati', pron: '슴빳 하티', meaning: '속이 좁다, 소심하다', pos: '형용사구', root: 'sempit', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'kikir, picik', ant: 'berjiwa besar' },
  { word: 'besar kepala', pron: '브사르 끄빨라', meaning: '우쭐대다, 오만하다', pos: '형용사구', root: 'besar', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'sombong, angkuh', ant: 'rendah hati' },

  // 3. Affix Verbs
  { word: 'memimpin', pron: '머ميم삔', meaning: '이끌다, 리도하다', pos: '동사', root: 'pimpin', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'mengarahkan', ant: 'mengikuti' },
  { word: 'mengikuti', pron: '멍이꾸띠', meaning: '따르다, 주시하다', pos: '동사', root: 'ikut', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'mengekor', ant: 'memimpin' },
  { word: 'mengakhiri', pron: '멍아키리', meaning: '매듭짓다, 종결하다', pos: '동사', root: 'akhir', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'menuntaskan', ant: 'memulai' },
  { word: 'memulai', pron: '멈무라이', meaning: '착수하다, 대두되다', pos: '동사', root: 'mula', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'mengawali', ant: 'mengakhiri' },

  // 4. Slang & Spoken
  { word: 'mageran parah', pron: '마게란 빠라', meaning: '극강의 귀차니스트', pos: '형용사구', root: 'gerak', cat: 'slang_daily_spoken', subcat: 'slang_abbreviations', syn: 'pemalas sekali', ant: 'rajin banget' },
  { word: 'baperan banget', pron: '바뻬란 방앗', meaning: '엄청 유리멘탈인', pos: '형용사구', root: 'rasa', cat: 'slang_daily_spoken', subcat: 'slang_abbreviations', syn: 'sensitif sekali', ant: 'cuek habisan' },

  // 5. BIPA Topics
  { word: 'kebijakan publik', pron: '끄비자깐 뿌블릭', meaning: '공공 정책', pos: '명사구', root: 'bijak', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'peraturan pemerintah', ant: 'kebijakan pribadi' },
  { word: 'hubungan bilateral', pron: '후붕안 비라뜨랄', meaning: '양국 외교 관계', pos: '명사구', root: 'hubung', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'kerjasama antarnegara', ant: 'konflik' },

  // 6. Daily Living Vocab
  { word: 'kopi tubruk', pron: '꼬삐 뚜브룩', meaning: '인도네시아 전통 가루 커피', pos: '명사구', root: 'kopi', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'kopi hitam tradisional', ant: 'kopi instan' },
  { word: 'kopi susu gula aren', pron: '꼬삐 수수 굴라 아렌', meaning: '야자당 라떼 커피', pos: '명사구', root: 'kopi', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'kopi aren', ant: 'air teh' },
  { word: 'kerupuk', pron: '끄루뿍', meaning: '인도네시아 전통 튀김 칩', pos: '명사', root: 'kerupuk', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'krupuk renyah', ant: 'nasi' },
  { word: 'papan tulis', pron: '빠판 뚜리스', meaning: '칠판, 화이트보드', pos: '명사구', root: 'papan', cat: 'daily_living_themes', subcat: 'home_appliances_living', syn: 'board', ant: 'buku' },
  { word: 'kartu nama', pron: '까르뚜 나마', meaning: '비즈니스 명함', pos: '명사구', root: 'kartu', cat: 'daily_living_themes', subcat: 'home_appliances_living', syn: 'namecard', ant: 'surat' }
];

newWordsBatch.forEach(item => {
  const itemCompiled = createWordItem(item);
  if (itemCompiled) {
    if (item.cat === 'discourse') existingDiscourse.push(itemCompiled);
    else if (item.cat === 'emotions_nuances') existingEmotions.push(itemCompiled);
    else if (item.cat === 'affix_verbs') existingAffix.push(itemCompiled);
    else if (item.cat === 'slang_daily_spoken') existingSlang.push(itemCompiled);
    else if (item.cat === 'bipa_levels') existingBipa.push(itemCompiled);
    else if (item.cat === 'daily_living_themes') existingDailyLiving.push(itemCompiled);
  }
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
console.log(`🎉 [누적 단어 검증 및 확장 성공]`);
console.log(`- 파일에 누적 수록된 총 고유 단어 수: ${totalAccumulatedCount}개`);
console.log(`- 1만 단어 목표까지 남은 단어 수: ${remainingCount}개`);
console.log(`- 진행률: ${((totalAccumulatedCount / TARGET_GOAL) * 100).toFixed(2)}%`);
console.log(`======================================================\n`);
