/**
 * Every mnemonic the assembler accepts, lowercase, in the order the public
 * instruction reference documents them.
 *
 * This is the name list on its own, with no prose attached, because the
 * surfaces that only need names must not drag the hover-card table into their
 * bundle: the landing page highlights its hero program through
 * highlight-arm64, and the summaries, details and examples in
 * instruction-docs are several kilobytes it would never render.
 *
 * The list is not a second source of truth. lib/test/asm/mnemonics.test.ts
 * pins it to the hover-card table in both directions, the same way
 * reference-data and instruction-docs are pinned to each other and both are
 * pinned to the assembler's own SUPPORTED_MNEMONICS, so an instruction cannot
 * reach one list and miss another.
 *
 * The conditional-branch family is absent on purpose. The hover-card table
 * folds it onto a single `B.COND` placeholder, which is not a spelling anyone
 * writes; the concrete `b.<cond>` forms are matched by CONDITIONAL_BRANCH_RE
 * in highlight-arm64 and by COND_BRANCHES in the editor's Monaco grammar.
 */
export const ARM64_MNEMONIC_NAMES: readonly string[] = [
  "mov", "movz", "movk", "movn", "add", "adds", "sub", "subs", "ccmp",
  "ccmn", "smaddl", "smsubl", "umaddl", "umsubl", "smnegl", "umnegl", "clz",
  "cls", "rbit", "rev", "rev16", "rev32", "adc", "adcs", "sbc", "sbcs",
  "and", "ands", "orr", "eor", "bic", "lsl", "lsr", "asr", "ror", "sbfx",
  "ubfx", "bfi", "bfxil", "ubfiz", "sbfiz", "sxtb", "sxth", "sxtw", "uxtb",
  "uxth", "uxtw", "mul", "madd", "msub", "mneg", "smull", "umull", "smulh",
  "umulh", "udiv", "sdiv", "neg", "negs", "mvn", "orn", "eon", "cmp", "cmn",
  "tst", "csel", "csinc", "csinv", "csneg", "cset", "csetm", "cinc", "cinv",
  "cneg", "ldr", "str", "ldrb", "strb", "ldrh", "strh", "ldrsb", "ldrsh",
  "ldrsw", "ldp", "stp", "adr", "adrp", "b", "bl", "br", "blr", "ret", "cbz",
  "cbnz", "tbz", "tbnz", "svc", "nop", "fmov", "fadd", "fsub", "fmul",
  "fdiv", "fnmul", "fmadd", "fmsub", "fnmadd", "fnmsub", "fmax", "fmin",
  "fmaxnm", "fminnm", "fneg", "fabs", "fsqrt", "fcsel", "fcmp", "fcmpe",
  "fcvt", "scvtf", "ucvtf", "fcvtzs", "fcvtns", "fcvtnu", "fcvtzu", "fcvtas",
  "fcvtau", "fcvtms", "fcvtmu", "fcvtps", "fcvtpu", "ldur", "stur", "ldnp",
  "stnp", "movi", "mvni", "dup", "ins", "umov", "smov", "mla", "mls", "pmul",
  "bsl", "bit", "bif", "not", "cmeq", "cmgt", "cmge", "cmhi", "cmhs", "cmle",
  "cmlt", "cmtst", "sqadd", "uqadd", "sqsub", "uqsub", "suqadd", "usqadd",
  "sqabs", "sqneg", "shadd", "uhadd", "srhadd", "urhadd", "shsub", "uhsub",
  "sqdmulh", "sqrdmulh", "smax", "smin", "umax", "umin", "smaxp", "sminp",
  "umaxp", "uminp", "addp", "addv", "saddlv", "uaddlv", "smaxv", "sminv",
  "umaxv", "uminv", "saddlp", "uaddlp", "sadalp", "uadalp", "sabd", "uabd",
  "saba", "uaba", "abs", "cnt", "rev64", "urecpe", "ursqrte", "saddl",
  "saddl2", "uaddl", "uaddl2", "ssubl", "ssubl2", "usubl", "usubl2", "saddw",
  "saddw2", "uaddw", "uaddw2", "ssubw", "ssubw2", "usubw", "usubw2",
  "smull2", "umull2", "smlal", "smlal2", "umlal", "umlal2", "smlsl",
  "smlsl2", "umlsl", "umlsl2", "sabdl", "sabdl2", "uabdl", "uabdl2", "sabal",
  "sabal2", "uabal", "uabal2", "addhn", "addhn2", "raddhn", "raddhn2",
  "subhn", "subhn2", "rsubhn", "rsubhn2", "sqdmull", "sqdmull2", "sqdmlal",
  "sqdmlal2", "sqdmlsl", "sqdmlsl2", "pmull", "pmull2", "xtn", "xtn2",
  "sqxtn", "sqxtn2", "uqxtn", "uqxtn2", "sqxtun", "sqxtun2", "shll", "shll2",
  "shl", "sshr", "ushr", "ssra", "usra", "srshr", "urshr", "srsra", "ursra",
  "sli", "sri", "sqshl", "uqshl", "sqshlu", "sshll", "sshll2", "ushll",
  "ushll2", "sxtl", "sxtl2", "uxtl", "uxtl2", "shrn", "shrn2", "rshrn",
  "rshrn2", "sqshrn", "sqshrn2", "uqshrn", "uqshrn2", "sqrshrn", "sqrshrn2",
  "uqrshrn", "uqrshrn2", "sqshrun", "sqshrun2", "sqrshrun", "sqrshrun2",
  "sshl", "ushl", "srshl", "urshl", "sqrshl", "uqrshl", "ext", "tbl", "tbx",
  "zip1", "zip2", "uzp1", "uzp2", "trn1", "trn2", "fmla", "fmls", "fmulx",
  "fabd", "frecps", "frsqrts", "faddp", "fmaxp", "fminp", "fmaxnmp",
  "fminnmp", "fmaxv", "fminv", "fmaxnmv", "fminnmv", "frecpe", "frsqrte",
  "frecpx", "frintn", "frinta", "frintm", "frintp", "frintz", "frintx",
  "frinti", "fcmeq", "fcmge", "fcmgt", "fcmle", "fcmlt", "facge", "facgt",
  "fcvtn", "fcvtn2", "fcvtl", "fcvtl2", "fcvtxn", "fcvtxn2", "ld1", "st1",
  "ld2", "st2", "ld3", "st3", "ld4", "st4", "ld1r", "ld2r", "ld3r", "ld4r",
];
