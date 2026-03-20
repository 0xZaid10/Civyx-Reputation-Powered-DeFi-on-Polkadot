// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityRegistry {
    function verifyIdentity(address wallet) external view returns (bool);
    function getCommitment(address wallet)  external view returns (bytes32);
}

interface ITaskRewardDispenser {
    function awardTask(bytes32 commitment, bytes32 taskId) external;
}

/**
 * @title  CommunityDrop
 * @notice One-stop community drop contract. Holds PAS, verifies Civyx identity,
 *         awards reputation points, and sends PAS — all in a single transaction.
 *
 *         Claim conditions:
 *           - Wallet must have a registered, active Civyx identity
 *           - Each identity commitment can only claim once (TaskRewardDispenser enforces this)
 *           - Contract must hold enough PAS to cover the claim
 *
 *         Task ID: keccak256("civyx:task:community_drop:genesis")
 *
 *         Rep points awarded:
 *           - 5 pts if identity's globalReputation < 50
 *           - 3 pts if identity's globalReputation >= 50
 *           (decided by TaskRewardDispenser automatically)
 *
 *         Deployment steps:
 *           1. Deploy this contract
 *           2. Call TaskRewardDispenser.grantTaskOracle(address(this))
 *           3. Send PAS to this contract address (admin funds it)
 *           4. Users call claim() — rep + PAS in one tx
 */
contract CommunityDrop is Ownable, Pausable, ReentrancyGuard {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant TASK_ID =
        keccak256("civyx:task:community_drop:genesis");

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IIdentityRegistry    public identityRegistry;
    ITaskRewardDispenser public dispenser;

    /// @notice PAS amount sent to each claimer (in planck, 1 PAS = 1e10)
    uint256 public claimAmount;

    /// @notice Total successful claims
    uint256 public totalClaims;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Claimed(
        address indexed wallet,
        bytes32 indexed commitment,
        uint256         pasAmount
    );
    event Funded(address indexed funder, uint256 amount);
    event ClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event Withdrawn(address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotRegistered(address wallet);
    error InsufficientContractBalance(uint256 available, uint256 required);
    error TransferFailed();
    error ZeroAddress();
    error ZeroAmount();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _identityRegistry  Deployed IdentityRegistry address
     * @param _dispenser         Deployed TaskRewardDispenser address
     * @param _claimAmount       PAS per claim in planck (e.g. 50 PAS = 500_000_000_000)
     * @param _admin             Admin address
     */
    constructor(
        address _identityRegistry,
        address _dispenser,
        uint256 _claimAmount,
        address _admin
    ) Ownable(_admin) {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        if (_dispenser        == address(0)) revert ZeroAddress();
        if (_claimAmount      == 0)          revert ZeroAmount();

        identityRegistry = IIdentityRegistry(_identityRegistry);
        dispenser        = ITaskRewardDispenser(_dispenser);
        claimAmount      = _claimAmount;
    }

    // -------------------------------------------------------------------------
    // Claim
    // -------------------------------------------------------------------------

    /**
     * @notice Claim PAS airdrop and earn reputation points.
     *
     * @dev    Checks-effects-interactions:
     *           1. Verify identity is registered
     *           2. Check contract has enough balance
     *           3. Increment totalClaims (state change)
     *           4. Call dispenser (external — reverts if already claimed)
     *           5. Transfer PAS to caller
     *
     *         Double-claim prevention: TaskRewardDispenser permanently records
     *         (commitment, TASK_ID). If already claimed, step 4 reverts with
     *         AlreadyClaimed before any PAS is sent.
     */
    function claim() external nonReentrant whenNotPaused {
        if (!identityRegistry.verifyIdentity(msg.sender))
            revert NotRegistered(msg.sender);
        if (address(this).balance < claimAmount)
            revert InsufficientContractBalance(address(this).balance, claimAmount);

        bytes32 commitment = identityRegistry.getCommitment(msg.sender);

        totalClaims++;

        // Awards rep — reverts with AlreadyClaimed if commitment already claimed
        dispenser.awardTask(commitment, TASK_ID);

        // Send PAS after rep is awarded
        (bool ok, ) = msg.sender.call{ value: claimAmount }("");
        if (!ok) revert TransferFailed();

        emit Claimed(msg.sender, commitment, claimAmount);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    /// @notice Current PAS balance held by this contract
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice How many claims can still be paid out
    function remainingClaims() external view returns (uint256) {
        if (claimAmount == 0) return 0;
        return address(this).balance / claimAmount;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Update the PAS amount per claim
    function setClaimAmount(uint256 newAmount) external onlyOwner {
        if (newAmount == 0) revert ZeroAmount();
        emit ClaimAmountUpdated(claimAmount, newAmount);
        claimAmount = newAmount;
    }

    function setIdentityRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IIdentityRegistry(newRegistry);
    }

    function setDispenser(address newDispenser) external onlyOwner {
        if (newDispenser == address(0)) revert ZeroAddress();
        dispenser = ITaskRewardDispenser(newDispenser);
    }

    /// @notice Withdraw remaining PAS (emergency or refill management)
    function withdraw(uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, ) = to.call{ value: amount }("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Accept PAS funding
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }
}
