import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 批量操作项目
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  const client = getSupabaseClient(token);
  
  try {
    const body = await request.json();
    const { action, projectIds, folderId, targetFolderId } = body;
    
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: '请选择要操作的项目' }, { status: 400 });
    }
    
    switch (action) {
      case 'delete': {
        // 批量软删除
        const { error } = await client
          .from('projects')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', projectIds);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, count: projectIds.length });
      }
      
      case 'move': {
        // 批量移动到文件夹
        const { error } = await client
          .from('projects')
          .update({ folder_id: targetFolderId || null })
          .in('id', projectIds);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, count: projectIds.length });
      }
      
      case 'copy': {
        // 获取要复制的项目
        const { data: projects, error: fetchError } = await client
          .from('projects')
          .select('*')
          .in('id', projectIds);
        
        if (fetchError) {
          return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }
        
        // 创建副本
        const copies = projects.map(p => ({
          name: `${p.name} (副本)`,
          type: p.type,
          remark: p.remark,
          core_config: p.core_config,
          daily_expenses: p.daily_expenses,
          other_expenses: p.other_expenses,
          folder_id: targetFolderId || p.folder_id,
        }));
        
        const { error: insertError } = await client
          .from('projects')
          .insert(copies);
        
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, count: projectIds.length });
      }
      
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: '请求解析失败' }, { status: 400 });
  }
}
