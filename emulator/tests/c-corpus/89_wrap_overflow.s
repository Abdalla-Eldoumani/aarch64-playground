	.text
	.data
	.align	3
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
	.align	3
lp:
	.quad	9223372036854775807
	.quad	1
	.quad	-9223372036854775808
	.quad	-1
	.quad	-9223372036854775808
	.quad	-9223372036854775808
	.quad	3037000499
	.quad	3037000499
	.quad	3037000500
	.quad	3037000500
	.quad	-4294967296
	.quad	2147483648
	.quad	4294967296
	.quad	2147483648
	.quad	0
	.quad	-9223372036854775808
	.align	3
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
	.align	3
ulp:
	.quad	-1
	.quad	1
	.quad	0
	.quad	1
	.quad	4294967296
	.quad	4294967296
	.quad	4294967295
	.quad	4294967297
	.quad	-9223372036854775808
	.quad	2
	.text
	.align	2
fnv32:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	mov	w0, 40389
	movk	w0, 0x811c, lsl 16
	str	w0, [sp, 28]
	b	.L2
.L3:
	ldr	x0, [sp, 8]
	add	x1, x0, 1
	str	x1, [sp, 8]
	ldrb	w0, [x0]
	mov	w1, w0
	ldr	w0, [sp, 28]
	eor	w1, w1, w0
	mov	w0, 403
	movk	w0, 0x100, lsl 16
	mul	w0, w1, w0
	str	w0, [sp, 28]
.L2:
	ldr	x0, [sp, 8]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L3
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
fnv64:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	mov	x0, 8997
	movk	x0, 0x8422, lsl 16
	movk	x0, 0x9ce4, lsl 32
	movk	x0, 0xcbf2, lsl 48
	str	x0, [sp, 24]
	b	.L6
.L7:
	ldr	x0, [sp, 8]
	add	x1, x0, 1
	str	x1, [sp, 8]
	ldrb	w0, [x0]
	and	x1, x0, 255
	ldr	x0, [sp, 24]
	eor	x1, x1, x0
	mov	x0, 435
	movk	x0, 0x100, lsl 32
	mul	x0, x1, x0
	str	x0, [sp, 24]
.L6:
	ldr	x0, [sp, 8]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L7
	ldr	x0, [sp, 24]
	add	sp, sp, 32
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
	.global	main
main:
	sub	sp, sp, #480
	stp	x29, x30, [sp, 32]
	add	x29, sp, 32
	stp	x19, x20, [sp, 48]
	stp	x21, x22, [sp, 64]
	stp	x23, x24, [sp, 80]
	stp	x25, x26, [sp, 96]
	str	x27, [sp, 112]
	mov	w0, 9
	str	w0, [sp, 420]
	str	wzr, [sp, 476]
	b	.L10
.L17:
	adrp	x0, ip
	add	x1, x0, :lo12:ip
	ldrsw	x0, [sp, 476]
	lsl	x0, x0, 3
	add	x0, x1, x0
	ldr	w0, [x0]
	str	w0, [sp, 328]
	adrp	x0, ip
	add	x1, x0, :lo12:ip
	ldrsw	x0, [sp, 476]
	lsl	x0, x0, 3
	add	x0, x1, x0
	ldr	w0, [x0, 4]
	str	w0, [sp, 324]
	mov	w2, 0
	ldr	w1, [sp, 328]
	ldr	w0, [sp, 324]
	adds	w0, w1, w0
	bvc	.L11
	mov	w2, 1
.L11:
	str	w0, [sp, 212]
	mov	w0, w2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 372]
	mov	w2, 0
	ldr	w1, [sp, 328]
	ldr	w0, [sp, 324]
	subs	w0, w1, w0
	bvc	.L13
	mov	w2, 1
.L13:
	str	w0, [sp, 208]
	mov	w0, w2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 368]
	mov	w3, 0
	ldr	w1, [sp, 328]
	ldr	w0, [sp, 324]
	smull	x0, w1, w0
	asr	x1, x0, 32
	asr	w2, w0, 31
	cmp	w2, w1
	beq	.L15
	mov	w3, 1
