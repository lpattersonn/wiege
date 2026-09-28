import { contactEmail } from '@/components/info/contact';
import {
  Callout,
  ExternalLink,
  InfoPage,
  InfoSection,
  Lead,
  List,
  N,
  NumberedList,
  P,
  Steps,
  SubHead,
  TextLink,
  Typeset,
  type TocEntry,
} from '@/components/info/InfoLayout';
import { infoMetadata } from '@/components/info/metadata';
import { sourceSummaries } from '@/components/info/sources';
import { SiteShell } from '@/components/layout/Shells';
import { LinkButton } from '@/components/ui/Button';
import { MetaCategory, MetaRow } from '@/components/ui/MetaRow';

/**
 * /parents (SPEC §8; DESIGN §12.9): for parents and teachers. The sources
 * come straight from FEEDS (src/lib/news/feeds.ts); the safety steps describe
 * src/lib/news/safety.ts and classify.ts; the schedule and retention come
 * from the scheduler, PER_CATEGORY_INTAKE and cleanup.ts.
 */

export const metadata = infoMetadata({
  path: '/parents',
  title: 'For parents and teachers',
  description:
    'How Wiege works, where its news comes from, how every story is checked for ages 12 to 15, and why students’ progress stays on their own device.',
});

const SOURCES = sourceSummaries();

