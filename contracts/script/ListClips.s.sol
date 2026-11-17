// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SnippetLicenses} from "../src/SnippetLicenses.sol";

/// @notice Lists every clip in web/lib/clips.json, the same file the website reads, so the
///         clip IDs, file hashes, splits, and prices on-chain match the site exactly.
///         Safe to re-run: clips that are already listed are skipped.
/// Env: SNIPPET_LICENSES_ADDRESS, RIGHTS_HOLDER_ADDRESS, CONTRIBUTOR_ADDRESS.
///      Clips with contributorBps = 0 are listed with no contributor (address 0).
contract ListClips is Script {
    uint256 constant USDC_UNITS = 1e6; // clips.json prices are whole USDC; USDC has 6 decimals

    function run() external {
        SnippetLicenses licenses = SnippetLicenses(vm.envAddress("SNIPPET_LICENSES_ADDRESS"));
        address rightsHolder = vm.envAddress("RIGHTS_HOLDER_ADDRESS");
        address contributor = vm.envAddress("CONTRIBUTOR_ADDRESS");
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/../web/lib/clips.json"));

        require(msg.sender == licenses.owner(), "Run as the contract owner: --sender <deployer address>");

        vm.startBroadcast();
        for (uint256 i = 0; vm.keyExistsJson(json, string.concat(".clips[", vm.toString(i), "]")); i++) {
            _listClip(licenses, json, string.concat(".clips[", vm.toString(i), "]"), rightsHolder, contributor);
        }
        vm.stopBroadcast();
    }

    function _listClip(
        SnippetLicenses licenses,
        string memory json,
        string memory p,
        address rightsHolder,
        address contributor
    ) private {
        string memory id = vm.parseJsonString(json, string.concat(p, ".id"));
        bytes32 clipId = vm.parseJsonBytes32(json, string.concat(p, ".clipIdBytes32"));
        bytes32 fileHash = vm.parseJsonBytes32(json, string.concat(p, ".fileHash"));
        require(clipId == keccak256(bytes(id)), string.concat(id, ": clipIdBytes32 is not keccak256(id)"));

        uint256 rhBps = vm.parseJsonUint(json, string.concat(p, ".split.rightsHolderBps"));
        uint256 contribBps = vm.parseJsonUint(json, string.concat(p, ".split.contributorBps"));
        uint256 platformBps = vm.parseJsonUint(json, string.concat(p, ".split.platformBps"));
        require(rhBps + contribBps + platformBps == 10_000, string.concat(id, ": split must sum to 10000 bps"));

        uint256[3] memory prices = [
            vm.parseJsonUint(json, string.concat(p, ".prices.editorial")) * USDC_UNITS,
            vm.parseJsonUint(json, string.concat(p, ".prices.social")) * USDC_UNITS,
            vm.parseJsonUint(json, string.concat(p, ".prices.commercial")) * USDC_UNITS
        ];

        if (licenses.getClip(clipId).listed) {
            console.log("skip (already listed):", id);
            return;
        }

        // Each bps value is <= 10000 (checked above), so it fits in uint16.
        // forge-lint: disable-next-line(unsafe-typecast)
        licenses.listClip(
            clipId,
            fileHash,
            rightsHolder,
            contribBps == 0 ? address(0) : contributor,
            uint16(rhBps),
            uint16(contribBps),
            uint16(platformBps),
            prices
        );
        console.log("listed:", id);
    }
}
