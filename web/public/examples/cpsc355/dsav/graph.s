// graph_viz.asm - an undirected graph, walked breadth first and depth first
//
// One drawing, two orders. The eight vertices sit at hand-picked cells so
// every edge the module can draw is either a straight run or an exact
// diagonal: no line algorithm, and the picture stays honest. The frontier
// -- a queue for the breadth first walk, a stack for the depth first one --
// is on screen the whole time, because which end of it empties next is the
// only difference between the two walks, and it is the entire lesson.

define(fp, x29)
define(lr, x30)

    graph_n = 8                             // vertices, labelled A..H
    graph_seg_n = 13                        // pairs this layout can draw
    graph_fcap = 64                         // frontier capacity, with slack

    // role numbers understood by th_fg, th_bg, ui_text and ui_badge
    graph_role_text = 0
    graph_role_dim = 1
    graph_role_faint = 2
    graph_role_accent = 3
    graph_role_key = 4
    graph_role_ok = 5
    graph_role_warn = 6
    graph_role_hot = 7
    graph_role_bad = 8
    graph_role_node = 9

    .data
    .balign 8

// ---------------------------------------------------------------- state

graph_adj:          .skip 64                // 8x8, adj[u*8 + v], symmetric
graph_visited:      .skip 8
graph_comp:         .skip 8                 // component id, 255 = unassigned
graph_fbuf:         .skip graph_fcap        // the frontier, one vertex a byte
graph_order:        .skip 32                // the visit order, as text

    .balign 4
graph_fhead:        .word 0
graph_ftail:        .word 0
graph_curr:         .word -1                // the vertex in hand, -1 = none
graph_order_len:    .word 0
graph_mode:         .word 0                 // 0 = queue walk, 1 = stack walk
graph_show_comp:    .word 0                 // components own the colours
graph_comp_count:   .word 0
graph_speed:        .word 320               // ms between animation steps
graph_ready:        .word 0                 // default graph loaded yet?
graph_msg_arg:      .word 0

    .balign 8
graph_msg:          .dword 0                // caption text, 0 = no caption

// --------------------------------------------------------------- layout
//
// Rows 5, 9 and 13 hold the three tiers; the columns are chosen so that
// every diagonal moves exactly one column per row.
//
//              (A)-------------(B)
//             /   \           /   \
//           (C)   (D)-------(E)   (F)
//             \   /           \   /
//              (G)-------------(H)

    .balign 4
graph_row:          .byte 5, 5, 9, 9, 9, 9, 13, 13
graph_col:          .byte 18, 34, 14, 22, 30, 38, 18, 34

// One-character labels, two bytes apart, so label i starts at
// graph_labels + 2*i and the bare letter is the byte at that address.
graph_labels:
    .string "A"
    .string "B"
    .string "C"
    .string "D"
    .string "E"
    .string "F"
    .string "G"
    .string "H"

// Menu digits, same two-byte stride.
graph_digits:
    .string "1"
    .string "2"
    .string "3"
    .string "4"
    .string "5"
    .string "6"
    .string "7"
    .string "0"

// One row per drawable pair: u, v, kind, first row, first column, cells.
// kind 0 is a horizontal run, 1 steps down and right, 2 down and left.
    .balign 4
graph_segs:
    .byte 0, 1, 0,  5, 20, 13
    .byte 0, 2, 2,  6, 17,  3
    .byte 0, 3, 1,  6, 19,  3
    .byte 1, 4, 2,  6, 33,  3
    .byte 1, 5, 1,  6, 35,  3
    .byte 2, 3, 0,  9, 16,  5
    .byte 2, 6, 1, 10, 15,  3
    .byte 3, 4, 0,  9, 24,  5
    .byte 3, 6, 2, 10, 21,  3
    .byte 4, 5, 0,  9, 32,  5
    .byte 4, 7, 1, 10, 31,  3
    .byte 5, 7, 2, 10, 37,  3
    .byte 6, 7, 0, 13, 20, 13

// The shipped graph, one flag per row of graph_segs. C-D and E-F are left
// out so there is something obvious to add.
graph_default:
    .byte 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1

// Components cycle through four inks so neighbouring blobs never match.
graph_comp_ink:
    .byte graph_role_key, graph_role_ok, graph_role_warn, graph_role_accent

// --------------------------------------------------------------- glyphs

graph_sp:           .string " "
graph_gl_h:         .string "\xe2\x94\x80"  // horizontal run
graph_gl_dr:        .string "\xe2\x95\xb2"  // down and to the right
graph_gl_dl:        .string "\xe2\x95\xb1"  // down and to the left
graph_lbl_next:     .string "\xe2\x96\xb8"  // marks the end that leaves next

// -------------------------------------------------------------- strings

graph_title:        .string "graph  ·  breadth first and depth first"
graph_foot_menu:    .string "one graph, two walks: a queue spreads out, a stack dives in"
graph_foot_run:     .string "watch the frontier - which end empties next is the whole difference"
graph_foot_pick:    .string "0 cancels and returns to the graph menu"

graph_panel_map:    .string "graph"
graph_panel_menu:   .string "operations"
graph_panel_pick:   .string "vertices"
graph_panel_queue:  .string "queue - breadth first"
graph_panel_stack:  .string "stack - depth first"
graph_panel_comp:   .string "components"

graph_mi1:          .string "breadth first search"
graph_mi2:          .string "depth first search"
graph_mi3:          .string "connected components"
graph_mi4:          .string "add an edge"
graph_mi5:          .string "remove an edge"
graph_mi6:          .string "reset the default graph"
graph_mi7:          .string "animation speed"
graph_mi0:          .string "back to the main menu"

graph_lbl_choice:   .string "choice "
graph_lbl_order:    .string "order"
graph_lbl_front:    .string "front"
graph_lbl_top:      .string "top"
graph_lbl_empty:    .string "empty"
graph_lbl_more:     .string "+%d more"
graph_lbl_vertex:   .string "vertex "
graph_lbl_value:    .string "speed  "

