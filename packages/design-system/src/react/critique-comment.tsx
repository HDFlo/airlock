import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check } from 'lucide-react';

import { cn } from '../utils/cn';

const critiqueCommentVariants = cva('text-small rounded-sm border border-transparent border-l-2 px-3 py-2', {
  variants: {
    severity: {
      error: 'border-l-danger bg-danger/15',
      warning: 'border-l-warning bg-warning/15',
      info: 'border-l-foreground-muted/40 bg-foreground-muted/5',
    },
  },
});

export interface CritiqueCommentProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof critiqueCommentVariants> {
  /** The comment message body. */
  message: string;
  /** Optional file path shown as monospace metadata. */
  file?: string;
  /** Optional line number shown alongside `file`. */
  line?: number;
  /** Whether the comment is selected. */
  selected?: boolean;
  /** Callback when the comment selection is toggled. Renders a checkbox when provided. */
  onToggle?: () => void;
}

function CritiqueComment({
  severity,
  message,
  file,
  line,
  selected,
  onToggle,
  className,
  ...props
}: CritiqueCommentProps) {
  return (
    <div className={cn(critiqueCommentVariants({ severity }), className)} {...props}>
      <div className="flex items-center gap-2">
        {onToggle != null && (
          <div
            className={cn(
              'flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border',
              selected ? 'border-signal bg-signal text-background' : 'border-foreground-muted'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {selected && <Check className="h-2.5 w-2.5" />}
          </div>
        )}
        {file && (
          <span className="text-micro text-foreground-muted truncate font-mono">
            {file}
            {line != null && `:${line}`}
          </span>
        )}
      </div>
      <p className="mt-1">{message}</p>
    </div>
  );
}

export { CritiqueComment, critiqueCommentVariants };
