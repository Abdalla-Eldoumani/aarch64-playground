/* Tries to break NaN, signed-zero, and subnormal operands: which NaN an operation returns, when the default NaN appears, which zero comes back, and gradual underflow. */
#include <stdio.h>
#include <math.h>

typedef unsigned long u64;
static double d_of(u64 u) { union { u64 u; double d; } v; v.u = u; return v.d; }
static u64 bits(double d) { union { double d; u64 u; } v; v.d = d; return v.u; }
static unsigned fbits(float f) { union { float f; unsigned u; } v; v.f = f; return v.u; }

/* Inline asm fixes each instruction and its operand order: when both
   operands are NaN, the hardware's priority rule (signalling first, then
   first operand; the addend first for the multiply-adds) picks the answer. */
#define OP2(fn, ins) static double fn(double a, double b) \
    { double r; __asm__(ins " %d0, %d1, %d2" : "=w"(r) : "w"(a), "w"(b)); return r; }
OP2(add, "fadd") OP2(sub, "fsub") OP2(mul, "fmul") OP2(dvd, "fdiv") OP2(nmul, "fnmul")
OP2(max, "fmax") OP2(min, "fmin") OP2(maxnm, "fmaxnm") OP2(minnm, "fminnm")
#define OP3(fn, ins) static double fn(double n, double m, double a) \
    { double r; __asm__(ins " %d0, %d1, %d2, %d3" : "=w"(r) : "w"(n), "w"(m), "w"(a)); return r; }
OP3(madd, "fmadd") OP3(msub, "fmsub") OP3(nmadd, "fnmadd") OP3(nmsub, "fnmsub")
static double root(double a) { double r; __asm__("fsqrt %d0, %d1" : "=w"(r) : "w"(a)); return r; }

enum { QA, QB, SC, SD, PINF, NINF, PZ, NZ, ONE, TINY, NV };
static volatile u64 in[NV] = {
    0x7ff8000000000000, 0xfff8000000000001, 0x7ff0000000000005, 0xfff4000000000000,
    0x7ff0000000000000, 0xfff0000000000000, 0x0000000000000000, 0x8000000000000000,
    0x3ff0000000000000, 0x0000000000000001,
};
static const unsigned char fma_cases[][3] = {
    {QA, ONE, QB}, {SC, ONE, QB}, {ONE, QB, SC}, {QB, SD, QA}, {PINF, PZ, QB}, {PINF, PZ, ONE},
    {PINF, ONE, NINF}, {PINF, PZ, SC}, {PZ, ONE, NZ}, {NZ, ONE, PZ}, {NZ, ONE, NZ}, {TINY, TINY, NZ},
};

static double val(int k) { return d_of(in[k]); }

int main(void)
{
    puts("a b: add sub mul div nmul max min maxnm minnm");
    for (int i = 0; i < NV; i++)
        for (int j = 0; j < NV; j++) {
            double a = val(i), b = val(j);
            printf("%d%d %016lx %016lx %016lx %016lx %016lx %016lx %016lx %016lx %016lx\n", i, j,
                   bits(add(a, b)), bits(sub(a, b)), bits(mul(a, b)), bits(dvd(a, b)), bits(nmul(a, b)),
                   bits(max(a, b)), bits(min(a, b)), bits(maxnm(a, b)), bits(minnm(a, b)));
        }
    int nc = (int)(sizeof fma_cases / sizeof fma_cases[0]);
    for (int k = 0; k < nc; k++) {
        double n = val(fma_cases[k][0]), m = val(fma_cases[k][1]), a = val(fma_cases[k][2]);
        printf("fma%02d %016lx %016lx %016lx %016lx\n", k, bits(madd(n, m, a)),
               bits(msub(n, m, a)), bits(nmadd(n, m, a)), bits(nmsub(n, m, a)));
    }
    for (int i = 0; i < NV; i++) {
        double a = val(i);
        printf("un%d sqrt %016lx neg %016lx abs %016lx copysign %016lx %016lx\n", i, bits(root(a)),
               bits(-a), bits(__builtin_fabs(a)), bits(__builtin_copysign(a, -1.0)),
               bits(__builtin_copysign(1.0, a)));
    }

    /* The hosted libm: glibc on AArch64 answers a domain error with the
       default NaN, whose sign bit is clear. */
    double neg = -val(ONE), inf = val(PINF), qb = val(QB);
    printf("libm %016lx %016lx %016lx %016lx\n", bits(sqrt(neg)), bits(log(neg)),
           bits(log10(neg * 2.0)), bits(pow(neg * 8.0, 1.0 / 3.0)));
    printf("libm %016lx %016lx %016lx %016lx %016lx\n", bits(fmod(1.0, val(PZ))), bits(fmod(inf, 2.0)),
           bits(sin(inf)), bits(cos(-inf)), bits(tan(inf)));
    printf("libm %016lx %016lx %016lx %016lx %016lx\n", bits(log(val(PZ))), bits(log(val(NZ))),
           bits(sqrt(val(NZ))), bits(fabs(qb)), bits(floor(val(NZ))));

    /* Signed zeros from plain C arithmetic; volatile keeps each one live. */
    volatile double pz = 0.0, nz = -0.0, one = 1.0, five = 5.0, tiny = 0x1p-1074, big = 0x1p1023;
    double z[] = {
        pz + nz, nz + nz, nz - pz, pz - nz, one - one, nz * five, pz * -five, nz / -five,
        -pz, one / nz, tiny * -tiny, -tiny / big, nz - nz, (one - one) * -1.0,
    };
    for (int i = 0; i < (int)(sizeof z / sizeof z[0]); i++)
        printf("z%02d %016lx %g\n", i, bits(z[i]), z[i]);

    /* Gradual underflow: halving 2^-1022 reaches 2^-1074 after 52 steps
       and zero after 53, because 2^-1075 is a tie that rounds to even. */
    double h = 0x1p-1022 * one;
    int steps = 0;
    while (h != 0.0) {
        h = h * 0.5;
        steps++;
    }
    printf("halvings %d\n", steps);
    double s = 0.0;
    for (int i = 0; i < 1000; i++)
        s += 1e-320 * one;
    double dmin = 0x1p-1022 * one;
    double und[] = {
        s, tiny * 0.5, tiny * 1.5, tiny * 0.75, tiny * 2.5, (dmin / 3.0) * 3.0, dmin - tiny,
        (dmin - tiny) + tiny, one / big / 4.0, 1e-310 * 1e10, dmin * (1.0 - 0x1p-53), tiny * 0x1p1000 * 0x1p74,
        (dmin * 0.75) / 0.75, sqrt(tiny),
    };
    for (int i = 0; i < (int)(sizeof und / sizeof und[0]); i++)
        printf("s%02d %016lx %.17g %d\n", i, bits(und[i]), und[i], und[i] > 0.0);

    volatile float fmin = 0x1p-126f, ftiny = 0x1p-149f;
    float fs[] = {
        fmin * 0.5f, ftiny * 0.5f, ftiny * 1.5f, fmin - ftiny, (fmin / 3.0f) * 3.0f,
        ftiny * 0x1p126f, fmin * fmin, -ftiny * 0.25f,
    };
    for (int i = 0; i < (int)(sizeof fs / sizeof fs[0]); i++)
        printf("fs%d %08x %.9g\n", i, fbits(fs[i]), (double)fs[i]);
    return 0;
}
