#include <stdio.h>
/* many mixed int and double varargs: register args then the shared stack spill */
int main(void) {
    printf("%d %f %d %f %d %f %d %f %d %f %d %f\n",
           1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5);
    printf("%d %d %d %d %d %d %d %d %d %d %d %d\n", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    printf("%f %f %f %f %f %f %f %f %f %f\n", 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0);
    printf("%s %c %d %ld %x %u %%\n", "str", 'c', -42, 9999999999L, 255, 4294967295u);
    printf("%5d|%-5d|%05d|%+d|% d\n", 42, 42, 42, 42, 42);
    printf("%p\n", (void *)0);
    return 0;
}
