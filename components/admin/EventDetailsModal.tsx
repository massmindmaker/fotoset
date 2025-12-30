"use client"

import { useEffect, useState } from "react"
import { X, ExternalLink, Copy, Check, Loader2 } from "lucide-react"
import type { SentryEvent } from "@/lib/admin/sentry-api"

/**
 * EventDetailsModal Component
 *
 * Displays full details of a Sentry event in a modal dialog
 *
 * Features:
 * - Stack trace display (if available)
 * - Breadcrumbs (user journey before error)
 * - Context data (user, device, request)
 * - Tags (environment, release, etc.)
 * - Link to Sentry dashboard
 * - Copy event ID button
 */

interface EventDetailsModalProps {
  event: SentryEvent | null
  isOpen: boolean
  onClose: () => void
}

export function EventDetailsModal({ event, isOpen, onClose }: EventDetailsModalProps) {
  const [copied, setCopied] = useState(false)
  const [fullDetails, setFullDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch full event details when modal opens
  useEffect(() => {
    if (isOpen && event) {
      fetchFullDetails(event.eventID || event.id)
    } else {
      setFullDetails(null)
    }
  }, [isOpen, event])

  const fetchFullDetails = async (eventId: string) => {
    setIsLoading(true)
    try {
      // For MVP, we'll just use the event data we already have
      // In production, you could fetch /api/admin/logs/${eventId} for full details
      setFullDetails(event)
    } catch (error) {
      console.error("[EventDetailsModal] Failed to fetch details:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Copy event ID to clipboard
  const handleCopyId = () => {
    if (event) {
      navigator.clipboard.writeText(event.eventID || event.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen || !event) return null

  // Sentry dashboard link
  const sentryOrgPath = process.env.NEXT_PUBLIC_SENTRY_ORG || "your-org"
  const sentryProjectPath = process.env.NEXT_PUBLIC_SENTRY_PROJECT || "pinglass"
  const sentryDashboardUrl = `https://sentry.io/organizations/${sentryOrgPath}/issues/?project=${sentryProjectPath}&query=${event.eventID || event.id}`

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="glass rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden pointer-events-auto border border-border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">
                Event Details
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date(event.timestamp).toLocaleString("ru-RU")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Message */}
                <Section title="Сообщение">
                  <p className="text-sm text-foreground font-medium">
                    {event.message}
                  </p>
                  {event.culprit && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      {event.culprit}
                    </p>
                  )}
                </Section>

                {/* Event ID + Actions */}
                <Section title="Event ID">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-xs font-mono text-foreground">
                      {event.eventID || event.id}
                    </code>
                    <button
                      onClick={handleCopyId}
                      className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Скопировано
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Копировать
                        </>
                      )}
                    </button>
                    <a
                      href={sentryDashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Sentry
                    </a>
                  </div>
                </Section>

                {/* User Info */}
                {event.user && (
                  <Section title="Пользователь">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {event.user.telegram_id && (
                        <InfoRow label="Telegram ID" value={event.user.telegram_id} />
                      )}
                      {event.user.id && <InfoRow label="User ID" value={event.user.id} />}
                      {event.user.username && (
                        <InfoRow label="Username" value={event.user.username} />
                      )}
                      {event.user.ip_address && (
                        <InfoRow label="IP Address" value={event.user.ip_address} />
                      )}
                    </div>
                  </Section>
                )}

                {/* Tags */}
                {event.tags && Object.keys(event.tags).length > 0 && (
                  <Section title="Tags">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(event.tags).map(([key, value]) => (
                        <span
                          key={key}
                          className="px-2 py-1 bg-muted rounded text-xs font-mono"
                        >
                          <span className="text-muted-foreground">{key}:</span>{" "}
                          <span className="text-foreground">{value}</span>
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Context */}
                {event.context && Object.keys(event.context).length > 0 && (
                  <Section title="Context">
                    <pre className="p-3 bg-muted rounded-lg text-xs font-mono text-foreground overflow-x-auto">
                      {JSON.stringify(event.context, null, 2)}
                    </pre>
                  </Section>
                )}

                {/* Platform */}
                {event.platform && (
                  <Section title="Platform">
                    <p className="text-sm text-foreground font-mono">{event.platform}</p>
                  </Section>
                )}

                {/* Note about full stack trace */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>Полный stack trace и breadcrumbs</strong> доступны в Sentry
                    dashboard (кнопка выше). В MVP мы показываем базовую информацию.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Section Component
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  )
}

/**
 * InfoRow Component
 */
function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium mt-0.5">{value}</p>
    </div>
  )
}
