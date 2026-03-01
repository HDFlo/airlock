import type { ArtifactInfo } from '@/hooks/use-daemon';
import { ActivityFeed } from './activity-feed';

interface OverviewTabProps {
  artifacts: ArtifactInfo[];
  runId: string;
  onPatchApplied?: () => void;
}

export function OverviewTab({ artifacts, runId, onPatchApplied }: OverviewTabProps) {
  return (
    <div className="h-full overflow-y-auto">
      <ActivityFeed artifacts={artifacts} runId={runId} onPatchApplied={onPatchApplied} />
    </div>
  );
}
