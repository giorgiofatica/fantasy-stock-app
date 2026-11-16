/**
 * The two dead-end screens that join the refusal family (board #call-dead-links, B; Giorgio 2026-11-16, "B"; PRODUCT_RULES, "Two more
 * dead ends join that family"). Each is a picture, a heading that ends in a full stop, at most ONE line under it, and the way out docked
 * at the bottom (components/shell/RefusalScreen.tsx). Both screens and the test that pins the exact words read this module.
 *
 *   app/reset-password.tsx   the dead reset link       unlink   "This link didn't work."   "It may have been opened on a different device."   [Request a new link] · Back to sign in
 *   app/+not-found.tsx       the not-found page        search   "Nothing here."            "This link is old or incomplete."                  [Go to Home]
 *
 * "It may have been opened on a different device." is NEW copy, approved by his pick (cut down from the sentence the reset screen showed).
 * "Everything in your leagues is still where you left it." is gone from the not-found page.
 */
import type { IconName } from '../../components/sp/logic/icon';

export interface DeadLinkCopy {
  icon: IconName;
  heading: string;
  line: string;
  primary: string;
  secondary?: string;
}

export const RESET_DEAD_LINK: DeadLinkCopy = {
  icon: 'unlink',
  heading: "This link didn't work.",
  line: 'It may have been opened on a different device.',
  primary: 'Request a new link',
  secondary: 'Back to sign in',
};

export const NOT_FOUND: DeadLinkCopy = {
  icon: 'search',
  heading: 'Nothing here.',
  line: 'This link is old or incomplete.',
  primary: 'Go to Home',
};
