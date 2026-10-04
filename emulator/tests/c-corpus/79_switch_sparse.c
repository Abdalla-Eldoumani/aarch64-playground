/* Tries to break sparse switches: compare trees on keys that need movz/movk or cmn, INT_MIN and INT_MAX edges, clustered sub-tables, bit-test lowering, and 64-bit keys. */
#include <stdio.h>
#include <limits.h>

/* Every input passes through this, so plain -O2 cannot fold the calls away. */
static volatile int vzero = 0;

static int sparse32(int v)
{
    switch (v) {
    case INT_MIN: return 1;      case -65536: return 2;
    case -4097: return 3;        case -4096: return 4;
    case -1: return 5;           case 0: return 6;
    case 4095: return 7;         case 4096: return 8;
    case 65535: return 9;        case 65536: return 10;
    case 0x12345: return 11;     case 0x7fff0000: return 12;
    case INT_MAX: return 13;     default: return 0;
    }
}

/* Three dense clusters far apart: gcc splits them into small tables behind a tree. */
#define CK(n, a, b) case n: return x * a + b;
static int clustered(int v, int x)
{
    switch (v) {
    CK(1, 3, 1) CK(2, 5, 2) CK(3, 7, 3) CK(4, 11, 4) CK(5, 13, 5) CK(6, 17, 6) CK(7, 19, 7) CK(8, 23, 8)
    CK(1000, 2, 100) CK(1001, 4, 101) CK(1002, 6, 102) CK(1003, 8, 103) CK(1004, 10, 104)
    CK(1005, 12, 105) CK(1006, 14, 106) CK(1007, 16, 107)
    CK(50000, 9, 500) CK(50001, 8, 501) CK(50002, 7, 502) CK(50003, 6, 503)
    CK(1 << 20, 99, 999)
    default: return -1;
    }
}

/* Few targets over under 64 values: gcc may test bits of a 64-bit mask.
   '@' sits at bit 31 and '`' at bit 63 counting from '!'. */
static int punct_kind(int c)
{
    switch (c) {
    case '(': case ')': case '[': case ']': return 1;
    case '+': case '-': case '*': case '/': case '=': case '<': case '>':
    case '^': case '%': case '&': case '@': case '!': return 2;
    case '\'': case '"': case '`': return 3;
    default: return 0;
    }
}

static int key64(unsigned long k)
{
    switch (k) {
    case 0: return 1;                      case 0xffffffffUL: return 2;
    case 0x100000000UL: return 3;          case 1UL << 40: return 4;
    case 0x7fffffffffffffffUL: return 5;   case 0x8000000000000000UL: return 6;
    case 0xdeadbeefcafebabeUL: return 7;   case 0xffffffffffffffffUL: return 8;
    default: return 0;
    }
}

static int skey64(long k)
{
    switch (k) {
    case LONG_MIN: return 1;      case -0x100000000L: return 2;
    case -4096L: return 3;        case -1L: return 4;
    case 0x80000000L: return 5;   case LONG_MAX: return 6;
    default: return 0;
    }
}

/* 46 labels over 2..199: a table where most entries point at default. */
static int is_small_prime(int n)
{
    switch (n) {
    case 2: case 3: case 5: case 7: case 11: case 13: case 17: case 19: case 23: case 29:
    case 31: case 37: case 41: case 43: case 47: case 53: case 59: case 61: case 67: case 71:
    case 73: case 79: case 83: case 89: case 97: case 101: case 103: case 107: case 109:
    case 113: case 127: case 131: case 137: case 139: case 149: case 151: case 157: case 163:
    case 167: case 173: case 179: case 181: case 191: case 193: case 197: case 199: return 1;
    default: return 0;
    }
}

/* The key is a sign-extended byte: -128 and 127 are neighbours of nothing. */
static int sc_kind(signed char c)
{
    switch (c) {
    case -128: return 1;   case -100: return 2;   case -1: return 3;
    case 0: return 4;      case 100: return 5;    case 127: return 6;
    default: return 0;
    }
}

int main(void)
{
    int z = vzero, i, d;
    unsigned sum = 0;
    static const long k32[] = {INT_MIN, -65536, -4097, -4096, -1, 0, 4095, 4096, 65535, 65536,
                               0x12345, 0x7fff0000, INT_MAX};
    printf("sparse32:");
    for (i = 0; i < 13; i++)
        for (d = -1; d <= 1; d++) {
            long t = k32[i] + d;
            if (t < INT_MIN || t > INT_MAX) continue;
            int r = sparse32((int)t + z);
            sum = sum * 31 + r;
            printf(" %d", r);
        }
    printf(" | %u\n", sum);

    static const int kc[] = {0, 1, 4, 8, 9, 999, 1000, 1003, 1007, 1008, 49999, 50000, 50003,
                             50004, (1 << 20) - 1, 1 << 20, (1 << 20) + 1, -1};
    printf("clustered:");
    for (i = 0; i < 18; i++) printf(" %d", clustered(kc[i] + z, 10 + i));
    printf("\n");

    printf("punct: ");
    for (i = 32; i < 128; i++) putchar('0' + punct_kind(i + z));
    printf(" %d %d %d\n", punct_kind(-1 + z), punct_kind(0x121 + z), punct_kind(0x40 + 64 + z));

    static const unsigned long k64[] = {0, 0xffffffffUL, 0x100000000UL, 1UL << 40,
                                        0x7fffffffffffffffUL, 0x8000000000000000UL,
                                        0xdeadbeefcafebabeUL, 0xffffffffffffffffUL,
                                        0x1ffffffffUL, 0xdeadbeef00000000UL, 0xcafebabeUL};
    printf("key64:");
    for (i = 0; i < 11; i++)
        printf(" %d%d%d", key64(k64[i] - 1 + z), key64(k64[i] + z), key64(k64[i] + 1 + z));
    printf("\n");

    static const long s64[] = {LONG_MIN, -0x100000000L, -4096L, -1L, 0x80000000L, LONG_MAX,
                               0x7fffffffL, -0x80000000L};
    printf("skey64:");
    for (i = 0; i < 8; i++) {
        long k = s64[i] + z;
        printf(" %d%d%d", k == LONG_MIN ? 9 : skey64(k - 1), skey64(k),
               k == LONG_MAX ? 9 : skey64(k + 1));
    }
    printf("\n");

    int np = 0;
    printf("primes:");
    for (i = -3; i <= 210; i++)
        if (is_small_prime(i + z)) { np++; if (i > 150) printf(" %d", i); }
    printf(" | %d\n", np);

    printf("schar:");
    for (i = 0; i < 256; i++) {
        int r = sc_kind((signed char)(i + z));
        if (r) printf(" %d:%d", i, r);
    }
    printf("\n");
    return 0;
}
