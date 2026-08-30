#include <stdio.h>
/* a few million iterations: step budget and a checksum that must match exactly */
int main(void) {
    unsigned int h = 2166136261u;
    for (int i = 0; i < 2000000; i++) { h ^= (unsigned int)i; h *= 16777619u; }
    long s = 0;
    for (int i = 0; i < 1000000; i++) s += i % 7;
    printf("%u %ld\n", h, s);
    return 0;
}
