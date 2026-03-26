import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取当前用户信息
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ user: null });
  }
  
  const token = authHeader.substring(7);
  const supabase = getSupabaseClient(token);
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json({ user: null });
  }
  
  return NextResponse.json({ 
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    }
  });
}
