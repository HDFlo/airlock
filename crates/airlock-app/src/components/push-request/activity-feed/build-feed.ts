import type { StepResultInfo, ArtifactInfo } from '@/hooks/use-daemon';
import type { FeedEvent, ArtifactCategory } from './types';

export function classifyArtifact(artifact: ArtifactInfo): ArtifactCategory {
  if (artifact.path.includes('/patches/')) return 'patch';
  if (artifact.path.includes('/comments/')) return 'comment';
  return 'content';
}

export function buildFeed(steps: StepResultInfo[], artifacts: ArtifactInfo[]): FeedEvent[] {
  const events: FeedEvent[] = [];

  for (const step of steps) {
    if (step.status === 'pending') continue;

    if (step.status === 'running') {
      events.push({
        type: 'step-running',
        step,
        timestamp: step.started_at ?? 0,
        key: `running-${step.step}`,
      });
    } else if (step.status === 'awaiting_approval') {
      events.push({
        type: 'step-awaiting',
        step,
        timestamp: step.started_at ?? 0,
        key: `awaiting-${step.step}`,
      });
    } else {
      events.push({
        type: 'step-completed',
        step,
        timestamp: step.started_at ?? 0,
        key: `completed-${step.step}`,
      });
    }
  }

  for (const artifact of artifacts) {
    const category = classifyArtifact(artifact);
    // Only show markdown content in the feed; other content files are data objects
    if (category === 'content' && !artifact.name.endsWith('.md')) continue;

    events.push({
      type: 'artifact',
      artifact,
      category,
      timestamp: artifact.created_at,
      key: `artifact-${artifact.name}`,
    });
  }

  // Sort by timestamp; tie-break: artifacts before steps so they attach
  // to the preceding step rather than appearing after the next one
  events.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    if (a.type === 'artifact' && b.type !== 'artifact') return -1;
    if (a.type !== 'artifact' && b.type === 'artifact') return 1;
    return 0;
  });

  return events;
}