graph_lg_curr:      .string "in hand"
graph_lg_done:      .string "visited"
graph_lg_wait:      .string "waiting"
graph_lg_new:       .string "unseen"
graph_lg_comp:      .string "one ink per connected piece"

graph_fmt_size:     .string "size %d"
graph_fmt_comp:     .string "c%d"
graph_fmt_found:    .string "found %d"
graph_fmt_stat:     .string "edges %d      step %d ms"
graph_fmt_range:    .string "60 is brisk, 1000 is a crawl"

graph_ask_start:    .string "walk out from which vertex?"
graph_ask_from:     .string "join which vertex..."
graph_ask_to:       .string "...to which vertex?"
graph_ask_cut:      .string "cut the edge touching which vertex..."
graph_ask_cut2:     .string "...and which vertex?"
graph_ask_speed:    .string "how long should a step hold, in milliseconds?"

graph_pick_row1:    .string "1 A     2 B     3 C     4 D"
graph_pick_row2:    .string "5 E     6 F     7 G     8 H"
graph_pick_zero:    .string "0 cancel"

graph_msg_start:    .string "start: %c goes into the frontier"
graph_msg_dequeue:  .string "dequeue %c from the front"
graph_msg_pop:      .string "pop %c off the top"
graph_msg_seen:     .string "%c came off already visited, drop it"
graph_msg_enqueue:  .string "enqueue %c at the back"
graph_msg_push:     .string "push %c on top"
graph_msg_done:     .string "the frontier is empty, so the walk is over"
graph_msg_comp:     .string "flood out from %c"
graph_msg_comps:    .string "%d connected component(s)"
graph_msg_added:    .string "edge added"
graph_msg_cut:      .string "edge removed"
graph_msg_reset:    .string "back to the graph this module ships with"
graph_msg_nopair:   .string "this layout draws no line between those two"
graph_msg_noedge:   .string "there is no edge between those two"
graph_msg_self:     .string "a vertex cannot join itself"

graph_cx_best:      .string "O(V+E)"
graph_cx_avg:       .string "O(V+E)"
graph_cx_worst:     .string "O(V+E)"
graph_cx_space:     .string "O(V)"

    .text
    .balign 4

// ----------------------------------------------------------- small parts

// graph_edge(w0 = u, w1 = v) -> w0 = 1 when the pair is joined
graph_edge:
    ldr     x2, =graph_adj
    lsl     w3, w0, 3
    add     w3, w3, w1
    ldrb    w0, [x2, w3, sxtw]
    ret

// graph_set_edge(w0 = u, w1 = v, w2 = 1 to join, 0 to cut) - both ways,
// because the graph is undirected and the matrix has to say so
graph_set_edge:
    ldr     x3, =graph_adj
    lsl     w4, w0, 3
    add     w4, w4, w1
    strb    w2, [x3, w4, sxtw]
    lsl     w4, w1, 3
    add     w4, w4, w0
    strb    w2, [x3, w4, sxtw]
    ret

// graph_seg(w0 = u, w1 = v) -> x0 = the segment row, 0 when this layout
// has no line for that pair
graph_seg:
    ldr     x2, =graph_segs
    mov     w3, 0
graph_seg_scan:
    cmp     w3, graph_seg_n
    b.ge    graph_seg_none
    mov     w4, 6
    mul     w4, w3, w4
    sxtw    x4, w4
    add     x5, x2, x4
    ldrb    w6, [x5]
    ldrb    w7, [x5, 1]
    cmp     w6, w0
    b.ne    graph_seg_swapped
    cmp     w7, w1
    b.eq    graph_seg_hit
    b       graph_seg_step
graph_seg_swapped:
    cmp     w6, w1
    b.ne    graph_seg_step
    cmp     w7, w0
    b.eq    graph_seg_hit
graph_seg_step:
    add     w3, w3, 1
    b       graph_seg_scan
graph_seg_hit:
    mov     x0, x5
    ret
graph_seg_none:
    mov     x0, 0
    ret

// graph_push(w0 = v) -> w0 = 1 when it fit
graph_push:
    ldr     x1, =graph_ftail
    ldr     w2, [x1]
    cmp     w2, graph_fcap
    b.ge    graph_push_full
    ldr     x3, =graph_fbuf
    strb    w0, [x3, w2, sxtw]
    add     w2, w2, 1
    str     w2, [x1]
    mov     w0, 1
    ret
graph_push_full:
    mov     w0, 0
    ret

// graph_in_frontier(w0 = v) -> w0 = 1 when v is waiting its turn
graph_in_frontier:
    ldr     x1, =graph_fhead
    ldr     w2, [x1]
    ldr     x1, =graph_ftail
    ldr     w3, [x1]
    ldr     x1, =graph_fbuf
graph_inf_scan:
    cmp     w2, w3
    b.ge    graph_inf_no
    ldrb    w4, [x1, w2, sxtw]
    cmp     w4, w0
    b.eq    graph_inf_yes
    add     w2, w2, 1
    b       graph_inf_scan
graph_inf_yes:
    mov     w0, 1
    ret
graph_inf_no:
    mov     w0, 0
    ret

// graph_note_n(x0 = caption, w1 = the one value it formats)
graph_note_n:
    ldr     x2, =graph_msg
    str     x0, [x2]
    ldr     x2, =graph_msg_arg
    str     w1, [x2]
    ret

// graph_note(x0 = caption, w1 = vertex) - for captions that carry a letter
graph_note:
    ldr     x2, =graph_labels
    sxtw    x1, w1
    add     x2, x2, x1, lsl 1
    ldrb    w1, [x2]
    b       graph_note_n

// graph_blank(w0 = row, w1 = col, w2 = cells) - wipe a run in place
graph_blank:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w2
    bl      ui_at
    ldr     x0, =graph_sp
    mov     w1, w19
    bl      ui_repeat

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_hold(w0 = how many halvings of the step delay) - flush, then wait
graph_hold:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0
    mov     x0, 0                           // fflush(0) drains every stream
    bl      fflush

    ldr     x0, =graph_speed
    ldr     w0, [x0]
    lsr     w0, w0, w19
    cmp     w0, 20                          // below this nothing reads
    b.ge    graph_hold_wait
    mov     w0, 20
