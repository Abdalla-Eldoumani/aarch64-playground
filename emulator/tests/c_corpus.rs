//! The C corpus: fifty small C programs compiled by gcc, their assembly
//! replayed here, their stdout and exit codes required to match what a
//! real AArch64 Linux machine produced. The references and the method
//! live in c-corpus/README.md; regeneration is c-corpus/tools/sanitize.py.
//!
//! Programs are discovered by directory scan, so adding one is a set of
//! files, not an edit here.

use std::fs;
use std::path::{Path, PathBuf};

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// Programs that crash on purpose. The run must halt with the named
/// diagnosis (the playground's improvement over the server's bare
/// `Segmentation fault`); stdout is not compared.
const EXPECTED_FAULTS: &[(&str, &str)] = &[
    ("44_null_deref", "segmentation"),
    ("45_misaligned_sp", "bus error"),
    ("46_stack_overflow", "stack overflow"),
];

/// Programs expected to fail assembly at every tier, with the reason. An
/// entry that starts assembling flips this list red, so a fix is recorded
/// instead of passing silently. Empty since the 128-bit register file
/// landed: 13_float_double copied a 16-byte struct through a q register
/// and now assembles and matches at both tiers.
const PENDING: &[(&str, &str)] = &[];

/// The same, for the optimized tier alone: these assemble and match at
/// -O0 and reach a form only gcc's optimizer emits.
const PENDING_O2: &[(&str, &str)] = &[
    (
        "13_float_double",
        "the optimizer zeroes the struct with `movi d31, #0`; the -O0 tier's q copies assemble",
    ),
    (
        "14_float_single",
        "gcc zeroes a float with `movi v0.2s, #0`; the MOVI immediate family is not implemented yet",
    ),
];

/// One run's budget. The slowest passing program at -O0 (21_long_loop,
/// three million C loop iterations) spends about 50M steps; the wall
/// exists so a runaway regression fails with the step-ceiling message
/// instead of spinning the suite.
const STEP_BUDGET: u64 = 200_000_000;

fn corpus_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join("c-corpus")
}

fn read_text(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok().map(|t| t.replace("\r\n", "\n"))
}

struct Outcome {
    stdout: Vec<u8>,
    exit_code: Option<i64>,
    error: Option<String>,
    steps: u64,
}

fn run_program(dir: &Path, stem: &str, infix: &str) -> Result<Outcome, String> {
    let src = read_text(&dir.join(format!("{stem}{infix}.s")))
        .ok_or_else(|| format!("{stem}: missing .s"))?;
    let mut cpu = Cpu::new();
    cpu.set_max_total_steps(STEP_BUDGET);
    let image = assemble_hosted(&src, &cpu.host).map_err(|e| format!("{stem}: {e}"))?;

    let args_line = read_text(&dir.join(format!("{stem}.args"))).unwrap_or_default();
    let args: Vec<&str> = args_line.split_whitespace().collect();
    cpu.load_linked_image_with_args(&image, &args)
        .map_err(|e| format!("{stem}: load failed: {e}"))?;

    if let Ok(stdin) = fs::read(dir.join(format!("{stem}.stdin"))) {
        let stdin = String::from_utf8_lossy(&stdin).replace("\r\n", "\n");
        cpu.push_stdin(stdin.as_bytes());
    }
    // Every corpus run is a `< file` redirect: an empty queue reads as
    // EOF, never as "wait for the console".
    cpu.close_stdin();

    // The wall is the budget; the chunk overshoots it slightly so the
    // ceiling fires INSIDE run_until_break with its calm message, never
    // as a silent chunk exhaustion out here.
    let mut steps: u64 = 0;
    let mut error = None;
    loop {
        let chunk = (STEP_BUDGET + 16 - steps).min(u32::MAX as u64 - 1) as u32;
        if chunk == 0 {
            break;
        }
        let r = cpu
            .run_until_break(chunk)
            .map_err(|e| format!("{stem}: run failed: {e}"))?;
        steps += r.steps_executed as u64;
        if r.error.is_some() {
            error = r.error.clone();
        }
        if r.halted || cpu.is_blocked() {
            break;
        }
        if r.steps_executed == 0 {
            // A sleep with nothing left to consume would spin here.
            break;
        }
    }
    Ok(Outcome {
        stdout: cpu.take_stdout(),
        exit_code: cpu.exit_code(),
        error,
        steps,
    })
}

/// One tier's outcome. `passing` counts the programs that actually
/// matched their reference, so a PENDING program (kept out of
/// `failures` because its gap is already recorded) never inflates it.
struct TierResult {
    passing: usize,
    failures: Vec<String>,
}

