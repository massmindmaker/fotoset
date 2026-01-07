'use client';

/**
 * Sign Up Page
 *
 * Registration via:
 * - Google OAuth
 * - Email/Password
 *
 * Uses Neon Auth (Better Auth) for authentication.
 */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient, useSession } from '@/lib/auth/client';

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const referralCode = searchParams.get('ref');

  // Redirect if already signed in
  useEffect(() => {
    if (session?.user && !isPending) {
      router.push(redirectTo);
    }
  }, [session, isPending, router, redirectTo]);

  // Store referral code in localStorage for post-signup processing
  useEffect(() => {
    if (referralCode) {
      const sanitized = referralCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (sanitized.length >= 6 && sanitized.length <= 10) {
        localStorage.setItem('pinglass_referral_code', sanitized);
      }
    }
  }, [referralCode]);

  // Handle Google sign up
  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: redirectTo,
      });
    } catch (err) {
      console.error('Google sign up error:', err);
      setError('Ошибка регистрации через Google. Попробуйте ещё раз.');
      setIsLoading(false);
    }
  };

  // Handle email/password sign up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Введите email и пароль');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: name || '',
        callbackURL: redirectTo,
      });

      if (result.error) {
        setError(result.error.message || 'Ошибка регистрации');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Email sign up error:', err);
      setError('Ошибка регистрации. Попробуйте снова.');
      setIsLoading(false);
    }
  };

  // Show loading while checking session
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Загрузка...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Создать аккаунт</CardTitle>
          <CardDescription>
            Зарегистрируйтесь, чтобы создавать AI-портреты
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Referral badge */}
          {referralCode && (
            <div className="text-center text-sm bg-primary/10 text-primary py-2 px-4 rounded-lg">
              Вы пришли по приглашению
            </div>
          )}

          {/* Google OAuth */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignUp}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Зарегистрироваться через Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                или
              </span>
            </div>
          </div>

          {/* Email/Password */}
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя (необязательно)</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Минимум 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </Button>
          </form>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{' '}
            <Link href="/auth/sign-in" className="text-primary hover:underline">
              Войти
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              ← Вернуться на главную
            </Link>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Регистрируясь, вы соглашаетесь с{' '}
            <Link href="/legal/terms" className="underline">
              условиями использования
            </Link>{' '}
            и{' '}
            <Link href="/legal/privacy" className="underline">
              политикой конфиденциальности
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Загрузка...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}
