import { IconDevice, IconDownload, IconEyeOff, IconJournal, IconLock } from '@/components/glyphs/icons';
import { contactEmail } from '@/components/info/contact';
import { Callout, ExternalLink, InfoPage, InfoSection, Lead, List, N, P, SubHead, TextLink, type TocEntry } from '@/components/info/InfoLayout';
import { KeyFacts, type KeyFact } from '@/components/info/KeyFacts';
import { infoMetadata } from '@/components/info/metadata';
import { SiteShell } from '@/components/layout/Shells';

/**
 * /privacy (SPEC §8, §9; DESIGN §12.9). Every statement here is checked
 * against the code: the local store (src/lib/local), POST /api/feedback and
 * src/lib/literacy/feedback.ts, GET /api/define and src/lib/dictionary.ts,
 * the salted IP hash in src/lib/request.ts and src/lib/rate-limit.ts, and the
 * absence of cookies and third-party requests. Update LAST_UPDATED with it.
 */

const LAST_UPDATED = { iso: '2026-09-27', label: '27 September 2026' } as const;

export const metadata = infoMetadata({
  path: '/privacy',
  title: 'Privacy',
  description:
    'No accounts, no cookies, no tracking. Your progress stays in your browser. What Wiege keeps, what it sends when you ask for notes on your writing, and how to back up or delete your data.',
});

const FACTS: readonly KeyFact[] = [
  {
    icon: <IconLock />,
    lead: 'No accounts.',
    body: 'You never give Wiege your name, your email address or a password. There’s nothing to sign up for.',
  },
  {
    icon: <IconEyeOff />,
    lead: 'No cookies, tracking or ads.',
    body: 'Wiege uses no analytics, and nothing on its pages comes from another company.',
  },
  {
    icon: <IconDevice />,
    lead: 'Your progress stays in this browser.',
    body: 'Your words, journal, streak, stamps and settings are saved on this device, not on Wiege’s server.',
  },
  {
    icon: <IconJournal />,
    lead: 'Your writing leaves only when you ask for notes.',
    body: 'Then it goes to an AI that writes the notes, and it isn’t kept. You can turn this off in Settings.',
  },
  {
    icon: <IconDownload />,
    lead: 'You’re in charge.',
    body: 'Save a backup file, move it to another device, or clear everything in one step.',
  },
];

