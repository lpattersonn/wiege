import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { IconBack, IconExternal } from '@/components/glyphs/icons';
import { Folio, FolioLeft, FolioMain, FolioMargin, PageContainer } from '@/components/layout/PageContainer';
import { Quiz, type QuizItem } from '@/components/quiz/Quiz';
import { FinishReading } from '@/components/reader/FinishReading';
import { ReaderRoot } from '@/components/reader/ReaderRoot';
import { ReaderShell } from '@/components/reader/ReaderShell';
import { ReaderToolbar } from '@/components/reader/ReaderToolbar';
import { firstSentenceWith, segmentLevel } from '@/components/reader/segment';
import { levelOnly, StoryBody } from '@/components/reader/StoryBody';
import { findEvidence } from '@/components/reader/text';
import { isPlaceholderDefinition, type ReaderVocab } from '@/components/reader/word-note';
import { WordNotes } from '@/components/reader/WordNotes';
import { WritePrompts } from '@/components/reader/WritePrompts';
import { Tag } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import { MetaCategory, MetaItem, MetaMinutes, MetaRow } from '@/components/ui/MetaRow';
import { lessonReadingMinutes } from '@/lib/literacy/readability';
import { GRADE_BANDS, type GradeBand } from '@/lib/literacy/types';
import { getRecentSlugs, getStoryBySlug, type Story } from '@/lib/stories';

/**
 * /read/[slug], the core experience (SPEC §8, DESIGN §12.4). Static per
 * story: recent stories are prerendered, others render on first visit and
 * are cached (ISR); the 'stories' tag refreshes them after every ingest.
 * Everything a student does (level, settings, words, quiz, writing) happens
 * in small client islands over this server-rendered page.
 */

