	.text
	.align	2
mix:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w1, [sp, 12]
	ldr	w0, [sp, 8]
	eor	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w1, [sp, 12]
	mov	w0, 403
	movk	w0, 0x100, lsl 16
	mul	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	lsr	w1, w0, 13
	ldr	w0, [sp, 12]
	eor	w0, w1, w0
	add	sp, sp, 16
	ret
	.align	2
around:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	cmp	w0, 7
	beq	.L4
	ldr	w0, [sp, 12]
	cmp	w0, 7
	bgt	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 6
	beq	.L6
	ldr	w0, [sp, 12]
	cmp	w0, 6
	bgt	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 5
	beq	.L7
	ldr	w0, [sp, 12]
	cmp	w0, 5
	bgt	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 4
	beq	.L8
	ldr	w0, [sp, 12]
	cmp	w0, 4
	bgt	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 3
	beq	.L9
	ldr	w0, [sp, 12]
	cmp	w0, 3
	bgt	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 2
	beq	.L10
	ldr	w0, [sp, 12]
	cmp	w0, 2
	bgt	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 1
	beq	.L11
	ldr	w0, [sp, 12]
	cmp	w0, 1
	bgt	.L5
	ldr	w0, [sp, 12]
	cmp	w0, 0
	beq	.L12
	ldr	w0, [sp, 12]
	cmp	w0, 0
	bgt	.L5
	ldr	w0, [sp, 12]
	cmn	w0, #1
	beq	.L13
	ldr	w0, [sp, 12]
	cmp	w0, 0
	bge	.L5
	ldr	w0, [sp, 12]
	cmn	w0, #2
	beq	.L14
	ldr	w0, [sp, 12]
	cmn	w0, #2
	bgt	.L5
	ldr	w0, [sp, 12]
	cmn	w0, #4
	beq	.L15
	ldr	w0, [sp, 12]
	cmn	w0, #3
	beq	.L16
	b	.L5
.L15:
	ldr	w0, [sp, 8]
	lsl	w0, w0, 1
	b	.L17
.L16:
	ldr	w0, [sp, 8]
	add	w0, w0, 30
	b	.L17
.L14:
	ldr	w0, [sp, 8]
	sub	w0, w0, #20
	b	.L17
.L13:
	ldr	w0, [sp, 8]
	eor	w0, w0, 1
	b	.L17
.L12:
	ldr	w0, [sp, 8]
	b	.L17
.L11:
	ldr	w0, [sp, 8]
	lsr	w1, w0, 31
	add	w0, w1, w0
	asr	w0, w0, 1
	b	.L17
.L10:
	ldr	w1, [sp, 8]
	mov	w0, 7
	sdiv	w2, w1, w0
	mov	w0, w2
	lsl	w0, w0, 3
	sub	w0, w0, w2
	sub	w0, w1, w0
	b	.L17
.L9:
	ldr	w0, [sp, 8]
	mul	w0, w0, w0
	b	.L17
.L8:
	ldr	w0, [sp, 8]
	sub	w0, w0, #1000
	b	.L17
.L7:
	ldr	w1, [sp, 8]
	mov	w0, 257
	orr	w0, w1, w0
	b	.L17
.L6:
	ldr	w0, [sp, 8]
	and	w0, w0, 240
	b	.L17
.L4:
	ldr	w0, [sp, 8]
	neg	w0, w0
	b	.L17
.L5:
	ldr	w1, [sp, 12]
	mov	w0, 7
	sdiv	w2, w1, w0
	mov	w0, w2
	lsl	w0, w0, 3
	sub	w0, w0, w2
	sub	w0, w1, w0
	add	w0, w0, 1000
.L17:
	add	sp, sp, 16
	ret
	.align	2
big:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	w0, [sp, 28]
	str	w1, [sp, 24]
	ldr	w0, [sp, 28]
	cmp	w0, 47
	beq	.L19
	ldr	w0, [sp, 28]
	cmp	w0, 47
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 46
	beq	.L21
	ldr	w0, [sp, 28]
	cmp	w0, 46
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 45
	beq	.L22
	ldr	w0, [sp, 28]
	cmp	w0, 45
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 44
	beq	.L23
	ldr	w0, [sp, 28]
	cmp	w0, 44
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 43
	beq	.L24
	ldr	w0, [sp, 28]
	cmp	w0, 43
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 42
	beq	.L25
	ldr	w0, [sp, 28]
	cmp	w0, 42
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 41
	beq	.L26
	ldr	w0, [sp, 28]
	cmp	w0, 41
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 40
	beq	.L27
	ldr	w0, [sp, 28]
	cmp	w0, 40
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 39
	beq	.L28
	ldr	w0, [sp, 28]
	cmp	w0, 39
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 38
	beq	.L29
	ldr	w0, [sp, 28]
	cmp	w0, 38
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 37
	beq	.L30
	ldr	w0, [sp, 28]
	cmp	w0, 37
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 36
	beq	.L31
	ldr	w0, [sp, 28]
	cmp	w0, 36
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 35
	beq	.L32
	ldr	w0, [sp, 28]
	cmp	w0, 35
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 34
	beq	.L33
	ldr	w0, [sp, 28]
	cmp	w0, 34
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 33
	beq	.L34
	ldr	w0, [sp, 28]
	cmp	w0, 33
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 32
	beq	.L35
	ldr	w0, [sp, 28]
	cmp	w0, 32
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 31
	beq	.L36
	ldr	w0, [sp, 28]
	cmp	w0, 31
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 30
	beq	.L37
	ldr	w0, [sp, 28]
	cmp	w0, 30
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 29
	beq	.L38
	ldr	w0, [sp, 28]
	cmp	w0, 29
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 28
	beq	.L39
	ldr	w0, [sp, 28]
	cmp	w0, 28
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 27
	beq	.L40
	ldr	w0, [sp, 28]
	cmp	w0, 27
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 26
	beq	.L41
	ldr	w0, [sp, 28]
	cmp	w0, 26
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 25
	beq	.L42
	ldr	w0, [sp, 28]
	cmp	w0, 25
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 24
	beq	.L43
	ldr	w0, [sp, 28]
	cmp	w0, 24
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 23
	beq	.L44
	ldr	w0, [sp, 28]
	cmp	w0, 23
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 22
	beq	.L45
	ldr	w0, [sp, 28]
	cmp	w0, 22
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 21
	beq	.L46
	ldr	w0, [sp, 28]
	cmp	w0, 21
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 20
	beq	.L47
	ldr	w0, [sp, 28]
	cmp	w0, 20
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 19
	beq	.L48
	ldr	w0, [sp, 28]
	cmp	w0, 19
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 18
	beq	.L49
	ldr	w0, [sp, 28]
	cmp	w0, 18
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 17
	beq	.L50
	ldr	w0, [sp, 28]
	cmp	w0, 17
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 16
	beq	.L51
	ldr	w0, [sp, 28]
	cmp	w0, 16
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 15
	beq	.L52
	ldr	w0, [sp, 28]
	cmp	w0, 15
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 14
	beq	.L53
	ldr	w0, [sp, 28]
	cmp	w0, 14
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 13
	beq	.L54
	ldr	w0, [sp, 28]
	cmp	w0, 13
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 12
	beq	.L55
	ldr	w0, [sp, 28]
	cmp	w0, 12
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 11
	beq	.L56
	ldr	w0, [sp, 28]
	cmp	w0, 11
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 10
	beq	.L57
	ldr	w0, [sp, 28]
	cmp	w0, 10
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 9
	beq	.L58
	ldr	w0, [sp, 28]
	cmp	w0, 9
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 8
	beq	.L59
	ldr	w0, [sp, 28]
	cmp	w0, 8
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 7
	beq	.L60
	ldr	w0, [sp, 28]
	cmp	w0, 7
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 6
	beq	.L61
	ldr	w0, [sp, 28]
	cmp	w0, 6
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 5
	beq	.L62
	ldr	w0, [sp, 28]
	cmp	w0, 5
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 4
	beq	.L63
	ldr	w0, [sp, 28]
	cmp	w0, 4
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 3
	beq	.L64
	ldr	w0, [sp, 28]
	cmp	w0, 3
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 2
	beq	.L65
	ldr	w0, [sp, 28]
	cmp	w0, 2
	bgt	.L20
	ldr	w0, [sp, 28]
	cmp	w0, 0
	beq	.L66
	ldr	w0, [sp, 28]
	cmp	w0, 1
	beq	.L67
	b	.L20
