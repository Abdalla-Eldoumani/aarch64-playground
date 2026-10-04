	.text
	.data
	.align	2
seed:
	.word	-1831433054
	.text
	.align	2
fill:
	sub	sp, sp, #16
	adrp	x0, seed
	add	x0, x0, :lo12:seed
	ldr	w0, [x0]
	str	w0, [sp, 12]
	str	wzr, [sp, 8]
	b	.L2
.L3:
	ldr	w0, [sp, 12]
	lsl	w0, w0, 13
	ldr	w1, [sp, 12]
	eor	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 17
	ldr	w1, [sp, 12]
	eor	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	lsl	w0, w0, 5
	ldr	w1, [sp, 12]
	eor	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 5
	mov	w1, w0
	mov	w0, -67108864
	add	w2, w1, w0
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	ldrsw	x1, [sp, 8]
	str	w2, [x0, x1, lsl 2]
	ldr	w1, [sp, 12]
	mov	w0, 1883
	movk	w0, 0xa7c5, lsl 16
	umull	x0, w1, w0
	lsr	x0, x0, 32
	lsr	w0, w0, 17
	mov	w2, 3395
	movk	w2, 0x3, lsl 16
	mul	w0, w0, w2
	sub	w0, w1, w0
	mov	w1, w0
	mov	w0, 31071
	movk	w0, 0xfffe, lsl 16
	add	w2, w1, w0
	adrp	x0, b32
	add	x0, x0, :lo12:b32
	ldrsw	x1, [sp, 8]
	str	w2, [x0, x1, lsl 2]
	adrp	x0, u32a
	add	x0, x0, :lo12:u32a
	ldrsw	x1, [sp, 8]
	ldr	w2, [sp, 12]
	str	w2, [x0, x1, lsl 2]
	ldr	w1, [sp, 12]
	mov	w0, 31153
	movk	w0, 0x9e37, lsl 16
	mul	w2, w1, w0
	adrp	x0, u32b
	add	x0, x0, :lo12:u32b
	ldrsw	x1, [sp, 8]
	str	w2, [x0, x1, lsl 2]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 16
	negs	w1, w0
	and	w0, w0, 2047
	and	w1, w1, 2047
	csneg	w0, w0, w1, mi
	and	w0, w0, 65535
	sub	w0, w0, #1024
	and	w0, w0, 65535
	sxth	w2, w0
	adrp	x0, a16
	add	x0, x0, :lo12:a16
	ldrsw	x1, [sp, 8]
	strh	w2, [x0, x1, lsl 1]
	ldr	w0, [sp, 12]
	and	w0, w0, 65535
	and	w0, w0, 2047
	and	w0, w0, 65535
	sub	w0, w0, #1024
	and	w0, w0, 65535
	sxth	w2, w0
	adrp	x0, b16
	add	x0, x0, :lo12:b16
	ldrsw	x1, [sp, 8]
	strh	w2, [x0, x1, lsl 1]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 8
	and	w2, w0, 255
	adrp	x0, u8a
	add	x1, x0, :lo12:u8a
	ldrsw	x0, [sp, 8]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 20
	and	w2, w0, 255
	adrp	x0, u8b
	add	x1, x0, :lo12:u8b
	ldrsw	x0, [sp, 8]
	strb	w2, [x1, x0]
	ldr	w0, [sp, 12]
	lsr	w0, w0, 24
	sxtb	w2, w0
	adrp	x0, s8a
	add	x1, x0, :lo12:s8a
	ldrsw	x0, [sp, 8]
	strb	w2, [x1, x0]
	ldr	w1, [sp, 12]
	mov	x0, x1
	lsl	x0, x0, 1
	add	x1, x0, x1
	mov	x0, -4294967296
	add	x2, x1, x0
	adrp	x0, a64
	add	x0, x0, :lo12:a64
	ldrsw	x1, [sp, 8]
	str	x2, [x0, x1, lsl 3]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L2:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L3
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	mov	w1, 67108863
	str	w1, [x0, 20]
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	mov	w1, -67108864
	str	w1, [x0, 1020]
	adrp	x0, u32a
	add	x0, x0, :lo12:u32a
	mov	w1, -1
	str	w1, [x0, 28]
	adrp	x0, a16
	add	x0, x0, :lo12:a16
	mov	w1, -1024
	strh	w1, [x0, 6]
	adrp	x0, u8a
	add	x0, x0, :lo12:u8a
	mov	w1, -1
	strb	w1, [x0]
	adrp	x0, u8b
	add	x0, x0, :lo12:u8b
	strb	wzr, [x0]
	adrp	x0, s8a
	add	x0, x0, :lo12:s8a
	mov	w1, -128
	strb	w1, [x0, 1]
	adrp	x0, s8a
	add	x0, x0, :lo12:s8a
	mov	w1, 127
	strb	w1, [x0, 2]
	nop
	add	sp, sp, 16
	ret
	.align	2
