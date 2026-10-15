import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  isLoading?: boolean
  leftIcon?:  ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm',
  secondary:
    'bg-surface border-2 border-navy-900 hover:bg-slate-50 active:bg-slate-100 text-navy-900',
  danger:
    'bg-danger hover:bg-red-700 active:bg-red-800 text-white',
  ghost:
    'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-navy-900',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-h4 gap-1.5',
  md: 'h-12 px-5 text-h4 gap-2',
  lg: 'h-14 px-6 text-body gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant   = 'primary',
      size      = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className,
      disabled,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          // Base
          'inline-flex items-center justify-center rounded-input font-semibold',
          'transition-colors focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-brand-600 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          'min-h-touch',
          // Variant & size
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          fullWidth && 'w-full',
          className,
        )}
        {...rest}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : leftIcon}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'
