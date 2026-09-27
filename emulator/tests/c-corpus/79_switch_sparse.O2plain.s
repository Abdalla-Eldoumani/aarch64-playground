	.text
	.align	2
	.align 5
punct_kind:
	sub	w0, w0, #33
	cmp	w0, 63
	bhi	.L3
	mov	x3, 22065
	mov	x2, 1
	movk	x3, 0xb800, lsl 16
	lsl	x1, x2, x0
	movk	x3, 0x2000, lsl 48
	mov	w0, 2
	tst	x1, x3
	bne	.L1
	mov	w0, w2
	mov	x2, 384
	movk	x2, 0x1400, lsl 48
	tst	x1, x2
	bne	.L1
	mov	x0, 66
	movk	x0, 0x8000, lsl 48
	tst	x1, x0
	mov	w0, 3
	csel	w0, wzr, w0, eq
.L1:
	ret
	.align 2
.L3:
	mov	w0, 0
	ret
	.align	2
	.align 5
key64:
	mov	x2, 9223372036854775807
	cmp	x0, x2
	beq	.L12
	tbnz	x0, #63, .L10
	mov	w1, 3
	mov	x2, 4294967296
	cmp	x0, x2
	beq	.L8
	bhi	.L11
	mov	w1, 1
	cbz	x0, .L8
	mov	x1, 4294967295
	cmp	x0, x1
	cset	w1, eq
	lsl	w1, w1, 1
.L8:
	mov	w0, w1
	ret
	.align 2
.L10:
	mov	x3, 47806
	mov	w1, 7
	movk	x3, 0xcafe, lsl 16
	movk	x3, 0xbeef, lsl 32
	movk	x3, 0xdead, lsl 48
	cmp	x0, x3
	beq	.L8
	mov	w1, 8
	cmn	x0, #1
	beq	.L8
	add	x2, x2, 1
	mov	w1, 6
	cmp	x0, x2
	csel	w1, w1, wzr, eq
	mov	w0, w1
	ret
	.align 2
.L11:
	mov	x1, 1099511627776
	cmp	x0, x1
	cset	w1, eq
	lsl	w1, w1, 2
	mov	w0, w1
	ret
	.align 2
.L12:
	mov	w1, 5
	mov	w0, w1
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"sparse32:"
	.align	3
.LC1:
	.string	" %d"
	.align	3
.LC2:
	.string	" | %u\n"
	.align	3
.LC3:
	.string	"clustered:"
	.align	3
.LC4:
	.string	"punct: "
	.align	3
.LC5:
	.string	" %d %d %d\n"
	.align	3
.LC6:
	.string	"key64:"
	.align	3
.LC7:
	.string	" %d%d%d"
	.align	3
.LC8:
	.string	"skey64:"
	.align	3
.LC9:
	.string	"primes:"
	.align	3
.LC10:
	.string	" | %d\n"
	.align	3
.LC11:
	.string	"schar:"
	.align	3
.LC12:
	.string	" %d:%d"
	.text
	.align	2
	.align 5
	.global	main
main:
	stp	x29, x30, [sp, -96]!
	adrp	x0, .LANCHOR0
	mov	x29, sp
	stp	x21, x22, [sp, 32]
	adrp	x22, .LANCHOR1
	add	x22, x22, :lo12:.LANCHOR1
	stp	x19, x20, [sp, 16]
	adrp	x20, .LC1
	add	x20, x20, :lo12:.LC1
	stp	x23, x24, [sp, 48]
	add	x24, x22, 104
	mov	w23, 0
	stp	x25, x26, [sp, 64]
	mov	w25, 9029
	mov	x26, x22
	movk	w25, 0x1, lsl 16
	ldr	w19, [x0, :lo12:.LANCHOR0]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	stp	x27, x28, [sp, 80]
	bl	printf
	.align 5
.L21:
	mov	x21, -1
	mov	x28, 2147483648
	mov	x27, 4294967295
