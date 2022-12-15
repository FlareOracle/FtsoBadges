// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IVoterWhitelister {
    function getFtsoWhitelistedPriceProviders(
        uint256 _ftsoIndex
    ) external view returns (address[] memory);
}

interface IFtsoRegistry {
    function getSupportedIndicesAndFtsos()
        external
        view
        returns (uint256[] memory _supportedIndices, address[] memory _ftsos);
}

contract FtsoUtils is Ownable {
    IFtsoRegistry ftsoRegistry;
    IVoterWhitelister voterWhitelister;

    constructor(IFtsoRegistry _registry, IVoterWhitelister _whitelister) {
        ftsoRegistry = _registry;
        voterWhitelister = _whitelister;
    }

    function isWhitelistedToFtso(address _account) public view returns (bool) {
        (uint256[] memory _supportedIndices, ) = ftsoRegistry
            .getSupportedIndicesAndFtsos();

        for (uint256 i = 0; i < _supportedIndices.length; i++) {
            address[] memory w = voterWhitelister
                .getFtsoWhitelistedPriceProviders(i);
            for (uint256 j = 0; j < w.length; j++) {
                if (w[j] == _account) return true;
            }
        }
        return false;
    }

    function setFtsoRegistry(IFtsoRegistry _registry) external onlyOwner {
        ftsoRegistry = _registry;
    }

    function setVoterWhitelister(
        IVoterWhitelister _whitelister
    ) external onlyOwner {
        voterWhitelister = _whitelister;
    }
}
