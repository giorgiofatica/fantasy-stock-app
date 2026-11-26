// Stockpile key-screens board — "Your call: your crests in Profile, and their words" (2026-11-25).
// Plan docs/plans/2026-11-25-crests.md ("The collection, in Profile"; the list; open question 3). Held crests in
// colour, the worn one marked, locked ones in grey with what earns each; tapping a held crest wears it. EVERY word
// here is a proposal: the plan's eight are placeholders and none are approved.
// Rule from the plan: "Nothing hidden, nothing impossible to get." A manager gets ONE starter, by chance, so the other
// eleven starters can never be earned and are not shown as locked: the collection is your starter + the 7 earned.
// Art: shields (his pick, #call-crest-look) as stand-ins; the earned ones carry a heavier gold inner rim, so they read
// as won in greyscale too. Data: roberto_b holds Bull (his starter, worn), Draft Day and First Win.
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

  // The eight a manager sees: their starter, then the seven earned, in the order a season usually brings them.
  // [id, name (proposed), what earns it (proposed), tone, symbol, split, earned?]. No two share a split or a symbol,
  // and light (sand) sits against dark, so they part in greyscale as well as in colour.
  const LIST = [
    ['bull', 'Bull', 'Your first league', 'teal', 'horns', 'bend', false],
    ['draft', 'Draft Day', 'Finish a draft', 'violet', 'gem', 'plain', true],
    ['win', 'First Win', 'Win a week', 'green', 'arrow', 'pale', true],
    ['three', 'Hat Trick', 'Win three matchups in a row', 'rust', 'chevrons', 'chevron', true],
    ['best', 'Top Week', 'Have the best week in your league', 'sand', 'star', 'fess', true],
    ['playoffs', 'Playoff Bound', 'Make the playoffs', 'crimson', 'bolt', 'quarterly', true],
    ['season', 'Full Season', 'Finish a season', 'slate', 'peak', 'band', true],
    ['champ', 'Champion', 'Win a league', 'gold', 'crown', 'chief', true],
  ];
  const HELD = ['bull', 'draft', 'win'];
  const byId = Object.fromEntries(LIST.map((r) => [r[0], r]));

  function Crest({ id, size, locked }) {
    const [, , , tone, sym, part, earned] = byId[id];
    return window.KSShield({ tone, sym, part, size, earned, locked });
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
  function Tile({ x, id, worn, onWear, none }) {
    const held = !none && HELD.includes(id);
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
  function Collection({ x, worn, onWear, cols = 3, none }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${x > 1 ? 2 : cols}, minmax(0, 1fr))`, gap: 8 }}>
        {LIST.map(([id]) => (none && id === 'bull'
          ? <div key={id} style={{ borderRadius: 14, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', borderStyle: 'dashed', minHeight: 96, display: 'grid', placeItems: 'center' }}><svg width="40" height="40" viewBox="0 0 24 24"><path d={window.KSShieldOutline} fill="none" stroke="var(--c-border-strong)" strokeWidth="1.2" strokeDasharray="2 2" /></svg></div>
          : <Tile key={id} x={x} id={id} worn={id === worn} onWear={onWear} none={none} />))}
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
      {worn ? <Crest id={worn} size={84} /> : <span style={{ width: 84, height: 84, borderRadius: 42, background: 'var(--c-you)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 800 }}>RB</span>}
      <b style={{ ...fs(22, x), color: 'var(--c-text)' }}>roberto_b</b>
    </div>
  );
  const Head = ({ x, children }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 2px -4px' }}>
      <b style={{ ...fs(13, x), letterSpacing: 0.8, color: 'var(--c-text-2)' }}>CRESTS</b>{children}
    </div>
  );

  /** A · the collection on Profile itself, between your name and the settings. */
  function ProfileA({ t, x = 1, label, live, none }) {
    const [worn, setWorn] = useState(none ? null : 'bull');
    return (
      <Screen t={t} label={label}>
        <Back x={x} label="Home" />
        <Identity x={x} worn={worn} />
        <Head x={x}><span className="dr-num" style={{ ...fs(13, x), fontWeight: 700, color: 'var(--c-text-2)' }}>{none ? '0 of 8' : '3 of 8'}</span></Head>
        <Collection x={x} worn={worn} onWear={live ? setWorn : null} none={none} />
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

  // The colour-blind and greyscale check (the bar: the whole screen grey still reads).
  const CB = [
    ['normal', 'As drawn', null],
    ['prot', 'No red (protanopia)', '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0'],
    ['deut', 'No green (deuteranopia)', '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0'],
    ['trit', 'No blue (tritanopia)', '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0'],
    ['grey', 'Greyscale', '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0'],
  ];
  function Check({ t }) {
    return (
      <Th t={t}>
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>{CB.filter((r) => r[2]).map(([k2, , m]) => <filter key={k2} id={`cc-${k2}`} colorInterpolationFilters="linearRGB"><feColorMatrix type="matrix" values={m} /></filter>)}</defs></svg>
        <div role="img" aria-label={`The eight crests through colour blindness and greyscale, ${t}`} style={{ background: 'var(--c-bg)', padding: 16, borderRadius: 16, display: 'grid', gridTemplateColumns: '170px max-content', gap: '12px 18px', alignItems: 'center', width: 'max-content' }}>
          {CB.map(([k2, lab]) => (
            <React.Fragment key={k2}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-2)' }}>{lab}</span>
              <span style={{ display: 'flex', gap: 10, filter: k2 === 'normal' ? 'none' : `url(#cc-${k2})` }}>{LIST.map(([id]) => <Crest key={id} id={id} size={36} />)}</span>
            </React.Fragment>
          ))}
        </div>
      </Th>
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
          <li><b>What you see: eight crests.</b> Your starter and the seven you can earn. The other eleven starters aren’t shown, because you can never get them (“nothing impossible to get”). Held ones in colour, locked ones in grey with what earns each, the one you wear outlined and marked “Wearing”. An earned crest has an inner rim, drawn heavier and in gold, so it reads as won even with no colour at all; a starter has none.</li>
          <li><b>Wearing one:</b> tap a coloured crest and it’s worn at once, everywhere, no question asked (like your queue, it saves as you go). A grey one does nothing.</li>
          <li><b>A · on Profile itself</b>, between your name and the settings. <b>B · a “Crests” row</b> on Profile, opening its own screen with the worn crest large at the top.</li>
          <li><b>Recommended: A.</b> Eight crests fit on one screen, and B hides them behind a row most people would never open. On Profile your mark becomes your worn crest, so you see the change the moment you tap.</li>
          <li><b>Proposed words, for your yes</b> (strike or rename any):
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li><b>Crests</b> · the collection’s name (A: the label over the grid; B: the row and its screen’s title)</li>
              <li><b>3 of 8</b> · how many you hold (the form of “5 of 6” managers)</li>
              <li><b>Wearing</b> · under the crest you wear</li>
              <li><b>The earned seven, name · what earns it:</b> Draft Day · Finish a draft; First Win · Win a week; Hat Trick · Win three matchups in a row; Top Week · Have the best week in your league; Playoff Bound · Make the playoffs; Full Season · Finish a season; Champion · Win a league</li>
              <li><b>The twelve starters:</b> {STARTERS.join(', ')} · line: <b>Your first league</b></li>
              <li><b>VoiceOver:</b> “Bull, wearing”; “Draft Day, double-tap to wear”; “Hat Trick, locked, win three matchups in a row”</li>
            </ul>
          </li>
          <li><b>Hat Trick</b> says “matchups”, not “weeks”: a bye neither breaks the run nor counts toward it, so three weeks in a row wouldn’t always be true. It’s earned once and kept, so no word here says “streak”.</li>
          <li><b>Telling them apart without colour:</b> no two of the eight share a split or a symbol, and light sits against dark (“Without colour”, including the whole set in grey).</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B, and yes to the words (or the ones to change).</>}</li>
        </ul>

        <Sub>{archived ? <><s>A · on Profile itself</s> · not picked</> : 'A · on Profile itself'}</Sub>
        <Grid>{[
          fig('a1', 'A · Light (tap a coloured crest)', <ProfileA live label="Profile with the collection: 3 of 8 crests, Bull worn" />, 'Your starter, then the seven earned in the order a season brings them. The settings rows continue below.'),
          fig('a2', 'A · Dark', <ProfileA t="dark" label="Profile with the collection, Dark" />),
          fig('a3', 'A · your text size', <ProfileA x={AX5} label="Profile with the collection, largest text size" />, 'Two crests to a row, so every “what earns it” line fits.'),
          fig('a4', 'A · no crest yet', <ProfileA none label="Profile for an account with no crest yet: today's initials, 0 of 8" />, 'An account from before crests, until its starter is revealed on the next open: today’s initials, the seven locked, an empty place for the starter.'),
        ]}</Grid>

        <Sub>{archived ? 'B · a row that opens Crests · picked' : 'B · a row that opens Crests'}</Sub>
        <Grid>{[
          fig('b1', 'B · Profile', <ProfileB label="Profile with a Crests row: the worn crest and 3 of 8" />),
          fig('b2', 'B · Crests (tap a coloured crest)', <CrestsB live label="Crests screen: Bull worn, 3 of 8" />),
          fig('b3', 'B · Crests, Dark', <CrestsB t="dark" label="Crests screen, Dark" />),
          fig('b4', 'B · Crests, your text size', <CrestsB x={AX5} label="Crests screen, largest text size" />),
        ]}</Grid>

        <Sub>Without colour</Sub>
        <div style={{ display: 'grid', gap: 24 }}>
          <figure className="b-fig b-fig--inv" style={{ margin: 0 }}><Check t="light" /><figcaption><b>Light</b><span className="b-annot">Review note: Look along each row: every crest still differs from its neighbours by its split and its symbol, and the earned seven by their inner rim. The bottom row is the whole set in grey.</span></figcaption></figure>
          <figure className="b-fig b-fig--inv" style={{ margin: 0 }}><Check t="dark" /><figcaption><b>Dark</b></figcaption></figure>
        </div>
      </section>
    );
  }

  window.KSCrestCollection = () => null;
  window.KSCrestCollectionArchived = () => <CallCrestCollection archived decidedNote={<><b>Decided 2026-11-25, in his words:</b> “your crests in Profile, and their words 2”, then, clearing it up, “let me clear that up, B crest row and A crest reveal”. B: a “Crests” row on Profile opening its own screen, the worn crest large at the top. A not picked. <b>The words are NOT approved</b> (he picked the option only): Crests, 3 of 8, Wearing, the earned names and lines, the starter names and VoiceOver stay proposals, still open for his yes.</>} />;
})();
