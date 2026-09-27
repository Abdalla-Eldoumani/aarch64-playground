	.text
	.section .rodata
	.align	3
nibble_bits:
	.byte 0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4
	.text
	.align	2
pop_ref:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	wzr, [sp, 28]
	str	wzr, [sp, 24]
	b	.L2
.L3:
	ldr	w0, [sp, 24]
	lsl	w0, w0, 2
	ldr	x1, [sp, 8]
	lsr	x0, x1, x0
	and	x0, x0, 15
	adrp	x1, nibble_bits
	add	x1, x1, :lo12:nibble_bits
	ldrb	w0, [x1, x0]
	mov	w1, w0
	ldr	w0, [sp, 28]
	add	w0, w0, w1
	str	w0, [sp, 28]
	ldr	w0, [sp, 24]
	add	w0, w0, 1
	str	w0, [sp, 24]
.L2:
	ldr	w0, [sp, 24]
	cmp	w0, 15
	ble	.L3
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
clz_ref:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	wzr, [sp, 28]
	mov	x0, -9223372036854775808
	str	x0, [sp, 16]
	b	.L6
.L8:
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
	ldr	x0, [sp, 16]
	lsr	x0, x0, 1
	str	x0, [sp, 16]
.L6:
	ldr	x0, [sp, 16]
	cmp	x0, 0
	beq	.L7
	ldr	x1, [sp, 8]
	ldr	x0, [sp, 16]
	and	x0, x1, x0
	cmp	x0, 0
	beq	.L8
.L7:
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
ctz_ref:
	sub	sp, sp, #32
	str	x0, [sp, 8]
	str	wzr, [sp, 28]
	mov	x0, 1
	str	x0, [sp, 16]
	b	.L11
.L13:
	ldr	w0, [sp, 28]
	add	w0, w0, 1
	str	w0, [sp, 28]
	ldr	x0, [sp, 16]
	lsl	x0, x0, 1
	str	x0, [sp, 16]
.L11:
	ldr	x0, [sp, 16]
	cmp	x0, 0
	beq	.L12
	ldr	x1, [sp, 8]
	ldr	x0, [sp, 16]
	and	x0, x1, x0
	cmp	x0, 0
	beq	.L13
.L12:
	ldr	w0, [sp, 28]
	add	sp, sp, 32
	ret
	.align	2
clz32:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 0
	beq	.L16
	ldr	w0, [sp, 12]
	clz	w0, w0
	b	.L18
.L16:
	mov	w0, 32
.L18:
	add	sp, sp, 16
	ret
	.align	2
ctz32:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 0
	beq	.L20
	ldr	w0, [sp, 12]
	rbit	w0, w0
	clz	w0, w0
	b	.L22
.L20:
	mov	w0, 32
.L22:
	add	sp, sp, 16
	ret
	.align	2
clz64:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	cmp	x0, 0
	beq	.L24
	ldr	x0, [sp, 8]
	clz	x0, x0
	b	.L26
.L24:
	mov	w0, 64
.L26:
	add	sp, sp, 16
	ret
	.align	2
ctz64:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	cmp	x0, 0
	beq	.L28
	ldr	x0, [sp, 8]
	rbit	x0, x0
	clz	x0, x0
	b	.L30
.L28:
	mov	w0, 64
.L30:
	add	sp, sp, 16
	ret
	.data
	.align	3
vals:
	.quad	0
	.quad	1
	.quad	2
	.quad	3
	.quad	128
	.quad	255
	.quad	-9223372036854775808
	.quad	-1
	.quad	9223372036854775807
	.quad	4294967295
	.quad	-4294967296
	.quad	81985529216486895
	.quad	-81985529216486896
	.quad	-9223372036854775807
	.quad	4294967296
	.quad	-6148914691236517206
	.quad	2147483648
	.section .rodata
	.align	3
.LC1:
	.string	"%016lx pop %d %d clz %d %d ctz %d %d cls %d %d\n"
	.align	3
.LC2:
	.string	"  ffs %d %d parity %d %d bswap %04x %08x %016lx\n"
	.align	3
.LC3:
	.string	"sums pop %ld clz %ld ctz %ld mismatches %d\n"
	.align	3
.LC4:
	.string	"log2(%lu) = %d, next pow2 %lu\n"
	.align	3
.LC5:
	.string	"set bits of %lx:"
	.align	3
.LC6:
	.string	" %d"
	.align	3
.LC7:
	.string	"\n"
	.align	3
.LC8:
	.string	"popcount total %ld\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #272
	stp	x29, x30, [sp, 16]
	add	x29, sp, 16
	stp	x19, x20, [sp, 32]
	stp	x21, x22, [sp, 48]
	str	x23, [sp, 64]
	mov	w0, 17
	str	w0, [sp, 176]
	str	wzr, [sp, 268]
	b	.L32
