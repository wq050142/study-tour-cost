import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 修改密码
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  const client = getSupabaseClient(token);
  
  // 验证用户
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { newPassword } = body;
    
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: '密码至少需要6个字符' }, { status: 400 });
    }
    
    // 更新密码
    const { error } = await client.auth.updateUser({
      password: newPassword,
    });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '密码修改成功' 
    });
  } catch (err) {
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 });
  }
}
