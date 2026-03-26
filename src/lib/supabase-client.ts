import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 在 Next.js 中，客户端只能访问 NEXT_PUBLIC_ 前缀的环境变量
// 但在服务器端 COZE_SUPABASE_URL 和 COZE_SUPABASE_ANON_KEY 会被注入
// 这里我们尝试两种方式获取

function getSupabaseCredentials() {
  // 优先使用 NEXT_PUBLIC_ 前缀的变量（客户端可用）
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // 如果没有，尝试使用 COZE_ 前缀的变量（服务器端注入）
  if (!url || !anonKey) {
    url = process.env.COZE_SUPABASE_URL;
    anonKey = process.env.COZE_SUPABASE_ANON_KEY;
  }
  
  return { url: url || '', anonKey: anonKey || '' };
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseCredentials();

// 创建一个懒加载的 Supabase 客户端
let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      // 返回一个空操作的客户端，避免应用崩溃
      console.warn('Supabase credentials not configured. Please set environment variables.');
      // 创建一个占位客户端
      supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } else {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
      });
    }
  }
  return supabaseInstance;
}

// 导出一个 getter 函数而不是直接导出实例
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});

// 检查 Supabase 是否已配置
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export type { User, Session } from '@supabase/supabase-js';