.L66:
	mov	w1, 31161
	movk	w1, 0x9e37, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 51819
	movk	w1, 0x85eb, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L67:
	mov	w1, 62322
	movk	w1, 0x3c6e, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 52074
	movk	w1, 0x84ea, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L65:
	mov	w1, 27947
	movk	w1, 0xdaa6, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 51305
	movk	w1, 0x87e9, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L64:
	mov	w1, 59108
	movk	w1, 0x78dd, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 51560
	movk	w1, 0x86e8, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L63:
	mov	w1, 24733
	movk	w1, 0x1715, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 52847
	movk	w1, 0x81ef, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L62:
	mov	w1, 55894
	movk	w1, 0xb54c, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 53102
	movk	w1, 0x80ee, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L61:
	mov	w1, 21519
	movk	w1, 0x5384, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 52333
	movk	w1, 0x83ed, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L60:
	mov	w1, 52680
	movk	w1, 0xf1bb, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 52588
	movk	w1, 0x82ec, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L59:
	mov	w1, 18305
	movk	w1, 0x8ff3, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 49763
	movk	w1, 0x8de3, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L58:
	mov	w1, 49466
	movk	w1, 0x2e2a, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 50018
	movk	w1, 0x8ce2, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L57:
	mov	w1, 15091
	movk	w1, 0xcc62, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 49249
	movk	w1, 0x8fe1, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L56:
	mov	w1, 46252
	movk	w1, 0x6a99, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 49504
	movk	w1, 0x8ee0, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L55:
	mov	w1, 11877
	movk	w1, 0x8d1, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 50791
	movk	w1, 0x89e7, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L54:
	mov	w1, 43038
	movk	w1, 0xa708, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 51046
	movk	w1, 0x88e6, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L53:
	mov	w1, 8663
	movk	w1, 0x4540, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 50277
	movk	w1, 0x8be5, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L52:
	mov	w1, 39824
	movk	w1, 0xe377, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 50532
	movk	w1, 0x8ae4, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L51:
	mov	w1, 5449
	movk	w1, 0x81af, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 55931
	movk	w1, 0x95fb, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L50:
	mov	w1, 36610
	movk	w1, 0x1fe6, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 56186
	movk	w1, 0x94fa, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L49:
	mov	w1, 2235
	movk	w1, 0xbe1e, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 55417
	movk	w1, 0x97f9, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L48:
	mov	w1, 33396
	movk	w1, 0x5c55, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 55672
	movk	w1, 0x96f8, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L47:
	mov	w1, 64557
	movk	w1, 0xfa8c, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 56959
	movk	w1, 0x91ff, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L46:
	mov	w1, 30182
	movk	w1, 0x98c4, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 57214
	movk	w1, 0x90fe, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L45:
	mov	w1, 61343
	movk	w1, 0x36fb, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 56445
	movk	w1, 0x93fd, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L44:
	mov	w1, 26968
	movk	w1, 0xd533, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 56700
	movk	w1, 0x92fc, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L43:
	mov	w1, 58129
	movk	w1, 0x736a, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 53875
	movk	w1, 0x9df3, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L42:
	mov	w1, 23754
	movk	w1, 0x11a2, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 54130
	movk	w1, 0x9cf2, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L41:
	mov	w1, 54915
	movk	w1, 0xafd9, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 53361
	movk	w1, 0x9ff1, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L40:
	mov	w1, 20540
	movk	w1, 0x4e11, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 53616
	movk	w1, 0x9ef0, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L39:
	mov	w1, 51701
	movk	w1, 0xec48, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 54903
	movk	w1, 0x99f7, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L38:
	mov	w1, 17326
	movk	w1, 0x8a80, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 55158
	movk	w1, 0x98f6, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L37:
	mov	w1, 48487
	movk	w1, 0x28b7, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 54389
	movk	w1, 0x9bf5, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L36:
	mov	w1, 14112
	movk	w1, 0xc6ef, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 54644
	movk	w1, 0x9af4, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L35:
	mov	w1, 45273
	movk	w1, 0x6526, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 59979
	movk	w1, 0xa5cb, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L34:
	mov	w1, 10898
	movk	w1, 0x35e, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 60234
	movk	w1, 0xa4ca, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L33:
	mov	w1, 42059
	movk	w1, 0xa195, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 59465
	movk	w1, 0xa7c9, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L32:
	mov	w1, 7684
	movk	w1, 0x3fcd, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 59720
	movk	w1, 0xa6c8, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L31:
	mov	w1, 38845
	movk	w1, 0xde04, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 61007
	movk	w1, 0xa1cf, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L30:
	mov	w1, 4470
	movk	w1, 0x7c3c, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 61262
	movk	w1, 0xa0ce, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L29:
	mov	w1, 35631
	movk	w1, 0x1a73, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 60493
	movk	w1, 0xa3cd, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L28:
	mov	w1, 1256
	movk	w1, 0xb8ab, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 60748
	movk	w1, 0xa2cc, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L27:
	mov	w1, 32417
	movk	w1, 0x56e2, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 57923
	movk	w1, 0xadc3, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L26:
	mov	w1, 63578
	movk	w1, 0xf519, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 58178
	movk	w1, 0xacc2, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L25:
	mov	w1, 29203
	movk	w1, 0x9351, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 57409
	movk	w1, 0xafc1, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L24:
	mov	w1, 60364
	movk	w1, 0x3188, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 57664
	movk	w1, 0xaec0, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L23:
	mov	w1, 25989
	movk	w1, 0xcfc0, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 58951
	movk	w1, 0xa9c7, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L22:
	mov	w1, 57150
	movk	w1, 0x6df7, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 59206
	movk	w1, 0xa8c6, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L21:
	mov	w1, 22775
	movk	w1, 0xc2f, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 58437
	movk	w1, 0xabc5, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L19:
	mov	w1, 53936
	movk	w1, 0xaa66, lsl 16
	ldr	w0, [sp, 24]
	bl	mix
	mov	w1, 58692
	movk	w1, 0xaac4, lsl 16
	bl	mix
	str	w0, [sp, 44]
	b	.L68
