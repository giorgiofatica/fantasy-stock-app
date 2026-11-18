// Stockpile key-screens board — "Your call: the Stocks tab's list" (2026-11-18). Modelled on ESPN's
// Players tab from Giorgio's 47 s recording (local/design-review/references/espn-players-tab-2026-11-18,
// never committed). Already decided and drawn the same everywhere (PRODUCT_RULES, #526/#528): the tab
// opens on a list, only stocks nobody in the league holds, the price on each row, largest companies
// first. A row carries what plan part 1 returns: ticker, name, the stored price, its category.
// Two open questions: the row's action (A/B) and how search is reached (C/D). Review notes sit UNDER
// the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const STAR = 'M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z';

  // The largest stocks nobody in this league holds (examples).
  const ROWS = [
    ['MSFT', 'Microsoft', 'Technology', '$512.30'],
    ['GOOGL', 'Alphabet', 'Technology', '$268.41'],
    ['AVGO', 'Broadcom', 'Technology', '$341.07'],
    ['BRK.B', 'Berkshire Hathaway', 'Financials', '$487.92'],
    ['JPM', 'JPMorgan Chase', 'Financials', '$301.55'],
    ['LLY', 'Eli Lilly', 'Healthcare', '$812.60'],
    ['WMT', 'Walmart', 'Retail & Consumer Goods', '$102.18'],
    ['XOM', 'Exxon Mobil', 'Energy & Utilities', '$114.73'],
  ];
  const CATS = ['Technology', 'Financials', 'Healthcare', 'Energy & Utilities'];

  function Plus({ closed }) {
    // Buy while the market is open (accent), Claim while it is closed (amber), as ESPN's green and orange.
    const c = closed ? 'var(--c-warn-text)' : 'var(--c-accent)';
    return (
      <span style={{ width: 44, height: 44, flex: '0 0 44px', display: 'grid', placeItems: 'center' }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, background: c, display: 'grid', placeItems: 'center', color: 'var(--c-on-accent)' }}><Icon d={ICON.plus} size={14} width={3} /></span>
      </span>
    );
  }

  function Row({ x, r, plus, closed, cat }) {
    const [sym, name, category, price] = r;
    const st = x >= 1.35;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--c-border)' }}>
        {plus ? <Plus closed={closed} /> : null}
        <span style={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: 20, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: sym.length > 4 ? 8 : 10, fontWeight: 800, color: 'var(--c-text)' }}>{sym}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'grid' }}>
          <b style={{ ...fs(16, x, 1.3), color: 'var(--c-text)' }}>{sym}</b>
          <span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>{cat ? `${name} · ${category}` : name}</span>
          {st ? <b className="dr-num" style={{ ...fs(16, x, 1.3), color: 'var(--c-text)', marginTop: 2 }}>{price}</b> : null}
        </span>
        {st ? null : <b className="dr-num" style={{ ...fs(16, x, 1.3), color: 'var(--c-text)' }}>{price}</b>}
        {plus ? null : <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.right} size={14} width={2.4} /></span>}
      </div>
    );
  }

  function Chip({ x, label, on, icon }) {
    return (
      <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 34, padding: icon ? '0 9px' : '0 13px', borderRadius: 17, boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--c-border-strong)', background: on ? 'var(--c-accent)' : 'transparent', color: on ? 'var(--c-on-accent)' : 'var(--c-text)', ...fs(14, x, 1.3), fontWeight: 700, whiteSpace: 'nowrap' }}>
        {icon ? <Icon d={icon} size={16} width={2.2} /> : null}{label}
      </span>
    );
  }

  function ChipRow({ x, search }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', padding: '4px 0 10px' }}>
        {search ? <><Chip x={x} icon={ICON.search} /><span style={{ width: 1, alignSelf: 'stretch', margin: '6px 2px', background: 'var(--c-border-strong)', flex: '0 0 1px' }} /></> : null}
        <Chip x={x} icon={STAR} />
        <Chip x={x} label="All" on />
        {CATS.map((c) => <Chip key={c} x={x} label={c} />)}
      </div>
    );
  }

  function TabBar() {
    const tab = (d, l, on) => (
      <span key={l} style={{ display: 'grid', justifyItems: 'center', gap: 2, color: on ? 'var(--c-accent)' : 'var(--c-text-2)', fontSize: 10, fontWeight: 600 }}><Icon d={d} size={22} width={2} />{l}</span>
    );
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', paddingTop: 8 }}>
        {tab(ICON.home, 'Home')}{tab(ICON.matchup, 'Matchup')}{tab(ICON.league, 'League')}{tab(ICON.portfolio, 'Portfolio')}{tab(ICON.search, 'Stocks', true)}
      </div>
    );
  }

  /** The Stocks tab. row: A ("+" at the left) | B (tap the row). search: C (icon in the chip row) | D (a field). */
  function Stocks({ t = 'light', x = 1, row = 'A', search = 'C', closed = false, label, rows = ROWS }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 78, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', ...fs(16, x, 1.3), fontWeight: 600, color: 'var(--c-text)' }}>Stock Scudetto<span style={{ ...fs(12, x, 1.3), padding: '1px 6px', borderRadius: 9, background: 'var(--c-inset)', color: 'var(--c-accent)' }}>+3</span><Icon d={ICON.chevron} size={13} width={2.4} /></span>
              <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-accent)', color: 'var(--c-on-accent)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>RB</span>
            </div>
            {search === 'D' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 12, background: 'var(--c-inset)', color: 'var(--c-text-2)', marginBottom: 10, ...fs(16, x, 1.6) }}><Icon d={ICON.search} size={16} width={2.4} />Search</span>
            ) : null}
            <ChipRow x={x} search={search === 'C'} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {rows.map((r) => <Row key={r[0]} x={x} r={r} plus={row === 'A'} closed={closed} cat />)}
            </div>
          </div>
          <TabBar />
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  /** Search, either way in: the field replaces the top with Cancel; plain results (today's search rows). */
  function Searching({ t = 'light', x = 1, label }) {
    const res = [['JPM', 'JPMorgan Chase', '$301.55', null], ['JNJ', 'Johnson & Johnson', '$176.20', null], ['JD', 'JD.com', '$33.48', 'Owned by Paolo M.']];
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 78, padding: '8px 16px', display: 'grid', alignContent: 'start', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 12, background: 'var(--c-inset)', boxShadow: 'inset 0 0 0 1.5px var(--c-accent)', color: 'var(--c-text)', ...fs(16, x, 1.6) }}><Icon d={ICON.search} size={16} width={2.4} />J</span>
              <span style={{ ...fs(16, x, 1.3), color: 'var(--c-accent)', fontWeight: 600 }}>Cancel</span>
            </div>
            {res.map(([s, n, p, own]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--c-border)' }}>
                <span style={{ flex: 1, display: 'grid' }}><b style={{ ...fs(16, x, 1.3), color: 'var(--c-text)' }}>{s}</b><span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>{own ? `${n} · ${own}` : n}</span></span>
                <b className="dr-num" style={{ ...fs(16, x, 1.3), color: 'var(--c-text)' }}>{p}</b>
              </div>
            ))}
          </div>
          <TabBar />
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const MAP = [
    ['Position chips (All, QB, RB…)', 'Our categories (Technology, Financials…), scrolling sideways. A chip narrows the list.'],
    ['The flag (watch list)', 'The star: your Saved stocks in this league (the watchlist, "Save"/"Saved").'],
    ['PROJ / SCORE columns', 'The price, one figure on the right: the stored price the plan returns. Nothing else: no day change, no company size (the list is ordered by size, but the size is not shown). A day change would need data the list does not carry yet.'],
    ['"71% Rost +14.3" and the next game', 'No equivalent: a stock has one owner per league, and has no games. The second line is the company and its category.'],
    ['The "+" at the left (orange for waivers)', 'Buy while the market is open, Claim while it is closed (already ruled). It opens the buy (or claim) review, never a one-tap trade. Only in A.'],
    ['Trending & Recommended', 'Not drawn: it waits on live market data (the price-supplier decision). When it comes, it sits above the list and folds away, as ESPN’s does.'],
    ['"AVAILABLE" and the stats dropdown', 'Left out: with one list and one figure there is nothing to name or switch.'],
    ['The filters (sliders) button and its sheet', 'Left out: Show My Team, Availability and Playing have no meaning here (the list is already "nobody holds it"), and Pro Team is the category chips.'],
    ['Search', 'Typing replaces the top with a field and Cancel and shows plain results: today’s search rows, owned stocks included, as ruled.'],
  ];

  function CallStocksList({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-stocks-list" aria-labelledby="call-stocks-list-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Stocks</span>
          <div>
            <h2 id="call-stocks-list-h">{archived ? 'Decided: the Stocks tab’s list' : 'Your call: the Stocks tab’s list'}</h2>
            <p className="b-job">{'Built from your ESPN Players recording. Already decided and drawn the same in every phone: it opens on the stocks nobody in the league holds, largest first, with the price on each row. Two things to pick: what a row does, and how you get to search.'}</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · a "+" at the left of each row, like ESPN.</b> Tap the "+" to buy (or claim, after the close); tap the rest of the row to open the stock.</li>
          <li><b>B · no button on the row.</b> Tap a row to open the stock; Buy (or Claim) is on its sheet, as today.</li>
          <li><b>Recommended: A.</b> It is the waiver-wire move you know from ESPN: see a stock, add it in one tap, and the review still shows before anything is bought.</li>
          <li><b>C · search is the first icon in the chip row, like ESPN.</b> Tap it and the top becomes a search field.</li>
          <li><b>D · a search field above the chips.</b> Always visible, one line taller.</li>
          <li><b>Recommended: C.</b> The list is the point of the tab; ESPN keeps search to one icon, and it opens the same field either way.</li>
          <li><b>The league pill stays on top,</b> as on every tab: the list is this league\u2019s.</li>
          <li><b>New words:</b> "All" (the first chip). Everything else is words the app already has: the tab name "Stocks", the category names, Save/Saved, Buy, Claim, Cancel, "Search".</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B, and C or D.</>}</li>
        </ul>
        <h3 className="b-sub">A · "+" on the row · C · search icon (recommended)</h3>
        <Grid>{[
          fig('ac', 'A + C · market open', <Stocks row="A" search="C" label="Stocks list, plus on the row, search icon, market open" />, 'The "+" is Buy. Numbers are examples. The tab\u2019s magnifier icon is a stand-in, chosen separately.'),
          fig('acc', 'A + C · after the close', <Stocks row="A" search="C" closed label="Stocks list, plus on the row, market closed" />, 'The "+" turns to Claim, amber, as ESPN’s waiver orange.'),
          fig('acd', 'A + C · Dark', <Stocks t="dark" row="A" search="C" label="Stocks list, A and C, Dark" />),
          fig('acx', 'A + C · your size (AX5, approximate)', <Stocks x={AX5} row="A" search="C" rows={ROWS.slice(0, 4)} label="Stocks list, A and C, AX5" />, 'The row\u2019s words stop growing at 1.3x, as Holdings rows do, so a row never outgrows its ticker. The "+" stays a 44pt target.'),
        ]}</Grid>
        <h3 className="b-sub">B · tap the row</h3>
        <Grid>{[
          fig('bc', 'B + C', <Stocks row="B" search="C" label="Stocks list, no button on the row, search icon" />, 'Buy and Claim live on the stock’s sheet.'),
          fig('bcx', 'B + C · your size (AX5, approximate)', <Stocks x={AX5} row="B" search="C" rows={ROWS.slice(0, 4)} label="Stocks list, B and C, AX5" />),
        ]}</Grid>
        <h3 className="b-sub">D · a search field</h3>
        <Grid>{[
          fig('ad', 'A + D', <Stocks row="A" search="D" label="Stocks list, plus on the row, search field" />, 'One row taller: fewer stocks above the fold.'),
          fig('adx', 'A + D · your size (AX5, approximate)', <Stocks x={AX5} row="A" search="D" rows={ROWS.slice(0, 4)} label="Stocks list, A and D, AX5" />),
        ]}</Grid>
        <h3 className="b-sub">Searching (the same either way)</h3>
        <Grid>{[
          fig('s1', 'Typing "J"', <Searching label="Stocks search results while typing" />, 'Plain results; a stock someone holds is found and says so.'),
        ]}</Grid>
        <h3 className="b-sub">ESPN, element by element, and ours</h3>
        <table className="b-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {MAP.map(([e, o]) => (
              <tr key={e} style={{ borderTop: '1px solid var(--b-rule, #ddd)' }}><td style={{ padding: '8px 12px 8px 0', fontWeight: 700, verticalAlign: 'top', width: '34%' }}>{e}</td><td style={{ padding: '8px 0' }}>{o}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  window.KSStocksList = () => <CallStocksList />;
})();
