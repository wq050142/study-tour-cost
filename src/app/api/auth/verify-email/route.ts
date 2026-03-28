import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 验证邮箱
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, type } = body;
    
    if (!token) {
      return NextResponse.json({ error: '无效的验证链接' }, { status: 400 });
    }
    
    const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: '服务配置错误' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 验证邮箱
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type === 'email_change' ? 'email_change' : 'signup',
    });
    
    if (error) {
      return NextResponse.json({ error: '链接已过期或无效' }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '邮箱验证成功',
      session: data.session
    });
  } catch (err) {
    return NextResponse.json({ error: '验证失败' }, { status: 500 });
  }
}
