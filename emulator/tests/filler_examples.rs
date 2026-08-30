//! Example-picker regression: the authored programs served by the web
//! example loader -- the "Data and memory" and "Stack and locals" stage
//! fillers against their fixtures, plus the interactive extras through
//! scripted sessions: the real-time programs (the snake game, the pocket
//! calculator, the multi-file deadzone survivor) keyed one press per
//! pacing boundary, and the cooked-mode menu programs (the two-sum
//! visualizer, the temperature instrument, the multi-file data structures
//! visualizer) driven from one stdin push.
//!
//! The calculator, the instrument and the two-sum visualizer each carry a
//! second face: `console` in argv[1] answers in plain text instead of
//! drawing. Each has its own case here, and each of those asserts the
//! output holds no escape byte at all -- that is the whole promise of the
//! plain face, and a single stray `\x1b` breaks it for the student who
//! picked console over the terminal pane.
//!
//! These are the same `.s` files the web example loader serves over HTTP,
//! read straight from `web/public/examples/cpsc355/` (not a copy) so the
//! served asset and the asserted behavior cannot drift. Each program is
//! assembled through the hosted pipeline, run to halt (pushing the stdin
//! fixture where the program reads input), and its stdout + exit code are
//! checked against the fixture files next to it.
//!
//! Line endings are normalized to LF on both sides: the WASM runtime emits
//! LF, but a Windows checkout can hand these tracked text files back as
//! CRLF, so the comparison is on logical content.

use std::path::PathBuf;

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

/// `web/public/examples/cpsc355/`, resolved relative to the emulator crate.
fn examples_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // emulator/ -> repo root
    p.push("web/public/examples/cpsc355");
    p
}

fn read(rel: &str) -> String {
    let path = examples_root().join(rel);
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    raw.replace("\r\n", "\n")
}

/// Assemble, load, optionally feed stdin, run to halt, return (stdout, exit).
fn run_example(src_rel: &str, stdin: Option<&str>) -> (String, Option<i64>) {
    let source = read(src_rel);
    let mut cpu = Cpu::new();
    let image = assemble_hosted(&source, &cpu.host)
        .unwrap_or_else(|e| panic!("assemble {src_rel}: {e}"));
    cpu.load_linked_image(&image)
        .unwrap_or_else(|e| panic!("load {src_rel}: {e}"));
    if let Some(input) = stdin {
        cpu.push_stdin(input.as_bytes());
    }
    let r = cpu
        .run_until_break(1_000_000)
        .unwrap_or_else(|e| panic!("run {src_rel}: {e}"));
    assert!(
        r.halted,
        "{src_rel} did not halt (still blocked for input: {})",
        cpu.is_blocked()
    );
    let stdout = String::from_utf8_lossy(&cpu.take_stdout())
        .replace("\r\n", "\n");
    (stdout, cpu.exit_code())
}

/// Drive a cooked-mode program from one scripted stdin push: load it with
/// `args` as its argv, run to halt, and step over the pauses a paced
/// program takes. Returns stdout, the exit code, and how many times the
/// program slept -- the sleep count is what proves an animation paced
/// itself rather than dumping every frame at once.
///
/// The source is passed in rather than read here because the multi-file
/// programs arrive already concatenated, the way the web's files strip
/// joins them.
fn run_cooked_session(
    label: &str,
    source: &str,
    args: &[&str],
    drive: &str,
) -> (String, Option<i64>, u32) {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host)
        .unwrap_or_else(|e| panic!("assemble {label}: {e}"));
    cpu.load_linked_image_with_args(&image, args)
        .unwrap_or_else(|e| panic!("load {label}: {e}"));
    cpu.push_stdin(drive.as_bytes());
    cpu.close_stdin();
    let mut sleeps = 0u32;
    loop {
        let r = cpu
            .run_until_break(10_000_000)
            .unwrap_or_else(|e| panic!("run {label}: {e}"));
        if r.halted {
            break;
        }
        if cpu.take_pending_sleep_ns().is_some() {
            sleeps += 1;
            continue;
        }
        assert!(!cpu.is_blocked(), "{label} ran out of scripted input");
    }
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).replace("\r\n", "\n");
    (stdout, cpu.exit_code(), sleeps)
}

