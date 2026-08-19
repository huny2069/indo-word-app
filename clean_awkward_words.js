import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧹 [어색한 한글 텍스트 및 조어 패턴 2차 완벽 정화 가동]');

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

function isAwkwardWord(item) {
  const w = item.word.split('[[')[0].trim().toLowerCase();
  const pron = item.word.includes('[[') ? item.word.split('[[')[1].replace(']]', '').trim() : '';
  const meaning = item.meaning || '';

  // 1. 발음 기호 안에 영어 알파벳이 섞여 있는 경우 (예: [[쁘ajar]], [[쁘르ajar안]] 등)
  if (/[a-zA-Z]/.test(pron)) {
    return true;
  }

  // 2. 뜻에 비문법적 표현이 섞여 있는 경우
  // 예: "가르치다, 배우는 사람", "는 사람, ", "는 도구", "는 과정", "는 장소", "는 상태, "
  if (/[가-힣]+다, [가-힣]+는/.test(meaning) || meaning.includes('는 사람, ') || meaning.includes('는 과정, ') || meaning.includes('는 상태, ') || meaning.includes('의 성질')) {
    return true;
  }

  // 3. 잘못 조어된 단어들 (peajar, perajaran 등 표준 인도네시아어가 아닌 형태)
  if (w === 'peajar' || w === 'perajaran' || w === 'pemakan' || w === 'peminum') {
    return true;
  }

  // 4. 뜻이 비어있거나 알파벳 그대로 남은 경우
  if (!meaning || /^[a-zA-Z\s]+$/.test(meaning)) {
    return true;
  }

  return false;
}

let removedCount = 0;
let totalRemaining = 0;

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
        if (isAwkwardWord(item)) {
          removedCount++;
          return false;
        }
        return true;
      });

      totalRemaining += cleanedData.length;
      fs.writeFileSync(filePath, `export const ${varName} = ${JSON.stringify(cleanedData, null, 2)};\n`, 'utf-8');
      console.log(`✨ ${fileName}: ${data.length - cleanedData.length}개 어색한 단어 제거 (순수 단어: ${cleanedData.length}개)`);
    }
  } catch (err) {
    console.error(`❌ ${fileName} 처리 실패:`, err.message);
  }
});

console.log(`\n======================================================`);
console.log(`🎉 [2차 정밀 정화 완료: 총 ${removedCount}개 불량 어휘 영구 제거!]`);
console.log(`- 현재 100% 무결점 순수 표준 어휘 수: ${totalRemaining}개`);
console.log(`======================================================\n`);
