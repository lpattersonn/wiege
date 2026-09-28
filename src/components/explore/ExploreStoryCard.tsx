import { ReadMarker } from '@/components/local/LocalCount';
import { StoryCardM } from '@/components/story/StoryCard';
import { Tag } from '@/components/ui/Chip';
import type { StorySummary } from '@/lib/stories';

import type { CardDetails } from './card-details';

/**
 * One M story card on /c/[category] (DESIGN §11.6): key-word cover, meta
 * (practice tag, category, minutes, the on-device "Read" marker), title and
 * a two-line summary. Server-rendered for the static first page and
 * rendered on the client for "Load more", so both look identical.
 */
export function ExploreStoryCard({ story, details }: { story: StorySummary; details?: CardDetails | null }) {
  return (
    <StoryCardM
      href={`/read/${encodeURIComponent(story.slug)}`}
      slug={story.slug}
      title={story.title}
      category={story.category}
      word={details?.word ?? null}
      minutes={details?.minutes ?? undefined}
      summary={story.keyIdea || undefined}
      tag={story.isSample ? <Tag>Practice story</Tag> : undefined}
      status={<ReadMarker slug={story.slug} />}
      headingLevel="h3"
    />
  );
}