/// The console face's whole promise: plain text. One escape byte in the
/// stream and the student who chose the console instead of the terminal
/// pane reads control codes, so the count is asserted rather than eyeballed.
fn assert_plain_text(label: &str, stdout: &str) {
    let escapes = stdout.bytes().filter(|b| *b == 0x1b).count();
    assert_eq!(
        escapes, 0,
        "{label} wrote {escapes} escape bytes; the console face must write none"
    );
}

#[test]
fn globals_filler_multiplies_data_and_stores_the_product() {
    let (stdout, exit) = run_example("globals.s", None);
    assert_eq!(stdout, read("fixtures/globals.stdout"));
    assert_eq!(exit, Some(0));
}

#[test]
fn locals_filler_reads_two_ints_and_prints_sum_and_product() {
    let stdin = read("fixtures/locals.stdin");
    let (stdout, exit) = run_example("locals.s", Some(&stdin));
    assert_eq!(stdout, read("fixtures/locals.stdout"));
    assert_eq!(exit, Some(0));
}

/// The arcade snake drains stale stdin every frame (real-time design),
/// so a pre-pushed fixture never survives its menu. Drive it the way a
/// player does instead: one key at each pacing boundary (a nanosleep
/// pause or a spent run chunk). The script starts classic mode, turns
/// once, quits to the game over screen, then quits out through the
/// menu; the padding tokens are the "human" gaps between presses.
#[test]
fn snake_arcade_plays_a_timed_session_and_exits_cleanly() {
    let source = read("snake.s");
    let mut cpu = aarch64_emulator::cpu::Cpu::new();
    let image = aarch64_emulator::frontend::pipeline::assemble_hosted(&source, &cpu.host)
        .unwrap_or_else(|e| panic!("assemble snake.s: {e}"));
    cpu.load_linked_image(&image).expect("load snake.s");

    let script = [
        "", "", "
", "", "", "w", "", "", "q", "q", "", "", "q", "", "", "q", "", "", "q",
    ];
    let mut tokens = script.iter();
    let mut boundaries = 0u64;
    let mut halted = false;
    for _ in 0..4000 {
        let r = cpu.run_until_break(1_000_000).expect("run snake.s");
        if r.halted {
            halted = true;
            break;
        }
        let _ = cpu.take_pending_sleep_ns();
        boundaries += 1;
        if boundaries.is_multiple_of(2) {
            if let Some(tok) = tokens.next() {
                cpu.push_stdin(tok.as_bytes());
            }
        }
        assert!(!cpu.blocked, "the arcade game must never block on stdin");
    }
    assert!(halted, "the scripted session must reach a clean exit");
    assert_eq!(cpu.exit_code, Some(0));
    let stdout = String::from_utf8_lossy(&cpu.take_stdout()).into_owned();
    assert!(stdout.contains("GAME OVER"), "the quit path shows the game over screen");
    assert!(stdout.contains("Time Alive"), "the run stats panel prints");
    // The game put the terminal in raw mode to play and restored it on
    // the way out; a clean exit leaves the flag lowered.
    assert!(!cpu.term.raw_mode, "exit must restore the terminal");
}

