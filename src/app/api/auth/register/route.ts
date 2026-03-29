import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 用户注册
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }
    
    // 获取不带 token 的客户端进行注册
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) {
      // 处理特定错误
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        return NextResponse.json({ error: '该邮箱已被注册' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // 注册成功，返回 session（无需邮箱验证）
    return NextResponse.json({ 
      success: true, 
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 });
  }
}