.L27:
	ldr	x0, [x26]
	add	x0, x21, x0
	add	x1, x0, x28
	cmp	x1, x27
	bhi	.L22
	add	w0, w19, w0
	cmp	w0, 4095
	beq	.L86
	bgt	.L24
	cmn	w0, #4096
	beq	.L87
	cmn	w0, #4095
	bge	.L25
	cmn	w0, #65536
	beq	.L88
	mov	w1, -4097
	cmp	w0, w1
	beq	.L89
	mov	w1, -2147483648
	cmp	w0, w1
	bne	.L98
	mov	w0, 1
	mov	w1, w0
	.align 5
.L23:
	lsl	w2, w23, 5
	sub	w23, w2, w23
	add	w23, w23, w0
	mov	x0, x20
	bl	printf
.L22:
	add	x21, x21, 1
	cmp	x21, 2
	bne	.L27
	add	x26, x26, 8
	cmp	x26, x24
	bne	.L21
	mov	w1, w23
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x0, .LC3
	add	x25, x22, 112
	add	x0, x0, :lo12:.LC3
	mov	w26, 0
	mov	w28, 114
	mov	w27, 0
	mov	x21, 0
	mov	w23, 50000
	mov	w24, 50003
	bl	printf
	b	.L58
	.align 2
.L142:
	cmp	w0, 6
	beq	.L31
	bgt	.L32
	cmp	w0, 3
	beq	.L33
	bgt	.L34
	cmp	w0, 1
	beq	.L35
	add	w1, w21, w21, lsl 2
	add	w1, w1, 52
	cmp	w0, 2
	bne	.L44
	.align 5
.L37:
	mov	x0, x20
	add	x21, x21, 1
	bl	printf
	add	w27, w27, 7
	add	w28, w28, 11
	add	w26, w26, 6
	cmp	x21, 18
	beq	.L141
.L58:
	ldr	w0, [x25, x21, lsl 2]
	add	w0, w19, w0
	cmp	w0, 1002
	beq	.L29
	ble	.L142
	cmp	w0, w23
	beq	.L45
	bgt	.L46
	cmp	w0, 1005
	beq	.L47
	bgt	.L48
	cmp	w0, 1003
	beq	.L143
	add	w1, w21, w21, lsl 2
	mov	x0, x20
	add	x21, x21, 1
	add	w27, w27, 7
	lsl	w1, w1, 1
	add	w28, w28, 11
	add	w1, w1, 204
	bl	printf
	add	w26, w26, 6
	cmp	x21, 18
	bne	.L58
.L141:
	adrp	x23, stdout
	add	w21, w19, 32
	add	w24, w19, 128
	add	x23, x23, :lo12:stdout
	mov	w0, 10
	bl	putchar
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	.align 5
.L59:
	mov	w0, w21
	bl	punct_kind
	ldr	x1, [x23]
	add	w21, w21, 1
	add	w0, w0, 48
	bl	putc
	cmp	w21, w24
	bne	.L59
	sub	w0, w19, #1
	bl	punct_kind
	mov	w4, w0
	add	w0, w19, 289
	bl	punct_kind
	mov	w5, w0
	mov	w0, w21
	bl	punct_kind
	mov	w2, w5
	mov	w3, w0
	mov	w1, w4
	adrp	x21, .LC7
	sxtw	x23, w19
	add	x24, x22, 192
	add	x25, x22, 280
	add	x21, x21, :lo12:.LC7
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	.align 5
.L60:
	ldr	x4, [x24], 8
	add	x4, x23, x4
	sub	x0, x4, #1
	bl	key64
	mov	w5, w0
	mov	x0, x4
	bl	key64
	mov	w6, w0
	add	x0, x4, 1
	bl	key64
	mov	w2, w6
	mov	w3, w0
	mov	w1, w5
	mov	x0, x21
	bl	printf
	cmp	x25, x24
	bne	.L60
	mov	w0, 10
	bl	putchar
	add	x26, x22, 288
	adrp	x0, .LC8
	add	x22, x22, 352
	add	x0, x0, :lo12:.LC8
	mov	x24, -9223372036854775808
	mov	x25, 2147483648
	bl	printf
	b	.L66
	.align 2
