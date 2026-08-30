#include <stdio.h>
#include <stdlib.h>
#include <string.h>
/* argc/argv, atoi on arguments, argv[0] presence */
int main(int argc, char **argv) {
    printf("argc=%d\n", argc);
    printf("argv0_nonempty=%d\n", strlen(argv[0]) > 0);
    int total = 0;
    for (int i = 1; i < argc; i++) {
        printf("arg%d=%s len=%d\n", i, argv[i], (int)strlen(argv[i]));
        total += atoi(argv[i]);
    }
    printf("total=%d\n", total);
    printf("argv_end_null=%d\n", argv[argc] == 0);
    return total % 256;
}
