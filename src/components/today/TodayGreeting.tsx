'use client';

import { useSyncExternalStore } from 'react';

import { InlineScript } from '@/components/local/InlineScript';
import { greetingFor } from '@/components/local/Greeting';
import type { LocalState } from '@/lib/local/schema';
import { useLocal } from '@/lib/local/store';

/**
 * The Today `h1` (DESIGN §12.2): "Start here." on a first visit, otherwise
 * "Good morning." / "Good afternoon." / "Good evening." by the device's
 * clock. The server renders "Start here."; on a hard load an inline script
 * right after the heading switches it before first paint, using the
 * `data-new` flag the Today root's pre-paint script set. No flash, no shift.
 */
const isNewHere = (s: LocalState) =>
  Object.keys(s.reads).length === 0 && Object.keys(s.words).length === 0 && Object.keys(s.journal).length === 0;

const noopSubscribe = () => () => {};
const clientHour = () => new Date().getHours();
const serverHour = () => null;

const SCRIPT =
  '(function(){var s=document.currentScript,h=s&&s.previousElementSibling,r=s&&s.closest("[data-today]");' +
  'if(!h||!r||r.getAttribute("data-new")!=="0")return;var n=new Date().getHours();' +
  'h.textContent=n>=5&&n<12?"Good morning.":n>=12&&n<18?"Good afternoon.":"Good evening."})()';

export function TodayGreeting({ className }: { className?: string }) {
  const isNew = useLocal(isNewHere);
  const hour = useSyncExternalStore(noopSubscribe, clientHour, serverHour);
  const text = isNew === false && hour !== null ? greetingFor(hour) : 'Start here.';
  return (
    <>
      <h1 className={className} suppressHydrationWarning>
        {text}
      </h1>
      <InlineScript html={SCRIPT} />
    </>
  );
}
