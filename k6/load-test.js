/**
 * k6 Load Testing Suite for PinGlass API
 *
 * Performance and load testing for critical API endpoints.
 *
 * Installation:
 *   - Windows: choco install k6
 *   - Mac: brew install k6
 *   - Linux: snap install k6
 *
 * Usage:
 *   k6 run k6/load-test.js
 *   k6 run k6/load-test.js --env BASE_URL=https://staging.pinglass.ru
 *   k6 run k6/load-test.js --vus 100 --duration 10m
 *
 * Environment Variables:
 *   BASE_URL - Target URL (default: http://localhost:3000)
 *   TEST_TELEGRAM_USER_ID - Test user ID (default: 123456789)
 */

import http from "k6/http"
import { check, sleep, group } from "k6"
import { Rate, Trend, Counter } from "k6/metrics"

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"
const TEST_TELEGRAM_USER_ID = __ENV.TEST_TELEGRAM_USER_ID || "123456789"

// Custom metrics
const errorRate = new Rate("errors")
const paymentDuration = new Trend("payment_duration")
const generationDuration = new Trend("generation_duration")
const avatarDuration = new Trend("avatar_duration")
const requestCounter = new Counter("requests_total")

// Load test scenarios
export const options = {
  // Ramp-up pattern
  stages: [
    { duration: "30s", target: 10 }, // Warm up to 10 users
    { duration: "1m", target: 25 }, // Ramp up to 25 users
    { duration: "2m", target: 50 }, // Peak at 50 users
    { duration: "1m", target: 25 }, // Ramp down
    { duration: "30s", target: 0 }, // Cool down
  ],

  // Performance thresholds
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests under 2s
    http_req_failed: ["rate<0.05"], // Error rate under 5%
    errors: ["rate<0.1"], // Custom error rate under 10%
    payment_duration: ["p(95)<3000"], // Payment API under 3s
    generation_duration: ["p(95)<5000"], // Generation API under 5s
    avatar_duration: ["p(95)<1500"], // Avatar API under 1.5s
  },

  // Tags for grouping
  tags: {
    environment: __ENV.ENVIRONMENT || "local",
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getHeaders(telegramUserId = TEST_TELEGRAM_USER_ID) {
  return {
    "Content-Type": "application/json",
    "x-telegram-user-id": String(telegramUserId),
  }
}

function handleResponse(response, name, customMetric = null) {
  requestCounter.add(1)

  const success = check(response, {
    [`${name}: status is 200`]: (r) => r.status === 200 || r.status === 201,
    [`${name}: response time < 2s`]: (r) => r.timings.duration < 2000,
  })

  if (!success) {
    errorRate.add(1)
    console.log(
      `[ERROR] ${name}: status=${response.status}, body=${response.body?.substring(0, 200)}`
    )
  } else {
    errorRate.add(0)
  }

  if (customMetric) {
    customMetric.add(response.timings.duration)
  }

  return success
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

/**
 * Main test function - called for each virtual user
 */
export default function () {
  const userId = `${TEST_TELEGRAM_USER_ID}${__VU}` // Unique user per VU

  // Run different scenarios based on iteration
  const scenario = __ITER % 5

  switch (scenario) {
    case 0:
      testUserFlow(userId)
      break
    case 1:
      testPaymentFlow(userId)
      break
    case 2:
      testAvatarOperations(userId)
      break
    case 3:
      testGenerationPolling(userId)
      break
    case 4:
      testReferralSystem(userId)
      break
  }

  // Small pause between iterations
  sleep(Math.random() * 2 + 0.5)
}

// ============================================================================
// USER FLOW TESTS
// ============================================================================

function testUserFlow(userId) {
  group("User Flow", function () {
    // 1. Create/get user
    const createUserRes = http.post(
      `${BASE_URL}/api/user`,
      JSON.stringify({ telegramUserId: parseInt(userId) }),
      { headers: getHeaders(userId) }
    )

    if (!handleResponse(createUserRes, "POST /api/user")) {
      return
    }

    sleep(0.5)

    // 2. Get user's avatars
    const avatarsRes = http.get(
      `${BASE_URL}/api/avatars?telegram_user_id=${userId}`,
      { headers: getHeaders(userId) }
    )

    handleResponse(avatarsRes, "GET /api/avatars", avatarDuration)
  })
}

// ============================================================================
// PAYMENT FLOW TESTS
// ============================================================================

function testPaymentFlow(userId) {
  group("Payment Flow", function () {
    // 1. Check payment status
    const statusRes = http.get(
      `${BASE_URL}/api/payment/status?telegram_user_id=${userId}`,
      { headers: getHeaders(userId) }
    )

    handleResponse(statusRes, "GET /api/payment/status", paymentDuration)

    sleep(0.5)

    // 2. Create payment (only if not in production to avoid real charges)
    if (BASE_URL.includes("localhost") || BASE_URL.includes("staging")) {
      const createPaymentRes = http.post(
        `${BASE_URL}/api/payment/create`,
        JSON.stringify({
          telegramUserId: parseInt(userId),
          email: `test${userId}@pinglass.ru`,
          tierId: "standard",
        }),
        { headers: getHeaders(userId) }
      )

      handleResponse(createPaymentRes, "POST /api/payment/create", paymentDuration)
    }
  })
}

// ============================================================================
// AVATAR OPERATIONS TESTS
// ============================================================================

function testAvatarOperations(userId) {
  group("Avatar Operations", function () {
    // 1. List avatars
    const listRes = http.get(
      `${BASE_URL}/api/avatars?telegram_user_id=${userId}`,
      { headers: getHeaders(userId) }
    )

    handleResponse(listRes, "GET /api/avatars (list)", avatarDuration)

    sleep(0.3)

    // 2. Create avatar (limit check)
    const createRes = http.post(
      `${BASE_URL}/api/avatars`,
      JSON.stringify({
        telegramUserId: parseInt(userId),
        name: `Load Test Avatar ${Date.now()}`,
      }),
      { headers: getHeaders(userId) }
    )

    // May return 400 if limit reached, that's OK
    const success = check(createRes, {
      "POST /api/avatars: status is 2xx or 400": (r) =>
        r.status === 200 || r.status === 201 || r.status === 400,
    })

    if (!success) {
      errorRate.add(1)
    }

    avatarDuration.add(createRes.timings.duration)

    sleep(0.3)

    // 3. Get specific avatar if created
    if (createRes.status === 201) {
      try {
        const avatar = JSON.parse(createRes.body)
        if (avatar.id) {
          const getRes = http.get(
            `${BASE_URL}/api/avatars/${avatar.id}?telegram_user_id=${userId}`,
            { headers: getHeaders(userId) }
          )

          handleResponse(getRes, "GET /api/avatars/:id", avatarDuration)
        }
      } catch (e) {
        // Parse error, skip
      }
    }
  })
}

// ============================================================================
// GENERATION POLLING TESTS
// ============================================================================

function testGenerationPolling(userId) {
  group("Generation Polling", function () {
    // Simulate polling for generation status
    // This tests the read path which should be fast

    const pollRes = http.get(
      `${BASE_URL}/api/generate?telegram_user_id=${userId}`,
      { headers: getHeaders(userId) }
    )

    // May return 404 if no active generation, that's OK
    const success = check(pollRes, {
      "GET /api/generate: status is 2xx or 404": (r) =>
        r.status === 200 || r.status === 404,
      "GET /api/generate: response time < 1s": (r) => r.timings.duration < 1000,
    })

    if (!success) {
      errorRate.add(1)
    }

    generationDuration.add(pollRes.timings.duration)
  })
}

// ============================================================================
// REFERRAL SYSTEM TESTS
// ============================================================================

function testReferralSystem(userId) {
  group("Referral System", function () {
    // 1. Get referral stats
    const statsRes = http.get(
      `${BASE_URL}/api/referral/stats?telegram_user_id=${userId}`,
      { headers: getHeaders(userId) }
    )

    // May return 404 for new users
    check(statsRes, {
      "GET /api/referral/stats: status is 2xx or 404": (r) =>
        r.status === 200 || r.status === 404,
    })

    sleep(0.3)

    // 2. Get referral code
    const codeRes = http.get(
      `${BASE_URL}/api/referral/code?telegram_user_id=${userId}`,
      { headers: getHeaders(userId) }
    )

    check(codeRes, {
      "GET /api/referral/code: status is 2xx or 404": (r) =>
        r.status === 200 || r.status === 404,
    })
  })
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

/**
 * Run once at the start of the test
 */
export function setup() {
  console.log(`
====================================
 PinGlass Load Test Starting
====================================
 Target: ${BASE_URL}
 Test User ID: ${TEST_TELEGRAM_USER_ID}
====================================
  `)

  // Verify server is reachable
  const healthRes = http.get(`${BASE_URL}/api/user`, {
    headers: getHeaders(TEST_TELEGRAM_USER_ID),
  })

  if (healthRes.status !== 200 && healthRes.status !== 201) {
    console.log(`[WARN] Server may not be ready: status=${healthRes.status}`)
  }

  return { startTime: Date.now() }
}

/**
 * Run once at the end of the test
 */
export function teardown(data) {
  const duration = ((Date.now() - data.startTime) / 1000).toFixed(2)
  console.log(`
====================================
 Load Test Complete
====================================
 Duration: ${duration}s
====================================
  `)
}

// ============================================================================
// SMOKE TEST (Quick validation)
// ============================================================================

/**
 * Quick smoke test - run with: k6 run k6/load-test.js --iterations 1 --vus 1
 */
export function smokeTest() {
  group("Smoke Test", function () {
    const res = http.get(`${BASE_URL}/api/avatars?telegram_user_id=${TEST_TELEGRAM_USER_ID}`, {
      headers: getHeaders(),
    })

    check(res, {
      "smoke: status is 200": (r) => r.status === 200,
      "smoke: response is JSON": (r) => {
        try {
          JSON.parse(r.body)
          return true
        } catch {
          return false
        }
      },
    })
  })
}

// ============================================================================
// STRESS TEST CONFIG
// ============================================================================

/**
 * Stress test - run with: k6 run k6/load-test.js --config k6/stress.json
 *
 * Alternative inline config:
 */
export const stressOptions = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp to 100 users
    { duration: "5m", target: 100 }, // Stay at 100
    { duration: "2m", target: 200 }, // Spike to 200
    { duration: "5m", target: 200 }, // Stay at 200
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(99)<5000"], // Relax to 5s for 99th percentile
    http_req_failed: ["rate<0.1"], // Allow 10% errors under stress
  },
}

// ============================================================================
// SOAK TEST CONFIG
// ============================================================================

/**
 * Soak test - run for extended period to detect memory leaks
 */
export const soakOptions = {
  stages: [
    { duration: "5m", target: 50 }, // Ramp up
    { duration: "4h", target: 50 }, // Stay at 50 for 4 hours
    { duration: "5m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"], // Very low error rate expected
  },
}
