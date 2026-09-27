/* Tries to break: structs of 1 to 16 bytes packed into x0/x1, unpacked again, and spilled to the stack once x0-x7 run out. */
#include <stdio.h>

#define BYTES(N) struct b##N { unsigned char v[N]; }
BYTES(1); BYTES(2); BYTES(3); BYTES(5); BYTES(7); BYTES(9); BYTES(12); BYTES(15); BYTES(16);

/* mixN takes its struct by value, rewrites every byte, and returns it by value. */
#define MIX(N)                                                \
    struct b##N mix##N(struct b##N x, int k) {                \
        for (int i = 0; i < N; i++)                           \
            x.v[i] = (unsigned char)(x.v[i] * 7 + i * k + N); \
        return x;                                             \
    }
MIX(1) MIX(2) MIX(3) MIX(5) MIX(7) MIX(9) MIX(12) MIX(15) MIX(16)

/* Mixed members with padding and signed halves: unpacking them must sign-extend. */
struct s6 { signed char a; short b; signed char c; };
struct s12 { int a, b, c; };
struct s16 { char tag; long val; };

struct s6 neg6(struct s6 s) {
    struct s6 r = { (signed char)(-s.a), (short)(s.b * -3), (signed char)(s.c / 2 - 50) };
    return r;
}

struct s12 rot12(struct s12 s) {
    struct s12 r = { s.b, s.c, s.a - s.b - s.c };
    return r;
}

struct s16 next16(struct s16 s) {
    struct s16 r = { (char)(s.tag + 1), s.val * -2 - 1 };
    return r;
}

/* x0-x6 hold the first five; the 15-byte struct needs two registers and finds
   only x7, so it goes on the stack, and so does the int after it. */
unsigned long spill(struct b3 a, struct b5 b, struct b7 c, struct b9 d,
                    struct b16 e, struct b15 f, int tail) {
    unsigned long h = (unsigned long)tail;
    for (int i = 0; i < 3; i++) h = h * 131 + a.v[i];
    for (int i = 0; i < 5; i++) h = h * 131 + b.v[i];
    for (int i = 0; i < 7; i++) h = h * 131 + c.v[i];
    for (int i = 0; i < 9; i++) h = h * 131 + d.v[i];
    for (int i = 0; i < 16; i++) h = h * 131 + e.v[i];
    for (int i = 0; i < 15; i++) h = h * 131 + f.v[i];
    return h;
}

void show(const char *tag, const unsigned char *p, int n) {
    unsigned sum = 0;
    printf("%-4s", tag);
    for (int i = 0; i < n; i++) {
        printf(" %02x", p[i]);
        sum = sum * 31u + p[i];
    }
    printf(" | %u\n", sum);
}

volatile int knob = 3;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    int k = knob;
    struct b1 a1 = {{0x80}};
    struct b2 a2 = {{0xff, 0x01}};
    struct b3 a3 = {{1, 2, 3}};
    struct b5 a5 = {{0xf0, 0xe1, 0xd2, 0xc3, 0xb4}};
    struct b7 a7;
    struct b9 a9;
    struct b12 a12;
    struct b15 a15;
    struct b16 a16;
    for (int i = 0; i < 16; i++) {
        unsigned char c = (unsigned char)(0x11 * i + 0x0f);
        if (i < 7) a7.v[i] = c;
        if (i < 9) a9.v[i] = (unsigned char)(c ^ 0x5a);
        if (i < 12) a12.v[i] = (unsigned char)(c + 0x80);
        if (i < 15) a15.v[i] = (unsigned char)~c;
        a16.v[i] = (unsigned char)(i * i);
    }

    a1 = mix1(a1, k);    show("b1", a1.v, 1);
    a2 = mix2(a2, k);    show("b2", a2.v, 2);
    a3 = mix3(a3, k);    show("b3", a3.v, 3);
    a5 = mix5(a5, k);    show("b5", a5.v, 5);
    a7 = mix7(a7, k);    show("b7", a7.v, 7);
    a9 = mix9(a9, k);    show("b9", a9.v, 9);
    a12 = mix12(a12, k); show("b12", a12.v, 12);
    a15 = mix15(a15, k); show("b15", a15.v, 15);
    a16 = mix16(mix16(a16, k), k + 1);
    show("b16", a16.v, 16);
    printf("direct %u %u\n", mix3(a3, 5).v[2], mix12(a12, -k).v[11]);

    unsigned long h = spill(mix3(a3, 1), a5, mix7(a7, 2), a9, a16, mix15(a15, 3), -k * 1000);
    printf("spill %lu %016lx\n", h, h);

    struct s6 s = { -100, 1000, 20 };
    for (int i = 0; i < 3; i++) {
        s = neg6(s);
        printf("s6 %d %d %d\n", s.a, s.b, s.c);
    }
    struct s12 t = { k, -7, 100000 };
    for (int i = 0; i < 4; i++) {
        t = rot12(t);
        printf("s12 %d %d %d\n", t.a, t.b, t.c);
    }
    struct s16 u = { 'a', 1000 };
    for (int i = 0; i < 3; i++) {
        u = next16(u);
        printf("s16 %c %ld\n", u.tag, u.val);
    }
    printf("sizes %d %d %d %d\n", (int)sizeof(struct b15), (int)sizeof(struct s6),
           (int)sizeof(struct s12), (int)sizeof(struct s16));
    return 0;
}
