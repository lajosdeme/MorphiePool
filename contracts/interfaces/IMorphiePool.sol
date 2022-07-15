// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMorphiePool {

    /* ------------ View ------------ */
    
    function earned() external view returns (uint256);

    function getStakedTokens(address _user) external view returns (uint256[] memory tokenIds);
    
    function getStakedTokensBalance(address _user) external view returns (uint256);
    
    /* ------------ Staking ------------ */
    function stake(uint256 tokenId) external;

    function stakeBatch(uint256[] memory tokenIds) external;

    function stakeAll() external;

    /* ------------ Unstaking ------------ */
    function unstake(uint256 tokenId) external;

    function unstakeBatch(uint256[] memory tokenIds) external;

    function emergencyUnstake(uint256 _tokenId) external;

    /* ------------ Claiming ------------ */
    function claimRewards() external;

    /* ------------ Setters ------------ */
    function setRewardParams(uint256 reward, uint256 duration) external;
}