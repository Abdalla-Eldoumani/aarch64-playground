/* Tries to break: tail calls that reuse the caller's stack-argument slots, indirect tail calls through a table, and Ackermann's nesting. */
#include <stdio.h>

static volatile int sum_depth = 6000;
static volatile int parity_depth = 3001;
static volatile int rot_depth = 1500;
static volatile int ack_top = 4;

/* -O0: 6000 real frames. -O2: a loop. Both must agree. */
static unsigned long long sum_to(unsigned n, unsigned long long acc)
{
    if (n == 0)
        return acc;
    return sum_to(n - 1, acc + (unsigned long long)n * n);
}

static int is_odd(long long n);
static int is_even(long long n)
{
    return n == 0 ? 1 : is_odd(n - 1);
}
static int is_odd(long long n)
{
    return n == 0 ? 0 : is_even(n - 1);
}

/* Ten arguments, two on the stack. At -O2 the sibling call writes the
   rotated values into its own incoming slots and branches, so a store to
   the wrong slot or a stale sp breaks the next level. */
static long long rotate(int n, long long a, long long b, long long c, long long d,
                        long long e, long long f, long long g, long long h, long long i)
{
    if (n % 300 == 0)
        printf("rotate n=%d a=%lld e=%lld h=%lld i=%lld\n", n, a, e, h, i);
    if (n == 0)
        return a - b + c - d + e - f + g - h + i;
    return rotate(n - 1, i + 1, a, b, c, d, e, f, g, h * 2 % 1000003);
}

/* gcd by tail recursion; Fibonacci neighbours are the slowest input */
static unsigned long long gcd(unsigned long long a, unsigned long long b, int *steps)
{
    ++*steps;
    return b == 0 ? a : gcd(b, a % b, steps);
}

/* A run-length state machine whose every state tail-calls the next state
   through a function-pointer table (an indirect branch at -O2). */
typedef unsigned (*state_fn)(const char *s, unsigned acc, unsigned run);
static unsigned st_letter(const char *s, unsigned acc, unsigned run);
static unsigned st_digit(const char *s, unsigned acc, unsigned run);
static unsigned st_other(const char *s, unsigned acc, unsigned run);
static const state_fn table[3] = { st_letter, st_digit, st_other };

static int kind(char c)
{
    return (c >= 'a' && c <= 'z') ? 0 : (c >= '0' && c <= '9') ? 1 : 2;
}
static unsigned next(const char *s, unsigned acc, unsigned run, int from)
{
    if (*s == 0)
        return acc * 131 + run;
    if (kind(*s) == from)
        return table[from](s + 1, acc, run + 1);
    return table[kind(*s)](s + 1, acc * 131 + run * (unsigned)(from + 1), 1);
}
static unsigned st_letter(const char *s, unsigned acc, unsigned run)
{
    return next(s, acc ^ 0x1234, run, 0);
}
static unsigned st_digit(const char *s, unsigned acc, unsigned run)
{
    return next(s, acc + 7, run, 1);
}
static unsigned st_other(const char *s, unsigned acc, unsigned run)
{
    return next(s, acc - 3, run, 2);
}

static long ack_calls;
static long ack(long m, long n)
{
    ack_calls++;
    if (m == 0)
        return n + 1;
    if (n == 0)
        return ack(m - 1, 1);
    return ack(m - 1, ack(m, n - 1));
}

static char text[1800];

int main(void)
{
    unsigned long long f0 = 0, f1 = 1, t;
    int i, steps;
    long r;

    printf("sum_to=%llu\n", sum_to(sum_depth, 0));
    printf("even(%d)=%d odd(%d)=%d\n", parity_depth, is_even(parity_depth),
           parity_depth, is_odd(parity_depth));
    printf("rotate=%lld\n", rotate(rot_depth, 1, 2, 3, 4, 5, 6, 7, 8, 9));

    for (i = 0; i < 92; i++) {
        t = f0 + f1;
        f0 = f1;
        f1 = t;
        if (i % 23 == 22) {
            steps = 0;
            t = gcd(f1, f0, &steps);
            printf("gcd(fib %d, fib %d)=%llu in %d steps\n", i + 2, i + 1, t, steps);
        }
    }

    for (i = 0; i < (int)sizeof text - 1; i++)
        text[i] = "aab77-zzz0.q"[(i * 7 + i / 5) % 12];
    printf("machine=%u\n", table[kind(text[0])](text + 1, 0, 1));
    text[0] = 0;
    printf("machine(empty)=%u\n", next(text, 5, 9, 2));

    for (i = 0; i <= ack_top; i++) {
        ack_calls = 0;
        r = ack(2, i);
        printf("ack(2,%d)=%ld calls=%ld\n", i, r, ack_calls);
        ack_calls = 0;
        r = ack(3, i);
        printf("ack(3,%d)=%ld calls=%ld\n", i, r, ack_calls);
    }
    return 0;
}
