// AegisID - Wallet Link Circuit
//
// Statement proven:
//   "I know a secret such that:
//     pedersen_hash([secret])                  == commitment
//     pedersen_hash([secret, wallet_address])  == nullifier"
//
// Private inputs (witness):
//   secret: Field  - the identity secret
//
// Public inputs (submitted on-chain):
//   commitment:     Field  - pedersen_hash([secret]), the identity anchor
//   nullifier:      Field  - pedersen_hash([secret, wallet_address]), one-time use
//   wallet_address: Field  - the wallet being linked (cast from address)

fn main(
    // Private
    secret: Field,

    // Public
    commitment:     pub Field,
    nullifier:      pub Field,
    wallet_address: pub Field,
) {
    // 1. Verify identity ownership
    let computed_commitment = std::hash::pedersen_hash([secret]);

    assert(
        computed_commitment == commitment,
        "commitment mismatch: pedersen_hash([secret]) != commitment"
    );

    // 2. Verify nullifier binds proof to this specific wallet
    // A proof for wallet_A cannot be replayed for wallet_B.
    let computed_nullifier = std::hash::pedersen_hash([secret, wallet_address]);

    assert(
        computed_nullifier == nullifier,
        "nullifier mismatch: pedersen_hash([secret, wallet_address]) != nullifier"
    );
}

// --- Tests ---
// Note: all Field literals must be < BN254 modulus:
// 21888242871839275222246405745257275088548364400416034343698204186575808495617

#[test]
fn test_valid_wallet_link() {
    let secret         = 12345678901234567890;
    let wallet_address = 0x1234567890123456789012345678901234567890;

    let commitment = std::hash::pedersen_hash([secret]);
    let nullifier  = std::hash::pedersen_hash([secret, wallet_address]);

    main(secret, commitment, nullifier, wallet_address);
}

#[test(should_fail_with = "commitment mismatch: pedersen_hash([secret]) != commitment")]
fn test_wrong_secret_fails() {
    let secret         = 12345678901234567890;
    let wrong_secret   = 9999999999;
    let wallet_address = 0x1234567890123456789012345678901234567890;

    let commitment = std::hash::pedersen_hash([secret]);
    let nullifier  = std::hash::pedersen_hash([wrong_secret, wallet_address]);

    main(wrong_secret, commitment, nullifier, wallet_address);
}

#[test(should_fail_with = "nullifier mismatch: pedersen_hash([secret, wallet_address]) != nullifier")]
fn test_wrong_nullifier_fails() {
    let secret         = 12345678901234567890;
    let wallet_address = 0x1234567890123456789012345678901234567890;

    let commitment      = std::hash::pedersen_hash([secret]);
    let wrong_nullifier = 9999;

    main(secret, commitment, wrong_nullifier, wallet_address);
}

#[test(should_fail_with = "nullifier mismatch: pedersen_hash([secret, wallet_address]) != nullifier")]
fn test_replayed_proof_different_wallet_fails() {
    // Critical security test:
    // A valid proof for wallet_A must not be usable for wallet_B.
    let secret   = 12345678901234567890;
    let wallet_a = 0x1111111111111111111111111111111111111111;
    let wallet_b = 0x2222222222222222222222222222222222222222;

    let commitment      = std::hash::pedersen_hash([secret]);
    let nullifier_for_a = std::hash::pedersen_hash([secret, wallet_a]);

    // Attempt to use wallet_A's nullifier for wallet_B - must fail
    main(secret, commitment, nullifier_for_a, wallet_b);
}

#[test]
fn test_same_secret_different_wallets_different_nullifiers() {
    let secret   = 12345678901234567890;
    let wallet_a = 0x1111111111111111111111111111111111111111;
    let wallet_b = 0x2222222222222222222222222222222222222222;

    let nullifier_a = std::hash::pedersen_hash([secret, wallet_a]);
    let nullifier_b = std::hash::pedersen_hash([secret, wallet_b]);

    assert(nullifier_a != nullifier_b, "nullifiers must differ per wallet");
}


