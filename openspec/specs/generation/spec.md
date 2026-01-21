# AI Photo Generation Specification

## Overview

The generation system creates 23 AI-generated photo portraits from user-uploaded reference images using async processing via Kie.ai.

---

## Requirements

### Requirement: Async Task Creation

The system SHALL create generation tasks asynchronously using fire-and-forget pattern.

#### Scenario: User initiates generation
- GIVEN a user with successful payment
- AND 5-8 uploaded reference photos
- WHEN user clicks "Generate"
- THEN system creates `generation_job` record with status `processing`
- AND system creates 23 `kie_tasks` records (one per prompt)
- AND system returns immediately without waiting for completion

#### Scenario: Task submission to Kie.ai
- GIVEN a `kie_task` record with status `pending`
- WHEN cron job processes the task
- THEN system submits task to Kie.ai API
- AND updates `kie_task_id` with API response
- AND sets status to `submitted`

---

### Requirement: Cron-Based Polling

The system SHALL poll for task completion via Vercel Cron to avoid Cloudflare timeouts.

#### Scenario: Check pending tasks
- GIVEN tasks with status `submitted`
- WHEN cron job runs (every 30 seconds)
- THEN system queries Kie.ai for task status
- AND updates local status based on response

#### Scenario: Task completion
- GIVEN a task marked complete by Kie.ai
- WHEN cron detects completion
- THEN system downloads result image
- AND uploads to Cloudflare R2
- AND updates `result_url` in database
- AND sets status to `completed`

#### Scenario: Task failure
- GIVEN a task that failed in Kie.ai
- WHEN cron detects failure
- THEN system increments `attempts` counter
- AND if attempts < 3, resubmits task
- AND if attempts >= 3, marks status `failed`

---

### Requirement: Payment Verification

The system SHALL verify payment before allowing generation.

#### Scenario: Valid payment
- GIVEN user with `payments.status = 'succeeded'`
- WHEN generation is requested
- THEN system allows generation to proceed

#### Scenario: No payment
- GIVEN user without successful payment
- WHEN generation is requested
- THEN system returns 403 error
- AND displays payment modal

---

### Requirement: Reference Image Processing

The system SHALL process 5-8 reference images for consistent portrait generation.

#### Scenario: Image upload
- GIVEN user uploads 5-8 photos
- WHEN photos are submitted
- THEN system validates file types (jpg, png, webp)
- AND validates file sizes (< 10MB each)
- AND stores temporarily for generation

#### Scenario: Insufficient images
- GIVEN user uploads fewer than 5 photos
- WHEN trying to proceed
- THEN system displays error "Upload at least 5 photos"

---

### Requirement: Style Selection

The system SHALL support 3 generation style presets.

#### Scenario: Professional style
- GIVEN user selects "Professional" style
- WHEN generation runs
- THEN system uses prompts: 3, 4, 11, 6, 18, 21, 0, 19, 7
- AND generates business-appropriate portraits

#### Scenario: Lifestyle style
- GIVEN user selects "Lifestyle" style
- WHEN generation runs
- THEN system uses prompts: 0, 1, 2, 5, 8, 12, 15, 20, 22
- AND generates casual social media portraits

#### Scenario: Creative style
- GIVEN user selects "Creative" style
- WHEN generation runs
- THEN system uses prompts: 7, 9, 10, 13, 14, 16, 17, 19, 21
- AND generates artistic portfolio portraits

---

### Requirement: Progress Tracking

The system SHALL provide real-time generation progress to users.

#### Scenario: Progress display
- GIVEN active generation job
- WHEN user views generation page
- THEN system displays completed/total count
- AND shows percentage progress bar

#### Scenario: Background generation
- GIVEN user closes app during generation
- WHEN user returns
- THEN system shows current progress
- AND notifies via Telegram when complete

---

### Requirement: Result Delivery

The system SHALL deliver generated photos with download capability.

#### Scenario: View results
- GIVEN generation job with status `ready`
- WHEN user views results page
- THEN system displays all successful photos in gallery
- AND provides individual download buttons
- AND provides "Download All" option

#### Scenario: Partial success
- GIVEN some tasks failed after retries
- WHEN user views results
- THEN system shows successful photos
- AND indicates count of failed generations
- AND does not charge for failed photos
