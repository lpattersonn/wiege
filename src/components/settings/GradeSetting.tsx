'use client';

import { setPrefs, usePrefs } from '@/components/local/hooks';
import { Segmented } from '@/components/ui/Segmented';

type Band = '7-8' | '9-10';

const OPTIONS = [
  { value: '7-8', label: 'Grade 7–8' },
  { value: '9-10', label: 'Grade 9–10' },
] as const;

/** Grade band (DESIGN §12.8): nothing is selected until the student picks (stories default to 7–8). */
export function GradeSetting() {
  const prefs = usePrefs();
  return <Segmented<Band> legend="Your grade" value={prefs ? prefs.gradeBand : null} onChange={(gradeBand) => setPrefs({ gradeBand })} options={OPTIONS} />;
}
