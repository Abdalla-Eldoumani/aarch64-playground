/* Tries to break heavy malloc and free: singly, doubly, and circular linked lists built, sorted, reversed, filtered, and torn down, with freed blocks handed straight back out. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct node { int val; int check; struct node *next; };

static unsigned seed = 12345u;
static int rnd(int m) { seed = seed * 1103515245u + 12345u; return (int)((seed >> 16) % (unsigned)m); }

/* check holds ~val, so a stray store into a live node shows up. */
static struct node *mk(int v, struct node *next)
{
    struct node *n = malloc(sizeof *n);
    n->val = v; n->check = ~v; n->next = next;
    return n;
}

static void show(const char *tag, const struct node *n)
{
    int len = 0, bad = 0;
    printf("%s:", tag);
    for (; n; n = n->next, len++) { printf(" %d", n->val); bad += n->check != ~n->val; }
    printf(" (len %d%s)\n", len, bad ? " CORRUPT" : "");
}

static struct node *reverse(struct node *h)
{
    struct node *prev = NULL;
    while (h) { struct node *nx = h->next; h->next = prev; prev = h; h = nx; }
    return prev;
}

/* Merge sort on the list itself, ordered by a comparator callback. */
static struct node *lsort(struct node *h, int (*before)(const struct node *, const struct node *))
{
    if (!h || !h->next) return h;
    struct node *slow = h, *fast = h->next;
    while (fast && fast->next) { slow = slow->next; fast = fast->next->next; }
    struct node *b = slow->next, dummy, *t = &dummy;
    slow->next = NULL;
    h = lsort(h, before);
    b = lsort(b, before);
    while (h && b) {
        if (before(b, h)) { t->next = b; b = b->next; } else { t->next = h; h = h->next; }
        t = t->next;
    }
    t->next = h ? h : b;
    return dummy.next;
}
static int asc(const struct node *a, const struct node *b) { return a->val < b->val; }
static int odd_first(const struct node *a, const struct node *b) { return (a->val & 1) > (b->val & 1); }

static struct node *insert_sorted(struct node *h, int v)
{
    struct node **p = &h;
    while (*p && (*p)->val < v) p = &(*p)->next;
    *p = mk(v, *p);
    return h;
}

static struct node *remove_if(struct node *h, int (*drop)(int), int *freed)
{
    struct node **p = &h;
    while (*p) {
        if (drop((*p)->val)) { struct node *d = *p; *p = d->next; free(d); ++*freed; }
        else p = &(*p)->next;
    }
    return h;
}
static int is_mult3(int v) { return v % 3 == 0; }

static void free_list(struct node *h) { while (h) { struct node *nx = h->next; free(h); h = nx; } }

struct dnode { struct dnode *prev, *next; int v; };
static void d_insert_after(struct dnode *at, int v)
{
    struct dnode *n = malloc(sizeof *n);
    n->v = v; n->prev = at; n->next = at->next;
    at->next->prev = n; at->next = n;
}

struct snode { struct snode *next; size_t len; char text[]; };

int main(void)
{
    struct node *h = NULL, **tail = &h;
    int i, freed = 0;
    for (i = 0; i < 12; i++) h = mk(rnd(100) - 30, h);
    show("built", h);
    h = reverse(h); show("reversed", h);
    h = lsort(h, asc); show("sorted", h);
    h = insert_sorted(h, -1000); h = insert_sorted(h, 1000); h = insert_sorted(h, h->next->val);
    show("inserted", h);
    h = remove_if(h, is_mult3, &freed);
    printf("freed %d\n", freed);
    h = lsort(h, odd_first);
    while (*tail) tail = &(*tail)->next;
    for (i = 0; i < 3; i++) { *tail = mk(i * 111, NULL); tail = &(*tail)->next; }
    show("odd first, stable, appended", h);
    free_list(h);

    /* 500 nodes out and back twice; the second round reuses the freed blocks. */
    for (int round = 0; round < 2; round++) {
        struct node *big = NULL;
        long sum = 0;
        for (i = 0; i < 500; i++) big = mk(i * 7 + round, big);
        struct node *keep = NULL, *n = big;
        while (n) {
            struct node *nx = n->next;
            if (n->val % 5 == round) { n->next = keep; keep = n; } else free(n);
            n = nx;
        }
        char *blocks[50];
        for (i = 0; i < 50; i++) { blocks[i] = malloc(8 + i * 13); memset(blocks[i], i, 8 + i * 13); }
        int ok = 1, cnt = 0;
        for (n = keep; n; n = n->next, cnt++) { sum += n->val; ok &= n->check == ~n->val; }
        for (i = 0; i < 50; i++) { ok &= blocks[i][7 + i * 13] == i; free(blocks[i]); }
        printf("round %d: kept %d sum %ld ok %d\n", round, cnt, sum, ok);
        free_list(keep);
    }

    struct dnode s = {&s, &s, 0};
    for (i = 1; i <= 10; i++) d_insert_after(i % 2 ? &s : s.prev, i * i);
    for (struct dnode *d = s.next; d != &s;) {
        struct dnode *nx = d->next;
        if (d->v % 3 == 1) { d->prev->next = d->next; d->next->prev = d->prev; free(d); }
        d = nx;
    }
    printf("dlist fwd:");
    for (struct dnode *d = s.next; d != &s; d = d->next) printf(" %d", d->v);
    printf(" | back:");
    for (struct dnode *d = s.prev; d != &s; d = d->prev) printf(" %d", d->v);
    printf("\n");
    while (s.next != &s) { struct dnode *d = s.next; s.next = d->next; free(d); }

    /* Josephus: 41 people in a ring, every third one leaves. */
    struct node *ring = mk(1, NULL), *last = ring;
    for (i = 2; i <= 41; i++) { last->next = mk(i, NULL); last = last->next; }
    last->next = ring;
    printf("josephus:");
    for (int left = 41; left > 1; left--) {
        last = last->next->next;
        struct node *out = last->next;
        last->next = out->next;
        if (left > 31) printf(" %d", out->val);
        free(out);
    }
    printf(" ... survivor %d\n", last->val);
    free(last);

    const char *words[] = {"delta", "alpha", "echo", "", "charlie", "bravo", "alphabet", "alp"};
    struct snode *sl = NULL;
    for (i = 0; i < 8; i++) {
        size_t len = strlen(words[i]);
        struct snode *n = malloc(sizeof *n + len + 1), **p = &sl;
        n->len = len;
        strcpy(n->text, words[i]);
        while (*p && strcmp((*p)->text, n->text) < 0) p = &(*p)->next;
        n->next = *p; *p = n;
    }
    printf("words:");
    while (sl) { struct snode *nx = sl->next; printf(" %s/%d", sl->text, (int)sl->len); free(sl); sl = nx; }
    printf("\n");
    return 0;
}