sum_i32:
	sub	sp, sp, #16
	str	xzr, [sp, 8]
	str	wzr, [sp, 4]
	b	.L5
.L6:
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	ldrsw	x1, [sp, 4]
	ldr	w0, [x0, x1, lsl 2]
	sxtw	x0, w0
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	str	x0, [sp, 8]
	ldr	w0, [sp, 4]
	add	w0, w0, 1
	str	w0, [sp, 4]
.L5:
	ldr	w0, [sp, 4]
	cmp	w0, 255
	ble	.L6
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
sum_u32:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L9
.L10:
	adrp	x0, u32a
	add	x0, x0, :lo12:u32a
	ldrsw	x1, [sp, 8]
	ldr	w0, [x0, x1, lsl 2]
	ldr	w1, [sp, 12]
	add	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L9:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L10
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
sum_i16:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L13
.L14:
	adrp	x0, a16
	add	x0, x0, :lo12:a16
	ldrsw	x1, [sp, 8]
	ldrsh	w0, [x0, x1, lsl 1]
	mov	w1, w0
	ldr	w0, [sp, 12]
	add	w0, w0, w1
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L13:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L14
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
sum_u8:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L17
.L18:
	adrp	x0, u8a
	add	x1, x0, :lo12:u8a
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	mov	w1, w0
	ldr	w0, [sp, 12]
	add	w0, w0, w1
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L17:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L18
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
sum_s8:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L21
.L22:
	adrp	x0, s8a
	add	x1, x0, :lo12:s8a
	ldrsw	x0, [sp, 8]
	ldrsb	w0, [x1, x0]
	mov	w1, w0
	ldr	w0, [sp, 12]
	add	w0, w0, w1
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L21:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L22
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
sum_i64:
	sub	sp, sp, #16
	str	xzr, [sp, 8]
	str	wzr, [sp, 4]
	b	.L25
.L26:
	adrp	x0, a64
	add	x0, x0, :lo12:a64
	ldrsw	x1, [sp, 4]
	ldr	x0, [x0, x1, lsl 3]
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	str	x0, [sp, 8]
	ldr	w0, [sp, 4]
	add	w0, w0, 1
	str	w0, [sp, 4]
.L25:
	ldr	w0, [sp, 4]
	cmp	w0, 255
	ble	.L26
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
dot_i16:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L29
.L30:
	adrp	x0, a16
	add	x0, x0, :lo12:a16
	ldrsw	x1, [sp, 8]
	ldrsh	w0, [x0, x1, lsl 1]
	mov	w2, w0
	adrp	x0, b16
	add	x0, x0, :lo12:b16
	ldrsw	x1, [sp, 8]
	ldrsh	w0, [x0, x1, lsl 1]
	mul	w0, w2, w0
	ldr	w1, [sp, 12]
	add	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L29:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L30
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
dot_i32:
	sub	sp, sp, #16
	str	xzr, [sp, 8]
	str	wzr, [sp, 4]
	b	.L33
.L34:
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	ldrsw	x1, [sp, 4]
	ldr	w0, [x0, x1, lsl 2]
	sxtw	x1, w0
	adrp	x0, b32
	add	x0, x0, :lo12:b32
	ldrsw	x2, [sp, 4]
	ldr	w0, [x0, x2, lsl 2]
	sxtw	x0, w0
	mul	x0, x1, x0
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	str	x0, [sp, 8]
	ldr	w0, [sp, 4]
	add	w0, w0, 1
	str	w0, [sp, 4]
