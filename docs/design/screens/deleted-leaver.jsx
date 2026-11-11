// Stockpile key-screens board — "Your call: what the card says when a deleted account leaves before the draft"
// (phone pass step 25, build 14). Before the draft, deleting an account acts like leaving (PRODUCT_RULES,
// account deletion), so the commissioner's blockers card gets a leaver line. Its name is the deleted seat's
// label, so the card reads "Open team left the league" in a league that has no teams yet. The name must stay
// hidden. A: "A manager left the league" (the no-name clause the at-risk push already uses). B: "A manager
// deleted their account". At-risk state as on the phone, 5 of 6 after one left, Large / Dark / AX5 (approximate).
(function () {
  const { Device } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, G, Av } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const TITLE = {
    today: 'Open team left the league',
    A: 'A manager left the league',
    B: 'A manager deleted their account',
  };
  const AT = '6:30 PM ET';

  const Btn = ({ children, kind = 'primary', x, dim }) => (
    <span className={kind === 'primary' ? 'dr-btn' : 'dr-btn dr-btn--line'} style={{ width: '100%', minHeight: Math.round(44 * k(x, 1.6)), height: 'auto', padding: '8px 16px', textAlign: 'center', ...fs(15, x, 1.6), fontWeight: 800, opacity: dim ? 0.45 : 1 }}>{children}</span>
  );
  const Sub = ({ children }) => (
    <div className="dr-card" style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>{children}</div>
  );
  const Title = ({ x, children }) => <span style={{ ...fs(15, x, 1.6), fontWeight: 800, color: 'var(--c-text)' }}>{children}</span>;

  /** v: today | A | B. mode: choose (the two buttons) | inviting (after "Invite someone new"). */
  function Card({ v, x, mode = 'choose' }) {
    const leaver = mode === 'inviting' ? (
      <Sub>
        <Title x={x}>Invite someone to take their place</Title>
        <span className="dr-cap" style={{ ...fs(13, x, 1.6), color: 'var(--c-text)' }}>Share the code. When someone joins, the draft is ready to go.</span>
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="dr-cap" style={fs(12, x, 1.6)}>Invite code</span>
          <b className="dr-num" style={{ ...fs(22, x, 1.6), letterSpacing: '0.12em', color: 'var(--c-text)' }}>LGC26X</b>
        </div>
        <Btn x={x} kind="line">Share invite code</Btn>
        <Btn x={x} kind="line">Move forward with 5 instead</Btn>
      </Sub>
    ) : (
      <Sub>
        <Title x={x}>{TITLE[v]}</Title>
        <Btn x={x}>Move forward with 5</Btn>
        <Btn x={x} kind="line">Invite someone new</Btn>
      </Sub>
    );
    return (
      <div style={{ padding: 16, borderRadius: 20, background: 'var(--c-warn-tint)', boxShadow: 'inset 0 0 0 1px var(--c-warn-line)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <span className="dr-tag" style={{ ...fs(11, x, 1.4), color: 'var(--c-warn-text)' }}>Needs you before {AT}</span>
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={{ ...fs(17, x, 1.6), fontWeight: 800, color: 'var(--c-text)' }}>The draft can’t start yet</span>
          <span className="dr-cap" style={{ ...fs(13, x, 1.6), color: 'var(--c-text)' }}>Fix these before {AT}, when the draft room opens. If they’re still open then, the draft is postponed.</span>
        </div>
        {leaver}
      </div>
    );
  }

  const NAME = { today: 'as build 14 ships it', A: 'option A', B: 'option B' };
  function Frame({ t, v, x = 1, mode }) {
    const label = `League tab, draft lobby, commissioner, 5 of 6 managers after a deleted account left, ${mode === 'inviting' ? 'after Invite someone new' : NAME[v]}, ${x > 1 ? 'your size (AX5, approximate)' : 'Large'}, ${t}`;
    return (
      <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>
        <Device tab="league" label={label}>
          <div className="ks-head" style={{ paddingInline: G }}>
            <span className="ks-pill"><span>League C</span></span>
            <Av init="GF" you size={34} />
          </div>
          <div style={{ padding: `0 ${G}px 24px` }}><Card v={v} x={x} mode={mode} /></div>
        </Device>
      </div>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const AX = 'An approximation of your text size. The build gate checks the real thing.';
  const three = (v, cap, note) => [
    fig(`${v}ll`, `${cap} · Large · Light`, <Frame t="light" v={v} />, note),
    fig(`${v}ld`, `${cap} · Large · Dark`, <Frame t="dark" v={v} />),
    fig(`${v}xl`, `${cap} · your size (AX5) · Light`, <Frame t="light" v={v} x={2.4} />, AX),
  ];

  function CallDeletedLeaver({ archived }) {
    return (
      <section className="b-sec" id="call-deleted-leaver" aria-labelledby="call-deleted-leaver-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Draft</span>
          <div>
            <h2 id="call-deleted-leaver-h">{archived ? 'Decided' : 'Your call: the card when a deleted account leaves before the draft'}</h2>
            <p className="b-job">Your phone pass, step 25: you deleted T1, a member of League C, which hasn't drafted. Before the draft, deleting an account counts as leaving, so as commissioner you get the "draft can't start yet" card with a line saying who left. Its name is the deleted account's label, so it reads "Open team left the league", but before the draft there are no teams. The account's name has to stay hidden, so the line needs words without a name.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>What you're looking at:</b> League C › the draft lobby, as commissioner, 5 of 6 managers after T1's account was deleted. Only the bold line in the white card changes. The buttons, "Move forward with 5" and "Invite someone new", stay as approved.</li>
          <li><b>A · "A manager left the league".</b> It's the same as any other manager leaving, which is your rule for deleting before the draft. The push you get already says it in nearly the same words: "A manager left League C. Confirm your roster before the draft." Same pattern as the approved "3 managers left the league".</li>
          <li><b>B · "A manager deleted their account".</b> It says why the seat is empty. But it tells you something a leave doesn't, and the push would still say "left".</li>
          <li><b>Recommended: A.</b> Deleting before the draft already works like leaving, so the card says the same thing as the push and as any other leave.</li>
          <li><b>Either way:</b> after "Invite someone new" the card reads "Invite someone to take their place" (approved 2026-11-10). If a named manager and a deleted one both leave, it reads "2 managers left the league", the approved counted form, so the deleted name never shows.</li>
          <li><b>Not part of this call:</b> "Needs you before 6:30 PM ET" doesn't say which day (the draft is Tuesday). That's a separate question, and the Planner is checking whether your time-zone plan already covers it.</li>
          <li><b>Answer with:</b> A or B. Both lines are new to the app's screens, marked <b>NEW</b>.</li>
        </ul>
        <h3 className="b-sub">Today, as build 14 ships it</h3>
        <Grid>{three('today', 'Today', '"Open team" is the label for a deleted manager\'s team. Before the draft there is no team.')}</Grid>
        <h3 className="b-sub">A · "A manager left the league" (recommended, NEW)</h3>
        <Grid>{three('A', 'A')}</Grid>
        <h3 className="b-sub">B · "A manager deleted their account" (NEW)</h3>
        <Grid>{three('B', 'B')}</Grid>
        <h3 className="b-sub">Either way, after "Invite someone new"</h3>
        <Grid>{[fig('inv', 'After "Invite someone new" · Large · Light', <Frame t="light" v="A" mode="inviting" />, 'The approved inviting state, unchanged: no name in it.')]}</Grid>
      </section>
    );
  }

  window.KSDeletedLeaver = () => <CallDeletedLeaver />;
})();
