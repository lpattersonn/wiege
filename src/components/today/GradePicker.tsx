'use client';

import { setPrefs, usePrefs } from '@/components/local/hooks';
import { Segmented } from '@/components/ui/Segmented';
import type { GradeBand } from '@/lib/literacy/types';

const OPTIONS = [
  { value: '7-8', label: 'Grade 7–8' },
  { value: '9-10', label: 'Grade 9–10' },
] as const satisfies ReadonlyArray<{ value: GradeBand; label: string }>;

/**
 * The first-visit grade chip (DESIGN §11.21, §12.2): optional, never blocks
 * reading, saved to this device's prefs. Until chosen, stories open at
 * Grade 7–8.
 */
export function GradePicker() {
  const prefs = usePrefs();
  return (
    <div className="grid justify-items-start gap-2">
      <Segmented<GradeBand>
        legend="Which grade are you in?"
        showLegend
        options={OPTIONS}
        value={prefs?.gradeBand ?? null}
        onChange={(gradeBand) => setPrefs({ gradeBand })}
      />
      <p className="text-caption text-ink-3">This picks your reading level. You can change it any time.</p>
    </div>
  );
}
