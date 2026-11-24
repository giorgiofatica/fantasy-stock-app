// Stockpile key-screens board — "Your call: ordering your claims, and the claim that can't run" (2026-11-23).
// His rule (docs/PRODUCT_RULES.md, 2026-11-23; plan docs/plans/2026-11-18-stocks-tab.md point 10): "I get a
// multiple claims. I get to order the priority." Each pending claim has a place in its manager's own list (1 to 5);
// at the run, your first claim is tried first. Two claims may name the same sale: if the first fills, the second
// is void (nothing bought, nothing sold, the order unchanged). The Claims list is the approved one from
// #call-stocks-tab-lists (2026-11-22); this board adds only the order, the control that changes it, and the void
// ending. Data: Tier Cup, a price-tier league ($100–$200 slot), Roberto B.'s phone, Friday evening; the run is
// Monday at 9:30. Only a sale in the same tier can pay for a buy, so every claim here sells DIS or PYPL.
// Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap = 1.3, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const STORE = 'M4.5 4h15l1.5 5H3z M3 9c0 1.5 1.1 2.5 2.5 2.5S8 10.5 8 9c0 1.5 1.1 2.5 2.5 2.5S13 10.5 13 9c0 1.5 1.1 2.5 2.5 2.5S18 10.5 18 9c0 1.5 1.1 2.5 2.5 2.5 M5 11.5V20h14v-8.5 M10 20v-5h4v5';
  const GRIP = 'M5 8.5h14 M5 12h14 M5 15.5h14';
  // keepTime / keepMoney: a time or a money range never breaks across lines.
  const NW = ({ children }) => <span style={{ whiteSpace: 'nowrap' }}>{children}</span>;
  const keep = (str) => str.split(/(Mon 9:30 AM ET|\$100–\$200 slot)/).map((p, i) => (i % 2 ? <NW key={i}>{p}</NW> : p));

  // Your pending claims, in your order: the first two sell the same stock (DIS).
  const PENDING = [['AMGN', 'Selling DIS'], ['SHOP', 'Selling DIS'], ['LOW', 'Selling PYPL']];

  function OS() {
    return <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;
  }
  function TabBar() {
    const tab = (d, l, on) => <span key={l} style={{ display: 'grid', justifyItems: 'center', gap: 2, color: on ? 'var(--c-accent)' : 'var(--c-text-2)', fontSize: 10, fontWeight: 600 }}><Icon d={d} size={22} width={2} />{l}</span>;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', paddingTop: 8, zIndex: 3 }}>
        {tab(ICON.home, 'Home')}{tab(ICON.matchup, 'Matchup')}{tab(ICON.league, 'League')}{tab(ICON.portfolio, 'Portfolio')}{tab(STORE, 'Stocks', true)}
      </div>
    );
  }
  function Page({ t = 'light', x = 1, label, children }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 78, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 10px', flexShrink: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', ...fs(16, x), fontWeight: 600, color: 'var(--c-text)' }}>Tier Cup<Icon d={ICON.chevron} size={13} width={2.4} /></span>
              <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-you)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>RB</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: 3, borderRadius: 10, background: 'var(--c-inset)', ...fs(14, x), fontWeight: 600, marginBottom: 10, flexShrink: 0 }}>
              {['Available', 'Watching', 'Claims'].map((l) => (
                <span key={l} style={{ textAlign: 'center', padding: '7px 2px', borderRadius: 8, background: l === 'Claims' ? 'var(--c-surface)' : 'transparent', color: l === 'Claims' ? 'var(--c-text)' : 'var(--c-text-2)', whiteSpace: 'nowrap' }}>{l}</span>
              ))}
            </div>
            {children}
          </div>
          <TabBar />
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }
  function Position({ x, place }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-rim)', marginBottom: 12, flexShrink: 0 }}>
        <span style={{ flex: 1, ...fs(15, x), color: 'var(--c-text)' }}>You're <b>{place}</b> of 6 in the waiver order</span>
        <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.right} size={14} width={2.4} /></span>
      </div>
    );
  }
  const Label = ({ x, children }) => <span style={{ ...fs(11, x), fontWeight: 800, letterSpacing: 1, color: 'var(--c-text-2)', marginBottom: 4, flexShrink: 0 }}>{children}</span>;
  function Disc({ sym }) {
    return <span style={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: 20, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: sym.length > 3 ? 9.5 : 10.5, fontWeight: 800, color: 'var(--c-text)' }}>{sym}</span>;
  }
  const Num = ({ x, n }) => <span className="dr-num" style={{ ...fs(15, x), fontWeight: 700, color: 'var(--c-text-2)', width: 16, flex: '0 0 16px', textAlign: 'center' }}>{n}</span>;

  /** The reorder control. A: the grip at the right edge (drag it, or press and hold the row). B: up and down. */
  function Grip() {
    return <span style={{ width: 36, flex: '0 0 36px', display: 'grid', placeItems: 'center', color: 'var(--c-text-2)' }}><Icon d={GRIP} size={22} width={2.2} /></span>;
  }
  function Arrows({ first, last }) {
    const b = (off, flip) => (
      <span style={{ width: 34, height: 34, borderRadius: 17, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', display: 'grid', placeItems: 'center', color: 'var(--c-text)', opacity: off ? 0.3 : 1, transform: flip ? 'rotate(180deg)' : 'none' }}><Icon d={ICON.up} size={15} width={2.6} /></span>
    );
    return <span style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>{b(first)}{b(last, true)}</span>;
  }

  function PendingRow({ x, n, sym, fund, control, lifted, first, last }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: lifted ? '8px 8px' : '8px 0', margin: lifted ? '2px -8px' : 0, flexShrink: 0,
        borderBottom: lifted ? 'none' : '1px solid var(--c-border)', borderRadius: lifted ? 12 : 0,
        background: lifted ? 'var(--c-surface)' : 'transparent', boxShadow: lifted ? '0 10px 24px rgba(8,13,37,.22), inset 0 0 0 1px var(--c-rim)' : 'none', transform: lifted ? 'scale(1.02)' : 'none', position: 'relative', zIndex: lifted ? 2 : 0,
      }}>
        <Num x={x} n={n} />
        <Disc sym={sym} />
        <span style={{ flex: 1, minWidth: 0, display: 'grid' }}><b style={{ ...fs(16, x), color: 'var(--c-text)' }}>Buy {sym}</b><span style={{ ...fs(13, x), color: 'var(--c-text-2)' }}>{keep(`${fund} · fills Mon 9:30 AM ET`)}</span></span>
        <span style={{ ...fs(15, x), fontWeight: 700, color: 'var(--c-accent)', padding: '0 2px' }}>Cancel</span>
        {control === 'grip' ? <Grip /> : <Arrows first={first} last={last} />}
      </div>
    );
  }

  /** Pending claims with the order. control: grip | arrows. drag: LOW lifted, mid-move to 2nd. */
  function Pending({ t = 'light', x = 1, control = 'grip', drag, label }) {
    const rows = drag ? [PENDING[0], PENDING[2], PENDING[1]] : PENDING;
    return (
      <Page t={t} x={x} label={label}>
        <Position x={x} place="3rd" />
        <Label x={x}>PENDING</Label>
        {rows.map(([s, fund], i) => (
          <PendingRow key={s} x={x} n={i + 1} sym={s} fund={fund} control={control} lifted={drag && s === 'LOW'} first={i === 0} last={i === rows.length - 1} />
        ))}
      </Page>
    );
  }

  /** After the run: one card per claim, in your order. */
  const OUT = {
    won: [
      ['won', 'AMGN is yours', '$187.20 at the open · paid by selling DIS'],
      ['void', 'SHOP not bought', 'Your DIS was already sold for AMGN.'],
      ['failed', 'LOW opened at $203.10, above your $100–$200 slot', 'Nothing was bought.'],
    ],
    lost: [
      ['lost', 'Gianluigi B. claimed AMGN · lower in the standings', 'Your DIS paid for SHOP instead.'],
      ['won', 'SHOP is yours', '$142.80 at the open · paid by selling DIS'],
      ['failed', 'LOW opened at $203.10, above your $100–$200 slot', 'Nothing was bought.'],
    ],
  };
  function Endings({ t = 'light', x = 1, run = 'won', label }) {
    return (
      <Page t={t} x={x} label={label}>
        <Position x={x} place="6th" />
        <Label x={x}>MON 9:30 AM ET</Label>
        <div style={{ height: 2 }} />
        {OUT[run].map(([kind, title, line], i) => (
          <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: kind === 'won' ? 'var(--c-accent-tint)' : 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-rim)', marginBottom: 8, flexShrink: 0 }}>
            <Num x={x} n={i + 1} />
            <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
              <b style={{ ...fs(15, x), color: 'var(--c-text)' }}>{keep(title)}</b>
              <span style={{ ...fs(13, x), color: 'var(--c-text-2)' }}>{line}</span>
            </span>
          </div>
        ))}
      </Page>
    );
  }

  /** The notifications Monday morning: 1 = the void claim sends none, 2 = it sends one too. */
  function Pushes({ t = 'light', withVoid, label }) {
    const n = (title, body) => (
      <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 18, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-rim)' }}>
        <span style={{ width: 34, height: 34, flex: '0 0 34px', borderRadius: 8, background: 'var(--c-accent)', display: 'grid', placeItems: 'center', color: 'var(--c-on-accent)' }}><Icon d={STORE} size={18} width={2} /></span>
        <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 1, fontSize: 13, lineHeight: '17px' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-text-2)', fontSize: 11.5 }}><span>Stockpile</span><span>9:31 AM</span></span>
          <b style={{ color: 'var(--c-text)' }}>{keep(title)}</b>
          <span style={{ color: 'var(--c-text)' }}>{body}</span>
        </span>
      </div>
    );
    return (
      <Th t={t}>
        <div role="img" aria-label={label} style={{ background: 'var(--c-bg)', padding: 12, borderRadius: 14, display: 'grid', gap: 8, maxWidth: 360 }}>
          {n('AMGN is yours', '$187.20 at the open · paid by selling DIS')}
          {withVoid ? n('SHOP not bought', 'Your DIS was already sold for AMGN.') : null}
          {n('LOW opened at $203.10, above your $100–$200 slot', 'Nothing was bought.')}
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
  // Decided 2026-11-23: sections 3 and 4 were overruled ("we dont need to notify or have messages for claims that
  // didnt go through"). Archived, they stay drawn for the record under a struck heading and a dashed note.
  const Overruled = ({ archived, children }) => (archived ? (
    <>
      <h3 className="b-sub"><s>{children}</s> · overruled</h3>
      <p style={{ margin: '0 0 12px', padding: '6px 10px', borderRadius: 8, border: '1px dashed var(--c-border-strong)', background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 13, fontWeight: 600, lineHeight: 1.4, maxWidth: 840 }}>Review note: overruled 2026-11-23. A claim that did not go through gets no notification and no message; after the run it is simply no longer pending. Only the filled claim’s words stay (“AMGN is yours”, “$187.20 at the open · paid by selling DIS”). What went through is shown the ESPN way instead (#call-league-activity).</p>
    </>
  ) : <Sub>{children}</Sub>);

  const NEW_WORDS = [
    ['SHOP not bought', 'a claim that could not run because its sale already paid for an earlier claim (the title)'],
    ['Your DIS was already sold for AMGN.', 'its second line'],
    ['Your DIS paid for SHOP instead.', 'the second line of a LOST claim when a later claim used the same sale. The approved “Your TSLA was not sold.” would be false there, since DIS was sold'],
    ['Move up, Move down', 'A only: VoiceOver’s actions on each claim, never on screen (a drag can’t be done by voice)'],
  ];

  function CallClaimsOrder({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-claims-order" aria-labelledby="call-claims-order-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Claims</span>
          <div>
            <h2 id="call-claims-order-h">{archived ? 'Decided: ordering your claims, and the claim that can’t run' : 'Your call: ordering your claims, and the claim that can’t run'}</h2>
            <p className="b-job">“I get to order the priority.” Your claims get a number, 1 to 5, and the run tries 1 first. Two claims can sell the same stock: if the first fills, the second can’t run.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>The number</b> at the left of each pending claim is its place in your list. A new claim goes last; cancelling one closes the gap. Nobody else sees your list.</li>
          <li><b>Reorder · A, drag (ESPN’s way).</b> A grip at the right edge; drag it, or press and hold anywhere on the row. The numbers change as the row moves. <b>B, up and down buttons</b> on each row.</li>
          <li><b>Recommended: A.</b> It is what ESPN does and what iPhone lists do, and it costs one small mark per row. B puts two buttons beside Cancel on every row, which narrows the claim so its line wraps even at the default size, and the first row’s up and the last row’s down never do anything.</li>
          <li><b>The claim that can’t run.</b> After the run each claim keeps its number, so your second choice sits right under your first. If AMGN fills by selling DIS, SHOP (also selling DIS) reads “SHOP not bought”. If someone ahead of you takes AMGN, SHOP moves up and fills with DIS.</li>
          <li><b>Its notification · 1, none</b> (the Planner’s recommendation: you got your first choice, and a second message about it is noise; it still shows in Claims). <b>2, a notification like the others.</b></li>
          <li><b>New words, for your yes</b> (strike any you don’t want):
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {NEW_WORDS.map(([w, where]) => <li key={w}><b>{w}</b> · {where}</li>)}
            </ul>
          </li>
          <li><b>Already approved, reused:</b> Claims, Pending, Cancel, the waiver-order row, “fills Mon 9:30 AM ET”, “MON 9:30 AM ET” and the three endings (#call-stocks-tab-lists).</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B for the reorder, 1 or 2 for the notification, and yes to the words (or the ones to change).</>}</li>
        </ul>

        <Sub>1 · Reorder · A, drag</Sub>
        <Grid>{[
          fig('a1', 'A · your three claims', <Pending label="Claims, three pending, with a grip on each" />, 'AMGN and SHOP both sell DIS: SHOP is the second choice.'),
          fig('a2', 'A · moving LOW to 2nd', <Pending drag label="Claims, LOW lifted mid-drag into second place" />, 'LOW lifts while you hold it; the numbers follow it.'),
          fig('a3', 'A · your text size', <Pending x={AX5} label="Claims with grips, largest text size" />),
          fig('a4', 'A · Dark', <Pending t="dark" label="Claims with grips, Dark" />),
        ]}</Grid>

        <Sub>2 · Reorder · B, up and down</Sub>
        <Grid>{[
          fig('b1', 'B · your three claims', <Pending control="arrows" label="Claims, three pending, with up and down buttons" />, 'The first row’s up and the last row’s down are dimmed.'),
          fig('b2', 'B · your text size', <Pending control="arrows" x={AX5} label="Claims with up and down buttons, largest text size" />),
        ]}</Grid>

        <Overruled archived={archived}>3 · After the run, Monday 9:30</Overruled>
        <Grid>{[
          fig('v1', 'Your first choice filled', <Endings label="Claims after the run: AMGN won, SHOP not bought, LOW failed" />, 'You won a claim, so you moved to 6th of 6.'),
          fig('v2', 'Your first choice was taken', <Endings run="lost" label="Claims after the run: AMGN lost, SHOP won, LOW failed" />, 'SHOP moved up and filled with DIS.'),
          fig('v3', 'Your text size', <Endings x={AX5} label="Claims after the run, largest text size" />),
          fig('v4', 'Dark', <Endings t="dark" label="Claims after the run, Dark" />),
        ]}</Grid>

        <Overruled archived={archived}>4 · The notifications that morning</Overruled>
        <Grid>{[
          figPlain('p1', '1 · none for SHOP', <Pushes label="Two notifications" />, 'SHOP shows only in Claims.'),
          figPlain('p2', '2 · one for SHOP too', <Pushes withVoid label="Three notifications" />),
          figPlain('p3', '1 · Dark', <Pushes t="dark" label="Two notifications, Dark" />),
        ]}</Grid>
      </section>
    );
  }

  window.KSClaimsOrder = () => null;
  window.KSClaimsOrderArchived = () => <CallClaimsOrder archived decidedNote={<><b>Decided 2026-11-23, in his words:</b> “A”, then “we dont need to notify or have messages for claims that didnt go through. here is the espn league activity and waiver report screens.” Reorder is A: the grip, drag it or press and hold the row; “Move up” and “Move down” for VoiceOver. Sections 3 and 4 are overruled as drawn: no notification and no message for any claim that didn’t go through, so “SHOP not bought”, “Your DIS was already sold for AMGN.” and “Your DIS paid for SHOP instead.” are not approved. Only “AMGN is yours” / “$187.20 at the open · paid by selling DIS” stays.</>} />;
})();
