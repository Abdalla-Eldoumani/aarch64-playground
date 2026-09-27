	.text
	.align	2
sparse32:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w1, [sp, 12]
	mov	w0, 2147483647
	cmp	w1, w0
	beq	.L2
	ldr	w1, [sp, 12]
	mov	w0, 2147418112
	cmp	w1, w0
	beq	.L3
	ldr	w1, [sp, 12]
	mov	w0, 2147418112
	cmp	w1, w0
	bgt	.L4
	ldr	w1, [sp, 12]
	mov	w0, 9029
	movk	w0, 0x1, lsl 16
	cmp	w1, w0
	beq	.L5
	ldr	w1, [sp, 12]
	mov	w0, 9029
	movk	w0, 0x1, lsl 16
	cmp	w1, w0
	bgt	.L4
	ldr	w0, [sp, 12]
	cmp	w0, 65536
	beq	.L6
	ldr	w0, [sp, 12]
	cmp	w0, 65536
	bgt	.L4
	ldr	w1, [sp, 12]
	mov	w0, 65535
	cmp	w1, w0
	beq	.L7
	ldr	w1, [sp, 12]
	mov	w0, 65535
	cmp	w1, w0
	bgt	.L4
	ldr	w0, [sp, 12]
	cmp	w0, 4096
	beq	.L8
	ldr	w0, [sp, 12]
	cmp	w0, 4096
	bgt	.L4
	ldr	w0, [sp, 12]
	cmp	w0, 4095
	beq	.L9
	ldr	w0, [sp, 12]
	cmp	w0, 4095
	bgt	.L4
	ldr	w0, [sp, 12]
	cmp	w0, 0
	beq	.L10
	ldr	w0, [sp, 12]
	cmp	w0, 0
	bgt	.L4
	ldr	w0, [sp, 12]
	cmn	w0, #1
	beq	.L11
	ldr	w0, [sp, 12]
	cmp	w0, 0
	bge	.L4
	ldr	w0, [sp, 12]
	cmn	w0, #4096
	beq	.L12
	ldr	w0, [sp, 12]
	cmn	w0, #4096
	bgt	.L4
	ldr	w1, [sp, 12]
	mov	w0, -4097
	cmp	w1, w0
	beq	.L13
	ldr	w1, [sp, 12]
	mov	w0, -4097
	cmp	w1, w0
	bgt	.L4
	ldr	w1, [sp, 12]
	mov	w0, -2147483648
	cmp	w1, w0
	beq	.L14
	ldr	w0, [sp, 12]
	cmn	w0, #65536
	beq	.L15
	b	.L4
.L14:
	mov	w0, 1
	b	.L16
.L15:
	mov	w0, 2
	b	.L16
.L13:
	mov	w0, 3
	b	.L16
.L12:
	mov	w0, 4
	b	.L16
.L11:
	mov	w0, 5
	b	.L16
.L10:
	mov	w0, 6
	b	.L16
.L9:
	mov	w0, 7
	b	.L16
.L8:
	mov	w0, 8
	b	.L16
.L7:
	mov	w0, 9
	b	.L16
.L6:
	mov	w0, 10
	b	.L16
.L5:
	mov	w0, 11
	b	.L16
.L3:
	mov	w0, 12
	b	.L16
.L2:
	mov	w0, 13
	b	.L16
.L4:
	mov	w0, 0
.L16:
	add	sp, sp, 16
	ret
	.align	2
