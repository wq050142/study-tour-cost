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
  
  // 恢复项目：清除 deleted_at 字段
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
