/**
 * The house crest: a fleur-de-lis, drawn once and reused wherever the table needs a mark - the back
 * of every card, the centre of the felt, the rule under the lobby's title.
 *
 * Paths only, filled with `currentColor` - no gradients and no ids - so any number of copies can sit
 * on one page without colliding, and each caller sets its size and colour in CSS.
 */
export function Fleur({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 132" aria-hidden="true">
      {/* Centre petal, two furled side petals, the band, and the flared stem. */}
      <path d="M50 8c-7 10-9 19-5 27 1 3 3 6 5 8 2-2 4-5 5-8 4-8 2-17-5-27z" />
      <path d="M50 45c-6-4-13-9-21-9-9 0-14 6-14 13 0 8 6 13 13 13 5 0 9-2 12-6-4 1-8 0-10-3-2-3-1-7 2-9 5-3 12 1 18 6z" />
      <path d="M50 45c6-4 13-9 21-9 9 0 14 6 14 13 0 8-6 13-13 13-5 0-9-2-12-6 4 1 8 0 10-3 2-3 1-7-2-9-5-3-12 1-18 6z" />
      <rect x="30" y="47" width="40" height="7" rx="3.5" />
      <path d="M46 56h8l3 34c1 9 4 15 9 20-6-1-11-4-16-9-5 5-10 8-16 9 5-5 8-11 9-20z" />
      <path d="M50 108l5 8-5 8-5-8z" opacity="0.85" />
    </svg>
  );
}
