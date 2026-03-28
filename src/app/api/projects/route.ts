import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { DEFAULT_CORE_CONFIG, DEFAULT_OTHER_EXPENSES } from '@/types';

// 获取用户的所有项目
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  const client = getSupabaseClient(token);
  
  const { data, error } = await client
    .from('projects')
    .select('id, name, type, remark, created_at, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ projects: data });
}

// 创建新项目
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  const client = getSupabaseClient(token);
  
  // 获取当前用户信息
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { name, type, remark } = body;
    
    if (!name || !type) {
      return NextResponse.json({ error: '项目名称和类型不能为空' }, { status: 400 });
    }
    
    const { data, error } = await client
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        type,
        remark: remark || '',
        config: DEFAULT_CORE_CONFIG,
        daily_costs: [],
        other_costs: DEFAULT_OTHER_EXPENSES,
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ project: data });
  } catch (err) {
    return NextResponse.json({ error: '请求解析失败' }, { status: 400 });
  }
}