graph_hold_wait:
    bl      delay_ms

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_edge_count() -> w0 = how many of the drawable pairs are joined
graph_edge_count:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, 0
    mov     w20, 0
graph_count_loop:
    cmp     w19, graph_seg_n
    b.ge    graph_count_done
    ldr     x0, =graph_segs
    mov     w1, 6
    mul     w1, w19, w1
    sxtw    x1, w1
    add     x0, x0, x1
    ldrb    w1, [x0, 1]
    ldrb    w0, [x0]
    bl      graph_edge
    add     w20, w20, w0
    add     w19, w19, 1
    b       graph_count_loop

graph_count_done:
    mov     w0, w20
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// --------------------------------------------------------------- state

// graph_reset() - load the graph this module ships with
graph_reset:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x19, =graph_adj
    mov     w20, 0
graph_reset_wipe:
    cmp     w20, 64
    b.ge    graph_reset_fill
    strb    wzr, [x19, w20, sxtw]
    add     w20, w20, 1
    b       graph_reset_wipe

graph_reset_fill:
    mov     w20, 0
graph_reset_seg:
    cmp     w20, graph_seg_n
    b.ge    graph_reset_done
    ldr     x0, =graph_default
    ldrb    w0, [x0, w20, sxtw]
    cbz     w0, graph_reset_step

    ldr     x0, =graph_segs
    mov     w1, 6
    mul     w1, w20, w1
    sxtw    x1, w1
    add     x0, x0, x1
    ldrb    w1, [x0, 1]
    ldrb    w0, [x0]
    mov     w2, 1
    bl      graph_set_edge

graph_reset_step:
    add     w20, w20, 1
    b       graph_reset_seg

graph_reset_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_run_reset() - clear everything a walk writes, leaving the edges
graph_run_reset:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, 0
graph_run_clear:
    cmp     w19, graph_n
    b.ge    graph_run_zero
    ldr     x0, =graph_visited
    strb    wzr, [x0, w19, sxtw]
    ldr     x0, =graph_comp
    mov     w1, 255                         // 255 reads as "no component yet"
    strb    w1, [x0, w19, sxtw]
    add     w19, w19, 1
    b       graph_run_clear

graph_run_zero:
    ldr     x0, =graph_fhead
    str     wzr, [x0]
    ldr     x0, =graph_ftail
    str     wzr, [x0]
    ldr     x0, =graph_order_len
    str     wzr, [x0]
    ldr     x0, =graph_order
    strb    wzr, [x0]
    ldr     x0, =graph_show_comp
    str     wzr, [x0]
    ldr     x0, =graph_comp_count
    str     wzr, [x0]
    ldr     x0, =graph_msg
    str     xzr, [x0]
    ldr     x0, =graph_msg_arg
    str     wzr, [x0]
    ldr     x0, =graph_curr
    mov     w1, -1
    str     w1, [x0]

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_order_push(w0 = v) - add a letter to the running visit order
graph_order_push:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, w0
    ldr     x20, =graph_order_len
    ldr     w0, [x20]
    cmp     w0, 28                          // the caption cannot outgrow its row
    b.ge    graph_order_out

    ldr     x1, =graph_labels
    sxtw    x19, w19
    add     x1, x1, x19, lsl 1
    ldrb    w2, [x1]
    ldr     x1, =graph_order
    strb    w2, [x1, w0, sxtw]
    add     w0, w0, 1
    mov     w2, ' '
    strb    w2, [x1, w0, sxtw]
    add     w0, w0, 1
    strb    wzr, [x1, w0, sxtw]             // it stays a C string
    str     w0, [x20]

graph_order_out:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// -------------------------------------------------------------- colours

// graph_vertex_role(w0 = v) -> w0 = the role its chip is painted in
graph_vertex_role:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0

    ldr     x0, =graph_show_comp
    ldr     w0, [x0]
    cbz     w0, graph_vrole_walk

    ldr     x0, =graph_comp
    ldrb    w0, [x0, w19, sxtw]
    cmp     w0, 255
    b.eq    graph_vrole_rest
    and     w0, w0, 3
    ldr     x1, =graph_comp_ink
    ldrb    w0, [x1, w0, sxtw]
    b       graph_vrole_out

graph_vrole_walk:
    ldr     x0, =graph_curr
    ldr     w0, [x0]
    cmp     w0, w19
    b.eq    graph_vrole_hand

    ldr     x0, =graph_visited
    ldrb    w0, [x0, w19, sxtw]
    cbnz    w0, graph_vrole_done

    mov     w0, w19
    bl      graph_in_frontier
    cbnz    w0, graph_vrole_wait

graph_vrole_rest:
    mov     w0, graph_role_node
    b       graph_vrole_out
graph_vrole_hand:
    mov     w0, graph_role_hot
    b       graph_vrole_out
graph_vrole_done:
    mov     w0, graph_role_ok
    b       graph_vrole_out
graph_vrole_wait:
    mov     w0, graph_role_warn

graph_vrole_out:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_edge_role(w0 = u, w1 = v) -> w0 = the role its line is drawn in
graph_edge_role:
    ldr     x2, =graph_show_comp
    ldr     w2, [x2]
    cbz     w2, graph_erole_walk

    ldr     x2, =graph_comp
    ldrb    w2, [x2, w0, sxtw]
    cmp     w2, 255
    b.eq    graph_erole_idle
    and     w2, w2, 3
    ldr     x3, =graph_comp_ink
    ldrb    w0, [x3, w2, sxtw]
    ret

graph_erole_walk:
    // a line lights up once both of its ends have been reached
    ldr     x2, =graph_visited
    ldrb    w3, [x2, w0, sxtw]
    cbz     w3, graph_erole_idle
    ldrb    w3, [x2, w1, sxtw]
    cbz     w3, graph_erole_idle
    mov     w0, graph_role_node
    ret

graph_erole_idle:
    mov     w0, graph_role_faint
    ret

// -------------------------------------------------------------- drawing

