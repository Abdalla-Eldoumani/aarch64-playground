/* Tries to break the divide path: INT_MIN / -1, divide by zero, W results clearing X, and gcc's divide-by-constant multiplies. */
#include <stdio.h>
#include <limits.h>

/* C leaves INT_MIN / -1 and any division by zero undefined, but the
   AArch64 divide instructions define both: the quotient wraps and a zero
   divisor answers 0. Inline asm reaches that hardware answer directly. */
static int sdiv_w(int a, int b)
{
    int q;
    __asm__("sdiv %w0, %w1, %w2" : "=r"(q) : "r"(a), "r"(b));
    return q;
}

static unsigned udiv_w(unsigned a, unsigned b)
{
    unsigned q;
    __asm__("udiv %w0, %w1, %w2" : "=r"(q) : "r"(a), "r"(b));
    return q;
}

static long sdiv_x(long a, long b)
{
    long q;
    __asm__("sdiv %x0, %x1, %x2" : "=r"(q) : "r"(a), "r"(b));
    return q;
}

static unsigned long udiv_x(unsigned long a, unsigned long b)
{
    unsigned long q;
    __asm__("udiv %x0, %x1, %x2" : "=r"(q) : "r"(a), "r"(b));
    return q;
}

/* The remainder the way gcc builds it: divide, then msub. */
static int srem_w(int a, int b)
{
    int q, r;
    __asm__("sdiv %w0, %w2, %w3\n\tmsub %w1, %w0, %w3, %w2"
            : "=&r"(q), "=r"(r) : "r"(a), "r"(b));
    (void)q;
    return r;
}

static long srem_x(long a, long b)
{
    long q, r;
    __asm__("sdiv %x0, %x2, %x3\n\tmsub %x1, %x0, %x3, %x2"
            : "=&r"(q), "=r"(r) : "r"(a), "r"(b));
    (void)q;
    return r;
}

/* A W-sized result must zero bits 63:32 of its X register. The mov fills
   them with ones first, so a divider that skips the zeroing shows. */
static unsigned long sdiv_w_seen_as_x(int a, int b)
{
    unsigned long x;
    __asm__("mov %x0, -1\n\tsdiv %w0, %w1, %w2" : "=&r"(x) : "r"(a), "r"(b));
    return x;
}

static volatile int w_pairs[][2] = {
    {INT_MIN, -1}, {INT_MIN, 1}, {INT_MIN, 2}, {INT_MIN, INT_MIN},
    {INT_MAX, -1}, {INT_MAX, INT_MIN}, {-1, INT_MIN}, {-7, 2},
    {7, -2}, {-7, -2}, {5, 0}, {-5, 0}, {0, 0}, {INT_MIN, 0},
    {100, 7}, {-100, 7},
};

static volatile long x_pairs[][2] = {
    {LONG_MIN, -1}, {LONG_MIN, 0}, {LONG_MIN, 3}, {LONG_MAX, LONG_MIN},
    {-9, 4}, {9, -4}, {-1, 2}, {0x0123456789abcdefL, 0x1000},
};

static volatile int dividends[] = {
    INT_MIN, INT_MIN + 1, -1000000007, -10, -9, -1, 0, 1, 9, 10,
    1000000007, INT_MAX - 1, INT_MAX,
};

int main(void)
{
    int n = sizeof w_pairs / sizeof w_pairs[0];
    printf("w: a b | sdiv srem x-view udiv | C a/b a%%b\n");
    for (int i = 0; i < n; i++) {
        int a = w_pairs[i][0], b = w_pairs[i][1];
        printf("%d %d | %d %d %lx %u |", a, b, sdiv_w(a, b), srem_w(a, b),
               sdiv_w_seen_as_x(a, b), udiv_w((unsigned)a, (unsigned)b));
        if (b != 0 && !(a == INT_MIN && b == -1))
            printf(" %d %d %u\n", a / b, a % b, (unsigned)a % (unsigned)b);
        else
            printf(" hardware only\n");
    }

    n = sizeof x_pairs / sizeof x_pairs[0];
    printf("x: a b | sdiv srem udiv | C a/b a%%b\n");
    for (int i = 0; i < n; i++) {
        long a = x_pairs[i][0], b = x_pairs[i][1];
        printf("%ld %ld | %ld %ld %lu |", a, b, sdiv_x(a, b), srem_x(a, b),
               udiv_x((unsigned long)a, (unsigned long)b));
        if (b != 0 && !(a == LONG_MIN && b == -1))
            printf(" %ld %ld\n", a / b, a % b);
        else
            printf(" hardware only\n");
    }

    /* Every small divisor, zero and -1 included, against both extremes. */
    long sum = 0;
    for (int d = -8; d <= 8; d++) {
        sum += sdiv_w(INT_MIN, d);
        sum += srem_w(INT_MAX, d);
        sum += sdiv_x(LONG_MIN, d) >> 32;
    }
    printf("divisor sweep %ld\n", sum);

    /* Constant divisors: gcc turns these into multiply-high sequences at -O2. */
    n = sizeof dividends / sizeof dividends[0];
    for (int i = 0; i < n; i++) {
        int v = dividends[i];
        unsigned u = (unsigned)v;
        long l = (long)v * 1000003;
        printf("%d: d3 %d d7 %d d10 %d dm5 %d r10 %d rm3 %d u10 %u ur7 %u"
               " l %ld %ld %lu\n",
               v, v / 3, v / 7, v / 10, v / -5, v % 10, v % -3, u / 10, u % 7,
               l / 1000000007, l % 1000000007, (unsigned long)l / 1000000007UL);
    }
    return 0;
}
