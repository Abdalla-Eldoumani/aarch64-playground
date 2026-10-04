/* Tries to break printf's integer conversions: every flag, width, and precision on d i u x X o, with the zero-value and prefix rules. */
#include <stdio.h>
#include <limits.h>

/* The formats live in a table so one loop can run each against every
   value. The flags here are all ones C defines for that conversion. */
static const char *const sfmt[] = {
    "%d", "%i", "%6d", "%-6d", "%06d", "%+d", "% d", "%+ d", "%-+7d", "% 07d",
    "%-07d", "%.0d", "%4.0d", "%+.0d", "% .0d", "%.4d", "%09.4d", "%-9.4i",
    "%+.12d", "%+012d",
};
static const char *const ufmt[] = {
    "%u", "%+u", "% u", "%.0u", "%011u", "%-11.7u", "%5.0u",
    "%x", "%X", "%#x", "%#X", "%#012x", "%-#12x", "%#.9x", "%.0x", "%#.0x",
    "%08.3x", "%#8.0X",
    "%o", "%#o", "%.0o", "%#.0o", "%#6o", "%#.5o", "%07o", "%-#9o", "%#012o",
};
static const int svals[] = { 0, 7, -7, 42, 100000, INT_MAX, INT_MIN };
static const unsigned uvals[] = { 0u, 7u, 255u, 0x80000000u, UINT_MAX, 01234567u };

#define COUNT(a) (sizeof (a) / sizeof (a)[0])

int main(void)
{
    int total = 0;

    for (unsigned i = 0; i < COUNT(sfmt); i++) {
        int n = 0;
        printf("%-8s", sfmt[i]);
        for (unsigned j = 0; j < COUNT(svals); j++) {
            putchar('[');
            n += printf(sfmt[i], svals[j]);
            putchar(']');
        }
        printf(" n=%d\n", n);
        total += n;
    }
    for (unsigned i = 0; i < COUNT(ufmt); i++) {
        int n = 0;
        printf("%-8s", ufmt[i]);
        for (unsigned j = 0; j < COUNT(uvals); j++) {
            putchar('[');
            n += printf(ufmt[i], uvals[j]);
            putchar(']');
        }
        printf(" n=%d\n", n);
        total += n;
    }
    printf("total=%d\n", total);

    /* Literal formats, so gcc checks the types; the stars read ints
       ahead of each value. */
    int r = printf("[%-+*.*d][%0*d][%#-*.*x][%*.*o]\n",
                   9, 4, -12, 7, -3, 12, 5, 0xabcu, -6, 0, 0u);
    printf("r=%d\n", r);
    r = printf("[%+.0d][% .0i][%#.0o][%#.0X][%.0u]\n", 0, 0, 0u, 0u, 0u);
    printf("r=%d\n", r);

    /* The int below comes from a long, so at -O2 its x register can
       carry the long's upper half. printf must read only the w bits. */
    volatile long wide = 0x1234567880000005L;
    int low = (int)wide;
    r = printf("%d %i %u %x %o %X\n", low, low, (unsigned)low, (unsigned)low,
               (unsigned)low, (unsigned)low);
    printf("r=%d\n", r);
    return 0;
}
