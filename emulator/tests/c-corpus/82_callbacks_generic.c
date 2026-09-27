/* Tries to break generic callback code: void pointer sorts and searches over element sizes 1 to 24 bytes, overlapping memmove shifts, comparators on unsigned and extreme keys, and callbacks that carry a context pointer. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

typedef int (*cmp_fn)(const void *, const void *, void *ctx);

/* Insertion sort: memmove slides the sorted run up one slot, overlapping itself. */
static void isort(void *base, size_t n, size_t sz, cmp_fn cmp, void *ctx)
{
    unsigned char *b = base, *tmp = malloc(sz);
    for (size_t i = 1; i < n; i++) {
        size_t j = i;
        memcpy(tmp, b + i * sz, sz);
        while (j > 0 && cmp(b + (j - 1) * sz, tmp, ctx) > 0) j--;
        memmove(b + (j + 1) * sz, b + j * sz, (i - j) * sz);
        memcpy(b + j * sz, tmp, sz);
    }
    free(tmp);
}

/* Stable top-down merge sort through one scratch buffer. */
static void msort_rec(unsigned char *b, unsigned char *t, size_t n, size_t sz, cmp_fn cmp, void *ctx)
{
    if (n < 2) return;
    size_t h = n / 2, i = 0, j = h, k = 0;
    msort_rec(b, t, h, sz, cmp, ctx);
    msort_rec(b + h * sz, t, n - h, sz, cmp, ctx);
    while (i < h || j < n) {
        int right = i == h || (j < n && cmp(b + j * sz, b + i * sz, ctx) < 0);
        memcpy(t + k++ * sz, b + (right ? j++ : i++) * sz, sz);
    }
    memcpy(b, t, n * sz);
}

static void msort(void *base, size_t n, size_t sz, cmp_fn cmp, void *ctx)
{
    unsigned char *t = malloc(n * sz);
    msort_rec(base, t, n, sz, cmp, ctx);
    free(t);
}

