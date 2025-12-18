import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  tron: {
    fullNode: process.env.TRON_FULL_NODE || 'https://api.trongrid.io',
    solidityNode: process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io',
    eventServer: process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io',
    privateKey: process.env.TRON_PRIVATE_KEY,
  },
};
