//! Loading a program: the legacy word list, the linked image with its
//! argv, the section writer, and the lookups by address and by label
//! that read what was loaded.

use super::*;

impl Cpu {
    /// Load encoded instructions into memory at CODE_BASE and reset PC.
    pub fn load_program(&mut self, code: &[u32]) {
        let mut addr = CODE_BASE;
        for &word in code {
            // auto-maps pages on write
            self.mem.write_u32(addr, word).expect("code write should not fail on aligned addresses");
            addr += 4;
        }
        self.regs.write_pc(CODE_BASE);
        self.halted = false;
        // A freshly loaded program starts a fresh runaway budget.
        self.steps_total = 0;
        self.output_total = 0;
        self.abort_message = None;
        self.term = TermState::default();
        self.pending_sleep_ns = None;
        self.refund_steps_total = 0;
        self.refund_output_total = 0;
        self.snapshots_paused = false;
        // The writes above ran outside any step, so no frame's undo log
        // holds them: frames left from before the load cannot undo it.
        self.snapshots.clear();
        self.text_end = Some(CODE_BASE + (code.len() as u64) * 4);
        // The bare-metal path has no host calls; drop any trampolines a
        // previously loaded hosted image left behind.
        self.trampoline_base = 0;
        self.trampoline_names.clear();
    }

    /// Load a `LinkedImage` from `frontend::pipeline`. Writes each (addr,
    /// bytes) pair to memory, sets PC to the image's entry point, and
    /// clears the halt flag. Used for hosted cpsc 355 source. Equivalent
    /// to calling `load_linked_image_with_args(image, &[])`.
    pub fn load_linked_image(
        &mut self,
        image: &crate::frontend::pipeline::LinkedImage,
    ) -> Result<(), EmuError> {
        self.load_linked_image_with_args(image, &[])
    }

    /// Load a hosted image and additionally write argc/argv at
    /// `argv::ARGV_BASE` so the program's `main(int argc, char **argv)`
    /// sees the supplied arguments. `args` is argv[1..]; the loader
    /// prepends `argv::DEFAULT_ARGV0`, so an empty slice still means
    /// argc = 1 with argv[0] set, the Linux invariant.
    pub fn load_linked_image_with_args(
        &mut self,
        image: &crate::frontend::pipeline::LinkedImage,
        args: &[&str],
    ) -> Result<(), EmuError> {
        // A fresh program starts a fresh runaway budget and clears any
        // prior bounds-abort message.
        self.steps_total = 0;
        self.output_total = 0;
        self.abort_message = None;
        self.stdin_closed = false;
        self.term = TermState::default();
        // A fresh program tokenizes from scratch; a cursor into the last
        // program's memory would hand its first strtok(NULL) a stale
        // address that now means something else.
        self.strtok_save = 0;
        self.callbacks = Default::default();
        self.pending_sleep_ns = None;
        self.refund_steps_total = 0;
        self.refund_output_total = 0;
        self.snapshots_paused = false;
        // The image is written outside any step, so no frame's undo log
        // will hold it: frames left from before the load cannot undo it.
        self.snapshots.clear();
        self.clobber_notes.clear();
        self.clobber_noted = 0;
        for (addr, bytes) in &image.writes {
            self.mem.write_bytes(*addr, bytes).map_err(map_write_fault)?;
        }
        self.mem.set_zero_fill(image.data_spans.clone());
        self.regs.write_pc(image.entry_point);
        // Stash the `__main_return` sentinel in LR so a hosted program
        // that returns out of `main` halts cleanly instead of jumping to
        // PC = 0. The sentinel is always registered by `Cpu::new`.
        if let Some(ret_addr) = self.host.lookup("__main_return") {
            self.regs.write_gpr(30, true, ret_addr);
        }
        crate::argv::setup_argv(&mut self.regs, &mut self.mem, args).map_err(map_write_fault)?;
        crate::hosted::stdio::write_stdio_globals(&mut self.mem).map_err(map_write_fault)?;
        self.halted = false;
        // Refresh the symbol table from the linker so debugger
        // surfaces (`gdb b <label>`, future symbolic features) can
        // resolve names without going through the frontend again.
        self.symbols = image.symbols.clone();
        self.text_end = Some(image.text_end);
        self.trampoline_base = image.trampoline_base;
        self.trampoline_names = image.trampoline_names.clone();
        Ok(())
    }

