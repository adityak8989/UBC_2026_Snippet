// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SnippetLicenses
/// @notice Sells non-exclusive licenses to short podcast clips for USDC and records each license on-chain.
/// @dev The contract never holds funds: buyLicense pulls USDC from the buyer straight to the three payees.
///      On Arc, `usdc` must be the 6-decimal ERC-20 interface, not the 18-decimal native balance.
///      Spec: docs/PLAN.md section 4.
contract SnippetLicenses is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum UseType {
        Editorial,
        Social,
        Commercial
    }

    struct Clip {
        bytes32 fileHash; // sha256 of the exact file we serve
        address rightsHolder;
        address contributor; // address(0) if nobody is credited
        uint16 rhBps;
        uint16 contribBps;
        uint16 platformBps;
        bool listed;
        bool active;
        uint256[3] prices; // indexed by UseType, in USDC units (6 decimals); 0 = not for sale
    }

    struct License {
        bytes32 clipId;
        bytes32 fileHash;
        address buyer;
        UseType useType;
        uint64 timestamp;
        uint256 price;
        uint256 rhAmount;
        uint256 contribAmount;
        uint256 platformAmount;
    }

    uint256 public constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable usdc;
    address public immutable treasury;

    /// @notice Number of licenses sold. License IDs start at 1.
    uint256 public licenseCount;

    mapping(bytes32 clipId => Clip) private _clips;
    mapping(uint256 licenseId => License) private _licenses;

    event ClipListed(
        bytes32 indexed clipId,
        bytes32 fileHash,
        address rightsHolder,
        address contributor,
        uint16 rhBps,
        uint16 contribBps,
        uint16 platformBps,
        uint256[3] prices
    );
    event ClipUpdated(bytes32 indexed clipId, uint256[3] prices, bool active);
    event LicenseIssued(
        uint256 indexed licenseId,
        bytes32 indexed clipId,
        address indexed buyer,
        bytes32 fileHash,
        UseType useType,
        uint256 price,
        uint256 rhAmount,
        uint256 contribAmount,
        uint256 platformAmount,
        uint64 timestamp
    );

    error ZeroAddress();
    error ZeroValue();
    error InvalidBps();
    error ContributorBpsWithoutContributor();
    error ClipAlreadyListed(bytes32 clipId);
    error ClipNotListed(bytes32 clipId);
    error ClipNotActive(bytes32 clipId);
    error PriceNotSet(bytes32 clipId, UseType useType);

    constructor(IERC20 usdc_, address treasury_, address owner_) Ownable(owner_) {
        if (address(usdc_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        treasury = treasury_;
    }

    // ---------------------------------------------------------------- owner

    function listClip(
        bytes32 clipId,
        bytes32 fileHash,
        address rightsHolder,
        address contributor,
        uint16 rhBps,
        uint16 contribBps,
        uint16 platformBps,
        uint256[3] calldata prices
    ) external onlyOwner {
        if (clipId == bytes32(0) || fileHash == bytes32(0)) revert ZeroValue();
        if (rightsHolder == address(0)) revert ZeroAddress();
        if (uint256(rhBps) + contribBps + platformBps != BPS_DENOMINATOR) revert InvalidBps();
        if (contributor == address(0) && contribBps != 0) revert ContributorBpsWithoutContributor();
        if (_clips[clipId].listed) revert ClipAlreadyListed(clipId);

        _clips[clipId] = Clip({
            fileHash: fileHash,
            rightsHolder: rightsHolder,
            contributor: contributor,
            rhBps: rhBps,
            contribBps: contribBps,
            platformBps: platformBps,
            listed: true,
            active: true,
            prices: prices
        });

        emit ClipListed(clipId, fileHash, rightsHolder, contributor, rhBps, contribBps, platformBps, prices);
    }

    /// @notice Change prices or delist. Licenses already sold are unaffected.
    function updateClip(bytes32 clipId, uint256[3] calldata prices, bool active) external onlyOwner {
        Clip storage clip = _clips[clipId];
        if (!clip.listed) revert ClipNotListed(clipId);

        clip.prices = prices;
        clip.active = active;

        emit ClipUpdated(clipId, prices, active);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- buy

    /// @notice Buy a license. The buyer must first approve this contract for the price (6-decimal USDC units).
    function buyLicense(bytes32 clipId, UseType useType)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 licenseId)
    {
        // Checks
        Clip storage clip = _clips[clipId];
        if (!clip.listed) revert ClipNotListed(clipId);
        if (!clip.active) revert ClipNotActive(clipId);
        uint256 price = clip.prices[uint8(useType)];
        if (price == 0) revert PriceNotSet(clipId, useType);

        // Platform gets the rounding remainder, so the three parts always add up to the price.
        uint256 rhAmount = (price * clip.rhBps) / BPS_DENOMINATOR;
        uint256 contribAmount = (price * clip.contribBps) / BPS_DENOMINATOR;
        uint256 platformAmount = price - rhAmount - contribAmount;

        // Effects
        licenseId = ++licenseCount;
        License memory license = License({
            clipId: clipId,
            fileHash: clip.fileHash,
            buyer: msg.sender,
            useType: useType,
            // casting to 'uint64' is safe because Unix timestamps fit in 64 bits for billions of years
            // forge-lint: disable-next-line(unsafe-typecast)
            timestamp: uint64(block.timestamp),
            price: price,
            rhAmount: rhAmount,
            contribAmount: contribAmount,
            platformAmount: platformAmount
        });
        _licenses[licenseId] = license;
        _emitLicenseIssued(licenseId, license);

        // Interactions
        _pay(clip.rightsHolder, rhAmount);
        _pay(clip.contributor, contribAmount);
        _pay(treasury, platformAmount);
    }

    // ---------------------------------------------------------------- views

    function getClip(bytes32 clipId) external view returns (Clip memory) {
        return _clips[clipId];
    }

    function getLicense(uint256 licenseId) external view returns (License memory) {
        return _licenses[licenseId];
    }

    // ---------------------------------------------------------------- internal

    function _pay(address to, uint256 amount) private {
        if (amount > 0) usdc.safeTransferFrom(msg.sender, to, amount);
    }

    function _emitLicenseIssued(uint256 licenseId, License memory l) private {
        emit LicenseIssued(
            licenseId,
            l.clipId,
            l.buyer,
            l.fileHash,
            l.useType,
            l.price,
            l.rhAmount,
            l.contribAmount,
            l.platformAmount,
            l.timestamp
        );
    }
}
