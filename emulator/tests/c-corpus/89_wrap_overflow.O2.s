	.text
	.align	2
	.p2align 5,,15
fnv32:
	ldrb	w1, [x0]
	mov	x2, x0
	mov	w0, 40389
	movk	w0, 0x811c, lsl 16
	cbz	w1, .L1
	mov	w3, 403
	movk	w3, 0x100, lsl 16
	.p2align 5,,15
.L3:
	eor	w0, w1, w0
	ldrb	w1, [x2, 1]!
	mul	w0, w0, w3
	cbnz	w1, .L3
.L1:
	ret
	.align	2
	.p2align 5,,15
fnv64:
	ldrb	w1, [x0]
	mov	x2, x0
	mov	x0, 8997
	movk	x0, 0x8422, lsl 16
	movk	x0, 0x9ce4, lsl 32
	movk	x0, 0xcbf2, lsl 48
	cbz	w1, .L7
	mov	x3, 435
	movk	x3, 0x100, lsl 32
	.p2align 5,,15
.L9:
	eor	x0, x1, x0
	ldrb	w1, [x2, 1]!
	mul	x0, x0, x3
	cbnz	w1, .L9
.L7:
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"int %d %d: add %d %d sub %d %d mul %d %d\n"
	.align	3
.LC3:
	.string	"long %ld %ld: add %ld %d sub %ld %d mul %ld %d int %d %d\n"
	.align	3
.LC4:
	.string	"uint %u %u: add %u %d sub %u %d mul %u %d wrap %u %u %u\n"
	.align	3
.LC5:
	.string	"ulong %lx %lx: add %lx %d sub %lx %d mul %lx %d\n"
	.align	3
.LC6:
	.string	"narrow %d %d %d %d\n"
	.align	3
.LC7:
	.string	"add192 %lx %lx %lx carry %d\n"
	.align	3
.LC8:
	.string	"sub192 %lx %lx %lx borrow %d\n"
	.align	3
.LC9:
	.string	"sat %u\n"
	.align	3
.LC10:
	.string	"the quick brown fox"
	.align	3
.LC11:
	.string	""
	.align	3
.LC12:
	.string	"fnv32 %08x %08x\n"
	.align	3
.LC13:
	.string	"jumps over the lazy dog"
	.align	3
.LC14:
	.string	"a"
	.align	3
.LC15:
	.string	"fnv64 %016lx %016lx\n"
	.align	3
.LC16:
	.string	"lcg %016lx %08x\n"
	.align	3
.LC17:
	.string	"neg %u %lu %u\n"
	.text
	.align	2
	.p2align 5,,15
	.global	main
main:
	sub	sp, sp, #208
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	adrp	x19, .LANCHOR0
	add	x19, x19, :lo12:.LANCHOR0
	stp	x21, x22, [sp, 64]
	adrp	x21, .LC2
	add	x21, x21, :lo12:.LC2
	mov	w20, 0
	str	x23, [sp, 80]
	.p2align 5,,15
.L19:
	sbfiz	x0, x20, 3, 32
	add	w20, w20, 1
	add	x2, x19, x0
	ldr	w1, [x19, x0]
	ldr	w2, [x2, 4]
	adds	w3, w1, w2
	cset	w4, vs
	subs	w5, w1, w2
	smull	x7, w1, w2
	cset	w6, vs
	asr	x0, x7, 32
	cmp	w0, w7, asr 31
	cset	w0, ne
	str	w0, [sp]
	mov	x0, x21
	bl	printf
	cmp	w20, 9
	bne	.L19
	adrp	x22, .LC3
	add	x21, x19, 80
	add	x22, x22, :lo12:.LC3
	mov	w20, 0
	.p2align 5,,15
