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
    '1W': [0.62, 0.5, 0.56, 0.34, 0.22], // up on the week and up today (Mon above Fri), as every 1W label says
    Season: [0.7, 0.66, 0.72, 0.6, 0.52, 0.56, 0.44, 0.38, 0.41, 0.3, 0.26, 0.22],
    long: [0.8, 0.74, 0.77, 0.69, 0.71, 0.6, 0.63, 0.55, 0.5, 0.52, 0.44, 0.47, 0.39, 0.35, 0.3, 0.33, 0.24, 0.2],
    sinceDraft: [0.7, 0.66, 0.72, 0.6, 0.52, 0.56, 0.44, 0.38],
    fall: [0.2, 0.24, 0.33, 0.3, 0.35, 0.39, 0.47, 0.44, 0.52, 0.5, 0.55, 0.63, 0.6, 0.69, 0.71, 0.77, 0.74, 0.8],
  };
  const AXES = {
    '1W': ['Tue', 'Wed', 'Thu', 'Fri', 'Mon'],
    Season: ['Nov 2', 'Nov 9', 'Nov 16'],
    long: ['Jun 16', 'Aug 16', 'Oct 16'],
    sinceDraft: ['Nov 2', 'Nov 9', 'Nov 16'],
    fall: ['May 18', 'Aug 18', 'Nov 16'],
  };
  function Chart({ x = 1, shape = 'Season', up = true, h = 120, axis }) {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', ...fs(12, x, 1.3), color: 'var(--c-text-2)' }}>{(axis || AXES[shape]).map((a) => <span key={a}>{a}</span>)}</div>
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

  function Portfolio({ t = 'light', x = 1, range = 'Season', off = [], label, shape, fmt }) {
    return (
      <Phone t={t} tab="portfolio" label={label}>
        <Pill />
        <span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>Portfolio value · includes cash</span>
        <Big x={x} v="$12,343.58" />
        <Small x={x} color="var(--c-gain)">{fmt ? fmtLine('+$343.50', '+2.86%', 'since the draft', fmt === 'one' ? 'dollars' : fmt) : '+$343.50 · +2.86% since the draft'}</Small>
        <Chart x={x} shape={shape || (range === '1W' ? '1W' : 'Season')} />
        <Pills x={x} on={range} off={off} />
      </Phone>
    );
  }
  // The gain beside each chart, per range (drawing values), and the two ways to name the period.
  const GAINS = { '1W': ['+$7.40', '+4.13%'], '1M': ['+$12.85', '+7.40%'], '3M': ['+$31.20', '+20.10%'], '6M': ['+$54.60', '+41.42%'], Season: ['+$9.18', '+5.18%'], YTD: ['+$61.07', '+48.71%'] };
  const WORDS_A = { '1W': 'past week', '1M': 'past month', '3M': 'past 3 months', '6M': 'past 6 months', Season: 'since the draft', YTD: 'this year' };
  const gainLine = (range, words, big) => { const g = big ? ['\u2212$1,234.56', '\u221212.34%'] : GAINS[range]; return `${g[0]} · ${g[1]} ${words === 'B' ? `· ${range}` : WORDS_A[range]}`; };
  const AXIS_FOR = { '1W': AXES['1W'], '1M': ['Oct 16', 'Nov 1', 'Nov 16'], '3M': ['Aug 18', 'Oct 1', 'Nov 16'], '6M': ['May 18', 'Aug 18', 'Nov 16'], Season: AXES.Season, YTD: ['Jan 2', 'Jun 2', 'Nov 16'] };
  const fmtLine = (d, p, words, fmt) => (fmt === 'paren' ? `${d} (${p}) ${words}` : fmt === 'dollars' ? `${d} ${words}` : `${p} ${words}`);
  const shapeFor = (range) => (range === '1W' ? '1W' : range === 'Season' || range === '1M' ? 'Season' : 'long');

  function StockSheet({ t = 'light', x = 1, range = '1W', off = [], hide = [], label, shape, words, sym = 'NVDA', co = 'NVIDIA Corp', big, fmt }) {
    return (
      <Phone t={t} sheet label={label}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: 'var(--c-text)' }}>{sym}</span>
          <span style={{ display: 'grid', flex: 1 }}><b style={{ ...fs(20, x, 1.3), color: 'var(--c-text)' }}>{sym}</b><span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>{co}</span></span>
          <Icon d={ICON.close} size={18} width={2.4} />
        </div>
        <Big x={x} v="$186.42" />
        <Small x={x} color={big ? 'var(--c-loss)' : 'var(--c-gain)'}>{fmt ? fmtLine(GAINS[range][0], GAINS[range][1], WORDS_A[range], fmt === 'one' ? 'percent' : fmt) : words ? gainLine(range, words, big) : '+$3.11 · +1.70% today'}</Small>
        <Chart x={x} up={!big} shape={big ? 'fall' : shape || (words || fmt ? shapeFor(range) : range === '1W' ? '1W' : 'Season')} axis={words || fmt ? AXIS_FOR[range] : undefined} />
        <Pills x={x} on={range} off={off} hide={hide} />
        <span style={{ display: 'grid', placeItems: 'center', minHeight: 50, borderRadius: 26, background: 'var(--c-accent)', color: 'var(--c-on-accent)', ...fs(17, x, 1.6), fontWeight: 700 }}>Buy {sym}</span>
      </Phone>
    );
  }
  function PlayerCard({ t = 'light', x = 1, range = 'Season', label, card, words = 'A', fmt }) {
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
        <div style={{ display: 'grid', gridTemplateColumns: card === 'B' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 8 }}>
          {fig('Price', '$186.42', '+1.70% today', 'var(--c-gain)')}
          {fig('Week gain', '+$41.20', '+2.11%', 'var(--c-gain)')}
          {card === 'B' ? null : card === 'A' ? fig(words === 'B' ? range : WORDS_A[range], GAINS[range][0], GAINS[range][1], 'var(--c-gain)') : fig('Since the draft', '+$93.80', '+4.92%', 'var(--c-gain)')}
        </div>
        {card === 'B' ? <Small x={x} color="var(--c-gain)">{fmt ? fmtLine(GAINS[range][0], GAINS[range][1], WORDS_A[range], fmt === 'one' ? 'dollars' : fmt) : gainLine(range, words)}</Small> : null}
        <Chart x={x} shape={card ? shapeFor(range) : range === '1W' ? '1W' : 'Season'} axis={card ? AXIS_FOR[range] : undefined} />
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
        <h3 className="b-sub">B · your team on Season, a stock you're buying on 1W {archived ? '(decided)' : '(recommended)'}</h3>
        <Grid>{[
          fig('db1', 'B · Portfolio', <Portfolio range="Season" label="Portfolio opening on Season, option B" />),
          fig('db2', 'B · a stock’s sheet', <StockSheet range="1W" label="Stock sheet opening on 1W, option B" />, 'The past five trading days, as ruled.'),
          fig('db3', 'B · a manager’s stock (player card)', <PlayerCard range="Season" label="Player card opening on Season, option B" />, 'One chart now, not two.'),
          fig('db4', 'B · a stock’s sheet · Dark', <StockSheet t="dark" range="1W" label="Stock sheet on 1W, option B, Dark" />),
          fig('db5', 'B · a stock’s sheet · your size (AX5, approximate)', <StockSheet x={AX5} range="1W" label="Stock sheet on 1W, option B, AX5" />, 'The six ranges still fit one row at your size (they stop growing at 1.3x, like the other pills).'),
          fig('db6', 'B · Portfolio · your size (AX5, approximate)', <Portfolio x={AX5} range="Season" label="Portfolio on Season, option B, AX5" />),
          fig('db7', 'B · player card · your size (AX5, approximate)', <PlayerCard x={AX5} range="Season" label="Player card on Season, option B, AX5" />),
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
          <li><b>Recommended: B.</b> The row of ranges never changes shape, and the grey matches how the app shows anything that isn't available yet, including the Portfolio ranges you've already ruled grey.</li>
          <li><b>A second question: does a stock chart ever grey a range?</b> You ruled grey for the Portfolio graph. A stock can have the same gap: one that started trading on October 1 has no 3M, 6M or YTD yet.</li>
          <li><b>C · A stock shows what it has.</b> 3M, 6M and YTD on that stock draw its whole life, October 1 to now, the same line three times.</li>
          <li><b>D · A stock greys them too.</b> The same rule as your Portfolio: a range longer than the stock has existed is grey until it's long enough.</li>
          <li><b>Recommended: D.</b> One rule for every chart: a range with nothing behind it is grey. Three ranges drawing the same line would look broken, as on Portfolio.</li>
          <li><b>No new words.</b></li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B, and C or D.</>}</li>
        </ul>
        <Grid>{[
          fig('sa', 'A · before the draft', <StockSheet range="1W" hide={['Season']} label="Stock sheet before the draft, option A, no Season" />, 'Five ranges.'),
          fig('sb', archived ? 'B · before the draft (decided)' : 'B · before the draft (recommended)', <StockSheet range="1W" off={['Season']} label="Stock sheet before the draft, option B, Season greyed" />, 'Season greyed, in its place.'),
          fig('sc', 'After the draft (both) · Season', <StockSheet range="Season" shape="sinceDraft" label="Stock sheet after the draft on Season" />, 'Draft day to now, for any stock.'),
          fig('sbd', 'B · before the draft · Dark', <StockSheet t="dark" range="1W" off={['Season']} label="Stock sheet before the draft, option B, Dark" />),
          fig('sbx', 'B · before the draft · your size (AX5, approximate)', <StockSheet x={AX5} range="1W" off={['Season']} label="Stock sheet before the draft, option B, AX5" />, 'All six on one row at your size, Season grey.'),
        ]}</Grid>
        <h3 className="b-sub">A stock that started trading on October 1</h3>
        <Grid>{[
          fig('sgc', 'C · 6M selected (shows what it has)', <StockSheet sym="NEWC" co="Newco Inc." range="6M" shape="sinceDraft" words="A" label="A newly listed stock, 6M, option C" />, 'Its whole life, the same line as 3M and YTD.'),
          fig('sgd', archived ? 'D · 3M, 6M, YTD grey (decided)' : 'D · 3M, 6M, YTD grey (recommended)', <StockSheet sym="NEWC" co="Newco Inc." range="1M" off={['3M', '6M', 'YTD']} words="A" label="A newly listed stock, 3M 6M YTD greyed, option D" />, 'Grey until it has that much history.'),
          fig('sgx', 'D · your size (AX5, approximate)', <StockSheet sym="NEWC" co="Newco Inc." x={AX5} range="1M" off={['3M', '6M', 'YTD']} words="A" label="A newly listed stock, option D, AX5" />),
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
          fig('rb', archived ? 'B · a two-week-old league (decided)' : 'B · a two-week-old league (recommended)', <Portfolio range="Season" off={longer} label="Portfolio, two-week-old league, longer ranges greyed, option B" />, '1M, 3M, 6M and YTD grey until the league is old enough.'),
          fig('rbd', 'B · Dark', <Portfolio t="dark" range="Season" off={longer} label="Portfolio, option B, Dark" />),
          fig('rbx', 'B · your size (AX5, approximate)', <Portfolio x={AX5} range="Season" off={longer} label="Portfolio, option B, AX5" />),
        ]}</Grid>
      </section>
    );
  }

  function CallRangeGain({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-range-gain" aria-labelledby="call-range-gain-h">
        <Head id="call-range-gain" code="Charts" title={archived ? 'Decided: the gain beside each chart' : 'Your call: the gain beside each chart'} job={'You ruled that the gain or loss shown with a chart changes with the range you tap. Two things to settle: the words that name the period after the number, and where that number sits on a manager\u2019s stock (the player card), which today has three fixed figures: Price, Week gain and Since the draft.'} />
        <ul className="b-inv__notes">
          <li><b>The words, A · say the period.</b> "+$7.40 · +4.13% past week", then "past month", "past 3 months", "past 6 months", "since the draft" and "this year". New words: "past week", "past month", "past 3 months", "past 6 months", "this year".</li>
          <li><b>Season says "since the draft", not "this season".</b> It's the phrase Portfolio already uses under its value, and it says exactly where the line starts. "This season" would be a sixth new phrase for the same thing.</li>
          <li><b>Why the words matter:</b> a stock can be up on 3M and down on Season one tap apart. With the period named beside the number, green then red reads as two periods; without it, it reads as a glitch.</li>
          <li><b>The words, B · repeat the range.</b> "+$7.40 · +4.13% · 1W", "· Season", "· YTD". No new words, but it reads as a code, not a sentence.</li>
          <li><b>The player card, A · the third figure follows the range.</b> Price and Week gain stay; the third figure's label becomes the period ("Past week", "Since the draft"…) and its number changes as you tap.</li>
          <li><b>The player card, B · two figures and the number by the chart.</b> Price and Week gain stay; the gain sits right above the chart, the same place as on Portfolio and a stock's sheet.</li>
          <li><b>Week gain stays in both:</b> it's the matchup week (Monday to now, what the matchup scores), not 1W (the past five trading days), so it can't be one of the ranges.</li>
          <li><b>Recommended: words A, card B.</b> A reads like the "today" and "since the draft" lines you already have; B puts the number in the same place on every chart, beside the line it describes.</li>
          <li><b>One thing that goes:</b> a stock's sheet showed today's move ("+1.70% today"); with the number following the range, today's move shows only as the last point of 1W. On the player card it stays in the Price figure.</li>
          <li><b>New words, for your OK as written (words A):</b> "past week", "past month", "past 3 months", "past 6 months", "this year".</li>
          <li>{archived ? decidedNote : <><b>Words: decided A</b> (Giorgio, 2026-11-17: "i like the past 6 months"), in the bracket format of the next call. <b>Still open, answer with:</b> card A or B.</>}</li>
        </ul>
        <h3 className="b-sub">The words, on a stock's sheet</h3>
        <Grid>{[
          fig('wa1', 'Words A · 1W', <StockSheet range="1W" words="A" label="Stock sheet, 1W, words A" />, '"past week".'),
          fig('wa2', 'Words A · Season', <StockSheet range="Season" words="A" label="Stock sheet, Season, words A" />, '"since the draft", as on Portfolio today.'),
          fig('wa3', 'Words A · YTD', <StockSheet range="YTD" words="A" label="Stock sheet, YTD, words A" />, '"this year".'),
          fig('wb1', 'Words B · 1W', <StockSheet range="1W" words="B" label="Stock sheet, 1W, words B" />, 'The range\u2019s own label.'),
          fig('wb3', 'Words B · YTD', <StockSheet range="YTD" words="B" label="Stock sheet, YTD, words B" />),
        ]}</Grid>
        <h3 className="b-sub">The longest case at your size: a big loss on 6M</h3>
        <Grid>{[
          fig('wax', 'Words A · 6M · your size (AX5, approximate)', <StockSheet x={AX5} range="6M" words="A" big label="Stock sheet, 6M, a large loss, words A, AX5" />, 'If it can\u2019t fit one line, it wraps after the \u201c\u00b7\u201d, never inside a number.'),
          fig('wbx', 'Words B · 6M · your size (AX5, approximate)', <StockSheet x={AX5} range="6M" words="B" big label="Stock sheet, 6M, a large loss, words B, AX5" />),
        ]}</Grid>
        <h3 className="b-sub">The player card</h3>
        <Grid>{[
          fig('ca1', 'Card A · Season', <PlayerCard card="A" range="Season" label="Player card A, Season" />, 'The third figure is the range\u2019s gain.'),
          fig('ca2', 'Card A · 1W', <PlayerCard card="A" range="1W" label="Player card A, 1W" />, 'Its label and number change with the tap.'),
          fig('cb1', archived ? 'Card B · Season (decided)' : 'Card B · Season (recommended)', <PlayerCard card="B" fmt="paren" range="Season" label="Player card B, Season" />, 'Two figures; the gain above the chart.'),
          fig('cb2', 'Card B · 1W', <PlayerCard card="B" fmt="paren" range="1W" label="Player card B, 1W" />),
          fig('cbd', 'Card B · Dark', <PlayerCard t="dark" card="B" fmt="paren" range="Season" label="Player card B, Dark" />),
          fig('cbx', 'Card B · your size (AX5, approximate)', <PlayerCard x={AX5} card="B" fmt="paren" range="6M" label="Player card B, 6M, AX5" />, '"past 6 months" at your size.'),
        ]}</Grid>
      </section>
    );
  }

  function CallGainFormat({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-gain-format" aria-labelledby="call-gain-format-h">
        <Head id="call-gain-format" code="Charts" title={archived ? 'Decided: one number or two beside a chart' : 'Your call: one number or two beside a chart'} job={'You liked "past 6 months" but not two numbers separated only by a dot. Dollars decide matchups; percent compares stocks of different prices. Two ways to show the gain, drawn on all three charts.'} />
        <ul className="b-inv__notes">
          <li><b>A · Both, the brokerage way:</b> "+$54.60 (+41.42%) past 6 months". The percent sits in brackets after the dollars, as in Robinhood and Apple Stocks, so it reads as one figure with its percent.</li>
          <li><b>B · One number, the one that matters on that chart:</b> dollars on your team (Portfolio and a manager's stock, where dollars decide), percent on a stock you're shopping for (where it compares stocks of different prices).</li>
          <li><b>Recommended: A.</b> Nothing is lost, it's the format people know from their own brokerage app, and the brackets fix the dot. B is the cleaner line if you'd rather each chart say one thing.</li>
          <li><b>No new words.</b> The period words are the ones you liked ("past 6 months", "since the draft").</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <h3 className="b-sub">A · both, the percent in brackets {archived ? '(decided)' : '(recommended)'}</h3>
        <Grid>{[
          fig('fa1', 'A · Portfolio', <Portfolio fmt="paren" range="Season" label="Portfolio, gain with percent in brackets, option A" />),
          fig('fa2', 'A · a stock you\u2019re shopping for', <StockSheet fmt="paren" range="6M" label="Stock sheet, 6M, gain with percent in brackets, option A" />),
          fig('fa3', 'A · a manager\u2019s stock', <PlayerCard card="B" fmt="paren" range="6M" label="Player card, 6M, gain with percent in brackets, option A" />),
          fig('fax', 'A · a stock · your size (AX5, approximate)', <StockSheet x={AX5} fmt="paren" range="6M" label="Stock sheet, 6M, option A, AX5" />),
        ]}</Grid>
        <h3 className="b-sub">B · one number per chart</h3>
        <Grid>{[
          fig('fb1', 'B · Portfolio (dollars)', <Portfolio fmt="one" range="Season" label="Portfolio, dollars only, option B" />),
          fig('fb2', 'B · a stock you\u2019re shopping for (percent)', <StockSheet fmt="one" range="6M" label="Stock sheet, 6M, percent only, option B" />),
          fig('fb3', 'B · a manager\u2019s stock (dollars)', <PlayerCard card="B" fmt="one" range="6M" label="Player card, 6M, dollars only, option B" />),
          fig('fbx', 'B · a stock · your size (AX5, approximate)', <StockSheet x={AX5} fmt="one" range="6M" label="Stock sheet, 6M, option B, AX5" />),
        ]}</Grid>
      </section>
    );
  }

  window.KSChartDefault = () => null; // decided 2026-11-17: B; it lives in the Archive
  window.KSChartDefaultArchived = () => (
    <CallChartDefault
      archived
      decidedNote={<><b>Decided by Giorgio (2026-11-17): "go with B".</b> Portfolio and the player card open on Season; the stock sheet (a stock you're shopping for) opens on 1W. Recorded in PRODUCT_RULES by the Planner.</>}
    />
  );
  window.KSSeasonPredraft = () => null; // decided 2026-11-17: B and D; it lives in the Archive
  window.KSSeasonPredraftArchived = () => (
    <CallSeasonPredraft
      archived
      decidedNote={<><b>Decided by Giorgio (2026-11-17): "B and D".</b> Before the draft, Season stays in its place, greyed, on the stock sheet. A stock chart greys any range longer than the stock's trading history: a recent IPO's 3M, 6M and YTD stay grey until it is old enough. He first asked whether "new stock" meant a recent IPO or a stock new to his portfolio; it means a recent IPO, since a stock's chart is its market history whoever owns it. Recorded in PRODUCT_RULES by the Planner.</>}
    />
  );
  window.KSRangeTooLong = () => null; // decided 2026-11-17: B; it lives in the Archive
  window.KSRangeTooLongArchived = () => (
    <CallRangeTooLong
      archived
      decidedNote={<><b>Decided by Giorgio (2026-11-17), before the board reached him: "grey out the ranges longer than the league has existed".</b> That is B, for the Portfolio graph. Whether a stock chart ever greys a range was not asked. Recorded in PRODUCT_RULES by the Planner (#495).</>}
    />
  );
  window.KSRangeGain = () => null; // decided 2026-11-17: words A, card B; it lives in the Archive
  window.KSRangeGainArchived = () => (
    <CallRangeGain
      archived
      decidedNote={<><b>Decided by Giorgio (2026-11-17).</b> Words A ("i like the past 6 months"), in the bracket format of #call-gain-format. Card B ("B"): the player card's top keeps two figures, Price and Week gain, and the range's gain sits above the chart, "+$54.60 (+41.42%) past 6 months", in the same place as on Portfolio and a stock's sheet. Recorded in PRODUCT_RULES by the Planner.</>}
    />
  );
  window.KSGainFormat = () => null; // decided 2026-11-17: A; it lives in the Archive
  window.KSGainFormatArchived = () => (
    <CallGainFormat
      archived
      decidedNote={<><b>Decided by Giorgio (2026-11-17): "A".</b> Both numbers, the percent in brackets: "+$54.60 (+41.42%) past 6 months", on every chart. He had asked "explain the logic of keeping the two numbers?" (dollars decide matchups; percent compares stocks of different prices) and then picked A. Recorded in PRODUCT_RULES by the Planner.</>}
    />
  );
})();
