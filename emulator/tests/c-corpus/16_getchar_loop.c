#include <stdio.h>
/* getchar until EOF: count lines, words, chars; putchar echo of a transform */
int main(void) {
    int c, lines = 0, words = 0, chars = 0, inword = 0;
    while ((c = getchar()) != EOF) {
        chars++;
        if (c == '\n') lines++;
        if (c == ' ' || c == '\n' || c == '\t') inword = 0;
        else if (!inword) { inword = 1; words++; }
        if (c >= 'a' && c <= 'z') putchar(c - 32);
        else putchar(c);
    }
    printf("lines=%d words=%d chars=%d\n", lines, words, chars);
    return lines;
}
