// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IHederaTokenService {
    struct AccountAmount {
        address accountID;
        int64 amount;
        bool isApproval;
    }
    struct TransferList {
        AccountAmount[] transfers;
    }
    struct TokenTransferList {
        address token;
        AccountAmount[] transfers;
    }
    function cryptoTransfer(TransferList memory transferList, TokenTransferList[] memory tokenTransfers) external returns (int responseCode);
}

interface ISaucerSwapRouter {
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);
}

contract SweephySwap {
    address constant PRECOMPILE_ADDRESS = address(0x167);
    address public saucerRouter;
    address public whbar;
    address public usdc;

    // Standard Hedera/SaucerSwap Mainnet Addresses (Defaults)
    // Router: 0.0.3045981 (0x00000000000000000000000000000000002e7a1d)
    // WHBAR: 0.0.1456986 (0x0000000000000000000000000000000000163b5a)
    // USDC: 0.0.456858 (0x000000000000000000000000000000000006f89a)
    
    constructor(address _router, address _whbar, address _usdc) {
        saucerRouter = _router;
        whbar = _whbar;
        usdc = _usdc;
    }

    /**
     * @dev Executes a swap from HBAR to USDC on behalf of a user.
     * The user must have granted HBAR allowance to this contract.
     * @param user The address of the user (who pays HBAR and receives USDC).
     * @param amountHbar The amount of HBAR to swap (in tinybars).
     * @param minAmountOut The minimum amount of USDC to receive.
     */
    function executeSwap(address user, int64 amountHbar, uint256 minAmountOut) external {
        require(amountHbar > 0, "Amount must be > 0");

        // 1. Pull HBAR from user to this contract using HTS Precompile
        // We use isApproval = true for the debit to indicate we are using allowance
        IHederaTokenService.AccountAmount[] memory transfers = new IHederaTokenService.AccountAmount[](2);
        transfers[0] = IHederaTokenService.AccountAmount(user, -amountHbar, true); 
        transfers[1] = IHederaTokenService.AccountAmount(address(this), amountHbar, false);
        
        IHederaTokenService.TransferList memory transferList = IHederaTokenService.TransferList(transfers);
        IHederaTokenService.TokenTransferList[] memory tokenTransfers = new IHederaTokenService.TokenTransferList[](0);

        (bool success, bytes memory result) = PRECOMPILE_ADDRESS.call(
            abi.encodeWithSelector(IHederaTokenService.cryptoTransfer.selector, transferList, tokenTransfers)
        );
        require(success, "HTS Transfer Failed");
        int responseCode = abi.decode(result, (int));
        require(responseCode == 22, "HTS Transfer Error: Not Success"); // 22 = SUCCESS in Hedera

        // 2. Swap on SaucerSwap
        // The contract now holds the HBAR. We call swapExactETHForTokens sending the HBAR as value.
        address[] memory path = new address[](2);
        path[0] = whbar;
        path[1] = usdc;

        ISaucerSwapRouter(saucerRouter).swapExactETHForTokens{value: uint256(int256(amountHbar))}(
            minAmountOut,
            path,
            user, // Send USDC directly to the user
            block.timestamp + 1200 // Deadline
        );
    }

    // Allow contract to receive HBAR
    receive() external payable {}
}
