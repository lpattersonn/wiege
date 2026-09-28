import type { ReactNode } from 'react';

import { InlineScript } from '@/components/local/InlineScript';
import { cx } from '@/components/ui/cx';

/**
 * Pre-hydration gate for on-device islands (SPEC §4, DESIGN §11.18).
 *
 * The local store is null on the server, so an island normally shows a
 * skeleton until hydration. For states the server can render on its own (the
 * empty word bank, the empty journal, an entry that isn't on this device) a
 * tiny inline script peeks at `localStorage['wiege:v1']` while the HTML is
 * parsed and sets `data-gate` on this wrapper before first paint, and CSS shows
 * the matching server-rendered variant instead of the skeleton. The island
 * then renders the same content from the store after hydration, so nothing
 * flashes or shifts. On client-side navigations the store is already loaded
 * and the gate is never rendered.
 */
export type GateState = 'empty' | 'missing';

const SHOW: Record<GateState, string> = {
  empty: 'hidden group-data-[gate=empty]/gate:block',
  missing: 'hidden group-data-[gate=missing]/gate:block',
};
const HIDE_FALLBACK = 'group-data-[gate=empty]/gate:hidden group-data-[gate=missing]/gate:hidden';

/**
 * The gate script. `decide` is a JS snippet that reads the parsed store `s`
 * (null when nothing is saved) and assigns the state to `v`. Unreadable
 * storage counts as `fallbackState` (the store then runs empty, in memory).
 */
export function gateScript(id: string, decide: string, fallbackState: GateState = 'empty'): string {
  return (
    `(function(){var e=document.getElementById(${JSON.stringify(id)});if(!e)return;var v=${JSON.stringify(fallbackState)};` +
    `try{var s=JSON.parse(localStorage.getItem("wiege:v1")||"null");v="filled";${decide}}catch(x){v=${JSON.stringify(fallbackState)}}` +
    `e.setAttribute("data-gate",v)})()`
  );
}

/** `decide` snippet: "empty" when the store holds no saved words. */
export const NO_WORDS = 'if(!s||!s.words||!Object.keys(s.words).length)v="empty";';

/** `decide` snippet: "empty" when no journal entry has any writing. */
export const NO_ENTRIES =
  'var j=s&&s.journal,n=0;if(j)for(var k in j){if(Object.prototype.hasOwnProperty.call(j,k)&&j[k]&&typeof j[k].body==="string"&&j[k].body.trim())n++}if(!n)v="empty";';

export function StoreGate({
  id,
  script,
  variants,
  fallback,
  className,
}: {
  id: string;
  script: string;
  /** Server-rendered content per gate state. */
  variants: Partial<Record<GateState, ReactNode>>;
  /** Shown for any other state (a same-size skeleton). */
  fallback: ReactNode;
  className?: string;
}) {
  return (
    <>
      <div id={id} className={cx('group/gate', className)} suppressHydrationWarning>
        {(Object.keys(variants) as GateState[]).map((state) => (
          <div key={state} className={SHOW[state]}>
            {variants[state]}
          </div>
        ))}
        <div className={HIDE_FALLBACK}>{fallback}</div>
      </div>
      <InlineScript html={script} />
    </>
  );
}
