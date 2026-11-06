// Stockpile key-screens board — "Your call: the clock while you search" (2026-11-06, after #340 and
// the top bar's A). On your running clock the draft room scrolls the search up to the top so its
// results clear the keyboard; the clock card sits above the draft board, so it scrolls off the screen
// exactly while you choose, with 60-second picks. A: a small pinned clock. B: on your clock the search
// sits right under the clock card, so both stay in view. Large and AX5 (approximate), both themes.
(function () {
  const { Device, $ } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, G, NEW } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const ROW = 1.3;
  const CARD = 1.6;
  const ell = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
  const KB = 336; // the keyboard, with its suggestion strip and home bar

  const RESULTS = [
    { t: 'AAPL', co: 'Apple Inc.', p: 211.42 },
    { t: 'AMD', co: 'Advanced Micro Devices', p: 160.0, owned: true },
    { t: 'AMZN', co: 'Amazon.com Inc.', p: 236.4, owned: true },
    { t: 'AVGO', co: 'Broadcom Inc.', p: 184.5 },
  ];

  /** The clock as it is today: ring + "You're on the clock" + round and pick (Giorgio's 2026-10-13 card). */
  function ClockCard({ x }) {
    const ring = Math.round(74 * k(x, 1.3));
    return (
      <div style={{ background: 'var(--c-accent-tint)', boxShadow: 'inset 0 0 0 2px var(--c-live)', borderRadius: 16, padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
        <svg width={ring} height={ring} viewBox="0 0 74 74" aria-hidden="true" style={{ flex: 'none' }}>
          <circle cx="37" cy="37" r="31" fill="none" stroke="var(--c-track)" strokeWidth="6" />
          <circle cx="37" cy="37" r="31" fill="none" stroke="var(--c-live)" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 31} strokeDashoffset={2 * Math.PI * 31 * 0.3} transform="rotate(-90 37 37)" />
          <text x="37" y="44" textAnchor="middle" fontSize="20" fontWeight="900" fill="var(--c-text)">0:42</text>
        </svg>
        <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
          <span style={{ ...fs(26, x, CARD, 1.08), fontWeight: 900, color: 'var(--c-live-text)' }}>You're on the clock</span>
          <span className="dr-call" style={{ ...fs(15, x, CARD), fontWeight: 700 }}>Round 2 of 6 · Pick 11</span>
        </div>
      </div>
    );
  }
  /** A: the small clock pinned at the top while the card is off screen. The same ring, the seconds, "Your pick". */
  function ClockChip({ x }) {
    const r = Math.round(22 * k(x, 1.3));
    return (
      <div style={{ position: 'absolute', top: 0, left: G, right: G, zIndex: 4, display: 'flex', justifyContent: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: `6px 14px 6px 8px`, borderRadius: 999, background: 'var(--c-accent-tint)', boxShadow: 'inset 0 0 0 2px var(--c-live), 0 4px 14px rgba(0,0,0,.12)', backdropFilter: 'blur(12px)' }}>
          <svg width={r} height={r} viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" fill="none" stroke="var(--c-track)" strokeWidth="3" /><circle cx="11" cy="11" r="9" fill="none" stroke="var(--c-live)" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 9} strokeDashoffset={2 * Math.PI * 9 * 0.3} transform="rotate(-90 11 11)" /></svg>
          <span className="dr-num" style={{ ...fs(17, x, ROW), fontWeight: 900, color: 'var(--c-text)' }}>0:42</span>
          <span style={{ ...fs(15, x, ROW), fontWeight: 800, color: 'var(--c-live-text)' }}>Your pick</span>
        </span>
      </div>
    );
  }
  function SearchCard({ x }) {
    return (
      <div className="dr-card" style={{ padding: 16, boxShadow: 'inset 0 0 0 1px var(--c-border)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div style={{ minHeight: Math.round(48 * k(x, 2.4)), padding: '0 14px', borderRadius: '8px 8px 0 0', background: 'var(--c-inset)', boxShadow: 'inset 0 0 0 1px var(--c-border)', display: 'flex', alignItems: 'center' }}>
          <span style={{ ...fs(18, x), color: 'var(--c-text)' }}>A<span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--c-accent)', marginLeft: 1, verticalAlign: '-0.12em' }} /></span>
        </div>
        <div style={{ boxShadow: 'inset 1px 0 0 var(--c-border), inset -1px 0 0 var(--c-border), inset 0 -1px 0 var(--c-border)', borderRadius: '0 0 8px 8px', padding: '4px 14px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {RESULTS.map((r) => (
            <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, opacity: r.owned ? 0.55 : 1 }}>
              <span style={{ flex: 1, minWidth: 0, display: 'grid' }}>
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 }}>
                  <span className="dr-t" style={fs(16, x, ROW)}>{r.t}</span>
                  {r.owned ? <span style={{ ...fs(11, x, ROW), fontWeight: 800, padding: '0 5px', borderRadius: 4, boxShadow: 'inset 0 0 0 1px var(--c-warn-text)', color: 'var(--c-warn-text)' }}>ALREADY OWNED</span> : null}
                </span>
                <span className="dr-cap" style={{ ...fs(12, x, ROW), ...ell }}>{r.co}</span>
              </span>
              <span className="dr-num dr-muted" style={{ ...fs(14, x, ROW), fontWeight: 600 }}>{$(r.p)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  /** The keyboard, drawn as a block (its height is what matters here). */
  const Keyboard = () => (
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: KB, zIndex: 6, background: 'color-mix(in srgb, var(--c-inset) 92%, var(--c-text) 8%)', borderRadius: '28px 28px 0 0', padding: '52px 6px 0', display: 'grid', gap: 10, alignContent: 'start' }}>
      {[10, 9, 9, 3].map((n, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {Array.from({ length: n }, (_, j) => <span key={j} style={{ height: 44, flex: i === 3 && j === 1 ? 4 : 1, maxWidth: i === 3 && j === 1 ? 'none' : 36, borderRadius: 7, background: 'var(--c-surface)', opacity: 0.9 }} />)}
        </div>
      ))}
    </div>
  );

  /** v: today | A | B, scrolled as the reveal leaves it (B: the clock card at the top), the keyboard up. */
  function RoomK(props) {
    const label = props.v;
    return (
      <div className={`dr dir-a${props.t === 'light' ? ' dir-a-light' : ''}`}>
        <Device tab="league" noTabs overlay={<Keyboard />} label={`Draft room on your clock, typing with the keyboard up, ${{ today: 'today: the clock is off screen', A: 'option A: a small clock pinned at the top', B: 'option B: the search under the clock card' }[label]}, ${props.x > 1 ? 'your size (AX5, approximate)' : 'Large'}, ${props.t}`}>
          <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
            {props.v === 'A' ? <ClockChip x={props.x || 1} /> : null}
            <div style={{ padding: `${props.v === 'A' ? Math.round(44 * k(props.x || 1, ROW)) + 12 : 12}px ${G}px 0`, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
              {props.v === 'B' ? <ClockCard x={props.x || 1} /> : null}
              <SearchCard x={props.x || 1} />
            </div>
          </div>
        </Device>
      </div>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const AX_NOTE = 'An approximation of your text size. The build gate checks the real thing.';
  const four = (v, cap, notes = {}) => [
    fig(`${v}ld`, `${cap} · Large · Dark`, <RoomK t="dark" v={v} />, notes.l),
    fig(`${v}ll`, `${cap} · Large · Light`, <RoomK t="light" v={v} />, notes.l),
    fig(`${v}xd`, `${cap} · your size (AX5) · Dark`, <RoomK t="dark" v={v} x={2.4} />, notes.x || AX_NOTE),
    fig(`${v}xl`, `${cap} · your size (AX5) · Light`, <RoomK t="light" v={v} x={2.4} />, notes.x || AX_NOTE),
  ];

  function CallClock({ archived }) {
    return (
      <section className="b-sec" id="call-draft-clock" aria-labelledby="call-draft-clock-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Draft</span>
          <div>
            <h2 id="call-draft-clock-h">{archived ? 'Decided: A, the clock while you search' : 'Your call: the clock while you search'}</h2>
            <p className="b-job">On your turn you type in the search, and the screen scrolls the search up so its results clear the keyboard (the build-10 fix). The clock card sits above the draft board, so it goes off the screen exactly while you choose, with 60-second picks. Nothing on screen says how long you have left until you scroll back up. Drawn typing "A" with the results open, the way the screen sits after it scrolls.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Today</b> (with the top bar's A): the search and its results at the top, the keyboard below. No clock anywhere.</li>
          <li><b>A · A small clock pinned at the top.</b> While it's your pick and the clock card is off screen, a small pill holds the top of the screen: the same ring, the seconds, and "Your pick" <NEW />. It goes away when the card scrolls back into view, when you pick, or when your turn ends. At your size the field and four results still fit above the keyboard. <b>Cost: small to medium.</b> A new piece that watches whether the card is on screen (the way Standings already pins your row).</li>
          <li><b>B · The search sits right under the clock card.</b> Only on your turn (the search is only there on your turn anyway): the order becomes clock, search, then the draft board. The scroll stops at the clock card instead of the search, so the clock, the field and the results show together above the keyboard. No new words. At your size the clock card is tall, so only one or two results fit above the keyboard; the rest scroll inside their box. <b>Cost: small.</b> Two blocks swap places on your turn, and the scroll aims at the clock card.</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-06): "A for clock".</b> The small clock pinned at the top while the card is off the screen; "Your pick" approved with it. Rules: PRODUCT_RULES, "The clock while you search".</li> : null}
          <li><b>Recommended: A.</b> At your size, which is how you play, B leaves room for one or two results while A keeps the clock and four results in view. A also leaves the room's order as it is (clock, draft board, search). At the standard size both work; B's advantage there is that it adds nothing new. Pick B if you'd rather have no new piece and accept fewer results at your size.</li>
          <li><b>New words:</b> A only, "Your pick". B has none.</li>
        </ul>
        <h3 className="b-sub">Today: the clock is off the screen while you search</h3>
        <Grid>{[
          fig('tl', 'Today · Large · Light', <RoomK t="light" v="today" />, 'The clock card is above the draft board, scrolled away.'),
          fig('tx', 'Today · your size (AX5) · Light', <RoomK t="light" v="today" x={2.4} />, AX_NOTE),
        ]}</Grid>
        <h3 className="b-sub">A · A small clock pinned at the top (recommended)</h3>
        <Grid>{four('A', 'A')}</Grid>
        <h3 className="b-sub">B · On your turn, the search sits under the clock card</h3>
        <Grid>{four('B', 'B', { x: 'At your size the clock card is tall, so one or two results show above the keyboard; the rest scroll inside the list. An approximation of your text size.' })}</Grid>
      </section>
    );
  }

  // Decided 2026-11-06 (A); the call lives in the Archive (board.jsx).
  window.KSDraftClock = () => null;
  window.KSDraftClockArchived = () => <CallClock archived />;
})();
