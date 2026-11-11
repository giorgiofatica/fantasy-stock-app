# Progress log

A dated, plain-English record of what happened: what shipped, what Giorgio decided, what is
waiting on him, and what is next. Newest first. Written by the **Recorder**
([`README.md`](README.md), "The Recorder").

**This is not the source of truth.** [`STATUS.md`](STATUS.md) says what is true now
(deployed, open, blocked). This file says what happened and when. Every fact here also lives
where it belongs (`STATUS.md`, a plan, `PRODUCT_RULES.md`, a PR); nothing lives only here.

## Entry format

```markdown
## YYYY-MM-DD

**Shipped** — what reached players or prod, each with its evidence (PR, migration version
verified by query, build number with its commit).
**Merged, not confirmed live** — on `main`, no evidence of the effect yet.
**Decided** — Giorgio's rulings that day, one line each, pointing at `PRODUCT_RULES.md`.
**Waiting on Giorgio** — his own steps and open decisions.
**Next** — what the Orchestrator builds next and what the Design Lead is drawing.
```

Entries begin with the Recorder's first pass.
