# Focus round trip + opponent label (P3-A, P3-B)

Branch `fix/focus-roundtrip-and-oppname`, from main `d2b7a3bf` (after #327 and #328; not stacked on the keepTime branch, #329).
Device: iPhone 17e, light only. Sizes: `large` (L), `extra-extra-extra-large` (XXXL), `accessibility-extra-extra-extra-large` (AX5).
Frames: `~/fantasy-stock-design-review/fix/focus-roundtrip-and-oppname/` (`index.html`, `frames/`).

## P3-A: remount once at blur if the size changed at any point during focus

**The defect.** A focused field or row keeps its React key (a remount would drop the keyboard) and takes the current scale's key at blur. That
compared two endpoints, the scale at focus and the scale at blur. L -> AX5 -> L inside one focus session ends where it began, so nothing
remounted at blur and the field or row kept the box Fabric had measured at AX5 (frame `g1-3`: Stocks wide, Max pushed off the card, keyboard up).
It is the all-or-nothing shape from CLAUDE.md: a comparison of the ends cannot see what happened in between.

**The fix.** One shared implementation, because `useInputRemountKey` (every TextInput host, `Field` among them) and `useRowRemountKey`
(a row's container) both did the same at-focus vs at-blur comparison.

- `components/sp/logic/focusRoundTrip.ts` (pure): a focus *session* remembers the first render at a scale other than the one the focus began
  at (`changed`). Blur adds one to `bumps` when the session was `changed`; the key carries the count as a suffix (`fs-1:1`), so the blur
  remounts even at the same scale. A session that never saw another scale adds nothing, so an ordinary blur at a fixed size still remounts nothing.
- `components/sp/useFocusRemountKey.ts`: the shared hook (`useReducer`; a render-phase dispatch notes the scale move, guarded by
  `needsScaleNote`, so it cannot loop).
- `useInputRemountKey` and `useRowRemountKey` are now thin users of it. Credential hosts still keep their mount key (latched), `autoFocus`
  still never re-fires after a remount, `fontProps` is unchanged.

**Sibling tap.** Blur(old) and focus(new) reach React in one batch, so the key never changes between them. After a round trip the bump is
already counted at the first blur, the sibling's session freezes the OLD key, and the one remount happens at the LAST blur, when the row is left.
So moving between a row's fields never drops the keyboard (frame `g2-3`: Stocks focused, keyboard up, row still at its frozen layout).

### Device gate

| Gate | Steps | Result |
|---|---|---|
| Slot Min, round trip | Create league > Price tiers > Add slot. Focus Min, type `12`. L -> AX5 -> L with the keyboard up. Blur. | Keyboard held through both size changes (`g1-2`, `g1-3`). After blur: Stocks / Min / Max at L widths, `12` kept (`g1-4`). **Content region vs cold L (`g1-5`): 0 px.** |
| Sibling tap after a round trip | Min focused, L -> AX5 -> L, tap Stocks. Then blur. | Stocks takes focus, keyboard stays up, no remount between (`g2-3`). After the last blur: **0 px vs cold L** (`g2-4` vs `g1-5`). |
| Single Field | Create step 1, League name: type `Roma`, L -> AX5 -> L focused, blur. | Keyboard held. After blur "Roma" at L, no keyboard re-raised by the remount (`g3-4`). **0 px vs cold L (`g3-5`).** |

"Content region" is everything between the nav bar and the LogBox toast. The only other differences in the full frames are the status-bar clock
digit and the toast's badge count.

Not run on device: the one-way sibling case (Min focused, L -> AX5, tap a sibling with no return to L). At AX5 the fields are several screens down
under the keyboard, and the case is covered by the reducer tests ("a one-way change during focus still remounts once at blur", "a tap to a sibling
with no change never remounts") and by the P3-1 device runs on the old code. It does not exercise the new flag differently from the round trip.
The single-Field gate is a regression check: the pre-fix stale state was demonstrated on the slot row (`g1-3`), not on a lone Field.

### Tests and mutants

`focus-roundtrip.test.ts` (14 tests): a `Hook` simulator that mirrors the hook render by render (closures over the last render's key, a batched
sibling tap in one render), covering the round trip, no-change, one-way, several sizes in one session, repeated round trips (keys never repeat),
unfocused behaviour (unchanged), a sibling tap with and without a change, a change after a sibling tap, the pure steps, a no-render-loop guard, and
source guards that both users go through the shared hook and nothing else calls `inputRemountKey`. The two pinned hook source guards in
`input-remount-key.test.ts` and `row-remount-key.test.ts` follow the refactor.

Mutants (anchored to one line, the runner asserts the diff touches exactly that line): 21 in P3-A (14 in `focusRoundTrip.ts`, 4 in the hook, 2 in
`useInputRemountKey`, 1 in `useRowRemountKey`), all killed. One run reported a false survivor (R6): the runner matched `0 failed` inside `10 failed`.
Re-run by hand it fails 10 tests; the runner now matches `| 0 failed`.

## P3-B: This week opponent label breaks after "vs", never inside the name

At XXXL the two-line branch wrapped `vs Gianluigi` / `B.`. `oppLabelKept = vsOpponentLabel(keepName(opponentName))`: `keepName` glues a name of 20
characters or fewer, so the label breaks after "vs" or not at all, and a longer name keeps its breakable spaces. Only the `numberOfLines={2}`
branch takes it. The fit test (`nameBesideAvatar`), the stacked one-line fitted name and the VoiceOver label keep the plain label (a one-line fit
cannot orphan "B.", and a no-break space shifted digits there once before). `this-week-opp-name.test.ts` (6 tests) runs a greedy wrap over six
names, with a negative control that the plain label wraps `vs Gianluigi` / `B.`; 5 mutants in `ThisWeekCard`, all killed.

| Frame | What it shows |
|---|---|
| `b-short-XXXL` | `Gianluigi B.` at XXXL: **"vs" / "Gianluigi B."** (the label that used to wrap `vs Gianluigi` / `B.`). |
| `b-short-AX5-card5` | The same name at AX5: the fitted one-line branch, `vs Gianluigi B.`, no orphan. |
| `b-long-XXXL`, `b-long-AX5` | The `stress` fixture's 19-character name (`Gianluigi Buonarroti`): fitted one line at both sizes, no wrap. |

No pre-fix still of the XXXL wrap was taken on this branch; the bug is the Design Lead's report, and the test's negative control reproduces the wrap
in the plain string.

## Cross-PR notes

#329 (keepTime) edits `ThisWeekCard` (the `rightLabel` line) and its imports; this branch edits the opponent label lines and adds an import. Both
touch the generated files, so whichever lands second regenerates them (`gen-architecture`, `gen-tappables`, `gen-source-manifest`).
