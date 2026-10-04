/* Tries to break printf's vararg cursor: * and .* read from registers and the stack, one long mixed list through all four entry points, and fields wider than 4096. */
#include <stdio.h>
#include <string.h>

static char buf[256], buf2[256];

int main(void)
{
    int r;

    /* A sweep of star widths and precisions, negatives included: a
       negative width means '-', a negative precision means none. */
    for (int w = -9; w <= 9; w += 3) {
        r = 0;
        printf("w=%2d", w);
        for (int p = -2; p <= 6; p += 2)
            r += printf(" [%*.*f][%*.*d][%*.*s][%*.*e][%*.*x]", w, p, 3.14159, w, p, -42,
                        w, p, "string", w, p, 0.000123, w, p, 0xbeefu);
        printf(" r=%d\n", r);
    }
    for (int p = -1; p <= 7; p++) {
        r = printf("p=%d [%.*g][%#.*g][%-+*.*g][%0*.*f]\n", p, p, 123.456, p, 0.5,
                   -12, p, 1e-5, 12, p, -2.5);
        printf(" r=%d\n", r);
    }

    /* One list with ints, doubles, strings, chars and stars, long enough
       that both register files run out and the stack interleaves them. */
#define FMT "%d %f %*d %.*f %s %c %ld %e %u %g %x %.2f %d %f %d %f %*s| %d %.3e %c %d " \
            "%g %lu %f %-*.*s| %hhd %hd %5.1f %i %o\n"
#define ARGS -1, 1.5, 6, 22, 3, 2.71828, "str", 'Q', -123456789012L, 6.02e23, 4000000000u, \
             0.001, 0xdeadu, 9.99, -11, 1e10, 12, -0.5, 7, "right", 13, 0.000314, 'z', 14, \
             1e-10, 99999999999UL, 16.25, -8, 3, "leftcut", -200, 40000, -7.75, 17, 8u

    r = printf(FMT, ARGS);
    printf("printf r=%d\n", r);
    r = fprintf(stdout, FMT, ARGS);
    printf("fprintf r=%d\n", r);
    int s = sprintf(buf, FMT, ARGS);
    int n = snprintf(buf2, sizeof buf2, FMT, ARGS);
    printf("sprintf=%d snprintf=%d same=%d len=%zu\n", s, n, strcmp(buf, buf2) == 0, strlen(buf));
    fputs(buf2, stdout);

    /* Stars that land in stack slots, after x1-x7 are spent. */
    r = printf("%d %d %d %d %d %d %d [%*d][%-*d][%.*d][%*.*s]\n", 1, 2, 3, 4, 5, 6, 7,
               5, 8, 5, 9, 4, 10, 6, 2, "abcdef");
    printf("r=%d\n", r);
    r = printf("%f %f %f %f %f %f %f %f [%*.*f][%*.*e][%-*.*g]\n", 1.0, 2.0, 3.0, 4.0, 5.0,
               6.0, 7.0, 8.0, 10, 3, 9.0, 12, 2, 10.0, -9, 4, 11.0);
    printf("r=%d\n", r);

    /* glibc prints widths and precisions past 4096 in full. The counts
       show it; only a short prefix of the text is kept. */
    volatile int big = 5000, huge = 4500;
    n = snprintf(buf, 16, "%*d", big, 7);
    printf("n=%d head=[%s]\n", n, buf);
    n = snprintf(buf, 16, "%-*d|", big, 7);
    printf("n=%d head=[%s]\n", n, buf);
    n = snprintf(buf, 16, "%.*d", huge, 7);
    printf("n=%d head=[%s]\n", n, buf);
    n = snprintf(buf, 16, "%.*f", huge, 1.0);
    printf("n=%d head=[%s]\n", n, buf);
    volatile size_t cap = 16;
    n = snprintf(buf, cap, "%5000s|%4097c", "x", 'y');
    printf("n=%d head=[%s]\n", n, buf);
    r = printf("%*d\n", big, 42);
    printf("r=%d\n", r);
    return 0;
}
