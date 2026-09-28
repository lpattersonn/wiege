'use client';

import Link from 'next/link';

import { useDueCount } from '@/components/local/hooks';
import { InlineScript } from '@/components/local/InlineScript';

/**
 * The practise panel (DESIGN §12.2): shown only when words are due (the
 * Today root's `data-due` flag), with the real count. On a hard load the
 * count is written by the inline script at the end of the panel before
 * first paint, so the heading wraps exactly as it will after hydration.
 */
const FILL =
  '(function(){var s=document.currentScript,r=s&&s.closest("[data-today]"),n=r&&r.getAttribute("data-duen");' +
  'if(!n||!s.parentElement)return;var e=s.parentElement.querySelectorAll("[data-due-n]");for(var i=0;i<e.length;i++)e[i].textContent=n})()';

function DueNumber({ value, className }: { value: string; className?: string }) {
  return (
    <span data-due-n="" className={className} suppressHydrationWarning>
      {value}
    </span>
  );
}

/** "words are" / "word is" by the root's `data-one` flag (set before paint, like the count). */
function Plural({ many, one }: { many: string; one: string }) {
  return (
    <>
      <span className="group-data-[one=1]/today:hidden">{many}</span>
      <span className="hidden group-data-[one=1]/today:inline">{one}</span>
    </>
  );
}

export function TodayPractice() {
  const due = useDueCount();
  const n = due === null ? '' : String(due);
  return (
    <section
      aria-labelledby="practise-h"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-paper border border-line-soft p-5"
    >
      <div>
        <h2 id="practise-h" className="font-title text-[22px] leading-[1.15] font-bold text-balance text-ink">
          <DueNumber value={n} className="num" /> <Plural many="words are" one="word is" /> ready
        </h2>
        <p className="mt-1 text-small leading-snug text-ink-2">Flip each card, then say how well you knew it.</p>
        <p className="mt-2">
          <Link
            href="/words/practice"
            className="inline-flex min-h-11 items-center font-bold text-ink underline decoration-2 underline-offset-[5px] hover:decoration-[3px]"
          >
            Practise&nbsp;
            <DueNumber value={n} className="num" />
            &nbsp;
            <Plural many="words" one="word" />
          </Link>
        </p>
      </div>
      <div aria-hidden="true" className="relative mr-1 h-16 w-[88px]">
        <span className="absolute inset-0 -translate-x-1.5 translate-y-0.5 -rotate-[7deg] rounded-control border-[1.5px] border-ink bg-paper" />
        <span className="absolute inset-0 translate-x-1 -translate-y-0.5 rotate-[4deg] rounded-control border-[1.5px] border-ink bg-paper" />
        <span className="absolute inset-0 grid place-items-center rounded-control border-[1.5px] border-ink bg-paper">
          <DueNumber value={n} className="num text-[22px] leading-none font-extrabold" />
        </span>
      </div>
      <InlineScript html={FILL} />
    </section>
  );
}
