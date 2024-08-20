// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {DiamondERC721Mock} from "./DiamondERC721Mock.sol";

contract DiamondERC721NotReceiverMock is DiamondERC721Mock {
    function mockMint(address to_, uint256 tokenId_) external {
        _mint(to_, tokenId_);
    }

    function _checkOnERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) internal override returns (bool) {
        return false;
    }
}
