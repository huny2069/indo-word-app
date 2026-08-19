import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_GOAL = 10000;
console.log(`⚡ [1만 단어 달성을 위한 무중복 오프라인 사원 생성 엔진 가동 - 목표: ${TARGET_GOAL}개]`);

const globalWordSet = new Set();

function cleanWordKey(w) {
  if (!w) return '';
  return w.split('[[')[0].trim().toLowerCase().replace(/[^a-z0-9\-\s]/g, '');
}

function createWordItem(item) {
  const key = cleanWordKey(item.word);
  if (!key) return null;
  
  if (globalWordSet.has(key)) {
    return null; // 중복 100% 방지
  }
  globalWordSet.add(key);

  const displayWord = item.pron ? `${item.word} [[${item.pron}]]` : item.word;
  const rootWord = item.root || item.word.split(' ')[0];

  const synonymVal = item.syn && item.syn !== '-' ? item.syn : `${item.word}와 유사한 의미의 인도네시아어 표현`;
  const antonymVal = item.ant && item.ant !== '-' ? item.ant : `${item.word}와 반대되는 성격의 인도네시아어 표현`;

  return {
    id: item.id,
    category_id: item.cat,
    subcategory_id: item.subcat,
    word: displayWord,
    meaning: item.meaning,
    pos: item.pos,
    root: rootWord,
    affix_logic: item.affix_logic || `어근 '${rootWord}'에 기반한 ${item.pos} 어휘`,
    grammar_rule: item.grammar_rule || `문장 내에서 ${item.pos}의 역할을 하며 다양한 뉘앙스를 형성합니다.`,
    synonym: synonymVal,
    antonym: antonymVal,
    context: item.context || `실생활 및 회화 상황에서 '${item.meaning}'의 의미로 빈번하게 활용됩니다.`,
    caution: item.caution || `상황과 대화 상대에 맞추어 적절한 어조와 예의를 갖추어 사용하는 것이 좋습니다.`,
    related: item.related || `어근 '${rootWord}'의 파생 규칙을 함께 익히면 기억에 오래 남습니다!`,
    example_formal: item.example_formal || `Penggunaan kata '${item.word}' sangat lazim dalam bahasa Indonesia standar.`,
    example_formal_kr: item.example_formal_kr || `'${item.meaning}'을(를) 나타내는 표준적인 표현입니다.`,
    example_casual: item.example_casual || `Kata '${item.word}' sering banget dipake pas lagi ngobrol santai sehari-hari.`,
    example_casual_kr: item.example_casual_kr || `일상 대화에서 '${item.meaning}'의 뉘앙스로 자주 쓰여.`,
    word_breakdown: item.word_breakdown || [
      { word: item.word.split(' ')[0], meaning: item.meaning.split(',')[0].trim() }
    ]
  };
}

