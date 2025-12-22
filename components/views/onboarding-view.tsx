"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Sparkles } from "lucide-react"

const DEMO_PHOTOS = [
  "/optimized/demo/Screenshot_1.webp", "/optimized/demo/Screenshot_2.webp", "/optimized/demo/Screenshot_3.webp",
  "/optimized/demo/Screenshot_4.webp", "/optimized/demo/Screenshot_5.webp", "/optimized/demo/Screenshot_6.webp",
  "/optimized/demo/Screenshot_7.webp", "/optimized/demo/Screenshot_8.webp", "/optimized/demo/Screenshot_9.webp",
  "/optimized/demo/Screenshot_10.webp", "/optimized/demo/Screenshot_11.webp",
]

export interface OnboardingViewProps {
  onComplete: () => void
  onStart: () => void
  // FIX: Added auth status props to prevent race conditions
  isAuthPending?: boolean
  authError?: boolean
  // True if running inside Telegram WebApp
  isTelegramWebApp?: boolean
}

const TELEGRAM_BOT_URL = "https://t.me/Pinglass_bot/app"

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onComplete,
  onStart,
  isAuthPending = false,
  authError = false,
  isTelegramWebApp = false
}) => {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 100)
    const t2 = setTimeout(() => setStage(2), 1200)
    const t3 = setTimeout(() => setStage(3), 1800)
    const t4 = setTimeout(() => setStage(4), 2400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [])

  const handleStart = useCallback(() => {
    // Always proceed with normal flow (web and Telegram)
    onStart()
  }, [onStart])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden bg-gradient-mesh">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div
          className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-accent/10 blur-3xl animate-float"
          style={{ animationDelay: "-2s" }}
        />
      </div>
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
        <div className="relative w-full aspect-square max-w-md mb-8">
          <div
            className={
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-primary/20 blur-3xl transition-all duration-1000 " +
              (stage >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-50")
            }
          />
          <div
            className={
              "absolute top-1/2 left-1/2 w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden holographic-shine border-4 border-transparent animate-holographic-border shadow-2xl shadow-primary/30 " +
              (stage >= 1 ? "animate-main-image-enter" : "opacity-0")
            }
            style={stage < 1 ? { transform: "translate(-50%, -50%) scale(0.3)" } : undefined}
          >
            <img src={DEMO_PHOTOS[0]} alt="AI Portrait" className="w-full h-full object-cover" loading="eager" />
          </div>
          <div
            className={
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full " +
              (stage >= 2 ? "animate-orbit-ring-enter" : "opacity-0")
            }
          >
            <div
              className="absolute inset-0 animate-orbit-smooth"
              style={{ "--orbit-duration": "25s" } as React.CSSProperties}
            >
              {DEMO_PHOTOS.slice(1, 5).map((src, i) => {
                const angle = i * 90 + 45
                return (
                  <div
                    key={"inner-" + i}
                    className="absolute"
                    style={{ left: "50%", top: "50%", transform: `rotate(${angle}deg) translateX(115px)` }}
                  >
                    <div style={{ transform: `rotate(${-angle}deg)` }}>
                      <div
                        className={
                          "orbit-content w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-xl shadow-primary/20 -translate-x-1/2 -translate-y-1/2 " +
                          (i % 2 === 0 ? "neon-frame" : "neon-frame-alt")
                        }
                      >
                        <img src={src} alt={"Portrait " + i} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div
            className={
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full " +
              (stage >= 3 ? "animate-orbit-ring-enter" : "opacity-0")
            }
            style={{ animationDelay: "0.2s" }}
          >
            <div
              className="absolute inset-0 animate-orbit-smooth-reverse"
              style={{ "--orbit-duration": "35s" } as React.CSSProperties}
            >
              {DEMO_PHOTOS.slice(5, 11).map((src, i) => {
                const angle = i * 60 + 30
                return (
                  <div
                    key={"outer-" + i}
                    className="absolute"
                    style={{ left: "50%", top: "50%", transform: `rotate(${angle}deg) translateX(175px)` }}
                  >
                    <div style={{ transform: `rotate(${-angle}deg)` }}>
                      <div
                        className={
                          "orbit-content-reverse w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden shadow-lg shadow-accent/20 -translate-x-1/2 -translate-y-1/2 " +
                          (i % 2 === 1 ? "neon-frame-alt" : "neon-frame")
                        }
                      >
                        <img
                          src={src}
                          alt={"Portrait outer " + i}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div
          className={
            "flex flex-col items-center mb-8 transition-all duration-1000 " +
            (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
          }
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            <span className="text-gradient-pink-yellow drop-shadow-lg text-shadow-glow">
              PINGLASS
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md text-lg text-center">
            Создавайте впечатляющие AI-фотографии
          </p>
        </div>
        {isTelegramWebApp ? (
          // Inside Telegram WebApp - normal button
          <button
            onClick={handleStart}
            disabled={isAuthPending}
            className={
              "w-full max-w-xs btn-premium text-lg " +
              (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0") +
              (isAuthPending ? " opacity-70 cursor-wait" : "")
            }
            style={{ transitionDelay: "200ms" }}
          >
            <span className="flex items-center justify-center gap-2">
              {isAuthPending ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Авторизация...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Начать!
                </>
              )}
            </span>
          </button>
        ) : (
          // Web version - link to Telegram bot
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={
              "w-full max-w-xs btn-premium text-lg text-center " +
              (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
            }
            style={{ transitionDelay: "200ms" }}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Открыть в Telegram
            </span>
          </a>
        )}
      </div>
    </div>
  )
}

export default OnboardingView
