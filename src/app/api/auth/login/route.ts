import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 用户登录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }
    
    // 获取不带 token 的客户端进行登录
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      // 处理特定错误
      if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
        return NextResponse.json({ 
          error: '请先验证您的邮箱。如果没有收到验证邮件，请检查垃圾箱或重新注册。' 
        }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    // 检查邮箱是否已验证
    if (data.user && !data.user.email_confirmed_at) {
      return NextResponse.json({ 
        error: '请先验证您的邮箱。验证链接已发送到您的注册邮箱。' 
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      success: true, 
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 });
  }
}
