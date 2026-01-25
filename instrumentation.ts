// This file is used to instrument the application with Sentry and validate environment.
// It's called by Next.js when the app starts.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // TEMPORARILY DISABLED for debugging Node.js hanging issue on Vercel Preview
  // TODO: Re-enable after fixing the root cause
  console.log("[Instrumentation] Runtime:", process.env.NEXT_RUNTIME);
  
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Node.js runtime - skipping validation for debug");
    // Skip validation and Sentry to isolate the hanging issue
    // const { validateEnvOrThrow, ensureQstashTable } = await import("./lib/env-validation");
    // validateEnvOrThrow();
    // ensureQstashTable().catch(err => console.warn("[Startup] QStash table check failed:", err));
    // await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry initialization
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  err: Error,
  request: Request,
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
) => {
  // Import Sentry dynamically to avoid issues with edge runtime
  const Sentry = await import("@sentry/nextjs");

  Sentry.captureException(err, {
    tags: {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
    extra: {
      url: request.url,
      method: request.method,
    },
  });
};
