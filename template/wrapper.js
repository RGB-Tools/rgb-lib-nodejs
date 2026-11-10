const lib = require("./rgblib");

// integers are BigInt, both as arguments and in the results
const integerRanges = {
    u8: [0n, 255n],
    u16: [0n, 65535n],
    u32: [0n, 4294967295n],
    u64: [0n, 18446744073709551615n],
    i8: [-128n, 127n],
    i16: [-32768n, 32767n],
    i32: [-2147483648n, 2147483647n],
    i64: [-9223372036854775808n, 9223372036854775807n],
};

function isIntegerType(type) {
    return type in integerRanges;
}

function fitsIntegerType(value, type) {
    const [min, max] = integerRanges[type];
    return typeof value === "bigint" && value >= min && value <= max;
}

function checkInteger(value, type, name) {
    if (!fitsIntegerType(value, type)) {
        throw new Error(`${name} must be a BigInt in the ${type} range`);
    }
}

function trueTypeOf(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

function validateArrayElements(array, expectedElementType) {
    array.forEach((item, index) => {
        if (isIntegerType(expectedElementType)) {
            checkInteger(
                item,
                expectedElementType,
                `Array element at index ${index}`,
            );
            return;
        }
        const actualType = trueTypeOf(item);
        if (actualType !== expectedElementType) {
            throw new Error(
                `Array element at index ${index} must be of type ${expectedElementType}, but got ${actualType}`,
            );
        }
    });
}

function validateEnumValues(object, enumValidValues) {
    Object.keys(enumValidValues).forEach((key) => {
        const allowedValues = Object.values(enumValidValues[key]);
        const value = object[key];
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (!allowedValues.includes(item)) {
                    throw new Error(
                        `${key}[${index}] is invalid. Expected one of: ${allowedValues.join(", ")}`,
                    );
                }
            });
        } else if (!allowedValues.includes(value)) {
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
        const val = values[key];
        const actualType = trueTypeOf(val);
        const baseType = isOptional ? type.slice(0, -1) : type;

        if (isIntegerType(baseType)) {
            if (
                !(isOptional && val === null) &&
                !fitsIntegerType(val, baseType)
            ) {
                throw new Error(
                    `${key} must be a BigInt in the ${baseType} range${isOptional ? " or null" : ""}`,
                );
            }
            return;
        }

        const arrayMatch = baseType.match(/^array\[(.*)\]$/);
        if (arrayMatch) {
            if (actualType !== "array") {
                throw new Error(`${key} must be an array`);
            }
            const elementType = arrayMatch[1];
            validateArrayElements(val, elementType);
        } else if (actualType !== baseType && !(isOptional && val === null)) {
            throw new Error(
                `${key} type must be ${baseType}${isOptional ? " or null" : ""}`,
            );
        }
    });
}

// an assignment is either the name of a variant without value or an object with
// a single variant holding a u64 value
function validateAssignment(assignment, name) {
    if (typeof assignment === "string") {
        if (!["NonFungible", "Any"].includes(assignment)) {
            throw new Error(`${name} must be NonFungible or Any if a string`);
        }
        return;
    }
    if (trueTypeOf(assignment) !== "object") {
        throw new Error(`${name} must be a string or an object`);
    }
    const variants = Object.keys(assignment);
    if (
        variants.length !== 1 ||
        !["Fungible", "InflationRight"].includes(variants[0])
    ) {
        throw new Error(
            `${name} must have a single Fungible or InflationRight key`,
        );
    }
    checkInteger(assignment[variants[0]], "u64", `${name}.${variants[0]}`);
}

// check the assignments and the integers of the recipients
function validateRecipientMap(recipientMap) {
    Object.entries(recipientMap).forEach(([assetId, recipients]) => {
        if (!Array.isArray(recipients)) {
            throw new Error(`recipientMap.${assetId} must be an array`);
        }
        recipients.forEach((recipient, index) => {
            const name = `recipientMap.${assetId}[${index}]`;
            if (trueTypeOf(recipient) !== "object") {
                throw new Error(`${name} must be an object`);
            }
            validateAssignment(recipient.assignment, `${name}.assignment`);
            const witnessData = recipient.witnessData;
            if (witnessData === null || witnessData === undefined) {
                return;
            }
            checkInteger(
                witnessData.amountSat,
                "u64",
                `${name}.witnessData.amountSat`,
            );
            const blinding = witnessData.blinding;
            if (blinding !== null && blinding !== undefined) {
                checkInteger(blinding, "u64", `${name}.witnessData.blinding`);
            }
        });
    });
}

