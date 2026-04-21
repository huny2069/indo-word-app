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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // 1. 메인 엔진: ipify (IPv4/IPv6 공용)
    try {
      const res = await fetch('https://api64.ipify.org?format=json', { signal: controller.signal });
      const data = await res.json();
      if (data.ip && !data.ip.startsWith('0.0.0.0')) {
        clearTimeout(timeoutId);
        return data.ip;
      }
    } catch (e) { /* ignore */ }

    // 2. 백업 엔진 1: Cloudflare trace (도메인 기반이 더 안정적임)
    try {
      const cfRes = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: controller.signal });
      if (cfRes.ok) {
        const text = await cfRes.text();
        const ipLine = text.split('\n').find(line => line.startsWith('ip='));
        if (ipLine) {
          clearTimeout(timeoutId);
          return ipLine.split('=')[1];
        }
      }
    } catch (e) { /* ignore */ }

    // 3. 백업 엔진 2: jsonip.com
    try {
      const res = await fetch('https://jsonip.com', { signal: controller.signal });
      const data = await res.json();
      if (data.ip) {
        clearTimeout(timeoutId);
        return data.ip;
      }
    } catch (e) { /* ignore */ }

    clearTimeout(timeoutId);
    return 'unknown';
  } catch (err) {
    return 'unknown';
  }
};

/**
 * [사용량 로그 전송]
 * @param {Object} data { user_id, email, tokens_used, cost_usd, topic }
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
          email: data.email || null,
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
 * @param {string} email 사용자 이메일 (있을 경우)
 */
export const logAccess = async (userId, email = null) => {
  if (!supabase) return;
  try {
    const ip = await getClientIp();
    const { error } = await supabase
      .from('access_logs')
      .insert([
        { 
          user_id: userId || 'anonymous',
          email: email,
          user_agent: navigator.userAgent,
          ip: ip
        }
      ]);
    if (error) console.error('Supabase Access Log Error:', error);
  } catch (err) {
    console.error('Supabase Access Log Exception:', err);
  }
};

/**
 * [특정 테이블 로그 전체 삭제]
 * @param {string} tableName 삭제할 테이블 명
 */
export const deleteLogs = async (tableName) => {
    if (!supabase) return { error: 'Supabase Not Connected' };
    try {
        // Supabase에서 전체 행 삭제를 위해 필터 명시 (id가 null 아님)
        const { error } = await supabase
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // UUID 대상 모든 행 선택용 트릭
        
        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error(`Delete Logs (${tableName}) Error:`, err);
        return { error: err.message };
    }
};

/**
 * [공유 단어 데이터베이스 조회]
 * @param {string} topic 검색 주제
 * @param {boolean} isIndoMode 한국인 모드(false) / 인니인 모드(true)
 */
export const fetchSharedWords = async (topic, isIndoMode) => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('shared_words')
      .select('*')
      .eq('topic', topic)
      .eq('study_lang', studyLang)
      .eq('user_lang', userLang);
    
    if (error) {
      console.error('Supabase Shared Words Fetch Error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Supabase Shared Words Fetch Exception:', err);
    return [];
  }
};

/**
 * [공유 단어 데이터베이스에 저장]
 * @param {Array} words 저장할 단어 배열
 */
export const saveSharedWords = async (words) => {
  if (!supabase || !words || words.length === 0) return;
  try {
    const { error } = await supabase
      .from('shared_words')
      .upsert(words, { onConflict: 'word, user_lang, study_lang' });
    
    if (error) console.error('Supabase Shared Words Save Error:', error);
  } catch (err) {
    console.error('Supabase Shared Words Save Exception:', err);
  }
};
