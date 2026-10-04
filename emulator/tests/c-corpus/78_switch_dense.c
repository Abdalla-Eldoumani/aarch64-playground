/* Tries to break dense switch jump tables: word, halfword and byte offset entries, ranges straddling zero, 64-bit indices, and a switch into a loop body. */
#include <stdio.h>
#include <limits.h>

/* Every input passes through this, so plain -O2 cannot fold the calls away. */
static volatile int vzero = 0;

static unsigned mix(unsigned x, unsigned c)
{
    x ^= c;
    x *= 0x01000193u;
    return x ^ (x >> 13);
}

/* Different work per case keeps a real jump table instead of a lookup array;
   INT_MIN and INT_MAX must both miss through the unsigned bounds check. */
static int around(int v, int x)
{
    switch (v) {
    case -4: return x * 2;
    case -3: return x + 30;
    case -2: return x - 20;
    case -1: return x ^ 1;
    case 0: return x;
    case 1: return x / 2;
    case 2: return x % 7;
    case 3: return x * x;
    case 4: return x - 1000;
    case 5: return x | 0x101;
    case 6: return x & 0xf0;
    case 7: return -x;
    default: return 1000 + v % 7;
    }
}

/* Two calls with distinct 32-bit constants per case push the far cases out
   of a byte offset's reach, so the table needs wider entries. */
#define BIG(n) case n: r = mix(mix(x, 0x9e3779b9u * (n + 1)), 0x85ebca6bu ^ (n * 0x01010101u)); break;
static unsigned big(int k, unsigned x)
{
    unsigned r;
    switch (k) {
    BIG(0) BIG(1) BIG(2) BIG(3) BIG(4) BIG(5) BIG(6) BIG(7) BIG(8) BIG(9) BIG(10) BIG(11)
    BIG(12) BIG(13) BIG(14) BIG(15) BIG(16) BIG(17) BIG(18) BIG(19) BIG(20) BIG(21) BIG(22) BIG(23)
    BIG(24) BIG(25) BIG(26) BIG(27) BIG(28) BIG(29) BIG(30) BIG(31) BIG(32) BIG(33) BIG(34) BIG(35)
    BIG(36) BIG(37) BIG(38) BIG(39) BIG(40) BIG(41) BIG(42) BIG(43) BIG(44) BIG(45) BIG(46) BIG(47)
    default: r = 0xffffffffu;
    }
    return r;
}

/* Biased range: the index is m - 1 before the bounds check. */
static const char *month(int m)
{
    switch (m) {
    case 1: return "jan"; case 2: return "feb"; case 3: return "mar"; case 4: return "apr";
    case 5: return "may"; case 6: return "jun"; case 7: return "jul"; case 8: return "aug";
    case 9: return "sep"; case 10: return "oct"; case 11: return "nov"; case 12: return "dec";
    default: return "?";
    }
}

/* A 64-bit index: 0x100000003 must not land on case 3. */
static long wide(long v, long x)
{
    switch (v) {
    case 0: return x + 100;
    case 1: return x - 100;
    case 2: return x * 7;
    case 3: return x ^ 0x7f;
    case 4: return x << 3;
    case 5: return x >> 2;
    case 6: return x / 9;
    case 7: return x % 1000;
    case 8: return ~x;
    case 9: return x & 0xffff;
    case 10: return x - (x >> 5);
    case 11: return x % 77 + 1;
    default: return -1;
    }
}

/* Grouped labels: many table entries share one target. */
static int cls(int c)
{
    switch (c) {
    case 'a': case 'e': case 'i': case 'o': case 'u':
    case 'A': case 'E': case 'I': case 'O': case 'U': return 0;
    case '0': case '1': case '2': case '3': case '4':
    case '5': case '6': case '7': case '8': case '9': return 1;
    case ' ': case '\t': case '\n': return 2;
    case '.': case ',': case ';': case '!': case '?': return 3;
    case 0: return 5;
    default: return 4;
    }
}

/* Duff's device: the switch jumps into the middle of the loop body. */
static void duff(int *to, const int *from, int count)
{
    int n = (count + 7) / 8;
    switch (count % 8) {
    case 0: do { *to++ = *from++; /* fall through */
    case 7:      *to++ = *from++; /* fall through */
    case 6:      *to++ = *from++; /* fall through */
    case 5:      *to++ = *from++; /* fall through */
    case 4:      *to++ = *from++; /* fall through */
    case 3:      *to++ = *from++; /* fall through */
    case 2:      *to++ = *from++; /* fall through */
    case 1:      *to++ = *from++;
            } while (--n > 0);
    }
}

int main(void)
{
    int z = vzero, i, k;
    printf("around:");
    for (k = -6; k <= 9; k++) printf(" %d", around(k + z, 50 + k));
    printf(" %d %d\n", around(INT_MIN + z, 5), around(INT_MAX + z, 5));

    for (k = -1; k <= 48; k++)
        printf("%s%08x", (k + 1) % 5 ? " " : (k < 0 ? "big: " : "\nbig: "), big(k + z, 0x1234u + k));
    printf("\n");

    int ms[] = {INT_MIN, -1, 0, 1, 2, 6, 11, 12, 13, 14, INT_MAX};
    printf("month:");
    for (i = 0; i < 11; i++) printf(" %s", month(ms[i] + z));
    printf("\n");

    long ws[] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, -1, 0x100000003L,
                 0x7fffffff00000005L, LONG_MIN, LONG_MAX, 0xffffffffL};
    printf("wide:");
    for (i = 0; i < 19; i++) printf(" %ld", wide(ws[i] + z, 0x123456789L + z));
    printf("\n");

    const char *text = "Hello, World! 42 apples; 7 oranges?\t\x80\xff. Quiet x9 zone";
    int counts[6] = {0};
    printf("cls: ");
    for (i = 0; text[i]; i++) {
        int c = cls((unsigned char)text[i] + z);
        counts[c]++;
        putchar('0' + c);
    }
    printf("\ncounts: %d %d %d %d %d %d\n", counts[0], counts[1], counts[2], counts[3], counts[4],
           cls(z));

    int src[24], dst[24];
    for (i = 0; i < 24; i++) src[i] = i * i + 1;
    printf("duff:");
    for (k = 1; k <= 20; k++) {
        int ok = 1, sum = 0;
        for (i = 0; i < 24; i++) dst[i] = -1;
        duff(dst, src, k + z);
        for (i = 0; i < k; i++) { ok &= dst[i] == src[i]; sum += dst[i]; }
        ok &= dst[k] == -1;
        printf(" %d%c", sum, ok ? '+' : '!');
    }
    printf("\n");
    return 0;
}
