import { beforeEach, describe, expect, it, vi } from 'vitest';

const cache = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: cache.revalidateTag,
  revalidatePath: cache.revalidatePath,
  unstable_cache: <T>(fn: T) => fn,
}));

const { STORY_PAGE_PATHS, revalidateStoryPages } = await import('./revalidate');

describe('revalidateStoryPages', () => {
  beforeEach(() => {
    cache.revalidateTag.mockReset();
    cache.revalidatePath.mockReset();
  });

  it('marks the stories tag stale with the max profile and refreshes the story routes', () => {
    expect(revalidateStoryPages()).toBe(true);
    expect(cache.revalidateTag).toHaveBeenCalledWith('stories', 'max');
    expect(cache.revalidatePath.mock.calls).toEqual([
      ['/', undefined],
      ['/today', undefined],
      ['/c', undefined],
      ['/c/[category]', 'page'],
      ['/read/[slug]', 'page'],
    ]);
    expect(STORY_PAGE_PATHS.every(({ path, type }) => !path.includes('[') || type === 'page')).toBe(true);
  });

  it('can expire the data immediately', () => {
    revalidateStoryPages({ expireNow: true });
    expect(cache.revalidateTag).toHaveBeenCalledWith('stories', { expire: 0 });
  });

  it('returns false outside a Next.js request instead of throwing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    cache.revalidateTag.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag stories');
    });
    expect(revalidateStoryPages()).toBe(false);
  });
});
