// Stockpile key-screens board — "Your call: a slot that can't be filled" (Giorgio, 2026-11-17, relayed by
// the Orchestrator): "how will a user, especially a new user, understand or know what that means? that
// should be done by us automatically imo and then notify the user if something cannot work". So
// SlotBuilder's "Check availability" button goes; the check runs by itself and only a problem shows.
// Decided by the ruling (drawn the same in A and B): no button, the check runs as edits settle, the
// shortfall sits on the short slot. The one open choice: does a short slot stop Create league?
// Review notes sit UNDER the phones, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const TOP = 1.3;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;

  // The shortfall line today is "Slot 1: only 9 draftable stocks match — the league needs at least 16
  // (8 teams × 2)." On the slot itself, "Slot 1:" and the sum in brackets go (cuts only, no new words).
  const SHORT = 'Only 9 draftable stocks match — the league needs at least 16.';
  const SHORT_TODAY = 'Slot 1: only 9 draftable stocks match — the league needs at least 16 (8 teams × 2).';

  function Field({ x, label, value, placeholder }) {
    return (
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <span style={{ ...fs(15, x), fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>
        <span className="dr-num" style={{ ...fs(17, x), padding: '10px 12px', borderRadius: 12, background: 'var(--c-inset)', boxShadow: 'inset 0 0 0 1px var(--c-border)', color: value ? 'var(--c-text)' : 'var(--c-text-2)', whiteSpace: 'nowrap' }}>{value || placeholder}</span>
      </div>
    );
  }

  function Slot({ x, n, count, min, max, cat, note }) {
    const st = x >= 1.35;
    return (
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, padding: '12px 16px 4px', display: 'grid', gap: 12, boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...fs(17, x, 1.6), fontWeight: 700, color: 'var(--c-text)' }}>{`Slot ${n}`}</span>
          <span style={{ color: 'var(--c-text-2)', display: 'grid', placeItems: 'center', width: 32, height: 32 }}><Icon d={ICON.close} size={Math.round(17 * k(x, 1.6))} width={2.2} /></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: st ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <Field x={x} label="Stocks" value={count} placeholder="1" />
          <Field x={x} label="Min $" value={min} placeholder="any" />
          <Field x={x} label="Max $" value={max} placeholder="any" />
        </div>
        {note}
        <div style={{ height: 1, background: 'var(--c-border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, flexWrap: 'wrap' }}>
          <span style={{ ...fs(15, x), color: 'var(--c-text)' }}>Category</span>
          <span style={{ ...fs(15, x), color: 'var(--c-text-2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{cat}<span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Icon d={ICON.chevron} size={14} width={2.4} /></span></span>
        </div>
      </div>
    );
  }

  const Warn = ({ x, text }) => (
    <div style={{ background: 'var(--c-warn-tint)', boxShadow: 'inset 0 0 0 1px var(--c-warn-line)', borderRadius: 12, padding: '10px 12px' }}>
      <span style={{ ...fs(15, x), fontWeight: 600, color: 'var(--c-warn-text)' }}>{text}</span>
    </div>
  );
  const Danger = ({ x, text }) => <span style={{ ...fs(15, x), color: 'var(--c-loss)' }}>{text}</span>;
  const Pill = ({ x, children, primary, off }) => (
    <span style={{ display: 'inline-grid', placeItems: 'center', minHeight: Math.round(36 * k(x, 1.3)), padding: '0 14px', borderRadius: 20, boxShadow: primary ? 'none' : 'inset 0 0 0 1.5px var(--c-border-strong)', ...fs(15, x, 1.6), fontWeight: 700, color: off ? 'var(--c-text-2)' : 'var(--c-text)' }}>{children}</span>
  );

  /** The Stakes step, scrolled to Roster slots. v: today | A | B. */
  function Stakes({ t = 'light', x = 1, v, label, scroll = 0 }) {
    const note = v === 'A' ? <Warn x={x} text={SHORT} /> : v === 'B' ? <Danger x={x} text={SHORT} /> : null;
    const blocked = v === 'B';
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 0 16px', minHeight: 48 }}>
              <span style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--c-text-2)', ...fs(16, x, TOP) }}><Icon d={ICON.left} size={16} width={2.4} />Back</span>
              <span className="dr-num" style={{ ...fs(13, x, TOP), color: 'var(--c-text-2)' }}>Step 4 of 4</span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', padding: '8px 20px' }}><div style={{ display: 'grid', alignContent: 'start', gap: 14, marginTop: -scroll }}>
              <span style={{ ...fs(17, x, 1.6), fontWeight: 700, color: 'var(--c-text)' }}>Roster slots</span>
              <Slot x={x} n={1} count="2" min="500" max="" cat="Tech" note={note} />
              <Slot x={x} n={2} count="2" min="" max="100" cat="Any (flex)" />
              {v === 'today' ? <Warn x={x} text={SHORT_TODAY} /> : null}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Pill x={x}>Add slot</Pill>
                {v === 'today' ? <Pill x={x}>Check availability</Pill> : null}
              </div>
            </div></div>
            <div style={{ padding: '10px 20px 34px', background: 'var(--c-bg)' }}>
              <span style={{ display: 'grid', placeItems: 'center', minHeight: Math.round(52 * k(x, 1.3)), borderRadius: 30, background: blocked ? 'var(--c-inset)' : 'var(--c-accent)', color: blocked ? 'var(--c-text-2)' : 'var(--c-on-accent)', ...fs(17, x, 1.6), fontWeight: 700 }}>Create league</span>
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

  function CallSlotCheck({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-slot-check" aria-labelledby="call-slot-check-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">League</span>
          <div>
            <h2 id="call-slot-check-h">{archived ? "Decided: a slot that can't be filled" : "Your call: a slot that can't be filled"}</h2>
            <p className="b-job">{'You said the availability check "should be done by us automatically ... and then notify the user if something cannot work". So "Check availability" goes: the check runs by itself after each change, and a slot only shows a line when it can\'t be filled. One choice is left: does that line stop Create league?'}</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · Warn, don't block.</b> The line shows on the slot in yellow and Create league still works. If the slot is still short when the draft is due, the draft is postponed until it's fixed in League settings (as today).</li>
          <li><b>B · Block.</b> The line shows on the slot in red, like the slot's other mistakes, and Create league greys out until the slot can be filled. Same for Save in League settings.</li>
          <li><b>Recommended: B.</b> A league whose slots can't be filled can never draft ("a draft pick can never be unused"), so it's better to stop it here, while the fix is one field away, than to postpone the draft later. The check only counts stocks per slot, so it can't block a slot that would actually fill.</li>
          <li><b>In both:</b> if the check itself fails (no connection), nothing is blocked and the draft-time check still covers it.</li>
          <li><b>No new words.</b> The line is today's, minus "Slot 1:" and the sum in brackets now that it sits on the slot.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <h3 className="b-sub">Today (build 16): a button, then the line under every slot</h3>
        <Grid>{[
          fig('st1', 'Today · after tapping Check availability', <Stakes v="today" label="Roster slots today, after Check availability" />),
        ]}</Grid>
        <h3 className="b-sub">A · Warn, don't block</h3>
        <Grid>{[
          fig('sa1', 'A', <Stakes v="A" label="Roster slots, option A" />, 'Create league still works.'),
          fig('sad', 'A · Dark', <Stakes t="dark" v="A" label="Roster slots, option A, Dark" />),
          fig('sax', 'A · your size (AX5, approximate)', <Stakes x={AX5} v="A" scroll={330} label="Roster slots, option A, AX5" />, 'Scrolled down to the line.'),
        ]}</Grid>
        <h3 className="b-sub">B · Block (recommended)</h3>
        <Grid>{[
          fig('sb1', 'B', <Stakes v="B" label="Roster slots, option B" />, 'Create league grey until slot 1 can be filled.'),
          fig('sbd', 'B · Dark', <Stakes t="dark" v="B" label="Roster slots, option B, Dark" />),
          fig('sbx', 'B · your size (AX5, approximate)', <Stakes x={AX5} v="B" scroll={330} label="Roster slots, option B, AX5" />, 'Scrolled down to the line.'),
        ]}</Grid>
      </section>
    );
  }

  window.KSSlotCheck = () => <CallSlotCheck />;
})();
