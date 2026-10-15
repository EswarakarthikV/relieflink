import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  as?: 'div' | 'article' | 'section' | 'li'
  noPadding?: boolean
  interactive?: boolean
}

export function Card({
  children,
  as: Tag = 'div' as any,
  noPadding = false,
  interactive = false,
  className,
  ...rest
}: CardProps) {
  const Component = Tag as any
  return (
    <Component
      className={cn(
        'bg-surface rounded-card border border-slate-200/80 shadow-card',
        !noPadding && 'p-4',
        interactive && 'transition-transform active:scale-[0.99] cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  )
}

// ── Card sub-components ───────────────────────────────────────────────────

export function CardHeader({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-start justify-between', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardBody({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-1.5', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between pt-3 mt-3',
        'border-t border-slate-100',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3',
        className,
      )}
    >
      <div className="skeleton h-4 w-1/3 rounded" />
      <div className="skeleton h-6 w-3/4 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
      <div className="skeleton h-2 w-full rounded-full mt-4" />
    </div>
  )
}
