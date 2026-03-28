'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { MapPin } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  
  // 重新发送验证邮件
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  useEffect(() => {
    const verifyEmail = async () => {
      // 从 URL hash 或查询参数中获取参数
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      
      // 检查是否有错误参数
      const error = hashParams.get('error') || searchParams.get('error');
      const errCode = hashParams.get('error_code') || searchParams.get('error_code');
      const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
      
      if (error) {
        console.error('Supabase error:', { error, errCode, errorDescription });
        setStatus('error');
        setErrorCode(errCode || '');
        // 解码错误描述
        setMessage(decodeURIComponent(errorDescription?.replace(/\+/g, ' ') || error || '验证失败'));
        return;
      }
      
      // 优先从 hash 获取，其次从查询参数获取
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token') || '';
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token') || '';
      const type = hashParams.get('type') || searchParams.get('type') || '';
      const tokenHash = searchParams.get('token_hash') || '';
      
      console.log('Verify params:', { accessToken: !!accessToken, type, tokenHash: !!tokenHash });
      
      if (!accessToken && !tokenHash) {
        setStatus('error');
        setMessage('无效的验证链接：缺少验证令牌');
        return;
      }
      
      // 验证邮箱类型
      if (type === 'signup' || type === 'email_change' || type === 'recovery') {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL;
          const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            setStatus('error');
            setMessage('服务配置错误');
            return;
          }
          
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // 方式1：使用 access_token 设置会话
          if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (sessionError) {
              console.error('Session error:', sessionError);
              setStatus('error');
              setMessage('验证失败：' + sessionError.message);
              return;
            }
            
            setStatus('success');
            setMessage('您的邮箱已验证成功！');
            return;
          }
          
          // 方式2：使用 token_hash 验证
          if (tokenHash) {
            const { error: otpError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type === 'email_change' ? 'email_change' : 'signup',
            });
            
            if (otpError) {
              console.error('OTP error:', otpError);
              setStatus('error');
              setMessage('验证失败：' + otpError.message);
              return;
            }
            
            setStatus('success');
            setMessage('您的邮箱已验证成功！');
            return;
          }
          
        } catch (err) {
          console.error('Verify error:', err);
          setStatus('error');
          setMessage('验证失败，请重试');
        }
      } else {
        setStatus('error');
        setMessage('无效的验证类型：' + (type || '未知'));
      }
    };
    
    verifyEmail();
  }, [searchParams]);
  
  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;
    
    setResending(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setMessage(data.error);
      } else {
        setResendSuccess(true);
        setMessage('');
      }
    } catch (err) {
      setMessage('发送失败，请重试');
    } finally {
      setResending(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-7 h-7 text-white" />
          </div>
          
          {status === 'loading' && (
            <>
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">正在验证...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">验证成功</h2>
              <p className="text-gray-500 mb-4">{message}</p>
              <Button onClick={() => router.push('/')}>立即登录</Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">验证失败</h2>
              <p className="text-gray-500 mb-4">{message}</p>
              
              {/* 如果链接过期，显示重新发送表单 */}
              {(errorCode === 'otp_expired' || message.includes('过期')) && !resendSuccess && (
                <form onSubmit={handleResendVerification} className="mt-4 space-y-3 text-left">
                  <p className="text-sm text-gray-500 text-center">重新发送验证邮件：</p>
                  <Input
                    type="email"
                    placeholder="请输入您的注册邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={resending}
                  />
                  <Button type="submit" className="w-full" disabled={resending || !email.trim()}>
                    {resending ? '发送中...' : '重新发送验证邮件'}
                  </Button>
                </form>
              )}
              
              {resendSuccess && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg">
                  验证邮件已发送，请查收邮箱
                </div>
              )}
              
              <div className="mt-4">
                <Button variant="outline" onClick={() => router.push('/')}>返回首页</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