    /// Name of the host function the pc is currently inside, or `None` when
    /// the pc is an instruction the student wrote. Two ranges answer: the
    /// synthetic stub address (the runtime is executing printf itself) and
    /// the image's trampoline slots (the `LDR X16; BR X16` pair a `bl`
    /// arrives at). Both words of a slot report the same name, so all three
    /// steps a hosted call takes are legible as one external call.
    pub fn host_call_name(&self, pc: u64) -> Option<&str> {
        if let Some(name) = self.host.name_for_address(pc) {
            // `__main_return` is the loader's return sentinel, not a call the
            // program made, the same exemption the SP-alignment check
            // makes. Naming it would report an external call for the one step
            // between main's `ret` and the halt.
            if name == "__main_return" {
                return None;
            }
            return Some(name);
        }
        let span = (self.trampoline_names.len() as u64) * 8;
        if pc >= self.trampoline_base
            && pc < self.trampoline_base + span
            && pc.is_multiple_of(4)
        {
            let slot = ((pc - self.trampoline_base) / 8) as usize;
            return self.trampoline_names.get(slot).map(String::as_str);
        }
        None
    }

    /// Resolve a label name to its absolute address using the symbol
    /// table captured during the most recent `load_linked_image*`
    /// call. Returns `None` for unknown names or when no image has
    /// been loaded yet.
    pub fn resolve_label(&self, name: &str) -> Option<u64> {
        self.symbols.get(name).copied()
    }

    /// Load a parsed program's sections into memory at their configured
    /// base addresses. Data items (`.byte` / `.word` / `.string` / ...)
    /// land at the running offset inside each section. `Reserve` advances
    /// the offset without writing anything; the page is already zeroed
    /// because `Memory` pages are allocated zero-filled. `AlignToBytes`
    /// rounds the offset up. `Instruction` items are counted as 4 bytes
    /// so later `Bytes` items in the same section land at the right spot;
    /// `frontend::pipeline` does the actual instruction encoding.
    /// PC resets to CODE_BASE. Labels resolved via `Program::symbols` stay
    /// the caller's concern.
    pub fn load_sections(&mut self, program: &Program) -> Result<(), EmuError> {
        for section in &program.sections {
            let base = section.kind.default_base();
            let mut offset: u64 = 0;
            for item in &section.items {
                match item {
                    Item::Bytes(bytes) => {
                        self.mem.write_bytes(base + offset, bytes)?;
                        offset += bytes.len() as u64;
                    }
                    Item::Reserve(n) => {
                        offset += *n;
                    }
                    Item::AlignToBytes { bytes, max_skip } => {
                        offset += align_padding(offset, *bytes, *max_skip);
                    }
                    Item::Label { .. } => {}
                    Item::SymbolAssignment { .. } => {}
                    Item::Instruction { .. } => {
                        offset += 4;
                    }
                    Item::DataExprs { exprs, width, .. } => {
                        // Symbol-bearing data slots need the linker's
                        // symbol table; this legacy loader has none, so
                        // hold the layout and leave the page's zeros.
                        // Real programs reach these through
                        // `assemble_hosted` + `load_linked_image`.
                        offset += (exprs.len() * width) as u64;
                    }
                    Item::ReserveExpr { .. } => {
                        // Same story: sizing needs the symbol table this
                        // loader does not have. The linker path resolves
                        // it; here the reserve contributes no bytes.
                    }
                }
            }
        }
        self.regs.write_pc(CODE_BASE);
        self.halted = false;
        Ok(())
    }
}
