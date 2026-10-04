	.text
	.data
	.align	3
vinf:
	.word	0
	.word	2146435072
	.align	3
vnan:
	.word	0
	.word	2146959360
	.align	3
vone:
	.word	0
	.word	1072693248
	.text
	.align	2
digits:
	sub	sp, sp, #256
	str	w0, [sp, 12]
	str	x1, [sp, 200]
	str	x2, [sp, 208]
	str	x3, [sp, 216]
	str	x4, [sp, 224]
	str	x5, [sp, 232]
	str	x6, [sp, 240]
	str	x7, [sp, 248]
	str	q0, [sp, 64]
	str	q1, [sp, 80]
	str	q2, [sp, 96]
	str	q3, [sp, 112]
	str	q4, [sp, 128]
	str	q5, [sp, 144]
	str	q6, [sp, 160]
	str	q7, [sp, 176]
	add	x0, sp, 256
	str	x0, [sp, 16]
	add	x0, sp, 256
	str	x0, [sp, 24]
	add	x0, sp, 192
	str	x0, [sp, 32]
	mov	w0, -56
	str	w0, [sp, 40]
	mov	w0, -128
	str	w0, [sp, 44]
	str	xzr, [sp, 56]
	str	wzr, [sp, 52]
	b	.L2
.L6:
	ldr	d30, [sp, 56]
	fmov	d31, 1.0e+1
	fmul	d30, d30, d31
	ldr	w1, [sp, 44]
	ldr	x0, [sp, 16]
	cmp	w1, 0
	blt	.L3
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L4
.L3:
	add	w2, w1, 16
	str	w2, [sp, 44]
	ldr	w2, [sp, 44]
	cmp	w2, 0
	ble	.L5
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L4
.L5:
	ldr	x2, [sp, 32]
	sxtw	x0, w1
	add	x0, x2, x0
.L4:
	ldr	d31, [x0]
	fadd	d31, d30, d31
	str	d31, [sp, 56]
	ldr	w0, [sp, 52]
	add	w0, w0, 1
	str	w0, [sp, 52]
.L2:
	ldr	w1, [sp, 52]
	ldr	w0, [sp, 12]
	cmp	w1, w0
	blt	.L6
	ldr	d31, [sp, 56]
	fmov	d0, d31
	add	sp, sp, 256
	ret
	.align	2
mixed:
	sub	sp, sp, #256
	str	x0, [sp, 8]
	str	x1, [sp, 200]
	str	x2, [sp, 208]
	str	x3, [sp, 216]
	str	x4, [sp, 224]
	str	x5, [sp, 232]
	str	x6, [sp, 240]
	str	x7, [sp, 248]
	str	q0, [sp, 64]
	str	q1, [sp, 80]
	str	q2, [sp, 96]
	str	q3, [sp, 112]
	str	q4, [sp, 128]
	str	q5, [sp, 144]
	str	q6, [sp, 160]
	str	q7, [sp, 176]
	add	x0, sp, 256
	str	x0, [sp, 16]
	add	x0, sp, 256
	str	x0, [sp, 24]
	add	x0, sp, 192
	str	x0, [sp, 32]
	mov	w0, -56
	str	w0, [sp, 40]
	mov	w0, -128
	str	w0, [sp, 44]
	str	xzr, [sp, 56]
	ldr	x0, [sp, 8]
	str	x0, [sp, 48]
	b	.L9
.L22:
	ldr	x0, [sp, 48]
	ldrb	w0, [x0]
	cmp	w0, 100
	bne	.L10
	ldr	d30, [sp, 56]
	fmov	d31, 3.0e+0
	fmul	d30, d30, d31
	ldr	w1, [sp, 44]
	ldr	x0, [sp, 16]
	cmp	w1, 0
	blt	.L11
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L12
.L11:
	add	w2, w1, 16
	str	w2, [sp, 44]
	ldr	w2, [sp, 44]
	cmp	w2, 0
	ble	.L13
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L12
.L13:
	ldr	x2, [sp, 32]
	sxtw	x0, w1
	add	x0, x2, x0
.L12:
	ldr	d31, [x0]
	fadd	d31, d30, d31
	str	d31, [sp, 56]
	b	.L14