/// The pocket calculator, driven the way the snake game is: it polls the
/// keyboard every frame in raw mode, so a pre-pushed fixture never
/// survives its own drain. One key at each pacing boundary instead. The
/// script proves the two entry modes (expression entry honours
/// precedence, immediate entry applies a unary to the display), the
/// error state, and that C clears it.
#[test]
fn calc_device_plays_a_timed_session_and_exits_cleanly() {
    let source = read("calc.s");
    let mut cpu = Cpu::new();
    let image = assemble_hosted(&source, &cpu.host)
        .unwrap_or_else(|e| panic!("assemble calc.s: {e}"));
    cpu.load_linked_image(&image).expect("load calc.s");
    assert!(!cpu.term.raw_mode, "nothing has run yet, so the terminal is still cooked");

    // tab moves between immediate and expression entry, `v` is the sqrt
    // key, `C` clears the entry, `q` gives the terminal back. The empty
    // tokens are the gaps a person leaves between presses.
    let script = [
        "", "", "\t", "", "2", "+", "3", "*", "4", "=", "",
        "\t", "", "9", "v", "",
        "5", "/", "0", "=", "",
        "C", "",
        "q",
    ];
    let mut tokens = script.iter();
    let mut boundaries = 0u64;
    let mut halted = false;
    let mut raw_rose = false;
    let mut stdout = String::new();
    // Where the C press lands in the stream, so the frames painted after
    // it can be read apart from the ones that carried the error.
    let mut cleared_at: Option<usize> = None;
    for _ in 0..6000 {
        let r = cpu.run_until_break(1_000_000).expect("run calc.s");
        stdout.push_str(&String::from_utf8_lossy(&cpu.take_stdout()));
        if r.halted {
            halted = true;
            break;
        }
        let _ = cpu.take_pending_sleep_ns();
        raw_rose |= cpu.term.raw_mode;
        boundaries += 1;
        if boundaries.is_multiple_of(2) {
            if let Some(tok) = tokens.next() {
                if *tok == "C" {
                    cleared_at = Some(stdout.len());
                }
                cpu.push_stdin(tok.as_bytes());
            }
        }
        assert!(!cpu.blocked, "the device polls its keys, it must never block on stdin");
    }
    assert!(halted, "the scripted session must reach a clean exit");
    assert_eq!(cpu.exit_code, Some(0));
    // The raw-mode flag is what hands the web build its terminal pane.
    assert!(raw_rose, "the device must take the terminal over to draw itself");
    assert!(
        stdout.contains("2+3*4 = 14"),
        "expression entry evaluates with precedence, not left to right"
    );
    assert!(
        stdout.contains("sqrt(9) = 3"),
        "immediate entry applies the unary to whatever the display holds"
    );
    let cleared_at = cleared_at.expect("the script presses C");
    assert!(
        stdout[..cleared_at].contains("div by zero"),
        "5 / 0 = must put the display in its error state"
    );
    assert!(
        !stdout[cleared_at..].contains("div by zero"),
        "C must clear the error state, not leave it painted"
    );
    // The device put the terminal in raw mode to draw and restored it on
    // the way out; a clean exit leaves the flag lowered.
    assert!(!cpu.term.raw_mode, "exit must restore the terminal");
}

/// The same calculator with `console` in its argv: no key grid, no raw
/// mode, one answer per typed line. The script walks precedence, a unary,
/// the trig mode word, the error state, and the quit word.
#[test]
fn calc_console_face_answers_typed_lines_in_plain_text() {
    let (stdout, exit, _) = run_cooked_session(
        "calc.s console",
        &read("calc.s"),
        &["console"],
        "2+3*4\nsqrt(9)\ndeg\nsin(30)\n5/0\nq\n",
    );
    assert_eq!(exit, Some(0));
    assert!(stdout.contains("calc> "), "the plain face prompts per line");
    assert!(stdout.contains("= 14"), "precedence holds on the console path too");
    assert!(stdout.contains("= 3"), "sqrt(9) answers");
    assert!(stdout.contains("DEG"), "the mode word echoes the mode it switched to");
    assert!(stdout.contains("= 0.5"), "sin(30) in degrees");
    assert!(stdout.contains("div by zero"), "5/0 names the error instead of printing a number");
    assert!(stdout.contains("bye"), "the quit word ends the session");
    assert_plain_text("calc.s console", &stdout);
}

