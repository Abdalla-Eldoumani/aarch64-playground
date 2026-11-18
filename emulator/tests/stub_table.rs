//! What each libc stub is to a program: the address a `bl` reaches it at.

use aarch64_emulator::cpu::Cpu;

/// Every stub in slot order. A stub's address is its slot, so a stub
/// inserted or moved shifts every address after it, main's return address
/// (`__main_return`) among them, and a new stub goes last.
const ADDRESSES: &[(&str, u64)] = &[
    ("__host_noop", 0xffff_0000),
    ("printf", 0xffff_0010),
    ("scanf", 0xffff_0020),
    ("puts", 0xffff_0030),
    ("putchar", 0xffff_0040),
    ("getchar", 0xffff_0050),
    ("sprintf", 0xffff_0060),
    ("snprintf", 0xffff_0070),
    ("strlen", 0xffff_0080),
    ("strcmp", 0xffff_0090),
    ("strncmp", 0xffff_00a0),
    ("strcpy", 0xffff_00b0),
    ("strncpy", 0xffff_00c0),
    ("strcat", 0xffff_00d0),
    ("strchr", 0xffff_00e0),
    ("strstr", 0xffff_00f0),
    ("strtok", 0xffff_0100),
    ("memset", 0xffff_0110),
    ("memcpy", 0xffff_0120),
    ("memmove", 0xffff_0130),
    ("memcmp", 0xffff_0140),
    ("exit", 0xffff_0150),
    ("atof", 0xffff_0160),
    ("atoi", 0xffff_0170),
    ("strtol", 0xffff_0180),
    ("abs", 0xffff_0190),
    ("labs", 0xffff_01a0),
    ("rand", 0xffff_01b0),
    ("srand", 0xffff_01c0),
    ("time", 0xffff_01d0),
    ("malloc", 0xffff_01e0),
    ("calloc", 0xffff_01f0),
    ("realloc", 0xffff_0200),
    ("free", 0xffff_0210),
    ("usleep", 0xffff_0220),
    ("fflush", 0xffff_0230),
    ("isdigit", 0xffff_0240),
    ("isalpha", 0xffff_0250),
    ("isspace", 0xffff_0260),
    ("toupper", 0xffff_0270),
    ("tolower", 0xffff_0280),
    ("__ctype_b_loc", 0xffff_0290),
    ("__ctype_toupper_loc", 0xffff_02a0),
    ("__ctype_tolower_loc", 0xffff_02b0),
    ("fopen", 0xffff_02c0),
    ("fprintf", 0xffff_02d0),
    ("fgets", 0xffff_02e0),
    ("fputs", 0xffff_02f0),
    ("fclose", 0xffff_0300),
    ("putc", 0xffff_0310),
    ("fputc", 0xffff_0320),
    ("getc", 0xffff_0330),
    ("fwrite", 0xffff_0340),
    ("qsort", 0xffff_0350),
    ("bsearch", 0xffff_0360),
    ("sqrt", 0xffff_0370),
    ("pow", 0xffff_0380),
    ("sin", 0xffff_0390),
    ("cos", 0xffff_03a0),
    ("tan", 0xffff_03b0),
    ("log", 0xffff_03c0),
    ("log10", 0xffff_03d0),
    ("exp", 0xffff_03e0),
    ("floor", 0xffff_03f0),
    ("fabs", 0xffff_0400),
    ("fmod", 0xffff_0410),
    ("sincos", 0xffff_0420),
    ("__main_return", 0xffff_0430),
    ("__isoc99_scanf", 0xffff_0440),
];

#[test]
fn every_stub_keeps_its_name_and_address() {
    let cpu = Cpu::new();
    let table: Vec<(&str, u64)> = cpu
        .host
        .names()
        .map(|name| (name, cpu.host.lookup(name).expect("a listed name resolves")))
        .collect();
    assert_eq!(table, ADDRESSES);
}
