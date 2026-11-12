// Stockpile key-screens board — "Your call: Create league › Season" (Giorgio, 2026-11-10, build 12).
// His words: "I really don't like this style of mainline like managers and then this like smaller
// subtitle that explains it ... red flag of like AI built, vibe coded ... far too cluttered ... I want
// the regular season weeks button to be just as big as the managers and playoff teams. We can
// abbreviate weeks into just WKS to kind of fit this".
// Both options: three identical steppers ("11 wks"), no grey line under any label. A: one line under
// the card. B: a season strip (one tile per week, the playoff weeks named) and one line.
// The state is Giorgio's screen: 6 managers, 11 weeks, 5 playoff teams (3 playoff weeks, top 3 byes).
// Review notes sit UNDER the phones, never inside them.
(function () {
  const { Device, Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, G, NEW } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  /** The Stepper puts its box under the label from this text size (FULL_WIDTH_FONT_SCALE). */
  const STACK = 1.35;

  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const Rule = () => <div style={{ height: 1, background: 'var(--c-border)', marginInline: -16 }} />;

  /** One stepper. `cell`: the value cell's width (today it grows with "11 weeks"; both options fix
   * it, so the three boxes are identical). */
  function Stepper({ label, sub, value, x, down = true, up = true, today, info }) {
    const InfoI = info && window.KSInfoKit ? window.KSInfoKit.InfoI : null;
    const stacked = x >= STACK;
    const btn = (on, d) => (
      <span style={{ width: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: on ? 'var(--c-text)' : 'var(--c-text-3, var(--c-text-2))' }}>
        <Icon d={d} size={Math.round(18 * k(x, 1.6))} width={2.4} />
      </span>
    );
    const cell = today ? { minWidth: 64, padding: '0 12px' } : { width: Math.round(84 * k(x, 1.6)) };
    return (
      <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          {InfoI ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dr-call" style={{ ...fs(15, x, 1.6), fontWeight: 600, color: 'var(--c-text)' }}>{label}</span><InfoI x={x} /></span>
            : <span className="dr-call" style={{ ...fs(15, x, 1.6), fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>}
          {sub ? <span className="dr-cap" style={fs(12, x)}>{sub}</span> : null}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'stretch', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden', flex: 'none' }}>
          {btn(down, 'M5 12h14')}
          <b className="dr-num" style={{ ...cell, ...fs(17, x, 1.6), display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 700, color: 'var(--c-text)', borderInline: '1px solid var(--c-border)', whiteSpace: 'nowrap' }}>{value}</b>
          {btn(up, ICON.plus)}
        </span>
      </div>
    );
  }

  /** A reason beside a control that can't go further: shown only while it is at the limit
   * (PRODUCT_RULES, "Nothing tappable does nothing": disabled with the reason beside it). */
  const Reason = ({ x, children }) => <span className="dr-cap" style={{ ...fs(13, x, 1.6), color: 'var(--c-text)', marginTop: -6 }}>{children}</span>;

  /** B's strip: one tile per week, the playoff weeks wider and named (WC / SF / F, the approved chips). */
  function Strip({ x, weeks = 11, rounds = ['WC', 'SF', 'F'] }) {
    const total = weeks + rounds.length;
    return (
      <div role="img" aria-label={`Season: ${weeks} weeks + ${rounds.length} playoff weeks`} style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: weeks }, (_, i) => <span key={i} style={{ flex: 1, height: Math.round(30 * k(x, 1.4)), borderRadius: 4, background: 'var(--c-inset)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }} />)}
          {rounds.map((r) => (
            <span key={r} className="dr-tag" style={{ flex: 3, minWidth: 'max-content', paddingInline: 6, height: Math.round(30 * k(x, 1.4)), borderRadius: 4, display: 'grid', placeItems: 'center', background: 'var(--c-accent-tint)', boxShadow: 'inset 0 0 0 1px var(--c-accent)', color: 'var(--c-text)', ...fs(11, x, 1.4) }}>{r}</span>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="dr-cap dr-num" style={fs(12, x, 1.4)}>Wk 1</span>
          <span className="dr-cap dr-num" style={fs(12, x, 1.4)}>{`Wk ${total}`}</span>
        </div>
      </div>
    );
  }

  /** v: today | A | B. limit: Playoff teams at 6 of 6 (its + can't go further). */
  function Body({ v, x, limit, mgr }) {
    const pt = mgr ? mgr.pt : limit ? 6 : 5;
    // keepHyphens, as the app does: "first-round" never breaks at its hyphen.
    const byes = (mgr ? mgr.byes : limit ? 'the top 2 seeds get first-round byes' : 'the top 3 seeds get first-round byes').replace('-', '\u2011');
    if (v === 'today') {
      return (
        <>
          <div className="dr-a-card" style={{ padding: '20px 16px', display: 'grid', gap: 20 }}>
            <Stepper today x={x} label="Managers" sub="How many you expect, you included" value="6" />
            <Stepper today x={x} label="Regular season" value="11 weeks" />
            <span className="dr-cap" style={fs(12, x)}>At least 5 weeks, so every team plays every other team once.</span>
            <div style={{ display: 'grid', gap: 6 }}>
              <Stepper today x={x} label="Playoff teams" sub="2 to 6, up to your expected managers" value={String(pt)} up={!limit} />
              <span className="dr-cap dr-num" style={{ ...fs(12, x), color: 'var(--c-text)' }}>{`${pt} teams · 3 weeks of playoffs · ${byes}`}</span>
              <span className="dr-cap dr-num" style={fs(12, x)}>Season: 11 weeks + 3 playoff weeks. We check this again when the draft starts.</span>
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="dr-a-card" style={{ padding: '6px 16px', display: 'grid', gap: 14 }}>
          <div style={{ paddingTop: 8 }}><Stepper x={x} label="Managers" value={mgr ? mgr.v : '6'} down={!mgr || mgr.v !== '4'} up={!mgr || mgr.v !== '16'} /></div>
          {mgr && mgr.reason ? <Reason x={x}>{mgr.reason}</Reason> : null}
          <Rule />
          <Stepper x={x} label="Regular season" value={mgr ? `${mgr.weeks} wks` : '11 wks'} down={!(mgr && mgr.wkEnd)} />
          {mgr && mgr.wkEnd && mgr.lines ? <Reason x={x}>At least 5 weeks, so every team plays every other team once.</Reason> : null}
          <Rule />
          <Stepper x={x} label="Playoff teams" value={String(pt)} up={!limit && !(mgr && mgr.ptEnd)} info={mgr && mgr.info} />
          {limit || (mgr && mgr.ptEnd && mgr.lines) ? <Reason x={x}>2 to 6, up to your expected managers</Reason> : null}
          {v === 'B' ? <><Rule /><Strip x={x} weeks={mgr ? mgr.weeks : 11} rounds={mgr ? mgr.rounds : undefined} /></> : null}
          <div style={{ height: 2 }} />
        </div>
        {v === 'A'
          ? <span className="dr-call dr-num" style={{ ...fs(15, x, 1.6), color: 'var(--c-text-2)', paddingInline: 4 }}>{`Season: 11 weeks + 3 playoff weeks · ${byes}`}</span>
          : <span className="dr-call" style={{ ...fs(15, x, 1.6), color: 'var(--c-text-2)', paddingInline: 4 }}>{byes.replace(/^t/, 'T')}.</span>}
      </>
    );
  }

  function Frame({ t, v, x = 1, limit, mgr }) {
    const label = mgr && mgr.label ? `Create league, step 2 of 4, Season, ${mgr.label}, ${x > 1 ? 'your size (AX5, approximate)' : 'Large'}, ${t}`
      : mgr ? `Create league, step 2 of 4, Season, Managers at ${mgr.v}, ${mgr.reason ? `the line "${mgr.reason}"` : 'no line'}, ${x > 1 ? 'your size (AX5, approximate)' : 'Large'}, ${t}`
      : `Create league, step 2 of 4, Season, ${{ today: 'as build 12 ships it', A: 'option A', B: 'option B' }[v]}${limit ? ', playoff teams at its limit' : ''}, ${x > 1 ? 'your size (AX5, approximate)' : 'Large'}, ${t}`;
    return (
      <Th t={t}>
        <Device noTabs label={label}>
          <div style={{ padding: `8px ${G}px 24px`, display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="dr-call" style={{ color: 'var(--c-accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, ...fs(15, x, 1.6) }}><Icon d={ICON.left} size={18} width={2.4} />Back</span>
              <span className="dr-cap dr-num" style={fs(12, x, 1.6)}>Step 2 of 4</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {[1, 2, 3, 4].map((i) => <span key={i} style={{ height: 4, borderRadius: 2, background: i <= 2 ? 'var(--c-accent)' : 'var(--c-border)' }} />)}
              </div>
              <span style={{ ...fs(32, x, 1.6, 1.15), fontWeight: 800, color: 'var(--c-text)' }}>Season</span>
              {mgr ? null /* cut by the sweep (the Season-strip build) */ : <span className="dr-call" style={{ ...fs(15, x, 2), color: 'var(--c-text-2)' }}>How big the league is and how long it runs.</span>}
            </div>
            <Body v={v} x={x} limit={limit} mgr={mgr} />
            <span className="dr-btn" style={{ width: '100%', minHeight: Math.round(50 * k(x, 1.3)), height: 'auto', ...fs(16, x, 1.6), boxSizing: 'border-box' }}>Next</span>
          </div>
        </Device>
      </Th>
    );
  }

  /** The case of "wks", inside the stepper's value cell, at Large. */
  function CaseStrip({ t }) {
    const cells = [['11 WKS', 'Caps: reads as a tag ("POSTPONED", "LIVE"), not a number.'], ['11 Wks', 'Title case: a unit is never capitalised in the app.'], ['11 wks', 'Lowercase: a unit, like "30 seconds" and "6:00 PM ET" around it. Picked.']];
    return (
      <Th t={t}>
        <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 14, background: 'var(--c-bg)' }}>
          {cells.map(([v, note], i) => (
            <div key={v} style={{ display: 'grid', gridTemplateColumns: '172px minmax(0, 1fr)', gap: 14, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', border: `${i === 2 ? 2 : 1}px solid ${i === 2 ? 'var(--c-accent)' : 'var(--c-border)'}`, borderRadius: 10, overflow: 'hidden', color: 'var(--c-text)' }}>
                <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}><Icon d="M5 12h14" size={18} width={2.4} /></span>
                <b className="dr-num" style={{ width: 84, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 700, borderInline: '1px solid var(--c-border)', whiteSpace: 'nowrap' }}>{v}</b>
                <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}><Icon d={ICON.plus} size={18} width={2.4} /></span>
              </span>
              <span className="dr-call" style={{ fontSize: 13, lineHeight: '18px', color: i === 2 ? 'var(--c-text)' : 'var(--c-text-2)' }}>{note}</span>
            </div>
          ))}
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const AX = 'An approximation of your text size. The build gate checks the real thing.';
  const three = (v, cap, notes = {}, limit) => [
    fig(`${v}${limit ? 'm' : ''}ll`, `${cap} · Large · Light`, <Frame t="light" v={v} limit={limit} />, notes.l),
    fig(`${v}${limit ? 'm' : ''}ld`, `${cap} · Large · Dark`, <Frame t="dark" v={v} limit={limit} />, notes.d),
    fig(`${v}${limit ? 'm' : ''}xl`, `${cap} · your size (AX5) · Light`, <Frame t="light" v={v} x={2.4} limit={limit} />, notes.x || AX),
  ];

  function CallSeasonStep({ archived }) {
    return (
      <section className="b-sec" id="call-season-step" aria-labelledby="call-season-step-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Create</span>
          <div>
            <h2 id="call-season-step-h">{archived ? 'Decided: B, the Season step with a season strip' : 'Your call: the Season step, without the line under every label'}</h2>
            <p className="b-job">Your build-12 note: the label with a smaller grey line explaining it reads as AI-built and clutters the step, and the weeks box should be as big as the other two, as "WKS". Both options: three identical steppers, "11 wks", and no line under any label. What changes is where the season's facts go. The facts kept: the playoff teams' range, the playoff shape (3 weeks of playoffs, the top 3 seeds get byes) and the season's length.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          {archived ? <li><b>Decided by Giorgio (2026-11-10): B.</b> His words: "B for the season step, the one with a strip". Three identical steppers, "11 wks", no line under any label; the season strip and the bye line; a limit's reason only at the limit. The sweep is not yet decided. Rules: PRODUCT_RULES, "The Season step in Create league".</li> : null}
          <li><b>Today:</b> six small lines on one card (two under labels, four under the steppers), and the weeks box is wider than the others.</li>
          <li><b>A · One line under the card.</b> "Season: 11 weeks + 3 playoff weeks · the top 3 seeds get first-round byes", and it updates as you step. <b>Cost: small.</b> No new words (both halves are lines the step shows today).</li>
          <li><b>B · A season strip.</b> One tile per week, the playoff weeks named WC, SF, F (the chips your season chart already uses), "Wk 1" to "Wk 14" under it; then one line, "The top 3 seeds get first-round byes." You see the season's shape instead of reading it. <b>Cost: medium</b> (one small new piece). No new words.</li>
          <li><b>Both · the limits are the stepper's.</b> − and + grey out at the ends. Your rule says a control that can't act shows its reason beside it, so the reason appears under that stepper only while it is at the end: "2 to 6, up to your expected managers" (Playoff teams), "At least 5 weeks, so every team plays every other team once." (Regular season). Managers at 4 or 16 has no reason today; the build will need one (new words, for you).</li>
          <li><b>Dropped:</b> "How many you expect, you included" and "We check this again when the draft starts." The draft-time blockers card already catches a league that came in smaller than planned.</li>
          <li><b>Not drawn: an (i) button.</b> It hides the one fact you want while stepping, and a disabled + needs its reason beside it, not behind a tap.</li>
          <li><b>Recommended: B.</b> At your text size the strip stays one strip, while A's line runs to five lines; and it previews the season row you see on Home. If B's cost is too much for 1.3, A is the cheap version of the same step.</li>
          <li><b>The sweep (my recommendation): yes, the same rule on the screens that use these controls, in the same build.</b> The Draft step (Rounds' "One per roster slot"), the Duration lengths ("Quick game", "Standard"...), League settings (Rounds) and the renewal review's Playoffs stepper. Kept: League type's two lines and the stake modes' lines (there the line is what the choice means), and "the draft has started, so this is set" (a reason for a locked control). The non-draftable stocks switch's long label needs your words, so it comes to you separately. These are the only screens with the pattern; the gate checklist will keep it out of new ones.</li>
        </ul>
        <h3 className="b-sub">The case of "wks"</h3>
        <Grid>{[fig('case-l', 'Large · Light', <CaseStrip t="light" />), fig('case-d', 'Large · Dark', <CaseStrip t="dark" />, 'VoiceOver still says "11 weeks".')]}</Grid>
        <h3 className="b-sub">Today, as build 12 ships it</h3>
        <Grid>{three('today', 'Today', { l: 'Six small lines, and the weeks box is wider.' })}</Grid>
        <h3 className="b-sub">A · One line under the card</h3>
        <Grid>{three('A', 'A')}</Grid>
        <Grid>{three('A', 'A · Playoff teams at 6 of 6', { l: 'The reason shows only while + can\'t go further.' }, true)}</Grid>
        <h3 className="b-sub">B · A season strip (recommended)</h3>
        <Grid>{three('B', 'B', { l: 'WC, SF, F: the playoff chips from your season chart.' })}</Grid>
        <Grid>{three('B', 'B · Playoff teams at 6 of 6', { l: 'The reason shows only while + can\'t go further.' }, true)}</Grid>
      </section>
    );
  }

  // ── The reason line under Managers at its two ends (4 and 16), new words for Giorgio. ──
  // At 4: Playoff teams 3, Wild card then Final, one bye. At 16: every team plays every other once,
  // so the regular season is at least 15 weeks; Playoff teams 6, the top 2 seeds get byes.
  const LOW = { v: '4', pt: 3, weeks: 11, rounds: ['WC', 'F'], byes: 'the top seed gets a first-round bye' };
  const HIGH = { v: '16', pt: 6, weeks: 15, rounds: ['WC', 'SF', 'F'], byes: 'the top 2 seeds get first-round byes' };
  const MGR = {
    today: { low: null, high: null },
    A: { low: '4 to 16 managers', high: '4 to 16 managers' },
    B: { low: 'At least 4, so the league can draft.', high: 'Up to 16 managers.' },
  };
  const at = (end, opt) => ({ ...(end === 'low' ? LOW : HIGH), reason: MGR[opt][end] });
  function CallManagersLimit({ archived }) {
    const decided = <li><b>Decided by Giorgio (2026-11-11): neither, no line.</b> "I don't like this idea of adding in like this smaller subtext to explain things that don't need to be explained … if there needs to be an extra explanation for something, I want it to be in like a little information thing or something that the user would have to click to then see". − greys out at 4 and + at 16, with nothing beside them ("Today" below). Recorded in PRODUCT_RULES (The Season step, "Managers at 4 and 16: no line").</li>;
    return (
      <section className="b-sec" id="call-managers-limit" aria-labelledby="call-managers-limit-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Create</span>
          <div><h2 id="call-managers-limit-h">{archived ? 'Decided: no line under Managers at 4 or 16' : 'Your call: the line under Managers at 4 and at 16'}</h2></div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Why you're being asked:</b> your Season step (B) greys out − and + at the ends and shows the reason under that stepper only while it's at the end. Playoff teams and Regular season have their lines. Managers at 4 or 16 had none: new words, for you, when it was built. It's built now.</li>
          <li><b>What you're looking at:</b> Create league › Season, with Managers at its lowest (4, − greyed) and its highest (16, + greyed). Only the line under Managers changes. Every line here is <NEW />.</li>
          <li><b>Where the numbers come from:</b> 4 is the fewest a league can draft with (your rule, "a league needs at least 4 managers to draft"). 16 is the most a league allows. No rule gives a reason for 16, so neither option invents one.</li>
          <li><b>A · the range, the same line at both ends:</b> "4 to 16 managers". The same form as Playoff teams' "2 to 6, …".</li>
          <li><b>B · each end says its own:</b> at 4, "At least 4, so the league can draft." (the same form as Regular season's "At least 5 weeks, so …"); at 16, "Up to 16 managers."</li>
          <li><b>Recommended: B.</b> 4 is the end people will hit: a group of three friends tries 3. B tells them why in the words of your rule, so it doesn't read as an arbitrary limit. At 16 there is no reason to give, so B just names the cap.</li>
          <li><b>Not drawn: no line.</b> Your rule says a control that can't act shows its reason beside it.</li>
          {archived ? decided : <li><b>Answer with:</b> A or B, or your own words.</li>}
        </ul>
        <h3 className="b-sub">{archived ? 'Today, as the Season-strip build ships it: no line (decided)' : 'Today, as the Season-strip build ships it: no line'}</h3>
        <Grid>{[
          fig('ml-t4', 'Today · Managers at 4 · Large · Light', <Frame t="light" v="B" mgr={at('low', 'today')} />, '− is greyed, with nothing beside it.'),
          fig('ml-t16', 'Today · Managers at 16 · Large · Light', <Frame t="light" v="B" mgr={at('high', 'today')} />, '+ is greyed, with nothing beside it. At 16, the season is at least 15 weeks.'),
        ]}</Grid>
        <h3 className="b-sub">A · the range, the same line at both ends</h3>
        <Grid>{[
          fig('ml-a4', 'A · Managers at 4 · Large · Light', <Frame t="light" v="B" mgr={at('low', 'A')} />, '"4 to 16 managers" (NEW).'),
          fig('ml-a16', 'A · Managers at 16 · Large · Light', <Frame t="light" v="B" mgr={at('high', 'A')} />, 'The same line.'),
        ]}</Grid>
        <h3 className="b-sub">B · each end says its own (recommended)</h3>
        <Grid>{[
          fig('ml-b4', 'B · Managers at 4 · Large · Light', <Frame t="light" v="B" mgr={at('low', 'B')} />, '"At least 4, so the league can draft." (NEW).'),
          fig('ml-b16', 'B · Managers at 16 · Large · Light', <Frame t="light" v="B" mgr={at('high', 'B')} />, '"Up to 16 managers." (NEW).'),
          fig('ml-b4d', 'B · Managers at 4 · Large · Dark', <Frame t="dark" v="B" mgr={at('low', 'B')} />),
          fig('ml-b4x', 'B · Managers at 4 · your size (AX5) · Light', <Frame t="light" v="B" x={2.4} mgr={at('low', 'B')} />, AX),
        ]}</Grid>
      </section>
    );
  }
  window.KSManagersLimit = () => null; // decided 2026-11-11: no line; it lives in the Archive
  window.KSManagersLimitArchived = () => <CallManagersLimit archived />;

  // ── The two approved limit lines: keep them (A) or drop them too (B). Managers 6. ──
  const PT_END = { v: '6', pt: 6, weeks: 11, rounds: ['WC', 'SF', 'F'], byes: 'the top 2 seeds get first-round byes', ptEnd: true, info: true };
  const WK_END = { v: '6', pt: 4, weeks: 5, rounds: ['SF', 'F'], byes: 'No byes', wkEnd: true, info: true };
  const lim = (s, lines) => ({ ...s, lines, label: `${s.ptEnd ? 'Playoff teams at 6 of 6' : 'Regular season at its floor, 5 weeks'}, ${lines ? 'with the reason line' : 'no line'}` });
  function CallLimitLines({ archived }) {
    return (
      <section className="b-sec" id="call-limit-lines" aria-labelledby="call-limit-lines-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Create</span>
          <div><h2 id="call-limit-lines-h">{archived ? 'Decided: B, drop the two limit lines too' : 'Your call: the two limit lines on the Season step, keep them or drop them too'}</h2></div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Why you're being asked:</b> you ruled no line under Managers at 4 or 16 ("no one wants to run something as a bunch of tiny little subheaders"). Two lines like it are approved and built: under Playoff teams at its top, and under Regular season at its floor. Same pattern, so the same question.</li>
          <li><b>What you're looking at:</b> Create league › Season as the Season-strip build ships it (no subtitle, the strip, the i on Playoff teams), with 6 managers, in two states: Playoff teams at 6 of 6 (+ greyed), and Regular season at its floor, 5 weeks (− greyed). No new words in either option.</li>
          <li><b>A · keep them (today's rule).</b> While a stepper is at its end, its reason shows under it: "2 to 6, up to your expected managers" and "At least 5 weeks, so every team plays every other team once."</li>
          <li><b>B · drop them.</b> The stepper just greys out, as Managers now does. Nothing beside it, and nothing added to the Playoff teams i: its approved line already says the top teams play a bracket, and the greyed + shows where it stops.</li>
          <li><b>Recommended: B.</b> It's what your ruling on Managers says ("if there needs to be an extra explanation … a little information thing … the user would have to click"), and it makes all three steppers behave the same. What you lose: why 5 weeks is the floor (every team plays every other once) and why 6 managers caps Playoff teams. Both are reachable: step Managers up and the caps move with it.</li>
          <li><b>The rule B overrides:</b> "Nothing tappable does nothing" says a control that can't act is "disabled with the reason beside it". B makes the steppers' ends greyed with no reason beside them; it's still never a silent no-op, because the greyed button shows it can't go further.</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-11): "option B".</b> Both lines go; a stepper at its end just greys out, with nothing added to the Playoff teams i. It overrides the "disabled with the reason beside it" clause of "Nothing tappable does nothing" for steppers at their ends. Recorded in PRODUCT_RULES (The Season step, "Steppers at their ends: no line").</li> : <li><b>Answer with:</b> A or B.</li>}
        </ul>
        <Grid>{[
          fig('ll-a-pt', 'A · Playoff teams at 6 of 6 · Large · Light', <Frame t="light" v="B" mgr={lim(PT_END, true)} />, 'The reason under the stepper while + is greyed.'),
          fig('ll-a-wk', 'A · Regular season at 5 weeks · Large · Light', <Frame t="light" v="B" mgr={lim(WK_END, true)} />, 'The reason under the stepper while − is greyed.'),
          fig('ll-b-pt', archived ? 'B · Playoff teams at 6 of 6 · Large · Light (decided)' : 'B · Playoff teams at 6 of 6 · Large · Light', <Frame t="light" v="B" mgr={lim(PT_END, false)} />, '+ greyed, nothing beside it.'),
          fig('ll-b-wk', 'B · Regular season at 5 weeks · Large · Light', <Frame t="light" v="B" mgr={lim(WK_END, false)} />, '− greyed, nothing beside it.'),
        ]}</Grid>
      </section>
    );
  }
  window.KSLimitLines = () => null; // decided 2026-11-11: B; it lives in the Archive
  window.KSLimitLinesArchived = () => <CallLimitLines archived />;

  // Decided 2026-11-10 (B); the call lives in the Archive (board.jsx).
  window.KSSeasonStep = () => null;
  window.KSSeasonStepArchived = () => <CallSeasonStep archived />;
})();
