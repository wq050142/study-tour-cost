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
  
  // 获取当前用户信息
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 });
  }
  
  // 获取查询参数
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  
  let query = client
    .from('projects')
    .select('id, name, type, remark, created_at, updated_at, folder_id')
    .eq('user_id', user.id)  // 关键：只查询当前用户的项目
    .is('deleted_at', null);
  
  // 按文件夹筛选
  if (folderId) {
    query = query.eq('folder_id', folderId);
  } else {
    // 不传 folderId 时，只显示根目录的项目
    query = query.is('folder_id', null);
  }
  
  const { data, error } = await query.order('updated_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // 转换字段名
  const projects = (data || []).map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    remark: p.remark,
    folderId: p.folder_id,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
  
  return NextResponse.json({ projects });
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
        core_config: DEFAULT_CORE_CONFIG,
        daily_expenses: [],
        other_expenses: DEFAULT_OTHER_EXPENSES,
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
