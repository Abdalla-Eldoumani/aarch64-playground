#include <stdio.h>
/* pointer arithmetic, swap, pointer to pointer, function pointers (blr) */
void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }
int add(int a, int b) { return a + b; }
int sub(int a, int b) { return a - b; }
int mul(int a, int b) { return a * b; }
int apply(int (*f)(int, int), int a, int b) { return f(a, b); }
void set(int **pp, int *target) { *pp = target; }
int main(void) {
    int x = 3, y = 9;
    swap(&x, &y);
    printf("%d %d\n", x, y);
    int arr[6] = {10, 20, 30, 40, 50, 60};
    int *p = arr + 1, *q = &arr[5];
    printf("%d %d %ld %d\n", *p, *q, (long)(q - p), *(p + 2));
    int (*ops[3])(int, int) = {add, sub, mul};
    for (int i = 0; i < 3; i++) printf("%d ", apply(ops[i], 7, 4));
    printf("\n");
    int *r = 0;
    set(&r, &arr[2]);
    printf("%d %d\n", *r, r == &arr[2]);
    char s[] = "pointer";
    char *e = s;
    while (*e) e++;
    printf("%ld %c\n", (long)(e - s), *(e - 1));
    return 0;
}
