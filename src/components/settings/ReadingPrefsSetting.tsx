'use client';

import { useId } from 'react';

import { setPrefs, usePrefs } from '@/components/local/hooks';
import { InlineScript } from '@/components/local/InlineScript';
import { readingPrefsAttributes, type LineSpacing, type ReadingFont, type TextSize } from '@/components/ui/ReadingSettings';
import { Segmented } from '@/components/ui/Segmented';
import { DEFAULT_PREFS } from '@/lib/local/schema';

const PREVIEW = 'Runners study a level frame by frame, then practise the hardest trick until their hands know it by heart.';

/**
 * Sets the preview's reading attributes from the stored prefs during HTML
 * parsing, before first paint, so a student with XL text never sees the box
 * grow after hydration (no layout shift). The element keeps them through
 * hydration (suppressHydrationWarning) and React takes over from there.
 */
function previewScript(id: string): string {
  return `(function(){try{var p=(JSON.parse(localStorage.getItem("wiege:v1")||"null")||{}).prefs||{},e=document.getElementById(${JSON.stringify(id)});if(!e)return;if(/^(book|clear)$/.test(p.readingFont))e.setAttribute("data-reading-font",p.readingFont);if(/^(s|m|l|xl)$/.test(p.textSize))e.setAttribute("data-text-size",p.textSize);if(/^(normal|relaxed|loose)$/.test(p.lineSpacing))e.setAttribute("data-line-spacing",p.lineSpacing)}catch(x){}})()`;
}

/**
 * Reading prefs with a live preview (DESIGN §11.20, §12.8): font, size and
 * line spacing. The same rows as the reader's Aa panel, built from
 * <Segmented>; theme has its own section on /settings. Changes apply at once
 * and are saved on this device.
 */
export function ReadingPrefsSetting() {
  const prefs = usePrefs();
  const previewId = useId();
  const shown = prefs ?? { ...DEFAULT_PREFS };

  return (
    <div className="grid gap-6">
      <div id={previewId} {...readingPrefsAttributes(shown)} suppressHydrationWarning className="rounded-paper bg-sheet p-4 md:p-5">
        <p className="type-read max-w-none!">
          <span className="sr-only">Preview: </span>
          {PREVIEW}
        </p>
      </div>
      <InlineScript html={previewScript(previewId)} />

      <div className="grid gap-2">
        <Segmented<ReadingFont>
          legend="Font"
          showLegend
          block
          value={prefs ? prefs.readingFont : null}
          onChange={(readingFont) => setPrefs({ readingFont })}
          options={[
            { value: 'book', label: 'Book' },
            { value: 'clear', label: 'Clear' },
          ]}
        />
        <p className="text-caption text-ink-3">
          Clear is a plainer font that many readers find easier.
        </p>
      </div>
      <Segmented<TextSize>
        legend="Size"
        showLegend
        block
        value={prefs ? prefs.textSize : null}
        onChange={(textSize) => setPrefs({ textSize })}
        options={[
          { value: 's', label: 'S', ariaLabel: 'Small' },
          { value: 'm', label: 'M', ariaLabel: 'Medium' },
          { value: 'l', label: 'L', ariaLabel: 'Large' },
          { value: 'xl', label: 'XL', ariaLabel: 'Extra large' },
        ]}
      />
      <Segmented<LineSpacing>
        legend="Line spacing"
        showLegend
        block
        value={prefs ? prefs.lineSpacing : null}
        onChange={(lineSpacing) => setPrefs({ lineSpacing })}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'relaxed', label: 'Relaxed' },
          { value: 'loose', label: 'Loose' },
        ]}
      />
    </div>
  );
}
