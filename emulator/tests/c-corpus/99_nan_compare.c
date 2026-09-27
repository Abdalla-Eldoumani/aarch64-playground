/* Tries to break floating-point comparison: every relational form and quiet builtin against NaN, signed zeros, infinities and subnormals, plus selects, range tests, and a NaN-aware sort. */
#include <stdio.h>

static unsigned long dbits(double d) { union { double d; unsigned long u; } v; v.d = d; return v.u; }

#define NV 10
static volatile double vals[NV] = {
    -__builtin_inf(), -1.5, -0x1p-1074, -0.0, 0.0, 0x1p-1074, 1.5, __builtin_inf(),
    __builtin_nan(""), -__builtin_nan(""),
};

/* One call per pair, so each comparison is a real FCMP or FCMPE and a
   condition code at every optimisation level. */
static void relations(double a, double b, char *out)
{
    out[0] = '0' + (a < b);
    out[1] = '0' + (a <= b);
    out[2] = '0' + (a > b);
    out[3] = '0' + (a >= b);
    out[4] = '0' + (a == b);
    out[5] = '0' + (a != b);
    out[6] = '0' + __builtin_isless(a, b);
    out[7] = '0' + __builtin_islessequal(a, b);
    out[8] = '0' + __builtin_isgreater(a, b);
    out[9] = '0' + __builtin_isgreaterequal(a, b);
    out[10] = '0' + __builtin_islessgreater(a, b);
    out[11] = '0' + __builtin_isunordered(a, b);
    out[12] = '0' + !(a < b);
    out[13] = '0' + !(a >= b);
    /* -O2 turns these selects into FCSEL; which operand survives is
       told apart by its bits, since NaN never compares equal. */
    double lo = a < b ? a : b, hi = a >= b ? a : b;
    out[14] = dbits(lo) == dbits(a) ? 'a' : 'b';
    out[15] = dbits(hi) == dbits(a) ? 'a' : 'b';
    out[16] = 0;
}

static int cmp3(double a, double b)
{
    if (a < b)
        return '<';
    if (a > b)
        return '>';
    if (a == b)
        return '=';
    return '?';
}

/* Compound conditions: -O2 chains the second compare with FCCMP/FCCMPE. */
static int inside(double x, double lo, double hi) { return x >= lo && x <= hi; }
static int outside(double x, double lo, double hi) { return x < lo || x > hi; }
static int both_less(double a, double b, double c, double d) { return a < b && c < d; }
static int either_eq(float a, float b, float c) { return a == b || a == c; }

/* NaNs sort last and -0 before +0; everything else by value. */
static int before(double a, double b)
{
    if (b != b)
        return a == a;
    if (a != a)
        return 0;
    if (a < b)
        return 1;
    return a == b && __builtin_signbit(a) && !__builtin_signbit(b);
}

static void sort(double *x, int n)
{
    for (int i = 1; i < n; i++) {
        double t = x[i];
        int j = i;
        while (j > 0 && before(t, x[j - 1])) {
            x[j] = x[j - 1];
            j--;
        }
        x[j] = t;
    }
}

int main(void)
{
    char out[17];
    puts("ij < <= > >= == != isless isle isgt isge islg isun !< !>= min max");
    for (int i = 0; i < NV; i++)
        for (int j = 0; j < NV; j++) {
            relations(vals[i], vals[j], out);
            printf("%d%d %s\n", i, j, out);
        }
    for (int i = 0; i < NV; i++) {
        printf("cmp%d ", i);
        for (int j = 0; j < NV; j++)
            putchar(cmp3(vals[i], vals[j]));
        putchar('\n');
    }

    for (int i = 0; i < NV; i++) {
        double x = vals[i];
        printf("range%d %d%d %d%d %d %d%d\n", i, inside(x, -1.5, 1.5), outside(x, -1.5, 1.5),
               inside(x, -0.0, 0.0), outside(x, -0.0, 0.0), inside(x, x, x),
               both_less(x, 1.0, -1.0, x), both_less(-x, x, x, 2.0));
    }

    volatile float fz = -0.0f, fnan = __builtin_nanf(""), f1 = 0.1f, fbig = 16777216.0f;
    volatile double d1 = 0.1, dbig = 16777217.0;
    printf("float %d%d%d %d%d%d %d%d%d%d\n", either_eq(fz, 0.0f, fnan), either_eq(fnan, fnan, fnan),
           either_eq(f1, fnan, 0.1f), f1 == d1, f1 > d1, (double)f1 < d1,
           fbig == dbig, fbig < dbig, (float)dbig == fbig, fz == 0.0f);

    double arr[16];
    for (int i = 0; i < NV; i++)
        arr[i] = vals[NV - 1 - i];
    arr[10] = 2.0;
    arr[11] = -0.0;
    arr[12] = vals[8];
    arr[13] = -2.0;
    arr[14] = 0.0;
    arr[15] = vals[5] * 3.0;
    sort(arr, 16);
    printf("sorted");
    for (int i = 0; i < 16; i++) {
        if (arr[i] != arr[i])
            printf(" nan:%016lx", dbits(arr[i]));
        else
            printf(" %g", arr[i]);
    }
    printf("\n");

    /* A NaN-skipping maximum and counts that NaN must not disturb. */
    double best = -__builtin_inf();
    int above = 0, below = 0, unordered = 0;
    for (int i = 0; i < 16; i++) {
        double x = arr[i];
        if (x > best)
            best = x;
        above += x > 0.0;
        below += x < 0.0;
        unordered += !(x <= 0.0) && !(x > 0.0);
    }
    printf("best %g above %d below %d unordered %d\n", best, above, below, unordered);
    return 0;
}
