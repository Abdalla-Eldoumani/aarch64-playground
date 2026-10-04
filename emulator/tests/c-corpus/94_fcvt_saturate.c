/* Tries to break float and double to integer conversion: saturation at every rail, NaN, infinities, signed zero, subnormals, all rounding modes. */
#include <stdio.h>

/* Casting an out-of-range value or a NaN to an integer type is undefined
   in ISO C. gcc lowers each cast below to one FCVTZS or FCVTZU (a vector
   form at -O2), and what prints is that instruction's saturating answer.
   The inputs are volatile so no optimisation level can fold a cast. */
static volatile double dv[] = {
    0.0, -0.0, 0x1p-1074, -0x1p-1074, 0x1.fffffffffffffp-1, -1.5,
    0x1.fffffffffffffp30, 0x1p31, -0x1p31, -0x1.00000001fffffp31, -0x1.00000002p31,
    0x1.fffffffffffffp31, 0x1p32, 0x1.fffffffffffffp62, 0x1p63, -0x1p63,
    -0x1.0000000000001p63, 0x1.fffffffffffffp63, 0x1p64, 1e300, -1e300,
    __builtin_inf(), -__builtin_inf(), __builtin_nan(""), -__builtin_nan(""),
};
static volatile float fv[] = {
    0.0f, -0.0f, 0x1p-149f, -0x1p-149f, 0x1.fffffep-1f, -1.5f, 0x1.fffffep30f, 0x1p31f,
    -0x1p31f, -0x1.000002p31f, 0x1.fffffep31f, 0x1p32f, 0x1.fffffep62f, 0x1p63f, -0x1p63f,
    -0x1.000002p63f, 0x1.fffffep63f, 0x1p64f, 0x1.fffffep127f, -0x1.fffffep127f,
    __builtin_inff(), -__builtin_inff(), __builtin_nanf(""), -__builtin_nanf(""),
};
static volatile float lv[8] = {
    0x1.fffffep127f, -0x1.fffffep127f, __builtin_inff(), __builtin_nanf(""),
    -1.5f, 0x1p31f, 0x1p32f, -0x1p31f,
};
static volatile double qv[] = {1.5, -0.75, 32767.99999, 32768.0, -32768.0, -32769.0, 3e9, __builtin_nan("")};
static volatile double rv[] = {
    0.5, -0.5, 1.5, 2.5, -2.5, 2147483647.5, -2147483648.5, 4294967295.5, 1e19, -1e19, __builtin_nan(""),
};

static unsigned long dbits(double d) { union { double d; unsigned long u; } v; v.d = d; return v.u; }
static unsigned fbits(float f) { union { float f; unsigned u; } v; v.f = f; return v.u; }

/* At -O2 these round trips stay in SIMD registers: FCVTZS Dd, Dn, then SCVTF. */
static double via_long(double d) { return (double)(long)d; }
static double via_ulong(double d) { return (double)(unsigned long)d; }
static float via_int(float f) { return (float)(int)f; }
static float via_uint(float f) { return (float)(unsigned)f; }

/* Fixed-size, non-aliasing arrays, so -O2 may vectorize the loop into lanes. */
static float lanes[8];
static int lane_i[8];
static unsigned lane_u[8];
static void convert_lanes(void)
{
    for (int i = 0; i < 8; i++) {
        lane_i[i] = (int)lanes[i];
        lane_u[i] = (unsigned)lanes[i];
    }
}

/* A multiply by a power of two in front of the cast becomes the
   fixed-point form (FCVTZS Wd, Dn, #16) at -O2. */
static int q16(double d) { return (int)(d * 65536.0); }
static long q32(double d) { return (long)(d * 4294967296.0); }
static unsigned uq8(float f) { return (unsigned)(f * 256.0f); }

/* The other rounding modes have no C cast, so inline asm names each one;
   their saturation is defined by the instruction. */
#define CVT(op) \
    static unsigned op##_w(double d) { unsigned r; __asm__(#op " %w0, %d1" : "=r"(r) : "w"(d)); return r; } \
    static unsigned long op##_x(double d) { unsigned long r; __asm__(#op " %x0, %d1" : "=r"(r) : "w"(d)); return r; }
CVT(fcvtns) CVT(fcvtas) CVT(fcvtms) CVT(fcvtps) CVT(fcvtnu) CVT(fcvtau) CVT(fcvtmu) CVT(fcvtpu)

static const struct {
    const char *name;
    unsigned (*w)(double);
    unsigned long (*x)(double);
} modes[] = {
    {"ns", fcvtns_w, fcvtns_x}, {"as", fcvtas_w, fcvtas_x}, {"ms", fcvtms_w, fcvtms_x},
    {"ps", fcvtps_w, fcvtps_x}, {"nu", fcvtnu_w, fcvtnu_x}, {"au", fcvtau_w, fcvtau_x},
    {"mu", fcvtmu_w, fcvtmu_x}, {"pu", fcvtpu_w, fcvtpu_x},
};

int main(void)
{
    int nd = (int)(sizeof dv / sizeof dv[0]);
    for (int i = 0; i < nd; i++) {
        double d = dv[i];
        printf("d%02d %016lx i=%d u=%u l=%ld ul=%lu\n", i, dbits(d),
               (int)d, (unsigned)d, (long)d, (unsigned long)d);
        printf("    via %.1f %.1f\n", via_long(d), via_ulong(d));
    }

    int nf = (int)(sizeof fv / sizeof fv[0]);
    for (int i = 0; i < nf; i++) {
        float f = fv[i];
        printf("f%02d %08x i=%d u=%u l=%ld ul=%lu via %.1f %.1f\n", i, fbits(f),
               (int)f, (unsigned)f, (long)f, (unsigned long)f,
               (double)via_int(f), (double)via_uint(f));
    }

    for (int i = 0; i < 8; i++)
        lanes[i] = lv[i];
    convert_lanes();
    for (int i = 0; i < 8; i++)
        printf("lane%d %08x %d %u\n", i, fbits(lanes[i]), lane_i[i], lane_u[i]);

    int nq = (int)(sizeof qv / sizeof qv[0]);
    for (int i = 0; i < nq; i++)
        printf("q%d %d %ld %u\n", i, q16(qv[i]), q32(qv[i]), uq8((float)qv[i]));

    int nr = (int)(sizeof rv / sizeof rv[0]);
    for (int i = 0; i < nr; i++) {
        double d = rv[i];
        printf("r%02d w", i);
        for (int m = 0; m < 8; m++)
            printf(" %s:%08x", modes[m].name, modes[m].w(d));
        printf("\n    x");
        for (int m = 0; m < 8; m++)
            printf(" %s:%016lx", modes[m].name, modes[m].x(d));
        printf("\n");
    }
    return 0;
}
