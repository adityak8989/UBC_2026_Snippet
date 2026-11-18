// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SnippetLicenses} from "../src/SnippetLicenses.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {ReentrantUSDC} from "./mocks/ReentrantUSDC.sol";

contract SnippetLicensesTest is Test {
    // Same as the contract's events, redeclared so vm.expectEmit can match them.
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
        SnippetLicenses.UseType useType,
        uint256 price,
        uint256 rhAmount,
        uint256 contribAmount,
        uint256 platformAmount,
        uint64 timestamp
    );

    uint256 constant USDC = 1e6; // 1 USDC in 6-decimal units

    SnippetLicenses licenses;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address rightsHolder = makeAddr("rightsHolder");
    address contributor = makeAddr("contributor");
    address buyer = makeAddr("buyer");
    address stranger = makeAddr("stranger");

    bytes32 constant CLIP = keccak256("clip-1");
    // Real file hashes are sha256, but sha256 runs as a precompile call, which would use up vm.prank.
    // Any bytes32 works as a stand-in here.
    bytes32 constant FILE_HASH = keccak256("clip-1 file bytes");

    function setUp() public {
        usdc = new MockUSDC();
        licenses = new SnippetLicenses(IERC20(address(usdc)), treasury, owner);

        // 70% rights holder, 20% contributor, 10% platform.
        vm.prank(owner);
        licenses.listClip(CLIP, FILE_HASH, rightsHolder, contributor, 7000, 2000, 1000, _prices());

        usdc.mint(buyer, 1_000 * USDC);
        vm.prank(buyer);
        usdc.approve(address(licenses), type(uint256).max);
    }

    function _prices() internal pure returns (uint256[3] memory) {
        return [uint256(5 * USDC), 10 * USDC, 25 * USDC]; // Editorial, Social, Commercial
    }

    // ------------------------------------------------------------ constructor

    function test_Constructor_SetsState() public view {
        assertEq(address(licenses.usdc()), address(usdc));
        assertEq(licenses.treasury(), treasury);
        assertEq(licenses.owner(), owner);
        assertEq(licenses.licenseCount(), 0);
    }

    function test_RevertWhen_ConstructorZeroUsdc() public {
        vm.expectRevert(SnippetLicenses.ZeroAddress.selector);
        new SnippetLicenses(IERC20(address(0)), treasury, owner);
    }

    function test_RevertWhen_ConstructorZeroTreasury() public {
        vm.expectRevert(SnippetLicenses.ZeroAddress.selector);
        new SnippetLicenses(IERC20(address(usdc)), address(0), owner);
    }

    // ------------------------------------------------------------ listClip

    function test_ListClip_StoresClipAndEmits() public {
        bytes32 clipId = keccak256("clip-2");
        vm.expectEmit(address(licenses));
        emit ClipListed(clipId, FILE_HASH, rightsHolder, contributor, 6000, 3000, 1000, _prices());

        vm.prank(owner);
        licenses.listClip(clipId, FILE_HASH, rightsHolder, contributor, 6000, 3000, 1000, _prices());

        SnippetLicenses.Clip memory clip = licenses.getClip(clipId);
        assertEq(clip.fileHash, FILE_HASH);
        assertEq(clip.rightsHolder, rightsHolder);
        assertEq(clip.contributor, contributor);
        assertEq(clip.rhBps, 6000);
        assertEq(clip.contribBps, 3000);
        assertEq(clip.platformBps, 1000);
        assertTrue(clip.listed);
        assertTrue(clip.active);
        assertEq(clip.prices[2], 25 * USDC);
    }

    function test_RevertWhen_BpsDoNotSumTo10000() public {
        vm.prank(owner);
        vm.expectRevert(SnippetLicenses.InvalidBps.selector);
        licenses.listClip(keccak256("x"), FILE_HASH, rightsHolder, contributor, 7000, 2000, 999, _prices());
    }

    function test_RevertWhen_ContributorBpsWithoutContributor() public {
        vm.prank(owner);
        vm.expectRevert(SnippetLicenses.ContributorBpsWithoutContributor.selector);
        licenses.listClip(keccak256("x"), FILE_HASH, rightsHolder, address(0), 7000, 2000, 1000, _prices());
    }

    function test_RevertWhen_ZeroRightsHolder() public {
        vm.prank(owner);
        vm.expectRevert(SnippetLicenses.ZeroAddress.selector);
        licenses.listClip(keccak256("x"), FILE_HASH, address(0), contributor, 7000, 2000, 1000, _prices());
    }

    function test_RevertWhen_ZeroClipIdOrFileHash() public {
        vm.startPrank(owner);
        vm.expectRevert(SnippetLicenses.ZeroValue.selector);
        licenses.listClip(bytes32(0), FILE_HASH, rightsHolder, contributor, 7000, 2000, 1000, _prices());
        vm.expectRevert(SnippetLicenses.ZeroValue.selector);
        licenses.listClip(keccak256("x"), bytes32(0), rightsHolder, contributor, 7000, 2000, 1000, _prices());
        vm.stopPrank();
    }

    function test_RevertWhen_ClipAlreadyListed() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SnippetLicenses.ClipAlreadyListed.selector, CLIP));
        licenses.listClip(CLIP, FILE_HASH, rightsHolder, contributor, 7000, 2000, 1000, _prices());
    }

    // ------------------------------------------------------------ buyLicense: happy paths

    function test_BuyLicense_PaysExactSplitAndRecordsLicense() public {
        // Social = 10 USDC -> 7 / 2 / 1
        vm.expectEmit(address(licenses));
        emit LicenseIssued(
            1,
            CLIP,
            buyer,
            FILE_HASH,
            SnippetLicenses.UseType.Social,
            10 * USDC,
            7 * USDC,
            2 * USDC,
            1 * USDC,
            uint64(block.timestamp)
        );

        vm.prank(buyer);
        uint256 licenseId = licenses.buyLicense(CLIP, SnippetLicenses.UseType.Social);

        assertEq(licenseId, 1);
        assertEq(licenses.licenseCount(), 1);
        assertEq(usdc.balanceOf(rightsHolder), 7 * USDC);
        assertEq(usdc.balanceOf(contributor), 2 * USDC);
        assertEq(usdc.balanceOf(treasury), 1 * USDC);
        assertEq(usdc.balanceOf(buyer), 990 * USDC);
        assertEq(usdc.balanceOf(address(licenses)), 0, "contract must never hold funds");

        SnippetLicenses.License memory l = licenses.getLicense(1);
        assertEq(l.clipId, CLIP);
        assertEq(l.fileHash, FILE_HASH);
        assertEq(l.buyer, buyer);
        assertEq(uint8(l.useType), uint8(SnippetLicenses.UseType.Social));
        assertEq(l.timestamp, block.timestamp);
        assertEq(l.price, 10 * USDC);
        assertEq(l.rhAmount, 7 * USDC);
        assertEq(l.contribAmount, 2 * USDC);
        assertEq(l.platformAmount, 1 * USDC);
    }

    function test_BuyLicense_IdsIncrement() public {
        vm.startPrank(buyer);
        assertEq(licenses.buyLicense(CLIP, SnippetLicenses.UseType.Editorial), 1);
        assertEq(licenses.buyLicense(CLIP, SnippetLicenses.UseType.Commercial), 2);
        vm.stopPrank();
        assertEq(licenses.licenseCount(), 2);
        assertEq(licenses.getLicense(2).price, 25 * USDC);
    }

    function test_BuyLicense_PlatformGetsRoundingRemainder() public {
        bytes32 clipId = keccak256("odd");
        uint256[3] memory prices = [uint256(101), 101, 101]; // 0.000101 USDC
        vm.prank(owner);
        licenses.listClip(clipId, FILE_HASH, rightsHolder, contributor, 3333, 3333, 3334, prices);

        vm.prank(buyer);
        licenses.buyLicense(clipId, SnippetLicenses.UseType.Editorial);

        // 101 * 33.33% = 33.66 -> 33 each; platform gets 101 - 66 = 35
        assertEq(usdc.balanceOf(rightsHolder), 33);
        assertEq(usdc.balanceOf(contributor), 33);
        assertEq(usdc.balanceOf(treasury), 35);
    }

    function test_BuyLicense_NoContributor() public {
        bytes32 clipId = keccak256("solo");
        vm.prank(owner);
        licenses.listClip(clipId, FILE_HASH, rightsHolder, address(0), 9000, 0, 1000, _prices());

        vm.prank(buyer);
        licenses.buyLicense(clipId, SnippetLicenses.UseType.Editorial);

        assertEq(usdc.balanceOf(rightsHolder), 4_500_000);
        assertEq(usdc.balanceOf(treasury), 500_000);
        assertEq(licenses.getLicense(1).contribAmount, 0);
    }

    function test_UpdateClip_ChangesPricesButNotSoldLicenses() public {
        vm.prank(buyer);
        licenses.buyLicense(CLIP, SnippetLicenses.UseType.Social);

        uint256[3] memory newPrices = [uint256(1 * USDC), 2 * USDC, 3 * USDC];
        vm.expectEmit(address(licenses));
        emit ClipUpdated(CLIP, newPrices, true);
        vm.prank(owner);
        licenses.updateClip(CLIP, newPrices, true);

        assertEq(licenses.getClip(CLIP).prices[1], 2 * USDC);
        assertEq(licenses.getLicense(1).price, 10 * USDC, "sold license keeps its price");

        vm.prank(buyer);
        licenses.buyLicense(CLIP, SnippetLicenses.UseType.Social);
        assertEq(licenses.getLicense(2).price, 2 * USDC);
    }

    function test_Unpause_AllowsBuyingAgain() public {
        vm.startPrank(owner);
        licenses.pause();
        licenses.unpause();
        vm.stopPrank();

        vm.prank(buyer);
        assertEq(licenses.buyLicense(CLIP, SnippetLicenses.UseType.Editorial), 1);
    }

    // ------------------------------------------------------------ buyLicense: reverts

    function test_RevertWhen_ClipNotListed() public {
        bytes32 unknown = keccak256("unknown");
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(SnippetLicenses.ClipNotListed.selector, unknown));
        licenses.buyLicense(unknown, SnippetLicenses.UseType.Editorial);
    }

    function test_RevertWhen_ClipInactive() public {
        vm.prank(owner);
        licenses.updateClip(CLIP, _prices(), false);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(SnippetLicenses.ClipNotActive.selector, CLIP));
        licenses.buyLicense(CLIP, SnippetLicenses.UseType.Editorial);
    }

    function test_RevertWhen_Paused() public {
        vm.prank(owner);
        licenses.pause();

        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        licenses.buyLicense(CLIP, SnippetLicenses.UseType.Editorial);
    }

    function test_RevertWhen_PriceNotSet() public {
        uint256[3] memory prices = [uint256(5 * USDC), 0, 25 * USDC]; // Social not for sale
        vm.prank(owner);
        licenses.updateClip(CLIP, prices, true);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(SnippetLicenses.PriceNotSet.selector, CLIP, SnippetLicenses.UseType.Social)
        );
        licenses.buyLicense(CLIP, SnippetLicenses.UseType.Social);
    }

    // Stream clips are listed with Commercial at 0 (needs the game publisher's permission): listing works,
    // Commercial is refused, the other use types still sell.
    function test_ListClip_WithZeroCommercialPrice_RefusesCommercialOnly() public {
        bytes32 clipId = keccak256("clip-4");
        uint256[3] memory prices = [uint256(5 * USDC), 15 * USDC, 0];
        vm.prank(owner);
        licenses.listClip(clipId, FILE_HASH, rightsHolder, address(0), 9000, 0, 1000, prices);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(SnippetLicenses.PriceNotSet.selector, clipId, SnippetLicenses.UseType.Commercial)
        );
        licenses.buyLicense(clipId, SnippetLicenses.UseType.Commercial);

        uint256 before = usdc.balanceOf(buyer);
        vm.prank(buyer);
        licenses.buyLicense(clipId, SnippetLicenses.UseType.Social);
        assertEq(before - usdc.balanceOf(buyer), 15 * USDC);
        assertEq(licenses.licenseCount(), 1);
    }

    function test_RevertWhen_InsufficientAllowance() public {
        vm.prank(buyer);
        usdc.approve(address(licenses), 0);

        // The first transfer (7 USDC to the rights holder) is the one that fails.
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(licenses), 0, 7 * USDC)
        );
        licenses.buyLicense(CLIP, SnippetLicenses.UseType.Social);
        assertEq(licenses.licenseCount(), 0, "failed purchase leaves no license");
    }

    function test_RevertWhen_InsufficientBalance() public {
        vm.startPrank(stranger);
        usdc.approve(address(licenses), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, stranger, 0, 7 * USDC));
        licenses.buyLicense(CLIP, SnippetLicenses.UseType.Social);
        vm.stopPrank();
    }

    function test_RevertWhen_InvalidUseType() public {
        // UseType only has values 0-2; ABI decoding rejects 3 before any code runs.
        vm.prank(buyer);
        (bool ok,) = address(licenses).call(abi.encodeWithSelector(licenses.buyLicense.selector, CLIP, uint8(3)));
        assertFalse(ok);
    }

    function test_RevertWhen_Reentered() public {
        ReentrantUSDC evil = new ReentrantUSDC();
        SnippetLicenses target = new SnippetLicenses(IERC20(address(evil)), treasury, owner);
        vm.prank(owner);
        target.listClip(CLIP, FILE_HASH, rightsHolder, contributor, 7000, 2000, 1000, _prices());
        evil.setAttack(target, CLIP);

        evil.mint(buyer, 100 * USDC);
        vm.startPrank(buyer);
        evil.approve(address(target), type(uint256).max);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        target.buyLicense(CLIP, SnippetLicenses.UseType.Editorial);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ onlyOwner

    function test_RevertWhen_NonOwnerCallsAdminFunctions() public {
        bytes memory unauthorized = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger);
        vm.startPrank(stranger);

        vm.expectRevert(unauthorized);
        licenses.listClip(keccak256("x"), FILE_HASH, rightsHolder, contributor, 7000, 2000, 1000, _prices());

        vm.expectRevert(unauthorized);
        licenses.updateClip(CLIP, _prices(), false);

        vm.expectRevert(unauthorized);
        licenses.pause();

        vm.expectRevert(unauthorized);
        licenses.unpause();

        vm.stopPrank();
    }

    function test_RevertWhen_UpdatingUnlistedClip() public {
        bytes32 unknown = keccak256("unknown");
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SnippetLicenses.ClipNotListed.selector, unknown));
        licenses.updateClip(unknown, _prices(), true);
    }

    // ------------------------------------------------------------ fuzz

    /// The three payouts must always add up to exactly the price, for any price and any valid split.
    function testFuzz_SplitAlwaysSumsToPrice(uint256 price, uint16 rhBps, uint16 contribBps) public {
        price = bound(price, 1, 1_000_000_000 * USDC); // up to 1 billion USDC
        rhBps = uint16(bound(rhBps, 0, 10_000));
        contribBps = uint16(bound(contribBps, 0, 10_000 - rhBps));
        uint16 platformBps = uint16(10_000 - rhBps - contribBps);

        bytes32 clipId = keccak256("fuzz");
        vm.prank(owner);
        licenses.listClip(
            clipId, FILE_HASH, rightsHolder, contributor, rhBps, contribBps, platformBps, [price, price, price]
        );

        address payer = makeAddr("payer");
        usdc.mint(payer, price);
        vm.startPrank(payer);
        usdc.approve(address(licenses), price);
        uint256 id = licenses.buyLicense(clipId, SnippetLicenses.UseType.Commercial);
        vm.stopPrank();

        SnippetLicenses.License memory l = licenses.getLicense(id);
        assertEq(l.rhAmount + l.contribAmount + l.platformAmount, price);
        assertEq(l.rhAmount, price * rhBps / 10_000);
        assertEq(l.contribAmount, price * contribBps / 10_000);
        assertEq(usdc.balanceOf(rightsHolder) + usdc.balanceOf(contributor) + usdc.balanceOf(treasury), price);
        assertEq(usdc.balanceOf(payer), 0);
        assertEq(usdc.balanceOf(address(licenses)), 0);
    }
}
