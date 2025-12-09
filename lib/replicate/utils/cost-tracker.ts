// Cost Tracking for Replicate API Usage
// Monitors spending and enforces budget limits

import type { ModelType, CostMetrics } from '../types';
import { PROVIDERS } from '../config';

/**
 * Cost tracker for monitoring AI generation spending
 */
export class CostTracker {
  private metrics: CostMetrics;
  private budgetLimit: number;
  private startTime: number;

  constructor(budgetLimit: number = 1.00) {
    this.budgetLimit = budgetLimit;
    this.startTime = Date.now();
    this.metrics = {
      totalCost: 0,
      imageCount: 0,
      averageCostPerImage: 0,
      byModel: {
        'flux-pulid': 0,
        'flux-kontext-pro': 0,
        'instant-id': 0,
        'nano-banana-pro': 0,
      },
      byStatus: {
        successful: 0,
        failed: 0,
        retried: 0,
      },
    };
  }

  /**
   * Track a single generation attempt
   */
  trackGeneration(
    model: ModelType,
    success: boolean,
    retried: boolean = false
  ): void {
    const cost = PROVIDERS[model].costPerImage;

    this.metrics.totalCost += cost;
    this.metrics.imageCount++;
    this.metrics.averageCostPerImage =
      this.metrics.totalCost / this.metrics.imageCount;
    this.metrics.byModel[model] += cost;

    if (success) {
      this.metrics.byStatus.successful++;
    } else {
      this.metrics.byStatus.failed++;
    }

    if (retried) {
      this.metrics.byStatus.retried++;
    }
  }

  /**
   * Check if current spending is within budget
   */
  isWithinBudget(): boolean {
    return this.metrics.totalCost < this.budgetLimit;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    return Math.max(0, this.budgetLimit - this.metrics.totalCost);
  }

  /**
   * Estimate cost for a batch of images
   */
  estimateBatchCost(
    imageCount: number,
    model: ModelType = 'flux-pulid',
    retryRate: number = 0.1
  ): number {
    const baseCost = imageCount * PROVIDERS[model].costPerImage;
    const retryCost = baseCost * retryRate;
    return baseCost + retryCost;
  }

  /**
   * Check if batch can be executed within budget
   */
  canExecuteBatch(
    imageCount: number,
    model: ModelType = 'flux-pulid'
  ): boolean {
    const estimatedCost = this.estimateBatchCost(imageCount, model);
    return this.metrics.totalCost + estimatedCost <= this.budgetLimit;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CostMetrics {
    return { ...this.metrics };
  }

  /**
   * Get summary for logging
   */
  getSummary(): string {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const successRate = this.metrics.imageCount > 0
      ? Math.round((this.metrics.byStatus.successful / this.metrics.imageCount) * 100)
      : 0;

    return [
      `Cost: $${this.metrics.totalCost.toFixed(4)} / $${this.budgetLimit.toFixed(2)}`,
      `Images: ${this.metrics.imageCount}`,
      `Success rate: ${successRate}%`,
      `Avg cost/image: $${this.metrics.averageCostPerImage.toFixed(4)}`,
      `Elapsed: ${elapsed}s`,
    ].join(' | ');
  }

  /**
   * Reset metrics (for new generation session)
   */
  reset(): void {
    this.startTime = Date.now();
    this.metrics = {
      totalCost: 0,
      imageCount: 0,
      averageCostPerImage: 0,
      byModel: {
        'flux-pulid': 0,
        'flux-kontext-pro': 0,
        'instant-id': 0,
        'nano-banana-pro': 0,
      },
      byStatus: {
        successful: 0,
        failed: 0,
        retried: 0,
      },
    };
  }
}

/**
 * Calculate cost for a completed generation job
 */
export function calculateJobCost(
  results: Array<{ model: ModelType; success: boolean; retryCount: number }>
): CostMetrics {
  const tracker = new CostTracker(Infinity);

  for (const result of results) {
    // Track initial attempt
    tracker.trackGeneration(result.model, result.success, result.retryCount > 0);

    // Track retry costs (failed attempts still cost money)
    for (let i = 0; i < result.retryCount; i++) {
      tracker.trackGeneration(result.model, false, true);
    }
  }

  return tracker.getMetrics();
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(2)}c`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Get model cost info for UI
 */
export function getModelCostInfo(model: ModelType): {
  costPerImage: number;
  costFor23: number;
  formatted: string;
} {
  const costPerImage = PROVIDERS[model].costPerImage;
  const costFor23 = costPerImage * 23;

  return {
    costPerImage,
    costFor23,
    formatted: `${formatCost(costPerImage)}/image (~${formatCost(costFor23)} for 23)`,
  };
}
