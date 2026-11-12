/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { ReactNode, useCallback, useState } from 'react';
import { LayoutChangeEvent, NativeSyntheticEvent, Pressable, StyleSheet, Switch, TextLayoutEventData, useWindowDimensions, View, ViewProps } from 'react-native';

import { radius, space, typeFontFamily } from '@/constants/tokens';
import { Card } from '@/components/sp/Card';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { fontScaleKey } from '@/components/sp/logic/remeasureKey';
import { isStacked, nextBrokeAt, subAfterValue, valueLinesAt } from '@/lib/game/labelBreaks';

// 3c-2 — the row vocabulary of the board's setup frames (DraftSettingsScreen,
// RibReview: a card of `ks-rows`, each a callout-weight key, a muted value and
// a chevron when it opens something). Game Night (W4): the card is the §9C Card (surface
// + rim), its rows divided by space, never by a line. Nothing here truncates: titles, values
// and help lines wrap at every Dynamic Type size (§9B). Every pressable row is
// at least 44 pt tall.

/** A setup card: the board's `ks-card` (surface, 14 pt corners). */
export function SetupCard({ style, children, ...rest }: ViewProps) {
  return (
    <Card style={[styles.card, style]} {...rest}>
      {children}
    </Card>
  );
}

/** Between rows inside a SetupCard: SPACE, never a line (Game Night §9C rule 2, "separation
 * by surface, never by rules"; W4 League). The name stays so every caller keeps its rhythm. */
