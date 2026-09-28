'use client';

import { useState } from 'react';

import { IconAa, IconDownload, IconPlus, IconSpeak } from '@/components/glyphs/icons';
import { Drawer } from '@/components/layout/Drawer';
import { setThemePref, usePrefs } from '@/components/local/hooks';
import { MarkedWord } from '@/components/pen/MasteryMark';
import { Loop, Tick, Underline, Squiggle, DoubleUnderline, Cross, Ring } from '@/components/pen/PenMark';
import { WordsKeptMeter, Tally, ProgressLine } from '@/components/pen/marks';
import { Button, IconButton } from '@/components/ui/Button';
import { Chip, VocabChip } from '@/components/ui/Chip';
import { TextInput, Textarea, Select } from '@/components/ui/Field';
import { Flashcard, FlashcardGrades, type Grade } from '@/components/ui/Flashcard';
import { Popover } from '@/components/ui/Popover';
import { QuizChoices } from '@/components/ui/QuizChoices';
import { QuizOption, type QuizOptionState } from '@/components/ui/QuizOption';
import { ReadingSettings, type ReadingSettingsValue } from '@/components/ui/ReadingSettings';
import { SearchInput } from '@/components/ui/SearchInput';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/Toast';

/* Interactive demos for the living styleguide. */

export function ButtonsDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        loading={loading}
        onClick={() => {
          setLoading(true);
          window.setTimeout(() => setLoading(false), 1600);
        }}
      >
        Save a backup file
      </Button>
      <Button variant="secondary" icon={<IconPlus />} size="sm">
        Save word
      </Button>
      <Button variant="secondary" loading={loading} loadingLabel="Checking…">
        Check my answer
      </Button>
      <IconButton label="Say rehearse out loud" icon={<IconSpeak />} />
    </div>
  );
}

export function FormsDemo() {
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState('');
  const [draft, setDraft] = useState('My game is about a girl who rewinds broken clocks.');
  const invalid = confirm.length > 0 && confirm !== 'clear';
  return (
    <div className="grid max-w-[440px] gap-6">
      <SearchInput label="Search your words" value={query} onChange={(e) => setQuery(e.target.value)} />
      <TextInput label="Name this backup" helper="Only you see this name." placeholder="My Chromebook" autoComplete="off" />
      <TextInput
        label="Type clear to confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={invalid ? 'Type the word clear, in lower case, to delete everything.' : undefined}
        autoComplete="off"
      />
      <TextInput label="Backup file name" defaultValue="wiege-backup" error="Use letters, numbers and dashes only." autoComplete="off" />
      <TextInput label="Grade" value="Grade 7–8" disabled helper="Change your grade in Settings." readOnly />
      <Select label="Sort stories" defaultValue="newest">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="az">A to Z</option>
        <option value="short">Shortest first</option>
        <option value="long">Longest first</option>
      </Select>
      <Textarea label="Your draft" tone="draft" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
    </div>
  );
}

export function SegmentedDemo() {
  const [grade, setGrade] = useState<'7-8' | '9-10'>('7-8');
  const [sort, setSort] = useState<'due' | 'az' | 'new'>('due');
  const prefs = usePrefs();
  return (
    <div className="grid gap-6">
      <Segmented
        legend="Reading level"
        value={grade}
        onChange={setGrade}
        options={[
          { value: '7-8', label: 'Grade 7–8' },
          { value: '9-10', label: 'Grade 9–10' },
        ]}
      />
      <Segmented
        legend="Sort your words"
        value={sort}
        onChange={setSort}
        options={[
          { value: 'due', label: 'Due first' },
          { value: 'az', label: 'A–Z' },
          { value: 'new', label: 'Newest' },
        ]}
      />
      <Segmented
        legend="Theme"
        showLegend
        value={prefs?.theme ?? null}
        onChange={setThemePref}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
    </div>
  );
}