// graph_draw_edges() - every drawable pair, present or not; an absent one
// is painted in blanks so a cut edge leaves nothing behind
graph_draw_edges:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     w19, 0
graph_edges_loop:
    cmp     w19, graph_seg_n
    b.ge    graph_edges_done

    ldr     x20, =graph_segs
    mov     w0, 6
    mul     w0, w19, w0
    sxtw    x0, w0
    add     x20, x20, x0

    ldrb    w1, [x20, 1]
    ldrb    w0, [x20]
    bl      graph_edge
    cbz     w0, graph_edges_gap

    ldrb    w1, [x20, 1]
    ldrb    w0, [x20]
    bl      graph_edge_role
    mov     w21, w0

    ldrb    w26, [x20, 2]
    cmp     w26, 0
    b.eq    graph_edges_flat
    cmp     w26, 1
    b.eq    graph_edges_right
    ldr     x22, =graph_gl_dl
    b       graph_edges_ready
graph_edges_flat:
    ldr     x22, =graph_gl_h
    b       graph_edges_ready
graph_edges_right:
    ldr     x22, =graph_gl_dr
    b       graph_edges_ready

graph_edges_gap:
    mov     w21, graph_role_faint
    ldr     x22, =graph_sp
    ldrb    w26, [x20, 2]

graph_edges_ready:
    ldrb    w24, [x20, 3]                   // row of the first cell
    ldrb    w25, [x20, 4]                   // column of the first cell
    ldrb    w23, [x20, 5]                   // how many cells

    mov     w0, w21
    bl      th_fg

    cmp     w26, 0
    b.ne    graph_edges_diag

    // a straight run is contiguous, so park once and repeat
    mov     w0, w24
    mov     w1, w25
    bl      ui_at
    mov     x0, x22
    mov     w1, w23
    bl      ui_repeat
    b       graph_edges_end

graph_edges_diag:
    cbz     w23, graph_edges_end
    mov     w0, w24
    mov     w1, w25
    bl      ui_at
    mov     x0, x22
    bl      printf
    add     w24, w24, 1
    cmp     w26, 1
    b.eq    graph_edges_diag_r
    sub     w25, w25, 1
    b       graph_edges_diag_step
graph_edges_diag_r:
    add     w25, w25, 1
graph_edges_diag_step:
    sub     w23, w23, 1
    b       graph_edges_diag

graph_edges_end:
    bl      th_off
    add     w19, w19, 1
    b       graph_edges_loop

graph_edges_done:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// graph_draw_vertices() - the eight chips, each in the role its state earns
graph_draw_vertices:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    mov     w19, 0
graph_verts_loop:
    cmp     w19, graph_n
    b.ge    graph_verts_done

    mov     w0, w19
    bl      graph_vertex_role
    mov     w20, w0

    ldr     x0, =graph_row
    ldrb    w2, [x0, w19, sxtw]
    ldr     x0, =graph_col
    ldrb    w3, [x0, w19, sxtw]
    sub     w3, w3, 1                       // a chip is three cells wide
    ldr     x4, =graph_labels
    sxtw    x19, w19
    add     x4, x4, x19, lsl 1

    mov     w0, w2
    mov     w1, w3
    mov     w2, w20
    mov     x3, x4
    bl      ui_badge

    add     w19, w19, 1
    b       graph_verts_loop

graph_verts_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// graph_draw_frontier() - the side panel: what is waiting, in the order it
// will be taken
graph_draw_frontier:
    stp     fp, lr, [sp, -80]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    str     x25, [sp, 64]

    mov     w19, 5
graph_front_wipe:
    cmp     w19, 16
    b.gt    graph_front_wiped
    mov     w0, w19
    mov     w1, 53
    mov     w2, 26
    bl      graph_blank
    add     w19, w19, 1
    b       graph_front_wipe

graph_front_wiped:
    ldr     x0, =graph_show_comp
    ldr     w0, [x0]
    cbnz    w0, graph_front_comps

    ldr     x0, =graph_mode
    ldr     w19, [x0]
    ldr     x0, =graph_fhead
    ldr     w20, [x0]
    ldr     x0, =graph_ftail
    ldr     w21, [x0]
    sub     w22, w21, w20                   // how many are waiting

    cbnz    w19, graph_front_top
    ldr     x3, =graph_lbl_front
    b       graph_front_head
graph_front_top:
    ldr     x3, =graph_lbl_top
graph_front_head:
    mov     w0, 5
    mov     w1, 54
    mov     w2, graph_role_dim
    bl      ui_text

    cmp     w22, 0
    b.gt    graph_front_list
    mov     w0, 7
    mov     w1, 54
    mov     w2, graph_role_faint
    ldr     x3, =graph_lbl_empty
    bl      ui_text
    b       graph_front_size

graph_front_list:
    mov     w23, 0
graph_front_row:
    cmp     w23, 8                          // eight rows is all the panel has
    b.ge    graph_front_more
    cmp     w23, w22
    b.ge    graph_front_size

    cbnz    w19, graph_front_row_stack
    add     w24, w20, w23                   // a queue reads front to back
    b       graph_front_row_have
graph_front_row_stack:
    sub     w24, w21, w23                   // a stack reads top down
    sub     w24, w24, 1
graph_front_row_have:
    ldr     x0, =graph_fbuf
    ldrb    w25, [x0, w24, sxtw]

    cbnz    w23, graph_front_row_chip
    add     w0, w23, 6
    mov     w1, 54
    mov     w2, graph_role_key
    ldr     x3, =graph_lbl_next
    bl      ui_text

graph_front_row_chip:
    add     w0, w23, 6
    mov     w1, 56
    mov     w2, graph_role_warn
    ldr     x3, =graph_labels
    sxtw    x25, w25
    add     x3, x3, x25, lsl 1
    bl      ui_badge

    add     w23, w23, 1
    b       graph_front_row

graph_front_more:
    cmp     w22, 8
    b.le    graph_front_size
    mov     w0, 14
    mov     w1, 54
    bl      ui_at
    mov     w0, graph_role_faint
    bl      th_fg
    ldr     x0, =graph_lbl_more
    sub     w1, w22, 8
    bl      printf
    bl      th_off

