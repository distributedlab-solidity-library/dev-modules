import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";
import { ZERO_ADDR } from "@/scripts/utils/constants";

import { MultiOwnableContractsRegistry } from "@ethers-v6";

describe("MultiOwnableContractsRegistry", () => {
  const reverter = new Reverter();

  let SECOND: SignerWithAddress;

  let contractsRegistry: MultiOwnableContractsRegistry;

  before("setup", async () => {
    [, SECOND] = await ethers.getSigners();

    const MultiOwnableContractsRegistry = await ethers.getContractFactory("MultiOwnableContractsRegistry");
    contractsRegistry = await MultiOwnableContractsRegistry.deploy();

    await contractsRegistry.__MultiOwnableContractsRegistry_init();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("access", () => {
    it("should not initialize twice", async () => {
      await expect(contractsRegistry.__MultiOwnableContractsRegistry_init()).to.be.revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("only owner should call these functions", async () => {
      await expect(contractsRegistry.connect(SECOND).injectDependencies("")).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );

      await expect(contractsRegistry.connect(SECOND).injectDependenciesWithData("", "0x")).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );

      await expect(contractsRegistry.connect(SECOND).upgradeContract("", ZERO_ADDR)).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );

      await expect(contractsRegistry.connect(SECOND).upgradeContractAndCall("", ZERO_ADDR, "0x")).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );

      await expect(contractsRegistry.connect(SECOND).addContract("", ZERO_ADDR)).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );

      await expect(contractsRegistry.connect(SECOND).addProxyContract("", ZERO_ADDR)).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );

      await expect(contractsRegistry.connect(SECOND).addProxyContractAndCall("", ZERO_ADDR, "0x")).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );

      await expect(contractsRegistry.connect(SECOND).justAddProxyContract("", ZERO_ADDR)).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );

      await expect(contractsRegistry.connect(SECOND).removeContract("")).to.be.revertedWith(
        "MultiOwnable: caller is not the owner"
      );
    });
  });

  describe("coverage", () => {
    it("should call these methods", async () => {
      await expect(contractsRegistry.injectDependencies("")).to.be.reverted;

      await expect(contractsRegistry.injectDependenciesWithData("", "0x")).to.be.reverted;

      await expect(contractsRegistry.upgradeContract("", ZERO_ADDR)).to.be.reverted;

      await expect(contractsRegistry.upgradeContractAndCall("", ZERO_ADDR, "0x")).to.be.reverted;

      await expect(contractsRegistry.addContract("", ZERO_ADDR)).to.be.reverted;

      await expect(contractsRegistry.addProxyContract("", ZERO_ADDR)).to.be.reverted;

      await expect(contractsRegistry.addProxyContractAndCall("", ZERO_ADDR, "0x")).to.be.reverted;

      await expect(contractsRegistry.justAddProxyContract("", ZERO_ADDR)).to.be.reverted;

      await expect(contractsRegistry.removeContract("")).to.be.reverted;
    });
  });
});
