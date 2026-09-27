	.text
	.global	stock
	.section .rodata
	.align	3
.LC0:
	.string	"bolt"
	.align	3
.LC1:
	.string	"nut"
	.align	3
.LC2:
	.string	"gear"
	.align	3
.LC3:
	.string	"cam"
	.data
	.align	3
stock:
	.xword	.LC0
	.word	120
	.zero	4
	.word	0
	.word	1070596096
	.xword	.LC1
	.word	300
	.zero	4
	.word	0
	.word	1069547520
	.xword	.LC2
	.word	7
	.zero	4
	.word	0
	.word	1076428800
	.xword	.LC3
	.word	2
	.zero	4
	.word	0
	.word	1078198272
	.global	table
	.section .rodata
	.align	3
table:
	.zero	8
	.hword	1
	.hword	2
	.hword	3
	.byte	120
	.zero	1
	.zero	16
	.zero	4
	.hword	-9
	.byte	121
	.zero	1
	.zero	8
	.global	zeros
	.bss
	.align	3
zeros:
	.zero	300
	.global	g33
	.align	3
g33:
	.zero	33
	.text
	.align	2
	.global	counter
counter:
	sub	sp, sp, #32
	mov	x2, x0
	mov	x0, x1
	str	x2, [sp]
	and	x1, x0, 4294967295
	ldr	w2, [sp, 8]
	mov	w3, 0
	and	w2, w2, w3
	orr	w1, w2, w1
	str	w1, [sp, 8]
	lsr	x0, x0, 32
	and	x2, x0, 255
	ldrb	w0, [sp, 12]
	mov	w1, 0
	and	w0, w0, w1
	mov	w1, w0
	mov	w0, w2
	orr	w0, w1, w0
	strb	w0, [sp, 12]
	adrp	x0, st.0
	add	x0, x0, :lo12:st.0
	ldr	w0, [x0]
	add	w1, w0, 1
	adrp	x0, st.0
	add	x0, x0, :lo12:st.0
	str	w1, [x0]
	str	wzr, [sp, 28]
	b	.L2
.L3:
	adrp	x0, st.0
	add	x0, x0, :lo12:st.0
	ldr	x1, [x0, 8]
	ldrsw	x0, [sp, 28]
	mov	x2, sp
	ldrb	w0, [x2, x0]
	and	x0, x0, 255
	add	x1, x1, x0
	adrp	x0, st.0
	add	x0, x0, :lo12:st.0
	str	x1, [x0, 8]
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
.L2:
	ldr	w0, [sp, 28]
	cmp	w0, 12
	ble	.L3
	adrp	x0, st.0
	add	x0, x0, :lo12:st.0
	ldr	w1, [x0]
	mov	w0, 1000
	mul	w3, w1, w0
	adrp	x0, st.0
	add	x0, x0, :lo12:st.0
	ldr	x1, [x0, 8]
	mov	x0, 63439
	movk	x0, 0xe353, lsl 16
	movk	x0, 0x9ba5, lsl 32
	movk	x0, 0x20c4, lsl 48
	smulh	x0, x1, x0
	asr	x2, x0, 7
	asr	x0, x1, 63
	sub	x2, x2, x0
	mov	x0, x2
	lsl	x0, x0, 2
	add	x0, x0, x2
	lsl	x2, x0, 2
	add	x0, x0, x2
	lsl	x2, x0, 2
	add	x0, x0, x2
	lsl	x0, x0, 3
	sub	x2, x1, x0
	mov	w0, w2
	add	w0, w3, w0
	add	sp, sp, 32
	ret
	.align	2
	.global	make100
make100:
	sub	sp, sp, #128
	mov	x3, x8
	str	w0, [sp, 12]
	str	wzr, [sp, 124]
	b	.L6
.L7:
	ldr	w1, [sp, 124]
	mov	w0, w1
	lsl	w0, w0, 3
	sub	w1, w0, w1
	ldr	w0, [sp, 12]
	add	w0, w1, w0
	mov	w1, 26
	sdiv	w2, w0, w1
	mov	w1, 26
	mul	w1, w2, w1
	sub	w0, w0, w1
	and	w0, w0, 255
	add	w0, w0, 97
	and	w2, w0, 255
	ldrsw	x0, [sp, 124]
	add	x1, sp, 24
	strb	w2, [x1, x0]
	ldr	w0, [sp, 124]
	add	w0, w0, 1
	str	w0, [sp, 124]