// 1. Discourse Connectors
const discourseRaw = [
  { word: 'tetapi', pron: '뜨따삐', meaning: '하지만, 그러나', pos: '접속사', root: 'tetapi', subcat: 'logic_connectors', syn: 'namun, tapi', ant: 'dan, serta' },
  { word: 'namun', pron: '나문', meaning: '그러나, 그렇지만 (문어)', pos: '접속사', root: 'namun', subcat: 'logic_connectors', syn: 'tetapi, akan tetapi', ant: 'oleh karena itu' },
  { word: 'oleh karena itu', pron: '올레 까르나 이뚜', meaning: '따라서, 그러므로', pos: '접속사', root: 'karena', subcat: 'logic_connectors', syn: 'maka dari itu', ant: 'meskipun demikian' },
  { word: 'meskipun', pron: '메스끼뿐', meaning: '비록 ~일지라도', pos: '접속사', root: 'meski', subcat: 'logic_connectors', syn: 'walaupun, biarpun', ant: 'karena, sebab' },
  { word: 'sebaliknya', pron: '스발릭냐', meaning: '반면에, 그와 반대로', pos: '접속사', root: 'balik', subcat: 'logic_connectors', syn: 'justru, alih-alih', ant: 'sama halnya' },
  { word: 'padahal', pron: '빠다할', meaning: '사실은 ~인데도, ~임에도', pos: '접속사', root: 'padahal', subcat: 'logic_connectors', syn: 'sedangkan, nyatanya', ant: 'memang' },
  { word: 'sedangkan', pron: '스당깐', meaning: '~인 반면에, 한편', pos: '접속사', root: 'sedang', subcat: 'logic_connectors', syn: 'sementara itu', ant: 'dan' },
  { word: 'melainkan', pron: '믈라인깐', meaning: '~이 아니라 오히려', pos: '접속사', root: 'lain', subcat: 'logic_connectors', syn: 'tetapi', ant: 'dan juga' },
  { word: 'sehingga', pron: '스힝가', meaning: '그리하여, 그 결과', pos: '접속사', root: 'hingga', subcat: 'logic_connectors', syn: 'sampai-sampai', ant: 'sebelum' },
  { word: 'akibatnya', pron: '아끼밧냐', meaning: '그 결과로, 그 탓에', pos: '부사', root: 'akibat', subcat: 'logic_connectors', syn: 'hasilnya', ant: 'penyebabnya' },
  { word: 'agar', pron: '아가르', meaning: '~하도록, ~하기 위하여', pos: '접속사', root: 'agar', subcat: 'logic_connectors', syn: 'supaya, biar', ant: 'supaya jangan' },
  { word: 'supaya', pron: '수빠야', meaning: '~할 수 있도록, ~하기 위해', pos: '접속사', root: 'supaya', subcat: 'logic_connectors', syn: 'agar, biar', ant: 'jangan' },
  { word: 'lagipula', pron: '라기뿔라', meaning: '게다가, 어차피 또', pos: '접속사', root: 'pula', subcat: 'logic_connectors', syn: 'selain itu', ant: 'hanya saja' },
  { word: 'bahkan', pron: '바흐깐', meaning: '심지어, 심지어는', pos: '부사', root: 'bahkan', subcat: 'logic_connectors', syn: 'malahan', ant: 'hanya' },
  { word: 'malahan', pron: '말라한', meaning: '오히려, 도리어', pos: '부사', root: 'malah', subcat: 'logic_connectors', syn: 'justru', ant: 'sebenarnya' },
  { word: 'justru', pron: '주스뜨루', meaning: '오히려, 바로 그렇기에', pos: '부사', root: 'justru', subcat: 'logic_connectors', syn: 'malahan', ant: 'sebaliknya' },
  { word: 'walaupun', pron: '왈라우뿐', meaning: '비록 ~일지라도, ~라 해도', pos: '접속사', root: 'walau', subcat: 'logic_connectors', syn: 'meskipun', ant: 'karena' },
  { word: 'biarpun', pron: '비아르뿐', meaning: '아무리 ~일지라도', pos: '접속사', root: 'biar', subcat: 'logic_connectors', syn: 'meskipun', ant: 'karena' },
  { word: 'asalkan', pron: '아살깐', meaning: '~하기만 한다면', pos: '접속사', root: 'asal', subcat: 'logic_connectors', syn: 'dengan syarat', ant: 'meskipun tanpa' },
  { word: 'seandainya', pron: '스안다이냐', meaning: '만약에, 가령 ~라면', pos: '접속사', root: 'andai', subcat: 'logic_connectors', syn: 'jikalau', ant: 'nyatanya' },
  { word: 'kendatipun', pron: '끈다띠뿐', meaning: '~에도 불구하고', pos: '접속사', root: 'kendati', subcat: 'logic_connectors', syn: 'meskipun', ant: 'karena itu' },
  { word: 'selain itu', pron: '슬라인 이뚜', meaning: '그 밖에도, 게다가', pos: '접속사', root: 'lain', subcat: 'logic_connectors', syn: 'di samping itu', ant: 'hanya itu' },
  { word: 'di samping itu', pron: '디 삼삥 이뚜', meaning: '그 외에도, 이와 함께', pos: '접속사', root: 'samping', subcat: 'logic_connectors', syn: 'selain itu', ant: 'hanya itu' },
  { word: 'maka dari itu', pron: '마까 다리 이뚜', meaning: '그런 까닭에, 그러므로', pos: '접속사', root: 'maka', subcat: 'logic_connectors', syn: 'oleh karena itu', ant: 'meski begitu' },
  { word: 'gara-gara', pron: '가라가라', meaning: '~때문에 (부정적 원인)', pos: '접속사', root: 'gara', subcat: 'logic_connectors', syn: 'karena', ant: 'berkat' },
  { word: 'berkat', pron: '버르깟', meaning: '~덕분에, ~의 은혜로', pos: '전치사', root: 'berkat', subcat: 'logic_connectors', syn: 'karena kebaikan', ant: 'gara-gara' },
  { word: 'ibarat', pron: '이바랏', meaning: '비유하자면, 마치 ~처럼', pos: '접속사', root: 'ibarat', subcat: 'logic_connectors', syn: 'seperti', ant: 'berbeda' },
  { word: 'contohnya', pron: '쫀또냐', meaning: '예를 들면, 이를테면', pos: '부사', root: 'contoh', subcat: 'logic_connectors', syn: 'misalnya', ant: 'secara umum' },
  { word: 'yakni', pron: '약니', meaning: '즉, 다시 말해', pos: '접속사', root: 'yakni', subcat: 'logic_connectors', syn: 'yaitu', ant: 'bukan' },
  { word: 'yaitu', pron: '야이뚜', meaning: '다름 아닌, 곧', pos: '접속사', root: 'itu', subcat: 'logic_connectors', syn: 'yakni', ant: 'selain' },
  { word: 'tiba-tiba', pron: '띠바띠바', meaning: '갑자기, 느닷없이', pos: '부사', root: 'tiba', subcat: 'time_trigger_adverbs', syn: 'mendadak', ant: 'perlahan' },
  { word: 'mendadak', pron: '믄다닥', meaning: '돌연, 불시에', pos: '부사', root: 'dadak', subcat: 'time_trigger_adverbs', syn: 'tiba-tiba', ant: 'terencana' },
  { word: 'kebetulan', pron: '끄브뚤란', meaning: '어쩌다, 우연히', pos: '부사', root: 'betul', subcat: 'time_trigger_adverbs', syn: 'tanpa sengaja', ant: 'sengaja' },
  { word: 'awalnya', pron: '아왈냐', meaning: '원래는, 처음에는', pos: '부사', root: 'awal', subcat: 'time_trigger_adverbs', syn: 'semula', ant: 'akhirnya' },
  { word: 'semula', pron: '스물라', meaning: '애초에, 원래', pos: '부사', root: 'mula', subcat: 'time_trigger_adverbs', syn: 'awalnya', ant: 'akhirnya' },
  { word: 'lantas', pron: '란따스', meaning: '그러더니, 이어서', pos: '부사', root: 'lantas', subcat: 'time_trigger_adverbs', syn: 'lalu', ant: 'sebelumnya' },
  { word: 'akhirnya', pron: '아키르냐', meaning: '결국, 마침내', pos: '부사', root: 'akhir', subcat: 'time_trigger_adverbs', syn: 'pada akhirnya', ant: 'awalnya' },
  { word: 'ujung-ujungnya', pron: '우중우중냐', meaning: '결국에는, 끝끝내', pos: '부사', root: 'ujung', subcat: 'time_trigger_adverbs', syn: 'akhirnya', ant: 'awalnya' },
  { word: 'seketika', pron: '스끄띠까', meaning: '순식간에, 즉각', pos: '부사', root: 'ketika', subcat: 'time_trigger_adverbs', syn: 'langsung', ant: 'nanti' },
  { word: 'langsung', pron: '랑숭', meaning: '곧바로, 즉시', pos: '부사', root: 'langsung', subcat: 'time_trigger_adverbs', syn: 'segera', ant: 'tertunda' },
  { word: 'kelak', pron: '끌락', meaning: '훗날, 언젠가', pos: '부사', root: 'kelak', subcat: 'time_trigger_adverbs', syn: 'nanti', ant: 'sekarang' },
  { word: 'segera', pron: '스그라', meaning: '즉시, 조속히', pos: '부사', root: 'segera', subcat: 'time_trigger_adverbs', syn: 'lekas', ant: 'lambat' },
  { word: 'barusan', pron: '바루산', meaning: '방금 전에', pos: '부사', root: 'baru', subcat: 'time_trigger_adverbs', syn: 'baru saja', ant: 'nanti' },
  { word: 'sewaktu', pron: '스왁뚜', meaning: '~하던 당시에', pos: '접속사', root: 'waktu', subcat: 'time_trigger_adverbs', syn: 'ketika', ant: 'setelah' },
  { word: 'tatkala', pron: '땃깔라', meaning: '~하던 그때', pos: '접속사', root: 'kala', subcat: 'time_trigger_adverbs', syn: 'sewaktu', ant: 'nanti' },
  { word: 'sementara itu', pron: '스먼따라 이뚜', meaning: '한편, 그러는 동안에', pos: '접속사', root: 'antara', subcat: 'time_trigger_adverbs', syn: 'selagi itu', ant: 'setelahnya' },
  { word: 'semenjak', pron: '스먼작', meaning: '~이래로', pos: '전치사', root: 'sejak', subcat: 'time_trigger_adverbs', syn: 'sejak', ant: 'hingga' },
  { word: 'seusai', pron: '스우사이', meaning: '~가 끝난 뒤', pos: '전치사', root: 'usai', subcat: 'time_trigger_adverbs', syn: 'setelah', ant: 'sebelum' },
  { word: 'lama-kelamaan', pron: '라마끄라마안', meaning: '점차, 시간이 지남에 따라', pos: '부사', root: 'lama', subcat: 'time_trigger_adverbs', syn: 'berangsur-angsur', ant: 'seketika' },
  { word: 'lambat laun', pron: '람밧 라운', meaning: '서서히, 차츰차츰', pos: '부사', root: 'lambat', subcat: 'time_trigger_adverbs', syn: 'perlahan-lahan', ant: 'mendadak' },
  { word: 'lagian', pron: '라기안', meaning: '어차피 또, 게다가', pos: '접속사', root: 'lagi', subcat: 'logic_connectors', syn: 'lagipula', ant: 'hanya saja' },
  { word: 'makanya', pron: '마까냐', meaning: '그러니까, 그래서', pos: '접속사', root: 'maka', subcat: 'logic_connectors', syn: 'oleh karena itu', ant: 'padahal' },
  { word: 'seiring dengan', pron: '스이ring 등안', meaning: '~와 발맞추어', pos: '전치사구', root: 'iring', subcat: 'logic_connectors', syn: 'bersamaan dengan', ant: 'terlepas dari' },
  { word: 'sepanjang', pron: '스빤장', meaning: '~하는 한, 내내', pos: '전치사', root: 'panjang', subcat: 'logic_connectors', syn: 'selama', ant: 'sebentar' },
  { word: 'selama ini', pron: '스라마 이니', meaning: '그동안 줄곧', pos: '부사구', root: 'lama', subcat: 'time_trigger_adverbs', syn: 'sejauh ini', ant: 'ke depannya' },
  { word: 'oleh sebab itu', pron: '올레 스밥 이뚜', meaning: '그러므로, 그런 이유로', pos: '접속사', root: 'sebab', subcat: 'logic_connectors', syn: 'oleh karena itu', ant: 'kendati demikian' },
  { word: 'sehubungan dengan', pron: '스후붕안 등안', meaning: '~와 관련하여', pos: '전치사구', root: 'hubung', subcat: 'logic_connectors', syn: 'berkenaan dengan', ant: 'tidak ada hubungan' },
  { word: 'berkenaan dengan', pron: '버르끄나안 등안', meaning: '~에 관해서는', pos: '전치사구', root: 'kena', subcat: 'logic_connectors', syn: 'mengenai', ant: 'terlepas dari' }
];

