"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  X, Download, Share2, Star, ChevronLeft, ChevronRight,
  Check, CheckSquare, Square, Archive, ZoomIn, Heart,
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

// Telegram Link Modal Component
const TelegramLinkModal: React.FC<{
  linkCode: string
  onClose: () => void
}> = ({ linkCode, onClose }) => {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(linkCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Привязать Telegram</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Для отправки фото в Telegram нужно привязать аккаунт:
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>Откройте бот @Pinglass_bot в Telegram</li>
            <li>Отправьте команду /start</li>
            <li>Отправьте код привязки:</li>
          </ol>

          <div className="relative">
            <div className="p-4 bg-muted rounded-xl font-mono text-center text-lg font-semibold">
              {linkCode}
            </div>
            <button
              onClick={copyCode}
              className="absolute top-2 right-2 p-2 bg-primary text-primary-foreground rounded-lg text-xs hover:opacity-90 transition-all flex items-center gap-1"
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
          </div>

          <a
            href={`https://t.me/Pinglass_bot?start=${linkCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl text-center font-medium hover:opacity-90 transition-all"
          >
            Открыть Telegram
          </a>
        </div>
      </div>
    </div>
  )
}

// Share Modal Component
const ShareModal: React.FC<{
  asset: GeneratedAsset | GeneratedAsset[]
  onClose: () => void
  personaName: string
}> = ({ asset, onClose, personaName }) => {
  const [copied, setCopied] = useState(false)
  const isMultiple = Array.isArray(asset)
  const photoCount = isMultiple ? asset.length : 1
  const shareUrl = isMultiple ? asset[0].url : asset.url

  const shareText = isMultiple
    ? `Мои AI-фото от ${personaName} (${photoCount} фото)`
    : `Моё AI-фото от ${personaName}`

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
        // Download multiple as ZIP
        const zip = new JSZip()
        const folder = zip.folder("pinglass_photos")

        for (let i = 0; i < asset.length; i++) {
          const response = await fetch(asset[i].url)
          const blob = await response.blob()
          const filename = `photo_${String(i + 1).padStart(2, "0")}.png`
          folder?.file(filename, blob)
        }

        const zipBlob = await zip.generateAsync({ type: "blob" })
        saveAs(zipBlob, `pinglass_${photoCount}photos.zip`)
      } else {
        const response = await fetch(asset.url)
        const blob = await response.blob()
        const filename = `pinglass_${asset.id.slice(-8)}.png`
        saveAs(blob, filename)
      }
      onClose()
    } catch (e) {
      console.error("Download failed:", e)
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
    >
      <div
        className="bg-card border border-border rounded-3xl max-w-md w-full overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Поделиться</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {isMultiple ? `${photoCount} фото` : "1 фото"} - {personaName}
          </p>
        </div>

        {/* Preview */}
        <div className="p-4 bg-muted/30">
          <div className="flex gap-2 overflow-x-auto">
            {isMultiple ? (
              asset.slice(0, 4).map((a, i) => (
                <div key={a.id} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-border">
                  <img src={a.url} alt="" className="w-full h-full object-cover" />
                  {i === 3 && asset.length > 4 && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-sm font-semibold">
                      +{asset.length - 4}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="w-full max-w-[200px] mx-auto rounded-xl overflow-hidden border-2 border-border">
                <img src={asset.url} alt="" className="w-full aspect-square object-cover" />
              </div>
            )}
          </div>
        </div>

        {/* Share Options */}
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

        {/* Cancel */}
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

// Lightbox Component
const Lightbox: React.FC<{
  assets: GeneratedAsset[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
  onDownload: (asset: GeneratedAsset) => void
  onShare: (asset: GeneratedAsset) => void
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
}> = ({ assets, currentIndex, onClose, onNavigate, onDownload, onShare, favorites, onToggleFavorite }) => {
  const asset = assets[currentIndex]

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1)
      if (e.key === "ArrowRight" && currentIndex < assets.length - 1) onNavigate(currentIndex + 1)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentIndex, assets.length, onClose, onNavigate])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const isFavorite = favorites.has(asset.id)

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
          <X className="w-6 h-6" />
        </button>
        <span className="text-sm text-white/70">{currentIndex + 1} / {assets.length}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleFavorite(asset.id)}
            className={"p-2 rounded-xl transition-colors " + (isFavorite ? "bg-red-500/20 text-red-400" : "hover:bg-white/10")}
          >
            <Heart className={"w-5 h-5 " + (isFavorite ? "fill-current" : "")} />
          </button>
          <button onClick={() => onShare(asset)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
          <button onClick={() => onDownload(asset)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center relative px-4 pb-4">
        {/* Previous button */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
        )}

        {/* Image */}
        <div className="max-w-full max-h-full flex items-center justify-center">
          <img
            src={asset.url}
            alt={`Photo ${currentIndex + 1}`}
            className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-lg"
            draggable={false}
          />
        </div>

        {/* Next button */}
        {currentIndex < assets.length - 1 && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="p-4 bg-black/50">
        <div className="flex gap-2 overflow-x-auto justify-center pb-2">
          {assets.map((a, i) => (
            <button
              key={a.id}
              onClick={() => onNavigate(i)}
              className={"w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all " +
                (i === currentIndex ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-80")}
            >
              <img src={a.url} alt="" className="w-full h-full object-cover" />
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
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // Telegram state
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [showTelegramModal, setShowTelegramModal] = useState(false)
  const [telegramLinkCode, setTelegramLinkCode] = useState("")

  // Share modal state
  const [shareModalAsset, setShareModalAsset] = useState<GeneratedAsset | GeneratedAsset[] | null>(null)

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pinglass_favorites")
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)))
      } catch {}
    }
  }, [])

  // Check Telegram link status on mount
  useEffect(() => {
    const checkTelegramStatus = async () => {
      const deviceId = localStorage.getItem("pinglass_device_id")
      if (!deviceId) return

      try {
        const response = await fetch(`/api/telegram/link?device_id=${deviceId}`)
        const data = await response.json()
        setTelegramLinked(data.linked || false)
      } catch (e) {
        console.error("Failed to check Telegram status:", e)
      }
    }

    checkTelegramStatus()
  }, [])

  // Save favorites to localStorage
  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem("pinglass_favorites", JSON.stringify([...next]))
      return next
    })
  }, [])

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Select all / deselect all
  const selectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(assets.map(a => a.id)))
    }
  }

  // Download single photo
  const downloadSingle = async (asset: GeneratedAsset) => {
    try {
      const response = await fetch(asset.url)
      const blob = await response.blob()
      const filename = `pinglass_${asset.id.slice(-8)}.png`
      saveAs(blob, filename)
    } catch (e) {
      console.error("Download failed:", e)
    }
  }

  // Download multiple as ZIP
  const downloadAsZip = async (assetsToDownload: GeneratedAsset[]) => {
    if (assetsToDownload.length === 0) return

    setIsDownloading(true)
    setDownloadProgress(0)

    try {
      const zip = new JSZip()
      const folder = zip.folder("pinglass_photos")

      for (let i = 0; i < assetsToDownload.length; i++) {
        const asset = assetsToDownload[i]
        try {
          const response = await fetch(asset.url)
          const blob = await response.blob()
          const filename = `photo_${String(i + 1).padStart(2, "0")}.png`
          folder?.file(filename, blob)
          setDownloadProgress(Math.round(((i + 1) / assetsToDownload.length) * 100))
        } catch (e) {
          console.error(`Failed to download ${asset.id}:`, e)
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      saveAs(zipBlob, `pinglass_${personaName.replace(/\s+/g, "_")}_${assetsToDownload.length}photos.zip`)
    } catch (e) {
      console.error("ZIP creation failed:", e)
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
    }
  }

  // Share functionality - single photo
  const sharePhoto = async (asset: GeneratedAsset) => {
    // Try Web Share API first (native OS share sheet)
    if (navigator.share && navigator.canShare) {
      try {
        const response = await fetch(asset.url)
        const blob = await response.blob()
        const file = new File([blob], "pinglass_photo.png", { type: "image/png" })

        // Check if files can be shared
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "PinGlass Photo",
            text: `Моё AI-фото от ${personaName}`,
            files: [file]
          })
          return
        }
      } catch (e) {
        // If user cancelled, don't show fallback
        if ((e as Error).name === "AbortError") {
          return
        }
        console.error("Web Share API failed:", e)
      }
    }

    // Fallback: show custom share modal
    setShareModalAsset(asset)
  }

  // Share functionality - multiple photos
  const shareMultiplePhotos = async () => {
    const photosToShare = selectedAssets

    if (photosToShare.length === 0) return

    // Try Web Share API first for multiple files
    if (navigator.share && navigator.canShare && photosToShare.length <= 10) {
      try {
        const files: File[] = []

        for (let i = 0; i < photosToShare.length; i++) {
          const response = await fetch(photosToShare[i].url)
          const blob = await response.blob()
          const file = new File([blob], `pinglass_photo_${i + 1}.png`, { type: "image/png" })
          files.push(file)
        }

        if (navigator.canShare({ files })) {
          await navigator.share({
            title: "PinGlass Photos",
            text: `Мои AI-фото от ${personaName} (${photosToShare.length} фото)`,
            files
          })
          return
        }
      } catch (e) {
        // If user cancelled, don't show fallback
        if ((e as Error).name === "AbortError") {
          return
        }
        console.error("Web Share API failed:", e)
      }
    }

    // Fallback: show custom share modal
    setShareModalAsset(photosToShare)
  }

  // Telegram send handler
  const handleTelegramSend = async () => {
    const deviceId = localStorage.getItem("pinglass_device_id")
    if (!deviceId) {
      alert("Device ID не найден")
      return
    }

    setTelegramLoading(true)

    try {
      // Check if linked
      if (!telegramLinked) {
        // Get link code
        const linkResponse = await fetch("/api/telegram/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId })
        })

        const linkData = await linkResponse.json()

        if (linkData.code) {
          setTelegramLinkCode(linkData.code)
          setShowTelegramModal(true)
        } else if (linkData.linked) {
          setTelegramLinked(true)
          alert("Telegram уже привязан! Нажмите ещё раз для отправки фото.")
        } else {
          alert("Не удалось получить код привязки")
        }
      } else {
        // Send photos
        const photosToSend = selectedIds.size > 0
          ? assets.filter(a => selectedIds.has(a.id)).map(a => a.url)
          : assets.map(a => a.url)

        const sendResponse = await fetch("/api/telegram/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            photoUrls: photosToSend
          })
        })

        const sendData = await sendResponse.json()

        if (sendData.sent > 0) {
          alert(`Отправлено ${sendData.sent} из ${sendData.total} фото в Telegram`)
        } else if (sendData.error === "NOT_LINKED") {
          setTelegramLinked(false)
          alert("Telegram не привязан. Нажмите ещё раз для привязки.")
        } else {
          alert("Ошибка при отправке в Telegram: " + (sendData.error || "Неизвестная ошибка"))
        }
      }
    } catch (e) {
      console.error("Telegram error:", e)
      alert("Ошибка при работе с Telegram")
    } finally {
      setTelegramLoading(false)
    }
  }

  const selectedAssets = assets.filter(a => selectedIds.has(a.id))
  const favoriteAssets = assets.filter(a => favorites.has(a.id))

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-2xl">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary flex-shrink-0">
            <img src={thumbnailUrl || assets[0]?.url} alt={personaName} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{personaName}</h3>
            <p className="text-sm text-muted-foreground">{assets.length} фото</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selection mode toggle */}
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode)
              if (isSelectionMode) setSelectedIds(new Set())
            }}
            className={"px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 " +
              (isSelectionMode ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{isSelectionMode ? "Готово" : "Выбрать"}</span>
          </button>

          {/* Telegram button */}
          <button
            onClick={handleTelegramSend}
            disabled={telegramLoading}
            className="px-3 py-2 bg-[#0088cc] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {telegramLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Telegram</span>
          </button>

          {/* Download all */}
          <button
            onClick={() => downloadAsZip(assets)}
            disabled={isDownloading}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
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

      {/* Selection actions bar */}
      {isSelectionMode && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm font-medium hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2"
          >
            {selectedIds.size === assets.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selectedIds.size === assets.length ? "Снять всё" : "Выбрать всё"}
          </button>

          <div className="flex-1 text-sm text-muted-foreground">
            Выбрано: {selectedIds.size}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={shareMultiplePhotos}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Поделиться</span>
              </button>
              <button
                onClick={() => downloadAsZip(selectedAssets)}
                disabled={isDownloading}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Скачать ({selectedIds.size})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Favorites section */}
      {favoriteAssets.length > 0 && !isSelectionMode && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Heart className="w-4 h-4 fill-red-400 text-red-400" />
            Избранное ({favoriteAssets.length})
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {favoriteAssets.map((asset) => {
              const index = assets.findIndex(a => a.id === asset.id)
              return (
                <button
                  key={asset.id}
                  onClick={() => setLightboxIndex(index)}
                  className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-red-400/50 hover:ring-red-400 transition-all"
                >
                  <img src={asset.url} alt="" className="w-full h-full object-cover" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {assets.map((asset, index) => {
          const isSelected = selectedIds.has(asset.id)
          const isFavorite = favorites.has(asset.id)

          return (
            <div
              key={asset.id}
              className={"relative rounded-2xl overflow-hidden bg-card border transition-all group " +
                (isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50")}
            >
              {/* Selection checkbox */}
              {isSelectionMode && (
                <button
                  onClick={() => toggleSelection(asset.id)}
                  className={"absolute top-2 left-2 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-all " +
                    (isSelected ? "bg-primary text-primary-foreground" : "bg-black/50 text-white hover:bg-black/70")}
                >
                  {isSelected ? <Check className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
              )}

              {/* Favorite badge */}
              {isFavorite && !isSelectionMode && (
                <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-lg bg-red-500/80 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white fill-white" />
                </div>
              )}

              {/* Image */}
              <button
                onClick={() => isSelectionMode ? toggleSelection(asset.id) : setLightboxIndex(index)}
                className="aspect-square w-full"
              >
                <img src={asset.url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              </button>

              {/* Hover actions */}
              {!isSelectionMode && (
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id) }}
                      className={"p-2 rounded-lg transition-colors " + (isFavorite ? "bg-red-500/80 text-white" : "bg-white/20 text-white hover:bg-white/30")}
                    >
                      <Heart className={"w-4 h-4 " + (isFavorite ? "fill-current" : "")} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(index) }}
                      className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); sharePhoto(asset) }}
                      className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadSingle(asset) }}
                      className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {/* Telegram Link Modal */}
      {showTelegramModal && (
        <TelegramLinkModal
          linkCode={telegramLinkCode}
          onClose={() => setShowTelegramModal(false)}
        />
      )}

      {/* Share Modal */}
      {shareModalAsset && (
        <ShareModal
          asset={shareModalAsset}
          onClose={() => setShareModalAsset(null)}
          personaName={personaName}
        />
      )}
    </div>
  )
}
