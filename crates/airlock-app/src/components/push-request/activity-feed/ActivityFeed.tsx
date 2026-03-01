import { useMemo } from 'react';
import type { ArtifactInfo } from '@/hooks/use-daemon';
import { buildFeed } from './build-feed';
import { ArtifactItem } from './ArtifactItem';

interface ActivityFeedProps {
  artifacts: ArtifactInfo[];
  selectedComments: Set<string>;
  onToggleComment: (key: string) => void;
  selectedPatches: Set<string>;
  onTogglePatch: (id: string) => void;
}

export function ActivityFeed({
  artifacts,
  selectedComments,
  onToggleComment,
  selectedPatches,
  onTogglePatch,
}: ActivityFeedProps) {
  const events = useMemo(() => buildFeed([], artifacts), [artifacts]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-foreground-muted">No artifacts yet</p>
      </div>
    );
  }

  return (
    <div className="divide-border-subtle divide-y">
      {events.map((event) => {
        if (event.type !== 'artifact') return null;
        return (
          <ArtifactItem
            key={event.key}
            event={event}
            selectedComments={selectedComments}
            onToggleComment={onToggleComment}
            selectedPatches={selectedPatches}
            onTogglePatch={onTogglePatch}
          />
        );
      })}
    </div>
  );
}