.L15:
	str	w0, [sp, 204]
	mov	w0, w3
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 364]
	ldr	w0, [sp, 212]
	ldr	w1, [sp, 208]
	ldr	w2, [sp, 204]
	ldr	w3, [sp, 364]
	str	w3, [sp]
	mov	w7, w2
	ldr	w6, [sp, 368]
	mov	w5, w1
	ldr	w4, [sp, 372]
	mov	w3, w0
	ldr	w2, [sp, 324]
	ldr	w1, [sp, 328]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 476]
	add	w0, w0, 1
	str	w0, [sp, 476]
.L10:
	ldr	w1, [sp, 476]
	ldr	w0, [sp, 420]
	cmp	w1, w0
	blt	.L17
	mov	w0, 8
	str	w0, [sp, 420]
	str	wzr, [sp, 472]
	b	.L18
.L28:
	adrp	x0, lp
	add	x1, x0, :lo12:lp
	ldrsw	x0, [sp, 472]
	lsl	x0, x0, 4
	add	x0, x1, x0
	ldr	x0, [x0]
	str	x0, [sp, 344]
	adrp	x0, lp
	add	x1, x0, :lo12:lp
	ldrsw	x0, [sp, 472]
	lsl	x0, x0, 4
	add	x0, x1, x0
	ldr	x0, [x0, 8]
	str	x0, [sp, 336]
	mov	x2, 0
	ldr	x1, [sp, 344]
	ldr	x0, [sp, 336]
	adds	x0, x1, x0
	bvc	.L19
	mov	x2, 1
.L19:
	str	x0, [sp, 192]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 372]
	mov	x2, 0
	ldr	x1, [sp, 344]
	ldr	x0, [sp, 336]
	subs	x0, x1, x0
	bvc	.L21
	mov	x2, 1
.L21:
	str	x0, [sp, 184]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 368]
	mov	x2, 0
	ldr	x1, [sp, 344]
	ldr	x0, [sp, 336]
	mul	x3, x1, x0
	smulh	x0, x1, x0
	mov	x20, x3
	mov	x21, x0
	mov	x22, x21
	asr	x23, x21, 63
	mov	x0, x20
	asr	x1, x0, 63
	cmp	x1, x22
	beq	.L23
	mov	x2, 1
.L23:
	str	x0, [sp, 176]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 364]
	mov	w1, 0
	ldr	x2, [sp, 344]
	ldr	x0, [sp, 336]
	adds	x0, x2, x0
	bvc	.L25
	mov	w1, 1
.L25:
	sxtw	x2, w0
	cmp	x0, x2
	beq	.L27
	mov	w1, 1
.L27:
	str	w0, [sp, 320]
	mov	w0, w1
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 332]
	ldr	x0, [sp, 192]
	ldr	x1, [sp, 184]
	ldr	x2, [sp, 176]
	ldr	w3, [sp, 320]
	ldr	w4, [sp, 332]
	str	w4, [sp, 16]
	str	w3, [sp, 8]
	ldr	w3, [sp, 364]
	str	w3, [sp]
	mov	x7, x2
	ldr	w6, [sp, 368]
	mov	x5, x1
	ldr	w4, [sp, 372]
	mov	x3, x0
	ldr	x2, [sp, 336]
	ldr	x1, [sp, 344]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	ldr	w0, [sp, 472]
	add	w0, w0, 1
	str	w0, [sp, 472]
.L18:
	ldr	w1, [sp, 472]
	ldr	w0, [sp, 420]
	cmp	w1, w0
	blt	.L28
	mov	w0, 5
	str	w0, [sp, 420]
	str	wzr, [sp, 468]
	b	.L29
