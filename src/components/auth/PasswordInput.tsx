'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  dark?: boolean
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, dark, ...props }, ref) => {
    const [show, setShow] = useState(false)
    return (
      <div className="relative">
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={cn(className, 'pr-12')}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
          className={cn(
            'absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors',
            dark
              ? 'text-white/40 hover:text-white/70'
              : 'text-ink-soft2/60 hover:text-ink-soft',
          )}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
