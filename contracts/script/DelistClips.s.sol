// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SnippetLicenses} from "../src/SnippetLicenses.sol";

/// @notice Delists every clip that web/lib/clips.json marks `"active": false` (the same file the website
///         reads): updateClip(clipId, <its current on-chain prices>, false). Prices are left untouched and
///         licenses already sold are unaffected. Clips already inactive are skipped, so it is safe to re-run.
/// Env: SNIPPET_LICENSES_ADDRESS. Must run as the contract owner.
contract DelistClips is Script {
    function run() external {
        SnippetLicenses licenses = SnippetLicenses(vm.envAddress("SNIPPET_LICENSES_ADDRESS"));
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/../web/lib/clips.json"));

        require(msg.sender == licenses.owner(), "Run as the contract owner: --sender <deployer address>");

        vm.startBroadcast();
        for (uint256 i = 0; vm.keyExistsJson(json, string.concat(".clips[", vm.toString(i), "]")); i++) {
            _delist(licenses, json, string.concat(".clips[", vm.toString(i), "]"));
        }
        vm.stopBroadcast();
    }

    function _delist(SnippetLicenses licenses, string memory json, string memory p) private {
        string memory id = vm.parseJsonString(json, string.concat(p, ".id"));
        string memory activeKey = string.concat(p, ".active");
        if (!vm.keyExistsJson(json, activeKey) || vm.parseJsonBool(json, activeKey)) return; // stays for sale

        bytes32 clipId = vm.parseJsonBytes32(json, string.concat(p, ".clipIdBytes32"));
        require(clipId == keccak256(bytes(id)), string.concat(id, ": clipIdBytes32 is not keccak256(id)"));

        SnippetLicenses.Clip memory clip = licenses.getClip(clipId);
        require(clip.listed, string.concat(id, ": not listed on this contract"));
        if (!clip.active) {
            console.log("skip (already delisted):", id);
            return;
        }

        licenses.updateClip(clipId, clip.prices, false);
        console.log("delisted:", id);
    }
}