.L36:
	adrp	x0, up
	add	x1, x0, :lo12:up
	ldrsw	x0, [sp, 468]
	lsl	x0, x0, 3
	add	x0, x1, x0
	ldr	w0, [x0]
	str	w0, [sp, 360]
	adrp	x0, up
	add	x1, x0, :lo12:up
	ldrsw	x0, [sp, 468]
	lsl	x0, x0, 3
	add	x0, x1, x0
	ldr	w0, [x0, 4]
	str	w0, [sp, 356]
	mov	w2, 0
	ldr	w0, [sp, 360]
	ldr	w1, [sp, 356]
	adds	w0, w0, w1
	bcc	.L30
	mov	w2, 1
.L30:
	str	w0, [sp, 172]
	mov	w0, w2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 372]
	mov	w2, 0
	ldr	w1, [sp, 360]
	ldr	w0, [sp, 356]
	subs	w0, w1, w0
	bcs	.L32
	mov	w2, 1
.L32:
	str	w0, [sp, 168]
	mov	w0, w2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 368]
	mov	w2, 0
	ldr	w1, [sp, 360]
	ldr	w0, [sp, 356]
	umull	x0, w1, w0
	lsr	x1, x0, 32
	cmp	w1, 0
	beq	.L34
	mov	w2, 1
.L34:
	str	w0, [sp, 164]
	mov	w0, w2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 364]
	ldr	w2, [sp, 172]
	ldr	w3, [sp, 168]
	ldr	w4, [sp, 164]
	ldr	w1, [sp, 360]
	ldr	w0, [sp, 356]
	add	w5, w1, w0
	ldr	w1, [sp, 360]
	ldr	w0, [sp, 356]
	sub	w6, w1, w0
	ldr	w1, [sp, 360]
	ldr	w0, [sp, 356]
	mul	w0, w1, w0
	str	w0, [sp, 24]
	str	w6, [sp, 16]
	str	w5, [sp, 8]
	ldr	w0, [sp, 364]
	str	w0, [sp]
	mov	w7, w4
	ldr	w6, [sp, 368]
	mov	w5, w3
	ldr	w4, [sp, 372]
	mov	w3, w2
	ldr	w2, [sp, 356]
	ldr	w1, [sp, 360]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 468]
	add	w0, w0, 1
	str	w0, [sp, 468]
.L29:
	ldr	w1, [sp, 468]
	ldr	w0, [sp, 420]
	cmp	w1, w0
	blt	.L36
	mov	w0, 5
	str	w0, [sp, 420]
	str	wzr, [sp, 464]
	b	.L37
.L44:
	adrp	x0, ulp
	add	x1, x0, :lo12:ulp
	ldrsw	x0, [sp, 464]
	lsl	x0, x0, 4
	add	x0, x1, x0
	ldr	x0, [x0]
	str	x0, [sp, 384]
	adrp	x0, ulp
	add	x1, x0, :lo12:ulp
	ldrsw	x0, [sp, 464]
	lsl	x0, x0, 4
	add	x0, x1, x0
	ldr	x0, [x0, 8]
	str	x0, [sp, 376]
	mov	x2, 0
	ldr	x0, [sp, 384]
	ldr	x1, [sp, 376]
	adds	x0, x0, x1
	bcc	.L38
	mov	x2, 1
.L38:
	str	x0, [sp, 152]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 372]
	mov	x2, 0
	ldr	x1, [sp, 384]
	ldr	x0, [sp, 376]
	subs	x0, x1, x0
	bcs	.L40
	mov	x2, 1
.L40:
	str	x0, [sp, 144]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 368]
	mov	x2, 0
	ldr	x1, [sp, 384]
	ldr	x0, [sp, 376]
	mul	x3, x1, x0
	umulh	x0, x1, x0
	mov	x24, x3
	mov	x25, x0
	mov	x26, x25
	mov	x27, 0
	cmp	x26, 0
	beq	.L42
	mov	x2, 1
