/* Tries to break: narrowing and extension of char/short arguments around a 3-way mutual recursion cycle, plus Hofstadter F/M and tak. */
#include <stdio.h>

static volatile int cycle_len = 3000;
static volatile int fm_top = 24;
static volatile int tak_x = 12, tak_y = 7, tak_z = 3;

static unsigned long long ping(signed char a, unsigned long long acc, int n);
static unsigned long long pong(unsigned short b, unsigned long long acc, int n);
static unsigned long long pang(int c, unsigned long long acc, int n);

/* Each hop narrows the value into a different width, so every link needs
   the right sxtb/uxth/sxtw on the way in. The calls are in tail position,
   so -O2 turns the cycle into three branches and -O0 into 3000 frames. */
static unsigned long long ping(signed char a, unsigned long long acc, int n)
{
    if (n % 1500 == 0)
        printf("ping n=%d a=%d acc=%llu\n", n, a, acc);
    if (n == 0)
        return acc;
    return pong((unsigned short)(a * 300), acc * 3 + (unsigned long long)(long long)a, n - 1);
}

static unsigned long long pong(unsigned short b, unsigned long long acc, int n)
{
    if (n == 0)
        return acc ^ b;
    return pang((int)b - 40000, acc + b, n - 1);
}

static unsigned long long pang(int c, unsigned long long acc, int n)
{
    if (n == 0)
        return acc - (unsigned long long)(long long)c;
    return ping((signed char)(c ^ n), acc - (unsigned long long)(long long)c, n - 1);
}

/* Hofstadter female and male sequences: each call nests a call to the
   other inside its own argument, so the return value of one frame is the
   argument of the next and a wrong w0 derails the rest of the row. */
static int hof_m(int n);
static int hof_f(int n)
{
    return n == 0 ? 1 : n - hof_m(hof_f(n - 1));
}
static int hof_m(int n)
{
    return n == 0 ? 0 : n - hof_f(hof_m(n - 1));
}

/* Takeuchi: three recursive calls feed a fourth, 2809 calls in all. */
static long tak_calls;
static int tak(int x, int y, int z)
{
    tak_calls++;
    if (y < x)
        return tak(tak(x - 1, y, z), tak(y - 1, z, x), tak(z - 1, x, y));
    return z;
}

/* A frame with a 256-byte array alternates with a frame holding nothing,
   so sp moves by two different amounts on every other level. */
static int small_side(int n);
static int big_side(int n)
{
    unsigned char pad[256];
    int i, s = 0;

    for (i = 0; i < 256; i += 51)
        pad[i] = (unsigned char)(n + i);
    if (n > 0)
        s = small_side(n - 1);
    for (i = 0; i < 256; i += 51)
        s += pad[i];
    return s;
}
static int small_side(int n)
{
    return n > 0 ? big_side(n - 1) + 1 : 0;
}

int main(void)
{
    int i, t;

    printf("cycle=%llu\n", ping(-77, 1, cycle_len));

    printf("F:");
    for (i = 0; i <= fm_top; i++)
        printf(" %d", hof_f(i));
    printf("\nM:");
    for (i = 0; i <= fm_top; i++)
        printf(" %d", hof_m(i));
    printf("\n");

    /* its own statement: argument evaluation order is unspecified */
    t = tak(tak_x, tak_y, tak_z);
    printf("tak=%d calls=%ld\n", t, tak_calls);
    printf("big/small=%d\n", big_side(601));
    return 0;
}