.L6:
	ldr	w0, [sp, 124]
	cmp	w0, 99
	ble	.L7
	mov	x1, x3
	add	x0, sp, 24
	ldr	q26, [x0]
	ldr	q27, [x0, 16]
	ldr	q28, [x0, 32]
	ldr	q29, [x0, 48]
	ldr	q30, [x0, 64]
	ldr	q31, [x0, 80]
	ldr	w0, [x0, 96]
	str	q26, [x1]
	str	q27, [x1, 16]
	str	q28, [x1, 32]
	str	q29, [x1, 48]
	str	q30, [x1, 64]
	str	q31, [x1, 80]
	str	w0, [x1, 96]
	add	sp, sp, 128
	ret
	.align	2
	.global	sum100
sum100:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	xzr, [sp, 24]
	str	wzr, [sp, 20]
	b	.L10
.L11:
	ldr	x1, [sp, 24]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	mov	x1, 52789
	movk	x1, 0x4e5a, lsl 16
	movk	x1, 0xa2a2, lsl 32
	movk	x1, 0x8637, lsl 48
	mul	x4, x0, x1
	smulh	x1, x0, x1
	mov	x2, x4
	mov	x3, x1
	mov	x1, x3
	add	x1, x0, x1
	asr	x4, x1, 19
	asr	x1, x0, 63
	sub	x1, x4, x1
	mov	x4, 16963
	movk	x4, 0xf, lsl 16
	mul	x1, x1, x4
	sub	x1, x0, x1
	ldr	x4, [sp, 8]
	ldrsw	x0, [sp, 20]
	ldrb	w0, [x4, x0]
	and	x0, x0, 255
	add	x0, x1, x0
	str	x0, [sp, 24]
	ldr	w0, [sp, 20]
	add	w0, w0, 1
	str	w0, [sp, 20]
.L10:
	ldr	w0, [sp, 20]
	cmp	w0, 99
	ble	.L11
	ldr	x0, [sp, 24]
	add	sp, sp, 32
	ret
	.align	2
	.global	manhattan
manhattan:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x19, [sp, 16]
	str	x0, [sp, 40]
	str	x1, [sp, 32]
	ldr	w1, [sp, 40]
	ldr	w0, [sp, 32]
	sub	w0, w1, w0
	bl	abs
	mov	w19, w0
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 36]
	sub	w0, w1, w0
	bl	abs
	add	w0, w19, w0
	ldr	x19, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.align	2
	.global	mkfam
mkfam:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	ldrsw	x0, [sp, 28]
	add	x0, x0, 1
	lsl	x0, x0, 3
	bl	malloc
	str	x0, [sp, 32]
	ldr	x0, [sp, 32]
	cmp	x0, 0
	bne	.L16
	mov	x0, 0
	b	.L17
.L16:
	ldr	x0, [sp, 32]
	ldr	w1, [sp, 28]
	str	w1, [x0]
	str	wzr, [sp, 44]
	b	.L18
.L19:
	ldrsw	x1, [sp, 44]
	ldrsw	x0, [sp, 44]
	mul	x0, x1, x0
	sub	x2, x0, #3
	ldr	x1, [sp, 32]
	ldrsw	x0, [sp, 44]
	lsl	x0, x0, 3
	add	x0, x1, x0
	str	x2, [x0, 8]
	ldr	w0, [sp, 44]
	add	w0, w0, 1
	str	w0, [sp, 44]
.L18:
	ldr	w1, [sp, 44]
	ldr	w0, [sp, 28]
	cmp	w1, w0
	blt	.L19
	ldr	x0, [sp, 32]
.L17:
	ldp	x29, x30, [sp], 48
	ret
	.global	knob
	.data
	.align	2
knob:
	.word	4
	.section .rodata
	.align	3
.LC4:
	.string	"%.*s\n%.*s\n%.*s\n"
	.align	3
.LC5:
	.string	"%.*s\n"
	.align	3
.LC6:
	.string	"counter %d\n"
	.align	3
.LC7:
	.string	"zeros %ld %ld %ld %.10s\n"
	.align	3
.LC8:
	.string	"outer %d: %d %d %d %d | %d %d %d %d\n"
	.align	3
.LC9:
	.string	"tails %ld %ld sizes %d %d\n"
	.align	3
.LC10:
	.string	"table %d: %d %d %d %d\n"
	.align	3