const discourseCompiled = [];
discourseRaw.forEach((d, i) => {
  const item = createWordItem({
    id: `disc_${String(i + 1).padStart(4, '0')}`,
    cat: 'discourse',
    subcat: d.subcat,
    word: d.word,
    pron: d.pron,
    meaning: d.meaning,
    pos: d.pos,
    root: d.root,
    syn: d.syn,
    ant: d.ant
  });
  if (item) discourseCompiled.push(item);
});

fs.writeFileSync(
  path.join(__dirname, 'src/data/discourseConnectors.js'),
  `export const discourseConnectors = ${JSON.stringify(discourseCompiled, null, 2)};\n`,
  'utf-8'
);

// 2. Emotions Nuances
const emotionsRaw = [
  { word: 'merasuk kalbu', pron: '머라숙 깔부', meaning: '가슴 깊이 사무치다', pos: '동사구', root: 'rasuk', subcat: 'deep_emotions', syn: 'menusuk hati', ant: 'dangkal' },
  { word: 'samar-samar', pron: '사마르사마르', meaning: '아련하다, 희미하다', pos: '형용사', root: 'samar', subcat: 'deep_emotions', syn: 'sayup-sayup', ant: 'jelas' },
  { word: 'kecewa', pron: '끄체와', meaning: '서운하다, 실망하다', pos: '형용사', root: 'kecewa', subcat: 'deep_emotions', syn: 'ganjal', ant: 'puas' },
  { word: 'lega', pron: '르가', meaning: '후련하다, 안도하다', pos: '형용사', root: 'lega', subcat: 'deep_emotions', syn: 'plong', ant: 'sesak' },
  { word: 'terharu', pron: '떠르하루', meaning: '감동하다, 뭉클하다', pos: '형용사', root: 'haru', subcat: 'deep_emotions', syn: 'tersentuh', ant: 'cuek' },
  { word: 'rindu', pron: '린두', meaning: '그리워하다, 사모하다', pos: '형용사', root: 'rindu', subcat: 'deep_emotions', syn: 'kangen', ant: 'lupa' },
  { word: 'cemas', pron: '츠마스', meaning: '불안하다, 걱정스럽다', pos: '형용사', root: 'cemas', subcat: 'deep_emotions', syn: 'khawatir', ant: 'tenang' },
  { word: 'bangga', pron: '방가', meaning: '자랑스럽다, 뿌듯하다', pos: '형용사', root: 'bangga', subcat: 'deep_emotions', syn: 'puas', ant: 'malu' },
  { word: 'galau', pron: '갈라우', meaning: '마음이 복잡하다', pos: '형용사', root: 'galau', subcat: 'deep_emotions', syn: 'bimbang', ant: 'fokus' },
  { word: 'resah', pron: '르사', meaning: '안절부절못하다', pos: '형용사', root: 'resah', subcat: 'deep_emotions', syn: 'gelisah', ant: 'tenang' },
  { word: 'gundah', pron: '군다', meaning: '근심스럽다, 침울하다', pos: '형용사', root: 'gundah', subcat: 'deep_emotions', syn: 'sedih', ant: 'ceria' },
  { word: 'takjub', pron: '탁줍', meaning: '경탄하다, 감탄하다', pos: '형용사', root: 'takjub', subcat: 'deep_emotions', syn: 'kagum', ant: 'biasa' },
  { word: 'iba', pron: '이바', meaning: '가엾게 여기다', pos: '형용사', root: 'iba', subcat: 'deep_emotions', syn: 'kasihan', ant: 'tega' },
  { word: 'jengkel', pron: '젱껠', meaning: '짜증 나다', pos: '형용사', root: 'jengkel', subcat: 'deep_emotions', syn: 'kesal', ant: 'senang' },
  { word: 'muak', pron: '무악', meaning: '진절머리 나다', pos: '형용사', root: 'muak', subcat: 'deep_emotions', syn: 'jenuh', ant: 'suka' },
  { word: 'jenuh', pron: '즈누', meaning: '권태롭다, 싫증 나다', pos: '형용사', root: 'jenuh', subcat: 'deep_emotions', syn: 'bosan', ant: 'semangat' },
  { word: 'was-was', pron: '와스와스', meaning: '조마조마하다', pos: '형용사', root: 'was', subcat: 'deep_emotions', syn: 'khawatir', ant: 'yakin' },
  { word: 'dendam', pron: '든담', meaning: '원한을 품다', pos: '명사', root: 'dendam', subcat: 'deep_emotions', syn: 'benci', ant: 'ikhlas' },
  { word: 'ikhlas', pron: '이크라스', meaning: '진심으로 수용하다', pos: '형용사', root: 'ikhlas', subcat: 'deep_emotions', syn: 'tulus', ant: 'terpaksa' },
  { word: 'patah hati', pron: '빠따 하티', meaning: '실연당하다', pos: '형용사구', root: 'patah', subcat: 'deep_emotions', syn: 'putus cinta', ant: 'jatuh cinta' },
  { word: 'putus asa', pron: '뿌뚜스 아사', meaning: '절망하다', pos: '형용사구', root: 'putus', subcat: 'deep_emotions', syn: 'menyerah', ant: 'optimis' },
  { word: 'lapang dada', pron: '라빵 다다', meaning: '너그럽게 수용하다', pos: '형용사구', root: 'lapang', subcat: 'deep_emotions', syn: 'ikhlas', ant: 'sempit hati' },
  { word: 'terenyuh', pron: '뜨르뉴', meaning: '마음이 찡하다', pos: '형용사', root: 'renyuh', subcat: 'deep_emotions', syn: 'tersentuh', ant: 'dingin' },
  { word: 'merana', pron: '머라나', meaning: '수척해지다, 속앓이하다', pos: '동사', root: 'rana', subcat: 'deep_emotions', syn: 'menderita', ant: 'bahagia' },
  { word: 'panas hati', pron: '빠나스 하티', meaning: '분통이 터지다', pos: '형용사구', root: 'panas', subcat: 'deep_emotions', syn: 'murka', ant: 'dingin hati' },
  { word: 'berat hati', pron: '브랏 하티', meaning: '마음이 무겁다', pos: '형용사구', root: 'berat', subcat: 'deep_emotions', syn: 'enggan', ant: 'senang hati' },
  { word: 'ringan tangan', pron: '링안 땅안', meaning: '남을 돕기 좋아하다', pos: '형용사구', root: 'tangan', subcat: 'personality_attitude', syn: 'suka menolong', ant: 'pelit' },
  { word: 'telinga tipis', pron: '뜰링아 띠삐스', meaning: '귀가 얇다', pos: '형용사구', root: 'telinga', subcat: 'personality_attitude', syn: 'gampang percaya', ant: 'teguh pendirian' },
  { word: 'panas terik', pron: '빠나스 뜨릭', meaning: '햇볕이 쨍쨍 내리쬐다', pos: '형용사구', root: 'terik', subcat: 'senses_and_states', syn: 'menyengat', ant: 'teduh' },
  { word: 'makan hati', pron: '마깐 하티', meaning: '속을 썩이다, 애태우다', pos: '동사구', root: 'makan', subcat: 'deep_emotions', syn: 'menderita batin', ant: 'bahagia' },
  { word: 'cuci tangan', pron: '쭈찌 땅안', meaning: '손을 떼다, 책임을 회피하다', pos: '동사구', root: 'cuci', subcat: 'personality_attitude', syn: 'lepas tangan', ant: 'bertanggung jawab' }
];

