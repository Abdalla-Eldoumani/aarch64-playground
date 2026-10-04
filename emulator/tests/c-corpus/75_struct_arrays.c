/* Tries to break: arrays of structs with awkward strides (12, 20, 24, 36 bytes): index math, exact-division pointer differences, whole-element swaps, a two-key sort, and a heap array grown with realloc. */
#include <stdio.h>
#include <stdlib.h>

struct s12 { int id; short a, b; int c; };        /* 12 bytes */
struct s20 { int k[5]; };                         /* 20 bytes */
struct s24 { long key; int sub; char name[8]; };  /* 24 bytes */
struct s36 { char tag; int v[8]; };               /* 36 bytes */

struct s12 grid[5][7];                            /* .bss, 84-byte rows */

/* 12 bytes by value: x0 and x1. */
long score(struct s12 s) {
    return (long)s.id * 1000 + s.a * 10 + s.b - s.c;
}

/* Element differences divide by the stride; for 12, 24 and 36 gcc shifts and
   multiplies by the stride's inverse instead of dividing. */
void distances(struct s12 *a, struct s24 *b, struct s36 *c, int i, int j) {
    printf("d %d %d: %ld %ld %ld bytes %ld\n", i, j, (long)(&a[j] - &a[i]), (long)(&b[j] - &b[i]),
           (long)(&c[j] - &c[i]), (long)((char *)&c[j] - (char *)&c[i]));
}

/* Insertion sort on (key ascending, sub descending); every move is a 24-byte copy. */
void sort24(struct s24 *v, int n) {
    for (int i = 1; i < n; i++) {
        struct s24 t = v[i];
        int j = i - 1;
        while (j >= 0 && (v[j].key > t.key || (v[j].key == t.key && v[j].sub < t.sub))) {
            v[j + 1] = v[j];
            j--;
        }
        v[j + 1] = t;
    }
}

/* Index of the first element with this key, or -1. */
int find24(const struct s24 *v, int n, long key) {
    int lo = 0, hi = n;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (v[mid].key < key) lo = mid + 1; else hi = mid;
    }
    return lo < n && v[lo].key == key ? lo : -1;
}

struct s36 bump(struct s36 s, int k) {
    s.tag = (char)(s.tag + 1);
    for (int i = 0; i < 8; i++) s.v[i] += k * i;
    return s;
}

void reverse36(struct s36 *v, int n) {
    for (int i = 0, j = n - 1; i < j; i++, j--) {
        struct s36 t = v[i];
        v[i] = v[j];
        v[j] = t;
    }
}

struct vec { struct s20 *p; int n, cap; };

/* x arrives as a pointer to a caller-made copy: 20 bytes is over the 16-byte limit. */
int push(struct vec *v, struct s20 x) {
    if (v->n == v->cap) {
        int cap = v->cap ? v->cap * 2 : 1;
        struct s20 *p = realloc(v->p, cap * sizeof *p);
        if (!p) return 0;
        v->p = p;
        v->cap = cap;
        printf("grow %d\n", cap);
    }
    v->p[v->n++] = x;
    return 1;
}

volatile int knob = 7;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    int k = knob;
    struct s12 a[10];
    struct s24 b[12];
    struct s36 c[6];
    for (int i = 0; i < 10; i++) a[i] = (struct s12){ i, (short)(i - k), (short)(i * k), i * i - 7 };
    for (int i = 0; i < 12; i++) {
        b[i].key = (i * 5) % k - 3;
        b[i].sub = i;
        for (int j = 0; j < 7; j++) b[i].name[j] = (char)('a' + (i * 3 + j * k) % 26);
        b[i].name[7] = 0;
    }
    for (int i = 0; i < 6; i++) {
        c[i].tag = (char)('A' + i);
        for (int j = 0; j < 8; j++) c[i].v[j] = i * 10 + j;
    }

    long total = 0;
    for (int i = 0; i < 10; i++) total += score(a[i]);
    printf("score %ld last %ld\n", total, score(a[9]));
    distances(a, b, c, 1, 5);
    distances(a, b, c, k - 2, 0);

    sort24(b, 12);
    for (int i = 0; i < 12; i++) printf("%ld:%d:%s%c", b[i].key, b[i].sub, b[i].name, i % 4 == 3 ? '\n' : ' ');
    for (long key = -4; key <= 4; key++) printf("%d%c", find24(b, 12, key), key == 4 ? '\n' : ' ');

    c[2] = bump(c[2], k);
    reverse36(c, 6);
    for (int i = 0; i < 6; i++) printf("%c%d,%d%c", c[i].tag, c[i].v[1], c[i].v[7], i == 5 ? '\n' : ' ');

    for (int r = 0; r < 5; r++)
        for (int col = 0; col < 7; col++)
            grid[r][col] = (struct s12){ r * 7 + col, (short)(r - col), (short)(r * col), r * r - col * col };
    long diag = 0, column = 0;
    for (int i = 0; i < 5; i++) {
        diag += score(grid[i][i]);
        column += score(grid[i][6]);
    }
    printf("grid %ld %ld %d\n", diag, column, (int)((char *)&grid[4][6] - (char *)&grid[0][0]));

    struct vec v = { 0, 0, 0 };
    for (int i = 0; i < 40; i++) {
        struct s20 x = {{ i, -i, i * i, i ^ k, 40 - i }};
        if (!push(&v, x)) { printf("out of memory\n"); return 1; }
    }
    long check = 0;
    for (int i = 0; i < v.n; i++)
        for (int j = 0; j < 5; j++) check = (check * 31 + v.p[i].k[j]) % 1000000007L;
    printf("vec %d %d %ld\n", v.n, v.cap, check);
    free(v.p);
    printf("sizes %d %d %d %d\n", (int)sizeof(struct s12), (int)sizeof(struct s20),
           (int)sizeof(struct s24), (int)sizeof(struct s36));
    return 0;
}