export default function ParentsPage() {
  const email = contactEmail();
  const toc: TocEntry[] = [
    { id: 'how-it-works', label: 'How Wiege works' },
    { id: 'how-stories-are-chosen', label: 'How stories are chosen' },
    { id: 'where-progress-lives', label: 'Where progress lives' },
    { id: 'in-class', label: 'Using Wiege in class' },
    ...(email ? [{ id: 'contact', label: 'Contact' }] : []),
  ];

  return (
    <SiteShell>
      <InfoPage
        title="For parents and teachers."
        lede="Wiege is a free reading app for students aged 12 to 15. Here’s how it works, where its stories come from, how they’re checked, and where students’ work is kept."
        toc={toc}
      >
        <InfoSection
          id="how-it-works"
          title="How Wiege works"
          note={
            <Callout label="Free, with no sign-up.">
              Nothing to install and no student data on Wiege’s server. It runs in any up-to-date browser, including on school Chromebooks.
            </Callout>
          }
        >
          <P>
            Wiege turns recent news about books and writing, games, art and sport into short reading lessons for grades <N>7</N> to <N>10</N>. Every story becomes a lesson in
            three steps.
          </P>
          <Steps
            steps={[
              {
                title: 'Read',
                body: (
                  <>
                    A new retelling of a real news story, written at two levels: Grade <N>7–8</N> and Grade <N>9–10</N>. Five to eight vocabulary words are marked, and students can
                    look up any other word too. Words they save come back as flashcards, spaced further apart as they learn them.
                  </>
                ),
              },
              {
                title: 'Check',
                body: 'Five multiple-choice questions on things like the main idea, details, what the story implies, vocabulary and the writer’s purpose, each with a short explanation.',
              },
              {
                title: 'Write',
                body: (
                  <>
                    Three short prompts (a summary, a headline, an opinion, a letter or something creative) with a target length. Students get instant notes made on their device
                    and, if AI notes are on, notes from Claude: two things that work, quoting the student, two things to try next, one next step and a score from <N>1</N> to{' '}
                    <N>4</N> for ideas, organisation, word choice and conventions. The notes never rewrite the student’s work.
                  </>
                ),
              },
            ]}
          />
          <P>Each story ends with two questions to talk about and a link to the original article.</P>
          <SubHead id="how-lessons-are-made">How a lesson is made</SubHead>
          <P>
            When AI is set up for this site, lessons are written by Claude, an AI model made by Anthropic. It works from the article’s headline, summary and text, with
            instructions to be accurate, to write for <N>12</N> to <N>15</N> year olds and to ignore any instructions inside the article. Without AI, or when the AI can’t produce a
            good lesson, a built-in engine makes a simpler one from the summary. Either way, every word of the finished lesson goes through the word check again before it’s published.
          </P>
          <P>
            Wiege keeps only each article’s headline, a short summary of up to <N>600</N> characters and the link. When AI is on, the full article is read once to help write the lesson;
            it’s never stored or shown. Story pictures are drawn by Wiege; no photos from news sites are used.
          </P>
          <P>
            There are also <N>12</N> practice stories, three per category, written for Wiege and labelled Practice story. They explain something true that doesn’t go out of date,
            such as why a marathon is <N>42.195</N> kilometres, and are never presented as news.
          </P>
        </InfoSection>

        <InfoSection
          id="how-stories-are-chosen"
          title="How stories are chosen"
          note={
            <Callout label="When in doubt, it’s left out.">
              The checks are strict on purpose: Wiege would rather miss a good story than show one that isn’t right for this age group.
            </Callout>
          }
        >
          <SubHead id="sources">Only trusted sources</SubHead>
          <P>
            Wiege reads from a fixed list of <N>{SOURCES.length}</N> news feeds. Each one was picked by hand, and its recent stories read for suitability, before it was added. A
            story’s link must stay on its source’s own website. Some feeds cover many topics, so their stories are sorted into categories by keyword, and anything that fits none
            is dropped.
          </P>
          <ul className="grid w-full max-w-[40rem] border-t border-line-soft">
            {SOURCES.map((source) => (
              <li key={source.id} className="grid gap-2 border-b border-line-soft py-5">
                <p className="text-ui leading-snug font-bold">
                  <ExternalLink href={source.homepage}>
                    <Typeset text={source.name} />
                  </ExternalLink>
                </p>
                <MetaRow>
                  <span className="sr-only">Stories for:</span>
                  {source.categories.map((slug) => (
                    <MetaCategory key={slug} slug={slug} />
                  ))}
                </MetaRow>
                <p className="max-w-[36em] font-read text-[17px] leading-[26px] text-ink-2">
                  <Typeset text={source.why} />
                </p>
              </li>
            ))}
          </ul>

          <SubHead id="safety-filter">The safety filter</SubHead>
          <P>Every new story goes through these checks before a student can see it. If a check fails, the story is left out, and a story that’s left out is never checked again.</P>
          <NumberedList>
            <li>
              <Lead>Recent and from the list.</Lead> Only stories from the sources above, published in the last seven days.
            </li>
            <li>
              <Lead>A word check.</Lead> The headline and summary are checked against words and phrases about violence, war and terror, death and injury, sexual content, drugs and
              alcohol, gambling, self-harm, crime, swearing, horror, mature-rated games, elections and politics, and hate. One match and the story is out. A short, reviewed list of
              harmless sports and games phrases, such as “penalty shootout”, “killer serve” and “Pokémon battle”, is allowed.
            </li>
            <li>
              <Lead>An AI review.</Lead> When AI is set up, Claude reads every story that passed the word check. A story goes ahead only if Claude says it’s clearly suitable for{' '}
              <N>12</N> to <N>15</N> year olds. If the review can’t run, the story waits for the next check. Without AI, the word check and the hand-picked sources are the
              safeguards.
            </li>
            <li>
              <Lead>A second word check.</Lead> The finished lesson, including its questions and writing prompts, goes through the word check again. If it fails, it isn’t
              published.
            </li>
          </NumberedList>
          <P>
            Word lookups are filtered too: dictionary meanings marked vulgar, offensive or slang are dropped. No filter is perfect, so the checks lean hard towards leaving things
            out.
            {email ? (
              <>
                {' '}
                If you see something that shouldn’t be on Wiege, please email <ExternalLink href={`mailto:${email}`}>{email}</ExternalLink>.
              </>
            ) : null}
          </P>

          <SubHead id="schedule">Every four hours</SubHead>
          <P>
            Wiege checks its sources every four hours, at <N>00:00</N>, <N>04:00</N>, <N>08:00</N>, <N>12:00</N>, <N>16:00</N> and <N>20:00</N> UTC, and takes in up to six new
            stories per category each time. News stays on Wiege for <N>120</N> days and is then removed. Practice stories stay.
          </P>
        </InfoSection>

        <InfoSection
          id="where-progress-lives"
          title="Where progress lives"
          note={
            <Callout label="No teacher dashboard, on purpose.">
              Student work never reaches Wiege’s server, so there’s nothing for Wiege to show anyone.
            </Callout>
          }
        >
          <P>
            There are no accounts. A student’s words, journal, quiz results, streak, stamps and settings are saved in the browser on their own device (in local storage), not on
            Wiege’s server. Wiege can’t see them, and neither can anyone else through Wiege.
          </P>
          <List>
            <li>
              <Lead>Moving devices.</Lead> Progress doesn’t follow a student to another device on its own. In Settings they can save a backup file and restore it on another device,
              merging it with what’s there or replacing it.
            </li>
            <li>
              <Lead>Shared computers.</Lead> Everyone using the same browser profile shares the same progress; separate browser profiles keep it apart. Private or incognito windows
              save nothing.
            </li>
            <li>
              <Lead>Clearing.</Lead> Clearing the browser’s data for Wiege, or choosing Clear everything on this device in Settings, deletes it for good unless there’s a backup.
            </li>
            <li>
              <Lead>AI notes.</Lead> When a student asks for notes on their writing, the writing, the prompt, their grade and the story’s vocabulary words go to Claude, and none of
              it is stored. AI notes are on by default and can be switched off in Settings, on each device.
            </li>
            <li>
              <Lead>Nothing else.</Lead> No cookies, analytics, ads or third-party scripts.
            </li>
          </List>
          <P>
            The <TextLink href="/privacy">privacy page</TextLink> explains all of this for students, in their words.
          </P>
        </InfoSection>

        <InfoSection
          id="in-class"
          title="Using Wiege in class"
          note={
            <Callout label="Busy school network?">
              AI notes are limited to <N>60</N> a day per internet connection, and a whole school often shares one. When they run out, students still get instant notes.
            </Callout>
          }
        >
          <List>
            <li>
              <Lead>Read the same story together.</Lead> Share a story’s link. Each student picks Grade <N>7–8</N> or Grade <N>9–10</N>, so a mixed class reads the same news at
              the right level.
            </li>
            <li>
              <Lead>Talk about it.</Lead> Each story ends with two discussion questions, good for pairs or as a whole-class starter.
            </li>
            <li>
              <Lead>Write and share.</Lead> Wiege can’t send student writing to you. Students can show it on screen, or copy it into the tools you already use.
            </li>
            <li>
              <Lead>Web filters.</Lead> Wiege loads everything from its own address, so allowing that one site is enough. Links to original articles go to the news sites above.
            </li>
            <li>
              <Lead>Reading support.</Lead> Students can switch to a clearer font, larger text, more space between lines or a dark theme, and have the story read aloud where the
              browser supports it.
            </li>
          </List>
        </InfoSection>

        {email ? (
          <InfoSection id="contact" title="Contact">
            <P>
              Questions, a story that shouldn’t be on Wiege, or a source to suggest? Email <ExternalLink href={`mailto:${email}`}>{email}</ExternalLink>.
            </P>
          </InfoSection>
        ) : null}

        <div className="grid justify-items-start gap-3">
          <P>The quickest way to see Wiege is to read a story.</P>
          <LinkButton href="/today">See today’s stories</LinkButton>
        </div>
      </InfoPage>
    </SiteShell>
  );
}
