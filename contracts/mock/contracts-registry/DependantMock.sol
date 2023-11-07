// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {AbstractDependant} from "../../contracts-registry/AbstractDependant.sol";

import {ContractsRegistryMock} from "./ContractsRegistryMock.sol";

contract DependantMock is AbstractDependant {
    address public token;

    function setDependencies(address contractsRegistry_, bytes memory) public override dependant {
        token = ContractsRegistryMock(contractsRegistry_).getTokenContract();
    }
}
