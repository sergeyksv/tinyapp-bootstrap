"use strict";

const _ = require("lodash"),
	safe = require("safe"),
	tb = require('tinyback'),
	argon2 = require('argon2'),
	CustomError = tb.CustomError;

const roles = {
		ADMIN:"admin"
	};

function UnknownCurrentUserError() {
	this.constructor.prototype.__proto__ = CustomError.prototype;
	this.message = 'Current user is unknown';
	this.subject = 'Unauthorized';
}

function FailedCredentialsError() {
	this.constructor.prototype.__proto__ = CustomError.prototype;
	this.message = 'Log-in, password or both is not valid';
	this.subject = 'Unauthorized';
}

module.exports.deps = ['mongo', 'obac'];

var api = {},ctx,qf,df,cols;
module.exports.init = function (ctx_, cb) {
	ctx = ctx_;
	qf = ctx.api.prefixify.query;
	df = ctx.api.prefixify.data;
	/**
	 * @typedef User
	 * @type {Object}
	 * @property {String} _id
	 * @property {String} login
	 * @property {String} password
	 * @property {String} role
	 * @property {String} lastName
	 * @property {String} firstName
	 */
	ctx.api.validate.register("user", {
		$set: {
			properties: {
				_id: {
					type: "mongoId"
				},
				name: {
					type: "string",
					required: true,
					minLength: 2,
					maxLength: 32,
					messages: {}
				},
				email: {
					"type": "string",
					"format": 'email'
				},
				password: {
					type: "string",
					required: true,
					minLength: 6,
					messages: {}
				},
				role: {
					required: true,
					enum: _.values(roles),
					messages: {
						enum: "Please fill role"
					}
				}
			}
		}
	});

	ctx.api.obac.register(['user_edit'], 'users', {
		permission: 'getPermissionForUserEdit'
	}),

	ctx.api.obac.register(['user_new'], 'users', {
		permission: 'getPermissionForUserNew'
	}),

	ctx.api.mongo.getDb({}, safe.sure(cb, function (db) {
		safe.series({
			"users": function (cb) {
				db.collection("users", safe.sure(cb, function (col) {
					safe.parallel([
						function (cb) {
							ctx.api.mongo.ensureIndex(col, {"tokens.token": 1}, cb);
						},
						function (cb) {
							ctx.api.mongo.ensureIndex(col, {"email": 1}, {unique:true}, cb);
						}
					], safe.sure(cb, col));
				}));
			}
		}, safe.sure(cb, function (cols_) {
			cols = cols_;
			cb(null, { api: api});
		}));
	}));
}

/**
 * REST API to manage users
 *
 * @exports UsersApi
 */
api.getRoles = function(t, p, cb) {
	return safe.back(cb, null, roles);
}
api.getUsersList = function(t, p, cb) {
	var query = p.query || {};
	var cursor = cols.users.find(qf(query));
	safe.parallel({
		cnt: function(cb) {
			cursor.count(false, cb);
		},
		list: function(cb) {
			if (p.sort) {
				var sort = _.reduce(_.get(p, 'sort', {}), function(m, v, k) {
					m[k] = (v != -1 && !!v) ? 1 : -1;
					return m;
				}, {});
				cursor.sort(sort);
			}
			if (p.skip) {
				cursor.skip(parseInt(p.skip));
			}
			if (p.limit) {
				cursor.limit(parseInt(p.limit));
			}
			cursor.toArray(cb);
		}
	}, cb);
}

api.checkEmailExists = function(t, p, cb) {
	cols.users.findOne(qf({email: p}), safe.sure(cb, function (user) {
		cb(null, !_.isNull(user));
	}));
}

api.getUserItem = function(t, p, cb) {
	cols.users.findOne(qf({_id: p._id}), safe.sure(cb, function (user) {
		cb(null, user);
	}));
}

