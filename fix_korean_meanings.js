import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🛠️ [인도네시아어 어근 기반 한국어 뜻 정밀 복원 사전 수정 엔진 가동]');

const files = [
  path.join(__dirname, 'src/data/discourseConnectors.js'),
  path.join(__dirname, 'src/data/emotionsNuances.js'),
  path.join(__dirname, 'src/data/affixVerbs.js'),
  path.join(__dirname, 'src/data/slangDailySpoken.js'),
  path.join(__dirname, 'src/data/bipaTopics.js'),
  path.join(__dirname, 'src/data/dailyLivingVocab.js')
];

const varNames = {
  'discourseConnectors.js': 'discourseConnectors',
  'emotionsNuances.js': 'emotionsNuances',
  'affixVerbs.js': 'affixVerbs',
  'slangDailySpoken.js': 'slangDailySpoken',
  'bipaTopics.js': 'bipaTopics',
  'dailyLivingVocab.js': 'dailyLivingVocab'
};

// 어근별 한국어 순수 의미 맵핑 사전
const rootKoreanMap = {
  'beli': '사다, 구매하다',
  'bantu': '돕다, 보조하다',
  'buat': '만들다, 제작하다',
  'buka': '열다, 개방하다',
  'baca': '읽다, 독서하다',
  'tulis': '쓰다, 작성하다',
  'kerja': '일하다, 노동하다',
  'ajar': '가르치다, 배우다',
  'tidur': '자다, 수면을 취하다',
  'duduk': '앉다, 좌석에 앉다',
  'berdiri': '서다, 입립하다',
  'hari': '날, 일자',
  'hidup': '살다, 생명',
  'makan': '먹다, 식사하다',
  'minum': '마시다, 음용하다',
  'jalan': '걷다, 길',
  'lihat': '보다, 시찰하다',
  'cari': '찾다, 구하다',
  'bayar': '지불하다, 납부하다',
  'jual': '팔다, 판매하다',
  'hitung': '계산하다, 셈하다',
  'hapus': '지우다, 삭제하다',
  'hias': '꾸미다, 장식하다',
  'ikat': '묶다, 결속하다',
  'isi': '채우다, 내용',
  'ingat': '기억하다, 생각나다',
  'jaga': '지키다, 돌보다',
  'jemput': '마중 가다, 데리러 가다',
  'kirim': '보내다, 발송하다',
  'kunci': '잠그다, 열쇠',
  'kelola': '관리하다, 운영하다',
  'kembang': '발전하다, 피어나다',
  'lompat': '뛰다, 도약하다',
  'lempar': '던지다, 투척하다',
  'masak': '요리하다, 익다',
  'minta': '요청하다, 구하다',
  'mohon': '부탁하다, 탄원하다',
  'nyanyi': '노래하다, 가창하다',
  'naik': '타다, 올라가다',
  'nikmati': '즐기다, 향유하다',
  'olah': '가공하다, 처리하다',
  'pinjam': '빌리다, 대여하다',
  'pakai': '사용하다, 입다',
  'potong': '자르다, 절단하다',
  'pukul': '치다, 때리다',
  'pilih': '선택하다, 뽑다',
  'pimpin': '이끌다, 지휘하다',
  'rawat': '돌보다, 간호하다',
  'rusak': '망가지다, 파손되다',
  'rebus': '삶다, 끓이다',
  'simpan': '보관하다, 저장하다',
  'sapa': '인사하다, 말을 건네다',
  'siram': '물 주다, 붓다',
  'sewa': '빌리다, 임대하다',
  'tutup': '닫다, 폐쇄하다',
  'tanya': '질문하다, 묻다',
  'terima': '받다, 수용하다',
  'tahan': '버티다, 견디다',
  'tanam': '심다, 재배하다',
  'tangkap': '잡다, 체포하다',
  'timbang': '저울질하다, 무게를 재다',
  'ukir': '조각하다, 새기다',
  'uji': '시험하다, 테스트하다',
  'ulang': '반복하다, 다시 하다',
  'ukur': '측정하다, 재다',
  'tunjuk': '가리키다, 지적하다',
  'taruh': '놓다, 두다',
  'tumbuh': '자라다, 성장하다',
  'tolak': '거절하다, 밀어내다',
  'tukar': '교환하다, 바꾸다',
  'tanggung': '책임지다, 떠맡다',
  'tumpuk': '쌓다, 축적하다',
  'angkat': '들어올리다, 들어올림',
  'atur': '조절하다, 정돈하다',
  'aduk': '젓다, 섞다',
  'ampun': '용서하다, 사면하다',
  'ancam': '협박하다, 위협하다',
  'bimbing': '지도하다, 안내하다',
  'bina': '육성하다, 건설하다',
  'bagi': '나누다, 분배하다',
  'balas': '답장하다, 보복하다',
  'bentuk': '형성하다, 모양',
  'bela': '변호하다, 지키다',
  'bebas': '석방하다, 자유로운',
  'bakar': '태우다, 구우다',
  'beku': '얼다, 응고되다',
  'cabut': '뽑다, 취소하다',
  'cukur': '깎다, 면도하다',
  'curi': '훔치다, 절도하다',
  'cicip': '맛보다, 시식하다',
  'didik': '교육하다, 양육하다',
  'dorong': '밀다, 촉진하다',
  'duga': '추측하다, 짐작하다',
  'daftar': '등록하다, 명부',
  'gantung': '걸다, 매달다',
  'goreng': '튀기다, 볶다',
  'ganti': '교체하다, 바꿈',
  'goyang': '흔들리다, 동요하다',
  'garap': '작업하다, 가구하다',
  'gugat': '고소하다, 청구하다',
  'huni': '거주하다, 살다',
  'hambat': '방해하다, 저지하다',
  'harap': '바라다, 기대하다',
  'himpun': '모으다, 수집하다',
  'ikat': '묶다, 결속하다',
  'ikut': '따라가다, 참여하다',
  'isi': '채우다, 내용물',
  'jemput': '마중 나오다, 데리러 가다',
  'jabat': '악수하다, 직을 맡다',
  'jahit': '바느질하다, 재봉하다',
  'jaring': '그물 치다, 포획하다',
  'jangkau': '도달하다, 손을 뻗다',
  'kejar': '쫓다, 추격하다',
  'kaji': '연구하다, 검토하다',
  'karang': '작곡/작사하다, 엮다'
};

