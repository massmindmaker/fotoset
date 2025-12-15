/**
 * Test Fixtures for Payment System
 *
 * Mock data for T-Bank responses, webhooks, users, and payments
 */

import type { Payment, User } from '@/lib/db';
import type { TBankPayment } from '@/lib/tbank';

// Test Users
export const testUsers = {
  newUser: {
    device_id: 'test-device-new-001',
  },
  existingUser: {
    id: 1,
    device_id: 'test-device-existing-001',
    telegram_user_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  } as User,
  proUser: {
    id: 2,
    device_id: 'test-device-pro-001',
    telegram_user_id: 123456,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  } as User,
  referredUser: {
    id: 3,
    device_id: 'test-device-referred-001',
    telegram_user_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  } as User,
  referrer: {
    id: 4,
    device_id: 'test-device-referrer-001',
    telegram_user_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  } as User,
};

// Payment Tiers
export const paymentTiers = {
  starter: {
    id: 'starter',
    price: 499,
    photos: 7,
    description: 'PinGlass - 7 AI Photos (starter)',
  },
  standard: {
    id: 'standard',
    price: 999,
    photos: 15,
    description: 'PinGlass - 15 AI Photos (standard)',
  },
  premium: {
    id: 'premium',
    price: 1499,
    photos: 23,
    description: 'PinGlass - 23 AI Photos (premium)',
  },
};

// T-Bank Payment Responses
export const tbankResponses = {
  initSuccess: {
    Success: true,
    ErrorCode: '0',
    TerminalKey: 'TestDEMOTerminalKey',
    Status: 'NEW',
    PaymentId: 'test-payment-12345678',
    OrderId: 'u1t123abc',
    Amount: 49900,
    PaymentURL: 'https://securepay.tinkoff.ru/new/test-payment-12345678',
  } as TBankPayment,

  initSuccessStandard: {
    Success: true,
    ErrorCode: '0',
    TerminalKey: 'TestDEMOTerminalKey',
    Status: 'NEW',
    PaymentId: 'test-payment-standard',
    OrderId: 'u1t456def',
    Amount: 99900,
    PaymentURL: 'https://securepay.tinkoff.ru/new/test-payment-standard',
  } as TBankPayment,

  initSuccessPremium: {
    Success: true,
    ErrorCode: '0',
    TerminalKey: 'TestDEMOTerminalKey',
    Status: 'NEW',
    PaymentId: 'test-payment-premium',
    OrderId: 'u1t789ghi',
    Amount: 149900,
    PaymentURL: 'https://securepay.tinkoff.ru/new/test-payment-premium',
  } as TBankPayment,

  initError: {
    Success: false,
    ErrorCode: '9999',
    Message: 'Internal server error',
  } as TBankPayment,

  initInvalidTerminal: {
    Success: false,
    ErrorCode: '101',
    Message: 'Invalid terminal key',
  } as TBankPayment,

  initInvalidAmount: {
    Success: false,
    ErrorCode: '104',
    Message: 'Invalid amount',
  } as TBankPayment,

  stateNew: {
    Success: true,
    ErrorCode: '0',
    TerminalKey: 'TestDEMOTerminalKey',
    Status: 'NEW',
    PaymentId: 'test-payment-12345678',
    OrderId: 'u1t123abc',
    Amount: 49900,
  } as TBankPayment,

  stateAuthorized: {
    Success: true,
    ErrorCode: '0',
    TerminalKey: 'TestDEMOTerminalKey',
    Status: 'AUTHORIZED',
    PaymentId: 'test-payment-12345678',
    OrderId: 'u1t123abc',
    Amount: 49900,
  } as TBankPayment,

  stateConfirmed: {
    Success: true,
    ErrorCode: '0',
    TerminalKey: 'TestDEMOTerminalKey',
    Status: 'CONFIRMED',
    PaymentId: 'test-payment-12345678',
    OrderId: 'u1t123abc',
    Amount: 49900,
  } as TBankPayment,

  stateRejected: {
    Success: true,
    ErrorCode: '0',
    TerminalKey: 'TestDEMOTerminalKey',
    Status: 'REJECTED',
    PaymentId: 'test-payment-12345678',
    OrderId: 'u1t123abc',
    Amount: 49900,
  } as TBankPayment,

  stateNotFound: {
    Success: false,
    ErrorCode: '7',
    Message: 'Payment not found',
  } as TBankPayment,
};