graph_front_size:
    mov     w0, 15
    mov     w1, 54
    bl      ui_at
    mov     w0, graph_role_dim
    bl      th_fg
    ldr     x0, =graph_fmt_size
    mov     w1, w22
    bl      printf
    bl      th_off
    b       graph_front_out

graph_front_comps:
    mov     w19, 0                          // component id
    mov     w20, 6                          // panel row
graph_front_c_id:
    cmp     w19, graph_n
    b.ge    graph_front_c_total
    cmp     w20, 13
    b.gt    graph_front_c_total

    mov     w21, 0
    mov     w22, 0
graph_front_c_scan:
    cmp     w21, graph_n
    b.ge    graph_front_c_scanned
    ldr     x0, =graph_comp
    ldrb    w0, [x0, w21, sxtw]
    cmp     w0, w19
    b.ne    graph_front_c_scan_step
    add     w22, w22, 1
graph_front_c_scan_step:
    add     w21, w21, 1
    b       graph_front_c_scan
graph_front_c_scanned:
    cbz     w22, graph_front_c_id_step

    ldr     x0, =graph_comp_ink
    and     w1, w19, 3
    ldrb    w23, [x0, w1, sxtw]

    mov     w0, w20
    mov     w1, 54
    bl      ui_at
    mov     w0, graph_role_dim
    bl      th_fg
    ldr     x0, =graph_fmt_comp
    mov     w1, w19
    bl      printf
    bl      th_off

    mov     w21, 0
    mov     w24, 58
graph_front_c_member:
    cmp     w21, graph_n
    b.ge    graph_front_c_row_done
    ldr     x0, =graph_comp
    ldrb    w0, [x0, w21, sxtw]
    cmp     w0, w19
    b.ne    graph_front_c_member_step
    mov     w0, w20
    mov     w1, w24
    mov     w2, w23
    ldr     x3, =graph_labels
    sxtw    x21, w21
    add     x3, x3, x21, lsl 1
    bl      ui_text
    add     w24, w24, 2
graph_front_c_member_step:
    add     w21, w21, 1
    b       graph_front_c_member
graph_front_c_row_done:
    add     w20, w20, 1
graph_front_c_id_step:
    add     w19, w19, 1
    b       graph_front_c_id

graph_front_c_total:
    mov     w0, 15
    mov     w1, 54
    bl      ui_at
    mov     w0, graph_role_dim
    bl      th_fg
    ldr     x0, =graph_fmt_found
    ldr     x1, =graph_comp_count
    ldr     w1, [x1]
    bl      printf
    bl      th_off

graph_front_out:
    ldr     x25, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 80
    ret

// graph_draw_captions() - the order building up, and what just happened
graph_draw_captions:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w0, 18
    mov     w1, 2
    mov     w2, 78
    bl      graph_blank
    mov     w0, 19
    mov     w1, 2
    mov     w2, 78
    bl      graph_blank

    mov     w0, 18
    mov     w1, 3
    mov     w2, graph_role_dim
    ldr     x3, =graph_lbl_order
    bl      ui_text

    mov     w0, 18
    mov     w1, 10
    mov     w2, graph_role_ok
    ldr     x3, =graph_order
    bl      ui_text

    ldr     x19, =graph_msg
    ldr     x19, [x19]
    cbz     x19, graph_caps_out

    mov     w0, 19
    mov     w1, 3
    bl      ui_at
    mov     w0, graph_role_text
    bl      th_fg
    mov     x0, x19
    ldr     x1, =graph_msg_arg
    ldr     w1, [x1]
    bl      printf
    bl      th_off

graph_caps_out:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_paint() - one animation frame: the map, the frontier, the captions
graph_paint:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    bl      graph_draw_edges
    bl      graph_draw_vertices
    bl      graph_draw_frontier
    bl      graph_draw_captions
    mov     x0, 0
    bl      fflush

    ldp     fp, lr, [sp], 16
    ret

// graph_legend(w0 = view) - what the colours mean, spelled out under the
// map. The components view paints by blob rather than by walk state, so it
// gets its own line instead of the four chips.
graph_legend:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    cmp     w0, 2
    b.ne    graph_legend_walk
    mov     w0, 15
    mov     w1, 4
    mov     w2, graph_role_dim
    ldr     x3, =graph_lg_comp
    bl      ui_text
    b       graph_legend_out

graph_legend_walk:
    mov     w0, 15
    mov     w1, 4
    mov     w2, graph_role_hot
    ldr     x3, =graph_sp
    bl      ui_badge
    mov     w0, 15
    mov     w1, 8
    mov     w2, graph_role_dim
    ldr     x3, =graph_lg_curr
    bl      ui_text

    mov     w0, 15
    mov     w1, 16
    mov     w2, graph_role_ok
    ldr     x3, =graph_sp
    bl      ui_badge
    mov     w0, 15
    mov     w1, 20
    mov     w2, graph_role_dim
    ldr     x3, =graph_lg_done
    bl      ui_text

    mov     w0, 15
    mov     w1, 28
    mov     w2, graph_role_warn
    ldr     x3, =graph_sp
    bl      ui_badge
    mov     w0, 15
    mov     w1, 32
    mov     w2, graph_role_dim
    ldr     x3, =graph_lg_wait
    bl      ui_text

    mov     w0, 15
    mov     w1, 40
    mov     w2, graph_role_node
    ldr     x3, =graph_sp
    bl      ui_badge
    mov     w0, 15
    mov     w1, 44
    mov     w2, graph_role_dim
    ldr     x3, =graph_lg_new
    bl      ui_text

graph_legend_out:
    ldp     fp, lr, [sp], 16
    ret

// graph_shell(w0 = 0 queue view, 1 stack view, 2 components view)
// The parts that never move, drawn once so an animation step only has to
// repaint what changed
graph_shell:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     w19, w0

    ldr     x0, =graph_title
    bl      ui_screen
    ldr     x0, =graph_foot_run
    bl      ui_footer

    mov     w0, 4
    mov     w1, 2
    mov     w2, 50
    mov     w3, 14
    ldr     x4, =graph_panel_map
    bl      ui_panel

    cmp     w19, 2
    b.eq    graph_shell_comp
    cbnz    w19, graph_shell_stack
    ldr     x4, =graph_panel_queue
    b       graph_shell_side
