/* Tries to break 128-bit integer code: adds/adc carry chains, mul/umulh/smulh, register-pair arguments and constant shifts across the halves. */
#include <stdio.h>
#include <limits.h>

/* Division, modulo, variable shifts and double conversions of __int128
   are left out on purpose: gcc calls libgcc helpers for those. */
typedef unsigned __int128 u128;
typedef __int128 i128;

/* Decimal printing with 64-bit division only: four 32-bit limbs divided
   by 10^9 at a time, so no 128-bit divide is ever emitted. */
static void print_u128(u128 v)
{
    unsigned limb[4] = {(unsigned)(v >> 96), (unsigned)(v >> 64),
                        (unsigned)(v >> 32), (unsigned)v};
    unsigned chunk[5];
    int n = 0;
    for (;;) {
        unsigned long rem = 0;
        int more = 0;
        for (int i = 0; i < 4; i++) {
            unsigned long cur = (rem << 32) | limb[i];
            limb[i] = (unsigned)(cur / 1000000000UL);
            rem = cur % 1000000000UL;
            more |= limb[i] != 0;
        }
        chunk[n++] = (unsigned)rem;
        if (!more)
            break;
    }
    printf("%u", chunk[n - 1]);
    while (--n > 0)
        printf("%09u", chunk[n - 1]);
}

static void print_i128(i128 v)
{
    if (v < 0) {
        printf("-");
        print_u128(-(u128)v);
    } else {
        print_u128((u128)v);
    }
}

static void hex128(const char *label, u128 v)
{
    printf("%s %016lx%016lx\n", label, (unsigned long)(v >> 64), (unsigned long)v);
}

/* AAPCS64 puts a 128-bit argument in an even/odd register pair, skipping
   a register if needed, and on the stack once x0-x7 run out. */
static i128 mix(long a, i128 b, long c, i128 d, long e, long f, long g, i128 h)
{
    return b * a + d * c - h + e + f + g;
}

static volatile unsigned long hv[] = {0x0123456789abcdefUL, 0xfedcba9876543210UL,
                                      0x1111111111111111UL, 0x2222222222222222UL};
static volatile long sv[] = {LONG_MIN, LONG_MAX, -1, 3, -5};

int main(void)
{
    /* Factorials to 34! fit; 35! wraps modulo 2^128. */
    u128 f = 1;
    for (int k = 1; k <= 35; k++) {
        f *= (unsigned)k;
        if (k >= 20 && k <= 34 && (k % 5 == 0 || k >= 33)) {
            printf("%d! = ", k);
            print_u128(f);
            printf("\n");
        }
    }
    hex128("35! hex", f);

    /* Fibonacci through the carry: fib(94) is the first past 2^64. */
    u128 a = 0, b = 1;
    for (int k = 1; k <= 187; k++) {
        u128 t = a + b;
        a = b;
        b = t;
        if (k == 93 || k == 94 || k == 150 || k == 185 || k == 186) {
            printf("fib(%d) = ", k);
            print_u128(a);
            printf("\n");
        }
    }
    hex128("fib(187) wrapped", a);

    /* 64x64 -> 128 widening multiplies, unsigned and signed. */
    unsigned long umax = ULONG_MAX;
    hex128("umax*umax", (u128)umax * umax);
    for (int i = 0; i < 5; i++)
        for (int j = i; j < 5; j++) {
            i128 p = (i128)sv[i] * sv[j];
            printf("%ld * %ld = ", sv[i], sv[j]);
            print_i128(p);
            printf(" high %ld\n", (long)(p >> 64));
        }

    /* A full 128x128 product: mul, umulh and two madds. */
    u128 x = ((u128)hv[0] << 64) | hv[1];
    u128 y = ((u128)hv[2] << 64) | hv[3];
    hex128("x*y", x * y);
    hex128("x+y", x + y);
    hex128("x-y", x - y);
    hex128("y-x", y - x);
    hex128("-x", -x);
    hex128("~x", ~x);

    /* Constant shifts across and past the 64-bit seam. */
    hex128("x<<1", x << 1);
    hex128("x<<63", x << 63);
    hex128("x<<64", x << 64);
    hex128("x<<65", x << 65);
    hex128("x<<127", x << 127);
    hex128("x>>1", x >> 1);
    hex128("x>>64", x >> 64);
    hex128("x>>127", x >> 127);
    i128 neg = -(i128)x;   /* x < 2^127, so this is defined */
    hex128("neg>>1", (u128)(neg >> 1));
    hex128("neg>>100", (u128)(neg >> 100));

    /* Signed and unsigned compares disagree once the top bit is set. */
    i128 vals[6] = {(i128)x, -(i128)x, 0, -1, (i128)LONG_MIN, (i128)1 << 100};
    unsigned order_s = 0, order_u = 0;
    for (int i = 0; i < 6; i++)
        for (int j = 0; j < 6; j++) {
            order_s = order_s * 3 + (vals[i] < vals[j]) + 2 * (vals[i] == vals[j]);
            order_u = order_u * 3 + ((u128)vals[i] < (u128)vals[j]);
        }
    printf("orders %08x %08x\n", order_s, order_u);

    /* Widening conversions: sign extension into the high half, or not. */
    hex128("from int -5", (u128)(i128)(int)sv[4]);
    hex128("from long -5", (u128)(i128)sv[4]);
    hex128("from ulong", (u128)(unsigned long)sv[4]);
    printf("truncate %ld %d\n", (long)(x * y), (int)(x * y));

    i128 m = mix(sv[3], (i128)x, sv[4], -(i128)y, 7, 8, 9, (i128)1 << 90);
    printf("mix = ");
    print_i128(m);
    printf("\n");
    return 0;
}
