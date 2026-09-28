import type { CategorySlug } from '@/lib/categories';

/**
 * Today's on-device decisions (DESIGN §12.2), in one place.
 *
 * The page is a static shell: everyone gets the same HTML, which is the
 * first-visit layout. A returning student's layout (Continue reading rows,
 * the progress strip, the practise panel, which story is picked) depends on
 * their device, so a tiny inline script works it out from localStorage
 * *before first paint* and writes it as data attributes on the Today root.
 * CSS lays the page out from those attributes, the islands hydrate into
 * boxes that are already the right size, and nothing shifts.
 *
 * `todayFlags` and `flagAttributes` run in two places: in React (after
 * hydration, from the validated store) and serialised into that inline
 * script with Function#toString. So they must stay self-contained: no
 * imports, no module constants, no calls to anything outside their bodies.
 */

/** One story from the server's today set (newest per category), as the picker needs it. */
export interface PickCandidate {
  slug: string;
  category: CategorySlug;
  /** Epoch milliseconds. */
  publishedAt: number;
  isSample: boolean;
}

/** Why the pick was made: the one least-read corner, one of several tied, or no claim. */
export type PickReason = '' | 'least' | 'tie';

export interface TodayFlags {
  /** Nothing on this device yet (no reads, words or journal entries): show onboarding. */
  isNew: boolean;
  /** Continue reading rows to show (0–3). */
  cont: number;
  /** Words due for practice now. */
  due: number;
  /** Index into the candidates of Today's story, or -1 when there are none. */
  pick: number;
  why: PickReason;
}

/** Unfinished reads older than this are left out of Continue reading. */
export const CONTINUE_WINDOW_MS = 30 * 86_400_000;
/** "This week" for the least-read corner: the last seven days. */
export const WEEK_MS = 7 * 86_400_000;
export const CONTINUE_LIMIT = 3;

/**
 * Works out the layout-affecting decisions from a local state. `state` may be
 * raw, unvalidated JSON (the pre-paint script) or the validated store state,
 * so every field is checked before use. Never throws for odd input.
 */
export function todayFlags(state: unknown, now: number, candidates: readonly PickCandidate[], fallback: number): TodayFlags {
  const DAY = 86400000;
  const has = Object.prototype.hasOwnProperty;
  const asRecord = function (value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  };
  const root = asRecord(state);
  const reads = asRecord(root.reads);
  const words = asRecord(root.words);
  const journal = asRecord(root.journal);
  const slugs = Object.keys(reads);
  const isNew = slugs.length === 0 && Object.keys(words).length === 0 && Object.keys(journal).length === 0;

  const counts: Record<string, number> = { writing: 0, games: 0, art: 0, sports: 0 };
  const touched: Record<string, boolean> = Object.create(null);
  let unfinished = 0;
  for (let i = 0; i < slugs.length; i++) {
    const read = asRecord(reads[slugs[i]]);
    const started = typeof read.startedAt === 'number' ? read.startedAt : 0;
    const done = typeof read.completedAt === 'number';
    touched[slugs[i]] = true;
    if (!done && now - started <= 30 * DAY) unfinished++;
    const last = done ? (read.completedAt as number) : started;
    if (now - last <= 7 * DAY && typeof read.category === 'string' && has.call(counts, read.category)) counts[read.category]++;
  }

  let due = 0;
  const keys = Object.keys(words);
  for (let k = 0; k < keys.length; k++) {
    const word = asRecord(words[keys[k]]);
    if (typeof word.dueAt === 'number' && word.dueAt <= now) due++;
  }

  let pick = -1;
  let why: PickReason = '';
  if (candidates.length > 0) {
    if (slugs.length === 0) {
      pick = fallback >= 0 && fallback < candidates.length ? fallback : 0;
    } else {
      const countOf = function (index: number): number {
        const category = candidates[index].category;
        return has.call(counts, category) ? counts[category] : 0;
      };
      // Better = the corner read least this week, then news before practice, then newest.
      const better = function (a: number, b: number): boolean {
        if (countOf(a) !== countOf(b)) return countOf(a) < countOf(b);
        if (candidates[a].isSample !== candidates[b].isSample) return !candidates[a].isSample;
        return candidates[a].publishedAt > candidates[b].publishedAt;
      };
      // First choice: a story not opened on this device yet; otherwise any.
      for (let pass = 0; pass < 2 && pick < 0; pass++) {
        for (let c = 0; c < candidates.length; c++) {
          if (pass === 0 && touched[candidates[c].slug]) continue;
          if (pick < 0 || better(c, pick)) pick = c;
        }
      }
      const values = [counts.writing, counts.games, counts.art, counts.sports];
      const min = Math.min.apply(null, values);
      const max = Math.max.apply(null, values);
      // Only claim "the corner you've read least" when it's true: something was
      // read this week, and the pick's corner is at the minimum.
      if (max > 0 && countOf(pick) === min) {
        let tied = 0;
        for (let v = 0; v < values.length; v++) if (values[v] === min) tied++;
        why = tied === 1 ? 'least' : 'tie';
      }
    }
  }

  return { isNew: isNew, cont: Math.min(3, unfinished), due: due, pick: pick, why: why };
}

