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

import { StackHandler } from '@stackframe/stack';
import { stackServerApp, isStackAuthConfigured } from '@/lib/neon-auth';

export default function Handler() {
  if (!isStackAuthConfigured || !stackServerApp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">
          Stack Auth is not configured. Please set up environment variables.
        </p>
      </div>
    );
  }

  return <StackHandler fullPage={true} />;
}
