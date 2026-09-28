import { PageContainer, Section, SectionHead } from '@/components/layout/PageContainer';
import { MASTERY_LEVELS, MarkedWord } from '@/components/pen/MasteryMark';
import { AsideArrow, MiniTick, Tally } from '@/components/pen/marks';
import { MetaItem, MetaRow } from '@/components/ui/MetaRow';
import { StampGrid, StampTile } from '@/components/ui/StampTile';
import { BADGES, type BadgeId } from '@/lib/progress/badges';

/**
 * "What you keep" (DESIGN §12.1, §14 IKEA effect): an example notebook, a
 * spread with a 1.5px ink spine — words marked by mastery, the journal, the
 * streak tally and stamps. Everything here is labelled as an example ("This
 * one is an example" in the lede; the hand aside only repeats it); the
 * student's own notebook lives on /me and /words.
 */
export interface NotebookExample {
  /** Five words for the mastery ladder (the demo story's vocabulary). */
  words: string[];
  journal: { title: string; kind: string; words: number } | null;
}

const EXAMPLE_STREAK = 12;
const STAMPS: Array<{ id: BadgeId; earned: boolean; how?: string }> = [
  { id: 'first-story', earned: true, how: 'Finished a whole lesson' },
  { id: 'streak-7', earned: true, how: 'Read on 7 days in a row' },
  { id: 'words-10', earned: true, how: 'Saved 10 words to practise' },
  { id: 'all-four', earned: false },
];

export function Notebook({ example }: { example: NotebookExample }) {
  return (
    <Section rule labelledBy="notebook-title">
      <PageContainer>
        <div className="relative">
          <SectionHead
            id="notebook-title"
            title="Your notebook fills up as you read."
            lede="Words you collect, days you read, what you write and the stamps you earn. It all lives on this device, and you can back it up any time. This one is an example, a few weeks in."
          />
          <p aria-hidden="true" className="-mt-4 mb-8 flex items-end gap-1 lg:absolute lg:right-0 lg:bottom-2 lg:m-0 xl:right-[12%]">
      <span className="type-hand">what yours could look like</span>
            <AsideArrow direction="down" />
          </p>
        </div>
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-0">
          <div className="lg:py-2 lg:pr-14">
            <h3 className="font-title text-[26px] leading-[1.1] font-bold text-balance lg:text-[28px]">Words, marked by how well you know them</h3>
            <p className="mt-2 max-w-[44ch] text-nav leading-normal text-ink-2">Every flashcard round moves the pen mark on. Circled means you know it cold.</p>
            <ul className="word-list mt-6 grid">
              {MASTERY_LEVELS.map((level, i) => (
                <li key={level.level} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line-soft py-2">
                  <span className="justify-self-start font-title text-[26px] leading-[1.2] font-bold md:text-[30px]">
                    <MarkedWord word={example.words[i]} level={level.level} scope="landing-notebook" />
                  </span>
                  <span className="text-right text-small leading-snug font-bold text-ink-2">
                    {level.label}
                    <span className="block text-caption font-normal text-ink-3">{level.next}</span>
                  </span>
                </li>
              ))}
            </ul>

            {example.journal ? (
              <>
                <h3 className="mt-12 font-title text-[26px] leading-[1.1] font-bold text-balance lg:text-[28px]">Everything you write</h3>
                <p className="mt-2 max-w-[44ch] text-nav leading-normal text-ink-2">Each story ends with a short prompt. Your answers stay in your journal.</p>
                <div className="mt-6 rounded-paper border border-line-soft p-4">
                  <p className="font-title text-[22px] leading-[1.2] font-bold">{example.journal.title}</p>
                  <MetaRow className="mt-2">
                    <MetaItem>{example.journal.kind}</MetaItem>
                    <MetaItem>
                      <span>
                        <span className="num">{example.journal.words}</span> words
                      </span>
                    </MetaItem>
                    <MetaItem icon={<MiniTick size={14} />}>Notes ready</MetaItem>
                  </MetaRow>
                </div>
              </>
            ) : null}
          </div>

          <div className="lg:border-l-[1.5px] lg:border-ink lg:py-2 lg:pl-14">
            <h3 className="font-title text-[26px] leading-[1.1] font-bold text-balance lg:text-[28px]">Days you read, one stroke each</h3>
            <p className="mt-6">
              <span className="block type-numeral-xl">{EXAMPLE_STREAK}</span>
              <span className="mt-3 block text-ui font-bold">days in a row</span>
            </p>
            <Tally count={EXAMPLE_STREAK} className="mt-6" />
            <p className="mt-4 max-w-[44ch] text-nav leading-normal text-ink-2">
              Read one story today to make it <span className="num">{EXAMPLE_STREAK + 1}</span>. Miss a day and you simply start a new line.
            </p>

            <h3 className="mt-12 font-title text-[26px] leading-[1.1] font-bold lg:text-[28px]">Stamps</h3>
            <StampGrid className="mt-6">
              {STAMPS.map((stamp) => {
                const badge = BADGES.find((b) => b.id === stamp.id);
                if (!badge) return null;
                return <StampTile key={stamp.id} id={stamp.id} name={badge.name} how={stamp.earned ? (stamp.how ?? badge.hint) : badge.hint} earned={stamp.earned} />;
              })}
            </StampGrid>
          </div>
        </div>
      </PageContainer>
    </Section>
  );
}
