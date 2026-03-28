import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 重新发送验证邮件
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json({ error: '邮箱不能为空' }, { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    // 构建验证邮件的跳转链接
    const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT 
      || process.env.NEXT_PUBLIC_SITE_URL 
      || 'http://124.220.204.124:8080';
    const redirectTo = `${baseUrl}/auth/verify-email`;
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '验证邮件已重新发送，请查收' 
    });
  } catch (err) {
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 });
  }
}
