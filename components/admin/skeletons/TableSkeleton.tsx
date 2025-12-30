"use client"

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

/**
 * TableSkeleton - Loading skeleton for table components
 */
export function TableSkeleton({ rows = 5, columns = 6 }: TableSkeletonProps) {
  return (
    <div className="bg-card/50 border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-4 bg-muted rounded animate-pulse w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/50">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <div
                    className="h-4 bg-muted/50 rounded animate-pulse"
                    style={{
                      width: `${Math.random() * 40 + 60}%`,
                      animationDelay: `${rowIndex * 100 + colIndex * 50}ms`
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
