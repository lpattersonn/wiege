import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { CategoryGlyph, GLYPH_KEYS } from '@/components/glyphs/CategoryGlyph';
import { ICONS, IconClock, type IconName } from '@/components/glyphs/icons';
import { Wordmark } from '@/components/glyphs/Wordmark';
import { AppNavLinks } from '@/components/layout/AppNavLinks';
import { Folio, FolioLeft, FolioMain, FolioMargin, PageContainer, SectionHead } from '@/components/layout/PageContainer';
import { SiteShell } from '@/components/layout/Shells';
import { TabBar } from '@/components/layout/TabBar';
import { Greeting } from '@/components/local/Greeting';
import { LocalCount, ReadMarker, WordsNavLink } from '@/components/local/LocalCount';
import { PersistenceNotice } from '@/components/local/PersistenceNotice';
import { ThemeSwitch } from '@/components/local/ThemeSwitch';
import { MarginNote } from '@/components/pen/MarginNote';
import { MASTERY_LEVELS, MarkedWord } from '@/components/pen/MasteryMark';
import { AsideArrow, MiniTally, MiniTick, NoteMarkIcon, ProgressLine, Tally, TabUnderline, WordsKeptMeter } from '@/components/pen/marks';
import { Caret, PenMark, type PenKind } from '@/components/pen/PenMark';
import { StoryArt } from '@/components/story/StoryArt';
import { CategoryGrid, CategoryTile } from '@/components/story/CategoryTile';
import { StoryCardL, StoryCardM, StoryCardS, StoryGrid } from '@/components/story/StoryCard';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { CountPill, Tag } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Flashcard, FlashcardGrades } from '@/components/ui/Flashcard';
import { FreshnessLine } from '@/components/ui/FreshnessLine';
import { Kbd } from '@/components/ui/Kbd';
import { MetaCategory, MetaItem, MetaMinutes, MetaRow } from '@/components/ui/MetaRow';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { QuizChoices } from '@/components/ui/QuizChoices';
import { QuizOption } from '@/components/ui/QuizOption';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { StampGrid, StampTile } from '@/components/ui/StampTile';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { IconSearch } from '@/components/glyphs/icons';
import { BADGES } from '@/lib/progress/badges';

import { ButtonsDemo, ChipsDemo, FlashcardDemo, FormsDemo, OverlaysDemo, PenReplayDemo, QuizDemo, ReadingSettingsDemo, SegmentedDemo, SwitchDemo } from './demos';
import { HeroTapDemo, ReaderTapDemo } from './TapDemo';

export const metadata: Metadata = {
  title: 'Styleguide',
  description: 'The Wiege design system: tokens, type, the pen, glyphs and components.',
  robots: { index: false, follow: false },
};

/* ------------------------------------------------------------------------ */

const COLOURS = [
  { token: '--paper', light: '#FFFFFF', dark: '#000000', role: 'Page background', contrast: '—' },
  { token: '--sheet', light: '#F5F5F5', dark: '#141414', role: 'Raised surfaces, skeletons, hover wash', contrast: '—' },
  { token: '--ink', light: '#000000', dark: '#FFFFFF', role: 'Text, pen, filled buttons', contrast: '21.00 paper' },
  { token: '--ink-read', light: '#000000', dark: '#EBEBEB', role: 'Long-form reading text', contrast: '21.00 / 17.62' },
  { token: '--ink-2', light: '#404040', dark: '#C7C7C7', role: 'Secondary text', contrast: '10.37 / 12.42' },
  { token: '--ink-3', light: '#595959', dark: '#A3A3A3', role: 'Meta, captions, placeholders', contrast: '7.00 / 8.33' },
  { token: '--line-control', light: '#858585', dark: '#7A7A7A', role: 'Control boundaries (non-text)', contrast: '3.69 / 4.89' },
  { token: '--line-soft', light: '#D9D9D9', dark: '#2E2E2E', role: 'Decorative rules only', contrast: '1.41 / 1.55' },
];

const SPACING = [4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 112, 128];

const RADII = [
  { name: 'paper', px: 4, use: 'Cards, covers, tiles' },
  { name: 'control', px: 12, use: 'Inputs, choices, editor' },
  { name: 'card', px: 16, use: 'The flashcard' },
  { name: 'sheet', px: 20, use: 'Bottom sheet top' },
  { name: 'pill', px: 9999, use: 'Things you press' },
];

