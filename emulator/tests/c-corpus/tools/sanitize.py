#!/usr/bin/env python3
"""Regenerate the C corpus and compare it against the tracked files.

The corpus directory above this one holds, per program NAME:
    NAME.c            the source
    NAME.s            gcc's -O0 assembly, sanitized (what a student could paste)
    NAME.out          reference stdout from a real AArch64 run
    NAME.code         reference exit code, shell convention (128+N for signals)
    NAME.O2.s/.out/.code   the same at -O2 (a coverage tier, not a gate)
    NAME.stdin/.args/.flags   optional inputs and per-program compile flags

This script rebuilds all of that with a cross compiler and qemu-user and
fails when the rebuilt programs BEHAVE differently from the tracked
references (stdout or exit code), so toolchain drift becomes a signal
instead of silent rot. Assembly text is reported but never fails the
run: the tracked .s files were produced by the course server's own gcc,
and two gcc versions never emit identical text, so a text comparison
only means something under --write, which re-records everything with
the local toolchain:

    python3 sanitize.py regen             # both tiers, compare, report drift
    python3 sanitize.py regen --tier O0   # one tier
    python3 sanitize.py regen --only 03_control_flow
    python3 sanitize.py regen --write     # accept drift: rewrite tracked files

Needs: gcc-aarch64-linux-gnu, libc6-dev-arm64-cross, qemu-user, Python 3.10+.
The ordinary corpus test (cargo test --test c_corpus) needs none of this;
it replays the tracked files through the emulator.
"""

import argparse
import base64
import re
import subprocess
import sys
import tempfile
from pathlib import Path

CORPUS = Path(__file__).resolve().parent.parent

CFLAGS_BASE = [
    "-fno-asynchronous-unwind-tables",
    "-fno-unwind-tables",
    "-fno-stack-protector",
    "-fno-pie",
    "-fno-inline",            # keep the call graph the student would see
    "-fno-builtin",           # printf stays printf (no puts/putchar rewrites)
    "-U_FORTIFY_SOURCE",      # a distro -O2 default turns printf into __printf_chk
    "-Wall",
]
LDFLAGS = ["-static", "-no-pie", "-lm"]
LDFLAGS_FALLBACK = ["-no-pie", "-lm"]  # hosts with no static libc

# ---------------------------------------------------------------------------
# Sanitizer rules. Each row: (name, compiled regex on the stripped line, action).
# action is one of:
#   "drop"                  delete the line
#   ("replace", template)   substitute the line with template.format(**match.groupdict())
#   ("section", text)       force the section directive to the playground's spelling
#   "comm"                  collect a .comm into a synthesized .bss block
#   "base64"                decode a .base64 blob into .byte rows
# First matching row wins. Lines that match nothing pass through unchanged.
# The tables double as the documentation of what gcc emits that the
# playground does not take.
# ---------------------------------------------------------------------------
RULES = [
    # gcc 16 emits AArch64 build-attribute directives (BTI/PAC/GCS markers); metadata, not code
    ("aeabi",        re.compile(r"^\.aeabi_(subsection|attribute)\b"),        "drop"),
    # gcc 16 packs large rodata blobs as base64; decode to .byte rows so the playground can take them
    ("base64",       re.compile(r"^\.base64\s+\"(?P<b>[A-Za-z0-9+/=]*)\""),   "base64"),
    ("cfi",          re.compile(r"^\.cfi_"),                                   "drop"),
    ("file",         re.compile(r"^\.file\b"),                                 "drop"),
    ("ident",        re.compile(r"^\.ident\b"),                                "drop"),
    ("arch",         re.compile(r"^\.arch\b"),                                 "drop"),
    ("note",         re.compile(r"^\.section\s+\.note\."),                     "drop"),
    ("type",         re.compile(r"^\.type\b"),                                 "drop"),
    ("size",         re.compile(r"^\.size\b"),                                 "drop"),
    ("local",        re.compile(r"^\.local\b"),                                "drop"),
    ("comm",         re.compile(r"^\.comm\s+(?P<sym>[^,\s]+)\s*,\s*(?P<size>\d+)\s*(,\s*(?P<align>\d+))?"), "comm"),
    ("xword",        re.compile(r"^\.xword\b(?P<rest>.*)$"),                   ("replace", ".quad{rest}")),
    ("p2align",      re.compile(r"^\.p2align\s+(?P<n>\d+)"),                   ("replace", ".align {n}")),
    ("sect_rodata",  re.compile(r"^\.section\s+\.rodata"),                     ("section", ".section .rodata")),
    ("sect_text",    re.compile(r"^\.section\s+\.text"),                       ("section", ".text")),
    ("sect_data",    re.compile(r"^\.section\s+\.data"),                       ("section", ".data")),
    ("sect_bss",     re.compile(r"^\.section\s+\.bss"),                        ("section", ".bss")),
    # gcc pins section anchors with `.set .LANCHOR0, . + 0`: a label at the current address
    ("set_anchor",   re.compile(r"^\.(set|equ)\s+(?P<a>[^,\s]+)\s*,\s*\.\s*(\+\s*0)?\s*$"), ("replace", "{a}:")),
    # any other `.set A, B` alias; the playground spells that `A = B`
    ("set_alias",    re.compile(r"^\.(set|equ)\s+(?P<a>[^,\s]+)\s*,\s*(?P<b>.+)$"), ("replace", "{a} = {b}")),
    # glibc renames these through the headers (__isoc99_ on older glibc,
    # __isoc23_ from glibc 2.38); the playground knows the plain names
    ("isoc",         re.compile(r"^(?P<mn>bl)\s+__isoc(99|23)_(?P<fn>scanf|fscanf|sscanf|strtol)\b"), ("replace", "{mn} {fn}")),
]

