// Stockpile key-screens board — "Your call: the worst-week bear" (2026-11-25).
// Giorgio, 2026-11-25: "dont do a bear head, do a small full bear like the one of the CA flag", then, with a picture of
// a friendly cartoon bear face, "or a bear like this". Two bears, both our own drawings:
//   A · a small whole bear walking in profile: the POSE he named; nothing traced or copied from the flag.
//   B · a friendly smiling bear face in the spirit of his picture, simplified to what survives small. His picture is
//       someone else's drawing (it reads as an existing mascot): character only; our own shapes and our own colours
//       (honey and dark brown, not its yellow and navy). It is never copied, traced, or put in the repo.
// Each on the shield (his pick, #call-crest-look), large and at 20pt (the smallest mark, "Owned by …"), in both themes
// and greyscale, with his DOG ("beat manager in first place should be a dog bc underdog") beside it at both sizes.
// Stand-in shield colours: the split and final colours come with the full set. No words. Review notes under the art.
(function () {
  const Th = ({ t, children }) => <div className={`dr dir-a${t === 'light' ? ' dir-a-light' : ''}`}>{children}</div>;
  const DARK = '#3A2410';

  // ── The three symbols, drawn on a 24 grid. ──
  function BearWalk() {
    // Facing left, head low, the shoulder hump, four legs: one long low shape.
    // A bear's signature: a high shoulder hump, the back sloping DOWN to a lower rump, the head carried low and
    // forward, short round ear, heavy legs. (A level back reads as a pig.)
    return <path fill="#F3E6C8" d="M2 13.3 C1.9 12.6 2.3 12 3.1 11.6 C3.8 10.6 4.7 9.8 5.6 9.5 L6 8.3 C6.3 7.8 7.1 7.8 7.4 8.3 L7.8 9 C8.6 7.4 9.9 6.3 11.6 6.2 C13.8 6.1 15.8 7.1 17.8 8.1 C19.8 9 21.5 10.2 21.9 12 C22.2 13 21.9 13.9 21.3 14.4 L21.1 17.6 L19.1 17.6 L18.7 15 L17.3 15.1 L17 17.6 L15 17.6 L14.9 15 C13.6 15.1 12.2 15 11 14.7 L10.7 17.6 L8.7 17.6 L8.6 14.6 L7.7 14.5 L7.4 17.6 L5.4 17.6 L5.5 14.8 C4.7 15.1 3.8 15 3.1 14.6 C2.5 14.3 2.1 13.9 2 13.3 Z" />;
  }
  function BearFace() {
    // Round ears ON TOP, a wide round head, a pale muzzle, a big dark nose, a wide smile.
    return (
      <g>
        <circle cx="5.6" cy="6.6" r="2.9" fill="#E8B23A" /><circle cx="18.4" cy="6.6" r="2.9" fill="#E8B23A" />
        <circle cx="5.6" cy="6.6" r="1.3" fill="#B97C16" /><circle cx="18.4" cy="6.6" r="1.3" fill="#B97C16" />
        <ellipse cx="12" cy="13" rx="8.4" ry="7.4" fill="#E8B23A" />
        <ellipse cx="12" cy="16.1" rx="5.4" ry="3.7" fill="#FFF4DC" />
        <circle cx="8.7" cy="11" r="1.2" fill={DARK} /><circle cx="15.3" cy="11" r="1.2" fill={DARK} />
        <ellipse cx="12" cy="14" rx="2" ry="1.4" fill={DARK} />
        <path d="M8.4 16.2 Q12 20.2 15.6 16.2" fill="none" stroke={DARK} strokeWidth="1.5" strokeLinecap="round" />
      </g>
    );
  }
  function Dog() {
    // Long ears HANGING at the sides, a narrower head, a muzzle: wide at the bottom where the bear is wide at the top.
    return (
      <g>
        <path fill="#5A3A20" d="M7.2 7.4 C4.2 6.8 2.6 9.4 3 13.6 C3.3 16.4 5.6 16.6 6.6 14.4 L7.6 9.6 Z" />
        <path fill="#5A3A20" d="M16.8 7.4 C19.8 6.8 21.4 9.4 21 13.6 C20.7 16.4 18.4 16.6 17.4 14.4 L16.4 9.6 Z" />
        <ellipse cx="12" cy="12.6" rx="5.6" ry="6.6" fill="#F3E6C8" />
        <ellipse cx="12" cy="16.2" rx="3.4" ry="2.8" fill="#FFFFFF" />
        <circle cx="9.6" cy="11.2" r="1" fill={DARK} /><circle cx="14.4" cy="11.2" r="1" fill={DARK} />
        <ellipse cx="12" cy="14.8" rx="1.6" ry="1.1" fill={DARK} />
      </g>
    );
  }
  const ART = {
    bearA: { draw: BearWalk, fill: '#4A5568', s: 0.72, dy: 0.6 },
    bearB: { draw: BearFace, fill: '#4A5568', s: 0.66, dy: 0.2 },
    dog: { draw: Dog, fill: '#2E8B57', s: 0.66, dy: 0.4 },
  };
  function Crest({ k, size }) {
    const a = ART[k];
    const S = window.KSShieldOutline;
    const D = a.draw;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: `0 0 ${size}px` }}>
        <path d={S} fill={a.fill} />
        <g transform={`translate(12 ${12 + a.dy}) scale(${a.s}) translate(-12 -12)`}><D /></g>
        <path d={S} fill="none" stroke="rgba(0,0,0,.32)" strokeWidth="0.8" />
      </svg>
    );
  }

  /** One panel: the crests large, then each at 20pt beside a name as on "Owned by …". */
  function Panel({ t, keys, grey, label }) {
    const names = { bearA: 'Paolo M.', bearB: 'Sofia R.', dog: 'Elena V.' };
    return (
      <Th t={t}>
        <div role="img" aria-label={label} style={{ background: 'var(--c-bg)', padding: 18, borderRadius: 16, display: 'grid', gap: 16, filter: grey ? 'grayscale(1)' : 'none', width: 'max-content' }}>
          <div style={{ display: 'flex', gap: 22, alignItems: 'end' }}>{keys.map((k) => <Crest key={k} k={k} size={110} />)}</div>
          <div style={{ display: 'flex', gap: 26 }}>
            {keys.map((k) => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--c-text-2)', whiteSpace: 'nowrap' }}>
                Owned by <Crest k={k} size={20} /><b style={{ color: 'var(--c-text)', fontWeight: 600 }}>{names[k]}</b>
              </span>
            ))}
          </div>
        </div>
      </Th>
    );
  }
  /** The 20pt marks at screen size, then at 60 pixels: on a 3x iPhone, 20pt IS drawn with 60 pixels. */
  function Zoom({ t, keys, grey }) {
    return (
      <Th t={t}>
        <div role="img" aria-label={`The crests at 20 points, on the page and as a phone draws it, ${t}${grey ? ', greyscale' : ''}`} style={{ background: 'var(--c-bg)', padding: 18, borderRadius: 16, display: 'flex', gap: 28, alignItems: 'center', filter: grey ? 'grayscale(1)' : 'none', width: 'max-content' }}>
          {keys.map((k) => (
            <div key={k} style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
              <Crest k={k} size={20} />
              <Crest k={k} size={60} />
            </div>
          ))}
        </div>
      </Th>
    );
  }

  const fig = (key, cap, node, note) => (
    <figure key={key} className="b-fig b-fig--inv" style={{ margin: 0, alignContent: 'start' }}>{node}<figcaption><b>{cap}</b>{note ? <span className="b-annot">Review note: {note}</span> : null}</figcaption></figure>
  );
  const Row = ({ children }) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, margin: '6px 0 28px' }}>{children}</div>;
  const Sub = ({ children }) => <h3 className="b-sub">{children}</h3>;

  function CallCrestBear({ archived = false, decidedNote }) {
    return (
      <section className="b-sec" id="call-crest-bear" aria-labelledby="call-crest-bear-h">
        <header className="b-sec__head">
          <span className="b-sec__n b-sec__n--code">Crests</span>
          <div>
            <h2 id="call-crest-bear-h">{archived ? 'Decided: the worst-week bear' : 'Your call: the worst-week bear'}</h2>
            <p className="b-job">The two bears you asked for, both drawn new for us, each on the shield beside your dog.</p>
          </div>
        </header>
        <ul className="b-inv__notes">
          <li><b>A · a whole bear, walking</b>, in the pose of the flag you named (drawn new; nothing taken from the flag). <b>B · a friendly face</b>, in the spirit of the picture you sent, simplified for a small size and drawn new in our own colours, so it doesn’t read as that mascot.</li>
          <li><b>Your dog beside each</b> (beat the manager in first place). The dog is a face with long ears hanging at its sides; bear B is a face with round ears on top; bear A is a whole animal, long and low.</li>
          <li><b>At 20pt (the smallest a crest is drawn):</b> B and the dog can be told apart, in both themes and in grey: the bear’s round ears sit on top of its head, the dog’s long dark ears hang at its sides, so the outlines differ before any colour. A and the dog differ even more: one is a whole animal, long and low; the other is a face. (The dog’s ears are drawn dark so they don’t vanish into the green shield in grey.)</li>
          <li><b>Does B keep its smile at 20pt?</b> Yes, on a phone: at 20pt an iPhone draws the crest with 60 pixels and the smile is a clear dark curve under the nose (bottom row). It is the smallest part of the drawing, so it’s the first thing to go on a smaller screen; the face still reads as a bear without it.</li>
          <li><b>Recommended: B.</b> At 20pt the face reads as a bear at a glance. A is a bear only once you see the shoulder hump; at that size it needs a second look and can pass for another animal.</li>
          <li><b>No words.</b> The shield colours are stand-ins; the set’s colours and splits come with the full drawing.</li>
          <li>{archived ? decidedNote : <><b>Answer with:</b> A or B.</>}</li>
        </ul>

        <Sub>A · a whole bear, walking</Sub>
        <Row>{[
          fig('al', 'A beside the dog · Light', <Panel t="light" keys={['bearA', 'dog']} label="Bear A walking and the dog, large and at 20 points, Light" />),
          fig('ad', 'A beside the dog · Dark', <Panel t="dark" keys={['bearA', 'dog']} label="Bear A and the dog, Dark" />),
          fig('ag', 'A beside the dog · greyscale', <Panel t="light" grey keys={['bearA', 'dog']} label="Bear A and the dog, greyscale" />),
        ]}</Row>

        <Sub>B · a friendly face</Sub>
        <Row>{[
          fig('bl', 'B beside the dog · Light', <Panel t="light" keys={['bearB', 'dog']} label="Bear B face and the dog, large and at 20 points, Light" />),
          fig('bd', 'B beside the dog · Dark', <Panel t="dark" keys={['bearB', 'dog']} label="Bear B and the dog, Dark" />),
          fig('bg', 'B beside the dog · greyscale', <Panel t="light" grey keys={['bearB', 'dog']} label="Bear B and the dog, greyscale" />),
        ]}</Row>

        <Sub>All three at 20pt, on the page and as a phone draws it</Sub>
        <Row>{[
          fig('zl', 'Light', <Zoom t="light" keys={['bearA', 'bearB', 'dog']} />, 'Top: 20pt at this page’s size. Below: 20pt as your phone draws it (an iPhone draws 20pt with 60 pixels), shown larger so you can judge it.'),
          fig('zd', 'Dark', <Zoom t="dark" keys={['bearA', 'bearB', 'dog']} />),
          fig('zg', 'Greyscale', <Zoom t="light" grey keys={['bearA', 'bearB', 'dog']} />),
        ]}</Row>
      </section>
    );
  }

  window.KSCrestBear = () => <CallCrestBear />;
  window.KSCrestBearArchived = () => null;
})();