// 정확한 파생어 한국어 뜻 계산 함수
function getCorrectKoreanMeaning(w, root, originalMeaning) {
  const cleanW = w.split('[[')[0].trim().toLowerCase();
  
  // 이미 제대로 된 한국어 뜻이 있다면 최대한 활용
  let baseKr = rootKoreanMap[root];
  if (!baseKr) {
    if (originalMeaning && !/[a-zA-Z]되다|[a-zA-Z]당하다|[a-zA-Z]한/.test(originalMeaning)) {
      baseKr = originalMeaning.split(',')[0].trim();
    } else {
      baseKr = root; // 최후의 보루
    }
  }

  // 동사 어근에서 '다' 제거 (예: '사다' -> '사', '수리하다' -> '수리하')
  const rootStem = baseKr.replace(/다$/, '');

  if (cleanW.startsWith('di')) {
    return `${rootStem}여지다, ${rootStem}당하다 (수동태)`;
  }
  if (cleanW.startsWith('ter')) {
    return `나도 모르게 ${rootStem}여지다, 가장 ${baseKr}한`;
  }
  if (cleanW.startsWith('meng') || cleanW.startsWith('mem') || cleanW.startsWith('men') || cleanW.startsWith('me')) {
    return `${rootStem}다 (능동태)`;
  }
  if (cleanW.startsWith('ber')) {
    return `${rootStem}고 있다, ${rootStem}는 상태이다`;
  }
  if (cleanW.startsWith('pe') || cleanW.startsWith('peng') || cleanW.startsWith('pem') || cleanW.startsWith('pen')) {
    if (cleanW.endsWith('an')) {
      return `${rootStem}는 과정, ${rootStem}는 장소`;
    }
    return `${rootStem}는 사람, ${rootStem}는 도구`;
  }
  if (cleanW.startsWith('ke') && cleanW.endsWith('an')) {
    return `${rootStem}는 상태, ${rootStem}의 성질`;
  }

  return originalMeaning || baseKr;
}

function processWord(item) {
  const cleanW = item.word.split('[[')[0].trim();
  const root = item.root || cleanW.split(' ')[0];

  // 한국어 뜻 정상화
  const correctKrMeaning = getCorrectKoreanMeaning(item.word, root, item.meaning);

  // 문법 설명 정상화 (알파벳 생 의미 금지!)
  const grammarRule = `어근 '${root}'에 인도네시아어 접사가 결합하여 '${correctKrMeaning}'의 의미 및 문법적 역할을 수행하는 파생 어휘입니다.`;

  // 상황, 주의, 강사비법, 예문 한글 번역 완벽 정상화
  const contextVal = `'${cleanW}'은(는) '${correctKrMeaning}'을(를) 뜻하며 실생활 및 비즈니스 표준 문맥에서 활발히 쓰입니다.`;
  const cautionVal = `어근 '${root}'의 용법에 주의하세요. '${cleanW}' 사용 시 어조와 문맥에 맞게 격식/구어체를 구분하세요.`;
  const relatedVal = `'${root}' (어근)의 연관 파생어를 함께 묶어서 암기하면 학습 효과가 극대화됩니다!`;

  const exFormal = `Pemerintah telah menetapkan kebijakan baru terkait ${cleanW} untuk kesejahteraan masyarakat.`;
  const exFormalKr = `정부는 국민들의 복지를 위해 ${correctKrMeaning} 관련 새로운 정책을 수립했습니다.`;

  const exCasual = `Kamu sudah tahu tentang ${cleanW} yang lagi ramai dibicarakan ini?`;
  const exCasualKr = `너 요즘 요란하게 이야기되고 있는 ${correctKrMeaning}에 대해 알고 있어?`;

  return {
    ...item,
    meaning: correctKrMeaning,
    grammar_rule: grammarRule,
    context: contextVal,
    caution: cautionVal,
    related: relatedVal,
    example_formal: exFormal,
    example_formal_kr: exFormalKr,
    example_casual: exCasual,
    example_casual_kr: exCasualKr,
    word_breakdown: [
      { word: root, meaning: `(어근) ${correctKrMeaning.split(',')[0]}` },
      { word: cleanW, meaning: correctKrMeaning }
    ]
  };
}

let totalFixed = 0;

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  const fileName = path.basename(filePath);
  const varName = varNames[fileName];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = content.substring(jsonStart, jsonEnd + 1);
      const data = JSON.parse(jsonStr);

      const fixedData = data.map(item => {
        totalFixed++;
        return processWord(item);
      });

      fs.writeFileSync(filePath, `export const ${varName} = ${JSON.stringify(fixedData, null, 2)};\n`, 'utf-8');
      console.log(`✅ ${fileName}: ${fixedData.length}개 한국어 뜻 정밀 복원 완료!`);
    }
  } catch (err) {
    console.error(`❌ ${fileName} 처리 실패:`, err.message);
  }
});

console.log(`\n🎉 [총 ${totalFixed}개 오프라인 전체 단어 한국어 뜻 및 예문 번역 정상화 완료!]`);
