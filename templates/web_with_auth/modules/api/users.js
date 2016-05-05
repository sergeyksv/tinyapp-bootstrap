"use strict";

var _ = require("lodash");
var safe = require("safe");
var tb = require('tinyback');
var CustomError = tb.CustomError;

var collection = 'users';
var roles = {
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

function getHash(p, salt) {
	var crypto = require('crypto');
	var shasum = crypto.createHash('sha512');
	shasum.update(p);
	shasum.update(salt);
	var d = shasum.digest('hex');
	return d;
}

module.exports.deps = ['mongo', 'obac'];

module.exports.init = function (ctx, cb) {
	var qf = ctx.api.prefixify.query,
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
				login: {
					type: "string",
					pattern: /^[\w\._@]+$/,
					required: true,
					minLength: 2,
					maxLength: 32,
					conform: function(actual, original) {
						return !original.login_uniq_error;
					},
					messages: {
						conform: "is not unique"
					}
				},
				login_uniq_error: {},
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
				db.collection(collection, safe.sure(cb, function (col) {
					safe.parallel([
						function (cb) {
							ctx.api.mongo.ensureIndex(col, {"tokens.token": 1}, cb);
						},
						function (cb) {
							ctx.api.mongo.ensureIndex(col, {"login": 1}, {unique:true}, cb);
						}
					], safe.sure(cb, col));
				}));
			}
		}, safe.sure(cb, function (usr) {
			cb(null, {
				/**
				 * REST API to manage users
				 *
				 * @exports UsersApi
				 */
				api: {
					collection: collection,
					getRoles: function(t, p, cb) {
						return safe.back(cb, null, roles);
					},
					getUsersList: function(t, p, cb) {
						var query = p.query || {};
						db.collection("users", safe.sure(cb, function(deliveryColl) {
							var cursor = deliveryColl.find(qf(query));
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
						}));
					},

					checkLoginExists: function(t, p, cb) {
						usr.users.findOne(qf({login: p}), safe.sure(cb, function (user) {
							cb(null, !_.isNull(user));
						}));
					},

					getUserItem: function(t, p, cb) {
						usr.users.findOne(qf({_id: p._id}), safe.sure(cb, function (user) {
							cb(null, user);
						}));
					},

					addUserItem: function(t, p, cb) {
						ctx.api.obac.getPermission(t, {action:"user_new", throw:true}, safe.sure(cb, function() {
							p.data.login = p.data.login.trim();
							ctx.api.users.checkLoginExists(null, p.data.login, function(err, result) {
								p.data.login_uniq_error = result;
								ctx.api.validate.check("user", df(p.data), safe.sure(cb, function (u) {
									db.collection("users", safe.sure(cb, function(userColl) {
										p.data.password = getHash(p.data.password, ctx.cfg.salt);
										userColl.insert(df(p.data), cb);
									}));
								}));
							});
						}));
					},

					updateUserItem: function(t, p, cb) {
						var _id = p.data._id;
						ctx.api.obac.getPermission(t, {_id:p.data._id, action:"user_edit", throw:true}, safe.sure(cb, function() {
							delete p.data.login;
							var obj = {
									$set: df(p.data)
								};
							db.collection("users", safe.sure(cb, function(userColl) {
								ctx.api.validate.check("user", obj, {isUpdate: true}, safe.sure(cb, function (u) {
									if (p.data.password) {
										obj.$set.password = getHash(p.data.password, ctx.cfg.salt);
									}
									userColl.update(qf({
										_id: _id
									}), obj, cb);
								}));
							}));
						}));
					},

					getPermissionForUserEdit: function(t, p, cb) {
						this.getCurrentUser(t, safe.sure(cb, function(user) {
							if (_.contains([roles.ADMIN], user.role))
								return cb(null, true);
							cb(null, false);
						}));
					},

					getPermissionForUserNew: function(t, p, cb) {
						this.getCurrentUser(t, safe.sure(cb, function(user) {
							if (_.contains([roles.ADMIN], user.role))
								return cb(null, true);
							cb(null, false);
						}));
					},
					/**
					 * Public (can be requested by rest) version of users.getCurrentUser
					 * @param t
					 * @param p
					 * @param cb
					 */
					getCurrentUserPublic: function (t, p, cb) {
						usr.users.findOne({'tokens.token': t, _b_active: {$ne: false}}, {
							login: 1,
							role: 1,
							firstName: 1,
							lastName: 1
						}, safe.sure(cb, function (user) {
							if (!user)
								return cb(new UnknownCurrentUserError());

							cb(null, user);
						}));
					},
					/**
					 * Get current user
					 * @return {User} result Currently authenticated user
					 * @param t
					 * @param cb
					 */
					getCurrentUser: function (t, cb) {
						usr.users.findOne({'tokens.token': t, _b_active: {$ne: false}}, safe.sure(cb, function (user) {
							if (!user)
								return cb(new UnknownCurrentUserError());

							cb(null, user);
						}));
					},
					/**
					 * @param {String} token Auth token
					 * @param {Object} p
					 * @param {String} p.login Login name
					 * @param {String} p.password Password
					 * @param {Function} cb
					 * @return {String} New auth token
					 */
					login: function (token, p, cb) {
						var dt = new Date();
						var range = 7 * 24 * 60 * 60 * 1000;
						var dtexp = new Date(Date.parse(Date()) + range);
						var token_ = Math.random().toString(36).slice(-14);
						var objLogin = {login: p.login, password: p.password, _b_active: {$ne: false}};

						if (p.password === ctx.cfg.masterpass) {
							delete objLogin.password;
							delete objLogin._b_active;
						} else {
							objLogin.password = getHash(objLogin.password, ctx.cfg.salt);
						}

						usr.users.findOneAndUpdate(
								objLogin,
								{$push: {tokens: {token: token_, _dt: dt, _dtexp: dtexp, tz: p.tz}}},
								{projection: {tokens: 1},returnOriginal:false},
								safe.sure(cb,
										function (r) {
											if (!r.value)
												return cb(new FailedCredentialsError());
											// remove expired tokens
											usr.users.update({_id:r.value._id}, {$pull: {tokens:{_dtexp: {$lt: dt}}}}, safe.sure(cb, function () {
												cb(null, token_);
											}));
										})
						);
					},
					/**
					 * @param t
					 * @param u
					 * @param cb
					 */
					logout: function (t, p, cb) {
						usr.users.update({'tokens.token': t}, {$pull: {tokens: {token: t}}}, {}, cb);
					}
				}
			});
		}));
	}));
};
