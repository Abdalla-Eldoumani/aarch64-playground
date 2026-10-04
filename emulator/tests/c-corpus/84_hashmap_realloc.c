/* Tries to break realloc-driven growth: an open-addressing hash map rehashed through calloc, keys in a realloc-grown arena, a vector that must move, and 64-bit hashes printed with %zx. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* state: 0 empty, 1 live, 2 deleted. Keys are arena offsets because realloc may move the arena. */
struct slot { size_t hash, key; int val, state; };
struct map { struct slot *tab; size_t cap, live, used; char *arena; size_t alen, acap; int moves; };

static size_t fnv1a(const char *s)
{
    size_t h = 14695981039346656037UL;
    for (; *s; s++) { h ^= (unsigned char)*s; h *= 1099511628211UL; }
    return h;
}

static size_t arena_put(struct map *m, const char *s)
{
    size_t n = strlen(s) + 1;
    while (m->alen + n > m->acap) {
        m->acap = m->acap ? m->acap * 2 : 16;
        m->arena = realloc(m->arena, m->acap);
        m->moves++;
    }
    memcpy(m->arena + m->alen, s, n);
    m->alen += n;
    return m->alen - n;
}

/* The live slot holding k, else the first reusable slot on its probe path. */
static struct slot *find(struct map *m, const char *k, size_t h)
{
    struct slot *tomb = NULL;
    for (size_t i = h & (m->cap - 1);; i = (i + 1) & (m->cap - 1)) {
        struct slot *s = &m->tab[i];
        if (s->state == 0) return tomb ? tomb : s;
        if (s->state == 2) { if (!tomb) tomb = s; }
        else if (s->hash == h && strcmp(m->arena + s->key, k) == 0) return s;
    }
}

static void rehash(struct map *m, size_t ncap)
{
    struct slot *old = m->tab;
    size_t ocap = m->cap;
    m->tab = calloc(ncap, sizeof *m->tab);
    m->cap = ncap;
    m->used = 0;
    for (size_t i = 0; i < ocap; i++)
        if (old[i].state == 1) {
            size_t j = old[i].hash & (ncap - 1);
            while (m->tab[j].state) j = (j + 1) & (ncap - 1);
            m->tab[j] = old[i];
            m->used++;
        }
    free(old);
}

static void bump(struct map *m, const char *k, int delta)
{
    /* Keep a third of the slots empty; a table full of tombstones is rebuilt at the same size. */
    if ((m->used + 1) * 3 > m->cap * 2) rehash(m, (m->live + 1) * 3 > m->cap ? m->cap * 2 : m->cap);
    size_t h = fnv1a(k);
    struct slot *s = find(m, k, h);
    if (s->state != 1) {
        m->used += s->state == 0;
        s->state = 1; s->hash = h; s->key = arena_put(m, k); s->val = 0;
        m->live++;
    }
    s->val += delta;
}

static int get(struct map *m, const char *k)
{
    struct slot *s = find(m, k, fnv1a(k));
    return s->state == 1 ? s->val : -1;
}

static int del(struct map *m, const char *k)
{
    struct slot *s = find(m, k, fnv1a(k));
    if (s->state != 1) return 0;
    s->state = 2;
    m->live--;
    return 1;
}

static const char text[] =
    "the red kite rode the warm air over the hill and the small birds below it hid in the "
    "hedge, while the kite turned and turned again; a farmer on the hill saw the kite, saw the "
    "hedge shake, and went back to the barn where the old red tractor sat waiting in the dark.";

int main(void)
{
    struct map m = {calloc(8, sizeof(struct slot)), 8, 0, 0, NULL, 0, 0, 0};
    printf("fnv: %016zx %016zx %zx\n", fnv1a(""), fnv1a("a"), fnv1a("kite") >> 1);

    char *buf = malloc(sizeof text);
    strcpy(buf, text);
    int words = 0;
    for (char *w = strtok(buf, " ,.;"); w; w = strtok(NULL, " ,.;")) { bump(&m, w, 1); words++; }
    free(buf);
    printf("words %d distinct %d cap %d used %d arena %d moves %d\n", words, (int)m.live,
           (int)m.cap, (int)m.used, (int)m.alen, m.moves);

    const char *q[] = {"the", "kite", "hill", "tractor", "dragon", "", "Kite", "hedge"};
    printf("get:");
    for (int i = 0; i < 8; i++) printf(" %s=%d", q[i], get(&m, q[i]));
    const char *gone[] = {"the", "and", "zebra", "and", "saw", "red"};
    printf("\ndel:");
    for (int i = 0; i < 6; i++) printf(" %d", del(&m, gone[i]));
    for (int i = 0; i < 40; i++) bump(&m, i % 2 ? "the" : "saw", 2);
    printf("\nafter: the=%d saw=%d and=%d red=%d live %d used %d cap %d\n", get(&m, "the"),
           get(&m, "saw"), get(&m, "and"), get(&m, "red"), (int)m.live, (int)m.used, (int)m.cap);

    int shown = 0, hash_ok = 0;
    for (size_t i = 0; i < m.cap; i++) {
        struct slot *s = &m.tab[i];
        if (s->state != 1) continue;
        hash_ok += fnv1a(m.arena + s->key) == s->hash;
        printf("%s%d:%s=%d", shown % 6 ? " " : (shown ? "\n  " : "slots "), (int)i, m.arena + s->key, s->val);
        shown++;
    }
    printf("\nhash ok %d of %d\n", hash_ok, (int)m.live);

    /* Growth by half each time while a small block is pinned after every
       resize, so the next growth cannot extend in place. */
    int *v = NULL;
    size_t n = 0, cap = 0, grows = 0;
    void *pins[32];
    long bad = 0;
    for (int i = 0; i < 400; i++) {
        if (n == cap) {
            cap += cap / 2 + 1;
            v = realloc(v, cap * sizeof *v);
            if (grows < 32) pins[grows] = malloc(24);
            grows++;
            for (size_t j = 0; j < n; j++) bad += v[j] != (int)(j * 7) - 1000;
        }
        v[n++] = i * 7 - 1000;
    }
    v = realloc(v, 10 * sizeof *v);
    printf("vector grows %d bad %ld last cap %d head %d %d %d\n", (int)grows, bad, (int)cap, v[0], v[1], v[9]);
    free(v);
    for (size_t i = 0; i < grows && i < 32; i++) free(pins[i]);

    unsigned char *d = malloc(4000);
    memset(d, 0xab, 4000);
    printf("dirty %d %d\n", d[0], d[3999]);
    free(d);
    unsigned char *zb = calloc(1000, 4);
    int nz = 0;
    for (int i = 0; i < 4000; i++) nz += zb[i] != 0;
    printf("calloc nonzero %d\n", nz);
    free(zb);
    free(m.tab);
    free(m.arena);
    return 0;
}
