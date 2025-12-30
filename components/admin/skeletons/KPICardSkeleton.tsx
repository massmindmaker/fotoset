"use client"

/**
 * KPICardSkeleton - Loading skeleton for KPI cards
 */
export function KPICardSkeleton() {
  return (
    <div className="bg-card/50 border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-muted rounded" />
        <div className="h-3 bg-muted rounded w-16" />
      </div>
      <div className="h-8 bg-muted/50 rounded w-24 mb-1" />
      <div className="h-3 bg-muted/30 rounded w-20" />
    </div>
  )
}

/**
 * KPIGridSkeleton - Loading skeleton for grid of KPI cards
 */
export function KPIGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <KPICardSkeleton key={i} />
      ))}
    </div>
  )
}
