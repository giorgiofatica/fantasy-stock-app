// Stockpile key-screens board — "For your sign-off: the floating close on tall sheets" (Giorgio,
// 2026-11-12, build 14, recording 10:56, PRODUCT_RULES "A sheet's top must not be a stuck block that
// cuts text"). He picked "b" from the Planner's three directions: no bar; a small round close button
// floats in the sheet's top corner and stays there; the content scrolls the full height under it and
// fades softly as it passes, so nothing is sliced. This board draws it on every tall sheet that pins a
// header today, both themes, Large and AX5, and what a form that can save does when you close it with
// changes. Not a question: a drawing for his sign-off. Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, NEW } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1; // the largest accessibility size, over Large (approximate, as on the other boards)

  // The spec (the notes below repeat it in words).
  const CLOSE = 30; // the circle
  const TARGET = 44; // its tap target
  const EDGE = 14; // circle top from the sheet's top edge
  const SIDE = 20; // circle right from the sheet's right edge (the content gutter)
  const FADE = 56; // the top fade: the sheet's colour at the edge, clear by here
  const SHEET_TOP = 64; // a page sheet's top on iPhone 17 (status bar + the parent's peek)

  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const clear = (c) => `color-mix(in srgb, ${c} 0%, transparent)`;

  /** The floating close: a solid round button, the sheet's inset colour, an × in text-2. */
  function Close({ border }) {
    return (
      <span style={{ position: 'absolute', top: EDGE - (TARGET - CLOSE) / 2, right: SIDE - (TARGET - CLOSE) / 2, width: TARGET, height: TARGET, display: 'grid', placeItems: 'center', zIndex: 4 }}>
        <span style={{ width: CLOSE, height: CLOSE, borderRadius: CLOSE / 2, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', color: 'var(--c-text-2)', boxShadow: border ? 'inset 0 0 0 1px var(--c-border-strong)' : 'none' }}>
          <Icon d={ICON.close} size={14} width={2.6} />
        </span>
      </span>
    );
  }

  /** A page sheet over the dimmed screen it came from. `offset`: how far the content has scrolled.
   * `today`: the shipped top (the doubled inset band, a pinned Cancel row, a hard edge). */
  function PageSheet({ t, label, offset = 0, today, cancel = 'Cancel', bg = 'var(--c-bg)', footer, overlay, children }) {
    const band = today ? 62 + 44 : 0; // today: the inset spent twice, then the Cancel row
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label} style={{ background: 'oklch(18% 0.01 270)' }}>
          <div className="ks-os" style={{ color: '#fff' }}>
            <span>9:41</span>
            <span className="ks-os__island" />
            <span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span>
          </div>
          {/* The screen it came from, pushed back behind the sheet. */}
          <div style={{ position: 'absolute', top: 54, left: 14, right: 14, height: 40, borderRadius: '14px 14px 0 0', background: 'var(--c-surface)', opacity: 0.5 }} />
          <div style={{ position: 'absolute', top: SHEET_TOP, left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', background: bg, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: band, left: 0, right: 0, bottom: footer ? 98 : 0, overflow: 'hidden' }}>
              <div style={{ transform: `translateY(${-offset}px)`, padding: `${today ? 4 : EDGE}px 20px 40px`, display: 'grid', gap: 18 }}>{children}</div>
            </div>
            {today ? (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: band, background: bg, display: 'flex', alignItems: 'flex-end', padding: '0 20px 10px' }}>
                <span className="dr-call" style={{ fontSize: 16, color: 'var(--c-text-2)' }}>{cancel}</span>
              </div>
            ) : (
              <>
                {offset > 0 ? <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: FADE, background: `linear-gradient(to bottom, ${bg} 0, ${bg} 12px, ${clear(bg)} ${FADE}px)`, zIndex: 3, pointerEvents: 'none' }} /> : null}
                <Close border={false} />
              </>
            )}
            {footer ? (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 98, padding: '8px 20px 34px', background: bg }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: -24, height: 24, background: `linear-gradient(to top, ${bg}, ${clear(bg)})` }} />
                {footer}
              </div>
            ) : null}
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
          {overlay}
        </div>
      </Th>
    );
  }

  // ── Content pieces (drawn from the app's own screens; words are the app's) ──
  const Title = ({ x, children }) => <span style={{ ...fs(34, x, 1.5, 1.15), fontWeight: 800, color: 'var(--c-text)', paddingRight: TARGET + 12 }}>{children}</span>;
  const Head = ({ x, children }) => <span style={{ ...fs(17, x, 1.5), fontWeight: 700, color: 'var(--c-text)', marginBottom: -8 }}>{children}</span>;
  const Card = ({ children }) => <div style={{ background: 'var(--c-surface)', borderRadius: 16, padding: '4px 16px', display: 'grid' }}>{children}</div>;
  const Div = () => <div style={{ height: 1, background: 'var(--c-border)', marginInline: -16 }} />;
  function Row({ x, k: key, v, chev, stack }) {
    const s = x >= 2;
    return (
      <div style={{ display: 'flex', flexDirection: s || stack ? 'column' : 'row', justifyContent: 'space-between', alignItems: s || stack ? 'flex-start' : 'center', gap: s ? 2 : 12, padding: '12px 0', minHeight: 44 }}>
        <span style={{ ...fs(15, x, 1.3), fontWeight: 600, color: 'var(--c-text)' }}>{key}</span>
        {v ? <span className="dr-num" style={{ ...fs(15, x, 1.3), color: 'var(--c-text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>{v}{chev ? <Icon d={ICON.right} size={14} width={2.4} /> : null}</span> : null}
      </div>
    );
  }
  function Field({ x, label, value }) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ ...fs(15, x, 1.3), fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>
        <span style={{ ...fs(17, x, 1.6), padding: '12px 14px', borderRadius: 12, background: 'var(--c-inset)', color: 'var(--c-text)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>{value}</span>
      </div>
    );
  }
  function Seg({ x, opts, on }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${opts.length}, 1fr)`, gap: 2, padding: 2, borderRadius: 10, background: 'var(--c-inset)', margin: '4px 0 12px' }}>
        {opts.map((o) => <span key={o} className="dr-num" style={{ ...fs(13, x, 1.3), textAlign: 'center', padding: '6px 0', borderRadius: 8, fontWeight: 700, background: o === on ? 'var(--c-surface)' : 'transparent', color: o === on ? 'var(--c-text)' : 'var(--c-text-2)' }}>{o}</span>)}
      </div>
    );
  }
  function Stepper({ x, label, value }) {
    const b = (d) => <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'var(--c-text)' }}><Icon d={d} size={16} width={2.4} /></span>;
    return (
      <div style={{ display: 'flex', flexDirection: x >= 1.35 ? 'column' : 'row', alignItems: x >= 1.35 ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0' }}>
        <span style={{ ...fs(15, x, 1.6), fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>
        <span style={{ display: 'inline-flex', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>{b('M5 12h14')}<b className="dr-num" style={{ ...fs(17, x, 1.6), width: Math.round(56 * k(x, 1.6)), display: 'grid', placeItems: 'center', borderInline: '1px solid var(--c-border)', color: 'var(--c-text)' }}>{value}</b>{b(ICON.plus)}</span>
      </div>
    );
  }
  const Btn = ({ x = 1, children, kind = 'primary' }) => (
    <span style={{ display: 'grid', placeItems: 'center', minHeight: 52, borderRadius: 26, ...fs(17, x, 1.6), fontWeight: 700, background: kind === 'primary' ? 'var(--c-accent)' : 'transparent', color: kind === 'primary' ? 'var(--c-on-accent)' : 'var(--c-text)', boxShadow: kind === 'primary' ? 'none' : 'inset 0 0 0 1.5px var(--c-border-strong)' }}>{children}</span>
  );

  /** League settings, the commissioner before the draft (league-settings.tsx, the editable branch). */
  function CommishBody({ x }) {
    return (
      <>
        <Title x={x}>League settings</Title>
        <Field x={x} label="League name" value="Serie A Traders" />
        <Head x={x}>Draft</Head>
        <Card>
          <Row x={x} k="Pick clock" v="60 seconds" />
          <Seg x={x} opts={['30s', '45s', '60s', '75s', '90s']} on="60s" />
          <Div />
          <Row x={x} k="Draft time" v="Sat, Nov 14 · 6:45 PM ET" chev />
          <Div />
          <Stepper x={x} label="Rounds" value="6" />
        </Card>
        <Head x={x}>Stakes</Head>
        <Field x={x} label="Stake per slot ($)" value="2,000" />
        <Head x={x}>League info</Head>
        <Card>
          <Row x={x} k="Type" v="Matchup" />
          <Div />
          <Row x={x} k="Playoff teams" v="4" />
        </Card>
        <Card>
          <Row x={x} k="Invite code" v="SCUD26" stack />
        </Card>
      </>
    );
  }
  /** League settings, a member (read-only: invite code, commissioner, members, Leave). */
  function MemberBody({ x }) {
    return (
      <>
        <Title x={x}>League settings</Title>
        <Card>
          <Row x={x} k="Invite code" v="SCUD26" stack />
          <Div />
          <Row x={x} k="Commissioner" v="Paolo M." />
        </Card>
        <Card>
          {['Paolo M.', 'Roberto B.', 'Alessandro D.', 'Francesco T.', 'Gianluigi B.', 'Andrea P.'].map((n, i) => (
            <React.Fragment key={n}>{i ? <Div /> : null}<Row x={x} k={n} /></React.Fragment>
          ))}
        </Card>
        <Card>
          <div style={{ padding: '12px 0', display: 'grid', gap: 4 }}>
            <span style={{ ...fs(15, x, 1.3), fontWeight: 700, color: 'var(--c-loss)' }}>Leave league</span>
            <span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>You can leave until Sun 5:00 PM ET.</span>
          </div>
        </Card>
      </>
    );
  }
  function TeamBody({ x }) {
    const rows = [['NVDA', '$2,214.60', '+4.12%'], ['AAPL', '$2,061.33', '+1.94%'], ['MSFT', '$1,988.07', '−0.41%'], ['COST', '$2,120.45', '+2.58%'], ['V', '$2,032.68', '+1.63%'], ['TM', '$1,926.42', '−3.70%']];
    return (
      <>
        <Title x={x}>Paolo M.</Title>
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>Portfolio value</span>
          <span className="dr-num" style={{ ...fs(40, x, 1.3, 1.1), fontWeight: 800, color: 'var(--c-text)' }}>$12,343.58</span>
        </div>
        <Card>
          {rows.map(([s, v, p], i) => (
            <React.Fragment key={s}>{i ? <Div /> : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', ...fs(15, x, 1.3) }}>
                <b style={{ color: 'var(--c-text)' }}>{s}</b>
                <span className="dr-num" style={{ color: 'var(--c-text)', display: 'grid', justifyItems: 'end' }}>{v}<span style={{ color: p.startsWith('+') ? 'var(--c-gain)' : 'var(--c-loss)', ...fs(13, x, 1.3) }}>{p}</span></span>
              </div>
            </React.Fragment>
          ))}
        </Card>
      </>
    );
  }
  function HistoryBody({ x }) {
    const rows = [['Bought NVDA', 'Wed 10:42 AM ET · 4.21 shares', '$987.43'], ['Sold TM', 'Wed 10:41 AM ET · 5.18 shares', '$987.43'], ['Bought AAPL', 'Mon 2:15 PM ET · 9.88 shares', '$2,032.68'], ['Sold V', 'Mon 2:14 PM ET · 6.97 shares', '$2,032.68'], ['Drafted COST', 'Sat 6:52 PM ET · 2.19 shares', '$2,000.01'], ['Drafted MSFT', 'Sat 6:50 PM ET · 4.51 shares', '$2,000.01'], ['Drafted NVDA', 'Sat 6:47 PM ET · 11.0 shares', '$2,000.01']];
    return (
      <>
        <Title x={x}>Trade history</Title>
        <Seg x={x} opts={['All', 'Buys', 'Sells', 'Draft']} on="All" />
        <Card>
          {rows.map(([a, d, v], i) => (
            <React.Fragment key={a + d}>{i ? <Div /> : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0' }}>
                <span style={{ display: 'grid', gap: 2 }}><b style={{ ...fs(15, x, 1.3), color: 'var(--c-text)' }}>{a}</b><span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>{d}</span></span>
                <span className="dr-num" style={{ ...fs(15, x, 1.3), color: 'var(--c-text)' }}>{v}</span>
              </div>
            </React.Fragment>
          ))}
        </Card>
      </>
    );
  }
  function ForgotBody({ x }) {
    return (
      <>
        <Title x={x}>Forgot password?</Title>
        <Field x={x} label="Email address" value="roberto@" />
        <Btn x={x}>Send reset link</Btn>
      </>
    );
  }
  /** iOS's action sheet for an edited form. Both lines are NEW. */
  function DiscardSheet() {
    const item = (txt, style) => <span style={{ display: 'grid', placeItems: 'center', minHeight: 57, fontSize: 20, ...style }}>{txt}</span>;
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 8, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 10px 34px', gap: 8 }}>
        <div style={{ borderRadius: 14, background: 'var(--c-surface)', overflow: 'hidden' }}>{item('Discard changes', { color: 'var(--c-loss)' })}</div>
        <div style={{ borderRadius: 14, background: 'var(--c-surface)' }}>{item('Keep editing', { color: 'var(--c-accent)', fontWeight: 600 })}</div>
      </div>
    );
  }

  /** Up close: the sheet's top-right corner at 2×, content passing under. */
  function Corner({ t, contrast }) {
    const W = 170; const H = 110; const z = 2;
    return (
      <Th t={t}>
        <div role="img" aria-label={`The close button and the fade, up close, ${t}${contrast ? ', Increase Contrast' : ''}`} style={{ width: W * z, height: H * z, position: 'relative', overflow: 'hidden', borderRadius: `0 ${20 * z}px 0 0`, maxWidth: '100%', background: 'var(--c-bg)', boxShadow: '0 0 0 1px var(--c-border)' }}>
          <div style={{ transform: `scale(${z})`, transformOrigin: '0 0', width: W, height: H, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -10, left: 20, right: 0, display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600, color: 'var(--c-text)' }}>Draft time</span>
              <span style={{ fontSize: 15, lineHeight: '20px', color: 'var(--c-text-2)' }}>Sat, Nov 14 · 6:45 PM ET</span>
              <span style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600, color: 'var(--c-text)' }}>Rounds</span>
              <span style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600, color: 'var(--c-text)' }}>Stakes</span>
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: FADE, background: `linear-gradient(to bottom, var(--c-bg) 0, var(--c-bg) 12px, ${clear('var(--c-bg)')} ${FADE}px)` }} />
            <span style={{ position: 'absolute', top: EDGE - 7, right: SIDE - 7, width: TARGET, height: TARGET, borderRadius: 6, boxShadow: 'inset 0 0 0 1px var(--c-accent)', opacity: 0.8, backgroundImage: 'none' }} />
            <Close border={contrast} />
          </div>
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const save = <Btn>Save changes</Btn>;

  function SheetTop() {
    return (
      <section className="b-sec" id="call-sheet-top" aria-labelledby="call-sheet-top-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Sheets</span>
          <div>
            <h2 id="call-sheet-top-h">For your sign-off: the floating close on tall sheets</h2>
            <p className="b-job">You picked "b": no bar, a small round close button in the sheet's top corner, the content scrolling the full height under it and fading as it passes. Here it is on every tall sheet that pins a header today, Light and Dark, at Large and at your text size. Nothing to choose: tell me if anything looks wrong.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>The close button.</b> A {CLOSE} pt circle in the sheet's inset colour with an × in the secondary text colour, {EDGE} pt from the top edge and {SIDE} pt from the right (the same {SIDE} pt the content keeps from the edge). Its tap target is {TARGET} pt. It doesn't grow with text size, like iOS's own close buttons. It stays put while everything else scrolls.</li>
          <li><b>What sits behind it.</b> The button is solid, so text passing under it never shows through. Behind it, a fade in the sheet's own colour runs the full width: solid for the first 12 pt, clear by {FADE} pt. It appears only once you've scrolled, so at the top nothing covers the title. It's the same soft edge the sheets already have above a pinned button at the bottom.</li>
          <li><b>No empty band above it.</b> The title's first line sits beside the button, {EDGE} pt below the sheet's edge. The ~70 pt gap above "Cancel" today is a bug that's already being fixed separately.</li>
          <li><b>The title scrolls away with the content.</b> At the top of every sheet it's the first thing you see ("League settings", "Paolo M.", "Trade history", "Forgot password?"), with room left for the button on its line. At your size it wraps beside the button instead of under it.</li>
          <li><b>A form that can save: League settings for the commissioner, before the draft.</b> The × replaces "Cancel". "Save changes" stays where it is today, pinned at the bottom. If you've changed something and tap ×, or swipe the sheet down, it doesn't close: iOS's own two-button sheet asks first, "Discard changes" <NEW /> or "Keep editing" <NEW />. With no changes, × closes at once. Today "Cancel" and swipe-down both throw your edits away without asking.</li>
          <li><b>Read-only sheets</b> (League settings for a member, a manager's team, Trade history, Forgot password): × and swipe-down close straight away. Forgot password has nothing saved to lose, so it never asks. VoiceOver still hears "Back to sign in" there, the words its button has today.</li>
          <li><b>VoiceOver.</b> It reads the title first, then the close button, then the content top to bottom, then the pinned button. The two-finger scrub to go back does exactly what × does, including the discard question.</li>
          <li><b>Accessibility settings.</b> Reduce Motion: nothing here moves on its own. The fade follows your finger, and the button doesn't animate in. Reduce Transparency: no change, because the fade is a solid colour turning clear, not a see-through blur, and the button is solid. Increase Contrast: the button gets a thin outline in the strong border colour (bottom right).</li>
          <li><b>Sheets that don't change.</b> The sheets that rise from the bottom with a grab handle (a stock, the sale picker, Leave, the draft time, the "i" popups) already scroll their title with the content and have no pinned header. Create league is a full-screen flow, not a sheet: it keeps "Cancel" / "Back" and its step count, but gets the same fade instead of the hard edge. So do pages you go back from (Profile, Change password, Username), which keep their back button. Change password is one of those pages, not a sheet.</li>
          <li><b>New words, for your OK as written:</b> "Discard changes" and "Keep editing". Everything else is words the app already uses.</li>
        </ul>

        <h3 className="b-sub">League settings, commissioner (can save): today, then the new top</h3>
        <Grid>{[
          fig('today', 'Today · scrolled · Light · Large', <PageSheet t="light" today offset={150} footer={save} label="League settings as build 14 ships it, scrolled: an empty band, a pinned Cancel row, the rows cut on a hard line"><CommishBody x={1} /></PageSheet>, 'The empty band, then "Cancel" stuck on a block that cuts "Draft" in half.'),
          fig('lr', 'New · at the top · Light · Large', <PageSheet t="light" footer={save} label="League settings, new top, at the top, Light, Large"><CommishBody x={1} /></PageSheet>, 'The title beside the close button; nothing above them.'),
          fig('ls', 'New · scrolled · Light · Large', <PageSheet t="light" offset={260} footer={save} label="League settings, new top, scrolled, Light, Large"><CommishBody x={1} /></PageSheet>, 'The rows pass under the button and fade out; no line cuts them.'),
        ]}</Grid>
        <Grid>{[
          fig('ds', 'New · scrolled · Dark · Large', <PageSheet t="dark" offset={260} footer={save} label="League settings, new top, scrolled, Dark, Large"><CommishBody x={1} /></PageSheet>, 'Same in Dark: the fade is the dark sheet colour.'),
          fig('ar', 'New · at the top · Light · your size (AX5, approximate)', <PageSheet t="light" footer={save} label="League settings, new top, at the top, Light, AX5"><CommishBody x={AX5} /></PageSheet>, '"League settings" wraps beside the button, never under it. The button stays the same size.'),
          fig('as', 'New · scrolled · Dark · your size (AX5, approximate)', <PageSheet t="dark" offset={400} footer={save} label="League settings, new top, scrolled, Dark, AX5"><CommishBody x={AX5} /></PageSheet>, 'Big rows pass under it the same way.'),
        ]}</Grid>

        <h3 className="b-sub">Closing with changes you haven't saved</h3>
        <Grid>{[
          fig('dl', 'After an edit, × or swipe down · Light · Large', <PageSheet t="light" offset={0} footer={save} overlay={<DiscardSheet />} label="League settings, after changing the league name, the discard question, Light"><CommishBody x={1} /></PageSheet>, 'iOS’s own two-button sheet. "Keep editing" goes back with your changes in place.'),
          fig('dd', 'After an edit, × or swipe down · Dark · Large', <PageSheet t="dark" offset={0} footer={save} overlay={<DiscardSheet />} label="League settings, the discard question, Dark"><CommishBody x={1} /></PageSheet>, 'Same in Dark.'),
        ]}</Grid>

        <h3 className="b-sub">League settings, member (read-only)</h3>
        <Grid>{[
          fig('ml', 'At the top · Light · Large', <PageSheet t="light" label="League settings, member, at the top, Light, Large"><MemberBody x={1} /></PageSheet>, 'No Save, so × just closes.'),
          fig('md', 'Scrolled · Dark · your size (AX5, approximate)', <PageSheet t="dark" offset={190} label="League settings, member, scrolled, Dark, AX5"><MemberBody x={AX5} /></PageSheet>, 'At your size even the member sheet scrolls; the names fade under the button.'),
        ]}</Grid>

        <h3 className="b-sub">The other tall sheets</h3>
        <Grid>{[
          fig('tm', 'A manager’s team · scrolled · Light · Large', <PageSheet t="light" offset={95} label="A manager's team, scrolled, Light, Large"><TeamBody x={1} /></PageSheet>, 'Today the name and × sit on a pinned bar. Now the name scrolls away and the × stays.'),
          fig('th', 'Trade history · scrolled · Dark · Large', <PageSheet t="dark" offset={70} label="Trade history, scrolled, Dark, Large"><HistoryBody x={1} /></PageSheet>, 'The title and the filter scroll with the list.'),
          fig('fp', 'Forgot password · Light · Large', <PageSheet t="light" label="Forgot password, Light, Large"><ForgotBody x={1} /></PageSheet>, '× replaces "‹ Back to sign in". It goes to the same place.'),
        ]}</Grid>

        <h3 className="b-sub">The close button and the fade, the sheet's top-right corner up close (2×)</h3>
        <div className="b-concepts b-concepts--three">
          {[['light', false], ['dark', false], ['light', true]].map(([t, c]) => (
            <figure key={t + c} className="b-fig b-fig--inv" style={{ margin: 0 }}><Corner t={t} contrast={c} /><figcaption><b>{t === 'light' ? 'Light' : 'Dark'}{c ? ' · Increase Contrast' : ''}</b><span className="b-annot">Review note: the thin accent square is the {TARGET} pt tap target, drawn here only to show its size. The app doesn't draw it.</span></figcaption></figure>
          ))}
        </div>
      </section>
    );
  }

  window.KSSheetTop = () => <SheetTop />;
})();
