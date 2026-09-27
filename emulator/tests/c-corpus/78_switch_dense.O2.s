	.text
	.align	2
	.align 5
mix:
	eor	w0, w0, w1
	mov	w1, 403
	movk	w1, 0x100, lsl 16
	mul	w0, w0, w1
	eor	w0, w0, w0, lsr 13
	ret
	.align	2
	.align 5
around:
	add	w2, w0, 4
	cmp	w2, 11
	bls	.L19
	mov	w1, 7
	sdiv	w1, w0, w1
	lsl	w2, w1, 3
	sub	w1, w2, w1
	sub	w0, w0, w1
	add	w0, w0, 1000
	ret
	.align 2
.L19:
	adrp	x0, .L6
	add	x0, x0, :lo12:.L6
	ldrb	w0, [x0,w2,uxtw]
	adr	x2, .Lrtx6
	add	x0, x2, w0, sxtb #2
	br	x0
.Lrtx6:
	.section .rodata
	.align	0
	.align	2
.L6:
	.byte	(.L17 - .Lrtx6) / 4
	.byte	(.L16 - .Lrtx6) / 4
	.byte	(.L15 - .Lrtx6) / 4
	.byte	(.L14 - .Lrtx6) / 4
	.byte	(.L18 - .Lrtx6) / 4
	.byte	(.L12 - .Lrtx6) / 4
	.byte	(.L11 - .Lrtx6) / 4
	.byte	(.L10 - .Lrtx6) / 4
	.byte	(.L9 - .Lrtx6) / 4
	.byte	(.L8 - .Lrtx6) / 4
	.byte	(.L7 - .Lrtx6) / 4
	.byte	(.L5 - .Lrtx6) / 4
	.text
	.align 2
.L18:
	mov	w0, w1
	ret
	.align 2
.L12:
	asr	w0, w1, 1
	ret
	.align 2
.L11:
	mov	w0, 7
	udiv	w0, w1, w0
	lsl	w2, w0, 3
	sub	w0, w2, w0
	sub	w0, w1, w0
	ret
	.align 2
.L10:
	mul	w0, w1, w1
	ret
	.align 2
.L9:
	sub	w0, w1, #1000
	ret
	.align 2
.L8:
	mov	w0, 257
	orr	w0, w1, w0
	ret
	.align 2
.L7:
	and	w0, w1, 240
	ret
	.align 2
.L5:
	neg	w0, w1
	ret
	.align 2
.L17:
	lsl	w0, w1, 1
	ret
	.align 2
.L16:
	add	w0, w1, 30
	ret
	.align 2
.L15:
	sub	w0, w1, #20
	ret
	.align 2
.L14:
	eor	w0, w1, 1
	ret
	.align	2
	.align 5
big:
	cmp	w0, 47
	bls	.L74
	mov	w0, -1
	ret
	.align 2