.L29:
	sbfiz	x0, x20, 4, 32
	add	w20, w20, 1
	add	x2, x21, x0
	ldr	x1, [x21, x0]
	ldr	x2, [x2, 8]
	adds	x3, x1, x2
	str	w3, [sp, 8]
	smulh	x0, x1, x2
	cset	x4, vs
	mul	x7, x1, x2
	subs	x5, x1, x2
	cset	x6, vs
	cmp	x0, x7, asr 63
	cset	x8, ne
	adds	x0, x1, x2
	cset	w0, vs
	cmp	x3, w3, sxtw
	csinc	w0, w0, wzr, eq
	str	w8, [sp]
	str	w0, [sp, 16]
	mov	x0, x22
	bl	printf
	cmp	w20, 8
	bne	.L29
	adrp	x22, .LC4
	add	x21, x19, 208
	add	x22, x22, :lo12:.LC4
	mov	w20, 0
.L36:
	sbfiz	x0, x20, 3, 32
	add	w20, w20, 1
	add	x2, x21, x0
	ldr	w1, [x21, x0]
	ldr	w2, [x2, 4]
	adds	w3, w1, w2
	str	w3, [sp, 8]
	cset	w4, cs
	subs	w5, w1, w2
	umull	x7, w1, w2
	cset	w6, cc
	mul	w8, w1, w2
	str	w5, [sp, 16]
	str	w8, [sp, 24]
	cmp	xzr, x7, lsr 32
	cset	w0, ne
	str	w0, [sp]
	mov	x0, x22
	bl	printf
	cmp	w20, 5
	bne	.L36
	adrp	x22, .LC5
	add	x21, x19, 256
	add	x22, x22, :lo12:.LC5
	mov	w20, 0
.L43:
	sbfiz	x0, x20, 4, 32
	add	w20, w20, 1
	add	x2, x21, x0
	ldr	x1, [x21, x0]
	ldr	x2, [x2, 8]
	adds	x3, x1, x2
	umulh	x0, x1, x2
	cset	x4, cs
	mul	x7, x1, x2
	subs	x5, x1, x2
	cset	w6, cc
	cmp	x0, 0
	cset	x0, ne
	str	w0, [sp]
	mov	x0, x22
	bl	printf
	cmp	w20, 5
	bne	.L43
	mov	w0, -6
	strb	w0, [sp, 109]
	mov	w0, -6
	strh	w0, [sp, 110]
	ldrb	w1, [sp, 109]
	ldrh	w2, [sp, 110]
	ldrb	w3, [sp, 109]
	add	w1, w1, 10
	ldrb	w0, [sp, 109]
	add	w2, w2, 10
	ldrb	w4, [sp, 109]
	and	w2, w2, 65535
	and	w1, w1, 255
	neg	w4, w4
	mul	w3, w3, w0
	and	w4, w4, 255
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	and	w3, w3, 255
	bl	printf
	adrp	x0, .LANCHOR1
	add	x0, x0, :lo12:.LANCHOR1
	add	x7, sp, 112
	add	x6, sp, 136
	add	x10, sp, 160
	add	x9, sp, 184
	ldp	x2, x3, [x0]
	stp	x2, x3, [sp, 112]
	ldp	x2, x3, [x0, 24]
	ldr	x1, [x0, 16]
	str	x1, [x7, 16]
	ldr	x0, [x0, 40]
	stp	x2, x3, [sp, 136]
	mov	x1, 1
	mov	x3, 0
	mov	x2, 0
	str	x0, [x6, 16]
