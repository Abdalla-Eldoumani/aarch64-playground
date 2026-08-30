#include <stdio.h>
#include <stdlib.h>
/* malloc/free, linked list, dynamic array growth */
struct node { int v; struct node *next; };
struct node *push(struct node *h, int v) {
    struct node *n = malloc(sizeof *n);
    n->v = v; n->next = h;
    return n;
}
int main(void) {
    struct node *h = 0;
    for (int i = 1; i <= 8; i++) h = push(h, i * i);
    int s = 0, c = 0;
    for (struct node *p = h; p; p = p->next) { s += p->v; c++; }
    printf("%d %d\n", c, s);
    while (h) { struct node *n = h->next; free(h); h = n; }
    int cap = 4, n = 0;
    int *arr = malloc(cap * sizeof(int));
    for (int i = 0; i < 50; i++) {
        if (n == cap) {
            int *bigger = malloc(cap * 2 * sizeof(int));
            for (int j = 0; j < n; j++) bigger[j] = arr[j];
            free(arr); arr = bigger; cap *= 2;
        }
        arr[n++] = i * 3;
    }
    long t = 0;
    for (int i = 0; i < n; i++) t += arr[i];
    printf("%d %d %ld\n", n, cap, t);
    free(arr);
    void *p = malloc(0), *q = malloc(1);
    printf("%d\n", q != 0);
    free(p); free(q);
    return 0;
}
