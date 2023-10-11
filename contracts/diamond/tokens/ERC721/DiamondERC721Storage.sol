// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {DiamondERC165} from "../../introspection/DiamondERC165.sol";
import {InitializableStorage} from "../../utils/InitializableStorage.sol";

/**
 * @notice This is an ERC721 token Storage contract with Diamond Standard support
 */
abstract contract DiamondERC721Storage is
    InitializableStorage,
    DiamondERC165,
    IERC721,
    IERC721Metadata
{
    using Strings for uint256;

    bytes32 public constant DIAMOND_ERC721_STORAGE_SLOT =
        keccak256("diamond.standard.diamond.erc721.storage");

    struct DERC721Storage {
        string name;
        string symbol;
        uint256[] allTokens;
        mapping(uint256 => address) owners;
        mapping(address => uint256) balances;
        mapping(uint256 => address) tokenApprovals;
        mapping(uint256 => uint256) allTokensIndex;
        mapping(uint256 => uint256) ownedTokensIndex;
        mapping(address => mapping(address => bool)) operatorApprovals;
        mapping(address => mapping(uint256 => uint256)) ownedTokens;
    }

    function _getErc721Storage() internal pure returns (DERC721Storage storage _erc721Storage) {
        bytes32 slot_ = DIAMOND_ERC721_STORAGE_SLOT;

        assembly {
            _erc721Storage.slot := slot_
        }
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId_
    ) public view virtual override(DiamondERC165, IERC165) returns (bool) {
        return
            interfaceId_ == type(IERC721).interfaceId ||
            interfaceId_ == type(IERC721Metadata).interfaceId ||
            interfaceId_ == type(IERC721Enumerable).interfaceId ||
            super.supportsInterface(interfaceId_);
    }

    /**
     * @notice The function to get the name of the token.
     * @return The name of the token.
     */
    function name() public view virtual override returns (string memory) {
        return _getErc721Storage().name;
    }

    /**
     * @notice The function to get the symbol of the token.
     * @return The symbol of the token.
     */
    function symbol() public view virtual override returns (string memory) {
        return _getErc721Storage().symbol;
    }

    /**
     * @notice The function to get the Uniform Resource Identifier (URI) for `tokenId` token.
     * @return The URI of the token.
     */
    function tokenURI(uint256 tokenId_) public view virtual override returns (string memory) {
        _requireMinted(tokenId_);

        string memory baseURI_ = _baseURI();

        return
            bytes(baseURI_).length > 0
                ? string(abi.encodePacked(baseURI_, tokenId_.toString()))
                : "";
    }

    /**
     * @notice The function to get total amount of minted tokens.
     * @return The amount of minted tokens.
     */
    function totalSupply() public view virtual returns (uint256) {
        return _getErc721Storage().allTokens.length;
    }

    /**
     * @inheritdoc IERC721
     */
    function balanceOf(address owner_) public view virtual override returns (uint256) {
        return _getErc721Storage().balances[owner_];
    }

    /**
     * @notice This function allows you to retrieve the NFT token ID for a specific owner at a specified index.
     */
    function tokenOfOwnerByIndex(
        address owner_,
        uint256 index_
    ) public view virtual returns (uint256) {
        require(index_ < balanceOf(owner_), "ERC721Enumerable: owner index out of bounds");

        return _getErc721Storage().ownedTokens[owner_][index_];
    }

    /**
     * @notice This function allows you to retrieve the NFT token ID at a given `index` of all the tokens stored by the contract.
     */
    function tokenByIndex(uint256 index_) public view virtual returns (uint256) {
        require(index_ < totalSupply(), "ERC721Enumerable: global index out of bounds");

        return _getErc721Storage().allTokens[index_];
    }

    /**
     * @inheritdoc IERC721
     */
    function ownerOf(uint256 tokenId_) public view virtual override returns (address) {
        address owner = _ownerOf(tokenId_);

        require(owner != address(0), "ERC721: invalid token ID");

        return owner;
    }

    /**
     * @inheritdoc IERC721
     */
    function getApproved(uint256 tokenId_) public view virtual override returns (address) {
        _requireMinted(tokenId_);

        return _getErc721Storage().tokenApprovals[tokenId_];
    }

    /**
     * @inheritdoc IERC721
     */
    function isApprovedForAll(
        address owner_,
        address operator_
    ) public view virtual override returns (bool) {
        return _getErc721Storage().operatorApprovals[owner_][operator_];
    }

    /**
     * @notice This function that returns the base URI that can be used to construct the URI for retrieving metadata related to the NFT collection.
     */
    function _baseURI() internal view virtual returns (string memory) {
        return "";
    }

    /**
     * @notice The function that reverts if the `tokenId` has not been minted yet.
     */
    function _requireMinted(uint256 tokenId_) internal view virtual {
        require(_exists(tokenId_), "ERC721: invalid token ID");
    }

    /**
     * @notice The function that returns whether `tokenId` exists.
     */
    function _exists(uint256 tokenId_) internal view virtual returns (bool) {
        return _ownerOf(tokenId_) != address(0);
    }

    /**
     * @notice The function that returns the owner of the `tokenId`. Does NOT revert if token doesn't exist.
     */
    function _ownerOf(uint256 tokenId_) internal view virtual returns (address) {
        return _getErc721Storage().owners[tokenId_];
    }

    /**
     * @notice The function that returns whether `spender` is allowed to manage `tokenId`.
     */
    function _isApprovedOrOwner(
        address spender_,
        uint256 tokenId_
    ) internal view virtual returns (bool) {
        address owner = ownerOf(tokenId_);

        return (spender_ == owner ||
            isApprovedForAll(owner, spender_) ||
            getApproved(tokenId_) == spender_);
    }
}
