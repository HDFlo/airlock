import type { StepResultInfo, ArtifactInfo } from '@/hooks/use-daemon';

export type ArtifactCategory = 'content' | 'patch' | 'comment';

export type FeedEvent =
  | { type: 'step-running'; step: StepResultInfo; timestamp: number; key: string }
  | { type: 'step-completed'; step: StepResultInfo; timestamp: number; key: string }
  | { type: 'step-awaiting'; step: StepResultInfo; timestamp: number; key: string }
  | { type: 'artifact'; artifact: ArtifactInfo; category: ArtifactCategory; timestamp: number; key: string };
