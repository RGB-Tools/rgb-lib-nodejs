const { execSync } = require("child_process");
const rgblib = require("./wrapper");

const PROXY_URL = "rpc://127.0.0.1:3000/json-rpc";

function mine(numBlocks) {
    try {
        execSync(`./rgb-lib/tests/regtest.sh mine ${numBlocks}`);
        console.log("Mined " + numBlocks + " blocks");
    } catch (e) {
        throw new Error(`Unable to mine: ${e}`);
    }
}

function sendToAddress(address, amt) {
    try {
        let res = execSync(
            `./rgb-lib/tests/regtest.sh sendtoaddress ${address} ${amt}`,
        );
        console.log("Sent, TXID: " + res.toString().trim());
    } catch (e) {
        throw new Error(`Unable to send bitcoins: ${e}`);
    }
}

/* Run this method and monitor memory usage to check there are no memory leaks */
function checkMemoryLeak() {
    for (let i = 0; i < 50; i++) {
        let [wallet, online] = initWallet();
        rgblib.dropOnline(online);
        wallet.drop();
    }
}

function initWallet() {
    let bitcoinNetwork = rgblib.BitcoinNetwork.Regtest;
    let keys = rgblib.generateKeys(bitcoinNetwork);
    console.log("Keys: " + JSON.stringify(keys));

    let walletData = {
        dataDir: "./data",
        bitcoinNetwork: bitcoinNetwork,
        databaseType: rgblib.DatabaseType.Sqlite,
        maxAllocationsPerUtxo: 1,
        pubkey: keys.accountXpub,
        mnemonic: keys.mnemonic,
        vanillaKeychain: null,
    };
    console.log("Creating wallet...");
    let wallet = new rgblib.Wallet(new rgblib.WalletData(walletData));
    console.log("Wallet created");

    let address = wallet.getAddress();
    console.log("Address: " + address);

    sendToAddress(address, 1);

    console.log("Wallet is going online...");
    let online = wallet.goOnline(false, "tcp://localhost:50001");
    console.log("Wallet went online");

    let created = wallet.createUtxos(online, false, 25, null, 1.5, false);
    console.log("Created " + created + " UTXOs");

    return [wallet, online];
}

function main() {
    let [wallet, online] = initWallet();

    let asset1 = wallet.issueAssetNIA(online, "USDT", "Tether", 2, [777, 66]);
    console.log("Issued a NIA asset " + JSON.stringify(asset1));

    let asset2 = wallet.issueAssetCFA(online, "Cfa", "desc", 2, [777], null);
    console.log("Issued a CFA asset: " + JSON.stringify(asset2));

    let asset3 = wallet.issueAssetUDA(
        online,
        "TKN",
        "Token",
        null,
        2,
        "README.md",
        [],
    );
    console.log("Issued a UDA asset: " + JSON.stringify(asset3));

    let assets1 = wallet.listAssets([
        rgblib.AssetSchema.Nia,
        rgblib.AssetSchema.Cfa,
    ]);
    console.log("Assets: " + JSON.stringify(assets1));

    let assets2 = wallet.listAssets([]);
    console.log("Assets: " + JSON.stringify(assets2));

    let [rcvWallet, rcvOnline] = initWallet();

    let receiveData = rcvWallet.blindReceive(null, 100, null, [PROXY_URL], 1);
    console.log("Receive data: " + JSON.stringify(receiveData));

    let recipientMap = {
        [asset1.assetId]: [
            {
                recipientId: receiveData.recipientId,
                witnessData: null,
                amount: 100,
                transportEndpoints: [PROXY_URL],
            },
        ],
    };

    let sendResult = wallet.send(online, recipientMap, false, 1.3, 1, false);
    console.log("Sent: " + JSON.stringify(sendResult));

    rcvWallet.refresh(rcvOnline, null, [], false);
    wallet.refresh(online, null, [], false);

    mine(1);

    rcvWallet.refresh(rcvOnline, null, [], false);
    wallet.refresh(online, null, [], false);

    let rcvAssets = rcvWallet.listAssets([]);
    console.log("Assets: " + JSON.stringify(rcvAssets));

    // these avoid memory leaks, unnecessary here since the program exits
    rgblib.dropOnline(online);
    wallet.drop();
    rgblib.dropOnline(rcvOnline);
    rcvWallet.drop();
}

try {
    main();
} catch (e) {
    console.error("Error running example: " + e);
    process.exit(1);
}