.L42:
	mov	x0, x24
	str	x0, [sp, 136]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 364]
	ldr	x0, [sp, 152]
	ldr	x1, [sp, 144]
	ldr	x2, [sp, 136]
	ldr	w3, [sp, 364]
	str	w3, [sp]
	mov	x7, x2
	ldr	w6, [sp, 368]
	mov	x5, x1
	ldr	w4, [sp, 372]
	mov	x3, x0
	ldr	x2, [sp, 376]
	ldr	x1, [sp, 384]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	ldr	w0, [sp, 464]
	add	w0, w0, 1
	str	w0, [sp, 464]
.L37:
	ldr	w1, [sp, 464]
	ldr	w0, [sp, 420]
	cmp	w1, w0
	blt	.L44
	mov	w0, -6
	strb	w0, [sp, 319]
	mov	w0, -6
	strh	w0, [sp, 316]
	ldrb	w0, [sp, 319]
	add	w0, w0, 10
	strb	w0, [sp, 419]
	ldrh	w0, [sp, 316]
	add	w0, w0, 10
	strh	w0, [sp, 416]
	ldrb	w1, [sp, 319]
	ldrb	w0, [sp, 319]
	mul	w0, w1, w0
	strb	w0, [sp, 415]
	ldrb	w0, [sp, 419]
	ldrh	w1, [sp, 416]
	ldrb	w2, [sp, 415]
	ldrb	w3, [sp, 319]
	neg	w3, w3
	and	w3, w3, 255
	mov	w4, w3
	mov	w3, w2
	mov	w2, w1
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 288
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	adrp	x0, .LC1
	add	x1, x0, :lo12:.LC1
	add	x0, sp, 264
	ldp	x2, x3, [x1]
	ldr	x1, [x1, 16]
	stp	x2, x3, [x0]
	str	x1, [x0, 16]
	str	wzr, [sp, 460]
	str	wzr, [sp, 456]
	str	wzr, [sp, 452]
	b	.L45
.L54:
	ldrsw	x0, [sp, 452]
	lsl	x0, x0, 3
	add	x1, sp, 288
	ldr	x0, [x1, x0]
	ldrsw	x1, [sp, 452]
	lsl	x1, x1, 3
	add	x2, sp, 264
	ldr	x1, [x2, x1]
	mov	x2, 0
	adds	x0, x0, x1
	bcc	.L46
	mov	x2, 1
.L46:
	str	x0, [sp, 128]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 404]
	ldr	x0, [sp, 128]
	ldrsw	x1, [sp, 460]
	mov	x2, 0
	adds	x0, x0, x1
	bcc	.L48
	mov	x2, 1
.L48:
	mov	x3, x0
	ldrsw	x0, [sp, 452]
	lsl	x0, x0, 3
	add	x1, sp, 240
	str	x3, [x1, x0]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 400]
	ldr	w1, [sp, 404]
	ldr	w0, [sp, 400]
	orr	w0, w1, w0
	str	w0, [sp, 460]
	ldrsw	x0, [sp, 452]
	lsl	x0, x0, 3
	add	x1, sp, 264
	ldr	x1, [x1, x0]
	ldrsw	x0, [sp, 452]
	lsl	x0, x0, 3
	add	x2, sp, 288
	ldr	x0, [x2, x0]
	mov	x2, 0
	subs	x0, x1, x0
	bcs	.L50
	mov	x2, 1
.L50:
	str	x0, [sp, 128]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 396]
	ldr	x1, [sp, 128]
	ldrsw	x0, [sp, 456]
	mov	x2, 0
	subs	x0, x1, x0
	bcs	.L52
	mov	x2, 1
.L52:
	mov	x3, x0
	ldrsw	x0, [sp, 452]
	lsl	x0, x0, 3
	add	x1, sp, 216
	str	x3, [x1, x0]
	mov	x0, x2
	and	w0, w0, 1
	and	w0, w0, 255
	str	w0, [sp, 392]
	ldr	w1, [sp, 396]
	ldr	w0, [sp, 392]
	orr	w0, w1, w0
	str	w0, [sp, 456]
	ldr	w0, [sp, 452]
	add	w0, w0, 1
	str	w0, [sp, 452]
