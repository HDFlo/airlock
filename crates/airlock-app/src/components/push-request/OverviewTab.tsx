import type { ArtifactInfo } from '@/hooks/use-daemon';
import { ActivityFeed } from './activity-feed';

interface OverviewTabProps {
  artifacts: ArtifactInfo[];
  selectedComments: Set<string>;
  onToggleComment: (key: string) => void;
  selectedPatches: Set<string>;
  onTogglePatch: (id: string) => void;
}

export function OverviewTab({
  artifacts,
  selectedComments,
  onToggleComment,
  selectedPatches,
  onTogglePatch,
}: OverviewTabProps) {
  return (
    <div className="h-full overflow-y-auto">
      <ActivityFeed
        artifacts={artifacts}
        selectedComments={selectedComments}
        onToggleComment={onToggleComment}
        selectedPatches={selectedPatches}
        onTogglePatch={onTogglePatch}
      />
    </div>
  );
}
