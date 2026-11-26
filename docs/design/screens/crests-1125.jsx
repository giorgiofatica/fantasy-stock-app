// Stockpile key-screens board — "Your call: what a crest looks like" (2026-11-25).
// Plan docs/plans/2026-11-25-crests.md (approved 2026-11-25, "approved both"), open question 1. A crest is drawn
// wherever a manager's mark is drawn today (components/sp/Avatar.tsx: two initials on a disc, 20pt at its smallest
// on the player card's "owned by" line, 32pt in Standings). Three art directions, six samples each, drawn as rough
// vectors only: none is drawn in full before his pick (12 starters + ~8 earned come after).
// Every direction carries identity three ways (shape or pattern, a symbol, a colour), so a friend is never told apart
// by colour alone; section 3 runs all of them through three kinds of colour blindness and greyscale.
// Data: Tier Cup, ten managers, Roberto B.'s phone. Names, records and gains are board data.
// Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const STORE = 'M4.5 4h15l1.5 5H3z M3 9c0 1.5 1.1 2.5 2.5 2.5S8 10.5 8 9c0 1.5 1.1 2.5 2.5 2.5S13 10.5 13 9c0 1.5 1.1 2.5 2.5 2.5S18 10.5 18 9c0 1.5 1.1 2.5 2.5 2.5 M5 11.5V20h14v-8.5 M10 20v-5h4v5';

  // ── The crest palette: twelve fills, spread in LIGHTNESS as well as hue, none of them the "you" blue. ──
  // [fill, deep (the second tone), ink on the fill]
  const PAL = [
    ['#0F8C8C', '#0A5F5F', '#FFFFFF'], // teal
    ['#B5532A', '#7A3519', '#FFFFFF'], // rust
    ['#E0AE2E', '#A87C10', '#2A1E00'], // gold
    ['#6B3FA0', '#462868', '#FFFFFF'], // violet
    ['#2E8B57', '#1D5E39', '#FFFFFF'], // green
    ['#B0243A', '#761526', '#FFFFFF'], // crimson
    ['#4A5568', '#2D3440', '#FFFFFF'], // slate
    ['#E07BA5', '#B04D78', '#2A0B18'], // pink
    ['#8A9A2E', '#5E6A1B', '#FFFFFF'], // olive
    ['#E8CFA0', '#C2A267', '#3A2A0C'], // sand
    ['#E07B24', '#A35411', '#FFFFFF'], // orange
    ['#1F2A44', '#0E1424', '#F3E6C8'], // ink
  ];

  // ── Symbols (charges), filled on a 24 grid: filled shapes hold at 20pt where strokes fade. ──
  const SYM = {
    star: 'M12 2.5 L14.9 8.6 L21.5 9.3 L16.5 13.8 L18 20.3 L12 17 L6 20.3 L7.5 13.8 L2.5 9.3 L9.1 8.6 Z',
    bolt: 'M13.5 2 L5 13.5 H11 L10 22 L19 10 H13 Z',
    crown: 'M3 18 L4.5 7 L9 11.5 L12 5 L15 11.5 L19.5 7 L21 18 Z',
    arrow: 'M12 3 L20 12 H15 V21 H9 V12 H4 Z',
    horns: 'M3 5 C3 11 7 13 10 13 L10 19 H14 L14 13 C17 13 21 11 21 5 C19 8.5 16.5 10 12 10 C7.5 10 5 8.5 3 5 Z',
    candle: 'M9.5 7 H14.5 V17 H9.5 Z M11.2 3 H12.8 V21 H11.2 Z',
    moon: 'M15 3 A9 9 0 1 0 21 15 A7 7 0 1 1 15 3 Z',
    peak: 'M2 20 L9 7 L13 13.5 L16 9.5 L22 20 Z',
    flame: 'M12 2 C13 7 18 9 18 14.5 A6 6 0 0 1 6 14.5 C6 11 8 9.5 9 7 C10 9 10.5 10 11.5 10 C11.5 7 11 5 12 2 Z',
    gem: 'M7 4 H17 L21 9 L12 21 L3 9 Z',
    chevrons: 'M4 12.5 L12 5 L20 12.5 V17.5 L12 10 L4 17.5 Z',
    ring: 'M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M12 8.5 A3.5 3.5 0 1 0 12.01 8.5 Z',
  };
  const SYMS = Object.keys(SYM);

  // ── Ten crests per direction (the league of ten): each a palette entry, a symbol, and a pattern or shape. ──
  // The first six are the samples drawn large.
  const SET = [
    { p: 0, s: 'horns', v: 0, sh: 0 }, { p: 1, s: 'flame', v: 1, sh: 1 }, { p: 2, s: 'crown', v: 2, sh: 2 }, { p: 3, s: 'moon', v: 3, sh: 3 },
    { p: 4, s: 'arrow', v: 4, sh: 4 }, { p: 5, s: 'bolt', v: 5, sh: 5 }, { p: 6, s: 'peak', v: 0, sh: 6 }, { p: 7, s: 'gem', v: 1, sh: 7 },
    { p: 10, s: 'star', v: 2, sh: 8 }, { p: 9, s: 'candle', v: 3, sh: 9 },
  ];

  // A · Shield: one shield outline for all; the field is divided (heraldry's partitions) and a symbol sits on it.
  const SHIELD = 'M12 1.2 L21.6 4.4 V11 C21.6 16.8 17.4 20.9 12 23 C6.6 20.9 2.4 16.8 2.4 11 V4.4 Z';
  const PART = [
    null, // plain
    'M12 0 H24 V24 H12 Z', // per pale
    'M0 12 H24 V24 H0 Z', // per fess
    'M0 0 H24 V24 Z', // per bend
    'M0 24 L12 12 L24 24 Z', // chevron
    'M12 0 H24 V12 H12 Z M0 12 H12 V24 H0 Z', // quarterly
  ];
  function Shield({ c, size, id }) {
    const [fill, deep, ink] = PAL[c.p];
    const part = PART[c.v];
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: `0 0 ${size}px` }}>
        <defs><clipPath id={id}><path d={SHIELD} /></clipPath></defs>
        <path d={SHIELD} fill={fill} />
        {part ? <path d={part} fill={deep} clipPath={`url(#${id})`} /> : null}
        <g transform="translate(5.6 4.6) scale(0.53)"><path d={SYM[c.s]} fill={ink} fillRule="evenodd" /></g>
        <path d={SHIELD} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="0.8" />
      </svg>
    );
  }

  // B · Roundel: the disc a mark is today (same footprint, so no screen moves), a thick ring in the deep tone, the symbol.
  function Roundel({ c, size }) {
    const [fill, deep, ink] = PAL[c.p];
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: `0 0 ${size}px` }}>
        <circle cx="12" cy="12" r="12" fill={deep} />
        <circle cx="12" cy="12" r="9.4" fill={fill} />
        <g transform="translate(5.4 5.4) scale(0.55)"><path d={SYM[c.s]} fill={ink} fillRule="evenodd" /></g>
      </svg>
    );
  }

  // C · Patch: each crest has its own outline (hexagon, diamond, octagon …), filled, the symbol inside.
  const SHAPE = [
    'M12 1 L21.5 6.5 V17.5 L12 23 L2.5 17.5 V6.5 Z', // hexagon
    'M12 0.8 L23.2 12 L12 23.2 L0.8 12 Z', // diamond
    'M7.4 1.2 H16.6 L22.8 7.4 V16.6 L16.6 22.8 H7.4 L1.2 16.6 V7.4 Z', // octagon
    'M12 1 L23 9.2 L18.8 22.4 H5.2 L1 9.2 Z', // pentagon
    'M3 1.5 H21 V16 L12 22.8 L3 16 Z', // pennant
    'M12 0.6 L15 4.4 L19.8 3.6 L19.6 8.4 L23.4 11.6 L19.6 14.8 L19.8 19.6 L15 18.8 L12 22.6 L9 18.8 L4.2 19.6 L4.4 14.8 L0.6 11.6 L4.4 8.4 L4.2 3.6 L9 4.4 Z', // seal
    'M12 1 A11 11 0 1 1 11.99 1 Z', // disc
    'M12 1.2 L21.6 4.4 V11 C21.6 16.8 17.4 20.9 12 23 C6.6 20.9 2.4 16.8 2.4 11 V4.4 Z', // shield
    'M2 12 A10 10 0 0 1 22 12 V22.5 H2 Z', // arch
    'M5.5 1.5 H18.5 A4 4 0 0 1 22.5 5.5 V18.5 A4 4 0 0 1 18.5 22.5 H5.5 A4 4 0 0 1 1.5 18.5 V5.5 A4 4 0 0 1 5.5 1.5 Z', // tile
  ];
  function Patch({ c, size }) {
    const [fill, deep, ink] = PAL[c.p];
    const sh = SHAPE[c.sh];
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: `0 0 ${size}px` }}>
        <path d={sh} fill={fill} stroke={deep} strokeWidth="1.4" strokeLinejoin="round" />
        <g transform="translate(6.2 5.8) scale(0.5)"><path d={SYM[c.s]} fill={ink} fillRule="evenodd" /></g>
      </svg>
    );
  }

  const DIRS = [
    { key: 'a', name: 'A · Shield', Draw: Shield, about: 'One shield outline for everyone. The field is split the way heraldry splits it (down the middle, across, on the diagonal, a chevron, in quarters) and a symbol sits on top.' },
    { key: 'b', name: 'B · Roundel', Draw: Roundel, about: 'The round disc a mark is today, so nothing on any screen moves: a club badge, a thick ring in the darker tone, the symbol in the middle.' },
    { key: 'c', name: 'C · Patch', Draw: Patch, about: 'Each starter has its own outline (hexagon, diamond, octagon, pentagon, pennant, seal, disc, shield, arch, tile …) with the symbol inside, so in a league of ten the shape alone tells two crests apart.' },
  ];
  let uid = 0;
  const Crest = ({ dir, c, size }) => { const D = dir.Draw; return <D c={c} size={size} id={`cr-${dir.key}-${uid++}`} />; };

  // Today's mark, for comparison: two initials on the opponent slate (yours on your blue).
  function Initials({ name, size, me }) {
    const ini = name.split(' ').map((w) => w[0]).join('').replace('.', '').slice(0, size < 24 ? 1 : 2);
    return <span style={{ width: size, height: size, flex: `0 0 ${size}px`, borderRadius: size / 2, background: me ? 'var(--c-you)' : 'var(--c-opp, #4A5568)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: Math.round(size * 0.4), fontWeight: 800 }}>{ini}</span>;
  }
  // Your mark keeps today's ring (§9C): 2pt "you" ring across a 2pt gap. Blue still means you.
  const Ring = ({ on, children }) => (on ? <span style={{ display: 'grid', padding: 2, borderRadius: 99, boxShadow: '0 0 0 2px var(--c-you)', background: 'var(--c-bg)' }}>{children}</span> : children);

  // ── The league of ten. ──
  const ME = 'Roberto B.';
  const TEN = [
    ['Paolo M.', '6–1', '+18.4%'], ['Sofia R.', '5–2', '+14.9%'], [ME, '5–2', '+12.1%'], ['Gianluigi B.', '4–3', '+9.7%'], ['Elena V.', '4–3', '+6.2%'],
    ['Marco T.', '3–4', '+3.8%'], ['Giulia F.', '3–4', '+1.5%'], ['Luca D.', '2–5', '−0.9%'], ['Chiara S.', '2–5', '−3.4%'], ['Matteo P.', '1–6', '−7.2%'],
  ];

  function OS() {
    return <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;
  }
  function TabBar() {
    const tab = (d, l, on) => <span key={l} style={{ display: 'grid', justifyItems: 'center', gap: 2, color: on ? 'var(--c-accent)' : 'var(--c-text-2)', fontSize: 10, fontWeight: 600 }}><Icon d={d} size={22} width={2} />{l}</span>;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', paddingTop: 8, zIndex: 3 }}>
        {tab(ICON.home, 'Home')}{tab(ICON.matchup, 'Matchup')}{tab(ICON.league, 'League', true)}{tab(ICON.portfolio, 'Portfolio')}{tab(STORE, 'Stocks')}
      </div>
    );
  }
  /** League › Standings with ten managers; `dir` null draws today's initials. */
  function Standings({ t = 'light', dir, label }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 78, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 10px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>Tier Cup<Icon d={ICON.chevron} size={13} width={2.4} /></span>
              <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-you)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>RB</span>
            </div>
            <div className="dr-seg" style={{ marginBottom: 12 }}><span className="on">Standings</span><span>Schedule</span><span>Activity</span><span>History</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '18px 36px 1fr auto 72px', gap: 8, padding: '0 4px 6px', fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)' }}>
              <span>#</span><span /><span>Through Week 7</span><span style={{ textAlign: 'right' }}>W–L</span><span style={{ textAlign: 'right' }}>Season gain</span>
            </div>
            {TEN.map(([n, wl, g], i) => {
              const me = n === ME;
              return (
                <div key={n} style={{ display: 'grid', gridTemplateColumns: '18px 36px 1fr auto 72px', gap: 8, alignItems: 'center', padding: '6px 4px', borderTop: '1px solid var(--c-border)' }}>
                  <span className="dr-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-2)' }}>{i + 1}</span>
                  <span style={{ display: 'grid', placeItems: 'center' }}>
                    <Ring on={me}>{dir ? <Crest dir={dir} c={SET[i]} size={me ? 26 : 32} /> : <Initials name={n} size={me ? 26 : 32} me={me} />}</Ring>
                  </span>
                  <b style={{ fontSize: 15, color: me ? 'var(--c-you)' : 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</b>
                  <span className="dr-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', textAlign: 'right' }}>{wl}</span>
                  <span className="dr-num" style={{ fontSize: 14, fontWeight: 700, color: g.startsWith('+') ? 'var(--c-gain)' : 'var(--c-loss)', textAlign: 'right' }}>{g}</span>
                </div>
              );
            })}
          </div>
          <TabBar />
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  /** The six samples large (96pt), then at 20pt on the player card's "owned by" line, on one theme. */
  function Samples({ t, dir }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={`${dir.name}: six sample crests, large and at 20 points, ${t}`} style={{ background: 'var(--c-bg)', padding: 18, borderRadius: 16, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10, justifyItems: 'center' }}>
            {SET.slice(0, 6).map((c, i) => <Crest key={i} dir={dir} c={c} size={64} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px 14px' }}>
            {SET.slice(0, 6).map((c, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--c-text-2)', whiteSpace: 'nowrap' }}>
                <Crest dir={dir} c={c} size={20} /><span style={{ color: 'var(--c-text)', fontWeight: 600 }}>{TEN[i][0]}</span>
              </span>
            ))}
          </div>
        </div>
      </Th>
    );
  }

  // ── Colour-blind check: the ten at 32pt through three simulations and greyscale (SVG colour matrices). ──
  const CB = [
    ['normal', 'As drawn', null],
    ['prot', 'Protanopia (no red)', '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0'],
    ['deut', 'Deuteranopia (no green)', '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0'],
    ['trit', 'Tritanopia (no blue)', '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0'],
    ['grey', 'Greyscale', '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0'],
  ];
  function CBDefs() {
    return (
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>{CB.filter(([, , m]) => m).map(([k, , m]) => <filter key={k} id={`cb-${k}`} colorInterpolationFilters="linearRGB"><feColorMatrix type="matrix" values={m} /></filter>)}</defs>
      </svg>
    );
  }
  function CBCheck({ t }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={`Colour-blind check, ${t}`} style={{ background: 'var(--c-bg)', padding: 16, borderRadius: 16, display: 'grid', gridTemplateColumns: '150px repeat(3, max-content)', gap: '12px 22px', alignItems: 'center', color: 'var(--c-text)', width: 'max-content' }}>
          <span />{DIRS.map((d) => <b key={d.key} style={{ fontSize: 13 }}>{d.name}</b>)}
          {CB.map(([k, lab]) => (
            <React.Fragment key={k}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-2)' }}>{lab}</span>
              {DIRS.map((d) => (
                <span key={d.key} style={{ display: 'flex', flexWrap: 'nowrap', gap: 5, filter: k === 'normal' ? 'none' : `url(#cb-${k})` }}>
                  {SET.map((c, i) => <Crest key={i} dir={d} c={c} size={24} />)}
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const figPlain = (key, cap, node, note, span) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0, alignContent: 'start', gridColumn: span ? '1 / -1' : undefined }}>{node}<figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children, cols = 'three' }) => (cols === 'two'
    ? <div className="b-concepts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 28, marginBottom: 28 }}>{children}</div>
    : <div className="b-concepts b-concepts--three">{children}</div>);
  const Sub = ({ children }) => <h3 className="b-sub">{children}</h3>;

  function CallCrestLook({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-crest-look" aria-labelledby="call-crest-look-h">
        <CBDefs />
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Crests</span>
          <div>
            <h2 id="call-crest-look-h">{archived ? 'Decided: what a crest looks like' : 'Your call: what a crest looks like'}</h2>
            <p className="b-job">Three directions, six rough samples each. Whichever you pick, the twelve starters and the earned crests are then drawn in full in that style.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Where a crest goes:</b> everywhere a manager’s two-initial disc is drawn today, beside the name, never in place of it. The smallest is 20pt (“Owned by …” on a stock’s card); Standings uses 32pt.</li>
          <li><b>A · Shield.</b> One outline for all, the field split as in heraldry, a symbol on top. <b>B · Roundel.</b> Today’s round disc, as a club badge. <b>C · Patch.</b> Each crest its own outline, the symbol inside.</li>
          <li><b>Telling ten friends apart.</b> Every direction gives each crest three cues: a colour, a symbol, and a split field (A) or an outline (C). B has only colour and symbol, so at 20pt and in greyscale it leans on the symbol alone.</li>
          <li><b>Recommended: C.</b> At 20pt the outline is the first thing you see, and an outline doesn’t change in any colour-blind check or in greyscale: with no red or no green, rust, gold, crimson and orange all turn a similar olive-yellow, and only C still tells those four apart without reading the symbol. A reads most like a crest at full size, but at 20pt its split field turns to two smudges and every shield has the same outline.</li>
          <li><b>You</b> keep today’s blue ring around your mark and your name in blue; no crest colour is the “you” blue. A manager with no crest, a bot, and a deleted manager keep today’s mark.</li>
          <li><b>No new words.</b> The crests’ names and the collection’s words come on their own board (the collection, in Profile).</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A, B or C (or what to change in one).</>}</li>
        </ul>

        {DIRS.map((d, di) => (
          <React.Fragment key={d.key}>
            <Sub>{`${di + 1} · ${d.name}`}</Sub>
            <p style={{ margin: '0 0 12px', maxWidth: 760, color: 'var(--c-text-2)' }}>{d.about}</p>
            <Grid cols="two">{[
              figPlain(`${d.key}s1`, `${d.name} · Light`, <Samples t="light" dir={d} />, 'Large: 64pt. Below: the same six at 20pt, the size on “Owned by …”.'),
              figPlain(`${d.key}s2`, `${d.name} · Dark`, <Samples t="dark" dir={d} />),
            ]}</Grid>
            <Grid>{[
              fig(`${d.key}l1`, `${d.name} · Standings, ten managers`, <Standings dir={d} label={`Standings with ten managers, ${d.name} crests`} />, di === 0 ? 'Your mark is ringed in blue, as today.' : null),
              fig(`${d.key}l2`, `${d.name} · Standings, Dark`, <Standings t="dark" dir={d} label={`Standings with ten managers, ${d.name} crests, Dark`} />),
              ...(di === 0 ? [fig('t1', 'Today · two initials', <Standings label="Standings with ten managers, today's initials" />, 'For comparison: ten grey discs; PM, MT and MP differ by a letter.')] : []),
            ]}</Grid>
          </React.Fragment>
        ))}

        <Sub>4 · The colour-blind check</Sub>
        <p style={{ margin: '0 0 12px', maxWidth: 760, color: 'var(--c-text-2)' }}>The ten crests of each direction at 24pt, as drawn, as seen with each of the three kinds of colour blindness, and in greyscale.</p>
        <div style={{ display: 'grid', gap: 28 }}>
          {figPlain('cb1', 'Light', <CBCheck t="light" />, 'Look along a row: can you still tell each crest from its neighbours? With no red or no green, four of the ten (rust, gold, crimson, orange) turn a similar olive-yellow: A tells them apart by the split and the symbol, B by the symbol only, C by the outline first.')}
          {figPlain('cb2', 'Dark', <CBCheck t="dark" />)}
        </div>
      </section>
    );
  }

  window.KSCrestLook = () => <CallCrestLook />;
  window.KSCrestLookArchived = () => null;
})();
