import 'server-only';

import { getEnv } from '@/lib/env';

/**
 * The owner's contact address (`WIEGE_CONTACT_EMAIL`), or null when it is not
 * set or the environment is invalid. The info pages are static, so this is
 * read at build time; pages leave the contact line out entirely when null.
 */
export function contactEmail(): string | null {
  try {
    return getEnv().WIEGE_CONTACT_EMAIL ?? null;
  } catch {
    return null;
  }
}
