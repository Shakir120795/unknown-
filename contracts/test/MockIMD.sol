// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockIMD is ERC20 {
    constructor() ERC20("Mock IMD", "mIMD") {
        _mint(msg.sender, 1_000_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
