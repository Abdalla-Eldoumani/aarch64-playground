/* Tries to break byte-wise vector code: compare-and-select case flips, saturating and rounding lane math, widening, narrowing and de-interleaving. */
#include <stdio.h>

/* Fixed-size global buffers so gcc's -O2 vectoriser can take each loop
   whole. Each transform writes dst, then a scalar hash of dst is printed:
   one wrong byte in any lane changes the hash. */
#define N 512

static unsigned char src[N], src2[N], dst[N], pair[2 * N];
static signed char sgn[N];
static unsigned short w16[N];
static unsigned w32[N / 4];

static volatile unsigned seed = 88172645u;
static const char text[] = "Hello, World! the quick brown fox jumps over the lazy dog 0123456789 ~{}";

static void fill(void)
{
    unsigned x = seed;
    for (int i = 0; i < N; i++) {
        x = x * 1664525u + 1013904223u;
        /* Half text, half noise, so both branches of each select run. */
        src[i] = (i & 32) ? (unsigned char)(x >> 24) : (unsigned char)text[i % (sizeof text - 1)];
        src2[i] = (unsigned char)(x >> 16);
        sgn[i] = (signed char)(x >> 8);
    }
    src[1] = 255;
    src2[1] = 255;
    src[2] = 0;
    src2[2] = 255;
    sgn[3] = -128;
}

static unsigned hash(const unsigned char *p, int n)
{
    unsigned h = 2166136261u;
    for (int i = 0; i < n; i++)
        h = (h ^ p[i]) * 16777619u;
    return h;
}

static void report(const char *name)
{
    printf("%-9s %08x %02x %02x %02x %02x %02x\n", name, hash(dst, N),
           dst[0], dst[1], dst[2], dst[3], dst[N - 1]);
}

static void xor_key(void) { for (int i = 0; i < N; i++) dst[i] = src[i] ^ 0x5a; }

static void to_upper(void)
{
    for (int i = 0; i < N; i++) {
        unsigned char c = src[i];
        dst[i] = (unsigned char)(c - 'a') < 26 ? c - 32 : c;
    }
}

static void rot13(void)
{
    for (int i = 0; i < N; i++) {
        unsigned char c = src[i];
        unsigned char r = c + 13 > 'z' ? c - 13 : c + 13;
        dst[i] = c >= 'a' && c <= 'z' ? r : c;
    }
}

static void sat_add(void) { for (int i = 0; i < N; i++) { int s = src[i] + src2[i]; dst[i] = s > 255 ? 255 : s; } }
static void sat_sub(void) { for (int i = 0; i < N; i++) { int s = src[i] - src2[i]; dst[i] = s < 0 ? 0 : s; } }
static void avg_round(void) { for (int i = 0; i < N; i++) dst[i] = (src[i] + src2[i] + 1) >> 1; }
static void abs_diff(void) { for (int i = 0; i < N; i++) dst[i] = src[i] > src2[i] ? src[i] - src2[i] : src2[i] - src[i]; }
static void max_u8(void) { for (int i = 0; i < N; i++) dst[i] = src[i] > src2[i] ? src[i] : src2[i]; }
static void rotl3(void) { for (int i = 0; i < N; i++) dst[i] = (unsigned char)((src[i] << 3) | (src[i] >> 5)); }
static void abs_s8(void) { for (int i = 0; i < N; i++) dst[i] = (unsigned char)(sgn[i] < 0 ? -sgn[i] : sgn[i]); }

/* Widen to 16 bits, multiply, then narrow back by the high byte. */
static void widen_mul(void) { for (int i = 0; i < N; i++) w16[i] = (unsigned short)(src[i] * 300 + src2[i]); }
static void narrow_hi(void) { for (int i = 0; i < N; i++) dst[i] = (unsigned char)(w16[i] >> 8); }

/* Pairs: de-interleave with a sum (ld2), then interleave (st2). */
static void pair_sum(void)
{
    for (int i = 0; i < N / 2; i++)
        dst[i] = src[2 * i] + src[2 * i + 1];
    for (int i = N / 2; i < N; i++)
        dst[i] = 0;
}

static void interleave(void) { for (int i = 0; i < N; i++) { pair[2 * i] = src[i]; pair[2 * i + 1] = src2[i]; } }

static int count_space(void) { int c = 0; for (int i = 0; i < N; i++) c += src[i] == ' '; return c; }

int main(void)
{
    fill();
    xor_key();   report("xor");
    to_upper();  report("upper");
    rot13();     report("rot13");
    sat_add();   report("sat_add");
    sat_sub();   report("sat_sub");
    avg_round(); report("avg");
    abs_diff();  report("absdiff");
    max_u8();    report("max");
    rotl3();     report("rotl3");
    abs_s8();    report("abs_s8");
    widen_mul(); narrow_hi(); report("narrow");
    pair_sum();  report("pairsum");
    interleave();
    printf("interleave %08x %02x %02x %02x\n", hash(pair, 2 * N), pair[0], pair[1], pair[2 * N - 1]);
    printf("wide %04x %04x %04x\n", w16[0], w16[1], w16[N - 1]);
    printf("spaces %d\n", count_space());

    /* Byte-swap every 32-bit word of src (rev32 on the vector side). */
    for (int i = 0; i < N / 4; i++)
        w32[i] = (unsigned)src[4 * i] | ((unsigned)src[4 * i + 1] << 8) |
                 ((unsigned)src[4 * i + 2] << 16) | ((unsigned)src[4 * i + 3] << 24);
    for (int i = 0; i < N / 4; i++)
        w32[i] = __builtin_bswap32(w32[i]);
    unsigned h = 0;
    for (int i = 0; i < N / 4; i++)
        h = h * 31 + w32[i];
    printf("bswap %08x %08x %08x\n", h, w32[0], w32[N / 4 - 1]);

    /* Run the chain a second time on its own output to catch stale lanes. */
    for (int i = 0; i < N; i++)
        src[i] = dst[i];
    to_upper();  report("again");
    return 0;
}