.LC11:
	.string	"%-5s %4d %7.3f\n"
	.align	3
.LC12:
	.string	"value %.3f first %s last %s\n"
	.align	3
.LC13:
	.string	"manhattan %d\n"
	.align	3
.LC14:
	.string	"literal %d %d\n"
	.align	3
.LC15:
	.string	"fam %d %ld %ld %ld size %d\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #672
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	str	x21, [sp, 48]
	adrp	x0, knob
	add	x0, x0, :lo12:knob
	ldr	w0, [x0]
	str	w0, [sp, 608]
	str	wzr, [sp, 668]
	b	.L21
.L22:
	ldr	w1, [sp, 668]
	ldr	w0, [sp, 608]
	mul	w0, w1, w0
	mov	w1, 26
	sdiv	w2, w0, w1
	mov	w1, 26
	mul	w1, w2, w1
	sub	w0, w0, w1
	and	w0, w0, 255
	add	w0, w0, 65
	and	w2, w0, 255
	ldrsw	x0, [sp, 668]
	add	x1, sp, 544
	strb	w2, [x1, x0]
	ldr	w0, [sp, 668]
	add	w0, w0, 1
	str	w0, [sp, 668]
.L21:
	ldr	w0, [sp, 668]
	cmp	w0, 32
	ble	.L22
	add	x0, sp, 504
	add	x1, sp, 544
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldrb	w1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	strb	w1, [x0, 32]
	mov	w0, 42
	strb	w0, [sp, 504]
	mov	w0, 33
	strb	w0, [sp, 536]
	adrp	x0, g33
	add	x0, x0, :lo12:g33
	mov	x1, x0
	add	x0, sp, 504
	ldr	q30, [x0]
	ldr	q31, [x0, 16]
	ldrb	w0, [x0, 32]
	str	q30, [x1]
	str	q31, [x1, 16]
	strb	w0, [x1, 32]
	mov	w0, 45
	strb	w0, [sp, 520]
	add	x2, sp, 504
	add	x1, sp, 544
	adrp	x0, g33
	add	x6, x0, :lo12:g33
	mov	w5, 33
	mov	x4, x2
	mov	w3, 33
	mov	x2, x1
	mov	w1, 33
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 664]
	b	.L23
.L24:
	ldr	w1, [sp, 664]
	mov	w0, 10
	sdiv	w2, w1, w0
	mov	w0, w2
	lsl	w0, w0, 2
	add	w0, w0, w2
	lsl	w0, w0, 1
	sub	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 48
	and	w2, w0, 255
	ldrsw	x0, [sp, 664]
	add	x1, sp, 312
	strb	w2, [x1, x0]
	ldr	w0, [sp, 664]
	add	w0, w0, 1
	str	w0, [sp, 664]
.L23:
	ldr	w0, [sp, 664]
	cmp	w0, 46
	ble	.L24
	mov	w0, 1
	str	w0, [sp, 660]
	b	.L25
.L26:
	ldr	w0, [sp, 660]
	sub	w2, w0, #1
	ldrsw	x0, [sp, 660]
	mov	x1, x0
	lsl	x1, x1, 1
	add	x1, x1, x0
	lsl	x1, x1, 4
	sub	x1, x1, x0
	add	x3, sp, 312
	sxtw	x2, w2
	mov	x0, x2
	lsl	x0, x0, 1
	add	x0, x0, x2
	lsl	x0, x0, 4
	sub	x0, x0, x2
	add	x2, sp, 312
	add	x1, x3, x1
	add	x0, x2, x0
	ldr	q29, [x0]
	ldr	q30, [x0, 16]
	ldr	q31, [x0, 31]
	str	q29, [x1]
	str	q30, [x1, 16]
	str	q31, [x1, 31]
	ldr	w0, [sp, 660]
	and	w2, w0, 255
	ldr	w1, [sp, 660]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	add	w1, w2, 97
	and	w3, w1, 255
	sxtw	x2, w0
	ldrsw	x1, [sp, 660]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 4
	sub	x0, x0, x1
	add	x0, x0, 672
	add	x0, sp, x0
	add	x0, x0, x2
	sub	x0, x0, #4096
	mov	w1, w3
	strb	w1, [x0, 3736]
	mov	w1, 46
	ldr	w0, [sp, 660]
	sub	w0, w1, w0
	sxtw	x2, w0
	ldrsw	x1, [sp, 660]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 4
	sub	x0, x0, x1
	add	x0, x0, 672
	add	x0, sp, x0
	add	x0, x0, x2
	sub	x0, x0, #4096
	mov	w1, 35
	strb	w1, [x0, 3736]
	ldr	w0, [sp, 660]
	add	w0, w0, 1
	str	w0, [sp, 660]
