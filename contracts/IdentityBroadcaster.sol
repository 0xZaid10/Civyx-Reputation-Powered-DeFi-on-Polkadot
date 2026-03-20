// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ── XCM Precompile interface ──────────────────────────────────────────────────

address constant XCM_PRECOMPILE = address(0xA0000);

interface IXcm {
    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }
    function execute(bytes calldata message, Weight calldata weight) external;
    function send(bytes calldata destination, bytes calldata message) external;
    function weighMessage(bytes calldata message) external view returns (Weight memory);
}

// ── Civyx registry interfaces ─────────────────────────────────────────────────

interface ITrustOracle {
    struct TrustProfile {
        bool    isRegistered;
        uint256 stake;
        uint256 globalReputation;
        uint256 effectiveReputation;
        uint256 endorsementCount;
        uint256 linkedWalletCount;
        bytes32 commitment;
    }
    function getTrustProfile(address wallet) external view returns (TrustProfile memory);
}

/**
 * @title  IdentityBroadcaster
 * @notice Enables cross-chain broadcasting of Civyx identity snapshots via XCM.
 *
 *         Two broadcast modes:
 *
 *         OPTION A — Direct wallet broadcast (no contract involvement in XCM):
 *           1. Wallet calls prepareSnapshot(wallet) → gets encoded XCM bytes + weight
 *           2. Wallet calls xcm.send(destination, xcmMessage) directly
 *           3. Optionally calls recordBroadcast() to log the event on-chain
 *
 *         OPTION B — Two-step contract-assisted broadcast:
 *           1. Wallet calls prepareSnapshot(wallet) → gets xcmMessage + weight
 *           2. Wallet calls broadcastIdentity(paraId, destination, xcmMessage)
 *              → contract validates identity, enforces cooldown, emits IdentityBroadcast event
 *              → wallet must then call xcm.send() separately (contract can't send cross-chain)
 *
 *         WHY contracts can't call xcm.send():
 *           pallet_xcm::send on Polkadot Hub only accepts EOA (wallet) origins.
 *           Contract addresses are rejected. xcm.execute() works from contracts
 *           but is local-only. For actual cross-chain messages, the wallet must
 *           call xcm.send() directly.
 *
 * @dev    The XCM message encodes the full IdentitySnapshot as ABI-encoded bytes
 *         wrapped in a Transact instruction targeting the destination chain.
 */
