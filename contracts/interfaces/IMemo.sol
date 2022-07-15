// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMemo is IERC20 {
    function mintRewards(address _to, uint256 _amount) external;

    function burn(address account, uint256 amount) external;

    function mint(address _to, uint256 _amount) external;

    function lockAdminMinting() external;

    function allowPoolMinting() external;

    function lockPoolContract() external;
}