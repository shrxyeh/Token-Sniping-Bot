// Initiate Web3 connection
require('dotenv').config();

const Web3 = require('web3');
const web3 = new Web3('ws://127.0.0.1:7545'); // Replace with your WebSocket endpoint (e.g., Alchemy/Infura for mainnet)

const IUniswapV2Factory = require('@uniswap/v2-core/build/IUniswapV2Factory.json');
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json');
const IUniswapV2Pair = require('@uniswap/v2-core/build/IUniswapV2Pair.json');
const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json');

const uFactoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const uRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

const uFactory = new web3.eth.Contract(IUniswapV2Factory.abi, uFactoryAddress);
const uRouter = new web3.eth.Contract(IUniswapV2Router02.abi, uRouterAddress);
const WETH = new web3.eth.Contract(IERC20.abi, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');

const AMOUNT = '0.25'; // Amount of WETH to spend on new tokens
const SLIPPAGE = 0.05; // 5% slippage tolerance

const main = async () => {
    const [deployer, sniper] = await web3.eth.getAccounts();

    console.log('Listening for new pairs on Uniswap...\n');

    // Listen for PairCreated events
    uFactory.events.PairCreated({}, async (error, event) => {
        if (error) {
            console.error('Error listening to PairCreated events:', error);
            return;
        }

        console.log('New pair detected...\n');

        const { token0, token1, pair } = event.returnValues;
        console.log(`Token0: ${token0}`);
        console.log(`Token1: ${token1}`);
        console.log(`Pair Address: ${pair}\n`);

        // Check if WETH is involved in the pair
        let path = [];

        if (token0 === WETH.options.address) {
            path = [token0, token1];
        } else if (token1 === WETH.options.address) {
            path = [token1, token0];
        } else {
            console.log('Pair does not involve WETH. Skipping...\n');
            return;
        }

        const uPair = new web3.eth.Contract(IUniswapV2Pair.abi, pair);
        const token = new web3.eth.Contract(IERC20.abi, path[1]); // Token we want to buy

        console.log('Checking liquidity...\n');

        // Fetch reserves
        const reserves = await uPair.methods.getReserves().call();
        if (reserves[0] === '0' && reserves[1] === '0') {
            console.log('Token has no liquidity. Skipping...\n');
            return;
        }

        console.log('Swapping WETH for new token...\n');

        try {
            const amountIn = web3.utils.toWei(AMOUNT, 'ether');
            const amountsOut = await uRouter.methods.getAmountsOut(amountIn, path).call();
            const amountOutMin = String(amountsOut[1] - (amountsOut[1] * SLIPPAGE));
            const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10-minute deadline

            await WETH.methods.approve(uRouter.options.address, amountIn).send({ from: sniper });

            const gasEstimate = await uRouter.methods
                .swapExactTokensForTokens(amountIn, amountOutMin, path, sniper, deadline)
                .estimateGas({ from: sniper });

            await uRouter.methods
                .swapExactTokensForTokens(amountIn, amountOutMin, path, sniper, deadline)
                .send({ from: sniper, gas: gasEstimate });

            console.log('Swap successful!\n');

            // Fetch balance of new token
            const tokenSymbol = await token.methods.symbol().call();
            const tokenBalance = await token.methods.balanceOf(sniper).call();

            console.log(`Successfully swapped ${AMOUNT} WETH for ${web3.utils.fromWei(tokenBalance, 'ether')} ${tokenSymbol}\n`);
        } catch (err) {
            console.error('Error occurred during swap:', err);
        }

        console.log('Listening for new pairs...\n');
    });
};

main().catch((err) => console.error('Error in main execution:', err));
