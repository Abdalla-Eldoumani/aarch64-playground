#include <stdio.h>
#include <stdlib.h>
/* glibc rand sequence: unseeded, srand(1), srand(42), modulo use */
int main(void) {
    for (int i = 0; i < 5; i++) printf("%d ", rand());
    printf("\n");
    srand(42);
    for (int i = 0; i < 5; i++) printf("%d ", rand() % 100);
    printf("\n");
    srand(1);
    printf("%d\n", rand());
    return 0;
}