clustered:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	str	w1, [sp, 8]
	ldr	w0, [sp, 12]
	cmp	w0, 1048576
	beq	.L18
	ldr	w0, [sp, 12]
	cmp	w0, 1048576
	bgt	.L19
	ldr	w1, [sp, 12]
	mov	w0, 50003
	cmp	w1, w0
	beq	.L20
	ldr	w1, [sp, 12]
	mov	w0, 50003
	cmp	w1, w0
	bgt	.L19
	ldr	w1, [sp, 12]
	mov	w0, 50002
	cmp	w1, w0
	beq	.L21
	ldr	w1, [sp, 12]
	mov	w0, 50002
	cmp	w1, w0
	bgt	.L19
	ldr	w1, [sp, 12]
	mov	w0, 50001
	cmp	w1, w0
	beq	.L22
	ldr	w1, [sp, 12]
	mov	w0, 50001
	cmp	w1, w0
	bgt	.L19
	ldr	w1, [sp, 12]
	mov	w0, 50000
	cmp	w1, w0
	beq	.L23
	ldr	w1, [sp, 12]
	mov	w0, 50000
	cmp	w1, w0
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1007
	beq	.L24
	ldr	w0, [sp, 12]
	cmp	w0, 1007
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1006
	beq	.L25
	ldr	w0, [sp, 12]
	cmp	w0, 1006
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1005
	beq	.L26
	ldr	w0, [sp, 12]
	cmp	w0, 1005
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1004
	beq	.L27
	ldr	w0, [sp, 12]
	cmp	w0, 1004
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1003
	beq	.L28
	ldr	w0, [sp, 12]
	cmp	w0, 1003
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1002
	beq	.L29
	ldr	w0, [sp, 12]
	cmp	w0, 1002
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1001
	beq	.L30
	ldr	w0, [sp, 12]
	cmp	w0, 1001
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1000
	beq	.L31
	ldr	w0, [sp, 12]
	cmp	w0, 1000
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 8
	beq	.L32
	ldr	w0, [sp, 12]
	cmp	w0, 8
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 7
	beq	.L33
	ldr	w0, [sp, 12]
	cmp	w0, 7
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 6
	beq	.L34
	ldr	w0, [sp, 12]
	cmp	w0, 6
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 5
	beq	.L35
	ldr	w0, [sp, 12]
	cmp	w0, 5
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 4
	beq	.L36
	ldr	w0, [sp, 12]
	cmp	w0, 4
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 3
	beq	.L37
	ldr	w0, [sp, 12]
	cmp	w0, 3
	bgt	.L19
	ldr	w0, [sp, 12]
	cmp	w0, 1
	beq	.L38
	ldr	w0, [sp, 12]
	cmp	w0, 2
	beq	.L39
	b	.L19
.L38:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	add	w0, w0, 1
	b	.L40
.L39:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	add	w0, w0, 2
	b	.L40
.L37:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 3
	sub	w0, w0, w1
	add	w0, w0, 3
	b	.L40
.L36:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	add	w0, w0, 4
	b	.L40
.L35:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	add	w0, w0, 5
	b	.L40
.L34:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 4
	add	w0, w0, w1
	add	w0, w0, 6
	b	.L40
.L33:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 3
	add	w0, w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	add	w0, w0, 7
	b	.L40
.L32:
	ldr	w1, [sp, 8]
	mov	w0, 23
	mul	w0, w1, w0
	add	w0, w0, 8
	b	.L40
.L31:
	ldr	w0, [sp, 8]
	add	w0, w0, 50
	lsl	w0, w0, 1
	b	.L40
.L30:
	ldr	w0, [sp, 8]
	lsl	w0, w0, 2
	add	w0, w0, 101
	b	.L40
.L29:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	lsl	w0, w0, 1
	add	w0, w0, 102
	b	.L40
.L28:
	ldr	w0, [sp, 8]
	lsl	w0, w0, 3
	add	w0, w0, 103
	b	.L40
.L27:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 2
	add	w0, w0, w1
	lsl	w0, w0, 1
	add	w0, w0, 104
	b	.L40
.L26:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	lsl	w0, w0, 2
	add	w0, w0, 105
	b	.L40
.L25:
	ldr	w1, [sp, 8]
	mov	w0, 14
	mul	w0, w1, w0
	add	w0, w0, 106
	b	.L40
.L24:
	ldr	w0, [sp, 8]
	lsl	w0, w0, 4
	add	w0, w0, 107
	b	.L40
.L23:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 3
	add	w0, w0, w1
	add	w0, w0, 500
	b	.L40
.L22:
	ldr	w0, [sp, 8]
	lsl	w0, w0, 3
	add	w0, w0, 501
	b	.L40
.L21:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 3
	sub	w0, w0, w1
	add	w0, w0, 502
	b	.L40
