//! Secrets: API keys in the OS keychain, never in the settings JSON.
//!
//! One keychain entry per provider — service `obiter`, account = provider
//! name — so switching providers and back never loses a key, and adding a
//! provider later needs no migration. The key value is write-only from the
//! frontend's perspective: callers can set, delete, and ask whether a key
//! exists, but nothing here ever returns the value.
//!
//! No Tauri dependency; the command layer in `lib.rs` is thin glue.

use keyring::{Entry, Error};

const SERVICE: &str = "obiter";

fn entry(provider: &str) -> Result<Entry, Error> {
    Entry::new(SERVICE, provider)
}

pub fn set_api_key(provider: &str, key: &str) -> Result<(), Error> {
    entry(provider)?.set_password(key)
}

/// Whether a key exists for `provider`. The value itself never leaves
/// this module.
pub fn has_api_key(provider: &str) -> Result<bool, Error> {
    match entry(provider)?.get_password() {
        Ok(_) => Ok(true),
        Err(Error::NoEntry) => Ok(false),
        Err(e) => Err(e),
    }
}

/// Remove the key for `provider`. Deleting a key that was never stored is
/// not an error — the end state is the same.
pub fn delete_api_key(provider: &str) -> Result<(), Error> {
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // These hit the real OS keychain, so they run locally only; macOS
    // keychain access is unavailable or flaky in CI. Test accounts are
    // prefixed so they can never collide with a real provider entry.
    //
    // Run with:  cargo test -- --ignored --test-threads=1
    // Single-threaded because keyring v4's one-time store init races when
    // parallel tests call Entry::new concurrently (losers see
    // NoDefaultStore before the winner finishes initializing).

    #[test]
    #[ignore = "hits the real OS keychain; run locally with -- --ignored"]
    fn round_trip_set_has_delete_has() {
        let provider = "obiter-test-roundtrip";
        // Clean slate even if a previous run died mid-test.
        delete_api_key(provider).unwrap();

        assert!(!has_api_key(provider).unwrap());
        set_api_key(provider, "sk-test-not-a-real-key").unwrap();
        assert!(has_api_key(provider).unwrap());

        // The entry is a real keychain item, visible to the OS
        // (Keychain Access on macOS shows it under service "obiter").
        #[cfg(target_os = "macos")]
        {
            let found = std::process::Command::new("security")
                .args(["find-generic-password", "-s", SERVICE, "-a", provider])
                .output()
                .unwrap();
            assert!(found.status.success(), "entry not visible via security(1)");
        }

        delete_api_key(provider).unwrap();
        assert!(!has_api_key(provider).unwrap());
    }

    #[test]
    #[ignore = "hits the real OS keychain; run locally with -- --ignored"]
    fn providers_are_independent_entries() {
        let a = "obiter-test-provider-a";
        let b = "obiter-test-provider-b";
        delete_api_key(a).unwrap();
        delete_api_key(b).unwrap();

        set_api_key(a, "key-a").unwrap();
        set_api_key(b, "key-b").unwrap();
        assert!(has_api_key(a).unwrap());
        assert!(has_api_key(b).unwrap());

        // Deleting one never disturbs the other.
        delete_api_key(a).unwrap();
        assert!(!has_api_key(a).unwrap());
        assert!(has_api_key(b).unwrap());

        delete_api_key(b).unwrap();
        assert!(!has_api_key(b).unwrap());
    }

    #[test]
    #[ignore = "hits the real OS keychain; run locally with -- --ignored"]
    fn delete_of_a_missing_key_is_a_no_op() {
        delete_api_key("obiter-test-never-set").unwrap();
        assert!(!has_api_key("obiter-test-never-set").unwrap());
    }
}
