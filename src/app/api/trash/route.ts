import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取回收站项目列表
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  const client = getSupabaseClient(token);
  
  const { data, error } = await client
    .from('projects')
    .select('id, name, type, remark, created_at, updated_at, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // 转换字段名为 camelCase
  const projects = (data || []).map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    remark: p.remark,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    deletedAt: p.deleted_at,
  }));
  
  return NextResponse.json({ projects });
}
