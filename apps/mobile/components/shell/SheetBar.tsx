/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles` is declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { ActivityIndicator, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { space, typeFontFamily } from '@/constants/tokens';
import { clearOf } from '@/constants/tokens/color';
import { Icon } from '@/components/sp/Icon';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { useInputRemountKey } from '@/components/sp/useInputRemountKey';
import { useScreenTopInset } from '@/components/shell/ScreenPresentation';
import {
  SHEET_BAR_CLOSE_PAD,
  SHEET_BAR_SAVE_PAD,
  SHEET_BAR_HEIGHT,
  SHEET_BAR_MAX_SCALE,
  SHEET_BAR_SIDE,
  SHEET_BAR_TITLE_SIZE,
  SHEET_BAR_TARGET,
  SHEET_EDGE_DIVIDER,
  saveInert,
  sheetBarFieldSize,
  sheetBarPencilSize,
  sheetFadeHeight,
  sheetFadeLocations,
  type SaveState,
} from '@/components/shell/sheetBarLogic';

// The top of every tall sheet (Giorgio, 2026-11-12: "i like the idea of having the top left being a back or close button and the
// top right being the save button. it is greyed out until you make a change and then you click save when it populates", then
// "B and no, hitting back or x just closes it"; PRODUCT_RULES, the top-bar amendment under "A sheet's top must not be a stuck
// block that cuts text"). One bar for the four page-sheet routes (League settings, Forgot password, a manager's team, Trade
// history): solid in the surface colour from the sheet's top edge, × at the left, the title centred in bold on one line, "Save"
// at the right only on a sheet that can save. Rows scroll under it; once scrolled a 1pt divider and a short fade in the bar's own
// colour show, so a row going under dissolves into the bar and no sliver of cut letters is left. Closing never asks: × just
// closes, and so does a swipe down or the VoiceOver escape; unsaved changes are dropped.

export interface SheetSave {
  state: SaveState;
  onPress: () => void;
}

/** The league's name as an in-bar field (League settings, the commissioner, before the draft). */
export interface SheetRename {
  editing: boolean;
  onBegin: () => void;
  onEnd: () => void;
  onChangeText: (text: string) => void;
}

export interface SheetBarConfig {
  title: string;
  onClose: () => void;
  /** The ×'s VoiceOver label. Default "Close"; Forgot password keeps "Back to sign in". */
  closeLabel?: string;
  closeTestID?: string;
  /** Only on a sheet that can save. */
  save?: SheetSave;
  /** Only where the title is renamable: the pencil, the tap, the field. Otherwise the title is a plain header. */
  rename?: SheetRename;
}

export interface SheetBarProps extends SheetBarConfig {
  /** True once the content has scrolled under the bar (useSheetScrollEdge): the divider and the fade show. */
  edge: boolean;
}

export function SheetBar({ title, onClose, closeLabel = 'Close', closeTestID, save, rename, edge }: SheetBarProps) {
  const { colors } = useTheme();
  // None inside an iOS page sheet, which already starts below the status bar (components/shell/ScreenPresentation.tsx).
  const topInset = useScreenTopInset();
  const clear = clearOf(colors.surface);
  // The solid part of the fade covers one row line at the current text size (sheetBarLogic.ts), so no row straddling the divider shows half a line.
  const { fontScale } = useWindowDimensions();

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface, paddingTop: topInset }]}
      // The VoiceOver escape closes at once, like the ×.
      onAccessibilityEscape={onClose}
      testID="sheet-bar"
    >
      <View style={styles.row}>
        <View style={styles.sideLeft}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} style={styles.close} testID={closeTestID ?? 'sheet-bar-close'}>
            {/* The × never grows with the text size ('tab' is the icon role that never scales). */}
            <Icon name="close" size="tab" tone="text2" />
          </Pressable>
        </View>
        <View style={styles.center}>
          <BarTitle title={title} rename={rename} />
        </View>
        <View style={styles.sideRight}>{save ? <SaveButton save={save} /> : null}</View>
      </View>
      {edge ? (
        <>
          {/* The fade is the bar's surface into the surface at alpha 0, never the `transparent` keyword (black at 0: a grey fade). */}
          <LinearGradient
            colors={[colors.surface, colors.surface, clear]}
            locations={sheetFadeLocations(fontScale)}
            style={[styles.fade, { bottom: -sheetFadeHeight(fontScale), height: sheetFadeHeight(fontScale) }]}
            pointerEvents="none"
            testID="sheet-bar-fade"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} pointerEvents="none" testID="sheet-bar-divider" />
        </>
      ) : null}
    </View>
  );
}

function BarTitle({ title, rename }: { title: string; rename?: SheetRename }) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  if (rename?.editing) {
    return (
      <View style={styles.titleField}>
        <RenameInput value={title} rename={rename} />
        <View style={[styles.underline, { backgroundColor: colors.accent }]} />
      </View>
    );
  }
  if (rename) {
    return (
      <Pressable
        onPress={rename.onBegin}
        accessibilityRole="button"
        accessibilityLabel="League name"
        accessibilityValue={{ text: title }}
        style={styles.titleRow}
        testID="sheet-bar-title"
      >
        <Text variant="headline" numberOfLines={1} maxFontSizeMultiplier={SHEET_BAR_MAX_SCALE} style={styles.title}>{title}</Text>
        {/* Decorative, and it stays visible after a "…" (the title shrinks, the pencil does not). */}
        <View style={styles.pencil}><Icon name="edit" size="callout" pt={sheetBarPencilSize(fontScale)} tone="text2" /></View>
      </Pressable>
    );
  }
  return (
    <Text variant="headline" numberOfLines={1} maxFontSizeMultiplier={SHEET_BAR_MAX_SCALE} accessibilityRole="header" style={styles.title} testID="sheet-bar-title">
      {title}
    </Text>
  );
}

/** The title as a text field, at the title's size. It takes the app's TextInput hook (keyed by the text size while unfocused) and draws
 * an explicit size capped at the bar's 1.3x. Return ends editing, and so does losing focus. */
function RenameInput({ value, rename }: { value: string; rename: SheetRename }) {
  const { colors } = useTheme();
  const remount = useInputRemountKey(true);
  const font = remount.fontProps(SHEET_BAR_TITLE_SIZE);
  return (
    <TextInput
      key={remount.key}
      value={value}
      onChangeText={rename.onChangeText}
      autoFocus={remount.autoFocus}
      autoCorrect={false}
      returnKeyType="done"
      onSubmitEditing={rename.onEnd}
      onFocus={() => remount.onFocus()}
      onBlur={() => {
        remount.onBlur();
        rename.onEnd();
      }}
      accessibilityLabel="League name"
      selectionColor={colors.accent}
      allowFontScaling={false}
      style={[styles.input, { color: colors.text, fontSize: sheetBarFieldSize(font?.fontSize) }]}
      testID="sheet-bar-title-input"
    />
  );
}

function SaveButton({ save }: { save: SheetSave }) {
  const { colors } = useTheme();
  const inert = saveInert(save.state);
  const saving = save.state === 'saving';
  return (
    <Pressable
      onPress={inert ? undefined : save.onPress}
      accessibilityRole="button"
      accessibilityLabel="Save"
      // Grey: VoiceOver reads "Save, dimmed".
      accessibilityState={{ disabled: inert, busy: saving }}
      style={styles.save}
      testID="sheet-bar-save"
    >
      {/* The word stays laid out while saving (hidden), so progress takes its place and the bar never shifts. */}
      <Text
        variant="headline"
        numberOfLines={1}
        maxFontSizeMultiplier={SHEET_BAR_MAX_SCALE}
        color={inert ? colors.text3 : colors.accent}
        style={[styles.saveWord, saving ? styles.hidden : null]}
      >
        Save
      </Text>
      {saving ? <ActivityIndicator color={colors.text2} style={styles.spinner} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Above the scroll view that follows it, so the fade can hang over the content's top edge.
  bar: {
    zIndex: 2,
  },
  row: {
    minHeight: SHEET_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideLeft: {
    width: SHEET_BAR_SIDE,
    // The × ink sits SHEET_BAR_GUTTER from the edge: the gutter less the glyph's insets inside its 44 pt target (sheetBarLogic.ts).
    paddingLeft: SHEET_BAR_CLOSE_PAD,
    alignItems: 'flex-start',
  },
  sideRight: {
    width: SHEET_BAR_SIDE,
    // Save's last letter sits the same gutter from the right edge; its 44 pt target pads inward (see `save`).
    paddingRight: SHEET_BAR_SAVE_PAD,
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: SHEET_BAR_TARGET,
    height: SHEET_BAR_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  titleRow: {
    minHeight: SHEET_BAR_TARGET,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  pencil: {
    flexShrink: 0,
  },
  // The field takes the title's place at the same size; the accent underline marks it.
  titleField: {
    alignSelf: 'stretch',
    minHeight: SHEET_BAR_TARGET,
    justifyContent: 'center',
  },
  input: {
    fontFamily: typeFontFamily.bold,
    textAlign: 'center',
    paddingVertical: space[2],
    paddingHorizontal: 0,
  },
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space[2],
    height: 2,
  },
  save: {
    minWidth: SHEET_BAR_TARGET,
    minHeight: SHEET_BAR_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: space[3],
  },
  saveWord: {
    fontWeight: '700',
  },
  hidden: {
    opacity: 0,
  },
  spinner: {
    ...StyleSheet.absoluteFillObject,
  },
  // Hangs below the bar over the content; its height is the text-size formula (set inline from sheetFadeHeight).
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_EDGE_DIVIDER,
  },
});
