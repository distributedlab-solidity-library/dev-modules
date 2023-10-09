import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { wei } from "@/scripts/utils/utils";
import { Reverter } from "@/test/helpers/reverter";
import BigNumber from "bignumber.js";

import { UniswapV2FactoryMock, UniswapV2OracleMock, UniswapV2PairMock } from "@ethers-v6";

describe("UniswapV2Oracle", () => {
  const reverter = new Reverter();

  const ORACLE_TIME_WINDOW = 1;

  const A_TOKEN = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
  const B_TOKEN = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
  const C_TOKEN = "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC";
  const A_C_PATH = [A_TOKEN, C_TOKEN];
  const C_A_C_PATH = [C_TOKEN, A_TOKEN, C_TOKEN];
  const B_A_C_PATH = [B_TOKEN, A_TOKEN, C_TOKEN];

  let oracle: UniswapV2OracleMock;
  let uniswapV2Factory: UniswapV2FactoryMock;
  let A_C_PAIR: string;
  let A_B_PAIR: string;

  before("setup", async () => {
    await reverter.snapshot();
  });

  beforeEach(async () => {
    const UniswapV2FactoryMock = await ethers.getContractFactory("UniswapV2FactoryMock");
    uniswapV2Factory = await UniswapV2FactoryMock.deploy();

    const Oracle = await ethers.getContractFactory("UniswapV2OracleMock");
    oracle = await Oracle.deploy();

    await oracle.__OracleV2Mock_init(await uniswapV2Factory.getAddress(), ORACLE_TIME_WINDOW);
  });

  async function createPairs() {
    await uniswapV2Factory.createPair(A_TOKEN, C_TOKEN);
    await uniswapV2Factory.createPair(A_TOKEN, B_TOKEN);

    A_C_PAIR = await uniswapV2Factory.getPair(A_TOKEN, C_TOKEN);
    A_B_PAIR = await uniswapV2Factory.getPair(A_TOKEN, B_TOKEN);
  }

  afterEach(reverter.revert);

  describe("init", () => {
    it("should set oracle correctly", async () => {
      expect(await oracle.uniswapV2Factory()).to.be.equal(await uniswapV2Factory.getAddress());
      expect(await oracle.timeWindow()).to.be.equal(ORACLE_TIME_WINDOW);
    });

    it("should not initialize twice", async () => {
      await expect(oracle.mockInit(await uniswapV2Factory.getAddress(), ORACLE_TIME_WINDOW)).to.be.revertedWith(
        "Initializable: contract is not initializing"
      );
      await expect(
        oracle.__OracleV2Mock_init(await uniswapV2Factory.getAddress(), ORACLE_TIME_WINDOW)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("set", () => {
    it("should set timewindow correctly", async () => {
      await oracle.setTimeWindow(20);

      expect(await oracle.timeWindow()).to.be.equal(20);
    });

    it("shouldn't set 0 timewindow", async () => {
      await expect(oracle.setTimeWindow(0)).to.be.revertedWith("UniswapV2Oracle: time window can't be 0");
    });

    it("should add paths correctly", async () => {
      await createPairs();

      await oracle.addPaths([A_C_PATH, B_A_C_PATH]);

      expect(await oracle.getPath(A_TOKEN)).to.deep.equal(A_C_PATH);
      expect(await oracle.getPath(B_TOKEN)).to.deep.equal(B_A_C_PATH);

      expect(await oracle.getPairs()).to.deep.equal([A_C_PAIR, A_B_PAIR]);
    });

    it("should not allow to set path with length < 2", async () => {
      await expect(oracle.addPaths([[C_TOKEN]])).to.be.revertedWith("UniswapV2Oracle: path must be longer than 2");
    });

    it("should not allow to set path with non-existent pairs", async () => {
      await expect(oracle.addPaths([A_C_PATH])).revertedWith("UniswapV2Oracle: uniswap pair doesn't exist");
    });

    it("should not add same path twice", async () => {
      await createPairs();

      await expect(oracle.addPaths([A_C_PATH, A_C_PATH])).to.be.revertedWith(
        "UniswapV2Oracle: path already registered"
      );
    });
  });

  describe("remove", () => {
    it("should remove paths correctly", async () => {
      await createPairs();

      await oracle.addPaths([A_C_PATH]);
      await oracle.addPaths([B_A_C_PATH]);
      await oracle.addPaths([C_A_C_PATH]);

      await oracle.removePaths([A_TOKEN]);

      expect(await oracle.getPath(A_TOKEN)).to.deep.equal([]);
      expect(await oracle.getPairs()).to.deep.equal([A_C_PAIR, A_B_PAIR]);

      await oracle.removePaths([B_TOKEN, B_TOKEN]);

      expect(await oracle.getPath(B_TOKEN)).to.deep.equal([]);
      expect(await oracle.getPairs()).to.deep.equal([A_C_PAIR]);

      await oracle.removePaths([C_TOKEN]);

      expect(await oracle.getPath(C_TOKEN)).to.deep.equal([]);
      expect(await oracle.getPairs()).to.deep.equal([]);
    });
  });

  describe("update", () => {
    it("should update price correctly", async () => {
      await createPairs();

      await oracle.addPaths([A_C_PATH]);

      let rounds = await oracle.getPairRounds(A_C_PAIR);
      let pairInfo = await oracle.getPairInfo(A_C_PAIR, 0);

      expect(rounds).to.be.equal(1);
      expect(pairInfo[2]).to.be.equal(BigNumber(await time.latest()).mod(2 ** 32));

      await oracle.updatePrices();

      rounds = await oracle.getPairRounds(A_C_PAIR);

      expect(rounds).to.be.equal(2);
    });

    it("should not update if block is the same or later", async () => {
      await createPairs();

      await oracle.addPaths([A_C_PATH]);

      await oracle.doubleUpdatePrice();

      let rounds = await oracle.getPairRounds(A_C_PAIR);

      expect(rounds).to.be.equal(2);
    });
  });

  describe("getPrice", () => {
    it("should correctly get price", async () => {
      await createPairs();

      await oracle.addPaths([A_C_PATH]);

      await oracle.updatePrices();

      let response = await oracle.getPrice(A_TOKEN, 10);

      expect(response[0]).to.be.equal(10);
      expect(response[1]).to.be.equal(C_TOKEN);
    });

    it("should correctly get complex price", async () => {
      await createPairs();

      await oracle.addPaths([A_C_PATH]);

      const firstTime = await time.latest();

      await time.increaseTo(firstTime + 10);

      const pair = <UniswapV2PairMock>await ethers.getContractAt("UniswapV2PairMock", A_C_PAIR);

      await pair.swap(wei("0.85"), 0);

      await time.increaseTo(firstTime + 20);

      let response = await oracle.getPrice(A_TOKEN, 10);

      expect(response[0]).to.be.equal("35");
      expect(response[1]).to.be.equal(C_TOKEN);
    });

    it("should return 0 price", async () => {
      await createPairs();

      await oracle.addPaths([B_A_C_PATH]);

      const pair = <UniswapV2PairMock>await ethers.getContractAt("UniswapV2PairMock", A_C_PAIR);

      await pair.swap(wei("1"), 0);

      let response = await oracle.getPrice(B_TOKEN, 0);

      expect(response[0]).to.be.equal("0");
      expect(response[1]).to.be.equal(C_TOKEN);
    });

    it("should not get price if there is no path", async () => {
      await expect(oracle.getPrice(A_TOKEN, 10)).to.be.revertedWith("UniswapV2Oracle: invalid path");
    });
  });
});
