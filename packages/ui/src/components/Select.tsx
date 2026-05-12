import React from 'react';
import { cn } from '../utils/cn';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full bg-bg-primary border border-border text-text-primary text-sm px-3 py-2',
          'rounded-lg outline-none transition-colors duration-200 appearance-none',
          'bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat',
          'bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27%2394a3b8%27 viewBox=%270 0 16 16%27%3E%3Cpath d=%27M4.5 6l3.5 4 3.5-4z%27/%3E%3C/svg%3E")]',
          'pr-8 cursor-pointer',
          'hover:border-border-hover',
          'focus:border-border-focus focus:ring-1 focus:ring-border-focus/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
