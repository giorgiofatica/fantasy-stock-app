// Stockpile key-screens board — the open questions left by Giorgio's 2026-11-17 ruling "every chart
// like that, whether its the portfolio graph or the specific stock view, there should be 1 week, 1
// month, 3 months, 6 months, Season, and YTD" (PRODUCT_RULES, PR #495). Settled, not asked: every
// chart (Portfolio, the stock sheet, the player card) has 1W 1M 3M 6M Season YTD; the player card has
// ONE chart; no 1Y, no 1D, no dotted line; 1W is the past five sessions. Three A/B calls, most visible
// first. Review notes sit UNDER the phones, never inside.
//   #call-chart-default   which range each chart opens on
//   #call-season-predraft "Season" on a stock sheet before the league has drafted
//   #call-range-too-long  Portfolio ranges longer than the league has existed
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const RANGES = ['1W', '1M', '3M', '6M', 'Season', 'YTD'];
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;

  function Phone({ t, label, tab, sheet, children }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          {sheet ? (
            <>
              <div style={{ position: 'absolute', top: 54, left: 14, right: 14, height: 40, borderRadius: '14px 14px 0 0', background: 'var(--c-surface)', opacity: 0.5 }} />
              <div style={{ position: 'absolute', top: 64, left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', background: 'var(--c-surface)', overflow: 'hidden', padding: '14px 20px', display: 'grid', alignContent: 'start', gap: 14 }}>{children}</div>
            </>
          ) : (
            <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: tab ? 83 : 0, overflow: 'hidden', padding: '8px 20px', display: 'grid', alignContent: 'start', gap: 14 }}>{children}</div>
          )}
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

  // Line shapes (0..1 y, top = 0) per range, evenly spaced.
  const SHAPES = {
    '1W': [0.55, 0.42, 0.35, 0.18, 0.62],
    Season: [0.7, 0.66, 0.72, 0.6, 0.52, 0.56, 0.44, 0.38, 0.41, 0.3, 0.26, 0.22],
    long: [0.8, 0.74, 0.77, 0.69, 0.71, 0.6, 0.63, 0.55, 0.5, 0.52, 0.44, 0.47, 0.39, 0.35, 0.3, 0.33, 0.24, 0.2],
    sinceDraft: [0.7, 0.66, 0.72, 0.6, 0.52, 0.56, 0.44, 0.38],
  };
  const AXES = {
    '1W': ['Tue', 'Wed', 'Thu', 'Fri', 'Mon'],
    Season: ['Nov 2', 'Nov 9', 'Nov 16'],
    long: ['Jun 16', 'Aug 16', 'Oct 16'],
    sinceDraft: ['Nov 2', 'Nov 9', 'Nov 16'],
  };
  function Chart({ x = 1, shape = 'Season', up = true, h = 120 }) {
    const pts = SHAPES[shape];
    const W = 362; const step = W / (pts.length - 1);
    const d = pts.map((y, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(y * h).toFixed(1)}`).join(' ');
    const col = up ? 'var(--c-gain)' : 'var(--c-loss)';
    const last = pts[pts.length - 1];
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true" style={{ overflow: 'visible' }}>
          <path d={d} fill="none" stroke={col} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx={W} cy={last * h} r="4.5" fill="var(--c-accent)" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...fs(12, x, 1.3), color: 'var(--c-text-2)' }}>{AXES[shape].map((a) => <span key={a}>{a}</span>)}</div>
      </div>
    );
  }
  /** The range pills. on: the selected range; off: ranges drawn grey and inert; hide: ranges left out. */
  function Pills({ x = 1, on, off = [], hide = [] }) {
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {RANGES.filter((r) => !hide.includes(r)).map((r) => {
          const sel = r === on; const dead = off.includes(r);
          return (
            <span key={r} style={{ ...fs(14, x, 1.3), fontWeight: 700, padding: '7px 11px', borderRadius: 999, background: sel ? 'var(--c-accent)' : 'transparent', color: sel ? 'var(--c-on-accent)' : dead ? 'var(--c-text-2)' : 'var(--c-text)', opacity: dead ? 0.38 : 1 }}>{r}</span>
          );
        })}
      </div>
    );
  }
  const Pill = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ padding: '7px 13px', borderRadius: 999, boxShadow: 'inset 0 0 0 1px var(--c-border)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>Stock Scudetto</span>
      <span style={{ width: 34, height: 34, borderRadius: 17, background: 'var(--c-accent)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>RB</span>
    </div>
  );
  const Big = ({ x = 1, v }) => <span className="dr-num" style={{ ...fs(40, x, 1.3, 1.1), fontWeight: 800, color: 'var(--c-text)' }}>{v}</span>;
  const Small = ({ x = 1, children, color }) => <span className="dr-num" style={{ ...fs(14, x, 1.3), color: color || 'var(--c-text-2)', fontWeight: 600 }}>{children}</span>;

  function Portfolio({ t = 'light', x = 1, range = 'Season', off = [], label, shape }) {
    return (
      <Phone t={t} tab="portfolio" label={label}>
        <Pill />
        <span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>Portfolio value · includes cash</span>
        <Big x={x} v="$12,343.58" />
        <Small x={x} color="var(--c-gain)">+$343.50 · +2.86% since the draft</Small>
        <Chart x={x} shape={shape || (range === '1W' ? '1W' : 'Season')} />
        <Pills x={x} on={range} off={off} />
      </Phone>
    );
  }
  function StockSheet({ t = 'light', x = 1, range = '1W', off = [], hide = [], label, shape }) {
    return (
      <Phone t={t} sheet label={label}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: 'var(--c-text)' }}>NVDA</span>
          <span style={{ display: 'grid', flex: 1 }}><b style={{ ...fs(20, x, 1.3), color: 'var(--c-text)' }}>NVDA</b><span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>NVIDIA Corp</span></span>
          <Icon d={ICON.close} size={18} width={2.4} />
        </div>
        <Big x={x} v="$186.42" />
        <Small x={x} color="var(--c-gain)">+$3.11 · +1.70% today</Small>
        <Chart x={x} shape={shape || (range === '1W' ? '1W' : 'Season')} />
        <Pills x={x} on={range} off={off} hide={hide} />
        <span style={{ display: 'grid', placeItems: 'center', minHeight: 50, borderRadius: 26, background: 'var(--c-accent)', color: 'var(--c-on-accent)', ...fs(17, x, 1.6), fontWeight: 700 }}>Buy NVDA</span>
      </Phone>
    );
  }
  function PlayerCard({ t = 'light', x = 1, range = 'Season', label }) {
    const fig = (l, v, s, c) => (
      <span style={{ display: 'grid', gap: 2 }}>
        <span style={{ ...fs(11, x, 1.3), fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--c-text-2)' }}>{l}</span>
        <b className="dr-num" style={{ ...fs(17, x, 1.3), color: c || 'var(--c-text)' }}>{v}</b>
        <span className="dr-num" style={{ ...fs(13, x, 1.3), color: c || 'var(--c-text-2)' }}>{s}</span>
      </span>
    );
    return (
      <Phone t={t} sheet label={label}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'grid' }}><b style={{ ...fs(22, x, 1.3), color: 'var(--c-text)' }}>NVDA</b><span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>NVIDIA Corp · Paolo M.</span></span>
          <Icon d={ICON.close} size={18} width={2.4} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {fig('Price', '$186.42', '+1.70% today', 'var(--c-gain)')}
          {fig('Week gain', '+$41.20', '+2.11%', 'var(--c-gain)')}
          {fig('Since the draft', '+$93.80', '+4.92%', 'var(--c-gain)')}
        </div>
        <Chart x={x} shape={range === '1W' ? '1W' : 'Season'} />
        <Pills x={x} on={range} />
      </Phone>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const Head = ({ id, code, title, job }) => (
    <header className="b-sec__head"><span className="b-sec__n b-sec__n--code">{code}</span><div><h2 id={`${id}-h`}>{title}</h2><p className="b-job">{job}</p></div></header>
  );

  function CallChartDefault({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-chart-default" aria-labelledby="call-chart-default-h">
        <Head id="call-chart-default" code="Charts" title={archived ? 'Decided: which range each chart opens on' : 'Your call: which range each chart opens on'} job={'Every chart now has 1W, 1M, 3M, 6M, Season and YTD. Which one is selected when you open it?'} />
        <ul className="b-inv__notes">
          <li><b>A · Everything opens on Season.</b> Portfolio, a stock's sheet and a manager's stock (the player card) all start on Season, the game's own timeline.</li>
          <li><b>B · Your team opens on Season, a stock you're shopping for opens on 1W.</b> Portfolio and the player card start on Season (how it's done since the draft); the sheet you open to buy a stock starts on 1W (what it did lately), as it does today.</li>
          <li><b>Recommended: B.</b> Each chart opens on what you opened it to check: your season on your team, the last week on a stock you're thinking of buying. It's also what the app does today, plus the player card on Season.</li>
          <li><b>No new words.</b></li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <h3 className="b-sub">A · everything opens on Season</h3>
        <Grid>{[
          fig('da1', 'A · Portfolio', <Portfolio range="Season" label="Portfolio opening on Season, option A" />),
          fig('da2', 'A · a stock’s sheet', <StockSheet range="Season" label="Stock sheet opening on Season, option A" />),
          fig('da3', 'A · a manager’s stock (player card)', <PlayerCard range="Season" label="Player card opening on Season, option A" />),
        ]}</Grid>
        <h3 className="b-sub">B · your team on Season, a stock you're buying on 1W (recommended)</h3>
        <Grid>{[
          fig('db1', 'B · Portfolio', <Portfolio range="Season" label="Portfolio opening on Season, option B" />),
          fig('db2', 'B · a stock’s sheet', <StockSheet range="1W" label="Stock sheet opening on 1W, option B" />, 'The past five trading days, as ruled.'),
          fig('db3', 'B · a manager’s stock (player card)', <PlayerCard range="Season" label="Player card opening on Season, option B" />, 'One chart now, not two.'),
          fig('db4', 'B · a stock’s sheet · Dark', <StockSheet t="dark" range="1W" label="Stock sheet on 1W, option B, Dark" />),
          fig('db5', 'B · a stock’s sheet · your size (AX5, approximate)', <StockSheet x={AX5} range="1W" label="Stock sheet on 1W, option B, AX5" />, 'The six ranges still fit one row at your size (they stop growing at 1.3x, like the other pills).'),
        ]}</Grid>
      </section>
    );
  }

  function CallSeasonPredraft({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-season-predraft" aria-labelledby="call-season-predraft-h">
        <Head id="call-season-predraft" code="Charts" title={archived ? 'Decided: Season on a stock before the draft' : 'Your call: Season on a stock before the draft'} job={'Once the league has drafted, Season on any stock means "since the draft", owned or not, the same window for everyone. Before the draft there is no season yet. What should the Season range do then?'} />
        <ul className="b-inv__notes">
          <li><b>After the draft (both options):</b> Season shows the stock from draft day to now, whether you, someone else, or nobody owns it.</li>
          <li><b>A · Before the draft, no Season.</b> The sheet shows 1W, 1M, 3M, 6M and YTD; Season appears once the league has drafted.</li>
          <li><b>B · Before the draft, Season is grey.</b> It's in its place but greyed out and does nothing until the draft, like a stepper at its end.</li>
          <li><b>Recommended: B.</b> The row of ranges never changes shape, and the grey matches how the app shows anything that isn't available yet. It also matches the recommendation in the next call.</li>
          <li><b>No new words.</b></li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <Grid>{[
          fig('sa', 'A · before the draft', <StockSheet range="1W" hide={['Season']} label="Stock sheet before the draft, option A, no Season" />, 'Five ranges.'),
          fig('sb', 'B · before the draft (recommended)', <StockSheet range="1W" off={['Season']} label="Stock sheet before the draft, option B, Season greyed" />, 'Season greyed, in its place.'),
          fig('sc', 'After the draft (both) · Season', <StockSheet range="Season" shape="sinceDraft" label="Stock sheet after the draft on Season" />, 'Draft day to now, for any stock.'),
          fig('sbd', 'B · before the draft · Dark', <StockSheet t="dark" range="1W" off={['Season']} label="Stock sheet before the draft, option B, Dark" />),
        ]}</Grid>
      </section>
    );
  }

  function CallRangeTooLong({ archived = false, decidedNote }) {
    const longer = ['1M', '3M', '6M', 'YTD'];
    return (
      <section className="b-sec" id="call-range-too-long" aria-labelledby="call-range-too-long-h">
        <Head id="call-range-too-long" code="Portfolio" title={archived ? 'Decided: Portfolio ranges longer than the league' : 'Your call: Portfolio ranges longer than the league'} job={'Your portfolio has no value before its draft. In a league that drafted two weeks ago, 1M, 3M, 6M and YTD reach back before anything existed, so each would show the same line as Season. (Stock charts are not affected: a stock has years of prices.)'} />
        <ul className="b-inv__notes">
          <li><b>A · Show them anyway.</b> Tap 6M and you get the Season line: draft day to now, the axis starting at the draft.</li>
          <li><b>B · Grey them out until the league is old enough.</b> A two-week-old league has 1W and Season; 1M lights up after a month, 3M after three, and so on. YTD lights up once the league has been playing since January 1.</li>
          <li><b>Recommended: B.</b> Four ranges that all show the same line would look broken. Grey says "not yet" without words, and the row keeps its shape.</li>
          <li><b>No new words.</b></li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <Grid>{[
          fig('ra', 'A · a two-week-old league, 6M selected', <Portfolio range="6M" shape="Season" label="Portfolio, two-week-old league, 6M selected, option A" />, 'Same line as Season.'),
          fig('rb', 'B · a two-week-old league (recommended)', <Portfolio range="Season" off={longer} label="Portfolio, two-week-old league, longer ranges greyed, option B" />, '1M, 3M, 6M and YTD grey until the league is old enough.'),
          fig('rbd', 'B · Dark', <Portfolio t="dark" range="Season" off={longer} label="Portfolio, option B, Dark" />),
          fig('rbx', 'B · your size (AX5, approximate)', <Portfolio x={AX5} range="Season" off={longer} label="Portfolio, option B, AX5" />),
        ]}</Grid>
      </section>
    );
  }

  window.KSChartDefault = () => <CallChartDefault />;
  window.KSSeasonPredraft = () => <CallSeasonPredraft />;
  window.KSRangeTooLong = () => <CallRangeTooLong />;
})();
