'use client'

import React from 'react'

interface AnimatedLogoProps {
  size?: number
  className?: string
  showBackground?: boolean
}

export function AnimatedLogo({
  size = 200,
  className = '',
  showBackground = true
}: AnimatedLogoProps) {
  return (
    <div
      className={`pinglass-logo-wrapper ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        className="pinglass-logo"
      >
        <defs>
          {/* Neon pink glow filter for glasses */}
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Stronger glow for halo */}
          <filter id="haloGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Gradient for glasses lenses */}
          <radialGradient id="lensGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF1493" stopOpacity="0.3"/>
            <stop offset="70%" stopColor="#FF1493" stopOpacity="0.1"/>
            <stop offset="100%" stopColor="#FF1493" stopOpacity="0.05"/>
          </radialGradient>

          {/* Gradient for halo ring */}
          <linearGradient id="haloGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF1493" stopOpacity="0.8"/>
            <stop offset="50%" stopColor="#FF69B4" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#FF1493" stopOpacity="0.8"/>
          </linearGradient>

          {/* Background gradient */}
          <radialGradient id="bgGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A0004F"/>
            <stop offset="100%" stopColor="#8B0040"/>
          </radialGradient>
        </defs>

        {/* Background circle */}
        {showBackground && (
          <circle
            cx="100"
            cy="100"
            r="98"
            fill="url(#bgGradient)"
            stroke="#FF1493"
            strokeWidth="1"
            strokeOpacity="0.3"
          />
        )}

        {/* Halo ring around head */}
        <ellipse
          cx="100"
          cy="60"
          rx="55"
          ry="18"
          fill="none"
          stroke="url(#haloGradient)"
          strokeWidth="3"
          filter="url(#haloGlow)"
          className="pinglass-halo"
        />

        {/* Hood/jacket silhouette */}
        <path
          d="M50 180
             Q50 140 60 120
             Q70 100 80 95
             Q90 90 100 90
             Q110 90 120 95
             Q130 100 140 120
             Q150 140 150 180
             Z"
          fill="#2D1025"
          className="pinglass-hood"
        />

        {/* Hood inner shadow */}
        <path
          d="M60 180
             Q60 145 70 125
             Q80 108 90 102
             Q95 100 100 100
             Q105 100 110 102
             Q120 108 130 125
             Q140 145 140 180
             Z"
          fill="#1A0A15"
        />

        {/* Head/face silhouette */}
        <ellipse
          cx="100"
          cy="95"
          rx="32"
          ry="40"
          fill="#3D1530"
        />

        {/* Face highlight */}
        <ellipse
          cx="100"
          cy="92"
          rx="28"
          ry="35"
          fill="#4D2040"
        />

        {/* Left glasses lens - outer glow ring */}
        <circle
          cx="78"
          cy="90"
          r="20"
          fill="none"
          stroke="#FF1493"
          strokeWidth="3"
          filter="url(#neonGlow)"
          className="pinglass-lens-glow"
        />

        {/* Left glasses lens - inner */}
        <circle
          cx="78"
          cy="90"
          r="18"
          fill="url(#lensGradient)"
          stroke="#FF69B4"
          strokeWidth="1.5"
        />

        {/* Right glasses lens - outer glow ring */}
        <circle
          cx="122"
          cy="90"
          r="20"
          fill="none"
          stroke="#FF1493"
          strokeWidth="3"
          filter="url(#neonGlow)"
          className="pinglass-lens-glow"
        />

        {/* Right glasses lens - inner */}
        <circle
          cx="122"
          cy="90"
          r="18"
          fill="url(#lensGradient)"
          stroke="#FF69B4"
          strokeWidth="1.5"
        />

        {/* Glasses bridge */}
        <path
          d="M96 90 Q100 86 104 90"
          fill="none"
          stroke="#FF1493"
          strokeWidth="2"
          filter="url(#neonGlow)"
          className="pinglass-lens-glow"
        />

        {/* Left lens shine/reflection line */}
        <line
          x1="65"
          y1="87"
          x2="91"
          y2="93"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
          className="pinglass-shine"
        />

        {/* Right lens shine/reflection line */}
        <line
          x1="109"
          y1="87"
          x2="135"
          y2="93"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
          className="pinglass-shine"
        />

        {/* Additional small highlight dots */}
        <circle cx="70" cy="85" r="2" fill="#FFFFFF" opacity="0.4" className="pinglass-dot"/>
        <circle cx="114" cy="85" r="2" fill="#FFFFFF" opacity="0.4" className="pinglass-dot"/>
      </svg>
    </div>
  )
}

// Compact version for favicon/small displays
export function AnimatedLogoCompact({
  size = 32,
  className = ''
}: Omit<AnimatedLogoProps, 'showBackground'>) {
  return (
    <div
      className={`pinglass-logo-wrapper ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        className="pinglass-logo-compact"
      >
        <defs>
          <filter id="neonGlowCompact" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <radialGradient id="bgGradientCompact" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D42A7D"/>
            <stop offset="100%" stopColor="#B51A65"/>
          </radialGradient>

          <radialGradient id="lensGlowCompact" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FF69B4" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#FF1493" stopOpacity="0.1"/>
          </radialGradient>
        </defs>

        {/* Background */}
        <circle cx="100" cy="100" r="98" fill="url(#bgGradientCompact)"/>

        {/* Lens fills for depth */}
        <circle cx="72" cy="100" r="26" fill="url(#lensGlowCompact)" opacity="0.6"/>
        <circle cx="128" cy="100" r="26" fill="url(#lensGlowCompact)" opacity="0.6"/>

        {/* Glasses frames - brighter pink */}
        <circle
          cx="72"
          cy="100"
          r="28"
          fill="none"
          stroke="#FF69B4"
          strokeWidth="5"
          filter="url(#neonGlowCompact)"
          className="pinglass-lens-glow"
        />
        <circle
          cx="128"
          cy="100"
          r="28"
          fill="none"
          stroke="#FF69B4"
          strokeWidth="5"
          filter="url(#neonGlowCompact)"
          className="pinglass-lens-glow"
        />

        {/* Inner ring detail */}
        <circle cx="72" cy="100" r="22" fill="none" stroke="#FFB6C1" strokeWidth="1" opacity="0.5"/>
        <circle cx="128" cy="100" r="22" fill="none" stroke="#FFB6C1" strokeWidth="1" opacity="0.5"/>

        {/* Lens highlights */}
        <ellipse cx="64" cy="92" rx="8" ry="5" fill="#FFFFFF" opacity="0.25"/>
        <ellipse cx="120" cy="92" rx="8" ry="5" fill="#FFFFFF" opacity="0.25"/>

        {/* Bridge */}
        <path
          d="M97 100 Q100 92 103 100"
          fill="none"
          stroke="#FF69B4"
          strokeWidth="4"
          filter="url(#neonGlowCompact)"
        />
      </svg>
    </div>
  )
}

export default AnimatedLogo
