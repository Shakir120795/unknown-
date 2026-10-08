// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title UNKNOWN — Proof-of-Work NFT
/// @notice 1,111 ERC-721 NFTs minted directly by winning SHA-256 proofs.
/// @dev No backend, coordinator or mint signer is required. The contract verifies PoW on-chain.
///      Each successful mint immediately receives a unique artwork assignment on-chain.
contract UnknownMining is ERC721, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 1111;
    uint256 public constant MAX_CHALLENGE_AGE = 32;
    bytes16 public constant POW_DOMAIN = "UNKNOWN-MININGV2";

    IERC20 public immutable imd;
    address public immutable treasury;
    bytes32 public immutable provenanceHash;

    uint256 public totalMinted;
    uint256 public remainingArtCount = MAX_SUPPLY;
    mapping(uint256 => uint256) private shuffledArt;
    mapping(uint256 => uint256) public artIdOf;

    string private metadataBaseURI;

    mapping(uint8 => uint256) public phasePrice;
    mapping(uint8 => uint8) public phaseDifficultyBits;

    event Minted(
        address indexed minter,
        uint256 indexed tokenId,
        uint8 indexed phase,
        uint256 seedBlock,
        uint256 nonce,
        bytes32 proofHash,
        uint256 price,
        uint256 artId
    );
    event PausedByOwner();
    event UnpausedByOwner();

    error SoldOut();
    error InvalidTokenId();
    error InvalidSeedBlock();
    error StaleSeedBlock();
    error InvalidProof();
    error ZeroAddress();
    error InvalidConfig();

    constructor(
        address imdToken,
        address initialTreasury,
        string memory initialMetadataBaseURI,
        bytes32 initialProvenanceHash,
        uint256[6] memory prices,
        uint8[6] memory difficultyBits
    )
        ERC721("UNKNOWN", "UNKNOWN")
        Ownable(msg.sender)
    {
        if (imdToken == address(0) || initialTreasury == address(0)) revert ZeroAddress();
        if (bytes(initialMetadataBaseURI).length == 0) revert InvalidConfig();
        if (initialProvenanceHash == bytes32(0)) revert InvalidConfig();

        imd = IERC20(imdToken);
        treasury = initialTreasury;
        metadataBaseURI = initialMetadataBaseURI;
        provenanceHash = initialProvenanceHash;

        for (uint8 i = 0; i < 6; i++) {
            if (prices[i] == 0 || difficultyBits[i] == 0 || difficultyBits[i] > 248) revert InvalidConfig();
            if (i > 0 && difficultyBits[i] <= difficultyBits[i - 1]) revert InvalidConfig();
            phasePrice[i + 1] = prices[i];
            phaseDifficultyBits[i + 1] = difficultyBits[i];
        }
    }

    function currentPhase() public view returns (uint8) {
        if (totalMinted >= MAX_SUPPLY) return 6;
        return phaseForToken(totalMinted + 1);
    }

    function phaseForToken(uint256 tokenId) public pure returns (uint8) {
        if (tokenId >= 1 && tokenId <= 200) return 1;
        if (tokenId >= 201 && tokenId <= 400) return 2;
        if (tokenId >= 401 && tokenId <= 600) return 3;
        if (tokenId >= 601 && tokenId <= 800) return 4;
        if (tokenId >= 801 && tokenId <= 1000) return 5;
        if (tokenId >= 1001 && tokenId <= MAX_SUPPLY) return 6;
        revert InvalidTokenId();
    }

    /// @notice Returns the current mining work target derived from the latest block hash.
    /// @dev Miners may keep using a seed block for up to MAX_CHALLENGE_AGE blocks.
    function currentWork()
        external
        view
        returns (
            uint256 seedBlock,
            bytes32 challenge,
            uint256 tokenId,
            uint8 phase,
            uint256 price,
            uint8 difficultyBits
        )
    {
        if (block.number == 0) revert InvalidSeedBlock();
        seedBlock = block.number - 1;
        challenge = blockhash(seedBlock);
        tokenId = totalMinted + 1;
        if (tokenId > MAX_SUPPLY) revert SoldOut();
        phase = phaseForToken(tokenId);
        price = phasePrice[phase];
        difficultyBits = phaseDifficultyBits[phase];
    }

    /// @notice Builds the exact SHA-256 preimage used by the PoW function.
    function powHash(
        address minter,
        uint256 tokenId,
        uint48 seedBlock,
        uint64 nonce
    ) public view returns (bytes32) {
        bytes32 challenge = blockhash(seedBlock);
        return _powHash(minter, tokenId, seedBlock, challenge, nonce);
    }

    /// @notice Returns true when a submitted nonce is valid for the specified work target.
    function isValidProof(
        address minter,
        uint256 tokenId,
        uint48 seedBlock,
        uint64 nonce
    ) public view returns (bool) {
        if (minter == address(0) || tokenId < 1 || tokenId > MAX_SUPPLY) return false;
        if (totalMinted >= MAX_SUPPLY || tokenId != totalMinted + 1) return false;
        if (seedBlock >= block.number || block.number - seedBlock > MAX_CHALLENGE_AGE) return false;
        bytes32 challenge = blockhash(seedBlock);
        if (challenge == bytes32(0)) return false;
        uint8 phase = phaseForToken(tokenId);
        bytes32 digest = _powHash(minter, tokenId, seedBlock, challenge, nonce);
        return _meetsDifficulty(digest, phaseDifficultyBits[phase]);
    }

    /// @notice Mine and mint the next sequential NFT with a valid SHA-256 proof.
    /// @dev First valid transaction wins tokenId = totalMinted + 1. Artwork is assigned
    ///      immediately from a draw-without-replacement pool using the mint block entropy.
    function mint(uint48 seedBlock, uint64 nonce) external nonReentrant whenNotPaused {
        if (totalMinted >= MAX_SUPPLY) revert SoldOut();
        if (seedBlock >= block.number) revert InvalidSeedBlock();
        if (block.number - seedBlock > MAX_CHALLENGE_AGE) revert StaleSeedBlock();

        bytes32 challenge = blockhash(seedBlock);
        if (challenge == bytes32(0)) revert StaleSeedBlock();

        uint256 tokenId = totalMinted + 1;
        uint8 phase = phaseForToken(tokenId);
        bytes32 digest = _powHash(msg.sender, tokenId, seedBlock, challenge, nonce);
        if (!_meetsDifficulty(digest, phaseDifficultyBits[phase])) revert InvalidProof();

        uint256 price = phasePrice[phase];
        imd.safeTransferFrom(msg.sender, treasury, price);

        totalMinted = tokenId;
        uint256 artId = _drawUniqueArt(tokenId, seedBlock, challenge);
        artIdOf[tokenId] = artId;

        _safeMint(msg.sender, tokenId);

        emit Minted(msg.sender, tokenId, phase, seedBlock, nonce, digest, price, artId);
    }

    function pause() external onlyOwner {
        _pause();
        emit PausedByOwner();
    }

    function unpause() external onlyOwner {
        _unpause();
        emit UnpausedByOwner();
    }

    function remaining() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(metadataBaseURI, artIdOf[tokenId].toString(), ".json");
    }

    function _drawUniqueArt(
        uint256 tokenId,
        uint48 seedBlock,
        bytes32 challenge
    ) internal returns (uint256 artId) {
        uint256 count = remainingArtCount;
        if (count == 0) revert SoldOut();

        uint256 entropy = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    challenge,
                    msg.sender,
                    tokenId,
                    seedBlock
                )
            )
        );
        uint256 index = entropy % count;

        uint256 chosen = shuffledArt[index];
        if (chosen == 0) chosen = index + 1;

        uint256 lastIndex = count - 1;
        if (index != lastIndex) {
            uint256 lastValue = shuffledArt[lastIndex];
            if (lastValue == 0) lastValue = lastIndex + 1;
            shuffledArt[index] = lastValue;
        }
        delete shuffledArt[lastIndex];

        remainingArtCount = count - 1;
        return chosen;
    }

    function _powHash(
        address minter,
        uint256 tokenId,
        uint256 seedBlock,
        bytes32 challenge,
        uint64 nonce
    ) internal view returns (bytes32) {
        // Fixed-width 112-byte payload; the browser GPU miner uses the same layout.
        // DOMAIN(16) | chainId(uint32=4) | contract(20) | challenge(32) |
        // seedBlock(uint48=6) | tokenId(uint48=6) | minter(20) | nonce(uint64=8)
        return sha256(
            abi.encodePacked(
                POW_DOMAIN,
                uint32(block.chainid),
                address(this),
                challenge,
                uint48(seedBlock),
                uint48(tokenId),
                minter,
                uint64(nonce)
            )
        );
    }

    function _meetsDifficulty(bytes32 digest, uint8 difficultyBits) internal pure returns (bool) {
        uint256 value = uint256(digest);
        uint256 target = type(uint256).max >> difficultyBits;
        return value <= target;
    }

    function _baseURI() internal view override returns (string memory) {
        return metadataBaseURI;
    }
}
