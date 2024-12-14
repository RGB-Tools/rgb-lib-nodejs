const path = require("path");
const { Worker } = require("worker_threads");

let workerPromise;
async function initWorker() {
    if (workerPromise) return workerPromise;
    const worker = new Worker(path.join(__dirname, "worker.js"));
    workerPromise = new Promise((resolve) => {
        function onReady() {
            worker.off("message", onReady);
            let pendingPromises = {};
            worker.on("message", ({ id, res, err }) => {
                if (err) pendingPromises[id].reject(err);
                else pendingPromises[id].resolve(res);
                delete pendingPromises[id];
            });
            const wrappedWorker = {
                sendMessage: ({ isClass, self, method, args }) => {
                    const id = Math.random().toString(36).substring(2);
                    return new Promise((resolve, reject) => {
                        pendingPromises[id] = { resolve, reject };
                        worker.postMessage({ id, isClass, self, method, args });
                    });
                },
            };
            resolve(wrappedWorker);
        }
        worker.on("message", onReady);
    });

    return workerPromise;
}

function proxify(worker, res) {
    return new Proxy(res, {
        get(obj, method) {
            if (method === "then" || method === "catch" || method === "finally")
                return obj[method];
            return (...args) => worker.sendMessage({ self: obj, method, args });
        },
    });
}

function wrapClass(className) {
    return async (...args) => {
        const worker = await initWorker();
        const res = await worker.sendMessage({
            isClass: true,
            method: className,
            args,
        });
        return proxify(worker, res);
    };
}

function wrapMethod(methodName) {
    return async (...args) => {
        const worker = await initWorker();
        return worker.sendMessage({ method: methodName, args });
    };
}

exports.Wallet = wrapClass("Wallet");
exports.dropOnline = wrapMethod("dropOnline");
exports.generateKeys = wrapMethod("generateKeys");
exports.restoreKeys = wrapMethod("restoreKeys");
