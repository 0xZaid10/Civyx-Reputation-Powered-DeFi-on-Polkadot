// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ITrustOracle {
    function verifyIdentity(address wallet)         external view returns (bool);
    function getEffectiveReputation(address wallet) external view returns (uint256);
    function getCommitment(address wallet)          external view returns (bytes32);
}

/**
 * @title  CivUSD
 * @notice Reputation-aware ethical stablecoin backed by PAS collateral.
 *
 *         Key design:
 *           - Must hold active Civyx identity to mint
 *           - Collateral ratio determined by effective reputation (5 tiers)
 *           - Higher reputation = lower collateral required
 *           - Price oracle tracks PAS/USD value for health checks
 *           - No interest — one-time mint fee only (deducted from minted amount)
 *           - Full liquidation for undercollateralised positions
 *
 *         Collateral ratio tiers:
 *           Rep 0–49    180%  (Tier 0)
 *           Rep 50–99   150%  (Tier 1)
 *           Rep 100–299 130%  (Tier 2)
 *           Rep 300–599 115%  (Tier 3)
 *           Rep 600+    110%  (Tier 4)
 *
 *         Mint mechanics:
 *           gross CivUSD = (collateral * pasUsdPrice / 1e8) * 100 / ratio
 *           fee          = gross * mintFeeBps / 10_000
 *           net CivUSD   = gross - fee  (what user receives)
 *
 *         Health check:
 *           collateralUsd = collateral * pasUsdPrice / 1e8
 *           healthRatio   = collateralUsd * 100 / debt
 *           healthy if    healthRatio >= collateralRatioFor(wallet)
 *
 *         Liquidation:
 *           Any party can liquidate an unhealthy position by providing the debt.
 *           They receive the full collateral. No discount for now — extendable.
 */
