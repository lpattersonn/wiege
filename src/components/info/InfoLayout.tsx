import Link from 'next/link';
import { Fragment, type ComponentProps, type ReactNode } from 'react';

import { cx } from '@/components/ui/cx';

import { curlyQuotes, splitNumerals } from './typography';

/**
 * The info-page folio (DESIGN §12.9, §5.3): a sticky table of contents in the
 * left margin, reading prose in the text column and plain bracketed callouts
 * in the right margin. No pen marks: nobody is reading here to learn a word.
 *
 * ≥ 1280: 216 | 1fr | 312 (gaps 48), contents sticky beside the text.
 * 1024–1279: the contents become a row above; sections are 1fr | 288.
 * < 1024: one column; each callout follows its section's text.
 *
 * Server components only: these pages ship no JavaScript of their own.
 */

export interface TocEntry {
  id: string;
  label: string;
}

export function InfoPage({
  title,
  lede,
  meta,
  intro,
  toc,
  children,
}: {
  title: ReactNode;
  lede: ReactNode;
  /** A small line under the lede (e.g. "Last updated …"). */
  meta?: ReactNode;
  /** Content that belongs before the contents list on small screens (e.g. a summary). */
  intro?: ReactNode;
  toc: readonly TocEntry[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-(--gutter) pt-10 pb-16 md:pt-14 lg:pt-16 lg:pb-28">
      <div className="grid xl:grid-cols-[216px_minmax(0,1fr)] xl:gap-x-12">
        <header className="max-w-[760px] xl:col-start-2 xl:row-start-1">
          <h1 className="type-h1">{title}</h1>
          <p className="mt-3 type-lede">{lede}</p>
          {meta ? <div className="mt-4">{meta}</div> : null}
        </header>
        {intro ? <div className="mt-10 min-w-0 lg:mt-12 xl:col-start-2 xl:row-start-2">{intro}</div> : null}
        <InfoToc entries={toc} className={cx('mt-10 xl:col-start-1 xl:row-start-1 xl:mt-0', intro ? 'xl:row-span-3' : 'xl:row-span-2')} />
        <div className={cx('mt-12 grid min-w-0 gap-y-14 lg:mt-16 lg:gap-y-20 xl:col-start-2', intro ? 'xl:row-start-3' : 'xl:row-start-2')}>{children}</div>
      </div>
    </div>
  );
}

/** "On this page": a row above the text below 1280px, a sticky margin list beside it from 1280px. */
function InfoToc({ entries, className }: { entries: readonly TocEntry[]; className?: string }) {
  return (
    <nav aria-labelledby="toc-label" className={cx('min-w-0', className)}>
      <div className="border-y border-line-soft py-3 xl:sticky xl:top-24 xl:border-y-0 xl:py-0">
        <p id="toc-label" className="text-caption font-bold text-ink-3 xl:mt-3">
          On this page
        </p>
        <ul className="mt-1 grid md:grid-cols-2 md:gap-x-8 lg:flex lg:flex-wrap lg:gap-x-8 xl:grid xl:grid-cols-1 xl:gap-x-0">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                className="inline-flex min-h-11 items-center text-small leading-snug font-bold text-ink no-underline decoration-2 underline-offset-[5px] hover:underline"
              >
                {entry.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/**
 * One section of an info page: `h2` (32 desktop, 26 mobile) and prose in the
 * text column, with an optional bracketed callout in the right margin.
 */
export function InfoSection({ id, title, note, children }: { id: string; title: ReactNode; note?: ReactNode; children: ReactNode }) {
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="grid scroll-mt-24 gap-x-12 lg:grid-cols-[minmax(0,1fr)_288px] xl:grid-cols-[minmax(0,1fr)_312px]">
      <div className="min-w-0">
        <h2 id={headingId} className="type-h3">
          {title}
        </h2>
        <div className="mt-5 grid justify-items-start gap-5">{children}</div>
      </div>
      {note ? <div className="mt-8 lg:mt-2">{note}</div> : null}
    </section>
  );
}

/**
 * A plain bracketed callout (a straight typographic bracket, not the pen):
 * a bold lead-in and one or two sentences. Supplementary only: nothing
 * essential lives only here.
 */
export function Callout({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="note"
      className={cx(
        'relative max-w-[32em] border-l-[1.5px] border-ink py-1 pl-5 text-small leading-[22px] font-normal text-ink-2',
        "before:absolute before:top-0 before:left-0 before:h-[1.5px] before:w-2.5 before:bg-ink before:content-['']",
        "after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-2.5 after:bg-ink after:content-['']",
        className,
      )}
    >
      <p>
        <strong className="font-bold text-ink">{label}</strong> {children}
      </p>
    </div>
  );
}

/** A sub-heading inside a section (Bodoni 700, 24/22). */
export function SubHead({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mt-4 scroll-mt-24 type-h4">
      {children}
    </h3>
  );
}

/** A paragraph of reading prose (Literata 20/19, 1.72, max 32em). */
export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('type-read', className)}>{children}</p>;
}

/** A bulleted list in reading type. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx('type-read grid list-disc gap-2 pl-[1.1em] marker:text-ink-3', className)}>{children}</ul>;
}

/** A numbered list in reading type; the numbers are Atkinson (DESIGN §3.2). */
export function NumberedList({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cx('type-read grid list-decimal gap-3 pl-[1.3em] marker:font-ui marker:font-extrabold marker:text-ink', className)}>{children}</ol>;
}

/** A list item with a bold lead-in ("Back up. In Settings, …"). */
export function Lead({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

/**
 * Numerals inside prose are set in Atkinson with tabular figures (DESIGN §3.2).
 * `leading-none` keeps Atkinson's taller metrics from stretching the Literata line.
 */
export function N({ children }: { children: ReactNode }) {
  return <span className="num leading-none">{children}</span>;
}

/** A plain string typeset for prose: curly quotes, numerals in Atkinson. */
export function Typeset({ text }: { text: string }) {
  return (
    <>
      {splitNumerals(curlyQuotes(text)).map((run, index) => (
        <Fragment key={index}>{run.numeral ? <span className="num leading-none">{run.text}</span> : run.text}</Fragment>
      ))}
    </>
  );
}

const LINK = 'underline decoration-2 underline-offset-[5px] hover:decoration-[3px]';

/** An inline link inside prose (internal routes use next/link). */
export function TextLink({ href, children, className, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={cx(LINK, className)} {...rest}>
      {children}
    </Link>
  );
}

/** An inline link to another site or a mailto: address. */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={cx(LINK, className)}>
      {children}
    </a>
  );
}

/**
 * The read–check–write sequence: an ordered list with Atkinson 800 step
 * numbers (decorative; the list itself carries the order) and Bodoni titles.
 */
export function Steps({ steps }: { steps: ReadonlyArray<{ title: string; body: ReactNode }> }) {
  return (
    <ol className="grid w-full gap-8">
      {steps.map((step, index) => (
        <li key={step.title} className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-4 md:grid-cols-[56px_minmax(0,1fr)]">
          <span aria-hidden="true" className="num text-[40px] leading-[0.9] font-extrabold tracking-[-0.04em] md:text-[48px]">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="type-h4">{step.title}</h3>
            <p className="mt-2 type-read">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