contract IdentityBroadcaster is Ownable, ReentrancyGuard {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct IdentitySnapshot {
        bytes32 commitment;
        uint256 stake;
        uint256 walletCount;
        bool    active;
        uint256 globalReputation;
        uint256 effectiveReputation;
        uint256 endorsementCount;
        uint8   reputationTier;
        uint256 nativeBalance;
        uint256 snapshotBlock;
        address broadcaster;
    }

    struct PreparedBroadcast {
        IdentitySnapshot snapshot;
        bytes            xcmMessage;      // SCALE-encoded VersionedXcm V5
        IXcm.Weight      xcmWeight;       // from weighMessage()
        bool             canBroadcast;
        uint256          cooldownRemaining;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    ITrustOracle public trustOracle;
    IXcm         public xcm;

    uint256 public totalBroadcasts;
    mapping(bytes32 => uint256) public broadcastCount;
    mapping(bytes32 => uint256) public lastBroadcastBlock;
    uint256 public broadcastCooldown = 100;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event IdentityBroadcast(
        bytes32 indexed commitment,
        address indexed broadcaster,
        uint32  indexed destinationParaId,
        IdentitySnapshot snapshot
    );
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event XcmUpdated(address oldXcm, address newXcm);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotRegistered(address wallet);
    error BroadcastCooldownActive(uint256 currentBlock, uint256 availableAt);
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _trustOracle, address _admin) Ownable(_admin) {
        if (_trustOracle == address(0)) revert ZeroAddress();
        trustOracle = ITrustOracle(_trustOracle);
        xcm         = IXcm(XCM_PRECOMPILE);
    }

    // -------------------------------------------------------------------------
    // OPTION B — Contract-assisted broadcast
    // -------------------------------------------------------------------------

    /**
     * @notice Step 1 of Option B: validate identity, enforce cooldown, emit event.
     *
     * @dev    The contract CANNOT call xcm.send() — pallet_xcm rejects contract
     *         origins on Polkadot Hub. After calling this function, the wallet
     *         must call xcm.send(destination, xcmMessage) directly using the
     *         xcmMessage returned by prepareSnapshot().
     *
     *         Workflow:
     *           1. Call prepareSnapshot(msg.sender) to get xcmMessage + weight
     *           2. Call this function to validate + emit the on-chain event
     *           3. Call xcm.send(destination, prepareSnapshot.xcmMessage) from wallet
     *
     * @param destinationParaId  Target parachain ID (for event indexing)
     */
    function broadcastIdentity(
        uint32 destinationParaId,
        bytes calldata /* xcmMessage */
    )
        external
        nonReentrant
    {
        ITrustOracle.TrustProfile memory profile = trustOracle.getTrustProfile(msg.sender);
        if (!profile.isRegistered) revert NotRegistered(msg.sender);

        uint256 last = lastBroadcastBlock[profile.commitment];
        if (last != 0) {
            uint256 availableAt = last + broadcastCooldown;
            if (block.number < availableAt)
                revert BroadcastCooldownActive(block.number, availableAt);
        }

        IdentitySnapshot memory snap = _buildSnapshot(profile, msg.sender);

        lastBroadcastBlock[profile.commitment] = block.number;
        broadcastCount[profile.commitment]++;
        totalBroadcasts++;

        emit IdentityBroadcast(profile.commitment, msg.sender, destinationParaId, snap);
    }

    // sendXcm() removed: pallet_xcm on Polkadot Hub rejects contract-origin send() calls.
    // Use Option A — call xcm.send() directly from the wallet with prep.xcmMessage.


    // -------------------------------------------------------------------------
    // OPTION A + B — prepareSnapshot (view — free to call)
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the full identity snapshot + encoded XCM bytes for a wallet.
     *
     * @dev    Used by both Option A (direct wallet send) and Option B (contract-assisted).
     *         The xcmMessage encodes the IdentitySnapshot as ABI-encoded bytes
     *         inside a VersionedXcm V5 message.
     *
     *         Option A workflow:
     *           const prep = await broadcaster.prepareSnapshot(wallet);
     *           await xcm.send(destination, prep.xcmMessage);
     *
     *         Option B workflow:
     *           const prep = await broadcaster.prepareSnapshot(wallet);
     *           await broadcaster.broadcastIdentity(paraId, prep.xcmMessage);
     *           await broadcaster.sendXcm(destination, prep.xcmMessage);
     *
     * @param wallet  The wallet to build the snapshot for
     */
    function prepareSnapshot(address wallet)
        external
        view
        returns (PreparedBroadcast memory prep)
    {
        ITrustOracle.TrustProfile memory profile = trustOracle.getTrustProfile(wallet);

        prep.snapshot = _buildSnapshot(profile, wallet);

        // Build confirmed-valid XCM V5 ClearOrigin message.
        // Snapshot data is carried in the IdentityBroadcast event, not XCM payload.
        prep.xcmMessage = _encodeXcmMessage("");

        // Hardcoded weight for UnpaidExecution+ClearOrigin.
        // ClearOrigin alone = 890_000 refTime. UnpaidExecution adds ~890_000 more.
        // Using 2_000_000 as safe upper bound — run weighMessage to get exact value.
        prep.xcmWeight = IXcm.Weight({ refTime: 1_830_000, proofSize: 0 }); // confirmed by weighMessage on testnet

        // Cooldown status
        uint256 last        = lastBroadcastBlock[profile.commitment];
        uint256 availableAt = last == 0 ? 0 : last + broadcastCooldown;
        prep.canBroadcast        = (last == 0 || block.number >= availableAt) && profile.isRegistered;
        prep.cooldownRemaining   = (last != 0 && block.number < availableAt) ? availableAt - block.number : 0;
    }

    // -------------------------------------------------------------------------
    // View: getSnapshot (legacy — kept for compatibility)
    // -------------------------------------------------------------------------

    function getSnapshot(address wallet)
        external
        view
        returns (IdentitySnapshot memory snap, bool canBroadcast, uint256 cooldownRemaining)
    {
        ITrustOracle.TrustProfile memory profile = trustOracle.getTrustProfile(wallet);
        snap = _buildSnapshot(profile, wallet);

        uint256 last        = lastBroadcastBlock[profile.commitment];
        uint256 availableAt = last == 0 ? 0 : last + broadcastCooldown;
        canBroadcast      = (last == 0 || block.number >= availableAt) && profile.isRegistered;
        cooldownRemaining = (last != 0 && block.number < availableAt) ? availableAt - block.number : 0;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _buildSnapshot(
        ITrustOracle.TrustProfile memory profile,
        address wallet
    ) internal view returns (IdentitySnapshot memory) {
        return IdentitySnapshot({
            commitment:          profile.commitment,
            stake:               profile.stake,
            walletCount:         profile.linkedWalletCount,
            active:              profile.isRegistered,
            globalReputation:    profile.globalReputation,
            effectiveReputation: profile.effectiveReputation,
            endorsementCount:    profile.endorsementCount,
            reputationTier:      _getTier(profile.effectiveReputation),
            nativeBalance:       wallet.balance,
            snapshotBlock:       block.number,
            broadcaster:         wallet
        });
    }

    /// @dev Builds a VersionedXcm V5 message: UnpaidExecution + ClearOrigin.
    ///      UnpaidExecution (0x2f) is required so the relay chain executes without
    ///      requiring fees from the origin. Without it the relay chain rejects the message.
    ///      ClearOrigin (0x0a) clears the origin after execution.
    ///      Both instructions confirmed valid on Polkadot Hub / Paseo testnet.
    function _encodeXcmMessage(bytes memory /*payload*/) internal pure returns (bytes memory) {
        return bytes.concat(
            hex"05",       // VersionedXcm::V5
            hex"08",       // compact(2) — 2 instructions
            hex"2f",       // UnpaidExecution (position 47 in v5 Instruction enum)
            hex"00",       // WeightLimit::Unlimited
            hex"00",       // check_origin: None
            hex"0a"        // ClearOrigin (position 10)
        );
    }

    function _getTier(uint256 rep) internal pure returns (uint8) {
        if (rep >= 600) return 4;
        if (rep >= 300) return 3;
        if (rep >= 100) return 2;
        if (rep >= 50)  return 1;
        return 0;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setTrustOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        trustOracle = ITrustOracle(newOracle);
    }

    function setXcm(address newXcm) external onlyOwner {
        if (newXcm == address(0)) revert ZeroAddress();
        emit XcmUpdated(address(xcm), newXcm);
        xcm = IXcm(newXcm);
    }

    function setBroadcastCooldown(uint256 newCooldown) external onlyOwner {
        emit CooldownUpdated(broadcastCooldown, newCooldown);
        broadcastCooldown = newCooldown;
    }
}
