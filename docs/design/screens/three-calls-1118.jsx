// Stockpile key-screens board — three small calls for Giorgio in one sitting (2026-11-18, the Planner's
// ask): (1) the Matchup card in a finished league, (2) the Stocks tab in a finished season, (3) the Stocks
// tab's icon. Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  // Ionicons-style storefront (outline): awning, scalloped edge, the shop and its door.
  const STORE = 'M4.5 4h15l1.5 5H3z M3 9c0 1.5 1.1 2.5 2.5 2.5S8 10.5 8 9c0 1.5 1.1 2.5 2.5 2.5S13 10.5 13 9c0 1.5 1.1 2.5 2.5 2.5S18 10.5 18 9c0 1.5 1.1 2.5 2.5 2.5 M5 11.5V20h14v-8.5 M10 20v-5h4v5';
  const OS = () => <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;

  function TabBar({ x = 1, stocks = ICON.search }) {
    const tab = (d, l, on) => (
      <span key={l} style={{ display: 'grid', justifyItems: 'center', gap: 2, color: on ? 'var(--c-accent)' : 'var(--c-text-2)', ...fs(10, x, 1.3), fontWeight: 600 }}><Icon d={d} size={24} width={on ? 2.4 : 1.8} />{l}</span>
    );
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stocks === null ? 4 : 5}, 1fr)`, padding: '10px 4px 22px', background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)' }}>
        {tab(ICON.home, 'Home')}{tab(ICON.matchup, 'Matchup', stocks === null)}{tab(ICON.league, 'League')}{tab(ICON.portfolio, 'Portfolio')}{stocks === null ? null : tab(stocks, 'Stocks', true)}
      </div>
    );
  }

  const Pill = ({ name }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 12px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>{name}<span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 9, background: 'var(--c-inset)', color: 'var(--c-accent)' }}>+3</span><Icon d={ICON.chevron} size={13} width={2.4} /></span>
      <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-accent)', color: 'var(--c-on-accent)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>RB</span>
    </div>
  );
  const ROWS = [['MSFT', 'Microsoft', 'Technology', '$512.30'], ['GOOGL', 'Alphabet', 'Technology', '$268.41'], ['AVGO', 'Broadcom', 'Technology', '$341.07'], ['BRK.B', 'Berkshire Hathaway', 'Financials', '$487.92'], ['JPM', 'JPMorgan Chase', 'Financials', '$301.55'], ['LLY', 'Eli Lilly', 'Healthcare', '$812.60']];
  function Row({ r, plus }) {
    const [sym, name, cat, price] = r;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--c-border)' }}>
        {plus ? <span style={{ width: 44, flex: '0 0 44px', display: 'grid', placeItems: 'center' }}><span style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--c-accent)', color: 'var(--c-on-accent)', display: 'grid', placeItems: 'center' }}><Icon d={ICON.plus} size={14} width={3} /></span></span> : null}
        <span style={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: 20, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: sym.length > 4 ? 8 : 10, fontWeight: 800, color: 'var(--c-text)' }}>{sym}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'grid' }}><b style={{ fontSize: 16, color: 'var(--c-text)' }}>{sym}</b><span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>{`${name} · ${cat}`}</span></span>
        <b className="dr-num" style={{ fontSize: 16, color: 'var(--c-text)' }}>{price}</b>
      </div>
    );
  }
  function Chips() {
    const c = (l, on, icon) => <span key={l || 'i'} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', minHeight: 34, padding: icon ? '0 9px' : '0 13px', borderRadius: 17, boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--c-border-strong)', background: on ? 'var(--c-accent)' : 'transparent', color: on ? 'var(--c-on-accent)' : 'var(--c-text)', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{icon ? <Icon d={icon} size={16} width={2.2} /> : l}</span>;
    return <div style={{ display: 'flex', gap: 8, overflow: 'hidden', padding: '4px 0 10px' }}>{c(null, false, ICON.search)}{c('All', true)}{c('Technology')}{c('Financials')}{c('Healthcare')}</div>;
  }

  /** (2) The Stocks list in a finished league. plus: keep the "+" (B) or not (A). */
  function FinishedList({ t = 'light', plus, label }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, padding: '0 16px', overflow: 'hidden' }}>
              <Pill name="Summer Cup" />
              <Chips />
              {ROWS.map((r) => <Row key={r[0]} r={r} plus={plus} />)}
            </div>
            <TabBar />
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  /** (2) The stock's sheet opened from that list. line: the season-over line (B) or nothing (A). */
  function FinishedSheet({ t = 'light', line, label }) {
    const pills = ['1W', '1M', '3M', '6M', 'Season', 'YTD'];
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.28)' }} />
          <div style={{ position: 'absolute', top: 120, left: 0, right: 0, bottom: 0, background: 'var(--c-bg)', borderRadius: '22px 22px 0 0', padding: '14px 18px', display: 'grid', alignContent: 'start', gap: 12 }}>
            <span style={{ justifySelf: 'center', width: 36, height: 5, borderRadius: 3, background: 'var(--c-border-strong)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: 'var(--c-text)' }}>MSFT</span>
              <span style={{ flex: 1, display: 'grid' }}><b style={{ fontSize: 22, color: 'var(--c-text)' }}>MSFT</b><span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>Microsoft</span></span>
              <span style={{ color: 'var(--c-text)' }}><Icon d={ICON.close} size={18} width={2.4} /></span>
            </div>
            <b className="dr-num" style={{ fontSize: 36, color: 'var(--c-text)' }}>$512.30</b>
            <span className="dr-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-gain)' }}>{'+$9.84 (+1.96%) past week'}</span>
            <svg viewBox="0 0 300 110" style={{ width: '100%', height: 110 }} aria-hidden="true"><polyline points="0,80 60,72 120,76 180,52 240,46 300,30" fill="none" stroke="var(--c-gain)" strokeWidth="2.5" /></svg>
            <div style={{ display: 'flex', gap: 6 }}>{pills.map((p) => <span key={p} style={{ padding: '6px 10px', borderRadius: 16, fontSize: 13, fontWeight: 700, background: p === '1W' ? 'var(--c-accent)' : 'transparent', color: p === '1W' ? 'var(--c-on-accent)' : 'var(--c-text)' }}>{p}</span>)}</div>
            <span style={{ fontSize: 14, color: 'var(--c-text-2)' }}>No one in Summer Cup owns MSFT</span>
            {line ? <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)', padding: '12px 14px', borderRadius: 12, background: 'var(--c-inset)' }}>{"Summer Cup's season is over."}</span> : null}
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  /** (3) A tab bar on its own, at a size. */
  function Bar({ t = 'light', x = 1, icon, label }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={label} style={{ maxWidth: 390, width: '100%', background: 'var(--c-bg)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 0 0 1px var(--c-border)' }}>
          <TabBar x={x} stocks={icon} />
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const figBar = (key, cap, node) => (
    <figure key={key} className="b-fig" style={{ margin: 0, display: 'grid', gap: 8 }}>{node}<figcaption><b>{cap}</b></figcaption></figure>
  );
  const Grid = ({ children, n = 'three' }) => <div className={`b-concepts b-concepts--${n}`}>{children}</div>;

  /** (1) The Matchup tab once the season is over. v: a (the last matchup, final) | b (blank, as today). */
  function MatchupAfter({ t = 'light', v, label }) {
    const rows = [['NVDA', '+$149.60', '+7.23%', '−$12.14', '−0.63%', 'NKE'], ['AAPL', '+$97.68', '+4.73%', '−$21.11', '−1.09%', 'DIS'], ['CRM', '+$46.50', '+2.28%', '+$13.22', '+0.65%', 'KO'], ['V', '+$51.16', '+2.53%', '+$20.50', '+0.98%', 'JPM']];
    const tone = (s) => (s.startsWith('−') ? 'var(--c-loss)' : 'var(--c-gain)');
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, padding: '0 16px', overflow: 'hidden', display: 'grid', alignContent: 'start', gap: 10 }}>
              <Pill name="Summer Cup" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 3, borderRadius: 10, background: 'var(--c-inset)', fontSize: 14, fontWeight: 600 }}>
                <span style={{ textAlign: 'center', padding: '7px 0', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)' }}>My matchup</span>
                <span style={{ textAlign: 'center', padding: '7px 0', color: 'var(--c-text-2)' }}>All matchups</span>
              </div>
              {v === 'a' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 10, background: 'var(--c-accent)', color: 'var(--c-on-accent)', fontSize: 14, fontWeight: 800 }}><span>Roberto B. wins the Final</span><span>W · 5–1</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: 14, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
                    <div style={{ padding: 12, background: 'var(--c-inset)', display: 'grid', gap: 6 }}><b style={{ fontSize: 14, color: 'var(--c-text)' }}>Roberto B.</b><b className="dr-num" style={{ fontSize: 28, color: 'var(--c-text)' }}>+$351.79</b></div>
                    <div style={{ padding: 12, display: 'grid', gap: 6, justifyItems: 'end' }}><b style={{ fontSize: 14, color: 'var(--c-text)' }}>Gianluigi B.</b><b className="dr-num" style={{ fontSize: 28, color: 'var(--c-text)' }}>−$38.88</b></div>
                  </div>
                  <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--c-text-2)' }}>Roberto B. won by $390.67</span>
                  {rows.map(([a, ag, ap, bg, bp, b]) => (
                    <div key={a} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: 'var(--c-inset)' }}><b style={{ color: 'var(--c-text)' }}>{a}</b><span className="dr-num" style={{ textAlign: 'right', color: tone(ag), fontWeight: 700 }}>{ag}<br />{ap}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px' }}><span className="dr-num" style={{ color: tone(bg), fontWeight: 700 }}>{bg}<br />{bp}</span><b style={{ color: 'var(--c-text)' }}>{b}</b></div>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
            <TabBar stocks={null} />
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  function CallMatchupAfter({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-matchup-after" aria-labelledby="call-matchup-after-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Matchup</span>
          <div>
            <h2 id="call-matchup-after-h">{archived ? 'Decided: the Matchup tab after the season' : 'Your call: the Matchup tab after the season'}</h2>
            <p className="b-job">{'Once a season is over, the Matchup tab shows nothing under its switch today. What should it show?'}</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · your last matchup, final.</b> The final result the app already draws for any finished week, kept instead of cleared. Tapping a stock opens the finished-season card you picked: no price, no "today", no Sell.</li>
          <li><b>B · blank, as now.</b></li>
          <li><b>Who sees what in A:</b> the two finalists see the Final. A manager knocked out earlier sees their line, "Out in the Semifinals" (your words), and one who missed the playoffs sees "You didn't make the playoffs.", as they did in the last week. Nobody has a bye in the last week: byes only happen in the first playoff round.</li>
          <li><b>Recommended: A.</b> A blank tab is a dead end; the final result is the season’s last record.</li>
          <li><b>No new words.</b></li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <Grid n="two">{[
          fig('ma', 'A · the last matchup, final', <MatchupAfter v="a" label="Matchup tab after the season, the last matchup kept, option A" />, 'Numbers are examples.'),
          fig('mb', 'B · blank, as now', <MatchupAfter v="b" label="Matchup tab after the season, blank, option B" />, 'What a finished league shows today.'),
        ]}</Grid>
      </section>
    );
  }

  function CallStocksFinished({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-stocks-finished" aria-labelledby="call-stocks-finished-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Stocks</span>
          <div>
            <h2 id="call-stocks-finished-h">{archived ? 'Decided: the Stocks tab in a finished season' : 'Your call: the Stocks tab in a finished season'}</h2>
            <p className="b-job">{'A finished season can’t buy. The list stays to browse; what changes is how a stock says it can’t be bought.'}</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · no "+" and no button.</b> The rows lose the "+"; a stock’s sheet has no Buy and no line, like the finished-season card you picked.</li>
          <li><b>B · the "+" stays.</b> It opens the sheet, which says "Summer Cup’s season is over." where Buy would be (the app’s own words for a finished league, from the invite screen).</li>
          <li><b>Recommended: A.</b> Nothing on the screen offers a buy that can’t happen, and it matches the finished card.</li>
          <li><b>No new words.</b></li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <Grid n="four">{[
          fig('fa1', 'A · the list', <FinishedList plus={false} label="Stocks list in a finished season, no plus, option A" />),
          fig('fa2', 'A · a stock', <FinishedSheet label="Stock sheet in a finished season, no button, option A" />, 'No Buy, no line.'),
          fig('fb1', 'B · the list', <FinishedList plus label="Stocks list in a finished season, plus kept, option B" />),
          fig('fb2', 'B · a stock', <FinishedSheet line label="Stock sheet in a finished season, season-over line, option B" />, 'The line where Buy would be.'),
        ]}</Grid>
      </section>
    );
  }

  function CallStocksIcon({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-stocks-icon" aria-labelledby="call-stocks-icon-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Stocks</span>
          <div>
            <h2 id="call-stocks-icon-h">{archived ? 'Decided: the Stocks tab’s icon' : 'Your call: the Stocks tab’s icon'}</h2>
            <p className="b-job">{'Every mockup so far used a magnifying glass, and that was your first idea for this tab ("a little magnifying glass").'}</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · the magnifying glass.</b> Your first idea, and how the mockups have looked.</li>
          <li><b>B · a storefront.</b> It says "where you get stocks", your reason for the name ("not only a search, but also where you could buy"), and the screen already has its own search button, so a magnifier would say "search" twice.</li>
          <li><b>Recommended: B.</b> Icons never grow with the text size; only the labels do, up to 1.3x.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <Grid n="two">{[
          figBar('ia', 'A · magnifier · light', <Bar icon={ICON.search} label="Tab bar, magnifier icon, light" />),
          figBar('ib', 'B · storefront · light', <Bar icon={STORE} label="Tab bar, storefront icon, light" />),
          figBar('iad', 'A · magnifier · Dark', <Bar t="dark" icon={ICON.search} label="Tab bar, magnifier icon, Dark" />),
          figBar('ibd', 'B · storefront · Dark', <Bar t="dark" icon={STORE} label="Tab bar, storefront icon, Dark" />),
          figBar('iax', 'A · your size (AX5)', <Bar x={AX5} icon={ICON.search} label="Tab bar, magnifier icon, AX5" />),
          figBar('ibx', 'B · your size (AX5)', <Bar x={AX5} icon={STORE} label="Tab bar, storefront icon, AX5" />),
        ]}</Grid>
      </section>
    );
  }

  window.KSMatchupAfter = () => <CallMatchupAfter />;
  window.KSStocksFinished = () => <CallStocksFinished />;
  window.KSStocksIcon = () => <CallStocksIcon />;
})();
