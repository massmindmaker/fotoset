"use client"

import { useCallback } from "react"
import { AlertCircle, RefreshCw, X, WifiOff } from "lucide-react"

export interface ErrorModalProps {
  isOpen: boolean
  onClose: () => void
  onRetry?: () => void
  title?: string
  message: string
  isOffline?: boolean
  retryLabel?: string
  cancelLabel?: string
}

/**
 * Error Recovery Modal component
 * Provides user-friendly error display with retry functionality
 */
export function ErrorModal({
  isOpen,
  onClose,
  onRetry,
  title = "Произошла ошибка",
  message,
  isOffline = false,
  retryLabel = "Попробовать снова",
  cancelLabel = "Закрыть",
}: ErrorModalProps) {
  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
    }
  }, [onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
      aria-describedby="error-modal-description"
    >
      <div
        className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl shadow-black/20 animate-in zoom-in-95 duration-200"
        role="alertdialog"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Icon */}
          <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${
            isOffline
              ? "bg-amber-500/10 text-amber-500"
              : "bg-destructive/10 text-destructive"
          }`}>
            {isOffline ? (
              <WifiOff className="w-8 h-8" />
            ) : (
              <AlertCircle className="w-8 h-8" />
            )}
          </div>

          {/* Title */}
          <h2
            id="error-modal-title"
            className="text-xl font-semibold text-center mb-2"
          >
            {isOffline ? "Нет соединения" : title}
          </h2>

          {/* Message */}
          <p
            id="error-modal-description"
            className="text-muted-foreground text-center text-sm leading-relaxed"
          >
            {isOffline
              ? "Проверьте подключение к интернету и попробуйте снова"
              : message}
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 flex flex-col gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              {retryLabel}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl font-medium transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Offline Banner component
 * Shows a persistent banner when user is offline
 */
export function OfflineBanner({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium safe-area-inset-top animate-in slide-in-from-top duration-300"
      role="alert"
      aria-live="polite"
    >
      <WifiOff className="w-4 h-4" />
      <span>Нет подключения к интернету</span>
    </div>
  )
}

export default ErrorModal
