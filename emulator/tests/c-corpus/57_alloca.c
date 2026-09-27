/* Tries to break: alloca blocks that pile up until return, keep sp 16-byte aligned for libc calls, chain through recursion, and survive a VLA scope. */
#include <stdio.h>
#include <string.h>
#include <alloca.h>

static volatile int calls = 3000;
static volatile int odd_sizes[6] = { 1, 3, 17, 33, 100, 4097 };
static volatile int chain_depth = 120;

/* Odd sizes must still hand back 16-byte-aligned blocks (the result is
   printed as a remainder, never as an address), and every libc call made
   right after must pass the emulator's sp alignment check. */
static void odd(void)
{
    int k;

    for (k = 0; k < 6; k++) {
        int n = odd_sizes[k];
        char *p = alloca(n);

        memset(p, 'a' + k, n);
        p[n - 1] = 0;
        printf("alloca(%d): mod16=%d len=%d first=%c\n", n,
               (int)((unsigned long)p % 16), (int)strlen(p), n > 1 ? p[0] : '-');
    }
}

/* Blocks from earlier passes stay allocated: later ones must not land on
   top of them. Each block holds a string written by sprintf. */
static void pile(void)
{
    char *blocks[40];
    int i, total = 0;

    for (i = 0; i < 40; i++) {
        blocks[i] = alloca(24 + i);
        sprintf(blocks[i], "block %d of %d", i, 40);
    }
    for (i = 0; i < 40; i++)
        total += (int)strlen(blocks[i]) * (i + 1);
    printf("pile: %s | %s | total=%d\n", blocks[0], blocks[39], total);
}

/* 4 KB per call, 3000 calls: 12 MB if the epilogue failed to give it back */
static int once(int i)
{
    unsigned char *p = alloca(4096);

    p[0] = (unsigned char)i;
    p[4095] = (unsigned char)(i >> 4);
    return p[0] + p[4095];
}

/* each level links its alloca block to the parent's through an argument */
struct link {
    struct link *up;
    long long vals[4];
};

static unsigned long long chain(int n, struct link *up)
{
    struct link *me = alloca(sizeof *me);
    unsigned long long s = 0;
    int k;

    me->up = up;
    for (k = 0; k < 4; k++)
        me->vals[k] = (long long)n * (k + 1) - 200;
    if (n > 0)
        return chain(n - 1, me);
    for (k = 0; me; me = me->up, k++)
        s = s * 3 + (unsigned long long)me->vals[k % 4];
    return s + k;
}

/* alloca before a VLA scope, then check it after the scope has closed */
static int survive(int n)
{
    int *keep = alloca(n * sizeof *keep);
    int i, s = 0;

    for (i = 0; i < n; i++)
        keep[i] = i * i;
    {
        int vla[n * 4];

        for (i = 0; i < n * 4; i++)
            vla[i] = -1;
        s += vla[n];
    }
    for (i = 0; i < n; i++)
        s += keep[i];
    return s;
}

/* 70000 bytes in one call: past the 64 KB guard, so a stack-clash build probes it */
static unsigned big(int n)
{
    unsigned char *p = alloca(n);
    unsigned s = 0;
    int i;

    memset(p, 0x11, n);
    for (i = 0; i < n; i += 4099)
        p[i] = (unsigned char)i;
    for (i = 0; i < n; i += 997)
        s = s * 5 + p[i];
    return s + p[n - 1];
}

int main(void)
{
    long long sum = 0;
    int i;

    odd();
    pile();
    for (i = 0; i < calls; i++)
        sum += once(i);
    printf("once x%d: sum=%lld\n", calls, sum);
    printf("chain=%llu\n", chain(chain_depth, 0));
    printf("survive=%d\n", survive(25));
    printf("big=%u\n", big(70000));
    return 0;
}