// whether a value of a result is a byte array: the data of an embedded media
// or the proof of a proof of reserves
function isByteArray(key, value, holder) {
    return (
        Array.isArray(value) &&
        ((key === "data" && "mime" in holder) ||
            (key === "proof" && "utxo" in holder))
    );
}

// parse a JSON result, returning all the integers as BigInt, except for the
// bytes of byte arrays, which stay numbers
function parseJson(raw) {
    return JSON.parse(raw, function (key, value, context) {
        if (typeof value === "number" && /^-?\d+$/.test(context.source)) {
            return BigInt(context.source);
        }
        if (isByteArray(key, value, this)) {
            return value.map(Number);
        }
        return value;
    });
}

// serialize to JSON, writing BigInt values as numbers
function stringifyJson(value) {
    return JSON.stringify(value, (key, val) =>
        typeof val === "bigint" ? JSON.rawJSON(val.toString()) : val,
    );
}

// integers are passed to the C++ library as strings
function serializeInteger(value) {
    return value === null || value === undefined ? null : value.toString();
}

function parseOnline(raw) {
    const online = parseJson(raw);
    if (typeof online?.id !== "bigint") {
        throw new Error("Invalid online object");
    }
    return { id: online.id };
}

function serializeOnline(online) {
    if (online === null || online === undefined) {
        return null;
    }
    checkInteger(online.id, "u64", "online.id");
    return `{"id":${online.id}}`;
}

exports.AssetSchema = AssetSchema = {
    Nia: "Nia",
    Cfa: "Cfa",
    Uda: "Uda",
};

exports.BitcoinNetwork = BitcoinNetwork = {
    Mainnet: "Mainnet",
    Testnet: "Testnet",
    Testnet4: "Testnet4",
    Signet: "Signet",
    SignetCustom: "SignetCustom",
    Regtest: "Regtest",
};

exports.DatabaseType = DatabaseType = {
    Sqlite: "Sqlite",
};

exports.SyncKeychain = SyncKeychain = {
    Colored: "Colored",
};

exports.SyncStrategy = SyncStrategy = {
    FullScan: "FullScan",
    FullSync: "FullSync",
    FastSync: "FastSync",
};

exports.WitnessVersion = WitnessVersion = {
    SegWitV0: "SegWitV0",
    Taproot: "Taproot",
};

exports.generateKeys = function generateKeys(bitcoinNetwork, witnessVersion) {
    validateEnumValues(
        { bitcoinNetwork, witnessVersion },
        {
            bitcoinNetwork: BitcoinNetwork,
            witnessVersion: WitnessVersion,
        },
    );
    return parseJson(lib.rgblib_generate_keys(bitcoinNetwork, witnessVersion));
};

exports.invoiceData = function invoiceData(invoiceString) {
    validateTypes({ invoiceString }, { invoiceString: "string" });
    return parseJson(lib.rgblib_invoice_data(invoiceString));
};

exports.restoreBackup = function (backupPath, password, targetDir) {
    const params = { backupPath, password, targetDir };
    const expectedTypes = {
        backupPath: "string",
        password: "string",
        targetDir: "string",
    };
    validateTypes(params, expectedTypes);
    lib.rgblib_restore_backup(backupPath, password, targetDir);
};

exports.restoreKeys = function (bitcoinNetwork, mnemonic, witnessVersion) {
    validateEnumValues(
        { bitcoinNetwork, witnessVersion },
        {
            bitcoinNetwork: BitcoinNetwork,
            witnessVersion: WitnessVersion,
        },
    );
    validateTypes({ mnemonic }, { mnemonic: "string" });
    return parseJson(
        lib.rgblib_restore_keys(bitcoinNetwork, mnemonic, witnessVersion),
    );
};