graph_shell_stack:
    ldr     x4, =graph_panel_stack
    b       graph_shell_side
graph_shell_comp:
    ldr     x4, =graph_panel_comp
graph_shell_side:
    mov     w0, 4
    mov     w1, 52
    mov     w2, 28
    mov     w3, 14
    bl      ui_panel

    mov     w0, w19
    bl      graph_legend

    mov     w0, 20
    mov     w1, 3
    ldr     x2, =graph_cx_best
    ldr     x3, =graph_cx_avg
    ldr     x4, =graph_cx_worst
    ldr     x5, =graph_cx_space
    bl      ui_complexity

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// --------------------------------------------------------------- prompts

// graph_prompt_vertex(x0 = question) -> w0 = vertex, or -1 when cancelled
graph_prompt_vertex:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0

    ldr     x0, =graph_title
    bl      ui_screen
    ldr     x0, =graph_foot_pick
    bl      ui_footer

    mov     w0, 6
    mov     w1, 14
    mov     w2, 52
    mov     w3, 11
    ldr     x4, =graph_panel_pick
    bl      ui_panel

    mov     w0, 8
    mov     w1, 17
    mov     w2, graph_role_text
    mov     x3, x19
    bl      ui_text

    mov     w0, 10
    mov     w1, 17
    mov     w2, graph_role_key
    ldr     x3, =graph_pick_row1
    bl      ui_text

    mov     w0, 11
    mov     w1, 17
    mov     w2, graph_role_key
    ldr     x3, =graph_pick_row2
    bl      ui_text

    mov     w0, 13
    mov     w1, 17
    mov     w2, graph_role_dim
    ldr     x3, =graph_pick_zero
    bl      ui_text

    bl      ansi_show_cursor
    mov     w0, 15
    mov     w1, 17
    mov     w2, graph_role_text
    ldr     x3, =graph_lbl_vertex
    bl      ui_text
    mov     w0, 15
    mov     w1, 24
    bl      ui_at

    mov     w0, 0                           // 0 is the way out
    mov     w1, graph_n
    bl      read_int_range
    mov     w19, w0
    bl      ansi_hide_cursor

    cmp     w19, 0
    b.eq    graph_prompt_cancel
    sub     w0, w19, 1                      // menu numbers are 1-based
    b       graph_prompt_out
graph_prompt_cancel:
    mov     w0, -1

graph_prompt_out:
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_prompt_speed() - how long each animation step holds
graph_prompt_speed:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =graph_title
    bl      ui_screen
    ldr     x0, =graph_foot_pick
    bl      ui_footer

    mov     w0, 7
    mov     w1, 14
    mov     w2, 52
    mov     w3, 9
    ldr     x4, =graph_panel_pick
    bl      ui_panel

    mov     w0, 9
    mov     w1, 17
    mov     w2, graph_role_text
    ldr     x3, =graph_ask_speed
    bl      ui_text

    mov     w0, 11
    mov     w1, 17
    mov     w2, graph_role_dim
    ldr     x3, =graph_fmt_range
    bl      ui_text

    bl      ansi_show_cursor
    mov     w0, 13
    mov     w1, 17
    mov     w2, graph_role_text
    ldr     x3, =graph_lbl_value
    bl      ui_text
    mov     w0, 13
    mov     w1, 24
    bl      ui_at

    mov     w0, 60
    mov     w1, 1000
    bl      read_int_range
    mov     w19, w0
    mov     w20, w1                         // 0 means end of input
    bl      ansi_hide_cursor

    cbz     w20, graph_speed_keep           // end of input is not an answer:
    ldr     x0, =graph_speed                // keep the step we had
    str     w19, [x0]
graph_speed_keep:

    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_report(x0 = caption) - show the graph at rest with one line of
// explanation, then wait
graph_report:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    mov     x19, x0
    bl      graph_run_reset
    mov     x0, x19
    mov     w1, 0
    bl      graph_note_n

    mov     w0, 0
    bl      graph_shell
    bl      graph_paint
    bl      wait_for_enter

    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// -------------------------------------------------------------- editing

// graph_add_edge() - join two vertices, if this layout can draw the line
graph_add_edge:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =graph_ask_from
    bl      graph_prompt_vertex
    cmp     w0, 0
    b.lt    graph_add_out
    mov     w19, w0

    ldr     x0, =graph_ask_to
    bl      graph_prompt_vertex
    cmp     w0, 0
    b.lt    graph_add_out
    mov     w20, w0

    cmp     w19, w20
    b.ne    graph_add_pair
    ldr     x0, =graph_msg_self
    bl      graph_report
    b       graph_add_out

graph_add_pair:
    mov     w0, w19
    mov     w1, w20
    bl      graph_seg
    cbz     x0, graph_add_nopair

    mov     w0, w19
    mov     w1, w20
    mov     w2, 1
    bl      graph_set_edge
    ldr     x0, =graph_msg_added
    bl      graph_report
    b       graph_add_out

graph_add_nopair:
    ldr     x0, =graph_msg_nopair
    bl      graph_report

graph_add_out:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// graph_cut_edge() - drop an edge the graph currently has
graph_cut_edge:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    ldr     x0, =graph_ask_cut
    bl      graph_prompt_vertex
    cmp     w0, 0
    b.lt    graph_cut_out
    mov     w19, w0

    ldr     x0, =graph_ask_cut2
    bl      graph_prompt_vertex
    cmp     w0, 0
    b.lt    graph_cut_out
    mov     w20, w0

    mov     w0, w19
    mov     w1, w20
    bl      graph_edge
    cbz     w0, graph_cut_none

    mov     w0, w19
    mov     w1, w20
    mov     w2, 0
    bl      graph_set_edge
    ldr     x0, =graph_msg_cut
    bl      graph_report
    b       graph_cut_out

