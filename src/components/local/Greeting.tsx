'use client';

import { useId, useSyncExternalStore } from 'react';

import { cx } from '@/components/ui/cx';

import { InlineScript } from './InlineScript';

/**
 * "Good morning." / "Good afternoon." / "Good evening." by the device's local
 * time. No flash and no layout shift: an inline script writes the right text
 * before first paint, and React keeps it (suppressHydrationWarning).
 * Renders as the page `h1` in `type-h1` by default.
 */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning.';
  if (hour >= 12 && hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

const noopSubscribe = () => () => {};
const clientGreeting = () => greetingFor(new Date().getHours());
const serverGreeting = () => null;

export function Greeting({ as: Tag = 'h1', className }: { as?: 'h1' | 'h2' | 'p'; className?: string }) {
  const id = useId();
  const text = useSyncExternalStore(noopSubscribe, clientGreeting, serverGreeting);
  return (
    <>
      <Tag id={id} className={cx('type-h1', className)} suppressHydrationWarning>
        {text ?? 'Hello.'}
      </Tag>
      <InlineScript
        html={`(function(){var e=document.getElementById(${JSON.stringify(id)}),h=new Date().getHours();if(e)e.textContent=h>=5&&h<12?"Good morning.":h>=12&&h<18?"Good afternoon.":"Good evening."})()`}
      />
    </>
  );
}
