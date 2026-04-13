# Getting started

New to the playground. Five minutes to your first running program.

## What this is

A browser-based ARM64 emulator. You type assembly on the left, hit **assemble**, then step through it one instruction at a time and watch every register and memory byte change. There's nothing to install -- it all runs locally in your browser via WebAssembly.

## Your first program

Open the playground. You'll see a default factorial example already loaded. Press **assemble**, then **step** repeatedly and watch `X0` count down while `X1` grows.

Now clear the editor and type this:

```asm
    MOV X0, #10        // put 10 in X0
    MOV X1, #3         // put 3 in X1
    ADD X2, X0, X1     // X2 = X0 + X1 = 13
    SVC #0             // halt
```

Press **assemble**. The disassembly panel at the bottom shows each instruction's hex encoding. Now press **step** four times. After the third step `X2` should highlight yellow to indicate it changed, and show the value `0x000000000000000d` (= 13). The fourth step halts the CPU.

## The controls

| Button    | Shortcut    | What it does                           |
| --------- | ----------- | -------------------------------------- |
| assemble  | `F6`        | Parse and load the program.            |
| run       | `F5`        | Execute until halt, breakpoint, error. |
| step      | `F10`       | Execute one instruction.               |
| pause     | `F5` (again)| Stop running. Resumes with run.        |
| reset     | `Shift+F5`  | Zero registers and memory.             |

## Setting breakpoints

Click in the left gutter of any source line. A red dot appears; the running program will stop just before executing that line.

## Reading the panels

- **Registers** -- X0 through X30, plus SP and PC. Values that changed in the last step are yellow. The NZCV row shows the condition flags.
- **Memory** -- hex dump of a 256-byte slice. Type a hex address in the box to jump anywhere. Unmapped pages read as zeros.
- **Stack** -- shows the bytes around SP, with the current SP highlighted.
- **Disassembly** -- one row per encoded instruction, with its address, hex, and source text. The current PC is highlighted.

## Examples

The **load example** dropdown at the top has five programs to read:

- `factorial` -- computes 5! = 120 using a loop and `MUL`.
- `fibonacci` -- iterative fib, computing `fib(10) = 55`.
- `string reverse` -- in-place reverse of "HELLO" in memory.
- `bubble sort` -- sorts five values stored on the stack.
- `gcd` -- Euclidean algorithm, computing `gcd(48, 18) = 6`.

Each is a good starting point for your own programs -- load it, change a constant, hit **assemble**, step through.

## Which instructions work

See [`instruction-reference.md`](instruction-reference.md) for the full list. The short version:

- Arithmetic: `ADD`, `SUB`, `MUL`, `UDIV`, `SDIV`, `NEG`.
- Logic: `AND`, `ORR`, `EOR`, `MVN`, `LSL`, `LSR`, `ASR`.
- Flag-setting variants: `ADDS`, `SUBS`, `ANDS`, `CMP`, `CMN`, `TST`.
- Memory: `LDR`, `STR` (and their byte/halfword variants), `LDP`, `STP`.
- Branches: `B`, `BL`, `BR`, `BLR`, `RET`, and all the `B.cond` forms.
- Select: `CSEL`, `CSINC`, `CSET`.
- System: `NOP`, `SVC #0` (halt).

Write `//` or `;` for comments. Labels end with a colon on their own line.

## Where to next

Start with the examples. Change them. Break them. Read [`instruction-reference.md`](instruction-reference.md) when you want to know exactly what a mnemonic accepts. If you want to see how the emulator is built, [`ARCHITECTURE.md`](ARCHITECTURE.md) is a good tour.
