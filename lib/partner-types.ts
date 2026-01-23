// Partner Cabinet Types

export interface PartnerStats {
  balance: {
    rub: number
    ton: number
    availableRub: number
    pendingWithdrawals: number
  }
  pendingEarnings: {
    count: number
    rub: number
    ton: number
  }
  totalEarned: {
    rub: number
    ton: number
  }
  totalWithdrawn: {
    rub: number
    ton: number
  }
  referrals: {
    total: number
    active: number
    withPayments: number
  }
  conversion: {
    registrationToPayment: number
  }
  isPartner: boolean
  commissionRate: number
  referralCode: string | null
  promotedAt: string | null
  monthlyEarnings: MonthlyEarning[]
}

export interface MonthlyEarning {
  month: string
  rub: number
  ton: number
  count: number
}

export interface Earning {
  id: number
  paymentId: number
  referredUser: {
    id: number
    username: string | null
  }
  amount: number
  currency: 'RUB' | 'TON'
  commissionRate: number
  status: 'pending' | 'credited' | 'confirmed' | 'cancelled'
  createdAt: string
  creditedAt: string | null
  cancelledAt: string | null
  cancelledReason: string | null
  payment: {
    amount: number
    provider: string
  } | null
}

export interface EarningsResponse {
  earnings: Earning[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    pending: { count: number; rub: number; ton: number }
    credited: { count: number; rub: number; ton: number }
    confirmed: { count: number; rub: number; ton: number }
    cancelled: { count: number; rub: number; ton: number }
  }
}

export interface Referral {
  id: number
  username: string | null
  registeredAt: string
  lastActivityAt: string | null
  totalPayments: number
  totalSpent: number
  totalEarned: number
}

export interface ReferralsResponse {
  referrals: Referral[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface Withdrawal {
  id: number
  amount: number
  ndflAmount: number
  payoutAmount: number
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  method: 'card' | 'sbp'
  cardNumber: string | null
  phone: string | null
  recipientName: string
  rejectionReason: string | null
  createdAt: string
  processedAt: string | null
}

export interface WithdrawalsResponse {
  withdrawals: Withdrawal[]
}

export interface WithdrawRequest {
  telegramUserId: number
  payoutMethod: 'card' | 'sbp'
  cardNumber?: string
  phone?: string
  recipientName: string
}

export interface WithdrawResponse {
  success: boolean
  withdrawalId: number
  amount: number
  ndflAmount: number
  payoutAmount: number
  message: string
}

export interface PayoutSettings {
  defaultMethod: 'card' | 'sbp' | null
  cardNumber: string | null
  phone: string | null
  recipientName: string | null
}

// Constants
export const MIN_WITHDRAWAL = 5000
export const NDFL_RATE = 0.13