const emotionsCompiled = [];
emotionsRaw.forEach((e, i) => {
  const item = createWordItem({
    id: `emo_${String(i + 1).padStart(4, '0')}`,
    cat: 'emotions_nuances',
    subcat: e.subcat,
    word: e.word,
    pron: e.pron,
    meaning: e.meaning,
    pos: e.pos,
    root: e.root,
    syn: e.syn,
    ant: e.ant
  });
  if (item) emotionsCompiled.push(item);
});

fs.writeFileSync(
  path.join(__dirname, 'src/data/emotionsNuances.js'),
  `export const emotionsNuances = ${JSON.stringify(emotionsCompiled, null, 2)};\n`,
  'utf-8'
);

// 3. Affix Verbs
const affixRaw = [
  { word: 'mengambil', pron: '멍암빌', meaning: '가지고 가다, 취하다', pos: '동사', root: 'ambil', subcat: 'me_active_verbs', syn: 'meraih', ant: 'memberikan' },
  { word: 'memperbaiki', pron: '멈뻐르바이끼', meaning: '수리하다, 개선하다', pos: '동사', root: 'baik', subcat: 'causative_locative_verbs', syn: 'membetulkan', ant: 'merusak' },
  { word: 'terbawa', pron: '뜨르바와', meaning: '나도 모르게 휩쓸리다', pos: '동사', root: 'bawa', subcat: 'di_ter_passive_verbs', syn: 'terhanyut', ant: 'sengaja membawa' },
  { word: 'terkejut', pron: '뜨르끄줏', meaning: '깜짝 놀라다', pos: '동사', root: 'kejut', subcat: 'di_ter_passive_verbs', syn: 'kaget', ant: 'tenang' },
  { word: 'berdiskusi', pron: '버르디스꾸시', meaning: '토론하다', pos: '동사', root: 'diskusi', subcat: 'ber_intransitive_verbs', syn: 'bermusyawarah', ant: 'bungkam' },
  { word: 'memastikan', pron: '머마스띠깐', meaning: '확인하다', pos: '동사', root: 'pasti', subcat: 'causative_locative_verbs', syn: 'mengecek', ant: 'meragukan' },
  { word: 'menghasilkan', pron: '멍하실깐', meaning: '생산하다', pos: '동사', root: 'hasil', subcat: 'causative_locative_verbs', syn: 'memproduksi', ant: 'menghabiskan' },
  { word: 'menghindari', pron: '멍힌다리', meaning: '피하다', pos: '동사', root: 'hindar', subcat: 'causative_locative_verbs', syn: 'menjauhi', ant: 'menghadapi' },
  { word: 'berkembang', pron: '버르큼방', meaning: '성장하다', pos: '동사', root: 'kembang', subcat: 'ber_intransitive_verbs', syn: 'tumbuh', ant: 'mundur' },
  { word: 'menyelesaikan', pron: '머녤르사이깐', meaning: '끝마치다', pos: '동사', root: 'selesai', subcat: 'causative_locative_verbs', syn: 'menuntaskan', ant: 'menunda' },
  { word: 'mempercepat', pron: '멈뻐르쯔빳', meaning: '가속화하다', pos: '동사', root: 'cepat', subcat: 'per_memper_verbs', syn: 'mendorong', ant: 'memperlambat' },
  { word: 'memperluas', pron: '멈뻐르루아스', meaning: '확장하다', pos: '동사', root: 'luas', subcat: 'per_memper_verbs', syn: 'melebarkan', ant: 'menyempitkan' },
  { word: 'mempelajari', pron: '멈쁠라자리', meaning: '배우다, 연구하다', pos: '동사', root: 'ajar', subcat: 'causative_locative_verbs', syn: 'mengkaji', ant: 'mengabaikan' },
  { word: 'memperkuat', pron: '멈뻐르꾸앗', meaning: '강화하다', pos: '동사', root: 'kuat', subcat: 'per_memper_verbs', syn: 'menegaskan', ant: 'memperlemah' },
  { word: 'membawa', pron: '멈바와', meaning: '가져오다, 지참하다', pos: '동사', root: 'bawa', subcat: 'me_active_verbs', syn: 'mengangkut', ant: 'meninggalkan' },
  { word: 'mengirim', pron: '멍이림', meaning: '보내다, 발송하다', pos: '동사', root: 'kirim', subcat: 'me_active_verbs', syn: 'transmisi', ant: 'menerima' },
  { word: 'menerima', pron: '머느리마', meaning: '받다, 수락하다', pos: '동사', root: 'terima', subcat: 'me_active_verbs', syn: 'menampung', ant: 'menolak' },
  { word: 'membayar', pron: '멈바야르', meaning: '지불하다', pos: '동사', root: 'bayar', subcat: 'me_active_verbs', syn: 'melunasi', ant: 'menunggak' },
  { word: 'menemukan', pron: '머느무깐', meaning: '발견하다', pos: '동사', root: 'temu', subcat: 'causative_locative_verbs', syn: 'mendapati', ant: 'menghilangkan' },
  { word: 'menunggu', pron: '머눙구', meaning: '기다리다, 대기하다', pos: '동사', root: 'tunggu', subcat: 'me_active_verbs', syn: 'menanti', ant: 'meninggalkan' },
  { word: 'mengundang', pron: '멍운당', meaning: '초대하다, 초청하다', pos: '동사', root: 'undang', subcat: 'me_active_verbs', syn: 'mengajak', ant: 'mengusir' }
];

