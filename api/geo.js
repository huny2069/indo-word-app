/**
 * Vercel Serverless Geo-IP Endpoint (100% Free, Zero API Key, Adblocker-Proof)
 * Vercel Edge가 기본 제공하는 헤더에서 접속자의 실제 IP, 국가 코드, 도시, 지역, 타임존을 추출합니다.
 */

function countryCodeToFlag(cc) {
  if (!cc || typeof cc !== 'string' || cc.length !== 2) return '🌐';
  const code = cc.toUpperCase();
  if (code === 'XX' || code === 'T1') return '🌐';
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

function getCountryName(cc) {
  if (!cc || cc.length !== 2) return '';
  const code = cc.toUpperCase();
  const common = {
    KR: '대한민국 (South Korea)',
    ID: '인도네시아 (Indonesia)',
    US: '미국 (United States)',
    JP: '일본 (Japan)',
    SG: '싱가포르 (Singapore)',
    MY: '말레이시아 (Malaysia)',
    VN: '베트남 (Vietnam)',
    TH: '태국 (Thailand)',
    PH: '필리핀 (Philippines)',
    AU: '호주 (Australia)',
    CN: '중국 (China)',
    TW: '대만 (Taiwan)',
    HK: '홍콩 (Hong Kong)',
    GB: '영국 (United Kingdom)',
    CA: '캐나다 (Canada)',
    DE: '독일 (Germany)'
  };
  if (common[code]) return common[code];
  try {
    const koName = new Intl.DisplayNames(['ko'], { type: 'region' }).of(code);
    const enName = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    if (koName && enName && koName !== enName) return `${koName} (${enName})`;
    return koName || enName || code;
  } catch {
    return code;
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const forwarded = req.headers['x-forwarded-for'] || '';
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '';

  const countryCode = (req.headers['x-vercel-ip-country'] || '').toString().toUpperCase().trim();
  const rawCity = req.headers['x-vercel-ip-city'] || '';
  let city = '';
  try {
    city = rawCity ? decodeURIComponent(String(rawCity)) : '';
  } catch {
    city = String(rawCity);
  }
  const region = (req.headers['x-vercel-ip-country-region'] || '').toString();
  const timezone = (req.headers['x-vercel-ip-timezone'] || '').toString();

  return res.status(200).json({
    ok: true,
    ip,
    countryCode,
    country: getCountryName(countryCode),
    flag: countryCodeToFlag(countryCode),
    city,
    region,
    timezone,
    source: 'vercel-edge'
  });
}
