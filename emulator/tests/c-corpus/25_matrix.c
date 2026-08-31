#include <stdio.h>
#include <string.h>
/* matrix multiply with memset/memcpy, nested indexing through pointers */
#define N 4
void matmul(const int a[N][N], const int b[N][N], int c[N][N]) {
    memset(c, 0, sizeof(int) * N * N);
    for (int i = 0; i < N; i++)
        for (int j = 0; j < N; j++)
            for (int k = 0; k < N; k++)
                c[i][j] += a[i][k] * b[k][j];
}
int main(void) {
    int a[N][N], b[N][N], c[N][N], d[N][N];
    for (int i = 0; i < N; i++) for (int j = 0; j < N; j++) { a[i][j] = i + j; b[i][j] = i == j ? 2 : 0; }
    matmul(a, b, c);
    memcpy(d, c, sizeof c);
    for (int i = 0; i < N; i++) { for (int j = 0; j < N; j++) printf("%d ", d[i][j]); printf("\n"); }
    long trace = 0;
    for (int i = 0; i < N; i++) trace += d[i][i];
    printf("%ld\n", trace);
    return 0;
}
