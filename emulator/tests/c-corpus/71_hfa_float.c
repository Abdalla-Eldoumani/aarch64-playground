/* Tries to break: float HFAs of 2 to 4 members in s0-s7 and back in s0-s3, and the rule that sends a whole HFA, and every float after it, to the stack once v0-v7 cannot hold it. */
/* HFA (homogeneous floating-point aggregate): one to four floats, or one to four doubles, travelling in v registers. */
#include <stdio.h>

struct f2 { float x, y; };
struct f3 { float x, y, z; };
struct f4 { float v[4]; };
struct fn { struct f2 p; float w; };  /* nested, still three floats: an HFA */
struct f5 { float v[5]; };            /* five floats: not an HFA, so memory and x8 */
struct fi { float f; int i; };        /* mixed: the float's bits ride in x0 */

struct f2 cmul(struct f2 a, struct f2 b) {
    struct f2 r = { a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x };
    return r;
}

struct f3 cross(struct f3 a, struct f3 b) {
    struct f3 r = { a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x };
    return r;
}

/* a takes s0-s3 and b s4-s7, so the plain float k is passed on the stack. */
struct f4 axpy(struct f4 a, struct f4 b, float k) {
    struct f4 r;
    for (int i = 0; i < 4; i++) r.v[i] = a.v[i] * k + b.v[i];
    return r;
}

/* a and b fill s0-s5; c needs three and two are left, so c and tail go on the stack. */
float crowd(struct f3 a, struct f3 b, struct f3 c, float tail) {
    return a.x - a.y + a.z + 2 * (b.x - b.y + b.z) + 4 * (c.x - c.y + c.z) + 8 * tail;
}

/* a s0-s1, b s2-s5, c s6-s7; d and e find v0-v7 full. */
float crowd2(struct f2 a, struct f4 b, struct f2 c, float d, struct f2 e) {
    return a.x + a.y * 2 + (b.v[0] - b.v[3]) * 4 + (c.x - c.y) * 8 + d * 16 + (e.x + e.y) * 32;
}

/* Integers and floats are counted apart: n and m still land in x0 and x1. */
struct f4 blend(int n, struct f4 a, double w, struct f2 b, long m) {
    struct f4 r;
    for (int i = 0; i < 4; i++) r.v[i] = a.v[i] * (float)w + ((i & 1) ? b.y : b.x) * (float)(n - m);
    return r;
}

struct fn shift(struct fn s, float d) {
    s.p.x += d;
    s.p.y -= d;
    s.w *= -d;
    return s;
}

struct f5 twist(struct f5 s) {
    struct f5 r;
    for (int i = 0; i < 5; i++) r.v[i] = s.v[4 - i] - s.v[i] * 0.5f;
    return r;
}

struct fi fimix(struct fi s) {
    struct fi r = { s.f * (float)s.i, s.i - (int)s.f };
    return r;
}

void pf(const char *tag, const float *v, int n) {
    printf("%s", tag);
    for (int i = 0; i < n; i++) printf(" %.4f", v[i]);
    printf("\n");
}

void pf3(const char *tag, struct f3 v) {
    printf("%s %.4f %.4f %.4f\n", tag, v.x, v.y, v.z);
}

volatile float knob = 0.5f;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    float k = knob;
    struct f2 z = { 1.5f, -0.25f }, w = { k, 2.0f };
    for (int i = 0; i < 4; i++) {
        z = cmul(z, w);
        printf("cmul %d: %.6f %.6f\n", i, z.x, z.y);
    }
    struct f2 nz = cmul((struct f2){ -0.0f, 0.0f }, (struct f2){ 1.0f, 0.0f });
    printf("signed zeros %.1f %.1f\n", nz.x, nz.y);
    struct f2 tie = cmul((struct f2){ 0.125f, 0.5f }, (struct f2){ k * 0.5f, 0.0f });
    printf("ties %.4f %.2f\n", tie.x, tie.y);  /* exact halfway values: printf rounds them to even */

    struct f3 a = { 1, 2, 3 }, b = { -2, k, 4 };
    struct f3 c = cross(a, b);
    pf3("cross", c);
    c = cross(c, cross(a, c));
    pf3("cross2", c);

    struct f4 acc = {{ 0, 0, 0, 0 }};
    struct f4 rows[3] = {{{ 1, 2, 3, 4 }}, {{ -0.25f, 0.75f, 8, -16 }}, {{ 100, 0.125f, -3, 5 }}};
    for (int i = 0; i < 6; i++) {
        acc = axpy(acc, rows[i % 3], i & 1 ? k : -k);
        pf("axpy", acc.v, 4);
    }

    printf("crowd %.4f\n", crowd(a, b, c, k));
    printf("crowd2 %.4f\n", crowd2(z, acc, w, -k, (struct f2){ 3, 5 }));

    struct f4 bl = blend(7, rows[1], 1.5, w, -2L);
    pf("blend", bl.v, 4);

    struct fn s = { { 1, 2 }, 3 };
    for (int i = 0; i < 3; i++) {
        s = shift(s, k * (float)(i + 1));
        printf("shift %.4f %.4f %.4f\n", s.p.x, s.p.y, s.w);
    }

    struct f5 v5 = {{ 1, 2, 4, 8, 16 }};
    v5 = twist(twist(v5));
    pf("twist", v5.v, 5);

    struct fi m = { 2.5f, 3 };
    for (int i = 0; i < 3; i++) {
        m = fimix(m);
        printf("fimix %.4f %d\n", m.f, m.i);
    }
    printf("sizes %d %d %d %d\n", (int)sizeof(struct f3), (int)sizeof(struct fn),
           (int)sizeof(struct f5), (int)sizeof(struct fi));
    return 0;
}
