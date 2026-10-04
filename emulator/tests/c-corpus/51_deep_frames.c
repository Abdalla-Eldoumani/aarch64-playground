/* Tries to break: stack slots and callee-saved registers across 3000 live frames, stack-passed narrow args, and 10 values held over a call. */
#include <stdio.h>

/* volatile so the plain -O2 tier cannot fold the recursion away */
static volatile int walk_depth = 3000;
static volatile int ten_depth = 600;
static volatile int keep_depth = 1500;

/* Every integer width stays live across the recursive call. A slot the
   callee clobbers changes r at that level and every level above it. */
static unsigned long long walk(int n, unsigned long long h)
{
    signed char c = (signed char)(n * 37);
    unsigned short s = (unsigned short)(n * 1009u);
    int i = n ^ 0x5a5a;
    long long l = (long long)n * -1000003LL;
    unsigned long long r;

    if (n == 0)
        return h;
    r = walk(n - 1, h * 31 + (unsigned)n);
    r = r * 1099511628211ULL ^ (unsigned long long)(c + s + i) ^ (unsigned long long)l;
    if (n % 1000 == 0 || n < 3)
        printf("walk n=%d c=%d s=%u i=%d l=%lld r=%016llx\n", n, c, s, i, l, r);
    return r;
}

/* Twelve arguments: x0-x7 hold the first eight, the last four (a signed
   char, a short, an unsigned char, a long long) arrive on the stack, where
   the callee has to sign- or zero-extend them from 8-byte slots. */
static long long ten(int n, long long a, int b, long long c, int d, long long e, int f,
                     long long g, signed char h, short i, unsigned char j, long long k)
{
    long long r;

    if (n == 0)
        return a + b + c + d + e + f + g + h + i + j + k;
    r = ten(n - 1, k + n, (int)a, b, (int)c, d, (int)e, f,
            (signed char)(g + n), (short)(h * 300), (unsigned char)(i + 7), j + 3LL * n);
    if (n % 200 == 0 || n == 1)
        printf("ten n=%d h=%d i=%d j=%u k=%lld r=%lld\n", n, h, i, j, k, r);
    return r - h + i - j;
}

/* Ten 64-bit values and two doubles live across the call: at -O2 they sit
   in x19-x28 and d8-d15, so a save/restore pair that drops a register
   shows up in the sum. The doubles stay exact (quarters). */
static unsigned long long keep(int n, unsigned long long x)
{
    unsigned long long a = x * 3, b = x ^ 0x55, c = x + 7, d = x >> 3, e = x * x;
    unsigned long long f = ~x, g = x << 5, h = x - 11, k = x | 0x100, m = x & 0xff0;
    double q = n * 0.25, w = q + 1.5;
    unsigned long long r;

    if (n == 0)
        return x;
    r = keep(n - 1, x * 6364136223846793005ULL + 1442695040888963407ULL);
    r += a - b + c - d + e - f + g - h + k - m;
    r ^= (unsigned long long)(q * 4.0 + w);
    if (n % 500 == 0)
        printf("keep n=%d q=%.2f w=%.2f r=%016llx\n", n, q, w, r);
    return r;
}

int main(void)
{
    unsigned long long w = walk(walk_depth, 5381);
    long long t = ten(ten_depth, 1, -2, 3, -4, 5, -6, 7, -8, 9, 10, -11);
    unsigned long long k = keep(keep_depth, 42);

    printf("walk=%016llx\n", w);
    printf("ten=%lld\n", t);
    printf("keep=%016llx\n", k);
    return 0;
}
