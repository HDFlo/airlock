import type { FeedEvent } from './types';
import { StepItem } from './StepItem';
import { ArtifactItem } from './ArtifactItem';

interface FeedItemProps {
  event: FeedEvent;
  onStepClick?: () => void;
}

export function FeedItem({ event, onStepClick }: FeedItemProps) {
  switch (event.type) {
    case 'step-running':
    case 'step-completed':
    case 'step-awaiting':
      return <StepItem event={event} onClick={onStepClick} />;
    case 'artifact':
      return <ArtifactItem event={event} />;
  }
}