.L20:
	mov	w0, -1
	str	w0, [sp, 44]
.L68:
	ldr	w0, [sp, 44]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"jan"
	.align	3
.LC3:
	.string	"feb"
	.align	3
.LC4:
	.string	"mar"
	.align	3
.LC5:
	.string	"apr"
	.align	3
.LC6:
	.string	"may"
	.align	3
.LC7:
	.string	"jun"
	.align	3
.LC8:
	.string	"jul"
	.align	3
.LC9:
	.string	"aug"
	.align	3
.LC10:
	.string	"sep"
	.align	3
.LC11:
	.string	"oct"
	.align	3
.LC12:
	.string	"nov"
	.align	3
.LC13:
	.string	"dec"
	.align	3
.LC14:
	.string	"?"
	.text
	.align	2
month:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 12
	beq	.L71
	ldr	w0, [sp, 12]
	cmp	w0, 12
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 11
	beq	.L73
	ldr	w0, [sp, 12]
	cmp	w0, 11
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 10
	beq	.L74
	ldr	w0, [sp, 12]
	cmp	w0, 10
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 9
	beq	.L75
	ldr	w0, [sp, 12]
	cmp	w0, 9
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 8
	beq	.L76
	ldr	w0, [sp, 12]
	cmp	w0, 8
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 7
	beq	.L77
	ldr	w0, [sp, 12]
	cmp	w0, 7
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 6
	beq	.L78
	ldr	w0, [sp, 12]
	cmp	w0, 6
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 5
	beq	.L79
	ldr	w0, [sp, 12]
	cmp	w0, 5
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 4
	beq	.L80
	ldr	w0, [sp, 12]
	cmp	w0, 4
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 3
	beq	.L81
	ldr	w0, [sp, 12]
	cmp	w0, 3
	bgt	.L72
	ldr	w0, [sp, 12]
	cmp	w0, 1
	beq	.L82
	ldr	w0, [sp, 12]
	cmp	w0, 2
	beq	.L83
	b	.L72
.L82:
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	b	.L84
.L83:
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	b	.L84
.L81:
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	b	.L84
.L80:
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	b	.L84
.L79:
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	b	.L84
.L78:
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	b	.L84
.L77:
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	b	.L84
.L76:
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	b	.L84
.L75:
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	b	.L84
.L74:
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	b	.L84
.L73:
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	b	.L84
.L71:
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	b	.L84
.L72:
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
.L84:
	add	sp, sp, 16
	ret
	.align	2
wide:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	str	x1, [sp]
	ldr	x0, [sp, 8]
	cmp	x0, 11
	beq	.L86
	ldr	x0, [sp, 8]
	cmp	x0, 11
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 10
	beq	.L88
	ldr	x0, [sp, 8]
	cmp	x0, 10
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 9
	beq	.L89
	ldr	x0, [sp, 8]
	cmp	x0, 9
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 8
	beq	.L90
	ldr	x0, [sp, 8]
	cmp	x0, 8
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 7
	beq	.L91
	ldr	x0, [sp, 8]
	cmp	x0, 7
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 6
	beq	.L92
	ldr	x0, [sp, 8]
	cmp	x0, 6
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 5
	beq	.L93
	ldr	x0, [sp, 8]
	cmp	x0, 5
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 4
	beq	.L94
	ldr	x0, [sp, 8]
	cmp	x0, 4
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 3
	beq	.L95
	ldr	x0, [sp, 8]
	cmp	x0, 3
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 2
	beq	.L96
	ldr	x0, [sp, 8]
	cmp	x0, 2
	bgt	.L87
	ldr	x0, [sp, 8]
	cmp	x0, 0
	beq	.L97
	ldr	x0, [sp, 8]
	cmp	x0, 1
	beq	.L98
	b	.L87
.L97:
	ldr	x0, [sp]
	add	x0, x0, 100
	b	.L99
.L98:
	ldr	x0, [sp]
	sub	x0, x0, #100
	b	.L99
.L96:
	ldr	x1, [sp]
	mov	x0, x1
	lsl	x0, x0, 3
	sub	x0, x0, x1
	b	.L99
.L95:
	ldr	x0, [sp]
	eor	x0, x0, 127
	b	.L99
