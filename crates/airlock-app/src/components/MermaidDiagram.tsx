import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

let initialized = false;

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
        primaryTextColor: '#1B2236',
        primaryBorderColor: '#626D84',
        // Lines & edges
        lineColor: '#626D84',
        edgeLabelBackground: 'transparent',
        // Secondary / tertiary
        secondaryColor: 'transparent',
        secondaryTextColor: '#1B2236',
        secondaryBorderColor: '#626D84',
        tertiaryColor: 'transparent',
        tertiaryTextColor: '#1B2236',
        tertiaryBorderColor: '#626D84',
        // Text
        textColor: '#1B2236',
        // Subgraph
        clusterBkg: 'transparent',
        clusterBorder: '#C0C5CF',
        // Font
        fontSize: '14px',
      },
      themeCSS: `
        /* Transparent edge label backgrounds */
        .labelBkg { background-color: transparent !important; }
        .edgeLabel { background-color: transparent !important; }
        .edgeLabel span { color: #626D84 !important; font-size: 12px !important; }
        /* Node text */
        .nodeLabel { color: #1B2236 !important; }
        /* Edge paths */
        .flowchart-link { stroke: #C0C5CF !important; }
        /* Arrowheads */
        marker[id^="flowchart-"] path { fill: #626D84 !important; stroke: #626D84 !important; }
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const containerWidth = el.clientWidth;
    const dims = parseSvgDimensions(svgContent);
    if (!dims) {
      setFitScale(1);
      return;
    }
    const pad = 32;
    const scaleX = (containerWidth - pad) / dims.width;
    const scaleY = MAX_HEIGHT / dims.height;
    setFitScale(Math.min(scaleX, scaleY, 1));
  }, [svgContent]);

  return (
    <div ref={containerRef} className="border-border-subtle group relative my-4 overflow-hidden rounded-lg border">
      {fitScale !== null && (
        <TransformWrapper initialScale={fitScale} minScale={0.1} maxScale={4} centerOnInit wheel={{ step: 0.1 }}>
          <Controls />
          <TransformComponent
            wrapperStyle={{ width: '100%', height: `${MAX_HEIGHT}px` }}
            contentStyle={{ display: 'flex', justifyContent: 'center' }}
          >
            <div dangerouslySetInnerHTML={{ __html: svgContent }} />
          </TransformComponent>
        </TransformWrapper>
      )}
    </div>
  );
}