const MOTION = [
  ['press', '100ms', 'linear', 'translateY(1px)'],
  ['quick', '160ms', 'ease-out', 'Hover colour, note fade-in'],
  ['base', '200ms', 'ease-out', 'Nav slim, CTA bar, tab underline'],
  ['thunk', '240ms', 'ease-thunk', 'Stamp earned'],
  ['sheet', '280 / 200ms', 'ease-out / ease-in', 'Sheet and drawer'],
  ['flip', '360ms', 'ease-out', 'Flashcard'],
  ['pen-short', '260ms', 'ease-pen', 'Tick, underline, caret, tally'],
  ['pen', '420ms', 'ease-pen', 'Loop, squiggle, double, seal'],
  ['arrow', '320ms + 380ms delay', 'ease-pen', 'Margin-note leader'],
  ['count', '160ms', 'ease-out', 'Count badge tick'],
];

const TYPE_ROLES: Array<{ cls: string; spec: string; sample: ReactNode }> = [
  { cls: 'type-display-xl', spec: 'display-xl, Bodoni 900, clamp(36, 5.4vw, 78) / 1.04, −0.018', sample: 'Speedrunners rehearse one jump' },
  { cls: 'type-h1', spec: 'h1, Bodoni 900, 64/67, 40/42 mobile, −0.02', sample: 'Good afternoon.' },
  { cls: 'type-h2', spec: 'h2, Bodoni 800, 48/51, 32/34, −0.015', sample: 'Four corners of the news.' },
  { cls: 'type-h3', spec: 'h3, Bodoni 800, 32/36, 26/29, −0.01', sample: 'Continue reading' },
  { cls: 'type-reader-title', spec: 'reader-title, Bodoni 800, 36/40, 28/31', sample: 'Six students built a puzzle game about a lighthouse' },
  { cls: 'type-h4', spec: 'h4 / card title, Bodoni 700, 24/28, 22/26', sample: 'A skate park’s grey walls became a 90-metre mural' },
  { cls: 'type-note-word', spec: 'note-word, Bodoni 800, 34/36', sample: 'rehearse' },
  { cls: 'type-flash-word', spec: 'flash-word, Bodoni 900, 52/55, 56/59 mobile', sample: 'stamina' },
  { cls: 'type-standfirst', spec: 'standfirst, Literata 400, 21/35, 19/31, max 32em', sample: 'A speedrun is a race to finish a game as fast as possible, and the clock never lies.' },
  { cls: 'type-read', spec: 'read, Literata 400, 20/1.72, 19 mobile, max 32em (S 18, M 20, L 22, XL 24)', sample: 'It started as a science project about how light bends. Then Theo, 13, sketched a lighthouse keeper who guides ships home using nothing but mirrors.' },
  { cls: 'type-question', spec: 'question, Literata 400, 23/33, 20/29', sample: 'Why does Priya say the narrative matters more than the graphics?' },
  { cls: 'type-choice', spec: 'choice, Literata 400, 18/25', sample: 'Caring about the keeper is what keeps people playing.' },
  { cls: 'type-ui', spec: 'ui, Atkinson 400, 17/26', sample: 'To practise something again and again before you do it for real.' },
  { cls: 'type-ui-strong', spec: 'ui-strong, Atkinson 700, 17/24 (buttons 17, nav 16)', sample: 'Start reading' },
  { cls: 'type-lead-ui', spec: 'lead-ui, Atkinson 800, 21/28, −0.005', sample: 'Real news from the last four hours, turned into reading practice for ages 12 to 15.' },
  { cls: 'type-lede', spec: 'lede, Atkinson 400, 18/1.55, --ink-2, 56ch', sample: 'Pick the one you’re into. Every story is rewritten at your grade.' },
  { cls: 'type-small', spec: 'small, Atkinson 600, 15/22', sample: 'Question 2 of 5' },
  { cls: 'type-caption', spec: 'caption, Atkinson 400, 14/20, minimum size', sample: 'Free. No sign-up. Your progress stays on this device.' },
  { cls: 'type-micro', spec: 'micro, Atkinson 700, 12/14, tab labels and badges only', sample: 'Journal' },
  { cls: 'type-numeral-xl', spec: 'numeral-xl, Atkinson 800, 112/90, 88/72, tabular', sample: '12' },
  { cls: 'type-numeral-l', spec: 'numeral-l, Atkinson 800, 88/70, 64/52, tabular', sample: '3' },
 { cls: 'type-hand', spec: 'hand, Nanum Pen Script 400, 26/26, 24 mobile, aria-hidden asides only', sample: 'try it: tap a dotted word' },
];

