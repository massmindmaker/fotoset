# Payment System Specification

## Overview

Multi-provider payment system supporting T-Bank (cards), Telegram Stars, and TON cryptocurrency. All payments funnel into unified tracking with consistent status handling.

---

## Requirements

### Requirement: Multi-Provider Support

The system SHALL support multiple payment providers through unified interface.

#### Scenario: T-Bank card payment
- GIVEN user selects card payment
- WHEN payment is initiated
- THEN system creates T-Bank order via API
- AND redirects user to T-Bank payment page
- AND handles callback with payment result

#### Scenario: Telegram Stars payment
- GIVEN user is in Telegram WebApp
- WHEN user selects Stars payment
- THEN system initiates Telegram payment flow
- AND tracks via `telegram_charge_id`

#### Scenario: TON crypto payment
- GIVEN user selects TON payment
- WHEN payment is initiated
- THEN system generates payment address
- AND monitors blockchain for transaction
- AND tracks via `ton_tx_hash`

---

### Requirement: Payment Status Tracking

The system SHALL track all payments in unified `payments` table.

#### Scenario: Create payment record
- GIVEN user initiates payment
- WHEN provider returns payment ID
- THEN system creates record with status `pending`
- AND stores provider-specific identifiers

#### Scenario: Payment success webhook
- GIVEN T-Bank sends `payment.succeeded` webhook
- WHEN webhook is verified via SHA256 signature
- THEN system updates status to `succeeded`
- AND enables generation for user

#### Scenario: Payment cancellation
- GIVEN user cancels payment
- WHEN provider notifies cancellation
- THEN system updates status to `canceled`
- AND redirects to payment selection

---

### Requirement: Webhook Security

The system SHALL verify all payment webhooks cryptographically.

#### Scenario: Valid T-Bank webhook
- GIVEN incoming webhook with signature
- WHEN signature matches SHA256(data + password)
- THEN system processes the webhook

#### Scenario: Invalid webhook signature
- GIVEN incoming webhook with wrong signature
- WHEN verification fails
- THEN system returns 401 error
- AND logs security event

---

### Requirement: Idempotent Processing

The system SHALL handle duplicate webhook deliveries safely.

#### Scenario: Duplicate webhook
- GIVEN payment already marked `succeeded`
- WHEN same webhook arrives again
- THEN system acknowledges receipt
- AND does not duplicate any actions

---

### Requirement: Pricing Tiers

The system SHALL support configurable pricing tiers.

#### Scenario: Single tier (current)
- GIVEN pricing tier "Standard"
- WHEN user views payment
- THEN system displays price: 999 RUB
- AND includes 23 photos

#### Scenario: Future tier expansion
- GIVEN admin creates new tier
- WHEN tier is activated
- THEN system shows in pricing options
- AND adjusts photo count accordingly

---

### Requirement: Refund Handling

The system SHALL track refunds when processed.

#### Scenario: Refund issued
- GIVEN admin issues refund
- WHEN provider confirms refund
- THEN system updates status to `refunded`
- AND revokes generation access if unused

---

### Requirement: Payment Callback Page

The system SHALL provide user-friendly payment callback experience.

#### Scenario: Successful payment return
- GIVEN user returns from T-Bank with success
- WHEN callback page loads
- THEN system polls `/api/payment/status`
- AND shows "Payment successful" when confirmed
- AND redirects to generation

#### Scenario: Failed payment return
- GIVEN user returns from T-Bank with failure
- WHEN callback page loads
- THEN system shows "Payment failed"
- AND offers retry option