const affixCompiled = [];
affixRaw.forEach((a, i) => {
  const item = createWordItem({
    id: `aff_${String(i + 1).padStart(4, '0')}`,
    cat: 'affix_verbs',
    subcat: a.subcat,
    word: a.word,
    pron: a.pron,
    meaning: a.meaning,
    pos: a.pos,
    root: a.root,
    syn: a.syn,
    ant: a.ant
  });
  if (item) affixCompiled.push(item);
});

fs.writeFileSync(
  path.join(__dirname, 'src/data/affixVerbs.js'),
  `export const affixVerbs = ${JSON.stringify(affixCompiled, null, 2)};\n`,
  'utf-8'
);

// 4. Slang & Daily Spoken
const slangRaw = [
  { word: 'mager', pron: '마게르', meaning: '귀찮다 (귀차니즘)', pos: '형용사', root: 'gerak', subcat: 'slang_abbreviations', syn: 'malas gerak', ant: 'rajin' },
  { word: 'baper', pron: '바뻬르', meaning: '마음 상하다, 삐지다', pos: '형용사', root: 'rasa', subcat: 'slang_abbreviations', syn: 'tersinggung', ant: 'cuek' },
  { word: 'gpp', pron: '게페페', meaning: '괜찮아 (약어)', pos: '약어', root: 'apa', subcat: 'slang_abbreviations', syn: 'tidak apa-apa', ant: 'gawat' },
  { word: 'kepo', pron: '께뽀', meaning: '참견하다', pos: '형용사', root: 'kepo', subcat: 'slang_abbreviations', syn: 'penasaran', ant: 'acuh' },
  { word: 'curhat', pron: '쭈르핫', meaning: '속마음을 털어놓다', pos: '동사', root: 'curah', subcat: 'slang_abbreviations', syn: 'curah hati', ant: 'memendam' },
  { word: 'bungkus', pron: '붕꾸스', meaning: '포장하다', pos: '동사', root: 'bungkus', subcat: 'daily_life_survival', syn: 'take away', ant: 'makan di tempat' },
  { word: 'woles', pron: '월레스', meaning: '슬로우하게, 침착하게', pos: '형용사', root: 'selow', subcat: 'slang_abbreviations', syn: 'santai', ant: 'panik' },
  { word: 'mantul', pron: '만뚤', meaning: '대박이다, 끝내준다', pos: '형용사', root: 'mantap', subcat: 'slang_abbreviations', syn: 'keren', ant: 'buruk' },
  { word: 'bestie', pron: '베스띠', meaning: '단짝 친구, 찐친', pos: '명사', root: 'best', subcat: 'slang_abbreviations', syn: 'sahabat karib', ant: 'musuh' },
  { word: 'gokil abis', pron: '고낄 아비스', meaning: '상상초월로 웃기다', pos: '형용사구', root: 'gila', subcat: 'slang_abbreviations', syn: 'kocak banget', ant: 'garing' },
  { word: 'mageran', pron: '마게란', meaning: '귀차니스트', pos: '명사', root: 'gerak', subcat: 'slang_abbreviations', syn: 'pemalas', ant: 'pekerja keras' },
  { word: 'baperan', pron: '바뻬란', meaning: '잘 삐지는 사람', pos: '명사', root: 'rasa', subcat: 'slang_abbreviations', syn: 'sensitif', ant: 'pembawaan santai' }
];

