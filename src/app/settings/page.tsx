import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { IconBack } from '@/components/glyphs/icons';
import { AppShell } from '@/components/layout/Shells';
import { PersistenceNotice } from '@/components/local/PersistenceNotice';
import { ThemeSwitch } from '@/components/local/ThemeSwitch';
import { AiFeedbackSetting } from '@/components/settings/AiFeedbackSetting';
import { ClearEverything } from '@/components/settings/ClearEverything';
import { GradeSetting } from '@/components/settings/GradeSetting';
import { ReadingPrefsSetting } from '@/components/settings/ReadingPrefsSetting';
import { RestoreBackup } from '@/components/settings/RestoreBackup';
import { SaveBackup } from '@/components/settings/SaveBackup';
import { LinkButton } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Pick your grade, reading style and theme, turn AI notes on your writing on or off, and back up, restore or clear what’s on this device.',
  alternates: { canonical: '/settings' },
  robots: { index: false, follow: true },
};

function SettingsSection({ id, title, lede, children }: { id: string; title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line-soft pt-10">
      <h2 id={`${id}-h`} className="type-h3">
        {title}
      </h2>
      {lede ? <p className="mt-3 max-w-[56ch] text-ui text-ink-2">{lede}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function DataRow({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      <h3 className="type-h4">{title}</h3>
      <p className="max-w-[56ch] text-ui text-ink-2">{text}</p>
      <div>{children}</div>
    </div>
  );
}

/**
 * /settings (SPEC §8, DESIGN §12.8): one 640px column. Grade, reading prefs
 * with a live preview, theme, the AI notes switch with what is sent, and the
 * student's data: save a backup file, restore one (merge or replace, with a
 * preview), clear everything (type to confirm). A static shell; every control
 * reads and writes the on-device store.
 */
export default function SettingsPage() {
  return (
    <AppShell searchHref="/c">
      <div className="mx-auto w-full max-w-[640px]">
        <LinkButton href="/me" variant="ghost" size="sm" icon={<IconBack />} className="-ml-1 gap-1">
          Me
        </LinkButton>
        <h1 className="mt-2 type-h1">Settings</h1>
        <p className="mt-3 type-lede">Everything here is saved in this browser, on this device. Changes work straight away.</p>

        <div className="mt-12 grid gap-12">
          <SettingsSection id="grade" title="Grade" lede={'This sets the reading level of every story. Until you pick one, stories use Grade\u00a07–8.'}>
            <GradeSetting />
          </SettingsSection>

          <SettingsSection id="reading" title="Reading" lede="How story text looks. The preview changes as you choose.">
            <ReadingPrefsSetting />
          </SettingsSection>

          <SettingsSection id="theme" title="Theme" lede="System follows your device’s light or dark setting.">
            <ThemeSwitch />
          </SettingsSection>

          <SettingsSection id="writing-notes" title="Writing notes">
            <AiFeedbackSetting />
            <p className="mt-4 max-w-[56ch] text-small text-ink-2">When it’s off, you still get notes. They’re worked out on this device instead.</p>
            <LinkButton href="/privacy" variant="ghost" size="sm" className="mt-1">
              What leaves your device
            </LinkButton>
          </SettingsSection>

          <SettingsSection
            id="your-data"
            title="Your data"
            lede="Your words, journal, streak and stamps are kept only in this browser. A backup file lets you move them to another device or keep them safe."
          >
            <div className="grid gap-10">
              <PersistenceNotice />
              <DataRow title="Save a backup" text="Downloads one small file with everything in it. Nothing is uploaded.">
                <SaveBackup />
              </DataRow>
              <DataRow title="Restore from a backup" text="Choose a backup file from this or another device. You’ll see what’s in it before anything changes.">
                <RestoreBackup />
              </DataRow>
              <DataRow title="Clear this device" text="Deletes every word, entry, stamp and setting in this browser. You’ll be asked to confirm.">
                <ClearEverything />
              </DataRow>
            </div>
          </SettingsSection>
        </div>
      </div>
    </AppShell>
  );
}
