'use client'

import { useState } from 'react'
import { Download, ChevronDown, FileSpreadsheet, FileJson, FileText, Loader2 } from 'lucide-react'

export type ExportFormat = 'csv' | 'json' | 'xlsx'

interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void>
  disabled?: boolean
  loading?: boolean
}

const FORMATS: { id: ExportFormat; label: string; icon: React.ElementType }[] = [
  { id: 'csv', label: 'CSV', icon: FileText },
  { id: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { id: 'json', label: 'JSON', icon: FileJson }
]

export function ExportButton({ onExport, disabled, loading }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)

  const handleExport = async (format: ExportFormat) => {
    setIsOpen(false)
    setExportingFormat(format)
    try {
      await onExport(format)
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading || exportingFormat !== null}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(loading || exportingFormat) ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>Экспорт</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full mt-2 right-0 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden py-1">
            {FORMATS.map(format => (
              <button
                key={format.id}
                onClick={() => handleExport(format.id)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors text-left"
              >
                <format.icon className="w-4 h-4 text-zinc-500" />
                {format.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
