import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  CARD_HALF_HEIGHT,
  CARD_HALF_WIDTH,
  isLocked,
  toWorld,
  type Board,
  type Card,
  type LegalPlacement,
  type Suit,
  type Surface,
} from '@staccs/shared';
import { Cube, type Glow } from './Cube';
import { hexPolygon } from './cubeGeometry';

/**
 * The table, drawn as SVG in world units. It frames whatever is in play (the STACC plus any spots
 * the selected card could go), shows the table's edge when it is near, and can be zoomed and dragged.
 */

export interface Preview {
  card: Card;
  placement: LegalPlacement;
  calledSuit: Suit | null;
}

interface Props {
  board: Board;
  blockedTops: number[];
  /** Where the selected card could go. */
  spots: LegalPlacement[];
  preview: Preview | null;
  /** The cards just played, to mark them for a moment. */
  fresh: number[];
  onPickSpot: (spot: LegalPlacement) => void;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const PAD = 1.4;
const MIN_SPAN = 5.5;
/** How close (in card edges) a tap must land to a spot's centre to pick it. */
const TAP_RADIUS = 0.95;
const ZOOM_STEP = 1.35;

function spotKey(s: { pos: { a: number; b: number }; stack: number }): string {
  return `${s.pos.a},${s.pos.b},${s.stack}`;
}

function fitBox(board: Board, spots: LegalPlacement[]): Box {
  const points = [...board.placed.map((p) => p.pos), ...spots.map((s) => s.pos)].map(toWorld);
  const box = points.reduce<Box>(
    (b, p) => ({
      minX: Math.min(b.minX, p.x - CARD_HALF_WIDTH),
      maxX: Math.max(b.maxX, p.x + CARD_HALF_WIDTH),
      minY: Math.min(b.minY, p.y - CARD_HALF_HEIGHT),
      maxY: Math.max(b.maxY, p.y + CARD_HALF_HEIGHT),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const halfW = Math.max(box.maxX - box.minX + PAD * 2, MIN_SPAN) / 2;
  const halfH = Math.max(box.maxY - box.minY + PAD * 2, MIN_SPAN) / 2;
  return { minX: cx - halfW, maxX: cx + halfW, minY: cy - halfH, maxY: cy + halfH };
}

/** Surfaces to light up on the cards underneath: where the previewed card lands, else every open spot. */
function glowsFor(spots: LegalPlacement[], preview: Preview | null): Map<number, Partial<Record<Surface, Glow>>> {
  const glows = new Map<number, Partial<Record<Surface, Glow>>>();
  const source = preview ? [preview.placement] : spots;
  const kind: Glow = preview ? 'touch' : 'open';
  for (const spot of source) {
    for (const touch of spot.touches) glows.set(touch.seq, { ...glows.get(touch.seq), [touch.surface]: kind });
  }
  return glows;
}

export function Table({ board, blockedTops, spots, preview, fresh, onPickSpot }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const fit = useMemo(() => fitBox(board, spots), [board, spots]);
  const glows = useMemo(() => glowsFor(spots, preview), [spots, preview]);
  const uniqueSpots = useMemo(() => {
    const seen = new Map<string, LegalPlacement>();
    for (const s of spots) if (!seen.has(spotKey(s))) seen.set(spotKey(s), s);
    return [...seen.values()];
  }, [spots]);

  const width = (fit.maxX - fit.minX) / zoom;
  const height = (fit.maxY - fit.minY) / zoom;
  const cx = (fit.minX + fit.maxX) / 2 + pan.x;
  const cy = (fit.minY + fit.maxY) / 2 + pan.y;
  const viewBox = `${cx - width / 2} ${cy - height / 2} ${width} ${height}`;

  function toSvgPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  }

  function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const start = drag.current;
    const svg = svgRef.current;
    if (!start || !svg || e.buttons === 0) return;
    const dxPx = e.clientX - start.x;
    const dyPx = e.clientY - start.y;
    if (!start.moved && Math.hypot(dxPx, dyPx) < 6) return;
    start.moved = true;
    // Screen pixels to world units: the SVG is scaled to fit, so use the larger ratio.
    const rect = svg.getBoundingClientRect();
    const scale = Math.max(width / rect.width, height / rect.height);
    setPan((p) => ({ x: p.x - dxPx * scale, y: p.y - dyPx * scale }));
    start.x = e.clientX;
    start.y = e.clientY;
  }

  function handlePointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const start = drag.current;
    drag.current = null;
    if (start?.moved) return;
    const at = toSvgPoint(e.clientX, e.clientY);
    if (!at) return;
    let best: LegalPlacement | null = null;
    let bestDistance = TAP_RADIUS;
    for (const spot of uniqueSpots) {
      const c = toWorld(spot.pos);
      const d = Math.hypot(c.x - at.x, c.y - at.y);
      if (d < bestDistance) {
        best = spot;
        bestDistance = d;
      }
    }
    if (best) onPickSpot(best);
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const { bounds } = board;
  const blocked = new Set(blockedTops);
  const freshSet = new Set(fresh);

  return (
    <div className="staccs-table">
      <svg
        ref={svgRef}
        className="staccs-table__svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => (drag.current = null)}
        role="img"
        aria-label={`The STACC: ${board.placed.length} cards`}
      >
        <rect
          className="staccs-table__edge"
          x={bounds.minX}
          y={bounds.minY}
          width={bounds.maxX - bounds.minX}
          height={bounds.maxY - bounds.minY}
        />

        {board.placed.map((p) => (
          <g key={p.card.id} className={freshSet.has(p.seq) ? 'staccs-fresh' : undefined}>
            <Cube
              card={p.card}
              center={toWorld(p.pos)}
              orient={p.orient}
              calledSuit={p.calledSuit}
              locked={isLocked(board, p.seq)}
              blockedTop={blocked.has(p.seq)}
              glow={glows.get(p.seq)}
            />
          </g>
        ))}

        {!preview &&
          uniqueSpots.map((spot) => (
            <polygon key={spotKey(spot)} points={hexPolygon(toWorld(spot.pos))} className="staccs-spot" />
          ))}

        {preview && (
          <Cube
            card={preview.card}
            center={toWorld(preview.placement.pos)}
            orient={preview.placement.orient}
            calledSuit={preview.calledSuit}
            ghost
          />
        )}
      </svg>

      <div className="staccs-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => setZoom((z) => Math.min(z * ZOOM_STEP, 6))} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(z / ZOOM_STEP, 0.25))} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={resetView} aria-label="Fit the STACC">
          ⤢
        </button>
      </div>
    </div>
  );
}
