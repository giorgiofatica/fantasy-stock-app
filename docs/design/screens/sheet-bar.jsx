// Stockpile key-screens board — "Your call: the top bar on League settings" (Giorgio, 2026-11-12).
// A new direction that replaces the floating close (never signed off). He sent two screenshots of
// ESPN Fantasy's league manager ("Scoring Settings", "Basic Settings") and said: "i like the idea of
// having the top left being a back or close button and the top right being the save button. it is
// greyed out until you make a change and then you click save when it populates". So: a solid top bar,
// close at the left, the title in the middle, Save at the right (grey until something changes), and
// no pinned Save at the bottom. A: "League settings" in the bar and the league's name in a row (as
// ESPN does). B: the league's name in the bar (his "C" from the round before). Review notes sit UNDER
// the phones, never inside them.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1; // the largest accessibility size over Large (approximate, as on the other boards)
  const BAR_CAP = 1.3; // the bar's words stop growing here, as iOS's own bar titles do
  const SHEET_TOP = 64;
  const FADE = 24; // the soft edge under the bar, in the bar's own colour

  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const clear = (c) => `color-mix(in srgb, ${c} 0%, transparent)`;

  const Pencil = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--c-text-2)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
  );

  /** The bar: close at the left (44 pt), the title centred, Save at the right. save: null (no Save), 'off' (grey), 'on'. */
  function Bar({ x, title, pencil, save, scrolled }) {
    const h = Math.max(56, Math.round(22 * k(x, BAR_CAP)) + 30);
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h, background: 'var(--c-surface)', zIndex: 4, display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr) 84px', alignItems: 'center', boxShadow: scrolled ? '0 1px 0 var(--c-border)' : 'none' }}>
        <span style={{ width: 44, height: 44, marginLeft: 8, display: 'grid', placeItems: 'center', color: 'var(--c-text)' }}><Icon d={ICON.close} size={20} width={2.4} /></span>
        <span style={{ ...fs(17, x, BAR_CAP), fontWeight: 700, color: 'var(--c-text)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>{pencil ? <span style={{ flex: 'none', display: 'grid' }}><Pencil size={Math.round(15 * k(x, BAR_CAP))} /></span> : null}
        </span>
        {save ? (
          <span style={{ ...fs(17, x, BAR_CAP), fontWeight: 600, textAlign: 'right', paddingRight: 20, color: save === 'on' ? 'var(--c-accent)' : 'var(--c-text-2)', opacity: save === 'on' ? 1 : 0.45 }}>Save</span>
        ) : <span />}
        {scrolled ? <div style={{ position: 'absolute', left: 0, right: 0, top: h + 1, height: FADE, background: `linear-gradient(to bottom, var(--c-surface) 0, var(--c-surface) 6px, ${clear('var(--c-surface)')} ${FADE}px)`, pointerEvents: 'none' }} /> : null}
      </div>
    );
  }

  /** A page sheet with the bar. offset: how far the content has scrolled under the bar. */
  function BarSheet({ t, x = 1, label, title, pencil, save, offset = 0, overlay, children }) {
    const h = Math.max(56, Math.round(22 * k(x, BAR_CAP)) + 30);
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label} style={{ background: 'oklch(18% 0.01 270)' }}>
          <div className="ks-os" style={{ color: '#fff' }}>
            <span>9:41</span>
            <span className="ks-os__island" />
            <span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span>
          </div>
          <div style={{ position: 'absolute', top: 54, left: 14, right: 14, height: 40, borderRadius: '14px 14px 0 0', background: 'var(--c-surface)', opacity: 0.5 }} />
          <div style={{ position: 'absolute', top: SHEET_TOP, left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', background: 'var(--c-bg)', overflow: 'hidden' }}>
            <Bar x={x} title={title} pencil={pencil} save={save} scrolled={offset > 0} />
            <div style={{ position: 'absolute', top: h, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
              <div style={{ transform: `translateY(${-offset}px)`, padding: '16px 0 40px', display: 'grid', gap: 16 }}>{children}</div>
            </div>
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
          {overlay}
        </div>
      </Th>
    );
  }

  // ── Content: full-width cards with the page colour between them (as the ESPN screens). ──
  const Head = ({ x, children }) => <span style={{ ...fs(13, x, 1.6), fontWeight: 700, color: 'var(--c-text-2)', padding: '0 20px', marginBottom: -8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</span>;
  const Card = ({ children }) => <div style={{ background: 'var(--c-surface)', padding: '0 20px', display: 'grid' }}>{children}</div>;
  const Div = () => <div style={{ height: 1, background: 'var(--c-border)', marginRight: -20 }} />;
  function Row({ x, k: key, v, chev, edit, strong }) {
    const s = x >= 2;
    return (
      <div style={{ display: 'flex', flexDirection: s ? 'column' : 'row', justifyContent: 'space-between', alignItems: s ? 'flex-start' : 'center', gap: s ? 2 : 12, padding: '13px 0', minHeight: 44 }}>
        <span style={{ ...fs(15, x, 1.3), fontWeight: 600, color: 'var(--c-text)' }}>{key}</span>
        {v ? <span className="dr-num" style={{ ...fs(15, x, 1.6), color: edit || strong ? 'var(--c-text)' : 'var(--c-text-2)', display: 'flex', alignItems: 'center', gap: 6, textAlign: s ? 'left' : 'right' }}>{v}{edit ? <span style={{ width: 2, alignSelf: 'stretch', background: 'var(--c-accent)', marginLeft: 1 }} /> : null}{chev ? <Icon d={ICON.right} size={14} width={2.4} /> : null}</span> : null}
      </div>
    );
  }
  function Seg({ x, opts, on }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${opts.length}, 1fr)`, gap: 2, padding: 2, borderRadius: 10, background: 'var(--c-inset)', margin: '0 0 13px' }}>
        {opts.map((o) => <span key={o} className="dr-num" style={{ ...fs(13, x, 1.3), textAlign: 'center', padding: '6px 0', borderRadius: 8, fontWeight: 700, background: o === on ? 'var(--c-surface)' : 'transparent', color: o === on ? 'var(--c-text)' : 'var(--c-text-2)', boxShadow: o === on ? '0 1px 2px oklch(0% 0 0 / 0.12)' : 'none' }}>{o}</span>)}
      </div>
    );
  }
  function Stepper({ x, label, value }) {
    const b = (d) => <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'var(--c-text)' }}><Icon d={d} size={16} width={2.4} /></span>;
    const st = x >= 1.35;
    return (
      <div style={{ display: 'flex', flexDirection: st ? 'column' : 'row', alignItems: st ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0' }}>
        <span style={{ ...fs(15, x, 1.6), fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>
        <span style={{ display: 'inline-flex', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>{b('M5 12h14')}<b className="dr-num" style={{ ...fs(17, x, 1.6), width: Math.round(56 * k(x, 1.6)), display: 'grid', placeItems: 'center', borderInline: '1px solid var(--c-border)', color: 'var(--c-text)' }}>{value}</b>{b(ICON.plus)}</span>
      </div>
    );
  }

  /** The commissioner's League settings. nameRow: A puts the league's name in the first card. */
  function Settings({ x, nameRow, name = 'Serie A Traders', editing }) {
    return (
      <>
        {nameRow ? <Card><Row x={x} k="League name" v={name} edit={editing} strong /></Card> : null}
        <Head x={x}>Draft</Head>
        <Card>
          <Row x={x} k="Pick clock" v="60 seconds" />
          <Seg x={x} opts={['30s', '45s', '60s', '75s', '90s']} on="60s" />
          <Div />
          <Row x={x} k="Draft time" v="Sat, Nov 14 · 6:45 PM ET" chev />
          <Div />
          <Stepper x={x} label="Rounds" value="6" />
          <Div />
          <Stepper x={x} label="Teams" value="6" />
        </Card>
        <Head x={x}>Stakes</Head>
        <Card><Row x={x} k="Stake per slot ($)" v="2,000" strong /></Card>
        <Head x={x}>Roster slots</Head>
        <Card>
          <Row x={x} k="Tech" v="×2" />
          <Div />
          <Row x={x} k="Autos & Transport" v="×2" />
          <Div />
          <Row x={x} k="Flex" v="×2" />
        </Card>
        <Head x={x}>League info</Head>
        <Card>
          <Row x={x} k="Type" v="Matchup" />
          <Div />
          <Row x={x} k="Playoff teams" v="4" />
        </Card>
        <Card><Row x={x} k="Invite code" v="SCUD26" /></Card>
      </>
    );
  }
  function Member({ x }) {
    return (
      <>
        <Card>
          <Row x={x} k="League name" v="Serie A Traders" />
          <Div />
          <Row x={x} k="Invite code" v="SCUD26" />
          <Div />
          <Row x={x} k="Commissioner" v="Paolo M." />
        </Card>
        <Card>
          {['Paolo M.', 'Roberto B.', 'Alessandro D.', 'Francesco T.', 'Gianluigi B.', 'Andrea P.'].map((n, i) => (
            <React.Fragment key={n}>{i ? <Div /> : null}<Row x={x} k={n} /></React.Fragment>
          ))}
        </Card>
        <Card>
          <div style={{ padding: '13px 0', display: 'grid', gap: 4 }}>
            <span style={{ ...fs(15, x, 1.3), fontWeight: 700, color: 'var(--c-loss)' }}>Leave league</span>
            <span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>You can leave until Sun 5:00 PM ET.</span>
          </div>
        </Card>
      </>
    );
  }
  function History({ x }) {
    const rows = [['Bought NVDA', 'Wed 10:42 AM ET · 4.21 shares', '$987.43'], ['Sold TM', 'Wed 10:41 AM ET · 5.18 shares', '$987.43'], ['Bought AAPL', 'Mon 2:15 PM ET · 9.88 shares', '$2,032.68'], ['Sold V', 'Mon 2:14 PM ET · 6.97 shares', '$2,032.68'], ['Drafted COST', 'Sat 6:52 PM ET · 2.19 shares', '$2,000.01'], ['Drafted MSFT', 'Sat 6:50 PM ET · 4.51 shares', '$2,000.01'], ['Drafted NVDA', 'Sat 6:47 PM ET · 11.0 shares', '$2,000.01'], ['Drafted AAPL', 'Sat 6:45 PM ET · 9.46 shares', '$2,000.01']];
    return (
      <>
        <div style={{ padding: '0 20px' }}><Seg x={x} opts={['All', 'Buys', 'Sells', 'Draft']} on="All" /></div>
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
  function Team({ x }) {
    const rows = [['NVDA', '$2,214.60', '+4.12%'], ['AAPL', '$2,061.33', '+1.94%'], ['MSFT', '$1,988.07', '−0.41%'], ['COST', '$2,120.45', '+2.58%'], ['V', '$2,032.68', '+1.63%'], ['TM', '$1,926.42', '−3.70%']];
    return (
      <>
        <div style={{ display: 'grid', gap: 2, padding: '0 20px' }}>
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
  function Forgot({ x }) {
    return (
      <div style={{ display: 'grid', gap: 16, padding: '0 20px' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ ...fs(15, x, 1.3), fontWeight: 600, color: 'var(--c-text)' }}>Email address</span>
          <span style={{ ...fs(17, x, 1.6), padding: '12px 14px', borderRadius: 12, background: 'var(--c-surface)', color: 'var(--c-text)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>roberto@</span>
        </div>
        <span style={{ display: 'grid', placeItems: 'center', minHeight: 52, borderRadius: 26, ...fs(17, x, 1.6), fontWeight: 700, background: 'var(--c-accent)', color: 'var(--c-on-accent)' }}>Send reset link</span>
      </div>
    );
  }
  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;

  function CallSheetBar({ archived = false, decided, decidedNote }) {
    return (
      <section className="b-sec" id="call-sheet-bar" aria-labelledby="call-sheet-bar-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Sheets</span>
          <div>
            <h2 id="call-sheet-bar-h">{archived ? `Decided: ${decided}, the top bar on League settings` : 'Your call: the top bar on League settings'}</h2>
            <p className="b-job">Your new direction from the ESPN screens: close at the top left, Save at the top right, grey until you change something. This replaces the floating close. Two ways to title the bar, drawn on League settings (Light, Large, then your text size), with the Save states, the read-only member, and the other tall sheets.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>The bar.</b> Solid, the card colour, full width, about 56 pt tall. Close (×) at the left with a 44 pt target. The title centred, bold, on one line. "Save" at the right. Nothing above the bar: it starts at the sheet's top edge, so there's no empty band.</li>
          <li><b>Save.</b> Grey and does nothing until you change something; then it turns the accent colour and saves. On success the sheet closes and the League tab shows the change; if it fails, the sheet stays open with the error. The big "Save changes" button at the bottom goes away.</li>
          <li><b>No cut-off words.</b> Rows scroll under the bar, not under a block that looks like the page. Once you scroll, a thin divider appears under the bar and a short fade in the bar's own colour runs under it (solid for 6 pt, clear by 24 pt), so a row going under dissolves into the bar instead of showing a sliver of cut-off letters. At the top neither shows.</li>
          <li><b>The rows.</b> Full-width white cards with the page colour between them, as on ESPN. Headings ("Draft", "Stakes", "League info") sit in the gaps as small capitals.</li>
          <li><b>A · "League settings" in the bar, the league's name in a row.</b> The first card is "League name | Serie A Traders"; tap it and you type in place. This is what the ESPN screens do.</li>
          <li><b>B · The league's name in the bar,</b> with the pencil: your "C" from the last round, already recorded, moved into the bar. Tap the title to rename it in the bar. A long name has to shorten with "…" in the bar, because the bar is one line between × and Save.</li>
          <li><b>{archived ? 'Recommended (not taken): A.' : 'Recommended: A.'}</b> It's the ESPN pattern you pointed at: the bar says which screen this is, and the name sits with every other setting, where a long name can wrap instead of being cut short. B only works for short names. Picking A replaces your "C" (the name as the title); picking B keeps it.</li>
          <li><b>Closing.</b> × (or a swipe down) closes the sheet at once. You decided there's no question first: unsaved changes are dropped ("no, hitting back or x just closes it").</li>
          <li><b>Read-only sheets</b> (League settings for a member, a manager's team, Trade history, Forgot password): the same bar with × at the left and no Save.</li>
          <li><b>Your text size.</b> The bar's words stop growing at 1.3× (as iOS's own bars do), so × , the title and Save never collide; the rows under it grow fully and stack label over value.</li>
          <li><b>No new words.</b> "Save" is the app's existing word.</li>
          {archived ? <li>{decidedNote}</li> : <li><b>Answer with:</b> A or B.</li>}
        </ul>

        <h3 className="b-sub">A · "League settings" in the bar, the name in a row{archived ? ' (recommended, not taken)' : ' (recommended)'}</h3>
        <Grid>{[
          fig('a0', 'A · at the top, nothing changed (Save grey) · Light · Large', <BarSheet t="light" title="League settings" save="off" label="League settings, option A, at the top, Save grey, Light, Large"><Settings x={1} nameRow /></BarSheet>, 'Save is grey until something changes.'),
          fig('a1', 'A · after a change, scrolled (Save on) · Light · Large', <BarSheet t="light" title="League settings" save="on" offset={120} label="League settings, option A, after a change, scrolled, Save active, Light, Large"><Settings x={1} nameRow name="Serie A Legends" /></BarSheet>, 'Save turns on; rows pass under the divider and fade.'),
          fig('a2', 'A · after a change, scrolled · Dark · Large', <BarSheet t="dark" title="League settings" save="on" offset={120} label="League settings, option A, scrolled, Save active, Dark, Large"><Settings x={1} nameRow name="Serie A Legends" /></BarSheet>, 'Same in Dark.'),
        ]}</Grid>
        <Grid>{[
          fig('a3', 'A · at the top · Light · your size (AX5, approximate)', <BarSheet t="light" x={AX5} title="League settings" save="off" label="League settings, option A, Light, AX5"><Settings x={AX5} nameRow /></BarSheet>, 'The bar holds its size; the name row stacks and wraps.'),
          fig('a4', 'A · renaming (Save on) · Light · Large', <BarSheet t="light" title="League settings" save="on" label="League settings, option A, renaming in the row, Light, Large"><Settings x={1} nameRow name="Serie A Legends" editing /></BarSheet>, 'Typing in the row; Save turns on with the first change.'),
        ]}</Grid>

        <h3 className="b-sub">B · the league's name in the bar{archived ? ' (decided)' : ''}</h3>
        <Grid>{[
          fig('b0', 'B · at the top, nothing changed (Save grey) · Light · Large', <BarSheet t="light" title="Serie A Traders" pencil save="off" label="League settings, option B, at the top, Light, Large"><Settings x={1} /></BarSheet>, 'The name is the bar title, with the pencil.'),
          fig('b1', 'B · a long name · Light · Large', <BarSheet t="light" title="The Saturday Morning Stock Pickers" pencil save="off" label="League settings, option B, a long name shortened in the bar, Light, Large"><Settings x={1} /></BarSheet>, 'A long name is cut short with "…" between × and Save.'),
          fig('b2', 'B · Light · your size (AX5, approximate)', <BarSheet t="light" x={AX5} title="Serie A Traders" pencil save="off" label="League settings, option B, Light, AX5"><Settings x={AX5} /></BarSheet>, 'At your size even "Serie A Traders" is close to the limit.'),
        ]}</Grid>

        <h3 className="b-sub">The read-only member</h3>
        <Grid>{[
          fig('m0', 'Member · Light · Large', <BarSheet t="light" title="League settings" label="League settings, member, read-only, Light, Large"><Member x={1} /></BarSheet>, 'No Save: a member can’t change anything.'),
          fig('m1', 'Member · scrolled · Dark · your size (AX5, approximate)', <BarSheet t="dark" x={AX5} title="League settings" offset={160} label="League settings, member, scrolled, Dark, AX5"><Member x={AX5} /></BarSheet>, 'The same bar at your size.'),
        ]}</Grid>

        <h3 className="b-sub">The other tall sheets: × at the left, no Save</h3>
        <Grid>{[
          fig('o0', 'Trade history · scrolled · Dark · Large', <BarSheet t="dark" title="Trade history" offset={60} label="Trade history, scrolled, Dark, Large"><History x={1} /></BarSheet>, 'No league switcher and no "‹ Portfolio" in the sheet: × closes it.'),
          fig('o1', 'A manager’s team · Light · Large', <BarSheet t="light" title="Paolo M." label="A manager's team, Light, Large"><Team x={1} /></BarSheet>, 'The name is the bar title, as today.'),
          fig('o2', 'Forgot password · Light · Large', <BarSheet t="light" title="Forgot password?" label="Forgot password, Light, Large"><Forgot x={1} /></BarSheet>, '× goes back to Sign in (VoiceOver still says "Back to sign in").'),
        ]}</Grid>
      </section>
    );
  }

  window.KSSheetBar = () => null; // decided 2026-11-12: B, and closing never asks; it lives in the Archive
  window.KSSheetBarArchived = () => (
    <CallSheetBar
      archived
      decided="B"
      decidedNote={<><b>Decided by Giorgio (2026-11-12): "B and no, hitting back or x just closes it".</b> The league's name is the bar's title with the pencil (his C, kept); Save sits at the bar's right, grey until a change; no pinned Save at the bottom. Closing (×, back, swipe down) never asks: unsaved changes are dropped, and the discard question this board drew was not approved, so it's taken out. Recorded in PRODUCT_RULES (the top-bar amendment under "A sheet's top must not be a stuck block that cuts text", and "League settings opens on the league's own name").</>}
    />
  );
})();
