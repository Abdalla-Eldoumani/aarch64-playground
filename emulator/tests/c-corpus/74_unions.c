/* Tries to break: unions read through a different member than the one last written (float, double and integer views, little-endian byte order) and unions passed and returned by value. */
#include <stdio.h>

union fbits { float f; unsigned u; unsigned char b[4]; };
union dbits { double d; unsigned long u; unsigned w[2]; unsigned short h[4]; };
union fv { float f[2]; float g; };           /* float members only: travels in s0-s1 like two floats */
union any { long l; double d; char s[8]; };  /* 8 bytes of mixed class: x0 */
union wide { double d[2]; unsigned long u[2]; }; /* 16 bytes, not all floating point: x0 and x1 */
union odd { char c[5]; int i; };             /* 8 bytes: the size rounds up to the int's alignment */

enum kind { NUM, ADD, MUL, NEG };
struct node {                                /* 16 bytes: x0 and x1 */
    enum kind k;
    union { long n; struct { int l, r; } kids; int child; } u;
};

union dbits flipsign(union dbits x) {
    x.u ^= 1UL << 63;
    return x;
}

union fv fvswap(union fv v) {
    union fv r;
    r.f[0] = v.f[1] * 2;
    r.f[1] = v.f[0] - v.f[1];
    return r;
}

union wide widemix(union wide w) {
    union wide r;
    r.u[0] = w.u[1] ^ w.u[0];
    r.d[1] = w.d[0] * -2;
    return r;
}

union any shout(union any a) {
    for (int i = 0; i < 8 && a.s[i]; i++) a.s[i] = (char)(a.s[i] - 32);
    return a;
}

/* Valid for positive finite x: the next float up is the next bit pattern. */
float next_up(float x) {
    union fbits b = { .f = x };
    b.u += 1;
    return b.f;
}

struct node num(long v) { struct node n; n.k = NUM; n.u.n = v; return n; }
struct node op(enum kind k, int l, int r) { struct node n; n.k = k; n.u.kids.l = l; n.u.kids.r = r; return n; }

long eval(const struct node *t, int i) {
    switch (t[i].k) {
    case NUM: return t[i].u.n;
    case ADD: return eval(t, t[i].u.kids.l) + eval(t, t[i].u.kids.r);
    case MUL: return eval(t, t[i].u.kids.l) * eval(t, t[i].u.kids.r);
    case NEG: return -eval(t, t[i].u.child);  /* child shares its bytes with kids.l */
    }
    return 0;
}

volatile float knob = 1.0f;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    float one = knob;
    float fs[6] = { one, -1.5f, 0.15625f, 3e38f, 1e-40f, -0.0f };
    for (int i = 0; i < 6; i++) {
        union fbits b = { .f = fs[i] };
        printf("f %-12g %08x exp %3u man %06x bytes %02x %02x %02x %02x\n", b.f, b.u,
               (b.u >> 23) & 0xff, b.u & 0x7fffff, b.b[0], b.b[1], b.b[2], b.b[3]);
    }
    printf("next %.9g %.9g\n", next_up(one), next_up(next_up(one * 1024)));
    for (int e = -3; e <= 3; e++) {
        union fbits p;
        p.u = (unsigned)(127 + e) << 23;
        printf("%g%c", p.f, e == 3 ? '\n' : ' ');
    }
    union fbits tiny = { .u = 1 };
    printf("tiny %g\n", tiny.f);

    double ds[4] = { 0.1, 1.0, -0.0, one * 3.5 };
    for (int i = 0; i < 4; i++) {
        union dbits d = { .d = ds[i] };
        union dbits n = flipsign(d);
        printf("d %016lx lo %08x hi %08x h %04x %04x %04x %04x flip %.2f\n", d.u, d.w[0], d.w[1],
               d.h[0], d.h[1], d.h[2], d.h[3], n.d);
    }
    union dbits inf = { .u = 0x7ff0000000000000UL }, pi = { .u = 0x400921fb54442d18UL };
    printf("inf %f %f pi %.15f\n", inf.d, flipsign(inf).d, pi.d);

    union fv v = { { one * 3, -one / 4 } };
    for (int i = 0; i < 3; i++) {
        v = fvswap(v);
        printf("fv %.4f %.4f g %.4f\n", v.f[0], v.f[1], v.g);
    }

    union wide w = { { 2.0, -0.5 } };
    w = widemix(w);
    printf("wide %016lx %016lx %.3f\n", w.u[0], w.u[1], w.d[1]);

    union any a;
    a.l = 0x6f6c6c6568L;  /* the bytes of "hello", low byte first */
    union any b = shout(a);
    printf("any %s %s %lx\n", a.s, b.s, b.l);

    struct node t[8];
    t[0] = op(MUL, 1, 4);
    t[1] = op(ADD, 2, 3);
    t[2] = num(3);
    t[3] = num(4);
    t[4] = op(NEG, 5, 0);
    t[5] = op(ADD, 6, 7);
    t[6] = num(10);
    t[7] = num(-25L * (long)one);
    printf("eval %ld %ld %ld\n", eval(t, 0), eval(t, 5), eval(t, 4));

    printf("sizes %d %d %d %d %d %d\n", (int)sizeof(union fbits), (int)sizeof(union dbits),
           (int)sizeof(union fv), (int)sizeof(union wide), (int)sizeof(union odd),
           (int)sizeof(struct node));
    return 0;
}