graph_cut_none:
    ldr     x0, =graph_msg_noedge
    bl      graph_report

graph_cut_out:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// ------------------------------------------------------------- the walks

// graph_traverse(w0 = 0 breadth first, 1 depth first)
// One loop runs both walks. The queue hands back its oldest entry and the
// stack its newest, and that single choice is the whole of the difference
// the student is here to see.
graph_traverse:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]
    stp     x25, x26, [sp, 64]

    mov     w19, w0
    ldr     x0, =graph_mode
    str     w19, [x0]

    ldr     x0, =graph_ask_start
    bl      graph_prompt_vertex
    cmp     w0, 0
    b.lt    graph_walk_out
    mov     w20, w0

    bl      graph_run_reset
    ldr     x0, =graph_mode
    str     w19, [x0]                       // the reset does not own the mode

    mov     w0, w20
    bl      graph_push

    mov     w0, w19
    bl      graph_shell

    ldr     x0, =graph_msg_start
    mov     w1, w20
    bl      graph_note
    bl      graph_paint
    mov     w0, 0
    bl      graph_hold

graph_walk_loop:
    ldr     x0, =graph_fhead
    ldr     w21, [x0]
    ldr     x0, =graph_ftail
    ldr     w22, [x0]
    cmp     w21, w22
    b.ge    graph_walk_end

    cbnz    w19, graph_walk_take_top

    // breadth first: the entry that has waited longest leaves first
    ldr     x0, =graph_fbuf
    ldrb    w23, [x0, w21, sxtw]
    add     w21, w21, 1
    ldr     x0, =graph_fhead
    str     w21, [x0]
    ldr     x24, =graph_msg_dequeue
    b       graph_walk_took

graph_walk_take_top:
    // depth first: the newest entry leaves first
    sub     w22, w22, 1
    ldr     x0, =graph_ftail
    str     w22, [x0]
    ldr     x0, =graph_fbuf
    ldrb    w23, [x0, w22, sxtw]
    ldr     x24, =graph_msg_pop

graph_walk_took:
    mov     x0, x24
    mov     w1, w23
    bl      graph_note

    // a stack can hold the same vertex twice; the later copy is stale
    ldr     x0, =graph_visited
    ldrb    w0, [x0, w23, sxtw]
    cbz     w0, graph_walk_visit

    ldr     x0, =graph_msg_seen
    mov     w1, w23
    bl      graph_note
    bl      graph_paint
    mov     w0, 1
    bl      graph_hold
    b       graph_walk_loop

graph_walk_visit:
    ldr     x0, =graph_visited
    mov     w1, 1
    strb    w1, [x0, w23, sxtw]
    ldr     x0, =graph_curr
    str     w23, [x0]
    mov     w0, w23
    bl      graph_order_push
    bl      graph_paint
    mov     w0, 0
    bl      graph_hold

    // the stack takes the neighbours in reverse, so it descends through
    // the lowest-lettered one first, exactly as the recursive walk would
    mov     w25, 0
graph_walk_nbr:
    cmp     w25, graph_n
    b.ge    graph_walk_next
    cbnz    w19, graph_walk_nbr_rev
    mov     w26, w25
    b       graph_walk_nbr_have
graph_walk_nbr_rev:
    mov     w26, graph_n - 1
    sub     w26, w26, w25
graph_walk_nbr_have:
    mov     w0, w23
    mov     w1, w26
    bl      graph_edge
    cbz     w0, graph_walk_nbr_step

    ldr     x0, =graph_visited
    ldrb    w0, [x0, w26, sxtw]
    cbnz    w0, graph_walk_nbr_step

    // the queue never holds a vertex twice; the stack is allowed to
    cbnz    w19, graph_walk_nbr_add
    mov     w0, w26
    bl      graph_in_frontier
    cbnz    w0, graph_walk_nbr_step

graph_walk_nbr_add:
    mov     w0, w26
    bl      graph_push
    cbz     w0, graph_walk_nbr_step

    cbnz    w19, graph_walk_nbr_push
    ldr     x0, =graph_msg_enqueue
    b       graph_walk_nbr_say
graph_walk_nbr_push:
    ldr     x0, =graph_msg_push
graph_walk_nbr_say:
    mov     w1, w26
    bl      graph_note
    bl      graph_paint
    mov     w0, 1
    bl      graph_hold

graph_walk_nbr_step:
    add     w25, w25, 1
    b       graph_walk_nbr

graph_walk_next:
    ldr     x0, =graph_curr
    mov     w1, -1
    str     w1, [x0]
    b       graph_walk_loop

graph_walk_end:
    ldr     x0, =graph_curr
    mov     w1, -1
    str     w1, [x0]
    ldr     x0, =graph_msg_done
    mov     w1, 0
    bl      graph_note_n
    bl      graph_paint
    bl      wait_for_enter

graph_walk_out:
    ldp     x25, x26, [sp, 64]
    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// graph_components() - flood out from every vertex nothing has reached, so
// each blob comes up in its own ink and the count falls out of the walk
graph_components:
    stp     fp, lr, [sp, -96]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    stp     x21, x22, [sp, 32]
    stp     x23, x24, [sp, 48]

    bl      graph_run_reset
    ldr     x0, =graph_show_comp
    mov     w1, 1
    str     w1, [x0]

    mov     w0, 2
    bl      graph_shell

    mov     w19, 0                          // component id
    mov     w20, 0                          // seed vertex
graph_comp_seed:
    cmp     w20, graph_n
    b.ge    graph_comp_done
    ldr     x0, =graph_comp
    ldrb    w0, [x0, w20, sxtw]
    cmp     w0, 255
    b.ne    graph_comp_seed_step

    ldr     x0, =graph_fhead
    str     wzr, [x0]
    ldr     x0, =graph_ftail
    str     wzr, [x0]
    ldr     x0, =graph_comp
    strb    w19, [x0, w20, sxtw]
    add     w1, w19, 1                      // the readout counts what is on
    ldr     x0, =graph_comp_count           // screen, including this one
    str     w1, [x0]
    mov     w0, w20
    bl      graph_push
    ldr     x0, =graph_msg_comp
    mov     w1, w20
    bl      graph_note

