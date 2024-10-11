const lib = require("./rgblib");

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

function trueTypeOf(obj) {
    if (typeof obj === "number") {
        if (Number.isInteger(obj)) {
            // Unsigned integers
            if (obj >= 0 && obj <= 255) return "u8";
            if (obj >= 0 && obj <= 65535) return "u16";
            if (obj >= 0 && obj <= 4294967295) return "u32";
            if (obj >= 0 && obj <= Number.MAX_SAFE_INTEGER) return "u64";

            // Signed integers
            if (obj >= -128 && obj <= 127) return "i8";
            if (obj >= -32768 && obj <= 32767) return "i16";
            if (obj >= -2147483648 && obj <= 2147483647) return "i32";
            if (
                obj >= Number.MIN_SAFE_INTEGER &&
                obj <= Number.MAX_SAFE_INTEGER
            )
                return "i64";
        } else {
            // Floating-point numbers
            if (
                Math.abs(obj) <= 1.17549435e-38 ||
                Math.abs(obj) <= 3.4028235e38
            )
                return "f32"; // 32-bit float
            if (
                Math.abs(obj) <= Number.MIN_VALUE ||
                Math.abs(obj) <= Number.MAX_VALUE
            )
                return "f64"; // 64-bit float
        }
        return "number"; // fallback for unusual numbers
    }
    return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
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

function validateProperties(object, requiredProperties) {
    requiredProperties.forEach((prop) => {
        if (!(prop in object) || object[prop] == null) {
            throw new Error(`${prop} must be defined`);
        }
    });
}

function validateTypes(values, expectedTypes) {
    Object.keys(expectedTypes).forEach((key) => {
        const type = expectedTypes[key];
        const isOptional = type.endsWith("?");
        const actualType = trueTypeOf(values[key]);
        const baseType = isOptional ? type.slice(0, -1) : type;

        if (
            !isTypeSubset(actualType, baseType) &&
            !(isOptional && values[key] === null)
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

exports.generateKeys = function generateKeys(bitcoinNetwork) {
    validateEnumValues(
        { bitcoinNetwork },
        {
            bitcoinNetwork: BitcoinNetwork,
        },
    );
    return JSON.parse(lib.rgblib_generate_keys(bitcoinNetwork));
};

exports.restoreKeys = function (bitcoinNetwork, mnemonic) {
    validateEnumValues(
        { bitcoinNetwork },
        {
            bitcoinNetwork: BitcoinNetwork,
        },
    );
    validateTypes({ mnemonic }, { mnemonic: "string" });
    return JSON.parse(lib.rgblib_restore_keys(bitcoinNetwork, mnemonic));
};

exports.WalletData = class WalletData {
    constructor(walletData) {
        validateProperties(walletData, [
            "dataDir",
            "bitcoinNetwork",
            "databaseType",
            "pubkey",
            "maxAllocationsPerUtxo",
        ]);
        validateEnumValues(walletData, {
            bitcoinNetwork: BitcoinNetwork,
            databaseType: DatabaseType,
        });
        return walletData;
    }
};

exports.Wallet = class Wallet {
    constructor(walletData) {
        this.wallet = lib.rgblib_new_wallet(JSON.stringify(walletData));
    }

    drop() {
        lib.free_wallet(this.wallet);
        this.wallet = null;
    }

    blindReceive(
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
            transportEndpoints: "array",
            minConfirmations: "u8",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            lib.rgblib_blind_receive(
                this.wallet,
                assetId,
                JSON.stringify(amount),
                JSON.stringify(durationSeconds),
                JSON.stringify(transportEndpoints),
                minConfirmations,
            ),
        );
    }

    createUtxos(online, upTo, num, size, feeRate, skipSync) {
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
        return lib.rgblib_create_utxos(
            this.wallet,
            online,
            upTo,
            JSON.stringify(num),
            JSON.stringify(size),
            feeRate,
            skipSync,
        );
    }

    getAddress() {
        return lib.rgblib_get_address(this.wallet);
    }

    getAssetBalance(assetId) {
        const params = { assetId };
        const expectedTypes = {
            assetId: "string",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(lib.rgblib_get_asset_balance(this.wallet, assetId));
    }

    getBtcBalance(online, skipSync) {
        const params = { online, skipSync };
        const expectedTypes = {
            online: "object?",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return lib.rgblib_get_btc_balance(this.wallet, online, skipSync);
    }

    getFeeEstimation(online, blocks) {
        const params = { online, blocks };
        const expectedTypes = {
            online: "object",
            blocks: "u16",
        };
        validateTypes(params, expectedTypes);
        return lib.rgblib_get_fee_estimation(this.wallet, online, blocks);
    }

    goOnline(skipConsistencyCheck, electrumUrl) {
        const params = { skipConsistencyCheck, electrumUrl };
        const expectedTypes = {
            skipConsistencyCheck: "boolean",
            electrumUrl: "string",
        };
        validateTypes(params, expectedTypes);
        return lib.rgblib_go_online(
            this.wallet,
            skipConsistencyCheck,
            electrumUrl,
        );
    }

    issueAssetCFA(online, name, details, precision, amounts, filePath) {
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
            amounts: "array",
            filePath: "string?",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            lib.rgblib_issue_asset_cfa(
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

    issueAssetNIA(online, ticker, name, precision, amounts) {
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
            amounts: "array",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            lib.rgblib_issue_asset_nia(
                this.wallet,
                online,
                ticker,
                name,
                precision,
                JSON.stringify(amounts),
            ),
        );
    }

    issueAssetUDA(
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
            attachmentsFilePaths: "array",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            lib.rgblib_issue_asset_uda(
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

    listAssets(filterAssetSchemas) {
        const params = {
            filterAssetSchemas,
        };
        const expectedTypes = {
            filterAssetSchemas: "array",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            lib.rgblib_list_assets(
                this.wallet,
                JSON.stringify(filterAssetSchemas),
            ),
        );
    }

    listTransactions(online, skipSync) {
        const params = { online, skipSync };
        const expectedTypes = {
            online: "object",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            lib.rgblib_list_transactions(this.wallet, online, skipSync),
        );
    }

    listTransfers(assetId) {
        const params = {
            assetId,
        };
        const expectedTypes = {
            assetId: "string",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(lib.rgblib_list_transfers(this.wallet, assetId));
    }

    listUnspents(online, settledOnly, skipSync) {
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
            lib.rgblib_list_unspents(
                this.wallet,
                online,
                settledOnly,
                skipSync,
            ),
        );
    }

    refresh(online, assetId, filter, skipSync) {
        const params = {
            online,
            assetId,
            filter,
            skipSync,
        };
        const expectedTypes = {
            online: "object",
            assetId: "string?",
            filter: "array",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            lib.rgblib_refresh(
                this.wallet,
                online,
                assetId,
                JSON.stringify(filter),
                skipSync,
            ),
        );
    }

    send(online, recipientMap, donation, feeRate, minConfirmations, skipSync) {
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
            lib.rgblib_send(
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

    sync(online) {
        const params = { online };
        const expectedTypes = {
            online: "object",
        };
        validateTypes(params, expectedTypes);
        lib.rgblib_sync(this.wallet, online);
    }

    witnessReceive(
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
            transportEndpoints: "array",
            minConfirmations: "u8",
        };
        validateTypes(params, expectedTypes);
        return JSON.parse(
            lib.rgblib_blind_receive(
                this.wallet,
                assetId,
                JSON.stringify(amount),
                JSON.stringify(durationSeconds),
                JSON.stringify(transportEndpoints),
                minConfirmations,
            ),
        );
    }
};
