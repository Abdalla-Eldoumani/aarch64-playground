	.text
	.section .rodata
	.align	3
.LC0:
	.string	"%u"
	.align	3
.LC1:
	.string	"%09u"
	.text
	.align	2
print_u128:
	stp	x29, x30, [sp, -112]!
	mov	x29, sp
	stp	x0, x1, [sp, 16]
	ldr	x0, [sp, 24]
	lsr	x4, x0, 32
	mov	x5, 0
	mov	w0, w4
	str	w0, [sp, 64]
	ldr	x0, [sp, 24]
	mov	x6, x0
	mov	x7, 0
	mov	w0, w6
	str	w0, [sp, 68]
	ldr	x0, [sp, 24]
	lsl	x0, x0, 32
	ldr	x1, [sp, 16]
	lsr	x2, x1, 32
	mov	x1, x2
	add	x0, x0, x1
	mov	x2, x0
	ldr	x0, [sp, 24]
	lsr	x3, x0, 32
	mov	w0, w2
	str	w0, [sp, 72]
	ldr	x0, [sp, 16]
	str	w0, [sp, 76]
	str	wzr, [sp, 108]
.L6:
	str	xzr, [sp, 96]
	str	wzr, [sp, 92]
	str	wzr, [sp, 88]
	b	.L2
.L3:
	ldr	x0, [sp, 96]
	lsl	x1, x0, 32
	ldrsw	x0, [sp, 88]
	lsl	x0, x0, 2
	add	x2, sp, 64
	ldr	w0, [x2, x0]
	uxtw	x0, w0
	orr	x0, x1, x0
	str	x0, [sp, 80]
	ldr	x0, [sp, 80]
	lsr	x1, x0, 9
	mov	x0, 23123
	movk	x0, 0xa09b, lsl 16
	movk	x0, 0xb82f, lsl 32
	movk	x0, 0x44, lsl 48
	umulh	x0, x1, x0
	lsr	x0, x0, 11
	mov	w2, w0
	ldrsw	x0, [sp, 88]
	lsl	x0, x0, 2
	add	x1, sp, 64
	str	w2, [x1, x0]
	ldr	x0, [sp, 80]
	lsr	x2, x0, 9
	mov	x1, 23123
	movk	x1, 0xa09b, lsl 16
	movk	x1, 0xb82f, lsl 32
	movk	x1, 0x44, lsl 48
	umulh	x1, x2, x1
	lsr	x2, x1, 11
	mov	x1, 51712
	movk	x1, 0x3b9a, lsl 16
	mul	x1, x2, x1
	sub	x0, x0, x1
	str	x0, [sp, 96]
	ldrsw	x0, [sp, 88]
	lsl	x0, x0, 2
	add	x1, sp, 64
	ldr	w0, [x1, x0]
	cmp	w0, 0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 92]
	orr	w0, w0, w1
	str	w0, [sp, 92]
	ldr	w0, [sp, 88]
	add	w0, w0, 1
	str	w0, [sp, 88]
.L2:
	ldr	w0, [sp, 88]
	cmp	w0, 3
	ble	.L3
	ldr	w0, [sp, 108]
	add	w1, w0, 1
	str	w1, [sp, 108]
	ldr	x1, [sp, 96]
	mov	w2, w1
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x1, sp, 40
	str	w2, [x1, x0]
	ldr	w0, [sp, 92]
	cmp	w0, 0
	beq	.L10
	b	.L6
.L10:
	nop
	ldr	w0, [sp, 108]
	sub	w0, w0, #1
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x1, sp, 40
	ldr	w0, [x1, x0]
	mov	w1, w0
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	b	.L7
.L8:
	ldr	w0, [sp, 108]
	sub	w0, w0, #1
	sxtw	x0, w0
	lsl	x0, x0, 2
	add	x1, sp, 40
	ldr	w0, [x1, x0]
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
.L7:
	ldr	w0, [sp, 108]
	sub	w0, w0, #1
	str	w0, [sp, 108]
	ldr	w0, [sp, 108]
	cmp	w0, 0
	bgt	.L8
	nop
	nop
	ldp	x29, x30, [sp], 112
	ret
	.section .rodata
	.align	3
.LC2:
	.string	"-"
	.text
	.align	2
