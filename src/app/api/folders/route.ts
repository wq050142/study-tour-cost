import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取文件夹列表
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  const client = getSupabaseClient(token);
  
  const { data, error } = await client
    .from('folders')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // 转换字段名为 camelCase
  const folders = (data || []).map(f => ({
    id: f.id,
    name: f.name,
    parentId: f.parent_id,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));
  
  return NextResponse.json({ folders });
}

// 创建文件夹
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  const client = getSupabaseClient(token);
  
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { name, parentId } = body;
    
    if (!name?.trim()) {
      return NextResponse.json({ error: '文件夹名称不能为空' }, { status: 400 });
    }
    
    const { data, error } = await client
      .from('folders')
      .insert({
        user_id: user.id,
        name: name.trim(),
        parent_id: parentId || null,
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      folder: {
        id: data.id,
        name: data.name,
        parentId: data.parent_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (err) {
    return NextResponse.json({ error: '请求解析失败' }, { status: 400 });
  }
}
