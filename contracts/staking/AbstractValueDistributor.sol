// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {PRECISION} from "../utils/Globals.sol";

/**
 * @notice The AbstractValueDistributor module
 *
 * Contract module for distributing value among users based on their shares.
 *
 * The algorithm ensures that the distribution is proportional to the shares
 * held by each user and takes into account changes in the cumulative sum over time.
 *
 * This contract can be used as a base contract for implementing various distribution mechanisms,
 * such as token staking, profit sharing, or dividend distribution.
 *
 * It includes hooks for performing additional logic
 * when shares are added or removed, or when value is distributed.
 */
abstract contract AbstractValueDistributor {
    struct UserDistribution {
        uint256 shares;
        uint256 cumulativeSum;
        uint256 owedValue;
    }

    uint256 private _totalShares;
    uint256 private _cumulativeSum;
    uint256 private _updatedAt;

    mapping(address => UserDistribution) private _userDistributions;

    event SharesAdded(address user, uint256 amount);
    event SharesRemoved(address user, uint256 amount);
    event ValueDistributed(address user, uint256 amount);

    /**
     * @notice Returns the total number of shares.
     * @return The total number of shares.
     */
    function totalShares() public view returns (uint256) {
        return _totalShares;
    }

    /**
     * @notice Returns the cumulative sum of value that has been distributed.
     * @return The cumulative sum of value that has been distributed.
     */
    function cumulativeSum() public view returns (uint256) {
        return _cumulativeSum;
    }

    /**
     * @notice Returns the timestamp of the last update.
     * @return The timestamp of the last update.
     */
    function updatedAt() public view returns (uint256) {
        return _updatedAt;
    }

    /**
     * @notice Returns the distribution details for a specific user.
     * @param user_ The address of the user.
     * @return The distribution details including user's shares, cumulative sum and value owed.
     */
    function userDistribution(address user_) public view returns (UserDistribution memory) {
        return _userDistributions[user_];
    }

    /**
     * @notice Gets the amount of value owed to a specific user.
     * @param user_ The address of the user.
     * @return The total owed value to the user.
     */
    function getOwedValue(address user_) public view returns (uint256) {
        UserDistribution storage userDist = _userDistributions[user_];

        return
            (userDist.shares *
                (_getFutureCumulativeSum(block.timestamp) - userDist.cumulativeSum)) /
            PRECISION +
            userDist.owedValue;
    }

    /**
     * @notice Adds shares to a user's distribution.
     * @param user_ The address of the user.
     * @param amount_ The amount of shares to add.
     */
    function _addShares(address user_, uint256 amount_) internal virtual {
        require(user_ != address(0), "ValueDistributor: zero address is not allowed");
        require(amount_ > 0, "ValueDistributor: amount has to be more than 0");

        _update(user_);

        _totalShares += amount_;
        _userDistributions[user_].shares += amount_;

        emit SharesAdded(user_, amount_);

        _afterAddShares(user_, amount_);
    }

    /**
     * @notice Removes shares from a user's distribution.
     * @param user_ The address of the user.
     * @param amount_ The amount of shares to remove.
     */
    function _removeShares(address user_, uint256 amount_) internal virtual {
        require(amount_ > 0, "ValueDistributor: amount has to be more than 0");
        require(
            amount_ <= _userDistributions[user_].shares,
            "ValueDistributor: insufficient amount"
        );

        _update(user_);

        _totalShares -= amount_;
        _userDistributions[user_].shares -= amount_;

        emit SharesRemoved(user_, amount_);

        _afterRemoveShares(user_, amount_);
    }

    /**
     * @notice Distributes value to a specific user.
     * @param user_ The address of the user.
     * @param amount_ The amount of value to distribute.
     */
    function _distributeValue(address user_, uint256 amount_) internal virtual {
        _update(user_);

        require(amount_ > 0, "ValueDistributor: amount has to be more than 0");
        require(
            amount_ <= _userDistributions[user_].owedValue,
            "ValueDistributor: insufficient amount"
        );

        _userDistributions[user_].owedValue -= amount_;

        emit ValueDistributed(user_, amount_);

        _afterDistributeValue(user_, amount_);
    }

    /**
     * @notice Hook function that is called after shares have been added to a user's distribution.
     *
     * This function can be used to perform any additional logic that is required,
     * such as transferring tokens.
     *
     * @param user_ The address of the user.
     * @param amount_ The amount of shares added.
     */
    function _afterAddShares(address user_, uint256 amount_) internal virtual {}

    /**
     * @notice Hook function that is called after shares have been removed from a user's distribution.
     *
     * This function can be used to perform any additional logic that is required,
     * such as transferring tokens.
     *
     * @param user_ The address of the user.
     * @param amount_ The amount of shares removed.
     */
    function _afterRemoveShares(address user_, uint256 amount_) internal virtual {}

    /**
     * @notice Hook function that is called after value has been distributed to a user.
     *
     * This function can be used to perform any additional logic that is required,
     * such as transferring tokens.
     *
     * @param user_ The address of the user.
     * @param amount_ The amount of value distributed.
     */
    function _afterDistributeValue(address user_, uint256 amount_) internal virtual {}

    /**
     * @notice Updates the cumulative sum of tokens that have been distributed.
     *
     * This function should be called whenever user shares are modified or value distribution occurs.
     *
     * @param user_ The address of the user.
     */
    function _update(address user_) internal {
        _cumulativeSum = _getFutureCumulativeSum(block.timestamp);
        _updatedAt = block.timestamp;

        if (user_ != address(0)) {
            UserDistribution storage userDist = _userDistributions[user_];

            userDist.owedValue +=
                (userDist.shares * (_cumulativeSum - userDist.cumulativeSum)) /
                PRECISION;
            userDist.cumulativeSum = _cumulativeSum;
        }
    }

    /**
     * @notice Gets the value to be distributed for a given time period.
     *
     * Note: It will usually be required to override this function to provide custom distribution mechanics.
     *
     * @param timeUpTo_ The end timestamp of the period.
     * @param timeLastUpdate_ The start timestamp of the period.
     * @return The value to be distributed for the period.
     */
    function _getValueToDistribute(
        uint256 timeUpTo_,
        uint256 timeLastUpdate_
    ) internal view virtual returns (uint256);

    /**
     * @notice Gets the expected cumulative sum of value per token staked distributed at a given timestamp.
     * @param timeUpTo_ The timestamp up to which to calculate the value distribution.
     * @return The future cumulative sum of value per token staked that has been distributed.
     */
    function _getFutureCumulativeSum(uint256 timeUpTo_) internal view returns (uint256) {
        if (_totalShares == 0) {
            return _cumulativeSum;
        }

        uint256 value_ = _getValueToDistribute(timeUpTo_, _updatedAt);

        return _cumulativeSum + (value_ * PRECISION) / _totalShares;
    }
}