.L25:
	ldr	w0, [sp, 660]
	cmp	w0, 3
	ble	.L26
	str	wzr, [sp, 656]
	b	.L27
.L28:
	add	x2, sp, 312
	ldrsw	x1, [sp, 656]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 4
	sub	x0, x0, x1
	add	x0, x2, x0
	mov	x2, x0
	mov	w1, 47
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 656]
	add	w0, w0, 1
	str	w0, [sp, 656]
.L27:
	ldr	w0, [sp, 656]
	cmp	w0, 3
	ble	.L28
	str	wzr, [sp, 652]
	b	.L29
.L30:
	ldr	w0, [sp, 652]
	and	w1, w0, 255
	ldr	w0, [sp, 608]
	and	w0, w0, 255
	mul	w0, w1, w0
	and	w0, w0, 255
	add	w0, w0, 1
	and	w2, w0, 255
	ldrsw	x0, [sp, 652]
	add	x1, sp, 296
	strb	w2, [x1, x0]
	ldr	w0, [sp, 652]
	add	w0, w0, 1
	str	w0, [sp, 652]
.L29:
	ldr	w0, [sp, 652]
	cmp	w0, 12
	ble	.L30
	str	wzr, [sp, 648]
	b	.L31
.L32:
	ldr	x2, [sp, 296]
	ldr	x0, [sp, 304]
	ubfx	x1, x0, 0, 40
	mov	x0, x2
	bl	counter
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	w0, [sp, 648]
	add	w0, w0, 1
	str	w0, [sp, 648]
.L31:
	ldr	w0, [sp, 648]
	cmp	w0, 2
	ble	.L32
	adrp	x0, zeros
	add	x0, x0, :lo12:zeros
	add	x20, x0, 100
	add	x0, sp, 64
	mov	x8, x0
	ldr	w0, [sp, 608]
	bl	make100
	mov	x1, x20
	add	x0, sp, 64
	ldr	q26, [x0]
	ldr	q27, [x0, 16]
	ldr	q28, [x0, 32]
	ldr	q29, [x0, 48]
	ldr	q30, [x0, 64]
	ldr	q31, [x0, 80]
	ldr	w0, [x0, 96]
	str	q26, [x1]
	str	q27, [x1, 16]
	str	q28, [x1, 32]
	str	q29, [x1, 48]
	str	q30, [x1, 64]
	str	q31, [x1, 80]
	str	w0, [x1, 96]
	adrp	x0, zeros
	add	x0, x0, :lo12:zeros
	bl	sum100
	mov	x20, x0
	adrp	x0, zeros+100
	add	x0, x0, :lo12:zeros+100
	bl	sum100
	mov	x21, x0
	adrp	x0, zeros+200
	add	x0, x0, :lo12:zeros+200
	bl	sum100
	mov	x1, x0
	adrp	x0, zeros+100
	add	x4, x0, :lo12:zeros+100
	mov	x3, x1
	mov	x2, x21
	mov	x1, x20
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	stp	xzr, xzr, [sp, 256]
	stp	xzr, xzr, [sp, 272]
	str	xzr, [sp, 288]
	mov	w0, 5
	str	w0, [sp, 256]
	mov	w0, 7
	strh	w0, [sp, 276]
	mov	w0, 8
	strh	w0, [sp, 278]
	mov	w0, 9
	strh	w0, [sp, 280]
	mov	w0, 113
	strb	w0, [sp, 282]
	mov	x0, -1
	str	x0, [sp, 288]
	add	x0, sp, 216
	add	x1, sp, 256
	ldr	q30, [x1]
	ldr	q31, [x1, 16]
	ldr	x1, [x1, 32]
	str	q30, [x0]
	str	q31, [x0, 16]
	str	x1, [x0, 32]
	mov	w0, 80
	strh	w0, [sp, 238]
	mov	w0, 122
	strb	w0, [sp, 226]
	ldr	x1, [sp, 288]
	ldrsw	x0, [sp, 608]
	mul	x0, x1, x0
	str	x0, [sp, 248]
	str	wzr, [sp, 644]
	b	.L33
