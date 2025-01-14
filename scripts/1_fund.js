const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json');
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // Replace if testing on a local network
const UNLOCKED_ACCOUNT = '0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3'; // Replace with a valid unlocked account

module.exports = async function (callback) {
    try {
        console.log("Starting WETH transfer...\n");

        const [deployer, sniper] = await web3.eth.getAccounts();

        console.log(`Deployer Address: ${deployer}`);
        console.log(`Sniper Address: ${sniper}`);
        console.log(`Unlocked Account: ${UNLOCKED_ACCOUNT}\n`);

        const WETH = new web3.eth.Contract(IERC20.abi, WETH_ADDRESS);

        // Fetch unlocked account balance
        const unlockedBalance = await WETH.methods.balanceOf(UNLOCKED_ACCOUNT).call();
        console.log(`Unlocked Account WETH Balance: ${web3.utils.fromWei(unlockedBalance, 'ether')} WETH`);

        if (web3.utils.toBN(unlockedBalance).isZero()) {
            throw new Error("UNLOCKED_ACCOUNT has no WETH balance.");
        }

        // Set the amount dynamically based on balance
        const amountToTransfer = web3.utils.toBN(unlockedBalance).lt(web3.utils.toBN(web3.utils.toWei('0.01', 'ether')))
            ? unlockedBalance
            : web3.utils.toWei('0.01', 'ether');

        console.log(`Amount to Transfer: ${web3.utils.fromWei(amountToTransfer, 'ether')} WETH`);

        // Approve the transfer
        console.log("Approving WETH transfer from UNLOCKED_ACCOUNT...");
        await WETH.methods.approve(deployer, amountToTransfer).send({ from: UNLOCKED_ACCOUNT });

        // Transfer WETH to deployer
        console.log("Transferring WETH to deployer...");
        await WETH.methods.transfer(deployer, amountToTransfer).send({ from: UNLOCKED_ACCOUNT });

        // Transfer WETH to sniper
        console.log("Transferring WETH to sniper...");
        await WETH.methods.transfer(sniper, amountToTransfer).send({ from: UNLOCKED_ACCOUNT });

        // Check balances after transfer
        const deployerBalance = await WETH.methods.balanceOf(deployer).call();
        const sniperBalance = await WETH.methods.balanceOf(sniper).call();

        console.log(`WETH amount in deployer: ${web3.utils.fromWei(deployerBalance, 'ether')} WETH`);
        console.log(`WETH amount in sniper: ${web3.utils.fromWei(sniperBalance, 'ether')} WETH\n`);

        console.log("WETH transfer complete.");
        callback();
    } catch (error) {
        console.error("Error during WETH transfer:", error.message);
        callback(error);
    }
};