.L94:
	ldr	x0, [sp]
	lsl	x0, x0, 3
	b	.L99
.L93:
	ldr	x0, [sp]
	asr	x0, x0, 2
	b	.L99
.L92:
	ldr	x0, [sp]
	mov	x1, 7282
	movk	x1, 0x71c7, lsl 16
	movk	x1, 0xc71c, lsl 32
	movk	x1, 0x1c71, lsl 48
	smulh	x1, x0, x1
	asr	x0, x0, 63
	sub	x0, x1, x0
	b	.L99
.L91:
	ldr	x2, [sp]
	mov	x0, 63439
	movk	x0, 0xe353, lsl 16
	movk	x0, 0x9ba5, lsl 32
	movk	x0, 0x20c4, lsl 48
	smulh	x0, x2, x0
	asr	x1, x0, 7
	asr	x0, x2, 63
	sub	x0, x1, x0
	mov	x1, x0
	lsl	x1, x1, 2
	add	x1, x1, x0
	lsl	x0, x1, 2
	add	x1, x1, x0
	lsl	x0, x1, 2
	add	x1, x1, x0
	lsl	x0, x1, 3
	mov	x1, x0
	sub	x0, x2, x1
	b	.L99
.L90:
	ldr	x0, [sp]
	mvn	x0, x0
	b	.L99
.L89:
	ldr	x0, [sp]
	and	x0, x0, 65535
	b	.L99
.L88:
	ldr	x0, [sp]
	asr	x0, x0, 5
	ldr	x1, [sp]
	sub	x0, x1, x0
	b	.L99
.L86:
	ldr	x2, [sp]
	mov	x0, 62983
	movk	x0, 0xa98e, lsl 16
	movk	x0, 0xbd81, lsl 32
	movk	x0, 0x6a63, lsl 48
	smulh	x0, x2, x0
	asr	x1, x0, 5
	asr	x0, x2, 63
	sub	x1, x1, x0
	mov	x0, x1
	lsl	x0, x0, 3
	add	x0, x0, x1
	lsl	x0, x0, 1
	add	x0, x0, x1
	lsl	x0, x0, 2
	add	x0, x0, x1
	sub	x1, x2, x0
	add	x0, x1, 1
	b	.L99
.L87:
	mov	x0, -1
.L99:
	add	sp, sp, 16
	ret
	.align	2
cls:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 117
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 117
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 111
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 111
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 105
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 105
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 101
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 101
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 97
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 97
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 85
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 85
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 79
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 79
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 73
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 73
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 69
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 69
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 65
	beq	.L101
	ldr	w0, [sp, 12]
	cmp	w0, 65
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 63
	beq	.L103
	ldr	w0, [sp, 12]
	cmp	w0, 63
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 59
	beq	.L103
	ldr	w0, [sp, 12]
	cmp	w0, 59
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 57
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 48
	bge	.L104
	ldr	w0, [sp, 12]
	cmp	w0, 46
	beq	.L103
	ldr	w0, [sp, 12]
	cmp	w0, 46
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 44
	beq	.L103
	ldr	w0, [sp, 12]
	cmp	w0, 44
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 33
	beq	.L103
	ldr	w0, [sp, 12]
	cmp	w0, 33
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 32
	beq	.L105
	ldr	w0, [sp, 12]
	cmp	w0, 32
	bgt	.L102
	ldr	w0, [sp, 12]
	cmp	w0, 0
	beq	.L106
	ldr	w0, [sp, 12]
	cmp	w0, 0
	blt	.L102
	ldr	w0, [sp, 12]
	sub	w0, w0, #9
	cmp	w0, 1
	bhi	.L102
	b	.L105
.L101:
	mov	w0, 0
	b	.L107
.L104:
	mov	w0, 1
	b	.L107
.L105:
	mov	w0, 2
	b	.L107
.L103:
	mov	w0, 3
	b	.L107
.L106:
	mov	w0, 5
	b	.L107
.L102:
	mov	w0, 4
.L107:
	add	sp, sp, 16
	ret
	.align	2
duff:
	sub	sp, sp, #48
	str	x0, [sp, 24]
	str	x1, [sp, 16]
	str	w2, [sp, 12]
	ldr	w0, [sp, 12]
	add	w0, w0, 7
	add	w1, w0, 7
	cmp	w0, 0
	csel	w0, w1, w0, lt
	asr	w0, w0, 3
	str	w0, [sp, 44]
	ldr	w0, [sp, 12]
	negs	w1, w0
	and	w0, w0, 7
	and	w1, w1, 7
	csneg	w0, w0, w1, mi
	cmp	w0, 7
	beq	.L109
	cmp	w0, 7
	bgt	.L118
	cmp	w0, 6
	beq	.L111
	cmp	w0, 6
	bgt	.L118
	cmp	w0, 5
	beq	.L112
	cmp	w0, 5
	bgt	.L118
	cmp	w0, 4
	beq	.L113
	cmp	w0, 4
	bgt	.L118
	cmp	w0, 3
	beq	.L114
	cmp	w0, 3
	bgt	.L118
	cmp	w0, 2
	beq	.L115
	cmp	w0, 2
	bgt	.L118
	cmp	w0, 0
	beq	.L116
	cmp	w0, 1
	beq	.L117
	b	.L118
