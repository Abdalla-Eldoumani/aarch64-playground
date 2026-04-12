# aarch64-playground

A browser-based ARMv8 (AArch64) instruction emulator with a visual debugger. Write ARM64 assembly, hit Run, and watch every instruction execute. Inspect registers, memory, and the stack in real time. No installs, no QEMU.

## How it works

The emulator core is a pure Rust ARM64 interpreter compiled to WebAssembly. The frontend is a Next.js app with a Monaco editor and live state panels.

## Build

```bash
# Build the WASM module
cd emulator
wasm-pack build --target web --out-dir ../web/lib/wasm

# Install web deps and run
cd ../web
npm install
npm run dev
```

Open http://localhost:3000.

## Supported instructions

A focused teaching subset of ARMv8: MOV, ADD, SUB, AND, ORR, EOR, LSL, LSR, LDR, STR, LDP, STP, B, BL, BR, BLR, RET, B.cond, CMP, CMN, TST, CSEL, CSET, NOP. See `docs/instruction-reference.md` for the full list.

## License

MIT
