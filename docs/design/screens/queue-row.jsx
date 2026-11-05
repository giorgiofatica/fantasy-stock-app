// Stockpile key-screens board — "Your call: the queue row" (build-9 phone pass, step 16).
// Giorgio: "the queue only shows the ticker name, it should have Corporation Name (with ... if the
// name is too long), ticker, and price." Today a QueueEditor row is the position, the ticker, up,
// down and remove. A and B both add his three fields; they differ in which row they borrow:
// A, the draft room's search result (the list these stocks are queued from); B, Portfolio's
// Holdings row (the ticker disc). Drawn at Large and at his size (AX5), both themes.
(function () {
  const { Device, Icon, ICON, $ } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, Head, NEW, G } = GN;

  // ── Text size. x = the Dynamic Type multiplier (1 = Large, 2.4 ≈ AX5); cap = the app's cap. ──
  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  /** Every line of a row stops at the score's cap (1.3×), as Holdings and Schedule rows do. */
  const ROW = 1.3;
  const TAG = 1.4;

  // ── A sample queue. Prices are samples; the fifth stock's price didn't load. ──
  const QUEUE = [
    { t: 'NVDA', co: 'NVIDIA Corporation', price: 186.42 },
    { t: 'MSFT', co: 'Microsoft Corporation', price: 512.18 },
    { t: 'COST', co: 'Costco Wholesale Corporation', price: 918.3 },
    { t: 'BRK.B', co: 'Berkshire Hathaway Inc. Class B', price: 498.75 },
    { t: 'RKLB', co: 'Rocket Lab Corporation', price: null },
  ];

  const ell = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

  /** Up, down and remove: 44pt each, as today. A move that can't happen isn't drawn; its slot stays. */
  function Controls({ i, n, x }) {
    const size = Math.round(16 * k(x, ROW));
    const slot = (d, on, label) => (
      <span className="dr-muted" aria-label={on ? label : undefined} style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        {on ? <Icon d={d} size={size} width={2.4} /> : null}
      </span>
    );
    return (
      <span style={{ display: 'inline-flex', flex: 'none' }}>
        {slot(ICON.up, i > 0, 'Move up')}
        {slot(ICON.chevron, i < n - 1, 'Move down')}
        {slot(ICON.close, true, 'Remove')}
      </span>
    );
  }
  const Pos = ({ i, x }) => <span className="dr-cap dr-num" style={{ ...fs(12, x, ROW), minWidth: Math.round(20 * k(x, ROW)), flex: 'none' }}>{i + 1}</span>;
  /** The price, a money number (700). No price: a dash, never "$0.00" and never a blank. */
  const Price = ({ p, x }) => (
    <span className={p == null ? 'dr-num dr-muted' : 'dr-num'} style={{ ...fs(15, x, ROW), fontWeight: 700, whiteSpace: 'nowrap', flex: 'none', marginLeft: 'auto' }}>{p == null ? '–' : $(p)}</span>
  );

  // ── Today: the position, the ticker, up / down / remove. ──
  function RowToday({ s, i, n, x }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 44 }}>
        <Pos i={i} x={x} />
        <span className="dr-t" style={{ ...fs(16, x, ROW), flex: 1 }}>{s.t}</span>
        <Controls i={i} n={n} x={x} />
      </div>
    );
  }
  // ── A: the draft room's search result. The ticker over the company; the price on the ticker's
  // line, so the company gets the column's whole width before it truncates. ──
  function RowA({ s, i, n, x }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 52, padding: '4px 0' }}>
        <Pos i={i} x={x} />
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 8, flexWrap: 'wrap' }}>
            <span className="dr-t" style={{ ...fs(16, x, ROW), flex: '1 0 auto' }}>{s.t}</span>
            <Price p={s.price} x={x} />
          </div>
          <span className="dr-cap" style={{ ...fs(12, x, ROW), ...ell }}>{s.co}</span>
        </div>
        <Controls i={i} n={n} x={x} />
      </div>
    );
  }
  // ── B: Portfolio's Holdings row. The ticker disc (40pt, as on Holdings), then the same three
  // fields. Holdings puts its number in a right column; with three 44pt buttons there, that
  // column would leave the company almost no room, so the price rides the ticker's line here too. ──
  function RowB({ s, i, n, x }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 56, padding: '4px 0' }}>
        <Pos i={i} x={x} />
        <span style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--c-inset)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: s.t.length > 4 ? 10 : 11, fontWeight: 800, marginRight: 8 }}>{s.t}</span>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 8, flexWrap: 'wrap' }}>
            <span className="dr-t" style={{ ...fs(16, x, ROW), flex: '1 0 auto' }}>{s.t}</span>
            <Price p={s.price} x={x} />
          </div>
          <span className="dr-cap" style={{ ...fs(12, x, ROW), ...ell }}>{s.co}</span>
        </div>
        <Controls i={i} n={n} x={x} />
      </div>
    );
  }

  // ── The queue card on the League tab before the draft, scrolled to it. ──
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  function Queue({ t, v, x = 1, closed = false }) {
    const Row = { today: RowToday, A: RowA, B: RowB }[v];
    const ax = x > 1;
    return (
      <Th t={t}>
        <Device tab="league" full={!ax} label={`League tab before the draft, Your queue, ${v === 'today' ? 'as build 9 ships it' : `option ${v}`}${closed ? ', market closed' : ''}${ax ? ', Accessibility XXXL (AX5, approximate)' : ''}, ${t}`}>
          <Head />
          <div style={{ padding: `0 ${G}px 24px` }}>
            <div className="dr-card" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
              <span className="dr-tag dr-muted" style={fs(11, x, TAG, 1.27)}>Your queue · {QUEUE.length} of 50</span>
              <span className="dr-cap" style={fs(12, x)}>If you step away, we'll auto-pick from your queue when your time runs out. You can come back any time.</span>
              {closed ? <span className="dr-cap" style={fs(12, x)}>Prices at Wednesday's close.</span> : null}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
                {QUEUE.map((s, i) => <Row key={s.t} s={s} i={i} n={QUEUE.length} x={x} />)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: Math.round(48 * k(x, 1.6)), padding: '0 14px', borderRadius: 8, background: 'var(--c-inset)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
                <span className="dr-muted" style={{ ...fs(18, x), ...ell }}>Search by ticker or name…</span>
              </div>
            </div>
          </div>
        </Device>
      </Th>
    );
  }

  // ── Layout helpers (the note goes under the frame, never inside it) ──
  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const AX_NOTE = 'An approximation of your text size (Accessibility XXXL). The build gate checks the real thing.';
  const four = (v, cap, notes = {}) => [
    fig(`${v}ld`, `${cap} · Large · Dark`, <Queue t="dark" v={v} />, notes.l),
    fig(`${v}ll`, `${cap} · Large · Light`, <Queue t="light" v={v} />, notes.l),
    fig(`${v}xd`, `${cap} · your size (AX5) · Dark`, <Queue t="dark" v={v} x={2.4} />, notes.x || AX_NOTE),
    fig(`${v}xl`, `${cap} · your size (AX5) · Light`, <Queue t="light" v={v} x={2.4} />, notes.x || AX_NOTE),
  ];

  function CallQueueRow({ archived, decided, decidedNote }) {
    return (
      <section className="b-sec" id="call-queue-row" aria-labelledby="call-queue-row-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">League</span>
          <div>
            <h2 id="call-queue-row-h">{archived ? `Decided: ${decided}, the queue row` : 'Your call: the queue row'}</h2>
            <p className="b-job">Your words on build 9 (step 16): "the queue only shows the ticker name, it should have Corporation Name (with ... if the name is too long), ticker, and price." Below: the queue as it ships, then two rows that add all three. The card, the order buttons and the search are the same in both; only the row changes. Each is drawn at the standard size and at yours, in both themes.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Today:</b> the number, the ticker, and up / down / remove. Nothing says what the company is or what it costs.</li>
          <li><b>A · Like the draft room's search.</b> The ticker over the company name, the price on the ticker's line, as the search shows the stocks you queue from. The company gets the whole width left of the buttons and ends in "…" only when it runs out ("Berkshire Hathaway Inc. Cl…"). <b>Cost: small, about a day:</b> the names and prices come the same way the search gets them; the queue itself doesn't change.</li>
          <li><b>B · Like your Holdings.</b> The same three, behind Portfolio's round ticker badge, so a queued stock looks the way it will once you own it. The badge costs the name about 50pt: at Large "Costco Wholesale Corporat…" in A is "Costco Wholesale…" in B. At your size, "Microsoft Corporati…" in A is "Microsoft C…" in B. And a ticker with its price no longer fits on one line, even at Large, so in B the price drops under the ticker and every row grows a line. <b>Cost: the same as A.</b></li>
          <li><b>The price</b> is the stock's latest trade, the same number the draft search shows. While the market is open it's live when you open the card. When it's closed it's the last close, and one line under the card's intro says so: <b>"Prices at Wednesday's close."</b> <NEW /> (the day changes; the same wording as Matchup's approved "Ordered by Wednesday's close"). If a price doesn't load it shows "–", never "$0.00" and never a blank, and the rest of the row stays. While it loads, a grey bar holds its place. We don't fall back to an older stored price: it can be about two days old, and nothing would say so.</li>
          <li><b>At your size:</b> the row's words stop growing at 1.3×, as on Holdings and Schedule, so the buttons stay on the same line and the name keeps its room. A keeps the ticker and price on one line (only the longest ticker, BRK.B, drops its price under it) and shows most of each name; B shows a word of each name and takes three lines a row.</li>
          <li><b>Recommended: A.</b> It gives the name the most room, which is the thing you asked to see. It matches the list you queue from, so a stock reads the same in the search and in your queue. The queue is a list of picks you want, not stocks you own, so Holdings' look would promise something that hasn't happened yet. Pick B if you'd rather the queue preview your roster.</li>
          <li><b>New words, to approve as written:</b> "Prices at Wednesday's close." (only when the market is closed; Monday through Friday by the day). Everything else is a ticker, a company name, a price or "–".</li>
          {archived ? <li>{decidedNote}</li> : null}
        </ul>
        <h3 className="b-sub">Today, as build 9 ships it</h3>
        <Grid>{four('today', 'Today')}</Grid>
        <h3 className="b-sub">A · Like the draft room's search: ticker, company, price</h3>
        <Grid>{four('A', 'A', { l: 'RKLB\'s price didn\'t load, so it shows "–". BRK.B\'s long name ends in "…".' })}</Grid>
        <h3 className="b-sub">B · Like your Holdings: the ticker badge, then the same three</h3>
        <Grid>{four('B', 'B', { l: 'The same five stocks. The round badge takes room from every company name, and the price drops under the ticker.' })}</Grid>
        <h3 className="b-sub">With the market closed (A shown; B the same)</h3>
        <Grid>{[
          fig('cl', 'A · market closed · Large · Light', <Queue t="light" v="A" closed />, 'The prices are Wednesday\'s closes; the new line says so. It goes away when the market opens.'),
          fig('cx', 'A · market closed · your size (AX5) · Light', <Queue t="light" v="A" x={2.4} closed />, AX_NOTE),
        ]}</Grid>
      </section>
    );
  }

  window.KSQueueRow = () => <CallQueueRow />;
})();
