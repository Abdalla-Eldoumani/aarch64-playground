/* Tries to break conversion into floating point: 64-bit integers into single precision with one rounding, ties, overflow, underflow into subnormals, and NaN payloads across widths. */
#include <stdio.h>

static unsigned fbits(float f) { union { float f; unsigned u; } v; v.f = f; return v.u; }
static unsigned long dbits(double d) { union { double d; unsigned long u; } v; v.d = d; return v.u; }
static float f_of(unsigned u) { union { unsigned u; float f; } v; v.u = u; return v.f; }
static double d_of(unsigned long u) { union { unsigned long u; double d; } v; v.u = u; return v.d; }

/* Rounding a 64-bit integer to double and then to single can create a
   tie the exact value never had. 2^60 + 2^36 + 1 rounds once to
   2^60 + 2^37, but twice to 2^60; 2^60 + 2^37 + 2^36 - 1 fails the
   other way. Every such pair is here in both signs. */
static volatile long sv[] = {
    0, -1, 16777217, 16777219, -16777217, 2147483647, -2147483647 - 1,
    9007199254740993, 9007199254740995, -9007199254740993,
    0x1000001000000001, -0x1000001000000001, 0x4000004000000001,
    0x1000002fffffffff, -0x1000002fffffffff, 0x7fffff8000000001,
    0x7fffffffffffffff, -0x7fffffffffffffff - 1,
};
static volatile unsigned long uv[] = {
    0xffffffffffffffff, 0x8000008000000001, 0xffffff7fffffffff,
    0x8000000000000401, 0x8000000000000400, 0x00000000ffffffff,
};
static volatile int si[] = {16777217, -16777219, 2147483647, -2147483647 - 1, 33554435};
static volatile unsigned ui[] = {0x80000080, 0x80000081, 0xffffff7f, 0xffffffff};

/* Division by a power of two after the conversion is the fixed-point
   form (SCVTF Sd, Xn, #16) at -O2; the answer must not change. */
static float q16f(long x) { return (float)x / 65536.0f; }
static double q32d(long x) { return (double)x / 4294967296.0; }
static float uq16f(unsigned long x) { return (float)x / 65536.0f; }

static volatile double nv[] = {
    0x1.000001p0, 0x1.0000010000001p0, 0x1.000003p0, 0.1, -0.0,
    0x1.fffffefffffffp127, 0x1.ffffffp127, 1e39, -1e39,
    0x1p-149, 0x1p-150, 0x1.0000000000001p-150, -0x1p-150, 0x1.8p-149,
    0x1.fffffcp-127, 0x1.fffffep-127, 1e-50, 0x1p-1074,
};
static volatile float wv[] = {0x1p-149f, 0x1.fffffcp-127f, 0x1.fffffep127f, -0x1p-126f, 0.1f, -0.0f};

/* A NaN converted between widths keeps its sign, gets its quiet bit set,
   and keeps the top of its payload. ISO C leaves the payload open; the
   FCVT the cast becomes decides it. */
static volatile unsigned long dnan[] = {
    0x7ff8000000000000, 0xfff8000000000001, 0x7ff0000000000005,
    0xfff4000000000000, 0x7ff0000020000000, 0x7fffffffffffffff,
};
static volatile unsigned fnan[] = {0x7fc00000, 0xffc00001, 0x7f800001, 0xffa00000, 0x7fbfffff};

int main(void)
{
    int n = (int)(sizeof sv / sizeof sv[0]);
    for (int i = 0; i < n; i++) {
        long x = sv[i];
        float f = (float)x;
        printf("s%02d %ld f=%08x %.1f d=%016lx q=%08x %016lx\n", i, x, fbits(f), (double)f,
               dbits((double)x), fbits(q16f(x)), dbits(q32d(x)));
    }
    n = (int)(sizeof uv / sizeof uv[0]);
    for (int i = 0; i < n; i++) {
        unsigned long x = uv[i];
        float f = (float)x;
        printf("u%02d %lu f=%08x %.1f d=%016lx q=%08x\n", i, x, fbits(f), (double)f,
               dbits((double)x), fbits(uq16f(x)));
    }
    n = (int)(sizeof si / sizeof si[0]);
    for (int i = 0; i < n; i++)
        printf("i%d %d f=%08x d=%016lx\n", i, si[i], fbits((float)si[i]), dbits((double)si[i]));
    n = (int)(sizeof ui / sizeof ui[0]);
    for (int i = 0; i < n; i++)
        printf("w%d %u f=%08x d=%016lx\n", i, ui[i], fbits((float)ui[i]), dbits((double)ui[i]));

    n = (int)(sizeof nv / sizeof nv[0]);
    for (int i = 0; i < n; i++) {
        double d = nv[i];
        float f = (float)d;
        printf("n%02d %016lx -> %08x %.9g\n", i, dbits(d), fbits(f), (double)f);
    }
    n = (int)(sizeof wv / sizeof wv[0]);
    for (int i = 0; i < n; i++) {
        float f = wv[i];
        printf("x%d %08x -> %016lx %.17g\n", i, fbits(f), dbits((double)f), (double)f);
    }

    n = (int)(sizeof dnan / sizeof dnan[0]);
    for (int i = 0; i < n; i++)
        printf("dn%d %016lx -> %08x\n", i, dnan[i], fbits((float)d_of(dnan[i])));
    n = (int)(sizeof fnan / sizeof fnan[0]);
    for (int i = 0; i < n; i++)
        printf("fn%d %08x -> %016lx\n", i, fnan[i], dbits((double)f_of(fnan[i])));

    /* Round trips a correct conversion must survive exactly. */
    long back = 0;
    for (long k = 1; k <= 1000; k++) {
        long big = k << 40;
        back += (long)(float)big == big;
        back += (long)(double)(big + 1) == big + 1;
    }
    printf("exact %ld\n", back);
    return 0;
}
