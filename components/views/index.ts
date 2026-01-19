/**
 * View components index
 * Export all view components for easy imports
 */

export * from "./types"
export * from "./onboarding-view"
export * from "./dashboard-view"
export * from "./upload-view"
export * from "./tier-select-view"
export * from "./results-view"
export * from "./styles-list-view"
export * from "./style-detail-view"

// Re-export PRICING_TIERS from dashboard-view as it's used globally
export { PRICING_TIERS } from "./dashboard-view"
