/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles`/`cardShadow` are declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTheme } from '@/components/sp/ThemeProvider';
import { fontScaleKey } from '@/components/sp/logic/remeasureKey';
import { cappedTextProps } from '@/components/sp/logic/cappedType';
import { QUEUE_ROW_TEXT_MAX_SCALE } from '@/lib/game/queueRow';
import { useInputRemountKey } from '@/components/sp/useInputRemountKey';
import { useSymbolSearch, type UseSymbolSearchOptions } from '@/lib/useSymbolSearch';
import type { ShapedSearchResult } from '@/lib/symbolSearch';
import { useCaptureAction } from '@/lib/money/captureScript';
import { useScrollReveal } from '@/components/shell/scrollReveal';
import { acceptsChange, listJustOpened, nextPhase, type FieldPhase } from '@/components/sp/logic/searchField';

interface SymbolSearchFieldProps extends UseSymbolSearchOptions {
  /** Controlled input text (typically uppercase — matches both call sites'
   * existing autoCapitalize="characters" convention). */
  value: string;
  onChangeText: (text: string) => void;
  /** Fired only for a SELECTABLE result. Unselectable rows (already owned, or
   * not draftable) are shown dimmed with a badge, not hidden — the user
   * should see why a stock can't be picked, matching the app's "show, don't
   * hide" convention for ineligible state — but tapping one does nothing. */
  onSelect: (result: ShapedSearchResult) => void;
  /** The currently-confirmed symbol, if any — suppresses re-searching when
   * the input still matches it (TradeModal's original guard). */
  selectedSymbol?: string;
  placeholder?: string;
  /** OR'd into the field's own search-loading spinner — for a caller's own
   * follow-up fetch (e.g. TradeModal's post-select quote fetch). */
  extraLoading?: boolean;
  /** DEV capture script only: the action name that types into THIS field (a screen can hold
   * two fields, the room's and the queue's). Unset: no action. */
  captureAction?: string;
  /** The queue's search: a pick returns the box to EMPTY (the placeholder), as it is a list to add to. Unset: the caller
   * keeps the text it set (the draft room shows the picked symbol). */
  clearOnSelect?: boolean;
}

export default function SymbolSearchField({
  value,
  onChangeText,
  onSelect,
  selectedSymbol = '',
  placeholder = 'Search by ticker or name...',
  extraLoading = false,
  ownedSymbols,
  allowUndraftable,
  ownedBadgeLabel,
  debounceMs,
  limit,
  captureAction = '',
  clearOnSelect = false,
}: SymbolSearchFieldProps) {
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  // searchField.ts: after a pick the field takes no input until the next focus, so a late change event from the native box
  // (the blur Keyboard.dismiss() causes) cannot write the typed text back into a field that was just emptied.
  const phase = useRef<FieldPhase>('idle');
  const reveal = useScrollReveal();
  const { results, loading, error, retry } = useSymbolSearch(value, selectedSymbol, {
    ownedSymbols,
    allowUndraftable,
    ownedBadgeLabel,
    debounceMs,
    limit,
  });

  const typeInto = (text: string) => {
    onChangeText(text.toUpperCase());
    setShowResults(true);
  };
  const handleChangeText = (text: string) => {
    if (!acceptsChange(phase.current)) return;
    typeInto(text);
  };
  // DEV capture script only (a no-op without the seam and a script): types as a finger would (never focused, so not guarded).
  useCaptureAction(captureAction, (q) => typeInto(q ?? ''));

  // G-10 (pass-2b gate, §9A): every colour from the theme, so Dark is dark here too.
  // gn-sweep (§9C rule 2): no rule line between results — rows divide by their own 12pt
  // padding; the dropdown's edge is the card rim (elevation.card).
  const { colors, elevation } = useTheme();

  const handleSelect = (result: ShapedSearchResult) => {
    if (!result.selectable) return;
    phase.current = nextPhase(phase.current, 'pick');
    setShowResults(false);
    // The native box is its own buffer: empty it here too, not only through the controlled value.
    if (clearOnSelect) inputRef.current?.clear();
    Keyboard.dismiss();
    onSelect(result);
  };

  const visible = showResults && value.length >= 1 && value.toUpperCase() !== selectedSymbol.toUpperCase();
  // The popovers' Texts remount on a Dynamic Type change, or they keep the old scale's box
  // (remeasureKey.ts). Keyed per popover. The TextInput is keyed only while unfocused, so a
  // remount never drops the keyboard (useInputRemountKey).
  const { fontScale } = useWindowDimensions();
  const remountKey = fontScaleKey(fontScale);
  const inputRemount = useInputRemountKey(undefined);
  // The scale goes in the props too: a remounted field can reuse a recycled native view that keeps its
  // old placeholder size otherwise (remeasureKey.ts, "The PLACEHOLDER").
  const inputFont = inputRemount.fontProps(INPUT_FONT_SIZE);
  // The field and its whole results list stay above the keyboard (searchField.ts): scroll the field up under the top edge when
  // it takes focus, when the keyboard has finished opening, and when its results open (the page just grew).
  const listOpen = visible && results.length > 0;
  const wasOpen = useRef(false);
  const scrollFieldUp = () => reveal?.(containerRef.current);
  useEffect(() => {
    const opened = listJustOpened(wasOpen.current, listOpen);
    wasOpen.current = listOpen;
    if (!opened) return;
    const t = setTimeout(scrollFieldUp, 60);
    return () => clearTimeout(t);
    // scrollFieldUp closes over the stable reveal + ref; only the list opening should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOpen]);
  useEffect(() => {
    if (!inputRemount.focused) return;
    const sub = Keyboard.addListener('keyboardDidShow', scrollFieldUp);
    const t = setTimeout(scrollFieldUp, 60);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputRemount.focused]);
  // A result's ticker is never cut or split (Giorgio 2026-11-05, build 9's recording: "TE" over "M" at the largest size):
  // the row's text stops growing at 1.3×, as the queue row's does, and the ticker can't shrink (styles.resultSymbol).
  const rowText = (fontSize: number, lineHeight: number) => {
    const c = cappedTextProps({ fontSize, lineHeight }, fontScale, QUEUE_ROW_TEXT_MAX_SCALE);
    return { props: { allowFontScaling: c.allowFontScaling, maxFontSizeMultiplier: c.maxFontSizeMultiplier }, size: c.style };
  };
  const tickerText = rowText(16, 20);
  const badgeText = rowText(11, 14);
  const nameText = rowText(12, 16);
  const priceText = rowText(14, 18);

  return (
    <View ref={containerRef} style={styles.container}>
      <TextInput
        ref={inputRef}
        key={inputRemount.key}
        autoFocus={inputRemount.autoFocus}
        style={[styles.textInput, { backgroundColor: colors.inset, color: colors.text, borderColor: colors.border }, inputFont && { fontSize: inputFont.fontSize }]}
        allowFontScaling={inputFont ? inputFont.allowFontScaling : undefined}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text2}
        autoCapitalize="characters"
        autoCorrect={false}
        onFocus={() => {
          phase.current = nextPhase(phase.current, 'focus');
          inputRemount.onFocus();
          if (value && value.toUpperCase() !== selectedSymbol.toUpperCase()) setShowResults(true);
        }}
        onBlur={() => {
          phase.current = nextPhase(phase.current, 'blur');
          inputRemount.onBlur();
        }}
      />
      {(loading || extraLoading) && value.length > 0 && (
        <ActivityIndicator size="small" color={colors.accent} style={styles.spinner} />
      )}

      {visible && results.length > 0 && (
        <View key={`results-${remountKey}`} style={[styles.resultsContainer, { backgroundColor: colors.surface }, elevation.card]}>
          <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled" nestedScrollEnabled scrollsToTop={false}>
            {results.map((item) => (
              <TouchableOpacity
                key={item.symbol}
                style={[styles.resultItem, !item.selectable && styles.resultItemDisabled]}
                onPress={() => handleSelect(item)}
                disabled={!item.selectable}
              >
                <View style={styles.resultLeft}>
                  <View style={styles.resultSymbolRow}>
                    <Text
                      numberOfLines={1}
                      {...tickerText.props}
                      style={[styles.resultSymbol, { color: colors.text }, tickerText.size]}
                    >
                      {item.symbol}
                    </Text>
                    {item.badgeLabel && (
                      <Text
                        {...badgeText.props}
                        style={[styles.badge, { color: colors.warnText, borderColor: colors.warnText }, badgeText.size]}
                      >
                        {item.badgeLabel}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[styles.resultName, { color: colors.text2 }, nameText.size]}
                    {...nameText.props}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </View>
                {item.price ? (
                  <Text
                    numberOfLines={1}
                    {...priceText.props}
                    style={[styles.resultPrice, { color: colors.text2 }, priceText.size]}
                  >
                    ${item.price.toFixed(2)}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {visible && !loading && !error && results.length === 0 && (
        <View key={`none-${remountKey}`} style={[styles.noResultsContainer, { backgroundColor: colors.surface }, elevation.card]}>
          <Text style={[styles.noResultsText, { color: colors.text2 }]}>No matching stocks found</Text>
        </View>
      )}

      {/* E-1 (3e UX audit): a failed search must never read as "no matches". */}
      {visible && !loading && error && (
        <View key={`error-${remountKey}`} style={[styles.noResultsContainer, { backgroundColor: colors.surface }, elevation.card]}>
          <Text style={[styles.noResultsText, { color: colors.text2 }]}>Stocks didn't load. Check your connection, then try again.</Text>
          <TouchableOpacity onPress={retry} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: colors.accent }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const INPUT_FONT_SIZE = 18;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  textInput: {
    borderRadius: 8,
    padding: 14,
    fontSize: INPUT_FONT_SIZE,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
  },
  spinner: {
    position: 'absolute',
    right: 14,
    top: 12,
  },
  // In the page's flow, not floating over it: the page has to GROW by the list, or it cannot scroll far enough to lift the
  // list above the keyboard (the absolute list added no height; queue-search-keyboard).
  resultsContainer: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 250,
  },
  resultsList: {
    maxHeight: 250,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  resultItemDisabled: {
    opacity: 0.5,
  },
  resultLeft: {
    flex: 1,
    // Lets the company name (never the ticker) give way to the price beside it.
    minWidth: 0,
    marginRight: 12,
  },
  // A line that wraps: a badge ("NOT DRAFTABLE") drops under the ticker instead of squeezing it.
  resultSymbolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    rowGap: 2,
  },
  resultSymbol: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    // The ticker never shrinks, so it is never cut or split across lines.
    flexShrink: 0,
  },
  badge: {
    // §9B: the 11pt floor.
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  resultName: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  resultPrice: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  noResultsContainer: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 16,
  },
  noResultsText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
