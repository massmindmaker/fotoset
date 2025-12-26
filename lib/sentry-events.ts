import * as Sentry from "@sentry/nextjs"

// ==================== PAYMENT EVENTS ====================

export function trackPaymentStarted(userId: number, tier: string, amount: number) {
  Sentry.captureMessage("Payment Started", {
    level: "info",
    tags: { event_type: "payment", action: "started" },
    extra: { userId, tier, amount }
  })
  console.log("[Sentry] Payment Started:", { userId, tier, amount })
}

export function trackPaymentSuccess(userId: number, paymentId: string, tier: string) {
  Sentry.captureMessage("Payment Success", {
    level: "info",
    tags: { event_type: "payment", action: "success" },
    extra: { userId, paymentId, tier }
  })
  console.log("[Sentry] Payment Success:", { userId, paymentId, tier })
}

export function trackPaymentFailed(userId: number, error: string) {
  Sentry.captureException(new Error(`Payment Failed: ${error}`), {
    tags: { event_type: "payment", action: "failed" },
    extra: { userId }
  })
  console.log("[Sentry] Payment Failed:", { userId, error })
}

// ==================== GENERATION EVENTS ====================

export function trackGenerationStarted(userId: number, avatarId: string, tier: string, photoCount: number) {
  Sentry.captureMessage("Generation Started", {
    level: "info",
    tags: { event_type: "generation", action: "started" },
    extra: { userId, avatarId, tier, photoCount }
  })
  console.log("[Sentry] Generation Started:", { userId, avatarId, tier, photoCount })
}

export function trackGenerationCompleted(userId: number, avatarId: string, photoCount: number, durationMs: number) {
  Sentry.captureMessage("Generation Completed", {
    level: "info",
    tags: { event_type: "generation", action: "completed" },
    extra: { userId, avatarId, photoCount, durationMs }
  })
  console.log("[Sentry] Generation Completed:", { userId, avatarId, photoCount, durationMs })
}

export function trackGenerationFailed(userId: number, avatarId: string, error: string) {
  Sentry.captureException(new Error(`Generation Failed: ${error}`), {
    tags: { event_type: "generation", action: "failed" },
    extra: { userId, avatarId }
  })
  console.log("[Sentry] Generation Failed:", { userId, avatarId, error })
}

// ==================== REFERRAL EVENTS ====================

export function trackReferralApplied(userId: number, referrerId: number) {
  Sentry.captureMessage("Referral Applied", {
    level: "info",
    tags: { event_type: "referral", action: "applied" },
    extra: { userId, referrerId }
  })
  console.log("[Sentry] Referral Applied:", { userId, referrerId })
}

export function trackReferralEarning(referrerId: number, amount: number, paymentId: string) {
  Sentry.captureMessage("Referral Earning", {
    level: "info",
    tags: { event_type: "referral", action: "earning" },
    extra: { referrerId, amount, paymentId }
  })
  console.log("[Sentry] Referral Earning:", { referrerId, amount, paymentId })
}


// ==================== QSTASH EVENTS ====================

export function trackQStashFallback(jobId: number, avatarId: number, reason: string) {
  Sentry.captureMessage("QStash Fallback to Local", {
    level: "warning",
    tags: { event_type: "qstash", action: "fallback" },
    extra: { jobId, avatarId, reason }
  })
  console.warn("[Sentry] QStash Fallback to Local:", { jobId, avatarId, reason })
}

export function trackQStashSuccess(jobId: number, messageId: string) {
  Sentry.captureMessage("QStash Job Published", {
    level: "info",
    tags: { event_type: "qstash", action: "published" },
    extra: { jobId, messageId }
  })
  console.log("[Sentry] QStash Job Published:", { jobId, messageId })
}

export function trackQStashTimeout(jobId: number, chunkIndex: number, error: string) {
  Sentry.captureException(new Error(`QStash Timeout: ${error}`), {
    tags: { event_type: "qstash", action: "timeout" },
    extra: { jobId, chunkIndex }
  })
  console.error("[Sentry] QStash Timeout:", { jobId, chunkIndex, error })
}
