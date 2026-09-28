/**
 * A script that runs during HTML parsing on hard loads, and is inert on
 * client renders (type text/plain), per the Next "preventing flash before
 * hydration" guide. Keep the code tiny and self-contained.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
