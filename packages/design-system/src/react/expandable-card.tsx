import * as React from 'react';
import { ChevronsDown } from 'lucide-react';

import { cn } from '../utils/cn';

const DEFAULT_MAX_HEIGHT = 192; // 12rem

interface ExpandableCardProps {
  /** Maximum height in pixels before content is clamped. Defaults to 384. */
  maxHeight?: number;
  /** Label for the expand button. Defaults to "Show more". */
  expandLabel?: string;
  /** Additional class names for the outer container. */
  className?: string;
  children: React.ReactNode;
}

/**
 * A container that clamps its children to a max height and shows a
 * gradient fade with a "Show more" button when the content overflows.
 * Clicking the button reveals the full content.
 */
function ExpandableCard({
  maxHeight = DEFAULT_MAX_HEIGHT,
  expandLabel = 'Show more',
  className,
  children,
}: ExpandableCardProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [fullHeight, setFullHeight] = React.useState(false);
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  React.useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > maxHeight);
    }
  }, [children, maxHeight]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div ref={contentRef} className="overflow-hidden" style={!fullHeight ? { maxHeight } : undefined}>
        {children}
      </div>
      {isOverflowing && !fullHeight && (
        <div className="from-background/80 absolute right-0 bottom-0 left-0 flex justify-center bg-gradient-to-t pt-8 pb-2">
          <button
            className="bg-surface-elevated border-border-subtle text-foreground-muted hover:text-foreground flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 shadow-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setFullHeight(true);
            }}
          >
            <ChevronsDown className="h-3.5 w-3.5" />
            <span className="text-micro">{expandLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}

ExpandableCard.displayName = 'ExpandableCard';

export { ExpandableCard };
export type { ExpandableCardProps };
