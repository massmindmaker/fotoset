// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// TEMPORARY: Disable Sentry to debug Node.js runtime hanging issue
const SENTRY_DISABLED = process.env.VERCEL_ENV === 'preview' || !process.env.SENTRY_DSN;

if (!SENTRY_DISABLED) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Profiling disabled - requires @sentry/profiling-node which has compatibility issues with Next.js 16

    // Filter events before sending
    beforeSend(event, hint) {
      // Don't send events in development
      if (process.env.NODE_ENV === "development") {
        console.log("Sentry server event (dev):", event);
        return null;
      }
      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Database connection errors during cold starts
      "ECONNREFUSED",
      // Timeout errors that are expected in serverless
      "FUNCTION_INVOCATION_TIMEOUT",
    ],
  });
}
