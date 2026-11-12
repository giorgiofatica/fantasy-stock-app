// Stockpile key-screens board — "For your sign-off: the other dead-end screens, in the taken screen's form"
// (2026-11-12). Giorgio said the takeover refusal "Someone already took this team." "does not fit the
// format and theme of the app" and picked A (via the Planner, PR #442): a person icon, the sentence as
// the screen heading, "Go to Home" as the docked primary button, built like the takeover question. The
// same yellow panel + text link is used by every other dead end on the takeover and invite links, so
// this board draws each of them in A's form. Words unchanged. Review notes sit UNDER the phones.
(function () {
  const { Device, Icon } = window.KSKit;
  const GN = window.KSGN;
  const { Fit } = GN;

  const k = (x, cap) => Math.min(x, cap || x);
  const fs = (px, x, cap, lh = 1.25) => ({ fontSize: Math.round(px * k(x, cap)), lineHeight: `${Math.round(px * lh * k(x, cap))}px` });
  const AX5 = 3.1;
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;

  // The icons (pictures only, no words). Person: approved for "taken".
  const GLYPH = {
    person: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6'],
    link: ['M9.5 14.5l-1.8 1.8a3.2 3.2 0 0 1-4.5-4.5l2.6-2.6a3.2 3.2 0 0 1 4.3-.2', 'M14.5 9.5l1.8-1.8a3.2 3.2 0 0 1 4.5 4.5l-2.6 2.6a3.2 3.2 0 0 1-4.3.2', 'M4 4l16 16'],
    league: ['M8 4h8v5a4 4 0 0 1-8 0V4z', 'M12 13v4', 'M8 20h8', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4'],
    clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
    offline: ['M2 9a15 15 0 0 1 6.5-3.6', 'M22 9a15 15 0 0 0-8-3.9', 'M5.5 12.5a10 10 0 0 1 3-1.9', 'M18.5 12.5a10 10 0 0 0-2.4-1.6', 'M9 16a5 5 0 0 1 6 0', 'M12 20h.01', 'M3 3l18 18'],
  };
  function Disc({ g }) {
    return (
      <span style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--c-inset)', display: 'grid', placeItems: 'center', color: 'var(--c-text-2)' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLYPH[g].map((d) => <path key={d} d={d} />)}</svg>
      </span>
    );
  }

  /** A's form: the icon, the heading, an optional follow-up line, then the docked way out. */
  function Refusal({ t, x = 1, label, g, heading, line, primary, secondary }) {
    return (
      <Th t={t}>
        <Device noTabs label={label}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px', textAlign: 'center' }}>
              <Disc g={g} />
              <span style={{ ...fs(30, x, 1.6, 1.15), fontWeight: 800, color: 'var(--c-text)' }}>{heading}</span>
              {line ? <span style={{ ...fs(17, x, 2), color: 'var(--c-text-2)', marginTop: -6 }}>{line}</span> : null}
            </div>
            <div style={{ padding: '0 20px 24px', display: 'grid', gap: 6 }}>
              {primary ? <span style={{ display: 'grid', placeItems: 'center', minHeight: Math.round(52 * k(x, 1.3)), borderRadius: 30, ...fs(17, x, 1.6), fontWeight: 700, background: 'var(--c-accent)', color: 'var(--c-on-accent)' }}>{primary}</span> : null}
              {secondary ? <span style={{ display: 'grid', placeItems: 'center', minHeight: 44, ...fs(17, x, 1.6), fontWeight: 700, color: 'var(--c-text-2)' }}>{secondary}</span> : null}
            </div>
          </div>
        </Device>
      </Th>
    );
  }

  // Each dead end, in A's form. Words are the shipped ones; a two-sentence refusal splits at its full stop:
  // the first sentence is the heading, the second (what to do) the one line under it.
  const STATES = [
    { id: 'taken', name: 'Takeover link, the team is taken (decided: A)', g: 'person', heading: 'Someone already took this team.', primary: 'Go to Home', today: '"Someone already took this team." in the yellow panel + "Go to Home" as a link.' },
    { id: 'dead', name: 'Takeover link that no longer works', g: 'link', heading: 'This invite link doesn’t work anymore.', line: 'Ask for a new one.', primary: 'Go to Home', today: 'The invite’s dead-link sentence in the yellow panel + "Go to Home" as a link.' },
    { id: 'member', name: 'Takeover link when you’re already in the league', g: 'league', heading: 'You’re already in Stock Scudetto.', primary: 'Open the league', today: '"You’re already in {league}." in the yellow panel + "Open the league" as a link. (With no league name the app just opens Home, as today.)' },
    { id: 'wait', name: 'Takeover link after too many tries (a short wait)', g: 'clock', heading: 'Too many tries.', line: 'Wait a moment, then try again.', primary: 'Try again', secondary: 'Not now', today: 'The wait line in the yellow panel + "Try again" and "Not now" as links.' },
    { id: 'later', name: 'Takeover link after too many tries (an hour)', g: 'clock', heading: 'Too many tries.', line: 'Try again later.', primary: 'Not now', today: '"Too many tries. Try again later." in the yellow panel + "Not now" as a link (no Try again: it would fail).' },
    { id: 'offline', name: 'Takeover link that can’t reach the league', g: 'offline', heading: 'Couldn’t reach the league.', line: 'Check your connection, then try again.', primary: 'Try again', secondary: 'Not now', today: 'The unreachable line in the yellow panel + "Try again" and "Not now" as links.' },
    { id: 'invite', name: 'Invite link that no longer works (before sign-in)', g: 'link', heading: 'This invite link doesn’t work anymore.', line: 'Ask for a new one.', primary: 'Sign in', today: 'The dead-link sentence in the yellow panel + "Sign in" as a link, for someone who already has an account.' },
  ];

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0 }}><Fit>{node}</Fit><figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );

  function RefusalFamily({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-refusal-family" aria-labelledby="call-refusal-family-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Links</span>
          <div>
            <h2 id="call-refusal-family-h">{archived ? 'Signed off: the other dead-end screens, in the taken screen’s form' : 'For your sign-off: the other dead-end screens, in the taken screen’s form'}</h2>
            <p className="b-job">You picked A for "Someone already took this team.": a picture, the sentence as the heading, and the way out as a big button at the bottom. Every other dead end on a takeover or invite link uses the same yellow box and small link today, so here they all are in A's form. Light and Dark, at Large and at your text size. Same words as today.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>One layout for every dead end.</b> A picture in a grey circle, the sentence as the heading, and the way out as the big button at the bottom, where your thumb is. Where there's a second way out ("Not now"), it sits under the button in grey.</li>
          <li><b>Sentences that came in pairs are split, not rewritten.</b> "This invite link doesn't work anymore. Ask for a new one." becomes the heading and one line under it; the same for "Too many tries." and "Couldn't reach the league." The second sentence stays because it says what to do (rule 12 keeps that kind of line). No word changes.</li>
          <li><b>The pictures</b> (no words): a person for a taken team (yours), a broken link for a dead link, the trophy for "already in", a clock for a wait, a crossed-out signal for no connection.</li>
          <li><b>At your text size</b> the line under the heading grows to twice its size and stops there, so it never ends up bigger than the heading it belongs to.</li>
          <li><b>"Too many tries. Try again later."</b> has no Try again today (it would fail for an hour), so "Not now" becomes its big button.</li>
          <li><b>Not in this set:</b> the invite's "full" and "not taking players" lines, which keep their place above Sign in on the invite screen (they're about the league, not a dead link), and Join's lines inside the Join sheet.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> OK, or point at the ones you'd change.</>}</li>
        </ul>
        {STATES.map((s) => (
          <React.Fragment key={s.id}>
            <h3 className="b-sub">{s.name}</h3>
            <div className="b-concepts b-concepts--three">{[
              fig(`${s.id}-ll`, 'Light · Large', <Refusal t="light" label={`${s.name}, Light, Large`} {...s} />, `Today: ${s.today}`),
              fig(`${s.id}-dl`, 'Dark · Large', <Refusal t="dark" label={`${s.name}, Dark, Large`} {...s} />),
              fig(`${s.id}-la`, 'Light · your size (AX5, approximate)', <Refusal t="light" x={AX5} label={`${s.name}, Light, AX5`} {...s} />),
              fig(`${s.id}-da`, 'Dark · your size (AX5, approximate)', <Refusal t="dark" x={AX5} label={`${s.name}, Dark, AX5`} {...s} />),
            ]}</div>
          </React.Fragment>
        ))}
      </section>
    );
  }

  window.KSRefusalFamily = () => null; // signed off 2026-11-12; it lives in the Archive
  window.KSRefusalFamilyArchived = () => (
    <RefusalFamily
      archived
      decidedNote={<><b>Signed off by Giorgio (2026-11-12): "all screens look good".</b> He was shown all seven, with the small grey second lines pointed out against the no-subtext rule, and kept them. The split at the full stop and the 2x cap on the second line went with it. Recorded in PRODUCT_RULES ("Every dead end on a takeover or invite link takes the same form").</>}
    />
  );
})();
