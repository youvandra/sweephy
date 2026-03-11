pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

interface IWHBAR is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface ISaucerSwapRouter {
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IHederaTokenService {
    struct AccountAmount {
        address accountID;
        int64 amount;
        bool isApproval;
    }

    struct TokenTransferList {
        address token;
        AccountAmount[] transfers;
    }

    function cryptoTransfer(TokenTransferList[] memory tokenTransfers, AccountAmount[] memory hbarTransfers) external returns (int64);
    function associateToken(address account, address token) external returns (int64);
}

contract SweephySwap {
    error NotOwner();
    error NotOperator();
    error InvalidFeeBps();
    error InvalidAmount();
    error HtsError(int64 code);
    error HbarFeeTransferFailed();
    error TokenTransferFailed();

    event SwapExecuted(address indexed user, uint256 hbarInTinybars, uint256 usdcOut, uint256 feeTinybars);
    event OperatorUpdated(address indexed operator);
    event FeeRecipientUpdated(address indexed feeRecipient);
    event FeeBpsUpdated(uint16 feeBps);

    int64 private constant HTS_SUCCESS = 22;
    int64 private constant HTS_TOKEN_ALREADY_ASSOCIATED = 194;
    address private constant HTS_PRECOMPILE = address(0x167);
    uint256 private constant MAX_BPS = 10_000;

    address public owner;
    address public operator;
    address public feeRecipient;

    address public router;
    address public whbar;
    address public usdc;

    uint16 public feeBps;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(
        address operator_,
        address feeRecipient_,
        address router_,
        address whbar_,
        address usdc_,
        uint16 feeBps_
    ) {
        if (feeBps_ > MAX_BPS) revert InvalidFeeBps();
        owner = msg.sender;
        operator = operator_;
        feeRecipient = feeRecipient_;
        router = router_;
        whbar = whbar_;
        usdc = usdc_;
        feeBps = feeBps_;

        _ensureAssociated(whbar_);
        _ensureAssociated(usdc_);
    }

    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setFeeRecipient(address feeRecipient_) external onlyOwner {
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

    function setFeeBps(uint16 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_BPS) revert InvalidFeeBps();
        feeBps = feeBps_;
        emit FeeBpsUpdated(feeBps_);
    }

    function setRouter(address router_) external onlyOwner {
        router = router_;
    }

    function setTokens(address whbar_, address usdc_) external onlyOwner {
        whbar = whbar_;
        usdc = usdc_;
        _ensureAssociated(whbar_);
        _ensureAssociated(usdc_);
    }

    function executeSwap(address user, int64 amountInTinybars, uint256 amountOutMin) external onlyOperator returns (uint256 usdcOut) {
        if (user == address(0)) revert InvalidAmount();
        if (amountInTinybars <= 0) revert InvalidAmount();

        _ensureAssociated(whbar);
        _ensureAssociated(usdc);

        uint256 amountIn = uint256(int256(amountInTinybars));
        uint256 fee = (amountIn * uint256(feeBps)) / MAX_BPS;
        uint256 amountToSwap = amountIn - fee;
        if (amountToSwap == 0) revert InvalidAmount();

        _transferHbarFrom(user, amountIn);

        if (fee > 0) {
            (bool ok, ) = feeRecipient.call{ value: fee }("");
            if (!ok) revert HbarFeeTransferFailed();
        }

        IWHBAR(whbar).deposit{ value: amountToSwap }();

        IERC20(whbar).approve(router, 0);
        if (!IERC20(whbar).approve(router, amountToSwap)) revert TokenTransferFailed();

        address[] memory path = new address[](2);
        path[0] = whbar;
        path[1] = usdc;

        uint256 usdcBefore = IERC20(usdc).balanceOf(address(this));
        ISaucerSwapRouter(router).swapExactTokensForTokens(
            amountToSwap,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );
        uint256 usdcAfter = IERC20(usdc).balanceOf(address(this));
        usdcOut = usdcAfter - usdcBefore;
        if (usdcOut == 0) revert TokenTransferFailed();

        if (!IERC20(usdc).transfer(user, usdcOut)) revert TokenTransferFailed();
        emit SwapExecuted(user, amountIn, usdcOut, fee);
    }

    function _transferHbarFrom(address ownerAccount, uint256 amountTinybars) internal {
        IHederaTokenService.TokenTransferList[] memory tokenTransfers = new IHederaTokenService.TokenTransferList[](0);
        IHederaTokenService.AccountAmount[] memory hbarTransfers = new IHederaTokenService.AccountAmount[](2);
        hbarTransfers[0] = IHederaTokenService.AccountAmount(ownerAccount, -int64(int256(amountTinybars)), true);
        hbarTransfers[1] = IHederaTokenService.AccountAmount(address(this), int64(int256(amountTinybars)), false);
        int64 rc = IHederaTokenService(HTS_PRECOMPILE).cryptoTransfer(tokenTransfers, hbarTransfers);
        if (rc != HTS_SUCCESS) revert HtsError(rc);
    }

    function _ensureAssociated(address token) internal {
        int64 rc = IHederaTokenService(HTS_PRECOMPILE).associateToken(address(this), token);
        if (rc != HTS_SUCCESS && rc != HTS_TOKEN_ALREADY_ASSOCIATED) revert HtsError(rc);
    }

    receive() external payable {}
}

