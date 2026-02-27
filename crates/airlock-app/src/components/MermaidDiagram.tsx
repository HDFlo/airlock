import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

let initialized = false;
const COLOR_FOREGROUND = 'hsl(var(--foreground))';
const COLOR_FOREGROUND_MUTED = 'hsl(var(--foreground-muted))';
const COLOR_BORDER = 'hsl(var(--border))';

function ensureInit() {
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      securityLevel: 'strict',
      flowchart: { useMaxWidth: false, htmlLabels: true, padding: 20 },
      themeVariables: {
        // Node defaults
        primaryColor: 'transparent',
        primaryTextColor: COLOR_FOREGROUND,
        primaryBorderColor: COLOR_FOREGROUND_MUTED,
        // Lines & edges
        lineColor: COLOR_FOREGROUND_MUTED,
        edgeLabelBackground: 'transparent',
        // Secondary / tertiary
        secondaryColor: 'transparent',
        secondaryTextColor: COLOR_FOREGROUND,
        secondaryBorderColor: COLOR_FOREGROUND_MUTED,
        tertiaryColor: 'transparent',
        tertiaryTextColor: COLOR_FOREGROUND,
        tertiaryBorderColor: COLOR_FOREGROUND_MUTED,
        // Text
        textColor: COLOR_FOREGROUND,
        // Subgraph
        clusterBkg: 'transparent',
        clusterBorder: COLOR_BORDER,
        // Font
        fontSize: '14px',
      },
      themeCSS: `
        /* Transparent edge label backgrounds */
        .labelBkg { background-color: transparent !important; }
        .edgeLabel { background-color: transparent !important; }
        .edgeLabel span { color: ${COLOR_FOREGROUND_MUTED} !important; font-size: 12px !important; }
        /* Node text */
        .nodeLabel { color: ${COLOR_FOREGROUND} !important; }
        /* Edge paths */
        .flowchart-link { stroke: ${COLOR_BORDER} !important; }
        /* Arrowheads */
        marker[id^="flowchart-"] path { fill: ${COLOR_FOREGROUND_MUTED} !important; stroke: ${COLOR_FOREGROUND_MUTED} !important; }
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
    ensureInit();
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
      <TransformWrapper initialScale={fitScale} minScale={0.1} maxScale={4} centerOnInit wheel={{ step: 0.1 }}>
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
