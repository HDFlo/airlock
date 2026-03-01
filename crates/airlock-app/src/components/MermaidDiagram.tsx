import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

let initialized = false;

/** Resolve a CSS custom property to an hsl() color string for mermaid (which cannot parse CSS var()). */
function resolveColor(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  // eslint-disable-next-line design-tokens/no-raw-colors -- intentionally resolving design tokens for mermaid
  return value ? `hsl(${value})` : '#888';
}

function ensureInit() {
  if (!initialized) {
    const foreground = resolveColor('--foreground');
    const foregroundMuted = resolveColor('--foreground-muted');
    const border = resolveColor('--border');

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      securityLevel: 'strict',
      flowchart: { useMaxWidth: false, htmlLabels: true, padding: 20 },
      themeVariables: {
        // Node defaults
        primaryColor: 'transparent',
        primaryTextColor: foreground,
        primaryBorderColor: foregroundMuted,
        // Lines & edges
        lineColor: foregroundMuted,
        edgeLabelBackground: 'transparent',
        // Secondary / tertiary
        secondaryColor: 'transparent',
        secondaryTextColor: foreground,
        secondaryBorderColor: foregroundMuted,
        tertiaryColor: 'transparent',
        tertiaryTextColor: foreground,
        tertiaryBorderColor: foregroundMuted,
        // Text
        textColor: foreground,
        // Subgraph
        clusterBkg: 'transparent',
        clusterBorder: border,
        // Font
        fontSize: '14px',
      },
      themeCSS: `
        /* Transparent edge label backgrounds */
        .labelBkg { background-color: transparent !important; }
        .edgeLabel { background-color: transparent !important; }
        .edgeLabel span { color: ${foregroundMuted} !important; font-size: 12px !important; }
        /* Node text */
        .nodeLabel { color: ${foreground} !important; }
        /* Edge paths */
        .flowchart-link { stroke: ${border} !important; }
        /* Arrowheads */
        marker[id^="flowchart-"] path { fill: ${foregroundMuted} !important; stroke: ${foregroundMuted} !important; }
      `,
    });
    initialized = true;
  }
}

let counter = 0;

const MAX_HEIGHT = 600;

function Controls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      <button
        onClick={() => zoomIn()}
        className="bg-surface hover:bg-surface-elevated border-border-subtle rounded border p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
        title="Zoom in"
      >
        <ZoomIn className="text-foreground-muted h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => zoomOut()}
        className="bg-surface hover:bg-surface-elevated border-border-subtle rounded border p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
        title="Zoom out"
      >
        <ZoomOut className="text-foreground-muted h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => resetTransform()}
        className="bg-surface hover:bg-surface-elevated border-border-subtle rounded border p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
        title="Reset"
      >
        <Maximize className="text-foreground-muted h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Extract width/height from the rendered SVG string. */
function parseSvgDimensions(svg: string): { width: number; height: number } | null {
  const wMatch = svg.match(/(?:width=")([\d.]+)"/);
  const hMatch = svg.match(/(?:height=")([\d.]+)"/);
  if (wMatch && hMatch) {
    return { width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
  }
  return null;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    try {
      ensureInit();
    } catch (err) {
      setError(String(err));
      return;
    }

    const id = `mermaid-${++counter}`;

    let cancelled = false;
    mermaid
      .render(id, chart.trim())
      .then(({ svg }) => {
        if (!cancelled) {
          setSvgContent(svg);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <pre className="bg-terminal text-terminal-foreground overflow-auto rounded-md p-4">
        <code>{chart}</code>
      </pre>
    );
  }

  if (!svgContent) {
    return null;
  }

  return <DiagramViewer svgContent={svgContent} />;
}

/** Renders the SVG inside a zoom/pan container, scaled to fit on first mount. */
function DiagramViewer({ svgContent }: { svgContent: string }) {
  const [containerWidth, setContainerWidth] = useState<number>(() => window.innerWidth);

  useEffect(() => {
    const handleResize = () => setContainerWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fitScale = useMemo(() => {
    const dims = parseSvgDimensions(svgContent);
    if (!dims) {
      return 1;
    }
    const pad = 32;
    const scaleX = (containerWidth - pad) / dims.width;
    const scaleY = MAX_HEIGHT / dims.height;
    return Math.min(scaleX, scaleY, 1);
  }, [svgContent, containerWidth]);

  return (
    <div className="border-border-subtle group relative my-4 overflow-hidden rounded-lg border">
      <TransformWrapper initialScale={fitScale} minScale={0.1} maxScale={4} centerOnInit wheel={{ disabled: true }}>
        <Controls />
        <TransformComponent
          wrapperStyle={{ width: '100%', height: `${MAX_HEIGHT}px` }}
          contentStyle={{ display: 'flex', justifyContent: 'center' }}
        >
          <div dangerouslySetInnerHTML={{ __html: svgContent }} />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
