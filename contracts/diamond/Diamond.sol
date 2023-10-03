// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {DiamondStorage} from "./DiamondStorage.sol";

/**
 * @notice The Diamond standard module
 *
 * This is a custom implementation of a Diamond Proxy standard (https://eips.ethereum.org/EIPS/eip-2535).
 * This contract acts as a highest level contract of that standard. What is different from the EIP2535,
 * in order to use the DiamondStorage, storage is defined in a separate contract that the facets have to inherit from,
 * not an internal library.
 *
 * As a convention, view and pure function should be defined in the storage contract while function that modify state, in
 * the facet itself.
 *
 * If you wish to add a receive() function, you can attach a "0x00000000" selector to a facet that has such function.
 */
contract Diamond is DiamondStorage {
    using Address for address;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.AddressSet;

    enum FacetAction {
        Add,
        Replace,
        Remove
    }
    // Add=0, Replace=1, Remove=2

    struct Facet {
        address facetAddress;
        FacetAction action;
        bytes4[] functionSelectors;
    }

    event DiamondCut(Facet[] facets_, address init_, bytes calldata_);

    /**
     * @notice The payable fallback function that delegatecall's the facet with associated selector
     */
    // solhint-disable-next-line
    fallback() external payable virtual {
        address facet_ = facetAddress(msg.sig);

        require(facet_ != address(0), "Diamond: selector is not registered");

        _beforeFallback(facet_, msg.sig);

        assembly {
            calldatacopy(0, 0, calldatasize())
            let result_ := delegatecall(gas(), facet_, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            switch result_
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable virtual {}

    /**
     * @notice Add/replace/remove any number of functions and optionally execute a function with delegatecall
     * @param facets_ Contains the facet addresses and function selectors
     */
    function _diamondCut(Facet[] calldata facets_) internal {
        _diamondCut(facets_, address(0), "");
    }

    /**
     * @notice Add/replace/remove any number of functions and optionally execute a function with delegatecall
     * @param facets_ Contains the facet addresses and function selectors
     * @param init_ The address of the contract or facet to execute calldata_
     * @param calldata_ A function call, including function selector and arguments calldata_ is executed with delegatecall on init_
     */
    function _diamondCut(
        Facet[] calldata facets_,
        address init_,
        bytes memory calldata_
    ) internal {
        for (uint256 i; i < facets_.length; i++) {
            bytes4[] memory _functionSelectors = facets_[i].functionSelectors;
            address _facetAddress = facets_[i].facetAddress;

            require(
                _functionSelectors.length != 0,
                "Diamond: no selectors provided for facet for cut"
            );

            FacetAction _action = facets_[i].action;
            if (_action == FacetAction.Add) {
                _addFacet(_facetAddress, _functionSelectors);
            } else if (_action == FacetAction.Remove) {
                _removeFacet(_facetAddress, _functionSelectors);
            } else if (_action == FacetAction.Replace) {
                _updateFacet(_facetAddress, _functionSelectors);
            } else {
                revert("Diamond: incorrect facet action");
            }
        }

        emit DiamondCut(facets_, init_, calldata_);

        _initializeDiamondCut(init_, calldata_);
    }

    /**
     * @notice The internal function to add facets to a diamond (aka diamondCut())
     * @param facet_ the implementation address
     * @param selectors_ the function selectors the implementation has
     */
    function _addFacet(address facet_, bytes4[] memory selectors_) internal {
        require(facet_.isContract(), "Diamond: facet is not a contract");
        require(selectors_.length > 0, "Diamond: no selectors provided");

        DStorage storage _ds = _getDiamondStorage();

        for (uint256 i = 0; i < selectors_.length; i++) {
            require(
                _ds.selectorToFacet[selectors_[i]] == address(0),
                "Diamond: selector already added"
            );

            _ds.selectorToFacet[selectors_[i]] = facet_;
            _ds.facetToSelectors[facet_].add(bytes32(selectors_[i]));
        }

        _ds.facets.add(facet_);
    }

    /**
     * @notice The internal function to remove facets from the diamond
     * @param facet_ the implementation to be removed. The facet itself will be removed only if there are no selectors left
     * @param selectors_ the selectors of that implementation to be removed
     */
    function _removeFacet(address facet_, bytes4[] memory selectors_) internal {
        require(selectors_.length > 0, "Diamond: no selectors provided");

        DStorage storage _ds = _getDiamondStorage();

        for (uint256 i = 0; i < selectors_.length; i++) {
            require(
                _ds.selectorToFacet[selectors_[i]] == facet_,
                "Diamond: selector from another facet"
            );

            _ds.selectorToFacet[selectors_[i]] = address(0);
            _ds.facetToSelectors[facet_].remove(bytes32(selectors_[i]));
        }

        if (_ds.facetToSelectors[facet_].length() == 0) {
            _ds.facets.remove(facet_);
        }
    }

    /**
     * @notice The internal function to update the facet selectors of the diamond
     * @param facet_ the facet to update
     * @param selectors_ the selectors of the facet
     */
    function _updateFacet(address facet_, bytes4[] memory selectors_) internal {
        require(facet_ != address(0), "Diamond:  facet cannot be zero address");
        require(facet_.isContract(), "Diamond: replace facet has no code");

        DStorage storage _ds = _getDiamondStorage();

        for (uint256 i; i < selectors_.length; i++) {
            bytes4 _selector = selectors_[i];
            address _oldFacet = facetAddress(_selector);

            // can't replace immutable functions -- functions defined directly in the diamond in this case
            require(_oldFacet == address(this), "Diamond: cannot replace function of this");
            require(_oldFacet != facet_, "Diamond: cannot replace to the same facet");
            require(_oldFacet == address(0), "Diamond: no facet found for selector");

            // replace old facet address
            _ds.selectorToFacet[_selector] = facet_;
            _ds.facetToSelectors[facet_].add(bytes32(_selector));

            // remove old facet address
            _ds.facetToSelectors[_oldFacet].remove(bytes32(_selector));

            if (_ds.facetToSelectors[_oldFacet].length() == 0) {
                _ds.facets.remove(_oldFacet);
            }
        }
    }

    function _initializeDiamondCut(address init_, bytes memory calldata_) internal {
        if (init_ == address(0)) {
            return;
        }

        require(init_.isContract(), "Diamond: init_ address has no code");

        (bool success, bytes memory err) = init_.delegatecall(calldata_);

        if (!success) {
            require(err.length > 0, "Diamond: initialization function reverted");
            // bubble up error
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(err)
                revert(add(32, err), returndata_size)
            }
        }
    }

    function _beforeFallback(address facet_, bytes4 selector_) internal virtual {}
}
