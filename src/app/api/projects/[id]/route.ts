import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取单个项目
export async function GET(
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
  
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)  // 关键：验证项目属于当前用户
    .maybeSingle();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  if (!data) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }
  
  return NextResponse.json({ project: data });
}

// 更新项目
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
    const { name, remark, core_config, daily_expenses, other_expenses } = body;
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (name !== undefined) updateData.name = name;
    if (remark !== undefined) updateData.remark = remark;
    if (core_config !== undefined) updateData.core_config = core_config;
    if (daily_expenses !== undefined) updateData.daily_expenses = daily_expenses;
    if (other_expenses !== undefined) updateData.other_expenses = other_expenses;
    
    const { data, error } = await client
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)  // 关键：验证项目属于当前用户
      .select()
      .maybeSingle();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '项目不存在或无权限' }, { status: 404 });
    }
    
    return NextResponse.json({ project: data });
  } catch (err) {
    return NextResponse.json({ error: '请求解析失败' }, { status: 400 });
  }
}

// 软删除项目（移入回收站）
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
  
  // 软删除：设置 deleted_at 字段，同时验证用户权限
  const { error } = await client
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);  // 关键：验证项目属于当前用户
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}