// Webhook Payloads
export const webhookPayloads = {
  confirmed: {
    TerminalKey: 'TestDEMOTerminalKey',
    OrderId: 'u1t123abc',
    Success: true,
    Status: 'CONFIRMED',
    PaymentId: 'test-payment-12345678',
    ErrorCode: '0',
    Amount: 49900,
    CardId: '123456',
    Pan: '430000******0777',
    ExpDate: '1224',
    Token: '', // Will be generated in tests
  },

  authorized: {
    TerminalKey: 'TestDEMOTerminalKey',
    OrderId: 'u1t123abc',
    Success: true,
    Status: 'AUTHORIZED',
    PaymentId: 'test-payment-12345678',
    ErrorCode: '0',
    Amount: 49900,
    Token: '',
  },

  rejected: {
    TerminalKey: 'TestDEMOTerminalKey',
    OrderId: 'u1t123abc',
    Success: false,
    Status: 'REJECTED',
    PaymentId: 'test-payment-12345678',
    ErrorCode: '2001',
    Amount: 49900,
    Token: '',
  },

  refunded: {
    TerminalKey: 'TestDEMOTerminalKey',
    OrderId: 'u1t123abc',
    Success: true,
    Status: 'REFUNDED',
    PaymentId: 'test-payment-12345678',
    ErrorCode: '0',
    Amount: 49900,
    Token: '',
  },

  invalidSignature: {
    TerminalKey: 'TestDEMOTerminalKey',
    OrderId: 'u1t123abc',
    Success: true,
    Status: 'CONFIRMED',
    PaymentId: 'test-payment-12345678',
    Amount: 49900,
    Token: 'totally-invalid-signature-abc123',
  },

  tamperedAmount: {
    TerminalKey: 'TestDEMOTerminalKey',
    OrderId: 'u1t123abc',
    Success: true,
    Status: 'CONFIRMED',
    PaymentId: 'test-payment-12345678',
    Amount: 1, // Tampered from 49900 to 1
    Token: '', // Will be generated for original amount
  },
};

// Database Payment Records
export const dbPayments = {
  pending: {
    id: 1,
    user_id: 1,
    tbank_payment_id: 'test-payment-12345678',
    amount: 499,
    currency: 'RUB',
    status: 'pending',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  } as Payment,

  succeeded: {
    id: 2,
    user_id: 1,
    tbank_payment_id: 'test-payment-succeeded',
    amount: 499,
    currency: 'RUB',
    status: 'succeeded',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T01:00:00Z',
  } as Payment,

  canceled: {
    id: 3,
    user_id: 1,
    tbank_payment_id: 'test-payment-canceled',
    amount: 499,
    currency: 'RUB',
    status: 'canceled',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:30:00Z',
  } as Payment,
};

// Referral Data
export const referralData = {
  code: {
    id: 1,
    user_id: 4, // referrer
    code: 'FRIEND123',
    created_at: '2025-01-01T00:00:00Z',
    is_active: true,
  },

  relationship: {
    id: 1,
    referrer_id: 4,
    referred_id: 3,
    referral_code: 'FRIEND123',
    created_at: '2025-01-01T00:00:00Z',
  },

  earning: {
    id: 1,
    referrer_id: 4,
    referred_id: 3,
    payment_id: 1,
    amount: 49.9, // 10% of 499
    original_amount: 499,
    created_at: '2025-01-01T00:00:00Z',
  },

  balance: {
    id: 1,
    user_id: 4,
    balance: 49.9,
    total_earned: 49.9,
    total_withdrawn: 0,
    referrals_count: 1,
    updated_at: '2025-01-01T00:00:00Z',
  },
};

// Test Cards (T-Bank test mode)
export const testCards = {
  success: {
    number: '4300000000000777',
    expiry: '12/24',
    cvv: '123',
    description: 'Successful payment',
  },
  insufficientFunds: {
    number: '4300000000000065',
    expiry: '12/24',
    cvv: '123',
    description: 'Insufficient funds',
  },
  invalidCard: {
    number: '4300000000000099',
    expiry: '12/24',
    cvv: '123',
    description: 'Invalid card',
  },
  expired: {
    number: '4300000000000040',
    expiry: '12/20',
    cvv: '123',
    description: 'Expired card',
  },
};

// Helper function to generate valid webhook token
export function generateWebhookToken(
  payload: Record<string, any>,
  password: string = 'TestPassword123'
): string {
  const crypto = require('crypto');

  // Remove Token if present
  const { Token, ...params } = payload;

  // Filter out null/undefined
  const filteredParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined)
  );

  // Add password
  const paramsWithPassword = {
    ...filteredParams,
    Password: password,
  };

  // Sort keys alphabetically
  const sortedKeys = Object.keys(paramsWithPassword).sort();

  // Concatenate values
  const concatenated = sortedKeys.map((key) => String(paramsWithPassword[key])).join('');

  // Generate SHA256 hash
  return crypto.createHash('sha256').update(concatenated).digest('hex');
}

// Mock fetch responses
export const mockFetchResponses = {
  success: (data: any) => ({
    ok: true,
    status: 200,
    json: async () => data,
  }),

  error: (status: number, message: string) => ({
    ok: false,
    status,
    json: async () => ({ error: message }),
  }),

  networkError: () => {
    throw new Error('Network request failed');
  },

  timeout: async () => {
    await new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 5000)
    );
  },
};
