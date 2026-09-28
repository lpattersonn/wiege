'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';

import { IconTrash } from '@/components/glyphs/icons';
import { announceTheme } from '@/components/local/theme';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { dispatch } from '@/lib/local/store';

import { forgetBackup } from './backup-client';
import { isClearConfirmation } from './backup-core';

/**
 * "Clear everything on this device" (DESIGN §10, §12.8): a ghost button that
 * opens a modal sheet. Typing "clear" is the confirmation; anything else shows
 * an error that says what to do. Keeping everything is one tap, as easy as
 * clearing.
 */
export function ClearEverything() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const inputId = useId();

  // The dialog focuses its first control; the text field is what the student needs.
  useEffect(() => {
    if (open) document.getElementById(inputId)?.focus();
  }, [open, inputId]);

  const close = () => {
    setOpen(false);
    setText('');
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isClearConfirmation(text)) {
      setError('Type the word clear in the box to confirm.');
      document.getElementById(inputId)?.focus();
      return;
    }
    dispatch({ type: 'clearAll' });
    forgetBackup();
    announceTheme('system');
    close();
    toast({ message: 'Cleared. Everything on this device is gone.' });
  };

  return (
    <>
      <Button variant="ghost" icon={<IconTrash />} onClick={() => setOpen(true)}>
        Clear everything on this device
      </Button>
      <Sheet open={open} onClose={close} modal labelledBy={titleId} closeLabel="Keep everything" maxHeight="85svh">
        <form onSubmit={submit} noValidate className="pb-2">
          <h2 id={titleId} className="pr-13 font-title text-[26px] leading-tight font-bold">
            Clear everything on this device?
          </h2>
          <p className="mt-3 text-ui text-ink-2">
            Type <b className="font-bold text-ink">clear</b> to delete every word, entry and stamp on this device. This can’t be undone.
          </p>
          <p className="mt-2 text-small text-ink-2">Want a copy first? Close this and save a backup file.</p>
          <TextInput
            id={inputId}
            label="Type clear to confirm"
            className="mt-5"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            error={error ?? undefined}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="submit">Clear everything</Button>
            <Button variant="secondary" onClick={close}>
              Keep everything
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
