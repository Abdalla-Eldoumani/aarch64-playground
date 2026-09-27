/* Tries to break printf's floating-point conversions: every flag on %f %e %g and their capitals, NaN and infinity, exact ties, and more doubles than d0-d7 hold, in printf and in a variadic function of our own. */
#include <stdio.h>
#include <stdarg.h>

static volatile double vinf = __builtin_inf(), vnan = __builtin_nan(""), vzero = 0.0, vone = 1.0;

/* Folds its doubles in as decimal digits, so a skipped or repeated register shows. */
static double digits(int n, ...)
{
    va_list ap;
    va_start(ap, n);
    double s = 0.0;
    for (int i = 0; i < n; i++)
        s = s * 10.0 + va_arg(ap, double);
    va_end(ap);
    return s;
}

/* Reads each argument as the kind its letter names: d double, i int, l long. */
static double mixed(const char *kinds, ...)
{
    va_list ap;
    va_start(ap, kinds);
    double s = 0.0;
    for (const char *k = kinds; *k; k++) {
        if (*k == 'd')
            s = s * 3.0 + va_arg(ap, double);
        else if (*k == 'i')
            s = s * 3.0 - va_arg(ap, int);
        else
            s = s * 3.0 + (double)va_arg(ap, long) / 7.0;
    }
    va_end(ap);
    return s;
}

int main(void)
{
    double inf = vinf, nan = vnan, nz = -vzero, one = vone;
    double specials[] = {inf, -inf, nan, -nan};
    for (int i = 0; i < 4; i++) {
        double v = specials[i];
        printf("[%f] [%e] [%g] [%F] [%E] [%G]\n", v, v, v, v, v, v);
        printf("[%8f] [%-8f] [%08f] [%+f] [% f] [%+08.3e] [%#g] [%-+9G]\n", v, v, v, v, v, v, v, v);
    }

    for (int i = 0; i < 2; i++) {
        double z = i ? nz : vzero;
        printf("[%f] [%e] [%g] [%+.0f] [% .1e] [%#.0f] [%#g] [%05.1f]\n", z, z, z, z, z, z, z, z);
    }

    /* The # flag keeps the point and, for %g, the trailing zeros. */
    printf("[%#.0f] [%#.0e] [%#g] [%#.3g] [%#G] [%#.0E]\n", 3.0 * one, 3.0 * one, 3.0 * one,
           100.0 * one, 1e-5 * one, 2.5 * one);
    printf("[%#g] [%#.1g] [%#.10g] [%#.0f]\n", 123456789.0 * one, 0.5 * one, one / 3.0, 0.5 * one);

    /* The 0 flag pads every floating conversion, not only %f. */
    double m = -1.5 * one;
    printf("[%012.3e] [%012g] [%-12.3e] [%+012.2E] [%012G] [%012.4f]\n", m, m, m, m, m, m);
    printf("[%+012.3e] [% 012g] [%012.3g] [%015e]\n", -m, -m, 1234567.0 * one, 6.02214076e23 * one);

    /* Exact binary ties round to even; near-ties go by their true value. */
    printf("%.0f %.0f %.0f %.0f %.0f %.0f %.1f %.1f %.2f %.2f %.0e %.0e %.1e %.1g %.3g %.2f\n",
           0.5, 1.5, 2.5, 3.5, -0.5, -2.5, 0.25, 0.35, 0.125, 0.375, 2.5, 3.5, 1.25, 0.25, 1.0005, 0.005);
    printf("%g %g %g %g %g %g %g %g %g\n", 100000.0, 1e6, 999999.5, 0.0001, 0.00001, 123456789.0,
           1e-310, 1.7976931348623157e308, 9.9999995e-5);
    printf("%.3f|%.20f|%.0f|%e|%.15e|%.30e\n", 1e22, 0.1, 1e23, 1e-320, 5e-324, 0.1);
    printf("[%.*f] [%*.*e] [%-*g] [%.*f] [%*g]\n", 3, 3.14159265, 12, 2, 6.02e23, 10, 1.5, -1, 2.5,
           -8, 0.25);

    float f = (float)(0.1 * one);
    printf("%.10f %g %e %.9g\n", f, f, f, f * 3.0f);

    /* Eleven ints and eleven doubles: x1-x7 and d0-d7 fill, and the rest
       share the stack in argument order. */
    printf("%d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %d %.1f %ld %.2f\n",
           1, 1.5 * one, 2, 2.5 * one, 3, 3.5 * one, 4, 4.5 * one, 5, 5.5 * one, 6, 6.5 * one,
           7, 7.5 * one, 8, 8.5 * one, 9, 9.5 * one, 10, 10.5 * one, 11L, 11.25 * one);

    printf("digits %.17g %.17g\n", digits(11, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 0.0, 5.0 * one),
           digits(3, 0.5f * (float)one, 2.25f, -3.0f));
    printf("mixed %.17g\n", mixed("dldidldidldiddlidddl", 0.5 * one, 7L, 1.25, 3, 2.5, 70000000000L, -0.75,
                                  -9, 4.0, 14L, 1e10, 100, 0.125, 6.5, -21L, 8, 3.0, -1.5, 2.0 * one,
                                  0x7fffffffffffL));

    /* The size arrives at run time, so the truncation is snprintf's to report. */
    char buf[8], line[64];
    volatile int cap = 8;
    int len = snprintf(buf, cap, "%.6f", 3.14159265 * one);
    printf("snprintf %d [%s]\n", len, buf);
    len = sprintf(line, "%10.3e|%-10.2f|%+.4g", -12345.678 * one, 0.005, one / 7.0);
    printf("sprintf %d [%s]\n", len, line);

    /* A POSIX flag glibc accepts: grouping does nothing in the C locale. */
    printf("[%'.2f] [%'g] [%'012.1f]\n", 1234567.891 * one, 1234567.0 * one, -9876.54 * one);
    return 0;
}
