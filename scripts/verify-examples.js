// Legacy shim. `verify-corpus.js` is the full runner; this script forwards
// to it so existing docs and CI invocations keep working during the
// phase B transition.

require("./verify-corpus.js");
