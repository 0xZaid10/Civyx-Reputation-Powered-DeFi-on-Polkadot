// AegisID - Nullifier Circuit
//
// Statement proven:
//   "I know a secret such that:
//     pedersen_hash([secret])              == commitment
//     pedersen_hash([secret, action_id])   == nullifier"
//
// General-purpose circuit for any action beyond wallet linking.
// The action_id scopes the nullifier to a specific operation.
// One identity gets exactly one slot per action_id.
//
// Private inputs (witness):
//   secret: Field  - the identity secret
//
// Public inputs (submitted on-chain):
//   commitment: Field  - pedersen_hash([secret]), the identity anchor
//   nullifier:  Field  - pedersen_hash([secret, action_id]), one-time use per action
//   action_id:  Field  - encodes the action (e.g. hash of "airdrop:season1")

fn main(
    // Private
    secret: Field,

    // Public
    commitment: pub Field,
    nullifier:  pub Field,
    action_id:  pub Field,
) {
    // 1. Verify identity ownership
    let computed_commitment = std::hash::pedersen_hash([secret]);

    assert(
        computed_commitment == commitment,
        "commitment mismatch: pedersen_hash([secret]) != commitment"
    );

    // 2. Verify nullifier binds proof to this specific action
    let computed_nullifier = std::hash::pedersen_hash([secret, action_id]);

    assert(
        computed_nullifier == nullifier,
        "nullifier mismatch: pedersen_hash([secret, action_id]) != nullifier"
    );
}

// --- Tests ---

#[test]
fn test_valid_nullifier_proof() {
    let secret    = 12345678901234567890;
    let action_id = 1;

    let commitment = std::hash::pedersen_hash([secret]);
    let nullifier  = std::hash::pedersen_hash([secret, action_id]);

    main(secret, commitment, nullifier, action_id);
}

#[test(should_fail_with = "commitment mismatch: pedersen_hash([secret]) != commitment")]
fn test_wrong_secret_fails() {
    let secret       = 12345678901234567890;
    let wrong_secret = 9999999999;
    let action_id    = 1;

    let commitment = std::hash::pedersen_hash([secret]);
    let nullifier  = std::hash::pedersen_hash([wrong_secret, action_id]);

    main(wrong_secret, commitment, nullifier, action_id);
}

#[test(should_fail_with = "nullifier mismatch: pedersen_hash([secret, action_id]) != nullifier")]
fn test_wrong_action_id_fails() {
    let secret          = 12345678901234567890;
    let action_id       = 1;
    let wrong_action_id = 2;

    let commitment = std::hash::pedersen_hash([secret]);
    let nullifier  = std::hash::pedersen_hash([secret, action_id]);

    // nullifier was made for action 1 but claiming action 2 - must fail
    main(secret, commitment, nullifier, wrong_action_id);
}

#[test]
fn test_same_identity_different_actions_different_nullifiers() {
    let secret   = 12345678901234567890;
    let action_1 = 1;
    let action_2 = 2;

    let nullifier_1 = std::hash::pedersen_hash([secret, action_1]);
    let nullifier_2 = std::hash::pedersen_hash([secret, action_2]);

    assert(nullifier_1 != nullifier_2, "different actions must produce different nullifiers");
}

#[test]
fn test_different_identities_same_action_different_nullifiers() {
    let secret_a  = 11111111;
    let secret_b  = 22222222;
    let action_id = 1;

    let nullifier_a = std::hash::pedersen_hash([secret_a, action_id]);
    let nullifier_b = std::hash::pedersen_hash([secret_b, action_id]);

    assert(nullifier_a != nullifier_b, "different identities must produce different nullifiers");
}