print_i128:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	stp	x20, x21, [sp, 16]
	stp	x0, x1, [sp, 32]
	ldr	x0, [sp, 40]
	cmp	x0, 0
	bge	.L12
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldp	x0, x1, [sp, 32]
	subs	x2, xzr, x0
	sbc	x0, xzr, x1
	mov	x20, x2
	mov	x21, x0
	mov	x0, x20
	mov	x1, x21
	bl	print_u128
	b	.L15
.L12:
	ldp	x0, x1, [sp, 32]
	bl	print_u128
.L15:
	nop
	ldp	x20, x21, [sp, 16]
	ldp	x29, x30, [sp], 48
	ret
	.section .rodata
	.align	3
.LC3:
	.string	"%s %016lx%016lx\n"
	.text
	.align	2
hex128:
	stp	x29, x30, [sp, -48]!
	mov	x29, sp
	str	x0, [sp, 40]
	stp	x2, x3, [sp, 16]
	ldr	x0, [sp, 24]
	mov	x4, x0
	mov	x5, 0
	mov	x1, x4
	ldr	x0, [sp, 16]
	mov	x3, x0
	mov	x2, x1
	ldr	x1, [sp, 40]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	nop
	ldp	x29, x30, [sp], 48
	ret
	.align	2
mix:
	stp	x19, x20, [sp, -160]!
	stp	x21, x22, [sp, 16]
	stp	x23, x24, [sp, 32]
	stp	x25, x26, [sp, 48]
	str	x27, [sp, 64]
	str	x0, [sp, 152]
	stp	x2, x3, [sp, 128]
	str	x4, [sp, 144]
	stp	x6, x7, [sp, 112]
	ldr	x0, [sp, 152]
	mov	x10, x0
	asr	x0, x0, 63
	mov	x11, x0
	ldp	x0, x1, [sp, 128]
	mul	x3, x10, x0
	umulh	x2, x10, x0
	madd	x2, x11, x0, x2
	madd	x2, x10, x1, x2
	mov	x20, x3
	mov	x21, x2
	ldr	x0, [sp, 144]
	mov	x8, x0
	asr	x0, x0, 63
	mov	x9, x0
	ldp	x0, x1, [sp, 112]
	mul	x3, x8, x0
	umulh	x2, x8, x0
	madd	x2, x9, x0, x2
	madd	x2, x8, x1, x2
	str	x3, [sp, 80]
	str	x2, [sp, 88]
	ldp	x2, x3, [sp, 80]
	mov	x0, x2
	adds	x1, x20, x0
	mov	x0, x3
	adc	x0, x21, x0
	mov	x18, x1
	mov	x19, x0
	ldp	x0, x1, [sp, 192]
	subs	x2, x18, x0
	sbc	x0, x19, x1
	mov	x16, x2
	mov	x17, x0
	ldr	x0, [sp, 160]
	mov	x26, x0
	asr	x0, x0, 63
	mov	x27, x0
	mov	x0, x26
	adds	x1, x16, x0
	mov	x0, x27
	adc	x0, x17, x0
	mov	x14, x1
	mov	x15, x0
	ldr	x0, [sp, 168]
	mov	x24, x0
	asr	x0, x0, 63
	mov	x25, x0
	mov	x0, x24
	adds	x1, x14, x0
	mov	x0, x25
	adc	x0, x15, x0
	mov	x12, x1
	mov	x13, x0
	ldr	x0, [sp, 176]
	mov	x22, x0
	asr	x0, x0, 63
	mov	x23, x0
	mov	x0, x22
	adds	x1, x12, x0
	mov	x0, x23
	adc	x0, x13, x0
	str	x1, [sp, 96]
	str	x0, [sp, 104]
	ldp	x0, x1, [sp, 96]
	ldp	x21, x22, [sp, 16]
	ldp	x23, x24, [sp, 32]
	ldp	x25, x26, [sp, 48]
	ldr	x27, [sp, 64]
	ldp	x19, x20, [sp], 160
	ret
	.data
	.align	3
hv:
	.xword	81985529216486895
	.xword	-81985529216486896
	.xword	1229782938247303441
	.xword	2459565876494606882
	.align	3
sv:
	.xword	-9223372036854775808
	.xword	9223372036854775807
	.xword	-1
	.xword	3
	.xword	-5
	.section .rodata
	.align	3
.LC4:
	.string	"%d! = "
	.align	3
.LC5:
	.string	"\n"
	.align	3
.LC6:
	.string	"35! hex"
	.align	3
.LC7:
	.string	"fib(%d) = "
	.align	3
