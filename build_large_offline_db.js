import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_GOAL = 10000;
console.log(`⚡ [1만 단어 도달을 위한 대규모 어휘 폭풍 누적 생성 파이프라인 가동 - 목표: ${TARGET_GOAL}개]`);

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
    grammar_rule: item.grammar_rule || `문장 내에서 ${item.pos} 역할을 수행하며 표준적 및 실전 구어체로 사용됩니다.`,
    synonym: synonymVal,
    antonym: antonymVal,
    context: item.context || `실생활 및 회화/비즈니스 상황에서 '${item.meaning}'의 의미로 쓰입니다.`,
    caution: item.caution || `상대방과의 관계 및 정중함의 정도에 따라 어조를 조절하세요.`,
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

// 🚀 한번에 수백 개 대규모 어휘 주입 데이터셋
const massiveBatch = [
  // Discourse
  { word: 'dengan kata lain', pron: '등안 까따 라인', meaning: '다시 말해서', pos: '부사구', root: 'kata', cat: 'discourse', subcat: 'logic_connectors', syn: 'yaitu, yakni', ant: 'sebaliknya' },
  { word: 'singkat kata', pron: '싱깟 까따', meaning: '요약하자면', pos: '부사구', root: 'singkat', cat: 'discourse', subcat: 'logic_connectors', syn: 'ringkasnya', ant: 'panjang lebar' },
  { word: 'ringkasnya', pron: '링까스냐', meaning: '간단히 말해', pos: '부사', root: 'ringkas', cat: 'discourse', subcat: 'logic_connectors', syn: 'singkatnya', ant: 'secara mendetail' },
  { word: 'pada umumnya', pron: '빠다 우뭄냐', meaning: '일반적으로는', pos: '부사구', root: 'umum', cat: 'discourse', subcat: 'logic_connectors', syn: 'secara umum', ant: 'khususnya' },
  { word: 'khusus untuk', pron: '쿠수스 운뚝', meaning: '특별히 ~를 위해', pos: '전치사구', root: 'khusus', cat: 'discourse', subcat: 'logic_connectors', syn: 'terutama untuk', ant: 'secara acak' },
  { word: 'oleh sebab itu', pron: '올레 스밥 이뚜', meaning: '그러한 까닭으로', pos: '접속사', root: 'sebab', cat: 'discourse', subcat: 'logic_connectors', syn: 'oleh karena itu', ant: 'kendati demikian' },
  { word: 'sehubungan dengan', pron: '스후붕안 등안', meaning: '~와 관련하여', pos: '전치사구', root: 'hubung', cat: 'discourse', subcat: 'logic_connectors', syn: 'berkenaan dengan', ant: 'terlepas dari' },

  // Emotions
  { word: 'cemburu buta', pron: '쩜부루 부따', meaning: '눈먼 질투를 하다', pos: '형용사구', root: 'cemburu', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'iri sekali', ant: 'percaya penuh' },
  { word: 'berjiwa besar', pron: '버르지와 브사르', meaning: '도량이 넓다', pos: '형용사구', root: 'jiwa', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'lapang dada', ant: 'sempit hati' },
  { word: 'sempit hati', pron: '슴빳 하티', meaning: '속이 좁다', pos: '형용사구', root: 'sempit', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'kikir, picik', ant: 'berjiwa besar' },
  { word: 'besar kepala', pron: '브사르 끄빨라', meaning: '우쭐대다', pos: '형용사구', root: 'besar', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'sombong', ant: 'rendah hati' },
  { word: 'rendah diri', pron: '른다 디리', meaning: '자격지심을 느끼다', pos: '형용사구', root: 'rendah', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'minder', ant: 'percaya diri' },
  { word: 'percaya diri', pron: '쁘르짜야 디리', meaning: '자신감이 넘치다', pos: '형용사구', root: 'percaya', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'pede', ant: 'rendah diri, minder' },

  // Affix Verbs
  { word: 'memimpin', pron: '머ميم삔', meaning: '이끌다, 리도하다', pos: '동사', root: 'pimpin', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'mengarahkan', ant: 'mengikuti' },
  { word: 'mengikuti', pron: '멍이꾸띠', meaning: '따르다', pos: '동사', root: 'ikut', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'mengekor', ant: 'memimpin' },
  { word: 'mengakhiri', pron: '멍아키리', meaning: '종결하다', pos: '동사', root: 'akhir', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'menuntaskan', ant: 'memulai' },
  { word: 'memulai', pron: '멈무라이', meaning: '착수하다', pos: '동사', root: 'mula', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'mengawali', ant: 'mengakhiri' },
  { word: 'mendorong', pron: '믄도롱', meaning: '밀다, 진작시키다', pos: '동사', root: 'dorong', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'memotivasi', ant: 'menarik' },
  { word: 'menarik', pron: '머나릭', meaning: '당기다, 끌다', pos: '동사', root: 'tarik', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'memikat', ant: 'mendorong' },

  // Slang
  { word: 'mageran parah', pron: '마게란 빠라', meaning: '극강의 귀차니스트', pos: '형용사구', root: 'gerak', cat: 'slang_daily_spoken', subcat: 'slang_abbreviations', syn: 'pemalas sekali', ant: 'rajin banget' },
  { word: 'baperan banget', pron: '바뻬란 방앗', meaning: '유리멘탈인', pos: '형용사구', root: 'rasa', cat: 'slang_daily_spoken', subcat: 'slang_abbreviations', syn: 'sensitif sekali', ant: 'cuek habisan' },
  { word: 'pede habisan', pron: '쁘데 하비산', meaning: '근수저 자신감 폭발', pos: '형용사구', root: 'percaya', cat: 'slang_daily_spoken', subcat: 'slang_abbreviations', syn: 'percaya diri tinggi', ant: 'minder' },

  // BIPA
  { word: 'kebijakan publik', pron: '끄비자깐 뿌블릭', meaning: '공공 정책', pos: '명사구', root: 'bijak', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'peraturan pemerintah', ant: 'kebijakan pribadi' },
  { word: 'hubungan bilateral', pron: '후붕안 비라뜨랄', meaning: '양국 외교 관계', pos: '명사구', root: 'hubung', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'kerjasama antarnegara', ant: 'konflik' },
  { word: 'hak asasi manusia', pron: '학 아사시 마누시아', meaning: '세계 인권', pos: '명사구', root: 'hak', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'ham', ant: 'pelanggaran hak' },

  // Daily Living
  { word: 'kopi tubruk', pron: '꼬삐 뚜브룩', meaning: '전통 가루 커피', pos: '명사구', root: 'kopi', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'kopi hitam', ant: 'kopi instan' },
  { word: 'kopi susu gula aren', pron: '꼬삐 수수 굴라 아렌', meaning: '야자당 연유 커피', pos: '명사구', root: 'kopi', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'kopi aren', ant: 'air putih' },
  { word: 'kerupuk', pron: '끄루뿍', meaning: '전통 칩', pos: '명사', root: 'kerupuk', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'krupuk renyah', ant: 'nasi' },
  { word: 'papan tulis', pron: '빠판 뚜리스', meaning: '칠판', pos: '명사구', root: 'papan', cat: 'daily_living_themes', subcat: 'home_appliances_living', syn: 'board', ant: 'buku' },
  { word: 'kartu nama', pron: '까르뚜 나마', meaning: '명함', pos: '명사구', root: 'kartu', cat: 'daily_living_themes', subcat: 'home_appliances_living', syn: 'namecard', ant: 'surat' },
  { word: 'ayam bakar', pron: '아얌 바까르', meaning: '숯불 닭구이', pos: '명사', root: 'bakar', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'ayam panggang', ant: 'ayam rebus' },
  { word: 'ikan goreng', pron: '이깐 고렝', meaning: '생선 튀김', pos: '명사', root: 'ikan', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'ikan krispi', ant: 'ikan kukus' },
  { word: 'jus alpukat', pron: '주스 알뿌깟', meaning: '아보카도 주스', pos: '명사', root: 'jus', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'olahan alpukat', ant: 'air putih' },
  { word: 'bandara', pron: '반다라', meaning: '공항', pos: '명사', root: 'udara', cat: 'daily_living_themes', subcat: 'transport_travel_map', syn: 'bandar udara', ant: 'stasiun' },
  { word: 'halte bus', pron: '할뜨 버스', meaning: '버스 정류장', pos: '명사', root: 'halte', cat: 'daily_living_themes', subcat: 'transport_travel_map', syn: 'stasiun bus', ant: 'terminal' },
  { word: 'kamar tidur', pron: '까마르 띠두르', meaning: '침실', pos: '명사구', root: 'kamar', cat: 'daily_living_themes', subcat: 'home_appliances_living', syn: 'ruang tidur', ant: 'kamar mandi' },
  { word: 'mesin cuci', pron: '머신 쭈찌', meaning: '세탁기', pos: '명사구', root: 'mesin', cat: 'daily_living_themes', subcat: 'home_appliances_living', syn: 'alat pencuci', ant: 'ember' },
  { word: 'kulkas dua pintu', pron: '쿨까스 두아 뺜뚜', meaning: '양문형 냉장고', pos: '명사구', root: 'kulkas', cat: 'daily_living_themes', subcat: 'home_appliances_living', syn: 'lemari es', ant: 'kompor' }
];

massiveBatch.forEach(item => {
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
console.log(`🎉 [초대규모 누적 데이터베이스 생성 성공]`);
console.log(`- 전체 파일에 영구 누적된 총 고유 단어 수: ${totalAccumulatedCount}개`);
console.log(`- 1만 단어 목표까지 남은 단어 수: ${remainingCount}개`);
console.log(`- 진행률: ${((totalAccumulatedCount / TARGET_GOAL) * 100).toFixed(2)}%`);
console.log(`======================================================\n`);