.L146:
	sub	x1, x0, #1
	cmn	x0, #4095
	beq	.L100
	cmn	x1, #4095
	bge	.L62
	cmp	x1, x24
	beq	.L101
	mov	x2, -4294967296
	cmp	x1, x2
	bne	.L144
	mov	w2, 0
	mov	w1, 2
	mov	w3, 0
	.align 5
.L61:
	mov	x0, x21
	add	x26, x26, 8
	bl	printf
	cmp	x22, x26
	beq	.L145
.L66:
	ldr	x0, [x26]
	add	x0, x23, x0
	cmp	x0, x24
	bne	.L146
	mov	x0, x21
	mov	w2, 1
	mov	w1, 9
	mov	w3, 0
	add	x26, x26, 8
	bl	printf
	cmp	x22, x26
	bne	.L66
.L145:
	mov	x22, 321
	mov	x21, 4177
	mov	x26, 10412
	movk	x22, 0x414, lsl 16
	movk	x21, 0x4041, lsl 16
	movk	x26, 0xa08a, lsl 16
	movk	x22, 0x411, lsl 32
	movk	x21, 0x4514, lsl 32
	movk	x26, 0x8a20, lsl 32
	mov	w25, 0
	mov	w24, -3
	mov	x23, 81
	movk	x22, 0x1005, lsl 48
	movk	x21, 0x1000, lsl 48
	movk	x26, 0x2820, lsl 48
	mov	w0, 10
	bl	putchar
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	.align 5
.L79:
	add	w0, w24, w19
	cmp	w0, 127
	bgt	.L67
.L147:
	cmp	w0, 66
	bgt	.L68
	sub	w1, w0, #2
	cmp	w1, 59
	bhi	.L72
	lsr	x0, x26, x0
	tbz	x0, 0, .L72
.L71:
	add	w25, w25, 1
	cmp	w24, 150
	bgt	.L76
	add	w24, w24, 1
	add	w0, w24, w19
	cmp	w0, 127
	ble	.L147
.L67:
	cmp	w0, 191
	bgt	.L73
	cmp	w0, 130
	ble	.L72
	sub	w0, w0, #131
	lsr	x0, x22, x0
	tbnz	x0, 0, .L71
	.align 5
.L72:
	add	w24, w24, 1
	cmp	w24, 211
	bne	.L79
.L154:
	mov	w1, w25
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	adrp	x0, .LC11
	adrp	x21, .LC12
	add	x0, x0, :lo12:.LC11
	add	x21, x21, :lo12:.LC12
	mov	w20, 0
	bl	printf
	b	.L83
	.align 2
.L149:
	cmn	w0, #100
	beq	.L115
	cmn	w0, #1
	beq	.L116
	mov	w2, 1
	cmn	w0, #128
	bne	.L82
	.align 5
.L80:
	mov	w1, w20
	mov	x0, x21
	bl	printf
.L82:
	add	w20, w20, 1
	cmp	w20, 256
	beq	.L148
.L83:
	add	w0, w19, w20
	sxtb	w0, w0
	cmp	w0, 0
	cbz	w0, .L114
	ble	.L149
	cmp	w0, 100
	beq	.L118
	mov	w2, 6
	cmp	w0, 127
	beq	.L80
	add	w20, w20, 1
	cmp	w20, 256
	bne	.L83
.L148:
	mov	w0, 10
	bl	putchar
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x21, x22, [sp, 32]
	ldp	x23, x24, [sp, 48]
	ldp	x25, x26, [sp, 64]
	ldp	x27, x28, [sp, 80]
	ldp	x29, x30, [sp], 96
	ret
	.align 2
.L24:
	cmp	w0, w25
	beq	.L93
	bgt	.L26
	mov	w1, 65535
	cmp	w0, w1
	beq	.L94
	cmp	w0, 65536
	beq	.L95
	cmp	w0, 4096
	bne	.L98
	mov	w0, 8
	mov	w1, w0
	b	.L23
	.align 2
.L46:
	add	w1, w26, 563
	cmp	w0, w24
	beq	.L37
	bgt	.L54
	lsl	w1, w21, 3
	mov	w2, 50001
	add	w1, w1, 581
	cmp	w0, w2
	add	w0, w27, 572
	csel	w1, w1, w0, eq
	b	.L37
	.align 2
