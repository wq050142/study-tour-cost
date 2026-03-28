'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface Session {
  access_token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; needsVerification?: boolean; message?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'study_tour_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从 localStorage 恢复 session
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as Session;
        setSession(parsed);
        setUser(parsed.user);
        
        // 验证 session 是否有效
        fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${parsed.access_token}` },
        })
          .then(res => res.json())
          .then(data => {
            if (!data.user) {
              // session 无效，清除
              localStorage.removeItem(SESSION_KEY);
              setSession(null);
              setUser(null);
            }
          })
          .catch(() => {
            localStorage.removeItem(SESSION_KEY);
            setSession(null);
            setUser(null);
          })
          .finally(() => setLoading(false));
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        return { error: new Error(data.error) };
      }
      
      // 注册成功，提示用户验证邮箱
      return { 
        error: null,
        needsVerification: true,
        message: '注册成功！验证邮件已发送到您的邮箱，请查收并点击验证链接。'
      };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('注册失败') };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        return { error: new Error(data.error) };
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.session));
      }
      
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('登录失败') };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
