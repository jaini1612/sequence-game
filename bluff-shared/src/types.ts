/**
 * Bluff (also played as "Cheat"): everyone dumps cards face down claiming a rank, and the only
 * defence is calling someone a liar. This package is deliberately standalone - it shares no code
 * with the Sequence engine so the two games can evolve without tripping over each other.
 */

export type Suit = 'D' | 'C' | 'H' | 'S';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

/** e.g. "9H", "10D", "QS". Same shape as a Sequence card code, but its own type on purpose. */
export type CardCode = string;

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RANK_LABEL: Record<Rank, string> = {
  A: 'Aces',
  '2': 'Twos',
  '3': 'Threes',
  '4': 'Fours',
  '5': 'Fives',
  '6': 'Sixes',
  '7': 'Sevens',
  '8': 'Eights',
  '9': 'Nines',
  '10': 'Tens',
  J: 'Jacks',
  Q: 'Queens',
  K: 'Kings',
};

/** Singular form, for a claim of exactly one card ("1 x Nine" rather than "1 x Nines"). */
export const RANK_SINGULAR: Record<Rank, string> = {
  A: 'Ace',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  '10': 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
};

export function describeClaim(rank: Rank, count: number): string {
  return `${count} × ${count === 1 ? RANK_SINGULAR[rank] : RANK_LABEL[rank]}`;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

/**
 * How far past honesty a single claim may go, as a multiple of the largest number of one rank the
 * deck actually holds.
 *
 * The cap is not a fixed number, because the honest ceiling is not fixed: a proper single deck has
 * four of every rank, a proper double deck has eight, and a scrambled double deck might have fifteen
 * Queens. Pegging the cap to the deck means the room to lie always scales with the room to tell the
 * truth - at two times the honest ceiling you can always claim more than could possibly exist, which
 * is the whole point, without ever being able to dump an entire hand in one turn.
 */
export const CLAIM_HEADROOM = 2;

/**
 * Calling somebody a liar is a limited resource. You start with a full set, a correct call earns one
 * back (never past the cap), and a wrong one costs you. Run dry and you cannot challenge at all -
 * which is when the bluff meter below becomes your only way back in.
 */
export const MAX_CHALLENGES = 4;

/**
 * The way out of having no challenges left: every card you play that is not what you claimed it was
 * fills this meter, and filling it buys back a single challenge. Lying is the only thing that earns
 * it, so a player who has spent all their scepticism has to go and be dishonest to get it back.
 *
 * It only ticks while a player is at zero challenges - it is a comeback mechanism, not a score.
 */
export const BLUFF_METER_GOAL = 20;

export const DECK_COUNTS = [1, 2] as const;
export type DeckCount = (typeof DECK_COUNTS)[number];

/**
 * How the deck is built.
 *
 * - `standard` is an honest deck: exactly four of every rank per deck, so counting is possible and a
 *   claim of five Kings in a one-deck game is provably a lie.
 * - `scrambled` keeps the same number of cards but not the same make-up, so nobody knows how many
 *   Nines exist. It makes counting useless and calling bluff a genuine gamble.
 */
export type DeckComposition = 'standard' | 'scrambled';

export const TURN_SECONDS_MIN = 10;
export const TURN_SECONDS_MAX = 30;
export const TURN_SECONDS_STEP = 5;

export const TURN_SECONDS_OPTIONS: number[] = (() => {
  const options: number[] = [];
  for (let s = TURN_SECONDS_MIN; s <= TURN_SECONDS_MAX; s += TURN_SECONDS_STEP) options.push(s);
  return options;
})();

export interface BluffConfig {
  playerCount: number;
  deckCount: DeckCount;
  composition: DeckComposition;
  /** How long a player has to act before the table moves on without them. */
  turnSeconds: number;
}

/**
 * How many players have to empty their hands before the game stops. Head-to-head there is only one
 * prize; at a bigger table the first two out both walk away winners and the rest keep their shame.
 */
export function winnersNeeded(playerCount: number): number {
  return playerCount <= 2 ? 1 : 2;
}

/**
 * `pendingOut` is the gap between playing your last card and being safe: the claim that emptied your
 * hand can still be challenged, and a caught liar picks the pile up and is back in the game.
 */
export type PlayerStatus = 'active' | 'pendingOut' | 'out';

/**
 * A player's game-long record, for the honours handed out at the end. Bluffs are counted by turn and
 * not by card: putting seven cards down and lying about one of them is one bluff, because it was one
 * decision and one risk.
 */
export interface BluffStats {
  /** Turns spent putting cards down. Passes are not turns for this purpose. */
  turns: number;
  /** Of those, the ones where at least one card was not what it was called. */
  bluffTurns: number;
  /** Bluffs a challenge exposed. The rest got away with it. */
  bluffsCaught: number;
  challengesMade: number;
  challengesCorrect: number;
}

export interface BluffPlayer {
  id: string;
  name: string;
  seat: number;
  hand: CardCode[];
  status: PlayerStatus;
  /** Finishing position, set when they are confirmed out. 1 is the first player home. */
  place: number | null;
  /** Challenges left to spend, 0 to MAX_CHALLENGES. */
  challenges: number;
  /**
   * Progress towards buying a challenge back, 0 to BLUFF_METER_GOAL. Strictly private: it counts the
   * cards this player has lied about, so showing it to the table would give the game away.
   */
  bluffMeter: number;
  /** Also strictly private until the game is over - see BluffStats. */
  stats: BluffStats;
  /**
   * Passed this round, and so out of it: they may still call somebody a liar, but they cannot put
   * another card down until the round ends. Cleared when it does.
   */
  passedRound: boolean;
  /** Waved the closing claim through rather than checking it. */
  letGo: boolean;
}

/** The face-down cards on top of the pile and the story told about them. */
export interface Claim {
  playerId: string;
  rank: Rank;
  count: number;
  cards: CardCode[];
}

/**
 * What just happened, for the table to animate and the host to be smug about. One action can produce
 * several of these at once - a play can confirm somebody home and end the game in the same breath.
 */
export type BluffEvent =
  | { type: 'deal' }
  | { type: 'play'; playerId: string; rank: Rank; count: number }
  | { type: 'pass'; playerId: string; timedOut: boolean }
  | {
      type: 'challenge';
      challengerId: string;
      claimerId: string;
      rank: Rank;
      /** The cards that were face down, revealed to everyone - the whole point of a challenge. */
      cards: CardCode[];
      /** True when the claim was a lie, i.e. the challenger was right. */
      bluffed: boolean;
      /** Whoever swallowed the pile: the liar, or the challenger who cried wolf. */
      loserId: string;
      pileSize: number;
    }
  /** A full lap of passes, so the pile is taken out of play rather than left to rot. */
  | { type: 'burn'; count: number }
  /** Everyone else has passed, so this claim is the round's last - check it or let it go. */
  | { type: 'roundClosing'; playerId: string }
  | { type: 'letGo'; playerId: string }
  /** A bluff meter filled up and bought its owner a challenge back. */
  | { type: 'challengeEarned'; playerId: string }
  | { type: 'out'; playerId: string; place: number }
  | { type: 'finished'; winnerIds: string[] };

export interface BluffState {
  config: BluffConfig;
  players: BluffPlayer[];
  /** Seat index of whoever is on the clock. */
  currentSeat: number;
  /** The rank this round is locked to. Null at the start of a round: the opener names it. */
  roundRank: Rank | null;
  /** Face-down cards in the middle. Nobody may look, hence the count-only player view. */
  pile: CardCode[];
  lastClaim: Claim | null;
  /**
   * The most cards this deal allows in one claim: CLAIM_HEADROOM times the commonest rank in the
   * deck. Fixed at deal time, since the deck never changes mid-game.
   */
  maxClaim: number;
  /** Cards taken out of play by burnt rounds, so hand counts still add up for the UI. */
  burned: number;
  /**
   * Whoever made the round's closing claim, once everyone else has passed out of the round. While
   * this is set the round is shutting down: nobody may play, and the others each either check the
   * claim or let it go.
   */
  finalClaimBy: string | null;
  /** Wall-clock deadline for the current turn. */
  turnEndsAt: number;
  /** Player ids in finishing order. */
  winners: string[];
  finished: boolean;
  /** Everything the last action caused, in order. */
  events: BluffEvent[];
  /** Bumped once per action, so a client can tell a fresh batch from a re-render of the same state. */
  eventSeq: number;
}
