/* Tries to break shifts: counts at or past the width, which the register forms reduce to their low 5 or 6 bits. */
#include <stdio.h>

/* C makes a shift by the width or more undefined. The register-shift
   instructions define it: a W shift uses only the low 5 bits of the
   count and an X shift the low 6. Inline asm reaches that answer. */
static unsigned lsl_w(unsigned x, unsigned n)
{
    unsigned r;
    __asm__("lsl %w0, %w1, %w2" : "=r"(r) : "r"(x), "r"(n));
    return r;
}

static unsigned lsr_w(unsigned x, unsigned n)
{
    unsigned r;
    __asm__("lsr %w0, %w1, %w2" : "=r"(r) : "r"(x), "r"(n));
    return r;
}

static int asr_w(int x, unsigned n)
{
    int r;
    __asm__("asr %w0, %w1, %w2" : "=r"(r) : "r"(x), "r"(n));
    return r;
}

static unsigned ror_w(unsigned x, unsigned n)
{
    unsigned r;
    __asm__("ror %w0, %w1, %w2" : "=r"(r) : "r"(x), "r"(n));
    return r;
}

static unsigned long lsl_x(unsigned long x, unsigned long n)
{
    unsigned long r;
    __asm__("lsl %x0, %x1, %x2" : "=r"(r) : "r"(x), "r"(n));
    return r;
}

static unsigned long lsr_x(unsigned long x, unsigned long n)
{
    unsigned long r;
    __asm__("lsr %x0, %x1, %x2" : "=r"(r) : "r"(x), "r"(n));
    return r;
}

static long asr_x(long x, unsigned long n)
{
    long r;
    __asm__("asr %x0, %x1, %x2" : "=r"(r) : "r"(x), "r"(n));
    return r;
}

static unsigned long ror_x(unsigned long x, unsigned long n)
{
    unsigned long r;
    __asm__("ror %x0, %x1, %x2" : "=r"(r) : "r"(x), "r"(n));
    return r;
}

/* The defined C spellings of the same answers. */
static unsigned shl_masked(unsigned x, unsigned n) { return x << (n & 31); }
static unsigned shl_zero_past(unsigned x, unsigned n) { return n >= 32 ? 0 : x << n; }
static unsigned rot_c(unsigned x, unsigned n) { return (x >> (n & 31)) | (x << (-n & 31)); }
static unsigned long funnel(unsigned long hi, unsigned long lo, unsigned k)
{
    return (hi << (64 - k)) | (lo >> k);   /* k is 1..63 */
}

static volatile unsigned wv = 0xdeadbeefu;
static volatile unsigned long xv = 0x8123456789abcdefUL;
static volatile unsigned counts[] = {0, 1, 31, 32, 33, 63, 64, 65, 100, 255, 0xffffffe1u};

int main(void)
{
    unsigned w = wv;
    unsigned long x = xv;
    int n = sizeof counts / sizeof counts[0];

    for (int i = 0; i < n; i++) {
        unsigned c = counts[i];
        printf("n=%u w: %08x %08x %08x %08x x: %016lx %016lx %016lx %016lx\n", c,
               lsl_w(w, c), lsr_w(w, c), (unsigned)asr_w((int)w, c), ror_w(w, c),
               lsl_x(x, c), lsr_x(x, c), (unsigned long)asr_x((long)x, c), ror_x(x, c));
    }

    /* Sweep every count to 130 and fold the answers; count disagreements
       between the hardware forms and their defined C spellings. */
    unsigned long sum = 0;
    int bad = 0;
    for (unsigned c = 0; c <= 130; c++) {
        sum = sum * 31 + lsl_w(w, c);
        sum = sum * 31 + lsr_w(w, c);
        sum = sum * 31 + (unsigned)asr_w((int)w, c);
        sum = sum * 31 + ror_w(w, c);
        sum = sum * 31 + lsl_x(x, c);
        sum = sum * 31 + lsr_x(x, c);
        sum = sum * 31 + (unsigned long)asr_x((long)x, c);
        sum = sum * 31 + ror_x(x, c);
        bad += lsl_w(w, c) != shl_masked(w, c);
        bad += ror_w(w, c) != rot_c(w, c);
        bad += lsr_x(x, c) != x >> (c & 63);
        bad += (c < 32 ? lsl_w(w, c) : 0) != shl_zero_past(w, c);
    }
    printf("sweep %016lx mismatches %d\n", sum, bad);

    for (unsigned c = 30; c <= 34; c++)
        printf("zero-past %u: %08x masked %08x\n", c, shl_zero_past(w, c), shl_masked(w, c));

    /* Right shifts of negative values: gcc defines these as arithmetic. */
    volatile int neg[] = {-1, -2, -5, -2147483647 - 1};
    for (int i = 0; i < 4; i++) {
        int v = neg[i];
        long lv = (long)v * 4294967296L;
        printf("%d >>1 %d >>31 %d | %ld >>1 %ld >>63 %ld >>33 %ld\n",
               v, v >> 1, v >> 31, lv, lv >> 1, lv >> 63, lv >> 33);
    }

    /* Promotions: a small type is an int before it is shifted. */
    volatile unsigned char b = 0x81;
    volatile unsigned short h = 0x8001;
    printf("byte %d %d %d %d\n", b << 1, (unsigned char)(b << 1), b >> 7,
           (signed char)b >> 1);
    printf("half %u %d %u\n", (unsigned)h << 16, h >> 15, (unsigned)(unsigned short)(h << 1));

    /* Field extracts and funnel shifts that map to ubfx, sbfx and extr. */
    unsigned long hi = xv, lo = ~xv;
    printf("ubfx %lx sbfx %d\n", (x >> 7) & 0x1f, (int)(w << 20) >> 27);
    for (unsigned k = 1; k < 64; k += 13)
        printf("extr %u %016lx\n", k, funnel(hi, lo, k));
    printf("extr fixed %016lx %016lx\n", (hi << 13) | (lo >> 51), (lo << 60) | (hi >> 4));
    printf("rot %08x %08x %08x\n", rot_c(w, 0), rot_c(w, 8), rot_c(w, 31));
    return 0;
}