.L10:
	ldr	x0, [sp, 48]
	ldrb	w0, [x0]
	cmp	w0, 105
	bne	.L15
	ldr	d30, [sp, 56]
	fmov	d31, 3.0e+0
	fmul	d30, d30, d31
	ldr	w1, [sp, 40]
	ldr	x0, [sp, 16]
	cmp	w1, 0
	blt	.L16
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L17
.L16:
	add	w2, w1, 8
	str	w2, [sp, 40]
	ldr	w2, [sp, 40]
	cmp	w2, 0
	ble	.L18
	add	x1, x0, 11
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L17
.L18:
	ldr	x2, [sp, 24]
	sxtw	x0, w1
	add	x0, x2, x0
.L17:
	ldr	w0, [x0]
	scvtf	d31, w0
	fsub	d31, d30, d31
	str	d31, [sp, 56]
	b	.L14
.L15:
	ldr	d30, [sp, 56]
	fmov	d31, 3.0e+0
	fmul	d30, d30, d31
	ldr	w1, [sp, 40]
	ldr	x0, [sp, 16]
	cmp	w1, 0
	blt	.L19
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L20
.L19:
	add	w2, w1, 8
	str	w2, [sp, 40]
	ldr	w2, [sp, 40]
	cmp	w2, 0
	ble	.L21
	add	x1, x0, 15
	and	x1, x1, -8
	str	x1, [sp, 16]
	b	.L20
.L21:
	ldr	x2, [sp, 24]
	sxtw	x0, w1
	add	x0, x2, x0
.L20:
	ldr	d31, [x0]
	scvtf	d29, d31
	fmov	d31, 7.0e+0
	fdiv	d31, d29, d31
	fadd	d31, d30, d31
	str	d31, [sp, 56]
.L14:
	ldr	x0, [sp, 48]
	add	x0, x0, 1
	str	x0, [sp, 48]
.L9:
	ldr	x0, [sp, 48]
	ldrb	w0, [x0]
	cmp	w0, 0
	bne	.L22
	ldr	d31, [sp, 56]
	fmov	d0, d31
	add	sp, sp, 256
	ret
	.section .rodata
	.align	3
.LC0:
	.string	"[%f] [%e] [%g] [%F] [%E] [%G]\n"
	.align	3
.LC1:
	.string	"[%8f] [%-8f] [%08f] [%+f] [% f] [%+08.3e] [%#g] [%-+9G]\n"
	.align	3
.LC2:
	.string	"[%f] [%e] [%g] [%+.0f] [% .1e] [%#.0f] [%#g] [%05.1f]\n"
	.align	3
.LC4:
	.string	"[%#.0f] [%#.0e] [%#g] [%#.3g] [%#G] [%#.0E]\n"
	.align	3
.LC6:
	.string	"[%#g] [%#.1g] [%#.10g] [%#.0f]\n"
	.align	3
.LC7:
	.string	"[%012.3e] [%012g] [%-12.3e] [%+012.2E] [%012G] [%012.4f]\n"
	.align	3
.LC9:
	.string	"[%+012.3e] [% 012g] [%012.3g] [%015e]\n"
	.align	3
.LC10:
	.string	"%.0f %.0f %.0f %.0f %.0f %.0f %.1f %.1f %.2f %.2f %.0e %.0e %.1e %.1g %.3g %.2f\n"
	.align	3
.LC13:
	.string	"%g %g %g %g %g %g %g %g %g\n"
	.align	3
.LC17:
	.string	"%.3f|%.20f|%.0f|%e|%.15e|%.30e\n"
	.align	3
.LC21:
	.string	"[%.*f] [%*.*e] [%-*g] [%.*f] [%*g]\n"
	.align	3
.LC24:
	.string	"%.10f %g %e %.9g\n"
	.align	3
.LC25:
	.string	"%d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %ld %.2f\n"
	.align	3
.LC26:
	.string	"digits %.17g %.17g\n"
	.align	3
.LC27:
	.string	"dldidldidldiddlidddl"
	.align	3
.LC29:
	.string	"mixed %.17g\n"
	.align	3
.LC30:
	.string	"%.6f"
	.align	3
.LC31:
	.string	"snprintf %d [%s]\n"
	.align	3
.LC33:
	.string	"%10.3e|%-10.2f|%+.4g"
	.align	3
.LC34:
	.string	"sprintf %d [%s]\n"
	.align	3
.LC37:
	.string	"[%'.2f] [%'g] [%'012.1f]\n"
	.text
	.align	2
	.global	main
