// Stockpile key-screens board — the UX rule 12 sweep ("No explainer under a heading"; Giorgio, 2026-11-10,
// said three times in one day; UX_RULES rule 12, merged #365). Every heading on every screen with the lines
// under it, each KEEP (which fact) or CUT (and where its fact went), worst first. Before = as it ships on
// main @ cc2c38e3; after = swept. Removing text needs no copy approval; the few replacement lines are NEW.
// Inventory: two read-only passes over apps/mobile on main (tabs + every other screen), ~120 headings.
// Review notes sit UNDER the phones, never inside them.
(function () {
  const { Device, Icon, ICON } = window.KSKit;
  const { Fit, G, Av } = window.KSGN;

  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const grey = { color: 'var(--c-text-2)' };

  // ── One item of a screen. Each item may carry cut (shown only before) or add (shown only after). ──
  function Item({ it }) {
    const [k, a, b] = it;
    switch (k) {
      case 'step': return <span className="dr-cap dr-num" style={{ fontSize: 12 }}>{a}</span>;
      case 'h1': return <span style={{ fontSize: 30, lineHeight: '35px', fontWeight: 800 }}>{a}</span>;
      case 'sub': return <span className="dr-call" style={{ fontSize: 15, lineHeight: '20px', ...grey }}>{a}</span>;
      case 'tag': return <span className="dr-tag" style={{ fontSize: 11, color: b || 'var(--c-text-2)' }}>{a}</span>;
      case 'tagchip': return <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><span className="dr-tag" style={{ fontSize: 11, color: 'var(--c-live-text)' }}>{a}</span><span className="dr-chip" style={{ fontSize: 11 }}><span className="dr-dot" />{b}</span></span>;
      case 'title': return <span style={{ fontSize: 20, lineHeight: '25px', fontWeight: 800 }}>{a}</span>;
      case 'head': return <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 17, fontWeight: 800 }}>{a}</span>{b ? <span className="dr-cap dr-num">{b}</span> : null}</span>;
      case 'clock': return <span className="dr-num" style={{ fontSize: 40, lineHeight: '44px', fontWeight: 900 }}>{a}</span>;
      case 'line': return <span className="dr-call" style={{ fontSize: 15, lineHeight: '20px', fontWeight: 700 }}>{a}</span>;
      case 'you': return <span className="dr-call" style={{ fontSize: 15, lineHeight: '20px', fontWeight: 700, color: 'var(--c-you-text)' }}>{a}</span>;
      case 'grey': return <span className="dr-cap" style={{ fontSize: 13, lineHeight: '18px', ...grey }}>{a}</span>;
      case 'warn': return <span style={{ fontSize: 13, lineHeight: '18px', padding: '10px 12px', borderRadius: 10, background: 'var(--c-warn-tint, var(--c-sunken))', color: 'var(--c-text)' }}>{a}</span>;
      case 'btn': return <span className="dr-btn" style={{ width: '100%', minHeight: 50, boxSizing: 'border-box', fontSize: 16 }}>{a}</span>;
      case 'btnoff': return <span className="dr-btn" style={{ width: '100%', minHeight: 50, boxSizing: 'border-box', fontSize: 16, opacity: 0.4 }}>{a}</span>;
      case 'btnline': return <span className="dr-btn dr-btn--line" style={{ width: '100%', minHeight: 50, boxSizing: 'border-box', fontSize: 16 }}>{a}</span>;
      case 'link': return <span style={{ textAlign: 'center', color: 'var(--c-accent)', fontWeight: 700, fontSize: 15, minHeight: 36, display: 'grid', placeItems: 'center' }}>{a}</span>;
      case 'seg': return <div style={{ display: 'flex', borderRadius: 10, padding: 3, background: 'var(--c-inset)', gap: 3 }}>{a.map((o) => <span key={o} style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8, fontSize: 14, fontWeight: o === b ? 800 : 600, background: o === b ? 'var(--c-surface)' : 'transparent' }}>{o}</span>)}</div>;
      case 'row': return <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 28 }}><span style={{ fontSize: 15, fontWeight: 700 }}>{a}</span>{b != null ? <span style={{ fontSize: 15, fontWeight: 600, ...grey, display: 'flex', alignItems: 'center', gap: 4 }}>{b}<Icon d={ICON.right} size={14} width={2.4} /></span> : null}</span>;
      case 'stepper': return (
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{a}</span>
          <span style={{ display: 'inline-flex', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden', flex: 'none' }}>
            <span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}><Icon d="M5 12h14" size={16} width={2.4} /></span>
            <b className="dr-num" style={{ minWidth: 64, display: 'grid', placeItems: 'center', fontSize: 16, borderInline: '1px solid var(--c-border)', padding: '0 6px' }}>{b}</b>
            <span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}><Icon d={ICON.plus} size={16} width={2.4} /></span>
          </span>
        </span>
      );
      case 'label': return <span style={{ fontSize: 15, fontWeight: 700 }}>{a}</span>;
      case 'field': return <span style={{ minHeight: 46, borderRadius: 10, background: 'var(--c-inset)', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 15, color: b ? 'var(--c-text)' : 'var(--c-text-2)' }}>{b || a}</span>;
      case 'option': return (
        <span style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 12, boxShadow: it[3] ? 'inset 0 0 0 2px var(--c-accent)' : 'inset 0 0 0 1px var(--c-border)', background: 'var(--c-surface)' }}>
          <span style={{ width: 20, height: 20, borderRadius: 999, flex: 'none', marginTop: 1, boxShadow: it[3] ? 'inset 0 0 0 6px var(--c-accent)' : 'inset 0 0 0 2px var(--c-border-strong)' }} />
          <span style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 16, fontWeight: 800 }}>{a}</span>{b && b !== true ? <span className="dr-cap" style={{ fontSize: 13, lineHeight: '18px', ...grey }}>{b}</span> : null}</span>
        </span>
      );
      case 'switch': return <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{a}</span>{b && window.KSInfoKit ? <window.KSInfoKit.InfoI /> : null}<span style={{ width: 50, height: 30, borderRadius: 999, background: 'var(--c-track)', flex: 'none', position: 'relative' }}><span style={{ position: 'absolute', left: 2, top: 2, width: 26, height: 26, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} /></span></span>;
      case 'code': return <span style={{ display: 'grid', gap: 2 }}><span className="dr-cap" style={{ fontSize: 12 }}>Invite code</span><span className="dr-num" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.08em' }}>{a}</span></span>;
      case 'bar': return <span style={{ height: 8, borderRadius: 4, background: 'var(--c-track)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${a * 100}%`, background: 'var(--c-accent)' }} /></span>;
      case 'avatars': return <span style={{ display: 'flex', gap: 6 }}>{a.map((i) => <Av key={i} init={i} you={i === 'RB'} size={32} />)}</span>;
      case 'stocks': return <span style={{ display: 'grid' }}>{a.map(([tk, co, p]) => <span key={tk} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 50 }}><span style={{ flex: 1, display: 'grid' }}><span className="dr-t" style={{ fontSize: 15 }}>{tk}</span><span className="dr-cap" style={{ fontSize: 12 }}>{co}</span></span>{p ? <span className="dr-num dr-muted" style={{ fontSize: 14 }}>{p}</span> : null}<span className="dr-muted" style={{ width: 28, textAlign: 'center' }}>≡</span></span>)}</span>;
      case 'people': return <span style={{ display: 'grid' }}>{a.map(([i, n, r]) => <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}><span className="dr-num dr-muted" style={{ width: 16, fontSize: 13 }}>{r}</span><Av init={i} you={i === 'RB'} size={28} /><span style={{ fontSize: 15, fontWeight: i === 'RB' ? 800 : 600, flex: 1 }}>{n}</span></span>)}</span>;
      case 'check': return <span style={{ display: 'grid', gap: 4 }}>{a.map((c) => <span key={c} className="dr-cap" style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><Icon d={ICON.circle || ICON.check} size={14} width={2} />{c}</span>)}</span>;
      case 'wheel': return <span style={{ height: 120, borderRadius: 12, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700 }}><span style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--c-surface)' }}>{a}</span></span>;
      case 'standing': return <span style={{ display: 'grid' }}>{a.map(([n, nm, wl, g], i) => <span key={nm} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, fontSize: 14 }}><span className="dr-num" style={{ width: 14, fontWeight: 800 }}>{i + 1}</span><Av init={n} you={n === 'RB'} size={24} /><span style={{ flex: 1, fontWeight: n === 'RB' ? 800 : 600 }}>{nm}</span><span className="dr-num" style={{ width: 40 }}>{wl}</span><span className="dr-num" style={{ width: 56, textAlign: 'right', color: 'var(--c-gain, var(--c-text))' }}>{g}</span></span>)}</span>;
      case 'choices': return window.KSInfoKit ? <window.KSInfoKit.ChoiceCard opts={a} info={!!b} /> : null;
      case 'gap': return <span style={{ height: a || 4 }} />;
      case 'rule': return <span style={{ height: 1, background: 'var(--c-border)', marginInline: -16 }} />;
      default: return null;
    }
  }
  const show = (it, after) => !(after ? it.cut : it.add);
  function Items({ items, after }) {
    return items.filter((it) => show(it, after)).map((it, i) => <Item key={i} it={it} />);
  }
  /** A screen: head ('pill' | 'back' | 'sheet' | 'none'), then blocks; a block is { card: [...] } or { bare: [...] }. */
  function Screen({ t, s, after }) {
    return (
      <Th t={t}>
        <Device tab={s.tab} noTabs={!s.tab} label={`${s.name}, ${after ? 'after the sweep' : 'as it ships'}, Large, ${t}`}>
          {s.head === 'pill' ? (
            <div className="ks-head" style={{ paddingInline: G }}>
              <span className="ks-pill"><span>{s.league || 'Serie A Traders'}</span><Icon d={ICON.chevron} size={14} width={2.6} /></span>
              <Av init="RB" you size={34} />
            </div>
          ) : s.head === 'back' ? (
            <div style={{ padding: `8px ${G}px 0`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--c-accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, fontSize: 15 }}><Icon d={ICON.left} size={18} width={2.4} />{s.back || 'Back'}</span>
              {s.right ? <span className="dr-cap dr-num" style={{ fontSize: 12 }}>{s.right}</span> : null}
            </div>
          ) : s.head === 'sheet' ? (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)' }} />
          ) : null}
          {s.head === 'sheet' ? (
            <div className="dr-a-card" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '22px 22px 0 0', padding: `18px ${G}px 34px`, display: 'grid', gap: 12 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 20, fontWeight: 800 }}>{s.sheet}</span><Icon d={ICON.close} size={20} width={2.4} /></span>
              {s.blocks.map((b, i) => <Items key={i} items={b.bare || b.card} after={after} />)}
            </div>
          ) : (
            <div style={{ padding: `${s.head === 'none' ? 24 : 12}px ${G}px 24px`, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
              {s.blocks.filter((b) => !(after ? b.cut : b.add)).map((b, i) => (b.card
                ? <div key={i} className="dr-a-card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, ...(b.live ? { background: 'var(--c-accent-tint)', boxShadow: 'inset 0 0 0 2px var(--c-live)' } : null) }}><Items items={b.card} after={after} /></div>
                : <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}><Items items={b.bare} after={after} /></div>))}
            </div>
          )}
        </Device>
      </Th>
    );
  }
  const C = (...x) => Object.assign(x, { cut: true });
  const A = (...x) => Object.assign(x, { add: true });

  // ── The screens, worst first. lines: [the line, KEEP/CUT, the fact / where it went]. ──
  const LIVE = 'var(--c-live-text)';
  const SWEEP = [
    {
      id: 'postponed', n: 1, name: 'League tab, the postponed draft (commissioner)', why: 'Your report: the label, the heading, the text under it, a note under the button, and "Fix these" with nothing left to fix.',
      s: { head: 'pill', tab: 'league', blocks: [{ card: [
        C('tag', 'Postponed', LIVE), ['title', 'The draft is postponed'],
        C('grey', `The league wasn't ready at 6:00 PM ET. Fix these, then pick a new draft time.`),
        ['gap', 2], ['label', 'Fewer than 4 teams have joined'], ['code', 'K7Q2MX'], ['btnline', 'Share invite code'], C('rule'),
        C('btnoff', 'Pick a new draft time'), C('grey', `Fix these first. The new time needs at least an hour's notice.`),
      ] }] },
      after2: { label: 'Nothing left to fix', s: { head: 'pill', tab: 'league', blocks: [{ card: [['title', 'The draft is postponed'], ['btn', 'Pick a new draft time']] }] } },
      lines: [
        ['"POSTPONED"', 'CUT', 'Said the heading twice.'],
        [`"The league wasn't ready at 6:00 PM ET. Fix these, then pick a new draft time."`, 'CUT', 'The fix cards and the button say it; 6:00 PM is past and needs nothing from you. This is also where "Fix these" sat when nothing was left: gone with it.'],
        ['The fix card ("Fewer than 4 teams have joined", the code)', 'KEEP', 'What is blocking you, and the way out.'],
        ['"Pick a new draft time" while something is left to fix', 'MOVED', 'Shown only once nothing is left to fix (second frame), so the card never holds a button that does nothing.'],
        [`"Fix these first. The new time needs at least an hour's notice."`, 'CUT', 'The first half goes with the disabled button. The hour\'s notice is a rule the time wheel enforces (it cannot show an earlier time); if the server refuses, "Pick a time at least an hour from now." shows in place.'],
      ],
    },
    {
      id: 'queue', n: 2, name: 'League tab, your queue before the draft', why: 'Your report: "Your queue · 4 of 50" with three lines under it.',
      s: { head: 'pill', tab: 'league', blocks: [{ card: [
        ['tag', 'Your queue · 4 of 50'],
        C('grey', `If you step away, we'll auto-pick from your queue when your time runs out. You can come back any time.`),
        ['grey', `Prices at Wednesday's close.`],
        ['stocks', [['AAPL', 'Apple', '$198.60'], ['NFLX', 'Netflix', '$702.10'], ['CRM', 'Salesforce', '$312.40'], ['ADBE', 'Adobe', '$512.90']]],
        ['field', 'Add a stock'],
        ['btnline', 'Save queue'], ['grey', 'Not saved yet.'],
      ] }] },
      lines: [
        ['"Your queue · 4 of 50"', 'KEEP', 'The count, on the heading\'s line.'],
        [`"If you step away, we'll auto-pick…"`, 'CUT', 'Said once in the draft room\'s first-time tip (on main), and by the empty queue\'s one line (NEW, on the draft room board): "Out of time? We pick from the top of this list."'],
        [`"Prices at Wednesday's close."`, 'KEEP', 'A fact needed now and nowhere else on the card: the prices in the rows are not live. Shown only while the market is closed; now the only line.'],
        ['"Save queue" + "Not saved yet."', 'KEEP', 'Was CUT here, on a wrong premise: your decision 19 takes a drafted stock out of every queue on its own, but your own changes still save only when you press "Save queue", in the lobby and the room (QueueEditor, one save path). You then picked B, saves as you go (2026-11-11, "Your queue: a Save button, or saves as you go"): both lines go with that build, not with the sweep.'],
      ],
    },
    {
      id: 'create-draft', n: 3, name: 'Create league, step 3, Draft', why: 'Your report: the pick clock\'s "Time each manager has to make a pick…" and Rounds\' "One per roster slot".',
      s: { head: 'back', right: 'Step 3 of 4', blocks: [
        { bare: [['h1', 'Draft'], C('sub', 'A live snake draft. Everyone picks in turn, and the order reverses each round.')] },
        { card: [['head', 'Pick clock', '60 seconds'], ['seg', ['30', '45', '60', '75', '90'], '60'], C('grey', 'Time each manager has to make a pick. 60 seconds is the default.')] },
        { card: [['row', 'Draft time', 'TBD'], C('grey', 'Set a draft time before the draft can start. You can do it later in League settings.'), ['rule'], ['label', 'Draft order'], ['seg', ['Random', 'Manual'], 'Random'], C('grey', 'Random: revealed 1 hour before the draft.'), ['rule'], ['stepper', 'Rounds', '6'], C('grey', 'One per roster slot'),
          C('rule'), C('label', 'If time runs out'), C('grey', `We pick for you: the first stock still available in your queue, otherwise the biggest company that fits the league's rules. Never a random pick, never a skip.`)] },
        { bare: [['btn', 'Next']] },
      ] },
      lines: [
        ['"A live snake draft. Everyone picks in turn…"', 'CUT', 'The board in the room shows the snake.'],
        ['"Time each manager has to make a pick. 60 seconds is the default."', 'CUT', '"Pick clock · 60 seconds" says it; the control shows the choice.'],
        ['"Set a draft time before the draft can start…"', 'CUT', 'TBD says it isn\'t set; Home\'s card says "No draft time yet" with the button to set it.'],
        ['"Random: revealed 1 hour before the draft." (and Manual\'s line)', 'CUT', 'The reveal is the room\'s; Manual\'s cutoff appears as the refusal if you try after it.'],
        ['"One per roster slot"', 'CUT', 'A rule the slots enforce: a mismatch is refused in place on the Stakes step ("Your slots hold 5 stocks, but each team drafts 6…").'],
        ['"If time runs out" + its paragraph', 'CUT', 'A heading with no control at all. The room\'s first-time tip says it, once, where it matters.'],
      ],
    },
    {
      id: 'create-stakes', n: 4, name: 'Create league, step 4, Stakes', why: 'Your report: the Stakes options\' paragraphs.',
      s: { head: 'back', right: 'Step 4 of 4', blocks: [
        { bare: [['h1', 'Stakes'], C('sub', 'How do teams stake their picks?'),
          ['option', 'Equal stakes', 'Every roster slot represents the same simulated dollar stake (fractional shares). Pick any stock without price strategy.', true],
          ['option', 'Price tiers', 'One share per slot. Each roster slot takes stocks in a price range you set, so expensive stocks only compete with each other.'],
          ['option', 'Budget cap', `One share per slot. Your roster's share prices must add up to no more than the league cap, so a tight cap makes every pick count.`]] },
        { card: [['label', 'Stake per slot ($)'], ['field', '', '$1,000'], C('grey', 'Each pick simulates this dollar amount (fractional shares).'), ['rule'], ['switch', 'Allow non-draftable stocks (full universe)'], C('grey', 'Off (default): only vetted draftable stocks. On: the entire universe, including penny stocks and micro-caps.')] },
      ] },
      afterS: { head: 'back', right: 'Step 4 of 4', blocks: [
        { bare: [['h1', 'Stakes'], ['choices', [['Equal stakes', true], ['Price tiers', false], ['Budget cap', false]], true]] },
        { card: [['label', 'Stake per slot ($)'], ['field', '', '$1,000'], ['rule'], ['switch', 'Allow non-draftable stocks (full universe)', true]] },
      ] },
      lines: [
        ['"How do teams stake their picks?"', 'CUT', 'Restates the step\'s title.'],
        ['The three options\' paragraphs', 'MOVED', 'Behind an i at the end of each option (your tweak): tap it for one short line and a picture. Nothing under the row. The switch gets an i too. Drawn in "The i" below.'],
        ['"Each pick simulates this dollar amount (fractional shares)."', 'CUT', 'The field\'s label says it.'],
        ['"Off (default): only vetted draftable stocks. On: the entire universe…"', 'MOVED', 'Behind an i on the switch: "draftable" is our filter, and the label can\'t say what it is.'],
        ['Price tiers\' "Required: each slot sets a price range." (and Settings\' "Optional: …")', 'CUT', 'A rule the save enforces: "Price tiers need at least one slot with a price range." shows in place.'],
      ],
    },
    {
      id: 'home-draft', n: 5, name: 'Home before the draft, the Draft card', why: 'Four lines and a caption under one eyebrow.',
      s: { head: 'pill', tab: 'home', blocks: [{ card: [
        ['tag', 'Draft', LIVE], ['clock', '3d 04h 12m'], ['line', 'Sat, Oct 3 · 7:00 PM ET'],
        C('grey', '60-second picks · 6 rounds'), C('grey', 'The draft room opens Sat 6:00 PM ET, when the order is set.'),
        ['btn', 'Build your queue'], C('grey', 'No buying before the draft. Your team is set at the draft.'),
      ] }, { card: [['head', 'Members', '5 of 8 joined'], ['avatars', ['RB', 'GV', 'DN', 'TP', 'EM']]] }] },
      lines: [
        ['"Draft" + the countdown + "Sat, Oct 3 · 7:00 PM ET"', 'KEEP', 'The countdown is the card\'s value; the date is the one line.'],
        ['"60-second picks · 6 rounds"', 'CUT', 'League settings holds it; nothing to do with it before the draft.'],
        ['"The draft room opens Sat 6:00 PM ET, when the order is set."', 'CUT', 'The push says so when it happens, and this card turns into the room\'s card (draft room board).'],
        ['"No buying before the draft. Your team is set at the draft."', 'CUT', 'Portfolio\'s empty state already says "Trading opens after the draft."'],
        ['"Members · 5 of 8 joined"', 'KEEP', 'A count on the heading\'s line.'],
      ],
    },
    {
      id: 'home-draft-other', n: 6, name: 'Home before the draft, no draft time and postponed (member)', why: 'An eyebrow, a title, a line, a second line, a chip that repeats the eyebrow.',
      s: { head: 'pill', tab: 'home', blocks: [
        { card: [['tag', 'Draft', LIVE], ['title', 'No draft time yet'], C('grey', 'Pick a time, and the countdown starts here.'), C('grey', '60-second picks · 6 rounds'), ['btn', 'Set draft time'], ['btnline', 'Build your queue'], C('grey', 'No buying before the draft. Your team is set at the draft.')] },
        { card: [C('tagchip', 'Draft postponed', 'Postponed'), A('tag', 'Draft postponed', LIVE), ['title', 'Giulia V. will pick a new time.'], C('grey', `You'll see it here, with at least an hour's notice.`), ['btnline', 'Build your queue']] },
        { card: [['tag', 'Draft order · waiting'], C('grey', 'Set 1 hour before the draft, once 4 managers have joined.'), ['bar', 0.75], ['grey', '3 of 4 managers']] },
      ] },
      lines: [
        ['"Pick a time, and the countdown starts here."', 'CUT', 'The "Set draft time" button says it.'],
        ['"60-second picks · 6 rounds" and the no-buying caption', 'CUT', 'As on the scheduled card.'],
        ['The "Postponed" chip', 'CUT', 'Repeated "Draft postponed".'],
        [`"You'll see it here, with at least an hour's notice."`, 'CUT', 'How it works; when the time is set, the card shows it.'],
        ['"Set 1 hour before the draft, once 4 managers have joined."', 'CUT', 'The bar and "3 of 4 managers" show what is blocking.'],
        ['A member\'s "Giulia V. will set the draft time."', 'KEEP', 'A name: who you are waiting on.'],
      ],
    },
    {
      id: 'league-lobby', n: 7, name: 'League tab before the draft, countdown and draft order', why: 'Two sentences under the countdown; the order card explains itself before showing the order.',
      s: { head: 'pill', tab: 'league', blocks: [
        { card: [['tag', 'Draft starts in', LIVE], ['clock', '3d 04h 12m'], C('grey', 'The draft starts automatically at Sat, Oct 3 · 7:00 PM ET.'), A('line', 'Sat, Oct 3 · 7:00 PM ET'), C('grey', 'The draft room opens at 6:00 PM ET, when the order is set.')] },
        { card: [['tag', 'Draft order'], C('grey', 'Draft order set Sat 6:00 PM ET, an hour before the draft'), ['you', 'You pick 3rd, then 10th, 15th…'], ['people', [['MR', 'Marco R.', 1], ['LC', 'Luca C.', 2], ['RB', 'Roberto B.', 3], ['EM', 'Elena M.', 4]]]] },
      ] },
      lines: [
        ['"The draft starts automatically at Sat, Oct 3 · 7:00 PM ET."', 'KEEP the time', 'Kept as the value "Sat, Oct 3 · 7:00 PM ET" (words removed, none added), the same line as Home.'],
        ['"The draft room opens at 6:00 PM ET, when the order is set."', 'CUT', 'The push and the card itself change when the room opens.'],
        ['"Draft order set Sat 6:00 PM ET, an hour before the draft"', 'CUT', 'The order is right there; when it was set doesn\'t matter now.'],
        ['"You pick 3rd, then 10th, 15th…"', 'KEEP', 'Your picks: nowhere else on the card (the rows are the managers).'],
      ],
    },
    {
      id: 'at-risk', n: 8, name: 'League tab, the draft can\'t start yet (commissioner)', why: 'The eyebrow already holds the time; the code and the stepper say the rest. The "Fix these before …" line stays: step 25 (b), 2026-11-11, has it name its day.',
      s: { head: 'pill', tab: 'league', blocks: [{ card: [
        C('tag', 'Needs you before 6:00 PM ET', LIVE), A('tag', 'Needs you before 6:00\u00a0PM\u00a0ET on\u00a0Sat,\u00a0Oct\u00a03', LIVE), ['title', `The draft can't start yet`],
        C('grey', `Fix these before 6:00 PM ET, when the draft room opens. If they're still open then, the draft is postponed.`),
        A('grey', `Fix these before 6:00\u00a0PM\u00a0ET on\u00a0Sat,\u00a0Oct\u00a03, when the draft room opens. If they're still open then, the draft is postponed.`),
        ['gap', 2], ['label', `Invite someone to take Giulia V.'s place`], C('grey', 'Share the code. When someone joins, the draft is ready to go.'), ['code', 'K7Q2MX'], ['btnline', 'Share invite code'],
        ['rule'], ['label', '6 playoff teams, but 5 teams are in'], ['stepper', 'Playoff teams', '6'], C('grey', 'Up to 5, one per team.'),
      ] }] },
      lines: [
        ['"Fix these before 6:00 PM ET… the draft is postponed."', 'KEEP', 'Was CUT here; superseded 2026-11-11 by step 25 (b), the later and specific ruling: the line stays, and it and the eyebrow name the day ("before 6:30 PM ET today / tomorrow / on Tue, Nov 17"). PRODUCT_RULES, "A draft deadline always names its day"; plan #355.'],
        ['"Share the code. When someone joins, the draft is ready to go."', 'CUT', 'The code and "Share invite code" say it.'],
        ['"Up to 5, one per team."', 'CUT', 'The stepper stops at 5.'],
        ['"Invite someone to take Giulia V.\'s place"', 'KEEP', 'Your words (approved 2026-11-10).'],
      ],
    },
    {
      id: 'date-sheet', n: 9, name: 'Draft time sheet (Create league, Home, League, Settings)', why: 'A parenthetical that restates the wheel\'s floor, then a sentence on how the draft runs.',
      s: { head: 'sheet', sheet: 'Draft time', blocks: [{ bare: [['wheel', 'Sat, Oct 3   7:00 PM'], ['line', 'Sat, Oct 3 · 7:00 PM ET'], C('grey', '(the earliest you can pick: an hour from now)'), C('grey', 'The draft room opens 1 hour before, and the draft starts automatically.'), ['btn', 'Set draft time']] }] },
      lines: [
        ['"(the earliest you can pick: an hour from now)"', 'CUT', 'The wheel cannot go earlier; a server refusal shows "Pick a time at least an hour from now." in place.'],
        ['"The draft room opens 1 hour before, and the draft starts automatically."', 'CUT', 'How it works; the cards say it when it happens.'],
      ],
    },
    {
      id: 'settings', n: 10, name: 'League settings, Draft and Stakes', why: 'The same lines as Create league, plus a lock line per row under a lock note.',
      s: { head: 'back', back: 'League', blocks: [
        { bare: [['h1', 'League settings']] },
        { card: [['head', 'Pick clock', '60 seconds'], ['seg', ['30', '45', '60', '75', '90'], '60'], C('grey', 'Time each manager has to make a pick. 60 seconds is the default.'), ['rule'], ['row', 'Draft time', 'Sat, Oct 3 · 7:00 PM'], ['rule'], ['stepper', 'Rounds', '6'], C('grey', 'One per roster slot')] },
        { card: [['label', 'Roster slots'], C('grey', 'Optional: a slot can require a category or a price range.'), ['row', 'Slot 1', 'Any'], ['rule'], ['switch', 'Allow non-draftable stocks (full universe)'], C('grey', 'Off (default): only vetted draftable stocks. On: the entire universe, including penny stocks and micro-caps.')] },
        { card: [['head', 'Commissioner', 'You'], ['grey', 'You can hand over the commissioner role before the draft or after the season.']] },
      ] },
      lines: [
        ['Pick clock, Rounds, the switch', 'CUT', 'As on Create league.'],
        ['"Optional: a slot can require a category or a price range."', 'CUT', 'The slot\'s own fields show it.'],
        ['Locked: "60 seconds per pick. The draft has started, so this is set."', 'CUT', 'The screen\'s "Settings are locked once the draft starts." already says it; the row shows "60 seconds".'],
        ['"The draft time can\'t change once the draft room opens."', 'KEEP', 'The reason beside a row that can\'t act (allowed).'],
        ['"You can hand over the commissioner role…"', 'KEEP', 'The reason beside a row that can\'t act; your approved words.'],
        ['Leave row: "You can leave until Sat 6:00 PM ET, when the draft order is set."', 'KEEP the time', '"You can leave until Sat 6:00 PM ET." (words removed, none added).'],
        ['Hand-over sheet: tag "Who takes over as commissioner?"', 'CUT', 'Repeats the sheet\'s title; "The new commissioner takes over right away. You stay in the league." stays (what the confirmation will do).'],
      ],
    },
    {
      id: 'season2', n: 11, name: 'Season 2: the ask (member) and the review (commissioner)', why: 'Every Season 2 card carries a sentence about how renewal works, and a note under its buttons.',
      s: { head: 'pill', tab: 'home', blocks: [
        { card: [['tag', 'Season 2'], ['title', 'Giulia V. is running it back. Are you in?'], C('grey', 'Same league, new season. The draft is set once everyone has replied.'), ['btnline', `I'm out`], ['btn', `I'm in`], C('grey', 'You can change your answer until the draft is set.')] },
        { card: [['tag', 'Season 2 · running back'], ['line', '4 running back · 1 new · 1 out · 1 no reply yet'], ['grey', 'Waiting on Andrea P., Bo.'], C('grey', `You'll set up the draft once everyone has replied.`), ['btnline', `See who's in`]] },
      ] },
      lines: [
        ['"Same league, new season. The draft is set once everyone has replied."', 'CUT', 'The question says it.'],
        ['"You can change your answer until the draft is set."', 'CUT', 'The "Change" button is there once you answer.'],
        ['"Waiting on Andrea P., Bo."', 'KEEP', 'Names: who is blocking.'],
        [`"You'll set up the draft once everyone has replied."`, 'CUT', 'How it works.'],
        ['Run it back: "Everyone from Season 1 gets asked…" and League\'s "Start Season 2 with the same group…"', 'CUT', 'One card on both tabs, "Season 2 / Run it back?" and the button (drawn on the earlier sweep).'],
        ['Review: "Everything carries over from Season 1…", Teams\' "Follows who\'s in, up to 16…", the note under "Schedule the draft"', 'CUT', 'The rows show what carries over; the notification is what the button does.'],
        ['Review: the uneven-byes line, "Pick a future draft time."', 'KEEP', 'A fact needed now; the reason the button can\'t act.'],
      ],
    },
    {
      id: 'join', n: 12, name: 'Join a league: the code, the preview, joined', why: 'A subtitle that repeats the field, a reassurance under the button, a second sentence after the draft time.',
      s: { head: 'back', blocks: [
        { bare: [['h1', 'Join a league'], C('sub', 'Enter the invite code your commissioner sent you.'), ['label', 'Invite code'], ['field', 'K7Q2MX'], ['btn', 'Find league']] },
        { card: [['title', `You're in Serie A Traders`], ['grey', 'The draft is Sat, Oct 3 at 7:00 PM ET.'], C('grey', 'The draft order is set an hour before.')] },
      ] },
      lines: [
        ['"Enter the invite code your commissioner sent you."', 'CUT', 'The field\'s label says it.'],
        ['Preview: "You can leave any time before the draft." under Join', 'CUT', 'Reassurance; League settings\' Leave row says when.'],
        ['Joined: "The draft is Sat, Oct 3 at 7:00 PM ET."', 'KEEP', 'A time.'],
        ['"The draft order is set an hour before." / "You\'ll see it on your Home once they do."', 'CUT', 'How it works.'],
      ],
    },
    {
      id: 'auth', n: 13, name: 'Sign in, create account, new password, get started', why: 'Subtitles that restate the title; a sentence that restates the password checklist under it.',
      s: { head: 'none', blocks: [
        { bare: [['h1', 'Set a new password'], C('sub', 'Use at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.'), ['label', 'New password'], ['field', '••••••••'], ['check', ['At least 8 characters', 'A lowercase letter (a–z)', 'An uppercase letter (A–Z)', 'A number (0–9)', 'A symbol (! ? @ # …)']], ['btn', 'Update password']] },
        { bare: [['h1', 'Get started'], C('sub', 'Start a league for your friends, or join one with a code.')] },
        { card: [['label', 'Create a league'], C('grey', 'Pick the rules, invite friends, set the draft.')] },
        { card: [['label', 'Join with a code'], C('grey', 'Got a code from a friend? Enter it here.')] },
      ] },
      lines: [
        ['"Use at least 8 characters, with…"', 'CUT', 'The checklist under the field says it, and ticks as you type.'],
        ['Get started\'s subtitle and the two cards\' lines', 'CUT', 'The two choices say it.'],
        ['Sign in\'s "Sign in to your league", Create account\'s "Join the competition", Forgot password\'s "Enter your email address and we\'ll send you a link…"', 'CUT', 'Restate the title or the button.'],
        ['Pick a username: "Shown to your league on standings and matchups", "You can change it later in Profile."', 'CUT', 'How it works.'],
        ['Sign in\'s "Your email is confirmed…" / "Your account is deleted."', 'KEEP', 'State notices, once (your rulings).'],
      ],
    },
    {
      id: 'money', n: 14, name: 'Portfolio and the stock sheet', why: 'A caption under a row, a rule sentence after a refusal.',
      s: { head: 'pill', tab: 'portfolio', blocks: [
        { card: [['row', 'Buy a stock'], ['grey', '$1,240.00 of your budget is left to spend.'], ['rule'], ['row', 'Trade history'], C('grey', 'Includes your draft picks')] },
        { card: [['title', 'NFLX'], ['grey', 'Netflix'], ['warn', 'Dario N. owns NFLX.'], C('grey', 'A stock has one owner per league.'), ['btnoff', 'Review buy']] },
      ] },
      lines: [
        ['"Includes your draft picks"', 'CUT', 'The list shows the picks under "Draft".'],
        ['"Dario N. owns NFLX. A stock has one owner per league."', 'KEEP the first sentence', 'The refusal stays; the rule after it goes (it is the reason the button can\'t act, and the name says it).'],
        ['"$1,240.00 of your budget is left to spend."', 'KEEP', 'A value needed now.'],
        ['Home\'s "No buying before the draft…"', 'CUT', 'See Home\'s Draft card.'],
      ],
    },
    {
      id: 'standings', n: 15, name: 'League tab, the standings and the bracket', why: 'Not under a heading but the same habit: a rules paragraph after the list.',
      s: { head: 'pill', tab: 'league', blocks: [{ card: [
        ['head', 'Standings', 'Through Week 7'],
        ['standing', [['MR', 'Marco R.', '6–1', '+8.2%'], ['RB', 'Roberto B.', '5–2', '+6.9%'], ['LC', 'Luca C.', '4–3', '+3.1%'], ['EM', 'Elena M.', '3–4', '+1.4%']]],
        C('grey', 'Ranked by win percentage, then head-to-head, then season gain. This is also the playoff seeding.'),
      ] }] },
      lines: [
        ['"Ranked by win percentage, then head-to-head, then season gain…"', 'CUT', 'The order is the ranking. Nowhere else.'],
        ['Final standings: "After the playoffs" + the paragraph on how the top three are decided', 'CUT', '"Final standings" says it; the medals show the top three.'],
        ['Bracket: "The top 4 in the standings make the playoffs. A tied game goes to the higher seed."', 'CUT', 'The bracket shows who is in; a tie\'s result shows the winner.'],
        ['Schedule: "Then the playoffs: 4 teams · 2 weeks of playoffs…"', 'KEEP', 'Values: what comes after the last row.'],
      ],
    },
  ];

  // The lines that stay everywhere, by kind (not drawn).
  const KEEP_ALL = [
    ['Refusals and errors', 'every "…didn\'t load", "Try again", a refused pick or save, a full league, a dead link: what went wrong, in place.'],
    ['Empty states', '"No leagues yet", "No trades yet…", "Trading opens after the draft.", "Nothing here", the empty queue.'],
    ['Confirmations', 'Leave league ("…stays in the league\'s History…"), Delete account ("This can\'t be undone…"), the hand-over sheet: what the action will do.'],
    ['Your words', 'Delete account and its league lines, Check your email, the invite arrival, the takeover, onboarding\'s three lines, the notifications ask, How it works, "Invite someone to take their place", "Fewer than 4 teams have joined."'],
    ['Values', 'counts and times on a heading\'s line: "Members · 5 of 8 joined", "Your roster · 2 of 6", "Through Week 7", the hero\'s gain lines, "Picks 3 to 46".'],
  ];
  const ASK = [
    ['"Don\'t worry. You will be able to change this later." (Create league\'s name field)', 'Decided 2026-11-11: CUT ("3b cut").'],
  ];
  const DONE_ELSEWHERE = [
    ['Create league › Season', 'Decided: B, the strip (its own board). Its lines under Managers, Playoff teams and Regular season go with it.'],
    ['The draft room, Home\'s and League\'s live card, the end of the draft, the recap', 'Drawn to rule 12 on the draft room board (every heading listed there).'],
    ['Appearance: "System follows your phone\'s light or dark setting. Saved on this device."', 'CUT (the options say it).'],
    ['Create league › League: "Name your league and choose how it\'s played." and the duration options\' "Quick game" / "Standard" / …', 'CUT. The League type paragraphs move behind an i on Matchup and Duration (your example; drawn in "The i" below).'],
    ['Create league › done: "Share the invite code to bring your league in."', 'CUT (the Share button); "Set a draft time before the draft can start." KEEP (what is blocking).'],
    ['Home this week, pre-season: "No leader yet. Scoring starts at Monday\'s open."', '"No leader yet." CUT (0 to 0 says it); the time KEEP.'],
    ['Draft room, paused: "The clock is stopped and nobody is skipped."', 'CUT (the ring stops); the second sentence (who has been told / what lets it continue) KEEP.'],
  ];

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const tone = { CUT: 'var(--c-loss, #c0392b)', KEEP: 'var(--c-gain, #2e7d32)', MOVED: 'var(--c-accent)' };

  function Sections({ archived }) {
    return (
      <section className="b-sec" id="rule12-sweep" aria-labelledby="rule12-sweep-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Rule 12</span>
          <div>
            <h2 id="rule12-sweep-h">{archived ? 'Decided: every heading in the app, without the lines that explain it' : 'Your call: every heading in the app, without the lines that explain it'}</h2>
            <p className="b-job">Every screen on main, every heading and the lines under it, each kept (and which fact it holds) or cut (and where its fact went). Worst first; your three reports lead. Before is the app today, after is swept. Removing text needs no approval; the one new line is on the draft room board.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A line stays</b> only if it is a fact you need now that the card shows nowhere else: a time, a count, a name, or what is blocking you. One line at most.</li>
          <li><b>A line goes</b> if it says what the thing is or how it works, repeats the heading, the label or the button, or states a rule the control already enforces (that one comes back only as the refusal, in place, when you hit it).</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-10): all of it, with his tweak</b> ("i like what the design lead presented but there are little tweaks"): the i for a choice we defined. Rows 1 to 15 as drawn, with two later corrections: row 2 keeps "Save queue" (then B, saves as you go, its own call) and row 8 keeps "Fix these before …" (step 25 (b)). The one line left to rule on: "3b cut" (2026-11-11). Recorded in PRODUCT_RULES (rule 12, "Optional context for a choice we defined").</li> : <li><b>Recommended: all of it</b>, screen by screen as drawn. One line is yours to rule on, at the end.</li>}
          <li><b>Your tweak (2026-11-10):</b> where an option is key, ours and not obvious, its definition isn't cut, it moves behind an i at the end of the row, with a popup (a short line and a picture, a × to close). Point 4 is redrawn with it, and "The i" section after the sweep has every popup and the list of which options get one.</li>
        </ul>
        {SWEEP.map((x) => (
          <div key={x.id}>
            <h3 className="b-sub">{`${x.n} · ${x.name}`}</h3>
            <Grid>{[
              fig(`${x.id}-b`, 'As it ships · Large · Light', <Screen t="light" s={x.s} />, x.why),
              fig(`${x.id}-a`, 'After the sweep · Large · Light', <Screen t="light" s={x.afterS || x.s} after />),
              x.after2 ? fig(`${x.id}-a2`, `After · ${x.after2.label} · Large · Light`, <Screen t="light" s={x.after2.s} after />) : fig(`${x.id}-d`, 'After the sweep · Large · Dark', <Screen t="dark" s={x.afterS || x.s} after />),
            ]}</Grid>
            <ul className="b-inv__notes">
              {x.lines.map(([l, v, w]) => <li key={l}><b style={{ color: tone[v.split(' ')[0]] }}>{v}</b> · {l} — {w}</li>)}
            </ul>
          </div>
        ))}
        <h3 className="b-sub">Swept the same way, not drawn</h3>
        <ul className="b-inv__notes">{DONE_ELSEWHERE.map(([a, b]) => <li key={a}><b>{a}</b> — {b}</li>)}</ul>
        <h3 className="b-sub">What stays everywhere</h3>
        <ul className="b-inv__notes">{KEEP_ALL.map(([a, b]) => <li key={a}><b>{a}:</b> {b}</li>)}</ul>
        <h3 className="b-sub">Yours to rule on</h3>
        <ul className="b-inv__notes">{ASK.map(([a, b]) => <li key={a}><b>{a}</b> — {b}</li>)}</ul>
      </section>
    );
  }

  window.KSRule12Sweep = () => null; // decided 2026-11-10 (all of it, with the i); it lives in the Archive
  window.KSRule12SweepArchived = () => <Sections archived />;

  // ── The call: does the queue save as you go? (2026-11-12; the sweep's row 2 assumed it did.) ──
  const QROWS = [['AAPL', 'Apple', '$198.60'], ['NFLX', 'Netflix', '$702.10'], ['CRM', 'Salesforce', '$312.40'], ['ADBE', 'Adobe', '$512.90'], ['NVDA', 'NVIDIA', '$186.42']];
  const qScreen = (tail) => ({ name: 'League tab, your queue', head: 'pill', tab: 'league', blocks: [{ card: [
    ['tag', 'Your queue \u00b7 5 of 50'], ['grey', `Prices at Wednesday's close.`], ['stocks', QROWS], ['field', 'Add a stock'], ...tail,
  ] }] });
  function CallQueueSave({ archived }) {
    return (
      <section className="b-sec" id="call-queue-save" aria-labelledby="call-queue-save-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Queue</span>
          <div><h2 id="call-queue-save-h">{archived ? 'Decided: B, your queue saves as you go' : 'Your call: your queue, a Save button or saves as you go'}</h2></div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Why you're being asked:</b> the sweep board cut "Save queue" and "Not saved yet." on the belief that the queue already saves as you change it. It doesn't. Your decision 19 takes a stock someone drafts out of every queue on its own, but your own adds, removes and reorders still save only when you press "Save queue", before the draft and in the room. Cutting those two lines means changing how the queue works, so it's yours.</li>
          <li><b>What you're looking at:</b> League tab, your queue before the draft, right after you added NVDA. Only the bottom of the card changes. No new words: B's failure line and "Try again" are already in the app.</li>
          <li><b>A · keep the button (how it works today).</b> After any change, "Save queue" and "Not saved yet." appear under the list. Nothing is kept until you press it; leave without pressing and the change is gone.</li>
          <li><b>B · it saves as you go.</b> Every add, remove or reorder saves on its own a moment after you stop, the way Sleeper, ESPN and Yahoo queues work. No button, no "Not saved yet". If a save fails, "Your queue couldn't be saved." shows in place with "Try again", and the list stays as you left it.</li>
          <li><b>Recommended: B.</b> A queue is a list you tinker with, and a button you can forget is how a change gets lost; it's the same "removed but unsaved" state build 12 showed you. It costs a build: save after each change, show a failure in place, and stay in step when someone drafts a queued stock.</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-11): "B saves as you go".</b> No button, no "Not saved yet."; a failed save shows "Your queue couldn't be saved." in place with "Try again". No new words. Recorded in PRODUCT_RULES ("Your queue saves as you go").</li> : <li><b>Answer with:</b> A or B.</li>}
        </ul>
        <Grid>{[
          fig('qs-a', 'A · after adding NVDA (today)', <Screen t="light" s={qScreen([['btnline', 'Save queue'], ['grey', 'Not saved yet.']])} after />, 'Saved only when you press "Save queue".'),
          fig('qs-b', archived ? 'B · after adding NVDA (decided)' : 'B · after adding NVDA (recommended)', <Screen t="light" s={qScreen([])} after />, 'Already saved. Nothing to press.'),
          fig('qs-b-fail', 'B · if a save fails', <Screen t="light" s={qScreen([['warn', `Your queue couldn't be saved.`], ['btnline', 'Try again']])} after />, 'In place, the app\'s existing line. The list stays as you left it.'),
        ]}</Grid>
      </section>
    );
  }
  window.KSQueueSave = () => null; // decided 2026-11-11: B; it lives in the Archive
  window.KSQueueSaveArchived = () => <CallQueueSave archived />;
})();
