'use client';

import Link from 'next/link';

import { IconAlert, IconDownload } from '@/components/glyphs/icons';
import { useLocalState } from '@/components/local/hooks';
import { PersistenceNotice } from '@/components/local/PersistenceNotice';
import { backupCopy, backupStatus, latestChangeAt, needsBackup } from '@/components/settings/backup-core';
import { saveBackupFile, useLastBackupAt, useMinuteClock } from '@/components/settings/backup-client';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import type { LocalState } from '@/lib/local/schema';

import { Placeholder } from './Placeholder';

/** -1 means "nothing to back up yet" (null is reserved for "not hydrated"). */
const selectChangedAt = (s: LocalState) => latestChangeAt(s) ?? -1;

/**
 * The backup reminder on /me (DESIGN §12.7): "Last backup: never. Save a
 * backup file so a new device can have your words." It is always there (so
 * nothing shifts), and turns into a reminder, with the alert glyph, only when
 * there is progress that no backup holds yet or the backup is out of date.
 */
export function BackupPanel({ headingId }: { headingId: string }) {
  const changedAt = useLocalState(selectChangedAt);
  const lastBackupAt = useLastBackupAt();
  const now = useMinuteClock();
  const ready = changedAt !== null && lastBackupAt !== undefined && now !== null;
  const status = ready ? backupStatus(lastBackupAt, changedAt < 0 ? null : changedAt, now) : null;
  const copy = status && now !== null ? backupCopy(status, now) : null;
  const remind = status ? needsBackup(status) : false;

  const save = () => {
    const filename = saveBackupFile();
    toast(
      filename
        ? { message: `Saved ${filename}. Keep it somewhere safe.` }
        : { message: 'The backup file couldn’t be saved. Check that downloads are allowed, then try again.', tone: 'error' },
    );
  };

  return (
    <div className="grid gap-4 rounded-paper border border-line-soft p-5 md:p-8" aria-busy={!ready || undefined}>
      <h2 id={headingId} className="type-h3">
        Back up your progress
      </h2>
      <div className="grid gap-1">
        <p className="flex items-start gap-2 text-ui leading-[26px] font-bold text-ink">
          {remind ? <IconAlert className="mt-[3px] shrink-0" /> : null}
          <span>{copy ? copy.title : <Placeholder sizer="Last backup: 2 weeks ago." />}</span>
        </p>
        <p className="min-h-[52px] max-w-[56ch] text-ui text-ink-2 md:min-h-[26px]">
          {copy ? copy.body : <Placeholder sizer="Save a backup file so a new device can have your words." />}
        </p>
      </div>
      <PersistenceNotice />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Button variant="secondary" icon={<IconDownload />} onClick={save}>
          Save a backup file
        </Button>
        <p className="text-caption text-ink-3">
          To restore one, go to{' '}
          <Link href="/settings#your-data" className="font-bold text-ink underline decoration-2 underline-offset-[5px] hover:decoration-[3px]">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
