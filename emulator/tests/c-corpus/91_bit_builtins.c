/* Tries to break the bit-count instructions: cnt/addv popcounts, clz, rbit+clz, cls and rev, checked against plain loops. */
#include <stdio.h>

/* Needs the SIMD registers (no -mgeneral-regs-only): gcc computes a
   popcount with fmov, cnt and addv, and would call libgcc without them.
   clz and ctz are undefined for 0 in C, so every call guards it. */
static const unsigned char nibble_bits[16] = {0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4};

static int pop_ref(unsigned long x)
{
    int c = 0;
    for (int i = 0; i < 16; i++)
        c += nibble_bits[(x >> (4 * i)) & 15];
    return c;
}

static int clz_ref(unsigned long x)
{
    int n = 0;
    for (unsigned long m = 1UL << 63; m && !(x & m); m >>= 1)
        n++;
    return n;
}

static int ctz_ref(unsigned long x)
{
    int n = 0;
    for (unsigned long m = 1; m && !(x & m); m <<= 1)
        n++;
    return n;
}

static int clz32(unsigned x) { return x ? __builtin_clz(x) : 32; }
static int ctz32(unsigned x) { return x ? __builtin_ctz(x) : 32; }
static int clz64(unsigned long x) { return x ? __builtin_clzl(x) : 64; }
static int ctz64(unsigned long x) { return x ? __builtin_ctzl(x) : 64; }

static volatile unsigned long vals[] = {
    0, 1, 2, 3, 0x80, 0xff, 0x8000000000000000UL, 0xffffffffffffffffUL,
    0x7fffffffffffffffUL, 0x00000000ffffffffUL, 0xffffffff00000000UL,
    0x0123456789abcdefUL, 0xfedcba9876543210UL, 0x8000000000000001UL,
    0x0000000100000000UL, 0xaaaaaaaaaaaaaaaaUL, 0x0000000080000000UL,
};

int main(void)
{
    int n = sizeof vals / sizeof vals[0];
    for (int i = 0; i < n; i++) {
        unsigned long v = vals[i];
        unsigned w = (unsigned)v;
        printf("%016lx pop %d %d clz %d %d ctz %d %d cls %d %d\n", v,
               __builtin_popcount(w), __builtin_popcountl(v), clz32(w), clz64(v),
               ctz32(w), ctz64(v), __builtin_clrsb((int)w), __builtin_clrsbl((long)v));
        printf("  ffs %d %d parity %d %d bswap %04x %08x %016lx\n",
               __builtin_ffs((int)w), __builtin_ffsl((long)v), __builtin_parity(w),
               __builtin_parityl(v), (unsigned)__builtin_bswap16((unsigned short)w),
               __builtin_bswap32(w), __builtin_bswap64(v));
    }

    /* 256 pseudo-random words: builtins against the loops. */
    unsigned long x = 0x9e3779b97f4a7c15UL;
    long pop_sum = 0, clz_sum = 0, ctz_sum = 0;
    int bad = 0;
    for (int i = 0; i < 256; i++) {
        x = x * 6364136223846793005UL + 1442695040888963407UL;
        /* Thin some words out so the counts cover the whole range. */
        unsigned long v = x >> (x & 63);
        if (i & 1)
            v &= x << (i % 61);
        int p = __builtin_popcountl(v), l = clz64(v), t = ctz64(v);
        pop_sum += p;
        clz_sum += l;
        ctz_sum += t;
        bad += p != pop_ref(v);
        bad += l != clz_ref(v);
        bad += t != ctz_ref(v);
        bad += __builtin_popcount((unsigned)v) != pop_ref(v & 0xffffffffUL);
    }
    printf("sums pop %ld clz %ld ctz %ld mismatches %d\n", pop_sum, clz_sum, ctz_sum, bad);

    /* Everyday uses: log2, next power of two, walking the set bits. */
    volatile unsigned long sizes[] = {1, 2, 3, 1000, 4096, 4097, 0x8000000000000000UL};
    for (int i = 0; i < 7; i++) {
        unsigned long s = sizes[i];
        int lg = 63 - clz64(s);
        unsigned long up = s == 1 ? 1 : (s > (1UL << 63) ? 0 : 1UL << (64 - clz64(s - 1)));
        printf("log2(%lu) = %d, next pow2 %lu\n", s, lg, up);
    }
    unsigned long bits = vals[11];
    printf("set bits of %lx:", bits);
    while (bits) {
        printf(" %d", ctz64(bits));
        bits &= bits - 1;
    }
    printf("\n");

    /* popcount of every 12-bit value: 12 * 2^11 when the unit is right. */
    long total = 0;
    for (unsigned k = 0; k < 4096; k++)
        total += __builtin_popcount(k);
    printf("popcount total %ld\n", total);
    return 0;
}