.L34:
	ldrsw	x0, [sp, 644]
	lsl	x0, x0, 3
	add	x1, sp, 260
	ldrsh	w0, [x1, x0]
	mov	w2, w0
	ldrsw	x0, [sp, 644]
	lsl	x0, x0, 3
	add	x1, sp, 262
	ldrsh	w0, [x1, x0]
	mov	w3, w0
	ldrsw	x0, [sp, 644]
	lsl	x0, x0, 3
	add	x1, sp, 264
	ldrsh	w0, [x1, x0]
	mov	w4, w0
	ldrsw	x0, [sp, 644]
	lsl	x0, x0, 3
	add	x1, sp, 266
	ldrb	w0, [x1, x0]
	mov	w5, w0
	ldrsw	x0, [sp, 644]
	lsl	x0, x0, 3
	add	x1, sp, 220
	ldrsh	w0, [x1, x0]
	mov	w6, w0
	ldrsw	x0, [sp, 644]
	lsl	x0, x0, 3
	add	x1, sp, 222
	ldrsh	w0, [x1, x0]
	mov	w7, w0
	ldrsw	x0, [sp, 644]
	lsl	x0, x0, 3
	add	x1, sp, 224
	ldrsh	w0, [x1, x0]
	mov	w8, w0
	ldrsw	x0, [sp, 644]
	lsl	x0, x0, 3
	add	x1, sp, 226
	ldrb	w0, [x1, x0]
	str	w0, [sp, 8]
	str	w8, [sp]
	ldr	w1, [sp, 644]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	w0, [sp, 644]
	add	w0, w0, 1
	str	w0, [sp, 644]
.L33:
	ldr	w0, [sp, 644]
	cmp	w0, 2
	ble	.L34
	ldr	x0, [sp, 288]
	ldr	x1, [sp, 248]
	mov	w4, 40
	mov	w3, 8
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	str	wzr, [sp, 640]
	b	.L35
.L36:
	adrp	x0, table
	add	x1, x0, :lo12:table
	ldrsw	x0, [sp, 640]
	lsl	x0, x0, 3
	add	x0, x1, x0
	ldr	x0, [x0]
	str	x0, [sp, 176]
	ldrsh	w0, [sp, 176]
	and	w1, w0, 65535
	ldr	w0, [sp, 640]
	and	w0, w0, 65535
	add	w0, w1, w0
	and	w0, w0, 65535
	sxth	w0, w0
	strh	w0, [sp, 176]
	ldrsh	w0, [sp, 176]
	ldrsh	w1, [sp, 178]
	ldrsh	w2, [sp, 180]
	ldrb	w3, [sp, 182]
	mov	w5, w3
	mov	w4, w2
	mov	w3, w1
	mov	w2, w0
	ldr	w1, [sp, 640]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	ldr	w0, [sp, 640]
	add	w0, w0, 1
	str	w0, [sp, 640]
.L35:
	ldr	w0, [sp, 640]
	cmp	w0, 5
	ble	.L36
	str	xzr, [sp, 632]
	str	wzr, [sp, 628]
	b	.L37
.L38:
	adrp	x0, stock
	add	x2, x0, :lo12:stock
	ldrsw	x1, [sp, 628]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x3, [x0]
	adrp	x0, stock
	add	x2, x0, :lo12:stock
	ldrsw	x1, [sp, 628]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	w4, [x0, 8]
	adrp	x0, stock
	add	x2, x0, :lo12:stock
	ldrsw	x1, [sp, 628]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0, 16]
	fmov	d0, d31
	mov	w2, w4
	mov	x1, x3
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	adrp	x0, stock
	add	x2, x0, :lo12:stock
	ldrsw	x1, [sp, 628]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	w0, [x0, 8]
	scvtf	d30, w0
	adrp	x0, stock
	add	x2, x0, :lo12:stock
	ldrsw	x1, [sp, 628]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	d31, [x0, 16]
	fmul	d31, d30, d31
	ldr	d30, [sp, 632]
	fadd	d31, d30, d31
	str	d31, [sp, 632]
	ldr	w0, [sp, 628]
	add	w0, w0, 1
	str	w0, [sp, 628]