.L20:
	ldr	w1, [sp, 8]
	mov	w0, w1
	lsl	w0, w0, 1
	add	w0, w0, w1
	lsl	w0, w0, 1
	add	w0, w0, 503
	b	.L40
.L18:
	ldr	w1, [sp, 8]
	mov	w0, 99
	mul	w0, w1, w0
	add	w0, w0, 999
	b	.L40
.L19:
	mov	w0, -1
.L40:
	add	sp, sp, 16
	ret
	.align	2
punct_kind:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 96
	beq	.L42
	ldr	w0, [sp, 12]
	cmp	w0, 96
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 94
	beq	.L44
	ldr	w0, [sp, 12]
	cmp	w0, 94
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 93
	beq	.L45
	ldr	w0, [sp, 12]
	cmp	w0, 93
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 91
	beq	.L45
	ldr	w0, [sp, 12]
	cmp	w0, 91
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 64
	beq	.L44
	ldr	w0, [sp, 12]
	cmp	w0, 64
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 62
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 60
	bge	.L44
	ldr	w0, [sp, 12]
	cmp	w0, 47
	beq	.L44
	ldr	w0, [sp, 12]
	cmp	w0, 47
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 45
	beq	.L44
	ldr	w0, [sp, 12]
	cmp	w0, 45
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 43
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 42
	bge	.L44
	ldr	w0, [sp, 12]
	cmp	w0, 41
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 40
	bge	.L45
	ldr	w0, [sp, 12]
	cmp	w0, 39
	beq	.L42
	ldr	w0, [sp, 12]
	cmp	w0, 39
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 38
	bgt	.L43
	ldr	w0, [sp, 12]
	cmp	w0, 37
	bge	.L44
	ldr	w0, [sp, 12]
	cmp	w0, 33
	beq	.L44
	ldr	w0, [sp, 12]
	cmp	w0, 34
	beq	.L42
	b	.L43
.L45:
	mov	w0, 1
	b	.L46
.L44:
	mov	w0, 2
	b	.L46
.L42:
	mov	w0, 3
	b	.L46
.L43:
	mov	w0, 0
.L46:
	add	sp, sp, 16
	ret
	.align	2
key64:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x0, [sp, 8]
	cmn	x0, #1
	beq	.L48
	ldr	x1, [sp, 8]
	mov	x0, 47806
	movk	x0, 0xcafe, lsl 16
	movk	x0, 0xbeef, lsl 32
	movk	x0, 0xdead, lsl 48
	cmp	x1, x0
	beq	.L49
	ldr	x1, [sp, 8]
	mov	x0, 47806
	movk	x0, 0xcafe, lsl 16
	movk	x0, 0xbeef, lsl 32
	movk	x0, 0xdead, lsl 48
	cmp	x1, x0
	bhi	.L50
	ldr	x1, [sp, 8]
	mov	x0, -9223372036854775808
	cmp	x1, x0
	beq	.L51
	ldr	x1, [sp, 8]
	mov	x0, -9223372036854775808
	cmp	x1, x0
	bhi	.L50
	ldr	x1, [sp, 8]
	mov	x0, 9223372036854775807
	cmp	x1, x0
	beq	.L52
	ldr	x1, [sp, 8]
	mov	x0, 9223372036854775807
	cmp	x1, x0
	bhi	.L50
	ldr	x1, [sp, 8]
	mov	x0, 1099511627776
	cmp	x1, x0
	beq	.L53
	ldr	x1, [sp, 8]
	mov	x0, 1099511627776
	cmp	x1, x0
	bhi	.L50
	ldr	x1, [sp, 8]
	mov	x0, 4294967296
	cmp	x1, x0
	beq	.L54
	ldr	x1, [sp, 8]
	mov	x0, 4294967296
	cmp	x1, x0
	bhi	.L50
	ldr	x0, [sp, 8]
	cmp	x0, 0
	beq	.L55
	ldr	x1, [sp, 8]
	mov	x0, 4294967295
	cmp	x1, x0
	beq	.L56
	b	.L50
.L55:
	mov	w0, 1
	b	.L57
.L56:
	mov	w0, 2
	b	.L57
.L54:
	mov	w0, 3
	b	.L57
