const Big = require("big.js");
const lib = require("./rgblib");

const u8Max = new Big(255);
const u16Max = new Big(65535);
const u32Max = new Big(4294967295);
const u64Max = new Big(Number.MAX_SAFE_INTEGER);

const i8Min = new Big(-128);
const i8Max = new Big(127);
const i16Min = new Big(-32768);
const i16Max = new Big(32767);
const i32Min = new Big(-2147483648);
const i32Max = new Big(2147483647);
const i64Min = new Big(Number.MIN_SAFE_INTEGER);
const i64Max = new Big(Number.MAX_SAFE_INTEGER);

const f32Min = new Big("1.17549435e-38");
const f32Max = new Big("3.4028235e38");

function isNumberType(type) {
    const numberTypes = [
        "u8",
        "u16",
        "u32",
        "u64",
        "i8",
        "i16",
        "i32",
        "i64",
        "f32",
        "f64",
    ];
    return numberTypes.includes(type);
}

function isTypeSubset(actualType, expectedType) {
    const typeHierarchy = {
        u8: ["u8", "u16", "u32", "u64"],
        u16: ["u16", "u32", "u64"],
        u32: ["u32", "u64"],
        u64: ["u64"],
        i8: ["i8", "i16", "i32", "i64"],
        i16: ["i16", "i32", "i64"],
        i32: ["i32", "i64"],
        i64: ["i64"],
        f32: ["f32", "f64"],
        f64: ["f64"],
        string: ["string"],
        boolean: ["boolean"],
        array: ["array"],
        object: ["object"],
    };
    return (
        typeHierarchy[actualType] &&
        typeHierarchy[actualType].includes(expectedType)
    );
}

function trueTypeOfNumber(obj) {
    let isInteger = true;
    if (obj.includes(".")) {
        isInteger = false;
    }
    let num = Big(obj);

    if (isInteger) {
        // Unsigned integers
        if (num.gte(0) && num.lte(u8Max)) return "u8";
        if (num.gte(0) && num.lte(u16Max)) return "u16";
        if (num.gte(0) && num.lte(u32Max)) return "u32";
        if (num.gte(0) && num.lte(u64Max)) return "u64";

        // Signed integers
        if (num.gte(i8Min) && num.lte(i8Max)) return "i8";
        if (num.gte(i16Min) && num.lte(i16Max)) return "i16";
        if (num.gte(i32Min) && num.lte(i32Max)) return "i32";
        if (num.gte(i64Min) && num.lte(i64Max)) return "i64";
    } else {
        // Floating-point numbers
        if (num.abs().gte(f32Min) && num.abs().lte(f32Max)) return "f32";
        if (num.abs().lte(Number.MAX_VALUE)) return "f64";
    }
    return "number"; // Fallback for unusual numbers
}

