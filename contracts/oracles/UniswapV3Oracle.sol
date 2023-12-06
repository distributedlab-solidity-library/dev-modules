// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {FullMath} from "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @notice UniswapV3Oracle module
 *
 * A contract for retrieving prices from Uniswap V3 pools.
 *
 * Works by calculating the time-weighted average tick as difference between two tickCumulatives
 * divided by number of second between them, tickCumulatives are taken from the newest observation
 * and from the one nearest to required time.
 *
 * Price is obtained as 1.0001 in power of this tick.
 *
 * In case required period of time is unreachable, tick is taken from oldest available observation.
 */
contract UniswapV3Oracle {
    using FullMath for *;

    IUniswapV3Factory public immutable uniswapV3Factory;

    /**
     * @dev contract is not an Initializable because the compiler version is <0.8.0
     */
    constructor(address uniswapV3Factory_) {
        uniswapV3Factory = IUniswapV3Factory(uniswapV3Factory_);
    }

    /**
     * @notice The function to retrieve the price of a token following the configured route
     * @dev The function returns price in quote token decimals. If amount is zero, returns (0, 0)
     * @param path_ the path of token address, the last one is token in which price will be returned
     * @param fees_ the array of fees for particular pools
     * @param amount_ the amount of baseToken_
     * @param period_ the time period
     * @return amount_ the price of start token in quote token
     * @return minPeriod_ the oldest period for which there is an observation in case period_ time ago there was no observation
     */
    function getPriceOfTokenInToken(
        address[] memory path_,
        uint24[] memory fees_,
        uint128 amount_,
        uint32 period_
    ) public view returns (uint128, uint32) {
        uint256 pathLength_ = path_.length;

        require(pathLength_ > 1, "UniswapV3Oracle: invalid path");
        require(pathLength_ == fees_.length + 1, "UniswapV3Oracle: path/fee lengths do not match");
        require(
            block.timestamp > period_,
            "UniswapV3Oracle: period larger than current timestamp"
        );
        require(period_ > 0, "UniswapV3Oracle: period can't be 0");

        if (amount_ == 0) {
            return (0, 0);
        }

        uint32 minPeriod_ = period_;

        for (uint256 i = 0; i < pathLength_ - 1; i++) {
            uint32 currentPeriod_;
            (amount_, currentPeriod_) = _getPriceOfTokenInToken(
                path_[i],
                path_[i + 1],
                amount_,
                fees_[i],
                period_
            );

            minPeriod_ = uint32(minPeriod_ < currentPeriod_ ? minPeriod_ : currentPeriod_);
        }

        return (amount_, minPeriod_);
    }

    /**
     * @notice The private function to get the price of a token inside a pool
     * @dev Price is expected to fit into uint128
     */
    function _getPriceOfTokenInToken(
        address baseToken_,
        address quoteToken_,
        uint128 amount_,
        uint24 fee_,
        uint32 period_
    ) private view returns (uint128, uint32) {
        if (baseToken_ == quoteToken_) {
            return (amount_, period_);
        }

        address pool_ = uniswapV3Factory.getPool(baseToken_, quoteToken_, fee_);

        require(pool_ != address(0), "UniswapV3Oracle: such pool doesn't exist");

        uint32 longestPeriod_ = OracleLibrary.getOldestObservationSecondsAgo(pool_);

        require(
            longestPeriod_ != 0,
            "UniswapV3Oracle: the oldest observation is on the current block"
        );

        period_ = uint32(period_ < longestPeriod_ ? period_ : longestPeriod_);

        (int24 arithmeticMeanTick, ) = OracleLibrary.consult(pool_, period_);

        return (
            uint128(
                OracleLibrary.getQuoteAtTick(arithmeticMeanTick, amount_, baseToken_, quoteToken_)
            ),
            period_
        );
    }
}