.L33:
	ldr	w0, [sp, 4]
	cmp	w0, 255
	ble	.L34
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
dot_u32:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L37
.L38:
	adrp	x0, u32a
	add	x0, x0, :lo12:u32a
	ldrsw	x1, [sp, 8]
	ldr	w1, [x0, x1, lsl 2]
	adrp	x0, u32b
	add	x0, x0, :lo12:u32b
	ldrsw	x2, [sp, 8]
	ldr	w0, [x0, x2, lsl 2]
	mul	w0, w1, w0
	ldr	w1, [sp, 12]
	add	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L37:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L38
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
dot_u8:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L41
.L42:
	adrp	x0, u8a
	add	x1, x0, :lo12:u8a
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	mov	w2, w0
	adrp	x0, u8b
	add	x1, x0, :lo12:u8b
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	mul	w0, w2, w0
	mov	w1, w0
	ldr	w0, [sp, 12]
	add	w0, w0, w1
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L41:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L42
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
dot_s8u8:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L45
.L46:
	adrp	x0, s8a
	add	x1, x0, :lo12:s8a
	ldrsw	x0, [sp, 8]
	ldrsb	w0, [x1, x0]
	mov	w2, w0
	adrp	x0, u8b
	add	x1, x0, :lo12:u8b
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	mul	w0, w2, w0
	ldr	w1, [sp, 12]
	add	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L45:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L46
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
sq_i16:
	sub	sp, sp, #16
	str	xzr, [sp, 8]
	str	wzr, [sp, 4]
	b	.L49
.L50:
	adrp	x0, a16
	add	x0, x0, :lo12:a16
	ldrsw	x1, [sp, 4]
	ldrsh	w0, [x0, x1, lsl 1]
	mov	w2, w0
	adrp	x0, a16
	add	x0, x0, :lo12:a16
	ldrsw	x1, [sp, 4]
	ldrsh	w0, [x0, x1, lsl 1]
	mul	w0, w2, w0
	sxtw	x0, w0
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	str	x0, [sp, 8]
	ldr	w0, [sp, 4]
	add	w0, w0, 1
	str	w0, [sp, 4]
.L49:
	ldr	w0, [sp, 4]
	cmp	w0, 255
	ble	.L50
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.align	2
max_i32:
	sub	sp, sp, #16
	mov	w0, -2147483648
	str	w0, [sp, 12]
	str	wzr, [sp, 8]
	b	.L53
.L54:
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	ldrsw	x1, [sp, 8]
	ldr	w0, [x0, x1, lsl 2]
	ldr	w2, [sp, 12]
	ldr	w1, [sp, 12]
	cmp	w2, w0
	csel	w0, w1, w0, ge
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L53:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L54
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
min_i32:
	sub	sp, sp, #16
	mov	w0, 2147483647
	str	w0, [sp, 12]
	str	wzr, [sp, 8]
	b	.L57
.L58:
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	ldrsw	x1, [sp, 8]
	ldr	w0, [x0, x1, lsl 2]
	ldr	w2, [sp, 12]
	ldr	w1, [sp, 12]
	cmp	w2, w0
	csel	w0, w1, w0, le
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L57:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L58
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
max_u32:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L61
.L62:
	adrp	x0, u32b
	add	x0, x0, :lo12:u32b
	ldrsw	x1, [sp, 8]
	ldr	w0, [x0, x1, lsl 2]
	ldr	w2, [sp, 12]
	ldr	w1, [sp, 12]
	cmp	w2, w0
	csel	w0, w1, w0, cs
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L61:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L62
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
min_u8:
	sub	sp, sp, #16
	mov	w0, -1
	strb	w0, [sp, 15]
	mov	w0, 1
	str	w0, [sp, 8]
	b	.L65
.L66:
	adrp	x0, u8b
	add	x1, x0, :lo12:u8b
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	ldrb	w3, [sp, 15]
	and	w2, w0, 255
	ldrb	w1, [sp, 15]
	cmp	w3, w2
	csel	w0, w1, w0, ls
	strb	w0, [sp, 15]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L65:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L66
	ldrb	w0, [sp, 15]
	add	sp, sp, 16
	ret
	.align	2
max_s8:
	sub	sp, sp, #16
	mov	w0, -128
	strb	w0, [sp, 15]
	str	wzr, [sp, 8]
	b	.L69
