import { contactEmail } from '@/components/info/contact';
import { Callout, ExternalLink, InfoPage, InfoSection, Lead, List, N, P, Steps, TextLink, type TocEntry } from '@/components/info/InfoLayout';
import { infoMetadata } from '@/components/info/metadata';
import { SiteShell } from '@/components/layout/Shells';
import { LinkButton } from '@/components/ui/Button';

/**
 * /about (SPEC §8; DESIGN §12.9), written for students. Practice stories link
 * here as their source ("Wiege practice", homepage /about), and WiegeBot's
 * User-Agent points here, so both have a section with a stable id.
 */

export const metadata = infoMetadata({
  path: '/about',
  title: 'About',
  description:
    'Wiege is a free reading app for ages 12 to 15. Recent news about writing, games, art and sport becomes a short lesson: read it, check it, write back. No sign-up.',
});

export default function AboutPage() {
  const email = contactEmail();
  const toc: TocEntry[] = [
    { id: 'how-it-works', label: 'How a story becomes a lesson' },
    { id: 'where-stories-come-from', label: 'Where the stories come from' },
    { id: 'practice-stories', label: 'Practice stories' },
    { id: 'what-you-collect', label: 'What you collect' },
    { id: 'your-progress', label: 'Your progress stays with you' },
    { id: 'the-name', label: 'Why “Wiege”' },
    { id: 'wiegebot', label: 'For news sites' },
  ];

  return (
    <SiteShell>
      <InfoPage
        title="About Wiege."
        lede="Wiege is a free reading app for students aged 12 to 15. It turns recent news about writing, games, art and sport into short lessons: read it, check it, write back."
        toc={toc}
      >
        <InfoSection
          id="how-it-works"
          title="How a story becomes a lesson"
          note={
            <Callout label="Two levels, one story.">
              Grade <N>7–8</N> and Grade <N>9–10</N> tell the same news. Pick the one that feels right; you can change it any time.
            </Callout>
          }
        >
          <Steps
            steps={[
              {
                title: 'Read',
                body: 'Every story is retold for you at two levels. Tap any word you don’t know to see what it means, then save it to your words.',
              },
              {
                title: 'Check',
                body: 'Answer five questions about the story. You find out straight away whether you got it, and why.',
              },
              {
                title: 'Write',
                body: 'Pick one of three short prompts and write back. Ask for notes and you get two things that work and two things to try next.',
              },
            ]}
          />
          <P>Every story ends with two questions to talk about with someone, and a link to the original.</P>
        </InfoSection>

        <InfoSection
          id="where-stories-come-from"
          title="Where the stories come from"
          note={
            <Callout label="Fresh every four hours.">
              Wiege looks for new stories at <N>00:00</N>, <N>04:00</N>, <N>08:00</N>, <N>12:00</N>, <N>16:00</N> and <N>20:00</N> UTC.
            </Callout>
          }
        >
          <P>
            The news comes from a short list of trusted sites, like BBC Newsround, Nintendo Life, Colossal and BBC Sport. Wiege checks them for new stories every four hours.
          </P>
          <P>
            Before a story shows up, Wiege checks that it’s right for readers aged <N>12</N> to <N>15</N>. Anything that might not be is left out. Then Wiege writes its own version
            of the story for you, and always links to the original.
          </P>
          <P>
            News stays on Wiege for <N>120</N> days, then makes room for newer stories. Parents and teachers can see every source, and how the checks work, on the{' '}
            <TextLink href="/parents">page for parents and teachers</TextLink>.
          </P>
        </InfoSection>

        <InfoSection id="practice-stories" title="Practice stories">
          <P>
            Stories labelled Practice story were written for Wiege, not taken from the news. There are <N>12</N> of them, three in each category, and they explain something true
            that doesn’t go out of date, like why a marathon is <N>42.195</N> kilometres or how chess changed as it travelled the world.
          </P>
          <P>They work just like news stories: two levels, words to tap, questions and prompts. They’re always there, even on a slow news day.</P>
        </InfoSection>

        <InfoSection
          id="what-you-collect"
          title="What you collect"
          note={<Callout label="It’s all yours.">You can see, back up and delete everything you collect.</Callout>}
        >
          <List>
            <li>
              <Lead>Words.</Lead> Save any word you look up, then practise with flashcards. The mark on each word shows how well you know it, from Just met to Know it cold.
            </li>
            <li>
              <Lead>A journal.</Lead> Everything you write is kept, with any notes you got on it.
            </li>
            <li>
              <Lead>A streak.</Lead> Read on days in a row and your tally grows. Miss a day and you simply start a new line.
            </li>
            <li>
              <Lead>Stamps.</Lead> There are <N>12</N> to earn, like One week for reading seven days in a row, and All four for finishing a story from every category.
            </li>
            <li>
              <Lead>XP and levels.</Lead> Finished stories, right answers, saved words and journal entries all earn XP, taking you from Scribbler all the way to Laureate.
            </li>
          </List>
        </InfoSection>

        <InfoSection id="your-progress" title="Your progress stays with you">
          <P>
            There are no accounts. Everything you collect is saved in this browser, on this device, and not on Wiege’s server. To carry on with another device, save a backup file
            in <TextLink href="/settings">Settings</TextLink> and restore it there.
          </P>
          <P>
            The <TextLink href="/privacy">privacy page</TextLink> explains exactly what stays on your device and what leaves it.
          </P>
        </InfoSection>

        <InfoSection id="the-name" title="Why “Wiege”">
          <P>
            Wiege (say it <span className="font-semibold">VEE-guh</span>) is German for cradle: the place where things begin. Here, that means a new word, a new idea or a new
            reader.
          </P>
        </InfoSection>

        <InfoSection id="wiegebot" title="For news sites">
          <P>
            Wiege’s fetcher calls itself WiegeBot and links to this page. Every four hours it reads the public news feeds listed on the{' '}
            <TextLink href="/parents#sources">page for parents and teachers</TextLink>, asking only for what has changed since last time. When AI lessons are on, it may also read a
            new article’s page once, to help write the retelling.
          </P>
          <P>
            Wiege keeps only the headline, the feed’s short summary and the link. The article itself is never stored or shown, and every story links back to its original.
            {email ? (
              <>
                {' '}
                To ask about your site, email <ExternalLink href={`mailto:${email}`}>{email}</ExternalLink>.
              </>
            ) : null}
          </P>
        </InfoSection>

        <div className="grid justify-items-start gap-3">
          <h2 className="type-h3">Your first story is already waiting.</h2>
          <LinkButton href="/today" className="mt-3">
            Start reading
          </LinkButton>
          <p className="text-caption text-ink-3">Free. No sign-up.</p>
        </div>
      </InfoPage>
    </SiteShell>
  );
}
