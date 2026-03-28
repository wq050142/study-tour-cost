import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 重置密码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;
    
    if (!token || !password) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }
    
    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少需要6个字符' }, { status: 400 });
    }
    
    const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: '服务配置错误' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 使用 token 验证并更新密码
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });
    
    if (error) {
      return NextResponse.json({ error: '链接已过期或无效' }, { status: 400 });
    }
    
    // 更新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '密码重置成功',
      session: data.session
    });
  } catch (err) {
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 });
  }
}