.L53:
	mov	w0, 4
	b	.L57
.L52:
	mov	w0, 5
	b	.L57
.L51:
	mov	w0, 6
	b	.L57
.L49:
	mov	w0, 7
	b	.L57
.L48:
	mov	w0, 8
	b	.L57
.L50:
	mov	w0, 0
.L57:
	add	sp, sp, 16
	ret
	.align	2
skey64:
	sub	sp, sp, #16
	str	x0, [sp, 8]
	ldr	x1, [sp, 8]
	mov	x0, 9223372036854775807
	cmp	x1, x0
	beq	.L59
	ldr	x1, [sp, 8]
	mov	x0, 2147483648
	cmp	x1, x0
	beq	.L60
	ldr	x1, [sp, 8]
	mov	x0, 2147483648
	cmp	x1, x0
	bgt	.L61
	ldr	x0, [sp, 8]
	cmn	x0, #1
	beq	.L62
	ldr	x0, [sp, 8]
	cmp	x0, 0
	bge	.L61
	ldr	x0, [sp, 8]
	cmn	x0, #4096
	beq	.L63
	ldr	x0, [sp, 8]
	cmn	x0, #4096
	bgt	.L61
	ldr	x1, [sp, 8]
	mov	x0, -9223372036854775808
	cmp	x1, x0
	beq	.L64
	ldr	x1, [sp, 8]
	mov	x0, -4294967296
	cmp	x1, x0
	beq	.L65
	b	.L61
.L64:
	mov	w0, 1
	b	.L66
.L65:
	mov	w0, 2
	b	.L66
.L63:
	mov	w0, 3
	b	.L66
.L62:
	mov	w0, 4
	b	.L66
.L60:
	mov	w0, 5
	b	.L66
.L59:
	mov	w0, 6
	b	.L66
.L61:
	mov	w0, 0
.L66:
	add	sp, sp, 16
	ret
	.align	2
is_small_prime:
	sub	sp, sp, #16
	str	w0, [sp, 12]
	ldr	w0, [sp, 12]
	cmp	w0, 199
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 199
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 197
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 197
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 193
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 193
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 191
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 191
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 181
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 181
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 179
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 179
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 173
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 173
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 167
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 167
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 163
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 163
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 157
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 157
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 151
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 151
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 149
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 149
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 139
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 139
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 137
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 137
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 131
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 131
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 127
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 127
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 113
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 113
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 109
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 109
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 107
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 107
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 103
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 103
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 101
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 101
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 97
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 97
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 89
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 89
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 83
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 83
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 79
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 79
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 73
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 73
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 71
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 71
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 67
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 67
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 61
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 61
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 59
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 59
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 53
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 53
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 47
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 47
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 43
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 43
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 41
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 41
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 37
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 37
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 31
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 31
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 29
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 29
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 23
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 23
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 19
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 19
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 17
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 17
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 13
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 13
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 11
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 11
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 7
	beq	.L68
	ldr	w0, [sp, 12]
	cmp	w0, 7
	bgt	.L69
	ldr	w0, [sp, 12]
	cmp	w0, 3
	bgt	.L70
	ldr	w0, [sp, 12]
	cmp	w0, 2
	bge	.L68
	b	.L69
.L70:
	ldr	w0, [sp, 12]
	cmp	w0, 5
	bne	.L69
.L68:
	mov	w0, 1
	b	.L71
.L69:
	mov	w0, 0
.L71:
	add	sp, sp, 16
	ret
	.align	2
sc_kind:
	sub	sp, sp, #16
	strb	w0, [sp, 15]
	ldrsb	w0, [sp, 15]
	cmp	w0, 127
	beq	.L73
	cmp	w0, 127
	bgt	.L74
	cmp	w0, 100
	beq	.L75
	cmp	w0, 100
	bgt	.L74
	cmp	w0, 0
	beq	.L76
	cmp	w0, 0
	bgt	.L74
	cmn	w0, #1
	beq	.L77
	cmp	w0, 0
	bge	.L74
	cmn	w0, #128
	beq	.L78
	cmn	w0, #100
	beq	.L79
	b	.L74
.L78:
	mov	w0, 1
	b	.L80