.L45:
	ldr	w0, [sp, 452]
	cmp	w0, 2
	ble	.L54
	ldr	x0, [sp, 256]
	ldr	x1, [sp, 248]
	ldr	x2, [sp, 240]
	ldr	w4, [sp, 460]
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	x0, [sp, 232]
	ldr	x1, [sp, 224]
	ldr	x2, [sp, 216]
	ldr	w4, [sp, 456]
	mov	x3, x2
	mov	x2, x1
	mov	x1, x0
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	str	wzr, [sp, 448]
	str	wzr, [sp, 444]
	b	.L55
.L58:
	adrp	x0, up
	add	x1, x0, :lo12:up
	ldrsw	x0, [sp, 444]
	lsl	x0, x0, 3
	add	x0, x1, x0
	ldr	w0, [x0]
	ldr	w1, [sp, 448]
	add	w0, w1, w0
	str	w0, [sp, 408]
	ldr	w1, [sp, 408]
	ldr	w0, [sp, 448]
	cmp	w1, w0
	bcc	.L56
	ldr	w0, [sp, 408]
	str	w0, [sp, 448]
	b	.L57
.L56:
	mov	w0, -1
	str	w0, [sp, 448]
.L57:
	ldr	w1, [sp, 448]
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	ldr	w0, [sp, 444]
	add	w0, w0, 1
	str	w0, [sp, 444]
.L55:
	ldr	w0, [sp, 444]
	cmp	w0, 4
	ble	.L58
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	fnv32
	mov	w19, w0
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	fnv32
	mov	w2, w0
	mov	w1, w19
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	fnv64
	mov	x19, x0
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	bl	fnv64
	mov	x2, x0
	mov	x1, x19
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	bl	printf
	mov	x0, 1
	str	x0, [sp, 432]
	mov	w0, 12345
	str	w0, [sp, 428]
	str	wzr, [sp, 424]
	b	.L59
.L60:
	ldr	x1, [sp, 432]
	mov	x0, 32557
	movk	x0, 0x4c95, lsl 16
	movk	x0, 0xf42d, lsl 32
	movk	x0, 0x5851, lsl 48
	mul	x1, x1, x0
	mov	x0, 33103
	movk	x0, 0xf767, lsl 16
	movk	x0, 0x7b7e, lsl 32
	movk	x0, 0x1405, lsl 48
	add	x0, x1, x0
	str	x0, [sp, 432]
	ldr	w1, [sp, 428]
	mov	w0, 20077
	movk	w0, 0x41c6, lsl 16
	mul	w1, w1, w0
	mov	w0, 12345
	add	w0, w1, w0
	str	w0, [sp, 428]
	ldr	w0, [sp, 424]
	add	w0, w0, 1
	str	w0, [sp, 424]
.L59:
	ldr	w0, [sp, 424]
	cmp	w0, 999
	ble	.L60
	ldr	w2, [sp, 428]
	ldr	x1, [sp, 432]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	bl	printf
	adrp	x0, ip
	add	x0, x0, :lo12:ip
	ldr	w0, [x0, 8]
	neg	w1, w0
	adrp	x0, lp
	add	x0, x0, :lo12:lp
	ldr	x0, [x0, 16]
	neg	x2, x0
	adrp	x0, up
	add	x0, x0, :lo12:up
	ldr	w0, [x0]
	neg	w0, w0
	mov	w3, w0
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 32]
	ldp	x19, x20, [sp, 48]
	ldp	x21, x22, [sp, 64]
	ldp	x23, x24, [sp, 80]
	ldp	x25, x26, [sp, 96]
	ldr	x27, [sp, 112]
	add	sp, sp, 480
	ret
	.section .rodata
	.align	3
.LC0:
	.quad	-1
	.quad	-1
	.quad	5
	.align	3
.LC1:
	.quad	1
	.quad	0
	.quad	7
	.text

