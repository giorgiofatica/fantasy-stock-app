// Stockpile key-screens board — the rule-12 sweep's lines that need words (2026-11-16, after Giorgio's
// fourth report). Most visible first: the draft room's card on someone else's turn, the commissioner's
// "can't start yet" card, then the dead reset link and the not-found page. Each is A / B for him; no
// option has a heading with more than one line under it. Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, NEW } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const tagStyle = (x, color) => ({ ...fs(11, x, 1.6, 1.3), fontWeight: 800, fontStretch: '125%', letterSpacing: '0.06em', textTransform: 'uppercase', color: color || 'var(--c-text-2)' });

  function Phone({ t, label, tab, children }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: tab ? 83 : 0, overflow: 'hidden' }}>{children}</div>
          {tab ? (
            <nav className="ks-tabs">
              {[['home', 'Home'], ['matchup', 'Matchup'], ['league', 'League'], ['portfolio', 'Portfolio']].map(([id, n]) => (
                <span key={id} className={id === tab ? 'ks-tabs__t ks-tabs__t--on' : 'ks-tabs__t'}><Icon d={ICON[id]} width={id === tab ? 2.4 : 1.8} />{n}</span>
              ))}
            </nav>
          ) : null}
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }
  const card = { background: 'var(--c-surface)', borderRadius: 16, padding: '16px 18px', boxShadow: 'inset 0 0 0 1px var(--c-border)' };
  const nb = (s) => s.replace(/ (\d+ (?:of|picks?))/g, ' $1');

  // ── #call-draft-turn ───────────────────────────────────────────────────
  /** The turn card while someone else is on the clock. v: today | A | B; after: you have a pick already. */
  function TurnCard({ x = 1, v, after }) {
    const round = 'Round 2 of 6 · Pick 11';
    const ring = (
      <span style={{ width: Math.round(56 * k(x, 1.3)), height: Math.round(56 * k(x, 1.3)), flex: 'none', borderRadius: '50%', boxShadow: 'inset 0 0 0 4px var(--c-accent)', display: 'grid', placeItems: 'center', ...fs(15, x, 1.3), fontWeight: 800, color: 'var(--c-text)' }} className="dr-num">0:42</span>
    );
    const head = <span style={{ ...fs(17, x, 1.6), fontWeight: 700, color: 'var(--c-text)' }}>Sofia is up</span>;
    const grey = (s) => <span style={{ ...fs(15, x, 1.3), color: 'var(--c-text-2)' }}>{s}</span>;
    const mine = (s) => <span style={{ ...fs(15, x, 1.3), fontWeight: 700, color: 'var(--c-you-text, var(--c-accent))' }}>{s}</span>;
    const personal = after ? "You took NVDA · you're up in 3 picks" : '3 picks until you';
    let body;
    if (v === 'today') body = <>{head}{grey(round)}{after ? mine(personal) : grey(personal)}</>;
    else if (v === 'A') body = <>{head}{grey(`${round} · ${after ? "you're up in 3\u00a0picks" : '3\u00a0picks until you'}`)}</>;
    else body = <><span style={tagStyle(x)}>{round}</span>{head}{after ? mine(personal) : grey(personal)}</>;
    return (
      <div style={{ ...card, display: 'flex', gap: 14, alignItems: x >= 2 ? 'flex-start' : 'center', flexDirection: x >= 2 ? 'column' : 'row' }}>
        {ring}
        <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>{body}</span>
      </div>
    );
  }
  function DraftRoom({ t = 'light', x = 1, v, after, label }) {
    const sq = (s, i) => <span key={i} style={{ height: 34, borderRadius: 6, background: s ? 'var(--c-surface)' : 'transparent', boxShadow: 'inset 0 0 0 1px var(--c-border)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: 'var(--c-text)' }}>{s}</span>;
    const picks = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOG', 'META', 'TSLA', 'COST', 'V', 'JPM', '', '', '', '', '', '', '', ''];
    return (
      <Phone t={t} label={label}>
        <div style={{ padding: '8px 16px', display: 'grid', gap: 14 }}>
          <span style={{ ...fs(17, x, 1.3), fontWeight: 700, color: 'var(--c-text)', textAlign: 'center' }}>Draft</span>
          <TurnCard x={x} v={v} after={after} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>{picks.map(sq)}</div>
        </div>
      </Phone>
    );
  }

  // ── #call-blockers-card ────────────────────────────────────────────────
  function BlockersCard({ x = 1, v }) {
    const line = v === 'today'
      ? 'Fix these before 6:00 PM ET, when the draft room opens. If they’re still open then, the draft is postponed.'
      : v === 'B' ? 'If they’re still open then, the draft is postponed.' : null;
    return (
      <div style={{ borderRadius: 16, padding: '16px 18px', display: 'grid', gap: 10, background: 'var(--c-warn-tint, oklch(96% 0.05 85))', boxShadow: 'inset 0 0 0 1px var(--c-warn-line, oklch(80% 0.1 85))' }}>
        <span style={tagStyle(x, 'var(--c-warn-text, oklch(45% 0.12 70))')}>Needs you before 6:00{' '}PM{' '}ET</span>
        <span style={{ display: 'grid', gap: 4 }}>
          <span style={{ ...fs(17, x, 1.6), fontWeight: 800, color: 'var(--c-text)' }}>The draft can’t start yet</span>
          {line ? <span style={{ ...fs(13, x, 2), color: 'var(--c-text)' }}>{line}</span> : null}
        </span>
        <div style={{ ...card, display: 'grid', gap: 8 }}>
          <b style={{ ...fs(15, x, 1.6), color: 'var(--c-text)' }}>Sofia F. left the league</b>
          <span style={{ ...fs(13, x, 2), color: 'var(--c-text-2)' }}>Fewer than 4 teams have joined.</span>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="dr-num" style={{ ...fs(17, x, 1.3), fontWeight: 800, letterSpacing: '0.08em', color: 'var(--c-text)' }}>SCUD26</span>
            <span style={{ padding: '8px 16px', borderRadius: 999, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', ...fs(15, x, 1.3), fontWeight: 700, color: 'var(--c-text)' }}>Share</span>
          </span>
        </div>
      </div>
    );
  }
  function LeagueRisk({ t = 'light', x = 1, v, label }) {
    return (
      <Phone t={t} tab="league" label={label}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px' }}>
          <span style={{ padding: '8px 14px', borderRadius: 999, boxShadow: 'inset 0 0 0 1px var(--c-border)', ...fs(17, x, 1.3), fontWeight: 700, color: 'var(--c-text)' }}>Stock Scudetto</span>
          <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-accent)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>PM</span>
        </div>
        <div style={{ padding: '6px 16px', display: 'grid', gap: 16 }}>
          <div style={{ ...card, display: 'grid', gap: 4, justifyItems: 'center' }}>
            <span style={tagStyle(x)}>Draft room opens in</span>
            <span className="dr-num" style={{ ...fs(40, x, 1.6, 1.1), fontWeight: 800, color: 'var(--c-text)' }}>2h 14m</span>
          </div>
          <BlockersCard x={x} v={v} />
        </div>
      </Phone>
    );
  }

  // ── #call-dead-links ───────────────────────────────────────────────────
  const GLYPH = {
    link: ['M9.5 14.5l-1.8 1.8a3.2 3.2 0 0 1-4.5-4.5l2.6-2.6a3.2 3.2 0 0 1 4.3-.2', 'M14.5 9.5l1.8-1.8a3.2 3.2 0 0 1 4.5 4.5l-2.6 2.6a3.2 3.2 0 0 1-4.3.2', 'M4 4l16 16'],
    search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
    alert: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 8v5', 'M12 16h.01'],
  };
  function Dead({ t = 'light', x = 1, label, g, heading, line, primary, secondary, today }) {
    return (
      <Phone t={t} label={label}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px', textAlign: 'center' }}>
            <span style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', color: 'var(--c-text-2)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLYPH[g].map((d) => <path key={d} d={d} />)}</svg>
            </span>
            <span style={{ ...fs(today ? 26 : 30, x, 1.15, 1.15), fontWeight: 800, color: 'var(--c-text)' }}>{heading}</span>
            {line ? <span style={{ ...fs(17, x, 2), color: 'var(--c-text-2)', marginTop: -6 }}>{line}</span> : null}
            {today ? <div style={{ display: 'grid', gap: 10, width: '100%', marginTop: 8 }}>
              {primary ? <span style={{ display: 'grid', placeItems: 'center', minHeight: 52, borderRadius: 30, ...fs(17, x, 1.6), fontWeight: 700, background: 'var(--c-accent)', color: 'var(--c-on-accent)' }}>{primary}</span> : null}
              {secondary ? <span style={{ display: 'grid', placeItems: 'center', minHeight: 44, ...fs(17, x, 1.6), fontWeight: 700, color: 'var(--c-accent)' }}>{secondary}</span> : null}
            </div> : null}
          </div>
          {today ? null : (
            <div style={{ padding: '0 20px 24px', display: 'grid', gap: 6 }}>
              <span style={{ display: 'grid', placeItems: 'center', minHeight: Math.round(52 * k(x, 1.3)), borderRadius: 30, ...fs(17, x, 1.6), fontWeight: 700, background: 'var(--c-accent)', color: 'var(--c-on-accent)' }}>{primary}</span>
              {secondary ? <span style={{ display: 'grid', placeItems: 'center', minHeight: 44, ...fs(17, x, 1.6), fontWeight: 700, color: 'var(--c-text-2)' }}>{secondary}</span> : null}
            </div>
          )}
        </div>
      </Phone>
    );
  }
  const RESET_TODAY = { g: 'alert', heading: 'This link didn’t work', line: 'It may have expired, been used already, or been opened on a different device than the one that asked for it. Request a new link to continue.', primary: 'Request a new link', secondary: 'Back to sign in' };
  const NF_TODAY = { g: 'search', heading: 'Nothing here', line: 'This link is old or incomplete. Everything in your leagues is still where you left it.', primary: 'Go to Home' };
  const RESET = { g: 'link', heading: 'This link didn’t work.', primary: 'Request a new link', secondary: 'Back to sign in' };
  const NF = { g: 'search', heading: 'Nothing here.', primary: 'Go to Home' };
  const RESET_B_LINE = 'It may have been opened on a different device.';
  const NF_B_LINE = 'This link is old or incomplete.';

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const Head = ({ id, code, title, job }) => (
    <header className="b-sec__head"><span className="b-sec__n b-sec__n--code">{code}</span><div><h2 id={`${id}-h`}>{title}</h2><p className="b-job">{job}</p></div></header>
  );

  function CallDraftTurn() {
    return (
      <section className="b-sec" id="call-draft-turn" aria-labelledby="call-draft-turn-h">
        <Head id="call-draft-turn" code="Draft" title="Your call: the turn card while someone else picks" job={'In the draft room, while someone else is on the clock, the card has two lines under "Sofia is up": the round and pick, then how far you are from your turn. Every part is a fact, but it’s two lines of small text under a name. Two ways to make it one.'} />
        <ul className="b-inv__notes">
          <li><b>A · One line:</b> the round, the pick and your distance joined: "Round 2 of 6 · Pick 11 · 3 picks until you". After your first pick it reads "… · you're up in 3 picks", and "You took NVDA" goes (your pick is on the board and in your team).</li>
          <li><b>B · The round moves above the name.</b> "Round 2 of 6 · Pick 11" becomes the card's small label, then "Sofia is up", then the one line about you: "3 picks until you", or after your first pick "You took NVDA · you're up in 3 picks" in your colour.</li>
          <li><b>Recommended: B.</b> Nothing is lost: your own pick still gets its moment, and the round reads like the other cards' labels. A is shorter but drops "You took NVDA".</li>
          <li><b>No new words.</b> Both only rearrange lines the room already shows.</li>
          <li><b>Answer with:</b> A or B.</li>
        </ul>
        <Grid>{[
          fig('tt', 'Today · Light · Large', <DraftRoom v="today" label="Draft room, someone else's turn, today" />, 'Two lines under the name.'),
          fig('ta', 'A · Light · Large', <DraftRoom v="A" label="Draft room, someone else's turn, option A" />, 'One joined line.'),
          fig('tb', 'B · Light · Large (recommended)', <DraftRoom v="B" label="Draft room, someone else's turn, option B" />, 'The round as the label; one line about you.'),
        ]}</Grid>
        <h3 className="b-sub">After your first pick, and B in Dark and at your size</h3>
        <Grid>{[
          fig('taa', 'A · after your pick · Light · Large', <DraftRoom v="A" after label="Draft room after your pick, option A" />, '"You took NVDA" is gone.'),
          fig('tba', 'B · after your pick · Light · Large', <DraftRoom v="B" after label="Draft room after your pick, option B" />, '"You took NVDA" stays, in your colour.'),
          fig('tbd', 'B · Dark · Large', <DraftRoom t="dark" v="B" after label="Draft room after your pick, option B, Dark" />),
          fig('tbx', 'B · Light · your size (AX5, approximate)', <DraftRoom v="B" after x={AX5} label="Draft room after your pick, option B, AX5" />, 'The ring sits above the text at your size, as it does today.'),
        ]}</Grid>
      </section>
    );
  }

  function CallBlockersCard() {
    return (
      <section className="b-sec" id="call-blockers-card" aria-labelledby="call-blockers-card-h">
        <Head id="call-blockers-card" code="League" title="Your call: the commissioner's “can't start yet” card" job={'When something blocks the draft, the commissioner sees "Needs you before 6:00 PM ET", "The draft can’t start yet", then: "Fix these before 6:00 PM ET, when the draft room opens. If they’re still open then, the draft is postponed." The first sentence repeats the label above it. The second is the one fact nowhere else: what happens if you don’t.'} />
        <ul className="b-inv__notes">
          <li><b>A · No line.</b> The label, the title, then what to fix. The countdown above already says when.</li>
          <li><b>B · Keep only the second sentence:</b> "If they're still open then, the draft is postponed." Cut, not rewritten.</li>
          <li><b>Recommended: B.</b> The card is the commissioner's one warning before the draft gets postponed; saying so in one line is worth it. A if you'd rather the deadline speak for itself.</li>
          <li><b>No new words</b> in either. The lines inside "Sofia F. left the league" are a separate card you've already ruled on (below four).</li>
          <li><b>Answer with:</b> A or B.</li>
        </ul>
        <Grid>{[
          fig('bkt', 'Today · Light · Large', <LeagueRisk v="today" label="League tab, commissioner, draft at risk, today" />, 'Two sentences under the title.'),
          fig('bka', 'A · Light · Large', <LeagueRisk v="A" label="League tab, commissioner, draft at risk, option A" />, 'No line.'),
          fig('bkb', 'B · Light · Large (recommended)', <LeagueRisk v="B" label="League tab, commissioner, draft at risk, option B" />, 'Only the consequence.'),
          fig('bkd', 'B · Dark · Large', <LeagueRisk t="dark" v="B" label="League tab, commissioner, draft at risk, option B, Dark" />),
          fig('bkx', 'B · Light · your size (AX5, approximate)', <LeagueRisk v="B" x={AX5} label="League tab, commissioner, draft at risk, option B, AX5" />),
        ]}</Grid>
      </section>
    );
  }

  function CallDeadLinks() {
    return (
      <section className="b-sec" id="call-dead-links" aria-labelledby="call-dead-links-h">
        <Head id="call-dead-links" code="Links" title="Your call: the dead password link and the “Nothing here” page" job={'Two dead ends the dead-end family didn’t cover: a password-reset link that no longer works, and a link that leads nowhere. Both have a long grey paragraph today. Both go into the form you signed off (a picture, the sentence as the heading, the way out at the bottom).'} />
        <ul className="b-inv__notes">
          <li><b>A · No line.</b> "This link didn't work." with "Request a new link" and "Back to sign in"; "Nothing here." with "Go to Home".</li>
          <li><b>B · One short line each.</b> Under the reset heading: "It may have been opened on a different device." <NEW /> (the most common reason by far, and the only one the person can do something about). Under "Nothing here.": "This link is old or incomplete." (today's first sentence).</li>
          <li><b>Recommended: B.</b> A dead reset link is usually the email opened on a laptop instead of the phone; one line saves a support message. The rest of today's paragraph goes in both.</li>
          <li><b>New words in B:</b> "It may have been opened on a different device." (a cut of today's sentence). A has none. The headings gain a full stop, as in the dead-end family.</li>
          <li><b>Answer with:</b> A or B.</li>
        </ul>
        <h3 className="b-sub">Today</h3>
        <Grid>{[
          fig('dlt', 'Dead reset link · today · Light · Large', <Dead today {...RESET_TODAY} label="Dead reset link, today" />),
          fig('nft', 'Nothing here · today · Light · Large', <Dead today {...NF_TODAY} label="Not found, today" />),
        ]}</Grid>
        <h3 className="b-sub">A · no line</h3>
        <Grid>{[
          fig('dla', 'Dead reset link · A · Light · Large', <Dead {...RESET} label="Dead reset link, option A" />),
          fig('nfa', 'Nothing here · A · Light · Large', <Dead {...NF} label="Not found, option A" />),
        ]}</Grid>
        <h3 className="b-sub">B · one short line (recommended)</h3>
        <Grid>{[
          fig('dlb', 'Dead reset link · B · Light · Large', <Dead {...RESET} line={RESET_B_LINE} label="Dead reset link, option B" />),
          fig('nfb', 'Nothing here · B · Light · Large', <Dead {...NF} line={NF_B_LINE} label="Not found, option B" />),
          fig('dlbd', 'Dead reset link · B · Dark · Large', <Dead t="dark" {...RESET} line={RESET_B_LINE} label="Dead reset link, option B, Dark" />),
          fig('dlbx', 'Dead reset link · B · Light · your size (AX5, approximate)', <Dead {...RESET} x={AX5} line={RESET_B_LINE} label="Dead reset link, option B, AX5" />),
        ]}</Grid>
      </section>
    );
  }

  window.KSDraftTurn = () => <CallDraftTurn />;
  window.KSBlockersCard = () => <CallBlockersCard />;
  window.KSDeadLinks = () => <CallDeadLinks />;
})();