.L74:
	stp	x29, x30, [sp, -16]!
	mov	w2, w0
	mov	w0, w1
	mov	x29, sp
	adrp	x1, .L23
	add	x1, x1, :lo12:.L23
	ldrh	w1, [x1,w2,uxtw #1]
	adr	x2, .Lrtx23
	add	x1, x2, w1, sxth #2
	br	x1
.Lrtx23:
	.section .rodata
	.align	0
	.align	2
.L23:
	.hword	(.L70 - .Lrtx23) / 4
	.hword	(.L69 - .Lrtx23) / 4
	.hword	(.L68 - .Lrtx23) / 4
	.hword	(.L67 - .Lrtx23) / 4
	.hword	(.L66 - .Lrtx23) / 4
	.hword	(.L65 - .Lrtx23) / 4
	.hword	(.L64 - .Lrtx23) / 4
	.hword	(.L63 - .Lrtx23) / 4
	.hword	(.L62 - .Lrtx23) / 4
	.hword	(.L61 - .Lrtx23) / 4
	.hword	(.L60 - .Lrtx23) / 4
	.hword	(.L59 - .Lrtx23) / 4
	.hword	(.L58 - .Lrtx23) / 4
	.hword	(.L57 - .Lrtx23) / 4
	.hword	(.L56 - .Lrtx23) / 4
	.hword	(.L55 - .Lrtx23) / 4
	.hword	(.L54 - .Lrtx23) / 4
	.hword	(.L53 - .Lrtx23) / 4
	.hword	(.L52 - .Lrtx23) / 4
	.hword	(.L51 - .Lrtx23) / 4
	.hword	(.L50 - .Lrtx23) / 4
	.hword	(.L49 - .Lrtx23) / 4
	.hword	(.L48 - .Lrtx23) / 4
	.hword	(.L47 - .Lrtx23) / 4
	.hword	(.L46 - .Lrtx23) / 4
	.hword	(.L45 - .Lrtx23) / 4
	.hword	(.L44 - .Lrtx23) / 4
	.hword	(.L43 - .Lrtx23) / 4
	.hword	(.L42 - .Lrtx23) / 4
	.hword	(.L41 - .Lrtx23) / 4
	.hword	(.L40 - .Lrtx23) / 4
	.hword	(.L39 - .Lrtx23) / 4
	.hword	(.L38 - .Lrtx23) / 4
	.hword	(.L37 - .Lrtx23) / 4
	.hword	(.L36 - .Lrtx23) / 4
	.hword	(.L35 - .Lrtx23) / 4
	.hword	(.L34 - .Lrtx23) / 4
	.hword	(.L33 - .Lrtx23) / 4
	.hword	(.L32 - .Lrtx23) / 4
	.hword	(.L31 - .Lrtx23) / 4
	.hword	(.L30 - .Lrtx23) / 4
	.hword	(.L29 - .Lrtx23) / 4
	.hword	(.L28 - .Lrtx23) / 4
	.hword	(.L27 - .Lrtx23) / 4
	.hword	(.L26 - .Lrtx23) / 4
	.hword	(.L25 - .Lrtx23) / 4
	.hword	(.L24 - .Lrtx23) / 4
	.hword	(.L22 - .Lrtx23) / 4
	.text
	.align 2
.L24:
	mov	w1, 22775
	movk	w1, 0xc2f, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 58437
	movk	w1, 0xabc5, lsl 16
	b	mix
	.align 2
.L25:
	mov	w1, 57150
	movk	w1, 0x6df7, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 59206
	movk	w1, 0xa8c6, lsl 16
	b	mix
	.align 2
.L26:
	mov	w1, 25989
	movk	w1, 0xcfc0, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 58951
	movk	w1, 0xa9c7, lsl 16
	b	mix
	.align 2
.L27:
	mov	w1, 60364
	movk	w1, 0x3188, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 57664
	movk	w1, 0xaec0, lsl 16
	b	mix
	.align 2
.L28:
	mov	w1, 29203
	movk	w1, 0x9351, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 57409
	movk	w1, 0xafc1, lsl 16
	b	mix
	.align 2
.L29:
	mov	w1, 63578
	movk	w1, 0xf519, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 58178
	movk	w1, 0xacc2, lsl 16
	b	mix
	.align 2
.L30:
	mov	w1, 32417
	movk	w1, 0x56e2, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 57923
	movk	w1, 0xadc3, lsl 16
	b	mix
	.align 2
.L31:
	mov	w1, 1256
	movk	w1, 0xb8ab, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 60748
	movk	w1, 0xa2cc, lsl 16
	b	mix
	.align 2
.L32:
	mov	w1, 35631
	movk	w1, 0x1a73, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 60493
	movk	w1, 0xa3cd, lsl 16
	b	mix
	.align 2
.L33:
	mov	w1, 4470
	movk	w1, 0x7c3c, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 61262
	movk	w1, 0xa0ce, lsl 16
	b	mix
	.align 2
.L34:
	mov	w1, 38845
	movk	w1, 0xde04, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 61007
	movk	w1, 0xa1cf, lsl 16
	b	mix
	.align 2
.L35:
	mov	w1, 7684
	movk	w1, 0x3fcd, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 59720
	movk	w1, 0xa6c8, lsl 16
	b	mix
	.align 2
.L36:
	mov	w1, 42059
	movk	w1, 0xa195, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 59465
	movk	w1, 0xa7c9, lsl 16
	b	mix
	.align 2
.L37:
	mov	w1, 10898
	movk	w1, 0x35e, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 60234
	movk	w1, 0xa4ca, lsl 16
	b	mix
	.align 2
.L38:
	mov	w1, 45273
	movk	w1, 0x6526, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 59979
	movk	w1, 0xa5cb, lsl 16
	b	mix
	.align 2
.L39:
	mov	w1, 14112
	movk	w1, 0xc6ef, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 54644
	movk	w1, 0x9af4, lsl 16
	b	mix
	.align 2
.L40:
	mov	w1, 48487
	movk	w1, 0x28b7, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 54389
	movk	w1, 0x9bf5, lsl 16
	b	mix
	.align 2
.L41:
	mov	w1, 17326
	movk	w1, 0x8a80, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 55158
	movk	w1, 0x98f6, lsl 16
	b	mix
	.align 2
.L42:
	mov	w1, 51701
	movk	w1, 0xec48, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 54903
	movk	w1, 0x99f7, lsl 16
	b	mix
	.align 2
.L43:
	mov	w1, 20540
	movk	w1, 0x4e11, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 53616
	movk	w1, 0x9ef0, lsl 16
	b	mix
	.align 2
.L44:
	mov	w1, 54915
	movk	w1, 0xafd9, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 53361
	movk	w1, 0x9ff1, lsl 16
	b	mix
	.align 2
.L45:
	mov	w1, 23754
	movk	w1, 0x11a2, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 54130
	movk	w1, 0x9cf2, lsl 16
	b	mix
	.align 2
.L46:
	mov	w1, 58129
	movk	w1, 0x736a, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 53875
	movk	w1, 0x9df3, lsl 16
	b	mix
	.align 2
.L47:
	mov	w1, 26968
	movk	w1, 0xd533, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 56700
	movk	w1, 0x92fc, lsl 16
	b	mix
	.align 2
.L48:
	mov	w1, 61343
	movk	w1, 0x36fb, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 56445
	movk	w1, 0x93fd, lsl 16
	b	mix
	.align 2
.L49:
	mov	w1, 30182
	movk	w1, 0x98c4, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 57214
	movk	w1, 0x90fe, lsl 16
	b	mix
	.align 2
.L50:
	mov	w1, 64557
	movk	w1, 0xfa8c, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 56959
	movk	w1, 0x91ff, lsl 16
	b	mix
	.align 2
.L51:
	mov	w1, 33396
	movk	w1, 0x5c55, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 55672
	movk	w1, 0x96f8, lsl 16
	b	mix
	.align 2
.L52:
	mov	w1, 2235
	movk	w1, 0xbe1e, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 55417
	movk	w1, 0x97f9, lsl 16
	b	mix
	.align 2
.L53:
	mov	w1, 36610
	movk	w1, 0x1fe6, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 56186
	movk	w1, 0x94fa, lsl 16
	b	mix
	.align 2
.L54:
	mov	w1, 5449
	movk	w1, 0x81af, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 55931
	movk	w1, 0x95fb, lsl 16
	b	mix
	.align 2
.L55:
	mov	w1, 39824
	movk	w1, 0xe377, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 50532
	movk	w1, 0x8ae4, lsl 16
	b	mix
	.align 2
.L56:
	mov	w1, 8663
	movk	w1, 0x4540, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 50277
	movk	w1, 0x8be5, lsl 16
	b	mix
	.align 2
.L57:
	mov	w1, 43038
	movk	w1, 0xa708, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 51046
	movk	w1, 0x88e6, lsl 16
	b	mix
	.align 2
.L58:
	mov	w1, 11877
	movk	w1, 0x8d1, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 50791
	movk	w1, 0x89e7, lsl 16
	b	mix
	.align 2
.L59:
	mov	w1, 46252
	movk	w1, 0x6a99, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 49504
	movk	w1, 0x8ee0, lsl 16
	b	mix
	.align 2
.L60:
	mov	w1, 15091
	movk	w1, 0xcc62, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 49249
	movk	w1, 0x8fe1, lsl 16
	b	mix
	.align 2
.L61:
	mov	w1, 49466
	movk	w1, 0x2e2a, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 50018
	movk	w1, 0x8ce2, lsl 16
	b	mix
	.align 2
.L62:
	mov	w1, 18305
	movk	w1, 0x8ff3, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 49763
	movk	w1, 0x8de3, lsl 16
	b	mix
	.align 2
.L63:
	mov	w1, 52680
	movk	w1, 0xf1bb, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 52588
	movk	w1, 0x82ec, lsl 16
	b	mix
	.align 2
.L64:
	mov	w1, 21519
	movk	w1, 0x5384, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 52333
	movk	w1, 0x83ed, lsl 16
	b	mix
	.align 2
.L65:
	mov	w1, 55894
	movk	w1, 0xb54c, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 53102
	movk	w1, 0x80ee, lsl 16
	b	mix
	.align 2
.L66:
	mov	w1, 24733
	movk	w1, 0x1715, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 52847
	movk	w1, 0x81ef, lsl 16
	b	mix
	.align 2
.L67:
	mov	w1, 59108
	movk	w1, 0x78dd, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 51560
	movk	w1, 0x86e8, lsl 16
	b	mix
	.align 2
.L68:
	mov	w1, 27947
	movk	w1, 0xdaa6, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 51305
	movk	w1, 0x87e9, lsl 16
	b	mix
	.align 2
.L69:
	mov	w1, 62322
	movk	w1, 0x3c6e, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 52074
	movk	w1, 0x84ea, lsl 16
	b	mix
	.align 2
.L70:
	mov	w1, 31161
	movk	w1, 0x9e37, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 51819
	movk	w1, 0x85eb, lsl 16
	b	mix
	.align 2
.L22:
	mov	w1, 53936
	movk	w1, 0xaa66, lsl 16
	bl	mix
	ldp	x29, x30, [sp], 16
	mov	w1, 58692
	movk	w1, 0xaac4, lsl 16
	b	mix
	.section .rodata
	.align	3
.LC2:
	.string	"?"
	.text
	.align	2
	.align 5
month:
	sub	w0, w0, #1
	cmp	w0, 11
	bhi	.L77
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	ldr	x0, [x1, w0, uxtw 3]
	ret
	.align 2
.L77:
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	ret
	.align	2
	.align 5
wide:
	cmp	x0, 11
	bhi	.L93
	cmp	w0, 11
	bls	.L94
.L93:
	mov	x0, -1
	ret
	.align 2
.L94:
	adrp	x2, .L81
	add	x2, x2, :lo12:.L81
	ldrb	w2, [x2,w0,uxtw]
	adr	x0, .Lrtx81
	add	x2, x0, w2, sxtb #2
	br	x2
.Lrtx81:
	.section .rodata
	.align	0
	.align	2
.L81:
	.byte	(.L92 - .Lrtx81) / 4
	.byte	(.L91 - .Lrtx81) / 4
	.byte	(.L90 - .Lrtx81) / 4
	.byte	(.L89 - .Lrtx81) / 4
	.byte	(.L88 - .Lrtx81) / 4
	.byte	(.L87 - .Lrtx81) / 4
	.byte	(.L86 - .Lrtx81) / 4
	.byte	(.L85 - .Lrtx81) / 4
	.byte	(.L84 - .Lrtx81) / 4
	.byte	(.L83 - .Lrtx81) / 4
	.byte	(.L82 - .Lrtx81) / 4
	.byte	(.L80 - .Lrtx81) / 4
	.text
	.align 2
.L82:
	sub	x0, x1, x1, asr 5
	ret
	.align 2
.L80:
	mov	x0, 62983
	movk	x0, 0xa98e, lsl 16
	movk	x0, 0xbd81, lsl 32
	movk	x0, 0x6a63, lsl 48
	umulh	x0, x1, x0
	lsr	x0, x0, 5
	add	x2, x0, x0, lsl 3
	add	x2, x0, x2, lsl 1
	add	x0, x0, x2, lsl 2
	sub	x1, x1, x0
	add	x0, x1, 1
	ret
	.align 2
.L92:
	add	x0, x1, 100
	ret
	.align 2
.L91:
	sub	x0, x1, #100
	ret
	.align 2
.L90:
	lsl	x0, x1, 3
	sub	x0, x0, x1
	ret
	.align 2
.L89:
	eor	x0, x1, 127
	ret
	.align 2
.L88:
	lsl	x0, x1, 3
	ret
	.align 2
.L87:
	asr	x0, x1, 2
	ret
	.align 2
.L86:
	mov	x0, 58255
	movk	x0, 0x8e38, lsl 16
	movk	x0, 0x38e3, lsl 32
	movk	x0, 0xe38e, lsl 48
	umulh	x1, x1, x0
	lsr	x0, x1, 3
	ret
	.align 2
.L85:
	mov	x2, 63439
	lsr	x0, x1, 3
	movk	x2, 0xe353, lsl 16
	movk	x2, 0x9ba5, lsl 32
	movk	x2, 0x20c4, lsl 48
	umulh	x0, x0, x2
	lsr	x0, x0, 4
	add	x0, x0, x0, lsl 2
	add	x0, x0, x0, lsl 2
	add	x0, x0, x0, lsl 2
	sub	x0, x1, x0, lsl 3
	ret
	.align 2
.L84:
	mvn	x0, x1
	ret
	.align 2
.L83:
	and	x0, x1, 65535
	ret
	.align	2
	.align 5
cls:
	cmp	w0, 117
	bhi	.L97
	adrp	x1, .LANCHOR0
	add	x1, x1, :lo12:.LANCHOR0
	add	x1, x1, 96
	ldrsb	w0, [x1, w0, uxtw]
	ret
	.align 2
.L97:
	mov	w0, 4
	ret
	.align	2
	.align 5
duff:
	adds	w3, w2, 7
	add	w4, w2, 14
	csel	w4, w4, w3, mi
	negs	w3, w2
	and	w3, w3, 7
	and	w2, w2, 7
	csneg	w3, w2, w3, mi
	asr	w4, w4, 3
	cmp	w3, 4
	beq	.L99
	bgt	.L100
	cmp	w3, 2
	beq	.L101
	cmp	w3, 3
	beq	.L102
	cbz	w2, .L103
	cmp	w3, 1
	beq	.L104
.L98:
	ret
	.align 2
.L100:
	cmp	w3, 6
	beq	.L106
	cmp	w3, 7
	bne	.L108
.L107:
	ldr	w2, [x1], 4
	str	w2, [x0], 4
.L106:
	ldr	w2, [x1], 4
	str	w2, [x0], 4
.L108:
	ldr	w2, [x1], 4
	str	w2, [x0], 4
.L99:
	ldr	w2, [x1], 4
	str	w2, [x0], 4
.L102:
	ldr	w2, [x1], 4
	str	w2, [x0], 4
.L101:
	ldr	w2, [x1], 4
	str	w2, [x0], 4
.L104:
	ldr	w2, [x1]
	sub	w4, w4, #1
	str	w2, [x0]
	cmp	w4, 0
	ble	.L98
	add	x1, x1, 4
	add	x0, x0, 4
.L103:
	ldr	w2, [x1], 4
	str	w2, [x0], 4
	b	.L107
	.section .rodata
	.align	3
.LC3:
	.string	" "
	.align	3
.LC4:
	.string	"\nbig: "
	.align	3
.LC6:
	.string	"around:"
	.align	3
.LC7:
	.string	" %d"
	.align	3
.LC8:
	.string	" %d %d\n"
	.align	3
.LC9:
	.string	"big: "
	.align	3
.LC10:
	.string	"%s%08x"
	.align	3
.LC11:
	.string	"\n"
	.align	3
.LC12:
	.string	"month:"
	.align	3
.LC13:
	.string	" %s"
	.align	3
.LC14:
	.string	"wide:"
	.align	3
.LC15:
	.string	" %ld"
	.align	3
.LC16:
	.string	"cls: "
	.align	3
.LC17:
	.string	"Hello, World! 42 apples; 7 oranges?\t\200\377. Quiet x9 zone"
	.align	3
.LC18:
	.string	"\ncounts: %d %d %d %d %d %d\n"
	.align	3
.LC19:
	.string	"duff:"
	.align	3
.LC20:
	.string	" %d%c"
	.text
	.align	2
	.align 5
	.global	main
main:
	sub	sp, sp, #528
	adrp	x0, .LANCHOR1
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	ldr	w21, [x0, :lo12:.LANCHOR1]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	sub	w22, w21, #50
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC7
	mov	w19, 44
	add	x20, x20, :lo12:.LC7
	stp	x23, x24, [sp, 48]
	stp	x25, x26, [sp, 64]
	str	x27, [sp, 80]
	bl	printf
	.align 5
.L125:
	mov	w1, w19
	add	w0, w22, w19
	bl	around
	add	w19, w19, 1
	mov	w1, w0
	mov	x0, x20
	bl	printf
	cmp	w19, 60
	bne	.L125
	mov	w1, 5
	mov	w0, -2147483648
	add	w0, w21, w0
	bl	around
	mov	w3, w0
	mov	w1, 5
	mov	w0, 2147483647
	add	w0, w21, w0
	bl	around
	mov	w2, w0
	mov	w25, 52429
	mov	w1, w3
	sub	w20, w21, #1
	adrp	x0, .LC8
	mov	w19, 0
	add	x0, x0, :lo12:.LC8
	movk	w25, 0xcccc, lsl 16
	bl	printf
	adrp	x24, .LC4
	adrp	x23, .LC3
	mov	w1, 4659
	mov	w0, w20
	adrp	x22, .LC10
	bl	big
	add	x22, x22, :lo12:.LC10
	mov	w2, w0
	adrp	x1, .LC9
	mov	x0, x22
	add	x1, x1, :lo12:.LC9
	bl	printf
	.align 5
.L126:
	mov	w0, 4660
	add	w1, w19, w0
	add	w19, w19, 1
	mov	w2, 858993459
	add	x0, x24, :lo12:.LC4
	add	x3, x23, :lo12:.LC3
	mul	w4, w19, w25
	cmp	w4, w2
	csel	x3, x3, x0, hi
	add	w0, w19, w21
	sub	w0, w0, #1
	bl	big
	mov	w2, w0
	mov	x1, x3
	mov	x0, x22
	bl	printf
	cmp	w19, 49
	bne	.L126
	adrp	x24, .LC11
	add	x24, x24, :lo12:.LC11
	mov	x0, x24
	adrp	x22, .LANCHOR0
	bl	printf
	add	x22, x22, :lo12:.LANCHOR0
	add	x0, x22, 240
	adrp	x23, .LC13
	add	x19, sp, 128
	add	x25, sp, 172
	ldp	q29, q30, [x22, 240]
	add	x23, x23, :lo12:.LC13
	ldr	q31, [x0, 28]
	adrp	x0, .LC12
	stp	q29, q30, [sp, 128]
	add	x0, x0, :lo12:.LC12
	str	q31, [sp, 156]
	bl	printf
	.align 5
.L129:
	ldr	w0, [x19], 4
	add	w0, w21, w0
	bl	month
	mov	x1, x0
	mov	x0, x23
	bl	printf
	cmp	x19, x25
	bne	.L129
	mov	x0, x24
	bl	printf
	ldp	q31, q30, [x22, 352]
	add	x19, sp, 376
	ldp	q29, q28, [x22, 320]
	mov	x23, 26505
	ldp	q27, q26, [x22, 288]
	stp	q31, q30, [x19, 64]
	sxtw	x25, w21
	ldr	q31, [x22, 416]
	stp	q29, q28, [x19, 32]
	movk	x23, 0x2345, lsl 16
	ldp	q30, q29, [x22, 384]
	movk	x23, 0x1, lsl 32
	ldr	x0, [x22, 432]
	adrp	x26, .LC15
	add	x23, x25, x23
	add	x26, x26, :lo12:.LC15
	stp	q27, q26, [x19]
	stp	q30, q29, [x19, 96]
	str	q31, [x19, 128]
	str	x0, [x19, 144]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	printf
	.align 5
.L130:
	ldr	x0, [x19], 8
	mov	x1, x23
	add	x0, x25, x0
	bl	wide
	mov	x1, x0
	mov	x0, x26
	bl	printf
	add	x0, sp, 528
	cmp	x19, x0
	bne	.L130
	mov	x0, x24
	adrp	x23, .LC17
	bl	printf
	add	x23, x23, :lo12:.LC17
	add	x19, x23, 1
	adrp	x0, .LC16
	add	x23, x23, 54
	add	x0, x0, :lo12:.LC16
	add	x25, sp, 104
	stp	xzr, xzr, [sp, 104]
	str	xzr, [sp, 120]
	bl	printf
	mov	w0, 72
	.align 5
.L131:
	add	w0, w0, w21
	bl	cls
	sbfiz	x2, x0, 2, 32
	add	w0, w0, 48
	ldr	w1, [x25, x2]
	add	w1, w1, 1
	str	w1, [x25, x2]
	bl	putchar
	ldrb	w0, [x19], 1
	cmp	x19, x23
	bne	.L131
	mov	w0, w21
	bl	cls
	ldp	w1, w2, [sp, 104]
	mov	w6, w0
	ldp	w3, w4, [sp, 112]
	adrp	x0, .LC18
	ldr	w5, [sp, 120]
	add	x0, x0, :lo12:.LC18
	add	x26, sp, 176
	add	x25, sp, 272
	bl	printf
	ldr	q31, [x22, 224]
	mov	x0, x26
	movi	v29.4s, 0x4
	.align 5
.L132:
	movi	v28.4s, 0x1
	mla	v28.4s, v31.4s, v31.4s
	add	v31.4s, v31.4s, v29.4s
	str	q28, [x0], 16
	cmp	x25, x0
	bne	.L132
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	printf
	adrp	x21, .LC20
	mvni	v31.4s, 0
	add	x21, x21, :lo12:.LC20
	add	x27, sp, 368
	mov	x5, 2
	mov	w23, 33
	mov	w22, 43
	.align 5
.L133:
	mov	x0, x25
	.align 5
.L134:
	str	q31, [x0], 16
	cmp	x0, x27
	bne	.L134
	add	w2, w20, w5
	mov	x1, x26
	mov	x0, x25
	bl	duff
	mov	x19, 1
	mov	w2, w19
	mov	w1, 0
	.align 5
.L135:
	add	x0, x25, x19, lsl 2
	add	x3, x26, x19, lsl 2
	add	x19, x19, 1
	ldr	w0, [x0, -4]
	ldr	w3, [x3, -4]
	add	w1, w1, w0
	cmp	w3, w0
	cset	w3, eq
	and	w2, w2, w3
	cmp	x19, x5
	bne	.L135
	add	x0, x25, x19, lsl 2
	ldr	w0, [x0, -4]
	cmn	w0, #1
	cset	w0, eq
	tst	w0, w2
	mov	x0, x21
	csel	w2, w23, w22, eq
	bl	printf
	mvni	v31.4s, 0
	add	x5, x19, 1
	cmp	x19, 21
	bne	.L133
	mov	x0, x24
	bl	printf
	ldr	x27, [sp, 80]
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	add	sp, sp, 528
	ret
	.section .rodata
	.align	3
.LC21:
	.string	"jan"
	.align	3
.LC22:
	.string	"feb"
	.align	3
.LC23:
	.string	"mar"
	.align	3
.LC24:
	.string	"apr"
	.align	3
.LC25:
	.string	"may"
	.align	3
.LC26:
	.string	"jun"
	.align	3
.LC27:
	.string	"jul"
	.align	3
.LC28:
	.string	"aug"
	.align	3
.LC29:
	.string	"sep"
	.align	3
.LC30:
	.string	"oct"
	.align	3
.LC31:
	.string	"nov"
	.align	3
.LC32:
	.string	"dec"
	.bss
	.align	2
	.LANCHOR1:
vzero:
	.zero	4
	.section .rodata
	.align	4
	.LANCHOR0:
CSWTCH__23:
	.quad	.LC21
	.quad	.LC22
	.quad	.LC23
	.quad	.LC24
	.quad	.LC25
	.quad	.LC26
	.quad	.LC27
	.quad	.LC28
	.quad	.LC29
	.quad	.LC30
	.quad	.LC31
	.quad	.LC32
CSWTCH__26:
	.byte	5
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	2
	.byte	2
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	2
	.byte	3
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	3
	.byte	4
	.byte	3
	.byte	4
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	1
	.byte	4
	.byte	3
	.byte	4
	.byte	4
	.byte	4
	.byte	3
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	4
	.byte	0
	.zero	10
.LC5:
	.word	0
	.word	1
	.word	2
	.word	3
.LC0:
	.word	-2147483648
	.word	-1
	.word	0
	.word	1
	.word	2
	.word	6
	.word	11
	.word	12
	.word	13
	.word	14
	.word	2147483647
	.zero	4
.LC1:
	.quad	0
	.quad	1
	.quad	2
	.quad	3
	.quad	4
	.quad	5
	.quad	6
	.quad	7
	.quad	8
	.quad	9
	.quad	10
	.quad	11
	.quad	12
	.quad	-1
	.quad	4294967299
	.quad	9223372032559808517
	.quad	-9223372036854775808
	.quad	9223372036854775807
	.quad	4294967295