export default function PrivacyPage() {
  const email = contactEmail();
  const toc: TocEntry[] = [
    { id: 'short-version', label: 'The short version' },
    { id: 'on-your-device', label: 'What stays on your device' },
    { id: 'leaves-your-device', label: 'What leaves your device' },
    { id: 'never-collected', label: 'What Wiege never collects' },
    { id: 'your-data', label: 'Back up, move or delete' },
    ...(email ? [{ id: 'questions', label: 'Questions' }] : []),
  ];

  return (
    <SiteShell>
      <InfoPage
        title="Your privacy, in plain words."
        lede="Wiege has no accounts and doesn’t track you. Your progress stays in this browser. Here’s exactly what that means."
        meta={
          <p className="text-small text-ink-3">
            Last updated <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.label}</time>. When this page changes, this date changes too.
          </p>
        }
        intro={<KeyFacts id="short-version" title="The short version" facts={FACTS} />}
        toc={toc}
      >
        <InfoSection
          id="on-your-device"
          title="What stays on your device"
          note={
            <Callout label="For grown-ups who want to check:">
              it’s one entry in this site’s local storage, called <span className="font-bold text-ink">wiege:v1</span>.
            </Callout>
          }
        >
          <P>Everything you do on Wiege is saved in this browser’s local storage: a small space every browser gives each website, on your device. Wiege keeps:</P>
          <List>
            <li>the stories you start and finish, and your quiz answers</li>
            <li>the words you save, and how well you know each one</li>
            <li>your journal writing, and any notes you got on it</li>
            <li>the days you read, your stamps and your XP</li>
            <li>your settings: grade, reading font and size, theme, whether AI notes are on, and your time zone (so a reading day ends at your midnight)</li>
          </List>
          <P>None of this is sent to Wiege’s server. That also means Wiege can’t get it back for you. If you clear this browser’s data for Wiege, or lose the device, it’s gone, unless you saved a backup.</P>
          <P>Anyone who uses this browser on this device can see it too. On a shared computer, use your own browser profile. In a private or incognito window, nothing can be saved at all.</P>
        </InfoSection>

        <InfoSection
          id="leaves-your-device"
          title="What leaves your device"
          note={
            <Callout label="Turn AI notes off.">
              It’s one switch in <TextLink href="/settings">Settings</TextLink>, and it only changes this device. You’ll still get instant notes.
            </Callout>
          }
        >
          <P>Your progress never leaves. A few other things do, each for a job you asked for.</P>

          <SubHead id="notes">Notes on your writing</SubHead>
          <P>
            When you ask for notes on something you wrote, Wiege first makes instant notes right here on your device. AI notes are on unless you turn them off. When they’re on, your
            browser also sends these to Wiege’s server:
          </P>
          <List>
            <li>the writing prompt you answered</li>
            <li>
              your writing (up to <N>6,000</N> characters)
            </li>
            <li>
              your grade, <N>7–8</N> or <N>9–10</N>
            </li>
            <li>the story’s vocabulary words, so the notes can say which ones you used</li>
            <li>the length you were aiming for and the kind of writing, if the prompt has them</li>
          </List>
          <P>
            Wiege’s server passes them to Claude, an AI made by the company Anthropic, which writes the notes. Anthropic handles what it receives under its own privacy terms. The
            notes come back to you and are saved in your journal on this device. Wiege’s server doesn’t save your writing or write it into its logs.
          </P>
          <P>
            To share AI notes fairly, Wiege counts how many notes each internet connection asks for in a day (up to <N>60</N>). It doesn’t keep your internet address to do this. It
            mixes the address with a secret code and keeps only the scrambled result, which can’t be turned back into the address. That count expires after <N>24</N> hours and is
            deleted at the next clean-up, which normally runs every four hours.
          </P>

          <SubHead id="word-lookups">Looking up a word</SubHead>
          <P>
            When you look up a word the story hasn’t explained, your browser sends just that word to Wiege’s server. The server finds it in the{' '}
            <ExternalLink href="https://dictionaryapi.dev/">Free Dictionary</ExternalLink> and remembers the meaning for everyone, not who asked. The dictionary never sees your
            browser. To stop floods of lookups, Wiege counts them per connection for one minute, using the same kind of scrambled number.
          </P>

          <SubHead id="read-aloud">Reading aloud</SubHead>
          <P>
            Listening to a story, or hearing a word said out loud, uses your browser’s own voice. Some browsers use an online voice, which sends the words being read to the company
            that makes the browser.
          </P>

          <SubHead id="pages">Opening pages</SubHead>
          <P>
            Like any website, your browser asks Wiege’s server for each page and for more stories. These requests don’t include your progress. The computers that host Wiege see your
            internet address while they send a page back, but Wiege doesn’t store it.
          </P>
        </InfoSection>

        <InfoSection
          id="never-collected"
          title="What Wiege never collects"
          note={
            <Callout label="No cookies, no banner.">That’s why Wiege never asks you to accept cookies: there are none to accept.</Callout>
          }
        >
          <List>
            <li>your name, email address, age, birthday, school or where you live</li>
            <li>a password, because there are no accounts</li>
            <li>cookies: Wiege doesn’t set any</li>
            <li>your internet address: Wiege keeps only the scrambled number described above</li>
            <li>what you read, save or write: all of that stays on your device</li>
          </List>
          <P>
            There are no ads, analytics, trackers, social media buttons or chat boxes. Fonts, pictures and code all come from Wiege itself, and story pictures are drawn by Wiege, not
            copied from news sites. So news sites and other companies don’t see you while you read. The only way out to another site is a link you choose to follow, like the
            original of a news story.
          </P>
        </InfoSection>

        <InfoSection
          id="your-data"
          title="Back up, move or delete"
          note={<Callout label="Keep backups private.">A backup file holds your journal, so treat it like a diary.</Callout>}
        >
          <List>
            <li>
              <Lead>Back up.</Lead> In <TextLink href="/settings">Settings</TextLink>, choose Save a backup file. You get a file called wiege-backup- followed by the date, with
              everything Wiege has saved on this device.
            </li>
            <li>
              <Lead>Move to another device.</Lead> Open Wiege on the new device, go to Settings and choose Restore from a backup. You can merge the file with what’s already there, or
              replace it. Wiege checks the file before it uses it.
            </li>
            <li>
              <Lead>Delete.</Lead> In Settings, choose Clear everything on this device, then type clear to confirm. Clearing this site’s data in your browser’s settings does the
              same.
            </li>
          </List>
          <P>Wiege’s server has nothing of yours to delete. Backup files are yours: delete them like any other file.</P>
          <P>
            Parents and teachers can read more about how Wiege works and how stories are checked on the <TextLink href="/parents">page for parents and teachers</TextLink>.
          </P>
        </InfoSection>

        {email ? (
          <InfoSection id="questions" title="Questions">
            <P>
              Questions about your privacy on Wiege? Email <ExternalLink href={`mailto:${email}`}>{email}</ExternalLink>. A parent or teacher can write too.
            </P>
          </InfoSection>
        ) : null}
      </InfoPage>
    </SiteShell>
  );
}
