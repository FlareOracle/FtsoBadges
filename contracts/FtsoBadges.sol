// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./FtsoUtils.sol";
import "./ERC1155NonTransferable.sol";

/**
 * @notice Whitelisted FTSO price providers can use this contract to claim NFT badges by signing commitments
 */
contract FtsoBadges is ERC1155NonTransferable, FtsoUtils {
    using ECDSA for bytes32;
    using ECDSA for bytes;
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.AddressSet;

    event PledgeAdded(uint256 _id);
    event Pledged(uint256 indexed _id, address _account);
    event Revoked(uint256 indexed _id, address _account);
    event Redeemed(uint256 indexed _id, address _account);

    struct Pledge {
        string content;
    }

    constructor(
        IFtsoRegistry _registry,
        IVoterWhitelister _whitelister
    ) FtsoUtils(_registry, _whitelister) {}

    Counters.Counter public ids;

    mapping(uint256 => Pledge) public pledges;
    mapping(uint256 => mapping(address => bool)) public pledgeRevoked;

    mapping(uint256 => EnumerableSet.AddressSet) private pledgedAccounts;

    /**
     * @notice Gets list of addresses with a badge
     * @param _id Badge id
     */
    function getAccountsWithBadges(
        uint256 _id
    ) external view returns (address[] memory) {
        address[] memory accounts = new address[](
            pledgedAccounts[_id].length()
        );
        for (uint256 i = 0; i < pledgedAccounts[_id].length(); i++) {
            accounts[i] = pledgedAccounts[_id].at(i);
        }
        return accounts;
    }

    /**
     * @notice A whitelisted FTSO price provider may sign a pledge and earn a badge
     * @param _id Badge id
     * @param _signature Pledge signed
     */
    function claimBadge(uint256 _id, bytes memory _signature) external {
        require(isWhitelistedToFtso(msg.sender), "Not whitelisted to FTSO");
        require(balanceOf(msg.sender, _id) == 0, "Already pledged");
        require(!pledgeRevoked[_id][msg.sender], "Revoked");

        Pledge memory p = pledges[_id];
        require(
            isValidSignature(msg.sender, p.content, _signature),
            "Not a valid signature"
        );

        pledgedAccounts[_id].add(msg.sender);
        _mint(msg.sender, _id, 1, "");

        emit Pledged(_id, msg.sender);
    }

    /**
     * @notice Function to check if an account has earned a badge
     * @param _id Badge id
     * @param _account Account to check
     */
    function hasBadge(
        uint256 _id,
        address _account
    ) external view returns (bool) {
        return balanceOf(_account, _id) > 0;
    }

    /**
     * @notice Add a new badge
     * @param _uri Token URI of the badge
     * @param _pledge Contents of the pledge related to this badge
     */
    function add(string memory _uri, string memory _pledge) external onlyOwner {
        uint256 id = ids.current();
        Pledge storage p = pledges[id];
        p.content = _pledge;

        _setURI(id, _uri);
        ids.increment();

        emit PledgeAdded(id);
    }

    /**
     * @notice Revokes a badge, the account can't claim this badge until redeemed
     * @param _from Account to revoke a badge from
     * @param _id ID of the badge
     */
    function revoke(address _from, uint256 _id) external onlyOwner {
        pledgeRevoked[_id][_from] = true;
        pledgedAccounts[_id].remove(_from);
        _burn(_from, _id, 1);

        emit Revoked(_id, _from);
    }

    /**
     * @notice Redeems user to be able to claim a badge
     * @param _account Account to redeem
     * @param _id ID of the badge
     */
    function redeem(address _account, uint256 _id) external onlyOwner {
        pledgeRevoked[_id][_account] = false;
        emit Redeemed(_id, _account);
    }

    function isValidSignature(
        address _signer,
        string memory _pledge,
        bytes memory _signature
    ) private pure returns (bool) {
        return
            bytes(_pledge).toEthSignedMessageHash().recover(_signature) ==
            _signer;
    }
}
