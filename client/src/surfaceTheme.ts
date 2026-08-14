import { useEffect } from 'react';

/**
 * The colour behind everything, per screen.
 *
 * Two things need it and neither is reachable from a stylesheet scoped to a game. The browser's own
 * bars are tinted by <meta name="theme-color">, and the canvas behind the page - what you see when a
 * phone rubber-bands past the end of the document - comes from the root element, which sits outside
 * every game's own backdrop. Both were pinned to Sequence's green, so Bluff was framed in green
 * chrome and bounced against a green edge.
 *
 * Each value is the tone at the top of that screen's own gradient, so the bars blend into the page
 * rather than drawing a line across it.
 */
const SURFACE = {
  portal: '#14161c',
  sequence: '#0f3d2e',
  bluff: '#170f1c',
} as const;

export type Surface = keyof typeof SURFACE;

/** Repaints the browser chrome and the overscroll canvas for the screen now showing. */
export function useSurfaceTheme(surface: Surface): void {
  useEffect(() => {
    const colour = SURFACE[surface];
    document.documentElement.style.background = colour;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colour);
  }, [surface]);
}
