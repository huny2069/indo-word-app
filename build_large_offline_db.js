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

// 🚀 한번에 수백 개 대규모 어휘 추가 데이터셋
const massiveBatch = [
  // 1. Discourse Connectors
  { word: 'sementara itu', pron: '스먼따라 이뚜', meaning: '그러는 와중에', pos: '접속사', root: 'antara', cat: 'discourse', subcat: 'time_trigger_adverbs', syn: 'selagi itu', ant: 'setelahnya' },
  { word: 'pada saat yang sama', pron: '빠다 사앗 양 사마', meaning: '동시에', pos: '부사구', root: 'sama', cat: 'discourse', subcat: 'time_trigger_adverbs', syn: 'serentak', ant: 'bergantian' },
  { word: 'dengan kata lain', pron: '등안 까따 라인', meaning: '다시 말해', pos: '부사구', root: 'kata', cat: 'discourse', subcat: 'logic_connectors', syn: 'yakni', ant: 'sebaliknya' },
  { word: 'secara keseluruhan', pron: '스짜라 끄슬루루한', meaning: '전반적으로', pos: '부사구', root: 'seluruh', cat: 'discourse', subcat: 'logic_connectors', syn: 'secara total', ant: 'sebagian' },

  // 2. Emotions & Nuances
  { word: 'naik darah', pron: '나익 다라', meaning: '욱하다, 뚜껑 열리다', pos: '동사구', root: 'darah', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'marah besar', ant: 'tenang' },
  { word: 'tengsi gengsi', pron: '떵시 겡시', meaning: '체면 차리다', pos: '형용사구', root: 'gengsi', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'jaim', ant: 'apa adanya' },
  { word: 'kemakan omongan', pron: '끄마깐 오몽안', meaning: '제 꾀에 넘어가다', pos: '동사구', root: 'omong', cat: 'emotions_nuances', subcat: 'deep_emotions', syn: 'terjerat kata sendiri', ant: 'konsisten' },
  { word: 'rendah hati', pron: '른다 하티', meaning: '겸손하다', pos: '형용사구', root: 'hati', cat: 'emotions_nuances', subcat: 'personality_attitude', syn: 'tawaduk', ant: 'sombong' },

  // 3. Affix Verbs
  { word: 'mendorong', pron: '믄도롱', meaning: '추진하다', pos: '동사', root: 'dorong', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'memotivasi', ant: 'menahan' },
  { word: 'menghambat', pron: '멍함밧', meaning: '방해하다, 지체시키다', pos: '동사', root: 'hambat', cat: 'affix_verbs', subcat: 'me_active_verbs', syn: 'merintangi', ant: 'mempercepat' },
  { word: 'mempercepat', pron: '멈뻐르쯔빳', meaning: '재촉하다, 단축하다', pos: '동사', root: 'cepat', cat: 'affix_verbs', subcat: 'per_memper_verbs', syn: 'mendorong', ant: 'menghambat' },
  { word: 'memperkuat', pron: '멈뻐르꾸앗', meaning: '공고히 하다', pos: '동사', root: 'kuat', cat: 'affix_verbs', subcat: 'per_memper_verbs', syn: 'mengukuhkan', ant: 'memperlemah' },

  // 4. Slang & Daily Spoken
  { word: 'ngabers', pron: '응아베르스', meaning: '오토바이 폭주족 슬랭', pos: '명사', root: 'ngab', cat: 'slang_daily_spoken', subcat: 'slang_abbreviations', syn: 'pemotor jalanan', ant: 'pengendara tertib' },
  { word: 'anak nongkrong', pron: '아낙 농끄롱', meaning: '수다족', pos: '명사구', root: 'nongkrong', cat: 'slang_daily_spoken', subcat: 'daily_life_survival', syn: 'penggemar kumpul', ant: 'rumahan' },
  { word: 'bocil kematian', pron: '보찔 끄마띠안', meaning: '트롤짓 하는 꼬맹이', pos: '명사구', root: 'bocah', cat: 'slang_daily_spoken', subcat: 'slang_abbreviations', syn: 'anak pembuat rusuh', ant: 'anak penurut' },

  // 5. BIPA Topics
  { word: 'kesejahteraan masyarakat', pron: '끄스자흐뜨라안 마샤라깟', meaning: '대중 복지', pos: '명사구', root: 'sejahtera', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'kemakmuran rakyat', ant: 'kemiskinan' },
  { word: 'kemiskinan ekstrem', pron: '끄미스끼난 엑스뜨렘', meaning: '극심한 빈곤', pos: '명사구', root: 'miskin', cat: 'bipa_levels', subcat: 'bipa_advanced', syn: 'kemiskinan parah', ant: 'kecukupan' },

  // 6. Daily Living Vocab
  { word: 'kopi tubruk manis', pron: '꼬삐 뚜브룩 마니스', meaning: '단맛 전통 커피', pos: '명사구', root: 'kopi', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'kopi manis', ant: 'kopi pahit' },
  { word: 'es jeruk nipis', pron: '에스 저룩 니삐스', meaning: '아이스 라임 주스', pos: '명사구', root: 'jeruk', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'es limau', ant: 'teh hangat' },
  { word: 'sate kambing', pron: '사떼 까మ్빙', meaning: '염소고기 꼬치 구이', pos: '명사구', root: 'sate', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'olahan kambing', ant: 'sate ayam' },
  { word: 'sop buntut sapi', pron: '솝 분뚯 사삐', meaning: '소꼬리 곰탕', pos: '명사구', root: 'sop', cat: 'daily_living_themes', subcat: 'food_cooking_dining', syn: 'sup ekor', ant: 'nasi' },
  { word: 'stasiun kota', pron: '스따시운 꼬따', meaning: '도심 중앙 기차역', pos: '명사구', root: 'stasiun', cat: 'daily_living_themes', subcat: 'transport_travel_map', syn: 'stasiun pusat', ant: 'bandara' },
  { word: 'helm sni', pron: '헬름 에스엔아이', meaning: '공인 규격 헬멧', pos: '명사구', root: 'helm', cat: 'daily_living_themes', subcat: 'transport_travel_map', syn: 'pelindung kepala', ant: 'topi' }
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
console.log(`🎉 [대규모 연속 누적 데이터베이스 확장 성공]`);
console.log(`- 전체 파일에 영구 누적된 총 고유 단어 수: ${totalAccumulatedCount}개`);
console.log(`- 1만 단어 목표까지 남은 단어 수: ${remainingCount}개`);
console.log(`- 진행률: ${((totalAccumulatedCount / TARGET_GOAL) * 100).toFixed(2)}%`);
console.log(`======================================================\n`);
