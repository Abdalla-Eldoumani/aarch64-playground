/* Tries to break: variable-length arrays that move sp at run time: released per loop pass, sized per recursion level, and live across stack-argument calls. */
#include <stdio.h>

static volatile int loop_size = 6000;
static volatile int loop_passes = 1500;
static volatile int mat_n = 7;
static volatile int rec_top = 180;

/* 1500 passes of a 6000-byte array is 9 MB: if leaving the block does
   not give the space back, the 8 MB stack wall stops the run. */
static unsigned long long churn(void)
{
    unsigned long long s = 0;
    int pass;

    for (pass = 0; pass < loop_passes; pass++) {
        unsigned char v[loop_size + (pass & 7)];
        int last = (int)sizeof v - 1;

        v[0] = (unsigned char)pass;
        v[last / 2] = (unsigned char)(pass >> 3);
        v[last] = (unsigned char)(pass * 7);
        s = s * 33 + v[0] + v[last / 2] + v[last] + (unsigned)last;
        if (pass % 500 == 0)
            printf("churn pass=%d size=%d s=%llu\n", pass, last + 1, s);
    }
    return s;
}

/* 2D VLA parameters: row stride n*8 is only known at run time */
static void matmul(int n, long long a[n][n], long long b[n][n], long long c[n][n])
{
    int i, j, k;

    for (i = 0; i < n; i++)
        for (j = 0; j < n; j++) {
            c[i][j] = 0;
            for (k = 0; k < n; k++)
                c[i][j] += a[i][k] * b[k][j];
        }
}

/* each level owns an array sized by its depth and checks it after the
   deeper levels (and their arrays) have come and gone */
static long long levels(int n)
{
    int v[n + 1];
    long long s = 0;
    int i;

    for (i = 0; i <= n; i++)
        v[i] = i * n - 50;
    if (n > 0)
        s = levels(n - 1);
    for (i = 0; i <= n; i++)
        s += v[i];
    return s;
}

/* nine arguments: the ninth goes on the stack below a live VLA */
static long long nine(long long a, long long b, long long c, long long d, long long e,
                      long long f, long long g, long long h, long long i)
{
    return a + 2 * b + 3 * c + 4 * d + 5 * e + 6 * f + 7 * g + 8 * h + 9 * i;
}

static long long with_vla_and_call(int n)
{
    long long v[n];
    long long s = 0;
    int i;

    for (i = 0; i < n; i++)
        v[i] = i * i;
    for (i = 0; i + 8 < n; i += 5)
        s += nine(v[i], v[i + 1], v[i + 2], v[i + 3], v[i + 4], v[i + 5], v[i + 6], v[i + 7], v[i + 8]);
    return s + v[n - 1];
}

int main(void)
{
    int n = mat_n, i, j, found = -1;
    long long a[n][n], b[n][n], c[n][n];
    long long trace = 0;

    printf("churn=%llu\n", churn());

    for (i = 0; i < n; i++)
        for (j = 0; j < n; j++) {
            a[i][j] = i * 3 - j;
            b[i][j] = (i == j) + j - 2 * i;
        }
    matmul(n, a, b, c);
    for (i = 0; i < n; i++) {
        trace += c[i][i];
        printf("row %d: %lld %lld %lld\n", i, c[i][0], c[i][n / 2], c[i][n - 1]);
    }
    printf("trace=%lld sizeof row=%d sizeof matrix=%d\n", trace, (int)sizeof a[0], (int)sizeof c);

    /* leave a VLA scope with break: sp has to come back all the same */
    for (i = 1; i < 100; i++) {
        short t[i * 3];

        t[i * 3 - 1] = (short)(i * -1111);
        if (i * 3 > 50) {
            found = t[i * 3 - 1];
            break;
        }
    }
    printf("found=%d at i=%d\n", found, i);

    printf("levels=%lld\n", levels(rec_top));
    printf("vla+call=%lld\n", with_vla_and_call(40 + mat_n));
    return 0;
}
