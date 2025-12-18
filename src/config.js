"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
exports.config = {
    tron: {
        fullNode: process.env.TRON_FULL_NODE || 'http://YOUR_VPS_IP:8090/jsonrpc',
        solidityNode: process.env.TRON_SOLIDITY_NODE || 'http://YOUR_VPS_IP:8090/jsonrpc',
        eventServer: process.env.TRON_EVENT_SERVER || 'http://YOUR_VPS_IP:8090/jsonrpc',
        privateKey: process.env.TRON_PRIVATE_KEY,
    },
};
//# sourceMappingURL=config.js.map