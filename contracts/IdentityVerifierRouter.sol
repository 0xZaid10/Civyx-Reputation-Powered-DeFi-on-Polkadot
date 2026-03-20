// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IUltraHonkVerifier {
    function verify(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external view returns (bool);
}

/**
 * @title  IdentityVerifierRouter
 * @notice Router that delegates ZK proof verification to the
 *         bb-generated UltraHonk verifier contracts.
 *
 *         The actual cryptographic verification is performed by:
 *           - WalletLinkVerifier.sol  (from wallet_link Noir circuit)
 *           - NullifierVerifier.sol   (from nullifier Noir circuit)
 *           - IdentityVerifier.sol    (from identity Noir circuit)
 *
 *         Each was generated with:
 *           bb write_vk -b ./target/<circuit>.json -o ./target --oracle_hash keccak
 *           bb write_solidity_verifier -k ./target/vk -o ./target/<n>Verifier.sol
 */
contract IdentityVerifierRouter is Ownable {

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IUltraHonkVerifier public walletLinkVerifier;
    IUltraHonkVerifier public nullifierVerifier;
    IUltraHonkVerifier public identityVerifier;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event WalletLinkVerifierUpdated(address oldAddr, address newAddr);
    event NullifierVerifierUpdated(address oldAddr, address newAddr);
    event IdentityVerifierUpdated(address oldAddr, address newAddr);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _walletLinkVerifier,
        address _nullifierVerifier,
        address _identityVerifier,
        address _admin
    ) Ownable(_admin) {
        require(_walletLinkVerifier != address(0), "zero walletLink");
        require(_nullifierVerifier  != address(0), "zero nullifier");
        require(_identityVerifier   != address(0), "zero identity");

        walletLinkVerifier = IUltraHonkVerifier(_walletLinkVerifier);
        nullifierVerifier  = IUltraHonkVerifier(_nullifierVerifier);
        identityVerifier   = IUltraHonkVerifier(_identityVerifier);
    }

    // -------------------------------------------------------------------------
    // Verification
    // -------------------------------------------------------------------------

    function verifyWalletLink(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool) {
        return walletLinkVerifier.verify(proof, publicInputs);
    }

    function verifyNullifier(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool) {
        return nullifierVerifier.verify(proof, publicInputs);
    }

    function verifyIdentity(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool) {
        return identityVerifier.verify(proof, publicInputs);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setWalletLinkVerifier(address newAddr) external onlyOwner {
        require(newAddr != address(0), "zero address");
        emit WalletLinkVerifierUpdated(address(walletLinkVerifier), newAddr);
        walletLinkVerifier = IUltraHonkVerifier(newAddr);
    }

    function setNullifierVerifier(address newAddr) external onlyOwner {
        require(newAddr != address(0), "zero address");
        emit NullifierVerifierUpdated(address(nullifierVerifier), newAddr);
        nullifierVerifier = IUltraHonkVerifier(newAddr);
    }

    function setIdentityVerifier(address newAddr) external onlyOwner {
        require(newAddr != address(0), "zero address");
        emit IdentityVerifierUpdated(address(identityVerifier), newAddr);
        identityVerifier = IUltraHonkVerifier(newAddr);
    }
}
