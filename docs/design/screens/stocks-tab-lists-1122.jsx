// Stockpile key-screens board — "Your call: the Stocks tab's lists" (2026-11-22). Giorgio's picks are the
// directions (plan docs/plans/2026-11-18-stocks-tab.md, Part 3): a three-way switch at the top of the Stocks
// tab, a star on every stock row at the right edge (the "+" stays left), the chip row under the first view,
// no re-sorting (largest first), and Top movers over the 500 largest companies. The watchlist and claims are
// the approved October plan (docs/plans/2026-10-08-trading-window-and-watchlist.md): its words are reused here
// and marked as approved; everything else that is written on a phone is listed as NEW for him. Data: Tier Cup,
// a price-tier league ($100–$200 slot open), Roberto B.'s phone; open = Thu 1:37 PM, closed = Fri 5:00 PM ET.
// Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap = 1.3, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const STAR = 'M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z';
  const STORE = 'M4.5 4h15l1.5 5H3z M3 9c0 1.5 1.1 2.5 2.5 2.5S8 10.5 8 9c0 1.5 1.1 2.5 2.5 2.5S13 10.5 13 9c0 1.5 1.1 2.5 2.5 2.5S18 10.5 18 9c0 1.5 1.1 2.5 2.5 2.5 M5 11.5V20h14v-8.5 M10 20v-5h4v5';
  const FILLS = 'fills Mon 9:30 AM ET';
  // The claim brown he picked on 2026-11-18 ("brown after the close"). The warning brown it was drawn in is teal
  // now (#call-yellow), so a claim gets the palette's own brown, the rust of the Retail category.
  const CLAIM = { light: '#A34C1B', dark: '#F9A781' };

  const AVAILABLE = [
    ['MSFT', 'Microsoft', 'Technology', '$512.30'],
    ['GOOGL', 'Alphabet', 'Technology', '$268.41'],
    ['AVGO', 'Broadcom', 'Technology', '$341.07'],
    ['BRK.B', 'Berkshire Hathaway', 'Financials', '$487.92'],
    ['JPM', 'JPMorgan Chase', 'Financials', '$301.55'],
    ['LLY', 'Eli Lilly', 'Healthcare', '$812.60'],
    ['WMT', 'Walmart', 'Retail', '$102.18'],
  ];
  // Watching (ruling 13(c): the ticker and one status line, no company name). [sym, status, price, change, plus]
  const WATCH = [
    ['AMGN', 'Available · fits your $100–$200 slot', '$187.20', '+1.4%', true],
    ['AAPL', 'Owned by Gianluigi B.', '$211.42', '−0.6%', false],
    ['NVDA', 'You own this', '$323.05', '+2.1%', false],
    ['COST', 'No free $400+ slot', '$920.55', '+0.3%', 'closed'],
    ['SQ', 'No longer tradable', '—', null, false],
  ];
  // Top movers: biggest move first, up or down, only stocks nobody in the league owns.
  const MOVERS = [
    ['SMCI', 'Super Micro Computer', '$48.12', '+11.2%'],
    ['MRNA', 'Moderna', '$38.70', '−9.8%'],
    ['PLTR', 'Palantir', '$71.05', '+8.4%'],
    ['ENPH', 'Enphase Energy', '$62.33', '−7.1%'],
    ['ANET', 'Arista Networks', '$104.90', '+6.6%'],
    ['DLTR', 'Dollar Tree', '$66.18', '−6.2%'],
  ];

  const sign = (c) => (c && c.startsWith('−') ? 'var(--c-loss)' : 'var(--c-gain)');

  function OS() {
    return <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;
  }
  function TabBar() {
    const tab = (d, l, on) => <span key={l} style={{ display: 'grid', justifyItems: 'center', gap: 2, color: on ? 'var(--c-accent)' : 'var(--c-text-2)', fontSize: 10, fontWeight: 600 }}><Icon d={d} size={22} width={2} />{l}</span>;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', paddingTop: 8, zIndex: 3 }}>
        {tab(ICON.home, 'Home')}{tab(ICON.matchup, 'Matchup')}{tab(ICON.league, 'League')}{tab(ICON.portfolio, 'Portfolio')}{tab(STORE, 'Stocks', true)}
      </div>
    );
  }
  function Pill({ x }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', ...fs(16, x), fontWeight: 600, color: 'var(--c-text)' }}>Tier Cup<Icon d={ICON.chevron} size={13} width={2.4} /></span>
        <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-you)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>RB</span>
      </div>
    );
  }
  /** The three-way switch, the same control as Matchup's "My matchup | All matchups". */
  function Switch({ x, on }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: 3, borderRadius: 10, background: 'var(--c-inset)', ...fs(14, x), fontWeight: 600, marginBottom: 10 }}>
        {['Available', 'Watching', 'Claims'].map((l) => (
          <span key={l} style={{ textAlign: 'center', padding: '7px 2px', borderRadius: 8, background: l === on ? 'var(--c-surface)' : 'transparent', color: l === on ? 'var(--c-text)' : 'var(--c-text-2)', whiteSpace: 'nowrap' }}>{l}</span>
        ))}
      </div>
    );
  }
  function Chip({ x, label, on, icon }) {
    return <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', minHeight: 34, padding: icon ? '0 9px' : '0 13px', borderRadius: 17, boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--c-border-strong)', background: on ? 'var(--c-accent)' : 'transparent', color: on ? 'var(--c-on-accent)' : 'var(--c-text)', ...fs(14, x), fontWeight: 700, whiteSpace: 'nowrap' }}>{icon ? <Icon d={icon} size={16} width={2.2} /> : label}</span>;
  }
  function Chips({ x, on = 'All' }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', padding: '0 0 8px', flexShrink: 0 }}>
        <Chip x={x} icon={ICON.search} />
        {['All', 'Top movers', 'Technology', 'Financials'].map((l) => <Chip key={l} x={x} label={l} on={l === on} />)}
      </div>
    );
  }
  function Plus({ claim, t }) {
    return (
      <span style={{ width: 40, flex: '0 0 40px', display: 'grid', placeItems: 'center' }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, background: claim ? CLAIM[t] : 'var(--c-accent)', display: 'grid', placeItems: 'center', color: claim ? (t === 'light' ? '#fff' : '#080D25') : 'var(--c-on-accent)' }}><Icon d={ICON.plus} size={14} width={3} /></span>
      </span>
    );
  }
  function Star({ on, x = 1 }) {
    return (
      <span style={{ width: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center', color: on ? 'var(--c-accent)' : 'var(--c-text-2)' }}>
        <svg width={Math.round(20 * k(x, 1.3))} height={Math.round(20 * k(x, 1.3))} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d={STAR} /></svg>
      </span>
    );
  }
  function Disc({ sym }) {
    return <span style={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: 20, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: sym.length > 4 ? 8.5 : 10, fontWeight: 800, color: 'var(--c-text)' }}>{sym}</span>;
  }
  /** One stock row: the "+" left, the star right (rule 3: never beside Buy or Claim). */
  function Row({ x, t, sym, sub, price, change, plus, claim, saved, changeWord = 'today' }) {
    const st = x > 1;
    const right = (
      <span style={{ display: 'grid', justifyItems: st ? 'start' : 'end' }}>
        <b className="dr-num" style={{ ...fs(16, x), color: 'var(--c-text)' }}>{price}</b>
        {change ? <span className="dr-num" style={{ ...fs(13, x), fontWeight: 700, color: sign(change) }}>{`${change} ${changeWord}`}</span> : null}
      </span>
    );
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--c-border)' }}>
        {plus ? <Plus claim={claim} t={t} /> : <span style={{ width: 40, flex: '0 0 40px' }} />}
        <Disc sym={sym} />
        <span style={{ flex: 1, minWidth: 0, display: 'grid' }}>
          <b style={{ ...fs(16, x), color: 'var(--c-text)' }}>{sym}</b>
          <span style={{ ...fs(13, x), color: 'var(--c-text-2)' }}>{sub}</span>
          {st ? right : null}
        </span>
        {st ? null : right}
        <Star on={saved} x={x} />
      </div>
    );
  }

  function Page({ t = 'light', x = 1, label, children, tabs = true }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: tabs ? 78 : 0, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'hidden' }}>{children}</div>
          {tabs ? <TabBar /> : null}
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  /** Available: the list as built, with the switch above and the star on each row. */
  function Available({ t = 'light', x = 1, closed, label }) {
    return (
      <Page t={t} x={x} label={label}>
        <Pill x={x} /><Switch x={x} on="Available" /><Chips x={x} />
        {AVAILABLE.map(([s, n, c, p], i) => <Row key={s} t={t} x={x} sym={s} sub={`${n} · ${c}`} price={p} plus claim={closed} saved={i === 2} />)}
      </Page>
    );
  }

  /** Watching: the saved stocks in this league. state: list | empty | closed (a claimed row). */
  function Watching({ t = 'light', x = 1, state = 'list', label }) {
    const closed = state === 'closed';
    return (
      <Page t={t} x={x} label={label}>
        <Pill x={x} /><Switch x={x} on="Watching" />
        {state === 'empty' ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, paddingBottom: 60, textAlign: 'center' }}>
            <span style={{ color: 'var(--c-text-2)' }}><Star x={2} /></span>
            <span style={{ ...fs(16, x), color: 'var(--c-text)', fontWeight: 600 }}>Star a stock to watch it here.</span>
          </div>
        ) : WATCH.map(([s, status, p, ch, plus]) => (
          <Row key={s} t={t} x={x} sym={s} sub={closed && s === 'AMGN' ? `Claimed · ${FILLS}` : status} price={p} change={ch} changeWord={closed ? 'Fri' : 'today'} plus={(plus === true || (plus === 'closed' && closed)) && !(closed && s === 'AMGN')} claim={closed} saved />
        ))}
      </Page>
    );
  }

  /** Claims: your waiver position, your pending claims with Cancel, and the endings after a run. */
  function Claims({ t = 'light', x = 1, state = 'pending', label }) {
    const pend = [['AMGN', 'Selling NVDA'], ['SHOP', 'Selling TSLA'], ['LOW', 'From your budget']];
    const endings = [
      ['won', 'AMGN is yours', '$187.20 at the open · paid by selling NVDA'],
      ['lost', 'Gianluigi B. claimed SHOP · lower in the standings', 'Your TSLA was not sold.'],
      ['failed', 'LOW opened at $203.10, above your $100–$200 slot', 'Nothing was bought.'],
    ];
    return (
      <Page t={t} x={x} label={label}>
        <Pill x={x} /><Switch x={x} on="Claims" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-rim)', marginBottom: 12 }}>
          <span style={{ flex: 1, ...fs(15, x), color: 'var(--c-text)' }}>You're <b>3rd</b> of 6 in the waiver order</span>
          <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.right} size={14} width={2.4} /></span>
        </div>
        {state === 'endings' ? (
          <>
            <span style={{ ...fs(11, x), fontWeight: 800, letterSpacing: 1, color: 'var(--c-text-2)', marginBottom: 6 }}>MON 9:30 AM ET</span>
            {endings.map(([kind, title, line]) => (
              <div key={kind} style={{ display: 'grid', gap: 2, padding: '10px 12px', borderRadius: 12, background: kind === 'won' ? 'var(--c-accent-tint)' : 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-rim)', marginBottom: 8 }}>
                <b style={{ ...fs(15, x), color: 'var(--c-text)' }}>{title}</b>
                <span style={{ ...fs(13, x), color: 'var(--c-text-2)' }}>{line}</span>
              </div>
            ))}
          </>
        ) : state === 'empty' ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', paddingBottom: 80 }}><span style={{ ...fs(16, x), color: 'var(--c-text)', fontWeight: 600 }}>No claims pending.</span></div>
        ) : (
          <>
            <span style={{ ...fs(11, x), fontWeight: 800, letterSpacing: 1, color: 'var(--c-text-2)', marginBottom: 4 }}>PENDING</span>
            {pend.map(([s, fund]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
                <Disc sym={s} />
                <span style={{ flex: 1, minWidth: 0, display: 'grid' }}><b style={{ ...fs(16, x), color: 'var(--c-text)' }}>Buy {s}</b><span style={{ ...fs(13, x), color: 'var(--c-text-2)' }}>{fund} · {FILLS}</span></span>
                <span style={{ ...fs(15, x), fontWeight: 700, color: 'var(--c-accent)', padding: '0 4px' }}>Cancel</span>
              </div>
            ))}
          </>
        )}
      </Page>
    );
  }

  /** The waiver order, on tap: the whole league, yours bold on the you-tint (S-10). */
  function WaiverOrder({ t = 'light', x = 1, label }) {
    const order = ['Chiara R.', 'Marco T.', 'Roberto B.', 'Luca V.', 'Paolo M.', 'Gianluigi B.'];
    return (
      <Page t={t} x={x} label={label} tabs={false}>
        <div style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, background: 'var(--c-border-strong)', margin: '8px 0 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <b style={{ ...fs(22, x), color: 'var(--c-text)' }}>Waiver order</b>
          <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.close} size={22} width={2.2} /></span>
        </div>
        {order.map((n, i) => {
          const you = n === 'Roberto B.';
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px', borderRadius: 10, background: you ? 'var(--c-you-tint)' : 'transparent' }}>
              <span className="dr-num" style={{ ...fs(15, x), color: 'var(--c-text-2)', width: 18 }}>{i + 1}</span>
              <span style={{ ...fs(16, x), color: 'var(--c-text)', fontWeight: you ? 800 : 500 }}>{n}</span>
            </div>
          );
        })}
      </Page>
    );
  }

  /** Top movers: the chip under Available. state: open | closed | failed. */
  function Movers({ t = 'light', x = 1, state = 'open', label }) {
    return (
      <Page t={t} x={x} label={label}>
        <Pill x={x} /><Switch x={x} on="Available" /><Chips x={x} on="Top movers" />
        {state === 'failed' ? (
          <div style={{ flex: 1, display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 8, paddingBottom: 60, textAlign: 'center' }}>
            <b style={{ ...fs(18, x), color: 'var(--c-text)' }}>Stocks didn't load</b>
            <span style={{ ...fs(15, x), color: 'var(--c-text-2)' }}>Check your connection, then try again.</span>
            <b style={{ ...fs(15, x), color: 'var(--c-accent)' }}>Try again</b>
          </div>
        ) : MOVERS.map(([s, n, p, ch]) => (
          <Row key={s} t={t} x={x} sym={s} sub={n} price={p} change={ch} changeWord={state === 'closed' ? 'Fri' : 'today'} plus claim={state === 'closed'} saved={s === 'PLTR'} />
        ))}
      </Page>
    );
  }

  /** A stock's sheet. mode: open (Save) | saved | closed (Claim) | full (the 51st save refused). */
  function Sheet({ t = 'light', x = 1, mode = 'open', label }) {
    const closed = mode === 'closed';
    const saved = mode !== 'open';
    return (
      <Page t={t} x={x} label={label} tabs={false}>
        <div style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, background: 'var(--c-border-strong)', margin: '8px 0 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Disc sym="AMGN" />
          <span style={{ flex: 1, minWidth: 0, display: 'grid' }}><b style={{ ...fs(20, x), color: 'var(--c-text)' }}>AMGN</b><span style={{ ...fs(14, x), color: 'var(--c-text-2)' }}>Amgen</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 16, boxShadow: saved ? 'none' : 'inset 0 0 0 1.5px var(--c-border-strong)', background: saved ? 'var(--c-accent-tint)' : 'transparent', color: saved ? 'var(--c-live-text)' : 'var(--c-text)', ...fs(14, x), fontWeight: 700 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d={STAR} /></svg>{saved ? 'Saved' : 'Save'}
          </span>
          <span style={{ color: 'var(--c-text-2)', display: 'grid', marginLeft: 4 }}><Icon d={ICON.close} size={22} width={2.2} /></span>
        </div>
        <b className="dr-num" style={{ ...fs(34, x, 1.15), color: 'var(--c-text)', marginTop: 14 }}>$187.20</b>
        <span className="dr-num" style={{ ...fs(14, x), color: 'var(--c-gain)', fontWeight: 700 }}>+$2.58 (+1.40%) {closed ? 'Fri' : 'today'}</span>
        <svg viewBox="0 0 340 110" style={{ width: '100%', height: 110, margin: '12px 0' }}><polyline fill="none" stroke="var(--c-gain)" strokeWidth="2.5" points="0,90 40,84 80,88 120,70 160,74 200,52 240,58 280,36 340,22" /></svg>
        <div style={{ flex: 1 }} />
        {mode === 'full' ? (
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--c-warn-tint)', border: '1px solid var(--c-warn-line)', color: 'var(--c-warn-text)', fontWeight: 700, ...fs(15, x, 1.6), marginBottom: 10 }}>Your watchlist is full (50). Remove one to add another.</div>
        ) : null}
        {closed ? <span style={{ ...fs(14, x), color: 'var(--c-text-2)', textAlign: 'center', marginBottom: 8 }}>Market's closed. Opens Mon 9:30 AM ET.</span> : null}
        <span style={{ display: 'grid', placeItems: 'center', minHeight: 50, borderRadius: 25, background: closed ? CLAIM[t] : 'var(--c-accent)', color: closed ? (t === 'light' ? '#fff' : '#080D25') : 'var(--c-on-accent)', ...fs(17, x), fontWeight: 800, marginBottom: 26 }}>{closed ? 'Claim' : 'Review buy'}</span>
      </Page>
    );
  }

  /** The claim composer: the trade review, re-labelled (the October plan). refuse: the 6th claim. */
  function Composer({ t = 'light', x = 1, refuse, label }) {
    const row = (a, b) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--c-border)', ...fs(15, x) }}><span style={{ color: 'var(--c-text-2)' }}>{a}</span><span style={{ color: 'var(--c-text)', fontWeight: 600, textAlign: 'right' }}>{b}</span></div>;
    return (
      <Page t={t} x={x} label={label} tabs={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 6px' }}>
          <span style={{ ...fs(15, x), color: 'var(--c-text-2)' }}>Tier Cup</span>
          <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.close} size={22} width={2.2} /></span>
        </div>
        <b style={{ ...fs(28, x, 1.2), color: 'var(--c-text)', margin: '4px 0 8px' }}>Claim AMGN</b>
        {row('Buy', '1 AMGN')}
        {row('Price', 'Monday’s opening price')}
        {row('Last close', '$187.20 · Fri')}
        <span style={{ ...fs(11, x), fontWeight: 800, letterSpacing: 1, color: 'var(--c-text-2)', margin: '14px 0 4px' }}>PAID BY</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
          <Disc sym="NVDA" />
          <span style={{ flex: 1, display: 'grid' }}><b style={{ ...fs(15, x), color: 'var(--c-text)' }}>Selling NVDA</b><span className="dr-num" style={{ ...fs(13, x), color: 'var(--c-text-2)' }}>1 sh · $323.05 at Fri close</span></span>
          <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.right} size={14} width={2.4} /></span>
        </div>
        {row('Fits', 'Your $200–$400 slot, once NVDA is sold')}
        {row('As of', 'Friday’s close')}
        <div style={{ flex: 1 }} />
        {refuse ? <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--c-warn-tint)', border: '1px solid var(--c-warn-line)', color: 'var(--c-warn-text)', fontWeight: 700, ...fs(15, x, 1.6), marginBottom: 10 }}>5 claims pending. Cancel one to claim another.</div> : null}
        <span style={{ display: 'grid', placeItems: 'center', minHeight: 50, borderRadius: 25, background: CLAIM[t], color: t === 'light' ? '#fff' : '#080D25', opacity: refuse ? 0.45 : 1, ...fs(17, x), fontWeight: 800, marginBottom: 26, textAlign: 'center', padding: '0 12px' }}>Claim · {FILLS}</span>
      </Page>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const Sub = ({ children }) => <h3 className="b-sub">{children}</h3>;

  const NEW_WORDS = [
    ['Available', 'the first view of the switch (the stocks nobody in the league owns)'],
    ['Watching', 'the second view (your saved stocks in this league)'],
    ['Top movers', 'the chip under Available'],
    ['Star a stock to watch it here.', 'Watching, when nothing is saved'],
    ['No claims pending.', 'Claims, when you have none'],
    ['"+11.2% Fri"', 'a mover or a saved stock while the market is closed: the last session’s change, named by its day (the same "Fri" as "at Fri close")'],
    ['MON 9:30 AM ET', 'the small label over the endings in Claims (the October endings carried it as "Claims · Mon 9:30 AM ET")'],
  ];
  const APPROVED = 'Claim, Claims, Save, Saved, Waiver order, Pending, Cancel, the five status lines, "Claimed · fills Mon 9:30 AM ET", the composer’s words, "Claim · fills Mon 9:30 AM ET", the three endings, "Your watchlist is full (50). Remove one to add another." and "5 claims pending. Cancel one to claim another." (the October plan, approved 2026-10-09); "Stocks didn’t load", "Check your connection, then try again.", "Try again" and "Market’s closed. Opens Mon 9:30 AM ET." (in the app today).';

  function CallStocksTabLists({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-stocks-tab-lists" aria-labelledby="call-stocks-tab-lists-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Stocks</span>
          <div>
            <h2 id="call-stocks-tab-lists-h">{archived ? 'Decided: the Stocks tab’s lists' : 'Your call: the Stocks tab’s lists'}</h2>
            <p className="b-job">Your picks, drawn whole: the switch at the top, a star on every stock, your watchlist, your claims, and Top movers. Market open on Thursday, closed on Friday evening, the claims run Monday at 9:30.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>The switch</b> sits under the league pill, the same control as Matchup’s. The chips stay under the first view only.</li>
          <li><b>The star</b> is at the right edge of every row, the “+” at the left. On a stock’s sheet it is the Save button in the header, far from Buy and Claim.</li>
          <li><b>After the close,</b> the “+” and the sheet’s button turn brown and open a claim, as you picked on the 18th. The warning brown they were drawn in is teal now, so a claim takes the palette’s own brown (the Retail rust).</li>
          <li><b>Watching</b> shows each saved stock’s ticker and whether you can get it here, with the current price and today’s change. A stock you can get keeps its “+”.</li>
          <li><b>Claims</b> shows your place in the waiver order (the whole order on tap), your pending claims with Cancel, and after the run what happened to each.</li>
          <li><b>Top movers</b> lists up to 25 stocks nobody in the league owns, biggest move first, up or down. While the market is closed it shows Friday’s movers, each labelled “Fri”; if the ranking is old while the market is open, it says it didn’t load.</li>
          <li><b>New words, for your yes</b> (strike any you don’t want):
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {NEW_WORDS.map(([w, where]) => <li key={w}><b>{w}</b> · {where}</li>)}
            </ul>
          </li>
          <li><b>Already approved, reused:</b> {APPROVED}</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> yes, or the words to change.</>}</li>
        </ul>

        <Sub>1 · The switch, the star, the chips</Sub>
        <Grid>{[
          fig('a1', 'Available · open', <Available label="Stocks tab, Available, market open" />, 'AVGO’s star is filled: you saved it. The “+” is the buy, as today.'),
          fig('a2', 'Available · your text size', <Available x={AX5} label="Stocks tab, Available, largest text size" />, 'The price drops under the name, as built; the star stays at the right.'),
          fig('a3', 'Available · Dark', <Available t="dark" label="Stocks tab, Available, Dark" />),
          fig('a4', 'Available · closed', <Available closed label="Stocks tab, Available, market closed" />, 'Every “+” turns brown: it opens a claim.'),
        ]}</Grid>

        <Sub>2 · The star on a stock’s sheet</Sub>
        <Grid>{[
          fig('s1', 'Not saved', <Sheet label="Stock sheet, not saved" />, 'Save sits in the header; Review buy stays at the bottom.'),
          fig('s2', 'Saved', <Sheet mode="saved" label="Stock sheet, saved" />),
          fig('s3', 'Saved · your text size', <Sheet x={AX5} mode="saved" label="Stock sheet, saved, largest text size" />),
          fig('s4', 'The 51st save', <Sheet mode="full" label="Stock sheet, watchlist full" />, 'The refusal panel, in the new teal.'),
        ]}</Grid>

        <Sub>3 · Watching</Sub>
        <Grid>{[
          fig('w1', 'Watching · open', <Watching label="Watching, market open" />, 'One status line per stock; a price we don’t have reads “—”. COST gets its “+” only after the close, when a claim can name the sale that frees the slot (October ruling 13a).'),
          fig('w2', 'Watching · your text size', <Watching x={AX5} label="Watching, largest text size" />),
          fig('w3', 'Watching · Dark', <Watching t="dark" label="Watching, Dark" />),
          fig('w4', 'Watching · closed, after a claim', <Watching state="closed" label="Watching, market closed, a claim placed" />, 'AMGN reads “Claimed · fills Mon 9:30 AM ET”; its star doesn’t change.'),
          fig('w5', 'Watching · nothing saved', <Watching state="empty" label="Watching, empty" />),
        ]}</Grid>

        <Sub>4 · Claiming after the close</Sub>
        <Grid>{[
          fig('c1', 'A stock’s sheet · closed', <Sheet mode="closed" label="Stock sheet, market closed" />, 'Claim takes Buy’s place, the same size.'),
          fig('c2', 'The claim', <Composer label="Claim composer" />, '× closes without claiming.'),
          fig('c3', 'The 6th claim', <Composer refuse label="Claim composer, five claims pending" />),
          fig('c4', 'The claim · your text size', <Composer x={AX5} label="Claim composer, largest text size" />),
        ]}</Grid>

        <Sub>5 · Claims</Sub>
        <Grid>{[
          fig('k1', 'Claims · pending', <Claims label="Claims, three pending" />, 'Only your own claims: nobody sees anyone else’s.'),
          fig('k2', 'Claims · your text size', <Claims x={AX5} label="Claims, largest text size" />),
          fig('k3', 'Claims · Dark', <Claims t="dark" label="Claims, Dark" />),
          fig('k4', 'The waiver order, on tap', <WaiverOrder label="Waiver order" />, 'The whole league sees it, like the standings.'),
          fig('k5', 'After the run · Monday 9:30', <Claims state="endings" label="Claims, the three endings" />, 'Won, lost and failed, one each. Each also arrives as a notification.'),
          fig('k6', 'Claims · none', <Claims state="empty" label="Claims, none pending" />),
        ]}</Grid>

        <Sub>6 · Top movers</Sub>
        <Grid>{[
          fig('m1', 'Top movers · open', <Movers label="Top movers, market open" />, 'Biggest move first, up or down; price and change from the live lookup.'),
          fig('m2', 'Top movers · your text size', <Movers x={AX5} label="Top movers, largest text size" />),
          fig('m3', 'Top movers · Dark', <Movers t="dark" label="Top movers, Dark" />),
          fig('m4', 'Top movers · closed', <Movers state="closed" label="Top movers, market closed" />, 'Friday’s movers, labelled “Fri”; the “+” claims.'),
          fig('m5', 'The ranking is old', <Movers state="failed" label="Top movers, didn't load" />, 'The existing “didn’t load” state, word for word.'),
        ]}</Grid>
      </section>
    );
  }

  window.KSStocksTabLists = () => null;
  window.KSStocksTabListsArchived = () => <CallStocksTabLists archived decidedNote={<><b>Decided 2026-11-22:</b> “yes to all the words”. Every new word above is approved, on the board as drawn.</>} />;
})();
