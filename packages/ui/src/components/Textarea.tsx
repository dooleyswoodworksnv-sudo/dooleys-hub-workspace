import React from 'react';
import { cn } from '../utils/cn';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full bg-bg-primary border border-border text-text-primary text-sm px-3 py-2',
          'rounded-lg outline-none transition-colors duration-200 resize-none min-h-[80px]',
          'placeholder:text-text-faint',
          'hover:border-border-hover',
          'focus:border-border-focus focus:ring-1 focus:ring-border-focus/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
