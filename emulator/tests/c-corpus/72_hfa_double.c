/* Tries to break: double HFAs in d0-d7 and back in d0-d3, nested HFAs, and near-miss structs that are not HFAs and travel in x registers or through x8. */
/* HFA (homogeneous floating-point aggregate): one to four floats, or one to four doubles, travelling in v registers. */
#include <stdio.h>

struct d2 { double re, im; };
struct d4 { double w, x, y, z; };        /* a quaternion: the largest HFA */
struct d3n { struct d2 pos; double t; }; /* nested, three doubles: still an HFA */
struct da { double v[3]; };              /* array member, three doubles: an HFA */
struct dm { double d; float f; };        /* mixed widths: not an HFA, so x0 and x1 */
struct d5 { double v[5]; };              /* five members: not an HFA, so memory and x8 */
struct dl { double d; long l; };         /* 16 bytes of mixed class: x0 and x1 */

struct d4 qmul(struct d4 a, struct d4 b) {
    struct d4 r = {
        a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
        a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    };
    return r;
}

struct d4 qconj(struct d4 q) {
    struct d4 r = { q.w, -q.x, -q.y, -q.z };
    return r;
}

struct d2 sq_add(struct d2 z, struct d2 c) {
    struct d2 r = { z.re * z.re - z.im * z.im + c.re, 2 * z.re * z.im + c.im };
    return r;
}

int escape(struct d2 c, int limit) {
    struct d2 z = { 0, 0 };
    for (int i = 0; i < limit; i++) {
        z = sq_add(z, c);
        if (z.re * z.re + z.im * z.im > 4.0) return i;
    }
    return limit;
}

/* s in d0-d2, vel in d3-d4, dt in d5. */
struct d3n advance(struct d3n s, struct d2 vel, double dt) {
    s.pos.re += vel.re * dt;
    s.pos.im += vel.im * dt;
    s.t += dt;
    return s;
}

double dot3(struct da a, struct da b) {
    return a.v[0] * b.v[0] + a.v[1] * b.v[1] + a.v[2] * b.v[2];
}

struct dm dmix(struct dm m) {
    struct dm r = { m.d * 2 + m.f, (float)(m.d - m.f) };
    return r;
}

struct d5 d5scale(struct d5 v, double k) {
    for (int i = 0; i < 5; i++) v.v[i] = v.v[i] * k + i;
    return v;
}

struct dl dlmake(double d, long l) {
    struct dl r = { d * (double)l, (long)(d * 4) + l };
    return r;
}

/* a in d0-d3, b in d4-d5; c needs four and two are left, so c and tail go on the stack. */
double overflow(struct d4 a, struct d2 b, struct d4 c, double tail) {
    return a.w + a.x + a.y + a.z + 10 * (b.re + b.im) + 100 * (c.w + c.x + c.y + c.z) + 1000 * tail;
}

struct d2 third(double x) {
    struct d2 r = { x / 3, -x / 7 };
    return r;
}

void pq(const char *tag, struct d4 q) {
    printf("%s %.4f %.4f %.4f %.4f\n", tag, q.w, q.x, q.y, q.z);
}

volatile double knob = 0.25;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    double k = knob;
    struct d4 q = { 1, 2, -3, k }, step = { 0.5, 0.5, 0.5, 0.5 };
    for (int i = 0; i < 7; i++) {
        q = qmul(q, step);
        pq("q", q);
    }
    struct d4 n = qmul(q, qconj(q));
    pq("norm", n);

    for (int row = 0; row < 3; row++) {
        char line[16];
        for (int col = 0; col < 12; col++) {
            struct d2 c = { -2.0 + col * 0.25, 1.0 - row * 0.5 };
            int e = escape(c, 30);
            line[col] = (char)(e >= 30 ? '#' : 'a' + e % 26);
        }
        line[12] = 0;
        printf("set %s\n", line);
    }

    struct d3n s = { { 0, 0 }, 0 };
    struct d2 vel = { 3, -1.5 };
    for (int i = 0; i < 4; i++) {
        s = advance(s, vel, k * (i + 1));
        printf("advance %.4f %.4f %.4f\n", s.pos.re, s.pos.im, s.t);
    }

    struct da a = {{ 1.5, -2, 0.125 }}, b = {{ 4, 0.5, -8 }};
    printf("dot3 %.6f %.6f\n", dot3(a, b), dot3(b, b));

    struct dm m = { 1.25, -0.5f };
    for (int i = 0; i < 3; i++) {
        m = dmix(m);
        printf("dmix %.4f %.4f\n", m.d, m.f);
    }

    struct d5 v = {{ 1, -1, 0.5, 8, -0.25 }};
    v = d5scale(d5scale(v, k), -2);
    printf("d5 %.4f %.4f %.4f %.4f %.4f\n", v.v[0], v.v[1], v.v[2], v.v[3], v.v[4]);

    struct dl dl = dlmake(-2.75, 6);
    printf("dl %.4f %ld\n", dl.d, dl.l);

    printf("overflow %.4f\n", overflow(step, vel, q, -k));

    struct d2 t = third(k);
    printf("third %.17g %.17g\n", t.re, t.im);
    printf("sizes %d %d %d %d\n", (int)sizeof(struct d3n), (int)sizeof(struct dm),
           (int)sizeof(struct d5), (int)sizeof(struct dl));
    return 0;
}
