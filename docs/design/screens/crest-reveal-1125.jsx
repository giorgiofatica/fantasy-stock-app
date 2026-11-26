// Stockpile key-screens board — "Your call: the crest reveal" (2026-11-25). MOVING.
// Plan docs/plans/2026-11-25-crests.md ("The reveal", open question 2). On "You're in {league}", the first time only,
// the new manager's starter crest is revealed where today's tick pops in, then sits there. Today's words, unchanged:
// "You're in {league}", "The draft is {when}.", the Managers / Stakes / Season card, "Go to the league".
// Guardrails (the plan): a second or two; never a tap or a wait added (the button is live from the first frame); a tap
// anywhere skips to the end; with Reduce Motion on the crest is simply there. Flat, depth suggested: transforms and
// opacity only, which Reanimated (already in the app, useMotion) does; no Lottie or Rive.
// The crest is drawn in direction C (the recommendation on #call-crest-look) as a stand-in until he picks.
// The phones loop every 4 s; tap one to skip it to the end, "Replay" to run it again. The filmstrips under each version
// hold five frames still. Review notes sit UNDER the phones, never inside.
(function () {
  const { useState } = React;
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap = 1.3, lh = 1.25) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const CYCLE = 4; // seconds per loop on the board

  // The stand-in crest: direction C, teal hexagon, the horns.
  const HEX = 'M12 1 L21.5 6.5 V17.5 L12 23 L2.5 17.5 V6.5 Z';
  const HORNS = 'M3 5 C3 11 7 13 10 13 L10 19 H14 L14 13 C17 13 21 11 21 5 C19 8.5 16.5 10 12 10 C7.5 10 5 8.5 3 5 Z';
  const FILL = '#0F8C8C', DEEP = '#0A5F5F';
  function Crest({ size, shine }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <clipPath id={`crv-clip-${shine || 'x'}`}><path d={HEX} /></clipPath>
          <linearGradient id="crv-shine-g" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={HEX} fill={FILL} stroke={DEEP} strokeWidth="1.4" strokeLinejoin="round" />
        <g transform="translate(6.2 5.8) scale(0.5)"><path d={HORNS} fill="#fff" /></g>
        {shine ? (
          <g clipPath={`url(#crv-clip-${shine})`}>
            <rect x="-8" y="-4" width="8" height="32" fill="url(#crv-shine-g)" transform="skewX(-18)" style={{ animation: `crv2-shine ${CYCLE}s linear infinite`, animationDelay: 'var(--crv-delay, 0s)', animationPlayState: 'var(--crv-play, running)' }} />
          </g>
        ) : null}
      </svg>
    );
  }

  // ── Keyframes. Times in seconds, as a share of the 4 s loop. ──
  const pc = (s) => `${((s / CYCLE) * 100).toFixed(2)}%`;
  const P3 = 'perspective(420px)';
  const CSS = `
  @keyframes crv1-front {
    0% { opacity: 0; transform: ${P3} rotateY(0deg) scale(.8); filter: brightness(1); }
    ${pc(0.25)} { opacity: 1; transform: ${P3} rotateY(0deg) scale(1); }
    ${pc(0.35)} { opacity: 1; transform: ${P3} rotateY(0deg) scale(1); filter: brightness(1); }
    ${pc(0.6)} { opacity: 1; transform: ${P3} rotateY(90deg) scale(1); filter: brightness(.55); }
    ${pc(0.601)}, 100% { opacity: 0; transform: ${P3} rotateY(90deg) scale(1); }
  }
  @keyframes crv1-back {
    0%, ${pc(0.6)} { opacity: 0; transform: ${P3} rotateY(-90deg) scale(1); filter: brightness(.55); }
    ${pc(0.601)} { opacity: 1; transform: ${P3} rotateY(-90deg) scale(1); filter: brightness(.55); }
    ${pc(0.9)} { opacity: 1; transform: ${P3} rotateY(0deg) scale(1); filter: brightness(1); }
    ${pc(1.0)} { transform: ${P3} rotateY(0deg) scale(1.1); }
    ${pc(1.15)}, 100% { opacity: 1; transform: ${P3} rotateY(0deg) scale(1); filter: brightness(1); }
  }
  @keyframes crv1-ring {
    0%, ${pc(0.9)} { opacity: 0; transform: scale(1); }
    ${pc(0.91)} { opacity: .6; transform: scale(1); }
    ${pc(1.4)}, 100% { opacity: 0; transform: scale(1.8); }
  }
  @keyframes crv2-glow {
    0% { opacity: 0; transform: scale(.4); }
    ${pc(0.3)} { opacity: .9; transform: scale(1); }
    ${pc(1.2)} { opacity: .6; transform: scale(1.05); }
    ${pc(1.8)}, 100% { opacity: 0; transform: scale(1.1); }
  }
  @keyframes crv2-rise {
    0%, ${pc(0.2)} { opacity: 0; transform: translateY(28px) scale(.5); }
    ${pc(0.9)} { opacity: 1; transform: translateY(0) scale(1.1); }
    ${pc(1.2)}, 100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes crv2-rays {
    0%, ${pc(0.4)} { opacity: 0; transform: rotate(0deg); }
    ${pc(0.8)} { opacity: .55; }
    ${pc(1.8)}, 100% { opacity: 0; transform: rotate(28deg); }
  }
  @keyframes crv2-shine {
    0%, ${pc(0.8)} { transform: skewX(-18deg) translateX(0); }
    ${pc(1.5)}, 100% { transform: skewX(-18deg) translateX(40px); }
  }
  `;
  const anim = (name) => ({ animation: `${name} ${CYCLE}s infinite`, animationTimingFunction: 'cubic-bezier(.2,.8,.2,1)', animationDelay: 'var(--crv-delay, 0s)', animationPlayState: 'var(--crv-play, running)', animationFillMode: 'both' });

  const SLOT = 96; // the reveal's stage; the crest sits at 88pt where today's 72pt tick is
  /** The stage: version 1 (the tick turns into the crest) or 2 (the crest rises in light). end = the final frame. */
  function Stage({ v, end, still }) {
    const wrap = { position: 'relative', width: SLOT, height: SLOT, display: 'grid', placeItems: 'center', justifySelf: 'center', ...(still != null ? { '--crv-delay': `-${still}s`, '--crv-play': 'paused' } : null) };
    if (end) return <div style={wrap}><Crest size={88} /></div>;
    if (v === 1) {
      return (
        <div style={wrap}>
          <span style={{ position: 'absolute', inset: 4, borderRadius: '50%', boxShadow: `0 0 0 3px ${FILL}`, ...anim('crv1-ring') }} />
          <span style={{ position: 'absolute', display: 'grid', placeItems: 'center', ...anim('crv1-front') }}>
            <span style={{ width: 72, height: 72, borderRadius: 36, background: 'var(--c-you)', color: 'var(--c-on-you, #fff)', display: 'grid', placeItems: 'center' }}><Icon d={ICON.check} size={32} width={2.6} /></span>
          </span>
          <span style={{ position: 'absolute', display: 'grid', placeItems: 'center', ...anim('crv1-back') }}><Crest size={88} /></span>
        </div>
      );
    }
    const rays = Array.from({ length: 10 }, (_, i) => i * 36);
    return (
      <div style={wrap}>
        <span style={{ position: 'absolute', inset: -46, borderRadius: '50%', background: `radial-gradient(circle, ${FILL}88 0%, ${FILL}33 40%, transparent 70%)`, ...anim('crv2-glow') }} />
        <span style={{ position: 'absolute', inset: -40, ...anim('crv2-rays') }}>
          {rays.map((r) => <span key={r} style={{ position: 'absolute', left: '50%', top: '50%', width: 3, height: 84, marginLeft: -1.5, marginTop: -84, borderRadius: 2, background: `linear-gradient(to top, ${FILL}00, ${FILL}aa)`, transformOrigin: '50% 100%', transform: `rotate(${r}deg)` }} />)}
        </span>
        <span style={{ position: 'relative', ...anim('crv2-rise') }}><Crest size={88} shine={`s${Math.random().toString(36).slice(2, 7)}`} /></span>
      </div>
    );
  }

  const LG = { name: 'Stock Scudetto', when: 'Sat, Nov 28 · 7:00 PM ET', rows: [['Managers', '5 of 6'], ['Stakes', '$2,000 per slot'], ['Season', '14 weeks']] };
  function OS() {
    return <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;
  }
  /** "You're in {league}" with the stage in place of the tick. Today's words only. */
  function YoureIn({ t = 'light', x = 1, v, end, label, onTap }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label} onClick={onTap} style={{ cursor: onTap ? 'pointer' : 'default' }}>
          <OS />
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, padding: `${x > 1 ? 40 : 90}px 20px 40px`, display: 'grid', alignContent: 'start', gap: 18, justifyItems: 'center', textAlign: 'center', overflow: 'hidden' }}>
            <Stage v={v} end={end} />
            <span style={{ display: 'grid', gap: 2 }}>
              <span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)' }}>You're in</span>
              <span style={{ ...fs(28, x), fontWeight: 800, color: 'var(--c-text)' }}>{LG.name}</span>
            </span>
            <span style={{ ...fs(15, x), color: 'var(--c-text-2)' }}>The draft is <span style={{ whiteSpace: 'nowrap' }}>{LG.when}</span>.</span>
            <div className="dr-a-card" style={{ padding: '4px 16px', width: '100%', boxSizing: 'border-box' }}>
              {LG.rows.map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, gap: 12 }}>
                  <span style={{ ...fs(15, x), color: 'var(--c-text-2)' }}>{a}</span><b style={{ ...fs(15, x), color: 'var(--c-text)' }}>{b}</b>
                </div>
              ))}
            </div>
            <span className="dr-btn" style={{ width: '100%', height: 50, ...fs(16, x), display: 'grid', placeItems: 'center' }}>Go to the league</span>
          </div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  /** A live phone: loops; a tap jumps it to the end (as in the app); Replay runs it again. */
  function Live({ t, x, v, label }) {
    const [run, setRun] = useState(0);
    const [end, setEnd] = useState(false);
    return (
      <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
        <Fit><YoureIn key={run} t={t} x={x} v={v} end={end} label={label} onTap={() => setEnd(true)} /></Fit>
        <button type="button" onClick={() => { setEnd(false); setRun(run + 1); }} style={{ font: 'inherit', fontWeight: 700, fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--c-border-strong)', background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer' }}>Replay</button>
      </div>
    );
  }
  /** Five frames, held still. */
  function Film({ t, v, times }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={`Version ${v}, five frames, ${t}`} style={{ background: 'var(--c-bg)', borderRadius: 14, padding: '18px 24px 10px', display: 'grid', gridTemplateColumns: `repeat(${times.length}, 150px)`, gap: 12, width: 'max-content', overflow: 'hidden' }}>
          {times.map((s) => (
            <div key={s} style={{ display: 'grid', gap: 26, justifyItems: 'center', paddingTop: 30 }}>
              <Stage v={v} still={s} />
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
  const Wide = ({ children }) => <div style={{ display: 'grid', gap: 28, margin: '8px 0 28px' }}>{children}</div>;

  function CallCrestReveal({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-crest-reveal" aria-labelledby="call-crest-reveal-h">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Crests</span>
          <div>
            <h2 id="call-crest-reveal-h">{archived ? 'Decided: the crest reveal' : 'Your call: the crest reveal'}</h2>
            <p className="b-job">On “You’re in {'{league}'}”, the first time only, your first crest arrives where today’s tick pops in. Two ways for it to arrive. The phones here move; tap one to skip to the end, as you could in the app.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>1 · The tick turns over (1.4 s).</b> Today’s blue tick pops in, then turns like a coin and its back is your crest, which lands with a small bounce and a ring of its colour.</li>
          <li><b>2 · The crest rises in light (1.8 s).</b> A glow in the crest’s colour opens, the crest rises out of it with a few rays behind, and a shine crosses it as it settles. No tick.</li>
          <li><b>Both:</b> today’s words, card and button appear at once and “Go to the league” works from the first frame, so nothing waits on the crest. A tap anywhere skips to the end. One tap on the phone (a haptic) as the crest lands. With Reduce Motion on, the crest is simply there (section 3).</li>
          <li><b>Sound, your call:</b> 1 needs none (the haptic is the landing). 2 suits a short soft chime as the crest lands. Either way it plays only with the ringer on.</li>
          <li><b>Recommended: 1.</b> It keeps the moment you joined (the tick) and turns it into the thing you keep, one object, no new effects. It is also the shorter of the two. 2 is closer to the treasure moment you liked; its glow is softer on Light than in Dark, and it drops the tick.</li>
          <li><b>Drawn flat, depth suggested</b> (a turn in perspective, a shadow as it turns): both are plain moves the app already makes, so no new library. The crest is a stand-in in style C until you pick a look.</li>
          <li><b>No new words.</b> The same reveal plays on “{'{name}'} is ready” for someone whose first league is one they created.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> 1 or 2, and sound or no sound.</>}</li>
        </ul>

        <Sub>1 · The tick turns over · 1.4 s</Sub>
        <Grid>{[
          fig('v1l', '1 · Light', <Live t="light" v={1} label="You're in Stock Scudetto, the tick turning into the crest" />, '0.25 s tick pops (as today) · 0.35–0.9 s turns over · 0.9 s lands, haptic · 1.4 s ring gone.'),
          fig('v1d', '1 · Dark', <Live t="dark" v={1} label="Version 1, Dark" />),
          fig('v1x', '1 · your text size', <Live t="light" x={AX5} v={1} label="Version 1, largest text size" />, 'The crest is a fixed size, like today’s tick; only the words grow.'),
        ]}</Grid>
        <Wide>
          {fig('v1f', '1 · five frames, Light', <Film t="light" v={1} times={[0.2, 0.4, 0.63, 1.0, 1.3]} />)}
          {fig('v1g', '1 · five frames, Dark', <Film t="dark" v={1} times={[0.2, 0.4, 0.63, 1.0, 1.3]} />)}
        </Wide>

        <Sub>2 · The crest rises in light · 1.8 s</Sub>
        <Grid>{[
          fig('v2l', '2 · Light', <Live t="light" v={2} label="You're in Stock Scudetto, the crest rising in light" />, '0–0.3 s glow opens · 0.2–0.9 s crest rises · 0.9 s lands, haptic · 0.8–1.5 s shine · 1.8 s glow gone.'),
          fig('v2d', '2 · Dark', <Live t="dark" v={2} label="Version 2, Dark" />),
          fig('v2x', '2 · your text size', <Live t="light" x={AX5} v={2} label="Version 2, largest text size" />),
        ]}</Grid>
        <Wide>
          {fig('v2f', '2 · five frames, Light', <Film t="light" v={2} times={[0.2, 0.5, 0.85, 1.2, 1.6]} />)}
          {fig('v2g', '2 · five frames, Dark', <Film t="dark" v={2} times={[0.2, 0.5, 0.85, 1.2, 1.6]} />)}
        </Wide>

        <Sub>3 · Reduce Motion on (both versions)</Sub>
        <Grid>{[
          fig('r1', 'Reduce Motion · Light', <Fit><YoureIn end label="You're in with Reduce Motion: the crest simply there" /></Fit>, 'No tick, no turn, no glow: the crest is there from the first frame.'),
          fig('r2', 'Reduce Motion · Dark', <Fit><YoureIn t="dark" end label="Reduce Motion, Dark" /></Fit>),
        ]}</Grid>
      </section>
    );
  }

  window.KSCrestReveal = () => <CallCrestReveal />;
  window.KSCrestRevealArchived = () => null;
})();
