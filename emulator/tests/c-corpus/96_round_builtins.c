/* Tries to break the scalar round-to-integral family (FRINTM/P/Z/A/X/I/N on s and d registers) and the conversions that follow a rounding. */
#include <stdio.h>

static unsigned long dbits(double d) { union { double d; unsigned long u; } v; v.d = d; return v.u; }
static double d_of(unsigned long u) { union { unsigned long u; double d; } v; v.u = u; return v.d; }

/* Called by their __builtin_ names these expand to one FRINT instruction
   at every optimisation level, even under -fno-builtin; the plain names
   would be library calls. */
static double r_floor(double x) { return __builtin_floor(x); }
static double r_ceil(double x) { return __builtin_ceil(x); }
static double r_trunc(double x) { return __builtin_trunc(x); }
static double r_round(double x) { return __builtin_round(x); }
static double r_rint(double x) { return __builtin_rint(x); }
static double r_nearby(double x) { return __builtin_nearbyint(x); }
static double r_even(double x) { return __builtin_roundeven(x); }
static float s_floor(float x) { return __builtin_floorf(x); }
static float s_ceil(float x) { return __builtin_ceilf(x); }
static float s_trunc(float x) { return __builtin_truncf(x); }
static float s_round(float x) { return __builtin_roundf(x); }
static float s_rint(float x) { return __builtin_rintf(x); }
static float s_nearby(float x) { return __builtin_nearbyintf(x); }
static float s_even(float x) { return __builtin_roundevenf(x); }

static double (*const dops[])(double) = {r_floor, r_ceil, r_trunc, r_round, r_rint, r_nearby, r_even};
static float (*const fops[])(float) = {s_floor, s_ceil, s_trunc, s_round, s_rint, s_nearby, s_even};

/* A cast right after a rounding can fuse into one FCVTMS/FCVTPS/FCVTAS/
   FCVTNS at -O2. Only in-range values reach these, so every cast is defined. */
static long l_floor(double x) { return (long)__builtin_floor(x); }
static long l_ceil(double x) { return (long)__builtin_ceil(x); }
static long l_round(double x) { return (long)__builtin_round(x); }
static long l_even(double x) { return (long)__builtin_roundeven(x); }
static int i_floorf(float x) { return (int)__builtin_floorf(x); }
static unsigned u_roundf(float x) { return (unsigned)__builtin_roundf(x); }

static volatile double dv[] = {
    0.5, -0.5, 1.5, -1.5, 2.5, -2.5, 0.49999999999999994, -0.49999999999999994,
    4503599627370495.5, -4503599627370495.5, 4503599627370497.0, 0x1p63, -0.0, 0.0,
    1e-300, -1e-300, 0x1p-1074, -123456.5, 0.7, -0.7, 1e300,
    __builtin_inf(), -__builtin_inf(),
};
static volatile unsigned long nanbits[] = {0x7ff8000000000001, 0xfff0000000000001};
static volatile float fv[] = {
    0.5f, -0.5f, 2.5f, -2.5f, 8388607.5f, -8388607.5f, 0x1p23f, 16777215.0f,
    -0.0f, 0x1p-149f, -0x1p-149f, 0.49999997f, -1.25f, 0x1.fffffep127f,
};

static void show(double r)
{
    if (r != r)
        printf(" nan:%016lx", dbits(r));
    else
        printf(" %.17g", r);
}

int main(void)
{
    puts("floor ceil trunc round rint nearbyint roundeven");
    int n = (int)(sizeof dv / sizeof dv[0]);
    for (int i = 0; i < n; i++) {
        double x = dv[i];
        printf("d%02d %.17g:", i, x);
        for (int k = 0; k < 7; k++)
            show(dops[k](x));
        printf("\n");
    }
    for (int i = 0; i < 2; i++) {
        double x = d_of(nanbits[i]);
        printf("nan%d %016lx:", i, nanbits[i]);
        for (int k = 0; k < 7; k++)
            show(dops[k](x));
        printf("\n");
    }
    n = (int)(sizeof fv / sizeof fv[0]);
    for (int i = 0; i < n; i++) {
        float x = fv[i];
        printf("f%02d %.9g:", i, (double)x);
        for (int k = 0; k < 7; k++)
            printf(" %.9g", (double)fops[k](x));
        printf("\n");
    }

    n = (int)(sizeof dv / sizeof dv[0]);
    for (int i = 0; i < n; i++) {
        double x = dv[i];
        if (!(__builtin_fabs(x) < 0x1p62))
            continue;
        printf("l%02d %ld %ld %ld %ld\n", i, l_floor(x), l_ceil(x), l_round(x), l_even(x));
    }
    n = (int)(sizeof fv / sizeof fv[0]);
    for (int i = 0; i < n; i++) {
        float x = fv[i];
        if (!(__builtin_fabsf(x) < 0x1p30f))
            continue;
        printf("i%02d %d", i, i_floorf(x));
        if (x >= 0.0f)
            printf(" %u", u_roundf(x));
        printf("\n");
    }

    /* The classic trap: floor(x + 0.5) is not round(x). */
    double t = dv[6];
    printf("trap %.17g %.17g\n", r_floor(t + 0.5), r_round(t));
    double sum = 0.0;
    for (int k = -8; k <= 8; k++)
        sum += r_rint(k + 0.5) * 1000.0 + r_round(k + 0.5);
    printf("sum %.17g\n", sum);
    return 0;
}
