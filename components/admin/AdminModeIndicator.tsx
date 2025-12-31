'use client'

import { useEffect, useState } from 'react'
import { TestTube, Rocket } from 'lucide-react'

export function AdminModeIndicator() {
  const [mode, setMode] = useState<'test' | 'production'>('test')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/settings/tbank')
      .then(r => r.json())
      .then(data => {
        setMode(data.mode || 'test')
        setLoading(false)
      })
      .catch(() => {
        setMode('test')
        setLoading(false)
      })
  }, [])

  if (loading) return null

  return mode === 'test' ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200">
      <TestTube className="w-3 h-3" />
      <span>Test Mode</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 border border-green-200">
      <Rocket className="w-3 h-3" />
      <span>Production</span>
    </span>
  )
}