.LC8:
	.string	"fib(187) wrapped"
	.align	3
.LC9:
	.string	"umax*umax"
	.align	3
.LC10:
	.string	"%ld * %ld = "
	.align	3
.LC11:
	.string	" high %ld\n"
	.align	3
.LC12:
	.string	"x*y"
	.align	3
.LC13:
	.string	"x+y"
	.align	3
.LC14:
	.string	"x-y"
	.align	3
.LC15:
	.string	"y-x"
	.align	3
.LC16:
	.string	"-x"
	.align	3
.LC17:
	.string	"~x"
	.align	3
.LC18:
	.string	"x<<1"
	.align	3
.LC19:
	.string	"x<<63"
	.align	3
.LC20:
	.string	"x<<64"
	.align	3
.LC21:
	.string	"x<<65"
	.align	3
.LC22:
	.string	"x<<127"
	.align	3
.LC23:
	.string	"x>>1"
	.align	3
.LC24:
	.string	"x>>64"
	.align	3
.LC25:
	.string	"x>>127"
	.align	3
.LC26:
	.string	"neg>>1"
	.align	3
.LC27:
	.string	"neg>>100"
	.align	3
.LC29:
	.string	"orders %08x %08x\n"
	.align	3
.LC30:
	.string	"from int -5"
	.align	3
.LC31:
	.string	"from long -5"
	.align	3
.LC32:
	.string	"from ulong"
	.align	3
.LC33:
	.string	"truncate %ld %d\n"
	.align	3
.LC35:
	.string	"mix = "
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #976
	stp	x29, x30, [sp, 48]
	add	x29, sp, 48
	stp	x20, x21, [sp, 64]
	stp	x22, x23, [sp, 80]
	stp	x24, x25, [sp, 96]
	stp	x26, x27, [sp, 112]
	mov	x0, 1
	mov	x1, 0
	add	x2, sp, 960
	stp	x0, x1, [x2]
	mov	w0, 1
	str	w0, [sp, 956]
	b	.L20
.L23:
	ldr	w0, [sp, 956]
	uxtw	x0, w0
	mov	x20, x0
	mov	x21, 0
	add	x0, sp, 960
	ldp	x0, x1, [x0]
	mul	x3, x0, x20
	umulh	x2, x0, x20
	madd	x2, x1, x20, x2
	madd	x2, x0, x21, x2
	str	x3, [sp, 608]
	str	x2, [sp, 616]
	add	x0, sp, 608
	ldp	x0, x1, [x0]
	add	x2, sp, 960
	stp	x0, x1, [x2]
	ldr	w0, [sp, 956]
	cmp	w0, 19
	ble	.L21
	ldr	w0, [sp, 956]
	cmp	w0, 34
	bgt	.L21
	ldr	w2, [sp, 956]
	mov	w0, 5
	sdiv	w1, w2, w0
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	sub	w0, w2, w0
	cmp	w0, 0
	beq	.L22
	ldr	w0, [sp, 956]
	cmp	w0, 32
	ble	.L21
.L22:
	ldr	w1, [sp, 956]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	add	x0, sp, 960
	ldp	x0, x1, [x0]
	bl	print_u128
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
.L21:
	ldr	w0, [sp, 956]
	add	w0, w0, 1
	str	w0, [sp, 956]
.L20:
	ldr	w0, [sp, 956]
	cmp	w0, 35
	ble	.L23
	add	x0, sp, 960
	ldp	x2, x3, [x0]
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	hex128
	add	x0, sp, 928
	stp	xzr, xzr, [x0]
	mov	x0, 1
	mov	x1, 0
	add	x2, sp, 912
	stp	x0, x1, [x2]
	mov	w0, 1
	str	w0, [sp, 908]
	b	.L24
.L27:
	add	x0, sp, 928
	ldp	x0, x1, [x0]
	add	x2, sp, 912
	ldp	x4, x5, [x2]
	mov	x2, x4
	adds	x3, x0, x2
	mov	x2, x5
	adc	x0, x1, x2
	str	x3, [sp, 624]
	str	x0, [sp, 632]
	add	x0, sp, 624
	ldp	x0, x1, [x0]
	add	x2, sp, 768
	stp	x0, x1, [x2]
	add	x0, sp, 912
	ldp	x0, x1, [x0]
	add	x2, sp, 928
	stp	x0, x1, [x2]
	add	x0, sp, 768
	ldp	x0, x1, [x0]
	add	x2, sp, 912
	stp	x0, x1, [x2]
	ldr	w0, [sp, 908]
	cmp	w0, 93
	beq	.L25
	ldr	w0, [sp, 908]
	cmp	w0, 94
	beq	.L25
	ldr	w0, [sp, 908]
	cmp	w0, 150
	beq	.L25
	ldr	w0, [sp, 908]
	cmp	w0, 185
	beq	.L25
	ldr	w0, [sp, 908]
	cmp	w0, 186
	bne	.L26