.L52:
	sub	w5, w1, #1
	add	x8, x10, x1, lsl 3
	ldr	x0, [x7, w5, sxtw 3]
	ldr	x4, [x6, w5, sxtw 3]
	adds	x0, x0, x4
	cset	x4, cs
	adds	x0, x0, x2
	str	x0, [x8, -8]
	cset	x2, cs
	ldr	x0, [x6, w5, sxtw 3]
	orr	x4, x4, x2
	ldr	x5, [x7, w5, sxtw 3]
	sxtw	x2, w4
	subs	x0, x0, x5
	cset	w5, cc
	subs	x0, x0, x3
	add	x3, x9, x1, lsl 3
	cset	w20, cc
	orr	x20, x20, x5
	add	x1, x1, 1
	str	x0, [x3, -8]
	sxtw	x3, w20
	cmp	x1, 4
	bne	.L52
	ldp	x3, x2, [sp, 160]
	adrp	x0, .LC7
	ldr	x1, [sp, 176]
	add	x0, x0, :lo12:.LC7
	adrp	x22, .LC9
	add	x23, x19, 208
	add	x22, x22, :lo12:.LC9
	mov	w21, 0
	bl	printf
	ldp	x3, x2, [sp, 184]
	mov	w4, w20
	ldr	x1, [sp, 200]
	adrp	x0, .LC8
	mov	w20, 0
	add	x0, x0, :lo12:.LC8
	bl	printf
.L53:
	sbfiz	x0, x20, 3, 32
	add	w20, w20, 1
	ldr	w0, [x23, x0]
	adds	w21, w21, w0
	mov	x0, x22
	csinv	w21, w21, wzr, cc
	mov	w1, w21
	bl	printf
	cmp	w20, 5
	bne	.L53
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	fnv32
	mov	w4, w0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	fnv32
	mov	w2, w0
	mov	w1, w4
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	fnv64
	mov	x4, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	fnv64
	mov	x2, x0
	mov	x1, x4
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	x6, 32557
	mov	x5, 33103
	movk	x6, 0x4c95, lsl 16
	movk	x5, 0xf767, lsl 16
	mov	w2, 12345
	movk	x6, 0xf42d, lsl 32
	movk	x5, 0x7b7e, lsl 32
	mov	w4, 20077
	mov	w3, w2
	mov	w0, 1000
	mov	x1, 1
	movk	x6, 0x5851, lsl 48
	movk	x5, 0x1405, lsl 48
	movk	w4, 0x41c6, lsl 16
	.p2align 5,,15
.L54:
	madd	x1, x1, x6, x5
	subs	w0, w0, #1
	madd	w2, w2, w4, w3
	bne	.L54
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	ldr	w1, [x19, 8]
	adrp	x0, .LC17
	ldr	x2, [x19, 96]
	neg	w1, w1
	ldr	w3, [x19, 208]
	add	x0, x0, :lo12:.LC17
	neg	x2, x2
	neg	w3, w3
	bl	printf
	ldr	x23, [sp, 80]
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	add	sp, sp, 208
	ret
	.section .rodata
	.align	3
	.LANCHOR1:
.LC0:
	.xword	-1
	.xword	-1
	.xword	5
.LC1:
	.xword	1
	.xword	0
	.xword	7
	.data
	.align	4
	.LANCHOR0:
ip:
	.word	2147483647
	.word	1
	.word	-2147483648
	.word	-1
	.word	-2147483648
	.word	-2147483648
	.word	-1
	.word	1
	.word	46340
	.word	46340
	.word	46341
	.word	46341
	.word	-65536
	.word	32768
	.word	65536
	.word	32768
	.word	0
	.word	-2147483648
	.zero	8
lp:
	.xword	9223372036854775807
	.xword	1
	.xword	-9223372036854775808
	.xword	-1
	.xword	-9223372036854775808
	.xword	-9223372036854775808
	.xword	3037000499
	.xword	3037000499
	.xword	3037000500
	.xword	3037000500
	.xword	-4294967296
	.xword	2147483648
	.xword	4294967296
	.xword	2147483648
	.xword	0
	.xword	-9223372036854775808
up:
	.word	-1
	.word	1
	.word	0
	.word	1
	.word	65536
	.word	65536
	.word	65535
	.word	65537
	.word	-2147483648
	.word	2
	.zero	8
ulp:
	.xword	-1
	.xword	1
	.xword	0
	.xword	1
	.xword	4294967296
	.xword	4294967296
	.xword	4294967295
	.xword	4294967297
	.xword	-9223372036854775808
	.xword	2

