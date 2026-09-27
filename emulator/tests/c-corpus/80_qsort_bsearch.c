/* Tries to break qsort and bsearch calling back into guest comparators over ints, strings, structs, and odd element sizes. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

/* Every comparator orders fully (ties broken), so qsort's output is defined even though it is not stable. */
static int cmp_int(const void *a, const void *b)
{
    int x = *(const int *)a, y = *(const int *)b;
    return (x > y) - (x < y);
}

static int cmp_ulong(const void *a, const void *b)
{
    unsigned long x = *(const unsigned long *)a, y = *(const unsigned long *)b;
    return (x > y) - (x < y);
}

static int cmp_str(const void *a, const void *b)
{
    return strcmp(*(const char *const *)a, *(const char *const *)b);
}

/* A comparator that calls through another function pointer. */
static int (*inner)(const void *, const void *) = cmp_str;
static int cmp_rev(const void *a, const void *b) { return inner(b, a); }

static int cmp_uchar(const void *a, const void *b)
{
    return *(const unsigned char *)a - *(const unsigned char *)b;
}

static int cmp3(const void *a, const void *b) { return memcmp(a, b, 3); }

struct rec { char name[10]; short age; unsigned id; };

static int cmp_rec(const void *a, const void *b)
{
    const struct rec *p = a, *q = b;
    if (p->age != q->age) return p->age - q->age;
    int c = strcmp(p->name, q->name);
    return c ? c : (p->id > q->id) - (p->id < q->id);
}

static int cmp_rec_id(const void *a, const void *b)
{
    unsigned x = ((const struct rec *)a)->id, y = ((const struct rec *)b)->id;
    return (x > y) - (x < y);
}

/* bsearch hands the key first: here a bare id against a whole record. */
static int cmp_key_id(const void *key, const void *elem)
{
    unsigned k = *(const unsigned *)key, id = ((const struct rec *)elem)->id;
    return (k > id) - (k < id);
}

static void show_ints(const char *tag, const int *a, int n)
{
    printf("%s:", tag);
    for (int i = 0; i < n; i++) printf(" %d", a[i]);
    printf("\n");
}

int main(void)
{
    int a[] = {42, -7, INT_MAX, 0, 13, INT_MIN, 42, -7, 99, 1, -1000000, 13, 5, 8, 0, 77};
    int n = (int)(sizeof a / sizeof a[0]), i, u;
    qsort(a, n, sizeof a[0], cmp_int);
    show_ints("asc", a, n);
    int uniq[16];
    for (i = u = 0; i < n; i++)
        if (u == 0 || uniq[u - 1] != a[i]) uniq[u++] = a[i];
    show_ints("uniq", uniq, u);
    int probes[] = {INT_MIN, -1000000, -8, 0, 7, 8, 42, 98, 99, INT_MAX, 12345};
    printf("find:");
    for (i = 0; i < 11; i++) {
        int *hit = bsearch(&probes[i], uniq, u, sizeof uniq[0], cmp_int);
        printf(" %d", hit ? (int)(hit - uniq) : -1);
    }
    printf(" %d\n", bsearch(&probes[0], uniq, 0, sizeof uniq[0], cmp_int) == NULL);

    qsort(a, 1, sizeof a[0], cmp_int);
    qsort(a, 0, sizeof a[0], cmp_int);
    printf("first after n=1 and n=0: %d\n", a[0]);

    unsigned long big[] = {0x8000000000000000UL, 1, 0xffffffffffffffffUL, 0x100000000UL, 0,
                           0xffffffffUL, 0x7fffffffffffffffUL, 0xdeadbeefUL};
    qsort(big, 8, sizeof big[0], cmp_ulong);
    printf("ulong:");
    for (i = 0; i < 8; i++) printf(" %lx", big[i]);
    printf("\n");

    const char *fruit[] = {"pear", "apple", "fig", "banana", "kiwi", "Apple", "", "apricot",
                           "fig2", "cherry"};
    qsort(fruit, 10, sizeof fruit[0], cmp_str);
    printf("str:");
    for (i = 0; i < 10; i++) printf(" [%s]", fruit[i]);
    const char *want[] = {"kiwi", "Apple", "", "zucchini", "fi"};
    printf("\nstr find:");
    for (i = 0; i < 5; i++) {
        const char **hit = bsearch(&want[i], fruit, 10, sizeof fruit[0], cmp_str);
        printf(" %d", hit ? (int)(hit - fruit) : -1);
    }
    qsort(fruit, 10, sizeof fruit[0], cmp_rev);
    printf("\nrev: %s %s [%s]\n", fruit[0], fruit[1], fruit[9]);

    char text[] = "the quick brown fox jumps over a lazy dog";
    qsort(text, strlen(text), 1, cmp_uchar);
    printf("bytes: [%s]\n", text);

    char tri[][3] = {"zb", "ab", "mq", "a", "zz", "", "ma", "b"};
    qsort(tri, 8, 3, cmp3);
    printf("tri:");
    for (i = 0; i < 8; i++) printf(" [%s]", tri[i]);
    printf("\n");

    struct rec r[] = {{"ola", 30, 7}, {"ben", 25, 3}, {"ada", 30, 9}, {"ben", 25, 1},
                      {"cy", -2, 40}, {"zed", 30, 2}, {"ada", 30, 5}, {"eve", 101, 8}};
    qsort(r, 8, sizeof r[0], cmp_rec);
    printf("rec:");
    for (i = 0; i < 8; i++) printf(" %s/%d/%u", r[i].name, r[i].age, r[i].id);
    qsort(r, 8, sizeof r[0], cmp_rec_id);
    unsigned ids[] = {1, 4, 9, 40, 0, 8};
    printf("\nby id:");
    for (i = 0; i < 6; i++) {
        struct rec *hit = bsearch(&ids[i], r, 8, sizeof r[0], cmp_key_id);
        printf(" %u=%s", ids[i], hit ? hit->name : "-");
    }
    printf("\nsizeof rec %d\n", (int)sizeof(struct rec));
    return 0;
}
