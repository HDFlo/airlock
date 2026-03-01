import { useState } from 'react';
import { FileCode, FileText, MessageSquare, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react';
import { Button, ExpandableCard } from '@airlock-hq/design-system/react';
import { cn } from '@/lib/utils';
import { useArtifactLoader } from '@/components/StageLogViewer/hooks';
import { applyPatches } from '@/hooks/use-daemon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from '@/components/MermaidDiagram';
import type { FeedEvent, ArtifactCategory } from './types';

type ArtifactEvent = Extract<FeedEvent, { type: 'artifact' }>;

interface ArtifactItemProps {
  event: ArtifactEvent;
  runId: string;
  onPatchApplied?: () => void;
}

function getCategoryIcon(category: ArtifactCategory) {
  switch (category) {
    case 'patch':
      return <FileCode className="text-foreground-muted h-4 w-4 shrink-0" />;
    case 'comment':
      return <MessageSquare className="text-foreground-muted h-4 w-4 shrink-0" />;
    case 'content':
      return <FileText className="text-foreground-muted h-4 w-4 shrink-0" />;
  }
}

function getTitle(artifact: ArtifactEvent['artifact']): string {
  return artifact.name.replace(/\.(json|md)$/, '').replace(/[-_]/g, ' ');
}

export function ArtifactItem({ event, runId, onPatchApplied }: ArtifactItemProps) {
  const { category } = event;

  switch (category) {
    case 'patch':
      return <PatchArtifactItem event={event} runId={runId} onPatchApplied={onPatchApplied} />;
    case 'comment':
      return <CommentArtifactItem event={event} />;
    case 'content':
      return <ContentArtifactItem event={event} />;
  }
}

// ---------------------------------------------------------------------------
// Patch artifact — shows title + diff stats, expandable diff
// ---------------------------------------------------------------------------

function PatchArtifactItem({
  event,
  runId,
  onPatchApplied,
}: {
  event: ArtifactEvent;
  runId: string;
  onPatchApplied?: () => void;
}) {
  const isApplied = event.artifact.path.includes('/patches/applied/');
  const [expanded, setExpanded] = useState(!isApplied);
  const [applying, setApplying] = useState(false);
  const { content, loading } = useArtifactLoader(event.artifact.path, true);
  const parsed = content ? safeParse<{ title?: string; explanation?: string; diff?: string }>(content) : null;
  const title = parsed?.title || getTitle(event.artifact);
  const explanation = parsed?.explanation;
  const diff = parsed?.diff ?? '';

  const handleApply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setApplying(true);
    try {
      const result = await applyPatches(runId, [event.artifact.path]);
      if (result.success) {
        onPatchApplied?.();
      }
    } catch {
      // error is non-critical here; PatchesTab has full error handling
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <div
        className="hover:bg-surface/40 flex cursor-pointer items-center gap-3 px-4 py-2"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronUp className="text-foreground-muted h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="text-foreground-muted h-3.5 w-3.5 shrink-0" />
        )}
        {getCategoryIcon('patch')}
        <span className="text-small min-w-0 flex-1 truncate py-1">{title}</span>
        {explanation && (
          <span className="text-small text-foreground-muted hidden truncate sm:inline">{explanation}</span>
        )}
        {diff && <PatchStats diff={diff} />}
        {isApplied ? (
          <span className="text-success text-micro flex shrink-0 items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Applied
          </span>
        ) : (
          <Button
            variant="signal-outline"
            size="sm"
            className="text-micro shrink-0"
            disabled={applying}
            onClick={handleApply}
          >
            {applying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {applying ? 'Applying...' : 'Apply'}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="border-border-subtle mx-4 mb-4 overflow-hidden rounded border">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="text-foreground-muted h-4 w-4 animate-spin" />
            </div>
          ) : diff ? (
            <ExpandableCard>
              <DiffPreview diff={diff} />
            </ExpandableCard>
          ) : (
            <div className="text-small text-foreground-muted p-4">No diff content</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment artifact — inline severity-colored cards
// ---------------------------------------------------------------------------

interface CodeComment {
  file: string;
  line: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

function CommentArtifactItem({ event }: { event: ArtifactEvent }) {
  const [expanded, setExpanded] = useState(true);
  const { content, loading } = useArtifactLoader(event.artifact.path, true);

  const parsed = content ? safeParse<{ comments?: CodeComment[] }>(content) : null;
  const comments = parsed?.comments ?? [];

  return (
    <div>
      <div
        className="hover:bg-surface/40 flex cursor-pointer items-center gap-3 px-4 py-2"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronUp className="text-foreground-muted h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="text-foreground-muted h-3.5 w-3.5 shrink-0" />
        )}
        {getCategoryIcon('comment')}
        <span className="text-small min-w-0 flex-1 truncate py-1">
          Critique comments
          {comments.length > 0 && <span className="text-foreground-muted ml-1">({comments.length})</span>}
        </span>
      </div>

      {expanded && !loading && comments.length > 0 && (
        <div className="mx-4 mb-4 space-y-2">
          {comments.map((comment, i) => (
            <div
              key={i}
              className={cn(
                'text-small rounded border-l-2 px-3 py-2',
                comment.severity === 'error' && 'border-danger bg-danger/10',
                comment.severity === 'warning' && 'border-warning bg-warning/10',
                comment.severity === 'info' && 'border-signal bg-signal/10'
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 shrink-0" />
                <span className="font-semibold capitalize">{comment.severity}</span>
                <span className="text-micro text-foreground-muted truncate font-mono">
                  {comment.file}:{comment.line}
                </span>
              </div>
              <p className="mt-1">{comment.message}</p>
            </div>
          ))}
        </div>
      )}

      {expanded && loading && (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="text-foreground-muted h-4 w-4 animate-spin" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content artifact — markdown auto-expanded, shows title from frontmatter
// ---------------------------------------------------------------------------

function ContentArtifactItem({ event }: { event: ArtifactEvent }) {
  const isMarkdown = event.artifact.name.endsWith('.md');
  const [expanded, setExpanded] = useState(isMarkdown);
  // Always trigger loading for markdown (auto-expanded) so we can extract the title
  const { content, loading } = useArtifactLoader(event.artifact.path, isMarkdown || expanded);

  const title = content ? parseFrontmatterTitle(content) || getTitle(event.artifact) : getTitle(event.artifact);

  return (
    <div>
      <div
        className="hover:bg-surface/40 flex cursor-pointer items-center gap-3 px-4 py-2"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronUp className="text-foreground-muted h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="text-foreground-muted h-3.5 w-3.5 shrink-0" />
        )}
        {getCategoryIcon('content')}
        <span className="text-small min-w-0 flex-1 truncate py-1">{title}</span>
      </div>

      {expanded && (
        <div className="border-border-subtle mx-4 mb-4 overflow-hidden rounded border">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="text-foreground-muted h-4 w-4 animate-spin" />
            </div>
          ) : content ? (
            <ExpandableCard>
              <div className="prose prose-sm max-w-none p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {stripFrontmatter(content)}
                </ReactMarkdown>
              </div>
            </ExpandableCard>
          ) : (
            <div className="text-small text-foreground-muted p-4">No content</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

import type { Components } from 'react-markdown';

const markdownComponents: Components = {
  pre: ({ children, ...props }) => {
    const child = Array.isArray(children) ? children[0] : children;
    if (child && typeof child === 'object' && 'type' in child && child.type === MermaidDiagram) {
      return <>{children}</>;
    }
    return (
      <pre
        className={cn(
          'border-border-subtle bg-surface-elevated overflow-auto rounded-md border p-4',
          'text-foreground text-small font-mono',
          '[&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[length:inherit] [&_code]:text-inherit'
        )}
        {...props}
      >
        {children}
      </pre>
    );
  },
  code: ({ children, className, ...props }) => {
    if (className?.includes('language-mermaid')) {
      const chart = String(children).replace(/\n$/, '');
      return <MermaidDiagram chart={chart} />;
    }
    return (
      <code className={cn('bg-surface text-small rounded px-1.5 py-0.5', className)} {...props}>
        {children}
      </code>
    );
  },
};

function safeParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? content.slice(match[0].length) : content;
}

function parseFrontmatterTitle(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const titleMatch = match[1].match(/^title:\s*"?(.+?)"?$/m);
  return titleMatch ? titleMatch[1].trim() : null;
}

function PatchStats({ diff }: { diff: string }) {
  const lines = diff.split('\n');
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }

  return (
    <span className="text-small flex shrink-0 items-center gap-2 font-mono">
      <span className="text-success">+{additions}</span>
      <span className="text-danger">-{deletions}</span>
    </span>
  );
}

function DiffPreview({ diff }: { diff: string }) {
  const lines = diff.split('\n');

  return (
    <div className="text-micro font-mono">
      {lines.map((line, index) => {
        let className = 'px-4 py-0.5';
        if (line.startsWith('+') && !line.startsWith('+++')) {
          className += ' bg-success/10 text-success';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          className += ' bg-danger/10 text-danger';
        } else if (line.startsWith('@@')) {
          className += ' bg-signal/10 text-signal';
        } else if (line.startsWith('diff ') || line.startsWith('index ')) {
          className += ' text-foreground-muted';
        } else {
          className += ' text-foreground';
        }

        return (
          <div key={index} className={className}>
            <pre className="whitespace-pre-wrap">{line || ' '}</pre>
          </div>
        );
      })}
    </div>
  );
}
