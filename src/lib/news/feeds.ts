import type { CategorySlug } from '@/lib/categories';

/**
 * Curated news feeds (SPEC §5). This list is the first kid-safety layer: only
 * these feeds are ever fetched (a row in `wiege.sources` that is not listed
 * here is ignored), and an item's link must stay on the feed's own hosts.
 *
 * Every feed was fetched live on 2026-09-27 with the WiegeBot User-Agent and
 * its recent items were read for suitability for 12–15 year olds. `why`
 * records the reasoning. Feeds that were considered and left out:
 * - The Guardian Books: adult literary coverage (crime, sex, politics); its
 *   children's-books feed stopped updating in 2016.
 * - NPR Books / NPR Sports: frequent adult and political topics.
 * - Book Riot: mostly daily deals, sponsored posts and horror lists.
 * - Push Square, Pure Xbox, GamesRadar, GoNintendo: dominated by mature-rated
 *   games (GTA 6, The Last of Us, horror tie-ins).
 * - Pocket Gamer "latest": mostly free-spin, coin and casino-style code posts
 *   (its news-only feed below is fine).
 * - Dicebreaker (stopped updating in 2024), Kirkus (items have no dates),
 *   Smithsonian Arts & Culture (two items a month), School Library Journal
 *   and The Horn Book (block bots), Olympics.com (no working feed).
 */

export type FeedRouting =
  /** Every item belongs to the feed's category. */
  | { kind: 'fixed' }
  /** A mixed feed: items are routed by keyword rules and dropped when none match. */
  | { kind: 'keywords'; categories: readonly CategorySlug[] };

export interface FeedDefinition {
  /** Stable slug, also the `wiege.sources.id`. */
  id: string;
  name: string;
  feedUrl: string;
  homepage: string;
  /** Category of the source row (for keyword-routed feeds, its main one). */
  category: CategorySlug;
  routing: FeedRouting;
  /** Item links must be on one of these hosts (or a subdomain). */
  allowedHosts: readonly string[];
  /** Items whose link matches are skipped (video bulletins, live pages, audio). */
  skipLinks?: readonly RegExp[];
  /** Items whose title matches are skipped: recurring trade columns and lists that make poor lessons. */
  skipTitles?: readonly RegExp[];
  /** Feed-specific boilerplate removed from excerpts (membership plugs, "READ:" lines). */
  excerptBoilerplate?: readonly RegExp[];
  /** Why this feed is on the list. */
  why: string;
}