/// The two-sum visualizer, cooked mode and menu-driven, so the whole
/// session is one scripted stdin push. The drive walks the screens a first
/// run touches: enter past the welcome splash, [4] speed down to 100 ms,
/// [1] preset [1] classic, [5] brute force frame by frame, then [0] out.
///
/// The blank lines are the "press enter to continue" waits that follow a
/// saved answer and a finished run.
///
/// Every asserted string is a run the program writes without a colour
/// escape in the middle of it. The screens are painted cell by cell with
/// cursor moves and role colours, so a line that reads as one row on
/// screen is often several writes in the stream; picking the contiguous
/// runs is what keeps this a behavior check and not a paint-order check.
#[test]
fn two_sum_visualizer_walks_the_menus_and_traces_a_preset() {
    let (stdout, exit, sleeps) = run_cooked_session(
        "two-sum.s",
        &read("two-sum.s"),
        &[],
        "\n\
         4\n100\n\n\
         1\n1\n\n\
         5\n\n\
         0\n",
    );
    assert_eq!(exit, Some(0));
    assert!(stdout.contains("TWO-SUM"), "the title bar carries the app mark");
    assert!(stdout.contains("TWO-SUM, TRACED"), "the welcome screen draws its box");
    assert!(stdout.contains("press enter to begin"), "the splash waits for a key");
    assert!(
        stdout.contains("two-sum, traced in ARMv8 assembly"),
        "the home screen carries the tagline beside the app mark"
    );
    assert!(
        stdout.contains("six arrays and targets worth watching"),
        "the home menu spells each entry out, dsav style"
    );
    assert!(
        stdout.contains("animation delay in ms (100 to 3000):"),
        "[4] opens the speed screen with its bounds named"
    );
    assert!(
        stdout.contains("PRESETS") && stdout.contains("arr=[2,7,11,15]"),
        "[1] opens the preset picker with the classic array on it"
    );
    assert!(
        stdout.contains("check every pair (i, j) with i < j"),
        "the brute force screen names what it is about to do"
    );
    assert!(
        stdout.contains("i=0  j=1   arr[0]+arr[1] = 2 + 7 = 9   target = 9"),
        "the narration panel reports the comparison it is on"
    );
    assert!(
        stdout.contains("result: arr[0] (2) + arr[1] (7) = 9.  comparisons: 1."),
        "brute force answers the classic preset on its first pair"
    );
    assert!(stdout.contains("thanks for watching."), "the exit path prints the goodbye line");
    assert!(sleeps > 0, "the animation paces itself through usleep");
}

/// The same program with `console` in its argv: no canvas, no colour, just
/// the two solvers over one typed array. The drive is the classic input.
#[test]
fn two_sum_console_face_solves_a_typed_array_in_plain_text() {
    // The 1000 is out of range: the same hardened reader as the
    // visualizer's should name the bounds and re-ask before accepting 7.
    let (stdout, exit, _) = run_cooked_session(
        "two-sum.s console",
        &read("two-sum.s"),
        &["console"],
        "4\n2\n1000\n7\n11\n15\n9\n",
    );
    assert_eq!(exit, Some(0));
    assert!(
        stdout.contains("1000 is out of range"),
        "an out-of-range element is refused with its value named"
    );
    assert!(
        stdout.contains("brute force:  arr[0] (2) + arr[1] (7) = 9   comparisons: 1"),
        "the brute force line is labelled and carries its comparison count"
    );
    assert!(
        stdout.contains("hash set:     arr[0] (2) + arr[1] (7) = 9   probes: 3"),
        "the hash set line lands under it with its probe count"
    );
    assert_plain_text("two-sum.s console", &stdout);
}

/// The temperature instrument in its interactive mode (no argv, so the
/// argc branch takes it there). Cooked mode, one reading per line: a good
/// one, junk, something below absolute zero, then the quit word.
///
/// The prompt is a labelled rule with a `> ` caret under it, and the
/// instrument under that is a bulb `(*)` on three scales filled to where
/// the reading landed -- the fill is what changes per reading, so it is
/// asserted as a run rather than as a whole row (the row carries colour
/// escapes between its segments).
#[test]
fn temp_convert_answers_readings_and_refuses_impossible_ones() {
    let drive = "36.6C\nhello\n-300C\nq\n";
    let (stdout, exit, _) =
        run_cooked_session("temp-convert.s", &read("temp-convert.s"), &[], drive);
    assert_eq!(exit, Some(0));
    assert!(
        stdout.contains("  reading -------------------------------------------------"),
        "each reading is asked for under its own labelled rule"
    );
    assert!(stdout.contains("  > "), "the caret marks where the answer goes");
    assert!(
        stdout.contains("      36.60 C  =     97.88 F  =    309.75 K"),
        "a good reading comes back on all three scales"
    );
    assert!(
        stdout.contains("(*)+=========================+===+"),
        "the instrument draws its bulb and fills to the reading"
    );
    assert!(
        stdout.contains("  right about human body temperature."),
        "the band under the scales names where the reading landed"
    );
    assert!(
        stdout.contains("  need a number and a unit: 36.6C, 98.6F, 310K."),
        "junk gets one line naming the shape that was expected"
    );
    assert!(
        stdout.contains("  -300.00 C is below absolute zero (-273.15 C)."),
        "the floor is quoted back in the unit that was typed"
    );
    assert!(stdout.contains("bye."), "the quit word ends the loop cleanly");
}

