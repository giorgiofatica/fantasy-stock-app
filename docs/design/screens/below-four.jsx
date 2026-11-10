// Stockpile key-screens board — "Your call: when a league drops below 4" (phone pass step 23, build 12).
// Two managers left a 4-team league before its draft, so it is at 2 of 4. The blockers card offers
// "Move forward with 2", but a league needs at least 4 managers to draft (PRODUCT_RULES, League size),
// so that button can only be refused. A: below 4, the leaver card keeps only "Invite someone new".
// B: below 4, the leaver card and "Fewer than 4 teams have joined" become one card with the invite code.
// Postponed state (as in Giorgio's step-23 screen), Large and AX5 (approximate), both themes.
(function () {
  const { Device } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, G, Av } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const LEFT = 'Gianluigi B. and Paolo M. left the league';
  const CODE = 'SCUD26';

  const Btn = ({ children, kind = 'primary', x, dim }) => (
    <span className={kind === 'primary' ? 'dr-btn' : 'dr-btn dr-btn--line'} style={{ width: '100%', minHeight: Math.round(44 * k(x, 1.6)), height: 'auto', padding: '8px 16px', textAlign: 'center', ...fs(15, x, 1.6), fontWeight: 800, opacity: dim ? 0.45 : 1 }}>{children}</span>
  );
  const Sub = ({ children }) => (
    <div className="dr-card" style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>{children}</div>
  );
  const Title = ({ x, children }) => <span style={{ ...fs(15, x, 1.6), fontWeight: 800, color: 'var(--c-text)' }}>{children}</span>;
  const Code = ({ x }) => (
    <div style={{ display: 'grid', gap: 4 }}>
      <span className="dr-cap" style={fs(12, x, 1.6)}>Invite code</span>
      <b className="dr-num" style={{ ...fs(22, x, 1.6), letterSpacing: '0.12em', color: 'var(--c-text)' }}>{CODE}</b>
    </div>
  );

  /** v: today | A | B | Ainv (A after "Invite someone new"). */
  function Card({ v, x }) {
    const leaver = {
      today: (
        <Sub key="l">
          <Title x={x}>{LEFT}</Title>
          <Btn x={x}>Move forward with 2</Btn>
          <Btn x={x} kind="line">Invite someone new</Btn>
        </Sub>
      ),
      A: (
        <Sub key="l">
          <Title x={x}>{LEFT}</Title>
          <Btn x={x} kind="line">Invite someone new</Btn>
        </Sub>
      ),
      Ainv: (
        <Sub key="l">
          <Title x={x}>Invite someone to take their place</Title>
          <span className="dr-cap" style={{ ...fs(13, x), color: 'var(--c-text)' }}>Share the code. When someone joins, the draft is ready to go.</span>
          <Code x={x} />
          <Btn x={x} kind="line">Share invite code</Btn>
        </Sub>
      ),
      B: (
        <Sub key="l">
          <Title x={x}>{LEFT}</Title>
          <span className="dr-cap" style={{ ...fs(13, x, 1.6), color: 'var(--c-text)' }}>Fewer than 4 teams have joined.</span>
          <Code x={x} />
          <Btn x={x} kind="line">Share invite code</Btn>
        </Sub>
      ),
    }[v];
    const fewer = v === 'B' ? null : (
      <Sub key="f">
        <Title x={x}>Fewer than 4 teams have joined</Title>
        <Code x={x} />
        <Btn x={x} kind="line">Share invite code</Btn>
      </Sub>
    );
    return (
      <div style={{ padding: 16, borderRadius: 20, background: 'var(--c-warn-tint)', boxShadow: 'inset 0 0 0 1px var(--c-warn-line)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <span className="dr-tag" style={{ ...fs(11, x, 1.4), color: 'var(--c-warn-text)' }}>Postponed</span>
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={{ ...fs(17, x, 1.6), fontWeight: 800, color: 'var(--c-text)' }}>The draft is postponed</span>
          <span className="dr-cap" style={{ ...fs(13, x, 1.6), color: 'var(--c-text)' }}>The league wasn’t ready at 6:00 PM ET. Fix these, then pick a new draft time.</span>
        </div>
        {leaver}
        {fewer}
        <Btn x={x} dim>Pick a new draft time</Btn>
        <span className="dr-cap" style={{ ...fs(13, x), color: 'var(--c-text)', textAlign: 'center' }}>Fix these first. The new time needs at least an hour's notice.</span>
      </div>
    );
  }

  function Frame({ t, v, x = 1 }) {
    const label = `League tab, draft lobby, commissioner, 2 of 4 managers after two left, postponed, ${{ today: 'as build 12 ships it', A: 'option A', Ainv: 'option A after Invite someone new', B: 'option B' }[v]}, ${x > 1 ? 'your size (AX5, approximate)' : 'Large'}, ${t}`;
    return (
      <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>
        <Device tab="league" label={label}>
          <div className="ks-head" style={{ paddingInline: G }}>
            <span className="ks-pill"><span>Stock Scudetto</span></span>
            <Av init="RB" you size={34} />
          </div>
          <div style={{ padding: `0 ${G}px 24px` }}><Card v={v} x={x} /></div>
        </Device>
      </div>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const AX = 'An approximation of your text size. The build gate checks the real thing.';
  const four = (v, cap, notes = {}) => [
    fig(`${v}ll`, `${cap} · Large · Light`, <Frame t="light" v={v} />, notes.l),
    fig(`${v}ld`, `${cap} · Large · Dark`, <Frame t="dark" v={v} />),
    fig(`${v}xl`, `${cap} · your size (AX5) · Light`, <Frame t="light" v={v} x={2.4} />, notes.x || AX),
  ];

  function CallBelowFour({ archived }) {
    return (
      <section className="b-sec" id="call-below-four" aria-labelledby="call-below-four-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Draft</span>
          <div>
            <h2 id="call-below-four-h">{archived ? 'Decided: B, one card below 4' : 'Your call: when a league drops below 4'}</h2>
            <p className="b-job">Your phone pass, step 23: two managers left Stock Scudetto before its draft, so it has 2 of 4. Your rule for someone leaving is that the commissioner chooses "move forward with 1 less" or "invite someone new to replace". But a league needs at least 4 managers to draft, so "Move forward with 2" can never work: tapping it is refused ("Lower the playoff teams first"), and there is nowhere to lower them. With 4 or more managers nothing changes in either option.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          {archived ? <li><b>Decided by Giorgio (2026-11-10): B.</b> Below 4, one card: who left, "Fewer than 4 teams have joined.", the invite code and Share; no "Move forward". At 4 or more, unchanged. "Invite someone to take their place" approved the same day ("sentence is fine"). Rules: PRODUCT_RULES, "Below 4, there is nothing to move forward with".</li> : null}
          <li><b>Today:</b> two cards. "Gianluigi B. and Paolo M. left the league" with "Move forward with 2" (which can't work) and "Invite someone new"; then "Fewer than 4 teams have joined" with the invite code and Share. Two cards ask for the same thing, and one of their buttons does nothing.</li>
          <li><b>A · Keep the leaver card, without "Move forward".</b> Below 4 it offers only "Invite someone new"; tapping it shows the code and Share, without "Move forward with 2 instead". The "Fewer than 4" card stays. <b>Cost: small.</b> No new words.</li>
          <li><b>B · One card below 4.</b> Who left, then "Fewer than 4 teams have joined.", the invite code and Share invite code. No "Move forward", no "Invite someone new" step: sharing the code is inviting someone new. <b>Cost: small.</b> No new words (the line is the existing card's title).</li>
          <li><b>Recommended: B.</b> Below 4 there is only one way forward, getting more managers in, so the screen asks for it once, with the code right there. A still shows two cards and two invite buttons for one job.</li>
          <li><b>Both:</b> at 4 or more managers, the leaver card keeps "Move forward with N" and "Invite someone new" exactly as approved (board #call-leave), and the playoff-teams card with its stepper still appears when the playoff teams outnumber the managers.</li>
        </ul>
        <h3 className="b-sub">Today, as build 12 ships it (2 of 4)</h3>
        <Grid>{four('today', 'Today', { l: '"Move forward with 2" can only be refused: a league needs 4 to draft.' })}</Grid>
        <h3 className="b-sub">A · The leaver card keeps only "Invite someone new"</h3>
        <Grid>{[...four('A', 'A'), fig('Ainv', 'A · after "Invite someone new" · Large · Light', <Frame t="light" v="Ainv" />, 'The approved inviting state, without "Move forward with 2 instead".')]}</Grid>
        <h3 className="b-sub">B · One card below 4 (recommended)</h3>
        <Grid>{four('B', 'B', { l: 'Who left, why the draft can\'t start, and the code to fix it, in one card.' })}</Grid>
      </section>
    );
  }

  // Decided 2026-11-10 (B); the call lives in the Archive (board.jsx).
  window.KSBelowFour = () => null;
  window.KSBelowFourArchived = () => <CallBelowFour archived />;
})();
