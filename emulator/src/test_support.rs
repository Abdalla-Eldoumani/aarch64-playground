//! Helpers the unit tests share.

use std::fmt::Display;

/// The refusal `result` carries must name `fragment`: a refusal a student
/// cannot act on is only half a check.
#[track_caller]
pub(crate) fn rejects<T, E: Display>(result: Result<T, E>, fragment: &str) {
    match result {
        Ok(_) => panic!("expected a refusal naming `{fragment}`, got success"),
        Err(e) => {
            let msg = e.to_string();
            assert!(msg.contains(fragment), "the refusal does not name `{fragment}`: {msg}");
        }
    }
}
