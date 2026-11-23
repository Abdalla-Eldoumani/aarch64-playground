//! The calls a program has made, returned ones included, as the small tree
//! the stack frames view lists beside the frames. Every call gets a node,
//! except that a run of calls to one function (each calling the next, or
//! one after another from the same caller) keeps its first `RUN_SHOWN` as
//! nodes of their own and folds the rest into one node that counts them, so
//! deep recursion and a loop calling a helper stay a few nodes. At most
//! `MAX_TREE_NODES` nodes: a call that finds them all taken first drops the
//! oldest returned calls, counting them as earlier calls. At most
//! `MAX_TREE_DEPTH` deep: a call past that is counted with every call made
//! inside it, never kept.
//!
//! Driven by the call stack's own pushes and pops (frames.rs), so a run
//! records every call a single step would, deeper than the call stack
//! records included, and kept in step-back frames and named saves with the
//! rest of the call stack.

/// Most nodes kept: the most the view draws.
pub const MAX_TREE_NODES: usize = 200;

/// About the nodes left once a full tree drops its oldest returned calls:
/// dropping half at once leaves the drop's cost to one call in a hundred.
const KEPT_AFTER_FULL: usize = MAX_TREE_NODES / 2;

/// Most nodes from the program's first function down: deeper nesting with
/// no run to fold (mutual recursion) is counted instead.
pub const MAX_TREE_DEPTH: u32 = 12;

/// Calls of a run that keep a node of their own; the next one is the fold.
pub const RUN_SHOWN: u32 = 4;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CallNode {
    /// The address the call entered.
    pub entry: u64,
    /// One more than its caller's node, 0 for the program's first function.
    pub parent: usize,
    /// One more than its latest callee's node, 0 before its first.
    latest: usize,
    /// Its place in a run of calls to one function, 1 for the first.
    run: u32,
    /// Nodes from the program's first function down to it, 1 for that one.
    depth: u32,
    /// The calls it stands for: 1, or the rest of a run in a fold.
    pub calls: u64,
    /// Of those, the ones that have not returned.
    pub open: u64,
    /// x0 when its first call began, and when its latest return came.
    pub arg: u64,
    pub ret: u64,
    /// The width of x0's latest write before that return: 4 for w0, 8 for
    /// x0, 0 before any return.
    pub ret_width: u8,
}

