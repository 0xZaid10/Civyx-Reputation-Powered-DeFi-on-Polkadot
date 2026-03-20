// AegisID - Identity Proof Circuit
//
// Statement proven:
//   "I know a secret such that pedersen_hash([secret]) == commitment"
//
// Private inputs (witness - never leave the device):
//   secret: Field  - the user's identity secret
//
// Public inputs (submitted on-chain):
//   commitment: Field  - pedersen_hash([secret]), the on-chain identity anchor

fn main(
    // Private
    secret: Field,

    // Public
    commitment: pub Field,
) {
    let computed = std::hash::pedersen_hash([secret]);

    assert(computed == commitment, "commitment mismatch: pedersen_hash([secret]) != commitment");
}

// --- Tests ---

#[test]
fn test_valid_commitment() {
    let secret = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    let commitment = std::hash::pedersen_hash([secret]);

    main(secret, commitment);
}

#[test(should_fail_with = "commitment mismatch: pedersen_hash([secret]) != commitment")]
fn test_wrong_commitment_fails() {
    let secret = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    let wrong_commitment = 0xdeadbeef;

    main(secret, wrong_commitment);
}

#[test(should_fail_with = "commitment mismatch: pedersen_hash([secret]) != commitment")]
fn test_zero_secret_wrong_commitment_fails() {
    main(0, 0xdeadbeef);
}

#[test]
fn test_zero_secret_valid_commitment() {
    let secret = 0;
    let commitment = std::hash::pedersen_hash([secret]);

    main(secret, commitment);
}