const slangCompiled = [];
slangRaw.forEach((s, i) => {
  const item = createWordItem({
    id: `slang_${String(i + 1).padStart(4, '0')}`,
    cat: 'slang_daily_spoken',
    subcat: s.subcat,
    word: s.word,
    pron: s.pron,
    meaning: s.meaning,
    pos: s.pos,
    root: s.root,
    syn: s.syn,
    ant: s.ant
  });
  if (item) slangCompiled.push(item);
});

fs.writeFileSync(
  path.join(__dirname, 'src/data/slangDailySpoken.js'),
  `export const slangDailySpoken = ${JSON.stringify(slangCompiled, null, 2)};\n`,
  'utf-8'
);

// 5. BIPA Topics
const bipaRaw = [
  { word: 'kebanyakan', pron: '끄바냑깐', meaning: '대부분, 과도한', pos: '명사', root: 'banyak', subcat: 'bipa_beginner', syn: 'sebagian besar', ant: 'sedikit' },
  { word: 'membutuhkan', pron: '멈부뚜깐', meaning: '필요로 하다', pos: '동사', root: 'butuh', subcat: 'bipa_beginner', syn: 'memerlukan', ant: 'menolak' },
  { word: 'mengembangkan', pron: '멍엠방깐', meaning: '발전시키다', pos: '동사', root: 'kembang', subcat: 'bipa_intermediate', syn: 'memajukan', ant: 'menurunkan' },
  { word: 'berdasarkan', pron: '버르다사르깐', meaning: '~에 근거하여', pos: '전치사', root: 'dasar', subcat: 'bipa_intermediate', syn: 'berlandaskan', ant: 'sembarangan' },
  { word: 'mempengaruhi', pron: '멈빵아루히', meaning: '영향을 미치다', pos: '동사', root: 'pengaruh', subcat: 'bipa_intermediate', syn: 'berdampak pada', ant: 'diabaikan' },
  { word: 'investasi', pron: '인베스따시', meaning: '투자', pos: '명사', root: 'investasi', subcat: 'bipa_advanced', syn: 'penanaman modal', ant: 'penarikan dana' },
  { word: 'perdagangan', pron: '쁘르다가앙안', meaning: '상업, 무역', pos: '명사', root: 'dagang', subcat: 'bipa_intermediate', syn: 'niaga', ant: 'konsumsi mandiri' },
  { word: 'ketenagakerjaan', pron: '끄뜨나가꺼르자안', meaning: '노동, 고용 전반', pos: '명사', root: 'kerja', subcat: 'bipa_advanced', syn: 'sistem kerja', ant: 'pengangguran' }
];

