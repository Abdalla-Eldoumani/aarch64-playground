/* Tries to break printf's double conversions: f F e E g G under every flag, exact-tie rounding, subnormals, infinities, and NaN signs. */
#include <stdio.h>
#include <string.h>
#include <float.h>

static const char *const fmts[] = {
    "%f", "%.0f", "%#.0f", "%.1f", "%.2f", "%12.4f", "%-12.4f", "%+f", "% f",
    "%012.3f", "%+012.3f", "%-+12.1f", "%.20f", "%F", "%10.2F",
    "%e", "%.0e", "%#.0e", "%.2e", "%E", "%+.3e", "%012.3e", "%-14.2E", "% .1e",
    "%g", "%.0g", "%.1g", "%.3g", "%#g", "%#.3g", "%G", "%.10g", "%+g",
    "%012g", "%-12g", "%.17g", "%#.0g",
};

static unsigned long bits(double d)
{
    unsigned long u;
    memcpy(&u, &d, sizeof u);
    return u;
}

int main(void)
{
    /* Annex F: these divisions run on the FPU at run time (the operand
       is volatile), giving +inf and the default NaN, positive on AArch64. */
    volatile double zero = 0.0;
    double inf = 1.0 / zero;
    double qnan = zero / zero;
    double vals[] = {
        0.0, -0.0, 1.0, -1.5, 0.125, 2.5, 0.1, 9.9995, 999.5,
        123456.789, 1e-5, 0.0001, 1e15, 6.02214076e23, 1e-300,
        DBL_TRUE_MIN, DBL_MIN, inf, -inf, qnan, -qnan,
    };
    int nv = (int)(sizeof vals / sizeof vals[0]);

    for (int j = 0; j < nv; j++)
        printf("v%-2d %016lx\n", j, bits(vals[j]));

    for (unsigned i = 0; i < sizeof fmts / sizeof fmts[0]; i++) {
        int n = 0;
        printf("%-8s", fmts[i]);
        for (int j = 0; j < nv; j++) {
            putchar('[');
            n += printf(fmts[i], vals[j]);
            putchar(']');
        }
        printf(" n=%d\n", n);
    }

    /* Exact binary ties go to even under the default rounding mode. */
    int r = printf("%.0f %.0f %.0f %.0f %.0f %.1f %.1f %.2f %.2f %.0e %.1e %.1g\n",
                   0.5, 1.5, 2.5, 3.5, -0.5, 0.25, 0.35, 1.125, 2.675, 2.5,
                   1.25, 0.25);
    printf("r=%d\n", r);

    /* A float argument is promoted to double at the call. */
    float f = 0.1f;
    r = printf("%.12f|%g|%.9e|%lf|%le|%lg\n", f, f, f, (double)f * 3, 1e-7, 1e7);
    printf("r=%d\n", r);

    /* DBL_MAX in full: 309 integer digits through %f, and wide fields. */
    r = printf("%.0f\n%.3e %g %40.10g|\n", DBL_MAX, DBL_MAX, DBL_MAX, -DBL_MAX);
    printf("r=%d\n", r);
    /* The smallest subnormal has an exact 1074-place decimal expansion. */
    r = printf("%.1074f\n%.40e\n%.25g\n", DBL_TRUE_MIN, 0.1, 1.0 / 3);
    printf("r=%d\n", r);
    return 0;
}