graph_comp_fill:
    ldr     x0, =graph_fhead
    ldr     w21, [x0]
    ldr     x0, =graph_ftail
    ldr     w22, [x0]
    cmp     w21, w22
    b.ge    graph_comp_filled

    ldr     x0, =graph_fbuf
    ldrb    w23, [x0, w21, sxtw]
    add     w21, w21, 1
    ldr     x0, =graph_fhead
    str     w21, [x0]

    ldr     x0, =graph_visited
    mov     w1, 1
    strb    w1, [x0, w23, sxtw]
    mov     w0, w23
    bl      graph_order_push
    bl      graph_paint
    mov     w0, 0
    bl      graph_hold

    mov     w24, 0
graph_comp_nbr:
    cmp     w24, graph_n
    b.ge    graph_comp_fill
    mov     w0, w23
    mov     w1, w24
    bl      graph_edge
    cbz     w0, graph_comp_nbr_step
    ldr     x0, =graph_comp
    ldrb    w1, [x0, w24, sxtw]
    cmp     w1, 255
    b.ne    graph_comp_nbr_step
    strb    w19, [x0, w24, sxtw]
    mov     w0, w24
    bl      graph_push
graph_comp_nbr_step:
    add     w24, w24, 1
    b       graph_comp_nbr

graph_comp_filled:
    add     w19, w19, 1
graph_comp_seed_step:
    add     w20, w20, 1
    b       graph_comp_seed

graph_comp_done:
    ldr     x0, =graph_comp_count
    str     w19, [x0]
    ldr     x0, =graph_msg_comps
    mov     w1, w19
    bl      graph_note_n
    bl      graph_paint
    bl      wait_for_enter

    ldr     x0, =graph_show_comp
    str     wzr, [x0]

    ldp     x23, x24, [sp, 48]
    ldp     x21, x22, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 96
    ret

// ----------------------------------------------------------------- menu

// graph_menu_draw() - the operations screen, with the shape and pace of the
// current graph spelled out under it
graph_menu_draw:
    stp     fp, lr, [sp, -48]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]
    str     x21, [sp, 32]

    ldr     x0, =graph_title
    bl      ui_screen
    ldr     x0, =graph_foot_menu
    bl      ui_footer

    mov     w0, 5
    mov     w1, 16
    mov     w2, 48
    mov     w3, 13
    ldr     x4, =graph_panel_menu
    bl      ui_panel

    ldr     x21, =graph_menu_items
    mov     w19, 0
graph_menu_item:
    cmp     w19, 8
    b.ge    graph_menu_stat

    add     w20, w19, 7                     // options begin on row 7
    mov     w0, w20
    mov     w1, 19
    mov     w2, graph_role_key
    ldr     x3, =graph_digits
    sxtw    x19, w19
    add     x3, x3, x19, lsl 1
    bl      ui_badge

    mov     w0, w20
    mov     w1, 23
    mov     w2, graph_role_text
    ldr     x3, [x21, w19, sxtw 3]
    bl      ui_text

    add     w19, w19, 1
    b       graph_menu_item

graph_menu_stat:
    bl      graph_edge_count
    mov     w19, w0
    mov     w0, 18
    mov     w1, 28
    bl      ui_at
    mov     w0, graph_role_dim
    bl      th_fg
    ldr     x0, =graph_fmt_stat
    mov     w1, w19
    ldr     x2, =graph_speed
    ldr     w2, [x2]
    bl      printf
    bl      th_off

    bl      ansi_show_cursor
    mov     w0, 16
    mov     w1, 19
    mov     w2, graph_role_text
    ldr     x3, =graph_lbl_choice
    bl      ui_text
    mov     w0, 16
    mov     w1, 26
    bl      ui_at

    ldr     x21, [sp, 32]
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 48
    ret

// graph_menu() - the module loop; choice 0 hands control back to main
    .global graph_menu
graph_menu:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    str     x19, [sp, 16]

    // the first visit gets the shipped graph
    ldr     x0, =graph_ready
    ldr     w1, [x0]
    cbnz    w1, graph_menu_loop
    mov     w1, 1
    str     w1, [x0]
    bl      graph_reset
    bl      graph_run_reset

graph_menu_loop:
    bl      graph_menu_draw

    mov     w0, 0
    mov     w1, 7
    bl      read_int_range
    mov     w19, w0                         // printf hands back a count, so
    bl      ansi_hide_cursor                // the choice has to be parked here

    cmp     w19, 0
    b.eq    graph_menu_exit
    cmp     w19, 1
    b.eq    graph_menu_bfs
    cmp     w19, 2
    b.eq    graph_menu_dfs
    cmp     w19, 3
    b.eq    graph_menu_comps
    cmp     w19, 4
    b.eq    graph_menu_add
    cmp     w19, 5
    b.eq    graph_menu_cut
    cmp     w19, 6
    b.eq    graph_menu_reset
    cmp     w19, 7
    b.eq    graph_menu_speed
    b       graph_menu_loop

graph_menu_bfs:
    mov     w0, 0
    bl      graph_traverse
    b       graph_menu_loop

graph_menu_dfs:
    mov     w0, 1
    bl      graph_traverse
    b       graph_menu_loop

graph_menu_comps:
    bl      graph_components
    b       graph_menu_loop

graph_menu_add:
    bl      graph_add_edge
    b       graph_menu_loop

graph_menu_cut:
    bl      graph_cut_edge
    b       graph_menu_loop

graph_menu_reset:
    bl      graph_reset
    ldr     x0, =graph_msg_reset
    bl      graph_report
    b       graph_menu_loop

graph_menu_speed:
    bl      graph_prompt_speed
    b       graph_menu_loop

graph_menu_exit:
    bl      ansi_hide_cursor
    ldr     x19, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

    .data
    .balign 8
graph_menu_items:
    .dword graph_mi1, graph_mi2, graph_mi3, graph_mi4
    .dword graph_mi5, graph_mi6, graph_mi7, graph_mi0

    .text
