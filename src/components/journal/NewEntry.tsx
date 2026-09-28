'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, LinkButton } from '@/components/ui/Button';
import type { LocalState } from '@/lib/local/schema';
import { useLocal } from '@/lib/local/store';

import { EntryFrame, EntryMeta } from './EntryParts';
import { freePrompt, kindLabel, targetText, wordTarget, type PromptInput } from './journal-helpers';
import { FREE_WRITE_HREF, NewEntryPicker, NewEntrySkeleton, PromptCard, storyPromptsHref, type TodayStory } from './NewEntryParts';
import { kitVocabulary, useStoryKit, type StoryKit } from './story-kit';
import { WritingEditor } from './WritingEditor';

/**
 * /journal/new island (DESIGN §12.6), inside <Suspense> because it reads the
 * URL: no parameters → the picker; `?story=<slug>` → that story's three
 * prompts plus a free write about it; `&prompt=<id>` (or `prompt=free`) →
 * the editor; `?free=1` → a free write. The entry is created on the first
 * autosave and the URL becomes /journal/<id>.
 */

/** Standalone meta links keep a 44px target. */
export const META_LINK = 'inline-flex min-h-11 items-center underline decoration-2 underline-offset-[5px] hover:decoration-[3px]';

const selectBand = (s: LocalState) => s.prefs.gradeBand ?? '7-8';

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function NewEntry({ today }: { today: readonly TodayStory[] }) {
  const params = useSearchParams();
  const story = params.get('story');
  const promptId = params.get('prompt');
  const free = params.has('free');
  const band = useLocal(selectBand);
  const kit = useStoryKit(story);

  if (!story && !free) return <NewEntryPicker today={today} />;
  if (band === null) return <NewEntrySkeleton />;
  if (!story) {
    return <EditorView key="free" prompt={freePrompt(false)} band={band} vocabulary={[]} />;
  }
  if (!kit || kit.status === 'loading') return <NewEntrySkeleton />;
  if (kit.status === 'missing' || kit.status === 'error') {
    return (
      <div className="grid max-w-[560px] justify-items-start gap-5">
        <h2 className="type-h3">{kit.status === 'missing' ? 'This story has moved on.' : 'The prompts didn’t load.'}</h2>
        <p className="text-ui text-ink-2">
          {kit.status === 'missing'
            ? 'Its prompts aren’t available any more. You can still write about it, or pick one of today’s stories.'
            : 'Check your connection, then try again. Your journal is still safe on this device.'}
        </p>
        {kit.status === 'missing' ? (
          <LinkButton href={FREE_WRITE_HREF}>Start a free write</LinkButton>
        ) : (
          <Button onClick={() => window.location.reload()}>Try again</Button>
        )}
      </div>
    );
  }
  const title = kit.kit.titles[band];
  const chosen: PromptInput | null = promptId === 'free' ? freePrompt(true) : (kit.kit.prompts.find((p) => p.id === promptId) ?? null);
  if (!chosen) return <StoryPrompts kit={kit.kit} title={title} />;
  return (
    <EditorView
      key={`${story}|${chosen.id}`}
      prompt={chosen}
      band={band}
      vocabulary={kitVocabulary(kit.kit, band)}
      story={{ slug: kit.kit.slug, title }}
    />
  );
}

function StoryPrompts({ kit, title }: { kit: StoryKit; title: string }) {
  return (
    <section aria-labelledby="story-prompts" className="grid gap-6">
      <div className="grid gap-2">
        <h2 id="story-prompts" className="type-h3">
          Pick a prompt
        </h2>
        <p className="text-ui text-ink-2">
          From “{title}”.{' '}
          <Link href="/journal/new" className="font-bold">
            Pick another story
          </Link>
        </p>
      </div>
      <ul className="grid gap-4 @3xl/app:grid-cols-2">
        {kit.prompts.map((p) => (
          <PromptCard key={p.id} href={storyPromptsHref(kit.slug, p.id)} label={kindLabel(p.kind)} text={p.prompt} target={capitalise(`${targetText(wordTarget(p))} words`)} />
        ))}
        <PromptCard href={storyPromptsHref(kit.slug, 'free')} glyph label="Free write" text={freePrompt(true).prompt} target="Aim for 50 words or more" />
      </ul>
    </section>
  );
}

function EditorView({ prompt, band, vocabulary, story }: { prompt: PromptInput; band: '7-8' | '9-10'; vocabulary: string[]; story?: { slug: string; title: string } }) {
  const items = [
      { label: 'Prompt', value: kindLabel(prompt.kind) },
      ...(story
        ? [
            {
              label: 'Story',
              value: (
                <Link href={`/read/${encodeURIComponent(story.slug)}`} className={META_LINK}>
                  {story.title}
                </Link>
              ),
            },
            {
              label: 'Want a different one?',
              value: (
                <Link href={storyPromptsHref(story.slug)} className={META_LINK}>
                  Choose another prompt
                </Link>
              ),
            },
          ]
        : [
            {
              label: 'Want a prompt?',
              value: (
                <Link href="/journal/new" className={META_LINK}>
                  Pick a story prompt
                </Link>
              ),
            },
          ]),
  ];
  return (
    <EntryFrame meta={<EntryMeta items={items} />}>
      <WritingEditor storySlug={story?.slug} storyTitle={story?.title} prompt={prompt} vocabulary={vocabulary} gradeBand={band} variant="page" />
    </EntryFrame>
  );
}
