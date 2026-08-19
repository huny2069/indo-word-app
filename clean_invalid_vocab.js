import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧹 [비정상 합성어 및 어색한 파생어 전수 제거 및 1만 단어 정예 정화 파이프라인 가동]');

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

function isInvalidWord(w, meaning) {
  const cleanW = w.split('[[')[0].trim().toLowerCase();
  
  // 1. 비정상적인 pemakai + 단어 조합 (예: pemakai makan, pemakai takut 등)
  if (cleanW.startsWith('pemakai ') || cleanW.startsWith('pengguna ') || cleanW.startsWith('pihak ')) {
    return true;
  }

  // 2. 한국어 뜻에 영어/인도네시아어 어근이 '~사용자', '~되다', '~당하다'로 붙어있는 경우
  if (/^[a-z\s]+ (사용자|사용자는|하는 사람|하는 도구)/i.test(meaning)) {
    return true;
  }
  if (/^[a-z\s]+(되다|당하다|하다)/i.test(meaning)) {
    return true;
  }

  // 3. 어색한 이중 파생어 패턴
  if (cleanW.startsWith('berber') || cleanW.startsWith('memeng') || cleanW.startsWith('didi')) {
    return true;
  }

  return false;
}

let removedCount = 0;
let remainingTotal = 0;

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

      const cleanedData = data.filter(item => {
        if (isInvalidWord(item.word, item.meaning)) {
          removedCount++;
          return false;
        }
        return true;
      });

      remainingTotal += cleanedData.length;
      fs.writeFileSync(filePath, `export const ${varName} = ${JSON.stringify(cleanedData, null, 2)};\n`, 'utf-8');
      console.log(`🧹 ${fileName}: ${data.length - cleanedData.length}개 비정상 단어 제거 완료 (유효 단어: ${cleanedData.length}개)`);
    }
  } catch (err) {
    console.error(`❌ ${fileName} 처리 실패:`, err.message);
  }
});

console.log(`\n======================================================`);
console.log(`✨ [정화 결과: 총 ${removedCount}개 비정상 단어 영구 제거 완료!]`);
console.log(`- 현재 정화된 순수 유효 고유 단어 수: ${remainingTotal}개`);
console.log(`======================================================\n`);
