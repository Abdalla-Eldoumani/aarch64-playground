// send every command-line word as Morse code
define(fp, x29)
define(lr, x30)

define(nargs_r, w19)
define(args_r, x20)
define(i_r, w21)
define(ptr_r, x22)
define(first_r, w23)
define(table_r, x24)
define(ch_r, w25)

.data
m_a:        .string ".-"
m_b:        .string "-..."
m_c:        .string "-.-."
m_d:        .string "-.."
m_e:        .string "."
m_f:        .string "..-."
m_g:        .string "--."
m_h:        .string "...."
m_i:        .string ".."
m_j:        .string ".---"
m_k:        .string "-.-"
m_l:        .string ".-.."
m_m:        .string "--"
m_n:        .string "-."
m_o:        .string "---"
m_p:        .string ".--."
m_q:        .string "--.-"
m_r:        .string ".-."
m_s:        .string "..."
m_t:        .string "-"
m_u:        .string "..-"
m_v:        .string "...-"
m_w:        .string ".--"
m_x:        .string "-..-"
m_y:        .string "-.--"
m_z:        .string "--.."
unknown:    .string "?"

        .balign 8
morse:      .dword  m_a, m_b, m_c, m_d, m_e, m_f, m_g, m_h, m_i
            .dword  m_j, m_k, m_l, m_m, m_n, m_o, m_p, m_q, m_r
            .dword  m_s, m_t, m_u, m_v, m_w, m_x, m_y, m_z

fmt_code:   .string "%s"
fmt_gap:    .string " "
fmt_word:   .string " / "
fmt_end:    .string "\n"
fmt_none:   .string "nothing to send\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     nargs_r, w0
        mov     args_r, x1
        cmp     nargs_r, 2                  // argv[0] is the program itself
        b.lt    no_words

        ldr     table_r, =morse
        mov     i_r, 1
        b       word_test

word_loop:
        cmp     i_r, 1
        b.eq    word_start                  // no slash before the first word
        ldr     x0, =fmt_word
        bl      printf
word_start:
        ldr     ptr_r, [args_r, i_r, SXTW 3]
        mov     first_r, 1
        b       char_test

char_loop:
        cmp     first_r, 1
        b.eq    char_code                   // no gap before a word's first letter
        ldr     x0, =fmt_gap
        bl      printf
char_code:
        mov     first_r, 0

        cmp     ch_r, 'A'                   // fold a capital to lower case
        b.lt    char_lookup
        cmp     ch_r, 'Z'
        b.gt    char_lookup
        add     ch_r, ch_r, 32
char_lookup:
        ldr     x1, =unknown
        cmp     ch_r, 'a'
        b.lt    char_print
        cmp     ch_r, 'z'
        b.gt    char_print
        sub     w9, ch_r, 'a'               // 0 for a, 25 for z
        ldr     x1, [table_r, w9, SXTW 3]   // pointers are 8 bytes apart
char_print:
        ldr     x0, =fmt_code
        bl      printf
        add     ptr_r, ptr_r, 1
char_test:
        ldrb    ch_r, [ptr_r]
        cmp     ch_r, 0
        b.ne    char_loop

        add     i_r, i_r, 1
word_test:
        cmp     i_r, nargs_r
        b.lt    word_loop

        ldr     x0, =fmt_end
        bl      printf
        mov     w0, 0
        b       done

no_words:
        ldr     x0, =fmt_none
        bl      printf
        mov     w0, 1

done:
        ldp     fp, lr, [sp], 16
        ret
