"use client"

interface ModalSkeletonProps {
  title?: boolean
  tabs?: number
  content?: 'form' | 'list' | 'grid'
}

/**
 * ModalSkeleton - Loading skeleton for modal content
 */
export function ModalSkeleton({ title = true, tabs = 0, content = 'form' }: ModalSkeletonProps) {
  return (
    <div className="animate-pulse">
      {/* Title */}
      {title && (
        <div className="h-6 bg-muted rounded w-48 mb-4" />
      )}

      {/* Tabs */}
      {tabs > 0 && (
        <div className="flex gap-2 mb-4 border-b border-border pb-2">
          {Array.from({ length: tabs }).map((_, i) => (
            <div key={i} className="h-8 bg-muted/50 rounded-lg w-20" />
          ))}
        </div>
      )}

      {/* Content */}
      {content === 'form' && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 bg-muted/30 rounded w-24 mb-2" />
              <div className="h-10 bg-muted/50 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {content === 'list' && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="w-10 h-10 bg-muted/50 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-muted/50 rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {content === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted/50 rounded-lg" />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
        <div className="h-10 bg-muted/30 rounded-lg w-24" />
        <div className="h-10 bg-muted/50 rounded-lg w-24" />
      </div>
    </div>
  )
}