main:
	sub	sp, sp, #288
	stp	x29, x30, [sp, 64]
	add	x29, sp, 64
	str	d15, [sp, 80]
	adrp	x0, vinf
	add	x0, x0, :lo12:vinf
	ldr	d31, [x0]
	str	d31, [sp, 264]
	adrp	x0, vnan
	add	x0, x0, :lo12:vnan
	ldr	d31, [x0]
	str	d31, [sp, 256]
	adrp	x0, vzero
	add	x0, x0, :lo12:vzero
	ldr	d31, [x0]
	fneg	d31, d31
	str	d31, [sp, 248]
	adrp	x0, vone
	add	x0, x0, :lo12:vone
	ldr	d31, [x0]
	str	d31, [sp, 240]
	ldr	d31, [sp, 264]
	str	d31, [sp, 184]
	ldr	d31, [sp, 264]
	fneg	d31, d31
	str	d31, [sp, 192]
	ldr	d31, [sp, 256]
	str	d31, [sp, 200]
	ldr	d31, [sp, 256]
	fneg	d31, d31
	str	d31, [sp, 208]
	str	wzr, [sp, 284]
	b	.L25
.L26:
	ldrsw	x0, [sp, 284]
	lsl	x0, x0, 3
	add	x1, sp, 184
	ldr	d31, [x1, x0]
	str	d31, [sp, 216]
	ldr	d5, [sp, 216]
	ldr	d4, [sp, 216]
	ldr	d3, [sp, 216]
	ldr	d2, [sp, 216]
	ldr	d1, [sp, 216]
	ldr	d0, [sp, 216]
	adrp	x0, .LC0
	add	x0, x0, :lo12:.LC0
	bl	printf
	ldr	d7, [sp, 216]
	ldr	d6, [sp, 216]
	ldr	d5, [sp, 216]
	ldr	d4, [sp, 216]
	ldr	d3, [sp, 216]
	ldr	d2, [sp, 216]
	ldr	d1, [sp, 216]
	ldr	d0, [sp, 216]
	adrp	x0, .LC1
	add	x0, x0, :lo12:.LC1
	bl	printf
	ldr	w0, [sp, 284]
	add	w0, w0, 1
	str	w0, [sp, 284]
.L25:
	ldr	w0, [sp, 284]
	cmp	w0, 3
	ble	.L26
	str	wzr, [sp, 280]
	b	.L27
.L30:
	ldr	w0, [sp, 280]
	cmp	w0, 0
	beq	.L28
	ldr	d31, [sp, 248]
	str	d31, [sp, 272]
	b	.L29
.L28:
	adrp	x0, vzero
	add	x0, x0, :lo12:vzero
	ldr	d31, [x0]
	str	d31, [sp, 272]
.L29:
	ldr	d7, [sp, 272]
	ldr	d6, [sp, 272]
	ldr	d5, [sp, 272]
	ldr	d4, [sp, 272]
	ldr	d3, [sp, 272]
	ldr	d2, [sp, 272]
	ldr	d1, [sp, 272]
	ldr	d0, [sp, 272]
	adrp	x0, .LC2
	add	x0, x0, :lo12:.LC2
	bl	printf
	ldr	w0, [sp, 280]
	add	w0, w0, 1
	str	w0, [sp, 280]
