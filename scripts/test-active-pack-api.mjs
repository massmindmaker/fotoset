#!/usr/bin/env node
/**
 * Test script for /api/user/active-pack endpoint
 *
 * Tests:
 * 1. GET active pack (should be null initially)
 * 2. POST set active pack by packId
 * 3. GET active pack (should return the set pack)
 * 4. POST set active pack by packSlug
 * 5. GET active pack (should return updated pack)
 * 6. POST with invalid pack ID (should fail)
 * 7. POST without auth (should fail)
 */

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Mock initData for testing (DEVELOPMENT ONLY)
// In production, this must be a valid Telegram initData with HMAC signature
const MOCK_INIT_DATA = 'mock-init-data-for-development'
const TEST_USER_ID = 12345678 // Mock Telegram user ID

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  console.log(`\n→ ${options.method || 'GET'} ${endpoint}`)

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': MOCK_INIT_DATA,
      ...options.headers,
    },
  })

  const data = await response.json()
  console.log(`← ${response.status} ${response.statusText}`)
  console.log(JSON.stringify(data, null, 2))

  return { response, data }
}

// Test 1: Get initial active pack (should be null)
async function testGetInitialActivePack() {
  console.log('\n=== Test 1: GET initial active pack ===')
  const { data } = await apiRequest('/api/user/active-pack')

  if (data.success && data.data.activePack === null) {
    console.log('✅ PASS: No active pack initially')
  } else {
    console.log('❌ FAIL: Expected null active pack')
  }
}

// Test 2: Set active pack by packId
async function testSetActivePackById() {
  console.log('\n=== Test 2: POST set active pack by packId ===')

  // First, get available packs
  const { data: packsData } = await apiRequest('/api/packs')
  if (!packsData.success || packsData.data.packs.length === 0) {
    console.log('⚠️ SKIP: No packs available')
    return null
  }

  const pack = packsData.data.packs[0]
  console.log(`Using pack: ${pack.id} - ${pack.name}`)

  const { data } = await apiRequest('/api/user/active-pack', {
    method: 'POST',
    body: JSON.stringify({
      packId: pack.id,
      telegramUserId: TEST_USER_ID,
    }),
  })

  if (data.success && data.data.activePackId === pack.id) {
    console.log('✅ PASS: Active pack set by ID')
    return pack
  } else {
    console.log('❌ FAIL: Failed to set active pack by ID')
    return null
  }
}

// Test 3: Get active pack after setting
async function testGetActivePack(expectedPack) {
  console.log('\n=== Test 3: GET active pack after setting ===')
  const { data } = await apiRequest('/api/user/active-pack')

  if (
    data.success &&
    data.data.activePack &&
    data.data.activePack.id === expectedPack.id
  ) {
    console.log('✅ PASS: Active pack retrieved correctly')
  } else {
    console.log('❌ FAIL: Active pack mismatch')
  }
}

// Test 4: Set active pack by slug
async function testSetActivePackBySlug() {
  console.log('\n=== Test 4: POST set active pack by slug ===')

  const { data } = await apiRequest('/api/user/active-pack', {
    method: 'POST',
    body: JSON.stringify({
      packSlug: 'pinglass',
      telegramUserId: TEST_USER_ID,
    }),
  })

  if (data.success && data.data.packSlug === 'pinglass') {
    console.log('✅ PASS: Active pack set by slug')
    return data.data
  } else {
    console.log('❌ FAIL: Failed to set active pack by slug')
    return null
  }
}

// Test 5: Set active pack with invalid ID
async function testSetInvalidPack() {
  console.log('\n=== Test 5: POST with invalid pack ID ===')
  const { data } = await apiRequest('/api/user/active-pack', {
    method: 'POST',
    body: JSON.stringify({
      packId: 999999,
      telegramUserId: TEST_USER_ID,
    }),
  })

  if (!data.success && data.error.code === 'NOT_FOUND') {
    console.log('✅ PASS: Invalid pack rejected')
  } else {
    console.log('❌ FAIL: Expected NOT_FOUND error')
  }
}

// Test 6: Request without authentication
async function testUnauthenticated() {
  console.log('\n=== Test 6: GET without authentication ===')

  const url = `${API_BASE}/api/user/active-pack`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json()
  console.log(`← ${response.status} ${response.statusText}`)
  console.log(JSON.stringify(data, null, 2))

  if (!data.success && data.error.code === 'UNAUTHORIZED') {
    console.log('✅ PASS: Unauthenticated request rejected')
  } else {
    console.log('❌ FAIL: Expected UNAUTHORIZED error')
  }
}

// Test 7: Set active pack without packId or packSlug
async function testMissingIdentifier() {
  console.log('\n=== Test 7: POST without packId or packSlug ===')
  const { data } = await apiRequest('/api/user/active-pack', {
    method: 'POST',
    body: JSON.stringify({
      telegramUserId: TEST_USER_ID,
    }),
  })

  if (!data.success && data.error.code === 'VALIDATION_ERROR') {
    console.log('✅ PASS: Missing identifier rejected')
  } else {
    console.log('❌ FAIL: Expected VALIDATION_ERROR')
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Testing /api/user/active-pack endpoint')
  console.log(`API Base: ${API_BASE}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)

  try {
    await testGetInitialActivePack()
    const pack = await testSetActivePackById()
    if (pack) {
      await testGetActivePack(pack)
    }
    const slugPack = await testSetActivePackBySlug()
    if (slugPack) {
      await testGetActivePack(slugPack)
    }
    await testSetInvalidPack()
    await testMissingIdentifier()
    await testUnauthenticated()

    console.log('\n✅ All tests completed')
  } catch (error) {
    console.error('\n❌ Test error:', error)
    process.exit(1)
  }
}

runTests()