# Identifier rewrites applied outside string literals on every surviving line.
IDENT_RULES = [
    # gcc names static locals `id.0`; the playground's lexer stops an identifier at a dot
    ("static_local", re.compile(r"(?<![\w.])([A-Za-z_]\w*)\.(\d+)\b"), r"\1__\2"),
    # gcc writes `[x0, #:lo12:sym]` for FP literal loads; the playground takes `:lo12:` bare
    ("hash_lo12",    re.compile(r"#:lo12:"), ":lo12:"),
]

INLINE_ASM_MARK = re.compile(r"^\s*#\s*(APP|NO_APP)\s*$")
QUOTED_SPAN = re.compile(r'"(?:[^"\\]|\\.)*"')

# Programs whose runtime behaviour under qemu-user differs from real
# hardware. Their tracked references come from the real machine and stay;
# regen under qemu skips the run comparison and says so.
QEMU_DIVERGES = {
    "45_misaligned_sp": "real hardware dies with SIGBUS before any output; "
                        "qemu-user tolerates the misaligned sp and runs on",
}


def rewrite_idents(line):
    # Rewrite around string literals, never inside them: split the line on
    # quoted spans and apply the rules to the unquoted stretches only.
    parts = []
    last = 0
    for m in QUOTED_SPAN.finditer(line):
        chunk = line[last:m.start()]
        for _, rx, rep in IDENT_RULES:
            chunk = rx.sub(rep, chunk)
        parts.append(chunk)
        parts.append(m.group(0))
        last = m.end()
    tail = line[last:]
    for _, rx, rep in IDENT_RULES:
        tail = rx.sub(rep, tail)
    parts.append(tail)
    return "".join(parts)


def sanitize(text):
    """Return the playground-ready form of one gcc assembly file."""
    out = []
    comms = []
    for raw in text.splitlines():
        line = raw.strip()
        if INLINE_ASM_MARK.match(line):
            continue
        handled = False
        for _, rx, action in RULES:
            m = rx.match(line)
            if not m:
                continue
            handled = True
            if action == "drop":
                pass
            elif action == "base64":
                data = base64.b64decode(m.groupdict()["b"])
                for i in range(0, len(data), 16):
                    out.append("\t.byte " + ", ".join(str(x) for x in data[i:i + 16]))
            elif action == "comm":
                g = m.groupdict()
                comms.append((g["sym"], g["size"], g["align"] or "8"))
            elif isinstance(action, tuple) and action[0] == "replace":
                out.append("\t" + rewrite_idents(action[1].format(**m.groupdict())))
            elif isinstance(action, tuple) and action[0] == "section":
                out.append("\t" + action[1])
            break
        if not handled:
            out.append(rewrite_idents(raw))
    if comms:
        out.append("")
        out.append("\t.bss")
        for sym, size, align in comms:
            out.append(f"\t.balign {align}")
            out.append(f"{rewrite_idents(sym)}:")
            out.append(f"\t.skip {size}")
    return "\n".join(out) + "\n"


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True,
                          timeout=kw.pop("timeout", 60), **kw)


def flags_for(name):
    f = CORPUS / f"{name}.flags"
    return f.read_text().split() if f.exists() else []