const PEN_KINDS: Array<{ kind: PenKind; label: string; word: string }> = [
  { kind: 'loop', label: 'loop, this word; Know it cold', word: 'narrative' },
  { kind: 'squiggle', label: 'squiggle, Seen it', word: 'stamina' },
  { kind: 'underline', label: 'underline, Getting there', word: 'rehearse' },
  { kind: 'double', label: 'double, Nearly; a strong phrase', word: 'momentum' },
  { kind: 'strike', label: 'strike, crossed out', word: 'hopefully' },
];

/* ------------------------------------------------------------------------ */

function Block({ id, title, lede, children }: { id: string; title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line-soft py-14 lg:py-20">
      <SectionHead id={`${id}-h`} title={title} lede={lede} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-14">{children}</div>
    </section>
  );
}

function Specimen({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `min-w-0 ${className}` : 'min-w-0'}>
      <h3 className="type-h3">{title}</h3>
      {note ? <p className="mt-2 max-w-[64ch] text-small leading-snug text-ink-2">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-caption font-bold text-ink-3">{children}</p>;
}

const TOC = [
  ['tokens', 'Tokens'],
  ['type', 'Type'],
  ['pen', 'The pen'],
  ['glyphs', 'Glyphs and icons'],
  ['controls', 'Controls'],
  ['feedback', 'Quiz, cards, progress'],
  ['story', 'Stories'],
  ['layout', 'Layout'],
  ['device', 'On this device'],
  ['tap', 'Tap a word'],
];

export default function StyleguidePage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <SiteShell>
      <PageContainer className="pt-12 pb-24 lg:pt-16">
        <h1 className="type-h1">Styleguide</h1>
        <p className="mt-3 type-lede">
          Fancy type, one pen, and the student holds it. Every token, type role, pen mark, glyph and component, live. Development only.
        </p>
        <p className="mt-2 text-small text-ink-2">
          See the app shell with the tab bar at{' '}
          <Link href="/styleguide/app-shell" className="font-bold underline decoration-2 underline-offset-[5px]">
            /styleguide/app-shell
          </Link>
          .
        </p>
        <nav aria-label="Styleguide sections" className="mt-8 flex flex-wrap gap-x-6 gap-y-1">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-11 min-w-11 items-center justify-center font-bold text-ink underline decoration-2 underline-offset-[5px] hover:decoration-[3px]">
              {label}
            </a>
          ))}
        </nav>

        {/* ------------------------------------------------------------ Tokens */}
        <Block id="tokens" title="Tokens" lede="Black, white and grey only. State by shape, never by hue. Contrast written next to every token.">
          <Specimen title="Colour" note="Light and dark values. Text only ever uses --ink, --ink-read, --ink-2 or --ink-3.">
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {COLOURS.map((c) => (
                <li key={c.token} className="grid gap-2">
                  <span className="h-16 rounded-paper border border-line-control" style={{ background: `var(${c.token})` }} aria-hidden="true" />
                  <span className="font-bold">{c.token}</span>
                  <span className="num text-caption text-ink-2">
                    {c.light} light, {c.dark} dark
                  </span>
                  <span className="text-caption text-ink-3">
                    {c.role}. Contrast {c.contrast}.
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8 inv grid gap-1 rounded-paper p-6">
              <p className="font-title text-[26px] font-bold">Inverted surface (.inv)</p>
              <p className="text-small">Closing band, lead cover, toast, filled button, count badge. In dark mode it becomes a white panel.</p>
            </div>
          </Specimen>

          <Specimen title="Spacing" note="An 8px rhythm. 4 and 12 only inside components. Tailwind: --spacing is 4px, so p-2 = 8px.">
            <ul className="grid gap-2">
              {SPACING.map((px) => (
                <li key={px} className="flex items-center gap-4 text-caption">
                  <span className="num w-12 text-right font-bold">{px}</span>
                  <span className="h-3 rounded-paper bg-ink" style={{ width: px }} aria-hidden="true" />
                  <span className="num text-ink-3">{px / 4}</span>
                </li>
              ))}
            </ul>
          </Specimen>

          <Specimen title="Radii and borders" note="Radius means something: paper is 4, controls 12, the index card 16, the sheet 20, things you press are pills.">
            <ul className="flex flex-wrap gap-6">
              {RADII.map((r) => (
                <li key={r.name} className="grid justify-items-start gap-2">
                  <span className="block h-20 w-28 border-[1.5px] border-ink" style={{ borderRadius: Math.min(r.px, 40) }} aria-hidden="true" />
                  <span className="font-bold">
                    {r.name} <span className="num font-semibold text-ink-3">{r.px === 9999 ? '9999' : r.px}px</span>
                  </span>
                  <span className="text-caption text-ink-3">{r.use}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <li className="rounded-paper border border-line-soft p-4 text-small">1px --line-soft, decorative</li>
              <li className="rounded-control border-[1.5px] border-line-control p-4 text-small">1.5px --line-control, controls</li>
              <li className="rounded-control border-2 border-ink p-4 text-small">2px --ink, selected, correct, error</li>
              <li className="rounded-control border-[1.5px] border-dashed border-line-control p-4 text-small text-ink-3">Dashed, disabled, pending</li>
            </ul>
          </Specimen>

          <Specimen title="Motion" note="Only responses to the student and sticky chrome move. Reduced motion shows final states.">
            {/* Scrolls sideways below 560px: focusable and named, so keyboard users can scroll it (WCAG 2.1.1). */}
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Motion tokens table">
              <table className="w-full min-w-[560px] border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-ink">
                    <th scope="col" className="py-2 pr-4">Token</th>
                    <th scope="col" className="py-2 pr-4">Duration</th>
                    <th scope="col" className="py-2 pr-4">Easing</th>
                    <th scope="col" className="py-2">Used for</th>
                  </tr>
                </thead>
                <tbody>
                  {MOTION.map(([name, dur, ease, use]) => (
                    <tr key={name} className="border-b border-line-soft">
                      <th scope="row" className="py-2 pr-4 font-bold">{name}</th>
                      <td className="num py-2 pr-4">{dur}</td>
                      <td className="py-2 pr-4 text-ink-2">{ease}</td>
                      <td className="py-2 text-ink-2">{use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Specimen>
        </Block>

        {/* ------------------------------------------------------------ Type */}
        <Block id="type" title="Type" lede="Bodoni Moda dresses up at 20px and above. Literata carries all reading. Atkinson Hyperlegible Next carries everything you operate, and every numeral.">
          <ul className="grid gap-8">
            {TYPE_ROLES.map((role) => (
              <li key={role.cls} className="grid gap-2 border-b border-line-soft pb-6">
                <p className="text-caption font-bold text-ink-3">{role.spec}</p>
                <p className={role.cls}>{role.sample}</p>
              </li>
            ))}
          </ul>
        </Block>

        {/* ------------------------------------------------------------ Pen */}
        <Block id="pen" title="The pen" lede="One primitive, seeded and server-rendered in its final state. It only marks meaning: a word you tapped, an answer, your writing, your progress.">
          <Specimen title="Marks" note="Same seed, same mark, on the server and the client. Stroke = --pen-w × --pen-scale; 2px light, 2.4px with a gel sheen in dark.">
            <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {PEN_KINDS.map((p) => (
                <li key={p.kind}>
                  <Label>{p.label}</Label>
                  <span className="font-title text-[34px] leading-[1.2] font-bold">
                    <span className="marked" data-pen-context="list">
                      {p.word}
                      <PenMark kind={p.kind} word={p.word} font="display-700" context="list" />
                    </span>
                  </span>
                </li>
              ))}
              <li>
                <Label>ring, cross, tick, caret, box</Label>
                <div className="flex items-center gap-8">
                  <span className="relative inline-grid size-9 place-items-center font-extrabold">
                    B<PenMark kind="ring" word="B" />
                  </span>
                  <span className="relative inline-grid size-9 place-items-center font-extrabold">
                    A<PenMark kind="cross" word="A" />
                  </span>
                  <span className="relative block h-[26px] w-[30px]">
                    <PenMark kind="tick" />
                  </span>
                  <span className="draft font-read text-[20px] leading-[1.9]">
                    a<span className="relative inline-block h-[1em] w-0">
                      <Caret />
                    </span>{' '}
                    girl
                  </span>
                  <span className="relative block size-[22px]">
                    <PenMark kind="box" word="box" className="inset-0 size-full" />
                  </span>
                </div>
              </li>
            </ul>
          </Specimen>

          <Specimen title="Draw-in" note="Client-only, for marks the student just made. The loop starts on pointerdown.">
            <PenReplayDemo />
          </Specimen>

          <Specimen title="Mastery" note="The mark equals the Leitner box, 1:1.">
            <ul className="word-list grid max-w-[640px] gap-1">
              {MASTERY_LEVELS.map((m) => (
                <li key={m.level} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line-soft">
                  <span className="justify-self-start font-title text-[30px] leading-[1.2] font-bold">
                    <MarkedWord word={['gleam', 'stamina', 'rehearse', 'momentum', 'narrative'][m.level - 1]} level={m.level} />
                  </span>
                  <span className="text-right text-small font-bold text-ink-2">
                    {m.label}
                    <small className="block text-caption font-normal text-ink-3">{m.next}</small>
                  </span>
                </li>
              ))}
            </ul>
          </Specimen>

          <Specimen title="Tally, seals, progress, meter" note="Numbers always have a text label. The tally and seals are role=img with plain-language labels.">
            <div className="grid gap-10">
              <div className="flex flex-wrap items-end gap-10">
                <div>
                  <p className="type-numeral-xl" aria-hidden="true">
                    12
                  </p>
                  <p className="mt-2 text-ui font-bold">days in a row</p>
                </div>
                <Tally count={12} />
                <Tally count={3} pending={false} />
                <div className="flex items-center gap-2 text-small text-ink-2">
                  <MiniTally count={12} />
                  <span>
                    <b className="font-extrabold text-ink">12 days</b> in a row
                  </span>
                </div>
              </div>
              <StampGrid>
                {BADGES.slice(0, 8).map((b, i) => (
                  <StampTile key={b.id} id={b.id} name={b.name} how={b.hint} earned={i < 4} />
                ))}
              </StampGrid>
              <div className="grid max-w-[520px] gap-4">
                <ProgressBar value={0} max={5} label="Question 1 of 5" />
                <ProgressBar value={2} max={5} label="Question 2 of 5" />
                <ProgressBar value={560} min={300} max={700} label="140 XP to Wordsmith" name="Level progress" />
                <ProgressBar value={5} max={5} label="Card 5 of 5" />
              </div>
              <div className="grid gap-3">
                <WordsKeptMeter kept={0} />
                <WordsKeptMeter kept={1} />
                <WordsKeptMeter kept={3} />
              </div>
            </div>
          </Specimen>

          <Specimen title="Notes, asides, small marks" note="Handwritten asides: one per viewport, 1–5 words, lowercase, aria-hidden, rotated −3° to +3°.">
            <div className="grid gap-10 lg:grid-cols-2">
              <MarginNote id="sg-static-note" open placement="inline" role="status" label="Quiz note" className="my-0!">
                <p className="font-title text-[26px] leading-[1.1] font-bold">Got it on the second try.</p>
                <p className="mt-3">Look at Priya’s last sentence: “If you care about the keeper, you keep playing.”</p>
                <p className="mt-2 text-small leading-[22px] text-ink-3">
                  <b className="text-ink">Reading tip.</b> Answers often hide inside quotes.
                </p>
              </MarginNote>
              <div className="grid content-start gap-6">
                <p className="flex items-end gap-1" aria-hidden="true">
         <span className="type-hand">try it: tap a dotted word</span>
                  <AsideArrow direction="down" />
                </p>
                <p className="flex flex-col items-start" aria-hidden="true">
         <span className="type-hand">what yours could look like</span>
                  <AsideArrow direction="right" className="mt-[-2px] ml-20" />
                </p>
                <div className="flex flex-wrap items-center gap-6">
                  <TabUnderline />
                  <MiniTick />
                  <NoteMarkIcon kind="loop" />
                  <NoteMarkIcon kind="double" />
                  <NoteMarkIcon kind="caret" />
                  <NoteMarkIcon kind="squiggle" />
                  <NoteMarkIcon kind="underline" />
                </div>
              </div>
            </div>
          </Specimen>
        </Block>

        {/* ------------------------------------------------------------ Glyphs */}
        <Block id="glyphs" title="Glyphs and icons" lede="Four hand-drawn category glyphs are the only illustrations. UI icons are 20px, 1.8 stroke, round, never filled.">
          <Specimen title="Category glyphs" note="Stroke 2.4 at 72, 2.2 at 56, 1.8 at 26–34, 1.7 at 22–30.">
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {GLYPH_KEYS.map((g) => (
                <li key={g} className="flex flex-wrap items-end gap-5">
                  <CategoryGlyph glyph={g} size={72} />
                  <CategoryGlyph glyph={g} size={56} />
                  <CategoryGlyph glyph={g} size={34} />
                  <CategoryGlyph glyph={g} size={22} />
                  <span className="w-full text-caption font-bold text-ink-3">{g}</span>
                </li>
              ))}
            </ul>
          </Specimen>
          <Specimen title="UI icons">
            <ul className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-9">
              {(Object.keys(ICONS) as IconName[]).map((name) => {
                const Icon = ICONS[name];
                return (
                  <li key={name} className="grid justify-items-center gap-2 rounded-paper border border-line-soft px-2 py-4">
                    <Icon />
                    <span className="text-caption text-ink-2">{name}</span>
                  </li>
                );
              })}
            </ul>
          </Specimen>
          <Specimen title="Wordmark">
            <div className="flex flex-wrap items-end gap-10">
              <Wordmark />
              <Wordmark size={26} />
              <span className="inv inline-flex rounded-paper px-4 py-2">
                <Wordmark size={26} className="text-paper" />
              </span>
            </div>
          </Specimen>
        </Block>

        {/* ------------------------------------------------------------ Controls */}
        <Block id="controls" title="Controls" lede="Pills you press, 12px boxes you type into. Every target is at least 44 × 44 with 8px between.">
          <Specimen title="Buttons" note="Primary is the one next step per viewport. Loading keeps the width; disabled is dashed, never faded.">
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center gap-4">
                <Button>Start reading</Button>
                <Button variant="secondary">Read this story</Button>
                <Button variant="ghost">See all</Button>
                <Button size="sm">Save</Button>
                <Button variant="secondary" size="sm">
                  Start reading
                </Button>
                <IconButton label="Reading settings" icon={<ICONS.aa />} />
                <IconButton label="Back to Today" icon={<ICONS.back />} bare />
                <IconButton label="Listening" icon={<ICONS.pause />} pressed />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button disabled>Save word</Button>
                <Button variant="secondary" disabled>
                  Practise anyway
                </Button>
                <Button loading>Save a backup file</Button>
                <LinkButton href="/today" variant="secondary">
                  A link that looks like a button
                </LinkButton>
              </div>
              <ButtonsDemo />
              <div className="inv flex flex-wrap items-center gap-4 rounded-paper p-8">
                <Button>Start reading</Button>
                <Button variant="secondary">Secondary on ink</Button>
                <p className="text-caption">Free. No sign-up. New stories every four hours.</p>
              </div>
              <div className="max-w-[390px]">
                <Button block>Keep reading</Button>
              </div>
            </div>
          </Specimen>
          <Specimen title="Fields" note="Label above, helper below. Errors say what to do, with a 2px border, the hatch strip and a circled “!”.">
            <FormsDemo />
          </Specimen>
          <Specimen title="Segmented" note="A fieldset of radio inputs: arrow keys move, the legend names the group.">
            <SegmentedDemo />
          </Specimen>
          <Specimen title="Chips, tags, count pills">
            <div className="grid gap-6">
              <ChipsDemo />
              <div className="flex flex-wrap items-center gap-4">
                <Tag>Practice story</Tag>
                <CountPill value={0} />
                <CountPill value={23} />
                <CountPill value={23} size={24} />
                <CountPill value={5} size={18} />
                <CountPill value={null} />
              </div>
            </div>
          </Specimen>
          <Specimen title="Switch">
            <SwitchDemo />
          </Specimen>
          <Specimen title="Popover, sheets, drawer, toast" note="Word sheets are non-modal; settings and confirmations are modal dialogs that trap and restore focus.">
            <OverlaysDemo />
          </Specimen>
          <Specimen title="Reading settings" note="Controlled: persist with setPrefs and apply with the data attributes from readingPrefsAttributes().">
            <ReadingSettingsDemo />
          </Specimen>
        </Block>

        {/* ------------------------------------------------------------ Feedback */}
        <Block id="feedback" title="Quiz, cards, progress" lede="Right and wrong without colour: border weight and style, a hatch strip, a pen mark and a text label.">
          <Specimen title="Quiz option states">
            {/* States that never share a question, so each specimen is its own one-option group. */}
            <div className="grid max-w-[36em] gap-3">
              <QuizChoices label="Example: first try">
                <QuizOption letter="A" state="first-try" aside disabled scope="sg-static">
                  The team couldn’t afford good graphics.
                </QuizOption>
              </QuizChoices>
              <QuizChoices label="Example: right answer">
                <QuizOption letter="B" state="correct" disabled scope="sg-static">
                  Caring about the keeper is what keeps people playing.
                </QuizOption>
              </QuizChoices>
              <QuizChoices label="Example: selected">
                <QuizOption letter="C" state="selected">
                  The game is mostly about the science of light.
                </QuizOption>
              </QuizChoices>
              <QuizChoices label="Example: a later wrong pick">
                <QuizOption letter="D" state="incorrect" disabled scope="sg-static">
                  Ada’s music was the best part of the game.
                </QuizOption>
              </QuizChoices>
              <QuizChoices label="Example: idle">
                <QuizOption letter="E">An idle choice, with hover and focus states.</QuizOption>
              </QuizChoices>
            </div>
          </Specimen>
          <Specimen title="Try it">
            <QuizDemo />
          </Specimen>
          <Specimen title="Flashcard" note="Space flips; 1–4 grade. Good moves the pen mark up one step, and that redraw is the reward.">
            <div className="grid gap-10 lg:grid-cols-2">
              <FlashcardDemo />
              <div className="grid content-start gap-6">
                <Flashcard word="momentum" mastery={4} definition="The push that keeps something moving once it has started." example="After the first goal, the team had all the momentum." flipped />
                <FlashcardGrades />
                <p className="text-caption text-ink-3">
                  <Kbd>Space</Kbd> flips the card. <Kbd>1</Kbd>–<Kbd>4</Kbd> grade it.
                </p>
              </div>
            </div>
          </Specimen>
          <Specimen title="Stat tiles">
            <StatGrid>
              <StatTile value={14} label="stories read" />
              <StatTile value={<LocalCount kind="words" />} label="words on this device" />
              <StatTile value={4} label="journal entries" />
              <StatTile value={12} label="best streak" progress={0.4} />
            </StatGrid>
          </Specimen>
          <Specimen title="Empty states and skeletons" note="Empty states say what will live here and give one action. Skeletons are the exact final size.">
            <div className="grid gap-10 lg:grid-cols-2">
              <EmptyState sketch="words" title="Your words will live here." headingLevel="h4" action={<LinkButton href="/today">Read today’s story</LinkButton>}>
                Tap any dotted word in a story, then Save word.
              </EmptyState>
              <EmptyState sketch="journal" title="Your writing stays here, on this device." headingLevel="h4" action={<LinkButton href="/today" variant="secondary">Write about today’s story</LinkButton>}>
                Every story ends with a short prompt.
              </EmptyState>
            </div>
            <div className="mt-8 grid max-w-[437px] gap-4" aria-label="Loading example" role="img">
              <Skeleton height={246} />
              <Skeleton width="40%" height={22} />
              <SkeletonText lines={2} lineHeight={28} />
            </div>
          </Specimen>
          <Specimen title="Meta row and freshness">
            <div className="grid gap-4">
              <MetaRow>
                <Tag>Practice story</Tag>
                <MetaCategory slug="games" />
                <MetaMinutes minutes={3} />
                <MetaItem>Grade 7–8</MetaItem>
              </MetaRow>
              <FreshnessLine lastSuccessAt={null} mode="at" />
              <p className="flex items-center gap-2 text-caption text-ink-3">
                <IconClock /> Updated 2 hours ago. Next drop in 1 h 52 min.
              </p>
            </div>
          </Specimen>
        </Block>

        {/* ------------------------------------------------------------ Story */}
        <Block id="story" title="Stories" lede="Covers are the key word, fitted to the width and never cropped, with one pen mark. The whole card is one link.">
          <Specimen title="Covers" note="The mark is chosen by fnv1a(slug) % 4. No word, or one over 12 letters, falls back to the glyph.">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <StoryArt slug="six-students-lighthouse" category="games" word="prototype" inverted pick />
              <StoryArt slug="skate-park-mural-weekend" category="art" word="mural" />
              <StoryArt slug="relay-team-baton-record" category="sports" word="momentum" />
              <StoryArt slug="comic-gran-bakery-print" category="writing" word={null} />
            </div>
          </Specimen>
          <Specimen title="Cards">
            <div className="grid gap-10">
              <StoryGrid>
                <StoryCardM
                  href="/read/six-students-lighthouse"
                  slug="six-students-lighthouse"
                  category="games"
                  word="prototype"
                  inverted
                  pick
                  minutes={5}
                  headingLevel="h4"
                  title="Six students built a puzzle game about a lighthouse. Version one was cardboard."
                  summary="It started as a science project about light, and a lot of arguing."
                  status={<ReadMarker slug="six-students-lighthouse" />}
                />
                <StoryCardM
                  href="/read/skate-park-mural-weekend"
                  slug="skate-park-mural-weekend"
                  category="art"
                  word="mural"
                  minutes={4}
                  headingLevel="h4"
                  title="A skate park’s grey walls became a 90-metre mural in one weekend"
                  summary="Forty painters, one rule: nobody paints over anybody else."
                />
                <StoryCardM
                  href="/read/relay-team-baton-record"
                  slug="relay-team-baton-record"
                  category="sports"
                  word="momentum"
                  minutes={4}
                  tag={<Tag>Practice story</Tag>}
                  headingLevel="h4"
                  title="The relay team that dropped the baton, then broke the school record"
                  summary="What they changed in the eleven days between the two races."
                />
              </StoryGrid>
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
                <div className="grid content-start gap-3">
                  <StoryCardS
                    href="/read/relay-team-baton-record"
                    category="sports"
                    inkThumb
                    headingLevel="h4"
                    title="The relay team that dropped the baton, then broke the school record"
                    meta="Question 3 of 5 next"
                    progress={<ProgressLine value={0.6} width={120} height={10} />}
                  />
                  <StoryCardS
                    href="/read/skate-park-mural-weekend"
                    category="art"
                    headingLevel="h4"
                    title="A skate park’s grey walls became a 90-metre mural in one weekend"
                    meta="Paragraph 2 of 5"
                    progress={<ProgressLine value={0.3} width={120} height={10} />}
                  />
                </div>
                <StoryCardL
                  href="/read/comic-gran-bakery-print"
                  slug="comic-gran-bakery-print"
                  category="writing"
                  word="manuscript"
                  headingLevel="h4"
                  why="Picked from Writing, the corner you’ve read least this week."
                  title="A 13-year-old’s comic about her gran’s bakery is going to print"
                  minutes={4}
                  newWords={4}
                />
              </div>
            </div>
          </Specimen>
          <Specimen title="Category tiles">
            <CategoryGrid>
              <CategoryTile category="writing" newToday={6} headingLevel="h4" latest={['A 13-year-old’s comic about her gran’s bakery is going to print']} />
              <CategoryTile category="games" newToday={9} headingLevel="h4" latest={['A board game where the map changes every turn']} />
              <CategoryTile category="art" newToday={0} headingLevel="h4" latest={['A museum lets visitors sketch its statues after dark']} />
              <CategoryTile category="sports" newToday={11} headingLevel="h4" latest={['Climbers who read a wall before they touch it']} />
            </CategoryGrid>
          </Specimen>
        </Block>

        {/* ------------------------------------------------------------ Layout */}
        <Block id="layout" title="Layout" lede="The folio is the signature grid: a printed left margin, the text column and a right margin where the pen works.">
          <Specimen title="Folio" note="≥1280: 216 | 1fr | 312, gap 48. 1024–1279: 1fr | 288 with the left margin above. Below: one column.">
            <Folio>
              <FolioLeft className="rounded-paper border-[1.5px] border-dashed border-line-control p-4 text-small text-ink-2">Left margin: pitch, step numbers, back link, meta</FolioLeft>
              <FolioMain className="rounded-paper border-[1.5px] border-ink p-4">
                <p className="type-read">The text column: 32em of Literata at 1.72, 56 to 70 characters per line. Nothing moves, overlaps or sits behind it.</p>
              </FolioMain>
              <FolioMargin className="rounded-paper border-[1.5px] border-dashed border-line-control p-4 text-small text-ink-2">Right margin: pen notes</FolioMargin>
            </Folio>
          </Specimen>
          <Specimen title="App navigation" note="From 768px: the five destinations as pills. Below 768px: the tab bar, 56px plus the safe area.">
            <div className="grid gap-8">
              <div className="flex h-16 items-center gap-4 overflow-x-auto rounded-control border-[1.5px] border-line-soft px-6">
                <Wordmark size={26} />
                <AppNavLinks className="ml-6" previewPath="/today" />
                <span className="ml-auto" />
                <span aria-hidden="true" className="inline-grid size-11 shrink-0 place-items-center rounded-pill border-[1.5px] border-line-control">
                  <IconSearch />
                </span>
              </div>
              <div className="max-w-[390px] overflow-hidden rounded-control border-[1.5px] border-line-soft">
                <TabBar preview previewPath="/today" />
              </div>
            </div>
          </Specimen>
        </Block>

        {/* ------------------------------------------------------------ Device */}
        <Block id="device" title="On this device" lede="Islands that read the on-device store. On the server they render a same-size placeholder, so nothing shifts when they fill in.">
          <div className="grid gap-6 text-ui">
            <Greeting as="p" />
            <p>
              <b className="font-extrabold">
                <LocalCount kind="words" /> words
              </b>
              , <LocalCount kind="dueWords" /> to practise. Streak: <LocalCount kind="streak" /> days.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <WordsNavLink />
              <WordsNavLink variant="app" current />
              <ReadMarker slug="six-students-lighthouse" className="visible!" />
            </div>
            <ThemeSwitch showLegend />
            <PersistenceNotice />
          </div>
        </Block>

        {/* ------------------------------------------------------------ Tap */}
        <Block id="tap" title="Tap a word" lede="The give-before-you-ask demo and the reader. Desktop: the note in the margin with a leader arrow. Mobile: inline under the block, or the non-modal word sheet in the reader.">
          <HeroTapDemo />
          <ReaderTapDemo />
        </Block>
      </PageContainer>
    </SiteShell>
  );
}
