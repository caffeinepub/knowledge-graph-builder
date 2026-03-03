import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface TooltipIconProps {
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function TooltipIcon({ content, side = 'right', align = 'start', className }: TooltipIconProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0 ${className ?? ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="max-w-xs text-xs font-mono leading-relaxed z-50"
          style={{
            backgroundColor: 'oklch(0.12 0.01 255)',
            border: '1px solid oklch(0.82 0.19 195 / 0.3)',
            color: 'oklch(0.85 0.01 240)',
            boxShadow: '0 0 16px oklch(0.82 0.19 195 / 0.1)',
          }}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
