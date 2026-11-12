/* eslint-disable @typescript-eslint/no-use-before-define -- RN styles-at-bottom idiom: `styles`/`cardShadow` are declared below and only referenced inside the render, which runs after module init, so there is no TDZ. See CLAUDE.md ("ESLint (mobile)"). */
// Create league (3c-2): the board's four steps — League, Season, Draft,
// Stakes ("Create league · Season" / "· Draft step"; League and Stakes have
// no frame and are composed from the same vocabulary). The step machine and
// its gates live in lib/game/createLeagueSteps.ts; handleCreate and every
// write below are unchanged from the nine-step screen this replaces.
import { Alert, Share, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/lib/useAuth';
import { useLeagueContext } from '@/lib/LeagueContext';
import { validateLeagueName } from '@/lib/contentModeration';
import { generateInviteCode } from '@/lib/inviteCode';
import SlotBuilder from '@/components/SlotBuilder';
import {
  type Category,
  type SlotDraft,
  type StakeMode,
  DEFAULT_BUDGET_CAP,
  DEFAULT_NOTIONAL_PER_SLOT,
  STAKE_MODE_OPTIONS,
  fetchCategories,
  validateSlotConfig,
} from '@/lib/categoryData';
import { seamInsertLeague, seamInsertMember, seamSaveLeagueSlots } from '@/lib/game/seamCalls';
import {
  DRAFT_ORDER_OPTIONS,
  type DraftOrderMode,
  DEFAULT_PICK_SECONDS,
  PICK_SECONDS_OPTIONS,
} from '@/lib/game/createLeagueSetup';
import {
  BUDGET_PRESETS,
  CREATE_ROUNDS_BOUNDS,
  CREATE_STEPS,
  CREATE_STEP_COPY,
  MANAGER_SIZES,
  type CreateStep,
  createNextDisabled,
  leagueNameError,
  nextStep,
  prevStep,
  stakesStepError,
  stepManagers,
  stepNumber,
  stepWeeks,
  stepWithin,
  weeksShown,
} from '@/lib/game/createLeagueSteps';
import { PRICE_TIERS_NEED_A_SLOT } from '@/lib/game/slotBuilderCopy';
import { draftDateTimeLabel } from '@/lib/home/draftCountdown';
import { draftDateForSave } from '@/lib/game/draftDateSave';
import { draftTimeRefusal } from '@/lib/game/autoStart';
import { stakesLine } from '@/lib/stakesLine';
import { INVITE_CODE_LABEL } from '@/lib/home/homeCopy';
import {
  CREATED_NO_DATE,
  CREATE_FAILED,
  GO_TO_LEAGUE,
  SLOTS_NOT_SAVED,
  createdTitle,
  createdWithoutDate,
  inviteShareMessage,
} from '@/lib/game/createLeagueDone';
import { space, typeFontFamily } from '@/constants/tokens';
import { Button } from '@/components/sp/Button';
import { Chip } from '@/components/sp/Chip';
import { SegmentedControl } from '@/components/sp/SegmentedControl';
import { Text } from '@/components/sp/Text';
import { useTheme } from '@/components/sp/ThemeProvider';
import { Field } from '@/components/shell/Field';
import { SetupScaffold } from '@/components/game/SetupScaffold';
import { Stepper } from '@/components/game/Stepper';
import { SeasonStrip } from '@/components/game/SeasonStrip';
import { WEEKS_UNIT_SHOWN, WEEKS_UNIT_SPOKEN, seasonByeLine, seasonLimitReasons } from '@/lib/game/seasonStep';
import { DraftDateSheet } from '@/components/game/DraftDateSheet';
import { CAPTURE } from '@/lib/shell/captureDev';
import { createFixtureStep } from '@/lib/shell/captureKnobs';
import { keepDots, keepHyphens, keepMoney } from '@/lib/game/keepDots';
import { pushAskRouteFor } from '@/lib/shell/pushAsk';
import { ChoiceRow, LabelWithInfo, RowDivider, RowKey, RowWrap, SettingRow, SetupCard, SwitchRow } from '@/components/game/SetupRows';
import { InfoButton, useInfoPopup } from '@/components/game/InfoPopup';
import { CONTROL_INFO, infoForLeagueType, infoForStakeMode } from '@/lib/game/infoPopups';
import { InviteCodeText } from '@/components/game/InviteCodeText';
import { codeLabelMaxScale } from '@/lib/game/codeLabel';

interface WizardState {
  name: string;
  // Matchup only: Duration is hidden until it is built (PRODUCT_RULES, "Duration is hidden
  // in Create league until it is built", 2026-11-11), and the server refuses one
  // (20261203000000_refuse_new_duration_leagues). Its copy stays in createLeagueSteps.ts.
  type: 'matchup';
  size: number;
  stakeMode: StakeMode;
  notionalPerSlot: string;
  budgetCap: string;
  allowUndraftable: boolean;
  slots: SlotDraft[];
  numWeeks: number;
  playoffTeams: number;
  numRounds: number;
  draftDate: Date | null;
  draftDateTBD: boolean;
  draftOrder: DraftOrderMode;
  pickSeconds: number;
}

// The League type card stays, with Matchup as its one option, already selected (PRODUCT_RULES,
// "The League type card stays, with Matchup alone", 2026-11-11). When Duration comes back it
// rejoins this card; its row is DURATION_TYPE_OPTION, unused until then. No line under the name: what Matchup means is
// behind its "i" (UX rule 13), as every option's definition is.
const TYPE_OPTIONS: { value: WizardState['type']; label: string }[] = [
  { value: 'matchup', label: 'Matchup' },
];

export default function CreateLeagueWizard() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { refresh, setActiveLeagueId } = useLeagueContext();
  // The "i" popups (UX rule 13): one popup for the screen, opened by any option's "i".
  const { open: openInfo, popup: infoPopup } = useInfoPopup();

  // DEV captures only (lib/shell/captureKnobs.ts): open on a step, or on the done screen.
  const [step, setStep] = useState<CreateStep>(createFixtureStep(CAPTURE.create));
  const [creating, setCreating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // The done screen (Design Lead ruling), in place of the old "League Created!" Alert.
  const [created, setCreated] = useState<{ name: string; inviteCode: string; noDate: boolean } | null>(
    CAPTURE.create === 'done' || CAPTURE.create === 'done_no_date'
      ? { name: 'Serie A Traders', inviteCode: 'SERIEA7', noDate: CAPTURE.create === 'done_no_date' }
      : null,
  );
  // Inline, under the Draft date row: a chosen date with no value (draftDateForSave).
  const [dateError, setDateError] = useState<string | null>(null);
  // Inline, under the name field (Design Lead ruling), never an Alert.
  const [nameError, setNameError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => { fetchCategories().then(setCategories); }, []);

  const [state, setState] = useState<WizardState>({
    name: CAPTURE.create ? 'Serie A Traders' : '',
    type: 'matchup',
    // DEV captures only: EXPO_PUBLIC_CREATE_SEASON seeds the Season values once (lib/shell/captureKnobs.ts).
    size: CAPTURE.createSeason?.size ?? 8,
    stakeMode: CAPTURE.create === 'tiers' ? 'price_tiers' : 'fixed_notional',
    notionalPerSlot: String(DEFAULT_NOTIONAL_PER_SLOT),
    budgetCap: String(DEFAULT_BUDGET_CAP),
    allowUndraftable: false,
    slots: [],
    numWeeks: CAPTURE.createSeason?.weeks ?? 11,
    playoffTeams: CAPTURE.createSeason?.playoffTeams ?? 4,
    numRounds: 6,
    draftDate: null,
    draftDateTBD: true, // Default to TBD
    draftOrder: 'random',
    pickSeconds: DEFAULT_PICK_SECONDS,
  });
  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }));

  const minWeeks = state.size - 1;
  // Flexible playoffs (Giorgio, 2026-09-29): any P from 2 up to the league
  // size, equal included. Clamped like numWeeks, so shrinking the league never
  // leaves a stale P above it.
  const playoffTeams = Math.min(Math.max(state.playoffTeams, 2), state.size);
  // The weeks the insert writes (max(numWeeks, minWeeks), below), shown as such.
  const shownWeeks = weeksShown(state.numWeeks, state.size);

  const goBack = () => {
    const prev = prevStep(step);
    if (prev) setStep(prev);
    else router.dismiss();
  };

  const handleCreate = async () => {
    if (!user?.id) {
      // Unreachable behind the auth gate; logged, never shown (Design Lead ruling).
      console.error('Create league: no signed-in user');
      return;
    }

    // Never send draft_date: undefined (a live 1.1.0 bug): Set later is null, a
    // chosen date must have a value.
    const draftDateValue = draftDateForSave(state.draftDateTBD, state.draftDate);
    if (!draftDateValue.ok) {
      setDateError(draftDateValue.error);
      setStep('draft');
      return;
    }

    setCreating(true);
    try {
      const effectiveWeeks = Math.max(state.numWeeks, minWeeks);

      // stake_mode is authoritative. budget_mode is deprecated and no longer
      // written (DB default applies); salary_cap_limit is retired — drop
      // migration authored on this branch. budget_amount only means anything
      // in budget_cap mode.
      const { data: league, error: leagueError } = await seamInsertLeague({
          name: state.name.trim(),
          commissioner_id: user.id,
          invite_code: generateInviteCode(),
          num_participants: state.size,
          num_rounds: state.numRounds,
          stake_mode: state.stakeMode,
          notional_per_slot: parseInt(state.notionalPerSlot) || DEFAULT_NOTIONAL_PER_SLOT,
          allow_undraftable: state.allowUndraftable,
          ...(state.stakeMode === 'budget_cap'
            ? { budget_amount: parseInt(state.budgetCap) || DEFAULT_BUDGET_CAP }
            : {}),
          // Always 'matchup' (the server refuses 'duration', and an omitted type, since the
          // column defaults to 'duration'). duration_days is NOT NULL with a CHECK, so it
          // carries the column's default value, which a Matchup league never reads.
          league_type: 'matchup',
          duration_days: 30,
          num_weeks: effectiveWeeks,
          playoff_teams: playoffTeams,
          draft_status: 'not_started',
          draft_order_mode: state.draftOrder,
          pick_seconds: state.pickSeconds,
          draft_date: draftDateValue.value,
      });

      if (leagueError) throw leagueError;

      const { error: memberError } = await seamInsertMember({
        league_id: league.id,
        user_id: user.id,
        role: 'commissioner',
      });

      if (memberError) throw memberError;

      if (state.slots.length > 0) {
        try {
          await seamSaveLeagueSlots(league.id, state.slots);
        } catch (slotErr) {
          console.error('Slot save failed:', slotErr);
          Alert.alert(SLOTS_NOT_SAVED.title, SLOTS_NOT_SAVED.message);
        }
      }

      await refresh();
      setActiveLeagueId(league.id);

      setCreated({
        name: state.name,
        inviteCode: league.invite_code,
        noDate: createdWithoutDate(state.draftDateTBD, state.draftDate),
      });
    } catch (error: any) {
      // The raw message is logged, never shown (Design Lead ruling).
      console.error('Failed to create league:', error);
      // A draft-time refusal (trg_leagues_draft_time: not a quarter hour, under
      // an hour out) goes back to the Draft step, inline under the date.
      const refusal = draftTimeRefusal(error);
      if (refusal) {
        setDateError(refusal);
        setStep('draft');
        return;
      }
      Alert.alert(CREATE_FAILED.title, CREATE_FAILED.message);
    } finally {
      setCreating(false);
    }
  };

  const slotErrors = validateSlotConfig(state.slots, state.numRounds);

  const goNext = () => {
    if (step === 'league') {
      const error = leagueNameError(state.name, validateLeagueName);
      setNameError(error);
      if (error) return;
    }
    if (step === 'draft') {
      const date = draftDateForSave(state.draftDateTBD, state.draftDate);
      setDateError(date.ok ? null : date.error);
      if (!date.ok) return;
    }
    if (step === 'stakes') {
      // Price tiers NEED slot price ranges (they are the anti-skew mechanism);
      // other modes go straight on — category slots stay optional via
      // league settings. The reasons show inline (Roster slots, the slots).
      if (stakesStepError(state.stakeMode, state.slots.length, slotErrors)) return;
      handleCreate();
      return;
    }
    const next = nextStep(step);
    if (next) setStep(next);
  };

  const draftDateValue = state.draftDateTBD
    ? 'TBD'
    : draftDateTimeLabel(state.draftDate?.toISOString() ?? null) ?? 'Pick a draft time';

  // ── Step 1 · League ───────────────────────────────────────────────────
  const renderLeague = () => (
    <>
      <Field
        label="League name"
        value={state.name}
        onChangeText={(text) => {
          patch({ name: text });
          if (nameError) setNameError(null);
        }}
        error={nameError}
        placeholder="Give your league a name"
        autoCapitalize="words"
        autoFocus
        returnKeyType="next"
        onSubmitEditing={goNext}
      />
      <View style={styles.section}>
        <RowKey>League type</RowKey>
        <SetupCard>
          {TYPE_OPTIONS.map((t, i) => {
            const info = infoForLeagueType(t.value);
            return (
              <View key={t.value}>
                {i > 0 ? <RowDivider /> : null}
                <ChoiceRow
                  title={t.label}
                  selected={state.type === t.value}
                  onPress={() => patch({ type: t.value })}
                  info={info ? <InfoButton info={info} onOpen={openInfo} edge /> : undefined}
                />
              </View>
            );
          })}
        </SetupCard>
      </View>
    </>
  );

  // ── Step 2 · Season (PRODUCT_RULES, "The Season step in Create league", B) ─
  // Three identical steppers, no line under any label; a limit's reason shows under its stepper only
  // while it is at that end (seasonLimitReasons). Then the season strip, and one line outside the
  // card: the playoff line's bye clause. Managers has no reason at 4 or 16 (its words are Giorgio's).
  const renderSeason = () => {
    const reasons = seasonLimitReasons(state.size, shownWeeks, playoffTeams);
    const byeLine = seasonByeLine(playoffTeams);
    return (
      <>
        <SetupCard>
          <View style={styles.block}>
            <Stepper
              label="Managers"
              value={state.size}
              uniformBox
              onStep={(d) => patch({ size: stepManagers(state.size, d) })}
              canDecrement={state.size > MANAGER_SIZES[0]}
              canIncrement={state.size < MANAGER_SIZES[MANAGER_SIZES.length - 1]}
            />
          </View>
          <RowDivider />
          <View style={styles.block}>
            <Stepper
              label="Regular season"
              value={shownWeeks}
              unit={WEEKS_UNIT_SHOWN}
              unitSpoken={WEEKS_UNIT_SPOKEN}
              uniformBox
              onStep={(d) => patch({ numWeeks: stepWeeks(state.numWeeks, state.size, d) })}
              canDecrement={shownWeeks > minWeeks}
              canIncrement
            />
            {reasons.weeks ? <Text variant="caption">{reasons.weeks}</Text> : null}
          </View>
          <RowDivider />
          <View style={styles.block}>
            <Stepper
              label="Playoff teams"
              labelInfo={<InfoButton info={CONTROL_INFO.playoffTeams} onOpen={openInfo} />}
              value={playoffTeams}
              uniformBox
              onStep={(d) => patch({ playoffTeams: stepWithin(playoffTeams, d, 2, state.size) })}
              canDecrement={playoffTeams > 2}
              canIncrement={playoffTeams < state.size}
            />
            {reasons.playoffTeams ? <Text variant="caption">{reasons.playoffTeams}</Text> : null}
          </View>
          <RowDivider />
          <View style={styles.block}>
            <SeasonStrip regularWeeks={shownWeeks} playoffTeams={playoffTeams} />
          </View>
        </SetupCard>
        {byeLine ? (
          <Text variant="callout" tone="secondary" style={styles.byeLine}>
            {keepHyphens(byeLine)}
          </Text>
        ) : null}
      </>
    );
  };

  // ── Step 3 · Draft (board: DraftSettingsScreen) ───────────────────────
  const renderDraft = () => (
    <>
      <SetupCard style={styles.cardStack}>
        <View style={styles.spread}>
          <Text variant="headline">Pick clock</Text>
          <Text variant="callout" style={[styles.bold, styles.tabular]} subOf="headline">{`${state.pickSeconds} seconds`}</Text>
        </View>
        <SegmentedControl
          options={PICK_SECONDS_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
          value={String(state.pickSeconds)}
          onChange={(v) => patch({ pickSeconds: Number(v) })}
        />
      </SetupCard>

      <SetupCard>
        <SettingRow
          label="Draft time"
          value={keepDots(draftDateValue)}
          valueColor={state.draftDateTBD ? colors.warnText : undefined}
          onPress={() => {
            // Opening writes nothing: the sheet holds the time until "Set draft time" (ruling B).
            setDateError(null);
            setShowDatePicker(true);
          }}
        />
        <RowDivider />
        <View style={styles.block}>
          <LabelWithInfo label="Draft order" info={<InfoButton info={CONTROL_INFO.draftOrder} onOpen={openInfo} />} />
          <SegmentedControl
            options={DRAFT_ORDER_OPTIONS}
            value={state.draftOrder}
            onChange={(v) => patch({ draftOrder: v as DraftOrderMode })}
          />
        </View>
        <RowDivider />
        <View style={styles.block}>
          <Stepper
            label="Rounds"
            value={state.numRounds}
            onStep={(d) => patch({ numRounds: stepWithin(state.numRounds, d, CREATE_ROUNDS_BOUNDS.min, CREATE_ROUNDS_BOUNDS.max) })}
            canDecrement={state.numRounds > CREATE_ROUNDS_BOUNDS.min}
            canIncrement={state.numRounds < CREATE_ROUNDS_BOUNDS.max}
          />
        </View>
      </SetupCard>

      {dateError ? (
        <Text variant="callout" color={colors.danger} accessibilityLiveRegion="polite">
          {dateError}
        </Text>
      ) : null}
      <DraftDateSheet
        visible={showDatePicker}
        initial={state.draftDate}
        onConfirm={(d) => patch({ draftDate: d, draftDateTBD: false })}
        onSetLater={() => {
          patch({ draftDateTBD: true, draftDate: null });
          setDateError(null);
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </>
  );

  // ── Step 4 · Stakes (no frame: composed) ──────────────────────────────
  const renderStakes = () => (
    <>
      <SetupCard>
        {STAKE_MODE_OPTIONS.map((opt, i) => {
          const info = infoForStakeMode(opt.value);
          return (
            <View key={opt.value}>
              {i > 0 ? <RowDivider /> : null}
              <ChoiceRow
                title={opt.label}
                selected={state.stakeMode === opt.value}
                onPress={() => patch({ stakeMode: opt.value })}
                info={info ? <InfoButton info={info} onOpen={openInfo} edge /> : undefined}
              />
            </View>
          );
        })}
      </SetupCard>

      {state.stakeMode === 'fixed_notional' ? (
        <Field
          label="Stake per slot ($)"
          value={state.notionalPerSlot}
          onChangeText={(text) => patch({ notionalPerSlot: text.replace(/[^0-9]/g, '') })}
          keyboardType="numeric"
          placeholder={String(DEFAULT_NOTIONAL_PER_SLOT)}
        />
      ) : null}

      {state.stakeMode === 'budget_cap' ? (
        <View style={styles.section}>
          <Field
            label="Budget cap ($)"
            value={state.budgetCap}
            onChangeText={(text) => patch({ budgetCap: text.replace(/[^0-9]/g, '') })}
            keyboardType="numeric"
            placeholder={String(DEFAULT_BUDGET_CAP)}
          />
          <RowWrap>
            {BUDGET_PRESETS.map((amount) => (
              <Chip
                key={amount}
                label={`$${parseInt(amount).toLocaleString()}`}
                selected={state.budgetCap === amount}
                onPress={() => patch({ budgetCap: amount })}
              />
            ))}
          </RowWrap>
        </View>
      ) : null}

      <SetupCard>
        <SwitchRow
          label="Allow non-draftable stocks (full universe)"
          info={<InfoButton info={CONTROL_INFO.nonDraftable} onOpen={openInfo} />}
          value={state.allowUndraftable}
          onValueChange={(value) => patch({ allowUndraftable: value })}
        />
      </SetupCard>

      {state.stakeMode === 'price_tiers' ? (
        <View style={styles.section}>
          <Text variant="headline" accessibilityRole="header">Roster slots</Text>
          {state.slots.length === 0 ? (
            <Text variant="callout" color={colors.danger} subOf="headline" accessibilityLiveRegion="polite">
              {PRICE_TIERS_NEED_A_SLOT}
            </Text>
          ) : null}
          <SlotBuilder
            slots={state.slots}
            onChange={(slots) => patch({ slots })}
            categories={categories}
            leagueSize={state.size}
            numRounds={state.numRounds}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="headline" accessibilityRole="header">League summary</Text>
        <SetupCard>
          <SettingRow label="Name" value={state.name} />
          <RowDivider />
          <SettingRow label="Type" value="Matchup" />
          <RowDivider />
          <SettingRow label="Teams" value={String(state.size)} />
          <RowDivider />
          <SettingRow
            label="Stakes"
            // The shared stakes line (Design Lead: one line across Join and this
            // summary), with the amounts the insert writes.
            value={keepMoney(keepDots(stakesLine(state.stakeMode, {
              notionalPerSlot: parseInt(state.notionalPerSlot) || DEFAULT_NOTIONAL_PER_SLOT,
              budgetAmount: parseInt(state.budgetCap) || DEFAULT_BUDGET_CAP,
            })))}
          />
          <RowDivider />
          <SettingRow
            label="Draft"
            value={keepDots(state.draftDateTBD ? 'TBD' : draftDateTimeLabel(state.draftDate?.toISOString() ?? null) ?? 'TBD')}
            valueColor={state.draftDateTBD ? colors.warnText : undefined}
          />
        </SetupCard>
      </View>
    </>
  );

  const renderStep = () => {
    switch (step) {
      case 'league': return renderLeague();
      case 'season': return renderSeason();
      case 'draft': return renderDraft();
      case 'stakes': return renderStakes();
      default: return null;
    }
  };

  if (created) {
    const share = async () => {
      try {
        await Share.share({ message: inviteShareMessage(created.inviteCode) });
      } catch {
        // A dismissed share sheet is not an error.
      }
    };
    return (
      <SetupScaffold
        title={createdTitle(created.name)}
        footer={<Button label={GO_TO_LEAGUE} onPress={() => void pushAskRouteFor('/(tabs)/league').then((to) => router.replace(to as never))} />}
      >
        {/* The pre-draft Home invite-code card (board). */}
        <SetupCard style={styles.codeCard}>
          <View style={styles.grow}>
            <Text variant="caption" tone="secondary" maxFontSizeMultiplier={codeLabelMaxScale('title')}>{INVITE_CODE_LABEL}</Text>
            <InviteCodeText variant="title" style={styles.code} selectable code={created.inviteCode} />
          </View>
          <Button label="Share" variant="secondary" size="sm" onPress={() => void share()} />
        </SetupCard>
        {created.noDate ? (
          <Text variant="body" tone="secondary">{CREATED_NO_DATE}</Text>
        ) : null}
      </SetupScaffold>
    );
  }

  const last = step === 'stakes';
  const blocked = createNextDisabled(step, stakesStepError(state.stakeMode, state.slots.length, slotErrors));

  return (
    <SetupScaffold
      // G-13: step 1's Cancel closes the modal (text only, as G-7); later steps go Back (chevron).
      back={{ label: step === 'league' ? 'Cancel' : 'Back', onPress: goBack, modal: step === 'league' }}
      step={{ number: stepNumber(step), total: CREATE_STEPS.length }}
      title={CREATE_STEP_COPY[step].title}
      subtitle={CREATE_STEP_COPY[step].subtitle}
      footer={
        <Button
          label={last ? 'Create league' : 'Next'}
          onPress={goNext}
          disabled={blocked}
          status={creating ? 'loading' : 'idle'}
        />
      }
    >
      {renderStep()}
      {infoPopup}
    </SetupScaffold>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space[3],
  },
  cardStack: {
    paddingVertical: space[5],
    gap: space[5],
  },
  // The bye line sits outside the card, in from its edge (board: paddingInline 4).
  byeLine: {
    paddingHorizontal: space[2],
  },
  block: {
    paddingVertical: space[4],
    gap: space[3],
  },
  spread: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space[2],
  },
  bold: {
    fontFamily: typeFontFamily.bold,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  codeCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[5],
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
    gap: space[1],
  },
  code: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
});