/** The data attributes the Today root carries (CSS lays the page out from these). */
export function flagAttributes(flags: TodayFlags): Record<string, string> {
  return {
    'data-new': flags.isNew ? '1' : '0',
    'data-cont': String(flags.cont),
    'data-keep': flags.cont > 0 ? '1' : '0',
    'data-due': flags.due > 0 ? '1' : '0',
    'data-one': flags.due === 1 ? '1' : '0',
    'data-duen': String(flags.due),
    'data-pick': String(flags.pick),
    'data-why': flags.why,
  };
}

/** The first-visit flags: what the server renders and what shows without script. */
export function firstVisitFlags(fallback: number): TodayFlags {
  return { isNew: true, cont: 0, due: 0, pick: fallback, why: '' };
}

/** Today's story on a first visit: the newest news story (practice only when there is no news). */
export function newestCandidate(candidates: readonly PickCandidate[]): number {
  let best = -1;
  candidates.forEach((candidate, index) => {
    if (best < 0) {
      best = index;
      return;
    }
    const current = candidates[best];
    if (candidate.isSample !== current.isSample ? !candidate.isSample : candidate.publishedAt > current.publishedAt) best = index;
  });
  return best;
}

export interface ContinueItem {
  slug: string;
  title: string;
  category: CategorySlug;
  startedAt: number;
}

interface ReadsSource {
  reads: Readonly<Record<string, { title: string; category: CategorySlug; startedAt: number; completedAt?: number }>>;
}

/** Unfinished reads from the last 30 days, most recently started first (max 3). Matches `todayFlags().cont`. */
export function unfinishedReads(state: ReadsSource, now: number, limit = CONTINUE_LIMIT): ContinueItem[] {
  return Object.keys(state.reads)
    .map((slug) => ({ slug, read: state.reads[slug] }))
    .filter(({ read }) => read.completedAt === undefined && now - read.startedAt <= CONTINUE_WINDOW_MS)
    .sort((a, b) => b.read.startedAt - a.read.startedAt || (a.slug < b.slug ? -1 : 1))
    .slice(0, Math.max(0, limit))
    .map(({ slug, read }) => ({ slug, title: read.title, category: read.category, startedAt: read.startedAt }));
}

/** JSON that is safe inside an inline <script>: no `</script>` or `<!--` breakout. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * The pre-paint script. It must be the first child of the Today root: it reads
 * `localStorage['wiege:v1']`, runs `todayFlags`, and sets the attributes on its
 * parent before the rest of the page is parsed. Any failure leaves the
 * first-visit layout, which React corrects after hydration.
 */
export function todayScript(candidates: readonly PickCandidate[], fallback: number): string {
  return (
    '(function(){try{var r=document.currentScript.parentElement,t=localStorage.getItem("wiege:v1"),' +
    `f=(${todayFlags.toString()})(t?JSON.parse(t):null,Date.now(),${scriptJson(candidates)},${fallback}),` +
    `a=(${flagAttributes.toString()})(f);for(var k in a)r.setAttribute(k,a[k])}catch(e){}})()`
  );
}
