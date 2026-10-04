/* Tries to break floats inside structs across calls: float aggregates in s and d registers, the shapes that are not, stack spill when v0-v7 run out, and returns through x8. */
#include <stdio.h>
#include <stddef.h>

typedef struct { float x, y; } V2;             /* two floats: s0, s1 */
typedef struct { float x, y, z; } V3;          /* three floats: s0-s2 */
typedef struct { double a, b, c, d; } D4;      /* four doubles: d0-d3, 32 bytes, still in registers */
typedef struct { float v[5]; } F5;             /* five members: memory, passed by reference */
typedef struct { float f; int i; } FI;         /* mixed kinds: one x register */
typedef struct { float f; double d; } FD;      /* two float kinds: x0 and x1, not s/d */
typedef struct { V2 p; float w; } NV;          /* nested: still three floats in s0-s2 */
typedef struct { double lo, hi; long n; } R3;  /* 24 bytes, not all floats: returned through x8 */
typedef struct { unsigned tag : 3; float f; unsigned flag : 1; } BF;
typedef struct { float px, py, vx, vy; } P;    /* four floats: s0-s3 in, s0-s3 out */
typedef union { float f; unsigned u; unsigned char b[4]; } FU;

static V2 v2_add(V2 a, V2 b) { V2 r = {a.x + b.x, a.y + b.y}; return r; }
static V3 v3_cross(V3 a, V3 b)
{
    V3 r = {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x};
    return r;
}
static D4 d4_scale(D4 a, double k) { D4 r = {a.a * k, a.b * k, a.c * k, a.d * k}; return r; }
static F5 f5_rev(F5 a)
{
    F5 r;
    for (int i = 0; i < 5; i++)
        r.v[i] = a.v[4 - i] * 2.0f;
    return r;
}
static FI fi_mix(FI a, float k) { FI r = {a.f * k, a.i + (int)k}; return r; }
static FD fd_swap(FD a) { FD r = {(float)a.d, (double)a.f}; return r; }
static NV nv_norm(NV a)
{
    float s = a.p.x * a.p.x + a.p.y * a.p.y + a.w * a.w;
    NV r = {{a.p.x / s, a.p.y / s}, a.w / s};
    return r;
}
/* a and b fill d0-d7, so c finds no register and goes to the stack, and e after it. */
static double spill(D4 a, D4 b, V2 c, double e) { return a.a + b.d * 2.0 + c.x * c.y + e; }
/* p..t take d0-d4; u needs four and three remain, so it goes whole to the
   stack, and f follows it there instead of taking d5. */
static double no_backfill(double p, double q, double r, double s, double t, D4 u, double f)
{
    return p + q * 2 + r * 3 + s * 4 + t * 5 + u.a * 6 + u.b * 7 + u.c * 8 + u.d * 9 + f * 10;
}
static R3 range(const double *x, int n)
{
    R3 r = {x[0], x[0], n};
    for (int i = 1; i < n; i++) {
        if (x[i] < r.lo)
            r.lo = x[i];
        if (x[i] > r.hi)
            r.hi = x[i];
    }
    return r;
}
static float bf_sum(const BF *b, int n)
{
    float s = 0.0f;
    for (int i = 0; i < n; i++)
        s += b[i].flag ? b[i].f * (float)b[i].tag : -b[i].f;
    return s;
}
static P step(P p, float dt)
{
    p.px += p.vx * dt;
    p.py += p.vy * dt;
    p.vy -= 9.8f * dt;
    return p;
}

static volatile float seed[6] = {0.1f, -2.5f, 3.75f, 1e-3f, 12345.678f, -0.0f};

int main(void)
{
    V2 a = {seed[0], seed[1]}, b = {seed[2], seed[3]};
    V2 c = v2_add(a, b);
    printf("v2 %.9g %.9g\n", c.x, c.y);

    V3 u = {seed[0], seed[1], seed[2]}, w = {seed[3], seed[4], seed[5]};
    V3 x = v3_cross(u, w);
    printf("v3 %.9g %.9g %.9g\n", x.x, x.y, x.z);

    D4 d = {seed[0], seed[1], seed[2], seed[4]};
    D4 e = d4_scale(d, 1.0 / 3.0);
    printf("d4 %.17g %.17g %.17g %.17g\n", e.a, e.b, e.c, e.d);

    F5 f = {{seed[0], seed[1], seed[2], seed[3], seed[4]}};
    F5 g = f5_rev(f);
    printf("f5 %.9g %.9g %.9g %.9g %.9g\n", g.v[0], g.v[1], g.v[2], g.v[3], g.v[4]);

    FI fi = fi_mix((FI){seed[2], -7}, seed[1]);
    FD fd = fd_swap((FD){seed[4], 1.0 / 7.0});
    printf("fi %.9g %d fd %.9g %.17g\n", fi.f, fi.i, fd.f, fd.d);

    NV nv = nv_norm((NV){{seed[1], seed[2]}, seed[0]});
    printf("nv %.9g %.9g %.9g\n", nv.p.x, nv.p.y, nv.w);

    printf("spill %.17g\n", spill(d, e, a, 0.5));
    printf("backfill %.17g\n", no_backfill(1, 2, 3, 4, 5, d, seed[3]));

    double xs[7];
    for (int i = 0; i < 7; i++)
        xs[i] = seed[i % 6] * (i + 1) - 1.0;
    R3 r = range(xs, 7);
    printf("range %.17g %.17g %ld\n", r.lo, r.hi, r.n);

    BF bf[4] = {{5, seed[0], 1}, {3, seed[2], 0}, {7, seed[3], 1}, {1, seed[1], 1}};
    printf("bf %.9g size %zu %zu %zu %zu off %zu %zu\n", bf_sum(bf, 4), sizeof(BF), sizeof(FD),
           sizeof(R3), sizeof(F5), offsetof(FD, d), offsetof(NV, w));

    P ps[3] = {{0, 0, seed[2], seed[2]}, {1, 2, -seed[0], 0}, {seed[4], 0, 0, 20}};
    for (int t = 0; t < 10; t++)
        for (int i = 0; i < 3; i++)
            ps[i] = step(ps[i], 0.05f);
    for (int i = 0; i < 3; i++)
        printf("p%d %.9g %.9g %.9g %.9g\n", i, ps[i].px, ps[i].py, ps[i].vx, ps[i].vy);

    FU fu = {.f = seed[1]};
    printf("fu %08x %02x %02x %02x %02x\n", fu.u, fu.b[0], fu.b[1], fu.b[2], fu.b[3]);
    fu.u ^= 0x80000000u;
    printf("fu %.9g\n", fu.f);
    return 0;
}
