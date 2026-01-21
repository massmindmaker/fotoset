#!/usr/bin/env node
/**
 * Test Partner Packs API
 * Tests all partner pack management endpoints
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Mock partner user (replace with actual test partner)
const TEST_TELEGRAM_USER_ID = 999999999 // Replace with real partner ID

// Color output helpers
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
}

function log(color, ...args) {
  console.log(color, ...args, colors.reset)
}

function success(msg) {
  log(colors.green, "✓", msg)
}

function error(msg) {
  log(colors.red, "✗", msg)
}

function info(msg) {
  log(colors.blue, "ℹ", msg)
}

// Test helper
async function testEndpoint(name, fn) {
  info(`Testing: ${name}`)
  try {
    await fn()
    success(`${name} - PASSED`)
    return true
  } catch (err) {
    error(`${name} - FAILED: ${err.message}`)
    return false
  }
}

// API client
async function apiCall(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json()

  if (!response.ok && !options.expectError) {
    throw new Error(`${response.status}: ${data.message || data.error}`)
  }

  return { status: response.status, data }
}

// Test state
let createdPackId = null
let createdPromptId = null

// Tests
async function test1_createPack() {
  const { status, data } = await apiCall("/api/partner/packs", {
    method: "POST",
    body: {
      telegramUserId: TEST_TELEGRAM_USER_ID,
      name: "Test Pack " + Date.now(),
      description: "Test pack for API validation",
      iconEmoji: "🧪",
    },
  })

  if (status !== 200 || !data.success) {
    throw new Error("Failed to create pack")
  }

  createdPackId = data.pack.id
  info(`Created pack ID: ${createdPackId}`)

  if (data.pack.moderationStatus !== "draft") {
    throw new Error(`Expected status 'draft', got '${data.pack.moderationStatus}'`)
  }
}

async function test2_listPacks() {
  const { status, data } = await apiCall("/api/partner/packs", {
    headers: {
      "x-telegram-user-id": TEST_TELEGRAM_USER_ID,
    },
  })

  if (status !== 200 || !data.success) {
    throw new Error("Failed to list packs")
  }

  if (!Array.isArray(data.packs)) {
    throw new Error("Expected packs array")
  }

  const pack = data.packs.find((p) => p.id === createdPackId)
  if (!pack) {
    throw new Error("Created pack not found in list")
  }
}

async function test3_getPack() {
  const { status, data } = await apiCall(`/api/partner/packs/${createdPackId}`, {
    headers: {
      "x-telegram-user-id": TEST_TELEGRAM_USER_ID,
    },
  })

  if (status !== 200 || !data.success) {
    throw new Error("Failed to get pack")
  }

  if (data.pack.id !== createdPackId) {
    throw new Error("Got wrong pack")
  }
}

async function test4_updatePack() {
  const { status, data } = await apiCall(`/api/partner/packs/${createdPackId}`, {
    method: "PUT",
    body: {
      telegramUserId: TEST_TELEGRAM_USER_ID,
      description: "Updated description",
      iconEmoji: "🎨",
    },
  })

  if (status !== 200 || !data.success) {
    throw new Error("Failed to update pack")
  }

  if (data.pack.description !== "Updated description") {
    throw new Error("Description not updated")
  }
}

async function test5_addPrompts() {
  // Add 7 prompts (minimum for submission)
  for (let i = 0; i < 7; i++) {
    const { status, data } = await apiCall(
      `/api/partner/packs/${createdPackId}/prompts`,
      {
        method: "POST",
        body: {
          telegramUserId: TEST_TELEGRAM_USER_ID,
          prompt: `Test prompt ${i + 1}`,
          negativePrompt: "low quality, blurry",
          stylePrefix: "professional",
          styleSuffix: "8k",
          position: i,
        },
      }
    )

    if (status !== 200 || !data.success) {
      throw new Error(`Failed to add prompt ${i + 1}`)
    }

    if (i === 0) {
      createdPromptId = data.prompt.id
      info(`Created prompt ID: ${createdPromptId}`)
    }
  }
}

async function test6_listPrompts() {
  const { status, data } = await apiCall(
    `/api/partner/packs/${createdPackId}/prompts`,
    {
      headers: {
        "x-telegram-user-id": TEST_TELEGRAM_USER_ID,
      },
    }
  )

  if (status !== 200 || !data.success) {
    throw new Error("Failed to list prompts")
  }

  if (data.prompts.length !== 7) {
    throw new Error(`Expected 7 prompts, got ${data.prompts.length}`)
  }
}

async function test7_updatePrompt() {
  const { status, data } = await apiCall(
    `/api/partner/packs/${createdPackId}/prompts/${createdPromptId}`,
    {
      method: "PUT",
      body: {
        telegramUserId: TEST_TELEGRAM_USER_ID,
        prompt: "Updated test prompt",
      },
    }
  )

  if (status !== 200 || !data.success) {
    throw new Error("Failed to update prompt")
  }

  if (data.prompt.prompt !== "Updated test prompt") {
    throw new Error("Prompt not updated")
  }
}

async function test8_submitPack() {
  const { status, data } = await apiCall(
    `/api/partner/packs/${createdPackId}/submit`,
    {
      method: "POST",
      body: {
        telegramUserId: TEST_TELEGRAM_USER_ID,
      },
    }
  )

  if (status !== 200 || !data.success) {
    throw new Error("Failed to submit pack")
  }

  if (data.pack.moderationStatus !== "pending") {
    throw new Error(
      `Expected status 'pending', got '${data.pack.moderationStatus}'`
    )
  }

  info("Pack submitted for moderation")
}

async function test9_cannotEditPending() {
  const { status, data } = await apiCall(`/api/partner/packs/${createdPackId}`, {
    method: "PUT",
    body: {
      telegramUserId: TEST_TELEGRAM_USER_ID,
      name: "Should not work",
    },
    expectError: true,
  })

  if (status !== 400) {
    throw new Error("Should not be able to edit pending pack")
  }

  if (data.error !== "INVALID_STATE") {
    throw new Error("Expected INVALID_STATE error")
  }
}

async function test10_cannotDeletePending() {
  const { status, data } = await apiCall(`/api/partner/packs/${createdPackId}`, {
    method: "DELETE",
    headers: {
      "x-telegram-user-id": TEST_TELEGRAM_USER_ID,
    },
    expectError: true,
  })

  if (status !== 400) {
    throw new Error("Should not be able to delete pending pack")
  }
}

async function test11_limitValidation() {
  // Try to submit pack with too few prompts
  const { status, data } = await apiCall("/api/partner/packs", {
    method: "POST",
    body: {
      telegramUserId: TEST_TELEGRAM_USER_ID,
      name: "Test Pack With Few Prompts",
    },
  })

  const packId = data.pack.id

  // Add only 5 prompts
  for (let i = 0; i < 5; i++) {
    await apiCall(`/api/partner/packs/${packId}/prompts`, {
      method: "POST",
      body: {
        telegramUserId: TEST_TELEGRAM_USER_ID,
        prompt: `Prompt ${i}`,
      },
    })
  }

  // Try to submit
  const submitResult = await apiCall(`/api/partner/packs/${packId}/submit`, {
    method: "POST",
    body: {
      telegramUserId: TEST_TELEGRAM_USER_ID,
    },
    expectError: true,
  })

  if (submitResult.status !== 400) {
    throw new Error("Should reject submission with <7 prompts")
  }

  // Clean up
  await apiCall(`/api/partner/packs/${packId}`, {
    method: "DELETE",
    headers: {
      "x-telegram-user-id": TEST_TELEGRAM_USER_ID,
    },
  })
}

// Run all tests
async function runTests() {
  log(colors.yellow, "\n=== Partner Packs API Tests ===\n")

  const tests = [
    ["Create Pack", test1_createPack],
    ["List Packs", test2_listPacks],
    ["Get Pack Details", test3_getPack],
    ["Update Pack", test4_updatePack],
    ["Add Prompts (7)", test5_addPrompts],
    ["List Prompts", test6_listPrompts],
    ["Update Prompt", test7_updatePrompt],
    ["Submit Pack", test8_submitPack],
    ["Cannot Edit Pending Pack", test9_cannotEditPending],
    ["Cannot Delete Pending Pack", test10_cannotDeletePending],
    ["Limit Validation", test11_limitValidation],
  ]

  let passed = 0
  let failed = 0

  for (const [name, fn] of tests) {
    const result = await testEndpoint(name, fn)
    if (result) passed++
    else failed++
  }

  log(colors.yellow, "\n=== Test Summary ===")
  log(colors.green, `Passed: ${passed}`)
  log(colors.red, `Failed: ${failed}`)

  if (failed === 0) {
    log(colors.green, "\n✓ All tests passed!")
    process.exit(0)
  } else {
    log(colors.red, `\n✗ ${failed} test(s) failed`)
    process.exit(1)
  }
}

// Run
runTests().catch((err) => {
  error(`Fatal error: ${err.message}`)
  console.error(err)
  process.exit(1)
})
