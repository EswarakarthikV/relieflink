import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

// ── Text Input ─────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:      string
  error?:      string
  hint?:       string
  leftIcon?:   ReactNode
  rightIcon?:  ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-caption font-semibold text-ink"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-ink-muted pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              // Base — 48px height (h-12)
              'w-full h-12 rounded-input bg-surface-low',
              'border border-slate-300 px-3.5',
              'text-body text-ink placeholder:text-ink-muted',
              'transition-all',
              // Focus
              'focus:outline-none focus:bg-surface focus:border-brand-600',
              'focus:ring-2 focus:ring-brand-600/20',
              // Error
              error && 'border-danger focus:border-danger focus:ring-danger/20',
              // Icon padding
              leftIcon  && 'pl-10',
              rightIcon && 'pr-10',
              className,
            )}
            {...rest}
          />
          {rightIcon && (
            <span className="absolute right-3 text-ink-muted">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="text-caption text-danger">{error}</p>
        )}
        {hint && !error && (
          <p className="text-caption text-ink-muted">{hint}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'

// ── Textarea ──────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?:  string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-caption font-semibold text-ink">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-input bg-surface border border-slate-300 p-3.5',
            'text-body text-ink placeholder:text-ink-muted resize-none',
            'transition-all focus:outline-none focus:border-brand-600',
            'focus:ring-2 focus:ring-brand-600/20',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...rest}
        />
        {error && <p className="text-caption text-danger">{error}</p>}
        {hint && !error && <p className="text-caption text-ink-muted">{hint}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
