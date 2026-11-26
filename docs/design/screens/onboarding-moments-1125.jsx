// Stockpile key-screens board — "Your call: four moments in onboarding" (2026-11-25). MOVING.
// Plan docs/plans/2026-11-25-onboarding-finish-and-feel.md, Part 3 (approved, "approved both"). The invited path, four
// moments, two versions each, Light / Dark / his text size:
//   1. Arrival: the invitation opens (inviter's mark, then the league's name, then the three buttons).
//   2. The username: the made-up name rolls into place; "Change" rolls another; with no name by 6 s, the empty field.
//   3. Taking your seat: in place of today's wordless spinner, your mark joins. No words added.
//   4. Between steps: one move per step, the league's name staying put while the rest changes.
// Guardrails (the plan): never a tap or a wait added (every button is live from the first frame); anything over ~1 s
// can be tapped through; complete with Reduce Motion on. Today's words only; nothing new.
// Data the screens may show: the no-sign-in preview returns only the league's name and the inviter, so the seat
// moment shows the inviter's mark and yours, nothing else about the league.
// The phones loop; tap one to skip to its end, "Replay" to run it again; on moment 2 "Change" rolls another name.
// Filmstrips hold four frames still. Review notes sit UNDER the phones.
(function () {
  const { useState } = React;
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap = 1.3, lh = 1.22) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const LG = 'Stock Scudetto';
  const INVITER = 'Roberto B.';
  const TAGS = ['swiftOtter42', 'boldLynx07', 'calmHeron55', 'brightBison12', 'quickFalcon31', 'sunnyMarten20'];
  const REEL = ['quickHeron18', 'boldLynx07', 'calmOtter55', 'sharpFalcon31', 'brightBison12'];

  // ── Keyframes ──
  const p = (s, C) => `${((s / C) * 100).toFixed(2)}%`;
  const layer = (name, tin, tout, ax, C) => {
    const from = ax === 'X' ? 'translateX(100%)' : 'translateY(28px)';
    const to = ax === 'X' ? 'translateX(-30%)' : 'translateY(-28px)';
    let s = `@keyframes ${name} {`;
    s += tin == null ? `0% { opacity: 1; transform: none; }` : `0%, ${p(tin, C)} { opacity: 0; transform: ${from}; } ${p(tin + 0.35, C)} { opacity: 1; transform: none; }`;
    s += tout == null ? `100% { opacity: 1; transform: none; }` : `${p(tout, C)} { opacity: 1; transform: none; } ${p(tout + 0.35, C)}, 100% { opacity: 0; transform: ${to}; }`;
    return `${s} }`;
  };
  const C1 = 4, C2 = 4, CT = 8, C3 = 4, C4 = 6, C5 = 9;
  // The roll follows the answer: it moves at a fixed speed until the name arrives, then settles in 0.25 s.
  // Drawn at three answer times: 0.25 s (quick), 0.6 s (usual), 2 s (slow). n = lines rolled before the name.
  const ANS = [0.25, 0.6, 2.0];
  const akey = (a) => Math.round(a * 100);
  const nReel = (a) => Math.max(2, Math.ceil(a * 10));
  const nChar = (a) => Math.max(2, Math.ceil(a * 12));
  const ROLL_CSS = ANS.map((a) => `
  @keyframes ob2a-reel-${akey(a)} { 0% { transform: translateY(0); animation-timing-function: linear; } ${p(a, C2)} { transform: translateY(calc(var(--ob-lh) * -${nReel(a) - 1})); animation-timing-function: cubic-bezier(.2,.8,.2,1); } ${p(a + 0.25, C2)}, 100% { transform: translateY(calc(var(--ob-lh) * -${nReel(a)})); } }
  @keyframes ob2b-char-${akey(a)} { 0% { transform: translateY(0); animation-timing-function: linear; } ${p(a, C2)} { transform: translateY(calc(var(--ob-lh) * -${nChar(a) - 1})); animation-timing-function: cubic-bezier(.2,.8,.2,1); } ${p(a + 0.12, C2)}, 100% { transform: translateY(calc(var(--ob-lh) * -${nChar(a)})); } }
  @keyframes ob2-keep-${akey(a)} { 0%, ${p(a + 0.22, C2)} { opacity: .45; } ${p(a + 0.27, C2)}, 100% { opacity: 1; } }
  @keyframes ob2-check-${akey(a)} { 0%, ${p(a + 0.2, C2)} { opacity: 0; transform: scale(.5); } ${p(a + 0.32, C2)}, 100% { opacity: 1; transform: none; } }`).join('');
  const CSS = ROLL_CSS + `
  @keyframes ob1a-mark { 0% { opacity: 0; transform: scale(.6); } ${p(.3, C1)} { opacity: 1; transform: scale(1.06); } ${p(.42, C1)}, 100% { opacity: 1; transform: none; } }
  @keyframes ob1a-lead { 0%, ${p(.15, C1)} { opacity: 0; transform: translateY(10px); } ${p(.45, C1)}, 100% { opacity: 1; transform: none; } }
  @keyframes ob1a-name { 0%, ${p(.3, C1)} { opacity: 0; transform: translateY(10px); } ${p(.6, C1)}, 100% { opacity: 1; transform: none; } }
  @keyframes ob1a-btns { 0%, ${p(.4, C1)} { opacity: 0; transform: translateY(24px); } ${p(.8, C1)}, 100% { opacity: 1; transform: none; } }
  @keyframes ob1b-mark { 0% { opacity: 0; transform: translateY(-44px); } ${p(.35, C1)} { opacity: 1; transform: translateY(4px); } ${p(.45, C1)}, 100% { opacity: 1; transform: none; } }
  @keyframes ob1b-ripple { 0%, ${p(.35, C1)} { opacity: 0; transform: scale(1); } ${p(.36, C1)} { opacity: .5; transform: scale(1); } ${p(.95, C1)}, 100% { opacity: 0; transform: scale(1.9); } }
  @keyframes ob1b-title { 0%, ${p(.4, C1)} { opacity: 0; transform: scale(.96); } ${p(.7, C1)}, 100% { opacity: 1; transform: none; } }
  @keyframes ob1b-btns { 0%, ${p(.55, C1)} { opacity: 0; } ${p(1.0, C1)}, 100% { opacity: 1; } }
  @keyframes ob2-spin { 0% { transform: translateY(0); } 100% { transform: translateY(calc(var(--ob-lh) * -5)); } }
  @keyframes ob2-tvis { 0%, ${p(6, CT)} { opacity: 1; } ${p(6.01, CT)}, 100% { opacity: 0; } }
  @keyframes ob2-tempty { 0%, ${p(6, CT)} { opacity: 0; } ${p(6.01, CT)}, 100% { opacity: 1; } }
  @keyframes ob3a-you { 0% { opacity: 0; transform: translateX(130px); } ${p(.6, C3)} { opacity: 1; transform: translateX(-4px); } ${p(.72, C3)}, 100% { opacity: 1; transform: none; } }
  @keyframes ob3b-orbit {
    0% { opacity: 0; transform: rotate(150deg) translateX(72px) rotate(-150deg) scale(1); }
    ${p(.12, C3)} { opacity: 1; }
    ${p(.8, C3)} { opacity: 1; transform: rotate(360deg) translateX(72px) rotate(-360deg) scale(1); }
    ${p(.9, C3)} { transform: rotate(360deg) translateX(72px) rotate(-360deg) scale(1.1); }
    ${p(1.0, C3)}, 100% { opacity: 1; transform: rotate(360deg) translateX(72px) rotate(-360deg) scale(1); }
  }
  ${layer('ob4a-l1', null, 1.2, 'Y', C4)} ${layer('ob4a-l2', 1.2, 2.8, 'Y', C4)} ${layer('ob4a-l3', 2.8, 4.0, 'Y', C4)} ${layer('ob4a-l4', 4.0, null, 'Y', C4)}
  ${layer('ob4b-l1', null, 1.2, 'X', C4)} ${layer('ob4b-l2', 1.2, 2.8, 'X', C4)} ${layer('ob4b-l3', 2.8, 4.0, 'X', C4)} ${layer('ob4b-l4', 4.0, null, 'X', C4)}
  @keyframes ob4c-s2 { 0%, ${p(1.2, C4)} { transform: scaleX(0); } ${p(1.55, C4)}, 100% { transform: scaleX(1); } }
  @keyframes ob4c-s3 { 0%, ${p(4.0, C4)} { transform: scaleX(0); } ${p(4.35, C4)}, 100% { transform: scaleX(1); } }
  ${layer('ob4e-l1', null, 1.2, 'X', C5)} ${layer('ob4e-l2', 1.2, 2.6, 'X', C5)} ${layer('ob4e-l3', 2.6, 4.6, 'X', C5)} ${layer('ob4e-l4', 4.6, 6.2, 'X', C5)} ${layer('ob4e-l5', 6.2, null, 'X', C5)}
  ${[1.2, 2.6, 4.6, 6.2].map((t, i) => `@keyframes ob4e-s${i + 2} { 0%, ${p(t, C5)} { transform: scaleX(0); } ${p(t + 0.35, C5)}, 100% { transform: scaleX(1); } }`).join(' ')}
  @keyframes ob4e-chip { 0%, ${p(1.2, C5)} { opacity: 0; transform: translateY(-6px); } ${p(1.55, C5)}, ${p(6.2, C5)} { opacity: 1; transform: none; } ${p(6.55, C5)}, 100% { opacity: 0; } }
  @keyframes ob4-chip { 0%, ${p(1.2, C4)} { opacity: 0; transform: translateY(-6px); } ${p(1.55, C4)}, ${p(4.0, C4)} { opacity: 1; transform: none; } ${p(4.35, C4)}, 100% { opacity: 0; } }
  `;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const anim = (name, C, extra = {}) => ({ animation: `${name} ${C}s infinite`, animationTimingFunction: extra.ease || EASE, animationDelay: extra.delay != null ? `calc(var(--ob-delay, 0s) + ${extra.delay}s)` : 'var(--ob-delay, 0s)', animationPlayState: 'var(--ob-play, running)', animationFillMode: 'both' });
  // A screen's end state = no animation at all (Reduce Motion, or after a tap).
  const A = (end, name, C, extra) => (end ? {} : anim(name, C, extra));

  function OS() {
    return <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;
  }
  const Disc = ({ init, size = 64, you }) => <span style={{ width: size, height: size, flex: `0 0 ${size}px`, borderRadius: size / 2, background: you ? 'var(--c-you)' : 'var(--c-inset)', color: you ? '#fff' : 'var(--c-text)', display: 'grid', placeItems: 'center', fontSize: Math.round(size * 0.36), fontWeight: 800, boxShadow: '0 0 0 3px var(--c-bg)' }}>{init}</span>;
  const Btn = ({ x, kind, children, style }) => <span className={kind === 'line' ? 'dr-btn dr-btn--line' : 'dr-btn'} style={{ height: 50, ...fs(16, x), display: 'grid', placeItems: 'center', ...style }}>{children}</span>;
  function Phone({ t = 'light', label, onTap, still, children }) {
    const vars = still != null ? { '--ob-delay': `-${still}s`, '--ob-play': 'paused' } : {};
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label} onClick={onTap} style={{ cursor: onTap ? 'pointer' : 'default', ...vars }}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>{children}</div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }
  const Fill = ({ children, style }) => <div style={{ position: 'absolute', inset: 0, padding: '0 20px 44px', display: 'grid', ...style }}>{children}</div>;

  // ── 1 · Arrival ──
  function Arrival({ x = 1, v = 'a', end, inLayer, name = LG }) {
    const a = (n) => A(end, `ob1${v}-${n}`, C1);
    const title = (
      <span style={{ display: 'grid', gap: 0, textAlign: 'center' }}>
        <span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)', ...(v === 'a' ? a('lead') : {}) }}>{INVITER} invited you to</span>
        <span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)', ...(v === 'a' ? a('name') : {}) }}>{name}</span>
      </span>
    );
    return (
      <Fill style={{ gridTemplateRows: '1fr auto' }}>
        <div style={{ display: 'grid', gap: 16, alignContent: 'center', justifyItems: 'center' }}>
          <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            {v === 'b' && !end && !inLayer ? <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 0 3px var(--c-border-strong)', ...a('ripple') }} /> : null}
            <span style={{ display: 'grid', ...(inLayer ? {} : a('mark')) }}><Disc init="RB" /></span>
          </span>
          <span style={v === 'b' && !inLayer ? a('title') : {}}>{title}</span>
        </div>
        <div style={{ display: 'grid', gap: 10, ...(inLayer ? {} : a('btns')) }}>
          <Btn x={x}>Continue with Apple</Btn><Btn x={x} kind="line">Continue with Google</Btn><Btn x={x} kind="line">Use email</Btn>
        </div>
      </Fill>
    );
  }

  // ── 2 · The username ──
  function NameValue({ x, v, end, tag, timeout, ans = 0.6 }) {
    const lh = Math.round(22 * 1.3 * k(x, 1.3));
    const box = { height: lh, overflow: 'hidden', position: 'relative', '--ob-lh': `${lh}px`, ...fs(22, x, 1.3, 1.3), fontWeight: 700, color: 'var(--c-text)' };
    if (end && !timeout) return <div style={box}>{tag}</div>;
    if (v === 'a') {
      const strip = timeout ? [...REEL, REEL[0]] : [...Array.from({ length: nReel(ans) }, (_, i) => REEL[i % REEL.length]), tag];
      return (
        <div style={box}>
          <div style={timeout ? anim('ob2-spin', 0.5, { ease: 'linear' }) : anim(`ob2a-reel-${akey(ans)}`, C2, { ease: 'linear' })}>
            {strip.map((s, i) => <div key={i} style={{ height: lh }}>{s}</div>)}
          </div>
        </div>
      );
    }
    const pool = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return (
      <div style={{ ...box, display: 'flex' }}>
        {tag.split('').map((ch, i) => {
          const junk = Array.from({ length: timeout ? 4 : nChar(ans) }, (_, j) => pool[(i * 7 + j * 11 + tag.length) % pool.length]);
          const strip = timeout ? [...junk, junk[0]] : [...junk, ch];
          return (
            <span key={i} style={{ display: 'inline-block', position: 'relative', height: lh, overflow: 'hidden' }}>
              <span style={{ visibility: 'hidden' }}>{timeout ? junk[0] : ch}</span>
              <span style={{ position: 'absolute', left: 0, top: 0, width: '100%', ...(timeout ? anim('ob2-spin', 0.4, { ease: 'linear', delay: i * 0.03 }) : anim(`ob2b-char-${akey(ans)}`, C2, { ease: 'linear', delay: i * 0.012 })) }}>
                {strip.map((c, j) => <span key={j} style={{ display: 'block', height: lh, textAlign: 'center' }}>{c}</span>)}
              </span>
            </span>
          );
        })}
      </div>
    );
  }
  function Username({ x = 1, v = 'a', end, tag = TAGS[0], timeout, onChange, inLayer, ans = 0.6 }) {
    const field = (value, check) => (
      <div className="dr-a-card" style={{ padding: '10px 14px', display: 'grid', gap: 2, boxShadow: 'inset 0 0 0 2px var(--c-accent)' }}>
        <span style={{ ...fs(13, x), color: 'var(--c-text-2)', fontWeight: 600 }}>Username</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{value}</div>
          {check ? <span style={{ color: 'var(--c-gain)', display: 'grid', ...(end || inLayer ? {} : anim(`ob2-check-${akey(ans)}`, C2)) }}><Icon d={ICON.check} size={20} width={2.8} /></span> : null}
        </div>
      </div>
    );
    const keepRow = (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <span style={end || inLayer ? {} : anim(`ob2-keep-${akey(ans)}`, C2)}><Btn x={x}>Keep</Btn></span>
        <span onClick={onChange ? (e) => { e.stopPropagation(); onChange(); } : undefined} style={{ cursor: onChange ? 'pointer' : 'default' }}><Btn x={x} kind="line">Change</Btn></span>
      </div>
    );
    if (timeout) {
      return (
        <Fill style={{ alignContent: 'start', paddingTop: x > 1 ? 30 : 70 }}>
          <div style={{ position: 'absolute', inset: `${x > 1 ? 30 : 70}px 20px 44px`, display: 'grid', alignContent: 'start', gap: 16, ...anim('ob2-tvis', CT, { ease: 'steps(1, end)' }) }}>
            <span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)' }}>Pick a username</span>
            {field(<NameValue x={x} v={v} tag={TAGS[0]} timeout />, false)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, opacity: 0.45 }}><Btn x={x}>Keep</Btn><Btn x={x} kind="line">Change</Btn></div>
          </div>
          <div style={{ position: 'absolute', inset: `${x > 1 ? 30 : 70}px 20px 44px`, display: 'grid', alignContent: 'start', gap: 16, ...anim('ob2-tempty', CT, { ease: 'steps(1, end)' }) }}>
            <span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)' }}>Pick a username</span>
            {field(<div style={{ ...fs(22, x, 1.3, 1.3), height: Math.round(22 * 1.3 * k(x, 1.3)), display: 'flex', alignItems: 'center' }}><span style={{ width: 2, height: '80%', background: 'var(--c-accent)' }} /></div>, false)}
            <span style={{ ...fs(13, x), color: 'var(--c-text-2)', display: 'grid', gap: 2 }}><span>3–20 characters</span><span>Letters, numbers and underscores</span></span>
          </div>
        </Fill>
      );
    }
    return (
      <Fill style={{ alignContent: 'start', gap: 16, paddingTop: x > 1 ? 48 : 70 }}>
        <span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)' }}>Pick a username</span>
        {field(inLayer ? <div style={{ ...fs(22, x, 1.3, 1.3), fontWeight: 700, color: 'var(--c-text)' }}>{tag}</div> : <NameValue key={tag} x={x} v={v} end={end} tag={tag} ans={ans} />, true)}
        {keepRow}
      </Fill>
    );
  }

  // ── 3 · Taking your seat ──
  function Seat({ x = 1, v = 'a', end, inLayer }) {
    if (v === 'a') {
      return (
        <Fill style={{ placeItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Disc init="RB" />
            <span style={{ marginLeft: -12, display: 'grid', ...(end || inLayer ? {} : anim('ob3a-you', C3)) }}><Disc init="S" you /></span>
          </div>
        </Fill>
      );
    }
    return (
      <Fill style={{ placeItems: 'center' }}>
        <div style={{ position: 'relative', width: 144, height: 144 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 0 2px var(--c-border-strong)' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--c-text-2)' }}><Icon d={ICON.league} size={30} width={2} /></span>
          <span style={{ position: 'absolute', left: 72 - 26, top: -26 }}><Disc init="RB" size={52} /></span>
          <span style={{ position: 'absolute', left: 72 - 26, top: 72 - 26, display: 'grid', transform: end || inLayer ? 'translateX(72px)' : undefined, ...(end || inLayer ? {} : anim('ob3b-orbit', C3)) }}><Disc init="S" size={52} you /></span>
        </div>
      </Fill>
    );
  }

  // ── 4 · Between steps: four screens in one phone, the league's name staying put from step 2 ──
  function YoureInLite({ x = 1, name = LG, top }) {
    return (
      <Fill style={{ alignContent: 'start', justifyItems: 'center', textAlign: 'center', gap: 14, paddingTop: top != null ? top : x > 1 ? 30 : 80 }}>
        <span style={{ width: 72, height: 72, borderRadius: 36, background: 'var(--c-you)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon d={ICON.check} size={32} width={2.6} /></span>
        <span style={{ display: 'grid' }}><span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)' }}>You're in</span><span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)' }}>{name}</span></span>
        <span style={{ ...fs(15, x), color: 'var(--c-text-2)' }}>The draft is <span style={{ whiteSpace: 'nowrap' }}>Sat, Nov 28 · 7:00 PM ET</span>.</span>
        <Btn x={x} style={{ width: '100%' }}>Go to the league</Btn>
      </Fill>
    );
  }
  function Steps({ x = 1, v = 'a', end, reduce }) {
    const L = (i) => (end ? { opacity: i === 4 ? 1 : 0 } : reduce ? { opacity: i === 2 ? 1 : 0 } : anim(`ob4${v}-l${i}`, C4, { ease: 'cubic-bezier(.3,.7,.2,1)' }));
    const chipStyle = end ? { opacity: 0 } : reduce ? { opacity: 1 } : anim('ob4-chip', C4);
    return (
      <>
        <div style={{ position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center', zIndex: 2, ...chipStyle }}>
          <span style={{ ...fs(15, x), fontWeight: 700, color: 'var(--c-text-2)' }}>{LG}</span>
        </div>
        <div style={{ position: 'absolute', inset: 0, ...L(1) }}><Arrival x={x} end inLayer /></div>
        <div style={{ position: 'absolute', inset: 0, ...L(2) }}><Username x={x} end inLayer /></div>
        <div style={{ position: 'absolute', inset: 0, ...L(3) }}><Seat x={x} v="a" end inLayer /></div>
        <div style={{ position: 'absolute', inset: 0, ...L(4) }}><YoureInLite x={x} /></div>
      </>
    );
  }

  // ── 4C · the progress bar at the top, the steps sliding sideways (his ask, 2026-11-25) ──
  // The bar counts the screens of the path you're on: Apple/Google = invite, username, in (3); email = invite, create
  // account, check your email (you leave for Mail here), username, in (5). The seat is part of "in". No words on
  // screen; VoiceOver reads "Step 2 of 3" (Create league's own "Step N of 4" form). Under the bar, the league's name.
  const LONG = 'The Friday Night Stock Pickers Club of Milan';
  function Bar({ x, n, path, end, reduce, name }) {
    const fill = (i) => (end || i === 1 || (reduce && i <= 2) ? { transform: 'none' } : reduce ? { transform: 'scaleX(0)' } : anim(`${path === 'email' ? 'ob4e' : 'ob4c'}-s${i}`, path === 'email' ? C5 : C4, { ease: 'cubic-bezier(.3,.7,.2,1)' }));
    const chip = end ? { opacity: 0 } : reduce ? { opacity: 1 } : anim(path === 'email' ? 'ob4e-chip' : 'ob4-chip', path === 'email' ? C5 : C4);
    return (
      <div style={{ position: 'absolute', top: 10, left: 20, right: 20, zIndex: 2, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }} aria-label={`Step ${reduce ? 2 : 1} of ${n}`}>
          {Array.from({ length: n }, (_, k) => (
            <span key={k} style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--c-inset)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', background: 'var(--c-accent)', transformOrigin: 'left center', ...fill(k + 1) }} />
            </span>
          ))}
        </div>
        <span style={{ textAlign: 'center', ...fs(15, x), fontWeight: 700, color: 'var(--c-text-2)', textWrap: 'balance', ...chip }}>{name}</span>
      </div>
    );
  }
  function CreateAccount({ x = 1 }) {
    const f = (label, value) => (
      <div className="dr-a-card" style={{ padding: '10px 14px', display: 'grid', gap: 2 }}>
        <span style={{ ...fs(13, x), color: 'var(--c-text-2)', fontWeight: 600 }}>{label}</span><span style={{ ...fs(17, x), color: 'var(--c-text)' }}>{value}</span>
      </div>
    );
    return (
      <Fill style={{ alignContent: 'start', gap: 14, paddingTop: x > 1 ? 30 : 60 }}>
        <span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)' }}>Create account</span>
        {f('Email address', 'luca@example.com')}{f('Password', '••••••••••')}
        <Btn x={x}>Create account</Btn><Btn x={x} kind="line">Sign in instead</Btn>
      </Fill>
    );
  }
  function CheckEmail({ x = 1, name = LG }) {
    return (
      <Fill style={{ alignContent: 'center', justifyItems: 'center', textAlign: 'center', gap: 12 }}>
        <span style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', color: 'var(--c-text)' }}><Icon d="M4 6h16v12H4zM4 7l8 6 8-6" size={28} width={2} /></span>
        <span style={{ ...fs(24, x), fontWeight: 800, color: 'var(--c-text)' }}>Check your email</span>
        <span style={{ ...fs(15, x), color: 'var(--c-text-2)' }}>We sent a link to luca@example.com. Tap it to finish joining {name}.</span>
        <Btn x={x} style={{ width: '100%' }}>Back to sign in</Btn>
        <span style={{ ...fs(15, x), color: 'var(--c-accent)', fontWeight: 700 }}>Didn't receive it? Send again</span>
      </Fill>
    );
  }
  function StepsBar({ x = 1, end, reduce, path = 'apple', name = LG }) {
    const email = path === 'email';
    const n = email ? 5 : 3;
    // ~0.55 em a character, across the 362pt between the gutters.
    const lines = Math.max(1, Math.ceil(name.length / Math.floor(362 / (15 * k(x, 1.3) * 0.55))));
    const top = 22 + lines * Math.round(15 * 1.22 * k(x, 1.3)) + 6;
    const L = (i, last) => (end ? { opacity: i === last ? 1 : 0 } : reduce ? { opacity: i === 2 ? 1 : 0 } : anim(`${email ? 'ob4e' : 'ob4b'}-l${i}`, email ? C5 : C4, { ease: 'cubic-bezier(.3,.7,.2,1)' }));
    const screens = email
      ? [<Arrival x={x} end inLayer name={name} />, <CreateAccount x={x} />, <CheckEmail x={x} name={name} />, <Username x={x} end inLayer />, <YoureInLite x={x} name={name} top={20} />]
      : [<Arrival x={x} end inLayer name={name} />, <Username x={x} end inLayer />, <Seat x={x} v="a" end inLayer />, <YoureInLite x={x} name={name} top={20} />];
    return (
      <>
        <Bar x={x} n={n} path={path} end={end} reduce={reduce} name={name} />
        <div style={{ position: 'absolute', top, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          {screens.map((sc, i) => <div key={i} style={{ position: 'absolute', inset: 0, ...L(i + 1, screens.length) }}>{sc}</div>)}
        </div>
      </>
    );
  }

  // ── Live phone and filmstrip ──
  function Live({ t, x, label, render, rollable }) {
    const [run, setRun] = useState(0);
    const [end, setEnd] = useState(false);
    const [tagI, setTagI] = useState(0);
    const replay = () => { setEnd(false); setRun(run + 1); };
    return (
      <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
        <Fit><Phone key={run} t={t} label={label} onTap={() => setEnd(true)}>{render({ x, end, tag: TAGS[tagI % TAGS.length], onChange: rollable ? () => { setTagI(tagI + 1); setEnd(false); setRun(run + 1); } : undefined })}</Phone></Fit>
        <button type="button" onClick={replay} style={{ font: 'inherit', fontWeight: 700, fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--c-border-strong)', background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer' }}>Replay</button>
      </div>
    );
  }
  function Film({ t = 'light', times, render, label }) {
    const W = 168, S = W / 402;
    return (
      <Th t={t}>
        <div role="img" aria-label={label} style={{ display: 'flex', gap: 14, padding: 12, background: 'var(--c-bg)', borderRadius: 14, width: 'max-content' }}>
          {times.map((s) => (
            <div key={s} style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              <div style={{ width: W, height: Math.round(874 * S), overflow: 'hidden', borderRadius: 18, boxShadow: '0 0 0 3px var(--c-border-strong)', background: 'var(--c-bg)' }}>
                <div style={{ transform: `scale(${S})`, transformOrigin: 'top left', width: 402 }}><Phone t={t} still={s} label={`${label} at ${s} s`}>{render({ x: 1 })}</Phone></div>
              </div>
              <span className="dr-num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-2)' }}>{s.toFixed(2)} s</span>
            </div>
          ))}
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}>{node}<figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const Sub = ({ children }) => <h3 className="b-sub">{children}</h3>;
  const Wide = ({ children }) => <div style={{ display: 'grid', gap: 20, margin: '4px 0 28px', overflowX: 'auto' }}>{children}</div>;
  const Static = ({ t = 'light', label, children }) => <Fit><Phone t={t} label={label}>{children}</Phone></Fit>;

  function Version({ id, title, len, note, render, rollable, times, status }) {
    return (
      <>
        <Sub>{status === 'not' ? <><s>{`${title} · ${len}`}</s> · not picked</> : status === 'picked' ? `${title} · ${len} · picked` : status === 'hold' ? `${title} · ${len} · on hold` : `${title} · ${len}`}</Sub>
        <Grid>{[
          fig(`${id}l`, `${title} · Light`, <Live t="light" x={1} label={`${title}, Light`} render={render} rollable={rollable} />, note),
          fig(`${id}d`, `${title} · Dark`, <Live t="dark" x={1} label={`${title}, Dark`} render={render} rollable={rollable} />),
          fig(`${id}x`, `${title} · your text size`, <Live t="light" x={AX5} label={`${title}, largest text size`} render={render} rollable={rollable} />),
        ]}</Grid>
        <Wide>{fig(`${id}f`, `${title} · four frames`, <Film times={times} render={render} label={`${title}, four frames`} />)}</Wide>
      </>
    );
  }

  function CallOnboardingMoments({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-ob-moments" aria-labelledby="call-ob-moments-h">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Onboarding</span>
          <div>
            <h2 id="call-ob-moments-h">{archived ? 'Decided: four moments in onboarding' : 'Your call: four moments in onboarding'}</h2>
            <p className="b-job">The invited path, from the link to “You’re in”, with four moments that move. Two versions of each. These phones move: tap one to skip to the end, as you could in the app.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Decided 2026-11-25, in his words:</b> “1b / 2b / i dont get 3 and its purpose / what about the progress bar up top? if that gets added to this screen then the sideways motion.” 1 is B (the mark drops in), 2 is B (letters lock); A of each not picked. 3 is on hold while the Planner explains it. 4 is open again, now between A and C below (a bar at the top, sliding sideways). “Change rolls another” not yet answered.</li>
          <li><b>The rules every version keeps:</b> no tap and no wait added (every button works from the first frame, even while it moves in); anything longer than about a second can be tapped through; with Reduce Motion on the screen is simply there, complete (section 5). Today’s words only.</li>
          <li><b>1 · Arrival.</b> A, 0.8 s: the mark, then each line, then the buttons rise in order. B, 1.0 s: the mark drops in with a ripple, then the heading, then the buttons.</li>
          <li><b>2 · The username.</b> The roll lasts exactly as long as your name takes to be made, and settles the moment it arrives (0.25 s); it’s never held open to be seen, and a tap ends it. Drawn with the name at 0.6 s (a usual answer), and at 0.25 s and at 2 s to show it reads at both. A: names roll past like a reel and stop on yours. B: each letter shuffles, then they lock left to right. A haptic as it lands; Keep turns on then (as today). <b>Change rolls another</b> (try it on the Light phones). If no name comes by 6 s, the field is empty and you type one (the last phone of each).</li>
          <li><b>3 · Taking your seat</b>, in place of today’s spinner. A, 0.7 s: your mark slides in beside the one who invited you. B, 1.0 s: your mark travels round the league’s ring and takes its place. A haptic as it lands. It plays only while the join is happening; a fast join cuts it short. Only the inviter’s mark and yours: nothing else about the league can be shown before you’re in.</li>
          <li><b>4 · Between steps, your progress-bar idea.</b> A (as before): the league’s name at the top from the username on, each step rising in. <b>C (new):</b> a progress bar at the top with the league’s name under it, each step sliding in from the right as the bar fills a segment. It replaces the old B (sideways with no bar).
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li><b>What it counts:</b> the screens of your path. With Apple or Google, three (invite, username, in; the seat is part of “in”). With email, five (invite, create account, check your email, username, in): at “Check your email” you leave the app for Mail, the bar holds at 3 of 5, and the link brings you back to 4.</li>
              <li><b>At your text size:</b> the bar and the name both fit. A long league name takes two lines under the bar and the screen moves down; the name is never cut, and the bar never replaces it.</li>
              <li><b>On a cold install:</b> no bar. Create league keeps its own “Step N of 4”, and the account and username screens before it lead to no single league to count towards, so one screen never carries two counters.</li>
              <li><b>No words:</b> the bar is segments only. VoiceOver reads it as “Step 2 of 3”, Create league’s own form, so nothing new to approve.</li>
            </ul>
          </li>
          <li><b>Recommended: C.</b> It answers the plan’s own complaint about the other app (no sense of how long it would be), it’s what you asked for, and with a bar sideways reads as forward, not as a way back. A stays as the quieter option.</li>
          <li><b>For the Planner:</b> today “Change” opens the field to type. The plan has it roll another name, so typing your own needs another way in: here, a tap on the name opens it for typing. That’s a change to an approved behaviour, for him to confirm.</li>
          <li><b>Sound:</b> none drawn; the plan leaves it to him once there’s something to hear. A haptic marks the two moments that land.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or C for 4, and yes or no to “Change rolls another”. 3 waits for the Planner.</>}</li>
        </ul>

        <Version status="not" id="m1a" title="1A · Arrival, in order" len="0.8 s" note="0–0.3 s mark · 0.15–0.6 s the two lines · 0.4–0.8 s buttons. The buttons work from the first frame." render={({ x, end }) => <Arrival x={x} v="a" end={end} />} times={[0.1, 0.3, 0.5, 0.8]} />
        <Version status="picked" id="m1b" title="1B · Arrival, the mark drops in" len="1.0 s" note="0–0.45 s mark drops, ripple · 0.4–0.7 s heading · 0.55–1.0 s buttons." render={({ x, end }) => <Arrival x={x} v="b" end={end} />} times={[0.15, 0.4, 0.6, 1.0]} />
        <Version status="not" id="m2a" title="2A · The username, a reel" len="as long as the name takes, then 0.25 s" note="Rolls until the name arrives (0.6 s here), lands at 0.85 s with a haptic. Tap Change to roll another name." rollable render={({ x, end, tag, onChange }) => <Username x={x} v="a" end={end} tag={tag} onChange={onChange} />} times={[0.2, 0.5, 0.7, 0.9]} />
        <Version status="picked" id="m2b" title="2B · The username, letters lock" len="as long as the name takes, then 0.25 s" note="Shuffles until the name arrives (0.6 s here), locks left to right by 0.85 s. Tap Change to roll another name." rollable render={({ x, end, tag, onChange }) => <Username x={x} v="b" end={end} tag={tag} onChange={onChange} />} times={[0.2, 0.5, 0.68, 0.9]} />
        <Sub>2 · A quick name and a slow one</Sub>
        <Grid>{[
          fig('m2q1', '2A · the name at 0.25 s', <Live t="light" x={1} label="Username reel, name at 0.25 s" render={({ x, end, tag, onChange }) => <Username x={x} v="a" end={end} tag={tag} onChange={onChange} ans={0.25} />} rollable />, 'A quick answer: a flick of two names, then yours, landed by 0.5 s.'),
          fig('m2s1', '2A · the name at 2 s', <Live t="light" x={1} label="Username reel, name at 2 s" render={({ x, end, tag, onChange }) => <Username x={x} v="a" end={end} tag={tag} onChange={onChange} ans={2.0} />} rollable />, 'A slow answer: the reel keeps rolling at the same speed until the name arrives, never longer.'),
          fig('m2q2', '2B · the name at 0.25 s', <Live t="light" x={1} label="Username letters, name at 0.25 s" render={({ x, end, tag, onChange }) => <Username x={x} v="b" end={end} tag={tag} onChange={onChange} ans={0.25} />} rollable />),
          fig('m2s2', '2B · the name at 2 s', <Live t="light" x={1} label="Username letters, name at 2 s" render={({ x, end, tag, onChange }) => <Username x={x} v="b" end={end} tag={tag} onChange={onChange} ans={2.0} />} rollable />),
        ]}</Grid>
        <Wide>
          {fig('m2sf', '2A · the name at 2 s, four frames', <Film times={[0.6, 1.4, 2.1, 2.3]} render={({ x }) => <Username x={x} v="a" tag={TAGS[0]} ans={2.0} />} label="Username reel with the name at 2 s, four frames" />)}
          {fig('m2qf', '2A · the name at 0.25 s, four frames', <Film times={[0.1, 0.2, 0.35, 0.5]} render={({ x }) => <Username x={x} v="a" tag={TAGS[0]} ans={0.25} />} label="Username reel with the name at 0.25 s, four frames" />)}
        </Wide>
        <Sub>2 · No name by 6 s (both versions)</Sub>
        <Grid>{[
          fig('m2ta', '2A · rolling, then the empty field at 6 s', <Live t="light" x={1} label="Username reel that gets no name, then the empty field" render={({ x }) => <Username x={x} v="a" timeout />} />, 'Loops every 8 s: rolls for 6 s, then the empty field with today’s two rules.'),
          fig('m2tb', '2B · shuffling, then the empty field at 6 s', <Live t="light" x={1} label="Username letters that get no name, then the empty field" render={({ x }) => <Username x={x} v="b" timeout />} />),
        ]}</Grid>
        <Version status="hold" id="m3a" title="3A · Your seat, beside the inviter" len="0.7 s" note="Your mark (your initial, in your colour) slides in beside Roberto B.’s. A haptic as it lands." render={({ x, end }) => <Seat x={x} v="a" end={end} />} times={[0.1, 0.3, 0.55, 0.8]} />
        <Version status="hold" id="m3b" title="3B · Your seat at the table" len="1.0 s" note="The ring is the league; the inviter sits at the top; yours travels round and lands." render={({ x, end }) => <Seat x={x} v="b" end={end} />} times={[0.1, 0.4, 0.7, 1.0]} />
        <Version id="m4a" title="4A · Between steps, rising" len="0.35 s a step" note="Arrival → username → seat → You’re in, looping. The league’s name stays at the top from the username on." render={({ x, end }) => <Steps x={x} v="a" end={end} />} times={[1.3, 1.45, 2.95, 4.15]} />
        <Sub>4C · A progress bar at the top, sliding sideways · 0.35 s a step</Sub>
        <Grid>{[
          fig('m4cl', '4C · Light, Apple or Google (3 steps)', <Live t="light" x={1} label="Steps with a progress bar, sliding, Light" render={({ x, end }) => <StepsBar x={x} end={end} />} />, 'Invite, username, in: three. The bar fills one segment as each step slides in; the seat is part of “in”.'),
          fig('m4cd', '4C · Dark', <Live t="dark" x={1} label="Steps with a progress bar, Dark" render={({ x, end }) => <StepsBar x={x} end={end} />} />),
          fig('m4cx', '4C · your text size', <Live t="light" x={AX5} label="Steps with a progress bar, largest text size" render={({ x, end }) => <StepsBar x={x} end={end} />} />, 'The bar and the league’s name both fit above the screen.'),
          fig('m4cxl', '4C · your text size, a long league name', <Live t="light" x={AX5} label="Steps with a progress bar, largest text size, long league name" render={({ x, end }) => <StepsBar x={x} end={end} name={LONG} />} />, 'A long name takes two lines under the bar; the screen moves down to make room. Nothing is cut.'),
          fig('m4ce', '4C · with email (5 steps)', <Live t="light" x={1} label="Steps with a progress bar on the email path" render={({ x, end }) => <StepsBar x={x} end={end} path="email" />} />, 'Invite, create account, check your email, username, in. At “Check your email” you leave for Mail; the bar holds at 3 of 5 and you come back to 4.'),
          fig('m4cg', '4C · the whole screen grey', <div style={{ filter: 'grayscale(1)' }}><Live t="light" x={1} label="Steps with a progress bar, greyscale" render={({ x, end }) => <StepsBar x={x} end={end} />} /></div>, 'In grey the filled segments are dark and the empty ones light, so the bar still counts.'),
        ]}</Grid>
        <Wide>
          {fig('m4cf', '4C · Apple or Google, four frames', <Film times={[0.6, 1.4, 2.95, 4.4]} render={() => <StepsBar />} label="Progress bar path, four frames" />)}
          {fig('m4ef', '4C · email, five frames', <Film times={[0.6, 1.4, 3.6, 5.0, 6.6]} render={() => <StepsBar path="email" />} label="Progress bar email path, five frames" />)}
        </Wide>

        <Sub>5 · Reduce Motion on</Sub>
        <Grid>{[
          fig('r1', 'Arrival, complete at once', <Static label="Arrival with Reduce Motion"><Arrival end /></Static>),
          fig('r2', 'Username, the name simply there', <Static label="Username with Reduce Motion"><Username end tag={TAGS[0]} /></Static>, 'If no name comes by 6 s, the empty field, as today.'),
          fig('r3', 'Your seat, both marks there', <Static t="dark" label="Seat with Reduce Motion, Dark"><Seat end /></Static>),
          fig('r4', 'Between steps, the next screen simply replaces the last', <Static label="A step with Reduce Motion"><Steps reduce /></Static>),
          fig('r5', 'C with Reduce Motion: the bar simply shows the step', <Static label="Progress bar step with Reduce Motion"><StepsBar reduce /></Static>),
        ]}</Grid>
      </section>
    );
  }

  window.KSOnboardingMoments = () => <CallOnboardingMoments />;
  window.KSOnboardingMomentsArchived = () => null;
})();
