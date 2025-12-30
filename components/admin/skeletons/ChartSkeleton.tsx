"use client"

interface ChartSkeletonProps {
  height?: number
  type?: 'line' | 'bar' | 'pie'
}

/**
 * ChartSkeleton - Loading skeleton for chart components
 */
export function ChartSkeleton({ height = 300, type = 'line' }: ChartSkeletonProps) {
  if (type === 'pie') {
    return (
      <div className="bg-card/50 border border-border rounded-xl p-6">
        <div className="h-4 bg-muted rounded w-32 mb-4 animate-pulse" />
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="w-48 h-48 rounded-full border-8 border-muted animate-pulse" />
        </div>
        <div className="flex justify-center gap-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted/50 rounded w-12 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card/50 border border-border rounded-xl p-6">
      <div className="h-4 bg-muted rounded w-32 mb-4 animate-pulse" />
      <div className="relative" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between w-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 bg-muted/30 rounded w-8 animate-pulse" />
          ))}
        </div>

        {/* Chart area */}
        <div className="ml-12 h-full flex items-end gap-2 pb-8">
          {type === 'bar' ? (
            // Bar chart skeleton
            Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-muted/50 rounded-t animate-pulse"
                style={{
                  height: `${Math.random() * 60 + 20}%`,
                  animationDelay: `${i * 100}ms`
                }}
              />
            ))
          ) : (
            // Line chart skeleton
            <svg className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="skeletonGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--muted)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--muted)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 80 Q 50 60, 100 70 T 200 50 T 300 65 T 400 40 T 500 55"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="2"
                className="animate-pulse"
              />
              <path
                d="M 0 80 Q 50 60, 100 70 T 200 50 T 300 65 T 400 40 T 500 55 V 100 H 0 Z"
                fill="url(#skeletonGradient)"
                className="animate-pulse"
              />
            </svg>
          )}
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-12 right-0 flex justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3 bg-muted/30 rounded w-8 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