const BBC_MEDIA_LINKS = [/\/iplayer\//, /\/sounds\//, /\/av\//, /\/videos\//, /\/live\//, /watch_newsround/];

export const FEEDS: readonly FeedDefinition[] = [
  // --- Writing -----------------------------------------------------------------
  {
    id: 'pw-childrens',
    name: "Publishers Weekly: Children's",
    feedUrl: 'https://www.publishersweekly.com/pw/feeds/section/childrens/index.xml',
    homepage: 'https://www.publishersweekly.com/pw/by-topic/childrens/index.html',
    category: 'writing',
    routing: { kind: 'fixed' },
    allowedHosts: ['publishersweekly.com'],
    // Weekly trade columns (rights deals, job moves, licensing, release lists) retell poorly as a lesson.
    skipTitles: [
      /^(?:rights report|in brief|licensing hotline|children['’]s job moves|new kids['’] and ya books)\b/i,
      /\ball our coverage$/i,
      /\bsneak peek$/i,
    ],
    why: "The book trade's own news desk for children's and YA books: new releases, author interviews and awards, about 20 items a week. Written for adults in the trade but about books this age group reads.",
  },
  {
    id: 'bbc-newsround',
    name: 'BBC Newsround',
    feedUrl: 'https://feeds.bbci.co.uk/newsround/rss.xml',
    homepage: 'https://www.bbc.co.uk/newsround',
    category: 'writing',
    routing: { kind: 'keywords', categories: ['writing', 'games', 'art', 'sports'] },
    allowedHosts: ['bbc.co.uk', 'bbc.com'],
    skipLinks: BBC_MEDIA_LINKS,
    why: "The BBC's news service made for children, edited for young readers. Mixed topics, so items are routed to a category by keyword and anything that fits none (animals, science, world news) is dropped. Video bulletins are skipped.",
  },
  {
    id: 'scholastic-kids-press',
    name: 'Scholastic Kids Press',
    feedUrl: 'https://kpcnotebook.scholastic.com/rss.xml',
    homepage: 'https://kpcnotebook.scholastic.com',
    category: 'writing',
    routing: { kind: 'keywords', categories: ['writing'] },
    allowedHosts: ['scholastic.com'],
    why: 'News written by kid reporters aged 10–14 for readers their age. Only its pieces about books, reading and writing are kept (by keyword); a few posts a month, so it adds quality rather than volume.',
  },
  {
    id: 'smithsonian-smart-news',
    name: 'Smithsonian Magazine',
    feedUrl: 'https://www.smithsonianmag.com/rss/smart-news/',
    homepage: 'https://www.smithsonianmag.com/smart-news/',
    category: 'art',
    routing: { kind: 'keywords', categories: ['art', 'writing'] },
    allowedHosts: ['smithsonianmag.com'],
    why: "A museum institution's short, fact-checked news pieces. Only items about art, museums, books and language are kept; history pieces about war or crime are dropped by routing or the safety filter.",
  },
  // --- Games -------------------------------------------------------------------
  {
    id: 'nintendo-life',
    name: 'Nintendo Life',
    feedUrl: 'https://www.nintendolife.com/feeds/news',
    homepage: 'https://www.nintendolife.com',
    category: 'games',
    routing: { kind: 'fixed' },
    allowedHosts: ['nintendolife.com'],
    why: "Daily news about Nintendo's platforms, whose catalogue is mostly rated for everyone or 12+. The most family-friendly of the large games sites checked.",
  },
  {
    id: 'pocket-gamer',
    name: 'Pocket Gamer',
    feedUrl: 'https://www.pocketgamer.com/news/index.rss',
    homepage: 'https://www.pocketgamer.com',
    category: 'games',
    routing: { kind: 'fixed' },
    allowedHosts: ['pocketgamer.com'],
    why: 'Mobile games news (Pokémon Go, Sky, puzzle and building games): the games this age group plays most. The news-only feed avoids the site-wide feed of casino-style code posts.',
  },
  {
    id: 'boardgamegeek-news',
    name: 'BoardGameGeek News',
    feedUrl: 'https://boardgamegeek.com/rss/blog/1',
    homepage: 'https://boardgamegeek.com/blog/1',
    category: 'games',
    routing: { kind: 'fixed' },
    allowedHosts: ['boardgamegeek.com'],
    why: 'Board game news and designer diaries, where designers explain how they made a game. Broadens Games beyond video games and models writing about a creative process.',
  },
  // --- Art ---------------------------------------------------------------------
  {
    id: 'colossal',
    name: 'Colossal',
    feedUrl: 'https://www.thisiscolossal.com/feed/',
    homepage: 'https://www.thisiscolossal.com',
    category: 'art',
    routing: { kind: 'fixed' },
    allowedHosts: ['thisiscolossal.com'],
    excerptBoilerplate: [/Do stories and artists like this matter to you\?[\s\S]*$/i],
    why: 'Independent art and visual culture magazine: illustration, craft, photography, murals and design, with short, descriptive posts.',
  },
  {
    id: 'my-modern-met',
    name: 'My Modern Met',
    feedUrl: 'https://mymodernmet.com/feed/',
    homepage: 'https://mymodernmet.com',
    category: 'art',
    routing: { kind: 'keywords', categories: ['art', 'sports'] },
    allowedHosts: ['mymodernmet.com'],
    excerptBoilerplate: [/\bREAD:[\s\S]*$/],
    why: 'Upbeat art, photography, architecture and design stories plus good-news pieces. Mixed topics, so items are routed to Art or Sports by keyword.',
  },
  // --- Sports ------------------------------------------------------------------
  {
    id: 'bbc-sport',
    name: 'BBC Sport',
    feedUrl: 'https://feeds.bbci.co.uk/sport/rss.xml',
    homepage: 'https://www.bbc.co.uk/sport',
    category: 'sports',
    routing: { kind: 'fixed' },
    allowedHosts: ['bbc.co.uk', 'bbc.com'],
    skipLinks: BBC_MEDIA_LINKS,
    why: "Broad, carefully edited coverage of men's and women's sport (football, cricket, tennis, rugby, athletics). Live pages, video and audio are skipped.",
  },
  {
    id: 'espn',
    name: 'ESPN',
    feedUrl: 'https://www.espn.com/espn/rss/news',
    homepage: 'https://www.espn.com',
    category: 'sports',
    routing: { kind: 'fixed' },
    allowedHosts: ['espn.com'],
    skipLinks: [/\/video\//, /\/watch\//],
    why: 'North American sport (NFL, NBA, WNBA, MLB, college sport) to balance the UK-focused BBC. Headlines are plain; injury and discipline items go through the safety filter.',
  },
];

const BY_ID = new Map(FEEDS.map((feed) => [feed.id, feed]));

export function getFeed(id: string): FeedDefinition | undefined {
  return BY_ID.get(id);
}

export function isCuratedFeed(id: string): boolean {
  return BY_ID.has(id);
}

/**
 * Keyword rules for mixed feeds. Terms are matched as whole words
 * (case-insensitive) in the title, excerpt and the feed's own tags. Generic
 * words that mislead ("game", "match", "story", "team") are deliberately absent.
 */
export const CATEGORY_KEYWORDS: Record<CategorySlug, readonly string[]> = {
  writing: [
    'book', 'books', 'author', 'authors', 'novel', 'novels', 'novelist', 'poem', 'poems', 'poet', 'poets', 'poetry',
    'writer', 'writers', 'writing', 'handwriting', 'cursive', 'library', 'libraries', 'librarian', 'literature',
    'literary', 'fiction', 'nonfiction', 'picture book', 'graphic novel', 'bookshop', 'bookstore', 'bookseller',
    'publisher', 'publishing', 'storytelling', 'storyteller', 'reading', 'readers', 'dictionary', 'word of the year',
    'spelling bee', 'playwright', 'shakespeare', 'world book day', 'booker prize', 'carnegie medal', 'newbery',
    'manuscript', 'journalist', 'kid reporter',
  ],
  games: [
    'video game', 'video games', 'videogame', 'gaming', 'gamer', 'gamers', 'console', 'consoles', 'nintendo',
    'switch 2', 'playstation', 'xbox', 'minecraft', 'roblox', 'fortnite', 'pokemon', 'pokémon', 'mario', 'zelda',
    'esports', 'e-sports', 'board game', 'board games', 'tabletop', 'chess', 'puzzle game', 'game designer',
    'game developer',
  ],
  art: [
    'art', 'arts', 'artist', 'artists', 'artwork', 'artworks', 'painting', 'paintings', 'painter', 'sculpture',
    'sculptures', 'sculptor', 'museum', 'museums', 'gallery', 'galleries', 'exhibition', 'exhibitions', 'mural',
    'murals', 'illustration', 'illustrations', 'illustrator', 'drawing', 'drawings', 'design', 'designer', 'designers',
    'architecture', 'architect', 'photography', 'photographer', 'photographers', 'portrait', 'portraits', 'ceramics',
    'pottery', 'craft', 'crafts', 'origami', 'animation', 'animator', 'cartoonist', 'graffiti', 'street art',
    'installation', 'monet', 'van gogh', 'picasso', 'rembrandt', 'da vinci', 'frida kahlo', 'louvre', 'tate modern', 'tate britain',
  ],
  sports: [
    'sport', 'sports', 'football', 'soccer', 'cricket', 'rugby', 'tennis', 'golf', 'athletics', 'athlete', 'athletes',
    'olympic', 'olympics', 'olympian', 'paralympic', 'paralympics', 'paralympian', 'commonwealth games', 'world cup',
    'premier league', "women's super league", 'fa cup', 'wimbledon', 'basketball', 'nba', 'wnba', 'netball',
    'hockey', 'swimming', 'swimmer', 'gymnastics', 'gymnast', 'cycling', 'cyclist', 'marathon', 'skateboarding',
    'surfing', 'climbing', 'skiing', 'snowboarding', 'formula 1', 'formula one', 'f1', 'lionesses', 'red roses',
    'tournament', 'medal', 'medals', 'stadium',
  ],
};

/** Weight of a keyword found in the title vs. in the excerpt or tags. */
const TITLE_WEIGHT = 2;
const BODY_WEIGHT = 1;
/** One title hit, or two hits in the body, is enough to route an item. */
const MIN_ROUTE_SCORE = 2;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Letter/digit boundaries instead of \b so "Pokémon" and "e-sports" match as words.
const keywordPatterns = new Map<CategorySlug, RegExp[]>(
  (Object.keys(CATEGORY_KEYWORDS) as CategorySlug[]).map((category) => [
    category,
    CATEGORY_KEYWORDS[category].map(
      (term) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term).replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu'),
    ),
  ]),
);

function keywordScore(category: CategorySlug, title: string, body: string): number {
  let score = 0;
  for (const pattern of keywordPatterns.get(category) ?? []) {
    if (pattern.test(title)) score += TITLE_WEIGHT;
    else if (pattern.test(body)) score += BODY_WEIGHT;
  }
  return score;
}

/**
 * The category an item belongs to, or null to drop it. Fixed feeds always
 * return their category; keyword feeds pick the best-scoring allowed category
 * (ties go to the earlier one in the feed's list).
 */
export function routeCategory(
  feed: Pick<FeedDefinition, 'category' | 'routing'>,
  item: { title: string; excerpt: string; tags?: readonly string[] },
): CategorySlug | null {
  if (feed.routing.kind === 'fixed') return feed.category;
  const body = `${item.excerpt}\n${(item.tags ?? []).join('\n')}`;
  let best: CategorySlug | null = null;
  let bestScore = MIN_ROUTE_SCORE - 1;
  for (const category of feed.routing.categories) {
    const score = keywordScore(category, item.title, body);
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

/** True when `hostname` is one of `allowed` or a subdomain of one. */
export function isAllowedHost(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
