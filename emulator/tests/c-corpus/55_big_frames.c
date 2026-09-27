/* Tries to break: frames past 4 KB, 32 KB and 64 KB, where sp offsets outgrow the load/store immediates and gcc adds stack probes. */
#include <stdio.h>
#include <string.h>

static volatile int knob = 3;
static volatile int deep_levels = 100;

/* byte offsets past 4095 cannot sit in an ldrb/strb immediate */
static unsigned long long frame_4k(int seed)
{
    unsigned char b[4100];
    unsigned long long s = 0;
    int i;

    memset(b, seed, sizeof b);
    for (i = 1; i < 4100; i += 13)
        b[i] = (unsigned char)(seed + i * 7);
    b[4099] ^= 0x3c;
    b[2050] += 9;
    for (i = 0; i < 4100; i += 5)
        s = s * 31 + b[i];
    return s + b[4099];
}

/* 8-byte offsets past 32760 cannot sit in an ldr/str immediate */
static unsigned long long frame_40k(int seed)
{
    long long v[5000];
    unsigned long long s = 0;
    int i;

    memset(v, 0, sizeof v);
    for (i = 0; i < 5000; i += 97)
        v[i] = (long long)seed * i - 77777;
    v[4999] = -1234567890123LL;
    v[2500] = v[4999] / seed;
    for (i = 0; i < 5000; i += 7)
        s += (unsigned long long)v[i] ^ (s >> 3);
    return s + (unsigned long long)(v[4999] + v[2500]);
}

/* 72000 bytes is past the 64 KB guard, so a stack-clash build probes it */
static unsigned long long frame_72k(int seed)
{
    int w[18000];
    unsigned long long s = 0;
    int i;

    memset(w, 0xff, sizeof w);
    for (i = 0; i < 18000; i += 1000)
        w[i] = i ^ seed;
    w[17999] = seed << 20;
    for (i = 0; i < 18000; i += 250)
        s = s * 3 + (unsigned)w[i];
    return s + (unsigned)w[17999];
}

/* 600 KB in one frame: the page cap and the stack wall both see it */
static unsigned long long frame_600k(int seed)
{
    unsigned char big[600000];
    unsigned long long s = 0;
    int i;

    memset(big, seed, sizeof big);
    for (i = 0; i < 600000; i += 4096)
        big[i] = (unsigned char)(i >> 12);
    big[599999] = 0x77;
    for (i = 0; i < 600000; i += 1777)
        s = s * 7 + big[i];
    return s + big[599999] + big[300000];
}

/* 100 levels of 8 KB frames, checked after every return */
static unsigned long long deep8k(int n)
{
    unsigned char pad[8192];
    unsigned long long r;

    memset(pad, n, sizeof pad);
    pad[4096] = (unsigned char)(n * 3);
    if (n == 0)
        return pad[4096];
    r = deep8k(n - 1);
    return r * 3 + pad[0] + pad[4096] + pad[8191];
}

/* the two stack arguments sit above a 40 KB frame */
static long long far_args(long long a, long long b, long long c, long long d, long long e,
                          long long f, long long g, long long h, long long i, long long j)
{
    long long v[5000];
    long long s = 0;
    int k;

    memset(v, 0, sizeof v);
    for (k = 0; k < 5000; k += 499)
        v[k] = a * k + b - c + d - e + f - g + h;
    v[4999] = i * j;
    for (k = 0; k < 5000; k += 499)
        s += v[k];
    return s + v[4999] - i + j;
}

/* 4800 bytes: passed as a pointer to a caller-made copy, returned via x8 */
struct blob {
    long long v[600];
};

static struct blob twist(struct blob b, int k)
{
    int i;

    for (i = 0; i < 600; i++)
        b.v[i] = b.v[i] * k + b.v[599 - i];
    b.v[599] ^= k;
    return b;
}

static void show(const char *name, const struct blob *b)
{
    long long s = 0;
    int i;

    for (i = 0; i < 600; i++)
        s += b->v[i];
    printf("%s: sum=%lld first=%lld last=%lld\n", name, s, b->v[0], b->v[599]);
}

int main(void)
{
    struct blob b1, b2, b3;
    int i;

    printf("frame_4k=%llu\n", frame_4k(knob));
    printf("frame_40k=%llu\n", frame_40k(knob));
    printf("frame_72k=%llu\n", frame_72k(knob));
    printf("frame_600k=%llu\n", frame_600k(knob));
    printf("deep8k=%llu\n", deep8k(deep_levels));
    printf("far_args=%lld\n", far_args(1, 2, 3, 4, 5, 6, 7, 8, -9, knob * 1000));

    for (i = 0; i < 600; i++)
        b1.v[i] = i * 3 - 900;
    b2 = twist(b1, knob);
    b3 = twist(twist(b2, 5), 7);
    show("b1", &b1);
    show("b2", &b2);
    show("b3", &b3);
    return 0;
}