.L32:
	cmp	w0, 1000
	beq	.L40
	cmp	w0, 1001
	beq	.L41
	cmp	w0, 7
	beq	.L42
	cmp	w0, 8
	bne	.L44
	mov	w1, 23
	mul	w1, w21, w1
	add	w1, w1, 238
	b	.L37
	.align 2
.L25:
	cmn	w0, #1
	beq	.L91
	cbnz	w0, .L98
	mov	w0, 6
	mov	w1, w0
	b	.L23
	.align 2
.L26:
	mov	w1, 2147418112
	cmp	w0, w1
	beq	.L97
	mov	w1, 2147483647
	cmp	w0, w1
	bne	.L98
	mov	w0, 13
	mov	w1, w0
	b	.L23
	.align 2
.L48:
	cmp	w0, 1006
	beq	.L51
	lsl	w1, w21, 4
	add	w1, w1, 267
	cmp	w0, 1007
	beq	.L37
.L44:
	mov	w1, -1
	b	.L37
	.align 2
.L34:
	cmp	w0, 4
	add	w0, w21, w21, lsl 1
	add	w0, w21, w0, lsl 2
	add	w0, w0, 135
	csel	w1, w28, w0, eq
	b	.L37
	.align 2
.L86:
	mov	w0, 7
	mov	w1, w0
	b	.L23
	.align 2
.L98:
	mov	w0, 0
	mov	w1, 0
	b	.L23
	.align 2
.L97:
	mov	w0, 12
	mov	w1, w0
	b	.L23
	.align 2
.L87:
	mov	w0, 4
	mov	w1, w0
	b	.L23
	.align 2
.L95:
	mov	w0, 10
	mov	w1, w0
	b	.L23
	.align 2
.L94:
	mov	w0, 9
	mov	w1, w0
	b	.L23
	.align 2
.L93:
	mov	w0, 11
	mov	w1, w0
	b	.L23
	.align 2
.L91:
	mov	w0, 5
	mov	w1, w0
	b	.L23
	.align 2
.L89:
	mov	w0, 3
	mov	w1, w0
	b	.L23
	.align 2
.L88:
	mov	w0, 2
	mov	w1, w0
	b	.L23
	.align 2
.L62:
	cmn	x1, #1
	beq	.L103
	cmp	x1, x25
	bne	.L150
	mov	w2, 0
	mov	w1, 5
	mov	w3, 0
	b	.L61
.L150:
	cmn	x0, #1
	beq	.L151
	tbnz	x0, #63, .L152
	cmp	x0, x25
	beq	.L106
	mov	x1, 9223372036854775807
	cmp	x0, x1
	bne	.L153
	mov	w2, 6
	mov	w1, 0
	mov	w3, 9
	b	.L61
	.align 2
.L68:
	sub	w0, w0, #67
	lsr	x0, x21, x0
	tbnz	x0, 0, .L71
	add	w24, w24, 1
	cmp	w24, 211
	bne	.L79
	b	.L154
	.align 2
.L116:
	mov	w2, 3
	b	.L80
	.align 2
.L115:
	mov	w2, 2
	b	.L80
	.align 2
.L114:
	mov	w2, 4
	b	.L80
	.align 2
.L118:
	mov	w2, 5
	b	.L80
	.align 2
.L76:
	mov	w1, w24
	mov	x0, x20
	add	w24, w24, 1
	bl	printf
	cmp	w24, 211
	bne	.L79
	b	.L154
	.align 2
.L73:
	sub	w0, w0, #193
	cmp	w0, 6
	bhi	.L72
	lsr	x0, x23, x0
	tbnz	x0, 0, .L71
	add	w24, w24, 1
	cmp	w24, 211
	bne	.L79
	b	.L154
	.align 2
.L54:
	cmp	w0, 1048576
	bne	.L44
	mov	w1, 99
	mul	w1, w21, w1
	add	w1, w1, 1989
	b	.L37
.L103:
	mov	w2, 0
	mov	w1, 4
	mov	w3, 0
	b	.L61
.L100:
	mov	w2, 0
	mov	w1, 3
	mov	w3, 0
	b	.L61
