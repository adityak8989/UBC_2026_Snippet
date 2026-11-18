// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SnippetLicenses} from "../src/SnippetLicenses.sol";

/// @notice Sets each listed clip's on-chain prices to the prices in web/lib/clips.json (the same file
///         the website reads). Only clips whose prices differ get an updateClip transaction; a clip's
///         active / delisted status is kept as it is. Safe to re-run.
/// Env: SNIPPET_LICENSES_ADDRESS. Must run as the contract owner.
contract UpdatePrices is Script {
    uint256 constant USDC_UNITS = 1e6; // clips.json prices are whole USDC; USDC has 6 decimals

    function run() external {
        SnippetLicenses licenses = SnippetLicenses(vm.envAddress("SNIPPET_LICENSES_ADDRESS"));
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/../web/lib/clips.json"));

        require(msg.sender == licenses.owner(), "Run as the contract owner: --sender <deployer address>");

        vm.startBroadcast();
        for (uint256 i = 0; vm.keyExistsJson(json, string.concat(".clips[", vm.toString(i), "]")); i++) {
            _update(licenses, json, string.concat(".clips[", vm.toString(i), "]"));
        }
        vm.stopBroadcast();
    }

    function _update(SnippetLicenses licenses, string memory json, string memory p) private {
        string memory id = vm.parseJsonString(json, string.concat(p, ".id"));
        bytes32 clipId = vm.parseJsonBytes32(json, string.concat(p, ".clipIdBytes32"));
        require(clipId == keccak256(bytes(id)), string.concat(id, ": clipIdBytes32 is not keccak256(id)"));

        uint256[3] memory prices = [
            vm.parseJsonUint(json, string.concat(p, ".prices.editorial")) * USDC_UNITS,
            vm.parseJsonUint(json, string.concat(p, ".prices.social")) * USDC_UNITS,
            vm.parseJsonUint(json, string.concat(p, ".prices.commercial")) * USDC_UNITS
        ];

        SnippetLicenses.Clip memory clip = licenses.getClip(clipId);
        require(clip.listed, string.concat(id, ": not listed on this contract (run ListClips first)"));

        if (clip.prices[0] == prices[0] && clip.prices[1] == prices[1] && clip.prices[2] == prices[2]) {
            console.log("unchanged:", id);
            return;
        }

        licenses.updateClip(clipId, prices, clip.active);
        console.log("updated:", id);
        console.log("  editorial / social / commercial, USDC units:", prices[0], prices[1], prices[2]);
    }
}
