/* Tries to break: whole-struct copies of odd sizes (overlapping unaligned tail loads, ldp/stp runs, memcpy for big ones), struct tables in .data, .rodata and .bss, designated and compound-literal initializers, and a flexible array member. */
#include <stdio.h>
#include <stdlib.h>

struct c13 { char b[13]; };
struct c33 { char b[33]; };
struct c47 { char b[47]; };
struct c100 { char b[100]; };

struct inner { short s[3]; char c; };                     /* 8 bytes */
struct outer { int id; struct inner in[3]; long tail; };  /* 40 bytes */
struct item { const char *name; int qty; double price; };
struct pt { int x, y; };
struct fam { int n; long v[]; };

struct item stock[4] = { { "bolt", 120, 0.25 }, { "nut", 300, 0.125 }, { "gear", 7, 12.5 }, { "cam", 2, 40.0 } };
const struct inner table[6] = { [1] = { { 1, 2, 3 }, 'x' }, [4] = { .c = 'y', .s[2] = -9 } };
struct c100 zeros[3];  /* .bss: all zero until written */
struct c33 g33;

/* 13 bytes by value in x0 and x1; the static local keeps its state between calls. */
int counter(struct c13 x) {
    static struct { int calls; long sum; } st;
    st.calls++;
    for (int i = 0; i < 13; i++) st.sum += x.b[i];
    return st.calls * 1000 + (int)(st.sum % 1000);
}

struct c100 make100(int seed) {
    struct c100 r;
    for (int i = 0; i < 100; i++) r.b[i] = (char)('a' + (seed + i * 7) % 26);
    return r;
}

long sum100(const struct c100 *p) {
    long s = 0;
    for (int i = 0; i < 100; i++) s = s * 3 % 1000003 + p->b[i];
    return s;
}

int manhattan(struct pt a, struct pt b) {
    return abs(a.x - b.x) + abs(a.y - b.y);
}

struct fam *mkfam(int n) {
    struct fam *f = malloc(sizeof *f + n * sizeof f->v[0]);
    if (!f) return 0;
    f->n = n;
    for (int i = 0; i < n; i++) f->v[i] = (long)i * i - 3;
    return f;
}

volatile int knob = 4;  /* read at run time so gcc cannot fold the calls away */

int main(void) {
    int k = knob;
    struct c33 a;
    for (int i = 0; i < 33; i++) a.b[i] = (char)('A' + (i * k) % 26);
    struct c33 b = a;  /* a 33-byte copy: gcc ends it with an overlapping unaligned load */
    b.b[0] = '*';
    b.b[32] = '!';
    g33 = b;
    b.b[16] = '-';
    printf("%.*s\n%.*s\n%.*s\n", 33, a.b, 33, b.b, 33, g33.b);

    struct c47 chain[4];
    for (int i = 0; i < 47; i++) chain[0].b[i] = (char)('0' + i % 10);
    for (int i = 1; i < 4; i++) {
        chain[i] = chain[i - 1];
        chain[i].b[i * 11] = (char)('a' + i);
        chain[i].b[46 - i] = '#';
    }
    for (int i = 0; i < 4; i++) printf("%.*s\n", 47, chain[i].b);

    struct c13 w;
    for (int i = 0; i < 13; i++) w.b[i] = (char)(i * k + 1);
    for (int i = 0; i < 3; i++) printf("counter %d\n", counter(w));

    zeros[1] = make100(k);
    printf("zeros %ld %ld %ld %.10s\n", sum100(&zeros[0]), sum100(&zeros[1]), sum100(&zeros[2]), zeros[1].b);

    struct outer o = { .id = 5, .in = { [2] = { { 7, 8, 9 }, 'q' } }, .tail = -1 };
    struct outer p = o;
    p.in[2].s[1] = 80;
    p.in[0].c = 'z';
    p.tail = o.tail * k;
    for (int i = 0; i < 3; i++)
        printf("outer %d: %d %d %d %d | %d %d %d %d\n", i, o.in[i].s[0], o.in[i].s[1], o.in[i].s[2],
               o.in[i].c, p.in[i].s[0], p.in[i].s[1], p.in[i].s[2], p.in[i].c);
    printf("tails %ld %ld sizes %d %d\n", o.tail, p.tail, (int)sizeof(struct inner), (int)sizeof(struct outer));

    for (int i = 0; i < 6; i++) {
        struct inner t = table[i];
        t.s[0] = (short)(t.s[0] + i);
        printf("table %d: %d %d %d %d\n", i, t.s[0], t.s[1], t.s[2], t.c);
    }

    double value = 0;
    for (int i = 0; i < 4; i++) {
        printf("%-5s %4d %7.3f\n", stock[i].name, stock[i].qty, stock[i].price);
        value += stock[i].qty * stock[i].price;
    }
    struct item swap = stock[0];
    stock[0] = stock[3];
    stock[3] = swap;
    printf("value %.3f first %s last %s\n", value, stock[0].name, stock[3].name);

    printf("manhattan %d\n", manhattan((struct pt){ .y = 5 }, (struct pt){ -3, k }));
    struct pt *pp = &(struct pt){ 1, 2 };
    pp->x += 10;
    printf("literal %d %d\n", pp->x, pp->y);

    struct fam *f = mkfam(5);
    if (!f) return 1;
    struct fam *g = realloc(f, sizeof *g + 12 * sizeof g->v[0]);
    if (!g) { free(f); return 1; }
    for (int i = g->n; i < 12; i++) g->v[i] = -(long)i * k;
    g->n = 12;
    long fs = 0;
    for (int i = 0; i < g->n; i++) fs = fs * 7 + g->v[i];
    printf("fam %d %ld %ld %ld size %d\n", g->n, g->v[4], g->v[11], fs, (int)sizeof(struct fam));
    free(g);
    return 0;
}
