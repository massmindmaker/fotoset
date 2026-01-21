# Referral System Specification

## Overview

Two-tier referral system with regular users (10% commission) and partners (50% commission). Earnings tracked in balance, withdrawable to various payment methods.

---

## Requirements

### Requirement: Referral Code Generation

The system SHALL generate unique referral codes for users.

#### Scenario: First referral code request
- GIVEN user without referral code
- WHEN user accesses referral section
- THEN system generates unique 8-character code
- AND creates `referral_balances` record
- AND sets default `commission_rate = 0.10`

#### Scenario: Existing code
- GIVEN user with existing referral code
- WHEN user views referral section
- THEN system displays existing code
- AND shows sharing options

---

### Requirement: Referral Tracking

The system SHALL track referral relationships.

#### Scenario: New user via referral link
- GIVEN user opens app with `?ref=ABC123`
- WHEN user record is created
- THEN system links user to referrer
- AND stores in `referral_signups` table

#### Scenario: Referral payment conversion
- GIVEN referred user makes payment
- WHEN payment status becomes `succeeded`
- THEN system calculates commission
- AND credits referrer's balance
- AND records in `referral_transactions`

---

### Requirement: Commission Calculation

The system SHALL calculate commission based on referrer tier.

#### Scenario: Regular user referral
- GIVEN referrer with `is_partner = false`
- WHEN referred user pays 999 RUB
- THEN system credits 99.90 RUB (10%)
- AND updates referrer balance

#### Scenario: Partner referral
- GIVEN referrer with `is_partner = true`
- WHEN referred user pays 999 RUB
- THEN system credits 499.50 RUB (50%)
- AND updates partner balance

---

### Requirement: Partner Status

The system SHALL support elevated partner status.

#### Scenario: Grant partner status
- GIVEN admin grants partner status
- WHEN `is_partner` set to `true`
- THEN system sets `commission_rate = 0.50`
- AND partner sees elevated rate in dashboard

#### Scenario: Custom commission rate
- GIVEN special partnership agreement
- WHEN admin sets custom rate
- THEN system uses custom `commission_rate`
- AND overrides default partner rate

---

### Requirement: Balance Management

The system SHALL track and manage referral balances.

#### Scenario: View balance
- GIVEN user with referral activity
- WHEN user views referral section
- THEN system displays current balance
- AND shows pending/available amounts

#### Scenario: Withdrawal request
- GIVEN user with sufficient balance
- WHEN user requests withdrawal
- THEN system creates withdrawal request
- AND deducts from available balance
- AND admin reviews and processes

---

### Requirement: Referral Link Sharing

The system SHALL provide easy sharing mechanisms.

#### Scenario: Share via Telegram
- GIVEN user in Telegram WebApp
- WHEN user clicks "Share"
- THEN system opens Telegram share dialog
- AND pre-fills referral message with link

#### Scenario: Copy link
- GIVEN user on any platform
- WHEN user clicks "Copy Link"
- THEN system copies referral URL to clipboard
- AND shows confirmation toast

---

### Requirement: Statistics Display

The system SHALL show referral performance metrics.

#### Scenario: View statistics
- GIVEN user with referral activity
- WHEN user views stats section
- THEN system displays:
  - Total signups via link
  - Converted (paid) users
  - Total earnings
  - Current balance
  - Commission rate

#### Scenario: No activity
- GIVEN user with no referrals
- WHEN user views stats
- THEN system shows zero counts
- AND displays sharing encouragement
