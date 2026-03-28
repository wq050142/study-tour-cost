import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 更新文件夹
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    const { name, parentId } = body;
    
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parent_id = parentId;
    
    const { data, error } = await client
      .from('folders')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)  // 关键：只操作当前用户的文件夹
      .select()
      .maybeSingle();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '文件夹不存在' }, { status: 404 });
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

// 删除文件夹（软删除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  
  // 软删除文件夹（只删除当前用户的）
  const { error } = await client
    .from('folders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);  // 关键：只操作当前用户的文件夹
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // 同时将文件夹内的项目移到根目录（只移动当前用户的项目）
  await client
    .from('projects')
    .update({ folder_id: null })
    .eq('folder_id', id)
    .eq('user_id', user.id);  // 关键：只操作当前用户的项目
  
  return NextResponse.json({ success: true });
}
