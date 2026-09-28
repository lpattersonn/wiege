/**
 * Element ids and the tap group shared by the reader's server markup and its
 * client islands. A plain module on purpose: a server component that imports
 * a constant from a 'use client' file gets a client reference, not the value.
 */
export { READER_ID } from './prefs-script';

/** Tap-store group for every word note in the reader. */
export const TAP_GROUP = 'reader';
/** The margin note (≥ 1024px) or word sheet (below): the tap words' aria-controls target. */
export const NOTE_ID = 'reader-note';
/** The story text of both levels (taps on any word are resolved inside it). */
export const STORY_BODY_ID = 'story-body';
/** Pen marks the student makes on the text (free-word loops, quiz evidence) are drawn in here. */
export const OVERLAY_ID = 'story-overlay';
