'use client';

/**
 * Stack Auth Handler Page
 *
 * This catch-all page handles all Stack Auth (Neon Auth) requests:
 * - OAuth callbacks (Google, GitHub)
 * - Magic link verification
 * - Sign out
 * - Token refresh
 *
 * Stack Auth v2.x uses React component approach instead of API routes.
 *
 * @see https://docs.stack-auth.com/getting-started/setup
 */

import { Component, type ReactNode } from 'react';
import { StackHandler } from '@stackframe/stack';
import { stackServerApp, isStackAuthConfigured } from '@/lib/neon-auth';

/**
 * Error Boundary for StackHandler
 * Catches and displays auth-related errors gracefully
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AuthErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Auth Error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md text-center space-y-4">
              <h2 className="text-xl font-semibold text-destructive">
                Ошибка авторизации
              </h2>
              <p className="text-muted-foreground">
                Произошла ошибка при обработке авторизации.
                Пожалуйста, попробуйте ещё раз.
              </p>
              <div className="flex gap-2 justify-center">
                <a
                  href="/auth/sign-in"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Войти заново
                </a>
                <a
                  href="/"
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  На главную
                </a>
              </div>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="mt-4 p-2 bg-muted rounded text-xs text-left overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Not Configured Fallback
 */
function NotConfigured() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-semibold">Авторизация недоступна</h2>
        <p className="text-muted-foreground">
          Веб-авторизация временно недоступна. Пожалуйста, используйте Telegram Mini App.
        </p>
        <a
          href="https://t.me/PinGlassBot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Открыть в Telegram
        </a>
      </div>
    </div>
  );
}

export default function Handler() {
  if (!isStackAuthConfigured || !stackServerApp) {
    return <NotConfigured />;
  }

  return (
    <AuthErrorBoundary>
      <StackHandler fullPage={true} />
    </AuthErrorBoundary>
  );
}
