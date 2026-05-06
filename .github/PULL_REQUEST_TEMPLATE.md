## What this changes

One paragraph. What does this PR do and why?

## How to verify

- [ ] `cargo test --manifest-path emulator/Cargo.toml` passes locally
- [ ] `cd web && npm run lint && npm run typecheck && npm test` passes locally
- [ ] `node scripts/verify-corpus.js` passes if the change touches the assembler, executor, or examples
- [ ] Manually exercised the change in `npm run dev` if it's UI-visible

## Notes for review

Anything tricky, or any decisions that could have gone the other way.
