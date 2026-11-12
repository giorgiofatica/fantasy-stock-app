// Stockpile key-screens board — "Your call: the Leave sheet when the league has four" (build 1.3.0 (14)
// phone pass, step 24d). The member's Leave sheet before the draft says "{commissioner} chooses
// whether to go ahead with one fewer team or invite someone new." Since rule B (PRODUCT_RULES "When
// managers leave before the draft, below four"), a leave that takes the league below four gives the
// commissioner NO choice: one card, the code and Share, and the league is ready again once four are
// in. So in a league of four (or fewer) the bullet is false. A: a below-four bullet (NEW copy).
// B: no bullet. Five or more is unchanged.
(function () {
  const GN = window.KSGN;
  const { Fit, NEW } = GN;
  const I = window.KSInventory;
  const K = window.KS;

  const CHOOSES = 'Roberto B. chooses whether to go ahead with one fewer team or invite someone new.';
  const WAITS = 'The draft waits until 4 teams are in.'; // NEW (A)
  const REJOIN = `You can rejoin with the invite code until ${K.SERIE_A.revealAt}.`;
  const V = {
    today: { items: [CHOOSES, REJOIN], top: 560 },
    A: { items: [WAITS, REJOIN], top: 590 },
    B: { items: [REJOIN], top: 620 },
    Bnotime: { items: [], top: 665 },
    five: { items: [CHOOSES, REJOIN], top: 560 },
  };

  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const Leave = ({ t, v }) => <Th t={t}><I.LeaveSheet mode="pre" items={V[v].items} top={V[v].top} /></Th>;
  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Grid = ({ children }) => <div className="b-concepts b-concepts--three">{children}</div>;

  function CallLeaveBelowFour({ archived = false, decided, decidedNote }) {
    return (
      <section className="b-sec" id="call-leave-below-four" aria-labelledby="call-leave-below-four-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">League</span>
          <div>
            <h2 id="call-leave-below-four-h">{archived ? `Decided: ${decided}, the Leave sheet in a league of four` : 'Your call: the Leave sheet in a league of four'}</h2>
            <p className="b-job">From the phone pass (step 24d). Before the draft, the Leave sheet tells you what happens after you go. In a league of four that sentence is no longer true: since your rule for leaving below four, the commissioner gets no choice. Below: the sheet as it ships, then two fixes. Only the first line changes. Drawn in Light only: nothing but the words changes.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>Today:</b> "Roberto B. chooses whether to go ahead with one fewer team or invite someone new." That's right with five or more. With four, your leave leaves three, and your rule says three can't go ahead: Roberto sees one card with the invite code, and the league is ready again once four are in. So the sheet promises a choice that doesn't exist.</li>
          <li><b>A · Say what really happens.</b> "The draft waits until 4 teams are in." <NEW /> It's the one leave that stops the draft, which is worth knowing before you tap. It says "4 teams are in", not "a fourth team joins", so it's also right if a league of three loses a second manager.</li>
          <li><b>B · Say nothing about the league.</b> The sheet keeps only "{REJOIN}" When the draft has no time yet, that line isn't there either, so the sheet is just "Leave {K.SERIE_A.name}?" and the two buttons. No new words.</li>
          <li><b>Five or more:</b> unchanged in A and B. The commissioner's choice is real there, so the sentence stays.</li>
          <li><b>Rule 12 doesn't settle this one.</b> These are lines on a sheet that confirms something, saying what the tap will do, and the sweep keeps that kind of line. So it's a question of whether the leaver needs to know the draft will wait.</li>
          <li><b>{archived ? 'Recommended (not taken): A.' : 'Recommended: A.'}</b> Leaving at four is the only leave that holds everyone else up. It's the most important thing the sheet could say, and you'd want people to know it before they go. Pick B if you'd rather the sheet only talk about you.</li>
          <li><b>{archived ? 'New words in A (not used):' : 'New words, to approve as written (A only):'}</b> "The draft waits until 4 teams are in."</li>
          {archived ? <li>{decidedNote}</li> : null}
        </ul>
        <h3 className="b-sub">Today, in a league of four, as build 14 ships it</h3>
        <Grid>{[
          fig('tl', 'Today · four managers · Light', <Leave t="light" v="today" />, 'A choice the commissioner doesn\'t get once the league is below four.'),
          fig('fl', 'Five or more · Light (stays in A and B)', <Leave t="light" v="five" />, 'With five or more the choice is real, so the line stays.'),
        ]}</Grid>
        <h3 className="b-sub">A · Say what really happens</h3>
        <Grid>{[
          fig('al', 'A · four managers · Light', <Leave t="light" v="A" />, 'The new line replaces the first bullet only when your leave takes the league below four.'),
        ]}</Grid>
        <h3 className="b-sub">B · Say nothing about the league</h3>
        <Grid>{[
          fig('bl', 'B · four managers · Light', <Leave t="light" v="B" />, 'Only the rejoin line is left.'),
          fig('bn', 'B · no draft time yet · Light', <Leave t="light" v="Bnotime" />, 'No draft time, so no rejoin line: the title and the two buttons.'),
        ]}</Grid>
      </section>
    );
  }

  window.KSLeaveBelowFour = () => null; // decided 2026-11-12: B; it lives in the Archive
  window.KSLeaveBelowFourArchived = () => (
    <CallLeaveBelowFour
      archived
      decided="B"
      decidedNote={<><b>Decided by Giorgio (2026-11-12): "B".</b> He was shown today, A and B side by side, with A as the recommendation. When your leave takes the league below four, the sheet drops the commissioner-choice line and keeps only the rejoin line; with no draft time yet, it's the title and the two buttons. Five or more is unchanged. A's new line was not taken. Recorded in PRODUCT_RULES ("The Leave sheet when your leave takes the league below four").</>}
    />
  );
})();
