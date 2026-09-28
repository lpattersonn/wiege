'use client';

import { setPrefs, usePrefs } from '@/components/local/hooks';
import { Switch } from '@/components/ui/Switch';

/**
 * "Use AI to write notes on my writing" (DESIGN §12.8, SPEC §9): with the
 * plain explanation of what is sent. Off means the notes are worked out on
 * this device instead. On by default.
 */
export function AiFeedbackSetting() {
  const prefs = usePrefs();
  return (
    <Switch
      label="Use AI to write notes on my writing"
      description="Wiege sends only your writing, the prompt, your grade and the story’s key words to write them. Nothing is stored."
      checked={prefs ? prefs.aiFeedback : true}
      onChange={(aiFeedback) => setPrefs({ aiFeedback })}
    />
  );
}
