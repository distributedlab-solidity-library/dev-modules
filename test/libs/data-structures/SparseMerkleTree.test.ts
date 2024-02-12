import { expect } from "chai";
import { ethers } from "hardhat";

import { Hash, LocalStorageDB, Merkletree, Proof, str2Bytes, verifyProof } from "@iden3/js-merkletree";

import { SparseMerkleTreeMock } from "@ethers-v6";
import { SparseMerkleTree } from "@/generated-types/ethers/contracts/mock/libs/data-structures/SparseMerkleTreeMock.sol/SparseMerkleTreeMock";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { Reverter } from "@/test/helpers/reverter";
import { getPoseidon, poseidonHash } from "@/test/helpers/poseidon-hash";

import "mock-local-storage";

describe("SparseMerkleTree", () => {
  const reverter = new Reverter();

  let USER1: SignerWithAddress;

  let merkleTree: SparseMerkleTreeMock;

  let storage: LocalStorageDB;

  let localMerkleTree: Merkletree;

  before("setup", async () => {
    [USER1] = await ethers.getSigners();

    const SparseMerkleTreeMock = await ethers.getContractFactory("SparseMerkleTreeMock", {
      libraries: {
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    merkleTree = await SparseMerkleTreeMock.deploy();

    await reverter.snapshot();
  });

  beforeEach("setup", async () => {
    storage = new LocalStorageDB(str2Bytes(""));

    localMerkleTree = new Merkletree(storage, true, 20);
  });

  afterEach("cleanup", async () => {
    await reverter.revert();

    localStorage.clear();
  });

  async function getRoot(tree: Merkletree): Promise<string> {
    return ethers.toBeHex((await tree.root()).bigInt(), 32);
  }

  function getOnchainProof(onchainProof: SparseMerkleTree.ProofStructOutput): Proof {
    const modifiableArray = JSON.parse(JSON.stringify(onchainProof.siblings)).reverse() as string[];
    const reversedKey = modifiableArray.findIndex((value) => value !== ethers.ZeroHash);
    const lastKey = reversedKey !== -1 ? onchainProof.siblings.length - 1 - reversedKey : -1;

    const siblings = onchainProof.siblings
      .filter((value, key) => value != ethers.ZeroHash || key <= lastKey)
      .map((sibling: string) => new Hash(Hash.fromHex(sibling.slice(2)).value.reverse()));

    let nodeAux: { key: Hash; value: Hash } | undefined = undefined;

    if (onchainProof.auxExistence) {
      nodeAux = {
        key: new Hash(Hash.fromHex(onchainProof.auxKey.slice(2)).value.reverse()),
        value: new Hash(Hash.fromHex(onchainProof.auxValue.slice(2)).value.reverse()),
      };
    }

    return new Proof({
      siblings,
      existence: onchainProof.existence,
      nodeAux,
    });
  }

  async function compareNodes(node: SparseMerkleTree.NodeStructOutput, key: bigint) {
    const localNode = await localMerkleTree.get(key);

    expect(node.key).to.equal(ethers.toBeHex(localNode.key, 32));
    expect(node.value).to.equal(ethers.toBeHex(localNode.value, 32));
  }

  describe("Uint SMT", () => {
    beforeEach("setup", async () => {
      await merkleTree.initializeUintTree(20);
      await merkleTree.setUintPoseidonHasher();
    });

    it("should not initialize twice", async () => {
      await expect(merkleTree.initializeUintTree(20)).to.be.rejectedWith(
        "SparseMerkleTree: tree is already initialized",
      );
    });

    it("should revert if trying to set incorrect max depth", async () => {
      await expect(merkleTree.setMaxDepthUintTree(0)).to.be.rejectedWith(
        "SparseMerkleTree: max depth must be greater than zero",
      );

      await expect(merkleTree.setMaxDepthUintTree(15)).to.be.rejectedWith(
        "SparseMerkleTree: max depth can only be increased",
      );

      await expect(merkleTree.setMaxDepthUintTree(300)).to.be.rejectedWith(
        "SparseMerkleTree: max depth is greater than hard cap",
      );
    });

    it("should set max depth bigger than the current one", async () => {
      await merkleTree.setMaxDepthUintTree(21);

      expect(await merkleTree.getUintMaxDepth()).to.equal(21);
    });

    it("should revert if trying to call add function on non-initialized tree", async () => {
      const SparseMerkleTreeMock = await ethers.getContractFactory("SparseMerkleTreeMock", {
        libraries: {
          PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });
      const newMerkleTree = await SparseMerkleTreeMock.deploy();

      await expect(newMerkleTree.addUint(1n, 1n)).to.be.rejectedWith("SparseMerkleTree: tree is not initialized");
    });

    it("should build a Merkle Tree of a predefined size with correct initial values", async () => {
      const value = 2341n;
      const key = BigInt(poseidonHash(ethers.toBeHex(value)));

      expect(await merkleTree.getUintRoot()).to.equal(await getRoot(localMerkleTree));

      await merkleTree.addUint(key, value);

      await localMerkleTree.add(key, value);

      expect(await merkleTree.getUintRoot()).to.equal(await getRoot(localMerkleTree));

      expect(await merkleTree.getUintMaxDepth()).to.equal(20);
      expect(await merkleTree.getUintNodesCount()).to.equal(1);

      await compareNodes(await merkleTree.getUintNode(1), key);
      await compareNodes(await merkleTree.getUintNodeByKey(key), key);

      const onchainProof = getOnchainProof(await merkleTree.getUintProof(key));

      expect(await verifyProof(await localMerkleTree.root(), onchainProof, key, value)).to.be.true;
    });

    it("should build a Merkle Tree correctly with multiple elements", async () => {
      for (let i = 1n; i < 20n; i++) {
        const value = BigInt(ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32));
        const key = BigInt(poseidonHash(ethers.toBeHex(`0x` + value.toString(16), 32)));

        await merkleTree.addUint(key, value);

        await localMerkleTree.add(key, value);

        expect(await merkleTree.getUintRoot()).to.equal(await getRoot(localMerkleTree));

        await compareNodes(await merkleTree.getUintNodeByKey(key), key);

        const onchainProof = getOnchainProof(await merkleTree.getUintProof(key));
        expect(await verifyProof(await localMerkleTree.root(), onchainProof, key, value)).to.be.true;
      }

      expect(await merkleTree.isUintCustomHasherSet()).to.be.true;

      await expect(merkleTree.setUintPoseidonHasher()).to.be.rejectedWith("SparseMerkleTree: tree is not empty");
    });

    it("should generate empty proof on empty tree", async () => {
      const onchainProof = getOnchainProof(await merkleTree.getUintProof(1n));

      expect(onchainProof.allSiblings()).to.have.length(0);
    });

    it("should generate an empty proof for but with aux fields", async () => {
      await merkleTree.addUint(7n, 1n);

      const onchainProof = await merkleTree.getUintProof(5n);

      expect(onchainProof.auxKey).to.equal(7n);
      expect(onchainProof.auxValue).to.equal(1n);
      expect(onchainProof.auxExistence).to.equal(true);
      expect(onchainProof.existence).to.equal(false);
    });

    it("should generate non-membership proof (empty node and different node)", async () => {
      await localMerkleTree.add(3n, 15n); // key -> 0b011
      await localMerkleTree.add(7n, 15n); // key -> 0b111

      await merkleTree.addUint(3n, 15n);
      await merkleTree.addUint(7n, 15n);

      let onchainProof = getOnchainProof(await merkleTree.getUintProof(5n));
      expect(await verifyProof(await localMerkleTree.root(), onchainProof, 5n, 0n)).to.be.true;

      onchainProof = getOnchainProof(await merkleTree.getUintProof(15n));
      expect(await verifyProof(await localMerkleTree.root(), onchainProof, 15n, 15n)).to.be.true;
    });

    it("should revert if trying to add a node with the same key", async () => {
      const value = 2341n;
      const key = BigInt(poseidonHash(ethers.toBeHex(value)));

      await merkleTree.addUint(key, value);

      await expect(merkleTree.addUint(key, value)).to.be.rejectedWith("SparseMerkleTree: the key already exists");
    });

    it("should revert if max depth is reached", async () => {
      const SparseMerkleTreeMock = await ethers.getContractFactory("SparseMerkleTreeMock", {
        libraries: {
          PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });
      const newMerkleTree = await SparseMerkleTreeMock.deploy();

      await newMerkleTree.initializeUintTree(1);

      await newMerkleTree.addUint(1n, 1n);
      await newMerkleTree.addUint(2n, 1n);

      await expect(newMerkleTree.addUint(3n, 1n)).to.be.rejectedWith("SparseMerkleTree: max depth reached");
    });

    it("should get empty Node by non-existing key", async () => {
      expect((await merkleTree.getUintNodeByKey(1n)).nodeType).to.be.equal(0);

      await merkleTree.addUint(7n, 1n);

      expect((await merkleTree.getUintNodeByKey(5n)).nodeType).to.be.equal(0);
    });
  });

  describe("Bytes32 SMT", () => {
    beforeEach("setup", async () => {
      await merkleTree.initializeBytes32Tree(15);
      await merkleTree.setBytes32PoseidonHasher();

      await merkleTree.setMaxDepthBytes32Tree(20);
    });

    it("should not initialize twice", async () => {
      await expect(merkleTree.initializeBytes32Tree(20)).to.be.rejectedWith(
        "SparseMerkleTree: tree is already initialized",
      );
    });

    it("should build a Merkle Tree of a predefined size with correct initial values", async () => {
      const value = ethers.toBeHex("0x1235", 32);
      const key = poseidonHash(value);

      await merkleTree.addBytes32(key, value);

      await localMerkleTree.add(BigInt(key), BigInt(value));

      expect(await merkleTree.getBytes32Root()).to.equal(await getRoot(localMerkleTree));

      expect(await merkleTree.getBytes32MaxDepth()).to.equal(20);
      expect(await merkleTree.getBytes32NodesCount()).to.equal(1);

      await compareNodes(await merkleTree.getBytes32Node(1), BigInt(key));
      await compareNodes(await merkleTree.getBytes32NodeByKey(key), BigInt(key));

      const onchainProof = getOnchainProof(await merkleTree.getBytes32Proof(key));

      expect(await verifyProof(await localMerkleTree.root(), onchainProof, BigInt(key), BigInt(value))).to.be.true;
    });

    it("should build a Merkle Tree correctly with multiple elements", async () => {
      for (let i = 1n; i < 20n; i++) {
        const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
        const key = poseidonHash(value);

        await merkleTree.addBytes32(key, value);

        await localMerkleTree.add(BigInt(key), BigInt(value));

        expect(await merkleTree.getBytes32Root()).to.equal(await getRoot(localMerkleTree));

        await compareNodes(await merkleTree.getBytes32NodeByKey(key), BigInt(key));

        const onchainProof = getOnchainProof(await merkleTree.getBytes32Proof(key));
        expect(await verifyProof(await localMerkleTree.root(), onchainProof, BigInt(key), BigInt(value))).to.be.true;
      }

      expect(await merkleTree.isBytes32CustomHasherSet()).to.be.true;

      await expect(merkleTree.setBytes32PoseidonHasher()).to.be.rejectedWith("SparseMerkleTree: tree is not empty");
    });
  });

  describe("Address SMT", () => {
    beforeEach("setup", async () => {
      await merkleTree.initializeAddressTree(15);
      await merkleTree.setAddressPoseidonHasher();

      await merkleTree.setMaxDepthAddressTree(20);
    });

    it("should not initialize twice", async () => {
      await expect(merkleTree.initializeAddressTree(20)).to.be.rejectedWith(
        "SparseMerkleTree: tree is already initialized",
      );
    });

    it("should build a Merkle Tree of a predefined size with correct initial values", async () => {
      const value = await USER1.getAddress();
      const key = poseidonHash(value);

      await merkleTree.addAddress(key, value);

      await localMerkleTree.add(BigInt(key), BigInt(value));

      expect(await merkleTree.getAddressRoot()).to.equal(await getRoot(localMerkleTree));

      expect(await merkleTree.getAddressMaxDepth()).to.equal(20);
      expect(await merkleTree.getAddressNodesCount()).to.equal(1);

      await compareNodes(await merkleTree.getAddressNode(1), BigInt(key));
      await compareNodes(await merkleTree.getAddressNodeByKey(key), BigInt(key));

      const onchainProof = getOnchainProof(await merkleTree.getAddressProof(key));

      expect(await verifyProof(await localMerkleTree.root(), onchainProof, BigInt(key), BigInt(value))).to.be.true;
    });

    it("should build a Merkle Tree correctly with multiple elements", async () => {
      for (let i = 1n; i < 20n; i++) {
        const value = ethers.toBeHex(BigInt(await USER1.getAddress()) + i);
        const key = poseidonHash(value);

        await merkleTree.addAddress(key, value);

        await localMerkleTree.add(BigInt(key), BigInt(value));

        expect(await merkleTree.getAddressRoot()).to.equal(await getRoot(localMerkleTree));

        await compareNodes(await merkleTree.getAddressNodeByKey(key), BigInt(key));

        const onchainProof = getOnchainProof(await merkleTree.getAddressProof(key));
        expect(await verifyProof(await localMerkleTree.root(), onchainProof, BigInt(key), BigInt(value))).to.be.true;
      }

      expect(await merkleTree.isAddressCustomHasherSet()).to.be.true;

      await expect(merkleTree.setAddressPoseidonHasher()).to.be.rejectedWith("SparseMerkleTree: tree is not empty");
    });
  });
});