static size_t lower_bound(const void *key, const void *base, size_t n, size_t sz, cmp_fn cmp, void *ctx)
{
    size_t lo = 0, hi = n;
    while (lo < hi) {
        size_t mid = lo + (hi - lo) / 2;
        if (cmp((const unsigned char *)base + mid * sz, key, ctx) < 0) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

static int cmp_u8(const void *a, const void *b, void *ctx)
{ (void)ctx; return *(const unsigned char *)a - *(const unsigned char *)b; }
static int cmp_s16_desc(const void *a, const void *b, void *ctx)
{ (void)ctx; return *(const short *)b - *(const short *)a; }
/* Orders by the masked bits first, then the whole value. */
static int cmp_u32_mask(const void *a, const void *b, void *ctx)
{
    unsigned m = *(const unsigned *)ctx, x = *(const unsigned *)a, y = *(const unsigned *)b;
    if ((x & m) != (y & m)) return (x & m) < (y & m) ? -1 : 1;
    return (x > y) - (x < y);
}
static int cmp_s64_dir(const void *a, const void *b, void *ctx)
{
    long x = *(const long *)a, y = *(const long *)b;
    return ((x > y) - (x < y)) * *(const int *)ctx;
}

struct s12 { char tag; int seq; short w; };             /* 1 + 3 pad + 4 + 2 + 2 pad */
struct s24 { long key; char name[8]; unsigned seq; };   /* 8 + 8 + 4 + 4 pad */
static int cmp_s12_tag(const void *a, const void *b, void *ctx)
{ (void)ctx; return ((const struct s12 *)a)->tag - ((const struct s12 *)b)->tag; }
static int cmp_s24(const void *a, const void *b, void *ctx)
{
    const struct s24 *p = a, *q = b;
    int c = strncmp(p->name, q->name, sizeof p->name);
    (void)ctx;
    return c ? c : (p->key > q->key) - (p->key < q->key);
}

/* Sorts a copy both ways and reports whether the two sorts agree byte for byte. */
static void *sort_both(const void *src, size_t n, size_t sz, cmp_fn cmp, void *ctx, const char *tag)
{
    unsigned char *a = malloc(n * sz), *b = malloc(n * sz);
    memcpy(a, src, n * sz);
    memcpy(b, src, n * sz);
    isort(a, n, sz, cmp, ctx);
    msort(b, n, sz, cmp, ctx);
    printf("%s: n=%d size=%d agree=%d\n", tag, (int)n, (int)sz, memcmp(a, b, n * sz) == 0);
    free(b);
    return a;
}

/* Compacts the kept elements to the front; returns how many stayed. */
static size_t filter(void *base, size_t n, size_t sz, int (*keep)(const void *, void *), void *ctx)
{
    unsigned char *b = base;
    size_t out = 0;
    for (size_t i = 0; i < n; i++)
        if (keep(b + i * sz, ctx)) memmove(b + out++ * sz, b + i * sz, sz);
    return out;
}
static int divisible(const void *e, void *ctx) { return *(const long *)e % *(const long *)ctx == 0; }

int main(void)
{
    unsigned seed = 2024u;
    size_t i, n;
    unsigned char bytes[40];
    short sh[23];
    unsigned u32[17];
    for (i = 0; i < 40; i++) { seed = seed * 1664525u + 1013904223u; bytes[i] = (unsigned char)(seed >> 24); }
    for (i = 0; i < 23; i++) { seed = seed * 1664525u + 1013904223u; sh[i] = (short)(seed >> 16); }
    for (i = 0; i < 17; i++) { seed = seed * 1664525u + 1013904223u; u32[i] = seed; }
    sh[3] = SHRT_MIN; sh[9] = SHRT_MAX; u32[2] = 0xffffffffu; u32[5] = 0x80000000u; u32[6] = 0;

    unsigned char *sb = sort_both(bytes, 40, 1, cmp_u8, NULL, "u8");
    for (i = 0; i < 40; i++) printf("%02x", sb[i]);
    unsigned char key8 = 0x80;
    printf("\nlower_bound(0x80)=%d\n", (int)lower_bound(&key8, sb, 40, 1, cmp_u8, NULL));
    short *ss = sort_both(sh, 23, 2, cmp_s16_desc, NULL, "s16 desc");
    for (i = 0; i < 23; i++) printf(" %d", ss[i]);
    unsigned mask = 0x0f00000fu;
    unsigned *su = sort_both(u32, 17, 4, cmp_u32_mask, &mask, "\nu32 mask");
    for (i = 0; i < 17; i++) printf(" %08x", su[i]);

    long s64[] = {5, LONG_MIN, -1, LONG_MAX, 0, 1L << 40, -(1L << 40), 77, -77, 1, LONG_MIN + 1};
    int dir = -1;
    long *sl = sort_both(s64, 11, 8, cmp_s64_dir, &dir, "\ns64 desc");
    for (i = 0; i < 11; i++) printf(" %ld", sl[i]);
    printf("\n");

    struct s12 r12[14];
    struct s24 r24[9];
    memset(r12, 0, sizeof r12);   /* padding bytes take part in the memcmp */
    memset(r24, 0, sizeof r24);
    for (i = 0; i < 14; i++) { r12[i].tag = "dbcadbbcadcaab"[i]; r12[i].seq = (int)i; r12[i].w = (short)(i * 1000); }
    struct s12 *st = sort_both(r12, 14, sizeof r12[0], cmp_s12_tag, NULL, "s12 stable");
    for (i = 0; i < 14; i++) printf(" %c%d", st[i].tag, st[i].seq);
    printf("\n");

    const char *names[] = {"kilo", "alpha", "kilo", "echo", "alphabet", "", "alpha", "zulu", "echo"};
    for (i = 0; i < 9; i++) {
        strncpy(r24[i].name, names[i], 8);
        r24[i].key = (long)(i * 7 % 5) - 2;
        r24[i].seq = (unsigned)i;
    }
    struct s24 *s2 = sort_both(r24, 9, sizeof r24[0], cmp_s24, NULL, "s24");
    for (i = 0; i < 9; i++) printf(" %.8s/%ld/%u", s2[i].name, s2[i].key, s2[i].seq);
    struct s24 probe = {0, "echo", 0};
    printf("\nfind echo at %d\n", (int)lower_bound(&probe, s2, 9, sizeof probe, cmp_s24, NULL));

    long vals[20], by = 6;
    for (i = 0; i < 20; i++) vals[i] = (long)(i * i * 1000003) * (i % 3 ? 1 : -1);
    n = filter(vals, 20, sizeof vals[0], divisible, &by);
    printf("div6 (%d):", (int)n);
    for (i = 0; i < n; i++) printf(" %ld", vals[i]);
    printf("\n");
    free(sb); free(ss); free(su); free(sl); free(st); free(s2);
    return 0;
}