.L119:
	nop
.L116:
	ldr	x1, [sp, 16]
	add	x0, x1, 4
	str	x0, [sp, 16]
	ldr	x0, [sp, 24]
	add	x2, x0, 4
	str	x2, [sp, 24]
	ldr	w1, [x1]
	str	w1, [x0]
.L109:
	ldr	x1, [sp, 16]
	add	x0, x1, 4
	str	x0, [sp, 16]
	ldr	x0, [sp, 24]
	add	x2, x0, 4
	str	x2, [sp, 24]
	ldr	w1, [x1]
	str	w1, [x0]
.L111:
	ldr	x1, [sp, 16]
	add	x0, x1, 4
	str	x0, [sp, 16]
	ldr	x0, [sp, 24]
	add	x2, x0, 4
	str	x2, [sp, 24]
	ldr	w1, [x1]
	str	w1, [x0]
.L112:
	ldr	x1, [sp, 16]
	add	x0, x1, 4
	str	x0, [sp, 16]
	ldr	x0, [sp, 24]
	add	x2, x0, 4
	str	x2, [sp, 24]
	ldr	w1, [x1]
	str	w1, [x0]
.L113:
	ldr	x1, [sp, 16]
	add	x0, x1, 4
	str	x0, [sp, 16]
	ldr	x0, [sp, 24]
	add	x2, x0, 4
	str	x2, [sp, 24]
	ldr	w1, [x1]
	str	w1, [x0]
.L114:
	ldr	x1, [sp, 16]
	add	x0, x1, 4
	str	x0, [sp, 16]
	ldr	x0, [sp, 24]
	add	x2, x0, 4
	str	x2, [sp, 24]
	ldr	w1, [x1]
	str	w1, [x0]
.L115:
	ldr	x1, [sp, 16]
	add	x0, x1, 4
	str	x0, [sp, 16]
	ldr	x0, [sp, 24]
	add	x2, x0, 4
	str	x2, [sp, 24]
	ldr	w1, [x1]
	str	w1, [x0]
.L117:
	ldr	x1, [sp, 16]
	add	x0, x1, 4
	str	x0, [sp, 16]
	ldr	x0, [sp, 24]
	add	x2, x0, 4
	str	x2, [sp, 24]
	ldr	w1, [x1]
	str	w1, [x0]
	ldr	w0, [sp, 44]
	sub	w0, w0, #1
	str	w0, [sp, 44]
	ldr	w0, [sp, 44]
	cmp	w0, 0
	bgt	.L119
.L118:
	nop
	add	sp, sp, 48
	ret
	.section .rodata
	.align	3
.LC15:
	.string	"around:"
	.align	3
.LC16:
	.string	" %d"
	.align	3
.LC17:
	.string	" %d %d\n"
	.align	3
.LC18:
	.string	"big: "
	.align	3
.LC19:
	.string	"\nbig: "
	.align	3
.LC20:
	.string	" "
	.align	3
.LC21:
	.string	"%s%08x"
	.align	3
.LC22:
	.string	"\n"
	.align	3
.LC23:
	.string	"month:"
	.align	3
.LC24:
	.string	" %s"
	.align	3
.LC25:
	.string	"wide:"
	.align	3
.LC26:
	.string	" %ld"
	.align	3
.LC27:
	.string	"Hello, World! 42 apples; 7 oranges?\t\200\377. Quiet x9 zone"
	.align	3
.LC28:
	.string	"cls: "
	.align	3
.LC29:
	.string	"\ncounts: %d %d %d %d %d %d\n"
	.align	3
.LC30:
	.string	"duff:"
	.align	3
.LC31:
	.string	" %d%c"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #512
	stp	x29, x30, [sp]
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	str	x23, [sp, 48]
	adrp	x0, vzero
	add	x0, x0, :lo12:vzero
	ldr	w0, [x0]
	str	w0, [sp, 492]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	w0, -6
	str	w0, [sp, 504]
	b	.L121
.L122:
	ldr	w1, [sp, 504]
	ldr	w0, [sp, 492]
	add	w2, w1, w0
	ldr	w0, [sp, 504]
	add	w0, w0, 50
	mov	w1, w0
	mov	w0, w2
	bl	around
	mov	w1, w0
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	ldr	w0, [sp, 504]
	add	w0, w0, 1
	str	w0, [sp, 504]
