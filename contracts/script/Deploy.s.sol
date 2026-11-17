// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SnippetLicenses} from "../src/SnippetLicenses.sol";

/// @notice Deploys SnippetLicenses. The deployer (--sender / --account) becomes the owner.
/// Env: TREASURY_ADDRESS (required), USDC_ADDRESS (optional; defaults to Arc testnet USDC).
contract Deploy is Script {
    // USDC ERC-20 interface on Arc testnet (6 decimals). Never the 18-decimal native balance.
    address constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;
    uint256 constant ARC_TESTNET_CHAIN_ID = 5042002;

    function run() external returns (SnippetLicenses licenses) {
        address usdc = vm.envOr("USDC_ADDRESS", ARC_TESTNET_USDC);
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address owner = msg.sender;

        require(owner != DEFAULT_SENDER, "Pass --sender <deployer address> (and --account deployer)");
        if (block.chainid == ARC_TESTNET_CHAIN_ID) {
            require(usdc == ARC_TESTNET_USDC, "On Arc testnet, USDC must be the 0x3600...0000 ERC-20");
        }

        vm.startBroadcast();
        licenses = new SnippetLicenses(IERC20(usdc), treasury, owner);
        vm.stopBroadcast();

        console.log("SnippetLicenses deployed at:", address(licenses));
        console.log("  chain id:", block.chainid);
        console.log("  owner:   ", owner);
        console.log("  treasury:", treasury);
        console.log("  usdc:    ", usdc);
    }
}
