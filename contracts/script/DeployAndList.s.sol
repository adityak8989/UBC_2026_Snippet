// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SnippetLicenses} from "../src/SnippetLicenses.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys SnippetLicenses to Arc testnet and registers the 3 demo clips.
/// @dev If TREASURY_ADDRESS, RIGHTS_HOLDER_ADDRESS, or CONTRIBUTOR_ADDRESS are unset,
///      it defaults to msg.sender so you can test with just 1 wallet.
contract DeployAndList is Script {
    // Arc testnet USDC ERC-20 contract (6 decimals)
    address constant USDC_ARC_TESTNET = 0x3600000000000000000000000000000000000000;

    // Demo clip hashes from videos/vid1.mp4, vid2.mp4, vid3.mp4
    bytes32 constant CLIP_1_ID = 0x25145b57224240a2fe7ee1cb641c7b808ec2fd0b14fb4987034c5685794aa1c2;
    bytes32 constant CLIP_1_HASH = 0x0d8008875f768886066b00143d3f9e703815b33c7115517b47f9cfc6a21d5c6c;

    bytes32 constant CLIP_2_ID = 0x38e2ea5fb026d368d407621c4310d5e1f7480a48b321c7fa15be43431d102e3b;
    bytes32 constant CLIP_2_HASH = 0xc54c607b3399536a8308bc8b5bf194e53df3c7822337454d4183c5a97bb1d60c;

    bytes32 constant CLIP_3_ID = 0xec2eb351d451eb7db7ae6ef9d3d3a778fc3ecb483c6b29d47915bf5dfc5bbf84;
    bytes32 constant CLIP_3_HASH = 0xa188de76316fd48e7592697bf58a3c68d6e40a0c40ceeb3160dcd86e2415b3fa;

    function run() external returns (SnippetLicenses licenses) {
        address deployer = msg.sender;

        // Load recipient wallets from contracts/.env
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address rightsHolder = vm.envAddress("RIGHTS_HOLDER_ADDRESS");
        address contributor = vm.envAddress("CONTRIBUTOR_ADDRESS");

        console.log("=== Deploying SnippetLicenses to Arc Testnet ===");
        console.log("Deployer / Owner :", deployer);
        console.log("Treasury         :", treasury);
        console.log("Rights Holder    :", rightsHolder);
        console.log("Contributor      :", contributor);

        // Standard demo pricing in 6-decimal USDC units:
        // [0] Editorial: $5 USDC
        // [1] Social:    $15 USDC
        // [2] Commercial: $50 USDC
        uint256[3] memory prices = [uint256(5 * 1e6), uint256(15 * 1e6), uint256(50 * 1e6)];

        vm.startBroadcast();

        // 1. Deploy the contract
        licenses = new SnippetLicenses(IERC20(USDC_ARC_TESTNET), treasury, deployer);

        // 2. List Clip 1: 70% Host, 20% Guest, 10% Platform
        licenses.listClip(
            CLIP_1_ID,
            CLIP_1_HASH,
            rightsHolder,
            contributor,
            7000,
            2000,
            1000,
            prices
        );

        // 3. List Clip 2: 70% Host, 20% Guest, 10% Platform
        licenses.listClip(
            CLIP_2_ID,
            CLIP_2_HASH,
            rightsHolder,
            contributor,
            7000,
            2000,
            1000,
            prices
        );

        // 4. List Clip 3: Solo clip (90% Host, 0% Guest, 10% Platform)
        licenses.listClip(
            CLIP_3_ID,
            CLIP_3_HASH,
            rightsHolder,
            address(0),
            9000,
            0,
            1000,
            prices
        );

        vm.stopBroadcast();

        console.log("\n>>> DEPLOYED CONTRACT ADDRESS <<<");
        console.log(address(licenses));
        console.log("---------------------------------\n");
    }
}
