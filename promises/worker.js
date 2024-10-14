const { parentPort } = require("worker_threads");
const wrapper = require("../wrapper");

const registry = {};
parentPort.on("message", ({ id, isClass, self, method, args }) => {
    try {
        if (self) self = getArgValue(self);
        else self = wrapper;
        if (typeof self[method] !== "function") {
            throw new Error(
                `${self[method]} is not a function (calling ${method})`,
            );
        }

        let res;
        if (isClass) res = new self[method](...args.map(getArgValue));
        else res = self[method](...args.map(getArgValue));
        try {
            parentPort.postMessage({ id, res });
        } catch (e) {
            if (e.name === "DataCloneError") {
                registry[id] = res;
                parentPort.postMessage({ id, res: { _id: id } });
            } else {
                throw e;
            }
        }
    } catch (err) {
        parentPort.postMessage({ id, err });
    }
});
parentPort.postMessage(null);

function getArgValue(a) {
    return registry[a?._id] || a;
}
