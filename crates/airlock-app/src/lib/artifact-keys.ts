export interface CodeComment {
  file: string;
  line: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export function getCommentKey(c: CodeComment): string {
  return `${c.file}:${c.line}:${c.severity}:${c.message}`;
}

/**
 * Derive a unique patch ID from an artifact file path.
 * Uses the full path so patches with the same filename in different
 * directories don't collide.
 */
export function getPatchId(artifactPath: string): string {
  return artifactPath;
}
