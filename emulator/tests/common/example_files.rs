//! The helper files of a multi-file example, in the order the web pastes
//! them, read from the example catalog the web itself loads
//! (web/lib/playground/example-catalog.ts) rather than from a copy.

use std::path::PathBuf;

/// `stem`'s `files` list in catalog order, empty for a one-file example.
/// Names read the same in either quote style; a stem the catalog does not
/// list panics, since every shipped example has a record.
pub fn example_files(stem: &str) -> Vec<String> {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop();
    path.push("web/lib/playground/example-catalog.ts");
    let catalog = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    let start = ["\"", "'"]
        .iter()
        .find_map(|q| catalog.find(&format!("stem: {q}{stem}{q}")))
        .unwrap_or_else(|| panic!("{stem} has no record in {}", path.display()));
    // The record runs to the next one's `stem:`.
    let record = catalog[start + "stem:".len()..].split("stem:").next().unwrap_or("");
    let Some(list) = record.split("files:").nth(1) else { return Vec::new() };
    list.split(']')
        .next()
        .unwrap_or("")
        .split(['"', '\''])
        .skip(1)
        .step_by(2)
        .map(str::to_string)
        .collect()
}