.L70:
	adrp	x0, s8a
	add	x1, x0, :lo12:s8a
	ldrsw	x0, [sp, 8]
	ldrsb	w0, [x1, x0]
	ldrsb	w3, [sp, 15]
	sxtb	w2, w0
	ldrb	w1, [sp, 15]
	cmp	w3, w2
	csel	w0, w1, w0, ge
	strb	w0, [sp, 15]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L69:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L70
	ldrsb	w0, [sp, 15]
	add	sp, sp, 16
	ret
	.align	2
min_i16:
	sub	sp, sp, #16
	mov	w0, 32767
	strh	w0, [sp, 14]
	str	wzr, [sp, 8]
	b	.L73
.L74:
	adrp	x0, b16
	add	x0, x0, :lo12:b16
	ldrsw	x1, [sp, 8]
	ldrsh	w0, [x0, x1, lsl 1]
	ldrsh	w3, [sp, 14]
	sxth	w2, w0
	ldrh	w1, [sp, 14]
	cmp	w3, w2
	csel	w0, w1, w0, le
	strh	w0, [sp, 14]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L73:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L74
	ldrsh	w0, [sp, 14]
	add	sp, sp, 16
	ret
	.align	2
sad_u8:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L77
.L78:
	adrp	x0, u8a
	add	x1, x0, :lo12:u8a
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	mov	w2, w0
	adrp	x0, u8b
	add	x1, x0, :lo12:u8b
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	sub	w0, w2, w0
	str	w0, [sp, 4]
	ldr	w0, [sp, 4]
	cmp	w0, 0
	csneg	w0, w0, w0, ge
	mov	w1, w0
	ldr	w0, [sp, 12]
	add	w0, w0, w1
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L77:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L78
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
count_pos:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L81
.L82:
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	ldrsw	x1, [sp, 8]
	ldr	w0, [x0, x1, lsl 2]
	cmp	w0, 0
	cset	w0, gt
	and	w0, w0, 255
	mov	w1, w0
	ldr	w0, [sp, 12]
	add	w0, w0, w1
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L81:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L82
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
xor_u32:
	sub	sp, sp, #16
	str	wzr, [sp, 12]
	str	wzr, [sp, 8]
	b	.L85
.L86:
	adrp	x0, u32a
	add	x0, x0, :lo12:u32a
	ldrsw	x1, [sp, 8]
	ldr	w0, [x0, x1, lsl 2]
	ldr	w1, [sp, 12]
	eor	w0, w1, w0
	str	w0, [sp, 12]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L85:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L86
	ldr	w0, [sp, 12]
	add	sp, sp, 16
	ret
	.align	2
or_u8:
	sub	sp, sp, #16
	strb	wzr, [sp, 15]
	str	wzr, [sp, 8]
	b	.L89
.L90:
	adrp	x0, u8a
	add	x1, x0, :lo12:u8a
	ldrsw	x0, [sp, 8]
	ldrb	w0, [x1, x0]
	sxtb	w0, w0
	and	w0, w0, -127
	sxtb	w1, w0
	ldrsb	w0, [sp, 15]
	orr	w0, w1, w0
	sxtb	w0, w0
	strb	w0, [sp, 15]
	ldr	w0, [sp, 8]
	add	w0, w0, 1
	str	w0, [sp, 8]
.L89:
	ldr	w0, [sp, 8]
	cmp	w0, 255
	ble	.L90
	ldrb	w0, [sp, 15]
	add	sp, sp, 16
	ret
	.align	2
wsum_u32:
	sub	sp, sp, #16
	str	xzr, [sp, 8]
	str	wzr, [sp, 4]
	b	.L93
.L94:
	adrp	x0, u32a
	add	x0, x0, :lo12:u32a
	ldrsw	x1, [sp, 4]
	ldr	w0, [x0, x1, lsl 2]
	uxtw	x0, w0
	ldr	x1, [sp, 8]
	add	x0, x1, x0
	str	x0, [sp, 8]
	ldr	w0, [sp, 4]
	add	w0, w0, 1
	str	w0, [sp, 4]
.L93:
	ldr	w0, [sp, 4]
	cmp	w0, 255
	ble	.L94
	ldr	x0, [sp, 8]
	add	sp, sp, 16
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"sum i32 %ld u32 %u i16 %d u8 %u s8 %d i64 %ld wide u32 %ld\n"
	.align	3
