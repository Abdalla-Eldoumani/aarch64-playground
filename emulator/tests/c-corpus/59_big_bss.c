/* Tries to break: about 990 KB of .bss (just under a 1 MiB section window), symbol+offset addresses deep inside it, and zero fill on every page. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SIEVE_N 150001
#define LIMIT 8000

/* an odd byte count, so whatever follows has to be realigned */
static unsigned char sieve[SIEVE_N];
long long wide[60000];
struct cell {
    int c;
    short a;
    signed char b;
    int d;
};
struct cell grid[300][100];
int marker[4] = { 0x11111111, 0x22222222, 0x33333333, 0x44444444 };

static volatile int limit = LIMIT;

/* one byte per 4 KB page plus the last byte: all of it must read zero */
static int nonzero(const unsigned char *p, long n)
{
    long i;
    int bad = 0;

    for (i = 0; i < n; i += 4096)
        bad += p[i] != 0;
    return bad + (p[n - 1] != 0);
}

/* a 2000-byte static local that also lands in .bss */
static int gap_stats(int gap, int report)
{
    static unsigned short counts[1000];
    int i, best = 0;

    if (!report) {
        counts[gap]++;
        return 0;
    }
    /* counts[0] stays zero (no gap is 0), so any real gap beats it */
    for (i = 1; i < 1000; i++)
        if (counts[i] > counts[best])
            best = i;
    for (i = 999; i > 0 && counts[i] == 0; i--)
        ;
    printf("gaps: twins=%u gap6=%u commonest=%d widest=%d (x%u)\n",
           counts[2], counts[6], best, i, counts[i]);
    return i;
}

int main(void)
{
    long i, j, primes = 0, last = 0, prev = 2;
    unsigned long long psum = 0, wsum = 0, gsum = 0, hsum = 0;
    unsigned char *heap;
    int r, c;

    printf("zero: sieve=%d wide=%d grid=%d\n", nonzero(sieve, sizeof sieve),
           nonzero((unsigned char *)wide, sizeof wide), nonzero((unsigned char *)grid, sizeof grid));

    sieve[SIEVE_N - 1] = 0xab;
    wide[59999] = -1;
    grid[299][99].d = 0x7eadbeef;
    printf("edges: wide[0]=%lld grid[0][0].c=%d marker[3]=%x\n", wide[0], grid[0][0].c, marker[3]);

    for (i = 2; i * i < limit; i++)
        if (!sieve[i])
            for (j = i * i; j < limit; j += i)
                sieve[j] = 1;
    for (i = 2; i < limit; i++) {
        if (sieve[i])
            continue;
        primes++;
        psum += (unsigned long long)i * i;
        if (i > 2)
            gap_stats((int)(i - prev), 0);
        prev = i;
        last = i;
    }
    printf("sieve: %ld primes below %d, last=%ld, sum of squares=%llu\n", primes, limit, last, psum);
    gap_stats(0, 1);

    for (i = 0; i < 60000; i += 997)
        wide[i] = (long long)i * i * i - i;
    for (i = 0; i < 60000; i += 997)
        wsum = wsum * 7 + (unsigned long long)wide[i];
    wsum += (unsigned long long)wide[59999] + (unsigned long long)wide[30000];
    printf("wide: sum=%llu wide[59820]=%lld wide[59999]=%lld\n", wsum, wide[59820], wide[59999]);

    for (r = 0; r < 300; r += 7)
        for (c = 0; c < 100; c += 3) {
            grid[r][c].c = r * c;
            grid[r][c].a = (short)(r - c);
            grid[r][c].b = (signed char)((r * 3 + c) % 200 - 100);
            grid[r][c].d = -r;
        }
    for (r = 0; r < 300; r += 5)
        for (c = 0; c < 100; c += 3)
            gsum = gsum * 3 + (unsigned)(grid[r][c].c + grid[r][c].a + grid[r][c].b + grid[r][c].d);
    printf("grid: sum=%llu last.d=%x cell[294][99].b=%d\n", gsum, grid[299][99].d, grid[294][99].b);

    heap = malloc(200000);
    if (!heap)
        return 1;
    memset(heap, 0x5c, 200000);
    for (i = 0; i < 200000; i += 1000)
        hsum += heap[i] + (unsigned long long)i;
    free(heap);
    printf("heap: sum=%llu, then sieve[last]=%x wide[59999]=%lld marker=%x,%x,%x,%x\n", hsum,
           sieve[SIEVE_N - 1], wide[59999], marker[0], marker[1], marker[2], marker[3]);
    return 0;
}
