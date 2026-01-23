'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Package, ChevronRight, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

interface Pack {
  id: number
  name: string
  description: string | null
  slug: string
  coverUrl: string | null
  previewImages: string[]
  promptCount: number
  usageCount: number
  isActive: boolean
  moderationStatus: 'draft' | 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export default function PartnerPacksPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPacks = useCallback(async () => {
    const telegramUserId = localStorage.getItem('pinglass_telegram_user_id')
    if (!telegramUserId) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/partner/packs?telegram_user_id=${telegramUserId}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch packs')
      }
      const data = await res.json()
      setPacks(data.packs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPacks()
  }, [fetchPacks])

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/10 text-gray-500',
    pending: 'bg-yellow-500/10 text-yellow-600',
    approved: 'bg-green-500/10 text-green-600',
    rejected: 'bg-red-500/10 text-red-600'
  }

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-red-500">Error loading packs</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link
          href="/partner/dashboard"
          className="inline-block mt-4 text-primary hover:underline"
        >
          Return to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Packs</h1>
          <p className="text-muted-foreground">
            Create and manage your style packs
          </p>
        </div>

        <Link
          href="/partner/packs/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Pack
        </Link>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
        <h3 className="font-medium mb-2">How Partner Packs Work</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Create a style pack with 15-23 unique prompts</li>
          <li>Submit for review - our team will check quality</li>
          <li>Once approved, users can select your pack for generation</li>
          <li>Earn commission from every generation using your pack</li>
        </ul>
      </div>

      {/* Packs Grid */}
      {packs.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-lg">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No packs yet</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Create your first style pack to start earning
          </p>
          <Link
            href="/partner/packs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Create Pack
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <Link
              key={pack.id}
              href={`/partner/packs/${pack.id}`}
              className="bg-card border rounded-lg overflow-hidden hover:border-primary transition-colors group"
            >
              {/* Preview Images */}
              <div className="aspect-video bg-muted relative">
                {pack.previewImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-0.5 h-full">
                    {pack.previewImages.slice(0, 4).map((url, i) => (
                      <div key={i} className="relative overflow-hidden">
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[pack.moderationStatus]}`}>
                    {statusLabels[pack.moderationStatus]}
                  </span>
                </div>

                {/* Active/Inactive */}
                {pack.moderationStatus === 'approved' && (
                  <div className="absolute top-2 left-2">
                    {pack.isActive ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium truncate">{pack.name}</h3>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {pack.description || 'No description'}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{pack.promptCount} prompts</span>
                  <span>{pack.usageCount} uses</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
