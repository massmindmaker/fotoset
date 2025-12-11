"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Sparkles } from "lucide-react"

const DEMO_PHOTOS = [
  "/demo/Screenshot_1.png", "/demo/Screenshot_2.png", "/demo/Screenshot_3.png",
  "/demo/Screenshot_4.png", "/demo/Screenshot_5.png", "/demo/Screenshot_6.png",
  "/demo/Screenshot_7.png", "/demo/Screenshot_8.png", "/demo/Screenshot_9.png",
  "/demo/Screenshot_10.png", "/demo/Screenshot_11.png",
]

export interface OnboardingViewProps {
  onComplete: () => void
  onStart: () => void
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete, onStart }) => {
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
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent drop-shadow-lg">
              PINGLASS
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md text-lg text-center">
            Создавайте впечатляющие AI-фотографии
          </p>
        </div>
        <button
          onClick={handleStart}
          className={
            "w-full max-w-xs py-4 px-8 bg-gradient-to-r from-primary to-accent text-white font-semibold text-lg rounded-3xl hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-primary/25 " +
            (stage >= 4 ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")
          }
          style={{ transitionDelay: "200ms" }}
        >
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5" />
            Начать!
          </span>
        </button>
      </div>
    </div>
  )
}

export default OnboardingView