.L121:
	ldr	w0, [sp, 504]
	cmp	w0, 9
	ble	.L122
	ldr	w1, [sp, 492]
	mov	w0, -2147483648
	add	w0, w1, w0
	mov	w1, 5
	bl	around
	mov	w19, w0
	ldr	w1, [sp, 492]
	mov	w0, 2147483647
	add	w0, w1, w0
	mov	w1, 5
	bl	around
	mov	w2, w0
	mov	w1, w19
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	mov	w0, -1
	str	w0, [sp, 504]
	b	.L123
.L127:
	ldr	w0, [sp, 504]
	add	w1, w0, 1
	mov	w0, 5
	sdiv	w2, w1, w0
	mov	w0, w2
	lsl	w0, w0, 2
	add	w0, w0, w2
	sub	w0, w1, w0
	cmp	w0, 0
	bne	.L124
	ldr	w0, [sp, 504]
	cmp	w0, 0
	bge	.L125
	adrp	x0, .LC18
	add	x19, x0, :lo12:.LC18
	b	.L126
.L125:
	adrp	x0, .LC19
	add	x19, x0, :lo12:.LC19
	b	.L126
.L124:
	adrp	x0, .LC20
	add	x19, x0, :lo12:.LC20
.L126:
	ldr	w1, [sp, 504]
	ldr	w0, [sp, 492]
	add	w2, w1, w0
	ldr	w1, [sp, 504]
	mov	w0, 4660
	add	w0, w1, w0
	mov	w1, w0
	mov	w0, w2
	bl	big
	mov	w2, w0
	mov	x1, x19
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	w0, [sp, 504]
	add	w0, w0, 1
	str	w0, [sp, 504]
.L123:
	ldr	w0, [sp, 504]
	cmp	w0, 48
	ble	.L127
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 432
	ldr	q29, [x1]
	ldr	q30, [x1, 16]
	ldr	q31, [x1, 28]
	str	q29, [x0]
	str	q30, [x0, 16]
	str	q31, [x0, 28]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	printf
	str	wzr, [sp, 508]
	b	.L128
.L129:
	ldrsw	x0, [sp, 508]
	lsl	x0, x0, 2
	add	x1, sp, 432
	ldr	w1, [x1, x0]
	ldr	w0, [sp, 492]
	add	w0, w1, w0
	bl	month
	mov	x1, x0
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	ldr	w0, [sp, 508]
	add	w0, w0, 1
	str	w0, [sp, 508]
.L128:
	ldr	w0, [sp, 508]
	cmp	w0, 10
	ble	.L129
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 280
	ldr	q26, [x1]
	ldr	q27, [x1, 16]
	ldr	q28, [x1, 32]
	ldr	q29, [x1, 48]
	ldr	q30, [x1, 64]
	ldr	q31, [x1, 80]
	str	q26, [x0]
	str	q27, [x0, 16]
	str	q28, [x0, 32]
	str	q29, [x0, 48]
	str	q30, [x0, 64]
	str	q31, [x0, 80]
	ldr	q29, [x1, 96]
	ldr	q30, [x1, 112]
	ldr	q31, [x1, 128]
	ldr	x1, [x1, 144]
	str	q29, [x0, 96]
	str	q30, [x0, 112]
	str	q31, [x0, 128]
	str	x1, [x0, 144]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	str	wzr, [sp, 508]
	b	.L130
.L131:
	ldrsw	x0, [sp, 508]
	lsl	x0, x0, 3
	add	x1, sp, 280
	ldr	x1, [x1, x0]
	ldrsw	x0, [sp, 492]
	add	x2, x1, x0
	ldrsw	x1, [sp, 492]
	mov	x0, 26505
	movk	x0, 0x2345, lsl 16
	movk	x0, 0x1, lsl 32
	add	x0, x1, x0
	mov	x1, x0
	mov	x0, x2
	bl	wide
	mov	x1, x0
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	ldr	w0, [sp, 508]
	add	w0, w0, 1
	str	w0, [sp, 508]
.L130:
	ldr	w0, [sp, 508]
	cmp	w0, 18
	ble	.L131
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	str	x0, [sp, 480]
	stp	xzr, xzr, [sp, 256]
	str	xzr, [sp, 272]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	bl	printf
	str	wzr, [sp, 508]
	b	.L132
