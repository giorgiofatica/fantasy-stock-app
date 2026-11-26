// Stockpile key-screens board — "Your call: the 21 crest icons" (2026-11-25).
// Giorgio: "all 21 go in the first version". The list: docs/plans/2026-11-25-crests.md (amended table, PR #631).
// His own icons: the dog (beat first place), the repeat symbol (back to back), the bear (worst week: the friendly
// face, his pick "B" on #call-crest-bear, 2026-11-26). The other 18 are the Planner's
// ideas, drawn as plain bold shapes. ONE shield for all: one colour, one ink, so every crest differs by its icon's
// SHAPE (the greyscale bar); an earned crest keeps the gold inner rim, the standard crest (everybody's) has none.
// No names: the 21 names are not written yet. Captions describe the drawing, not the crest's name.
// Review notes sit under the art.
(function () {
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const FIELD = '#3F4A5E';
  const INK = '#F3E6C8';
  const GOLD = '#F0C44C';
  // Every icon is drawn on a 24 grid in INK; "holes" are drawn in FIELD, so details survive in one colour.
  const F = (d, extra) => <path d={d} fill={INK} {...extra} />;
  const H = (d, extra) => <path d={d} fill={FIELD} {...extra} />;
  const S = (d, w = 2.6, extra) => <path d={d} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" {...extra} />;
  const star7 = (() => {
    const pts = [];
    for (let i = 0; i < 14; i++) { const r = i % 2 ? 4.1 : 9.6; const a = -Math.PI / 2 + (i * Math.PI) / 7; pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12.6 + r * Math.sin(a)).toFixed(2)}`); }
    return `M${pts.join(' L')} Z`;
  })();
  const chev = (dy) => `M4 ${8.8 + dy} L12 ${3 + dy} L20 ${8.8 + dy} V${12 + dy} L12 ${6.2 + dy} L4 ${12 + dy} Z`;

  const ICON = {
    mark: <g><rect x="3.5" y="12" width="4" height="8" rx="1.5" fill={INK} /><rect x="10" y="8" width="4" height="12" rx="1.5" fill={INK} /><rect x="16.5" y="4" width="4" height="16" rx="1.5" fill={INK} /></g>,
    gavel: <g><g transform="rotate(-45 12 11)"><rect x="6" y="4" width="11" height="5.2" rx="1.2" fill={INK} /><rect x="10.3" y="8.4" width="2.4" height="11" rx="1.1" fill={INK} /></g><rect x="2.5" y="19" width="10" height="2.6" rx="1.1" fill={INK} /></g>,
    flag: <g><rect x="4.5" y="2.5" width="2.2" height="19" rx="1.1" fill={INK} />{F('M6.7 3.6 H19.5 L16.4 8 L19.5 12.4 H6.7 Z')}</g>,
    hook: <g>{S('M15 7.5 V14 A5 5 0 1 1 5 14 L5 11.5')}{S('M5 11.5 L7.8 14', 2.4)}<circle cx="15" cy="4.6" r="2.2" fill="none" stroke={INK} strokeWidth="2" /></g>,
    whistle: <g>{F('M9 8.2 H20.5 V13.2 H14.6 A5.8 5.8 0 1 1 9 8.2 Z')}<circle cx="9" cy="14" r="2" fill={FIELD} /><circle cx="5" cy="6.4" r="1.8" fill="none" stroke={INK} strokeWidth="1.6" /></g>,
    rings: <g><circle cx="8.8" cy="12" r="5.2" fill="none" stroke={INK} strokeWidth="2.6" /><circle cx="15.2" cy="12" r="5.2" fill="none" stroke={INK} strokeWidth="2.6" /></g>,
    bull: <g>{F('M2.4 5.2 C2.6 8.6 5.2 10.4 8.2 10 L8.6 8.2 C6 8.4 3.8 7.4 2.4 5.2 Z')}{F('M21.6 5.2 C21.4 8.6 18.8 10.4 15.8 10 L15.4 8.2 C18 8.4 20.2 7.4 21.6 5.2 Z')}{F('M7.2 10 L4 11.4 L7.5 12.8 Z')}{F('M16.8 10 L20 11.4 L16.5 12.8 Z')}{F('M8 8 H16 C16.8 8 17.2 8.6 17 9.4 L15.6 18.6 C15.4 20 14.4 21 13 21 H11 C9.6 21 8.6 20 8.4 18.6 L7 9.4 C6.8 8.6 7.2 8 8 8 Z')}<circle cx="9.7" cy="12.4" r="0.95" fill={FIELD} /><circle cx="14.3" cy="12.4" r="0.95" fill={FIELD} /><ellipse cx="10.8" cy="18.3" rx="0.8" ry="0.9" fill={FIELD} /><ellipse cx="13.2" cy="18.3" rx="0.8" ry="0.9" fill={FIELD} /></g>,
    bolt: F('M13.5 2 L5 13.5 H11 L10 22 L19 10 H13 Z'),
    dog: <g>{F('M7.2 7.4 C4.2 6.8 2.6 9.4 3 13.6 C3.3 16.4 5.6 16.6 6.6 14.4 L7.6 9.6 Z')}{F('M16.8 7.4 C19.8 6.8 21.4 9.4 21 13.6 C20.7 16.4 18.4 16.6 17.4 14.4 L16.4 9.6 Z')}<ellipse cx="12" cy="12.6" rx="5.6" ry="6.6" fill={INK} stroke={FIELD} strokeWidth="1" /><circle cx="9.6" cy="11.2" r="1.05" fill={FIELD} /><circle cx="14.4" cy="11.2" r="1.05" fill={FIELD} /><ellipse cx="12" cy="15.2" rx="1.7" ry="1.2" fill={FIELD} /></g>,
    bearFace: <g><circle cx="5.6" cy="6.6" r="2.9" fill={INK} /><circle cx="18.4" cy="6.6" r="2.9" fill={INK} /><ellipse cx="12" cy="13" rx="8.4" ry="7.4" fill={INK} stroke={FIELD} strokeWidth="1" /><circle cx="8.7" cy="11" r="1.2" fill={FIELD} /><circle cx="15.3" cy="11" r="1.2" fill={FIELD} /><ellipse cx="12" cy="14" rx="2" ry="1.4" fill={FIELD} /><path d="M8.4 16.2 Q12 20.2 15.6 16.2" fill="none" stroke={FIELD} strokeWidth="1.5" strokeLinecap="round" /></g>,
    cup: <g>{F('M7 3 H17 V9 A5 5 0 0 1 7 9 Z')}{S('M7 5 H4.6 C4.6 8.8 5.8 10.6 7.8 11', 2)}{S('M17 5 H19.4 C19.4 8.8 18.2 10.6 16.2 11', 2)}<rect x="11" y="13.6" width="2" height="4" fill={INK} /><rect x="7.5" y="17.4" width="9" height="3.2" rx="1" fill={INK} /></g>,
    medal: <g>{F('M6.6 2 H10.4 L13.2 9.2 H9.4 Z')}{F('M17.4 2 H13.6 L10.8 9.2 H14.6 Z')}<circle cx="12" cy="15.2" r="5.8" fill={INK} /><circle cx="12" cy="15.2" r="3.4" fill="none" stroke={FIELD} strokeWidth="1.3" /></g>,
    ladder: <g><rect x="5.6" y="2.5" width="2.4" height="19" rx="1" fill={INK} /><rect x="16" y="2.5" width="2.4" height="19" rx="1" fill={INK} />{[6, 10.6, 15.2].map((y) => <rect key={y} x="7.6" y={y} width="8.8" height="2.2" fill={INK} />)}</g>,
    seed: <g><ellipse cx="12" cy="17.6" rx="4.8" ry="3.4" fill={INK} /><rect x="11.1" y="9" width="1.8" height="7" fill={INK} />{F('M11.4 11.4 C8 11.8 5.4 9.6 5.2 6 C8.8 6 11.2 8.2 11.4 11.4 Z')}{F('M12.6 9.8 C13 6.2 15.8 3.9 19.2 4.1 C19 7.7 16.2 10 12.6 9.8 Z')}</g>,
    summit: <g>{F('M1.5 20.5 L9 6.5 L13 13 L16 9 L22.5 20.5 Z')}{H('M9 6.5 L11.1 10.4 L9.9 9.6 L8.6 10.8 L7.4 9.6 Z')}</g>,
    diamond: <g>{F('M7 4 H17 L21 9 L12 21 L3 9 Z')}<path d="M3.6 9 H20.4 M9.2 4.2 L11.4 9 M14.8 4.2 L12.6 9 M11.4 9 L12 20" fill="none" stroke={FIELD} strokeWidth="1" /></g>,
    spoon: <g><ellipse cx="8" cy="8.2" rx="4.2" ry="5.6" transform="rotate(-42 8 8.2)" fill={INK} />{S('M10.6 11 L19.6 20.2', 2.8)}</g>,
    repeat: <g>{S('M4.8 11.4 V9.6 A3.6 3.6 0 0 1 8.4 6 H17.6', 2.4)}{S('M15.2 3 L18.6 6 L15.2 9', 2.4)}{S('M19.2 12.6 V14.4 A3.6 3.6 0 0 1 15.6 18 H6.4', 2.4)}{S('M8.8 21 L5.4 18 L8.8 15', 2.4)}</g>,
    chevrons: <g transform="translate(0 -0.4) scale(1 0.92)">{F(chev(0))}{F(chev(6))}{F(chev(12))}</g>,
    globe: <g><circle cx="12" cy="12" r="8.6" fill="none" stroke={INK} strokeWidth="2.2" /><ellipse cx="12" cy="12" rx="3.6" ry="8.6" fill="none" stroke={INK} strokeWidth="1.8" /><path d="M3.6 12 H20.4 M5 7.8 H19 M5 16.2 H19" fill="none" stroke={INK} strokeWidth="1.6" /></g>,
    star7: F(star7),
  };

  // The 21, by the table's five kinds. [icon, what it's for (the table's row), his?]
  const KINDS = [
    ['Standard', [['mark', 'everybody: the app’s mark (no rim)']]],
    ['Firsts', [['gavel', 'first draft'], ['flag', 'first week won'], ['hook', 'first claim won'], ['whistle', 'started a league'], ['rings', 'a friend joined']]],
    ['In season', [['bull', 'best week'], ['bolt', 'biggest margin'], ['dog', 'beat first place (his)', true], ['bearFace', 'worst week (his: the friendly face)', true]]],
    ['End of season', [['cup', 'champion'], ['medal', 'runner-up'], ['ladder', 'made the playoffs'], ['seed', 'top seed'], ['summit', 'top scorer'], ['diamond', 'unbeaten'], ['spoon', 'last place']]],
    ['Across seasons', [['repeat', 'back to back (his)', true], ['chevrons', 'three seasons'], ['globe', 'two leagues'], ['star7', 'every Mag 7 stock']]],
  ];
  const ALL = KINDS.flatMap(([, list]) => list.map(([k]) => k));

  function Crest({ k, size }) {
    const earned = k !== 'mark';
    const SH = window.KSShieldOutline;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: `0 0 ${size}px` }}>
        <path d={SH} fill={FIELD} />
        <g transform="translate(12 12.3) scale(0.56) translate(-12 -12)">{ICON[k]}</g>
        {earned ? <path d={SH} fill="none" stroke={GOLD} strokeWidth="1.5" transform="translate(12 12.1) scale(0.88) translate(-12 -12.1)" /> : null}
        <path d={SH} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="0.8" />
      </svg>
    );
  }

  /** The set by kind, large, with what each is for under it (board text, not app words). */
  function Sheet({ t, grey }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={`The 21 crests by kind, ${t}${grey ? ', greyscale' : ''}`} style={{ background: 'var(--c-bg)', padding: 20, borderRadius: 16, display: 'grid', gap: 18, filter: grey ? 'grayscale(1)' : 'none', width: 'max-content' }}>
          {KINDS.map(([kind, list]) => (
            <div key={kind} style={{ display: 'grid', gridTemplateColumns: '130px repeat(7, 96px)', alignItems: 'start', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.6, color: 'var(--c-text-2)', paddingTop: 26 }}>{kind.toUpperCase()}</span>
              {list.map(([k, what, his]) => (
                <div key={k} style={{ display: 'grid', justifyItems: 'center', gap: 6, textAlign: 'center' }}>
                  <Crest k={k} size={72} />
                  <span style={{ fontSize: 11.5, lineHeight: '14px', color: his ? 'var(--c-text)' : 'var(--c-text-2)', fontWeight: his ? 700 : 500 }}>{what}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Th>
    );
  }
  /** All 21 in one row at a size: 20 (the page's 20pt) or 60 (how an iPhone draws 20pt). */
  function Row({ t, size, grey }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={`All 21 crests at ${size} pixels, ${t}${grey ? ', greyscale' : ''}`} style={{ background: 'var(--c-bg)', padding: 14, borderRadius: 14, display: 'flex', flexWrap: 'wrap', gap: size > 30 ? 10 : 8, filter: grey ? 'grayscale(1)' : 'none', maxWidth: size > 30 ? 11 * 70 : 'none', width: 'max-content' }}>
          {ALL.map((k) => <Crest key={k} k={k} size={size} />)}
        </div>
      </Th>
    );
  }
  /** The three animals side by side at phone 20pt, and the bear's other style. */
  function Animals({ t, grey }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={`The bull, the dog and the bear at phone size, ${t}${grey ? ', greyscale' : ''}`} style={{ background: 'var(--c-bg)', padding: 14, borderRadius: 14, display: 'flex', gap: 14, alignItems: 'end', filter: grey ? 'grayscale(1)' : 'none', width: 'max-content' }}>
          {['bull', 'dog', 'bearFace'].map((k) => <div key={k} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}><Crest k={k} size={60} /><Crest k={k} size={20} /></div>)}
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0, alignContent: 'start' }}>{node}<figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Col = ({ children }) => <div style={{ display: 'grid', gap: 22, margin: '6px 0 28px', overflowX: 'auto' }}>{children}</div>;
  const Sub = ({ children }) => <h3 className="b-sub">{children}</h3>;

  function CallCrestSet({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-crest-set" aria-labelledby="call-crest-set-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Crests</span>
          <div>
            <h2 id="call-crest-set-h">{archived ? 'Decided: the 21 crest icons' : 'Your call: the 21 crest icons'}</h2>
            <p className="b-job">All 21 on one shield, one icon each, none shared. Your dog, repeat symbol and bear (the face you picked) are in; the other 18 are first drawings of the Planner’s ideas.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>One shield for all:</b> the same colour and the same cream ink on every crest, so each one is told apart by its icon’s shape alone, which is also what makes them all read in grey. Every crest you earn has the gold inner rim; the standard one everybody gets (the app’s three bars) has none.</li>
          <li><b>Plain, bold shapes:</b> each icon is a filled silhouette with its details cut out of it (eyes, a nose, a gem’s facets), which is what survives at 20pt. The rows below show all 21 at 20pt on the page and as your phone draws 20pt (60 pixels).</li>
          <li><b>The three animals</b> part by outline: the bull by its horns out to the sides, the dog by long ears hanging down, the bear by round ears on top. The bear is the friendly face, your pick (“B”).</li>
          <li><b>Hardest at 20pt</b> (judged at the 60 pixels your phone uses): every one of the 21 still differs from the others by shape, in both themes and in grey. Three are weaker: the <b>seven-point star</b> reads as a starburst, and its seven points can’t be counted at that size; the <b>globe</b>’s lines start to merge; and the <b>dog</b> reads by its ears more than its face.</li>
          <li><b>No names.</b> The words under each icon say what it’s for (from the plan’s list); the crests’ names come later with the Planner.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> yes to the set, or the icons to change.</>}</li>
        </ul>

        <Sub>The set, by kind</Sub>
        <Col>
          {fig('sl', 'Light', <Sheet t="light" />)}
          {fig('sd', 'Dark', <Sheet t="dark" />)}
          {fig('sg', 'The whole set in grey', <Sheet t="light" grey />, 'Every crest still differs from every other by its shape.')}
        </Col>

        <Sub>All 21 at 20pt</Sub>
        <Col>
          {fig('r20l', 'On the page (20 pixels) · Light', <Row t="light" size={20} />)}
          {fig('r60l', 'As your phone draws 20pt (60 pixels) · Light', <Row t="light" size={60} />)}
          {fig('r60d', 'As your phone draws 20pt · Dark', <Row t="dark" size={60} />)}
          {fig('r60g', 'As your phone draws 20pt · grey', <Row t="light" size={60} grey />)}
        </Col>

        <Sub>The animals side by side</Sub>
        <Col>
          {fig('al', 'Bull, dog, bear · Light', <Animals t="light" />, 'Each at phone 20pt (60 pixels) with the page’s 20pt under it.')}
          {fig('ag', 'The same in grey', <Animals t="light" grey />)}
        </Col>
      </section>
    );
  }

  window.KSCrestSet = () => <CallCrestSet />;
  window.KSCrestSetArchived = () => null;
})();