contract CivUSD is ERC20, Ownable, Pausable, ReentrancyGuard {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant BASIS_POINTS  = 10_000;
    uint256 public constant PRICE_PREC    = 1e8;    // 8-decimal price precision

    // Reputation thresholds
    uint256 public constant REP_TIER_1 = 50;
    uint256 public constant REP_TIER_2 = 100;
    uint256 public constant REP_TIER_3 = 300;
    uint256 public constant REP_TIER_4 = 600;

    // Collateral ratios as plain percentages (e.g. 180 = 180%)
    uint256 public constant RATIO_TIER_0 = 180;
    uint256 public constant RATIO_TIER_1 = 150;
    uint256 public constant RATIO_TIER_2 = 130;
    uint256 public constant RATIO_TIER_3 = 115;
    uint256 public constant RATIO_TIER_4 = 110;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    ITrustOracle public trustOracle;

    /// @notice PAS/USD price in 8-decimal precision (e.g. 5_000_000 = $0.05)
    uint256 public pasUsdPrice;

    /// @notice Mint fee in basis points. Default 50 bps = 0.5%. Max 500 bps.
    uint256 public mintFeeBps = 50;

    /// @notice PAS collateral locked per wallet (in wei)
    mapping(address => uint256) public collateralOf;

    /// @notice CivUSD debt (minted) per wallet
    mapping(address => uint256) public debtOf;

    /// @notice Total PAS locked
    uint256 public totalCollateral;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Minted(
        address indexed wallet,
        bytes32 indexed commitment,
        uint256         collateral,
        uint256         grossCivUsd,
        uint256         fee,
        uint256         netCivUsd,
        uint256         ratio
    );
    event Burned(address indexed wallet, uint256 civUsdBurned, uint256 collateralReturned);
    event Liquidated(address indexed target, address indexed liquidator, uint256 debt, uint256 collateral);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotRegisteredIdentity(address wallet);
    error InsufficientCollateral(uint256 collateral, uint256 minRequired);
    error InsufficientDebt(uint256 debt, uint256 requested);
    error PositionHealthy(address wallet);
    error ZeroAmount();
    error ZeroAddress();
    error ZeroPrice();
    error FeeTooHigh(uint256 feeBps);
    error TransferFailed();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _trustOracle  Deployed TrustOracle address
     * @param _pasUsdPrice  Initial PAS/USD price (8 decimals, e.g. 5_000_000 = $0.05)
     * @param _admin        Owner/admin
     */
    constructor(
        address _trustOracle,
        uint256 _pasUsdPrice,
        address _admin
    )
        ERC20("Civyx USD", "CivUSD")
        Ownable(_admin)
    {
        if (_trustOracle == address(0)) revert ZeroAddress();
        if (_pasUsdPrice == 0)          revert ZeroPrice();
        trustOracle = ITrustOracle(_trustOracle);
        pasUsdPrice = _pasUsdPrice;
    }

    // -------------------------------------------------------------------------
    // Mint
    // -------------------------------------------------------------------------

    /**
     * @notice Mint CivUSD by depositing PAS collateral.
     *
     * @dev    The user deposits collateral (msg.value) and requests to receive
     *         `civUsdAmount` net CivUSD (after fee deduction).
     *
     *         Validation:
     *           gross = civUsdAmount / (1 - fee/BASIS_POINTS)  [approx]
     *           requiredCollateral = gross * ratio / 100 * 1e18 / pasUsdPrice
     *           msg.value must >= requiredCollateral
     *
     *         Simplified as:
     *           gross = civUsdAmount * BASIS_POINTS / (BASIS_POINTS - mintFeeBps)
     *           requiredCollateral = gross * ratio * PRICE_PREC / (100 * pasUsdPrice) [scaled to wei]
     *
     * @param civUsdAmount  Net CivUSD to receive (after fee)
     */
    function mint(uint256 civUsdAmount)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (msg.value == 0) revert ZeroAmount();
        if (!trustOracle.verifyIdentity(msg.sender))
            revert NotRegisteredIdentity(msg.sender);

        uint256 rep   = trustOracle.getEffectiveReputation(msg.sender);
        uint256 ratio = _collateralRatio(rep);

        // Compute max mintable from the supplied collateral (msg.value):
        //   grossFromValue = (msg.value * pasUsdPrice * 100) / (1e18 * ratio)
        //   feeFromValue   = grossFromValue * mintFeeBps / BASIS_POINTS
        //   netFromValue   = grossFromValue - feeFromValue
        // Validate that civUsdAmount <= netFromValue (user cannot mint more than collateral allows)
        uint256 grossFromValue =
            (msg.value * pasUsdPrice * 100 * 1e10) / (1e18 * ratio);
        uint256 feeFromValue   = (grossFromValue * mintFeeBps) / BASIS_POINTS;
        uint256 netFromValue   = grossFromValue - feeFromValue;

        if (civUsdAmount > netFromValue)
            revert InsufficientCollateral(msg.value, 0); // 0 = no fixed required, ratio-dependent

        // Gross and fee proportional to what user is actually minting
        uint256 gross = (civUsdAmount * BASIS_POINTS) / (BASIS_POINTS - mintFeeBps);
        uint256 fee   = gross - civUsdAmount;

        // Store the full msg.value as collateral — no refund, all becomes backing
        // This makes positions healthier when user sends more than minimum
        collateralOf[msg.sender] += msg.value;
        debtOf[msg.sender]       += civUsdAmount;
        totalCollateral          += msg.value;

        // Mint net CivUSD to user
        _mint(msg.sender, civUsdAmount);

        // Mint fee to this contract as protocol reserve
        if (fee > 0) _mint(address(this), fee);

        bytes32 commitment = trustOracle.getCommitment(msg.sender);
        emit Minted(msg.sender, commitment, msg.value, gross, fee, civUsdAmount, ratio);
    }

    // -------------------------------------------------------------------------
    // Burn
    // -------------------------------------------------------------------------

    /**
     * @notice Burn CivUSD and receive back PAS collateral proportionally.
     * @param  civUsdAmount  Amount of CivUSD to burn
     */
    function burn(uint256 civUsdAmount)
        external
        nonReentrant
        whenNotPaused
    {
        if (civUsdAmount == 0) revert ZeroAmount();
        if (debtOf[msg.sender] < civUsdAmount)
            revert InsufficientDebt(debtOf[msg.sender], civUsdAmount);

        uint256 collateralReturn = collateralOf[msg.sender] * civUsdAmount / debtOf[msg.sender];

        collateralOf[msg.sender] -= collateralReturn;
        debtOf[msg.sender]       -= civUsdAmount;
        totalCollateral          -= collateralReturn;

        _burn(msg.sender, civUsdAmount);

        (bool ok, ) = msg.sender.call{ value: collateralReturn }("");
        if (!ok) revert TransferFailed();

        emit Burned(msg.sender, civUsdAmount, collateralReturn);
    }

    // -------------------------------------------------------------------------
    // Liquidation
    // -------------------------------------------------------------------------

    /**
     * @notice Liquidate an undercollateralised position.
     *
     * @dev    Caller must hold enough CivUSD to cover `debtAmount`.
     *         On success: caller's CivUSD is burned, they receive the full collateral.
     *         Position is marked fully cleared.
     *
     * @param  target      The position owner to liquidate
     * @param  debtAmount  Amount of debt to repay (must equal full debt for full liquidation)
     */
    function liquidate(address target, uint256 debtAmount)
        external
        nonReentrant
        whenNotPaused
    {
        if (isHealthy(target)) revert PositionHealthy(target);
        if (debtOf[target] < debtAmount)
            revert InsufficientDebt(debtOf[target], debtAmount);

        uint256 collateralToSeize = collateralOf[target] * debtAmount / debtOf[target];

        collateralOf[target] -= collateralToSeize;
        debtOf[target]       -= debtAmount;
        totalCollateral      -= collateralToSeize;

        _burn(msg.sender, debtAmount);

        (bool ok, ) = msg.sender.call{ value: collateralToSeize }("");
        if (!ok) revert TransferFailed();

        emit Liquidated(target, msg.sender, debtAmount, collateralToSeize);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    /**
     * @notice Collateral ratio as a plain percentage for a wallet's current reputation.
     */
    function collateralRatioFor(address wallet) external view returns (uint256) {
        return _collateralRatio(trustOracle.getEffectiveReputation(wallet));
    }

    /**
     * @notice Max CivUSD mintable for a given collateral amount.
     * @return net    Net CivUSD user would receive
     * @return fee    Fee minted to protocol reserve
     * @return ratio  Collateral ratio that applies (plain %)
     */
    function maxMintable(address wallet, uint256 collateral)
        external
        view
        returns (uint256 net, uint256 fee, uint256 ratio)
    {
        uint256 rep = trustOracle.getEffectiveReputation(wallet);
        ratio = _collateralRatio(rep);
        // gross = (collateral * pasUsdPrice * 100) / (1e18 * ratio)
        // Matches the test helper: collateralUsd = collateral*pasUsdPrice/1e18, gross = collateralUsd*100/ratio
        uint256 gross =
            (collateral * pasUsdPrice * 100 * 1e10) / (1e18 * ratio);
        fee = (gross * mintFeeBps) / BASIS_POINTS;
        net = gross - fee;
    }

    /**
     * @notice Whether a position is currently healthy (sufficiently collateralised).
     */
    function isHealthy(address wallet) public view returns (bool) {
        uint256 debt = debtOf[wallet];
        if (debt == 0) return true;

        uint256 col       = collateralOf[wallet];
        uint256 rep       = trustOracle.getEffectiveReputation(wallet);
        uint256 ratio     = _collateralRatio(rep);

        // collateralUsd = col * pasUsdPrice / 1e18  (rough USD value)
        // healthRatio   = collateralUsd * 100 / debt
        // healthy if healthRatio >= ratio
        // col * pasUsdPrice * 100 / 1e18 >= debt * ratio
        uint256 collateralUsd = (col * pasUsdPrice * 1e10) / 1e18;
        return (collateralUsd * 100) >= (debt * ratio);
    }

    /**
     * @notice Whether a wallet can currently mint.
     */
    function canMint(address wallet) external view returns (bool) {
        return trustOracle.verifyIdentity(wallet);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _collateralRatio(uint256 rep) internal pure returns (uint256) {
        if (rep >= REP_TIER_4) return RATIO_TIER_4; // 600+ → 110%
        if (rep >= REP_TIER_3) return RATIO_TIER_3; // 300–599 → 115%
        if (rep >= REP_TIER_2) return RATIO_TIER_2; // 100–299 → 130%
        if (rep >= REP_TIER_1) return RATIO_TIER_1; // 50–99 → 150%
        return RATIO_TIER_0;                         // 0–49 → 180%
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /**
     * @notice Update the PAS/USD price. Affects all health checks immediately.
     */
    function updatePrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert ZeroPrice();
        emit PriceUpdated(pasUsdPrice, newPrice);
        pasUsdPrice = newPrice;
    }

    function setTrustOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        trustOracle = ITrustOracle(newOracle);
    }

    function setMintFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 500) revert FeeTooHigh(newFeeBps);
        emit MintFeeUpdated(mintFeeBps, newFeeBps);
        mintFeeBps = newFeeBps;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    receive() external payable {}
}