export function RowDivider() {
  return <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

/** A 1 pt rule across a SetupCard, edge to edge: the Season step's rows (the approved board, B, draws one between Managers,
 * Regular season, Playoff teams and the strip). The card's other rows still divide by SPACE (RowDivider, §9C rule 2); this
 * is only for the card the board draws with rules. */
export function SetupRule() {
  const { colors } = useTheme();
  return <View style={[styles.rule, { backgroundColor: colors.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

/** A section's bold key, the board's `ks-callout` at weight 600. */
export function RowKey({ children, maxScale, onTextLayout }: { children: string; maxScale?: number; onTextLayout?: (e: NativeSyntheticEvent<TextLayoutEventData>) => void }) {
  return (
    <Text variant="callout" maxFontSizeMultiplier={maxScale} style={styles.key} onTextLayout={onTextLayout}>
      {children}
    </Text>
  );
}

/** Has this row's label broken inside a word? A row lays out as it always did (label beside its value and control); only
 * once its label breaks mid-word does it stack, so nothing moves at the sizes where every label fits. Reset when the
 * Dynamic Type size changes, so a smaller size lays out beside again. */
export function useLabelBreaks() {
  const { fontScale } = useWindowDimensions();
  const [brokeAt, setBrokeAt] = useState<number | null>(null);
  const onTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      // Read the event BEFORE the updater: it runs after the handler returns, when the native event is already released
      // ("Cannot read property 'layout' of null" at Accessibility XXXL, found by the account-deletion capture pass).
      const lines = e.nativeEvent.lines;
      setBrokeAt((prev) => nextBrokeAt(prev, fontScale, { kind: 'lines', lines }));
    },
    [fontScale],
  );
  // A label squeezed to nothing reports no broken line (there was no room for one): its column's width says so.
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const width = e.nativeEvent.layout.width;
      setBrokeAt((prev) => nextBrokeAt(prev, fontScale, { kind: 'width', width }));
    },
    [fontScale],
  );
  // A text-size change must also re-lay the row's CONTAINERS: remounting only its Texts (the sp Text key) leaves the
  // wrapper Views' flex layout from the old size, so a value squeezed beside a wide label column stays wrapped at the
  // smaller size ("Sat, Oct 3 · / 7:00 PM ET" after AX5 -> L). Keying the row's root by the scale starts it over.
  return { broke: isStacked(brokeAt, fontScale), onTextLayout, onLayout, fontScale, remountKey: fontScaleKey(fontScale) };
}

export interface SettingRowProps {
  label: string;
  value?: string;
  sub?: string;
  /** Colours the value (e.g. warnText for a TBD draft date). */
  valueColor?: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Overrides the VoiceOver label (default: label, value). */
  accessibilityLabel?: string;
  /** A Dynamic Type cap for the row's text, where the row sits on a screen whose figures
   * are capped (League: 1.5×, the gains' 19.5pt). Unset: the text scales freely (forms). */
  maxScale?: number;
}

/** Key, value, optional sub-line, and a chevron when it opens something. */
export function SettingRow({ label, value, sub, valueColor, onPress, disabled = false, accessibilityLabel, maxScale }: SettingRowProps) {
  // A static row without a help line always wraps: a value that cannot sit beside its label (an amount at XXXL, keepMoney)
  // drops UNDER it, so a label is never squeezed to nothing (W8 follow-up: Create league's summary lost "Name" and "Stakes").
  // Every other row (a chevron, or a help line, whose width is not the label's) keeps its one-line layout until its label
  // breaks inside a word, then stacks: the value and the chevron drop under the label (the label-no-midword round: a row
  // with a chevron broke "Commissioner" into "Commis / sioner" and lost "Draft time").
  const { broke, onTextLayout: onLabelLayout, onLayout: onLabelBox, fontScale, remountKey } = useLabelBreaks();
  const stack = (!onPress && !sub) || broke;
  // A value that runs to several lines reads LEFT (beside the label or stacked under it); a one-line value keeps the
  // right alignment it always had, which is the same pixel (left-aligned, it sits up to a pixel off the box's edge).
  // Stored with the size it was measured at and read only at that size (valueLinesAt), like the label's latch.
  const [measuredLines, setMeasuredLines] = useState<{ fontScale: number; lines: number }>({ fontScale, lines: 1 });
  const valueLines = valueLinesAt(measuredLines, fontScale);
  const chevron = <Icon name="chevronRight" size="callout" tone="text2" />;
  // Stacked with a sub-line: label, then the value, then the sub on its own full-width line (labelBreaks.subAfterValue).
  const subLast = subAfterValue(stack, sub);
  const subText = sub ? (
    <Text variant="caption" tone="secondary" style={subLast ? styles.subLast : undefined}>
      {sub}
    </Text>
  ) : null;
  const valueText = value ? (
    <Text
      variant="callout"
      tone="secondary"
      color={valueColor}
      style={stack && valueLines > 1 ? [styles.value, styles.valueMulti] : styles.value}
      onTextLayout={
        stack
          ? (e) => {
              const lines = e.nativeEvent.lines.length;
              setMeasuredLines({ fontScale, lines });
            }
          : undefined
      }
    >
      {value}
    </Text>
  ) : null;
  const body = (
    <View key={remountKey} style={[styles.settingRow, stack && styles.settingRowWrap, disabled && styles.dim]}>
      <View style={stack ? styles.growWrap : styles.grow} onLayout={onPress || sub ? onLabelBox : undefined}>
        <RowKey maxScale={maxScale} onTextLayout={onPress || sub ? onLabelLayout : undefined}>
          {label}
        </RowKey>
        {subLast ? null : subText}
      </View>
      {onPress && value && stack ? (
        // The chevron stays with its value once stacked: the pair wraps together, never a chevron alone on a line.
        <View style={styles.valueWithChevron}>
          {valueText}
          {chevron}
        </View>
      ) : (
        <>
          {valueText}
          {onPress ? stack ? <View style={styles.trailing}>{chevron}</View> : chevron : null}
        </>
      )}
      {subLast ? subText : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${label}, ${value}` : label)}
      accessibilityState={{ disabled }}
    >
      {body}
    </Pressable>
  );
}

export interface ChoiceRowProps {
  title: string;
  help?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** The "i" at the end of the row (an <InfoButton>; UX rule 13). A SIBLING of the radio, never inside it: an accessible radio hides
   * its children from VoiceOver, and tapping the "i" must not select the option. */
  info?: ReactNode;
}

/** One option of a single choice (a radio): the title, a help line, and a
 * check on the selected one (the League sheet's selection mark). */
export function ChoiceRow({ title, help, selected, onPress, disabled = false, info }: ChoiceRowProps) {
  const radio = (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.choiceRow, info ? styles.choicePress : null, disabled && styles.dim]}
    >
      <View style={styles.grow}>
        <Text variant="callout" style={styles.key}>
          {title}
        </Text>
        {help ? (
          <Text variant="caption" tone="secondary">
            {help}
          </Text>
        ) : null}
      </View>
      <View style={styles.check}>{selected ? <Icon name="check" size="headline" tone="accent" /> : null}</View>
    </Pressable>
  );
  if (!info) return radio;
  return (
    <View style={styles.choiceWithInfo}>
      {radio}
      {info}
    </View>
  );
}

/** A label that ends in an "i" (a segmented control's label, Draft order): the key, then the "i", on one row that wraps at the
 * large sizes. The "i" is its own 44 pt target; the label never shrinks below its own words. */
export function LabelWithInfo({ label, info }: { label: string; info: ReactNode }) {
  return (
    <View style={styles.labelWithInfo}>
      <View style={styles.labelShrink}>
        <RowKey>{label}</RowKey>
      </View>
      {info}
    </View>
  );
}

export interface SwitchRowProps {
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** The "i" after the label (an <InfoButton>; UX rule 13), its own 44 pt target. */
  info?: ReactNode;
}

/** A label, an optional help line, and a Switch. */
export function SwitchRow({ label, sub, value, onValueChange, disabled = false, info }: SwitchRowProps) {
  const { colors } = useTheme();
  // Beside the label until the label breaks inside a word; then the switch drops under it (see SettingRow).
  const { broke, onTextLayout, onLayout, remountKey } = useLabelBreaks();
  const sw = (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ false: colors.border, true: colors.accent }}
    />
  );
  return (
    <View key={remountKey} style={[styles.settingRow, broke && styles.settingRowWrap, disabled && styles.dim]}>
      <View style={broke ? styles.growWrap : styles.grow} onLayout={onLayout}>
        {info ? (
          <View style={styles.labelWithInfo}>
            <View style={styles.labelShrink}>
              <RowKey onTextLayout={onTextLayout}>{label}</RowKey>
            </View>
            {info}
          </View>
        ) : (
          <RowKey onTextLayout={onTextLayout}>{label}</RowKey>
        )}
        {sub ? (
          <Text variant="caption" tone="secondary">
            {sub}
          </Text>
        ) : null}
      </View>
      {broke ? <View style={styles.trailing}>{sw}</View> : sw}
    </View>
  );
}

/** The board's warn-tint card (ByeNotice, setup blockers): informational by
 * default (a note); `alert` when it explains why an action is refused. No icon
 * (§9B: refusals and blockers keep their warn-tint card, with no icon). Both lines read the
 * fill's own ink, `warnText` (§9C rule 4, as the money screens' WarnPanel; W4 Onboarding). */
export function WarnNote({ title, line, alert = false }: { title: string; line?: string; alert?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole={alert ? 'alert' : 'text'}
      style={[styles.warn, { backgroundColor: colors.warnTint, borderColor: colors.warnLine }]}
    >
      <Text variant="callout" color={colors.warnText} style={styles.key}>
        {title}
      </Text>
      {line ? <Text variant="caption" color={colors.warnText}>{line}</Text> : null}
    </View>
  );
}

/** A neutral note with the lock icon (League settings while locked; Design
 * Lead ruling): informational, not a warning, so `sunken`, not the warn tint. */
export function LockNote({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={text} style={[styles.lock, { backgroundColor: colors.sunken }]}>
      <Icon name="lock" size="callout" tone="text2" />
      <Text variant="callout" tone="secondary" style={styles.grow}>
        {text}
      </Text>
    </View>
  );
}

/** Children in a row container with a gap (for chips, buttons). */
export function RowWrap({ children }: { children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    paddingHorizontal: space[5],
    paddingVertical: space[2],
  },
  divider: {
    height: space[2],
  },
  // Full-bleed inside the card: it cancels the card's own horizontal padding.
  rule: {
    height: 1,
    marginHorizontal: -space[5],
  },
  key: {
    fontFamily: typeFontFamily.semiBold,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 44,
    paddingVertical: space[4],
  },
  // Static rows: the label sizes to its content (flexBasis auto, not flex: 1's 0) so the row CAN wrap; the value
  // sits at the right edge beside the label, or drops UNDER it, at the left (space-between starts a lone item at the
  // start), like the Renewal review and the Join preview.
  settingRowWrap: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    // A wrapping row's lines hug the top (alignContent flex-start), where the one-line row centred in its minHeight:
    // keep a single line centred so nothing moves at normal size.
    alignContent: 'center',
    columnGap: space[3],
    rowGap: space[1],
  },
  // The label never shrinks: its basis is its own width, capped by the row's (a Text is measured at most the container
  // wide), so it only wraps BETWEEN words, and what does not fit beside it wraps to the next line instead.
  growWrap: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    gap: space[1],
  },
  // A stacked row's sub-line: its own full-width line, after the value.
  subLast: {
    flexBasis: '100%',
  },
  // A control after the label (a chevron on its own, a switch): the right edge of whichever line it lands on.
  trailing: {
    marginLeft: 'auto',
  },
  // A value and its chevron: one wrap item, so the chevron is never left alone on a line. The value shrinks inside it
  // when it is longer than the line; otherwise the pair sits right after the label, as the one-line row always did.
  valueWithChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space[3],
    flexShrink: 1,
  },
  // The value's box shrink-wraps its text: on its own line it starts at the left, and several lines read left too.
  valueMulti: {
    textAlign: 'left',
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 44,
    paddingVertical: space[4],
  },
  // A choice row with an "i": the radio takes the width, the "i" (44 pt) sits at the end.
  choiceWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  choicePress: {
    flex: 1,
  },
  // A label and its "i" on one row. The "i" never wraps under the label (it would read as belonging to nothing): the label
  // wraps its own words between lines and the "i" stays beside it, vertically centred (the board's LabelI).
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space[2],
  },
  labelShrink: {
    flexShrink: 1,
  },
  grow: {
    flex: 1,
    gap: space[1],
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  check: {
    width: 24,
    alignItems: 'center',
  },
  dim: {
    opacity: 0.5,
  },
  warn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[1],
  },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
});
