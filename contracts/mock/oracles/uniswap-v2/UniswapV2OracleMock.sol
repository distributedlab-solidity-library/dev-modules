// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {UniswapV2Oracle} from "../../../oracles/UniswapV2Oracle.sol";
import {UniswapV2PairMock} from "./UniswapV2PairMock.sol";

contract UniswapV2OracleMock is UniswapV2Oracle {
    using EnumerableSet for EnumerableSet.AddressSet;

    function __OracleV2Mock_init(
        address uniswapV2Factory_,
        uint256 timeWindow_
    ) external initializer {
        __OracleV2_init(uniswapV2Factory_, timeWindow_);
    }

    function mockInit(address uniswapV2Factory_, uint256 timeWindow_) external {
        __OracleV2_init(uniswapV2Factory_, timeWindow_);
    }

    function addPaths(address[][] calldata paths_) external {
        _addPaths(paths_);
    }

    function removePaths(address[] calldata tokenIns_) external {
        _removePaths(tokenIns_);
    }

    function setTimeWindow(uint256 newTimeWindow_) external {
        _setTimeWindow(newTimeWindow_);
    }

    function doubleUpdatePrice() external {
        updatePrices();
        updatePrices();
    }
}
