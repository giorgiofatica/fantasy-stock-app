// Stockpile key-screens board — "Your call: the words under a final that wasn't decided by dollars" (2026-11-19,
// the Planner's candidate lines). Today the line under a final card picks the winner from DOLLARS, so a percent
// tiebreak, an automatic loss for no stocks, or a playoff seed decision can read "Dead even" or "won by $X" beside
// the real result; the interim build shows no line there. These are the words for those cases, A (short) or B
// (reason first), drawn on All matchups, the season recap and the week itself. Review notes sit UNDER the phones.
(function () {
  const { Icon, ICON } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const OS = () => <div className="ks-os"><span>9:41</span><span className="ks-os__island" /><span className="ks-os__icons"><span className="ks-os__bars"><i /><i /><i /><i /></span><span className="ks-os__batt"><i /></span></span></div>;

  // The four cases (you are Roberto B.). Figures: equal dollars where the rule says so; "–" for a side with no stocks.
  const CASES = {
    pct: {
      week: 'WK 14', l: ['RB', 'Roberto B.', '+$34.04', true], r: ['PM', 'Paolo M.', '+$34.04'],
      A: 'Paolo M. won the tiebreak, +1.76% to +0.74%',
      B: 'Tied on dollars. Paolo M. won on percent, +1.76% to +0.74%',
    },
    none: {
      week: 'WK 14', l: ['CR', 'Chiara R.', '−$12.40'], r: ['SF', 'Sofia F.', '–'],
      A: 'Chiara R. won. Sofia F. had no stocks',
      B: 'Sofia F. had no stocks this week, so Chiara R. won',
    },
    seed: {
      week: 'WK 15', l: ['RB', 'Roberto B.', '+$20.10', true], r: ['LV', 'Luca V.', '+$20.10'],
      A: 'Tied. Luca V. advances as the higher seed',
      B: 'Dead even. The higher seed, Luca V., advances',
    },
    empty: {
      week: 'WK 15', l: ['CR', 'Chiara R.', '–'], r: ['MT', 'Marco T.', '–'],
      A: 'No stocks on either side. Chiara R. advances as the higher seed',
      B: 'Dead even. The higher seed, Chiara R., advances',
    },
  };

  const Av = ({ i, you, s = 1 }) => (
    <span style={{ width: 30 * s, height: 30 * s, flex: `0 0 ${30 * s}px`, borderRadius: 15 * s, background: you ? 'var(--c-you)' : 'var(--c-opp)', color: you ? 'var(--c-on-you, #fff)' : 'var(--c-on-opp)', boxShadow: you ? '0 0 0 2px var(--c-surface), 0 0 0 3.5px var(--c-you)' : 'none', display: 'grid', placeItems: 'center', fontSize: 11 * s, fontWeight: 700 }}>{i}</span>
  );

  /** The compact Scoreboard (All matchups) with its line. x: 1 at Large, 1.3 = the capped AX5 size of names and the line. */
  function Card({ c, words, x = 1 }) {
    const [li, ln, lf, you] = c.l;
    const [ri, rn, rf] = c.r;
    const fig = (f, end) => <b className="dr-num" style={{ fontSize: 24, color: f === '–' ? 'var(--c-text-2)' : 'var(--c-text)', textAlign: end ? 'right' : 'left' }}>{f}</b>;
    const stack = x > 1;
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 22px', borderRadius: 14, overflow: 'hidden', background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
          <div style={{ padding: 10, display: 'grid', gap: 8, background: you ? 'var(--c-you-tint)' : 'transparent' }}>
            <span style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', alignItems: stack ? 'flex-start' : 'center', gap: 6 }}><Av i={li} you={you} /><b style={{ fontSize: 13 * x, color: 'var(--c-text)', whiteSpace: 'nowrap' }}>{ln}</b></span>
            {fig(lf)}
          </div>
          <div style={{ padding: 10, display: 'grid', gap: 8, justifyItems: 'end' }}>
            <span style={{ display: 'flex', flexDirection: stack ? 'column-reverse' : 'row', alignItems: stack ? 'flex-end' : 'center', gap: 6 }}><b style={{ fontSize: 13 * x, color: 'var(--c-text)', whiteSpace: 'nowrap' }}>{rn}</b>{stack ? null : <Av i={ri} />}{stack ? <Av i={ri} /> : null}</span>
            {fig(rf, true)}
          </div>
          <span style={{ display: 'grid', placeItems: 'center', color: 'var(--c-text-2)' }}><Icon d={ICON.right} size={14} width={2.4} /></span>
        </div>
        <span style={{ textAlign: 'center', fontSize: 12.5 * x, lineHeight: `${Math.round(17 * x)}px`, color: 'var(--c-text-2)', padding: '0 8px' }}>{c[words]}</span>
      </div>
    );
  }

  const Switch = ({ left }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 3, borderRadius: 10, background: 'var(--c-inset)', fontSize: 14, fontWeight: 600 }}>
      <span style={{ textAlign: 'center', padding: '7px 0', borderRadius: 8, background: left ? 'var(--c-surface)' : 'transparent', color: left ? 'var(--c-text)' : 'var(--c-text-2)' }}>My matchup</span>
      <span style={{ textAlign: 'center', padding: '7px 0', borderRadius: 8, background: left ? 'transparent' : 'var(--c-surface)', color: left ? 'var(--c-text-2)' : 'var(--c-text)' }}>All matchups</span>
    </div>
  );
  const Wk = ({ children }) => <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--c-text-2)', marginTop: 4 }}>{children}</span>;

  function Phone({ t = 'light', label, children }) {
    return (
      <Th t={t}>
        <div className="ks-device" role="img" aria-label={label}>
          <OS />
          <div style={{ position: 'absolute', top: 58, left: 16, right: 16, bottom: 30, display: 'grid', alignContent: 'start', gap: 10, overflow: 'hidden' }}>{children}</div>
          <span className="ks-home-ind" style={{ zIndex: 6 }} />
        </div>
      </Th>
    );
  }

  /** All matchups, recap view: the two weeks holding the four cases. */
  function AllMatchups({ t, words }) {
    return (
      <Phone t={t} label={`All matchups with the ${words} words`}>
        <Switch />
        <Wk>WK 15</Wk>
        <Card c={CASES.seed} words={words} />
        <Card c={CASES.empty} words={words} />
        <Wk>WK 14</Wk>
        <Card c={CASES.pct} words={words} />
        <Card c={CASES.none} words={words} />
      </Phone>
    );
  }

  /** The longest line of an option, at Giorgio's text size (names and the line at their 1.3 cap). */
  function Longest({ words, c }) {
    return (
      <Phone label={`The longest ${words} line at the largest text size`}>
        <Switch />
        <Wk>{c.week}</Wk>
        <Card c={c} words={words} x={1.3} />
      </Phone>
    );
  }

  /** My matchup, the season recap. reason: false = as built today (1); true = the short reason after the letter (2).
   * x: 1 at Large, 1.3 = the rows' capped size at Giorgio's text size (the result drops under the name, as built). */
  function Recap({ reason = false, x = 1, label }) {
    const rows = [
      ['SF', 'LV', 'Luca V.', 'L', '+$20.10', 'seed'],
      ['WK 14', 'PM', 'Paolo M.', 'L', '+$34.04', 'tiebreak'],
      ['WK 13', 'SF', 'Sofia F.', 'W', '−$12.40', 'no stocks'],
      ['WK 12', 'GB', 'Gianluigi B.', 'W', '+$58.75', null],
      ['WK 11', 'MT', 'Marco T.', 'L', '−$96.40', null],
    ];
    const tone = (f) => (f.startsWith('−') ? 'var(--c-loss)' : 'var(--c-gain)');
    const big = x > 1;
    return (
      <Phone label={label}>
        <Switch left />
        {rows.map(([wk, i, n, r, f, why]) => {
          const result = (
            <b className="dr-num" style={{ fontSize: 14 * x, whiteSpace: 'nowrap' }}>
              <span style={{ color: r === 'W' ? 'var(--c-gain)' : 'var(--c-loss)' }}>{r}</span>
              {reason && why ? <span style={{ color: 'var(--c-text-2)', fontWeight: 600 }}>{` · ${why}`}</span> : null}
              {' '}<span style={{ color: tone(f) }}>{f}</span>
            </b>
          );
          return (
            <div key={wk} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px', borderRadius: 12, background: 'var(--c-surface)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11 * x, fontWeight: 800, letterSpacing: 0.8, color: 'var(--c-text-2)', minWidth: 40 * x, whiteSpace: 'nowrap' }}>{wk}</span>
                  <Av i={i} s={0.75} />
                  <span style={{ flex: 1, fontSize: 14 * x, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>vs {n}</span>
                  {big ? null : result}
                </span>
                {big ? <span style={{ justifySelf: 'end' }}>{result}</span> : null}
              </div>
              <span style={{ color: 'var(--c-text-2)', display: 'grid' }}><Icon d={ICON.right} size={13} width={2.4} /></span>
            </div>
          );
        })}
      </Phone>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children, n = 'three' }) => <div className={`b-concepts b-concepts--${n}`}>{children}</div>;

  function CallTiebreakWords({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-tiebreak-words" aria-labelledby="call-tiebreak-words-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Matchup</span>
          <div>
            <h2 id="call-tiebreak-words-h">{archived ? 'Decided: the words when dollars don’t decide a week' : 'Your call: the words when dollars don’t decide a week'}</h2>
            <p className="b-job">When the dollars are level, or a team had no stocks, the winner is decided another way. The line under the final card should say who won and why.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · short.</b> The winner first: “Paolo M. won the tiebreak, +1.76% to +0.74%”.</li>
          <li><b>B · the reason first.</b> “Tied on dollars. Paolo M. won on percent, +1.76% to +0.74%”. In B one seed line covers both playoff cases.</li>
          <li><b>Who won, on All matchups:</b> every line names the winner, so no extra marker is needed on the card. Where both figures match, or a side shows “–”, the line is what tells you.</li>
          <li><b>The season recap row, 1 or 2.</b> 1 · as it is today: the letter is the result, the figure is your week (“L +$34.04”: you gained and still lost); the reason is one tap away, under that week’s card. 2 · the reason after the letter, in grey: “L · tiebreak”, “L · seed”, “W · no stocks” (new words, a word each). Only these weeks change; every other row stays as it is.</li>
          <li><b>Recommended: A and 2.</b> A answers who won before why, like “won by”, and its longest line still fits in two lines at your text size. 2, because a red L beside a bigger green figure looks like a mistake until you know why; one grey word settles it without a second line.</li>
          <li><b>New words:</b> the lines for the four cases below, and in 2 the three reason words; no other text changes. Normal wins keep “won by $X”, a true tie keeps “Dead even”.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B for the line, and 1 or 2 for the recap row.</>}</li>
        </ul>
        <Grid>{[
          fig('ta', 'A · short', <AllMatchups words="A" />, 'Top to bottom: a seed tie, no stocks on either side, a percent tiebreak, no stocks on one side.'),
          fig('tb', 'B · reason first', <AllMatchups words="B" />, 'The same four games.'),
          fig('tad', 'A · Dark', <AllMatchups t="dark" words="A" />),
        ]}</Grid>
        <Grid>{[
          fig('la', 'A · its longest line, your text size', <Longest words="A" c={CASES.empty} />, 'Two lines, centred under the card.'),
          fig('lb', 'B · its longest line, your text size', <Longest words="B" c={CASES.pct} />, 'Two lines, centred under the card.'),
        ]}</Grid>
        <Grid>{[
          fig('r1', '1 · the recap row as it is today', <Recap label="Season recap rows as today, option 1" />, 'SF and Wk 14: a red L beside a green figure. Wk 13 is its mirror, a green W beside a red figure.'),
          fig('r2', '2 · the reason after the letter', <Recap reason label="Season recap rows with the reason, option 2" />, 'Only the three tiebreak weeks change.'),
          fig('r2x', '2 · at your text size', <Recap reason x={1.3} label="Season recap rows with the reason at the largest text size, option 2" />, 'The result drops under the name, as built; the reason stays with its letter.'),
        ]}</Grid>
      </section>
    );
  }

  window.KSTiebreakWords = () => <CallTiebreakWords />;
})();
