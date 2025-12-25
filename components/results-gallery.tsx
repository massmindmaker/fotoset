"use client"

import React, { useState, useEffect, useCallback, memo } from "react"
import {
  X, Download, Share2, Star, ChevronLeft, ChevronRight,
  Check, CheckSquare, Square, Archive, ZoomIn,
  Copy, ExternalLink, Loader2, Send, MessageCircle, Link as LinkIcon
} from "lucide-react"
import JSZip from "jszip"
import { saveAs } from "file-saver"

interface GeneratedAsset {
  id: string
  type: "PHOTO"
  url: string
  styleId: string
  prompt?: string
  createdAt: number
}

interface ResultsGalleryProps {
  assets: GeneratedAsset[]
  personaName: string
  thumbnailUrl?: string
}

// Memoized Asset Card Component - prevents unnecessary re-renders
const AssetCard = memo<{
  asset: GeneratedAsset
  index: number
  isSelected: boolean
  isSelectionMode: boolean
  onToggleSelection: (id: string) => void
  onOpenLightbox: (index: number) => void
  onShare: (asset: GeneratedAsset) => void
  onDownload: (asset: GeneratedAsset) => void
}>(
  ({
    asset,
    index,
    isSelected,
    isSelectionMode,
    onToggleSelection,
    onOpenLightbox,
    onShare,
    onDownload,
  }) => {
    return (
      <div
        className={
          "relative rounded-2xl overflow-hidden bg-card border transition-all group " +
          (isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50")
        }
      >
        {/* Selection checkbox */}
        {isSelectionMode && (
          <button
            onClick={() => onToggleSelection(asset.id)}
            className={
              "absolute top-2 left-2 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-all " +
              (isSelected ? "bg-primary text-primary-foreground" : "bg-black/50 text-white hover:bg-black/70")
            }
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`Select photo ${index + 1}`}
          >
            {isSelected ? <Check className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        )}

        {/* Image */}
        <button
          onClick={() => (isSelectionMode ? onToggleSelection(asset.id) : onOpenLightbox(index))}
          className="aspect-square w-full"
          aria-label={isSelectionMode ? `Select photo ${index + 1}` : `View photo ${index + 1} in fullscreen`}
        >
          <img src={asset.url} alt={`Generated photo ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
        </button>

        {/* Hover actions */}
        {!isSelectionMode && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenLightbox(index)
                }}
                className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                aria-label="View fullscreen"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShare(asset)
                }}
                className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                aria-label="Share photo"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDownload(asset)
                }}
                className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                aria-label="Download photo"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  },
  // Custom comparison function - only re-render if these props change
  (prev, next) =>
    prev.asset.id === next.asset.id &&
    prev.isSelected === next.isSelected &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.index === next.index
)

AssetCard.displayName = 'AssetCard'

// Share Modal Component with referral link
const ShareModal: React.FC<{
  asset: GeneratedAsset | GeneratedAsset[]
  onClose: () => void
  personaName: string
  referralCode?: string | null
}> = ({ asset, onClose, personaName, referralCode }) => {
  const [copied, setCopied] = useState(false)
  const isMultiple = Array.isArray(asset)
  const photoCount = isMultiple ? asset.length : 1
  const shareUrl = isMultiple ? asset[0].url : asset.url

  // Build referral link for PinGlass promotion
  const appUrl = referralCode
    ? `https://t.me/PinGlassBot/app?startapp=${referralCode}`
    : (typeof window !== "undefined" ? window.location.origin : "")

  const shareText = isMultiple
    ? `Мои AI-фото от ${personaName} (${photoCount} фото)\n\nPinGlass - создай свои AI-портреты:\n${appUrl}`
    : `Моё AI-фото от ${personaName}\n\nPinGlass - создай свои AI-портреты:\n${appUrl}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error("Failed to copy:", e)
    }
  }

  const downloadPhoto = async () => {
    try {
      if (isMultiple) {
        const zip = new JSZip()
        const folder = zip.folder("pinglass_photos")
        let addedFiles = 0

        for (let i = 0; i < asset.length; i++) {
          try {
            const response = await fetch(asset[i].url, { mode: 'cors', credentials: 'omit' })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const blob = await response.blob()
            if (blob.size === 0) throw new Error("Empty response")
            const filename = `photo_${String(i + 1).padStart(2, "0")}.png`
            folder?.file(filename, blob)
            addedFiles++
          } catch (err) {
            console.error(`Failed to download photo ${i + 1}:`, err)
          }
        }

        if (addedFiles === 0) {
          // All downloads failed - show fallback message
          const tg = window.Telegram?.WebApp
          if (tg?.showAlert) {
            tg.showAlert("Не удалось скачать фото. Откройте фото по отдельности и сохраните вручную.")
          } else {
            alert("Не удалось скачать фото. Попробуйте скачать по одному.")
          }
          return
        }

        const zipBlob = await zip.generateAsync({ type: "blob" })
        saveAs(zipBlob, `pinglass_${addedFiles}photos.zip`)
      } else {
        const response = await fetch(asset.url, { mode: 'cors', credentials: 'omit' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        if (blob.size === 0) throw new Error("Empty file received")
        const filename = `pinglass_${asset.id.slice(-8)}.png`
        saveAs(blob, filename)
      }
      onClose()
    } catch (e) {
      console.error("Download failed:", e)
      // Fallback: open in new tab with instruction
      if (!isMultiple) {
        window.open(asset.url, '_blank')
        const tg = window.Telegram?.WebApp
        if (tg?.showAlert) {
          tg.showAlert("Фото открыто в новой вкладке. Сохраните вручную (долгое нажатие).")
        }
      }
    }
  }

  const shareOptions = [
    {
      name: "Скопировать ссылку",
      icon: copied ? Check : LinkIcon,
      color: "bg-gray-500",
      action: copyLink,
      badge: copied ? "Скопировано!" : undefined
    },
    {
      name: "Telegram",
      icon: Send,
      color: "bg-[#0088cc]",
      action: () => {
        const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
        window.open(url, "_blank", "width=600,height=400")
        onClose()
      }
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "bg-[#25D366]",
      action: () => {
        const text = `${shareText} ${shareUrl}`
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
        window.open(url, "_blank", "width=600,height=400")
        onClose()
      }
    },
    {
      name: "VK",
      icon: ExternalLink,
      color: "bg-[#0077FF]",
      action: () => {
        const url = `https://vk.com/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`
        window.open(url, "_blank", "width=600,height=400")
        onClose()
      }
    },
    {
      name: "Скачать",
      icon: Download,
      color: "bg-primary",
      action: downloadPhoto
    }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="bg-card border border-border rounded-3xl max-w-md w-full overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 id="share-modal-title" className="font-semibold text-lg">Поделиться</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {isMultiple ? `${photoCount} фото` : "1 фото"} - {personaName}
          </p>
        </div>

        <div className="p-4 bg-muted/30">
          <div className="flex gap-2 overflow-x-auto">
            {isMultiple ? (
              asset.slice(0, 4).map((a, i) => (
                <div key={a.id} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-border">
                  <img src={a.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  {i === 3 && asset.length > 4 && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-sm font-semibold">
                      +{asset.length - 4}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="w-full max-w-[200px] mx-auto rounded-xl overflow-hidden border-2 border-border">
                <img src={asset.url} alt="" className="w-full aspect-square object-cover" loading="lazy" />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-2">
          {shareOptions.map((option, i) => (
            <button
              key={i}
              onClick={option.action}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-all group"
            >
              <div className={`w-10 h-10 ${option.color} rounded-full flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform`}>
                <option.icon className="w-5 h-5" />
              </div>
              <span className="font-medium text-left flex-1">{option.name}</span>
              {option.badge && (
                <span className="text-xs text-green-500 font-medium">{option.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-3 text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// Lightbox Component (unchanged, but with keyboard nav)
const Lightbox: React.FC<{
  assets: GeneratedAsset[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
  onDownload: (asset: GeneratedAsset) => void
  onShare: (asset: GeneratedAsset) => void
}> = ({ assets, currentIndex, onClose, onNavigate, onDownload, onShare }) => {
  const asset = assets[currentIndex]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1)
      if (e.key === "ArrowRight" && currentIndex < assets.length - 1) onNavigate(currentIndex + 1)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentIndex, assets.length, onClose, onNavigate])

  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && currentIndex < assets.length - 1) {
      onNavigate(currentIndex + 1)
    }
    if (isRightSwipe && currentIndex > 0) {
      onNavigate(currentIndex - 1)
    }
  }

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="flex items-center justify-between p-4 text-white">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors" aria-label="Close viewer">
          <X className="w-6 h-6" />
        </button>
        <span className="text-sm text-white/70" aria-live="polite">{currentIndex + 1} / {assets.length}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => onShare(asset)} className="p-2 hover:bg-white/10 rounded-xl transition-colors" aria-label="Share photo">
            <Share2 className="w-5 h-5" />
          </button>
          <button onClick={() => onDownload(asset)} className="p-2 hover:bg-white/10 rounded-xl transition-colors" aria-label="Download photo">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative px-4 pb-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
        )}

        <div className="max-w-full max-h-full flex items-center justify-center">
          <img
            src={asset.url}
            alt={`Generated photo ${currentIndex + 1}`}
            className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-lg"
            draggable={false}
          />
        </div>

        {currentIndex < assets.length - 1 && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            aria-label="Next photo"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        )}
      </div>

      <div className="p-4 bg-black/50">
        <div className="flex gap-2 overflow-x-auto justify-center pb-2">
          {assets.map((a, i) => (
            <button
              key={a.id}
              onClick={() => onNavigate(i)}
              className={
                "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all " +
                (i === currentIndex ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-80")
              }
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === currentIndex ? "true" : undefined}
            >
              <img src={a.url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Main Gallery Component
export default function ResultsGallery({ assets, personaName, thumbnailUrl }: ResultsGalleryProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [shareModalAsset, setShareModalAsset] = useState<GeneratedAsset | GeneratedAsset[] | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)

  // Load referral code from localStorage
  useEffect(() => {
    // Load referral code for sharing
    const loadReferralCode = async () => {
      // Get telegram user ID from Telegram WebApp
      const tg = (window as any).Telegram?.WebApp
      const telegramUserId = tg?.initDataUnsafe?.user?.id
      if (!telegramUserId) return

      try {
        const res = await fetch(`/api/referral/code?telegram_user_id=${telegramUserId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.code) {
            setReferralCode(data.code)
          }
        }
      } catch (e) {
        console.error("Failed to load referral code:", e)
      }
    }
    loadReferralCode()
  }, [])

  // Memoized handlers to prevent re-creating functions
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(assets.map(a => a.id)))
    }
  }, [selectedIds.size, assets])

  const downloadSingle = useCallback(async (asset: GeneratedAsset) => {
    const filename = `pinglass_${asset.id.slice(-8)}.png`

    try {
      // Use proxy to bypass CORS
      const proxyUrl = `/api/download?url=${encodeURIComponent(asset.url)}&filename=${encodeURIComponent(filename)}`
      const response = await fetch(proxyUrl)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      const blob = await response.blob()
      if (blob.size === 0) throw new Error("Empty file")

      saveAs(blob, filename)
    } catch (e) {
      console.error("Download failed:", e)
      // Fallback: open in new tab + show explanation
      window.open(asset.url, '_blank')
      const tg = (window as any).Telegram?.WebApp
      if (tg?.showAlert) {
        tg.showAlert("Фото открыто в новой вкладке. Сохраните его вручную (долгое нажатие).")
      }
    }
  }, [])

  const downloadAsZip = useCallback(async (assetsToDownload: GeneratedAsset[]) => {
    if (assetsToDownload.length === 0) return

    setIsDownloading(true)
    setDownloadProgress(0)

    try {
      const zip = new JSZip()
      const folder = zip.folder("pinglass_photos")
      let addedFiles = 0
      let processedFiles = 0

      // Parallel download with limit
      const PARALLEL_LIMIT = 5
      const chunks: GeneratedAsset[][] = []
      for (let i = 0; i < assetsToDownload.length; i += PARALLEL_LIMIT) {
        chunks.push(assetsToDownload.slice(i, i + PARALLEL_LIMIT))
      }

      for (const chunk of chunks) {
        const results = await Promise.all(
          chunk.map(async (asset, chunkIndex) => {
            const globalIndex = processedFiles + chunkIndex
            const filename = `photo_${String(globalIndex + 1).padStart(2, "0")}.png`
            try {
              // Use proxy to bypass CORS
              const proxyUrl = `/api/download?url=${encodeURIComponent(asset.url)}&filename=${encodeURIComponent(filename)}`
              const response = await fetch(proxyUrl)
              if (!response.ok) throw new Error(`HTTP ${response.status}`)

              const blob = await response.blob()
              if (blob.size === 0) throw new Error("Empty response")

              return { filename, blob, success: true }
            } catch (e) {
              console.error(`Failed to download ${asset.id}:`, e)
              return { filename, blob: null, success: false }
            }
          })
        )

        // Add successful downloads to zip
        for (const result of results) {
          if (result.success && result.blob) {
            folder?.file(result.filename, result.blob)
            addedFiles++
          }
        }

        processedFiles += chunk.length
        setDownloadProgress(Math.round((processedFiles / assetsToDownload.length) * 100))
      }

      // Check if any files were added
      if (addedFiles === 0) {
        const tg = (window as any).Telegram?.WebApp
        if (tg?.showAlert) {
          tg.showAlert("Не удалось скачать фото. Попробуйте скачать по одному.")
        } else {
          alert("Не удалось скачать фото. Попробуйте скачать по одному.")
        }
        return
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      saveAs(zipBlob, `pinglass_${personaName.replace(/\s+/g, "_")}_${addedFiles}photos.zip`)
    } catch (e) {
      console.error("ZIP creation failed:", e)
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
    }
  }, [personaName])

  const sharePhoto = useCallback(async (asset: GeneratedAsset) => {
    // Build referral link
    const shareUrl = referralCode
      ? `https://t.me/PinGlassBot/app?startapp=${referralCode}`
      : window.location.origin

    if (navigator.share && navigator.canShare) {
      try {
        const response = await fetch(asset.url)
        const blob = await response.blob()
        const file = new File([blob], "pinglass_photo.png", { type: "image/png" })

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "PinGlass - AI Фото",
            text: `Моё AI-фото от ${personaName}\n\nPinGlass - создай свои AI-портреты:\n${shareUrl}`,
            files: [file]
          })
          return
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          return
        }
        console.error("Web Share API failed:", e)
      }
    }

    setShareModalAsset(asset)
  }, [personaName, referralCode])

  const selectedAssets = assets.filter(a => selectedIds.has(a.id))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-2xl">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary flex-shrink-0 bg-muted flex items-center justify-center">
            {thumbnailUrl || assets[0]?.url ? (
              <img src={thumbnailUrl || assets[0]?.url} alt={personaName} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">{personaName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{personaName}</h3>
            <p className="text-sm text-muted-foreground">{assets.length} фото</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode)
              if (isSelectionMode) setSelectedIds(new Set())
            }}
            className={
              "px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 " +
              (isSelectionMode ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")
            }
            aria-pressed={isSelectionMode}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{isSelectionMode ? "Готово" : "Выбрать"}</span>
          </button>

          <button
            onClick={() => downloadAsZip(assets)}
            disabled={isDownloading}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            aria-label="Download all photos as ZIP"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">{downloadProgress}%</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">Скачать все</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selection actions */}
      {isSelectionMode && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm font-medium hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2"
          >
            {selectedIds.size === assets.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selectedIds.size === assets.length ? "Снять всё" : "Выбрать всё"}
          </button>

          <div className="flex-1 text-sm text-muted-foreground" aria-live="polite">
            Выбрано: {selectedIds.size}
          </div>

          {selectedIds.size > 0 && (
            <button
              onClick={() => downloadAsZip(selectedAssets)}
              disabled={isDownloading}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Скачать ({selectedIds.size})</span>
            </button>
          )}
        </div>
      )}

      {/* Photo grid with memoized cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-0.5">
        {assets.map((asset, index) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            index={index}
            isSelected={selectedIds.has(asset.id)}
            isSelectionMode={isSelectionMode}
            onToggleSelection={toggleSelection}
            onOpenLightbox={setLightboxIndex}
            onShare={sharePhoto}
            onDownload={downloadSingle}
          />
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          assets={assets}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDownload={downloadSingle}
          onShare={sharePhoto}
        />
      )}

      {/* Share Modal */}
      {shareModalAsset && (
        <ShareModal
          asset={shareModalAsset}
          onClose={() => setShareModalAsset(null)}
          personaName={personaName}
          referralCode={referralCode}
        />
      )}
    </div>
  )
}
