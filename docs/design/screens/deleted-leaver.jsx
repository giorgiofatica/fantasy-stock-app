// Stockpile key-screens board — two calls from phone pass step 25 (build 14), on the commissioner's
// "draft can't start yet" card in League C (hasn't drafted; draft Tue Nov 17).
// (a) Before the draft, deleting an account acts like leaving (PRODUCT_RULES, account deletion), so the card
//     gets a leaver line. Its name is the deleted seat's label: "Open team left the league", in a league with
//     no teams yet. The name must stay hidden. A: "A manager left the league" (the no-name clause the at-risk
//     push already uses). B: "A manager deleted their account".
// (b) "Needs you before 6:30 PM ET" / "Fix these before 6:30 PM ET, …" name no day, so with the draft six days
//     away they read as today. Plan #355 rules the zone, not the day (Planner, 2026-11-11). A: name the day when
//     it isn't today. B: always name it, today included. Shown for today, tomorrow and Tue Nov 17.
// At-risk state, 4 of 6 after one left; Large / Dark / AX5 (approximate). Times keep their no-break spaces
// (keepTime), as the app draws them.
(function () {
  const { Device } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, G, Av } = GN;

  const NB = ' ';
  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const TITLE = {
    today: 'Open team left the league',
    A: 'A manager left the league',
    B: 'A manager deleted their account',
    named: `Sofia${NB}F. left the league`,
  };
  const TIME = `6:30${NB}PM${NB}ET`;
  const DAY = { today: 'today', tomorrow: 'tomorrow', tue: `on Tue,${NB}Nov${NB}17` };
  /** dayMode: 'none' (build 14) | 'A' (the day unless it's today) | 'B' (always the day). */
  const at = (day = 'today', dayMode = 'none') =>
    dayMode === 'none' || (dayMode === 'A' && day === 'today') ? TIME : `${TIME} ${DAY[day]}`;

  const Btn = ({ children, kind = 'primary', x, dim }) => (
    <span className={kind === 'primary' ? 'dr-btn' : 'dr-btn dr-btn--line'} style={{ width: '100%', minHeight: Math.round(44 * k(x, 1.6)), height: 'auto', padding: '8px 16px', textAlign: 'center', ...fs(15, x, 1.6), fontWeight: 800, opacity: dim ? 0.45 : 1 }}>{children}</span>
  );
  const Sub = ({ children }) => (
    <div className="dr-card" style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>{children}</div>
  );
  const Title = ({ x, children }) => <span style={{ ...fs(15, x, 1.6), fontWeight: 800, color: 'var(--c-text)' }}>{children}</span>;

  /** who: a TITLE key. mode: choose (the two buttons) | inviting (after "Invite someone new"). */
  function Card({ who, x, mode = 'choose', day, dayMode }) {
    const when = at(day, dayMode);
    const leaver = mode === 'inviting' ? (
      <Sub>
        <Title x={x}>Invite someone to take their place</Title>
        <span className="dr-cap" style={{ ...fs(13, x, 1.6), color: 'var(--c-text)' }}>Share the code. When someone joins, the draft is ready to go.</span>
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="dr-cap" style={fs(12, x, 1.6)}>Invite code</span>
          <b className="dr-num" style={{ ...fs(22, x, 1.6), letterSpacing: '0.12em', color: 'var(--c-text)' }}>LGC26X</b>
        </div>
        <Btn x={x} kind="line">Share invite code</Btn>
        <Btn x={x} kind="line">Move forward with 4 instead</Btn>
      </Sub>
    ) : (
      <Sub>
        <Title x={x}>{TITLE[who]}</Title>
        <Btn x={x}>Move forward with 4</Btn>
        <Btn x={x} kind="line">Invite someone new</Btn>
      </Sub>
    );
    return (
      <div style={{ padding: 16, borderRadius: 20, background: 'var(--c-warn-tint)', boxShadow: 'inset 0 0 0 1px var(--c-warn-line)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <span className="dr-tag" style={{ ...fs(11, x, 1.4), color: 'var(--c-warn-text)' }}>Needs you before {when}</span>
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={{ ...fs(17, x, 1.6), fontWeight: 800, color: 'var(--c-text)' }}>The draft can’t start yet</span>
          <span className="dr-cap" style={{ ...fs(13, x, 1.6), color: 'var(--c-text)' }}>Fix these before {when}, when the draft room opens. If they’re still open then, the draft is postponed.</span>
        </div>
        {leaver}
      </div>
    );
  }

  const WHO = { today: 'as build 14 ships it', A: 'option A', B: 'option B', named: 'a named manager left' };
  const WHEN = { today: 'the draft is today', tomorrow: 'the draft is tomorrow', tue: 'the draft is Tue Nov 17' };
  function Frame({ t, who, x = 1, mode, day, dayMode }) {
    const what = dayMode ? `${WHEN[day]}, day ${dayMode === 'none' ? 'as build 14 ships it' : `option ${dayMode}`}` : (mode === 'inviting' ? 'after Invite someone new' : WHO[who]);
    const label = `League tab, draft lobby, commissioner, 4 of 6 managers after one left, ${what}, ${x > 1 ? 'your size (AX5, approximate)' : 'Large'}, ${t}`;
    return (
      <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>
        <Device tab="league" label={label}>
          <div className="ks-head" style={{ paddingInline: G }}>
            <span className="ks-pill"><span>League C</span></span>
            <Av init="GF" you size={34} />
          </div>
          <div style={{ padding: `0 ${G}px 24px` }}><Card who={who} x={x} mode={mode} day={day} dayMode={dayMode} /></div>
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
    fig(`${v}ll`, `${cap} · Large · Light`, <Frame t="light" who={v} />, note),
    fig(`${v}ld`, `${cap} · Large · Dark`, <Frame t="dark" who={v} />),
    fig(`${v}xl`, `${cap} · your size (AX5) · Light`, <Frame t="light" who={v} x={2.4} />, AX),
  ];
  // (b): one row per option, today / tomorrow / Tue Nov 17, at your size.
  const days = (m, cap, notes = {}) => ['today', 'tomorrow', 'tue'].map((d) =>
    fig(`b${m}${d}`, `${cap} · ${{ today: 'draft today', tomorrow: 'draft tomorrow', tue: 'draft Tue Nov 17 (your case)' }[d]} · AX5`, <Frame t="light" who="named" x={2.4} day={d} dayMode={m} />, notes[d]));

  function CallStep25({ archived }) {
    return (
      <section className="b-sec" id="call-deleted-leaver" aria-labelledby="call-deleted-leaver-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Draft</span>
          <div>
            <h2 id="call-deleted-leaver-h">{archived ? 'Decided: (a) A, "A manager left the league"; (b) B, the day always named' : 'Your calls: two lines on the "draft can\'t start yet" card'}</h2>
            <p className="b-job">Your phone pass, step 25: you deleted T1, a member of League C, which hasn't drafted (its draft is Tue Nov 17). As commissioner you got the "draft can't start yet" card, and two of its lines read wrong. Two questions, one answer each.</p>
          </div>
        </header>

        <h3 className="b-sub" id="call-deleted-leaver-a">Question (a): who left, when it was a deleted account</h3>
        <ul className="b-inv__notes">
          <li><b>Why you're being asked:</b> before the draft, deleting an account counts as leaving, so the card has a line saying who left. Its name is the deleted account's label, so it reads "Open team left the league". Before the draft there are no teams, and the account's name has to stay hidden, so the line needs words without a name.</li>
          <li><b>What you're looking at:</b> League C › the draft lobby, as commissioner, 4 of 6 managers. Only the bold line in the white card changes. "Move forward with 4" and "Invite someone new" stay as approved.</li>
          <li><b>A · "A manager left the league".</b> It's the same as any other manager leaving, which is your rule for deleting before the draft. The push you get already says it in nearly the same words: "A manager left League C. Confirm your roster before the draft." Same pattern as the approved "3 managers left the league".</li>
          <li><b>B · "A manager deleted their account".</b> It says why the seat is empty. But it tells you something a leave doesn't, and the push would still say "left".</li>
          <li><b>Recommended: A.</b> Deleting before the draft already works like leaving, so the card says the same thing as the push and as any other leave.</li>
          <li><b>Either way:</b> after "Invite someone new" the card reads "Invite someone to take their place" (approved 2026-11-10). If a named manager and a deleted one both leave, it reads "2 managers left the league", the approved counted form, so the deleted name never shows.</li>
        </ul>
        <h3 className="b-sub">(a) Today, as build 14 ships it</h3>
        <Grid>{three('today', 'Today', '"Open team" is the label for a deleted manager\'s team. Before the draft there is no team.')}</Grid>
        <h3 className="b-sub">(a) A · "A manager left the league" (recommended, NEW)</h3>
        <Grid>{three('A', 'A')}</Grid>
        <h3 className="b-sub">(a) B · "A manager deleted their account" (NEW)</h3>
        <Grid>{three('B', 'B')}</Grid>
        <h3 className="b-sub">(a) Either way, after "Invite someone new"</h3>
        <Grid>{[fig('inv', 'After "Invite someone new" · Large · Light', <Frame t="light" who="A" mode="inviting" />, 'The approved inviting state, unchanged: no name in it.')]}</Grid>

        <h3 className="b-sub" id="call-deleted-leaver-b">Question (b): the deadline, when the draft isn't today</h3>
        <ul className="b-inv__notes">
          <li><b>Why you're being asked:</b> the card's top line and the sentence under its title say "before 6:30 PM ET" with no day. League C drafts Tuesday, six days away, so it read as tonight. Your local-time plan (#355) decides which time zone a time is shown in; it doesn't say a deadline must carry its day.</li>
          <li><b>What you're looking at:</b> the same card at your size, three times per option: the draft today, tomorrow, and Tue Nov 17 (your case). Only the words after "before" change, in both places. The leaver line here is a named manager ("Sofia F."), so it doesn't depend on your answer to (a).</li>
          <li><b>A · name the day when it isn't today.</b> Today stays "before 6:30 PM ET"; tomorrow is "before 6:30 PM ET tomorrow"; further out, "before 6:30 PM ET on Tue, Nov 17". With no day, it means today, which is how you read it.</li>
          <li><b>B · always name the day, today included.</b> "before 6:30 PM ET today", "… tomorrow", "… on Tue, Nov 17". Nothing is left to infer, but every card is a word longer, and the top line is the one that wraps at your size.</li>
          <li><b>Recommended: A.</b> It fixes the case that misled you and leaves the most common one, the day of the draft, as short as it is now.</li>
          <li><b>Either way:</b> the day words are the app's own ("tomorrow", "Tue, Nov 17"), they follow your phone's date once the local-time plan lands, and a time never splits across lines ("6:30 PM ET" stays together).</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-11): (a) A, (b) B</b> ("A, manager left the league. include today when day of"). (b) went against the recommended A: the deadline names its day today too, "before 6:30 PM ET today". Recorded in PRODUCT_RULES ("A deleted account that leaves before the draft is 'A manager'"; "A draft deadline always names its day") and plan #355.</li> : <li><b>Answer with:</b> (a) A or B, and (b) A or B. All the new words are marked <b>NEW</b>.</li>}
        </ul>
        <h3 className="b-sub">(b) Today, as build 14 ships it</h3>
        <Grid>{days('none', 'Today', { tue: 'Your step-25 screen: six days away, and it reads as tonight.' })}</Grid>
        <h3 className="b-sub">(b) A · the day when it isn't today (recommended, NEW)</h3>
        <Grid>{days('A', 'A', { today: 'Unchanged on the day of the draft.' })}</Grid>
        <h3 className="b-sub">(b) B · always the day (NEW)</h3>
        <Grid>{days('B', 'B')}</Grid>
        <p className="b-annot" style={{ marginTop: 8 }}>{AX}</p>
      </section>
    );
  }

  window.KSDeletedLeaver = () => null; // decided 2026-11-11: (a) A, (b) B; it lives in the Archive
  window.KSDeletedLeaverArchived = () => <CallStep25 archived />;
})();