.L25:
	ldr	w1, [sp, 908]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	add	x0, sp, 928
	ldp	x0, x1, [x0]
	bl	print_u128
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
.L26:
	ldr	w0, [sp, 908]
	add	w0, w0, 1
	str	w0, [sp, 908]
.L24:
	ldr	w0, [sp, 908]
	cmp	w0, 187
	ble	.L27
	add	x0, sp, 928
	ldp	x2, x3, [x0]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	hex128
	mov	x0, -1
	str	x0, [sp, 872]
	ldr	x0, [sp, 872]
	mov	x24, x0
	mov	x25, 0
	ldr	x0, [sp, 872]
	mov	x22, x0
	mov	x23, 0
	mul	x1, x24, x22
	umulh	x0, x24, x22
	madd	x0, x25, x22, x0
	madd	x0, x24, x23, x0
	str	x1, [sp, 192]
	str	x0, [sp, 200]
	ldp	x2, x3, [sp, 192]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	hex128
	str	wzr, [sp, 904]
	b	.L28
.L31:
	ldr	w0, [sp, 904]
	str	w0, [sp, 900]
	b	.L29
.L30:
	adrp	x0, sv
	add	x1, x0, :lo12:sv
	ldrsw	x0, [sp, 904]
	ldr	x0, [x1, x0, lsl 3]
	str	x0, [sp, 208]
	asr	x0, x0, 63
	str	x0, [sp, 216]
	adrp	x0, sv
	add	x1, x0, :lo12:sv
	ldrsw	x0, [sp, 900]
	ldr	x0, [x1, x0, lsl 3]
	mov	x26, x0
	asr	x0, x0, 63
	mov	x27, x0
	ldp	x2, x3, [sp, 208]
	mov	x0, x2
	mul	x1, x0, x26
	mov	x0, x2
	umulh	x0, x0, x26
	mov	x4, x3
	madd	x0, x4, x26, x0
	madd	x0, x2, x27, x0
	str	x1, [sp, 640]
	str	x0, [sp, 648]
	add	x0, sp, 640
	ldp	x0, x1, [x0]
	add	x2, sp, 784
	stp	x0, x1, [x2]
	adrp	x0, sv
	add	x1, x0, :lo12:sv
	ldrsw	x0, [sp, 904]
	ldr	x3, [x1, x0, lsl 3]
	adrp	x0, sv
	add	x1, x0, :lo12:sv
	ldrsw	x0, [sp, 900]
	ldr	x0, [x1, x0, lsl 3]
	mov	x2, x0
	mov	x1, x3
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	add	x0, sp, 784
	ldp	x0, x1, [x0]
	bl	print_i128
	ldr	x0, [sp, 792]
	str	x0, [sp, 224]
	ldr	x0, [sp, 792]
	asr	x0, x0, 63
	str	x0, [sp, 232]
	ldr	x0, [sp, 224]
	mov	x1, x0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	ldr	w0, [sp, 900]
	add	w0, w0, 1
	str	w0, [sp, 900]
.L29:
	ldr	w0, [sp, 900]
	cmp	w0, 4
	ble	.L30
	ldr	w0, [sp, 904]
	add	w0, w0, 1
	str	w0, [sp, 904]
