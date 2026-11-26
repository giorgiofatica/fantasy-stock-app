// Stockpile key-screens board — "Your call: crests where no name is beside them" (2026-11-25).
// Plan docs/plans/2026-11-25-crests.md, risk "Marks that stop identifying people": two initials tell managers apart at
// a glance; crests may not. Every <Avatar> on main @ 0687e35f was read: three places draw a manager's mark with NO
// name beside it.
//   1. Pre-draft Home › Members (PreDraftCard): a row of 36pt discs, "5 of 6 joined", "+1". The real question.
//   2. Your own mark, top right of every tab (ShellHeader, 36pt): it is you, so the crest simply goes in.
//   3. The draft-order "i" picture (InfoVisuals): example people, not members; keeps initials.
// Two more draw a disc before you are in the league, and keep today's mark: the invite arrival (64pt, the inviter) and
// the takeover landing (64pt, the team). The crest is returned only to members who share a league (the plan), and
// the no-sign-in preview returns only the name and the inviter (the Planner's security ruling).
// Crests in direction C (#call-crest-look's recommendation) as stand-ins. Review notes sit UNDER the phones.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap = 1.3, lh = 1.28) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;

  const SYM = {
    horns: 'M3 5 C3 11 7 13 10 13 L10 19 H14 L14 13 C17 13 21 11 21 5 C19 8.5 16.5 10 12 10 C7.5 10 5 8.5 3 5 Z',
    flame: 'M12 2 C13 7 18 9 18 14.5 A6 6 0 0 1 6 14.5 C6 11 8 9.5 9 7 C10 9 10.5 10 11.5 10 C11.5 7 11 5 12 2 Z',
    crown: 'M3 18 L4.5 7 L9 11.5 L12 5 L15 11.5 L19.5 7 L21 18 Z',
    moon: 'M15 3 A9 9 0 1 0 21 15 A7 7 0 1 1 15 3 Z',
    arrow: 'M12 3 L20 12 H15 V21 H9 V12 H4 Z',
  };
  const SHAPE = {
    hex: 'M12 1 L21.5 6.5 V17.5 L12 23 L2.5 17.5 V6.5 Z',
    diamond: 'M12 0.8 L23.2 12 L12 23.2 L0.8 12 Z',
    oct: 'M7.4 1.2 H16.6 L22.8 7.4 V16.6 L16.6 22.8 H7.4 L1.2 16.6 V7.4 Z',
    pent: 'M12 1 L23 9.2 L18.8 22.4 H5.2 L1 9.2 Z',
    pennant: 'M3 1.5 H21 V16 L12 22.8 L3 16 Z',
  };
  // You first (S-3), then in the order they joined. [name, shape, symbol, fill, deep]
  const MEMBERS = [
    ['Roberto B.', 'oct', 'crown', '#E0AE2E', '#A87C10'],
    ['Paolo M.', 'hex', 'horns', '#0F8C8C', '#0A5F5F'],
    ['Sofia R.', 'diamond', 'flame', '#B5532A', '#7A3519'],
    ['Gianluigi B.', 'pent', 'moon', '#6B3FA0', '#462868'],
    ['Elena V.', 'pennant', 'arrow', '#2E8B57', '#1D5E39'],
  ];
  function Crest({ m, size }) {
    const [, sh, sy, fill, deep] = m;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: `0 0 ${size}px` }}>
        <path d={SHAPE[sh]} fill={fill} stroke={deep} strokeWidth="1.4" strokeLinejoin="round" />
        <g transform="translate(6.2 5.8) scale(0.5)"><path d={SYM[sy]} fill={sy === 'crown' ? '#2A1E00' : '#fff'} /></g>
      </svg>
    );
  }
  const Initials = ({ name, size, fill = 'var(--c-inset)', ink = 'var(--c-text)' }) => (
    <span style={{ width: size, height: size, flex: `0 0 ${size}px`, borderRadius: size / 2, background: fill, color: ink, display: 'grid', placeItems: 'center', fontSize: Math.round(size * 0.38), fontWeight: 800 }}>{name.split(' ').map((w) => w[0]).join('').replace('.', '')}</span>
  );

  function OS() {
    return <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;
  }
  const STORE = 'M4.5 4h15l1.5 5H3z M3 9c0 1.5 1.1 2.5 2.5 2.5S8 10.5 8 9c0 1.5 1.1 2.5 2.5 2.5S13 10.5 13 9c0 1.5 1.1 2.5 2.5 2.5S18 10.5 18 9c0 1.5 1.1 2.5 2.5 2.5 M5 11.5V20h14v-8.5 M10 20v-5h4v5';
  function TabBar() {
    const tab = (d, l, on) => <span key={l} style={{ display: 'grid', justifyItems: 'center', gap: 2, color: on ? 'var(--c-accent)' : 'var(--c-text-2)', fontSize: 10, fontWeight: 600 }}><Icon d={d} size={22} width={2} />{l}</span>;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', paddingTop: 8, zIndex: 3 }}>
        {tab(ICON.home, 'Home', true)}{tab(ICON.matchup, 'Matchup')}{tab(ICON.league, 'League')}{tab(ICON.portfolio, 'Portfolio')}{tab(STORE, 'Stocks')}
      </div>
    );
  }

  /** Pre-draft Home: the header (your mark top right), the draft card's foot, the Members card. names: B. */
  function PreDraft({ t = 'light', x = 1, names, label }) {
    const size = 36;
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 78, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 0' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', ...fs(16, x), fontWeight: 600, color: 'var(--c-text)' }}>Stock Scudetto<Icon d={ICON.chevron} size={13} width={2.4} /></span>
              <Crest m={MEMBERS[0]} size={36} />
            </div>
            <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 6 }}>
              <span className="dr-tag" style={{ color: 'var(--c-live-text)' }}>Draft · Sat, Nov 28 · 7:00 PM ET</span>
              <span className="dr-score" style={{ fontSize: 30, lineHeight: '34px' }}>2d 06h 40m</span>
            </div>
            <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ ...fs(17, x), color: 'var(--c-text)' }}>Members</b>
                <span style={{ ...fs(13, x), color: 'var(--c-text-2)' }}>5 of 6 joined</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: names ? '10px 4px' : 8, alignItems: 'flex-start' }}>
                {MEMBERS.map((m, i) => (
                  <span key={m[0]} style={{ display: 'grid', justifyItems: 'center', gap: 4, width: names ? Math.round(52 * k(x, 1.3)) : 'auto' }}>
                    <Crest m={m} size={size} />
                    {names ? <span style={{ ...fs(11, x), fontWeight: i ? 600 : 800, color: i ? 'var(--c-text-2)' : 'var(--c-you)', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m[0].split(' ')[0]}</span> : null}
                  </span>
                ))}
                <span style={{ width: size, height: size, borderRadius: size / 2, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', display: 'grid', placeItems: 'center', ...fs(15, x, 1.2), color: 'var(--c-text-2)' }}>+1</span>
              </div>
            </div>
          </div>
          <TabBar />
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }
  /** Today, for comparison: the same card with initials. */
  function PreDraftToday({ t = 'light', label }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={label} style={{ background: 'var(--c-bg)', padding: 14, borderRadius: 16 }}>
          <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}><b style={{ fontSize: 17, color: 'var(--c-text)' }}>Members</b><span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>5 of 6 joined</span></div>
            <div style={{ display: 'flex', gap: 8 }}>
              {MEMBERS.map((m, i) => <Initials key={m[0]} name={m[0]} size={36} fill={i ? 'var(--c-inset)' : 'var(--c-you)'} ink={i ? 'var(--c-text)' : '#fff'} />)}
              <span style={{ width: 36, height: 36, borderRadius: 18, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--c-text-2)' }}>+1</span>
            </div>
          </div>
        </div>
      </Th>
    );
  }
  /** The invite arrival, unchanged: the inviter's initials before sign-in. */
  function Arrival({ t = 'light', label }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, padding: '0 20px 44px', display: 'grid', gridTemplateRows: '1fr auto' }}>
            <div style={{ display: 'grid', gap: 16, alignContent: 'center', justifyItems: 'center', textAlign: 'center' }}>
              <Initials name="Roberto B." size={64} />
              <span style={{ fontSize: 28, lineHeight: '32px', fontWeight: 800, color: 'var(--c-text)' }}>Roberto B. invited you to Stock Scudetto</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {['Continue with Apple', 'Continue with Google', 'Use email'].map((l, i) => <span key={l} className={i ? 'dr-btn dr-btn--line' : 'dr-btn'} style={{ height: 50, fontSize: 16, display: 'grid', placeItems: 'center' }}>{l}</span>)}
            </div>
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const figPlain = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0, alignContent: 'start' }}>{node}<figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const Sub = ({ children }) => <h3 className="b-sub">{children}</h3>;

  function CallCrestNameless({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-crest-nameless" aria-labelledby="call-crest-nameless-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Crests</span>
          <div>
            <h2 id="call-crest-nameless-h">{archived ? 'Decided: crests where no name is beside them' : 'Your call: crests where no name is beside them'}</h2>
            <p className="b-job">Almost everywhere, a crest sits next to a name. These are the places it doesn’t, and what each one does.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Every place a manager’s mark is drawn today was checked.</b> Three have no name beside them; two more show a mark before you’re in the league.</li>
          <li><b>1 · Members on the pre-draft Home</b> is the one that needs your call. Today, two initials tell you who has joined. With crests, friends haven’t learned each other’s yet. <b>A:</b> the crests alone, as the initials are today. <b>B:</b> each crest with the first name under it.</li>
          <li><b>Recommended: B.</b> Before the draft is exactly when nobody knows whose crest is whose, and this card is how you check who’s in. No new words: the names are the managers’ own.</li>
          <li><b>2 · Your mark, top right of every tab:</b> it’s you, so your crest simply goes in. Tapping it still opens Profile.</li>
          <li><b>3 · Stays as today:</b> the invite arrival and the takeover landing keep today’s mark, because you aren’t in the league yet and a crest is only shown to people who share one. The draft-order “i” picture keeps its initials: those are example people, not your league.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B for Members.</>}</li>
        </ul>

        <Sub>1 · Members on the pre-draft Home</Sub>
        <Grid>{[
          fig('a1', 'A · crests alone', <PreDraft label="Pre-draft Home, Members as crests alone" />, 'Which crest is Sofia’s? Only the people who saw her join know.'),
          fig('b1', 'B · crests with first names', <PreDraft names label="Pre-draft Home, Members as crests with first names" />, 'Your name in your colour, first, as you are today.'),
          fig('b2', 'B · Dark', <PreDraft t="dark" names label="Members with first names, Dark" />),
          fig('b3', 'B · your text size', <PreDraft x={AX5} names label="Members with first names, largest text size" />, 'The names grow (capped, like every row); the crests stay their size.'),
          fig('a2', 'A · Dark', <PreDraft t="dark" label="Members as crests alone, Dark" />),
          figPlain('t1', 'Today, for comparison', <PreDraftToday label="Today's Members card with initials" />, 'PM, SR, GB, EV: initials say who, crests alone don’t.'),
        ]}</Grid>

        <Sub>2 · Your mark, top right of every tab</Sub>
        <p style={{ margin: '0 0 12px', maxWidth: 760, color: 'var(--c-text-2)' }}>Drawn in every phone above: your crest (Roberto B.’s crown) where your blue initials are today.</p>

        <Sub>3 · Stays as today</Sub>
        <Grid>{[
          fig('s1', 'The invite arrival, unchanged', <Arrival label="Invite arrival with the inviter's initials, unchanged" />, 'Before sign-in the page may show only the league’s name and who invited you, so no crest.'),
        ]}</Grid>
      </section>
    );
  }

  window.KSCrestNameless = () => <CallCrestNameless />;
  window.KSCrestNamelessArchived = () => null;
})();
