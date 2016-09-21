var	count = 0;
const pok_readConfig = require('pok_utils').readConfig,
	safe = require('safe'),
	argon2 = require('argon2');

var tinyback = require('tinyback'),
	ctx = {api:{}},
	cols={},db;


var mongodb = tinyback.mongodb();
safe.run(function(cb){
	safe.series([
		function(cb){
			pok_readConfig(safe.sure_result(cb,function(cfg_){
				ctx.cfg = cfg_;
			}));
		},
		function(cb){
			tinyback.prefixify().init(ctx,safe.sure_result(cb,function(m){
				ctx.api.prefixify = m.api;
			}));
		},
		function(cb){
			mongodb.init(ctx,safe.sure_result(cb,function(m){
				ctx.api.mongo = m.api;
			}));
		},
		function(cb){
			ctx.api.mongo.getDb({},safe.sure_result(cb,function(db_){
				db = db_;
			}));
		},
		function(cb){
			safe.parallel({
				users:function(cb){
					db.collection("users",cb);
				}
			},safe.sure_result(cb,function(res){
				cols = res;
			}));
		},
		function(cb){
			var cursor = cols.users.find({}, {password: 1});
			var check = 1;
			safe.whilst(
				function() {
					return check;
				},
				function(cb) {
					cursor.nextObject(safe.sure(cb, function(u) {
						if (u === null) {
							check = 0;
							cb();
						} else {
							if (u.password.length < 100) {
								argon2.generateSalt().then(salt => {
									argon2.hash(u.password, salt, {})
									.then(hash => {
										cols.users.update(
											{"_id": u._id },
											{ $set: { "password": hash } },
											cb
										);
										count++;
									})
									.catch(cb);
								});
							}
							else{
								cb();
							}
						}
					}));
				},
			cb);
		}
	],cb);
},function(err){
	if(err){
		console.log(err);
		process.exit(1);
	}
	console.log("update " + count + " users");
	process.exit(0);
});
