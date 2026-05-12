import React from 'react';
import { cn } from '../utils/cn';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  isExpanded,
  onToggle,
  action,
  className,
}: SectionHeaderProps) {
  const isCollapsible = onToggle !== undefined;

  return (
    <div
      className={cn(
        'border-b border-border pb-4 mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4',
        isCollapsible && 'cursor-pointer hover:bg-white/5 transition-colors p-2 -mx-2 rounded',
        className
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {isCollapsible && (
          <div className="text-accent-blue mt-1.5">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-text-muted mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {action && isExpanded !== false && (
        <div onClick={(e) => e.stopPropagation()}>{action}</div>
      )}
    </div>
  );
}
