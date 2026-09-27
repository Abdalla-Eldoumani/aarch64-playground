/* Tries to break: static locals: same-named statics in three functions, .data pointers with addends into other statics, and narrow counters that wrap. */
#include <stdio.h>

static volatile int rounds = 300;

/* one name, three objects: gcc spells them hits.0, hits.1, hits.2 */
static int tick_a(void) { static int hits; return ++hits; }
static int tick_b(void) { static int hits = 100; return hits += 2; }
static int tick_c(void) { static int hits = -5; return hits *= -2; }

/* narrow statics: the store must truncate and the load must extend */
static unsigned char wrap8(void) { static unsigned char c = 250; return c++; }
static unsigned short wrap16(void) { static unsigned short s = 65530; return s += 3; }
static signed char swrap(void) { static signed char c = 120; c += 5; return c; }

/* .data words holding the address of another static plus an offset */
static int cursor_next(void)
{
    static int pool[8] = { 11, 22, 33, 44, 55, 66, 77, 88 };
    static int *cur = &pool[5];
    static int *const end = pool + 8;
    int v = *cur;

    *cur += 100;
    if (++cur == end)
        cur = pool;
    return v;
}

/* a .rodata table of pointers to .rodata strings, and a .data pointer into it */
static const char *name_of(int i)
{
    static const char *const names[] = { "zero", "one", "two", "three", "four" };
    static const char *const *last = &names[4];

    if (i >= 5) {
        last = last == names ? &names[4] : last - 1;
        return *last;
    }
    return names[i];
}

/* padding between char, long long, short and a byte array; plain char is
   unsigned on AArch64, so tag wraps to 157 where an ldrsb would say -99 */
struct mixed {
    char tag;
    unsigned long long big;
    short s;
    unsigned char b[3];
};

static const struct mixed *state(void)
{
    static struct mixed m = { 'q', 0x0123456789abcdefULL, -2, { 250, 251, 252 } };

    m.tag++;
    m.big = (m.big << 4) | (m.big >> 60);
    m.s -= 3;
    m.b[m.tag % 3]++;
    return &m;
}

/* a function pointer in .data, swapped on every call */
static int add1(int x) { return x + 1; }
static int dbl(int x) { return x * 2; }
static int apply_next(int x)
{
    static int (*op)(int) = add1;
    int r = op(x);

    op = op == add1 ? dbl : add1;
    return r;
}

/* statics shared by every level of a recursion, unlike its locals */
static int fib_probe(int n, int report)
{
    static int calls, now, deepest;
    int r;

    if (report) {
        printf("fib calls=%d deepest=%d now=%d\n", calls, deepest, now);
        calls = deepest = 0;
        return 0;
    }
    calls++;
    if (++now > deepest)
        deepest = now;
    r = n < 2 ? n : fib_probe(n - 1, 0) + fib_probe(n - 2, 0);
    now--;
    return r;
}

/* a 4000-byte zeroed static (.bss) and an exact double in .data */
static int histogram(int v)
{
    static int hist[1000];
    static int total;

    hist[v % 1000]++;
    total++;
    return hist[v % 1000] * 10000 + total;
}

static double halves(void)
{
    static double d = 0.1;
    static long long big = -9000000000000000000LL;

    d *= 2;
    big = big / 3 - 1;
    printf("d=%.17g big=%lld\n", d, big);
    return d;
}

int main(void)
{
    int i, h = 0, ops = 0, cur = 0;
    const struct mixed *m = 0;

    for (i = 0; i < rounds; i++) {
        int a = tick_a(), b = tick_b();
        unsigned char c8 = wrap8();
        unsigned short c16 = wrap16();
        signed char sc = swrap();

        cur += cursor_next();
        ops = apply_next(ops) % 100003;
        h = histogram(i * 37 % 1100);
        m = state();
        if (i % 50 == 0 || i == rounds - 1)
            printf("i=%d a=%d b=%d c8=%u c16=%u sc=%d cur=%d ops=%d h=%d\n",
                   i, a, b, c8, c16, sc, cur, ops, h);
    }
    /* rounds is volatile, so gcc cannot prove m was set: without the test
       -O2 plants a trap on the null path */
    if (m)
        printf("tag=%d big=%016llx s=%d b=%u,%u,%u\n", m->tag, m->big, m->s, m->b[0], m->b[1], m->b[2]);
    for (i = 0; i < 10; i++)
        printf("c=%d ", tick_c());
    printf("\n");
    for (i = 0; i < 8; i++)
        printf("%s ", name_of(i));
    printf("\n");
    printf("fib(16)=%d\n", fib_probe(16, 0));
    fib_probe(0, 1);
    printf("fib(9)=%d\n", fib_probe(9, 0));
    fib_probe(0, 1);
    for (i = 0; i < 5; i++)
        halves();
    return 0;
}