exports.SinglesigKeys = class SinglesigKeys {
    constructor(singlesigKeys) {
        const expectedTypes = {
            accountXpubVanilla: "string",
            accountXpubColored: "string",
            vanillaKeychain: "u8?",
            masterFingerprint: "string",
            mnemonic: "string?",
        };
        validateTypes(singlesigKeys, expectedTypes);
        return singlesigKeys;
    }
};

exports.WalletData = class WalletData {
    constructor(walletData) {
        const expectedTypes = {
            dataDir: "string",
            bitcoinNetwork: "string",
            databaseType: "string",
            maxAllocationsPerUtxo: "u32",
            supportedSchemas: "array[string]",
        };
        validateTypes(walletData, expectedTypes);
        validateEnumValues(walletData, {
            bitcoinNetwork: BitcoinNetwork,
            databaseType: DatabaseType,
            supportedSchemas: AssetSchema,
        });
        return walletData;
    }
};

exports.Wallet = class Wallet {
    constructor(walletData, singlesigKeys) {
        this.wallet = lib.rgblib_new_wallet(
            stringifyJson(walletData),
            stringifyJson(singlesigKeys),
        );
    }

    drop() {
        lib.free_wallet(this.wallet);
        this.wallet = null;
    }

    backup(backupPath, password) {
        const params = { backupPath, password };
        const expectedTypes = {
            backupPath: "string",
            password: "string",
        };
        validateTypes(params, expectedTypes);
        lib.rgblib_backup(this.wallet, backupPath, password);
    }

    backupInfo() {
        return parseJson(lib.rgblib_backup_info(this.wallet));
    }

    blindReceive(
        assetId,
        assignment,
        expirationTimestamp,
        transportEndpoints,
        minConfirmations,
    ) {
        const params = {
            assetId,
            assignment,
            expirationTimestamp,
            transportEndpoints,
            minConfirmations,
        };
        const expectedTypes = {
            assetId: "string?",
            expirationTimestamp: "u64",
            transportEndpoints: "array[string]",
            minConfirmations: "u8",
        };
        validateTypes(params, expectedTypes);
        validateAssignment(assignment, "assignment");
        return parseJson(
            lib.rgblib_blind_receive(
                this.wallet,
                assetId,
                stringifyJson(assignment),
                serializeInteger(expirationTimestamp),
                stringifyJson(transportEndpoints),
                serializeInteger(minConfirmations),
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
            feeRate: "u64",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_create_utxos(
                this.wallet,
                serializeOnline(online),
                upTo,
                serializeInteger(num),
                serializeInteger(size),
                serializeInteger(feeRate),
                skipSync,
            ),
        );
    }

    createUtxosBegin(online, upTo, num, size, feeRate, skipSync, dryRun) {
        const params = { online, upTo, num, size, feeRate, skipSync, dryRun };
        const expectedTypes = {
            online: "object",
            upTo: "boolean",
            num: "u8?",
            size: "u32?",
            feeRate: "u64",
            skipSync: "boolean",
            dryRun: "boolean",
        };
        validateTypes(params, expectedTypes);
        return lib.rgblib_create_utxos_begin(
            this.wallet,
            serializeOnline(online),
            upTo,
            serializeInteger(num),
            serializeInteger(size),
            serializeInteger(feeRate),
            skipSync,
            dryRun,
        );
    }

    createUtxosEnd(online, signedPsbt) {
        const params = { online, signedPsbt };
        const expectedTypes = {
            online: "object",
            signedPsbt: "string",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_create_utxos_end(
                this.wallet,
                serializeOnline(online),
                signedPsbt,
            ),
        );
    }

    deleteTransfers(batchTransferIdx, noAssetOnly) {
        const params = {
            batchTransferIdx,
            noAssetOnly,
        };
        const expectedTypes = {
            batchTransferIdx: "i32?",
            noAssetOnly: "boolean",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_delete_transfers(
                this.wallet,
                serializeInteger(batchTransferIdx),
                noAssetOnly,
            ),
        );
    }

    failTransfers(online, batchTransferIdx, noAssetOnly, skipSync) {
        const params = {
            online,
            batchTransferIdx,
            noAssetOnly,
            skipSync,
        };
        const expectedTypes = {
            online: "object",
            batchTransferIdx: "i32?",
            noAssetOnly: "boolean",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_fail_transfers(
                this.wallet,
                serializeOnline(online),
                serializeInteger(batchTransferIdx),
                noAssetOnly,
                skipSync,
            ),
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
        return parseJson(lib.rgblib_get_asset_balance(this.wallet, assetId));
    }

    getAssetMetadata(assetId) {
        const params = { assetId };
        const expectedTypes = {
            assetId: "string",
        };
        validateTypes(params, expectedTypes);
        return parseJson(lib.rgblib_get_asset_metadata(this.wallet, assetId));
    }

    getBtcBalance(online, skipSync) {
        const params = { online, skipSync };
        const expectedTypes = {
            online: "object?",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_get_btc_balance(
                this.wallet,
                serializeOnline(online),
                skipSync,
            ),
        );
    }

    getFeeEstimation(online, blocks) {
        const params = { online, blocks };
        const expectedTypes = {
            online: "object",
            blocks: "u16",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_get_fee_estimation(
                this.wallet,
                serializeOnline(online),
                serializeInteger(blocks),
            ),
        );
    }

    goOnline(onlineOptions) {
        const params = { onlineOptions };
        const expectedTypes = {
            onlineOptions: "object",
        };
        validateTypes(params, expectedTypes);
        validateTypes(onlineOptions, {
            indexerUrl: "string",
            skipConsistencyCheck: "boolean",
            vanillaSyncLookback: "u32",
        });
        return parseOnline(
            lib.rgblib_go_online(this.wallet, stringifyJson(onlineOptions)),
        );
    }

    issueAssetCFA(name, details, precision, amounts, filePath) {
        const params = {
            name,
            details,
            precision,
            amounts,
            filePath,
        };
        const expectedTypes = {
            name: "string",
            details: "string?",
            precision: "u8",
            amounts: "array[u64]",
            filePath: "string?",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_issue_asset_cfa(
                this.wallet,
                name,
                details,
                serializeInteger(precision),
                stringifyJson(amounts.map(serializeInteger)),
                filePath,
            ),
        );
    }

    issueAssetNIA(ticker, name, precision, amounts) {
        const params = {
            ticker,
            name,
            precision,
            amounts,
        };
        const expectedTypes = {
            name: "string",
            precision: "u8",
            amounts: "array[u64]",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_issue_asset_nia(
                this.wallet,
                ticker,
                name,
                serializeInteger(precision),
                stringifyJson(amounts.map(serializeInteger)),
            ),
        );
    }

    issueAssetUDA(
        ticker,
        name,
        details,
        precision,
        mediaFilePath,
        attachmentsFilePaths,
    ) {
        const params = {
            ticker,
            name,
            details,
            precision,
            mediaFilePath,
            attachmentsFilePaths,
        };
        const expectedTypes = {
            ticker: "string",
            name: "string",
            details: "string?",
            precision: "u8",
            mediaFilePath: "string?",
            attachmentsFilePaths: "array[string]",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_issue_asset_uda(
                this.wallet,
                ticker,
                name,
                details,
                serializeInteger(precision),
                mediaFilePath,
                stringifyJson(attachmentsFilePaths),
            ),
        );
    }

    listAssets(filterAssetSchemas) {
        const params = {
            filterAssetSchemas,
        };
        const expectedTypes = {
            filterAssetSchemas: "array[string]",
        };
        validateTypes(params, expectedTypes);
        validateEnumValues(params, {
            filterAssetSchemas: AssetSchema,
        });
        return parseJson(
            lib.rgblib_list_assets(
                this.wallet,
                stringifyJson(filterAssetSchemas),
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
        return parseJson(
            lib.rgblib_list_transactions(
                this.wallet,
                serializeOnline(online),
                skipSync,
            ),
        );
    }

    listTransfers(assetId) {
        const params = {
            assetId,
        };
        const expectedTypes = {
            assetId: "string?",
        };
        validateTypes(params, expectedTypes);
        return parseJson(lib.rgblib_list_transfers(this.wallet, assetId));
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
        return parseJson(
            lib.rgblib_list_unspents(
                this.wallet,
                serializeOnline(online),
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
            filter: "array[string]",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_refresh(
                this.wallet,
                serializeOnline(online),
                assetId,
                stringifyJson(filter),
                skipSync,
            ),
        );
    }

    send(
        online,
        recipientMap,
        donation,
        feeRate,
        minConfirmations,
        expirationTimestamp,
    ) {
        const params = {
            online,
            recipientMap,
            donation,
            feeRate,
            minConfirmations,
            expirationTimestamp,
        };
        const expectedTypes = {
            online: "object",
            recipientMap: "object",
            donation: "boolean",
            feeRate: "u64",
            minConfirmations: "u8",
            expirationTimestamp: "u64",
        };
        validateTypes(params, expectedTypes);
        validateRecipientMap(recipientMap);
        return parseJson(
            lib.rgblib_send(
                this.wallet,
                serializeOnline(online),
                stringifyJson(recipientMap),
                donation,
                serializeInteger(feeRate),
                serializeInteger(minConfirmations),
                serializeInteger(expirationTimestamp),
            ),
        );
    }

    sendBegin(
        online,
        recipientMap,
        donation,
        feeRate,
        minConfirmations,
        expirationTimestamp,
        dryRun,
    ) {
        const params = {
            online,
            recipientMap,
            donation,
            feeRate,
            minConfirmations,
            expirationTimestamp,
            dryRun,
        };
        const expectedTypes = {
            online: "object",
            recipientMap: "object",
            donation: "boolean",
            feeRate: "u64",
            minConfirmations: "u8",
            expirationTimestamp: "u64",
            dryRun: "boolean",
        };
        validateTypes(params, expectedTypes);
        validateRecipientMap(recipientMap);
        return parseJson(
            lib.rgblib_send_begin(
                this.wallet,
                serializeOnline(online),
                stringifyJson(recipientMap),
                donation,
                serializeInteger(feeRate),
                serializeInteger(minConfirmations),
                serializeInteger(expirationTimestamp),
                dryRun,
            ),
        );
    }

    sendBtc(online, address, amount, feeRate, skipSync) {
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
            feeRate: "u64",
            skipSync: "boolean",
        };
        validateTypes(params, expectedTypes);
        return lib.rgblib_send_btc(
            this.wallet,
            serializeOnline(online),
            address,
            serializeInteger(amount),
            serializeInteger(feeRate),
            skipSync,
        );
    }

    sendEnd(online, signedPsbt) {
        const params = {
            online,
            signedPsbt,
        };
        const expectedTypes = {
            online: "object",
            signedPsbt: "string",
        };
        validateTypes(params, expectedTypes);
        return parseJson(
            lib.rgblib_send_end(
                this.wallet,
                serializeOnline(online),
                signedPsbt,
            ),
        );
    }

    signPsbt(psbt) {
        const params = { psbt };
        const expectedTypes = {
            psbt: "string",
        };
        validateTypes(params, expectedTypes);
        return lib.rgblib_sign_psbt(this.wallet, psbt);
    }

    sync(online, options) {
        const params = { online, options };
        const expectedTypes = {
            online: "object",
            options: "object",
        };
        validateTypes(params, expectedTypes);
        validateEnumValues(options, {
            strategy: SyncStrategy,
        });
        if (trueTypeOf(options.keychain) === "object") {
            validateTypes(options.keychain, { Vanilla: "object" });
            validateTypes(options.keychain.Vanilla, { lookback: "u32" });
        }
        lib.rgblib_sync(
            this.wallet,
            serializeOnline(online),
            stringifyJson(options),
        );
    }

    witnessReceive(
        assetId,
        assignment,
        expirationTimestamp,
        transportEndpoints,
        minConfirmations,
    ) {
        const params = {
            assetId,
            assignment,
            expirationTimestamp,
            transportEndpoints,
            minConfirmations,
        };
        const expectedTypes = {
            assetId: "string?",
            expirationTimestamp: "u64",
            transportEndpoints: "array[string]",
            minConfirmations: "u8",
        };
        validateTypes(params, expectedTypes);
        validateAssignment(assignment, "assignment");
        return parseJson(
            lib.rgblib_witness_receive(
                this.wallet,
                assetId,
                stringifyJson(assignment),
                serializeInteger(expirationTimestamp),
                stringifyJson(transportEndpoints),
                serializeInteger(minConfirmations),
            ),
        );
    }
};