.L79:
	mov	w0, 2
	b	.L80
.L77:
	mov	w0, 3
	b	.L80
.L76:
	mov	w0, 4
	b	.L80
.L75:
	mov	w0, 5
	b	.L80
.L73:
	mov	w0, 6
	b	.L80
.L74:
	mov	w0, 0
.L80:
	add	sp, sp, 16
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
	.string	"\n"
	.align	3
.LC5:
	.string	"punct: "
	.align	3
.LC6:
	.string	" %d %d %d\n"
	.align	3
.LC7:
	.string	"key64:"
	.align	3
.LC8:
	.string	" %d%d%d"
	.align	3
.LC9:
	.string	"skey64:"
	.align	3
.LC10:
	.string	"primes:"
	.align	3
.LC11:
	.string	" | %d\n"
	.align	3
.LC12:
	.string	"schar:"
	.align	3
.LC13:
	.string	" %d:%d"
	.text
	.align	2
	.global	main
main:
	stp	x29, x30, [sp, -80]!
	mov	x29, sp
	stp	x19, x20, [sp, 16]
	adrp	x0, vzero
	add	x0, x0, :lo12:vzero
	ldr	w0, [x0]
	str	w0, [sp, 60]
	str	wzr, [sp, 68]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	str	wzr, [sp, 76]
	b	.L82
.L88:
	mov	w0, -1
	str	w0, [sp, 72]
	b	.L83
.L87:
	adrp	x0, k32__3
	add	x0, x0, :lo12:k32__3
	ldrsw	x1, [sp, 76]
	ldr	x1, [x0, x1, lsl 3]
	ldrsw	x0, [sp, 72]
	add	x0, x1, x0
	str	x0, [sp, 40]
	ldr	x1, [sp, 40]
	mov	x0, -2147483648
	cmp	x1, x0
	blt	.L108
	ldr	x1, [sp, 40]
	mov	x0, 2147483647
	cmp	x1, x0
	bgt	.L108
	ldr	x0, [sp, 40]
	mov	w1, w0
	ldr	w0, [sp, 60]
	add	w0, w1, w0
	bl	sparse32
	str	w0, [sp, 36]
	ldr	w1, [sp, 68]
	mov	w0, w1
	lsl	w0, w0, 5
	sub	w1, w0, w1
	ldr	w0, [sp, 36]
	add	w0, w1, w0
	str	w0, [sp, 68]
	ldr	w1, [sp, 36]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	b	.L86
.L108:
	nop
.L86:
	ldr	w0, [sp, 72]
	add	w0, w0, 1
	str	w0, [sp, 72]
.L83:
	ldr	w0, [sp, 72]
	cmp	w0, 1
	ble	.L87
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L82:
	ldr	w0, [sp, 76]
	cmp	w0, 12
	ble	.L88
	ldr	w1, [sp, 68]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	bl	printf
	str	wzr, [sp, 76]
	b	.L89
.L90:
	adrp	x0, kc__2
	add	x0, x0, :lo12:kc__2
	ldrsw	x1, [sp, 76]
	ldr	w1, [x0, x1, lsl 2]
	ldr	w0, [sp, 60]
	add	w2, w1, w0
	ldr	w0, [sp, 76]
	add	w0, w0, 10
	mov	w1, w0
	mov	w0, w2
	bl	clustered
	mov	w1, w0
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L89:
	ldr	w0, [sp, 76]
	cmp	w0, 17
	ble	.L90
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	bl	printf
	mov	w0, 32
	str	w0, [sp, 76]
	b	.L91
.L92:
	ldr	w1, [sp, 76]
	ldr	w0, [sp, 60]
	add	w0, w1, w0
	bl	punct_kind
	add	w0, w0, 48
	bl	putchar
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L91:
	ldr	w0, [sp, 76]
	cmp	w0, 127
	ble	.L92
	ldr	w0, [sp, 60]
	sub	w0, w0, #1
	bl	punct_kind
	mov	w19, w0
	ldr	w0, [sp, 60]
	add	w0, w0, 289
	bl	punct_kind
	mov	w20, w0
	ldr	w0, [sp, 60]
	add	w0, w0, 128
	bl	punct_kind
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	str	wzr, [sp, 76]
	b	.L93
