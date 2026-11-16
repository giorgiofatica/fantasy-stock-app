/**
 * The two dead-end screens that join the refusal family (board #call-dead-links, B; Giorgio 2026-11-16, "B"; PRODUCT_RULES, "Two more
 * dead ends join that family"). Each is a picture, a heading that ends in a full stop, at most ONE line under it, and the way out docked
 * at the bottom (components/shell/RefusalScreen.tsx). Both screens and the test that pins the exact words read this module.
 *
 *   app/reset-password.tsx   the dead reset link      (icon unlink; primary "Request a new link"; secondary "Back to sign in")
 *   app/+not-found.tsx       the not-found page       (icon search; primary "Go to Home")
 *
 * The line under the reset heading is NEW copy, approved by his pick (cut down from the sentence the reset screen showed). The not-found page
 * dropped its second sentence about the leagues. The words live ONCE, below, so a change to them is a change to a constant a test pins literally.
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
