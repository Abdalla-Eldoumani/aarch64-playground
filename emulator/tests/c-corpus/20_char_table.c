#include <stdio.h>
#include <string.h>
/* lookup tables, caesar cipher, hex encoding, switch on char */
static const char hexd[] = "0123456789abcdef";
int score(char c) {
    switch (c) {
        case 'a': case 'e': case 'i': case 'o': case 'u': return 1;
        case 'z': case 'q': case 'x': return 10;
        default: return 2;
    }
}
int main(void) {
    char msg[] = "attack at dawn";
    for (int i = 0; msg[i]; i++) if (msg[i] >= 'a' && msg[i] <= 'z') msg[i] = 'a' + (msg[i] - 'a' + 13) % 26;
    printf("%s\n", msg);
    unsigned char bytes[] = {0xde, 0xad, 0xbe, 0xef, 0x00, 0x7f};
    for (int i = 0; i < 6; i++) printf("%c%c", hexd[bytes[i] >> 4], hexd[bytes[i] & 15]);
    printf("\n");
    int total = 0;
    for (const char *p = "quiz box"; *p; p++) total += score(*p);
    printf("%d\n", total);
    int freq[26];
    memset(freq, 0, sizeof freq);
    for (const char *p = "mississippi"; *p; p++) freq[*p - 'a']++;
    for (int i = 0; i < 26; i++) if (freq[i]) printf("%c%d ", 'a' + i, freq[i]);
    printf("\n");
    return 0;
}
