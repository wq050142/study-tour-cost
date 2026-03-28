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
  
  // 获取当前用户信息
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '用户信息获取失败' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { action, projectIds, folderId, targetFolderId } = body;
    
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: '请选择要操作的项目' }, { status: 400 });
    }
    
    switch (action) {
      case 'delete': {
        // 批量软删除（只删除当前用户的项目）
        const { error } = await client
          .from('projects')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', projectIds)
          .eq('user_id', user.id);  // 关键：只操作当前用户的项目
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, count: projectIds.length });
      }
      
      case 'move': {
        // 批量移动到文件夹（只移动当前用户的项目）
        const { error } = await client
          .from('projects')
          .update({ folder_id: targetFolderId || null })
          .in('id', projectIds)
          .eq('user_id', user.id);  // 关键：只操作当前用户的项目
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, count: projectIds.length });
      }
      
      case 'copy': {
        // 获取要复制的项目（只获取当前用户的项目）
        const { data: projects, error: fetchError } = await client
          .from('projects')
          .select('*')
          .in('id', projectIds)
          .eq('user_id', user.id);  // 关键：只获取当前用户的项目
        
        if (fetchError) {
          return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }
        
        // 创建副本（关联到当前用户）
        const copies = projects.map(p => ({
          user_id: user.id,  // 关键：副本属于当前用户
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
