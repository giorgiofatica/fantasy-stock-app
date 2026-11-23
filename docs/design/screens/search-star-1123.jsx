// Stockpile key-screens board — "Your call: the star in search results" (2026-11-23). The Stocks tab's
// board (#call-stocks-tab-lists, decided 2026-11-22) drew the star on the list, Watching and Top movers, but
// never on search. Search's rows as built: the ticker disc, the ticker, a status line ("You own this",
// "Owned by …", "No free slot", or none), the company, the price; a stock not in the league's list is dimmed
// with "Not in this league's list" and is not a button. A yes/no: the star on every result except that one.
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

  // [ticker, status, company, price, saved, kind]; kind: mine (your colour) | off (not in the league's list).
  const RESULTS = [
    ['JPM', null, 'JPMorgan Chase', '$301.55', false],
    ['JNJ', null, 'Johnson & Johnson', '$176.20', true],
    ['JD', 'Owned by Paolo M.', 'JD.com', '$33.48', false],
    ['JBL', 'You own this', 'Jabil', '$141.06', false, 'mine'],
    ['JCI', 'No free slot', 'Johnson Controls', '$82.40', false],
    ['JOBY', "Not in this league's list", 'Joby Aviation', '$6.12', false, 'off'],
  ];

  function Star({ on, x }) {
    const s = Math.round(20 * k(x, 1.3));
    return (
      <span style={{ width: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center', color: on ? 'var(--c-accent)' : 'var(--c-text-2)' }}>
        <svg width={s} height={s} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d={STAR} /></svg>
      </span>
    );
  }

  function Search({ t = 'light', x = 1, stars = true, label }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 78, padding: '8px 16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexShrink: 0 }}>
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 12, background: 'var(--c-inset)', boxShadow: 'inset 0 0 0 1.5px var(--c-accent)', color: 'var(--c-text)', ...fs(16, x, 1.6) }}><Icon d={ICON.search} size={16} width={2.4} />J</span>
              <span style={{ ...fs(16, x), color: 'var(--c-accent)', fontWeight: 600 }}>Cancel</span>
            </div>
            {RESULTS.map(([sym, status, co, price, saved, kind]) => {
              const off = kind === 'off';
              const st = x > 1;
              const priceEl = <b className="dr-num" style={{ ...fs(16, x), color: 'var(--c-text)', fontWeight: 800 }}>{price}</b>;
              return (
                <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', opacity: off ? 0.45 : 1, flexShrink: 0 }}>
                  <span style={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: 20, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: sym.length > 3 ? 9 : 10.5, fontWeight: 800, color: 'var(--c-text)' }}>{sym}</span>
                  <span style={{ flex: 1, minWidth: 0, display: 'grid' }}>
                    <b style={{ ...fs(16, x), color: 'var(--c-text)' }}>{sym}</b>
                    {status ? <span style={{ ...fs(13, x), fontWeight: 700, color: kind === 'mine' ? 'var(--c-you-text)' : 'var(--c-text-2)' }}>{status}</span> : null}
                    <span style={{ ...fs(13, x), color: 'var(--c-text-2)' }}>{co}</span>
                    {st ? priceEl : null}
                  </span>
                  {st ? null : priceEl}
                  {stars ? (off ? <span style={{ width: 36, flex: '0 0 36px' }} /> : <Star on={saved} x={x} />) : null}
                </div>
              );
            })}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', paddingTop: 8 }}>
            {[[ICON.home, 'Home'], [ICON.matchup, 'Matchup'], [ICON.league, 'League'], [ICON.portfolio, 'Portfolio'], [STORE, 'Stocks']].map(([d, l]) => (
              <span key={l} style={{ display: 'grid', justifyItems: 'center', gap: 2, color: l === 'Stocks' ? 'var(--c-accent)' : 'var(--c-text-2)', fontSize: 10, fontWeight: 600 }}><Icon d={d} size={22} width={2} />{l}</span>
            ))}
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );

  function CallSearchStar({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-search-star" aria-labelledby="call-search-star-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Stocks</span>
          <div>
            <h2 id="call-search-star-h">{archived ? 'Decided: the star in search results' : 'Your call: the star in search results'}</h2>
            <p className="b-job">Search wasn’t on the Stocks tab’s board. The star goes at the right edge of each result, as on the list.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A star on every result you could ever watch:</b> a free stock, one you own, one someone else owns (you can watch it until they sell), and one with no free slot for you.</li>
          <li><b>No star on “Not in this league’s list”:</b> that stock can never be bought or claimed here, so watching it would do nothing. Its row is already greyed and can’t be tapped.</li>
          <li><b>No new words.</b></li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> yes or no.</>}</li>
        </ul>
        <div className="b-concepts b-concepts--three">{[
          fig('q1', 'Search with the star', <Search label="Stock search with stars" />, 'JNJ’s star is filled: you saved it.'),
          fig('q2', 'Your text size', <Search x={AX5} label="Stock search with stars, largest text size" />, 'The price drops under the company, as built; the star stays at the right.'),
          fig('q3', 'Dark', <Search t="dark" label="Stock search with stars, Dark" />),
          fig('q0', 'Search today', <Search stars={false} label="Stock search today, no stars" />, 'As built, for comparison.'),
        ]}</div>
      </section>
    );
  }

  window.KSSearchStar = () => <CallSearchStar />;
})();
