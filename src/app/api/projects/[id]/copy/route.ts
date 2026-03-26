import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 复制项目
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
  
  // 获取原项目
  const { data: original, error: fetchError } = await client
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  
  if (!original) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }
  
  // 创建副本
  const { data, error } = await client
    .from('projects')
    .insert({
      name: `${original.name} (副本)`,
      type: original.type,
      remark: original.remark,
      core_config: original.core_config,
      daily_expenses: original.daily_expenses,
      other_expenses: original.other_expenses,
    })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ project: data });
}