.LC1:
	.string	"dot i16 %d i32 %ld u32 %u u8 %u s8u8 %d sq16 %ld\n"
	.align	3
.LC2:
	.string	"max i32 %d min i32 %d max u32 %u min u8 %d max s8 %d min i16 %d\n"
	.align	3
.LC3:
	.string	"sad %u positive %d xor %08x or %02x\n"
	.align	3
.LC4:
	.string	"lane check %016lx\n"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	stp	x21, x22, [sp, 32]
	stp	x23, x24, [sp, 48]
	bl	fill
	bl	sum_i32
	mov	x19, x0
	bl	sum_u32
	mov	w20, w0
	bl	sum_i16
	mov	w21, w0
	bl	sum_u8
	mov	w22, w0
	bl	sum_s8
	mov	w23, w0
	bl	sum_i64
	mov	x24, x0
	bl	wsum_u32
	mov	x7, x0
	mov	x6, x24
	mov	w5, w23
	mov	w4, w22
	mov	w3, w21
	mov	w2, w20
	mov	x1, x19
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	bl	dot_i16
	mov	w19, w0
	bl	dot_i32
	mov	x20, x0
	bl	dot_u32
	mov	w21, w0
	bl	dot_u8
	mov	w22, w0
	bl	dot_s8u8
	mov	w23, w0
	bl	sq_i16
	mov	x6, x0
	mov	w5, w23
	mov	w4, w22
	mov	w3, w21
	mov	x2, x20
	mov	w1, w19
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	bl	max_i32
	mov	w19, w0
	bl	min_i32
	mov	w20, w0
	bl	max_u32
	mov	w21, w0
	bl	min_u8
	mov	w22, w0
	bl	max_s8
	mov	w23, w0
	bl	min_i16
	sxth	w0, w0
	mov	w6, w0
	mov	w5, w23
	mov	w4, w22
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	bl	sad_u8
	mov	w19, w0
	bl	count_pos
	mov	w20, w0
	bl	xor_u32
	mov	w21, w0
	bl	or_u8
	mov	w4, w0
	mov	w3, w21
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	str	xzr, [sp, 72]
	str	wzr, [sp, 68]
	b	.L97
.L98:
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	ldrsw	x1, [sp, 68]
	ldr	w1, [x0, x1, lsl 2]
	ldr	w0, [sp, 68]
	add	w2, w0, 1
	mov	w0, 1000
	mul	w0, w2, w0
	add	w2, w1, w0
	adrp	x0, a32
	add	x0, x0, :lo12:a32
	ldrsw	x1, [sp, 68]
	str	w2, [x0, x1, lsl 2]
	adrp	x0, u8a
	add	x1, x0, :lo12:u8a
	ldrsw	x0, [sp, 68]
	ldrb	w1, [x1, x0]
	mov	w0, 90
	eor	w0, w1, w0
	and	w2, w0, 255
	adrp	x0, u8a
	add	x1, x0, :lo12:u8a
	ldrsw	x0, [sp, 68]
	strb	w2, [x1, x0]
	ldr	x1, [sp, 72]
	mov	x0, 16963
	movk	x0, 0xf, lsl 16
	mul	x19, x1, x0
	bl	sum_i32
	add	x19, x19, x0
	bl	sum_u8
	uxtw	x0, w0
	add	x19, x19, x0
	bl	dot_i16
	uxtw	x0, w0
	add	x0, x19, x0
	str	x0, [sp, 72]
	ldr	w0, [sp, 68]
	add	w0, w0, 1
	str	w0, [sp, 68]
.L97:
	ldr	w0, [sp, 68]
	cmp	w0, 15
	ble	.L98
	ldr	x1, [sp, 72]
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x29, x30, [sp], 80
	ret


	.bss
	.balign 8
a32:
	.skip 1024
	.balign 8
b32:
	.skip 1024
	.balign 8
u32a:
	.skip 1024
	.balign 8
u32b:
	.skip 1024
	.balign 8
a16:
	.skip 512
	.balign 8
b16:
	.skip 512
	.balign 8
u8a:
	.skip 256
	.balign 8
u8b:
	.skip 256
	.balign 8
s8a:
	.skip 256
	.balign 8
a64:
	.skip 2048
