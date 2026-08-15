import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-1',
        'text-sm text-fg placeholder:text-fg-muted/70',
        // Focus is drawn by the global :focus-visible ring only — adding a
        // border colour on top of it reads as a double outline.
        'transition-colors hover:border-border-strong',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }
