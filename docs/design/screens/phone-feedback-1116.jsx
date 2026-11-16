// Stockpile key-screens board — three calls from Giorgio's build 1.3.0 (14) phone feedback, 2026-11-16
// (PRODUCT_RULES, the 2026-11-16 entries). Each is A / B for him, with no heading-plus-grey-line in any
// option (UX rule 12). Drawn as `main` will ship in build 15, not as build 14 showed it, except where a
// "today" frame is labelled as build 14. Review notes sit UNDER the phones, never inside.
//   #call-buy-top     Portfolio › Buy a stock: the top of the screen.
//   #call-draft-card  The League tab's draft card before the draft.
//   #call-queue-card  The League tab's queue card.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit, NEW } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.3) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const tag = (x) => ({ ...fs(11, x, 1.6, 1.3), fontWeight: 800, fontStretch: '125%', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--c-text-2)' });

  /** A phone: the status bar, then `children` from the top, optional tab bar and keyboard. */
  function Phone({ t, label, tab, keyboard, children }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: tab ? 83 : 0, overflow: 'hidden' }}>{children}</div>
          {tab ? (
            <nav className="ks-tabs">
              {[['home', 'Home'], ['matchup', 'Matchup'], ['league', 'League'], ['portfolio', 'Portfolio']].map(([id, n]) => (
                <span key={id} className={id === tab ? 'ks-tabs__t ks-tabs__t--on' : 'ks-tabs__t'}><Icon d={ICON[id]} width={id === tab ? 2.4 : 1.8} />{n}</span>
              ))}
            </nav>
          ) : null}
          {keyboard ? (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 291, background: 'var(--c-inset)', borderTop: '1px solid var(--c-border)', padding: '10px 4px 40px', display: 'grid', gap: 10, alignContent: 'start' }} aria-hidden="true">
              {[10, 9, 9, 5].map((n, r) => (
                <div key={r} style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {Array.from({ length: n }, (_, i) => <span key={i} style={{ width: r === 3 && i === 2 ? 180 : 33, height: 42, borderRadius: 6, background: 'var(--c-surface)', boxShadow: '0 1px 0 var(--c-border-strong)' }} />)}
                </div>
              ))}
            </div>
          ) : null}
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }
  const Pill = ({ x = 1 }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, boxShadow: 'inset 0 0 0 1px var(--c-border)', ...fs(17, x, 1.3), fontWeight: 700, color: 'var(--c-text)' }}>Stock Scudetto <span style={{ ...fs(13, x, 1.3), padding: '0 7px', borderRadius: 999, background: 'var(--c-accent-tint)', color: 'var(--c-accent)' }}>+3</span><Icon d={ICON.chevron} size={14} width={2.4} /></span>
      <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-you, var(--c-accent))', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>RB</span>
    </div>
  );
  const Search = ({ x = 1, focused, flat, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 14px', borderRadius: 12, background: flat ? 'transparent' : 'var(--c-inset)', boxShadow: focused ? 'inset 0 0 0 2px var(--c-accent)' : flat ? 'none' : 'inset 0 0 0 1px var(--c-border)', flex: 1, minWidth: 0 }}>
      <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.search} size={18} width={2.2} /></span>
      {value ? <span style={{ ...fs(17, x, 1.6), color: 'var(--c-text)' }}>{value}<span style={{ display: 'inline-block', width: 2, height: '1em', verticalAlign: 'middle', background: 'var(--c-accent)', marginLeft: 1 }} /></span> : <span style={{ ...fs(17, x, 1.6), color: 'var(--c-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Search by ticker or name</span>}
    </div>
  );
  const RESULTS = [['NVDA', 'NVIDIA Corp', '$186.42'], ['NFLX', 'Netflix Inc', '$1,121.80'], ['NKE', 'Nike Inc', '$61.07'], ['NEE', 'NextEra Energy', '$79.55'], ['NOW', 'ServiceNow Inc', '$903.12']];
  function Results({ x = 1, typed }) {
    return (
      <div style={{ display: 'grid', padding: '4px 16px' }}>
        {RESULTS.map(([s, n, p]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--c-border)' }}>
            <span style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: 'var(--c-text)' }}>{s}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'grid' }}><b style={{ ...fs(16, x, 1.3), color: 'var(--c-text)' }}>{s}</b><span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)' }}>{n}</span></span>
            <b className="dr-num" style={{ ...fs(16, x, 1.3), color: 'var(--c-text)' }}>{p}</b>
          </div>
        ))}
        {typed ? null : null}
      </div>
    );
  }
  const Back = ({ x = 1, label }) => (
    <span style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--c-accent)', ...fs(17, x, 1.3), fontWeight: 700 }}><Icon d={ICON.left} size={22} width={2.6} />{label || null}</span>
  );

  // ── #call-buy-top ──────────────────────────────────────────────────────
  function BuyToday({ t = 'light', x = 1 }) {
    return (
      <Phone t={t} label="Buy a stock as build 14 shows it" keyboard>
        <Pill x={x} />
        <div style={{ padding: '4px 16px', display: 'grid', gap: 10 }}>
          <Back x={x} label="Portfolio" />
          <span style={{ ...fs(28, x, 1.6, 1.15), fontWeight: 800, color: 'var(--c-text)' }}>Buy a stock</span>
          <Search x={x} focused />
        </div>
      </Phone>
    );
  }
  /** A: a bar like the sheets' (back at the left, the title centred), the search field under it. */
  function BuyA({ t = 'light', x = 1, results, keyboard = true }) {
    return (
      <Phone t={t} label={`Buy a stock, option A, ${results ? 'results' : 'empty'}`} keyboard={keyboard}>
        <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 64px', alignItems: 'center', minHeight: 52, padding: '0 8px', background: 'var(--c-surface)' }}>
          <Back x={x} />
          <span style={{ ...fs(17, x, 1.3), fontWeight: 700, color: 'var(--c-text)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Buy a stock</span>
          <span />
        </div>
        <div style={{ padding: '10px 16px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex' }}><Search x={x} focused value={results ? 'n' : null} /></div>
        {results ? <Results x={x} /> : null}
      </Phone>
    );
  }
  /** B: the search field is the top row, beside the back arrow; no title. */
  function BuyB({ t = 'light', x = 1, results, keyboard = true }) {
    return (
      <Phone t={t} label={`Buy a stock, option B, ${results ? 'results' : 'empty'}`} keyboard={keyboard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 16px 10px 8px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
          <Back x={x} />
          <Search x={x} focused value={results ? 'n' : null} />
        </div>
        {results ? <Results x={x} /> : null}
      </Phone>
    );
  }

  // ── #call-draft-card ───────────────────────────────────────────────────
  const QUEUE = [['AAPL', 'Apple Inc.', '$211.42'], ['CRM', 'Salesforce Inc.', '$274.10'], ['V', 'Visa Inc.', '$291.40']];
  function DraftCard({ x = 1, v, room }) {
    const card = { background: 'var(--c-surface)', borderRadius: 16, padding: 20, display: 'grid', gap: 6, justifyItems: 'center', textAlign: 'center', boxShadow: 'inset 0 0 0 1px var(--c-border)' };
    const clock = <span className="dr-num" style={{ ...fs(44, x, 1.6, 1.1), fontWeight: 800, color: 'var(--c-text)' }}>{room ? '42:08' : '2d 06h 40m'}</span>;
    const small = (s) => <span key={s} style={{ ...fs(14, x, 2), color: 'var(--c-text)' }}>{s}</span>;
    const when = room ? 'Thu, Nov 12 · 12:48 PM ET' : 'Sat, Nov 14 · 6:44 PM ET';
    if (v === 'today') {
      return (
        <div style={card}>
          <span style={tag(x)}>{room ? 'Draft room open · starts in' : 'Draft starts in'}</span>
          {clock}
          {small(when)}
          <span style={{ ...fs(13, x, 2), color: 'var(--c-text-2)' }}>{room ? 'The draft starts automatically at 12:48 PM ET.' : 'The draft room opens at 5:44 PM ET, when the order is set.'}</span>
          {room ? null : <span style={{ ...fs(13, x, 2), color: 'var(--c-text-2)' }}>The draft starts automatically at 6:44 PM ET.</span>}
        </div>
      );
    }
    if (v === 'A') {
      return (
        <div style={card}>
          <span style={tag(x)}>{room ? 'Draft room open · starts in' : 'Draft starts in'}</span>
          {clock}
          {small(when)}
        </div>
      );
    }
    return (
      <div style={card}>
        <span style={{ ...tag(x), color: room ? 'var(--c-accent)' : 'var(--c-text-2)' }}>{room ? 'Draft room open · 12:48\u00a0PM\u00a0ET' : 'Draft · Sat, Nov\u00a014 · 6:44\u00a0PM\u00a0ET'}</span>
        {clock}
      </div>
    );
  }
  function QueueCard({ x = 1, v }) {
    const s = x >= 2;
    return (
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, padding: '18px 20px', display: 'grid', gap: 10, boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
        <span style={tag(x)}>Your queue · 3 of 50</span>
        {QUEUE.map(([sym, n, p], i) => (
          <div key={sym} style={{ display: 'flex', alignItems: s ? 'flex-start' : 'center', gap: 10 }}>
            <span className="dr-num" style={{ ...fs(14, x, 1.3), color: 'var(--c-text-2)', width: 16 }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'grid' }}>
              <b style={{ ...fs(17, x, 1.3), color: 'var(--c-text)' }}>{sym} <span className="dr-num" style={{ marginLeft: 8 }}>{p}</span></b>
              <span style={{ ...fs(13, x, 1.3), color: 'var(--c-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
            </span>
            <span style={{ display: 'flex', color: 'var(--c-text)' }}>
              <span style={{ width: 36, display: 'grid', placeItems: 'center', opacity: i === 0 ? 0 : 1 }}><Icon d={ICON.up} size={16} width={2.4} /></span>
              <span style={{ width: 36, display: 'grid', placeItems: 'center', opacity: i === 2 ? 0 : 1 }}><Icon d={ICON.chevron} size={16} width={2.4} /></span>
              <span style={{ width: 36, display: 'grid', placeItems: 'center' }}><Icon d={ICON.close} size={16} width={2.4} /></span>
            </span>
          </div>
        ))}
        {v === 'B' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: '1px solid var(--c-border)', paddingTop: 8 }}>
            <span style={{ width: 16, color: 'var(--c-accent)', display: 'grid', placeItems: 'center' }}><Icon d={ICON.plus} size={16} width={2.6} /></span>
            <span style={{ ...fs(17, x, 1.6), color: 'var(--c-accent)', fontWeight: 600 }}>Search by ticker or name</span>
          </div>
        ) : <div style={{ display: 'flex' }}><Search x={x} /></div>}
      </div>
    );
  }
  function LeagueTab({ t = 'light', x = 1, draft = 'A', queue = 'A', room, label }) {
    return (
      <Phone t={t} tab="league" label={label}>
        <Pill x={x} />
        <div style={{ padding: '6px 16px', display: 'grid', gap: 16 }}>
          <DraftCard x={x} v={draft} room={room} />
          <QueueCard x={x} v={queue} />
          <div style={{ background: 'var(--c-surface)', borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', boxShadow: 'inset 0 0 0 1px var(--c-border)', ...fs(16, x, 1.3), fontWeight: 700, color: 'var(--c-text)' }}>League settings <Icon d={ICON.right} size={16} width={2.4} /></div>
        </div>
      </Phone>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;
  const Head = ({ id, code, title, job }) => (
    <header className="b-sec__head">
      <span className="b-sec__n b-sec__n--code">{code}</span>
      <div><h2 id={`${id}-h`}>{title}</h2><p className="b-job">{job}</p></div>
    </header>
  );

  function CallBuyTop({ archived = false }) {
    return (
      <section className="b-sec" id="call-buy-top" aria-labelledby="call-buy-top-h">
        <Head id="call-buy-top" code="Portfolio" title={archived ? 'Decided: B, the top of Buy a stock' : 'Your call: the top of Buy a stock'} job={'You said the top left is too jumbled: the league pill, "‹ Portfolio", "Buy a stock" and the search all stacked in one corner over an empty page. Two ways to clean it up. Both drop the league pill here (you’re buying for the league you came from; switching leagues stays on the tabs) and both keep a way back to Portfolio.'} />
        <ul className="b-inv__notes">
          <li><b>A · A bar, like the sheets.</b> The back arrow at the left, "Buy a stock" centred, the same bar you picked for the tall sheets. The search field sits right under it, full width.</li>
          <li><b>B · The search is the top.</b> The back arrow, then the search field across the rest of the top row. No title: "Search by ticker or name" in the field says what the page is for, like the search in Apple's Stocks and App Store.</li>
          <li><b>In both, the empty page is mostly keyboard:</b> the field is ready to type the moment the page opens, so the space under it is the keyboard, and results fill it as you type.</li>
          <li><b>Recommended: B{archived ? ' (taken)' : ''}.</b> It's one row instead of two, and the first thing on the page is the thing you came to do. A is the better pick if you'd rather every page keep a title in the bar.</li>
          <li><b>No new words.</b> VoiceOver still says "Portfolio" on the back arrow.</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-16): "B".</b> The back arrow and the search field on one top row, no title, no league pill; VoiceOver keeps "Portfolio"; he accepted the empty field's “…” at his size. Recorded in PRODUCT_RULES ("Buy a stock: the top of the screen is too crowded").</li> : <li><b>Answer with:</b> A or B.</li>}
        </ul>
        <h3 className="b-sub">Today (build 14)</h3>
        <Grid>{[fig('bt', 'Today · Light · Large', <BuyToday />, 'Four things stacked in the top left.')]}</Grid>
        <h3 className="b-sub">A · a bar with the title, the search under it</h3>
        <Grid>{[
          fig('ba0', 'A · just opened · Light · Large', <BuyA />, 'Back, title, then the field.'),
          fig('ba1', 'A · typing "n" · Light · Large', <BuyA results />, 'Results fill the page.'),
          fig('ba2', 'A · just opened · Dark · Large', <BuyA t="dark" />),
        ]}</Grid>
        <h3 className="b-sub">B · the search is the top row {archived ? '(decided)' : '(recommended)'}</h3>
        <Grid>{[
          fig('bb0', 'B · just opened · Light · Large', <BuyB />, 'One row: back and the field.'),
          fig('bb1', 'B · typing "n" · Light · Large', <BuyB results />, 'Results start right under the top row.'),
          fig('bb2', 'B · just opened · Dark · Large', <BuyB t="dark" />),
          fig('bb3', 'B · typing "n" · Light · your size (AX5, approximate)', <BuyB x={AX5} results keyboard={false} />, 'The field’s words stop growing at 1.6x so the row stays one row; empty, its words end in “…” at this size.'),
        ]}</Grid>
      </section>
    );
  }

  function CallDraftCard({ archived = false }) {
    return (
      <section className="b-sec" id="call-draft-card" aria-labelledby="call-draft-card-h">
        <Head id="call-draft-card" code="League" title={archived ? 'Decided: B, the draft card before the draft' : 'Your call: the draft card before the draft'} job={'You said: "draft starts, this big date thing, and then two lines of smaller text below it." The two lines ("The draft room opens at…" and "The draft starts automatically at…") are already gone in build 15. What’s left under the countdown is the draft’s day and time. Keep that line, or put the time in the label above the countdown so nothing sits under it.'} />
        <ul className="b-inv__notes">
          <li><b>A · As build 15 has it.</b> "Draft starts in", the countdown, then one line: "Sat, Nov 14 · 6:44 PM ET". The line is a fact you can't see anywhere else on the card (when), so rule 12 lets it stay.</li>
          <li><b>B · Nothing under the countdown.</b> The time moves into the small label above it: "Draft · Sat, Nov 14 · 6:44 PM ET", then the countdown. Once the room opens: "Draft room open · 12:48 PM ET", then the countdown.</li>
          <li><b>Recommended: B{archived ? ' (taken)' : ''}.</b> It's the one layout with no small text under the big number, which is what you asked for, and nothing is lost: the time is still on the card.</li>
          <li><b>New words in B:</b> the two labels put words you already have together: "Draft · {'{day and time}'}" <NEW /> and "Draft room open · {'{time}'}" <NEW />. A has no new words.</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-16): "B", both labels approved as copy.</b> "Draft · {'{day and time}'}" and "Draft room open · {'{time}'}" above the countdown, nothing under it. Recorded in PRODUCT_RULES by the Planner (the 11-16 pre-draft League entry).</li> : <li><b>Answer with:</b> A or B.</li>}
        </ul>
        <h3 className="b-sub">Build 14 (what you saw) · A (build 15) · B</h3>
        <Grid>{[
          fig('dt', 'Build 14 · Light · Large', <LeagueTab draft="today" label="League tab before the draft, build 14" />, 'The two lines are already cut on main.'),
          fig('da', 'A · build 15 · Light · Large', <LeagueTab draft="A" label="League tab before the draft, option A" />, 'One line: the time.'),
          fig('db', 'B · Light · Large (recommended)', <LeagueTab draft="B" label="League tab before the draft, option B" />, 'The time in the label; nothing under the countdown.'),
        ]}</Grid>
        <h3 className="b-sub">Once the room opens, and B in Dark and at your size</h3>
        <Grid>{[
          fig('dar', 'A · room open · Light · Large', <LeagueTab draft="A" room label="League tab, room open, option A" />),
          fig('dbr', 'B · room open · Light · Large', <LeagueTab draft="B" room label="League tab, room open, option B" />),
          fig('dbd', 'B · Dark · Large', <LeagueTab t="dark" draft="B" label="League tab before the draft, option B, Dark" />),
          fig('dbx', 'B · Light · your size (AX5, approximate)', <LeagueTab draft="B" x={AX5} label="League tab before the draft, option B, AX5" />, 'The label wraps between its parts, never inside the time (keepTime), as the app does.'),
        ]}</Grid>
      </section>
    );
  }

  function CallQueueCard({ archived = false }) {
    return (
      <section className="b-sec" id="call-queue-card" aria-labelledby="call-queue-card-h">
        <Head id="call-queue-card" code="League" title={archived ? 'Decided: B, the queue card' : 'Your call: the queue card'} job={'You said: "your queue, then a bunch of little text, and then kind of a bigger stock thing, and then a big search bar, and then a big save queue button. It just looks cluttered." In build 15 the save button and the line under "Your queue" are gone (it saves by itself). What’s left that’s heavy is the big search box under the list.'} />
        <ul className="b-inv__notes">
          <li><b>A · As build 15 has it.</b> "Your queue · 3 of 50", your stocks, then the search box under them.</li>
          <li><b>B · The search becomes the list's last row.</b> No box: a "+" and "Search by ticker or name" in the accent colour, the height of one row. Tap it and it turns into the search field right there, with the same results as today. The card reads as one list.</li>
          <li><b>Recommended: B{archived ? ' (taken)' : ''}.</b> The box is the biggest thing on the card and it's the thing you use least once your queue is set; as a row it's still one tap away.</li>
          <li><b>No new words.</b> Both use the field's own words.</li>
          {archived ? <li><b>Decided by Giorgio (2026-11-16): "B".</b> The search is the queue list's last row, “+ Search by ticker or name” in the accent colour with no box; a tap turns it into the field in place, with the same results. No new words. Recorded in PRODUCT_RULES by the Planner.</li> : <li><b>Answer with:</b> A or B.</li>}
        </ul>
        <Grid>{[
          fig('qa', 'A · build 15 · Light · Large', <LeagueTab queue="A" label="League tab, queue card, option A" />, 'The search box under the list.'),
          fig('qb', 'B · Light · Large (recommended)', <LeagueTab queue="B" label="League tab, queue card, option B" />, 'The search as the last row.'),
          fig('qbd', 'B · Dark · Large', <LeagueTab t="dark" queue="B" label="League tab, queue card, option B, Dark" />),
          fig('qbx', 'B · Light · your size (AX5, approximate)', <LeagueTab queue="B" x={AX5} label="League tab, queue card, option B, AX5" />, 'The row grows with your text like the stock rows.'),
        ]}</Grid>
      </section>
    );
  }

  window.KSBuyTop = () => null; // decided 2026-11-16: B; it lives in the Archive
  window.KSBuyTopArchived = () => <CallBuyTop archived />;
  window.KSDraftCard = () => null; // decided 2026-11-16: B; it lives in the Archive
  window.KSDraftCardArchived = () => <CallDraftCard archived />;
  window.KSQueueCard = () => null; // decided 2026-11-16: B; it lives in the Archive
  window.KSQueueCardArchived = () => <CallQueueCard archived />;
})();
