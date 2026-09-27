/* Tries to break: one call mixing ints, doubles, small structs, HFAs and big structs until both register files spill, va_arg of struct types from the saved x and v registers and the stack, and struct returns through function pointers. */
/* HFA (homogeneous floating-point aggregate): one to four floats, or one to four doubles, travelling in v registers. */
#include <stdio.h>
#include <stdarg.h>

struct d2 { double re, im; };     /* HFA: two d registers */
struct f3 { float x, y, z; };     /* HFA: three s registers */
struct sm { int a, b, c; };       /* 12 bytes: two x registers */
struct big { long v[4]; };        /* 32 bytes: a pointer to a copy */

/* x registers: a x0, b x1, s x2-x3, g x4, d x5, s2 x6-x7; f and g2 go on the stack.
   v registers: h d0-d1, c d2, t s3-s5, h2 d6-d7; e and t2 go on the stack. */
double kitchen(int a, struct d2 h, long b, struct sm s, double c, struct big g,
               struct f3 t, int d, struct d2 h2, struct sm s2, double e,
               struct f3 t2, char f, struct big g2) {
    printf("k1 %d %g %g %ld %d %d %d %g\n", a, h.re, h.im, b, s.a, s.b, s.c, c);
    printf("k2 %ld %ld %ld %ld %g %g %g %d\n", g.v[0], g.v[1], g.v[2], g.v[3], t.x, t.y, t.z, d);
    printf("k3 %g %g %d %d %d %g\n", h2.re, h2.im, s2.a, s2.b, s2.c, e);
    printf("k4 %g %g %g %c %ld %ld %ld %ld\n", t2.x, t2.y, t2.z, f, g2.v[0], g2.v[1], g2.v[2], g2.v[3]);
    return a + h.re + b + s.c + c + g.v[3] + t.z + d + h2.im + s2.a + e + t2.y + f + g2.v[0];
}

/* Walks its arguments by a type string. */
double vmix(const char *types, ...) {
    va_list ap;
    va_start(ap, types);
    double acc = 0;
    printf("vmix %s:", types);
    for (const char *p = types; *p; p++) {
        switch (*p) {
        case 'i': { int v = va_arg(ap, int); acc = acc * 3 + v; printf(" %d", v); break; }
        case 'd': { double v = va_arg(ap, double); acc = acc * 3 + v; printf(" %g", v); break; }
        case 'h': { struct d2 v = va_arg(ap, struct d2); acc = acc * 3 + v.re - v.im; printf(" (%g,%g)", v.re, v.im); break; }
        case 'f': { struct f3 v = va_arg(ap, struct f3); acc = acc * 3 + v.x + v.y + v.z; printf(" <%g,%g,%g>", v.x, v.y, v.z); break; }
        case 's': { struct sm v = va_arg(ap, struct sm); acc = acc * 3 + v.a - v.c; printf(" [%d,%d,%d]", v.a, v.b, v.c); break; }
        case 'b': { struct big v = va_arg(ap, struct big); acc = acc * 3 + v.v[0] + v.v[3]; printf(" {%ld..%ld}", v.v[0], v.v[3]); break; }
        }
    }
    va_end(ap);
    printf(" = %.1f\n", acc);
    return acc;
}

struct big mkbig(long k) { struct big b = {{ k, k * k, -k, 100 - k }}; return b; }
struct big mkbig2(long k) { struct big b = {{ k + 1, k - 1, k * 3, 7 }}; return b; }
struct d2 rot90(struct d2 z) { struct d2 r = { -z.im, z.re }; return r; }
struct d2 conj2(struct d2 z) { struct d2 r = { z.re, -z.im }; return r; }

struct big (*makers[2])(long) = { mkbig, mkbig2 };
struct d2 (*turns[2])(struct d2) = { rot90, conj2 };

/* z to the n by squaring: every level returns its HFA in d0-d1 across a recursive call. */
struct d2 cpowi(struct d2 z, int n) {
    if (n == 0) return (struct d2){ 1, 0 };
    struct d2 h = cpowi(z, n / 2);
    struct d2 r = { h.re * h.re - h.im * h.im, 2 * h.re * h.im };
    if (n & 1) {
        struct d2 t = { r.re * z.re - r.im * z.im, r.re * z.im + r.im * z.re };
        r = t;
    }
    return r;
}

volatile int knob = 2;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    int k = knob;
    struct d2 h = { 1.5, -k }, h2 = { 0.25, 8 };
    struct sm s = { 1, -2, 3 }, s2 = { 100, 200, -300 };
    struct f3 t = { 0.5f, (float)k, -4 }, t2 = { 16, -0.125f, 2 };
    struct big g = mkbig(k), g2 = mkbig2(-k);
    double r = kitchen(k, h, 1L << 40, s, -7.5, g, t, -k, h2, s2, 9.75, t2, 'Z', g2);
    printf("kitchen %.4f\n", r);

    vmix("ihdfsb", k, h, 2.5, t, s, g);
    /* The three d2s fill v0-v5; the f3 needs three and finds two, so it and both doubles
       come from the stack. The three sm and the int fill x1-x7, so the big one's pointer does too. */
    vmix("hhhfddsssib", h, h2, h, t2, 1.25, -3.0, s, s2, s, 42, g2);
    /* Eight doubles fill v0-v7; the ninth, the f3 and the d2 all come from the stack. */
    vmix("dddddddddfh", 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, t, h2);

    struct d2 z = { 3, 4 };
    for (int i = 0; i < 4; i++) {
        struct big b = makers[i & 1](i + k);
        z = turns[(i >> 1) & 1](z);
        printf("fp %d: %ld %ld %ld %ld | %g %g\n", i, b.v[0], b.v[1], b.v[2], b.v[3], z.re, z.im);
    }

    struct d2 one_i = { 1, 1 };
    int ns[4] = { 0, 1, 10, 13 };
    for (int i = 0; i < 4; i++) {
        struct d2 p = cpowi(one_i, ns[i]);
        printf("(1+i)^%d = %g %g\n", ns[i], p.re, p.im);
    }
    return 0;
}
