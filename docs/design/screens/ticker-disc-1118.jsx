// Stockpile key-screens board — "Your call: a long ticker in its round badge" (2026-11-18). The round badge at
// the left of every stock row (Holdings, the Stocks list, search) is a fixed 40pt circle whose 13pt text may
// not shrink under 11pt (the app's smallest-text rule), so GOOGL, BRK.B and even AMGN get cut to "GO…".
// Cutting to letters ("GOOG") would show a different stock. Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;

  const ROWS = [
    ['GOOGL', 'Alphabet', 'Technology', '$268.41'],
    ['BRK.B', 'Berkshire Hathaway', 'Financials', '$487.92'],
    ['AMGN', 'Amgen', 'Healthcare', '$282.40'],
    ['MSFT', 'Microsoft', 'Technology', '$512.30'],
    ['V', 'Visa', 'Financials', '$291.40'],
    ['JPM', 'JPMorgan Chase', 'Financials', '$301.55'],
  ];
  // Width of a ticker at 13pt ExtraBold, roughly (the app measures real glyph widths).
  // Calibrated to the worker's real glyph measurements (Archivo ExtraBold 13pt: NVDA 39.2, AMZN 40.7, MSFT 38.1).
  const GLYPH = { G: 10.5, O: 10.5, Q: 10.5, M: 12.8, W: 13.5, Z: 8.3, F: 8.2, T: 8.4, S: 8.8, J: 8, L: 8.2, I: 4.5, '.': 4 };
  const w13 = (s) => [...s].reduce((a, c) => a + (GLYPH[c] ?? 9.8), 0);
  const ROOM = 36;

  function Disc({ sym, v }) {
    const natural = w13(sym);
    const base = { height: 40, borderRadius: 20, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontWeight: 800, color: 'var(--c-text)', overflow: 'hidden', whiteSpace: 'nowrap' };
    if (v === 'today') {
      const scale = Math.max(0.85, Math.min(1, ROOM / natural));
      const fits = natural * scale <= ROOM;
      const shown = fits ? sym : `${sym.slice(0, 2)}…`;
      return <span style={{ ...base, width: 40, flex: '0 0 40px', fontSize: 13 * scale }}>{shown}</span>;
    }
    if (v === 'A') {
      const scale = Math.min(1, ROOM / natural);
      return <span style={{ ...base, width: 40, flex: '0 0 40px', fontSize: 13 * scale }}>{sym}</span>;
    }
    const scale = Math.max(0.85, Math.min(1, ROOM / natural));
    const width = Math.max(40, Math.ceil(natural * scale + 12));
    return <span style={{ ...base, width, flex: `0 0 ${width}px`, fontSize: 13 * scale }}>{sym}</span>;
  }

  function Phone({ t = 'light', v, label }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          <div style={{ position: 'absolute', top: 70, left: 16, right: 16, display: 'grid' }}>
            {ROWS.map(([sym, name, cat, price]) => (
              <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
                <span style={{ width: 26, height: 26, flex: '0 0 26px', borderRadius: 13, background: 'var(--c-accent)', color: 'var(--c-on-accent)', display: 'grid', placeItems: 'center' }}><Icon d={ICON.plus} size={14} width={3} /></span>
                <Disc sym={sym} v={v} />
                <span style={{ flex: 1, minWidth: 0, display: 'grid' }}><b style={{ fontSize: 16, color: 'var(--c-text)' }}>{sym}</b><span style={{ fontSize: 13, color: 'var(--c-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${name} · ${cat}`}</span></span>
                <b className="dr-num" style={{ fontSize: 16, color: 'var(--c-text)' }}>{price}</b>
              </div>
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
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;

  function CallTickerDisc({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-ticker-disc" aria-labelledby="call-ticker-disc-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Stocks</span>
          <div>
            <h2 id="call-ticker-disc-h">{archived ? 'Decided: a long ticker in its round badge' : 'Your call: a long ticker in its round badge'}</h2>
            <p className="b-job">{'The round badge beside each stock is too small for five-letter tickers, so today GOOGL shows as "GO…". Cutting it to letters ("GOOG") would name a different stock.'}</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · the badge text shrinks to fit.</b> Every badge stays the same round size; a long ticker is drawn smaller (about 9pt) inside it.</li>
          <li><b>B · the badge widens.</b> A long ticker gets a wider badge at the usual size, so those rows start their name a little further right.</li>
          <li><b>Recommended: A.</b> The rows stay lined up, and the ticker is written in full, at full size, right beside the badge, so the small badge text is never the only place to read it. It is the one place we would go under the app’s 11pt smallest-text rule.</li>
          <li><b>Where:</b> Holdings, the Stocks list and search all use this badge. It does not grow with your text size, so it looks the same at yours.</li>
          <li><b>No new words.</b></li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <Grid>{[
          fig('dt', 'Today', <Phone v="today" label="Stock rows today, long tickers cut" />, 'GOOGL, BRK.B and AMGN are cut.'),
          fig('da', 'A · shrinks to fit (recommended)', <Phone v="A" label="Stock rows, badge text shrinks to fit, option A" />, 'Same round badge on every row.'),
          fig('db', 'B · the badge widens', <Phone v="B" label="Stock rows, the badge widens, option B" />, 'Rows with a long ticker start further right.'),
          fig('dad', 'A · Dark', <Phone t="dark" v="A" label="Stock rows, option A, Dark" />),
        ]}</Grid>
      </section>
    );
  }

  window.KSTickerDisc = () => <CallTickerDisc />;
})();
