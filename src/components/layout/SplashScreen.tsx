import { useState, useEffect } from 'react'
import { cn } from '@/utils/cn'

interface SplashScreenProps {
  onFinish?: () => void
  duration?: number
}

export function SplashScreen({ onFinish, duration = 2400 }: SplashScreenProps) {
  const [isFading, setIsFading] = useState(false)
  const [isMounted, setIsMounted] = useState(true)

  // Staggered animation triggers
  const [showLogo, setShowLogo] = useState(false)
  const [showBrand, setShowBrand] = useState(false)
  const [showTagline, setShowTagline] = useState(false)

  useEffect(() => {
    // Stage 1: Reveal logo immediately
    const t0 = setTimeout(() => setShowLogo(true), 150)
    // Stage 2: Reveal brand name typography
    const t1 = setTimeout(() => setShowBrand(true), 500)
    // Stage 3: Reveal caption
    const t2 = setTimeout(() => setShowTagline(true), 800)

    // Fade out stage
    const fadeTimer = setTimeout(() => {
      setIsFading(true)
    }, Math.max(duration - 450, 1500))

    // Unmount and hand off to main application
    const finishTimer = setTimeout(() => {
      setIsMounted(false)
      onFinish?.()
    }, duration)

    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(fadeTimer)
      clearTimeout(finishTimer)
    }
  }, [duration, onFinish])

  if (!isMounted) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to ReliefLink"
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-between',
        'bg-[#071426] text-white px-6 py-10 select-none overflow-hidden',
        'transition-opacity duration-500 ease-out',
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100',
      )}
    >
      {/* ── Background: Connecting Lines & Teal Glow Effect ─────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Central ambient glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[460px] h-[340px] sm:h-[460px] rounded-full blur-[120px] animate-splash-glow"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,197,0.22) 0%, rgba(255,190,85,0.09) 45%, transparent 75%)',
          }}
        />

        {/* Geometric connecting lines representing the supply grid */}
        <svg
          className="absolute inset-0 w-full h-full opacity-15 stroke-[#22D3C5]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="grid-fade" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3C5" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#22D3C5" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#22D3C5" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g stroke="url(#grid-fade)" strokeWidth="1" fill="none">
            <line x1="15%" y1="20%" x2="50%" y2="40%" strokeDasharray="4 4" />
            <line x1="85%" y1="25%" x2="50%" y2="40%" strokeDasharray="4 4" />
            <line x1="20%" y1="75%" x2="50%" y2="58%" strokeDasharray="4 4" />
            <line x1="80%" y1="70%" x2="50%" y2="58%" strokeDasharray="4 4" />
          </g>
          {/* Subtle node coordinates */}
          <circle cx="15%" cy="20%" r="2" fill="#22D3C5" opacity="0.6" />
          <circle cx="85%" cy="25%" r="2" fill="#FFBE55" opacity="0.6" />
          <circle cx="20%" cy="75%" r="2" fill="#FFBE55" opacity="0.6" />
          <circle cx="80%" cy="70%" r="2" fill="#22D3C5" opacity="0.6" />
        </svg>
      </div>

      {/* ── Top bar with subtle Skip action ──────────────────────────────── */}
      <div className="w-full flex justify-end items-center pt-safe z-10">
        <button
          type="button"
          onClick={() => {
            setIsFading(true)
            setTimeout(() => {
              setIsMounted(false)
              onFinish?.()
            }, 250)
          }}
          className="text-[12px] font-medium tracking-wide text-white/40 hover:text-white/80 active:text-white transition-colors px-2.5 py-1 rounded focus:outline-none focus:ring-1 focus:ring-[#22D3C5]"
        >
          Skip
        </button>
      </div>

      {/* ── Main Center Branding Content ─────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm mx-auto my-auto w-full px-4">
        {/* 1. Official Logo (Single Logo Asset) */}
        <div
          className={cn(
            'relative mb-4 transition-all duration-700 ease-out transform',
            showLogo
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 translate-y-3',
          )}
        >
          {/* Subtle logo backing glow */}
          <div
            className="absolute -inset-3 bg-[#22D3C5]/20 rounded-3xl blur-xl"
            aria-hidden="true"
          />
          <img
            src="/icons/logo-mark.png"
            alt="ReliefLink Logo"
            className="relative w-28 sm:w-32 h-auto object-contain drop-shadow-[0_10px_28px_rgba(34,211,197,0.35)]"
          />
        </div>

        {/* 2. One ReliefLink Brand Name Typography */}
        <div
          className={cn(
            'transition-all duration-700 ease-out transform',
            showBrand
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3',
          )}
        >
          <h1 className="text-[32px] sm:text-[36px] font-bold tracking-tight flex items-center justify-center leading-tight">
            <span className="text-white">Relief</span>
            <span className="text-[#22D3C5]">Link</span>
          </h1>
        </div>

        {/* 3. One Caption Only */}
        <div
          className={cn(
            'mt-2.5 transition-all duration-700 ease-out transform',
            showTagline
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3',
          )}
        >
          <p className="text-[13px] sm:text-[14px] font-semibold text-[#FFBE55] tracking-widest uppercase">
            Connecting help. Delivering hope.
          </p>
        </div>
      </div>

      {/* ── Bottom Section: Premium Refined Teal Loading Indicator ─────── */}
      <div className="relative z-10 w-full flex flex-col items-center gap-3 pb-safe">
        {/* Modern pulsed network dots indicator (refined SaaS aesthetic) */}
        <div
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-pill bg-[#071426]/60 border border-white/5 backdrop-blur-sm"
          role="status"
          aria-label="Initializing humanitarian supply grid"
        >
          <span className="w-2 h-2 rounded-full bg-[#22D3C5] shadow-[0_0_8px_#22D3C5] animate-pulse-dot-1" />
          <span className="w-2 h-2 rounded-full bg-[#22D3C5] shadow-[0_0_8px_#22D3C5] animate-pulse-dot-2" />
          <span className="w-2 h-2 rounded-full bg-[#FFBE55] shadow-[0_0_8px_#FFBE55] animate-pulse-dot-3" />
        </div>

        {/* Grid Label */}
        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.2em]">
          Rapid Humanitarian Grid
        </span>
      </div>
    </div>
  )
}