.L33:
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldrsw	x1, [sp, 268]
	ldr	x0, [x0, x1, lsl 3]
	str	x0, [sp, 144]
	ldr	x0, [sp, 144]
	str	w0, [sp, 140]
	ldr	w0, [sp, 140]
	uxtw	x0, w0
	fmov	d31, x0
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	w19, s31
	ldr	x0, [sp, 144]
	fmov	d31, x0
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	w20, s31
	ldr	w0, [sp, 140]
	bl	clz32
	mov	w21, w0
	ldr	x0, [sp, 144]
	bl	clz64
	mov	w22, w0
	ldr	w0, [sp, 140]
	bl	ctz32
	mov	w23, w0
	ldr	x0, [sp, 144]
	bl	ctz64
	mov	w2, w0
	ldr	w0, [sp, 140]
	cls	w1, w0
	ldr	x0, [sp, 144]
	cls	x0, x0
	str	w0, [sp, 8]
	str	w1, [sp]
	mov	w7, w2
	mov	w6, w23
	mov	w5, w22
	mov	w4, w21
	mov	w3, w20
	mov	w2, w19
	ldr	x1, [sp, 144]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 140]
	cmp	w0, 0
	rbit	w0, w0
	clz	w0, w0
	csinc	w0, wzr, w0, eq
	ldr	x1, [sp, 144]
	cmp	x1, 0
	rbit	x1, x1
	clz	x1, x1
	csinc	x1, xzr, x1, eq
	mov	w8, w1
	ldr	w1, [sp, 140]
	uxtw	x1, w1
	fmov	d31, x1
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	w1, s31
	and	w2, w1, 1
	ldr	x1, [sp, 144]
	fmov	d31, x1
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	x1, d31
	and	x1, x1, 1
	mov	w4, w1
	ldr	w1, [sp, 140]
	and	w1, w1, 65535
	rev16	w1, w1
	and	w1, w1, 65535
	mov	w5, w1
	ldr	w1, [sp, 140]
	rev	w3, w1
	ldr	x1, [sp, 144]
	rev	x1, x1
	mov	x7, x1
	mov	w6, w3
	mov	w3, w2
	mov	w2, w8
	mov	w1, w0
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 268]
	add	w0, w0, 1
	str	w0, [sp, 268]
.L32:
	ldr	w1, [sp, 268]
	ldr	w0, [sp, 176]
	cmp	w1, w0
	blt	.L33
	mov	x0, 31765
	movk	x0, 0x7f4a, lsl 16
	movk	x0, 0x79b9, lsl 32
	movk	x0, 0x9e37, lsl 48
	str	x0, [sp, 256]
	str	xzr, [sp, 248]
	str	xzr, [sp, 240]
	str	xzr, [sp, 232]
	str	wzr, [sp, 228]
	str	wzr, [sp, 224]
	b	.L34
.L36:
	ldr	x1, [sp, 256]
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
	str	x0, [sp, 256]
	ldr	x0, [sp, 256]
	and	w0, w0, 63
	ldr	x1, [sp, 256]
	lsr	x0, x1, x0
	str	x0, [sp, 216]
	ldr	w0, [sp, 224]
	and	w0, w0, 1
	cmp	w0, 0
	beq	.L35
	ldr	w0, [sp, 224]
	mov	w1, 61
	sdiv	w2, w0, w1
	mov	w1, 61
	mul	w1, w2, w1
	sub	w0, w0, w1
	ldr	x1, [sp, 256]
	lsl	x0, x1, x0
	ldr	x1, [sp, 216]
	and	x0, x1, x0
	str	x0, [sp, 216]
.L35:
	ldr	x0, [sp, 216]
	fmov	d31, x0
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	w0, s31
	str	w0, [sp, 160]
	ldr	x0, [sp, 216]
	bl	clz64
	str	w0, [sp, 156]
	ldr	x0, [sp, 216]
	bl	ctz64
	str	w0, [sp, 152]
	ldrsw	x0, [sp, 160]
	ldr	x1, [sp, 248]
	add	x0, x1, x0
	str	x0, [sp, 248]
	ldrsw	x0, [sp, 156]
	ldr	x1, [sp, 240]
	add	x0, x1, x0
	str	x0, [sp, 240]
	ldrsw	x0, [sp, 152]
	ldr	x1, [sp, 232]
	add	x0, x1, x0
	str	x0, [sp, 232]
	ldr	x0, [sp, 216]
	bl	pop_ref
	mov	w1, w0
	ldr	w0, [sp, 160]
	cmp	w0, w1
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 228]
	add	w0, w0, w1
	str	w0, [sp, 228]
	ldr	x0, [sp, 216]
	bl	clz_ref
	mov	w1, w0
	ldr	w0, [sp, 156]
	cmp	w0, w1
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 228]
	add	w0, w0, w1
	str	w0, [sp, 228]
	ldr	x0, [sp, 216]
	bl	ctz_ref
	mov	w1, w0
	ldr	w0, [sp, 152]
	cmp	w0, w1
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 228]
	add	w0, w0, w1
	str	w0, [sp, 228]
	ldr	x0, [sp, 216]
	uxtw	x0, w0
	fmov	d31, x0
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	w19, s31
	ldr	x0, [sp, 216]
	and	x0, x0, 4294967295
	bl	pop_ref
	cmp	w19, w0
	cset	w0, ne
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 228]
	add	w0, w0, w1
	str	w0, [sp, 228]
	ldr	w0, [sp, 224]
	add	w0, w0, 1
	str	w0, [sp, 224]
