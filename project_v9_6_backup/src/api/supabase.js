import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase 설정 가져오기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 클라이언트 초기화 (설정값이 없을 경우 null 반환하여 에러 방지)
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * [IP 주소 가져오기]
 */
const getClientIp = async () => {
  try {
    // 1. 메인 엔진: ipify (IPv4) - 타임아웃 3초 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      // 비정상적인 IP (0.0.0.0 등) 필터링
      if (data.ip && !data.ip.startsWith('0.0.0.0') && data.ip !== '127.0.0.1') {
        return data.ip;
      }
    } catch (e) {
      // 메인 실패 시 조용히 백업으로 넘어감
    }

    // 2. 백업 엔진: Cloudflare trace (더 안정적임)
    const cfRes = await fetch('https://1.1.1.1/cdn-cgi/trace');
    if (cfRes.ok) {
      const text = await cfRes.text();
      const ipLine = text.split('\n').find(line => line.startsWith('ip='));
      if (ipLine) return ipLine.split('=')[1];
    }

    return 'unknown';
  } catch (err) {
    return 'unknown';
  }
};

/**
 * [사용량 로그 전송]
 * @param {Object} data { user_id, tokens_used, cost_usd, topic }
 */
export const logUsage = async (data) => {
  if (!supabase) return;
  try {
    const ip = await getClientIp();
    const { error } = await supabase
      .from('usage_logs')
      .insert([
        { 
          user_id: data.user_id || 'anonymous',
          tokens_used: data.tokens_used || 0,
          cost_usd: data.cost_usd || 0,
          topic: data.topic || 'unknown',
          ip: ip
        }
      ]);
    if (error) console.error('Supabase Usage Log Error:', error);
  } catch (err) {
    console.error('Supabase Usage Log Exception:', err);
  }
};

/**
 * [접속 로그 전송]
 * @param {string} userId 익명 사용자 ID
 */
export const logAccess = async (userId) => {
  if (!supabase) return;
  try {
    const ip = await getClientIp();
    const { error } = await supabase
      .from('access_logs')
      .insert([
        { 
          user_id: userId || 'anonymous',
          user_agent: navigator.userAgent,
          ip: ip
        }
      ]);
    if (error) console.error('Supabase Access Log Error:', error);
  } catch (err) {
    console.error('Supabase Access Log Exception:', err);
  }
};
