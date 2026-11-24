// Stockpile key-screens board — "Your call: what went through, the way ESPN shows it" (2026-11-23).
// His ruling (docs/PRODUCT_RULES.md, 2026-11-23, plan docs/plans/2026-11-18-stocks-tab.md point 11): "we dont need
// to notify or have messages for claims that didnt go through. here is the espn league activity and waiver report
// screens." A manager sees only what went through, the way ESPN shows it: a Waiver Report (a day picker, one card per
// manager in the order they were served, "Priority: 1st", Added/Dropped) and Recent Activity (every add and drop, with
// its time). Stockpile has neither screen; a `league_activity` view (20261005000000) exists and nothing reads it.
// His screenshots are third-party UI and stay in local/design-review/references, never in the repo.
// Data: Tier Cup, a price-tier league ($100–$200 slot), Roberto B.'s phone, Monday 10:15 AM ET. This morning's run
// filled three claims; Elena V. (2nd in the order) got nothing, so she appears nowhere. Review notes sit UNDER the phones.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap = 1.3, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const STORE = 'M4.5 4h15l1.5 5H3z M3 9c0 1.5 1.1 2.5 2.5 2.5S8 10.5 8 9c0 1.5 1.1 2.5 2.5 2.5S13 10.5 13 9c0 1.5 1.1 2.5 2.5 2.5S18 10.5 18 9c0 1.5 1.1 2.5 2.5 2.5 M5 11.5V20h14v-8.5 M10 20v-5h4v5';
  const REPORT = 'M8 4h8v3H8z M6 5.5H5v15h14v-15h-1 M8.5 12h7 M8.5 16h5';
  const MINUS = 'M5 12h14';
  const NW = ({ children }) => <span style={{ whiteSpace: 'nowrap' }}>{children}</span>;

  // Who: you are Roberto B. Your name and your initials take your colour (blue), as everywhere else.
  const ME = 'Roberto B.';
  const ini = (n) => n.split(' ').map((w) => w[0]).join('').replace('.', '');

  // This morning's run, in the order the managers were served (their place in the waiver order at the run).
  const RUN = [
    { who: 'Paolo M.', place: '1st', buy: ['AMD', '$152.30'], sell: ['QCOM', '$158.40'] },
    { who: ME, place: '3rd', buy: ['AMGN', '$187.20'], sell: ['DIS', '$112.40'] },
    { who: 'Sofia R.', place: '4th', buy: ['ABNB', '$131.55'], sell: ['TGT', '$142.10'] },
  ];
  // Buys and sells made while the market was open. A buy and a sale in the same minute share a card.
  const TODAY_LATER = [{ who: 'Gianluigi B.', time: '10:02 AM ET', buy: ['TGT', '$142.10'], sell: ['UPS', '$131.75'] }];
  const FRIDAY = [{ who: 'Elena V.', time: '3:48 PM ET', sell: ['NKE', '$104.80'] }, { who: 'Marco T.', time: '11:20 AM ET', buy: ['ORCL', '$168.00'] }];

  function OS() {
    return <div className="ks-os"><span>10:15</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;
  }
  function TabBar() {
    const tab = (d, l, on) => <span key={l} style={{ display: 'grid', justifyItems: 'center', gap: 2, color: on ? 'var(--c-accent)' : 'var(--c-text-2)', fontSize: 10, fontWeight: 600 }}><Icon d={d} size={22} width={2} />{l}</span>;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', paddingTop: 8, zIndex: 3 }}>
        {tab(ICON.home, 'Home')}{tab(ICON.matchup, 'Matchup')}{tab(ICON.league, 'League', true)}{tab(ICON.portfolio, 'Portfolio')}{tab(STORE, 'Stocks')}
      </div>
    );
  }
  /** League tab: the pill, the text tabs (Activity selected), then the content. */
  function League({ t = 'light', x = 1, label, children }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 78, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 10px', flexShrink: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', ...fs(16, x), fontWeight: 600, color: 'var(--c-text)' }}>Tier Cup<Icon d={ICON.chevron} size={13} width={2.4} /></span>
              <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-you)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>RB</span>
            </div>
            {/* SegmentTabs: wider than the screen, the row scrolls sideways (as four tabs already do at XL). */}
            <div style={{ display: 'flex', gap: 22, padding: '0 2px', marginBottom: 12, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {['Standings', 'Schedule', 'Activity', 'History'].map((l) => (
                <span key={l} style={{ ...fs(15, x), fontWeight: l === 'Activity' ? 800 : 700, color: l === 'Activity' ? 'var(--c-text)' : 'var(--c-text-2)', paddingBottom: 6, position: 'relative', flexShrink: 0 }}>
                  {l}{l === 'Activity' ? <span style={{ position: 'absolute', left: '50%', bottom: 0, width: 18, height: 3, marginLeft: -9, borderRadius: 2, background: 'var(--c-accent)' }} /> : null}
                </span>
              ))}
            </div>
            {children}
          </div>
          <TabBar />
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }
  /** A pushed screen (A's Claims report): back to League, the title, no tab bar. */
  function Pushed({ t = 'light', x = 1, label, title, children }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', padding: '0 16px 30px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '8px 0 12px', flexShrink: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--c-accent)', ...fs(16, x), fontWeight: 600 }}><Icon d={ICON.left} size={18} width={2.4} />League</span>
              <b style={{ ...fs(17, x), color: 'var(--c-text)', whiteSpace: 'nowrap' }}>{title}</b>
              <span />
            </div>
            {children}
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  const Label = ({ x, children }) => <span style={{ ...fs(11, x), fontWeight: 800, letterSpacing: 1, color: 'var(--c-text-2)', margin: '2px 0 6px', flexShrink: 0 }}>{children}</span>;
  function Who({ x, who, right }) {
    const me = who === ME;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ width: 24, height: 24, flex: '0 0 24px', borderRadius: 12, background: me ? 'var(--c-you)' : 'var(--c-inset)', color: me ? '#fff' : 'var(--c-text)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>{ini(who)}</span>
        <b style={{ flex: 1, minWidth: 0, ...fs(15, x), color: me ? 'var(--c-you)' : 'var(--c-text)' }}>{who}</b>
        {right ? <span style={{ ...fs(13, x), color: 'var(--c-text-2)', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 'auto' }}>{right}</span> : null}
      </div>
    );
  }
  /** One line: + Bought AMGN … $187.20, or − Sold DIS … $112.40. The "+" is the Stocks tab's buy teal. */
  function Line({ x, kind, sym, price }) {
    const buy = kind === 'buy';
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 2 }}>
        <span style={{ alignSelf: 'center', color: buy ? 'var(--c-accent)' : 'var(--c-text-2)', display: 'grid', width: 20, flex: '0 0 20px', placeItems: 'center' }}><Icon d={buy ? ICON.plus : MINUS} size={16} width={2.8} /></span>
        <span style={{ ...fs(15, x), color: 'var(--c-text-2)' }}>{buy ? 'Bought' : 'Sold'}</span>
        <b style={{ ...fs(15, x), color: 'var(--c-text)' }}>{sym}</b>
        <span className="dr-num" style={{ marginLeft: 'auto', ...fs(14, x), color: 'var(--c-text-2)' }}>{price}</span>
      </div>
    );
  }
  const Card = ({ children, tone }) => (
    <div style={{ display: 'grid', gap: 8, padding: '11px 12px', borderRadius: 12, background: tone || 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-rim)', marginBottom: 8, flexShrink: 0 }}>{children}</div>
  );
  const Lines = ({ x, e }) => <>{e.buy ? <Line x={x} kind="buy" sym={e.buy[0]} price={e.buy[1]} /> : null}{e.sell ? <Line x={x} kind="sell" sym={e.sell[0]} price={e.sell[1]} /> : null}</>;
  const Entry = ({ x, e }) => <Card><Who x={x} who={e.who} right={e.time} /><Lines x={x} e={e} /></Card>;

  /** A · the Claims report row at the top of Activity (ESPN's "Waiver Report" row). */
  function ReportRow({ x }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-rim)', marginBottom: 14, flexShrink: 0 }}>
        <span style={{ color: 'var(--c-text)', display: 'grid' }}><Icon d={REPORT} size={20} width={2} /></span>
        <b style={{ flex: 1, ...fs(16, x), color: 'var(--c-text)' }}>Claims report</b>
        <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.right} size={14} width={2.4} /></span>
      </div>
    );
  }

  /** A · Activity: the report row, then every buy and sell, newest first, under its day. */
  function ActivityA({ t, x = 1, label }) {
    const runNewestFirst = [...RUN].reverse().map((r) => ({ ...r, time: '9:30 AM ET' }));
    return (
      <League t={t} x={x} label={label}>
        <ReportRow x={x} />
        <Label x={x}>MON, NOV 23</Label>
        {[...TODAY_LATER, ...runNewestFirst].map((e, i) => <Entry key={i} x={x} e={e} />)}
        <Label x={x}>FRI, NOV 20</Label>
        {FRIDAY.map((e, i) => <Entry key={i} x={x} e={e} />)}
      </League>
    );
  }
  /** A · the Claims report: a day picker, one card per manager in the order served. */
  function ReportA({ t, x = 1, label }) {
    return (
      <Pushed t={t} x={x} label={label} title="Claims report">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, flexShrink: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--c-accent)', ...fs(15, x), fontWeight: 700 }}><NW>Mon, Nov 23</NW><span style={{ display: 'grid', transform: 'rotate(90deg)' }}><Icon d={ICON.right} size={13} width={2.6} /></span></span>
        </div>
        {RUN.map((r) => <Card key={r.who}><Who x={x} who={r.who} right={`Priority: ${r.place}`} /><Lines x={x} e={r} /></Card>)}
      </Pushed>
    );
  }
  /** B · one list: the run is one card in Activity, at its time; no report screen, no day picker. */
  function ActivityB({ t, x = 1, label }) {
    return (
      <League t={t} x={x} label={label}>
        <Label x={x}>MON, NOV 23</Label>
        {TODAY_LATER.map((e, i) => <Entry key={i} x={x} e={e} />)}
        <Card>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ flex: 1, ...fs(15, x), color: 'var(--c-text)' }}>Claims</b>
            <span style={{ ...fs(13, x), color: 'var(--c-text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>9:30 AM ET</span>
          </div>
          {RUN.map((r, i) => (
            <div key={r.who} style={{ display: 'grid', gap: 6, paddingTop: 8, borderTop: '1px solid var(--c-border)' }}>
              <Who x={x} who={r.who} right={`Priority: ${r.place}`} />
              <Lines x={x} e={r} />
            </div>
          ))}
        </Card>
        <Label x={x}>FRI, NOV 20</Label>
        {FRIDAY.map((e, i) => <Entry key={i} x={x} e={e} />)}
      </League>
    );
  }
  /** Both · Activity before anyone has bought or sold since the draft. */
  function Empty({ t, x = 1, label }) {
    return (
      <League t={t} x={x} label={label}>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', paddingBottom: 60 }}>
          <span style={{ ...fs(15, x), color: 'var(--c-text-2)', textAlign: 'center' }}>No buys or sells yet.</span>
        </div>
      </League>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const Sub = ({ children }) => <h3 className="b-sub">{children}</h3>;

  const NEW_WORDS = [
    ['Activity', 'the new tab on League, between Schedule and History'],
    ['Bought, Sold', 'each line, before the ticker (ESPN’s Added and Dropped)'],
    ['Priority: 1st', 'beside each manager who was served (ESPN’s words; “waiver order” stays on the Claims tab)'],
    ['Claims report', 'A only: the row at the top of Activity and its screen’s title (ESPN’s “Waiver Report”)'],
    ['Claims', 'B only: the heading of the run’s card in the list'],
    ['No buys or sells yet.', 'Activity before anyone has bought or sold since the draft'],
  ];

  function CallLeagueActivity({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-league-activity" aria-labelledby="call-league-activity-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">League</span>
          <div>
            <h2 id="call-league-activity-h">{archived ? 'Decided: what went through, the way ESPN shows it' : 'Your call: what went through, the way ESPN shows it'}</h2>
            <p className="b-job">Your ESPN screens, in Stockpile: a new Activity tab on League with every buy and sell, and each morning’s claims in the order managers were served. A claim that didn’t go through shows nowhere.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Where:</b> League gets a fourth text tab, <b>Activity</b> (Standings, Schedule, Activity, History; Playoffs joins them in the playoffs). It’s league-wide, like Standings: everyone in the league sees the same list.</li>
          <li><b>A · ESPN’s two screens.</b> Activity lists every buy and sell, newest first, under its day. Its top row, <b>Claims report</b>, opens a screen with a day picker and one card per manager in the order served, “Priority: 1st”.</li>
          <li><b>B · one list.</b> No report screen and no day picker: each morning’s claims are one card in Activity at 9:30, the managers inside it in the order served.</li>
          <li><b>Recommended: A.</b> It’s the two screens you sent, and each list stays short: Activity is one card per move, and a morning with many claims doesn’t push the day’s buys and sells off the screen. B saves a screen, but at your text size one morning’s card fills the phone.</li>
          <li><b>What shows nowhere:</b> a claim that didn’t go through (yours included), pending claims, and draft picks (the draft has its own recap). A missing place, like 2nd here, gives nothing away: everyone has a place in the order, claim or not.</li>
          <li><b>New words, for your yes</b> (strike any you don’t want):
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {NEW_WORDS.map(([w, where]) => <li key={w}><b>{w}</b> · {where}</li>)}
            </ul>
          </li>
          <li><b>Already approved, reused:</b> the day and time forms (“Mon, Nov 23”, “9:30 AM ET”), Standings, Schedule, History.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B, and yes to the words (or the ones to change).</>}</li>
        </ul>

        <Sub>1 · A, ESPN’s two screens</Sub>
        <Grid>{[
          fig('a1', 'A · Activity', <ActivityA label="League, Activity: the Claims report row, then buys and sells under Mon, Nov 23" />, 'This morning’s three claims appear at 9:30, newest first, like any buy. Gianluigi B. bought the TGT that Sofia R. sold at the open.'),
          fig('a2', 'A · Claims report', <ReportA label="Claims report for Mon, Nov 23: Paolo M. 1st, Roberto B. 3rd, Sofia R. 4th" />, 'The day picker lists only days when a claim went through, so it is never empty. Your name is in your colour, as everywhere.'),
          fig('a3', 'A · Activity, your text size', <ActivityA x={AX5} label="Activity at the largest text size" />, 'Four tabs are wider than the screen here, so the row scrolls sideways, as League’s four tabs already do at XL.'),
          fig('a4', 'A · Claims report, your text size', <ReportA x={AX5} label="Claims report at the largest text size" />, 'Every line still fits on one row; the prices stay at the right.'),
          fig('a5', 'A · Activity, Dark', <ActivityA t="dark" label="Activity, Dark" />),
          fig('a6', 'A · Claims report, Dark', <ReportA t="dark" label="Claims report, Dark" />),
        ]}</Grid>

        <Sub>2 · B, one list</Sub>
        <Grid>{[
          fig('b1', 'B · Activity', <ActivityB label="League, Activity: this morning's claims as one card at 9:30" />, 'The run is one card at its time; earlier runs are further down the list.'),
          fig('b2', 'B · your text size', <ActivityB x={AX5} label="Activity with the claims card, largest text size" />, 'One morning’s card fills the phone.'),
          fig('b3', 'B · Dark', <ActivityB t="dark" label="Activity with the claims card, Dark" />),
        ]}</Grid>

        <Sub>3 · Both, before anyone has bought or sold</Sub>
        <Grid>{[
          fig('e1', 'Activity, nothing yet', <Empty label="Activity with nothing yet" />, 'In A the Claims report row stays hidden until the first claim goes through.'),
        ]}</Grid>
      </section>
    );
  }

  window.KSLeagueActivity = () => null;
  window.KSLeagueActivityArchived = () => <CallLeagueActivity archived decidedNote={<><b>Decided 2026-11-23, in his words:</b> “A, and yes to the words”. ESPN’s two screens: League’s Activity tab (every buy and sell, newest first, under its day) with the Claims report row, opening a day picker and one card per manager in the order served. Approved words: Activity; Bought, Sold; “Priority: 1st”; Claims report; “No buys or sells yet.” B’s “Claims” heading is not used.</>} />;
})();
