'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { MapPin } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  
  const token = searchParams.get('token') || searchParams.get('token_hash') || '';
  const type = searchParams.get('type');
  
  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('无效的验证链接');
        return;
      }
      
      // 如果是邮箱验证类型
      if (type === 'signup' || type === 'email_change') {
        try {
          const response = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, type }),
          });
          
          const data = await response.json();
          
          if (data.error) {
            setStatus('error');
            setMessage(data.error);
          } else {
            setStatus('success');
            setMessage('您的邮箱已验证成功！');
          }
        } catch (err) {
          setStatus('error');
          setMessage('验证失败，请重试');
        }
      } else {
        setStatus('error');
        setMessage('无效的验证类型');
      }
    };
    
    verifyEmail();
  }, [token, type]);
  
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
              <div className="flex gap-2 justify-center">
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
