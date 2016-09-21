var api = {};
var ctx;

module.exports.deps = ['mongo'];

module.exports.init = function (_ctx, cb) {
	ctx = _ctx;
	cb(null, {api: api});
};
