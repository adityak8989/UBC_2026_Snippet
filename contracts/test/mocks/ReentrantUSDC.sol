// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MockUSDC} from "./MockUSDC.sol";
import {SnippetLicenses} from "../../src/SnippetLicenses.sol";

/// @notice Test-only malicious token: during transferFrom it tries to call buyLicense again,
///         to prove the nonReentrant guard blocks it.
contract ReentrantUSDC is MockUSDC {
    SnippetLicenses private _target;
    bytes32 private _clipId;

    function setAttack(SnippetLicenses target, bytes32 clipId) external {
        _target = target;
        _clipId = clipId;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (address(_target) != address(0)) {
            _target.buyLicense(_clipId, SnippetLicenses.UseType.Editorial);
        }
        return super.transferFrom(from, to, amount);
    }
}
