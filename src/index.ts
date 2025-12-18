import { TronClient } from './tronClient';
import { config } from './config';

async function main() {
  console.log('Initializing Pouseidon Bot v2 - TRON Module...');
  
  const client = new TronClient();
  const address = client.getAddress();

  if (!address) {
    console.log('No private key found in configuration.');
    console.log('Generating a new wallet for setup purposes...');
    const newWallet = await client.createWallet();
    console.log('NEW WALLET GENERATED:');
    console.log(`Address: ${newWallet.address}`);
    console.log(`Private Key: ${newWallet.privateKey}`);
    console.log('Please save these credentials to your .env file as TRON_PRIVATE_KEY.');
    return;
  }

  console.log(`Connected with wallet: ${address}`);

  try {
    // 1. Verify Connection & Balance
    console.log('Checking balance...');
    const balance = await client.getBalance();
    console.log(`Balance: ${balance.trx} TRX, ${balance.usdt} USDT`);

    // 2. Check Funding
    console.log('Verifying funding requirements (50 USDT + 12 TRX)...');
    const fundingStatus = await client.checkFundingRequirements();
    console.log(`Funding Status: ${fundingStatus.funded ? 'OK' : 'INSUFFICIENT'}`);
    if (!fundingStatus.funded) {
        console.log(fundingStatus.details);
    }

    // 3. Verify Transaction Signing
    console.log('Verifying transaction signing capability...');
    const canSign = await client.verifySigning();
    if (canSign) {
        console.log('SUCCESS: Wallet can sign transactions.');
    } else {
        console.error('FAILURE: Wallet cannot sign transactions.');
    }

    // 4. Fee Management (Example)
    console.log('Estimating fee for standard transaction...');
    // Dummy address for estimation
    const fee = await client.estimateFee('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', 10); 
    console.log(`Estimated Fee: ${fee} TRX`);

    console.log('TRON initialization complete. Ready for trading engine integration.');

  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

main();
