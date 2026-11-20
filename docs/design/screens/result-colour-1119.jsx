// Stockpile key-screens board — "Your call: W, L and T in neutral ink everywhere?" (2026-11-19). Giorgio made the
// season recap's result letters bold neutral ink, the figure keeping its sign colour (#574). This audit lists every
// other place a result is coloured by the result and shows each as it is today and neutral. The real app stills
// (same fixture, only the result element differs) live outside the repo: local/design-review/design/result-colour-1119/.
// Review notes sit UNDER the elements, never inside.
(function () {
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`} style={{ background: 'var(--c-bg)', padding: 10, borderRadius: 12 }}>{children}</div>;
  const ink = (r, neutral) => (neutral ? 'var(--c-text)' : r === 'W' ? 'var(--c-gain)' : r === 'L' ? 'var(--c-loss)' : 'var(--c-text-2)');
  const sign = (f) => (f.startsWith('−') ? 'var(--c-loss)' : 'var(--c-gain)');

  const WEEKS = [['Wk 1', 'W', '+$41.30'], ['Wk 2', 'W', '+$58.75'], ['Wk 3', 'L', '−$96.40'], ['Wk 4', 'W', '+$72.10'], ['Wk 5', 'W', '+$54.24']];

  /** Home › Your season: the week tiles. */
  const Tiles = ({ n }) => (
    <div style={{ background: 'var(--c-surface)', borderRadius: 14, padding: 10, display: 'grid', gap: 8 }}>
      <b style={{ fontSize: 13, color: 'var(--c-text)' }}>Your season</b>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 }}>
        {WEEKS.map(([w, r, f]) => (
          <div key={w} style={{ display: 'grid', justifyItems: 'center', gap: 2, padding: '5px 0', borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--c-rim)' }}>
            <span style={{ fontSize: 9, color: 'var(--c-text-2)' }}>{w}</span>
            <b style={{ fontSize: 17, fontWeight: 800, color: ink(r, n) }}>{r}</b>
            <span className="dr-num" style={{ fontSize: 8.5, fontWeight: 700, color: sign(f) }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );

  /** League › Schedule: the week rows. */
  const Schedule = ({ n }) => (
    <div style={{ display: 'grid', gap: 6 }}>
      {WEEKS.slice(1, 4).map(([w, r, f]) => (
        <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-surface)', borderRadius: 10, padding: '9px 10px', fontSize: 12.5 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text-2)', minWidth: 26 }}>{w.replace('Wk ', 'W')}</span>
          <span style={{ flex: 1, color: 'var(--c-text)', whiteSpace: 'nowrap' }}>vs Gianluigi B.</span>
          <b className="dr-num" style={{ whiteSpace: 'nowrap' }}><span style={{ color: ink(r, n) }}>{r}</span> <span style={{ color: sign(f) }}>{f}</span></b>
        </div>
      ))}
    </div>
  );

  /** The finished week's banner, a week you won. */
  const Banner = ({ n }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 800, background: n ? 'var(--c-sunken)' : 'var(--c-you)', color: n ? 'var(--c-text)' : 'var(--c-on-you)' }}>
      <span style={{ whiteSpace: 'nowrap' }}>Roberto B. wins Week 6</span><span style={{ whiteSpace: 'nowrap' }}>W · 5–1</span>
    </div>
  );

  /** The Matchup "i" popup's picture: the W beside the winner. */
  const Popup = ({ n }) => (
    <div style={{ background: 'var(--c-inset)', borderRadius: 12, padding: 10, display: 'grid', gap: 8, fontSize: 12.5 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--c-text-2)' }}>WEEK 3</span>
      {[['You', '+$24.10', true], ['Marco R.', '−$8.30', false]].map(([who, f, win]) => (
        <div key={who} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, color: 'var(--c-text)', fontWeight: win ? 700 : 400 }}>{who}</span>
          <b className="dr-num" style={{ color: sign(f) }}>{f}</b>
          <b style={{ width: 16, textAlign: 'center', fontSize: 11, color: win ? ink('W', n) : 'transparent' }}>W</b>
        </div>
      ))}
    </div>
  );

  const PLACES = [
    { key: 'tiles', name: 'Home › Your season', where: 'The week tiles: the letter is green, red or grey today; the figure under it keeps its sign colour either way.', El: Tiles },
    { key: 'sched', name: 'League › Schedule', where: 'Each week’s row: the same letter as the season recap, which is already neutral (#574).', El: Schedule },
    { key: 'popup', name: 'The Matchup “i” popup', where: 'The W beside the winner in the picture that explains a matchup.', El: Popup },
  ];

  const Pair = ({ El, n }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
      <Th t="light"><El n={n} /></Th>
      <Th t="dark"><El n={n} /></Th>
    </div>
  );

  function Place({ name, where, El, a, b }) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div><b>{name}</b><span className="b-annot" style={{ display: 'block' }}>Where: {where}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 12 }}>
          <figure style={{ margin: 0, display: 'grid', gap: 6 }}><Pair El={El} n={false} /><figcaption><b>{a}</b><span className="b-annot"> Light · Dark</span></figcaption></figure>
          <figure style={{ margin: 0, display: 'grid', gap: 6 }}><Pair El={El} n /><figcaption><b>{b}</b><span className="b-annot"> Light · Dark</span></figcaption></figure>
        </div>
      </div>
    );
  }

  function CallResultColour({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-result-colour" aria-labelledby="call-result-colour-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Colour</span>
          <div>
            <h2 id="call-result-colour-h">{archived ? 'Decided: W, L and T colours outside the recap' : 'Your call: W, L and T in neutral ink everywhere?'}</h2>
            <p className="b-job">You made the season recap’s W, L and T bold neutral ink, with the money keeping its green or red. Three more places colour the letter by the result, and one banner colours a week you won.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Letters · A, neutral everywhere.</b> Home’s season tiles, League › Schedule and the Matchup popup draw W, L and T like the recap: bold, in the normal ink. The figures keep their sign colour.</li>
          <li><b>Letters · B, as today</b> outside the recap: W green, L red, T grey.</li>
          <li><b>The banner · 1, keep it blue</b> when you won a week (your colour; a lost or tied week is already grey). <b>2, grey for every week.</b></li>
          <li><b>Recommended: A and 1.</b> A, because the tiles and Schedule show the same weeks as the recap, and a tiebreak week would otherwise show a red L beside a green figure there too. 1, because the blue is your colour, not a result colour: it never sits beside a figure it could contradict, and it is the one moment a week celebrates you.</li>
          <li><b>Left as they are:</b> the bracket (the winner bold, the other grey, no colour), the medals, money everywhere, and the standings’ up and down arrows (rank movement, not a result).</li>
          <li><b>No new words.</b> Real app stills of every place: the contact sheet sent with this board.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B for the letters, and 1 or 2 for the banner.</>}</li>
        </ul>
        <div style={{ display: 'grid', gap: 22 }}>
          {PLACES.map((p) => <Place key={p.key} name={p.name} where={p.where} El={p.El} a="Today" b="A · neutral" />)}
          <Place name="The finished week’s banner" where="The Matchup tab and a week’s detail, a week you won. A week you lost or tied is grey today and stays grey." El={Banner} a="1 · as today, blue" b="2 · grey for every week" />
        </div>
      </section>
    );
  }

  window.KSResultColour = () => null;
  window.KSResultColourArchived = () => <CallResultColour archived decidedNote={<><b>Decided 2026-11-20:</b> “A and keep blue”. The letters go neutral in all three places, the money keeps its colour, and the banner of a week you won stays blue.</>} />;
})();
