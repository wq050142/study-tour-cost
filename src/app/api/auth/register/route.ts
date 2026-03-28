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
    
    // 构建验证邮件的跳转链接
    // 优先使用环境变量，否则使用生产域名
    const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT 
      || process.env.NEXT_PUBLIC_SITE_URL 
      || 'http://124.220.204.124:8080';
    const redirectTo = `${baseUrl}/auth/verify-email`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    
    if (error) {
      // 处理特定错误
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        return NextResponse.json({ error: '该邮箱已被注册' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // 注册成功，返回提示（不返回 session，需要验证邮箱）
    return NextResponse.json({ 
      success: true, 
      message: '注册成功！验证邮件已发送到您的邮箱，请查收并点击验证链接。',
      needsVerification: true,
    });
  } catch (err) {
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 });
  }
}
