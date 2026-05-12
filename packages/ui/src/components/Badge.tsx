import React from 'react';
import { cn } from '../utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'gold' | 'info';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-white/5 text-text-muted border-border',
  success: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  danger: 'bg-accent-danger/10 text-accent-danger border-accent-danger/30',
  gold: 'bg-accent-gold/10 text-accent-gold border-accent-gold/30',
  info: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5',
          'text-[10px] font-bold uppercase tracking-widest',
          'border rounded-sm',
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
