// Stockpile key-screens board — Giorgio's tweak to the rule 12 sweep (2026-11-10): "a little information i on
// the end of each bar with a pop up explaining … it could even be a two part pop up, one explaining it with a
// concise word explanation and another with a visual. there should be a small x in the corner … for instances
// where a selection is key to process and has been defined by us and isnt obvious, then we need to give the
// user optional context". The i, the popup (A: words and visual together; B: two pages), every popup's words
// and visual, the AX5 frames, and which options get an i. Review notes sit UNDER the phones, never inside.
(function () {
  const { Device, Icon, ICON } = window.KSKit;
  const { Fit, G, Av, NEW } = window.KSGN;

  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  /** Text size: x is the Dynamic Type multiplier (1 = Large, ~3 = AX5 uncapped); cap is where that text stops. */
  const z = (px, x = 1, cap) => Math.round(px * Math.min(x, cap || x));
  const ROW = 1.3; // option rows stop at 1.3x, as Holdings and Schedule rows do
  const TITLE = 1.6; // card and popup titles stop at 1.6x
  const WORDS = undefined; // the popup's line is reading text: it grows the whole way (AX5 ~3.1x), and the card scrolls
  const VIS = 1.4; // labels inside a visual stop at 1.4x so the diagram keeps its shape
  const grey = { color: 'var(--c-text-2)' };

  // ── The i: 44pt target at the end of the row, a 22pt glyph in the secondary text colour. Never selects. ──
  function InfoI({ x = 1, on }) {
    return (
      <span aria-label="About" style={{ width: 44, height: 44, flex: 'none', display: 'grid', placeItems: 'center', marginRight: -10, color: on ? 'var(--c-accent)' : 'var(--c-text-2)', borderRadius: 999, background: on ? 'var(--c-accent-tint)' : 'transparent' }}>
        <Icon d={ICON.info} size={z(22, x, ROW)} width={2} />
      </span>
    );
  }
  const Radio = ({ on, x = 1 }) => (
    <span style={{ width: z(22, x, ROW), height: z(22, x, ROW), borderRadius: 999, flex: 'none', boxShadow: on ? `inset 0 0 0 ${z(7, x, ROW)}px var(--c-accent)` : 'inset 0 0 0 2px var(--c-border-strong)' }} />
  );
  /** A card of option rows (the app's SetupCard + ChoiceRow): radio, the name, the i. No line under any name. */
  function ChoiceCard({ opts, x = 1, info = true, pressed }) {
    return (
      <div className="dr-a-card" style={{ padding: '0 16px', display: 'grid' }}>
        {opts.map(([name, on], i) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, borderTop: i ? '1px solid var(--c-border)' : 'none', paddingBlock: x > 1 ? 8 : 0 }}>
            <Radio on={on} x={x} />
            <span style={{ flex: 1, minWidth: 0, fontSize: z(16, x, ROW), lineHeight: 1.25, fontWeight: 700 }}>{name}</span>
            {info ? <InfoI x={x} on={pressed === name} /> : null}
          </div>
        ))}
      </div>
    );
  }
  const Tag = ({ children, x = 1 }) => <span className="dr-tag" style={{ fontSize: z(11, x, ROW), color: 'var(--c-text-2)' }}>{children}</span>;
  /** A label row that ends in an i (a segmented control's label, a stepper's, a switch's). */
  function LabelI({ label, value, x = 1, kind, info = true }) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <span style={{ fontSize: z(15, x, ROW), fontWeight: 700, flex: kind === 'switch' ? 1 : 'none', minWidth: 0 }}>{label}</span>
        {info ? <InfoI x={x} /> : null}
        {kind === 'stepper' ? (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden', flex: 'none' }}>
            <span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}><Icon d="M5 12h14" size={16} width={2.4} /></span>
            <b className="dr-num" style={{ minWidth: 48, display: 'grid', placeItems: 'center', fontSize: 16, borderInline: '1px solid var(--c-border)' }}>{value}</b>
            <span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}><Icon d={ICON.plus} size={16} width={2.4} /></span>
          </span>
        ) : kind === 'switch' ? (
          <span style={{ width: 50, height: 30, borderRadius: 999, background: 'var(--c-track)', flex: 'none', position: 'relative', marginLeft: 6 }}><span style={{ position: 'absolute', left: 2, top: 2, width: 26, height: 26, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} /></span>
        ) : value ? <span className="dr-cap dr-num" style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 600, ...grey }}>{value}</span> : null}
      </span>
    );
  }
  const Seg = ({ opts, on }) => (
    <div style={{ display: 'flex', borderRadius: 10, padding: 3, background: 'var(--c-inset)', gap: 3 }}>{opts.map((o) => <span key={o} style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8, fontSize: 14, fontWeight: o === on ? 800 : 600, background: o === on ? 'var(--c-surface)' : 'transparent' }}>{o}</span>)}</div>
  );
  const Field = ({ v }) => <span style={{ minHeight: 46, borderRadius: 10, background: 'var(--c-inset)', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 15 }}>{v}</span>;

  // ── The steps, as they are after the sweep, with the i. ──
  function Step({ n, title, x = 1, children }) {
    return (
      <>
        <div style={{ padding: `8px ${G}px 0`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--c-accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, fontSize: z(15, x, ROW) }}><Icon d={ICON.left} size={18} width={2.4} />{n === 1 ? 'Cancel' : 'Back'}</span>
          <span className="dr-cap dr-num" style={{ fontSize: z(12, x, ROW) }}>{`Step ${n} of 4`}</span>
        </div>
        <div style={{ padding: `12px ${G}px 24px`, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          <span style={{ fontSize: z(30, x, TITLE), lineHeight: 1.15, fontWeight: 800 }}>{title}</span>
          {children}
        </div>
      </>
    );
  }
  const LeagueStep = ({ x = 1, pressed, reassure }) => (
    <Step n={1} title="League" x={x}>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: z(15, x, ROW), fontWeight: 700 }}>League name</span>
        <Field v="Serie A Traders" />
        {reassure ? <span style={{ fontSize: z(13, x, ROW), lineHeight: 1.35, ...grey }}>Don’t worry. You will be able to change this later.</span> : null}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <Tag x={x}>League type</Tag>
        <ChoiceCard x={x} opts={[['Matchup', true], ['Duration', false]]} pressed={pressed} />
      </div>
    </Step>
  );
  const StakesStep = ({ x = 1, pressed }) => (
    <Step n={4} title="Stakes" x={x}>
      <ChoiceCard x={x} opts={[['Equal stakes', true], ['Price tiers', false], ['Budget cap', false]]} pressed={pressed} />
      <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Stake per slot ($)</span>
        <Field v="$1,000" />
        <span style={{ height: 1, background: 'var(--c-border)', marginInline: -16 }} />
        <LabelI x={x} label="Allow non-draftable stocks (full universe)" kind="switch" />
      </div>
    </Step>
  );
  const DraftStep = ({ roundsI }) => (
    <Step n={3} title="Draft">
      <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 17, fontWeight: 800 }}>Pick clock</span><span className="dr-num" style={{ fontWeight: 700 }}>60 seconds</span></span>
        <Seg opts={['30', '45', '60', '75', '90']} on="60" />
      </div>
      <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 }}><span style={{ fontSize: 15, fontWeight: 700 }}>Draft time</span><span style={{ ...grey, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>TBD<Icon d={ICON.right} size={14} width={2.4} /></span></span>
        <span style={{ height: 1, background: 'var(--c-border)', marginInline: -16 }} />
        <LabelI label="Draft order" />
        <Seg opts={['Random', 'Manual']} on="Random" />
        <span style={{ height: 1, background: 'var(--c-border)', marginInline: -16 }} />
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 15, fontWeight: 700 }}>Rounds</span>{roundsI ? <InfoI /> : null}</span>
          <span style={{ display: 'inline-flex', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}><span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}><Icon d="M5 12h14" size={16} width={2.4} /></span><b className="dr-num" style={{ minWidth: 48, display: 'grid', placeItems: 'center', fontSize: 16, borderInline: '1px solid var(--c-border)' }}>6</b><span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}><Icon d={ICON.plus} size={16} width={2.4} /></span></span>
        </span>
      </div>
    </Step>
  );
  const SeasonStep = () => (
    <Step n={2} title="Season">
      <div className="dr-a-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <LabelI label="Managers" value="8" kind="stepper" info={false} />
        <span style={{ height: 1, background: 'var(--c-border)', marginInline: -16 }} />
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 15, fontWeight: 700 }}>Regular season</span><b className="dr-num" style={{ fontSize: 16 }}>11 weeks</b></span>
        <span style={{ height: 1, background: 'var(--c-border)', marginInline: -16 }} />
        <LabelI label="Playoff teams" value="6" kind="stepper" />
      </div>
    </Step>
  );

  // ── The visuals. s = the label scale (capped at VIS). ──
  const L = (px, x) => z(px, x, VIS);
  const money = { fontVariantNumeric: 'tabular-nums' };
  function VisMatchup({ x = 1 }) {
    const row = (init, name, gain, win, you) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34 }}>
        <Av init={init} you={you} size={L(24, x)} />
        <span style={{ flex: 1, fontSize: L(14, x), fontWeight: win ? 800 : 600 }}>{name}</span>
        <span className="dr-num" style={{ ...money, fontSize: L(14, x), fontWeight: 800, color: gain.startsWith('+') ? 'var(--c-gain)' : 'var(--c-loss)' }}>{gain}</span>
        <span style={{ width: L(22, x), textAlign: 'center', fontSize: L(12, x), fontWeight: 900, color: win ? 'var(--c-gain)' : 'transparent' }}>W</span>
      </span>
    );
    const pair = (a, b) => <span style={{ display: 'grid', fontSize: L(12, x), padding: '4px 8px', borderRadius: 8, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-border)', whiteSpace: 'nowrap' }}><span><b className="dr-num">{a[0]}</b> {a[1]}</span><span style={grey}><b className="dr-num">{b[0]}</b> {b[1]}</span></span>;
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <span className="dr-tag" style={{ fontSize: L(11, x), ...grey }}>Week 3</span>
        <div style={{ display: 'grid' }}>{row('RB', 'You', '+$24.10', true, true)}{row('MR', 'Marco R.', '−$8.30', false)}</div>
        <span style={{ height: 1, background: 'var(--c-border)' }} />
        <span className="dr-tag" style={{ fontSize: L(11, x), ...grey }}>After the regular season</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'grid', gap: 6, flex: 1, minWidth: 0 }}>
            {pair([1, 'You'], [4, 'Elena M.'])}
            {pair([2, 'Luca C.'], [3, 'Marco R.'])}
          </span>
          <Icon d={ICON.right} size={L(16, x)} width={2.4} />
          <span style={{ fontSize: L(12, x), fontWeight: 800, padding: '8px 12px', borderRadius: 8, background: 'var(--c-accent-tint)' }}>Final</span>
        </div>
      </div>
    );
  }
  function VisDuration({ x = 1 }) {
    const W = 300, H = 120;
    const lines = [
      { pts: [0, 8, 4, 22, 30, 46, 58, 72, 92], c: 'var(--c-accent)', w: 3, name: 'Marco R.', end: '+$182' },
      { pts: [0, 12, 18, 14, 34, 40, 38, 52, 66], c: 'var(--c-you-text)', w: 2.5, name: 'You', end: '+$131' },
      { pts: [0, -6, 6, 10, 4, 18, 26, 22, 30], c: 'var(--c-text-2)', w: 1.5 },
      { pts: [0, 4, -4, -10, -2, -8, 2, -6, -12], c: 'var(--c-text-2)', w: 1.5 },
    ];
    const px = (i) => (i / 8) * (W - 70), py = (v) => H - 20 - ((v + 20) / 115) * (H - 30);
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} aria-hidden="true">
          <line x1="0" x2={W - 70} y1={py(0)} y2={py(0)} stroke="var(--c-border)" strokeDasharray="3 4" />
          {lines.map((l, k) => <polyline key={k} points={l.pts.map((v, i) => `${px(i)},${py(v)}`).join(' ')} fill="none" stroke={l.c} strokeWidth={l.w} strokeLinejoin="round" strokeLinecap="round" />)}
          <line x1={W - 70} x2={W - 70} y1="6" y2={H - 14} stroke="var(--c-text-2)" strokeWidth="1.5" />
          {lines.filter((l) => l.name).map((l, k) => (
            <text key={k} x={W - 64} y={py(l.pts[8]) + 4} fontSize={L(12, x)} fontWeight="800" fill={l.c}>{k === 0 ? '1st' : '2nd'}</text>
          ))}
        </svg>
        <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: L(12, x), ...grey }}><span>Start</span><span>End</span></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: L(13, x) }}><Av init="MR" size={L(22, x)} /><b style={{ flex: 1 }}>Marco R. wins</b><b className="dr-num" style={{ ...money, color: 'var(--c-gain)' }}>+$182.40</b></span>
      </div>
    );
  }
  /** Question 1: what Rounds means. Your team after a 6-round draft: one stock per round. */
  function VisRounds({ x = 1 }) {
    const picks = ['NVDA', 'COST', 'F', 'AAPL', 'MSFT', 'KO'];
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="dr-tag" style={{ fontSize: L(11, x), ...grey }}>6 rounds: your team after the draft</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {picks.map((t, i) => (
            <span key={t} style={{ display: 'grid', gap: 2, padding: '6px 8px', borderRadius: 8, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
              <span style={{ fontSize: L(11, x), ...grey }}>{`Round ${i + 1}`}</span><b className="dr-t" style={{ fontSize: L(14, x) }}>{t}</b>
            </span>
          ))}
        </div>
        <span style={{ fontSize: L(13, x), fontWeight: 700 }}>6 rounds = 6 stocks on every team</span>
      </div>
    );
  }
  /** Question 2: how a Duration league is won. One Budget cap league, ranked by dollars or by percent. */
  const FINAL = [
    { init: 'MR', name: 'Marco R.', start: 2480, gain: 186 },
    { init: 'RB', name: 'You', start: 1240, gain: 136.4, you: true },
    { init: 'LC', name: 'Luca C.', start: 1900, gain: 95 },
  ];
  function VisFinal({ x = 1, by }) {
    const pct = (r) => (r.gain / r.start) * 100;
    const rows = [...FINAL].sort((a, b) => (by === 'pct' ? pct(b) - pct(a) : b.gain - a.gain));
    const w = L(60, x);
    const col = (on) => ({ ...money, width: w, textAlign: 'right', fontSize: L(13, x), fontWeight: on ? 900 : 500, color: on ? 'var(--c-gain)' : 'var(--c-text-2)' });
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <span className="dr-tag" style={{ fontSize: L(11, x), ...grey }}>End of the league · a Budget cap league</span>
        <span style={{ display: 'flex', gap: 6, fontSize: L(11, x), ...grey }}><span style={{ flex: 1 }} /><span style={{ width: w, textAlign: 'right' }}>Spent</span><span style={{ width: w, textAlign: 'right' }}>Gain $</span><span style={{ width: w, textAlign: 'right' }}>Gain %</span></span>
        {rows.map((r, i) => (
          <span key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 32 }}>
            <b className="dr-num" style={{ width: 12, fontSize: L(13, x) }}>{i + 1}</b>
            <Av init={r.init} you={r.you} size={L(22, x)} />
            <span style={{ flex: 1, minWidth: 0, fontSize: L(13, x), fontWeight: i === 0 ? 800 : 600, whiteSpace: 'nowrap' }}>{r.name}</span>
            <span className="dr-num" style={{ ...money, width: w, textAlign: 'right', fontSize: L(12, x), ...grey }}>{`$${r.start.toLocaleString('en-US')}`}</span>
            <span className="dr-num" style={col(by !== 'pct')}>{`+$${r.gain.toFixed(2)}`}</span>
            <span className="dr-num" style={col(by === 'pct')}>{`+${pct(r).toFixed(1)}%`}</span>
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: L(13, x), marginTop: 4 }}><Av init={rows[0].init} you={rows[0].you} size={L(22, x)} /><b style={{ flex: 1 }}>{rows[0].you ? 'You win' : `${rows[0].name} wins`}</b><span style={grey}>{by === 'pct' ? 'biggest gain in %' : 'biggest gain in $'}</span></span>
      </div>
    );
  }
  const STOCKS = { F: ['F', 11.2], NVDA: ['NVDA', 186.42], MSFT: ['MSFT', 512.18], COST: ['COST', 918.3] };
  const $ = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  function VisEqual({ x = 1 }) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {['F', 'NVDA', 'COST'].map((k) => {
          const [t, p] = STOCKS[k];
          return (
            <div key={k} style={{ display: 'grid', gap: 4 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: L(13, x), flexWrap: 'wrap' }}><b className="dr-t">{t}</b><span className="dr-num" style={{ ...grey, ...money }}>{$(p)}</span><span className="dr-num" style={{ marginLeft: 'auto', ...grey, ...money }}>{`${(1000 / p).toFixed(2)} shares`}</span></span>
              <span style={{ height: L(18, x), borderRadius: 6, background: 'var(--c-accent)', color: 'var(--c-primary-fg, #fff)', fontSize: L(11, x), fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }} className="dr-num">$1,000</span>
            </div>
          );
        })}
      </div>
    );
  }
  function VisTiers({ x = 1 }) {
    const rows = [['Slot 1', 'Under $50', 'F'], ['Slot 2', '$50 to $300', 'NVDA'], ['Slot 3', '$300 and up', 'COST']];
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map(([s, r, k]) => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
            <span style={{ display: 'grid', flex: 1, minWidth: 0 }}><b style={{ fontSize: L(13, x) }}>{s}</b><span className="dr-num" style={{ fontSize: L(12, x), ...grey }}>{r}</span></span>
            <span style={{ display: 'grid', textAlign: 'right' }}><b className="dr-t" style={{ fontSize: L(13, x) }}>{k}</b><span className="dr-num" style={{ fontSize: L(12, x), ...grey, ...money }}>{`${$(STOCKS[k][1])} · 1 share`}</span></span>
          </span>
        ))}
      </div>
    );
  }
  function VisCap({ x = 1 }) {
    const ks = ['F', 'NVDA', 'MSFT', 'COST'];
    const cap = 2500, total = ks.reduce((a, k) => a + STOCKS[k][1], 0);
    const tone = ['var(--c-text-2)', 'var(--c-accent)', 'var(--c-you-text)', 'var(--c-gain)'];
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: L(13, x) }}><b className="dr-num" style={money}>{$(total)}</b><span className="dr-num" style={{ ...grey, ...money }}>Cap $2,500</span></span>
        <span style={{ position: 'relative', height: L(22, x), borderRadius: 6, background: 'var(--c-track)', display: 'flex', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
          {ks.map((k, i) => <span key={k} style={{ width: `${(STOCKS[k][1] / cap) * 100}%`, background: tone[i], borderRight: '2px solid var(--c-surface)' }} />)}
        </span>
        <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
          {ks.map((k, i) => <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: L(12, x) }}><span style={{ width: 10, height: 10, borderRadius: 3, background: tone[i], flex: 'none' }} /><b className="dr-t">{k}</b><span className="dr-num" style={{ ...grey, ...money, marginLeft: 'auto' }}>{$(STOCKS[k][1])}</span></span>)}
        </span>
        <span style={{ fontSize: L(12, x), ...grey }} className="dr-num">{`${$(cap - total)} left under the cap`}</span>
      </div>
    );
  }
  function VisOrder({ x = 1 }) {
    const P = [['MR', 'Marco R.'], ['LC', 'Luca C.'], ['RB', 'You'], ['EM', 'Elena M.']];
    const round = (label, list, dir) => (
      <div style={{ display: 'grid', gap: 6 }}>
        <span className="dr-tag" style={{ fontSize: L(11, x), ...grey }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {list.map(([i, n], k) => (
            <React.Fragment key={i}>
              {k ? <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={dir > 0 ? ICON.right : ICON.left} size={L(14, x)} width={2.4} /></span> : null}
              <span style={{ display: 'grid', justifyItems: 'center', gap: 2 }}><Av init={i} you={i === 'RB'} size={L(26, x)} /><span className="dr-num" style={{ fontSize: L(11, x), fontWeight: 800 }}>{`Pick ${dir > 0 ? k + 1 : 8 - k}`}</span></span>
            </React.Fragment>
          ))}
        </span>
      </div>
    );
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {round('Round 1', P, 1)}
        {round('Round 2', P, -1)}
      </div>
    );
  }
  function VisPlayoffs({ x = 1 }) {
    const box = (a, b, hi) => (
      <span style={{ display: 'grid', fontSize: L(12, x), borderRadius: 8, background: hi ? 'var(--c-accent-tint)' : 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-border)', padding: '4px 8px', minWidth: 0 }}>
        <span style={{ whiteSpace: 'nowrap' }}>{a}</span>{b ? <span style={{ whiteSpace: 'nowrap', ...grey }}>{b}</span> : null}
      </span>
    );
    const col = (label, items) => <div style={{ display: 'grid', gap: 6, alignContent: 'center' }}><span className="dr-tag" style={{ fontSize: L(10, x), ...grey }}>{label}</span>{items}</div>;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, alignItems: 'center' }}>
        {col('Wild card', [<React.Fragment key="1">{box(<b>1 · bye</b>)}{box('4 Elena M.', '5 Sara T.')}{box(<b>2 · bye</b>)}{box('3 Marco R.', '6 Dario N.')}</React.Fragment>])}
        {col('Semifinals', [<React.Fragment key="2">{box('1 You', '4 or 5')}{box('2 Luca C.', '3 or 6')}</React.Fragment>])}
        {col('Final', [<React.Fragment key="3">{box(<b>The two</b>, 'winners', true)}</React.Fragment>])}
      </div>
    );
  }
  function VisDraftable({ x = 1 }) {
    const chip = (t, muted) => <span className={muted ? '' : 'dr-t'} style={{ fontSize: L(12, x), fontWeight: muted ? 600 : 800, padding: '3px 7px', borderRadius: 6, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-border)', whiteSpace: 'nowrap', ...(muted ? grey : null) }}>{t}</span>;
    return (
      <div style={{ borderRadius: 14, border: '2px dashed var(--c-border-strong)', padding: 10, display: 'grid', gap: 8 }}>
        <span className="dr-tag" style={{ fontSize: L(11, x), ...grey }}>On · every US stock</span>
        <div style={{ borderRadius: 10, background: 'var(--c-accent-tint)', padding: 10, display: 'grid', gap: 8 }}>
          <span className="dr-tag" style={{ fontSize: L(11, x), color: 'var(--c-text)' }}>Off · draftable stocks only</span>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chip('AAPL')}{chip('NVDA')}{chip('COST')}{chip('F')}</span>
        </div>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chip('a $0.40 stock', true)}{chip('a $90 million company', true)}</span>
      </div>
    );
  }

  // ── Every popup: title (the option's name), one line (NEW), the visual, its VoiceOver label (NEW). ──
  const POPS = {
    matchup: { title: 'Matchup', line: 'Each week you play one team, and the bigger dollar gain wins. The best records make the playoffs.', Vis: VisMatchup, behind: 'league',
      vo: 'Example: in week 3 you gain $24.10 and Marco R. loses $8.30, so you win the week. After the regular season, the top 4 play off.' },
    duration: { title: 'Duration', line: 'One race for the whole league. The biggest gain at the end wins.', Vis: VisDuration, behind: 'league',
      vo: 'Example: four teams race from start to end. Marco R. finishes first, up $182.40.' },
    equal: { title: 'Equal stakes', line: 'Every pick is the same dollar amount, so a cheap stock counts as much as an expensive one.', Vis: VisEqual, behind: 'stakes',
      vo: 'Example: $1,000 buys 89.29 shares of F, 5.36 of NVDA, or 1.09 of COST.' },
    tiers: { title: 'Price tiers', line: 'One share per pick. Each slot takes stocks in its own price range.', Vis: VisTiers, behind: 'stakes',
      vo: 'Example: slot 1 takes stocks under $50, like F. Slot 2, $50 to $300, like NVDA. Slot 3, $300 and up, like COST.' },
    cap: { title: 'Budget cap', line: 'One share per pick. Your shares together can’t cost more than the cap.', Vis: VisCap, behind: 'stakes',
      vo: 'Example: one share each of F, NVDA, MSFT and COST costs $1,628.10, under a $2,500 cap.' },
    order: { title: 'Draft order', line: 'Random shuffles it an hour before the draft; Manual lets you set it. Either way, it reverses each round.', Vis: VisOrder, behind: 'draft',
      vo: 'Example: in round 1 Marco R. picks first and Elena M. fourth. In round 2 it runs back: Elena M. picks fifth and Marco R. eighth.' },
    playoffs: { title: 'Playoff teams', line: 'The top teams in the standings play a bracket. When it doesn’t fill evenly, the top seeds skip the first round.', Vis: VisPlayoffs, behind: 'season',
      vo: 'Example with 6 teams: seeds 1 and 2 skip the wild card round, 3 plays 6 and 4 plays 5, then the semifinals and the final.' },
    draftable: { title: 'Non-draftable stocks', line: 'Off: stocks at $1 or more, on a major US exchange, from companies worth $250 million or more. On: every US stock, penny stocks too.', Vis: VisDraftable, behind: 'stakes',
      vo: 'Off, only draftable stocks like AAPL, NVDA, COST and F. On, every US stock, including a $0.40 stock or a $90 million company.' },
  };
  // Question frames only (not approved words): Rounds' line is NEW; the two Duration entries reuse the approved line.
  POPS.rounds = { title: 'Rounds', line: 'How many stocks each team drafts: one per round.', Vis: VisRounds, behind: 'draftR',
    vo: 'Example: after 6 rounds, your team has 6 stocks, one from each round.' };
  POPS.durUsd = { ...POPS.duration, Vis: (p) => <VisFinal {...p} by="usd" /> };
  POPS.durPct = { ...POPS.duration, Vis: (p) => <VisFinal {...p} by="pct" /> };
  // Question 4 frames only: the generic-copy versions are NEW and not approved.
  POPS.mGeneric = { ...POPS.matchup, line: 'Each week you play one team, and the best performance wins. The best records make the playoffs.' };
  POPS.dDollar = { ...POPS.duration, line: 'One race for the whole league. The biggest dollar gain at the end wins.' };
  POPS.dGeneric = { ...POPS.duration, line: 'One race for the whole league. The best performance at the end wins.' };
  const APPROVED = ['matchup', 'duration', 'equal', 'tiers', 'cap', 'order', 'playoffs', 'draftable'];
  const BEHIND = { league: LeagueStep, stakes: StakesStep, draft: DraftStep, season: SeasonStep, draftR: () => <DraftStep roundsI /> };

  /** The × : a 44pt target, a 16pt glyph on a sunken disc, top right of the card. */
  const Close = ({ x = 1, float }) => (
    <span aria-label="Close" style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', flex: 'none', marginTop: -8, marginRight: -10, ...(float ? { position: 'absolute', top: 10, right: 12, marginTop: 0, marginRight: 0, zIndex: 2 } : null) }}>
      <span style={{ width: z(28, x, ROW), height: z(28, x, ROW), borderRadius: 999, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', boxShadow: float ? '0 1px 6px rgba(0,0,0,.18)' : 'none' }}><Icon d={ICON.close} size={z(14, x, ROW)} width={2.6} /></span>
    </span>
  );
  /**
   * The popup. form 'A': the line and the visual together (not picked; kept as the record of the call).
   * form 'B' (Giorgio's pick, 2026-11-11): page 1 = the name and the line; page 2 = the name and the picture.
   * nav 'dots' (his pick, same day): no button, a swipe or the dots turn the page. At Large the card's top edge is fixed (TOP), so the name and the × never move when the
   * page turns; the card hugs each page and grows or shrinks below them. x > 1: AX5. The card fills the
   * screen between the status bar and the home indicator and scrolls inside; the × floats, pinned top right.
   * scrolled: drawn scrolled to the end.
   */
  const TOP = 150; // the card's fixed top edge at Large, in points
  function Popup({ k, x = 1, form = 'B', page = 1, scrolled = false, nav = 'dots' }) {
    const p = POPS[k];
    const ax = x > 1;
    const head = (
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, fontSize: z(20, x, TITLE), lineHeight: 1.2, fontWeight: 800 }}>{p.title}</span>
        {ax ? <span style={{ width: 34, flex: 'none' }} /> : <Close x={x} />}
      </span>
    );
    const line = <span style={{ fontSize: z(15, x, WORDS), lineHeight: 1.35 }}>{p.line}</span>;
    const cardRef = React.useRef(null), bodyRef = React.useRef(null);
    const [shift, setShift] = React.useState(0);
    const [over, setOver] = React.useState(false);
    React.useLayoutEffect(() => {
      if (!ax || !cardRef.current || !bodyRef.current) return;
      const room = cardRef.current.clientHeight, need = bodyRef.current.scrollHeight;
      setOver(need > room);
      if (scrolled) setShift(Math.max(0, need - room));
    }, [scrolled, ax, page]);
    const vis = <div style={{ borderRadius: 14, background: 'var(--c-inset)', padding: 14 }}><p.Vis x={x} /></div>;
    const btn = (label) => <span className="dr-btn dr-btn--line" style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', fontSize: z(15, x, ROW) }}>{label}</span>;
    // nav (Giorgio's question, 2026-11-11): 'button' = the full-width button, as drawn first; 'dots' = no
    // button, swipe or tap the dots (the dots row is the 44pt page control); 'link' = a small text link on
    // the dots' row.
    const big = nav === 'dots';
    const dot = (d) => <span key={d} style={{ width: big ? 8 : 7, height: big ? 8 : 7, borderRadius: 9, background: d === page ? 'var(--c-text)' : 'var(--c-border-strong)' }} />;
    const dotRow = <span style={{ display: 'flex', gap: big ? 8 : 6 }}>{[1, 2].map(dot)}</span>;
    const dots = nav === 'dots'
      ? <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 44, marginBottom: -10 }}>{dotRow}</span>
      : <span aria-hidden="true" style={{ display: 'flex', justifyContent: 'center' }}>{dotRow}</span>;
    const link = (label) => (
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: -10 }}>
        <span style={{ fontSize: z(15, x, ROW), fontWeight: 700, color: 'var(--c-accent)' }}>{label}</span>
        <span aria-hidden="true">{dotRow}</span>
      </span>
    );
    const col = { display: 'flex', flexDirection: 'column', gap: 14 };
    const foot1 = nav === 'button' ? <>{btn('See an example')}{dots}</> : nav === 'link' ? link('See an example ›') : dots;
    const foot2 = nav === 'button' ? <>{btn('Back')}{dots}</> : nav === 'link' ? link('‹ Back') : dots;
    const p1 = <div style={col}>{head}{line}{foot1}</div>;
    const p2 = <div style={col}>{head}{vis}{foot2}</div>;
    const body = form === 'A' ? <>{head}{line}{vis}</> : <>{page === 1 ? p1 : p2}</>;
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--c-scrim, rgba(0,0,0,.4))' }} />
        <div ref={cardRef} role="dialog" aria-label={p.title} className="dr-a-card" style={{
          position: 'absolute', left: 16, right: 16, ...(ax ? { top: 58, bottom: 30 } : { top: TOP }),
          borderRadius: 22, boxShadow: '0 12px 40px rgba(0,0,0,.28)', overflow: 'hidden',
        }}>
          {ax ? <Close x={x} float /> : null}
          <div ref={bodyRef} style={{ padding: 20, display: 'grid', gap: 14, ...(ax && scrolled ? { transform: `translateY(-${shift}px)` } : null) }}>{body}</div>
          {ax && over ? <span style={{ position: 'absolute', right: 4, top: scrolled ? '62%' : 64, width: 4, height: 90, borderRadius: 4, background: 'var(--c-border-strong)' }} /> : null}
        </div>
      </>
    );
  }
  function PopFrame({ t, k, x = 1, form, page, scrolled, nav }) {
    const B = BEHIND[POPS[k].behind];
    return (
      <Th t={t}>
        <Device noTabs label={`${POPS[k].title}: the i's popup, ${x > 1 ? 'AX5' : 'Large'}, ${t}`} overlay={<Popup k={k} x={x} form={form} page={page} scrolled={scrolled} nav={nav} />}>
          <B x={x > 1 ? 2.4 : 1} />
        </Device>
      </Th>
    );
  }
  function StepFrame({ t, B, x = 1, label, pressed }) {
    return <Th t={t}><Device noTabs label={label}><B x={x} pressed={pressed} /></Device></Th>;
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;

  const GETS = [
    ['League type: Matchup, Duration', 'Create league › League', 'Your example. Ours, key, and the names alone don\'t say how you win.'],
    ['Stakes: Equal stakes, Price tiers, Budget cap', 'Create league › Stakes; League settings', 'Ours and not obvious: they change what a pick costs and how many shares you get.'],
    ['Draft order (one i for Random and Manual)', 'Create league › Draft; League settings; Season 2 review', 'Who sets it and when is ours; the i also shows that the order reverses each round (the "snake" line we cut).'],
    ['Playoff teams', 'Create league › Season (Matchup only); League settings', 'Byes to the top seeds are ours, and the number alone doesn\'t show them.'],
    ['Allow non-draftable stocks', 'Create league › Stakes; League settings', '"Draftable" is our filter ($1, $250 million, a major exchange); the label can\'t say it.'],
  ];
  const NOT = [
    ['Duration lengths (1 Week … 1 Year)', 'The names say it.'],
    ['Pick clock (30 to 90 seconds), Managers, Regular season weeks', 'A number with its unit on the heading\'s line.'],
    ['Stake per slot, the budget cap presets, a slot\'s price range', 'Dollar amounts.'],
    ['A slot\'s category (Tech, Energy, …)', 'Plain names; the list shows them.'],
    ['Draft time, Appearance, Season 2\'s "I\'m in" / "I\'m out"', 'Obvious.'],
    ['Rounds', 'A close call, yours: it is how many stocks each team drafts. I left it out because the draft room shows "Round 2 of 6"; say if you want one.'],
    ['Any limit (a stepper\'s max, the hour\'s notice, "Up to 5")', 'Never an i. A limit shows as the reason beside a control that can\'t act, or as the refusal in place, as the sweep and your Season pick (B) have it.'],
    ['Read-only summaries (Join\'s preview, League settings\' "Type: Matchup")', 'Not a choice, so no i for now.'],
  ];

  function Section() {
    const keys = APPROVED; // the eight approved popups only; the question-only entries (rounds, durUsd, …) stay out
    return (
      <section className="b-sec" id="rule12-info" aria-labelledby="rule12-info-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Rule 12</span>
          <div>
            <h2 id="rule12-info-h">The i, for a choice we defined: two pages (B, your pick)</h2>
            <p className="b-job">Your tweak to the sweep: "a little information i on the end of each bar with a pop up explaining … one explaining it with a concise word explanation and another with a visual … a small x in the corner". Below: the rows with the i, the popup two ways, every popup's words and picture, and the popup at your text size.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>The i</b> sits at the end of the row, in grey, with a 44pt target. Tapping it opens the popup and never selects the row; tapping the name still selects. VoiceOver reads it as "About Matchup", button. Nothing shows under the row.</li>
          <li><b>The popup</b> is a card over a dimmed screen: the option's name, one short line (approved), and a small picture. A small × in the top-right corner closes it (44pt target, "Close" to VoiceOver); so does a tap on the dimmed screen. The picture has a spoken description <NEW /> (the "VoiceOver:" lines below), so it isn't silent.</li>
          <li><b>Two pages (B), your pick (2026-11-11):</b> "i like version B with the see an example and the second potential slide". Page 1 is the name and the line. Page 2 is the name and the picture. <b>No button: "just the dots"</b> (your pick, same day). A swipe turns the page; the two dots show which page you're on and are the page control themselves (a 44pt row: tap to turn; VoiceOver: "Page 1 of 2", swipe up or down to turn). The card's top edge stays put on both pages, so the name and the × never move when the page turns; the card grows or shrinks below them. The × closes from either page. The popup always opens on page 1.</li>
          <li><b>At your size (AX5)</b> the card fills the screen and each page scrolls inside, and the × stays pinned in its corner while the page scrolls under it. The line grows the whole way, since it's the part you read. The title stops at 1.6× and the picture's labels at 1.4×, so the picture keeps its shape. The build gate checks the real thing.</li>
          <li><b>Pictures use example numbers</b> (prices, gains, names from the board's fixture league). They show how a mode works, not anyone's real results; the words never quote a number that could go stale, except the draftable filter's own $1 and $250 million.</li>
        </ul>

        <h3 className="b-sub">The rows, with the i</h3>
        <Grid>{[
          fig('lg-l', 'Create league › League · Large · Light', <StepFrame t="light" B={LeagueStep} label="League step with the i" />, 'Your example: each league type ends in an i. "Don\'t worry. You will be able to change this later." is still yours to rule on (sweep, "Yours to rule on"), so it is left out here.'),
          fig('lg-d', 'Create league › League · Large · Dark', <StepFrame t="dark" B={LeagueStep} label="League step with the i, dark" />),
          fig('lg-x', 'Create league › League · your size (AX5) · Light', <StepFrame t="light" B={LeagueStep} x={2.4} label="League step with the i, AX5" />, 'The names stop at 1.3×; the i keeps its 44pt target at the end of the row.'),
          fig('st-l', 'Create league › Stakes · Large · Light', <StepFrame t="light" B={StakesStep} label="Stakes step with the i" />, 'The three stake modes and the non-draftable switch.'),
          fig('dr-l', 'Create league › Draft · Large · Light', <StepFrame t="light" B={DraftStep} label="Draft step with the i" />, 'One i for the Draft order control (it covers Random and Manual). Pick clock and Rounds get none.'),
          fig('se-l', 'Create league › Season · Large · Light', <StepFrame t="light" B={SeasonStep} label="Season step with the i" />, 'Only the i is new here. The rest of your Season pick (B) is on its own board and not redrawn.'),
        ]}</Grid>

        <h3 className="b-sub">The popup: two pages (B, your pick)</h3>
        <Grid>{[
          fig('fb1', 'Page 1 · Matchup · Large · Light', <PopFrame t="light" k="matchup" page={1} />, 'The name and the line. Swipe or tap the dots for the picture. The × in the corner.'),
          fig('fb2', 'Page 2 · Matchup · Large · Light', <PopFrame t="light" k="matchup" page={2} />, 'The picture. Swipe back or tap the dots. The top edge, the name and the × are where page 1 had them; the card grows downward.'),
          fig('fa', 'Not picked · A · Matchup · Large · Light', <PopFrame t="light" k="matchup" form="A" />, 'Words and picture on one page. Kept as the record of the call.'),
        ]}</Grid>

        <h3 className="b-sub">Every popup, both pages, Light</h3>
        <Grid>{keys.flatMap((k) => [
          fig(`p-${k}-l1`, `${POPS[k].title} · page 1 · Large · Light`, <PopFrame t="light" k={k} page={1} />),
          fig(`p-${k}-l2`, `${POPS[k].title} · page 2 · Large · Light`, <PopFrame t="light" k={k} page={2} />, `VoiceOver: "${POPS[k].vo}"${k === 'duration' ? ' Check: no rule says whether a Duration league ranks by dollars or percent; the picture shows dollars, as Matchup does, and the line says only "gain".' : ''}`),
        ])}</Grid>
        <h3 className="b-sub">Every popup, both pages, Dark</h3>
        <Grid>{keys.flatMap((k) => [
          fig(`p-${k}-d1`, `${POPS[k].title} · page 1 · Large · Dark`, <PopFrame t="dark" k={k} page={1} />),
          fig(`p-${k}-d2`, `${POPS[k].title} · page 2 · Large · Dark`, <PopFrame t="dark" k={k} page={2} />),
        ])}</Grid>

        <h3 className="b-sub">At your size (AX5): each page scrolls inside, the × stays put</h3>
        <Grid>{[
          fig('x1', 'Matchup · page 1 · AX5 · Light', <PopFrame t="light" k="matchup" x={3.1} page={1} />, 'The card fills the screen; the line grows the whole way.'),
          fig('x2', 'Matchup · page 2 · AX5 · Dark · top', <PopFrame t="dark" k="matchup" x={3.1} page={2} />, 'The picture\'s labels stop at 1.4×, so it keeps its shape.'),
          fig('x3', 'Non-draftable stocks · page 1 · AX5 · Light · top', <PopFrame t="light" k="draftable" x={3.1} page={1} />, 'The longest line. It runs past the card, so the page scrolls; the bar on the right says so.'),
          fig('x4', 'Non-draftable stocks · page 1 · AX5 · Light · scrolled to the end', <PopFrame t="light" k="draftable" x={3.1} page={1} scrolled />, 'Scrolled to the dots: the × is still in its corner.'),
          fig('x5', 'Playoff teams · page 2 · AX5 · Dark', <PopFrame t="dark" k="playoffs" x={3.1} page={2} />, 'The tallest picture still fits without scrolling, because its labels stop at 1.4×.'),
        ]}</Grid>

        <h3 className="b-sub">Decided: just the dots, no button (your pick, 2026-11-11)</h3>
        <ul className="b-inv__notes">
          <li><b>Your words (2026-11-11):</b> "is it better to have this button or simply have the two dots at the bottom and have it be swipable where the user dictates where they go. not sure if im a fan of the big button".</li>
          <li><b>Your pick: "just the dots".</b> The words and the picture are what the popup is for, and a full-width button outweighs both (rule 6, one thing stands out). Two dots under a card is the iOS page control people already swipe (rule 1, familiar first: the App Store's Today cards, onboarding pages). The dots row is the 44pt tap target, so tapping it also turns the page (rule 3), and VoiceOver reads it as "Page 1 of 2", where a swipe up or down turns the page. So the picture is never reachable by swipe alone.</li>
          <li><b>The risk, said plainly:</b> with no words on page 1 pointing to page 2, a player who doesn't notice the dots never sees the picture. The small link is the middle ground if you want that said out loud without the big button.</li>
        </ul>
        <Grid>{[
          fig('nv-b1', 'Not picked · the big button · page 1', <PopFrame t="light" k="matchup" page={1} nav="button" />, 'The full-width button.'),
          fig('nv-d1', 'Picked · just the dots · page 1', <PopFrame t="light" k="matchup" page={1} nav="dots" />, 'Swipe, or tap the dots. Nothing else under the words.'),
          fig('nv-l1', 'Not picked · a small link · page 1', <PopFrame t="light" k="matchup" page={1} nav="link" />, '"See an example ›" in text, on the dots\' row.'),
          fig('nv-b2', 'Not picked · the big button · page 2', <PopFrame t="light" k="matchup" page={2} nav="button" />),
          fig('nv-d2', 'Picked · just the dots · page 2', <PopFrame t="light" k="matchup" page={2} nav="dots" />, 'Swipe back, or tap the dots.'),
          fig('nv-l2', 'Not picked · a small link · page 2', <PopFrame t="light" k="matchup" page={2} nav="link" />, '"‹ Back" in text.'),
        ]}</Grid>

        <h3 className="b-sub">Which options get an i</h3>
        <ul className="b-inv__notes">{GETS.map(([a, w, b]) => <li key={a}><b style={{ color: 'var(--c-gain, #2e7d32)' }}>i</b> · <b>{a}</b> ({w}) — {b}</li>)}</ul>
        <h3 className="b-sub">Which don't, and why</h3>
        <ul className="b-inv__notes">{NOT.map(([a, b]) => <li key={a}><b>{a}</b> — {b}</li>)}</ul>
        <h3 className="b-sub">The words, approved as written (your call, 2026-11-11: "the popup lines are approved")</h3>
        <ul className="b-inv__notes">
          {keys.map((k) => <li key={k}><b>{POPS[k].title}:</b> "{POPS[k].line}"</li>)}
          <li><b>Spoken only (VoiceOver):</b> "About {'{option}'}" on each i, "Close" on the ×, and the picture descriptions under each Light page 2 above.</li>
        </ul>
      </section>
    );
  }

  const LeagueKeep = (p) => <LeagueStep {...p} reassure />;
  const Q1 = {
    q: 'Should Rounds get an i?',
    look: 'Create league › Draft. “Rounds” is how many stocks each team drafts. 1A: as drawn, no i. 1B: an i after “Rounds”, and the popup it opens (both pages). Its line is NEW, for you to approve if you pick 1B.',
    answer: 'Decided 2026-11-11: 1A, no i ("1a").',
  };
  const Q2 = {
    q: 'How is a Duration league won: the biggest dollar gain, or the biggest percent gain?',
    look: 'Not a design choice: a game rule nobody had confirmed (DR-001 said dollars; the app has no Duration scoring today). This is the Duration popup’s picture, with the same three players at the end of a Budget cap league, ranked each way. They spent different amounts, so the two rules crown different winners. In an Equal stakes league everyone starts with the same amount, so both rules give the same order. Your approved line (“The biggest gain at the end wins.”) fits either answer.',
    answer: 'Decided 2026-11-11: 2A, dollars ("dollars, confirmed"), as DR-001 had it. The Duration popup keeps the dollars picture.',
  };
  const Q3 = {
    q: 'Keep or cut “Don’t worry. You will be able to change this later.”?',
    look: 'Create league › League, under the League name field. The sweep cut every other line like it; this one was left for you because it reassures rather than explains.',
    answer: 'Decided 2026-11-11: 3B, cut ("3b cut").',
  };
  function Questions() {
    const Q = ({ n, d, children }) => (
      <>
        <h3 className="b-sub">{`Question ${n} of 3: ${d.q}`}</h3>
        <ul className="b-inv__notes"><li><b>What you’re looking at:</b> {d.look}</li><li><b>Answer with:</b> {d.answer}</li></ul>
        <Grid>{children}</Grid>
      </>
    );
    return (
      <section className="b-sec" id="rule12-questions" aria-labelledby="rule12-questions-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Rule 12</span>
          <div><h2 id="rule12-questions-h">Three questions left on the sweep and the i: all decided (1A, 2A, 3B)</h2></div>
        </header>
        <Q n={1} d={Q1}>{[
          fig('q1a', '1A · no i on Rounds (as drawn)', <StepFrame t="light" B={DraftStep} label="Draft step, Rounds without an i" />, 'Draft order keeps its i; Rounds has none.'),
          fig('q1b', '1B · an i on Rounds', <StepFrame t="light" B={BEHIND.draftR} label="Draft step, Rounds with an i" />, 'The i sits after “Rounds”, as on Draft order.'),
          fig('q1b1', '1B · its popup, page 1', <PopFrame t="light" k="rounds" page={1} />, 'NEW line: “How many stocks each team drafts: one per round.”'),
          fig('q1b2', '1B · its popup, page 2', <PopFrame t="light" k="rounds" page={2} />, 'The picture: 6 rounds, 6 stocks on your team.'),
        ]}</Q>
        <Q n={2} d={Q2}>{[
          fig('q2a', '2A · dollars decide', <PopFrame t="light" k="durUsd" page={2} />, 'Marco R. wins with +$186.00, the most dollars, though only +7.5%. Same as Matchup, where dollars decide.'),
          fig('q2b', '2B · percent decides', <PopFrame t="light" k="durPct" page={2} />, 'You win with +11.0%, the best return, though only +$136.40.'),
        ]}</Q>
        <Q n={3} d={Q3}>{[
          fig('q3a', '3A · keep the line', <StepFrame t="light" B={LeagueKeep} label="League step with the line" />, 'The grey line under the name field.'),
          fig('q3b', '3B · cut it', <StepFrame t="light" B={LeagueStep} label="League step without the line" />, 'The name field, then League type.'),
        ]}</Q>
      </section>
    );
  }

  function CopyCall() {
    return (
      <section className="b-sec" id="rule12-copy-call" aria-labelledby="rule12-copy-call-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Rule 12</span>
          <div><h2 id="rule12-copy-call-h">Your call: should the i popups name what decides the winner?</h2></div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Why you're being asked:</b> two of your rules pull opposite ways here. "Generic scoring copy": rules, marketing and onboarding say "best performance wins", never "biggest dollar gain", because capital varies by stake mode. "Dollars decide": the UI shows the metric that decides the winner. The popup lines you approved today name it for Matchup ("the bigger dollar gain wins").</li>
          <li><b>What you're looking at:</b> page 1 of two popups, Matchup on top and Duration below, three ways. Only the line changes.</li>
          <li><b>4A · as you approved them.</b> A popup is a definition, so it says what decides the winner. The generic rule gets a written exception for definitions. Duration stays "the biggest gain" (it doesn't say dollars or percent).</li>
          <li><b>4A+ · the same, and Duration says "dollar" too</b> <NEW />, now that dollars decide Duration as well.</li>
          <li><b>4B · the generic rule wins.</b> Both say "best performance" <NEW />, and neither says what decides.</li>
          <li><b>Recommended: 4A+</b> (the Planner advises A). A definition that won't say what decides the winner doesn't define anything, and the popup is the one place a player asks exactly that. Adding "dollar" to Duration makes the two lines match.</li>
          <li><b>Answer with:</b> 4A, 4A+ or 4B.</li>
        </ul>
        <Grid>{[
          fig('c-a-m', '4A · Matchup (as approved)', <PopFrame t="light" k="matchup" page={1} />),
          fig('c-ap-m', '4A+ · Matchup (as approved)', <PopFrame t="light" k="matchup" page={1} />),
          fig('c-b-m', '4B · Matchup, generic', <PopFrame t="light" k="mGeneric" page={1} />, 'NEW: "the best performance wins".'),
          fig('c-a-d', '4A · Duration (as approved)', <PopFrame t="light" k="duration" page={1} />, '"The biggest gain": names neither dollars nor percent.'),
          fig('c-ap-d', '4A+ · Duration says dollar', <PopFrame t="light" k="dDollar" page={1} />, 'NEW: "The biggest dollar gain at the end wins."'),
          fig('c-b-d', '4B · Duration, generic', <PopFrame t="light" k="dGeneric" page={1} />, 'NEW: "The best performance at the end wins."'),
        ]}</Grid>
      </section>
    );
  }

  window.KSInfoKit = { ChoiceCard, InfoI };
  window.KSRule12Info = () => <><Section /><Questions /><CopyCall /></>;
})();
