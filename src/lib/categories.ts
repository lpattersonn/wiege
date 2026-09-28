import { z } from 'zod';

/** Isomorphic: safe to import from server and client code. */

export const CATEGORY_SLUGS = ['writing', 'games', 'art', 'sports'] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CategorySlugSchema = z.enum(CATEGORY_SLUGS);

/** Key of the ink glyph drawn for a category (components/ink maps keys to marks). */
export type CategoryGlyph = 'quill' | 'controller' | 'brush' | 'ball';

export interface Category {
  slug: CategorySlug;
  name: string;
  /** One plain-language line, written from the student's point of view. */
  description: string;
  glyph: CategoryGlyph;
}

export const CATEGORIES: readonly Category[] = [
  {
    slug: 'writing',
    name: 'Writing',
    description: 'Books, authors, poems and the people who tell stories.',
    glyph: 'quill',
  },
  {
    slug: 'games',
    name: 'Games',
    description: 'Video games, board games and the people who design them.',
    glyph: 'controller',
  },
  {
    slug: 'art',
    name: 'Art',
    description: 'Painting, design, museums and makers from around the world.',
    glyph: 'brush',
  },
  {
    slug: 'sports',
    name: 'Sports',
    description: 'Matches, records and the athletes behind them.',
    glyph: 'ball',
  },
];

const BY_SLUG = new Map<CategorySlug, Category>(CATEGORIES.map((c) => [c.slug, c]));

export function isCategorySlug(value: unknown): value is CategorySlug {
  return typeof value === 'string' && BY_SLUG.has(value as CategorySlug);
}

export function getCategory(slug: CategorySlug): Category {
  const category = BY_SLUG.get(slug);
  if (!category) throw new Error(`Unknown category: ${slug}`);
  return category;
}

/** Returns the category for an untrusted string (e.g. a URL segment), or null. */
export function findCategory(value: string): Category | null {
  return isCategorySlug(value) ? getCategory(value) : null;
}