.L101:
	mov	w2, 0
	mov	w1, 1
	mov	w3, 0
	b	.L61
.L42:
	add	w1, w21, w21, lsl 3
	add	w1, w21, w1, lsl 1
	add	w1, w1, 197
	b	.L37
.L35:
	add	w1, w21, w21, lsl 1
	add	w1, w1, 31
	b	.L37
.L41:
	lsl	w1, w21, 2
	add	w1, w1, 141
	b	.L37
.L40:
	lsl	w1, w21, 1
	add	w1, w1, 120
	b	.L37
.L31:
	add	w1, w21, w21, lsl 4
	add	w1, w1, 176
	b	.L37
.L33:
	add	w1, w27, 73
	b	.L37
.L51:
	mov	w1, 14
	mul	w1, w21, w1
	add	w1, w1, 246
	b	.L37
.L29:
	add	w1, w26, 162
	b	.L37
.L47:
	add	w1, w21, w21, lsl 1
	lsl	w1, w1, 2
	add	w1, w1, 225
	b	.L37
.L45:
	add	w1, w21, w21, lsl 3
	add	w1, w1, 590
	b	.L37
.L143:
	lsl	w1, w21, 3
	add	w1, w1, 183
	b	.L37
.L144:
	cmp	x0, x2
	beq	.L109
	cmn	x0, #4096
	bne	.L155
	mov	w2, 3
	mov	w1, 0
	mov	w3, 0
	b	.L61
.L109:
	mov	w2, 2
	mov	w1, 0
	mov	w3, 0
	b	.L61
.L106:
	mov	w2, 5
	mov	w1, 0
	mov	w3, 0
	b	.L61
.L151:
	mov	w2, 4
	mov	w1, 0
	mov	w3, 0
	b	.L61
.L155:
	add	x1, x0, 1
	cmp	x1, x2
	beq	.L111
.L85:
	cmn	x1, #4096
	mov	w2, 0
	mov	w1, 0
	mov	w3, 3
	beq	.L61
	mov	w3, 0
	b	.L61
.L153:
	add	x0, x0, 1
	cmp	x0, x25
	beq	.L108
	mov	x1, 9223372036854775807
	mov	w2, 0
	cmp	x0, x1
	mov	w3, 6
	mov	w1, 0
	beq	.L61
	mov	w3, 0
	b	.L61
.L152:
	add	x1, x0, 1
	cmn	x0, #2
	bne	.L85
	mov	w2, 0
	mov	w1, 0
	mov	w3, 4
	b	.L61
.L111:
	mov	w2, 0
	mov	w1, 0
	mov	w3, 2
	b	.L61
.L108:
	mov	w2, 0
	mov	w1, 0
	mov	w3, 5
	b	.L61
	.section .rodata
	.align	4
	.LANCHOR1:
k32__3:
	.quad	-2147483648
	.quad	-65536
	.quad	-4097
	.quad	-4096
	.quad	-1
	.quad	0
	.quad	4095
	.quad	4096
	.quad	65535
	.quad	65536
	.quad	74565
	.quad	2147418112
	.quad	2147483647
	.zero	8
kc__2:
	.word	0
	.word	1
	.word	4
	.word	8
	.word	9
	.word	999
	.word	1000
	.word	1003
	.word	1007
	.word	1008
	.word	49999
	.word	50000
	.word	50003
	.word	50004
	.word	1048575
	.word	1048576
	.word	1048577
	.word	-1
	.zero	8
k64__1:
	.quad	0
	.quad	4294967295
	.quad	4294967296
	.quad	1099511627776
	.quad	9223372036854775807
	.quad	-9223372036854775808
	.quad	-2401053089206453570
	.quad	-1
	.quad	8589934591
	.quad	-2401053092612145152
	.quad	3405691582
	.zero	8
s64__0:
	.quad	-9223372036854775808
	.quad	-4294967296
	.quad	-4096
	.quad	-1
	.quad	2147483648
	.quad	9223372036854775807
	.quad	2147483647
	.quad	-2147483648
	.bss
	.align	2
	.LANCHOR0:
vzero:
	.zero	4

