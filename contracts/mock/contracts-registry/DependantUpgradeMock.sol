// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {DependantMock} from "./DependantMock.sol";

contract DependantUpgradeMock is DependantMock {
    uint256 public dummyValue;

    function doUpgrade(uint256 value_) external {
        dummyValue = value_;
    }

    function addedFunction() external pure returns (uint256) {
        return 42;
    }
}
