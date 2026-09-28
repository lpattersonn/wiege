import { cx } from '@/components/ui/cx';

/** "9 new today" (numeral Atkinson 800 20) or "Nothing new yet today" (DESIGN §11.7). */
export function NewTodayLine({ count, className }: { count: number; className?: string }) {
  return (
    <p className={cx('flex items-center gap-2 text-small font-bold text-ink', className)}>
      {count > 0 ? (
        <>
          <span className="num text-[20px] leading-none font-extrabold">{count}</span> new today
        </>
      ) : (
        'Nothing new yet today'
      )}
    </p>
  );
}
