// Stockpile key-screens board — "Your call: your crests in Profile, and their words" (2026-11-25).
// Plan docs/plans/2026-11-25-crests.md ("The collection, in Profile"; the list; open question 3). Held crests in
// colour, the worn one marked, locked ones in grey with what earns each; tapping a held crest wears it. EVERY word
// here is a proposal: the plan's eight are placeholders and none are approved.
// Rule from the plan: "Nothing hidden, nothing impossible to get." A manager gets ONE starter, by chance, so the other
// eleven starters can never be earned and are not shown as locked: the collection is your starter + the 7 earned.
// Art: direction C patches (#call-crest-look's recommendation) as stand-ins; the earned ones carry a gold rim so they
// read as won, not given. Data: roberto_b holds Bull (his starter, worn), Draft Day and First Win.
// Profile today: "‹ Home", the 84pt mark and the username, then Username / Email / Change password / Appearance /
// How it works, then Sign out / Delete account. Review notes sit UNDER the phones, never inside.
(function () {
  const { useState } = React;
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap = 1.3, lh = 1.28) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;

  const SYM = {
    horns: 'M3 5 C3 11 7 13 10 13 L10 19 H14 L14 13 C17 13 21 11 21 5 C19 8.5 16.5 10 12 10 C7.5 10 5 8.5 3 5 Z',
    gem: 'M7 4 H17 L21 9 L12 21 L3 9 Z',
    arrow: 'M12 3 L20 12 H15 V21 H9 V12 H4 Z',
    chevrons: 'M4 12.5 L12 5 L20 12.5 V17.5 L12 10 L4 17.5 Z',
    star: 'M12 2.5 L14.9 8.6 L21.5 9.3 L16.5 13.8 L18 20.3 L12 17 L6 20.3 L7.5 13.8 L2.5 9.3 L9.1 8.6 Z',
    bolt: 'M13.5 2 L5 13.5 H11 L10 22 L19 10 H13 Z',
    peak: 'M2 20 L9 7 L13 13.5 L16 9.5 L22 20 Z',
    crown: 'M3 18 L4.5 7 L9 11.5 L12 5 L15 11.5 L19.5 7 L21 18 Z',
  };
  const SHAPE = {
    hex: 'M12 1 L21.5 6.5 V17.5 L12 23 L2.5 17.5 V6.5 Z',
    diamond: 'M12 0.8 L23.2 12 L12 23.2 L0.8 12 Z',
    oct: 'M7.4 1.2 H16.6 L22.8 7.4 V16.6 L16.6 22.8 H7.4 L1.2 16.6 V7.4 Z',
    pent: 'M12 1 L23 9.2 L18.8 22.4 H5.2 L1 9.2 Z',
    pennant: 'M3 1.5 H21 V16 L12 22.8 L3 16 Z',
    seal: 'M12 0.6 L15 4.4 L19.8 3.6 L19.6 8.4 L23.4 11.6 L19.6 14.8 L19.8 19.6 L15 18.8 L12 22.6 L9 18.8 L4.2 19.6 L4.4 14.8 L0.6 11.6 L4.4 8.4 L4.2 3.6 L9 4.4 Z',
    shield: 'M12 1.2 L21.6 4.4 V11 C21.6 16.8 17.4 20.9 12 23 C6.6 20.9 2.4 16.8 2.4 11 V4.4 Z',
    tile: 'M5.5 1.5 H18.5 A4 4 0 0 1 22.5 5.5 V18.5 A4 4 0 0 1 18.5 22.5 H5.5 A4 4 0 0 1 1.5 18.5 V5.5 A4 4 0 0 1 5.5 1.5 Z',
  };
  const GOLD = '#D9A520';
  // The eight a manager sees: their starter, then the seven earned, in the order a season usually brings them.
  // [id, name (proposed), what earns it (proposed), shape, symbol, fill, deep, earned?]
  const LIST = [
    ['bull', 'Bull', 'Your first league', 'hex', 'horns', '#0F8C8C', '#0A5F5F', false],
    ['draft', 'Draft Day', 'Finish a draft', 'diamond', 'gem', '#6B3FA0', '#462868', true],
    ['win', 'First Win', 'Win a week', 'pent', 'arrow', '#2E8B57', '#1D5E39', true],
    ['three', 'Hat Trick', 'Win three weeks in a row', 'oct', 'chevrons', '#B5532A', '#7A3519', true],
    ['best', 'Top Week', 'Have the best week in your league', 'seal', 'star', '#E07B24', '#A35411', true],
    ['playoffs', 'Playoff Bound', 'Make the playoffs', 'pennant', 'bolt', '#B0243A', '#761526', true],
    ['season', 'Full Season', 'Finish a season', 'tile', 'peak', '#4A5568', '#2D3440', true],
    ['champ', 'Champion', 'Win a league', 'shield', 'crown', '#E0AE2E', '#A87C10', true],
  ];
  const HELD = ['bull', 'draft', 'win'];
  const byId = Object.fromEntries(LIST.map((r) => [r[0], r]));

  function Crest({ id, size, locked }) {
    const [, , , sh, sy, fill, deep, earned] = byId[id];
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: `0 0 ${size}px`, filter: locked ? 'grayscale(1)' : 'none', opacity: locked ? 0.42 : 1, overflow: 'visible' }}>
        <path d={SHAPE[sh]} fill={fill} stroke={earned ? GOLD : deep} strokeWidth={earned ? 1.8 : 1.4} strokeLinejoin="round" />
        <g transform="translate(6.2 5.8) scale(0.5)"><path d={SYM[sy]} fill="#fff" /></g>
      </svg>
    );
  }

  function OS() {
    return <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;
  }
  const Back = ({ x, label }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--c-accent)', ...fs(16, x), fontWeight: 600 }}><Icon d={ICON.left} size={18} width={2.4} />{label}</span>;
  function Screen({ t = 'light', label, children }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>{children}</div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  /** One tile: the crest, its name; locked shows what earns it; the worn one is ringed and says Wearing. */
  function Tile({ x, id, worn, onWear }) {
    const held = HELD.includes(id);
    const [, name, line] = byId[id];
    return (
      <div onClick={held && onWear ? () => onWear(id) : undefined} style={{ display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 6, padding: '12px 6px 10px', borderRadius: 14, background: 'var(--c-surface)', boxShadow: worn ? 'inset 0 0 0 2px var(--c-accent)' : 'inset 0 0 0 1px var(--c-rim)', textAlign: 'center', cursor: held ? 'pointer' : 'default' }}>
        <Crest id={id} size={52} locked={!held} />
        <b style={{ ...fs(13, x), color: held ? 'var(--c-text)' : 'var(--c-text-2)' }}>{name}</b>
        {held ? (worn ? <span style={{ ...fs(11, x), fontWeight: 800, letterSpacing: 0.4, color: 'var(--c-accent)' }}>Wearing</span> : null)
          : <span style={{ ...fs(11.5, x), color: 'var(--c-text-2)' }}>{line}</span>}
      </div>
    );
  }
  function Collection({ x, worn, onWear, cols = 3 }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${x > 1 ? 2 : cols}, minmax(0, 1fr))`, gap: 8 }}>
        {LIST.map(([id]) => <Tile key={id} x={x} id={id} worn={id === worn} onWear={onWear} />)}
      </div>
    );
  }
  const Rows = ({ x, rows }) => (
    <div className="dr-a-card" style={{ padding: '2px 14px' }}>
      {rows.map(([a, b], i) => (
        <div key={a} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 46, borderTop: i ? '1px solid var(--c-border)' : 'none' }}>
          <span style={{ ...fs(16, x), color: 'var(--c-text)' }}>{a}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...fs(15, x), color: 'var(--c-text-2)' }}>{b}{a === 'Email' ? null : <Icon d={ICON.right} size={13} width={2.4} />}</span>
        </div>
      ))}
    </div>
  );
  const Identity = ({ x, worn }) => (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
      <Crest id={worn} size={84} />
      <b style={{ ...fs(22, x), color: 'var(--c-text)' }}>roberto_b</b>
    </div>
  );
  const Head = ({ x, children }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 2px -4px' }}>
      <b style={{ ...fs(13, x), letterSpacing: 0.8, color: 'var(--c-text-2)' }}>CRESTS</b>{children}
    </div>
  );

  /** A · the collection on Profile itself, between your name and the settings. */
  function ProfileA({ t, x = 1, label, live }) {
    const [worn, setWorn] = useState('bull');
    return (
      <Screen t={t} label={label}>
        <Back x={x} label="Home" />
        <Identity x={x} worn={worn} />
        <Head x={x}><span className="dr-num" style={{ ...fs(13, x), fontWeight: 700, color: 'var(--c-text-2)' }}>3 of 8</span></Head>
        <Collection x={x} worn={worn} onWear={live ? setWorn : null} />
        <Rows x={x} rows={[['Username', 'roberto_b'], ['Email', 'roberto@…']]} />
      </Screen>
    );
  }
  /** B · a Crests row on Profile, which opens the collection on its own screen. */
  function ProfileB({ t, x = 1, label }) {
    return (
      <Screen t={t} label={label}>
        <Back x={x} label="Home" />
        <Identity x={x} worn="bull" />
        <Rows x={x} rows={[['Crests', <span key="c" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Crest id="bull" size={20} />3 of 8</span>]]} />
        <Rows x={x} rows={[['Username', 'roberto_b'], ['Email', 'roberto@…'], ['Change password', ''], ['Appearance', 'System'], ['How it works', '']]} />
      </Screen>
    );
  }
  function CrestsB({ t, x = 1, label, live }) {
    const [worn, setWorn] = useState('bull');
    const [, name] = byId[worn];
    return (
      <Screen t={t} label={label}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}><Back x={x} label="Profile" /><b style={{ ...fs(17, x), color: 'var(--c-text)' }}>Crests</b><span /></div>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 4, padding: '6px 0 2px' }}>
          <Crest id={worn} size={96} />
          <b style={{ ...fs(20, x), color: 'var(--c-text)' }}>{name}</b>
          <span style={{ ...fs(12, x), fontWeight: 800, letterSpacing: 0.4, color: 'var(--c-accent)' }}>Wearing</span>
        </div>
        <div style={{ textAlign: 'right', margin: '0 2px -6px' }}><span className="dr-num" style={{ ...fs(13, x), fontWeight: 700, color: 'var(--c-text-2)' }}>3 of 8</span></div>
        <Collection x={x} worn={worn} onWear={live ? setWorn : null} />
      </Screen>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const Sub = ({ children }) => <h3 className="b-sub">{children}</h3>;

  const STARTERS = ['Bull', 'Flame', 'Crown', 'Moon', 'Rally', 'Bolt', 'Summit', 'Gem', 'Star', 'Candle', 'Orbit', 'Climb'];
  function CallCrestCollection({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-crest-collection" aria-labelledby="call-crest-collection-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Crests</span>
          <div>
            <h2 id="call-crest-collection-h">{archived ? 'Decided: your crests in Profile, and their words' : 'Your call: your crests in Profile, and their words'}</h2>
            <p className="b-job">Where your crests live, and every word on them. All the words are proposals. Tap a coloured crest on the live phones to wear it.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>What you see: eight crests.</b> Your starter and the seven you can earn. The other eleven starters aren’t shown, because you can never get them (“nothing impossible to get”). Held ones in colour, locked ones in grey with what earns each, the one you wear outlined and marked “Wearing”. Earned crests have a gold rim, so they read as won, not given.</li>
          <li><b>Wearing one:</b> tap a coloured crest and it’s worn at once, everywhere, no question asked (like your queue, it saves as you go). A grey one does nothing.</li>
          <li><b>A · on Profile itself</b>, between your name and the settings. <b>B · a “Crests” row</b> on Profile, opening its own screen with the worn crest large at the top.</li>
          <li><b>Recommended: A.</b> Eight crests fit on one screen, and B hides them behind a row most people would never open. On Profile your mark becomes your worn crest, so you see the change the moment you tap.</li>
          <li><b>Proposed words, for your yes</b> (strike or rename any):
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li><b>Crests</b> · the collection’s name (A: the label over the grid; B: the row and its screen’s title)</li>
              <li><b>3 of 8</b> · how many you hold (the form of “5 of 6” managers)</li>
              <li><b>Wearing</b> · under the crest you wear</li>
              <li><b>The earned seven, name · what earns it:</b> Draft Day · Finish a draft; First Win · Win a week; Hat Trick · Win three weeks in a row; Top Week · Have the best week in your league; Playoff Bound · Make the playoffs; Full Season · Finish a season; Champion · Win a league</li>
              <li><b>The twelve starters:</b> {STARTERS.join(', ')} · line: <b>Your first league</b></li>
              <li><b>VoiceOver:</b> “Bull, wearing”; “Draft Day, double-tap to wear”; “Hat Trick, locked, win three weeks in a row”</li>
            </ul>
          </li>
          <li><b>Hat Trick</b> is earned once and kept: losing the fourth week takes nothing away, so no word here says “streak”.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B, and yes to the words (or the ones to change).</>}</li>
        </ul>

        <Sub>1 · A, on Profile itself</Sub>
        <Grid>{[
          fig('a1', 'A · Light (tap a coloured crest)', <ProfileA live label="Profile with the collection: 3 of 8 crests, Bull worn" />, 'Your starter, then the seven earned in the order a season brings them. The settings rows continue below.'),
          fig('a2', 'A · Dark', <ProfileA t="dark" label="Profile with the collection, Dark" />),
          fig('a3', 'A · your text size', <ProfileA x={AX5} label="Profile with the collection, largest text size" />, 'Two crests to a row, so every “what earns it” line fits.'),
        ]}</Grid>

        <Sub>2 · B, a row that opens Crests</Sub>
        <Grid>{[
          fig('b1', 'B · Profile', <ProfileB label="Profile with a Crests row: the worn crest and 3 of 8" />),
          fig('b2', 'B · Crests (tap a coloured crest)', <CrestsB live label="Crests screen: Bull worn, 3 of 8" />),
          fig('b3', 'B · Crests, Dark', <CrestsB t="dark" label="Crests screen, Dark" />),
          fig('b4', 'B · Crests, your text size', <CrestsB x={AX5} label="Crests screen, largest text size" />),
        ]}</Grid>
      </section>
    );
  }

  window.KSCrestCollection = () => <CallCrestCollection />;
  window.KSCrestCollectionArchived = () => null;
})();