function trueTypeOf(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

function validateArrayElements(array, expectedElementType) {
    array.forEach((item, index) => {
        const actualType = trueTypeOf(item);
        if (!isTypeSubset(actualType, expectedElementType)) {
            throw new Error(
                `Array element at index ${index} must be of type ${expectedElementType}, but got ${actualType}`,
            );
        }
    });
}

function validateEnumValues(object, enumValidValues) {
    Object.keys(enumValidValues).forEach((key) => {
        const allowedValues = Object.values(enumValidValues[key]);
        if (!allowedValues.includes(object[key])) {
            throw new Error(
                `${key} is invalid. Expected one of: ${allowedValues.join(", ")}`,
            );
        }
    });
}

function validateTypes(values, expectedTypes) {
    Object.keys(expectedTypes).forEach((key) => {
        if (!(key in values)) {
            throw new Error(`${key} must be defined`);
        }
        const type = expectedTypes[key];
        const isOptional = type.endsWith("?");
        let val = values[key];
        let actualType = trueTypeOf(val);
        const baseType = isOptional ? type.slice(0, -1) : type;

        if (val !== null && isNumberType(baseType)) {
            if (actualType != "string") {
                throw new Error("numbers must be passed as strings");
            }
            actualType = trueTypeOfNumber(val);
        }

        const arrayMatch = baseType.match(/^array\[(.*)\]$/);
        if (arrayMatch) {
            if (actualType !== "array") {
                throw new Error(`${key} must be an array`);
            }
            const elementType = arrayMatch[1];
            validateArrayElements(val, elementType);
        } else if (
            !isTypeSubset(actualType, baseType) &&
            !(isOptional && val === null)
        ) {
            throw new Error(
                `${key} type must be ${baseType}${isOptional ? " or null" : ""}`,
            );
        }
    });
}

exports.AssetSchema = AssetSchema = {
    Nia: "Nia",
    Cfa: "Cfa",
    Uda: "Uda",
};

exports.BitcoinNetwork = BitcoinNetwork = {
    Mainnet: "Mainnet",
    Testnet: "Testnet",
    Signet: "Signet",
    Regtest: "Regtest",
};

exports.DatabaseType = DatabaseType = {
    Sqlite: "Sqlite",
};

exports.dropOnline = function dropOnline(online) {
    lib.free_online(online);
};

exports.generateKeys = async function generateKeys(bitcoinNetwork) {
    validateEnumValues(
        { bitcoinNetwork },
        {
            bitcoinNetwork: BitcoinNetwork,
        },
    );
    return JSON.parse(await lib.rgblib_generate_keys(bitcoinNetwork));
};

exports.restoreKeys = async function (bitcoinNetwork, mnemonic) {
    validateEnumValues(
        { bitcoinNetwork },
        {
            bitcoinNetwork: BitcoinNetwork,
        },
    );
    validateTypes({ mnemonic }, { mnemonic: "string" });
    return JSON.parse(await lib.rgblib_restore_keys(bitcoinNetwork, mnemonic));
};

exports.WalletData = class WalletData {
    constructor(walletData) {
        const expectedTypes = {
            dataDir: "string",
            bitcoinNetwork: "string",
            databaseType: "string",
            pubkey: "string",
            maxAllocationsPerUtxo: "u32",
            vanillaKeychain: "u8?",
        };
        validateTypes(walletData, expectedTypes);
        validateEnumValues(walletData, {
            bitcoinNetwork: BitcoinNetwork,
            databaseType: DatabaseType,
        });
        return walletData;
    }
};

exports.Wallet = class Wallet {
    constructor(wallet) {
        this.wallet = wallet;
    }

    static async createInstance(walletData) {
        const wallet = await lib.rgblib_new_wallet(JSON.stringify(walletData));
        return new Wallet(wallet);
    }

    drop() {
        lib.free_wallet(this.wallet);
        this.wallet = null;
    }

    async blindReceive(
        assetId,
        amount,
        durationSeconds,
        transportEndpoints,
        minConfirmations,
    ) {
        const params = {
            assetId,
            amount,
            durationSeconds,
            transportEndpoints,
            minConfirmations,
        };
        const expectedTypes = {
            assetId: "string?",
            amount: "u64?",
            durationSeconds: "u32?",
            transportEndpoints: "array[string]",
            minConfirmations: "u8",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_blind_receive(
                this.wallet,
                assetId,
                amount,
                durationSeconds,
                JSON.stringify(transportEndpoints),
                minConfirmations,
            ),
        );
    }

    async createUtxos(online, upTo, num, size, feeRate, skipSync) {
        const params = { online, upTo, num, size, feeRate, skipSync };
        const expectedTypes = {
            online: "object",
            upTo: "boolean",
            num: "u8?",
            size: "u32?",
            feeRate: "f32",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return await lib.rgblib_create_utxos(
            this.wallet,
            online,
            upTo,
            num,
            size,
            feeRate,
            skipSync,
        );
    }

    async getAddress() {
        return await lib.rgblib_get_address(this.wallet);
    }

    async getAssetBalance(assetId) {
        const params = { assetId };
        const expectedTypes = {
            assetId: "string",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_get_asset_balance(this.wallet, assetId),
        );
    }

    async getBtcBalance(online, skipSync) {
        const params = { online, skipSync };
        const expectedTypes = {
            online: "object?",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_get_btc_balance(this.wallet, online, skipSync),
        );
    }

    async getFeeEstimation(online, blocks) {
        const params = { online, blocks };
        const expectedTypes = {
            online: "object",
            blocks: "u16",
        };
        validateTypes(params, expectedTypes);
        return await lib.rgblib_get_fee_estimation(this.wallet, online, blocks);
    }

    async goOnline(skipConsistencyCheck, electrumUrl) {
        const params = { skipConsistencyCheck, electrumUrl };
        const expectedTypes = {
            skipConsistencyCheck: "boolean",
            electrumUrl: "string",
        };
        validateTypes(params, expectedTypes);
        return await lib.rgblib_go_online(
            this.wallet,
            skipConsistencyCheck,
            electrumUrl,
        );
    }

    async issueAssetCFA(online, name, details, precision, amounts, filePath) {
        const params = {
            online,
            name,
            details,
            precision,
            amounts,
            filePath,
        };
        const expectedTypes = {
            online: "object",
            name: "string",
            details: "string?",
            precision: "u8",
            amounts: "array[string]",
            filePath: "string?",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_issue_asset_cfa(
                this.wallet,
                online,
                name,
                details,
                precision,
                JSON.stringify(amounts),
                filePath,
            ),
        );
    }

    async issueAssetNIA(online, ticker, name, precision, amounts) {
        const params = {
            online,
            ticker,
            name,
            precision,
            amounts,
        };
        const expectedTypes = {
            online: "object",
            name: "string",
            precision: "u8",
            amounts: "array[string]",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_issue_asset_nia(
                this.wallet,
                online,
                ticker,
                name,
                precision,
                JSON.stringify(amounts),
            ),
        );
    }

    async issueAssetUDA(
        online,
        ticker,
        name,
        details,
        precision,
        mediaFilePath,
        attachmentsFilePaths,
    ) {
        const params = {
            online,
            ticker,
            name,
            details,
            precision,
            mediaFilePath,
            attachmentsFilePaths,
        };
        const expectedTypes = {
            online: "object",
            ticker: "string",
            name: "string",
            details: "string?",
            precision: "u8",
            mediaFilePath: "string?",
            attachmentsFilePaths: "array[string]",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_issue_asset_uda(
                this.wallet,
                online,
                ticker,
                name,
                details,
                precision,
                mediaFilePath,
                JSON.stringify(attachmentsFilePaths),
            ),
        );
    }

    async listAssets(filterAssetSchemas) {
        const params = {
            filterAssetSchemas,
        };
        const expectedTypes = {
            filterAssetSchemas: "array[string]",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_list_assets(
                this.wallet,
                JSON.stringify(filterAssetSchemas),
            ),
        );
    }

    async listTransactions(online, skipSync) {
        const params = { online, skipSync };
        const expectedTypes = {
            online: "object",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_list_transactions(this.wallet, online, skipSync),
        );
    }

    async listTransfers(assetId) {
        const params = {
            assetId,
        };
        const expectedTypes = {
            assetId: "string",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_list_transfers(this.wallet, assetId),
        );
    }

    async listUnspents(online, settledOnly, skipSync) {
        const params = {
            online,
            settledOnly,
            skipSync,
        };
        const expectedTypes = {
            online: "object",
            settledOnly: "boolean",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_list_unspents(
                this.wallet,
                online,
                settledOnly,
                skipSync,
            ),
        );
    }

    async refresh(online, assetId, filter, skipSync) {
        const params = {
            online,
            assetId,
            filter,
            skipSync,
        };
        const expectedTypes = {
            online: "object",
            assetId: "string?",
            filter: "array[string]",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_refresh(
                this.wallet,
                online,
                assetId,
                JSON.stringify(filter),
                skipSync,
            ),
        );
    }

    async send(
        online,
        recipientMap,
        donation,
        feeRate,
        minConfirmations,
        skipSync,
    ) {
        const params = {
            online,
            recipientMap,
            donation,
            feeRate,
            minConfirmations,
            skipSync,
        };
        const expectedTypes = {
            online: "object",
            recipientMap: "object",
            donation: "boolean",
            feeRate: "f32",
            minConfirmations: "u8",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_send(
                this.wallet,
                online,
                JSON.stringify(recipientMap),
                donation,
                feeRate,
                minConfirmations,
                skipSync,
            ),
        );
    }

    async sendBtc(online, address, amount, feeRate, skipSync) {
        const params = {
            online,
            address,
            amount,
            feeRate,
            skipSync,
        };
        const expectedTypes = {
            online: "object",
            address: "string",
            amount: "u64",
            feeRate: "f32",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return await lib.rgblib_send_btc(
            this.wallet,
            online,
            address,
            amount,
            feeRate,
            skipSync,
        );
    }

    async sync(online) {
        const params = { online };
        const expectedTypes = {
            online: "object",
        };
        validateTypes(params, expectedTypes);
        await lib.rgblib_sync(this.wallet, online);
    }

    async witnessReceive(
        assetId,
        amount,
        durationSeconds,
        transportEndpoints,
        minConfirmations,
    ) {
        const params = {
            assetId,
            amount,
            durationSeconds,
            transportEndpoints,
            minConfirmations,
        };
        const expectedTypes = {
            assetId: "string?",
            amount: "u64?",
            durationSeconds: "u32?",
            transportEndpoints: "array[string]",
            minConfirmations: "u8",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            await lib.rgblib_witness_receive(
                this.wallet,
                assetId,
                amount,
                durationSeconds,
                JSON.stringify(transportEndpoints),
                minConfirmations,
            ),
        );
    }
};