.L28:
	ldr	w0, [sp, 904]
	cmp	w0, 4
	ble	.L31
	adrp	x0, hv
	add	x0, x0, :lo12:hv
	ldr	x0, [x0]
	str	x0, [sp, 240]
	str	xzr, [sp, 248]
	ldr	x0, [sp, 240]
	str	x0, [sp, 264]
	str	xzr, [sp, 256]
	adrp	x0, hv
	add	x0, x0, :lo12:hv
	ldr	x0, [x0, 8]
	str	x0, [sp, 272]
	str	xzr, [sp, 280]
	ldp	x4, x5, [sp, 256]
	mov	x0, x4
	ldp	x2, x3, [sp, 272]
	mov	x1, x2
	orr	x0, x0, x1
	str	x0, [sp, 848]
	mov	x0, x5
	mov	x1, x3
	orr	x0, x0, x1
	str	x0, [sp, 856]
	adrp	x0, hv
	add	x0, x0, :lo12:hv
	ldr	x0, [x0, 16]
	str	x0, [sp, 288]
	str	xzr, [sp, 296]
	ldr	x0, [sp, 288]
	str	x0, [sp, 312]
	str	xzr, [sp, 304]
	adrp	x0, hv
	add	x0, x0, :lo12:hv
	ldr	x0, [x0, 24]
	str	x0, [sp, 320]
	str	xzr, [sp, 328]
	ldp	x4, x5, [sp, 304]
	mov	x0, x4
	ldp	x2, x3, [sp, 320]
	mov	x1, x2
	orr	x0, x0, x1
	str	x0, [sp, 832]
	mov	x0, x5
	mov	x1, x3
	orr	x0, x0, x1
	str	x0, [sp, 840]
	add	x0, sp, 848
	ldp	x2, x3, [x0]
	add	x0, sp, 832
	ldp	x0, x1, [x0]
	mul	x5, x2, x0
	umulh	x4, x2, x0
	madd	x4, x3, x0, x4
	madd	x4, x2, x1, x4
	str	x5, [sp, 336]
	str	x4, [sp, 344]
	ldp	x2, x3, [sp, 336]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	hex128
	add	x0, sp, 848
	ldp	x0, x1, [x0]
	add	x2, sp, 832
	ldp	x4, x5, [x2]
	mov	x2, x4
	adds	x3, x0, x2
	mov	x2, x5
	adc	x0, x1, x2
	str	x3, [sp, 352]
	str	x0, [sp, 360]
	ldp	x2, x3, [sp, 352]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	hex128
	add	x0, sp, 848
	ldp	x2, x3, [x0]
	add	x0, sp, 832
	ldp	x0, x1, [x0]
	subs	x4, x2, x0
	sbc	x0, x3, x1
	str	x4, [sp, 368]
	str	x0, [sp, 376]
	ldp	x2, x3, [sp, 368]
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	hex128
	add	x0, sp, 832
	ldp	x2, x3, [x0]
	add	x0, sp, 848
	ldp	x0, x1, [x0]
	subs	x4, x2, x0
	sbc	x0, x3, x1
	str	x4, [sp, 384]
	str	x0, [sp, 392]
	ldp	x2, x3, [sp, 384]
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	hex128
	add	x0, sp, 848
	ldp	x0, x1, [x0]
	subs	x2, xzr, x0
	sbc	x0, xzr, x1
	str	x2, [sp, 400]
	str	x0, [sp, 408]
	ldp	x2, x3, [sp, 400]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	hex128
	ldr	x0, [sp, 848]
	mvn	x0, x0
	str	x0, [sp, 416]
	ldr	x0, [sp, 856]
	mvn	x0, x0
	str	x0, [sp, 424]
	ldp	x2, x3, [sp, 416]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	hex128
	ldr	x0, [sp, 848]
	lsr	x1, x0, 63
	ldr	x0, [sp, 856]
	lsl	x0, x0, 1
	str	x0, [sp, 136]
	ldr	x0, [sp, 136]
	add	x0, x1, x0
	str	x0, [sp, 136]
	ldr	x0, [sp, 848]
	lsl	x0, x0, 1
	str	x0, [sp, 128]
	ldp	x2, x3, [sp, 128]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	bl	hex128
	ldr	x0, [sp, 848]
	lsr	x1, x0, 1
	ldr	x0, [sp, 856]
	lsl	x0, x0, 63
	str	x0, [sp, 152]
	ldr	x0, [sp, 152]
	add	x0, x1, x0
	str	x0, [sp, 152]
	ldr	x0, [sp, 848]
	lsl	x0, x0, 63
	str	x0, [sp, 144]
	ldp	x2, x3, [sp, 144]
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	bl	hex128
	ldr	x0, [sp, 848]
	str	x0, [sp, 440]
	str	xzr, [sp, 432]
	ldp	x2, x3, [sp, 432]
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	bl	hex128
	ldr	x0, [sp, 848]
	lsl	x0, x0, 1
	str	x0, [sp, 456]
	str	xzr, [sp, 448]
	ldp	x2, x3, [sp, 448]
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	hex128
	ldr	x0, [sp, 848]
	lsl	x0, x0, 63
	str	x0, [sp, 472]
	str	xzr, [sp, 464]
	ldp	x2, x3, [sp, 464]
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	bl	hex128
	ldr	x0, [sp, 856]
	lsl	x0, x0, 63
	ldr	x1, [sp, 848]
	lsr	x1, x1, 1
	str	x1, [sp, 160]
	ldr	x1, [sp, 160]
	add	x0, x0, x1
	str	x0, [sp, 160]
	ldr	x0, [sp, 856]
	lsr	x0, x0, 1
	str	x0, [sp, 168]
	ldp	x2, x3, [sp, 160]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	bl	hex128
	ldr	x0, [sp, 856]
	str	x0, [sp, 480]
	str	xzr, [sp, 488]
	ldp	x2, x3, [sp, 480]
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	hex128
	ldr	x0, [sp, 856]
	lsr	x0, x0, 63
	str	x0, [sp, 496]
	str	xzr, [sp, 504]
	ldp	x2, x3, [sp, 496]
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	hex128
	add	x0, sp, 848
	ldp	x0, x1, [x0]
	subs	x2, xzr, x0
	sbc	x0, xzr, x1
	str	x2, [sp, 656]
	str	x0, [sp, 664]
	add	x0, sp, 656
	ldp	x0, x1, [x0]
	add	x2, sp, 816
	stp	x0, x1, [x2]
	ldr	x0, [sp, 824]
	lsl	x0, x0, 63
	ldr	x1, [sp, 816]
	lsr	x1, x1, 1
	str	x1, [sp, 176]
	ldr	x1, [sp, 176]
	add	x0, x0, x1
	str	x0, [sp, 176]
	ldr	x0, [sp, 824]
	asr	x0, x0, 1
	str	x0, [sp, 184]
	ldp	x0, x1, [sp, 176]
	mov	x2, x0
	mov	x3, x1
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	hex128
	ldr	x0, [sp, 824]
	asr	x0, x0, 36
	str	x0, [sp, 512]
	ldr	x0, [sp, 824]
	asr	x0, x0, 63
	str	x0, [sp, 520]
	add	x0, sp, 512
	ldp	x0, x1, [x0]
	mov	x2, x0
	mov	x3, x1
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	hex128
	add	x0, sp, 848
	ldp	x0, x1, [x0]
	add	x2, sp, 672
	stp	x0, x1, [x2]
	add	x0, sp, 848
	ldp	x0, x1, [x0]
	subs	x2, xzr, x0
	sbc	x0, xzr, x1
	str	x2, [sp, 528]
	str	x0, [sp, 536]
	add	x0, sp, 528
	ldp	x0, x1, [x0]
	add	x2, sp, 688
	stp	x0, x1, [x2]
	add	x0, sp, 704
	stp	xzr, xzr, [x0]
	mov	x0, -1
	mov	x1, -1
	add	x2, sp, 720
	stp	x0, x1, [x2]
	mov	x0, -9223372036854775808
	mov	x1, -1
	add	x2, sp, 736
	stp	x0, x1, [x2]
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	ldp	x0, x1, [x0]
	add	x2, sp, 752
	stp	x0, x1, [x2]
	str	wzr, [sp, 896]
	str	wzr, [sp, 892]
	str	wzr, [sp, 888]
	b	.L32
