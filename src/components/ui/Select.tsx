import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options?: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, children, className, id, value, ...rest }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const isPlaceholderActive = value === '' || value === undefined

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="text-caption font-semibold text-ink">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            value={value}
            className={cn(
              'w-full h-12 rounded-input bg-surface border border-slate-300 px-3.5 pr-10',
              'text-body appearance-none cursor-pointer',
              isPlaceholderActive ? 'text-ink-muted' : 'text-ink font-medium',
              'transition-all focus:outline-none focus:border-brand-600',
              'focus:ring-2 focus:ring-brand-600/20',
              error && 'border-danger focus:border-danger focus:ring-danger/20',
              className,
            )}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled className="text-ink-muted">
                {placeholder}
              </option>
            )}
            {options
              ? options.map(opt => (
                  <option key={opt.value} value={opt.value} className="text-ink">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 pointer-events-none" />
        </div>
        {error && <p className="text-caption text-danger">{error}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'