.L27:
	ldr	w0, [sp, 280]
	cmp	w0, 1
	ble	.L30
	ldr	d30, [sp, 240]
	fmov	d31, 3.0e+0
	fmul	d29, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 3.0e+0
	fmul	d28, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 3.0e+0
	fmul	d27, d30, d31
	ldr	d31, [sp, 240]
	mov	x0, 4636737291354636288
	fmov	d30, x0
	fmul	d26, d31, d30
	ldr	d30, [sp, 240]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	ldr	d31, [x0]
	fmul	d25, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 2.5e+0
	fmul	d31, d30, d31
	fmov	d5, d31
	fmov	d4, d25
	fmov	d3, d26
	fmov	d2, d27
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC4
	add	x0, x0, :lo12:.LC4
	bl	printf
	ldr	d30, [sp, 240]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	ldr	d31, [x0]
	fmul	d29, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 5.0e-1
	fmul	d28, d30, d31
	fmov	d31, 3.0e+0
	ldr	d30, [sp, 240]
	fdiv	d27, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 5.0e-1
	fmul	d31, d30, d31
	fmov	d3, d31
	fmov	d2, d27
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC6
	add	x0, x0, :lo12:.LC6
	bl	printf
	ldr	d30, [sp, 240]
	fmov	d31, -1.5e+0
	fmul	d31, d30, d31
	str	d31, [sp, 232]
	ldr	d5, [sp, 232]
	ldr	d4, [sp, 232]
	ldr	d3, [sp, 232]
	ldr	d2, [sp, 232]
	ldr	d1, [sp, 232]
	ldr	d0, [sp, 232]
	adrp	x0, .LC7
	add	x0, x0, :lo12:.LC7
	bl	printf
	ldr	d31, [sp, 232]
	fneg	d29, d31
	ldr	d31, [sp, 232]
	fneg	d28, d31
	ldr	d31, [sp, 240]
	mov	x0, 235875308929024
	movk	x0, 0x4132, lsl 48
	fmov	d30, x0
	fmul	d27, d31, d30
	ldr	d30, [sp, 240]
	adrp	x0, .LC8
	add	x0, x0, :lo12:.LC8
	ldr	d31, [x0]
	fmul	d31, d30, d31
	fmov	d3, d31
	fmov	d2, d27
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC9
	add	x0, x0, :lo12:.LC9
	bl	printf
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	ldr	d31, [x0]
	str	d31, [sp, 56]
	adrp	x0, .LC12
	add	x0, x0, :lo12:.LC12
	ldr	d31, [x0]
	str	d31, [sp, 48]
	fmov	d31, 2.5e-1
	str	d31, [sp, 40]
	fmov	d31, 1.25e+0
	str	d31, [sp, 32]
	fmov	d31, 3.5e+0
	str	d31, [sp, 24]
	fmov	d31, 2.5e+0
	str	d31, [sp, 16]
	fmov	d31, 3.75e-1
	str	d31, [sp, 8]
	fmov	d31, 1.25e-1
	str	d31, [sp]
	mov	x0, 7378697629483820646
	movk	x0, 0x3fd6, lsl 48
	fmov	d7, x0
	fmov	d6, 2.5e-1
	fmov	d5, -2.5e+0
	fmov	d4, -5.0e-1
	fmov	d3, 3.5e+0
	fmov	d2, 2.5e+0
	fmov	d1, 1.5e+0
	fmov	d0, 5.0e-1
	adrp	x0, .LC10
	add	x0, x0, :lo12:.LC10
	bl	printf
	adrp	x0, .LC14
	add	x0, x0, :lo12:.LC14
	ldr	d31, [x0]
	str	d31, [sp]
	mov	x0, 9218868437227405311
	fmov	d7, x0
	adrp	x0, .LC15
	add	x0, x0, :lo12:.LC15
	ldr	d6, [x0]
	adrp	x0, .LC5
	add	x0, x0, :lo12:.LC5
	ldr	d5, [x0]
	adrp	x0, .LC3
	add	x0, x0, :lo12:.LC3
	ldr	d4, [x0]
	adrp	x0, .LC16
	add	x0, x0, :lo12:.LC16
	ldr	d3, [x0]
	mov	x0, 145680995713024
	movk	x0, 0x412e, lsl 48
	fmov	d2, x0
	mov	x0, 145685290680320
	movk	x0, 0x412e, lsl 48
	fmov	d1, x0
	mov	x0, 116548232544256
	movk	x0, 0x40f8, lsl 48
	fmov	d0, x0
	adrp	x0, .LC13
	add	x0, x0, :lo12:.LC13
	bl	printf
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	ldr	d5, [x0]
	mov	x0, 1
	fmov	d4, x0
	mov	x0, 2024
	fmov	d3, x0
	adrp	x0, .LC19
	add	x0, x0, :lo12:.LC19
	ldr	d2, [x0]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	ldr	d1, [x0]
	adrp	x0, .LC20
	add	x0, x0, :lo12:.LC20
	ldr	d0, [x0]
	adrp	x0, .LC17
	add	x0, x0, :lo12:.LC17
	bl	printf
	fmov	d4, 2.5e-1
	mov	w6, -8
	fmov	d3, 2.5e+0
	mov	w5, -1
	fmov	d2, 1.5e+0
	mov	w4, 10
	adrp	x0, .LC22
	add	x0, x0, :lo12:.LC22
	ldr	d1, [x0]
	mov	w3, 2
	mov	w2, 12
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	ldr	d0, [x0]
	mov	w1, 3
	adrp	x0, .LC21
	add	x0, x0, :lo12:.LC21
	bl	printf
	ldr	d30, [sp, 240]
	adrp	x0, .LC18
	add	x0, x0, :lo12:.LC18
	ldr	d31, [x0]
	fmul	d31, d30, d31
	fcvt	s31, d31
	str	s31, [sp, 228]
	ldr	s31, [sp, 228]
	fcvt	d29, s31
	ldr	s31, [sp, 228]
	fcvt	d28, s31
	ldr	s31, [sp, 228]
	fcvt	d27, s31
	ldr	s30, [sp, 228]
	fmov	s31, 3.0e+0
	fmul	s31, s30, s31
	fcvt	d31, s31
	fmov	d3, d31
	fmov	d2, d27
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC24
	add	x0, x0, :lo12:.LC24
	bl	printf
	ldr	d30, [sp, 240]
	fmov	d31, 1.5e+0
	fmul	d29, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 2.5e+0
	fmul	d28, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 3.5e+0
	fmul	d27, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 4.5e+0
	fmul	d26, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 5.5e+0
	fmul	d25, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 6.5e+0
	fmul	d24, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 7.5e+0
	fmul	d23, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 8.5e+0
	fmul	d22, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 9.5e+0
	fmul	d21, d30, d31
	ldr	d30, [sp, 240]
	fmov	d31, 1.05e+1
	fmul	d20, d30, d31
	ldr	d31, [sp, 240]
	mov	x0, 140737488355328
	movk	x0, 0x4026, lsl 48
	fmov	d30, x0
	fmul	d31, d31, d30
	str	d31, [sp, 48]
	mov	x0, 11
	str	x0, [sp, 40]
	str	d20, [sp, 32]
	mov	w0, 10
	str	w0, [sp, 24]
	str	d21, [sp, 16]
	mov	w0, 9
	str	w0, [sp, 8]
	mov	w0, 8
	str	w0, [sp]
	fmov	d7, d22
	fmov	d6, d23
	mov	w7, 7
	fmov	d5, d24
	mov	w6, 6
	fmov	d4, d25
	mov	w5, 5
	fmov	d3, d26
	mov	w4, 4
	fmov	d2, d27
	mov	w3, 3
	fmov	d1, d28
	mov	w2, 2
	fmov	d0, d29
	mov	w1, 1
	adrp	x0, .LC25
	add	x0, x0, :lo12:.LC25
	bl	printf
	ldr	d30, [sp, 240]
	fmov	d31, 5.0e+0
	fmul	d31, d30, d31
	str	d31, [sp, 16]
	str	xzr, [sp, 8]
	fmov	d31, 9.0e+0
	str	d31, [sp]
	fmov	d7, 8.0e+0
	fmov	d6, 7.0e+0
	fmov	d5, 6.0e+0
	fmov	d4, 5.0e+0
	fmov	d3, 4.0e+0
	fmov	d2, 3.0e+0
	fmov	d1, 2.0e+0
	fmov	d0, 1.0e+0
	mov	w0, 11
	bl	digits
	fmov	d15, d0
	ldr	d31, [sp, 240]
	fcvt	s30, d31
	fmov	s31, 5.0e-1
	fmul	s31, s30, s31
	fcvt	d31, s31
	fmov	d2, -3.0e+0
	fmov	d1, 2.25e+0
	fmov	d0, d31
	mov	w0, 3
	bl	digits
	fmov	d31, d0
	fmov	d1, d31
	fmov	d0, d15
	adrp	x0, .LC26
	add	x0, x0, :lo12:.LC26
	bl	printf
	ldr	d30, [sp, 240]
	fmov	d31, 5.0e-1
	fmul	d30, d30, d31
	ldr	d31, [sp, 240]
	fadd	d31, d31, d31
	mov	x0, 140737488355327
	str	x0, [sp, 32]
	str	d31, [sp, 24]
	fmov	d31, -1.5e+0
	str	d31, [sp, 16]
	fmov	d31, 3.0e+0
	str	d31, [sp, 8]
	mov	w0, 8
	str	w0, [sp]
	mov	x7, -21
	fmov	d7, 6.5e+0
	fmov	d6, 1.25e-1
	mov	w6, 100
	adrp	x0, .LC28
	add	x0, x0, :lo12:.LC28
	ldr	d5, [x0]
	mov	x5, 14
	fmov	d4, 4.0e+0
	mov	w4, -9
	fmov	d3, -7.5e-1
	mov	x3, 15360
	movk	x3, 0x4c53, lsl 16
	movk	x3, 0x10, lsl 32
	fmov	d2, 2.5e+0
	mov	w2, 3
	fmov	d1, 1.25e+0
	mov	x1, 7
	fmov	d0, d30
	adrp	x0, .LC27
	add	x0, x0, :lo12:.LC27
	bl	mixed
	fmov	d31, d0
	fmov	d0, d31
	adrp	x0, .LC29
	add	x0, x0, :lo12:.LC29
	bl	printf
	mov	w0, 8
	str	w0, [sp, 108]
	ldr	w0, [sp, 108]
	sxtw	x1, w0
	ldr	d30, [sp, 240]
	adrp	x0, .LC23
	add	x0, x0, :lo12:.LC23
	ldr	d31, [x0]
	fmul	d31, d30, d31
	add	x3, sp, 176
	fmov	d0, d31
	adrp	x0, .LC30
	add	x2, x0, :lo12:.LC30
	mov	x0, x3
	bl	snprintf
	str	w0, [sp, 224]
	add	x0, sp, 176
	mov	x2, x0
	ldr	w1, [sp, 224]
	adrp	x0, .LC31
	add	x0, x0, :lo12:.LC31
	bl	printf
	ldr	d30, [sp, 240]
	adrp	x0, .LC32
	add	x0, x0, :lo12:.LC32
	ldr	d31, [x0]
	fmul	d29, d30, d31
	fmov	d31, 7.0e+0
	ldr	d30, [sp, 240]
	fdiv	d31, d30, d31
	add	x2, sp, 112
	fmov	d2, d31
	adrp	x0, .LC11
	add	x0, x0, :lo12:.LC11
	ldr	d1, [x0]
	fmov	d0, d29
	adrp	x0, .LC33
	add	x1, x0, :lo12:.LC33
	mov	x0, x2
	bl	sprintf
	str	w0, [sp, 224]
	add	x0, sp, 112
	mov	x2, x0
	ldr	w1, [sp, 224]
	adrp	x0, .LC34
	add	x0, x0, :lo12:.LC34
	bl	printf
	ldr	d30, [sp, 240]
	adrp	x0, .LC35
	add	x0, x0, :lo12:.LC35
	ldr	d31, [x0]
	fmul	d29, d30, d31
	ldr	d31, [sp, 240]
	mov	x0, 235875308929024
	movk	x0, 0x4132, lsl 48
	fmov	d30, x0
	fmul	d28, d31, d30
	ldr	d30, [sp, 240]
	adrp	x0, .LC36
	add	x0, x0, :lo12:.LC36
	ldr	d31, [x0]
	fmul	d31, d30, d31
	fmov	d2, d31
	fmov	d1, d28
	fmov	d0, d29
	adrp	x0, .LC37
	add	x0, x0, :lo12:.LC37
	bl	printf
	mov	w0, 0
	ldr	d15, [sp, 80]
	ldp	x29, x30, [sp, 64]
	add	sp, sp, 288
	ret
	.section .rodata
	.align	3
