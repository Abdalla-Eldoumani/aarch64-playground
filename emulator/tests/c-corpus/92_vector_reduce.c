/* Tries to break the vector unit gcc -O2 reaches for: widening sums, dot products and min/max reductions across lanes. */
#include <stdio.h>
#include <limits.h>

/* Globals with a fixed count that is a multiple of 16 let gcc's -O2
   vectoriser replace each loop whole, with no scalar tail. Every
   accumulator is wide enough, or unsigned, so no sum overflows. */
#define N 256

static int a32[N], b32[N];
static unsigned u32a[N], u32b[N];
static short a16[N], b16[N];
static unsigned char u8a[N], u8b[N];
static signed char s8a[N];
static long a64[N];

static volatile unsigned seed = 2463534242u;

static void fill(void)
{
    unsigned x = seed;
    for (int i = 0; i < N; i++) {
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        a32[i] = (int)(x >> 5) - (1 << 26);        /* about +-2^26 */
        b32[i] = (int)(x % 200003u) - 100001;
        u32a[i] = x;
        u32b[i] = x * 2654435761u;
        a16[i] = (short)((int)(x >> 16) % 2048 - 1024);
        b16[i] = (short)((int)(x & 0x7ff) - 1024);
        u8a[i] = (unsigned char)(x >> 8);
        u8b[i] = (unsigned char)(x >> 20);
        s8a[i] = (signed char)(x >> 24);
        a64[i] = (long)x * 3 - (1L << 32);
    }
    /* Pin extremes at fixed lanes, where a lane mistake shows. */
    a32[5] = (1 << 26) - 1;
    a32[N - 1] = -(1 << 26);
    u32a[7] = UINT_MAX;
    a16[3] = -1024;
    u8a[0] = 255;
    u8b[0] = 0;
    s8a[1] = -128;
    s8a[2] = 127;
}

static long sum_i32(void) { long s = 0; for (int i = 0; i < N; i++) s += a32[i]; return s; }
static unsigned sum_u32(void) { unsigned s = 0; for (int i = 0; i < N; i++) s += u32a[i]; return s; }
static int sum_i16(void) { int s = 0; for (int i = 0; i < N; i++) s += a16[i]; return s; }
static unsigned sum_u8(void) { unsigned s = 0; for (int i = 0; i < N; i++) s += u8a[i]; return s; }
static int sum_s8(void) { int s = 0; for (int i = 0; i < N; i++) s += s8a[i]; return s; }
static long sum_i64(void) { long s = 0; for (int i = 0; i < N; i++) s += a64[i]; return s; }

static int dot_i16(void) { int s = 0; for (int i = 0; i < N; i++) s += a16[i] * b16[i]; return s; }
static long dot_i32(void) { long s = 0; for (int i = 0; i < N; i++) s += (long)a32[i] * b32[i]; return s; }
static unsigned dot_u32(void) { unsigned s = 0; for (int i = 0; i < N; i++) s += u32a[i] * u32b[i]; return s; }
static unsigned dot_u8(void) { unsigned s = 0; for (int i = 0; i < N; i++) s += u8a[i] * u8b[i]; return s; }
static int dot_s8u8(void) { int s = 0; for (int i = 0; i < N; i++) s += s8a[i] * u8b[i]; return s; }
static long sq_i16(void) { long s = 0; for (int i = 0; i < N; i++) s += a16[i] * a16[i]; return s; }

static int max_i32(void) { int m = INT_MIN; for (int i = 0; i < N; i++) m = a32[i] > m ? a32[i] : m; return m; }
static int min_i32(void) { int m = INT_MAX; for (int i = 0; i < N; i++) m = a32[i] < m ? a32[i] : m; return m; }
static unsigned max_u32(void) { unsigned m = 0; for (int i = 0; i < N; i++) m = u32b[i] > m ? u32b[i] : m; return m; }
static int min_u8(void) { unsigned char m = 255; for (int i = 1; i < N; i++) m = u8b[i] < m ? u8b[i] : m; return m; }
static int max_s8(void) { signed char m = -128; for (int i = 0; i < N; i++) m = s8a[i] > m ? s8a[i] : m; return m; }
static short min_i16(void) { short m = SHRT_MAX; for (int i = 0; i < N; i++) m = b16[i] < m ? b16[i] : m; return m; }

static unsigned sad_u8(void)
{
    unsigned s = 0;
    for (int i = 0; i < N; i++) {
        int d = u8a[i] - u8b[i];
        s += d < 0 ? -d : d;
    }
    return s;
}

static int count_pos(void) { int c = 0; for (int i = 0; i < N; i++) c += a32[i] > 0; return c; }
static unsigned xor_u32(void) { unsigned x = 0; for (int i = 0; i < N; i++) x ^= u32a[i]; return x; }
static unsigned or_u8(void) { unsigned char o = 0; for (int i = 0; i < N; i++) o |= u8a[i] & 0x81; return o; }
static long wsum_u32(void) { long s = 0; for (int i = 0; i < N; i++) s += u32a[i]; return s; }

int main(void)
{
    fill();
    printf("sum i32 %ld u32 %u i16 %d u8 %u s8 %d i64 %ld wide u32 %ld\n",
           sum_i32(), sum_u32(), sum_i16(), sum_u8(), sum_s8(), sum_i64(), wsum_u32());
    printf("dot i16 %d i32 %ld u32 %u u8 %u s8u8 %d sq16 %ld\n",
           dot_i16(), dot_i32(), dot_u32(), dot_u8(), dot_s8u8(), sq_i16());
    printf("max i32 %d min i32 %d max u32 %u min u8 %d max s8 %d min i16 %d\n",
           max_i32(), min_i32(), max_u32(), min_u8(), max_s8(), min_i16());
    printf("sad %u positive %d xor %08x or %02x\n", sad_u8(), count_pos(), xor_u32(), or_u8());

    /* Change one lane at each position and redo the sum: a reduction that
       drops or doubles a lane moves this checksum. */
    unsigned long check = 0;
    for (int k = 0; k < 16; k++) {
        a32[k] += 1000 * (k + 1);
        u8a[k] ^= 0x5a;
        check = check * 1000003 + (unsigned long)sum_i32() + sum_u8() + (unsigned)dot_i16();
    }
    printf("lane check %016lx\n", check);
    return 0;
}