export function ChipsDemo() {
  const [pressed, setPressed] = useState<string[]>(['Games']);
  const [used, setUsed] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {['Writing', 'Games', 'Art', 'Sports'].map((c) => (
          <Chip key={c} pressed={pressed.includes(c)} onClick={() => setPressed((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}>
            {c}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <VocabChip word="narrative" used animate={false} />
        <VocabChip word="prototype" used={used} animate={used} />
        <VocabChip word="collaborate" used={false} />
        <Button variant="ghost" size="sm" onClick={() => setUsed((u) => !u)}>
          {used ? 'Undo “prototype”' : 'Use “prototype” in the draft'}
        </Button>
      </div>
    </div>
  );
}

export function SwitchDemo() {
  const [on, setOn] = useState(true);
  return (
    <Switch
      label="Use AI to write notes on my writing"
      description="Wiege sends only your writing and the prompt to write these notes. Nothing is stored."
      checked={on}
      onChange={setOn}
      className="max-w-[640px]"
    />
  );
}

const READING_DEFAULT: ReadingSettingsValue = { readingFont: 'book', textSize: 'm', lineSpacing: 'relaxed', theme: 'system' };

export function OverlaysDemo() {
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState<ReadingSettingsValue>(READING_DEFAULT);
  const update = (patch: Partial<ReadingSettingsValue>) => setSettings((s) => ({ ...s, ...patch }));
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Popover label="Reading settings" trigger={(p) => <IconButton {...p} label="Reading settings (popover)" icon={<IconAa />} />}>
        <ReadingSettings value={settings} onChange={update} showTheme={false} />
      </Popover>
      <Button variant="secondary" onClick={() => setSheet(true)}>
        Reading settings sheet
      </Button>
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        Delete entry
      </Button>
      <Button variant="secondary" onClick={() => setDrawer(true)}>
        Open drawer
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ message: 'Removed “stamina”.', action: { label: 'Undo', onAction: () => toast({ message: 'Restored “stamina”.' }) } })}
      >
        Show a toast
      </Button>
      <Button variant="secondary" onClick={() => toast({ message: 'Progress can’t be saved in this browser mode.', tone: 'error' })}>
        Show an error toast
      </Button>

      <Sheet open={sheet} onClose={() => setSheet(false)} modal label="Reading settings" closeLabel="Close reading settings" maxHeight="85svh">
        <h2 className="mb-4 pr-13 font-title text-[26px] leading-tight font-bold">Reading settings</h2>
        <ReadingSettings value={settings} onChange={update} />
      </Sheet>
      <Sheet open={confirm} onClose={() => setConfirm(false)} modal labelledBy="sg-confirm-h" closeLabel="Keep it">
        <h2 id="sg-confirm-h" className="pr-13 font-title text-[26px] leading-tight font-bold">
          Delete this entry?
        </h2>
        <p className="mt-2 text-ui text-ink-2">It’s only on this device, so it can’t come back.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => setConfirm(false)}>Delete entry</Button>
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Keep it
          </Button>
        </div>
      </Sheet>
      <Drawer open={drawer} onClose={() => setDrawer(false)} label="Menu">
        <p className="text-ui text-ink-2">The landing menu uses this drawer below 1024px.</p>
      </Drawer>
    </div>
  );
}

export function ReadingSettingsDemo() {
  const [settings, setSettings] = useState<ReadingSettingsValue>(READING_DEFAULT);
  return (
    <div className="max-w-[320px] rounded-control border-[1.5px] border-ink p-5">
      <ReadingSettings value={settings} onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))} showTheme={false} />
    </div>
  );
}

const CHOICES = [
  'The team couldn’t afford good graphics.',
  'Caring about the keeper is what keeps people playing.',
  'The game is mostly about the science of light.',
  'Ada’s music was the best part of the game.',
];

