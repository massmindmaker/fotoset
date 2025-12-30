'use client'

import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

export type DateFilterPreset = 'today' | '7d' | '30d' | 'mtd' | 'custom' | 'all'

interface DateFilterProps {
  value: DateFilterPreset
  customRange?: { from: Date | null; to: Date | null }
  onChange: (preset: DateFilterPreset, range?: { from: Date | null; to: Date | null }) => void
}

const PRESETS: { id: DateFilterPreset; label: string }[] = [
  { id: 'all', label: 'Все время' },
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: 'mtd', label: 'Этот месяц' },
  { id: 'custom', label: 'Свой период' }
]

export function DateFilter({ value, customRange, onChange }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [fromDate, setFromDate] = useState(customRange?.from?.toISOString().split('T')[0] || '')
  const [toDate, setToDate] = useState(customRange?.to?.toISOString().split('T')[0] || '')

  const selectedPreset = PRESETS.find(p => p.id === value) || PRESETS[0]

  const handlePresetClick = (preset: DateFilterPreset) => {
    if (preset === 'custom') {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      onChange(preset)
      setIsOpen(false)
    }
  }

  const handleCustomApply = () => {
    const from = fromDate ? new Date(fromDate) : null
    const to = toDate ? new Date(toDate) : null

    if (from && to) {
      onChange('custom', { from, to })
      setIsOpen(false)
      setShowCustom(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 transition-colors shadow-sm"
      >
        <Calendar className="w-4 h-4 text-slate-500" />
        <span>{selectedPreset.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false)
              setShowCustom(false)
            }}
          />

          {/* Dropdown */}
          <div className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[200px] overflow-hidden">
            {!showCustom ? (
              <div className="py-1">
                {PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.id)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      value === preset.id
                        ? 'bg-pink-50 text-pink-600 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="text-sm font-medium text-slate-900">Свой период</div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">От</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">До</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCustom(false)}
                    className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors"
                  >
                    Назад
                  </button>
                  <button
                    onClick={handleCustomApply}
                    disabled={!fromDate || !toDate}
                    className="flex-1 px-3 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Применить
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function getDateRangeFromPreset(preset: DateFilterPreset): { from: Date | null; to: Date | null } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case 'today':
      return { from: today, to: now }
    case '7d':
      const week = new Date(today)
      week.setDate(week.getDate() - 7)
      return { from: week, to: now }
    case '30d':
      const month = new Date(today)
      month.setDate(month.getDate() - 30)
      return { from: month, to: now }
    case 'mtd':
      const mtd = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: mtd, to: now }
    case 'all':
    default:
      return { from: null, to: null }
  }
}
