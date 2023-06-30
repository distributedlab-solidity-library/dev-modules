// SPDX-License-Identifier: MIT
// Modified from OpenZeppelin Contracts (last updated v4.8.0) (proxy/utils/Initializable.sol)

pragma solidity ^0.8.4;

/**
 * @dev This is a modified version of the OpenZeppelin Initializable contract to be used
 * with the Diamond Standard.
 */
abstract contract InitializableStorage {
    bytes32 internal constant INITIALIZABLE_STORAGE_SLOT =
        keccak256("diamond.standard.initializable.storage");

    /**
     * @param initializingStorage Indicates that the particular storage slot has been initialized.
     */
    struct InitializableStorage {
        // storage slot => { 0: not initialized, 1: initializing, 2: initialized }
        mapping(bytes32 => uint8) initializingStorage;
    }

    /**
     * @dev Triggered when the {storageSlot} in the Diamond has been initialized.
     */
    event Initialized(bytes32 storageSlot);

    /**
     * @dev A modifier that defines a protected initializer function that can be invoked at most
     * once for a particular storage in a Diamond proxy that begins with {storageSlot_}.
     * In its scope, `onlyInitializing` functions can be used to initialize parent contracts.
     *
     * Emits an {Initialized} event.
     */
    modifier initializer(bytes32 storageSlot_) {
        uint8 initializing_ = _getInitializing(storageSlot_);

        require(initializing_ == 0, "Initializable: contract is already initialized");

        _setInitializing(storageSlot_, 1);
        _;
        _setInitializing(storageSlot_, 2);

        emit Initialized(storageSlot_);
    }

    /**
     * @dev Modifier to protect an initialization function so that it can only be invoked by functions with the
     * {initializer} modifier, directly or indirectly.
     */
    modifier onlyInitializing(bytes32 storageSlot_) {
        require(
            _getInitializing(storageSlot_) == 1,
            "Initializable: contract is not initializing"
        );
        _;
    }

    function _initializableStorage() internal pure returns (InitializableStorage storage _iss) {
        bytes32 slot_ = INITIALIZABLE_STORAGE_SLOT;

        assembly {
            _iss.slot := slot_
        }
    }

    /**
     * @dev Internal function that sets the initializingStorage value.
     */
    function _setInitializing(
        bytes32 storageSlot_,
        uint8 value_
    ) internal virtual onlyInitializing {
        _initializableStorage().initializingStorage[storageSlot_] = value_;
    }

    /**
     * @dev Locks the contract.
     * It is recommended to use this to lock Diamond Facets contracts.
     *
     * Emits an {Initialized} event the first time it is successfully executed.
     */
    function _disableInitializers(bytes storageSlot_) internal virtual {
        uint8 initializing_ = _getInitializing(storageSlot_);

        require(initializing_ == 0, "Initializable: contract is initializing");

        _setInitializing(storageSlot_, 2);

        emit Initialized(storageSlot_);
    }

    /**
     * @dev Internal function that returns the initializing for the specified storage slot.
     */
    function _getInitializing(bytes32 storageSlot_) internal view returns (uint8) {
        return _initializableStorage().initializingStorage[storageSlot_];
    }
}
