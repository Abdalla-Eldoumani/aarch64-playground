#include <stdio.h>
/* arrays, bubble sort, 2D arrays, reverse in place, array of strings */
void bubble(int *a, int n) {
    for (int i = 0; i < n - 1; i++)
        for (int j = 0; j < n - 1 - i; j++)
            if (a[j] > a[j + 1]) { int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; }
}
int main(void) {
    int a[10] = {9, 3, 7, 1, 8, 2, 6, 5, 4, 0};
    bubble(a, 10);
    for (int i = 0; i < 10; i++) printf("%d ", a[i]);
    printf("\n");
    int m[3][4];
    for (int r = 0; r < 3; r++) for (int c = 0; c < 4; c++) m[r][c] = r * 10 + c;
    int tr = 0;
    for (int r = 0; r < 3; r++) tr += m[r][r];
    printf("%d %d %d\n", m[2][3], m[1][0], tr);
    int n = 7, b[7];
    for (int i = 0; i < n; i++) b[i] = i * i;
    for (int i = 0, j = n - 1; i < j; i++, j--) { int t = b[i]; b[i] = b[j]; b[j] = t; }
    for (int i = 0; i < n; i++) printf("%d ", b[i]);
    printf("\n");
    const char *names[] = {"alpha", "beta", "gamma"};
    for (int i = 2; i >= 0; i--) printf("%s ", names[i]);
    printf("\n");
    long big[100];
    for (int i = 0; i < 100; i++) big[i] = (long)i * i * i;
    long s = 0;
    for (int i = 0; i < 100; i += 7) s += big[i];
    printf("%ld\n", s);
    return 0;
}