.L37:
	ldr	w0, [sp, 628]
	cmp	w0, 3
	ble	.L38
	adrp	x0, stock
	add	x1, x0, :lo12:stock
	add	x0, sp, 192
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	adrp	x0, stock
	add	x1, x0, :lo12:stock
	adrp	x0, stock
	add	x0, x0, :lo12:stock
	add	x0, x0, 72
	mov	x2, x1
	mov	x3, x0
	ldp	x0, x1, [x3]
	ldr	x3, [x3, 16]
	stp	x0, x1, [x2]
	str	x3, [x2, 16]
	adrp	x0, stock
	add	x0, x0, :lo12:stock
	add	x0, x0, 72
	mov	x3, x0
	add	x2, sp, 192
	ldp	x0, x1, [x2]
	ldr	x2, [x2, 16]
	stp	x0, x1, [x3]
	str	x2, [x3, 16]
	adrp	x0, stock
	add	x0, x0, :lo12:stock
	ldr	x1, [x0]
	adrp	x0, stock
	add	x0, x0, :lo12:stock
	ldr	x0, [x0, 72]
	mov	x2, x0
	ldr	d0, [sp, 632]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	mov	x0, 0
	mov	x1, 5
	bfi	x0, x1, 32, 32
	mov	x1, -3
	bfi	x19, x1, 0, 32
	ldr	w1, [sp, 608]
	bfi	x19, x1, 32, 32
	mov	x1, x19
	bl	manhattan
	mov	w1, w0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	mov	w0, 1
	str	w0, [sp, 184]
	mov	w0, 2
	str	w0, [sp, 188]
	add	x0, sp, 184
	str	x0, [sp, 600]
	ldr	x0, [sp, 600]
	ldr	w0, [x0]
	add	w1, w0, 10
	ldr	x0, [sp, 600]
	str	w1, [x0]
	ldr	x0, [sp, 600]
	ldr	w1, [x0]
	ldr	x0, [sp, 600]
	ldr	w0, [x0, 4]
	mov	w2, w0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	mov	w0, 5
	bl	mkfam
	str	x0, [sp, 592]
	ldr	x0, [sp, 592]
	cmp	x0, 0
	bne	.L39
	mov	w0, 1
	b	.L46
.L39:
	mov	x1, 104
	ldr	x0, [sp, 592]
	bl	realloc
	str	x0, [sp, 584]
	ldr	x0, [sp, 584]
	cmp	x0, 0
	bne	.L41
	ldr	x0, [sp, 592]
	bl	free
	mov	w0, 1
	b	.L46
.L41:
	ldr	x0, [sp, 584]
	ldr	w0, [x0]
	str	w0, [sp, 624]
	b	.L42
.L43:
	ldrsw	x0, [sp, 624]
	neg	x1, x0
	ldrsw	x0, [sp, 608]
	mul	x2, x1, x0
	ldr	x1, [sp, 584]
	ldrsw	x0, [sp, 624]
	lsl	x0, x0, 3
	add	x0, x1, x0
	str	x2, [x0, 8]
	ldr	w0, [sp, 624]
	add	w0, w0, 1
	str	w0, [sp, 624]
.L42:
	ldr	w0, [sp, 624]
	cmp	w0, 11
	ble	.L43
	ldr	x0, [sp, 584]
	mov	w1, 12
	str	w1, [x0]
	str	xzr, [sp, 616]
	str	wzr, [sp, 612]
	b	.L44
.L45:
	ldr	x1, [sp, 616]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x1, x0, x1
	ldr	x2, [sp, 584]
	ldrsw	x0, [sp, 612]
	lsl	x0, x0, 3
	add	x0, x2, x0
	ldr	x0, [x0, 8]
	add	x0, x1, x0
	str	x0, [sp, 616]
	ldr	w0, [sp, 612]
	add	w0, w0, 1
	str	w0, [sp, 612]
.L44:
	ldr	x0, [sp, 584]
	ldr	w0, [x0]
	ldr	w1, [sp, 612]
	cmp	w1, w0
	blt	.L45
	ldr	x0, [sp, 584]
	ldr	w1, [x0]
	ldr	x0, [sp, 584]
	ldr	x2, [x0, 40]
	ldr	x0, [sp, 584]
	ldr	x0, [x0, 96]
	mov	w5, 8
	ldr	x4, [sp, 616]
	mov	x3, x0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	ldr	x0, [sp, 584]
	bl	free
	mov	w0, 0
.L46:
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldr	x21, [sp, 48]
	add	sp, sp, 672
	ret


	.bss
	.balign 8
st.0:
	.skip 16