api.addUserItem = function(t, p, cb) {
	ctx.api.obac.getPermission(t, {action:"user_new", throw:true}, safe.sure(cb, function() {
		p.data.email = p.data.email.trim();
		ctx.api.validate.check("user", df(p.data), safe.sure(cb, function () {
			argon2.generateSalt().then(salt => {
				argon2.hash(p.data.password, salt, {}).then(hash => {
					p.data.password = hash;
					cols.users.insert(df(p.data), cb);
				});
			});
		}));
	}));
}

api.updateUserItem = function(t, p, cb) {
	var _id = p.data._id;
	ctx.api.obac.getPermission(t, {_id:p.data._id, action:"user_edit", throw:true}, safe.sure(cb, function() {
		delete p.data.email;
		var obj = {
				$set: df(p.data)
			};
		ctx.api.validate.check("user", obj, {isUpdate: true}, safe.sure(cb, function (u) {
			var pr = new Promise((res,rej)=>{
				if (!p.data.password)
					return res();
				argon2.generateSalt().then(salt => {
					argon2.hash(p.data.password, salt, {})
					.then(hash => {
						obj.$set.password = hash;
					})
					.then(res)
					.catch(rej);
				});
			});
			pr
				.then(()=>{
					cols.users.update(qf({
						_id: _id
					}), obj, cb);
				})
				.catch((err)=>{
					cb(err);
				});
		}));
	}));
}

api.getPermissionForUserEdit = function(t, p, cb) {
	this.getCurrentUser(t, safe.sure(cb, function(user) {
		if (_.includes([roles.ADMIN], user.role))
			return cb(null, true);
		cb(null, false);
	}));
}

api.getPermissionForUserNew = function(t, p, cb) {
	this.getCurrentUser(t, safe.sure(cb, function(user) {
		if (_.includes([roles.ADMIN], user.role))
			return cb(null, true);
		cb(null, false);
	}));
}
/**
 * Public (can be requested by rest) version of users.getCurrentUser
 * @param t
 * @param p
 * @param cb
 */
api.getCurrentUserPublic = function (t, p, cb) {
	cols.users.findOne({'tokens.token': t, _b_active: {$ne: false}}, {
		login: 1,
		role: 1,
		firstName: 1,
		lastName: 1
	}, safe.sure(cb, function (user) {
		if (!user)
			return cb(new UnknownCurrentUserError());

		cb(null, user);
	}));
}
/**
 * Get current user
 * @return {User} result Currently authenticated user
 * @param t
 * @param cb
 */
api.getCurrentUser = function (t, cb) {
	cols.users.findOne({'tokens.token': t, _b_active: {$ne: false}}, safe.sure(cb, function (user) {
		if (!user)
			return cb(new UnknownCurrentUserError());

		cb(null, user);
	}));
}
/**
 * @param {String} token Auth token
 * @param {Object} p
 * @param {String} p.login Login name
 * @param {String} p.password Password
 * @param {Function} cb
 * @return {String} New auth token
 */
api.login = function (token, p, cb) {
	var dt = new Date();
	var range = 7 * 24 * 60 * 60 * 1000;
	var dtexp = new Date(Date.parse(Date()) + range);
	var token_ = Math.random().toString(36).slice(-14);
	cols.users.find({email:p.email},{_id:1,password:1}).toArray(safe.sure(cb,(res)=>{
		if(!res.length || res.length > 1)
			return cb(new FailedCredentialsError());
		argon2.verify(res[0].password,p.password).then(match=>{
			if(!match)
				return cb(new FailedCredentialsError());
			safe.series([
				(cb)=>{
					cols.users.update(
						{_id:res[0]._id},
						{
							$push: {tokens: {token: token_, _dt: dt, _dtexp: dtexp, tz: p.tz}}
						},
					cb);
				},
				(cb)=>{
					cols.users.update(
						{_id:res[0]._id},
						{
							$pull: {tokens:{_dtexp: {$lt: dt}}}
						},
					cb);
				}
			],safe.sure(cb,()=>{
				cb(null, token_);
			}));
		}).catch(cb);
	}));
}
/**
 * @param t
 * @param u
 * @param cb
 */
api.logout = function (t, p, cb) {
	cols.users.update({'tokens.token': t}, {$pull: {tokens: {token: t}}}, {}, cb);
}
