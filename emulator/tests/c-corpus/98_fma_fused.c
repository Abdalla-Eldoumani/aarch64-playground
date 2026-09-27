/* Tries to break fused multiply-add: one rounding instead of two in double and single, all four sign forms, exact error terms, overflow and signed-zero edges, and the lane form. */
#include <stdio.h>

static unsigned long dbits(double d) { union { double d; unsigned long u; } v; v.d = d; return v.u; }
static unsigned fbits(float f) { union { float f; unsigned u; } v; v.f = f; return v.u; }

/* The builtins expand to FMADD at every level; the negated operands let
   gcc pick FMSUB, FNMADD, and FNMSUB at -O2. */
static double fma_(double a, double b, double c) { return __builtin_fma(a, b, c); }
static double fms_(double a, double b, double c) { return __builtin_fma(-a, b, c); }
static double fnma_(double a, double b, double c) { return __builtin_fma(-a, b, -c); }
static double fnms_(double a, double b, double c) { return __builtin_fma(a, b, -c); }
static float fmaf_(float a, float b, float c) { return __builtin_fmaf(a, b, c); }
static float fnmaf_(float a, float b, float c) { return __builtin_fmaf(-a, b, -c); }

/* The volatile product forces a separate rounding, so contraction cannot fuse it. */
static double unfused(double a, double b, double c) { volatile double p = a * b; return p + c; }
static float unfusedf(float a, float b, float c) { volatile float p = a * b; return p + c; }

static volatile double dv[][3] = {
    {0.1, 10.0, -1.0},
    {0x1.00000004p0, 0x1.00000004p0, -0x1.00000008p0},  /* (1 + 2^-30)^2 - (1 + 2^-29) = 2^-60 */
    {0x1.fffffffffffffp1023, 2.0, -0x1.fffffffffffffp1023}, /* exact fused, infinite unfused */
    {-1e-200, 1e-200, 0.0},                             /* -0 fused, +0 unfused */
    {1e-200, 1e-200, -0.0},
    {-0.0, 5.0, -0.0}, {-0.0, 5.0, 0.0}, {2.0, 3.0, -6.0}, {-2.0, 3.0, 6.0},
    {0x1p-1022, 0.5, 0.0}, {0x1p-1074, 0.5, 0x1p-1074}, {3.0, 1.0 / 3.0, -1.0},
    {1e308, 10.0, -1e308}, {0x1.0000000000001p0, 0x1.fffffffffffffp-1, -1.0},
};
static volatile float fv[][3] = {
    {0x1.001p0f, 0x1.001p0f, 0x1p-60f},   /* a double intermediate would round this to a tie */
    {3.0f, 0x1.555556p-2f, -1.0f},
    {0x1.fffffep127f, 2.0f, -0x1.fffffep127f},
    {0x1p-149f, 0.5f, 0x1p-149f},
    {-1e-30f, 1e-30f, 0.0f},
    {1.1f, 1.1f, -1.21f},
    {16777215.0f, 16777215.0f, -0x1.fffffcp47f},
};

/* Eight-term dot product: -O2 contracts s += x*y into FMADD by default,
   -O0 does not, so the two tiers keep separate answers. */
static double xs[8], ys[8];
static double dot(void)
{
    double s = 0.0;
    for (int i = 0; i < 8; i++)
        s += xs[i] * ys[i];
    return s;
}

/* Four independent lanes: -O2 may turn this loop into FMLA on v registers. */
static double la[4], lb[4], lc[4];
static void fma_lanes(void)
{
    for (int i = 0; i < 4; i++)
        lc[i] = __builtin_fma(la[i], lb[i], lc[i]);
}

int main(void)
{
    int n = (int)(sizeof dv / sizeof dv[0]);
    for (int i = 0; i < n; i++) {
        double a = dv[i][0], b = dv[i][1], c = dv[i][2];
        double r = fma_(a, b, c);
        printf("d%02d %016lx %016lx %016lx %016lx un %016lx %.17g\n", i, dbits(r),
               dbits(fms_(a, b, c)), dbits(fnma_(a, b, c)), dbits(fnms_(a, b, c)),
               dbits(unfused(a, b, c)), r);
    }
    n = (int)(sizeof fv / sizeof fv[0]);
    for (int i = 0; i < n; i++) {
        float a = fv[i][0], b = fv[i][1], c = fv[i][2];
        float r = fmaf_(a, b, c);
        printf("f%02d %08x %08x un %08x %.9g\n", i, fbits(r), fbits(fnmaf_(a, b, c)),
               fbits(unfusedf(a, b, c)), (double)r);
    }

    /* The error of a rounded product is exactly representable, and FMA finds it. */
    n = (int)(sizeof dv / sizeof dv[0]);
    for (int i = 0; i < n; i++) {
        double a = dv[i][0] * 0.7, b = dv[i][1] + 0.3;
        volatile double p = a * b;
        double e = fma_(a, b, -p);
        printf("e%02d %016lx %016lx %.17g\n", i, dbits(p), dbits(e), e);
    }

    /* Horner evaluation of 1 + x + x^2/2 + ... + x^7/5040, one rounding per step. */
    static const double coef[] = {1.0 / 5040, 1.0 / 720, 1.0 / 120, 1.0 / 24, 1.0 / 6, 0.5, 1.0, 1.0};
    for (int k = -3; k <= 3; k++) {
        double x = k * dv[0][0] * 2.5, h = 0.0;
        float hf = 0.0f;
        for (int j = 0; j < 8; j++) {
            h = fma_(h, x, coef[j]);
            hf = fmaf_(hf, (float)x, (float)coef[j]);
        }
        printf("h%+d %016lx %08x %.17g\n", k, dbits(h), fbits(hf), h);
    }

    for (int i = 0; i < 8; i++) {
        xs[i] = dv[0][0] * (i + 1) + 1.0 / 3.0;
        ys[i] = dv[1][0] / (i + 7);
    }
    printf("dot %016lx %.17g\n", dbits(dot()), dot());

    for (int i = 0; i < 4; i++) {
        la[i] = dv[i][0];
        lb[i] = dv[i][1];
        lc[i] = dv[i][2];
    }
    fma_lanes();
    for (int i = 0; i < 4; i++)
        printf("lane%d %016lx\n", i, dbits(lc[i]));
    return 0;
}