.LC3:
	.word	-1998362383
	.word	1055193269
	.align	3
.LC5:
	.word	1409286144
	.word	1100836660
	.align	3
.LC8:
	.word	-900217577
	.word	1155522949
	.align	3
.LC11:
	.word	1202590843
	.word	1064598241
	.align	3
.LC12:
	.word	1236950581
	.word	1072693772
	.align	3
.LC14:
	.word	-719404213
	.word	1058682594
	.align	3
.LC15:
	.word	-1955535317
	.word	4712
	.align	3
.LC16:
	.word	-350469331
	.word	1058682594
	.align	3
.LC18:
	.word	-1717986918
	.word	1069128089
	.align	3
.LC19:
	.word	-941536522
	.word	1152724226
	.align	3
.LC20:
	.word	105764242
	.word	1149300943
	.align	3
.LC22:
	.word	279499617
	.word	1155522207
	.align	3
.LC23:
	.word	1405670641
	.word	1074340347
	.align	3
.LC28:
	.word	536870912
	.word	1107468383
	.align	3
.LC32:
	.word	-927712936
	.word	-1060627242
	.align	3
.LC35:
	.word	-468151435
	.word	1093850759
	.align	3
.LC36:
	.word	515396076
	.word	-1060943291


	.bss
	.balign 8
vzero:
	.skip 8