export const revalidate = 600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await getRecentSlugs();
  return slugs.map((slug) => ({ slug }));
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6))}…`;
}

function describe(story: Story): string {
  const lead = clip(story.content.keyIdea || story.content.levels['7-8'].paragraphs[0] || story.excerpt, 158);
  const suffix = story.isSample ? 'A practice story for readers aged 12 to 15.' : `Retold from ${story.sourceName} for readers aged 12 to 15.`;
  return lead.length + suffix.length + 1 <= 160 ? `${lead} ${suffix}` : lead;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) return { title: 'This story has moved on', robots: { index: false, follow: true } };
  const description = describe(story);
  const url = `/read/${story.slug}`;
  // Overriding openGraph drops the root's file-based share image, so name it again.
  const image = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Wiege: real news, turned into reading practice for ages 12 to 15.' };
  return {
    title: story.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: 'Wiege',
      locale: 'en',
      url,
      title: story.title,
      description,
      images: [image],
      ...(story.isSample ? {} : { publishedTime: story.publishedAt }),
    },
    twitter: { card: 'summary_large_image', title: story.title, description, images: [image] },
  };
}

const NOT_WORD = new RegExp('[^\\p{L}\\p{N}]+', 'gu');
const normalize = (text: string) => text.toLowerCase().replace(NOT_WORD, ' ').trim();

/** The key idea as a standfirst, unless it only repeats how the story starts (offline lessons do that). */
function standfirstFor(story: Story): string | null {
  const idea = normalize(story.content.keyIdea);
  if (!idea) return null;
  const repeats = GRADE_BANDS.some((band) => normalize(story.content.levels[band].paragraphs.join(' ')).includes(idea.slice(0, 80)));
  return repeats ? null : story.content.keyIdea;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function ByLevel({ children }: { children: (band: GradeBand) => ReactNode }) {
  return (
    <>
      {GRADE_BANDS.map((band) => (
        <span key={band} className={levelOnly(band)}>
          {children(band)}
        </span>
      ))}
    </>
  );
}

function StepHeading({ step, id, title, short, note }: { step?: number; id: string; title: string; short?: string; note: string }) {
  // In the 216px left margin (≥ 1280) the heading is the short word from the folio ("Check", "Write").
  const label =
    short && title.startsWith(short) && short !== title ? (
      <>
        <span className="xl:hidden">{title}</span>
        <span className="max-xl:hidden">
          {short}
          <span className="sr-only">{title.slice(short.length)}</span>
        </span>
      </>
    ) : (
      title
    );
  return (
    <div className="grid gap-3 xl:pt-1">
      {step ? (
        <p aria-hidden="true" className="type-numeral-l max-xl:hidden">
          {step}
        </p>
      ) : null}
      <h2 id={id} className="type-h2 xl:mt-4 xl:text-[32px] xl:leading-[1.1]">
        {label}
      </h2>
      <p className="max-w-[56ch] text-ui leading-normal text-ink-2 xl:text-small xl:leading-[1.55]">{note}</p>
    </div>
  );
}

function OriginalLink({ story, className }: { story: Story; className?: string }) {
  // Inline text (not flex), so a wrapped name keeps the arrow after its last word; py keeps a 44px target.
  return (
    <a
      href={story.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cx('inline-block py-2.5 leading-snug font-bold text-ink underline decoration-2 underline-offset-[5px] hover:decoration-[3px]', className)}
    >
      Read the original at {story.sourceName}
      <IconExternal size={18} className="ml-1 inline-block align-[-3px]" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default async function ReadPage({ params }: Props) {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) notFound();

  const { content } = story;
  const vocabWords = content.vocabulary.map((v) => v.word);
  const paragraphs = { '7-8': content.levels['7-8'].paragraphs, '9-10': content.levels['9-10'].paragraphs } satisfies Record<GradeBand, string[]>;
  const titles = {
    '7-8': content.levels['7-8'].title || story.titles['7-8'],
    '9-10': content.levels['9-10'].title || story.titles['9-10'],
  } satisfies Record<GradeBand, string>;
  const levels = { '7-8': segmentLevel(paragraphs['7-8'], vocabWords), '9-10': segmentLevel(paragraphs['9-10'], vocabWords) };
  const vocabulary: ReaderVocab[] = content.vocabulary.map((v) => ({
    word: v.word,
    partOfSpeech: v.partOfSpeech,
    definition: v.definition,
    example: v.example,
    placeholder: isPlaceholderDefinition(v.definition),
    inStory: { '7-8': firstSentenceWith(paragraphs['7-8'], v.word), '9-10': firstSentenceWith(paragraphs['9-10'], v.word) },
  }));
  const quiz: QuizItem[] = content.quiz.map((q) => ({
    id: q.id,
    question: q.question,
    choices: q.choices,
    answerIndex: q.answerIndex,
    explanation: q.explanation,
    evidence: { '7-8': findEvidence(q.explanation, paragraphs['7-8']), '9-10': findEvidence(q.explanation, paragraphs['9-10']) },
  }));
  const minutes = { '7-8': lessonReadingMinutes(content, '7-8'), '9-10': lessonReadingMinutes(content, '9-10') };
  const standfirst = standfirstFor(story);
  const published = story.isSample ? null : dateFormat.format(new Date(story.publishedAt));

  const source = story.isSample ? <Tag>Practice story</Tag> : <MetaItem>From {story.sourceName}</MetaItem>;
  const minutesItem = <ByLevel>{(band) => <MetaMinutes minutes={minutes[band]} />}</ByLevel>;

  const barStart = (
    <>
      <Link
        href="/today"
        aria-label="Back to Today"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-pill text-small font-bold text-ink no-underline transition-[background-color] duration-160 hover:bg-sheet md:-ml-3 md:pr-4 md:pl-2 xl:hidden"
      >
        <IconBack />
        <span className="max-md:hidden">Today</span>
      </Link>
      <span className="md:hidden">
        <MetaCategory slug={story.category} />
      </span>
    </>
  );

  return (
    <ReaderShell>
      <ReaderRoot story={{ slug: story.slug, category: story.category, titles }}>
        <PageContainer size="page" className="pb-14 lg:pb-28">
          <Folio className="xl:pt-6">
            <FolioLeft className="hidden xl:block">
              <Link
                href="/today"
                className="-ml-3 inline-flex min-h-11 items-center gap-1 rounded-pill pr-4 pl-2 text-small font-bold text-ink no-underline transition-[background-color] duration-160 hover:bg-sheet"
              >
                <IconBack />
                Today
              </Link>
              <MetaRow as="div" className="mt-8 flex-col items-start gap-y-4">
                <MetaCategory slug={story.category} />
                {minutesItem}
                {source}
                {published ? <MetaItem>{published}</MetaItem> : null}
              </MetaRow>
              {story.isSample ? null : <OriginalLink story={story} className="mt-3 text-small" />}
            </FolioLeft>

            <FolioMain>
              <ReaderToolbar start={barStart} vocabulary={vocabulary} />
              <header className="mt-6 md:mt-8">
                <MetaRow className="xl:hidden">
                  <span className="max-md:hidden">
                    <MetaCategory slug={story.category} />
                  </span>
                  {minutesItem}
                  {source}
                </MetaRow>
                <h1 className="mt-4 max-w-[22em] type-reader-title xl:mt-0">
                  <ByLevel>{(band) => titles[band]}</ByLevel>
                </h1>
                {standfirst ? <p className="mt-5 type-standfirst">{standfirst}</p> : null}
              </header>
              <StoryBody slug={story.slug} levels={levels} />
              <FinishReading />
            </FolioMain>

            <FolioMargin>
              <WordNotes vocabulary={vocabulary} />
            </FolioMargin>
          </Folio>

          <section aria-labelledby="check-heading" className="mt-16 border-t border-line-soft pt-12 lg:mt-24 lg:pt-20">
            <Quiz
              questions={quiz}
              writeHref="#write"
              heading={<StepHeading step={2} id="check-heading" title="Check your understanding" short="Check" note="One question at a time. A wrong answer is a first try, not a fail." />}
            />
          </section>

          <section id="write" aria-labelledby="write-heading" className="mt-16 scroll-mt-24 border-t border-line-soft pt-12 lg:mt-24 lg:pt-20">
            <Folio>
              <FolioLeft>
                <StepHeading step={3} id="write-heading" title="Write back" short="Write" note="A short prompt, then notes on what’s working. Your writing stays in your journal, on this device." />
              </FolioLeft>
              <FolioMain>
                <WritePrompts
                  prompts={content.writingPrompts.map((p) => ({ id: p.id, kind: p.kind, prompt: p.prompt, minWords: p.minWords, maxWords: p.maxWords, tips: p.tips }))}
                  vocabulary={vocabWords}
                />
              </FolioMain>
            </Folio>
          </section>

          <section aria-labelledby="talk-heading" className="mt-16 border-t border-line-soft pt-12 lg:mt-24 lg:pt-20">
            <Folio>
              <FolioLeft>
                <StepHeading id="talk-heading" title="Talk about it" note="No right answers. Think it over, or ask someone at home or in class what they think." />
              </FolioLeft>
              <FolioMain>
                <ol className="grid max-w-[32em] gap-6">
                  {content.discussion.map((question, i) => (
                    <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-2">
                      <span aria-hidden="true" className="num text-ui font-extrabold text-ink-3">
                        {i + 1}
                      </span>
                      <p className="type-question">{question}</p>
                    </li>
                  ))}
                </ol>
                <div className="mt-12 max-w-[32em] border-t border-line-soft pt-6 text-ui leading-normal text-ink-2">
                  {story.isSample ? (
                    <p>
                      <Tag className="mr-2 align-middle">Practice story</Tag>
                      Wiege wrote this story for reading practice. It explains something that doesn’t change with the news.
                    </p>
                  ) : (
                    <>
                      <p>
                        Wiege retold this story from a report by {story.sourceName}
                        {published ? <>, published {published}</> : null}. The words here are ours; the reporting is theirs.
                      </p>
                      <OriginalLink story={story} className="mt-1" />
                    </>
                  )}
                </div>
              </FolioMain>
            </Folio>
          </section>
        </PageContainer>
      </ReaderRoot>
    </ReaderShell>
  );
}
