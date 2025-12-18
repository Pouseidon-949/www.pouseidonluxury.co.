interface WalletBalance {
    trx: number;
    usdt: number;
}
export declare class TronClient {
    private tronWeb;
    private walletAddress;
    constructor();
    private initTronWeb;
    getAddress(): string;
    createWallet(): Promise<{
        address: string;
        privateKey: string;
    }>;
    getBalance(): Promise<WalletBalance>;
    checkFundingRequirements(): Promise<{
        funded: boolean;
        details: string;
    }>;
    estimateFee(toAddress: string, amount: number): Promise<number>;
    verifySigning(): Promise<boolean>;
}
export {};
//# sourceMappingURL=tronClient.d.ts.map