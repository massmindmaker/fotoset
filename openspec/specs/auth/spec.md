# Authentication Specification

## Overview

Device-based authentication using Telegram user identification. No passwords or traditional auth flows.

---

## Requirements

### Requirement: Telegram User Identification

The system SHALL identify users via Telegram user ID.

#### Scenario: First visit from Telegram
- GIVEN user opens app from Telegram WebApp
- WHEN app initializes
- THEN system extracts `telegram_user_id` from WebApp data
- AND creates or retrieves user record
- AND stores device ID in localStorage

#### Scenario: Return visit
- GIVEN user has existing device ID in localStorage
- WHEN app loads
- THEN system retrieves user by device ID
- AND loads user's personas and history

---

### Requirement: Device ID Persistence

The system SHALL maintain session via localStorage device ID.

#### Scenario: Device ID creation
- GIVEN new user without device ID
- WHEN user record is created
- THEN system generates UUID device ID
- AND stores as `pinglass_device_id` in localStorage

#### Scenario: Device ID validation
- GIVEN request with device ID
- WHEN API validates request
- THEN system verifies device ID exists in database
- AND returns associated user data

---

### Requirement: Onboarding State

The system SHALL track onboarding completion per device.

#### Scenario: First time user
- GIVEN user without `pinglass_onboarding_complete`
- WHEN app loads
- THEN system shows onboarding carousel
- AND waits for completion before dashboard

#### Scenario: Onboarding complete
- GIVEN user completes onboarding
- WHEN user clicks "Get Started"
- THEN system sets `pinglass_onboarding_complete = true`
- AND redirects to upload view

#### Scenario: Returning user
- GIVEN user with `pinglass_onboarding_complete = true`
- WHEN app loads
- THEN system skips onboarding
- AND shows dashboard directly

---

### Requirement: User Creation

The system SHALL create user records automatically.

#### Scenario: New Telegram user
- GIVEN valid Telegram WebApp data
- WHEN no user exists with that `telegram_user_id`
- THEN system creates user record
- AND extracts username if available
- AND returns new user ID

#### Scenario: Existing user
- GIVEN user with existing `telegram_user_id`
- WHEN app requests user data
- THEN system returns existing record
- AND updates `telegram_username` if changed

---

### Requirement: Ban Handling

The system SHALL respect user ban status.

#### Scenario: Banned user access
- GIVEN user with `is_banned = true`
- WHEN user tries to access app
- THEN system shows "Account suspended" message
- AND prevents any actions

---

### Requirement: No Status Tiers

The system SHALL NOT implement Free/Pro user status.

#### Scenario: Access determination
- GIVEN user requests generation
- WHEN checking access
- THEN system queries payments table for `status = 'succeeded'`
- AND grants access if payment exists
- AND does NOT check any `is_pro` or status field

#### Scenario: Anti-pattern prevention
- GIVEN developer adds `is_pro` field
- WHEN code review occurs
- THEN change MUST be rejected
- AND developer redirected to payment-based access check
