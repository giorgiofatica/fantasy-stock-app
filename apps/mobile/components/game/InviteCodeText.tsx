import { Text, type TextProps } from '@/components/sp/Text';

// An invite code on its own line (Design Lead ruling 2026-11-01): one token that never breaks and fits itself to one
// line down to 0.6x. At XXXL "ASC-0fc85d9d" wrapped a lone "d" onto its own line. numberOfLines 1 +
// adjustsFontSizeToFit shrink it rather than wrap, so no line can end inside it. Every surface that shows a code by
// itself draws it through here (League settings, the pre-draft Home card, the draft blockers card, Create league's
// done screen); tests-deno/league-settings-commissioner-and-codes.test.ts pins each one.
//
// It draws the PLAIN code, not keepCode's word-joined string: on one line a joiner adds nothing, and a joiner takes
// its own share of letterSpacing (the Home card tracks its code at 2pt, so every glyph gap doubled: "A S C - 0 f c").
// It also keeps what a selectable code copies, and what VoiceOver reads, exactly the code. keepCode (lib/game/keepDots)
// is for a code inside a SENTENCE, where the line can break around it.

export const CODE_MIN_SCALE = 0.6;

export function InviteCodeText({ code, ...rest }: Omit<TextProps, 'children' | 'numberOfLines'> & { code: string }) {
  return (
    <Text
      {...rest}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={CODE_MIN_SCALE}
    >
      {code}
    </Text>
  );
}
