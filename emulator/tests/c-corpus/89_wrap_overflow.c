/* Tries to break the carry and overflow flags: wrapping unsigned math at every width and the checked-arithmetic builtins that read C and V. */
#include <stdio.h>
#include <limits.h>

/* Signed overflow is undefined in C, so the signed cases go through
   gcc's checked builtins: they store the wrapped result and report the
   overflow, which gcc builds from adds/subs flags and smulh/umulh. */
static volatile int ip[][2] = {
    {INT_MAX, 1}, {INT_MIN, -1}, {INT_MIN, INT_MIN}, {-1, 1}, {46340, 46340},
    {46341, 46341}, {-65536, 32768}, {65536, 32768}, {0, INT_MIN},
};
static volatile long lp[][2] = {
    {LONG_MAX, 1}, {LONG_MIN, -1}, {LONG_MIN, LONG_MIN}, {3037000499L, 3037000499L},
    {3037000500L, 3037000500L}, {-4294967296L, 2147483648L},
    {4294967296L, 2147483648L}, {0, LONG_MIN},
};
static volatile unsigned up[][2] = {
    {UINT_MAX, 1}, {0, 1}, {65536, 65536}, {65535, 65537}, {0x80000000u, 2},
};
static volatile unsigned long ulp[][2] = {
    {ULONG_MAX, 1}, {0, 1}, {1UL << 32, 1UL << 32},
    {0xffffffffUL, 0x100000001UL}, {1UL << 63, 2},
};

static unsigned fnv32(const char *s)
{
    unsigned h = 2166136261u;
    while (*s)
        h = (h ^ (unsigned char)*s++) * 16777619u;
    return h;
}

static unsigned long fnv64(const char *s)
{
    unsigned long h = 14695981039346656037UL;
    while (*s)
        h = (h ^ (unsigned char)*s++) * 1099511628211UL;
    return h;
}

int main(void)
{
    int r, o1, o2, o3;
    int n = sizeof ip / sizeof ip[0];
    for (int i = 0; i < n; i++) {
        int a = ip[i][0], b = ip[i][1], s, d, m;
        o1 = __builtin_add_overflow(a, b, &s);
        o2 = __builtin_sub_overflow(a, b, &d);
        o3 = __builtin_mul_overflow(a, b, &m);
        printf("int %d %d: add %d %d sub %d %d mul %d %d\n", a, b, s, o1, d, o2, m, o3);
    }

    n = sizeof lp / sizeof lp[0];
    for (int i = 0; i < n; i++) {
        long a = lp[i][0], b = lp[i][1], s, d, m;
        o1 = __builtin_add_overflow(a, b, &s);
        o2 = __builtin_sub_overflow(a, b, &d);
        o3 = __builtin_mul_overflow(a, b, &m);
        int narrow = __builtin_add_overflow(a, b, &r);
        printf("long %ld %ld: add %ld %d sub %ld %d mul %ld %d int %d %d\n",
               a, b, s, o1, d, o2, m, o3, r, narrow);
    }

    n = sizeof up / sizeof up[0];
    for (int i = 0; i < n; i++) {
        unsigned a = up[i][0], b = up[i][1], s, d, m;
        o1 = __builtin_add_overflow(a, b, &s);
        o2 = __builtin_sub_overflow(a, b, &d);
        o3 = __builtin_mul_overflow(a, b, &m);
        printf("uint %u %u: add %u %d sub %u %d mul %u %d wrap %u %u %u\n",
               a, b, s, o1, d, o2, m, o3, a + b, a - b, a * b);
    }

    n = sizeof ulp / sizeof ulp[0];
    for (int i = 0; i < n; i++) {
        unsigned long a = ulp[i][0], b = ulp[i][1], s, d, m;
        o1 = __builtin_add_overflow(a, b, &s);
        o2 = __builtin_sub_overflow(a, b, &d);
        o3 = __builtin_mul_overflow(a, b, &m);
        printf("ulong %lx %lx: add %lx %d sub %lx %d mul %lx %d\n",
               a, b, s, o1, d, o2, m, o3);
    }

    /* Narrow unsigned types wrap when stored back. */
    volatile unsigned char c = 250;
    volatile unsigned short h = 65530;
    unsigned char c2 = c + 10;
    unsigned short h2 = h + 10;
    unsigned char c3 = c * c;
    printf("narrow %d %d %d %d\n", c2, h2, c3, (unsigned char)(0 - c));

    /* A 192-bit add and subtract, one limb at a time through the carry. */
    volatile unsigned long av[3] = {ULONG_MAX, ULONG_MAX, 5};
    volatile unsigned long bv[3] = {1, 0, 7};
    unsigned long sum[3], dif[3];
    int carry = 0, borrow = 0;
    for (int i = 0; i < 3; i++) {
        unsigned long t;
        int c1 = __builtin_add_overflow(av[i], bv[i], &t);
        int c2b = __builtin_add_overflow(t, (unsigned long)carry, &sum[i]);
        carry = c1 | c2b;
        int b1 = __builtin_sub_overflow(bv[i], av[i], &t);
        int b2 = __builtin_sub_overflow(t, (unsigned long)borrow, &dif[i]);
        borrow = b1 | b2;
    }
    printf("add192 %lx %lx %lx carry %d\n", sum[2], sum[1], sum[0], carry);
    printf("sub192 %lx %lx %lx borrow %d\n", dif[2], dif[1], dif[0], borrow);

    /* Saturating add written in C: gcc tends to use the carry flag here. */
    unsigned sat = 0;
    for (int i = 0; i < 5; i++) {
        unsigned t = sat + up[i][0];
        sat = t < sat ? UINT_MAX : t;
        printf("sat %u\n", sat);
    }

    /* Hashes and generators that live on wrapping multiplies. */
    printf("fnv32 %08x %08x\n", fnv32("the quick brown fox"), fnv32(""));
    printf("fnv64 %016lx %016lx\n", fnv64("jumps over the lazy dog"), fnv64("a"));
    unsigned long x = 1;
    unsigned w = 12345;
    for (int i = 0; i < 1000; i++) {
        x = x * 6364136223846793005UL + 1442695040888963407UL;
        w = w * 1103515245u + 12345u;
    }
    printf("lcg %016lx %08x\n", x, w);
    printf("neg %u %lu %u\n", 0u - (unsigned)ip[1][0], 0UL - (unsigned long)lp[1][0],
           -(unsigned)up[0][0]);
    return 0;
}
