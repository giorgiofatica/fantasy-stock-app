// Stockpile key-screens board — "Your call: closing Create league from any step" (Giorgio, 2026-11-17,
// build 16): "one thing when creating the league, i need to hit back a bunch before i can get back to
// the cancel button. should be a bit easier of a way to x out". Today only Step 1 has "Cancel"; steps
// 2-4 have "‹ Back" and "Step N of 4". Both options put a × on every step that closes the whole flow at
// once, with no question (his 2026-11-12 ruling: "hitting back or x just closes it"). They differ in
// where Back goes. Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const TOP = 1.3; // the top row's words stop growing here, as in Create league today
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;

  const Close = () => <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'var(--c-text)' }}><Icon d={ICON.close} size={20} width={2.4} /></span>;
  const Back = ({ x }) => <span style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--c-text-2)', ...fs(16, x, TOP) }}><Icon d={ICON.left} size={16} width={2.4} />Back</span>;
  const Count = ({ x, n }) => <span className="dr-num" style={{ ...fs(13, x, TOP), color: 'var(--c-text-2)' }}>{`Step ${n} of 4`}</span>;

  function Stepper({ x, label, value }) {
    const b = (d) => <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'var(--c-text)' }}><Icon d={d} size={16} width={2.4} /></span>;
    const st = x >= 1.35;
    return (
      <div style={{ display: 'flex', flexDirection: st ? 'column' : 'row', alignItems: st ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ ...fs(15, x, 1.6), fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>
        <span style={{ display: 'inline-flex', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>{b('M5 12h14')}<b className="dr-num" style={{ ...fs(17, x, 1.6), width: Math.round(84 * k(x, 1.6)), display: 'grid', placeItems: 'center', borderInline: '1px solid var(--c-border)', color: 'var(--c-text)', whiteSpace: 'nowrap' }}>{value}</b>{b(ICON.plus)}</span>
      </div>
    );
  }

  /** One Create league step. v: today | A | B. n: the step (1 = League, 2 = Season). */
  function Step({ t = 'light', x = 1, v, n = 2, label }) {
    let top;
    if (v === 'today') top = <>{n === 1 ? <span style={{ ...fs(16, x, TOP), color: 'var(--c-text-2)', minHeight: 44, display: 'grid', alignItems: 'center' }}>Cancel</span> : <Back x={x} />}<Count x={x} n={n} /></>;
    else if (v === 'A') top = <>{n === 1 ? <span style={{ width: 44 }} /> : <Back x={x} />}<Count x={x} n={n} /><span style={{ justifySelf: 'end' }}><Close /></span></>;
    else top = <><Close /><Count x={x} n={n} /></>;
    const title = n === 1 ? 'League' : 'Season';
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...(v === 'A' ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr' } : { display: 'flex', justifyContent: 'space-between' }), alignItems: 'center', padding: '0 12px 0 16px', minHeight: 48 }}>{top}</div>
            <div style={{ flex: 1, overflow: 'hidden', padding: '8px 20px', display: 'grid', alignContent: 'start', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {[1, 2, 3, 4].map((i) => <span key={i} style={{ height: 4, borderRadius: 2, background: i <= n ? 'var(--c-accent)' : 'var(--c-border)' }} />)}
              </div>
              <span style={{ ...fs(32, x, 1.6, 1.15), fontWeight: 800, color: 'var(--c-text)' }}>{title}</span>
              {n === 1 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={{ ...fs(15, x, 1.3), fontWeight: 600, color: 'var(--c-text)' }}>League name</span>
                  <span style={{ ...fs(17, x, 1.6), padding: '12px 14px', borderRadius: 12, background: 'var(--c-inset)', color: 'var(--c-text)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>Serie A Traders</span>
                </div>
              ) : (
                <div style={{ background: 'var(--c-surface)', borderRadius: 16, padding: 16, display: 'grid', gap: 14, boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
                  <Stepper x={x} label="Managers" value="6" />
                  <Stepper x={x} label="Regular season" value="11 wks" />
                  <Stepper x={x} label="Playoff teams" value="4" />
                </div>
              )}
            </div>
            <div style={{ padding: '0 20px 34px', display: 'flex', gap: 10 }}>
              {v === 'B' && n > 1 ? <span style={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: Math.round(52 * k(x, 1.3)), borderRadius: 30, boxShadow: 'inset 0 0 0 1.5px var(--c-border-strong)', ...fs(17, x, 1.6), fontWeight: 700, color: 'var(--c-text)' }}>Back</span> : null}
              <span style={{ flex: v === 'B' && n > 1 ? 2 : 1, display: 'grid', placeItems: 'center', minHeight: Math.round(52 * k(x, 1.3)), borderRadius: 30, background: 'var(--c-accent)', color: 'var(--c-on-accent)', ...fs(17, x, 1.6), fontWeight: 700 }}>Next</span>
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
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;

  function CallCreateClose({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-create-close" aria-labelledby="call-create-close-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">League</span>
          <div>
            <h2 id="call-create-close-h">{archived ? 'Decided: closing Create league from any step' : 'Your call: closing Create league from any step'}</h2>
            <p className="b-job">{'You said: "i need to hit back a bunch before i can get back to the cancel button. should be a bit easier of a way to x out". Both options put a × on every step that closes Create league at once, with no question, as you ruled for sheets. They differ in where Back goes.'}</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · Back at the top left, × at the top right.</b> "‹ Back" stays where it is today; × takes the top-right corner on every step, and "Step 2 of 4" moves to the middle to make room. On step 1 there's nothing to go back to, so the left is empty. This is how iPhone apps lay out a step-by-step flow.</li>
          <li><b>B · × at the top left, Back at the bottom.</b> × takes the top-left corner on every step, like the bar on your sheets, and "Step 2 of 4" stays on the right; Back moves down next to Next as its own button.</li>
          <li><b>In both:</b> × closes the whole flow and drops the half-made league, without asking. "Cancel" on step 1 becomes the ×.</li>
          <li><b>Recommended: A.</b> Back stays exactly where it was, so nothing you've learned moves, and × is always in the same corner. B makes the bottom two buttons, where it now takes a closer look to tell Next from Back.</li>
          <li><b>No new words.</b> "Back" is today's word; × has the VoiceOver label "Close".</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <h3 className="b-sub">Today (build 16)</h3>
        <Grid>{[
          fig('ct1', 'Today · step 1', <Step v="today" n={1} label="Create league step 1, today" />, '"Cancel" only here.'),
          fig('ct2', 'Today · step 2', <Step v="today" n={2} label="Create league step 2, today" />, 'Only Back: three taps to get to Cancel from step 4.'),
        ]}</Grid>
        <h3 className="b-sub">A · Back left, × right (recommended)</h3>
        <Grid>{[
          fig('ca1', 'A · step 1', <Step v="A" n={1} label="Create league step 1, option A" />, '× top right; nothing to go back to.'),
          fig('ca2', 'A · step 2', <Step v="A" n={2} label="Create league step 2, option A" />, 'Back where it was, × in the corner.'),
          fig('cad', 'A · step 2 · Dark', <Step t="dark" v="A" n={2} label="Create league step 2, option A, Dark" />),
          fig('cax', 'A · step 2 · your size (AX5, approximate)', <Step x={AX5} v="A" n={2} label="Create league step 2, option A, AX5" />, 'The top row stops growing at 1.3x, so Back, the count and × never collide.'),
        ]}</Grid>
        <h3 className="b-sub">B · × left, Back at the bottom</h3>
        <Grid>{[
          fig('cb1', 'B · step 1', <Step v="B" n={1} label="Create league step 1, option B" />),
          fig('cb2', 'B · step 2', <Step v="B" n={2} label="Create league step 2, option B" />, 'Back beside Next.'),
          fig('cbx', 'B · step 2 · your size (AX5, approximate)', <Step x={AX5} v="B" n={2} label="Create league step 2, option B, AX5" />),
        ]}</Grid>
      </section>
    );
  }

  window.KSCreateClose = () => <CallCreateClose />;
})();
