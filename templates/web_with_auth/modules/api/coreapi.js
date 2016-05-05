var path = require('path');
var fs = require('fs');
var safe = require('safe');
var _ = require('lodash');
var mongo = require('mongodb');

var api = {};
var ctx;

module.exports.deps = ['mongo'];

module.exports.init = function (_ctx, cb) {
	ctx = _ctx;
	cb(null, {api: api});
};

/**
 *  Save uploaded file to GridFS
 *
 * @param token
 * @param file {Object} returned by multer
 * @param metadata {Object} optional
 * @param cb
 *
 * @returns saved file object
 */
api.uploadFile = function (token, file, metadata, cb) {
	if (_.isFunction(metadata)) {
		cb = metadata;
		metadata = {};
	} else if (!_.isPlainObject(metadata)) {
		metadata = {};
	}

	ctx.api.mongo.getDb({}, safe.sure(cb, function (db) {
		var dat = {
			content_type: file.mimetype,
			filename: file.originalname,
			metadata: metadata
		};

		storeFileMongo(db, file.path, dat, cb);
	}));
};

api.getFile = function (token, id, cb) {

	ctx.api.mongo.getDb({}, safe.sure(cb, function (db) {
		var store = new mongo.Grid(db);

		store.get(new mongo.ObjectID(id.toString()), safe.sure(cb, function (data) {
			cb(null, data)
		}));
	}));

};

api.getFileMeta = function(token, _id, cb) {
	if (!_id)
		return safe.back(cb, null);
	ctx.api.mongo.getDb({}, safe.sure(cb, function (db) {
		db.collection('fs.files', safe.sure(cb, function(files) {
			files.findOne({'_id': new mongo.ObjectID(_id.toString())}, cb);
		}));
	}));

};

/**
 * Read file by filename & stores it into db
 * @todo stream to write a large file
 *
 * @param db database instance
 * @param pth
 *
 * @param options
 * @param options.filename
 * @param options.content_type
 * @param options.metadata
 *
 * @param cb
 */
function storeFileMongo(db, pth, options, cb) {
	if (_.isFunction(options)) {
		cb = options;
		options = null;
	}

	fs.readFile(pth, safe.sure(cb, function (fileData) {
				var store = new mongo.Grid(db);
				var fd = new Buffer(fileData);
				var opts = {
					filename: (options && options.filename) || path.basename(pth)
				};

				if (_.isObject(options))
					_.merge(opts, _.pick(options, ['content_type', 'metadata']));

				store.put(fd, opts, safe.sure(cb, function (result) {
					cb(null, result);
				}));
			}
	));
}