.L133:
	ldrsw	x0, [sp, 508]
	ldr	x1, [sp, 480]
	add	x0, x1, x0
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	w0, [sp, 492]
	add	w0, w1, w0
	bl	cls
	str	w0, [sp, 476]
	ldrsw	x0, [sp, 476]
	lsl	x0, x0, 2
	add	x1, sp, 256
	ldr	w0, [x1, x0]
	add	w2, w0, 1
	ldrsw	x0, [sp, 476]
	lsl	x0, x0, 2
	add	x1, sp, 256
	str	w2, [x1, x0]
	ldr	w0, [sp, 476]
	add	w0, w0, 48
	bl	putchar
	ldr	w0, [sp, 508]
	add	w0, w0, 1
	str	w0, [sp, 508]
.L132:
	ldrsw	x0, [sp, 508]
	ldr	x1, [sp, 480]
	add	x0, x1, x0
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L133
	ldr	w19, [sp, 256]
	ldr	w20, [sp, 260]
	ldr	w21, [sp, 264]
	ldr	w22, [sp, 268]
	ldr	w23, [sp, 272]
	ldr	w0, [sp, 492]
	bl	cls
	mov	w6, w0
	mov	w5, w23
	mov	w4, w22
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	str	wzr, [sp, 508]
	b	.L134
.L135:
	ldr	w0, [sp, 508]
	mul	w0, w0, w0
	add	w2, w0, 1
	ldrsw	x0, [sp, 508]
	lsl	x0, x0, 2
	add	x1, sp, 160
	str	w2, [x1, x0]
	ldr	w0, [sp, 508]
	add	w0, w0, 1
	str	w0, [sp, 508]
.L134:
	ldr	w0, [sp, 508]
	cmp	w0, 23
	ble	.L135
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	printf
	mov	w0, 1
	str	w0, [sp, 504]
	b	.L136
.L143:
	mov	w0, 1
	str	w0, [sp, 500]
	str	wzr, [sp, 496]
	str	wzr, [sp, 508]
	b	.L137
.L138:
	ldrsw	x0, [sp, 508]
	lsl	x0, x0, 2
	add	x1, sp, 64
	mov	w2, -1
	str	w2, [x1, x0]
	ldr	w0, [sp, 508]
	add	w0, w0, 1
	str	w0, [sp, 508]
.L137:
	ldr	w0, [sp, 508]
	cmp	w0, 23
	ble	.L138
	ldr	w1, [sp, 504]
	ldr	w0, [sp, 492]
	add	w2, w1, w0
	add	x1, sp, 160
	add	x0, sp, 64
	bl	duff
	str	wzr, [sp, 508]
	b	.L139
.L140:
	ldrsw	x0, [sp, 508]
	lsl	x0, x0, 2
	add	x1, sp, 64
	ldr	w1, [x1, x0]
	ldrsw	x0, [sp, 508]
	lsl	x0, x0, 2
	add	x2, sp, 160
	ldr	w0, [x2, x0]
	cmp	w1, w0
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 500]
	and	w0, w0, w1
	str	w0, [sp, 500]
	ldrsw	x0, [sp, 508]
	lsl	x0, x0, 2
	add	x1, sp, 64
	ldr	w0, [x1, x0]
	ldr	w1, [sp, 496]
	add	w0, w1, w0
	str	w0, [sp, 496]
	ldr	w0, [sp, 508]
	add	w0, w0, 1
	str	w0, [sp, 508]
.L139:
	ldr	w1, [sp, 508]
	ldr	w0, [sp, 504]
	cmp	w1, w0
	blt	.L140
	ldrsw	x0, [sp, 504]
	lsl	x0, x0, 2
	add	x1, sp, 64
	ldr	w0, [x1, x0]
	cmn	w0, #1
	cset	w0, eq
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 500]
	and	w0, w0, w1
	str	w0, [sp, 500]
	ldr	w0, [sp, 500]
	cmp	w0, 0
	beq	.L141
	mov	w0, 43
	b	.L142
.L141:
	mov	w0, 33
.L142:
	mov	w2, w0
	ldr	w1, [sp, 496]
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	printf
	ldr	w0, [sp, 504]
	add	w0, w0, 1
	str	w0, [sp, 504]
.L136:
	ldr	w0, [sp, 504]
	cmp	w0, 20
	ble	.L143
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp]
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldr	x23, [sp, 48]
	add	sp, sp, 512
	ret
	.section .rodata
	.align	3
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
	.align	3
.LC1:
	.xword	0
	.xword	1
	.xword	2
	.xword	3
	.xword	4
	.xword	5
	.xword	6
	.xword	7
	.xword	8
	.xword	9
	.xword	10
	.xword	11
	.xword	12
	.xword	-1
	.xword	4294967299
	.xword	9223372032559808517
	.xword	-9223372036854775808
	.xword	9223372036854775807
	.xword	4294967295
	.text


	.bss
	.balign 4
vzero:
	.skip 4