/// The same instrument with `console` in its argv: the same reading loop
/// with the palette slots emptied, so the layout survives and the escapes
/// do not. Same script as the interactive case, so the two faces are read
/// against the same milestones.
#[test]
fn temp_convert_console_face_draws_the_same_readings_in_plain_text() {
    let drive = "36.6C\nhello\n-300C\nq\n";
    let (stdout, exit, _) = run_cooked_session(
        "temp-convert.s console",
        &read("temp-convert.s"),
        &["console"],
        drive,
    );
    assert_eq!(exit, Some(0));
    assert!(
        stdout.contains("  reading -------------------------------------------------"),
        "the labelled rule survives with the colour gone"
    );
    assert!(
        stdout.contains("      36.60 C  =     97.88 F  =    309.75 K"),
        "the trio of scales answers the same way"
    );
    assert!(
        stdout.contains(" C -273.15 (*)+=========================+===+-----+  100.00"),
        "with no escapes in the way the whole scale row is one run"
    );
    assert!(
        stdout.contains("  -300.00 C is below absolute zero (-273.15 C)."),
        "the refusal keeps its wording on the plain face"
    );
    assert!(stdout.contains("bye."), "the quit word ends the loop cleanly");
    assert_plain_text("temp-convert.s console", &stdout);
}

/// The multi-file visualizer, combined exactly the way the web's files
/// strip does it (main first, each extra behind a `// ---- name ----`
/// boundary, in the loader manifest's order). Drives one operation per
/// data structure at the fastest pace and leaves through every menu, so
/// the whole surface assembles, links, and runs behind one gate.
#[test]
fn dsav_visualizer_links_across_its_files_and_runs_the_menus() {
    const EXTRAS: [&str; 17] = [
        "theme.s", "ui.s", "ansi.s", "display.s", "utils.s", "array.s",
        "stack.s", "queue.s", "list.s", "bst.s", "rbt.s", "heap.s",
        "hash.s", "graph.s", "sort.s", "search.s", "recursion.s",
    ];
    let mut source = read("dsav.s");
    for name in EXTRAS {
        source.push_str(&format!("\n// ---- {name} ----\n"));
        source.push_str(&read(&format!("dsav/{name}")));
    }
    // One operation per module, then out. EVERY module is visited: a drive
    // that stopped at the six original ones let a printf conversion the
    // hosted runtime rejects (`%*s`) ship inside the sorting module, because
    // nothing here ever reached it. One blank line per operation feeds
    // wait_for_enter.
    //
    // array: user init 3 values, display, back; stack: push, pop, back;
    // queue: enqueue, dequeue, back; list: insert, display, back; bst:
    // insert, search hit, back; rbt: insert, search hit, back; heap: insert,
    // show, back; hash: insert, show, back; graph: breadth first, back;
    // sorting: new array then bubble, back; searching: linear on the seeded
    // array, back; recursion: solve, back; then exit.
    let drive = "1\n2\n3\n10\n20\n30\n\n3\n\n0\n\n\
                 2\n1\n5\n\n2\n\n0\n\n\
                 3\n1\n5\n\n2\n\n0\n\n\
                 4\n1\n5\n\n5\n\n0\n\n\
                 5\n1\n5\n\n3\n5\n\n0\n\n\
                 6\n1\n5\n\n2\n5\n\n0\n\n\
                 7\n1\n5\n\n5\n\n0\n\n\
                 8\n1\n42\n\n4\n\n0\n\n\
                 9\n0\n\
                 10\n0\n\
                 11\n0\n\
                 12\n0\n\
                 0\n";
    let (stdout, exit, sleeps) = run_cooked_session("dsav", &source, &[], drive);
    assert_eq!(exit, Some(0));
    // the home screen: the app mark and this screen's name on the title
    // bar, the two group headings, and the tagline the kernel sets beside
    // them
    assert!(stdout.contains("DSAV"), "the title bar carries the app mark");
    assert!(stdout.contains("STRUCTURES") && stdout.contains("ALGORITHMS"));
    assert!(stdout.contains("data structures & algorithms in ARMv8 assembly"));
    assert!(
        stdout.contains("thanks for using dsav"),
        "the exit path prints the goodbye line"
    );
    assert!(sleeps > 0, "the animations pace themselves through usleep");
}