def regen_one(cc, qemu, name, tier, write, notes):
    """Rebuild one program at one tier; return a list of drift strings.

    Behaviour differences (stdout, exit code) and build failures are
    drift. A tracked .s whose text differs from the local rebuild is
    appended to notes instead: informative, never a failure."""
    infix = "" if tier == "O0" else f".{tier}"
    drift = []
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        c = CORPUS / f"{name}.c"
        # 1. assembly
        r = sh([cc, f"-{tier}", "-S", *CFLAGS_BASE, *flags_for(name),
                "-o", str(td / "a.s"), str(c)])
        if r.returncode != 0:
            return [f"{name} {tier}: compile failed\n{r.stderr[-1500:]}"]
        san = sanitize((td / "a.s").read_text())
        tracked_s = CORPUS / f"{name}{infix}.s"
        if not tracked_s.exists() or tracked_s.read_text().replace("\r\n", "\n") != san:
            # Text differs whenever the local gcc is not the one that made
            # the references; only behaviour decides pass or fail.
            notes.append(f"{name} {tier}")
            if write:
                tracked_s.write_text(san)
        # 2. reference run
        if name in QEMU_DIVERGES:
            print(f"[skip run] {name}: {QEMU_DIVERGES[name]}")
            return drift
        r = sh([cc, f"-{tier}", *CFLAGS_BASE, *flags_for(name),
                "-o", str(td / "a.out"), str(c), *LDFLAGS])
        if r.returncode != 0:
            r = sh([cc, f"-{tier}", *CFLAGS_BASE, *flags_for(name),
                    "-o", str(td / "a.out"), str(c), *LDFLAGS_FALLBACK])
        if r.returncode != 0:
            return drift + [f"{name} {tier}: link failed\n{r.stderr[-1500:]}"]
        stdin_p = CORPUS / f"{name}.stdin"
        args_p = CORPUS / f"{name}.args"
        args = args_p.read_text().split() if args_p.exists() else []
        rr = subprocess.run([qemu, str(td / "a.out"), *args],
                            input=stdin_p.read_bytes() if stdin_p.exists() else b"",
                            capture_output=True, timeout=60, cwd=td)
        # Signals: subprocess reports -N; the tracked files use the shell
        # convention 128+N, which is what the real server records.
        code = rr.returncode if rr.returncode >= 0 else 128 - rr.returncode
        tracked_out = CORPUS / f"{name}{infix}.out"
        tracked_code = CORPUS / f"{name}{infix}.code"
        if not tracked_out.exists() or tracked_out.read_bytes() != rr.stdout:
            drift.append(f"{name} {tier}: stdout drifted")
            if write:
                tracked_out.write_bytes(rr.stdout)
        if not tracked_code.exists():
            drift.append(f"{name} {tier}: exit-code file missing")
        elif int(tracked_code.read_text().strip()) != code:
            drift.append(f"{name} {tier}: exit code {code} vs tracked "
                         f"{tracked_code.read_text().strip()}")
        if write:
            tracked_code.write_text(f"{code}\n")
    return drift


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["regen"])
    ap.add_argument("--tier", choices=["O0", "O2"], default=None,
                    help="one tier only (default: both)")
    ap.add_argument("--only", help="one program stem")
    ap.add_argument("--write", action="store_true",
                    help="rewrite tracked files instead of failing on drift")
    ap.add_argument("--cc", default="aarch64-linux-gnu-gcc")
    ap.add_argument("--qemu", default="qemu-aarch64")
    opts = ap.parse_args()

    names = sorted(p.stem for p in CORPUS.glob("*.c"))
    if opts.only:
        names = [n for n in names if n == opts.only]
        if not names:
            sys.exit(f"no program named {opts.only}")
    tiers = [opts.tier] if opts.tier else ["O0", "O2"]

    all_drift = []
    text_notes = []
    for name in names:
        for tier in tiers:
            try:
                all_drift += regen_one(opts.cc, opts.qemu, name, tier, opts.write,
                                       text_notes)
            except subprocess.TimeoutExpired as e:
                # One hung compile or run marks its program and moves on.
                all_drift.append(f"{name} {tier}: timed out ({e.cmd[0]})")
    if text_notes:
        print(f"assembly text differs from the tracked files for "
              f"{len(text_notes)} of {len(names) * len(tiers)} rebuilds. "
              f"That is expected under any gcc other than the one that "
              f"produced the references; behaviour was compared instead.")
    if all_drift:
        print(f"{len(all_drift)} drift item(s):")
        for d in all_drift:
            print("  " + d)
        sys.exit(0 if opts.write else 1)
    print(f"{len(names)} program(s) x {len(tiers)} tier(s): behaviour matches the references")


if __name__ == "__main__":
    main()