.L41:
	str	wzr, [sp, 884]
	b	.L33
.L40:
	ldr	w1, [sp, 896]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w4, w0, w1
	ldrsw	x0, [sp, 888]
	lsl	x0, x0, 4
	add	x1, sp, 672
	add	x0, x1, x0
	ldp	x0, x1, [x0]
	ldrsw	x2, [sp, 884]
	lsl	x2, x2, 4
	add	x3, sp, 672
	add	x2, x3, x2
	ldp	x2, x3, [x2]
	mov	w5, 1
	cmp	x3, x1
	bgt	.L34
	cmp	x3, x1
	bne	.L35
	cmp	x2, x0
	bhi	.L34
.L35:
	mov	w5, 0
.L34:
	and	w0, w5, 255
	add	w4, w4, w0
	ldrsw	x0, [sp, 888]
	lsl	x0, x0, 4
	add	x1, sp, 672
	add	x0, x1, x0
	ldp	x2, x3, [x0]
	ldrsw	x0, [sp, 884]
	lsl	x0, x0, 4
	add	x1, sp, 672
	add	x0, x1, x0
	ldp	x0, x1, [x0]
	cmp	x2, x0
	bne	.L36
	cmp	x3, x1
	bne	.L36
	mov	w0, 2
	b	.L37