export function QuizDemo() {
  const [picks, setPicks] = useState<number[]>([]);
  const answer = 1;
  const solved = picks.includes(answer);
  const stateOf = (i: number): QuizOptionState => {
    if (!picks.includes(i)) return 'idle';
    if (i === answer) return 'correct';
    return picks[0] === i ? 'first-try' : 'incorrect';
  };
  return (
    <div className="grid max-w-[36em] gap-3">
      <p className="type-question" id="sg-q">
        Why does Priya say the narrative matters more than the graphics?
      </p>
      <QuizChoices labelledBy="sg-q" className="mt-3">
        {CHOICES.map((choice, i) => (
          <QuizOption
            key={i}
            letter={String.fromCharCode(65 + i)}
            state={stateOf(i)}
            checked={picks.at(-1) === i}
            animate
            scope="sg-q"
            disabled={solved || picks.includes(i)}
            onClick={() => setPicks((p) => [...p, i])}
          >
            {choice}
          </QuizOption>
        ))}
      </QuizChoices>
      <p aria-live="polite" className="mt-2 min-h-7 font-title text-[22px] font-bold">
        {solved ? (picks.length === 1 ? 'Got it.' : 'Got it on the second try.') : picks.length ? 'Not quite. Look at what Priya says.' : ''}
      </p>
      <div className="flex flex-wrap gap-4">
        <Button variant="ghost" onClick={() => setPicks([])}>
          Start the question again
        </Button>
      </div>
    </div>
  );
}

export function FlashcardDemo() {
  const [flipped, setFlipped] = useState(false);
  const [box, setBox] = useState(2);
  const [raised, setRaised] = useState(false);
  const grade = (g: Grade) => {
    const next = g === 'again' ? 1 : g === 'hard' ? box : g === 'good' ? Math.min(5, box + 1) : Math.min(5, box + 2);
    setRaised(next > box);
    setBox(next);
    setFlipped(false);
  };
  return (
    <div className="grid max-w-[560px] gap-6">
      <Flashcard
        word="stamina"
        mastery={box}
        definition="The strength to keep going for a long time, in your body or your mind."
        example="By the last lap she was running on pure stamina."
        storyTitle="The relay team that dropped the baton, then broke the school record"
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        animateMark={raised}
      />
      {flipped ? <FlashcardGrades onGrade={grade} /> : <Button block onClick={() => setFlipped(true)}>Flip the card</Button>}
    </div>
  );
}

export function PenReplayDemo() {
  const [key, setKey] = useState(0);
  const [kept, setKept] = useState(0);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-6 font-title text-[40px] leading-[1.2] font-bold" key={key}>
        <span className="marked" data-pen-context="list">
          narrative
          <Loop word="narrative" font="display-700" context="list" animate />
        </span>
        <span className="marked">
          stamina
          <Squiggle word="stamina" animate />
        </span>
        <span className="marked">
          rehearse
          <Underline word="rehearse" animate duration={260} />
        </span>
        <span className="marked">
          momentum
          <DoubleUnderline word="momentum" animate />
        </span>
        <span className="relative inline-grid size-9 place-items-center rounded-pill font-ui text-nav font-extrabold">
          B<Ring word="B" animate />
        </span>
        <span className="relative inline-grid size-9 place-items-center rounded-pill font-ui text-nav font-extrabold">
          A<Cross word="A" animate duration={260} />
        </span>
        <span className="relative block h-[26px] w-[30px]">
          <Tick animate duration={260} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <Tally count={4} pending={false} animateLast key={`t${key}`} />
        <WordsKeptMeter kept={kept} animateIndex={kept - 1} />
        <ProgressLine value={0.6} animate key={`p${key}`} />
      </div>
      <div className="flex flex-wrap gap-4">
        <Button variant="secondary" size="sm" icon={<IconDownload />} onClick={() => setKey((k) => k + 1)}>
          Replay the pen
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setKept((k) => (k >= 3 ? 0 : k + 1))}>
          Keep a word
        </Button>
        <span className="self-center text-caption text-ink-3">Draw-in is skipped under reduced motion.</span>
      </div>
      <p className="font-title text-[34px] font-bold">
        <MarkedWord word="gleam" level={1} /> <MarkedWord word="gleam" level={2} /> <MarkedWord word="gleam" level={3} /> <MarkedWord word="gleam" level={4} />{' '}
        <MarkedWord word="gleam" level={5} />
      </p>
    </div>
  );
}