.L34:
	ldr	w0, [sp, 224]
	cmp	w0, 255
	ble	.L36
	ldr	w4, [sp, 228]
	ldr	x3, [sp, 232]
	ldr	x2, [sp, 240]
	ldr	x1, [sp, 248]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	adrp	x0, .LC0
	add	x1, x0, :lo12:.LC0
	add	x0, sp, 80
	ldr	q29, [x1]
	ldr	q30, [x1, 16]
	ldr	q31, [x1, 32]
	ldr	x1, [x1, 48]
	str	q29, [x0]
	str	q30, [x0, 16]
	str	q31, [x0, 32]
	str	x1, [x0, 48]
	str	wzr, [sp, 212]
	b	.L37
.L41:
	ldrsw	x0, [sp, 212]
	lsl	x0, x0, 3
	add	x1, sp, 80
	ldr	x0, [x1, x0]
	str	x0, [sp, 168]
	ldr	x0, [sp, 168]
	bl	clz64
	mov	w1, w0
	mov	w0, 63
	sub	w0, w0, w1
	str	w0, [sp, 164]
	ldr	x0, [sp, 168]
	cmp	x0, 1
	beq	.L38
	ldr	x1, [sp, 168]
	mov	x0, -9223372036854775808
	cmp	x1, x0
	bhi	.L39
	ldr	x0, [sp, 168]
	sub	x0, x0, #1
	bl	clz64
	mov	w1, w0
	mov	w0, 64
	sub	w0, w0, w1
	mov	x1, 1
	lsl	x0, x1, x0
	str	x0, [sp, 200]
	b	.L40
.L39:
	str	xzr, [sp, 200]
	b	.L40
.L38:
	mov	x0, 1
	str	x0, [sp, 200]
.L40:
	ldr	x3, [sp, 200]
	ldr	w2, [sp, 164]
	ldr	x1, [sp, 168]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	w0, [sp, 212]
	add	w0, w0, 1
	str	w0, [sp, 212]
.L37:
	ldr	w0, [sp, 212]
	cmp	w0, 6
	ble	.L41
	adrp	x0, vals
	add	x0, x0, :lo12:vals
	ldr	x0, [x0, 88]
	str	x0, [sp, 192]
	ldr	x1, [sp, 192]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	b	.L42
.L43:
	ldr	x0, [sp, 192]
	bl	ctz64
	mov	w1, w0
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	x0, [sp, 192]
	sub	x0, x0, #1
	ldr	x1, [sp, 192]
	and	x0, x1, x0
	str	x0, [sp, 192]
.L42:
	ldr	x0, [sp, 192]
	cmp	x0, 0
	bne	.L43
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	str	xzr, [sp, 184]
	str	wzr, [sp, 180]
	b	.L44
.L45:
	ldr	w0, [sp, 180]
	uxtw	x0, w0
	fmov	d31, x0
	cnt	v31.8b, v31.8b
	addv	b31, v31.8b
	fmov	w0, s31
	sxtw	x0, w0
	ldr	x1, [sp, 184]
	add	x0, x1, x0
	str	x0, [sp, 184]
	ldr	w0, [sp, 180]
	add	w0, w0, 1
	str	w0, [sp, 180]
.L44:
	ldr	w0, [sp, 180]
	cmp	w0, 4095
	bls	.L45
	ldr	x1, [sp, 184]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	mov	w0, 0
	ldp	x29, x30, [sp, 16]
	ldp	x19, x20, [sp, 32]
	ldp	x21, x22, [sp, 48]
	ldr	x23, [sp, 64]
	add	sp, sp, 272
	ret
	.section .rodata
	.align	3
.LC0:
	.quad	1
	.quad	2
	.quad	3
	.quad	1000
	.quad	4096
	.quad	4097
	.quad	-9223372036854775808
	.text

