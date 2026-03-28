import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 恢复项目
export async function POST(
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
  
  // 检查是否是批量操作
  if (id === 'batch') {
    return handleBatchOperation(client, request);
  }
  
  // 恢复单个项目：清除 deleted_at 字段
  const { data, error } = await client
    .from('projects')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .maybeSingle();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  if (!data) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }
  
  return NextResponse.json({ success: true, project: data });
}

// 永久删除项目
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
  
  // 永久删除
  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}

// 批量操作处理
async function handleBatchOperation(client: ReturnType<typeof getSupabaseClient>, request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectIds } = body;
    
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: '请选择要操作的项目' }, { status: 400 });
    }
    
    if (action === 'restore') {
      // 批量恢复
      const { error } = await client
        .from('projects')
        .update({ deleted_at: null })
        .in('id', projectIds);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: projectIds.length });
    }
    
    if (action === 'delete') {
      // 批量永久删除
      const { error } = await client
        .from('projects')
        .delete()
        .in('id', projectIds);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: projectIds.length });
    }
    
    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: '请求解析失败' }, { status: 400 });
  }
}