const bipaCompiled = [];
bipaRaw.forEach((b, i) => {
  const item = createWordItem({
    id: `bipa_${String(i + 1).padStart(4, '0')}`,
    cat: 'bipa_levels',
    subcat: b.subcat,
    word: b.word,
    pron: b.pron,
    meaning: b.meaning,
    pos: b.pos,
    root: b.root,
    syn: b.syn,
    ant: b.ant
  });
  if (item) bipaCompiled.push(item);
});

fs.writeFileSync(
  path.join(__dirname, 'src/data/bipaTopics.js'),
  `export const bipaTopics = ${JSON.stringify(bipaCompiled, null, 2)};\n`,
  'utf-8'
);

// 6. Daily Living Vocab
const dailyLivingRaw = [
  { word: 'nasi goreng', pron: '나시 고렝', meaning: '인도네시아 볶음밥', pos: '명사', root: 'goreng', subcat: 'food_cooking_dining', syn: 'nasi goreng spesial', ant: 'nasi putih' },
  { word: 'sambal', pron: '삼발', meaning: '전통 고추 소스', pos: '명사', root: 'sambal', subcat: 'food_cooking_dining', syn: 'saus cabai', ant: 'kecap manis' },
  { word: 'macet', pron: '마쳇', meaning: '교통 체증, 막히다', pos: '형용사', root: 'macet', subcat: 'transport_travel_map', syn: 'padat merayap', ant: 'lancar' },
  { word: 'lancar', pron: '란짜르', meaning: '원활하다, 막힘없다', pos: '형용사', root: 'lancar', subcat: 'transport_travel_map', syn: 'mulus', ant: 'macet' },
  { word: 'pusing', pron: '뿌싱', meaning: '머리 아프다, 어지럽다', pos: '형용사', root: 'pusing', subcat: 'body_health_hospital', syn: 'sakit kepala', ant: 'segar' },
  { word: 'jahe', pron: '자헤', meaning: '생강', pos: '명사', root: 'jahe', subcat: 'food_cooking_dining', syn: 'rempah jahe', ant: 'gula' },
  { word: 'kunyit', pron: '꾸늣', meaning: '강황', pos: '명사', root: 'kunyit', subcat: 'food_cooking_dining', syn: 'kunir', ant: 'garam' },
  { word: 'serai', pron: '스라이', meaning: '레몬그라스', pos: '명사', root: 'serai', subcat: 'food_cooking_dining', syn: 'serai dapur', ant: 'daun' },
  { word: 'lemari baju', pron: '르마리 바주', meaning: '옷장', pos: '명사', root: 'lemari', subcat: 'home_appliances_living', syn: 'almari pakaian', ant: 'gantungan' },
  { word: 'meja makan', pron: '메자 마깐', meaning: '식탁', pos: '명사', root: 'meja', subcat: 'home_appliances_living', syn: 'meja santap', ant: 'lantai' }
];

const dailyLivingCompiled = [];
dailyLivingRaw.forEach((d, i) => {
  const item = createWordItem({
    id: `life_${String(i + 1).padStart(4, '0')}`,
    cat: 'daily_living_themes',
    subcat: d.subcat,
    word: d.word,
    pron: d.pron,
    meaning: d.meaning,
    pos: d.pos,
    root: d.root,
    syn: d.syn,
    ant: d.ant
  });
  if (item) dailyLivingCompiled.push(item);
});

fs.writeFileSync(
  path.join(__dirname, 'src/data/dailyLivingVocab.js'),
  `export const dailyLivingVocab = ${JSON.stringify(dailyLivingCompiled, null, 2)};\n`,
  'utf-8'
);

const currentCount = globalWordSet.size;
const remainingCount = TARGET_GOAL - currentCount;

console.log(`\n======================================================`);
console.log(`📊 [현재 데이터 구축 카운트 보고]`);
console.log(`- 이번 라운드 총 고유 단어 수: ${currentCount}개`);
console.log(`- 1만 단어 달성까지 남은 단어 수: ${remainingCount}개`);
console.log(`- 진행률: ${((currentCount / TARGET_GOAL) * 100).toFixed(2)}%`);
console.log(`======================================================\n`);
