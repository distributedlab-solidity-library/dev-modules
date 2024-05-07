import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Reverter } from "@/test/helpers/reverter";

import { SetHelperMock } from "@ethers-v6";
import { ZERO_BYTES32 } from "@/scripts/utils/constants";

describe("SetHelper", () => {
  const reverter = new Reverter();

  let FIRST: SignerWithAddress;
  let SECOND: SignerWithAddress;
  let THIRD: SignerWithAddress;

  let mock: SetHelperMock;

  function stringToBytes(strToConvert: string) {
    return ethers.hexlify(ethers.toUtf8Bytes(strToConvert));
  }

  before("setup", async () => {
    [FIRST, SECOND, THIRD] = await ethers.getSigners();

    const SetHelperMock = await ethers.getContractFactory("SetHelperMock");
    mock = await SetHelperMock.deploy();

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("add", () => {
    it("should add to address set", async () => {
      await mock.addToAddressSet([FIRST.address, SECOND.address]);

      expect(await mock.getAddressSet()).to.deep.equal([FIRST.address, SECOND.address]);
    });

    it("should add to uint set", async () => {
      await mock.addToUintSet([1]);

      expect(await mock.getUintSet()).to.deep.equal([1n]);
    });

    it("should add to bytes32 set", async () => {
      await mock.addToBytes32Set([ZERO_BYTES32]);

      expect(await mock.getBytes32Set()).to.deep.equal([ZERO_BYTES32]);
    });

    it("should add to bytes set", async () => {
      await mock.addToBytesSet([ethers.toUtf8Bytes("1"), ethers.toUtf8Bytes("2"), ethers.toUtf8Bytes("3")]);

      expect(await mock.getBytesSet()).to.deep.equal([stringToBytes("1"), stringToBytes("2"), stringToBytes("3")]);
    });

    it("should add to string set", async () => {
      await mock.addToStringSet(["1", "2", "3"]);

      expect(await mock.getStringSet()).to.deep.equal(["1", "2", "3"]);
    });
  });

  describe("strictAdd", () => {
    it("should not strict add to address set if element already exists", async () => {
      await expect(mock.strictAddToAddressSet([FIRST.address, FIRST.address])).to.be.revertedWith(
        "SetHelper: element already exists",
      );
    });

    it("should not strict add to uint set if element already exists", async () => {
      await expect(mock.strictAddToUintSet([1, 1])).to.be.revertedWith("SetHelper: element already exists");
    });

    it("should not strict add to bytes32 set if element already exists", async () => {
      await expect(mock.strictAddToBytes32Set([ZERO_BYTES32, ZERO_BYTES32])).to.be.revertedWith(
        "SetHelper: element already exists",
      );
    });

    it("should not strict add to bytes set if element already exists", async () => {
      const bytesToAdd = ethers.toUtf8Bytes("1");

      await expect(mock.strictAddToBytesSet([bytesToAdd, bytesToAdd])).to.be.revertedWith(
        "SetHelper: element already exists",
      );
    });

    it("should not strict add to string set if element already exists", async () => {
      await expect(mock.strictAddToStringSet(["1", "1"])).to.be.revertedWith("SetHelper: element already exists");
    });

    it("should strict add to address set", async () => {
      await mock.strictAddToAddressSet([FIRST.address, SECOND.address]);

      expect(await mock.getAddressSet()).to.deep.equal([FIRST.address, SECOND.address]);
    });

    it("should strict add to uint set", async () => {
      await mock.strictAddToUintSet([1]);

      expect(await mock.getUintSet()).to.deep.equal([1n]);
    });

    it("should strict add to bytes32 set", async () => {
      await mock.strictAddToBytes32Set([ZERO_BYTES32]);

      expect(await mock.getBytes32Set()).to.deep.equal([ZERO_BYTES32]);
    });

    it("should strict add to bytes set", async () => {
      await mock.strictAddToBytesSet([ethers.toUtf8Bytes("1"), ethers.toUtf8Bytes("2"), ethers.toUtf8Bytes("3")]);

      expect(await mock.getBytesSet()).to.deep.equal([stringToBytes("1"), stringToBytes("2"), stringToBytes("3")]);
    });

    it("should strict add to string set", async () => {
      await mock.strictAddToStringSet(["1", "2", "3"]);

      expect(await mock.getStringSet()).to.deep.equal(["1", "2", "3"]);
    });
  });

  describe("remove", () => {
    it("should remove from address set", async () => {
      await mock.addToAddressSet([FIRST.address, SECOND.address]);
      await mock.removeFromAddressSet([SECOND.address, THIRD.address]);

      expect(await mock.getAddressSet()).to.deep.equal([FIRST.address]);
    });

    it("should remove from uint set", async () => {
      await mock.addToUintSet([1]);
      await mock.removeFromUintSet([1]);

      expect(await mock.getUintSet()).to.deep.equal([]);
    });

    it("should remove from bytes32 set", async () => {
      await mock.addToBytes32Set([ZERO_BYTES32]);
      await mock.removeFromBytes32Set([ZERO_BYTES32]);

      expect(await mock.getBytes32Set()).to.deep.equal([]);
    });

    it("should remove from bytes set", async () => {
      const valuesToAdd: Uint8Array[] = [ethers.toUtf8Bytes("1"), ethers.toUtf8Bytes("2"), ethers.toUtf8Bytes("3")];

      await mock.strictAddToBytesSet(valuesToAdd);

      await mock.removeFromBytesSet([valuesToAdd[0], ethers.toUtf8Bytes("4")]);

      expect(await mock.getBytesSet()).to.deep.equal([stringToBytes("3"), stringToBytes("2")]);
    });

    it("should remove from string set", async () => {
      await mock.addToStringSet(["1", "2", "3"]);
      await mock.removeFromStringSet(["1", "4"]);

      expect(await mock.getStringSet()).to.deep.equal(["3", "2"]);
    });
  });

  describe("strictRemove", () => {
    it("should not strict remove from address set if no such element", async () => {
      await mock.strictAddToAddressSet([FIRST.address, SECOND.address]);

      await expect(mock.strictRemoveFromAddressSet([SECOND.address, SECOND.address])).to.be.revertedWith(
        "SetHelper: no such element",
      );
    });

    it("should not strict remove from uint set if no such element", async () => {
      await mock.strictAddToUintSet([1]);

      await expect(mock.strictRemoveFromUintSet([1, 1])).to.be.revertedWith("SetHelper: no such element");
    });

    it("should not strict remove from bytes32 set if no such element", async () => {
      await mock.strictAddToBytes32Set([ZERO_BYTES32]);

      await expect(mock.strictRemoveFromBytes32Set([ZERO_BYTES32, ZERO_BYTES32])).to.be.revertedWith(
        "SetHelper: no such element",
      );
    });

    it("should not strict remove from string set if no such element", async () => {
      await mock.strictAddToStringSet(["1", "2", "3"]);

      await expect(mock.strictRemoveFromStringSet(["1", "1"])).to.be.revertedWith("SetHelper: no such element");
    });

    it("should not strict remove from bytes set if no such element", async () => {
      await mock.strictAddToBytesSet([ethers.toUtf8Bytes("1"), ethers.toUtf8Bytes("2"), ethers.toUtf8Bytes("3")]);

      await expect(mock.strictRemoveFromBytesSet([ethers.toUtf8Bytes("5")])).to.be.revertedWith(
        "SetHelper: no such element",
      );
    });

    it("should strict remove from address set", async () => {
      await mock.strictAddToAddressSet([FIRST.address, SECOND.address]);
      await mock.strictRemoveFromAddressSet([SECOND.address]);

      expect(await mock.getAddressSet()).to.deep.equal([FIRST.address]);
    });

    it("should strict remove from uint set", async () => {
      await mock.strictAddToUintSet([1]);
      await mock.strictRemoveFromUintSet([1]);

      expect(await mock.getUintSet()).to.deep.equal([]);
    });

    it("should strict remove from bytes32 set", async () => {
      await mock.strictAddToBytes32Set([ZERO_BYTES32]);
      await mock.strictRemoveFromBytes32Set([ZERO_BYTES32]);

      expect(await mock.getBytes32Set()).to.deep.equal([]);
    });

    it("should strict remove from bytes set", async () => {
      const valuesToAdd: Uint8Array[] = [ethers.toUtf8Bytes("1"), ethers.toUtf8Bytes("2"), ethers.toUtf8Bytes("3")];

      await mock.strictAddToBytesSet(valuesToAdd);

      await mock.strictRemoveFromBytesSet([valuesToAdd[0]]);

      expect(await mock.getBytesSet()).to.deep.equal([stringToBytes("3"), stringToBytes("2")]);
    });

    it("should strict remove from string set", async () => {
      await mock.strictAddToStringSet(["1", "2", "3"]);
      await mock.strictRemoveFromStringSet(["1"]);

      expect(await mock.getStringSet()).to.deep.equal(["3", "2"]);
    });
  });
});
