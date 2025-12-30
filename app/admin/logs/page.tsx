"use client"

import { useState } from "react"
import { Activity } from "lucide-react"
import { LogsView } from "@/components/admin/LogsView"
import { EventDetailsModal } from "@/components/admin/EventDetailsModal"
import type { SentryEvent } from "@/lib/admin/sentry-api"

/**
 * Logs & Monitoring Page
 *
 * Day 2: Implemented
 * - Sentry API integration
 * - Event table with filters
 * - Event details modal
 * - Manual refresh button
 */
export default function LogsPage() {
  const [selectedEvent, setSelectedEvent] = useState<SentryEvent | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleEventClick = (event: SentryEvent) => {
    setSelectedEvent(event)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    // Small delay before clearing to allow modal close animation
    setTimeout(() => setSelectedEvent(null), 200)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Logs & Monitoring
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Отслеживание ошибок и активности пользователей через Sentry
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-border">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Live</span>
        </div>
      </div>

      {/* LogsView Component */}
      <LogsView onEventClick={handleEventClick} />

      {/* Event Details Modal */}
      <EventDetailsModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  )
}
