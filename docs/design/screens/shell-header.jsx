// Stockpile key-screens board — "Your call: the top bar" (build 11, 2026-11-06).
// Giorgio, verbatim: "the top bar with your profile icon doesnt appear on the portfolio page but
// does on the other tabs. also i dont love how it so clearly cuts off the page like that, not sure
// if theres a work around but maybe the top bar shouldnt always stay at the top and cutoff as you
// scroll." Two questions: (1) what the bar holds on Portfolio, (2) what the bar does when you scroll.
// Drawn on the League tab before the draft (his screenshot) and on Portfolio before the draft,
// at Large and at his size (AX5, approximate), both themes.
(function () {
  const { Device, Icon, ICON } = window.KSKit;
  const K = window.KS;
  const GN = window.KSGN;
  const { Fit, Av, G } = GN;

  // ── Text size. x = the Dynamic Type multiplier (1 = Large, 2.4 ≈ AX5); cap = the app's cap. ──
  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const ROW = 1.3; // queue rows, the league pill
  const TAG = 1.4; // tags and chips
  const BTN = 1.6; // button labels
  const ell = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

  /** The bar's height at a text size: 12 above, the pill (36pt, grows with its text), 16 below. */
  const barH = (x) => 12 + Math.max(36, Math.round(36 * k(x, ROW))) + 16;

  // ── The bar: the league pill on the left; the phase chip and/or the avatar on the right. ──
  function Bar({ x = 1, avatar = true, chip = false, look = 'none', style }) {
    const looks = {
      none: {},
      solid: { background: 'var(--c-bg)' },
      // b: the page colour, see-through and blurred, with a 1pt line under it once content is beneath.
      material: { background: 'color-mix(in srgb, var(--c-bg) 72%, transparent)', backdropFilter: 'blur(18px) saturate(1.4)', WebkitBackdropFilter: 'blur(18px) saturate(1.4)', boxShadow: '0 1px 0 var(--c-border)' },
      materialTop: { background: 'color-mix(in srgb, var(--c-bg) 72%, transparent)', backdropFilter: 'blur(18px) saturate(1.4)', WebkitBackdropFilter: 'blur(18px) saturate(1.4)' },
    };
    const pillFs = fs(17, x, ROW, 1.25);
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: `12px ${G}px 16px`, minHeight: barH(x) - 28, ...looks[look], ...style }}>
        <span className="ks-pill" style={{ ...pillFs, height: 'auto', minHeight: Math.round(36 * k(x, ROW)), maxWidth: 'none', flex: '0 1 auto', minWidth: 0 }}>
          <span style={ell}>{K.LEAGUE.name}</span>
          <span className="ks-pill__more" style={fs(11, x, ROW, 1.6)}>+{K.OTHER_LEAGUES.length}</span>
          <Icon d={ICON.chevron} size={14} width={2.6} />
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: 'none' }}>
          {chip ? <span className="ks-chip" style={{ ...fs(11, x, TAG, 1), height: 'auto', padding: `${Math.round(6 * k(x, TAG))}px 10px`, boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>Pre-draft</span> : null}
          {avatar ? <Av init="RB" you size={36} /> : null}
        </span>
      </div>
    );
  }

  // ── League tab before the draft, as in his 1:47 screenshot: the "fix these first" card, then the queue. ──
  const QUEUE = [
    { t: 'SG', co: 'Sweetgreen, Inc. Class A Common Stock', p: '$11.99' },
    { t: 'GE', co: 'GE Aerospace Common Stock', p: '$323.30' },
    { t: 'ROBO', co: 'ROBO Global Robotics and Automation ETF', p: '$70.01' },
    { t: 'BCI', co: 'abrdn Bloomberg All Commodity Strategy K-1 Free ETF', p: '$24.64' },
  ];
  /** Where "Share invite code" sits in the content: the warn card's padding, then the inner card's top
   * padding, where its lines sit (scrolled away in every frame); then the button. */
  const SHARE_TOP = 16 + 64;
  function LeagueContent({ x }) {
    const btnH = Math.round(48 * k(x, BTN));
    return (
      <div style={{ padding: `0 ${G}px 24px`, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
        <div style={{ padding: 16, borderRadius: 20, background: 'var(--c-warn-tint)', boxShadow: 'inset 0 0 0 1px var(--c-warn-line)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          <div className="dr-card" style={{ padding: 16, paddingTop: 64, borderRadius: 16 }}>
            <span className="dr-btn dr-btn--line" style={{ width: '100%', height: btnH, ...fs(15, x, BTN), fontWeight: 600 }}>Share invite code</span>
          </div>
          <span className="dr-btn" style={{ width: '100%', height: btnH, ...fs(17, x, BTN), opacity: 0.5 }}>Pick a new draft time</span>
          <span style={{ ...fs(13, x), fontWeight: 500 }}>Fix these first. The new time needs at least an hour's notice.</span>
        </div>
        <div className="dr-card" style={{ padding: 20, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
          <span className="dr-tag dr-muted" style={fs(11, x, TAG, 1.27)}>Your queue · 4 of 50</span>
          <span className="dr-cap" style={fs(12, x)}>If you step away, we'll auto-pick from your queue when your time runs out. You can come back any time.</span>
          <span className="dr-cap" style={fs(12, x)}>Prices at Friday's close.</span>
          {QUEUE.map((s, i) => (
            <div key={s.t} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 52, padding: '4px 0' }}>
              <span className="dr-cap dr-num" style={{ ...fs(12, x, ROW), minWidth: 18, flex: 'none' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 8, flexWrap: 'wrap' }}>
                  <span className="dr-t" style={{ ...fs(16, x, ROW), flex: '1 0 auto' }}>{s.t}</span>
                  <span className="dr-num" style={{ ...fs(15, x, ROW), fontWeight: 700, marginLeft: 'auto' }}>{s.p}</span>
                </div>
                <span className="dr-cap" style={{ ...fs(12, x, ROW), ...ell }}>{s.co}</span>
              </div>
              <span className="dr-muted" style={{ display: 'inline-flex', flex: 'none' }}>
                {[i > 0 ? ICON.up : null, i < QUEUE.length - 1 ? ICON.chevron : null, ICON.close].map((d, j) => (
                  <span key={j} style={{ width: 40, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{d ? <Icon d={d} size={Math.round(16 * k(x, ROW))} width={2.4} /> : null}</span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── The frames. S = the content line that sits right under the bar today (mid-"Share invite code"). ──
  const S = SHARE_TOP + 24;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const SIZE = (x) => (x > 1 ? 'your size (AX5, approximate)' : 'Large');
  /** The status-bar strip for a bar that scrolls away: the page colour behind the clock, fading out
   * over 12pt under it, so nothing slides into the time and no line cuts the page. */
  const Strip = () => <div aria-hidden="true" style={{ position: 'absolute', inset: '0 0 auto 0', height: 54 + 14, zIndex: 4, pointerEvents: 'none', background: 'linear-gradient(to bottom, var(--c-bg) 0, var(--c-bg) 54px, color-mix(in srgb, var(--c-bg) 0%, transparent) 68px)' }} />;

  /** v: today | a | b-top | b | c-down | c-up. */
  function LeagueFrame({ t, v, x = 1 }) {
    const h = barH(x);
    const label = `League tab before the draft, scrolled to Share invite code, ${{ today: 'as build 11 ships it', a: 'option A, the bar scrolls away', 'b-top': 'option B at the top of the page', b: 'option B, scrolled', 'c-down': 'option C, scrolling down', 'c-up': 'option C, scrolling back up' }[v]}, ${SIZE(x)}, ${t}`;
    let body;
    if (v === 'today') {
      body = (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Bar x={x} look="solid" />
          <div style={{ flex: 1, overflow: 'hidden' }}><div style={{ marginTop: -S }}><LeagueContent x={x} /></div></div>
        </div>
      );
    } else if (v === 'a' || v === 'c-down') {
      body = <div style={{ marginTop: -S }}><LeagueContent x={x} /></div>;
    } else if (v === 'b-top') {
      body = (
        <div style={{ position: 'relative' }}>
          <Bar x={x} look="materialTop" style={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 3 }} />
          <div style={{ paddingTop: h }}><LeagueContent x={x} /></div>
        </div>
      );
    } else {
      // b (scrolled) and c-up: the bar floats over the page; the content under it shows through (b) or not (c).
      body = (
        <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
          <Bar x={x} look={v === 'b' ? 'material' : 'solid'} style={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 3, ...(v === 'c-up' ? { boxShadow: '0 1px 0 var(--c-border)' } : null) }} />
          <div style={{ marginTop: -(S - h) }}><LeagueContent x={x} /></div>
        </div>
      );
    }
    return (
      <Th t={t}>
        <Device tab="league" label={label} overlay={v === 'a' || v === 'c-down' ? <Strip /> : undefined}>{body}</Device>
      </Th>
    );
  }

  // ── Portfolio before the draft (his other 1:47 screenshot). ──
  const LOCK = 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z';
  /** v: today (chip only) | A (avatar) | B (chip + avatar). */
  function PortfolioFrame({ t, v, x = 1 }) {
    const label = `Portfolio before the draft, ${{ today: 'as build 11 ships it: the phase chip, no avatar', A: 'option A: the avatar, no chip', B: 'option B: the chip and the avatar' }[v]}, ${SIZE(x)}, ${t}`;
    return (
      <Th t={t}>
        <Device tab="portfolio" label={label}>
          <Bar x={x} avatar={v !== 'today'} chip={v !== 'A'} />
          <div style={{ display: 'grid', justifyItems: 'center', gap: 20, padding: `${Math.round(120 / Math.max(1, k(x, 1.6)))}px ${G}px 0`, textAlign: 'center' }}>
            <span style={{ width: 96, height: 96, borderRadius: 48, background: 'var(--c-inset)', display: 'grid', placeItems: 'center' }} className="dr-muted"><Icon d={LOCK} size={36} width={2} /></span>
            <span style={{ ...fs(20, x, 1.6), fontWeight: 800 }}>Trading opens after the draft.</span>
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
  const AX_NOTE = 'An approximation of your text size. The build gate checks the real thing.';
  const four = (Frame, v, cap, notes = {}) => [
    fig(`${v}ld`, `${cap} · Large · Dark`, <Frame t="dark" v={v} />, notes.l),
    fig(`${v}ll`, `${cap} · Large · Light`, <Frame t="light" v={v} />, notes.l),
    fig(`${v}xd`, `${cap} · your size (AX5) · Dark`, <Frame t="dark" v={v} x={2.4} />, notes.x || AX_NOTE),
    fig(`${v}xl`, `${cap} · your size (AX5) · Light`, <Frame t="light" v={v} x={2.4} />, notes.x || AX_NOTE),
  ];

  function CallTopBar({ archived }) {
    return (
      <section className="b-sec" id="call-top-bar" aria-labelledby="call-top-bar-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Shell</span>
          <div>
            <h2 id="call-top-bar-h">{archived ? 'Decided: A and A, the top bar' : 'Your call: the top bar'}</h2>
            <p className="b-job">Your words on build 11: "the top bar with your profile icon doesnt appear on the portfolio page but does on the other tabs. also i dont love how it so clearly cuts off the page like that, not sure if theres a work around but maybe the top bar shouldnt always stay at the top and cutoff as you scroll." Two choices below: first what the bar shows on Portfolio, then what the bar does when you scroll. You can pick them separately.</p>
          </div>
        </header>

        <h3 className="b-sub">1 · What the bar shows on Portfolio</h3>
        <ul className="b-inv__notes">
          <li><b>Today:</b> Home, Matchup and League show your league and your avatar. Portfolio shows your league and a phase chip ("Pre-draft", or the week once the season starts), and no avatar. The avatar is the only way to your profile, so from Portfolio you have to change tabs to reach it.</li>
          <li><b>A · The avatar, no chip.</b> The bar is the same on all four tabs: your league on the left, you on the right. What phase the league is in is already the first thing each tab says: Portfolio's "Trading opens after the draft.", Home's countdown, League's draft card, and each league's line in the list behind the pill. <b>Cost: small.</b> One line on Portfolio.</li>
          <li><b>B · The chip and the avatar.</b> Portfolio keeps "Pre-draft" and adds the avatar. At your size the three don't fit on one line: the chip and the avatar keep their room, so your league's name is the one that gets cut. <b>Cost: small.</b></li>
          <li><b>Should the chip be on every tab?</b> No. It would say the phase a second time on every screen, and at your size it would cut your league's name on all four tabs.</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-06): "A for both".</b> The avatar on every tab, no chip; the bar scrolls away with the page, with the fade behind the clock. Rules: PRODUCT_RULES, "The top bar".</li> : null}
          <li><b>Recommended: A.</b> The same bar on every tab, so your profile is always in the same corner, and nothing in the bar repeats what the screen already says.</li>
        </ul>
        <Grid>{[
          fig('pt-l', 'Today · Large · Light', <PortfolioFrame t="light" v="today" />, 'As build 11 ships it: "Pre-draft" where every other tab has your avatar.'),
          fig('pt-x', 'Today · your size (AX5) · Light', <PortfolioFrame t="light" v="today" x={2.4} />, AX_NOTE),
        ]}</Grid>
        <h3 className="b-sub">A · The avatar, no chip (recommended)</h3>
        <Grid>{four(PortfolioFrame, 'A', 'A')}</Grid>
        <h3 className="b-sub">B · The chip and the avatar</h3>
        <Grid>{four(PortfolioFrame, 'B', 'B', { x: 'At your size the chip and the avatar keep their room, so the league\'s name is cut. An approximation of your text size.' })}</Grid>

        <h3 className="b-sub">2 · What the bar does when you scroll</h3>
        <ul className="b-inv__notes">
          <li><b>Today:</b> the bar sits on a solid strip of the page colour that never moves, so whatever scrolls up is sliced off in a straight line under it ("Share invite code" cut in half in your screenshot). At your size the bar takes about 75pt, every screen, all the time.</li>
          <li><b>A · The bar scrolls away with the page.</b> It is the top of the page, not a frame around it. Scroll down and it goes up with everything else; behind the clock the page colour fades out over a few points, so nothing slides into the time and no line cuts across. To switch league or open your profile, scroll back to the top, or tap the clock (iPhone's own shortcut to the top of any page). Every tab opens at the top, so the bar is there whenever you arrive. <b>Cost: small.</b> The bar moves inside the page, and the page starts just under the clock. The pull-to-refresh bars already sit above the page's top, so they appear above the bar as today. The search reveal (#340) measures from the page's top edge, so its one number changes, from under the bar to under the clock. (Standings' pinned row watches only the bottom edge, so it needs nothing.)</li>
          <li><b>B · The bar stays, and you see the page through it.</b> At the top of a page it looks like today. Once content is under it, the bar turns see-through and blurred, with a 1pt line under it, the way Settings and Mail look on iPhone. It no longer slices the page, but it still stays at the top, at full height. <b>Cost: medium.</b> The blur needs a new library (expo-blur), so a new app build. The bar floats over the page instead of sitting above it, so the pull-to-refresh bars, the search reveal and Standings' pinned row each need the bar's height added.</li>
          <li><b>C · The bar hides as you scroll down and comes back as you scroll up.</b> Like Safari. While reading down you get the whole screen; the moment you scroll up a little it slides back. When it's back it needs a background again, so the straight edge comes back with it (or C adds B's blur, and B's cost). <b>Cost: large.</b> Tracking which way you're scrolling, keeping it from hiding while you pull to refresh or while the league list is open, and the search reveal has to aim for a bar that may or may not be there.</li>
          <li><b>One more thing it touches:</b> the draft room's clock call (drawn next). If the bar scrolls away (A), a pinned clock would be the only thing at the top while it's your pick; with B it would sit under the bar; with C it would jump as the bar comes and goes.</li>
          <li><b>Recommended: A.</b> It answers both halves of what you said: there's no cut, and the bar doesn't always stay. It gives the whole screen back on every tab, which matters most at your size. It's also the smallest change. The trade: switching league from halfway down a page takes a scroll up, or one tap on the clock. Pick B if you want the league and your profile always one tap away.</li>
          <li><b>No new words</b> in either choice.</li>
        </ul>
        <h3 className="b-sub">Today, as build 11 ships it</h3>
        <Grid>{[
          fig('lt-l', 'Today · Large · Light', <LeagueFrame t="light" v="today" />, 'Your screenshot: "Share invite code" sliced in half under the bar.'),
          fig('lt-d', 'Today · Large · Dark', <LeagueFrame t="dark" v="today" />),
          fig('lt-x', 'Today · your size (AX5) · Light', <LeagueFrame t="light" v="today" x={2.4} />, AX_NOTE),
        ]}</Grid>
        <h3 className="b-sub">A · The bar scrolls away with the page (recommended)</h3>
        <Grid>{four(LeagueFrame, 'a', 'A', { l: 'The same scroll position as Today. The bar has gone up with the page, so "Share invite code" and everything below gets its room; behind the clock the page fades out instead of a line.' })}</Grid>
        <h3 className="b-sub">B · The bar stays; you see the page through it</h3>
        <Grid>{[
          fig('bt-l', 'B · at the top of the page · Large · Light', <LeagueFrame t="light" v="b-top" />, 'At the top it looks like today: nothing is under it yet, so no line.'),
          ...four(LeagueFrame, 'b', 'B · scrolled', { l: 'Scrolled: "Share invite code" shows through the bar, blurred, with a 1pt line under the bar. The bar is still at the top, at full height.' }),
        ]}</Grid>
        <h3 className="b-sub">C · The bar hides on the way down and comes back on the way up</h3>
        <Grid>{[
          ...four(LeagueFrame, 'c-down', 'C · scrolling down', { l: 'Scrolling down: the bar has slid away, as in A.' }),
          fig('cu-l', 'C · scrolling back up · Large · Light', <LeagueFrame t="light" v="c-up" />, 'Scrolling up a little: the bar slides back over the page. It needs a background again, so the straight edge comes back with it.'),
          fig('cu-d', 'C · scrolling back up · Large · Dark', <LeagueFrame t="dark" v="c-up" />),
        ]}</Grid>
      </section>
    );
  }

  // Decided 2026-11-06 (A and A); the call lives in the Archive (board.jsx).
  window.KSTopBar = () => null;
  window.KSTopBarArchived = () => <CallTopBar archived />;
})();