/// The multi-file survivor game, combined exactly the way the files strip
/// joins it (main first, each helper behind a `// ---- name ----` boundary,
/// in the loader manifest's order -- constants first, because a module's
/// equates only resolve below their definition). Raw mode and real time
/// like the snake game, so a pre-pushed fixture never survives the
/// per-frame drain: the presses are scheduled against the frame clock
/// instead. The drive sits through the title animation, starts a run from
/// the menu, moves, pauses, resumes, and quits.
#[test]
fn deadzone_survivor_links_across_its_files_and_plays_a_timed_session() {
    const EXTRAS: [&str; 11] = [
        "constants.s", "terminal.s", "input.s", "player.s", "enemies.s",
        "projectiles.s", "upgrades.s", "file-io.s", "effects.s", "boss.s",
        "abilities.s",
    ];
    let mut source = read("deadzone.s");
    for name in EXTRAS {
        source.push_str(&format!("\n// ---- {name} ----\n"));
        source.push_str(&read(&format!("deadzone/{name}")));
    }
    let mut cpu = Cpu::new();
    let image = assemble_hosted(&source, &cpu.host)
        .unwrap_or_else(|e| panic!("assemble deadzone: {e}"));
    cpu.load_linked_image(&image).expect("load deadzone");
    assert!(!cpu.term.raw_mode, "nothing has run yet, so the terminal is still cooked");

    // (frame, key): the title animation holds for 120 frames before it
    // takes a key, so the presses are scheduled on the frame clock rather
    // than counted out as padding tokens. The first enter leaves the
    // title, the second starts the run from the menu.
    let script: [(u64, &str); 10] = [
        (125, "\n"),
        (130, "\n"),
        (140, "d"),
        (145, "s"),
        (150, "d"),
        (155, "s"),
        (165, "p"),
        (180, "p"),
        (190, "d"),
        (200, "q"),
    ];
    // The frame the game is moving again by: the resume press is ten
    // frames behind it and the field has been repainted since, so
    // everything printed from here on is the field, not the overlay.
    const MOVING_AGAIN_BY: u64 = 190;
    let mut pending = script.iter();
    let mut next = pending.next();
    let mut boundaries = 0u64;
    let mut halted = false;
    let mut wants_terminal = false;
    let mut stdout = String::new();
    // Where the resumed field starts in the stream, so the frames painted
    // after it can be read apart from the ones that carried the overlay.
    let mut resumed_at: Option<usize> = None;
    for _ in 0..4000 {
        let r = cpu.run_until_break(1_000_000).expect("run deadzone");
        stdout.push_str(&String::from_utf8_lossy(&cpu.take_stdout()));
        if r.halted {
            halted = true;
            break;
        }
        let _ = cpu.take_pending_sleep_ns();
        wants_terminal |= cpu.term.raw_mode;
        boundaries += 1;
        if boundaries == MOVING_AGAIN_BY {
            resumed_at = Some(stdout.len());
        }
        while let Some((at, key)) = next {
            if *at > boundaries {
                break;
            }
            cpu.push_stdin(key.as_bytes());
            next = pending.next();
        }
        assert!(!cpu.blocked, "the game polls its keys, it must never block on stdin");
    }
    assert!(halted, "the scripted session must reach a clean exit");
    assert_eq!(cpu.exit_code, Some(0));
    // The raw-mode flag is what hands the web build its terminal pane.
    assert!(wants_terminal, "the game must take the terminal over to draw itself");
    assert!(stdout.contains("DEADZONE"), "the title screen carries the game's name");
    assert!(stdout.contains("START GAME"), "the first key gets past the title to the menu");
    // The status bar is drawn field by field with a colour per field, so
    // the labels are what survive as contiguous runs; the numbers beside
    // them arrive after their own escape.
    assert!(
        stdout.contains("HEALTH") && stdout.contains("WAVE ") && stdout.contains("KILLS "),
        "the second key starts a run, so the field's status bar draws"
    );
    assert!(
        stdout.contains("W A V E  "),
        "a run opens on the wave splash over the field"
    );
    assert!(
        stdout.contains("PAUSED"),
        "p over a live game paints the pause overlay"
    );
    let resumed_at = resumed_at.expect("the scripted session outlives the pause");
    assert!(
        !stdout[resumed_at..].contains("PAUSED"),
        "the second p resumes: the overlay stops being painted"
    );
    assert!(
        stdout.contains("Terminal restored. Goodbye!"),
        "q leaves through the cleanup path, not out from under the terminal"
    );
    // The game put the terminal in raw mode to draw and restored it on the
    // way out; a clean exit leaves the flag lowered.
    assert!(!cpu.term.raw_mode, "exit must restore the terminal");
}

