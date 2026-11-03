// Your call: the chart on Home (Giorgio, 1.3.0 (8), 2026-11-03). Design Lead, 2026-11-03.
// Game Night, Dark AND Light, at Large (the standard size) and at Accessibility XXXL (AX5, the
// size Giorgio's phone runs). Today's Home and three answers: A no chart (the matchup leads, a
// week-by-week strip under it), B a chart about the game (your score vs your opponent's, week by
// week), C your place in the league week by week.
// Review notes sit UNDER the phones (Giorgio, 2026-10-14), never inside them. AX5 frames are an
// approximation (text about 2.4x; money, scores and chart labels capped as the app caps them);
// the build gate checks the real size on the simulator.

(function () {
  const { Device, Icon, ICON, $, $s, pct } = window.KSKit;
  const K = window.KS;
  const GN = window.KSGN;
  const { Fit, Av, Head, LiveChip } = GN;
  const G = GN.G;
  const H = K.HOME;
  const L = K.MATCHUP.live;
  const tone = (v) => (Math.round(Math.abs(v) * 100) === 0 ? 'dr-zero' : v > 0 ? 'dr-gain' : 'dr-loss');
  const toneVar = (r) => (r === 'W' ? 'var(--c-gain)' : r === 'L' ? 'var(--c-loss)' : 'var(--c-text-2)');

  // ── Text size. x = the Dynamic Type multiplier (1 = Large, 2.4 ≈ AX5); cap = the app's cap. ──
  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  /** keepDots: each chunk is unbreakable; a "·" ends its chunk, so it can end a line but never start one. */
  const Chunks = ({ parts }) => parts.map((p, i) => <React.Fragment key={i}><span style={{ whiteSpace: 'nowrap' }}>{p}{i < parts.length - 1 ? ' ·' : ''}</span>{i < parts.length - 1 ? ' ' : ''}</React.Fragment>);

  // ── The season, week by week (sample schedule; Roberto's scores are data.js's ROBERTO_WEEKS
  // and this week's live score; the opponents' scores are board samples, each on the right side
  // of the result). Week 3's loss is to Alessandro, as data.js's head-to-head says. ──
  const WEEKS = [
    { wk: 1, opp: 'Andrea P.', init: 'AP', oppGain: -12.85 },
    { wk: 2, opp: 'Francesco T.', init: 'FT', oppGain: 22.4 },
    { wk: 3, opp: 'Alessandro D.', init: 'AD', oppGain: 64.1 },
    { wk: 4, opp: 'Gianluigi B.', init: 'GB', oppGain: -38.55 },
    { wk: 5, opp: 'Andrea P.', init: 'AP', oppGain: -61.7 },
  ].map((w, i) => ({ ...w, gain: K.ROBERTO_WEEKS[i].gain, result: K.ROBERTO_WEEKS[i].result }));
  const LIVE = { wk: 6, opp: 'Gianluigi B.', init: 'GB', gain: L.you.gain, oppGain: L.opp.gain, live: true };
  const NEXT = [
    { wk: 7, opp: 'Paolo M.', init: 'PM' },
    { wk: 8, opp: 'Francesco T.', init: 'FT' },
    { wk: 9, opp: 'Alessandro D.', init: 'AD' },
  ];
  // Standings position after each scored week (board sample; Week 5 matches "2nd of 6").
  const PLACES = [3, 2, 4, 3, 2];

  // ── Shared pieces, scaled ──
  function Hero({ x }) {
    return (
      <div style={{ display: 'grid', gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10 }}>
          <span className="dr-cap" style={fs(12, x)}>Your team</span>
          <span className="dr-cap dr-num" style={{ ...fs(12, x), textAlign: 'right', marginLeft: 'auto' }}><Chunks parts={['2nd of 6', H.record, `Week ${K.LEAGUE.week} of ${K.LEAGUE.weeks}`]} /></span>
        </div>
        <div className="dr-hero" style={{ fontSize: Math.round(46 * k(x, 1.3)), lineHeight: `${Math.round(48 * k(x, 1.3))}px` }}>{$(H.value)}</div>
        <div className="dr-call dr-num" style={{ ...fs(13, x), fontWeight: 700 }}>
          <span style={{ whiteSpace: 'nowrap' }}><span className="dr-gain">{$s(H.gain)} ·</span></span>{' '}
          <span style={{ whiteSpace: 'nowrap' }}><span className="dr-gain">{pct(H.gainPct)}</span></span>{' '}
          <span style={{ whiteSpace: 'nowrap' }} className="dr-muted"><span style={{ fontWeight: 500 }}>season gain ·</span></span>{' '}
          <span style={{ whiteSpace: 'nowrap' }}><span className="dr-gain">{$s(H.today)}</span> <span className="dr-muted" style={{ fontWeight: 500 }}>today</span></span>
        </div>
      </div>
    );
  }
  const Chev = ({ x }) => <span className="dr-muted" style={{ display: 'inline-flex' }}><Icon d={ICON.right} size={Math.round(16 * k(x, 1.6))} width={2.4} /></span>;
  /** This week: the approved card (your half shaded, the tug, the lead line). */
  function ThisWeek({ x }) {
    const y = K.scoreDisplay(L.you), o = K.scoreDisplay(L.opp);
    const frac = K.tugRatio(y.value, o.value);
    const sc = { fontSize: Math.round(28 * k(x, 1.5)), lineHeight: `${Math.round(30 * k(x, 1.5))}px` };
    return (
      <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="dr-tag" style={{ ...fs(11, x, 1.6), color: 'var(--c-live-text)' }}>This week</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LiveChip /><Chev x={x} /></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: x > 1.5 ? '1fr' : '1fr 1fr', margin: '0 -16px' }}>
          <div style={{ display: 'grid', gap: 10, padding: '12px 16px', background: 'var(--c-you-tint)', alignContent: 'start' }}>
            <span className="dr-call" style={{ ...fs(13, x), display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><Av init="RB" you size={24} />You</span>
            <span className="dr-score" style={sc}>{y.primary}</span>
          </div>
          <div style={{ display: 'grid', gap: 10, padding: '12px 16px', justifyItems: x > 1.5 ? 'start' : 'end', alignContent: 'start' }}>
            <span className="dr-call dr-muted" style={{ ...fs(13, x), display: 'flex', alignItems: 'center', gap: 8, flexDirection: x > 1.5 ? 'row-reverse' : 'row' }}>vs Gianluigi B.<Av init="GB" size={24} /></span>
            <span className="dr-score" style={sc}>{o.primary}</span>
          </div>
        </div>
        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 }}>
          <span style={{ flex: frac, background: 'var(--c-you)' }} />
          <span style={{ flex: 1 - frac, background: 'var(--c-track)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }} className="dr-cap">
          <span style={{ ...fs(12, x), color: 'var(--c-text)' }}>You lead by <b className="dr-num" style={{ whiteSpace: 'nowrap' }}>{K.formatMoney(Math.abs(L.you.gain - L.opp.gain))}</b></span>
          <span style={{ ...fs(12, x), marginLeft: x > 1.5 ? 0 : 'auto' }}><Chunks parts={['Ends Fri 4:00 PM ET']} /></span>
        </div>
      </div>
    );
  }
  /** Standings excerpt: the top three, your row tinted. */
  function Standings({ x }) {
    const rows = K.STANDINGS_BEFORE.slice(0, 3);
    return (
      <div className="dr-a-card" style={{ padding: '14px 10px 8px', display: 'grid', gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px 4px', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ ...fs(17, x), fontWeight: 800 }}>Standings</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}><span className="dr-cap" style={fs(12, x)}>Through Week 5</span><Chev x={x} /></span>
        </div>
        {rows.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'auto auto minmax(0,1fr) auto', columnGap: 10, rowGap: 2, alignItems: 'center', padding: '9px 10px', borderRadius: 10, background: r.you ? 'var(--c-you-tint)' : undefined }}>
            <span className="dr-score" style={{ ...fs(15, x, 1.6), color: 'var(--c-text-2)' }}>{r.rank}</span>
            <Av init={r.init} you={r.you} size={24} />
            <span className="dr-call" style={{ ...fs(15, x), fontWeight: r.you ? 800 : 500 }}>{r.name}</span>
            <span className="dr-call dr-num" style={{ ...fs(13, x), textAlign: 'right', display: 'flex', flexDirection: x > 1.5 ? 'column' : 'row', alignItems: 'flex-end', columnGap: 12 }}><span className="dr-muted">{r.w}–{r.l}</span><b className={tone(r.pf)} style={{ fontWeight: 800, minWidth: x > 1.5 ? 0 : 66, textAlign: 'right' }}>{$s(r.pf)}</b></span>
          </div>
        ))}
      </div>
    );
  }
  const SectionHead = ({ x, title, right }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <span style={{ ...fs(17, x), fontWeight: 800 }}>{title}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>{right}</span>
    </div>
  );

  // ── TODAY: the season chart as 1.3.0 ships it (dashed $0, W/L marks, two end dates, tabs) ──
  function TodayChart({ x }) {
    const w = 402, lab = k(x, 1.5);
    const h = Math.round(124 + 40 * lab);
    const s = H.series, starts = H.weekStarts;
    const pad = { t: 14, b: Math.round(24 * lab + 20 * lab) };
    const min = Math.min(0, ...s), max = Math.max(0, ...s);
    const X = (i) => (i / (s.length - 1)) * (w - 22) + 1;
    const Y = (v) => pad.t + (1 - (v - min) / (max - min || 1)) * (h - pad.t - pad.b);
    const path = s.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const ex = X(s.length - 1), ey = Y(s[s.length - 1]);
    const results = [...H.weekResults.map((r) => r.result), 'live'];
    const spans = starts.map((a, i) => [a, i + 1 < starts.length ? starts[i + 1] : s.length - 1]);
    const markY = h - Math.round(20 * lab) - 6;
    return (
      <div style={{ display: 'grid', gap: 2 }}>
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Season gain, Sep 29 to Nov 5" style={{ display: 'block', marginInline: -G, overflow: 'visible' }}>
          <line x1="0" x2={w} y1={Y(0)} y2={Y(0)} stroke="var(--c-border-strong)" strokeDasharray="3 5" strokeWidth="1" opacity=".8" />
          <path d={path} fill="none" stroke="var(--c-gain)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={ex} cy={ey} r="9" fill="var(--c-live)" opacity=".22" />
          <circle cx={ex} cy={ey} r="4.5" fill="var(--c-live)" />
          {spans.map(([a, b], i) => {
            const r = results[i];
            const cx = r === 'live' ? ex : (X(a) + X(b)) / 2;
            return r === 'live'
              ? <circle key={i} cx={cx} cy={markY - 4} r="3.5" fill="var(--c-live)" />
              : <text key={i} x={cx} y={markY} textAnchor="middle" fontSize={Math.round(12 * lab)} fontWeight="800" fill={toneVar(r)}>{r}</text>;
          })}
          <text x={G} y={h - 3} fontSize={Math.round(12 * lab)} fontWeight="500" fill="var(--c-text-2)">Sep 29</text>
          <text x={w - G} y={h - 3} textAnchor="end" fontSize={Math.round(12 * lab)} fontWeight="500" fill="var(--c-text-2)">Nov 5</text>
        </svg>
        <div style={{ display: 'flex', gap: 18 * k(x, 1.4), justifyContent: 'flex-end' }}>
          {['1W', '1M', 'Season'].map((t) => (
            <span key={t} className="dr-call" style={{ ...fs(13, x, 1.6), fontWeight: t === 'Season' ? 800 : 600, color: t === 'Season' ? 'var(--c-text)' : 'var(--c-text-2)', borderBottom: `2px solid ${t === 'Season' ? 'var(--c-accent)' : 'transparent'}`, paddingBottom: 2 }}>{t}</span>
          ))}
        </div>
      </div>
    );
  }

  // ── A: no chart. This week leads; "Your season" is one tile per week, scrolling sideways. ──
  function SeasonStrip({ x }) {
    const tw = Math.round(54 * k(x, 2.1));
    const tile = (w) => {
      const base = { flex: 'none', width: tw, minHeight: Math.round(76 * k(x, 2.1)), boxSizing: 'border-box', borderRadius: 12, padding: '8px 2px', display: 'grid', justifyItems: 'center', alignContent: 'space-between', gap: 2, textAlign: 'center' };
      const wk = <span className="dr-cap dr-num" style={fs(12, x)}>Wk {w.wk}</span>;
      if (w.live) {
        return (
          <span key={w.wk} style={{ ...base, background: 'var(--c-you-tint)', boxShadow: 'inset 0 0 0 1.5px var(--c-you)' }}>
            {wk}
            <span className="dr-dot" style={{ width: 9 * k(x, 2), height: 9 * k(x, 2) }} />
            <span className="dr-call" style={{ ...fs(12, x), fontWeight: 800, color: 'var(--c-live-text)' }}>Live</span>
          </span>
        );
      }
      if (w.result) {
        return (
          <span key={w.wk} style={{ ...base, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--d-rim)' }}>
            {wk}
            <span className="dr-score" style={{ ...fs(22, x, 2), color: toneVar(w.result) }}>{w.result}</span>
            <span className={`dr-num ${tone(w.gain)}`} style={{ ...fs(12, x), fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{$s(w.gain)}</span>
          </span>
        );
      }
      return (
        <span key={w.wk} style={{ ...base, boxShadow: 'inset 0 0 0 1px var(--c-line)' }}>
          {wk}
          <Av init={w.init} size={Math.round(26 * k(x, 1.6))} />
          <span className="dr-cap" style={{ ...fs(12, x), whiteSpace: 'nowrap' }}>{w.opp.split(' ')[0].slice(0, x > 1.5 ? 6 : 7)}</span>
        </span>
      );
    };
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <SectionHead x={x} title="Your season" right={<Chev x={x} />} />
        <div style={{ display: 'flex', gap: 6, marginInline: -G, paddingInline: G, overflow: 'hidden' }}>
          {[...WEEKS, LIVE, ...NEXT].map(tile)}
        </div>
      </div>
    );
  }

  // ── B: a chart about the game. Each week, your score beside your opponent's, on a labelled $ scale. ──
  function WeekBars({ x }) {
    const lab = k(x, 1.4);
    const w = 362, top = 10, plotH = 150, axisW = Math.round(46 * lab);
    const bottom = Math.round(40 * lab);
    const h = top + plotH + bottom;
    const lo = -100, hi = 250;
    const Y = (v) => top + (1 - (v - lo) / (hi - lo)) * plotH;
    const all = [...WEEKS, LIVE];
    const slot = (w - axisW) / all.length, bw = Math.min(16, slot * 0.28);
    const ticks = [200, 100, 0, -100];
    const lbl = (v) => (v === 0 ? '$0' : `${v > 0 ? '+' : '−'}$${Math.abs(v)}`);
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <SectionHead x={x} title="Week by week" right={<>
          <span className="dr-cap" style={{ ...fs(12, x, 1.6), display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--c-you)' }} />You</span>
          <span className="dr-cap" style={{ ...fs(12, x, 1.6), display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--c-text-2)', opacity: 0.5 }} />Opponent</span>
        </>} />
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Your score and your opponent's, each week" style={{ display: 'block', overflow: 'visible' }}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1="0" x2={w - axisW + 4} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? 'var(--c-text-2)' : 'var(--c-line)'} strokeWidth={v === 0 ? 1.25 : 1} opacity={v === 0 ? 0.7 : 1} />
              <text x={w} y={Y(v) + 4 * lab} textAnchor="end" fontSize={Math.round(11 * lab)} fontWeight={v === 0 ? 800 : 600} fill="var(--c-text-2)" style={{ fontVariantNumeric: 'tabular-nums' }}>{lbl(v)}</text>
            </g>
          ))}
          {all.map((wk, i) => {
            const cx = slot * i + slot / 2;
            const bar = (v, dx, fill, op) => {
              const y0 = Y(0), y1 = Y(v);
              return <rect x={cx + dx} y={Math.min(y0, y1)} width={bw} height={Math.max(2, Math.abs(y1 - y0))} rx="3" fill={fill} opacity={op} />;
            };
            return (
              <g key={wk.wk}>
                {wk.live ? <rect x={cx - slot / 2 + 3} y={top - 4} width={slot - 6} height={plotH + 8} rx="8" fill="var(--c-you-tint)" /> : null}
                {bar(wk.gain, -bw - 1.5, 'var(--c-you)', 1)}
                {bar(wk.oppGain, 1.5, 'var(--c-text-2)', 0.5)}
                <text x={cx} y={top + plotH + 16 * lab} textAnchor="middle" fontSize={Math.round(11 * lab)} fontWeight="600" fill="var(--c-text-2)" style={{ fontVariantNumeric: 'tabular-nums' }}>Wk {wk.wk}</text>
                {wk.live
                  ? <g><circle cx={cx - 16 * lab} cy={top + plotH + 31 * lab} r={3.5 * lab} fill="var(--c-live)" /><text x={cx + 5 * lab} y={top + plotH + 35 * lab} textAnchor="middle" fontSize={Math.round(12 * lab)} fontWeight="800" fill="var(--c-live-text)">Live</text></g>
                  : <text x={cx} y={top + plotH + 35 * lab} textAnchor="middle" fontSize={Math.round(13 * lab)} fontWeight="900" fill={toneVar(wk.result)}>{wk.result}</text>}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // ── C: your place in the league after each scored week (1st at the top). ──
  function PlaceRace({ x }) {
    const lab = k(x, 1.4);
    const w = 362, axisW = Math.round(34 * lab), top = 10, rowH = 24, plotH = rowH * 5, bottom = Math.round(40 * lab);
    const h = top + plotH + bottom;
    const Y = (p) => top + (p - 1) * rowH;
    const cols = [...WEEKS, LIVE];
    const slot = (w - axisW) / cols.length;
    const X = (i) => axisW + slot * i + slot / 2;
    const pts = PLACES.map((p, i) => [X(i), Y(p)]);
    const path = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <SectionHead x={x} title="Your place" right={<span className="dr-cap" style={fs(12, x)}>After each week</span>} />
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Your place in the standings after each week: 3rd, 2nd, 4th, 3rd, 2nd" style={{ display: 'block', overflow: 'visible' }}>
          {[1, 2, 3, 4, 5, 6].map((p) => (
            <g key={p}>
              <line x1={axisW} x2={w} y1={Y(p)} y2={Y(p)} stroke="var(--c-line)" strokeWidth="1" />
              <text x="0" y={Y(p) + 4 * lab} fontSize={Math.round(11 * lab)} fontWeight={p === 2 ? 800 : 600} fill={p === 2 ? 'var(--c-text)' : 'var(--c-text-2)'}>{K.ordinal(p)}</text>
            </g>
          ))}
          <path d={path} fill="none" stroke="var(--c-you)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map(([a, b], i) => <circle key={i} cx={a} cy={b} r={i === pts.length - 1 ? 6 : 4.5} fill="var(--c-you)" stroke="var(--c-bg)" strokeWidth="2" />)}
          {cols.map((wk, i) => (
            <g key={wk.wk}>
              <text x={X(i)} y={top + plotH + 18 * lab} textAnchor="middle" fontSize={Math.round(11 * lab)} fontWeight="600" fill="var(--c-text-2)">Wk {wk.wk}</text>
              {wk.live
                ? <text x={X(i)} y={top + plotH + 36 * lab} textAnchor="middle" fontSize={Math.round(12 * lab)} fontWeight="800" fill="var(--c-live-text)">Live</text>
                : <text x={X(i)} y={top + plotH + 36 * lab} textAnchor="middle" fontSize={Math.round(13 * lab)} fontWeight="900" fill={toneVar(wk.result)}>{wk.result}</text>}
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // ── The four Homes ──
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  function Home({ t, v, x = 1 }) {
    const ax = x > 1;
    const body = {
      today: <><div style={{ display: 'grid', gap: 8 }}><Hero x={x} /><TodayChart x={x} /></div><ThisWeek x={x} /><Standings x={x} /></>,
      A: <><Hero x={x} /><ThisWeek x={x} /><SeasonStrip x={x} /><Standings x={x} /></>,
      B: <><Hero x={x} /><WeekBars x={x} /><ThisWeek x={x} /><Standings x={x} /></>,
      C: <><Hero x={x} /><ThisWeek x={x} /><PlaceRace x={x} /><Standings x={x} /></>,
    }[v];
    return (
      <Th t={t}>
        <Device tab="home" full={!ax} label={`Home in season, ${v === 'today' ? 'as 1.3.0 ships it' : `option ${v}`}${ax ? ', Accessibility XXXL (AX5, approximate), first screen' : ''}, ${t}`}>
          <Head />
          <div style={{ padding: `0 ${G}px 24px`, display: 'flex', flexDirection: 'column', gap: 24 }}>{body}</div>
        </Device>
      </Th>
    );
  }

  // ── Layout helpers (the note goes under the frame, never inside it) ──
  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const AX_NOTE = 'An approximation of your text size (Accessibility XXXL): what fits on the first screen. The build gate checks the real thing.';
  const four = (v, cap, notes = {}) => [
    fig(`${v}ld`, `${cap} · Large · Dark`, <Home t="dark" v={v} />, notes.l),
    fig(`${v}ll`, `${cap} · Large · Light`, <Home t="light" v={v} />, notes.l),
    fig(`${v}xd`, `${cap} · your size (AX5) · Dark`, <Home t="dark" v={v} x={2.4} />, notes.x || AX_NOTE),
    fig(`${v}xl`, `${cap} · your size (AX5) · Light`, <Home t="light" v={v} x={2.4} />, notes.x || AX_NOTE),
  ];

  function CallHomeChart({ archived, decided, decidedNote }) {
    return (
      <section className="b-sec" id="call-home-chart" aria-labelledby="call-home-chart-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Home</span>
          <div>
            <h2 id="call-home-chart-h">{archived ? `Decided: ${decided}, the chart on Home` : 'Your call: the chart on Home'}</h2>
            <p className="b-job">Your words on 1.3.0 (8): "I don't love the chart on the home screen... I don't love the dashed line up top. ...you don't really get a sense of what's going on, because there's not really clearly labeled axes. ...it's pretty redundant having that, and then the view of the portfolio page is very similar. I think the portfolio page graph is way more impactful and useful." Below: Home as it ships, then three answers. The hero, This week and Standings are the same in all of them; only the chart changes. Each is drawn at the standard size and at yours, in both themes.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Today:</b> the season gain as a line, a dashed $0 line, W or L under each week, two end dates, and 1W / 1M / Season. In a season below $0 the dashed line sits at the top, as on your phone, with nothing saying what it is. Portfolio already draws your money as a line, with dates and the same tabs.</li>
          <li><b>A · No chart; the matchup comes first.</b> This week moves up under your team's value. Under it, <b>"Your season"</b>: one tile per week, sideways. A played week shows W or L and your score that week; this week says Live (its score is in This week, right above); the weeks ahead show who you play. A tile opens that week's matchup; the title opens League › Schedule. The money line lives on Portfolio, the one you prefer. <b>Cost: small, about a day:</b> the chart and its tabs come off Home; one new row, fed by the schedule League › Schedule already loads.</li>
          <li><b>B · A chart about the game.</b> <b>"Week by week"</b>: each week, your score beside your opponent's as two bars, a $ scale on the right, a solid line marked $0, and W or L under each week; this week is shaded and marked Live. Nothing like Portfolio's line, and it shows who you beat, not just your money. <b>Cost: medium, 2–3 days:</b> a new bar chart (tap a week to open it, VoiceOver per week), the same schedule data. Like every chart, its labels stop growing at about 1.4× your size, so at AX5 it stays as tall as it is and pushes This week down.</li>
          <li><b>C · Your place in the league.</b> <b>"Your place"</b>: where you stood in the standings after each week, 1st at the top, with W or L under each week. It shows how you got to "2nd of 6". <b>Cost: high, a week or more:</b> no table keeps past standings, so the server would rebuild them week by week with the same tiebreaks (new code where a mistake is easy and hard to see). It only moves on Fridays; the rest of the week it sits still.</li>
          <li><b>At your size:</b> today's chart takes most of the first screen, and This week starts at the bottom edge. In A, This week is on the first screen, right under your value. B is like today. C is like A.</li>
          <li><b>Recommended: A.</b> It answers both of your points: no second copy of Portfolio's chart, and nothing to decode. It puts the head-to-head, the heart of the game, first. It's the only option that gets better at your text size, not worse, and the cheapest. Pick B if you want a picture on Home that is about the game.</li>
          <li><b>New words, to approve as written:</b> A: "Your season", "Wk 1" … "Wk 14" on the tiles. B: "Week by week", "Opponent" (with "You"), the scale "+$200 / +$100 / $0 / −$100". C: "Your place", "After each week". The rules that change with A or B or C: "The Home chart plots season gain, week by week", and "the season chart sits directly under it" (the calm Home).</li>
          {archived ? <li><b>Decided by Giorgio ({decidedNote}).</b></li> : null}
        </ul>
        <h3 className="b-sub">Today, as 1.3.0 ships it</h3>
        <Grid>{four('today', 'Today', { l: 'The dashed line is $0. With a season below $0 it sits at the top of the chart.' })}</Grid>
        <h3 className="b-sub">A · No chart: This week first, then "Your season"</h3>
        <Grid>{four('A', 'A', { l: 'The tiles scroll sideways; Week 7 peeks in at the right edge. Later in the season the row opens with this week in view.' })}</Grid>
        <h3 className="b-sub">B · "Week by week": your score vs your opponent's</h3>
        <Grid>{four('B', 'B')}</Grid>
        <h3 className="b-sub">C · "Your place": where you stood after each week</h3>
        <Grid>{four('C', 'C', { l: 'Past places are a sample. No table keeps them today, which is the cost.' })}</Grid>
      </section>
    );
  }

  window.KSHomeChart = () => <CallHomeChart />;
})();
