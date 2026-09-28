'use client';

import { IconDownload } from '@/components/glyphs/icons';
import { Placeholder } from '@/components/me/Placeholder';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

import { saveBackupFile, useLastBackupAt, useMinuteClock } from './backup-client';
import { lastBackupLine } from './backup-core';

/** "Save a backup file" (primary): downloads wiege-backup-YYYY-MM-DD.json and shows when the last one was saved. */
export function SaveBackup() {
  const lastBackupAt = useLastBackupAt();
  const now = useMinuteClock();

  const save = () => {
    const filename = saveBackupFile();
    toast(
      filename
        ? { message: `Saved ${filename}. Keep it somewhere safe.` }
        : { message: 'The backup file couldn’t be saved. Check that downloads are allowed, then try again.', tone: 'error' },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Button icon={<IconDownload />} onClick={save}>
        Save a backup file
      </Button>
      <p className="text-caption text-ink-3" aria-live="polite">
        {lastBackupAt === undefined || now === null ? <Placeholder sizer="Last backup: never." /> : lastBackupLine(lastBackupAt, now)}
      </p>
    </div>
  );
}
