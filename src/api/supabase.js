import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase 설정 가져오기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 클라이언트 초기화 (설정값이 없을 경우 null 반환하여 에러 방지)
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * [사용량 로그 전송]
 * @param {Object} data { user_id, tokens_used, cost_usd, topic }
 */
export const logUsage = async (data) => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('usage_logs')
      .insert([
        { 
          user_id: data.user_id || 'anonymous',
          tokens_used: data.tokens_used || 0,
          cost_usd: data.cost_usd || 0,
          topic: data.topic || 'unknown'
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
    const { error } = await supabase
      .from('access_logs')
      .insert([
        { 
          user_id: userId || 'anonymous',
          user_agent: navigator.userAgent
        }
      ]);
    if (error) console.error('Supabase Access Log Error:', error);
  } catch (err) {
    console.error('Supabase Access Log Exception:', err);
  }
};
