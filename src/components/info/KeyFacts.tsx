import type { ReactNode } from 'react';

/**
 * "The short version": the page's key facts in one bordered panel at the top
 * of the text column, each led by its icon and a bold first phrase (front-
 * loaded for scanning). The details follow in the sections below.
 */
export interface KeyFact {
  icon: ReactNode;
  lead: string;
  body: ReactNode;
}

export function KeyFacts({ id, title, facts }: { id: string; title: string; facts: readonly KeyFact[] }) {
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="grid scroll-mt-24 gap-x-12 lg:grid-cols-[minmax(0,1fr)_288px] xl:grid-cols-[minmax(0,1fr)_312px]">
      <div className="min-w-0 rounded-paper border border-line-soft px-5 py-6 md:p-8">
        <h2 id={headingId} className="type-h3">
          {title}
        </h2>
        <ul className="mt-6 grid gap-5">
          {facts.map((fact) => (
            <li key={fact.lead} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-4">
              <span className="pt-[3px] text-ink">{fact.icon}</span>
              <p className="type-ui text-ink-2">
                <strong className="font-bold text-ink">{fact.lead}</strong> {fact.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
