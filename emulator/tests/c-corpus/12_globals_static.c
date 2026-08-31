#include <stdio.h>
/* .data, .bss, .rodata, static locals, const lookup tables */
int counter = 5;
int zeros[16];
static const int squares[10] = {0, 1, 4, 9, 16, 25, 36, 49, 64, 81};
const char greeting[] = "hi from rodata";
static long acc;
char name[8] = "abc";
int next_id(void) { static int id = 100; return id++; }
int main(void) {
    for (int i = 0; i < 16; i++) zeros[i] = i % 2 ? 0 : i;
    for (int i = 0; i < 16; i++) acc += zeros[i];
    printf("%d %ld %d %d\n", counter, acc, squares[7], (int)sizeof(squares) / (int)sizeof(squares[0]));
    printf("%s %s\n", greeting, name);
    name[0] = 'x';
    counter *= 3;
    printf("%s %d %d %d %d\n", name, counter, next_id(), next_id(), next_id());
    return 0;
}