fn check_tier(infix: &str) -> TierResult {
    let dir = corpus_dir();
    let mut stems: Vec<String> = fs::read_dir(&dir)
        .expect("c-corpus directory exists")
        .filter_map(|e| {
            let name = e.ok()?.file_name().into_string().ok()?;
            name.strip_suffix(".c").map(str::to_string)
        })
        .collect();
    stems.sort();
    assert!(stems.len() >= 50, "corpus shrank: {} programs", stems.len());

    // CI slices the corpus across parallel runners: CORPUS_SHARD=i/n takes
    // every nth program starting at the ith of the sorted list, so the
    // union of the shards is exactly the corpus and no program runs twice.
    // The count guard above sits before the slice on purpose (a shrunken
    // corpus must fail every shard, not just the one missing a program),
    // and a plain local `cargo test` still runs all fifty.
    if let Some(spec) = std::env::var("CORPUS_SHARD").ok().filter(|s| !s.is_empty()) {
        let parsed = spec
            .split_once('/')
            .and_then(|(i, n)| Some((i.parse::<usize>().ok()?, n.parse::<usize>().ok()?)));
        let (index, count) = match parsed {
            Some((i, n)) if 1 <= i && i <= n => (i, n),
            _ => panic!("CORPUS_SHARD must be i/n with 1 <= i <= n, got {spec:?}"),
        };
        stems = stems
            .into_iter()
            .enumerate()
            .filter(|(position, _)| position % count == index - 1)
            .map(|(_, stem)| stem)
            .collect();
    }

    let mut failures = Vec::new();
    let mut passing = 0usize;
    let mut slowest = (0u64, String::new());
    for stem in &stems {
        let tier_pending: &[(&str, &str)] = if infix == ".O2" { PENDING_O2 } else { &[] };
        let pending = PENDING.iter().chain(tier_pending).find(|(s, _)| s == stem);
        let outcome = match run_program(&dir, stem, infix) {
            Ok(o) => {
                if let Some((_, why)) = pending {
                    failures.push(format!(
                        "{stem}: assembles now (was pending: {why}); move it off PENDING"
                    ));
                    continue;
                }
                o
            }
            Err(e) => {
                if pending.is_none() {
                    failures.push(e);
                }
                continue;
            }
        };
        if let Some((_, fragment)) = EXPECTED_FAULTS.iter().find(|(s, _)| s == stem) {
            match &outcome.error {
                Some(msg) if msg.contains(fragment) => passing += 1,
                other => failures.push(format!(
                    "{stem}: expected a halt naming {fragment:?}, got {other:?}"
                )),
            }
            continue;
        }
        if let Some(err) = &outcome.error {
            failures.push(format!("{stem}: runtime error: {err}"));
            continue;
        }
        let want_out = fs::read(dir.join(format!("{stem}{infix}.out")))
            .unwrap_or_else(|_| panic!("{stem}: missing .out"));
        let want_code: i64 = read_text(&dir.join(format!("{stem}{infix}.code")))
            .unwrap_or_else(|| panic!("{stem}: missing .code"))
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("{stem}: unparsable .code"));
        if outcome.stdout != want_out {
            let got = String::from_utf8_lossy(&outcome.stdout);
            let want = String::from_utf8_lossy(&want_out);
            let diff = got
                .lines()
                .zip(want.lines())
                .enumerate()
                .find(|(_, (g, w))| g != w)
                .map(|(i, (g, w))| format!("line {}: emulator {g:?} vs reference {w:?}", i + 1))
                .unwrap_or_else(|| {
                    format!("{} vs {} bytes", outcome.stdout.len(), want_out.len())
                });
            failures.push(format!(
                "{stem}: stdout differs ({diff}) [halted with exit {:?} after {} steps]",
                outcome.exit_code, outcome.steps
            ));
            continue;
        }
        let got_code = outcome.exit_code.map(|c| c & 0xFF);
        if got_code != Some(want_code & 0xFF) {
            failures.push(format!("{stem}: exit code {got_code:?} vs {want_code}"));
            continue;
        }
        passing += 1;
        if outcome.steps > slowest.0 {
            slowest = (outcome.steps, stem.clone());
        }
    }
    if !slowest.1.is_empty() {
        println!("slowest pass: {} at {} steps", slowest.1, slowest.0);
    }
    TierResult { passing, failures }
}

#[test]
fn corpus_at_o0_matches_the_reference() {
    let failures = check_tier("").failures;
    assert!(
        failures.is_empty(),
        "{} corpus failure(s):\n  {}",
        failures.len(),
        failures.join("\n  ")
    );
}

/// The -O2 tier is an instruction-coverage map, not a correctness gate:
/// gcc's optimizer reaches for forms the -O0 corpus never emits. The
/// floor pins the current coverage so a regression shows up; growth is
/// recorded by raising it.
#[test]
#[ignore = "optimised tier: an instruction-coverage map, not a correctness gate"]
fn corpus_at_o2_coverage_map() {
    let TierResult { passing, failures } = check_tier(".O2");
    let total = 50;
    println!("o2 coverage: {passing}/{total} pass");
    for f in &failures {
        println!("  {f}");
    }
    // Measured 2026-09-13 against the -O2 tier, after the 128-bit
    // register file and the q loads and stores landed. Both remaining
    // gaps are MOVI: 13_float_double zeroes the struct with `movi d31, #0`
    // once the optimizer drops the q copies its -O0 tier makes (which now
    // assemble and pass), and 14_float_single zeroes a float with
    // `movi v0.2s, #0`. Both are on PENDING_O2, so nothing here fails to
    // assemble for a reason this crate means to cover.
    const O2_FLOOR: usize = 48;
    assert!(
        passing >= O2_FLOOR,
        "o2 coverage fell below the recorded floor: {passing} < {O2_FLOOR}"
    );
}