impl CallNode {
    /// It counts the rest of a run rather than one call.
    pub fn folds(&self) -> bool {
        self.run > RUN_SHOWN
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CallTree {
    /// Callers before callees: a node's calls follow it.
    nodes: Vec<CallNode>,
    /// One more than the node of the innermost call that has one, 0 for none.
    current: usize,
    /// Calls the program is inside, below that one, that have no node.
    outside: u64,
    /// Calls made that have no node.
    dropped: u64,
    /// Of those, the returned calls dropped to make room for later ones.
    earlier: u64,
}

/// What one step changed in the tree: its small fields as they were,
/// copied at the step's first change, and each node it changed, before the
/// change. A node the step added goes when the length is put back. A step
/// that drops earlier calls logs every node, and `earlier` at `EARLIER`.
#[derive(Debug, Default)]
pub struct TreeUndo {
    head: Option<(usize, usize, u64, u64)>,
    nodes: Vec<(usize, CallNode)>,
}

/// The node log's index for `earlier` (in `calls`): only a drop changes it,
/// so it stays out of the head every step copies.
const EARLIER: usize = usize::MAX;

impl CallTree {
    pub fn nodes(&self) -> &[CallNode] {
        &self.nodes
    }

    /// The node of the innermost call that has one.
    pub fn current(&self) -> Option<usize> {
        self.current.checked_sub(1)
    }

    /// Calls the program is inside that have no node.
    pub fn outside(&self) -> u64 {
        self.outside
    }

    /// Calls made that have no node.
    pub fn dropped(&self) -> u64 {
        self.dropped
    }

    pub(super) fn clear(&mut self) {
        self.nodes.clear();
        (self.current, self.outside, self.dropped, self.earlier) = (0, 0, 0, 0);
    }

    /// A fresh program: its first function, entered at `entry` with `x0`.
    pub(super) fn start(&mut self, entry: u64, x0: u64) {
        self.clear();
        self.nodes.push(CallNode { entry, run: 1, depth: 1, calls: 1, open: 1, arg: x0, ..CallNode::default() });
        self.current = 1;
    }

    pub(super) fn record_undo(log: &mut TreeUndo) {
        log.head = None;
        log.nodes.clear();
    }

    pub(super) fn undo(&mut self, log: TreeUndo) {
        let Some((len, current, outside, dropped)) = log.head else { return };
        // After a drop the logged nodes fill the length back in.
        self.nodes.resize(len, CallNode::default());
        for (i, node) in log.nodes.into_iter().rev() {
            if i == EARLIER {
                self.earlier = node.calls;
            } else {
                self.nodes[i] = node;
            }
        }
        (self.current, self.outside, self.dropped) = (current, outside, dropped);
    }

    /// Note, before a change, the small fields once a step and node `at`.
    fn log(&self, log: &mut Option<&mut TreeUndo>, at: Option<usize>) {
        if let Some(log) = log.as_deref_mut() {
            log.head.get_or_insert((self.nodes.len(), self.current, self.outside, self.dropped));
            if let Some(i) = at {
                log.nodes.push((i, self.nodes[i]));
            }
        }
    }

    /// The innermost call just called the function at `entry` with `x0`.
    pub(super) fn enter(&mut self, entry: u64, x0: u64, mut log: Option<&mut TreeUndo>) {
        let Some(c) = self.current.checked_sub(1).filter(|_| self.outside == 0) else {
            self.log(&mut log, None);
            self.outside += 1;
            self.dropped += 1;
            return;
        };
        let caller = self.nodes[c];
        // One call deeper inside a fold's own recursion.
        if caller.folds() && caller.entry == entry {
            self.log(&mut log, Some(c));
            self.nodes[c].calls += 1;
            self.nodes[c].open += 1;
            return;
        }
        // The caller is the innermost call, so none of its callees is open.
        let latest = caller.latest.checked_sub(1).map(|i| (i, self.nodes[i]));
        let run = match latest {
            Some((i, prev)) if prev.entry == entry && prev.folds() => {
                self.log(&mut log, Some(i));
                self.nodes[i].calls += 1;
                self.nodes[i].open += 1;
                self.current = i + 1;
                return;
            }
            Some((_, prev)) if prev.entry == entry => prev.run + 1,
            _ if caller.entry == entry => caller.run + 1,
            _ => 1,
        };
        if caller.depth >= MAX_TREE_DEPTH {
            self.log(&mut log, None);
            self.outside = 1;
            self.dropped += 1;
            return;
        }
        if self.nodes.len() >= MAX_TREE_NODES {
            self.drop_earlier(&mut log);
        }
        // The drop moves the caller's node.
        let c = self.current - 1;
        self.log(&mut log, Some(c));
        self.nodes[c].latest = self.nodes.len() + 1;
        self.nodes.push(CallNode {
            entry,
            parent: c + 1,
            latest: 0,
            run: run.min(RUN_SHOWN + 1),
            depth: caller.depth + 1,
            calls: 1,
            open: 1,
            arg: x0,
            ret: 0,
            ret_width: 0,
        });
        self.current = self.nodes.len();
    }

    /// Drop the oldest returned calls, whole calls with every call made
    /// inside them, down to about `KEPT_AFTER_FULL` nodes, and count each
    /// call they stood for. The open calls stay: they are one path from the
    /// first function down, at most `MAX_TREE_DEPTH` nodes.
    fn drop_earlier(&mut self, log: &mut Option<&mut TreeUndo>) {
        for i in 0..self.nodes.len() {
            self.log(log, Some(i));
        }
        if let Some(log) = log.as_deref_mut() {
            log.nodes.push((EARLIER, CallNode { calls: self.earlier, ..CallNode::default() }));
        }
        let nodes = &self.nodes;
        let open = |i: usize| nodes[i].open > 0;
        // Callers come before callees, so the returned nodes before the
        // first node that is open or has an open caller are whole calls.
        let mut cut = nodes.len() - KEPT_AFTER_FULL;
        while cut < nodes.len() && !open(cut) && !open(nodes[cut].parent - 1) {
            cut += 1;
        }
        // One more than each kept node's new index, 0 for a dropped one.
        let mut to = [0; MAX_TREE_NODES];
        let mut kept = 0;
        for (i, n) in nodes.iter().enumerate() {
            if i >= cut || n.open > 0 {
                kept += 1;
                to[i] = kept;
            } else {
                self.dropped += n.calls;
                self.earlier += n.calls;
            }
        }
        let renumber = |at: usize| at.checked_sub(1).map_or(0, |i| to[i]);
        let mut keep = to.iter().map(|&k| k > 0);
        self.nodes.retain_mut(|n| {
            (n.parent, n.latest) = (renumber(n.parent), renumber(n.latest));
            keep.next() == Some(true)
        });
        self.current = renumber(self.current);
    }

    /// The innermost call just returned `x0`, last written `x0_width`
    /// bytes wide.
    pub(super) fn leave(&mut self, x0: u64, x0_width: u8, mut log: Option<&mut TreeUndo>) {
        if self.outside > 0 {
            self.log(&mut log, None);
            self.outside -= 1;
            return;
        }
        let Some(c) = self.current.checked_sub(1) else { return };
        self.log(&mut log, Some(c));
        let node = &mut self.nodes[c];
        node.open = node.open.saturating_sub(1);
        (node.ret, node.ret_width) = (x0, x0_width);
        if node.open == 0 {
            self.current = node.parent;
        }
    }

    /// The tree as the flat numbers the frames export ends with: the node
    /// count, `current`, `outside`, `dropped`, `earlier` and the width of
    /// x0's latest write (`x0_width`, for a return said as it happens), then
    /// per node its caller (one more than its index, 0 for none), entry,
    /// calls, open calls, the width its function reads x0 at (`widths`, 0
    /// when it does not), x0 at its first call and at its latest return,
    /// each as its high and low 32 bits so a 64-bit value stays exact, and
    /// `ret_width`.
    pub fn numbers(&self, widths: &[u8], x0_width: u8, out: &mut Vec<f64>) {
        out.extend([
            self.nodes.len() as f64,
            self.current as f64,
            self.outside as f64,
            self.dropped as f64,
            self.earlier as f64,
            f64::from(x0_width),
        ]);
        for (n, &width) in self.nodes.iter().zip(widths) {
            out.extend([
                n.parent as f64,
                n.entry as f64,
                n.calls as f64,
                n.open as f64,
                f64::from(width),
                (n.arg >> 32) as f64,
                f64::from(n.arg as u32),
                (n.ret >> 32) as f64,
                f64::from(n.ret as u32),
                f64::from(n.ret_width),
            ]);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calls_into_a_fold_count_past_two_to_the_thirty_second() {
        // A program paced by sleeps in the terminal can make more than 2^32
        // calls in one session, so a fold's counts must not wrap there.
        const F: u64 = 0x40_0100;
        let mut tree = CallTree::default();
        tree.start(0x40_0000, 0);
        // Four calls keep a node each; the fifth makes the fold.
        for _ in 0..=RUN_SHOWN {
            tree.enter(F, 0, None);
            tree.leave(0, 8, None);
        }
        let fold = tree.nodes.len() - 1;
        assert!(tree.nodes[fold].folds());
        // Inside the fold, f calls itself and never returns.
        tree.enter(F, 0, None);
        tree.nodes[fold].calls = u32::MAX.into();
        tree.nodes[fold].open = u32::MAX.into();
        tree.enter(F, 0, None);
        assert_eq!(tree.nodes[fold].calls, 1 << 32);
        assert_eq!(tree.nodes[fold].open, 1 << 32);
        // A call past the tree's caps while outside it.
        tree.outside = u32::MAX.into();
        tree.enter(F, 0, None);
        assert_eq!(tree.outside(), 1 << 32);

        let mut out = Vec::new();
        tree.numbers(&[0; MAX_TREE_NODES], 8, &mut out);
        assert_eq!(out[2], (1u64 << 32) as f64, "outside");
        let at = 6 + fold * 10;
        assert_eq!((out[at + 2], out[at + 3]), ((1u64 << 32) as f64, (1u64 << 32) as f64), "calls, open");
    }
}
