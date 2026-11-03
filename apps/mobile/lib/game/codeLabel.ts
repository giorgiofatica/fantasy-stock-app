// The caption label over an invite code ("Invite code") takes the CODE's Dynamic Type cap (P3, Design Lead
// 2026-11-02). The code (components/game/InviteCodeText.tsx) is capped by its variant's maxScale while a caption
// scales freely, so at AX5 the label was drawn larger than the code it names: on Create league's done screen
// (title, capped 1.6) and the draft blockers card (headline, capped 1.6). Same rule as "links never outrank their
// panel" (components/sp/WarnPanel.tsx): the smaller text shares the larger one's cap. Under the cap nothing moves,
// so L and XXXL are unchanged. An uncapped code (callout: League settings, the pre-draft Home card) returns
// undefined and its label keeps scaling with it. Pure, for tests-deno.

import { type, type TypeVariant } from '../../constants/tokens/type';

/** The maxFontSizeMultiplier for the label over a code drawn in `codeVariant`. */
export function codeLabelMaxScale(codeVariant: TypeVariant): number | undefined {
  return type[codeVariant].maxScale;
}
