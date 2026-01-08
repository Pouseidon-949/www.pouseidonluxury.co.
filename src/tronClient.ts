import { TronWeb } from 'tronweb';
import { config } from './config';

// Define types if necessary
interface WalletBalance {
  trx: number;
  usdt: number;
}

export class TronClient {
  private tronWeb: any; // Using any for now to avoid strict typing issues with tronweb definition
  private walletAddress: string = '';

  constructor() {
    this.initTronWeb();
  }

  private initTronWeb() {
    const { fullNode, solidityNode, eventServer, privateKey } = config.tron;
    
    // Initialize TronWeb
    // If private key is not provided, we can still initialize for read-only or generate new
    const headers: any = {};
    if (process.env.TRON_PRO_API_KEY) {
        headers["TRON-PRO-API-KEY"] = process.env.TRON_PRO_API_KEY;
    }

    this.tronWeb = new TronWeb({
      fullHost: fullNode,
      headers: headers,
      privateKey: privateKey,
    });

    if (privateKey) {
      this.walletAddress = this.tronWeb.address.fromPrivateKey(privateKey);
      console.log(`Wallet initialized with address: ${this.walletAddress}`);
    } else {
      console.warn('No private key provided. Wallet functionality will be limited.');
    }
  }

  public getAddress(): string {
    return this.walletAddress;
  }

  public async createWallet(): Promise<{ address: string; privateKey: string }> {
    const account = await this.tronWeb.createAccount();
    return {
      address: account.address.base58,
      privateKey: account.privateKey,
    };
  }

  public async getBalance(): Promise<WalletBalance> {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const trxBalance = await this.tronWeb.trx.getBalance(this.walletAddress);
      
      // USDT is a TRC20 token on TRON. Contract address for USDT on Mainnet:
      const usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      let usdtBalance = 0;

      try {
        const contract = await this.tronWeb.contract().at(usdtContractAddress);
        const balance = await contract.balanceOf(this.walletAddress).call();
        // USDT has 6 decimals
        usdtBalance = parseInt(balance.toString()) / 1_000_000; 
      } catch (error) {
        console.warn('Failed to fetch USDT balance (maybe not on mainnet or contract unreachable):', error);
      }

      return {
        trx: this.tronWeb.fromSun(trxBalance),
        usdt: usdtBalance,
      };
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  public async checkFundingRequirements(): Promise<{ funded: boolean; details: string }> {
    const balance = await this.getBalance();
    const requiredTrx = 12;
    const requiredUsdt = 50;

    const trxOk = balance.trx >= requiredTrx;
    const usdtOk = balance.usdt >= requiredUsdt;

    if (trxOk && usdtOk) {
        return { funded: true, details: 'Wallet meets funding requirements.' };
    } else {
        return { 
            funded: false, 
            details: `Funding missing. Required: 12 TRX, 50 USDT. Current: ${balance.trx} TRX, ${balance.usdt} USDT.` 
        };
    }
  }

  // Estimate Fee for a standard TRC20 transfer (USDT)
  // This is an estimation. TRON fees depend on energy and bandwidth.
  public async estimateFee(toAddress: string, amount: number): Promise<number> {
      // Typically USDT transfer consumes Energy.
      // If the receiver has USDT, it costs less (around 13.5 TRX).
      // If the receiver does not have USDT, it costs more (around 27 TRX).
      // We can't easily calculate exact fee without simulating, but we can provide an estimate.
      
      // Placeholder for actual fee calculation logic if needed.
      // For now, return a safe estimate or calculate based on Energy/Bandwidth.
      return 15; // 15 TRX is a rough estimate for USDT transfer
  }

  public async verifySigning(): Promise<boolean> {
      if (!this.walletAddress) return false;
      
      try {
          // Sign a dummy message
          const message = 'PouseidonBotV2Init';
          const signature = await this.tronWeb.trx.sign(this.tronWeb.toHex(message));
          
          // Verify signature
          // verifyMessage returns boolean if address is provided, or address string if not
          const result = await this.tronWeb.trx.verifyMessage(
              this.tronWeb.toHex(message),
              signature,
              this.walletAddress
          );
          
          return result === true || result === this.walletAddress;
      } catch (error) {
          console.error('Signing verification failed:', error);
          return false;
      }
  }
}
