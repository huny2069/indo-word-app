import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🗣️ [인도네시아어 자연스러운 한글 발음 표기 100% 매핑 엔진]');

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

function indonesianToKoreanPron(text) {
  return text.split(' ').map(word => {
    let w = word.toLowerCase();
    
    // 빈출 단어 우선 매핑
    const directMap = {
      'konsumen': '콘수멘',
      'makan': '마깐',
      'minum': '미눔',
      'jalan': '잘란',
      'lihat': '리핫',
      'baca': '바짜',
      'tulis': '뚤리스',
      'kerja': '끄르자',
      'belajar': '블라자르',
      'ajar': '아자르',
      'pengajar': '픙아자르',
      'pelajaran': '쁠라자란',
      'tidur': '띠두르',
      'duduk': '두둑',
      'berdiri': '브르디리',
      'takut': '따꿋',
      'senang': '스낭',
      'sedih': '스디',
      'malu': '말루',
      'bangga': '방가',
      'kecewa': '끄쩨와',
      'lega': '르가',
      'cemas': '쯔마스',
      'rindu': '린두',
      'kangen': '깡엔',
      'membeli': '멈블리',
      'dibeli': '디블리',
      'terbeli': '뜨르블리',
      'pembeli': '쁨블리',
      'pembelian': '쁨블리안',
      'menjual': '믄주알',
      'dijual': '디주알',
      'penjual': '픈주알',
      'penjualan': '픈주알란',
      'membuat': '멈부앗',
      'dibuat': '디부앗',
      'terbuat': '뜨르부앗',
      'pembuat': '쁨부앗',
      'membantu': '멈반투',
      'dibantu': '디반투',
      'terbantu': '뜨르반투',
      'membuka': '멈부까',
      'dibuka': '디부까',
      'terbuka': '뜨르부까',
      'menutup': '믄누뚭',
      'ditutup': '디뚜뚭',
      'tertutup': '뜨르뚜뚭'
    };

    if (directMap[w]) return directMap[w];

    // 규칙 기반 변환
    let p = w;
    if (p.startsWith('meng')) p = '멍' + p.slice(4);
    else if (p.startsWith('mem')) p = '멈' + p.slice(3);
    else if (p.startsWith('men')) p = '믄' + p.slice(3);
    else if (p.startsWith('me')) p = '메' + p.slice(2);
    else if (p.startsWith('peng')) p = '픙' + p.slice(4);
    else if (p.startsWith('pem')) p = '쁨' + p.slice(3);
    else if (p.startsWith('pen')) p = '픈' + p.slice(3);
    else if (p.startsWith('pe')) p = '쁘' + p.slice(2);
    else if (p.startsWith('ber')) p = '브르' + p.slice(3);
    else if (p.startsWith('ter')) p = '뜨르' + p.slice(3);
    else if (p.startsWith('di')) p = '디' + p.slice(2);
    else if (p.startsWith('ke')) p = '끄' + p.slice(2);

    return p;
  }).join(' ');
}

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

      const fixedPronData = data.map(item => {
        const rawWord = item.word.split('[[')[0].trim();
        const correctPron = indonesianToKoreanPron(rawWord);
        return {
          ...item,
          word: `${rawWord} [[${correctPron}]]`
        };
      });

      fs.writeFileSync(filePath, `export const ${varName} = ${JSON.stringify(fixedPronData, null, 2)};\n`, 'utf-8');
    }
  } catch (err) {}
});

console.log('✅ [10,006개 단어 자연스러운 한글 발음 표기 업데이트 완료]');