/// Every printf conversion the shipped examples use must be one the hosted
/// runtime implements. Driving the menus cannot prove this on its own: a
/// conversion sitting in a branch the scripted session never reaches still
/// aborts the program for the student who does reach it, which is how a
/// then-unsupported `%*s` shipped inside the sorting module. Reading the
/// format strings costs nothing and covers every branch at once.
#[test]
fn shipped_examples_only_use_conversions_the_runtime_implements() {
    // What hosted/printf.rs accepts: flags, a width (digits or a `*`
    // taking it from the varargs), a .precision in either form, the
    // length modifiers, and one of these conversions.
    const CONVERSIONS: &str = "diouxXeEfgGcspn%";
    let mut offenders: Vec<String> = Vec::new();

    let mut names: Vec<String> = ["calc.s", "deadzone.s", "dsav.s", "temp-convert.s", "two-sum.s"]
        .iter()
        .map(|n| (*n).to_string())
        .collect();
    for dir in ["deadzone", "dsav"] {
        let mut extras: Vec<String> = std::fs::read_dir(examples_root().join(dir))
            .unwrap_or_else(|e| panic!("the {dir} helper directory is served from web/public: {e}"))
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|n| n.ends_with(".s"))
            .map(|n| format!("{dir}/{n}"))
            .collect();
        extras.sort();
        names.append(&mut extras);
    }
    assert!(
        names.len() >= 33,
        "expected both multi-file programs plus the three single-file ones, got {names:?}"
    );

    for rel in &names {
        let text = read(rel);
        for (n, line) in text.lines().enumerate() {
            // Only a NUL-terminated string literal can be a format: the
            // hosted printf takes a pointer and reads to the terminator.
            // A `%` in a comment ("rand() % max"), in a `msub`, or inside
            // a bare `.ascii` byte run is not one -- calc paints its key
            // grid out of one such run, five columns per cap, written by
            // length and never handed to a formatter -- and flagging any
            // of them would make this gate cry wolf.
            let Some(open) = line.find('"') else { continue };
            let trimmed = line.trim_start();
            if !(trimmed.starts_with(".string")
                || trimmed.starts_with(".asciz")
                || line[..open].contains(".string")
                || line[..open].contains(".asciz"))
            {
                continue;
            }
            let Some(close) = line.rfind('"') else { continue };
            if close <= open {
                continue;
            }
            let lit = &line[open + 1..close];
            let bytes = lit.as_bytes();
            let mut i = 0;
            while i < bytes.len() {
                if bytes[i] != b'%' {
                    i += 1;
                    continue;
                }
                // Walk the spec the way hosted/printf.rs does, then look at
                // whatever it stopped on.
                let mut j = i + 1;
                while j < bytes.len() && b"-+ #0".contains(&bytes[j]) {
                    j += 1;
                }
                if j < bytes.len() && bytes[j] == b'*' {
                    j += 1;
                } else {
                    while j < bytes.len() && bytes[j].is_ascii_digit() {
                        j += 1;
                    }
                }
                if j < bytes.len() && bytes[j] == b'.' {
                    j += 1;
                    if j < bytes.len() && bytes[j] == b'*' {
                        j += 1;
                    } else {
                        while j < bytes.len() && bytes[j].is_ascii_digit() {
                            j += 1;
                        }
                    }
                }
                while j < bytes.len() && b"hlLzjt".contains(&bytes[j]) {
                    j += 1;
                }
                if j >= bytes.len() {
                    break;
                }
                if !CONVERSIONS.contains(bytes[j] as char) {
                    offenders.push(format!(
                        "{}:{}: `%{}` -- {}",
                        rel,
                        n + 1,
                        bytes[j] as char,
                        line.trim()
                    ));
                }
                // Step PAST the conversion, so the second `%` of an escaped
                // `%%` is consumed here instead of starting a fresh spec.
                i = j + 1;
            }
        }
    }

    assert!(
        offenders.is_empty(),
        "shipped examples use printf conversions the hosted runtime rejects:\n{}",
        offenders.join("\n")
    );
}