.L94:
	adrp	x0, k64__1
	add	x0, x0, :lo12:k64__1
	ldrsw	x1, [sp, 76]
	ldr	x1, [x0, x1, lsl 3]
	ldrsw	x0, [sp, 60]
	add	x0, x1, x0
	sub	x0, x0, #1
	bl	key64
	mov	w19, w0
	adrp	x0, k64__1
	add	x0, x0, :lo12:k64__1
	ldrsw	x1, [sp, 76]
	ldr	x1, [x0, x1, lsl 3]
	ldrsw	x0, [sp, 60]
	add	x0, x1, x0
	bl	key64
	mov	w20, w0
	adrp	x0, k64__1
	add	x0, x0, :lo12:k64__1
	ldrsw	x1, [sp, 76]
	ldr	x1, [x0, x1, lsl 3]
	ldrsw	x0, [sp, 60]
	add	x0, x1, x0
	add	x0, x0, 1
	bl	key64
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L93:
	ldr	w0, [sp, 76]
	cmp	w0, 10
	ble	.L94
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	str	wzr, [sp, 76]
	b	.L95
.L100:
	adrp	x0, s64__0
	add	x0, x0, :lo12:s64__0
	ldrsw	x1, [sp, 76]
	ldr	x1, [x0, x1, lsl 3]
	ldrsw	x0, [sp, 60]
	add	x0, x1, x0
	str	x0, [sp, 48]
	ldr	x1, [sp, 48]
	mov	x0, -9223372036854775808
	cmp	x1, x0
	beq	.L96
	ldr	x0, [sp, 48]
	sub	x0, x0, #1
	bl	skey64
	mov	w19, w0
	b	.L97
.L96:
	mov	w19, 9
.L97:
	ldr	x0, [sp, 48]
	bl	skey64
	mov	w20, w0
	ldr	x1, [sp, 48]
	mov	x0, 9223372036854775807
	cmp	x1, x0
	beq	.L98
	ldr	x0, [sp, 48]
	add	x0, x0, 1
	bl	skey64
	b	.L99
.L98:
	mov	w0, 9
.L99:
	mov	w3, w0
	mov	w2, w20
	mov	w1, w19
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	bl	printf
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L95:
	ldr	w0, [sp, 76]
	cmp	w0, 7
	ble	.L100
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	str	wzr, [sp, 64]
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	mov	w0, -3
	str	w0, [sp, 76]
	b	.L101
.L103:
	ldr	w1, [sp, 76]
	ldr	w0, [sp, 60]
	add	w0, w1, w0
	bl	is_small_prime
	cmp	w0, 0
	beq	.L102
	ldr	w0, [sp, 64]
	add	w0, w0, 1
	str	w0, [sp, 64]
	ldr	w0, [sp, 76]
	cmp	w0, 150
	ble	.L102
	ldr	w1, [sp, 76]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
.L102:
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L101:
	ldr	w0, [sp, 76]
	cmp	w0, 210
	ble	.L103
	ldr	w1, [sp, 64]
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	bl	printf
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	bl	printf
	str	wzr, [sp, 76]
	b	.L104
.L106:
	ldr	w0, [sp, 76]
	and	w1, w0, 255
	ldr	w0, [sp, 60]
	and	w0, w0, 255
	add	w0, w1, w0
	and	w0, w0, 255
	sxtb	w0, w0
	bl	sc_kind
	str	w0, [sp, 56]
	ldr	w0, [sp, 56]
	cmp	w0, 0
	beq	.L105
	ldr	w2, [sp, 56]
	ldr	w1, [sp, 76]
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
.L105:
	ldr	w0, [sp, 76]
	add	w0, w0, 1
	str	w0, [sp, 76]
.L104:
	ldr	w0, [sp, 76]
	cmp	w0, 255
	ble	.L106
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	mov	w0, 0
	ldp	x19, x20, [sp, 16]
	ldp	x29, x30, [sp], 80
	ret
	.section .rodata
	.align	3
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
	.align	3
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
	.align	3
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
	.align	3
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
	.balign 4
vzero:
	.skip 4
