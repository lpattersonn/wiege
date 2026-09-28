import Link from 'next/link';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';
import { StoryCardS } from '@/components/story/StoryCard';
import { cx } from '@/components/ui/cx';
import { getCategory, type CategorySlug } from '@/lib/categories';

/**
 * The /journal/new prompt picker (DESIGN §12.6), server-safe: today's stories
 * (each opens its three prompts) and a free write. Rendered in the static HTML
 * and again by the client island when the URL has no story or prompt.
 */
export interface TodayStory {
  slug: string;
  category: CategorySlug;
  title: string;
}

export const FREE_WRITE_HREF = '/journal/new?free=1';

export function storyPromptsHref(slug: string, promptId?: string): string {
  const base = `/journal/new?story=${encodeURIComponent(slug)}`;
  return promptId ? `${base}&prompt=${encodeURIComponent(promptId)}` : base;
}

const cardClasses = cx(
  'relative grid h-full content-start gap-3 rounded-paper border border-line-soft bg-paper p-5',
  'transition-[border-color,transform] duration-150 ease-out hover:-translate-y-[3px] hover:border-ink',
  'has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-[6px] has-[a:focus-visible]:outline-ink',
);
const coverLink = "no-underline after:absolute after:inset-0 after:z-1 after:content-[''] focus-visible:outline-none";

/** A card that starts writing: a kind label, the prompt, the target. */
export function PromptCard({ href, label, text, target, glyph = false }: { href: string; label: string; text: string; target: string; glyph?: boolean }) {
  return (
    <li>
      <article className={cardClasses}>
        <h3 className="flex items-center gap-3 font-title text-[22px] leading-[1.15] font-bold text-ink">
          {glyph ? <CategoryGlyph glyph="quill" size={26} strokeWidth={1.8} /> : null}
          <Link href={href} className={coverLink}>
            {label}
          </Link>
        </h3>
        <p className="font-read text-choice leading-[1.45] text-ink">{text}</p>
        <p className="text-caption text-ink-3">{target}</p>
      </article>
    </li>
  );
}

export function NewEntryPicker({ today }: { today: readonly TodayStory[] }) {
  return (
    <div className="grid gap-14">
      <section aria-labelledby="new-stories" className="grid gap-6">
        <div className="grid gap-2">
          <h2 id="new-stories" className="type-h3">
            Answer a story prompt
          </h2>
          <p className="text-ui text-ink-2">Every story comes with three prompts. Pick one of today’s stories to see them.</p>
        </div>
        {today.length > 0 ? (
          <ul className="grid gap-3 @3xl/app:grid-cols-2">
            {today.map((story) => (
              <li key={story.slug}>
                <StoryCardS
                  href={storyPromptsHref(story.slug)}
                  title={story.title}
                  category={story.category}
                  meta={`${getCategory(story.category).name}, 3 prompts`}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ui text-ink-2">
            Today’s stories aren’t in yet. <Link href="/today">See what’s on Today</Link>, or write freely below.
          </p>
        )}
      </section>
      <section aria-labelledby="new-free" className="grid gap-6">
        <h2 id="new-free" className="type-h3">
          Or write freely
        </h2>
        <ul className="grid gap-4 @3xl/app:grid-cols-2">
          <PromptCard href={FREE_WRITE_HREF} glyph label="Free write" text="Write about anything you like: something you read, something you noticed, or an idea you want to try." target="Aim for 50 words or more" />
        </ul>
      </section>
    </div>
  );
}

/** Same-size placeholder while a story's prompts load. */
export function NewEntrySkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-6">
      <span className="skeleton block h-9 w-64" />
      <span className="skeleton block h-6 w-80 max-w-full" />
      <div className="grid gap-4 @3xl/app:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="skeleton block h-44" />
        ))}
      </div>
    </div>
  );
}

/** Pre-paint: with a story, prompt or free write in the URL, show the skeleton instead of the picker. */
export const NEW_ENTRY_GATE_SCRIPT =
  '(function(){var e=document.getElementById("new-entry-gate");if(e)e.setAttribute("data-gate",/[?&](story|prompt|free)=/.test(location.search)?"filled":"empty")})()';
