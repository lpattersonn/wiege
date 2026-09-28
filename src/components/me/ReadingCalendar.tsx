'use client';

import { useId } from 'react';

import { useLocalState } from '@/components/local/hooks';
import { fnv1a, mulberry32, r1 } from '@/components/pen/pen';
import { cx } from '@/components/ui/cx';
import type { LocalState } from '@/lib/local/schema';
import { readingCalendar, type CalendarDay } from '@/lib/progress/stats';
import { dayKey } from '@/lib/time';

import { calendarRows, calendarSummary, cellMark, cellText, weekHeaders, WEEKDAYS, type CellMark } from './me-view';
import { Placeholder } from './Placeholder';

const WEEKS = 12;

const selectCalendar = (s: LocalState) => readingCalendar(s.activity, dayKey(Date.now(), s.prefs.timezone), WEEKS);

/** A short pen slash for a reading day, seeded by the date so it never changes. */
function slashPath(day: string): string {
  const r = mulberry32(fnv1a(`slash:${day}`));
  const j = () => (r() - 0.5) * 1.6;
  return `M${r1(2.6 + j())} ${r1(11.6 + j())}Q${r1(6.4 + j())} ${r1(7.6 + j())} ${r1(11.4 + j())} ${r1(2.4 + j())}`;
}

function Mark({ mark, day }: { mark: CellMark | 'placeholder'; day: string }) {
  const ring = mark === 'today-read' || mark === 'today-waiting';
  const slash = mark === 'read' || mark === 'today-read';
  if (mark === 'none' || mark === 'placeholder') return <span className="block size-1 rounded-full bg-line-control" />;
  if (mark === 'future') return null;
  return (
    <svg viewBox="0 0 14 14" width={14} height={14} aria-hidden="true" focusable="false" className="pm-static">
      {ring ? <circle cx={7} cy={7} r={6.6} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="2 2.4" /> : null}
      {slash ? <path d={slashPath(day)} /> : null}
    </svg>
  );
}

/**
 * The 12-week reading calendar (DESIGN §12.7) as a real table: rows are
 * weekdays, columns are weeks (oldest first). A reading day is a short pen
 * slash, other days a 4px dot, today a dashed ring. Every cell carries text
 * ("Read", "No reading", "Today, not yet"), and the row and column headers give
 * the date, so nothing depends on the marks alone. Fits 320px without scrolling.
 */
export function ReadingCalendar({ headingId }: { headingId: string }) {
  const columns = useLocalState(selectCalendar);
  const summaryId = useId();
  const headers = columns ? weekHeaders(columns) : null;
  const rows = columns ? calendarRows(columns) : null;

  return (
    <div aria-busy={columns === null || undefined}>
      <h2 id={headingId} className="type-h3">
        The last 12 weeks
      </h2>
      <p id={summaryId} className="mt-3 min-h-[52px] max-w-[44ch] text-ui text-ink-2">
        {columns ? calendarSummary(columns) : <Placeholder sizer="You read on 14 days in the last 12 weeks." />}
      </p>

      <table
        aria-labelledby={headingId}
        aria-describedby={summaryId}
        aria-hidden={columns === null || undefined}
        className="mt-4 -ml-[clamp(4px,1.6vw,14px)] border-separate [border-spacing:clamp(4px,1.6vw,14px)_clamp(6px,0.8vw,8px)]"
      >
        <caption className="sr-only">Each column is one week, oldest first. Each row is a day of the week.</caption>
        <thead>
          <tr>
            <td className="p-0" />
            {Array.from({ length: WEEKS }, (_, i) => {
              const header = headers?.[i];
              return (
                <th key={header?.start ?? i} scope="col" className="relative h-5 w-3.5 min-w-3.5 p-0 font-normal">
                  {header?.month ? (
                    <span aria-hidden="true" className="absolute bottom-0.5 left-0 text-caption leading-none font-bold whitespace-nowrap text-ink-3">
                      {header.month}
                    </span>
                  ) : null}
                  {header ? <span className="sr-only">{header.label}</span> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((weekday, rowIndex) => {
            const row = rows?.[rowIndex];
            return (
              <tr key={weekday.name}>
                <th scope="row" className="h-3.5 p-0 pr-1 text-left align-middle text-caption leading-none font-bold whitespace-nowrap text-ink-3">
                  <span aria-hidden="true" className={cx(!weekday.labelled && 'invisible')}>
                    {weekday.short}
                  </span>
                  <span className="sr-only">{weekday.name}</span>
                </th>
                {Array.from({ length: WEEKS }, (_, col) => {
                  const day: CalendarDay | undefined = row?.cells[col];
                  const mark = day ? cellMark(day) : 'placeholder';
                  return (
                    <td key={day?.day ?? col} className="size-3.5 p-0 align-middle">
                      <span className="grid size-3.5 place-items-center">
                        <Mark mark={mark} day={day?.day ?? ''} />
                      </span>
                      {day ? <span className="sr-only">{cellText(mark as CellMark)}</span> : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul aria-hidden="true" className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-caption font-semibold text-ink-2">
        <li className="inline-flex items-center gap-2">
          <span className="grid size-3.5 place-items-center">
            <Mark mark="read" day="legend" />
          </span>
          Read
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="grid size-3.5 place-items-center">
            <Mark mark="none" day="legend" />
          </span>
          No reading
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="grid size-3.5 place-items-center">
            <Mark mark="today-waiting" day="legend" />
          </span>
          Today
        </li>
      </ul>
    </div>
  );
}
