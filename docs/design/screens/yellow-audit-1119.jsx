// Stockpile key-screens board — "Your call: the yellow warnings, in the palette's own colours" (2026-11-19).
// Giorgio: "we should have a select color palette and yellow doesnt really go with it". The audit lists every
// place the three yellow tokens (warnTint, warnLine, warnText) draw, and shows each in today's yellow, in A (the
// accent's soft tint, the family of the Matchup price notice he picked) and in B (a neutral grey). Every value
// below is copied from apps/mobile/constants/tokens/color.ts; A and B only re-point those three tokens, so a pick
// is a three-key change per theme and nothing else moves. The real app stills live outside the repo
// (local/design-review/design/yellow-audit-1119/). Review notes sit UNDER the elements, never inside.
(function () {
  const { Icon, ICON } = window.KSKit;

  // The app's own values (color.ts), per theme.
  const APP = {
    light: { bg: '#F3F5FC', surface: '#FDFEFF', text: '#0E142C', text2: '#505B72', line: '#D5DAEA', accent: '#00708E', onAccent: '#FDFEFF' },
    dark: { bg: '#060A1F', surface: '#0E132F', text: '#F3F5FB', text2: '#98A8C5', line: '#222C4C', accent: '#35EEFF', onAccent: '#080D25' },
  };
  // The three warn tokens in each option.
  const WARN = {
    today: {
      light: { tint: '#FAE7B3', line: '#EFCC83', ink: '#784900' },
      dark: { tint: 'rgba(244, 191, 63, 0.1)', line: 'rgba(244, 191, 63, 0.35)', ink: '#FAC547' },
    },
    A: {
      light: { tint: 'rgba(0, 112, 142, 0.12)', line: 'rgba(0, 112, 142, 0.35)', ink: '#006885' },
      dark: { tint: 'rgba(53, 238, 255, 0.16)', line: 'rgba(53, 238, 255, 0.4)', ink: '#35EEFF' },
    },
    B: {
      light: { tint: '#E7EBF6', line: '#737A8D', ink: '#0E142C' },
      dark: { tint: '#181F3E', line: '#58698C', ink: '#F3F5FB' },
    },
  };

  // One element of each kind, drawn the way the app draws it.
  const PLACES = [
    {
      key: 'panel',
      name: 'The refusal panel',
      where: 'The stock sheet (already owned, over the budget, a full team, couldn’t reach), the trade review, Join league, an invite link, taking over a team, Members and a manager’s team (couldn’t reach), the draft queue (didn’t save), Create account (signups paused), Delete account (wrong password, too many tries).',
      draw: (w, a, page) => (
        <div style={{ background: page, padding: 10 }}>
          <div style={{ background: w.tint, border: `1px solid ${w.line}`, borderRadius: 14, padding: '10px 12px', color: w.ink, fontWeight: 700, fontSize: 14, lineHeight: '19px' }}>Your roster is full. Sell a holding first.</div>
        </div>
      ),
    },
    {
      key: 'blockers',
      name: 'The commissioner’s “can’t start yet” card',
      where: 'Home, before the draft, when something blocks the start: the card’s fill and edge, its small label, and the ring on the Playoff teams stepper.',
      draw: (w, a, page) => (
        <div style={{ background: page, padding: 10 }}>
          <div style={{ background: w.tint, border: `1px solid ${w.line}`, borderRadius: 16, padding: 12, display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: w.ink, whiteSpace: 'nowrap' }}>NEEDS YOU BEFORE 2:44 PM ET</span>
            <b style={{ fontSize: 16, color: a.text }}>The draft can’t start yet</b>
            <div style={{ background: a.surface, borderRadius: 12, padding: 10, display: 'grid', gap: 8 }}>
              <b style={{ fontSize: 13, color: a.text }}>8 playoff teams, but 7 teams are in</b>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `2px solid ${w.line}`, borderRadius: 10, padding: '6px 10px' }}>
                <span style={{ fontSize: 13, color: a.text, whiteSpace: 'nowrap' }}>Playoff teams</span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center', color: a.text, fontWeight: 700 }}><Icon d="M5 12h14" size={14} width={2.4} />8<Icon d={ICON.plus} size={14} width={2.4} /></span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'note',
      name: 'The stake-mode note',
      where: 'League settings, for a league that has no stake mode yet (no test league reaches it, so it is drawn here from the code, with no app still).',
      draw: (w, a, page) => (
        <div style={{ background: page, padding: 10 }}>
          <div style={{ background: w.tint, border: `1px solid ${w.line}`, borderRadius: 14, padding: '10px 12px', color: w.ink, fontSize: 14, lineHeight: '19px' }}>This league has no stake mode yet — drafting is blocked until you choose one.</div>
        </div>
      ),
    },
    {
      key: 'tbd',
      name: 'A draft time still to set',
      where: 'Create league (the draft step and the summary) and League settings: “TBD” on the Draft time row.',
      draw: (w, a, page) => (
        <div style={{ background: page, padding: 10 }}>
          <div style={{ background: a.surface, borderRadius: 14, padding: '0 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 0', fontSize: 15 }}><b style={{ color: a.text, flex: 1 }}>Draft time</b><span style={{ color: w.ink }}>TBD</span><span style={{ color: a.text2, display: 'grid' }}><Icon d={ICON.chevron} size={13} width={2.4} /></span></div>
          </div>
        </div>
      ),
    },
    {
      key: 'badge',
      name: 'The search badge',
      where: 'The draft’s stock search: a stock you can’t pick (“NOT DRAFTABLE”, or one already owned). The row is greyed, so the badge is too.',
      draw: (w, a, page) => (
        <div style={{ background: page, padding: 10 }}>
          <div style={{ background: a.surface, borderRadius: 14, padding: '10px 12px', display: 'grid', gap: 2, opacity: 0.55 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><b style={{ fontSize: 16, color: a.text }}>SPY</b><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: w.ink, border: `1px solid ${w.ink}`, borderRadius: 6, padding: '1px 5px', whiteSpace: 'nowrap' }}>NOT DRAFTABLE</span></span>
            <span style={{ fontSize: 13, color: a.text2 }}>SPDR S&amp;P 500 ETF Trust</span>
          </div>
        </div>
      ),
    },
  ];

  const OPTS = [['today', 'Today (yellow)'], ['A', 'A · teal tint'], ['B', 'B · grey']];

  function Cell({ place, opt, t }) {
    const a = APP[t];
    return <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1px var(--c-border)' }}>{place.draw(WARN[opt][t], a, t === 'light' ? a.bg : a.bg)}</div>;
  }

  function CallYellow({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-yellow" aria-labelledby="call-yellow-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Colour</span>
          <div>
            <h2 id="call-yellow-h">{archived ? 'Decided: the yellow warnings' : 'Your call: the yellow warnings, in the palette’s own colours'}</h2>
            <p className="b-job">Yellow is the one colour outside the palette, and only the three warning colours draw it. It marks a refusal or a blocker in five kinds of places; each is below in today’s yellow and in two palette options, Light and Dark. Real app stills of all of them: the contact sheet sent with this board.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · the teal tint.</b> The accent’s soft tint with its words in teal: the same family as the Matchup price notice you picked. Warnings stay coloured.</li>
          <li><b>B · grey.</b> A neutral grey box with the words in the normal ink; colour is left for money and your turn. Warnings are carried by their words and their place. In the app, its grey edge makes a refusal look like the outlined button under it (“Try another code”).</li>
          <li><b>Recommended: A.</b> It keeps a refusal easy to spot (the panel appears right where you tried something), and it uses the one colour the app already leads with, so the palette is navy, teal, blue and green/red with nothing else.</li>
          <li><b>Left as they are:</b> the gold medal (a medal, only on a finished season, beside silver and bronze), and the Property category’s amber (one of the 11 category colours, not a warning).</li>
          <li><b>No new words.</b> Only the three warning colours change, in both themes, everywhere at once.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>
        <div style={{ display: 'grid', gap: 22 }}>
          {PLACES.map((p) => (
            <div key={p.key} style={{ display: 'grid', gap: 8 }}>
              <div><b>{p.name}</b><span className="b-annot" style={{ display: 'block' }}>Where: {p.where}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                {OPTS.map(([o, label]) => (
                  <figure key={o} style={{ margin: 0, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
                      <Cell place={p} opt={o} t="light" />
                      <Cell place={p} opt={o} t="dark" />
                    </div>
                    <figcaption><b>{label}</b><span className="b-annot"> Light · Dark</span></figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  window.KSYellow = () => null;
  window.KSYellowArchived = () => <CallYellow archived decidedNote={<><b>Decided 2026-11-19: A,</b> the teal tint, in all five kinds of place. A build re-points warnTint, warnLine and warnText in both themes.</>} />;
})();