.L36:
	mov	w0, 0
.L37:
	add	w0, w0, w4
	str	w0, [sp, 896]
	ldr	w1, [sp, 892]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w4, w0, w1
	ldrsw	x0, [sp, 888]
	lsl	x0, x0, 4
	add	x1, sp, 672
	add	x0, x1, x0
	ldp	x0, x1, [x0]
	ldrsw	x2, [sp, 884]
	lsl	x2, x2, 4
	add	x3, sp, 672
	add	x2, x3, x2
	ldp	x2, x3, [x2]
	mov	w5, 1
	cmp	x3, x1
	bhi	.L38
	cmp	x3, x1
	bne	.L39
	cmp	x2, x0
	bhi	.L38
.L39:
	mov	w5, 0
.L38:
	and	w0, w5, 255
	add	w0, w4, w0
	str	w0, [sp, 892]
	ldr	w0, [sp, 884]
	add	w0, w0, 1
	str	w0, [sp, 884]
.L33:
	ldr	w0, [sp, 884]
	cmp	w0, 5
	ble	.L40
	ldr	w0, [sp, 888]
	add	w0, w0, 1
	str	w0, [sp, 888]
.L32:
	ldr	w0, [sp, 888]
	cmp	w0, 5
	ble	.L41
	ldr	w2, [sp, 892]
	ldr	w1, [sp, 896]
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	adrp	x0, sv
	add	x0, x0, :lo12:sv
	ldr	x0, [x0, 32]
	sxtw	x0, w0
	str	x0, [sp, 544]
	asr	x0, x0, 63
	str	x0, [sp, 552]
	add	x0, sp, 544
	ldp	x2, x3, [x0]
	adrp	x0, .LC30
	add	x0, x0, :lo12:.LC30
	bl	hex128
	adrp	x0, sv
	add	x0, x0, :lo12:sv
	ldr	x0, [x0, 32]
	str	x0, [sp, 560]
	asr	x0, x0, 63
	str	x0, [sp, 568]
	add	x0, sp, 560
	ldp	x2, x3, [x0]
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	hex128
	adrp	x0, sv
	add	x0, x0, :lo12:sv
	ldr	x0, [x0, 32]
	str	x0, [sp, 576]
	str	xzr, [sp, 584]
	add	x0, sp, 576
	ldp	x2, x3, [x0]
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	bl	hex128
	ldr	x1, [sp, 848]
	ldr	x0, [sp, 832]
	mul	x0, x1, x0
	mov	x3, x0
	ldr	x0, [sp, 848]
	mov	w1, w0
	ldr	x0, [sp, 832]
	mul	w0, w1, w0
	mov	w2, w0
	mov	x1, x3
	adrp	x0, .LC33
	add	x0, x0, :lo12:.LC33
	bl	printf
	adrp	x0, sv
	add	x0, x0, :lo12:sv
	ldr	x5, [x0, 24]
	add	x0, sp, 848
	ldp	x2, x3, [x0]
	adrp	x0, sv
	add	x0, x0, :lo12:sv
	ldr	x4, [x0, 32]
	add	x0, sp, 832
	ldp	x0, x1, [x0]
	subs	x6, xzr, x0
	sbc	x0, xzr, x1
	str	x6, [sp, 592]
	str	x0, [sp, 600]
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	ldp	x0, x1, [x0]
	stp	x0, x1, [sp, 32]
	mov	x0, 9
	str	x0, [sp, 16]
	mov	x0, 8
	str	x0, [sp, 8]
	mov	x0, 7
	str	x0, [sp]
	add	x0, sp, 592
	ldp	x6, x7, [x0]
	mov	x0, x5
	bl	mix
	add	x2, sp, 800
	stp	x0, x1, [x2]
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	bl	printf
	add	x0, sp, 800
	ldp	x0, x1, [x0]
	bl	print_i128
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 48]
	ldp	x20, x21, [sp, 64]
	ldp	x22, x23, [sp, 80]
	ldp	x24, x25, [sp, 96]
	ldp	x26, x27, [sp, 112]
	add	sp, sp, 976
	ret
	.section .rodata
	.align	4
.LC28:
	.xword	0
	.xword	68719476736
	.align	4
.LC34:
	.xword	0
	.xword	67108864

