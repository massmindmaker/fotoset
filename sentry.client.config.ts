// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable Replay integration for session recordings
  replaysOnErrorSampleRate: 1.0,

  // Capture Replay for 10% of all sessions to understand user behavior
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
    Sentry.feedbackIntegration({
      // Display a "Report a Bug" button that sends user feedback to Sentry
      colorScheme: "system",
      autoInject: false, // We'll inject manually when needed
    }),
  ],

  // Define which URLs should be considered as part of your app
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/.*\.vercel\.app/,
    /^https:\/\/pinglass\.ru/,
  ],

  // Ignore certain errors that are not actionable
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // User aborted requests
    "AbortError",
    // ResizeObserver errors (common, not actionable)
    "ResizeObserver loop",
  ],

  // Filter events before sending
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development") {
      console.log("Sentry event (dev):", event);
      return null;
    }
    return event;
  },
});
