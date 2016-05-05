var fs = require('fs');
var _ = require("lodash");
var path = require('path');
var readConfig = require('pok_utils').readConfig;

var tinyback = require('tinyback');
var http = require('http');
var https = require('https');
var safe = require("safe");
var sstatic = require('serve-static');
var argv = require('yargs').argv;
var mongo = require("mongodb");
var moment = require("moment");
var mime = require("mime");

var cfg = {
	modules: [
		{name: "prefixify", object: tinyback.prefixify()},
		{name: "tson", object: tinyback.tson()},
		{name: "validate", object: tinyback.validate()},
		{name: "mongo", object: tinyback.mongodb()},
		{name: "cache", object: tinyback.mongocache()},
		{name: "obac", object: tinyback.obac()},
		{name: "restapi", object: tinyback.restapi()},
		{name:"coreapi",require:"./modules/api/coreapi.js"},
		{name:"users",require:"./modules/api/users.js"},
		{name:"scheduler",require:"./modules/api/scheduler.js"},
		{name: 'web', require: './modules/web'}
	]
};

console.time("Live !");
var cb = function (err) {
	console.log(err);
	if (err.originalError)
		console.log(err.originalError);
	process.exit(0);
};

readConfig(safe.sure(
	function(err){
		if (err){
			console.log(err);
			process.exit(1);
		}
	},
	function (config) {
		cfg.config = config;
		tinyback.createApp(cfg, safe.sure(cb, function (app) {
			var newrelic =  config.__newrelic;
			app.locals.newrelic = newrelic;
			app.express.use(sstatic(__dirname + "/public", {maxAge: 600000}));
			app.express.get("/robots.txt", function (req, res, next) {
				res.setHeader('Content-Type', 'text/plain');
				res.write("User-agent: *\n");
				res.write("Disallow: /");
				res.end();
			});
			app.express.get("/", function (req, res, next) {
				res.redirect("/web");
			});

			app.express.post("/file/upload",function(req,res,next){
				if (_.isEmpty(req.files.file))
					return res.status(400).send('Selecione o arquivo padrão com as NFe/CTe');

				var fileUpload = req.files.file;
				var resultId = "";
				var jsonData = [];
				var type = mime.lookup(fileUpload.path);
				safe.series([
					function(cb) {
						fs.stat(fileUpload.path, safe.sure(cb, function(stat) {
							if (stat.size > 10485760)
								return cb(new Error('This file is too large (over 10 Mb).'));
							cb();
						}));
					},
					function(cb) {
						if (!_.includes(cfg.upload.fileTypes,mime.extension(type))) {
							return safe.back(cb,new CustomError("Invalid file type for upload."));
						}
						safe.back(cb);
					},
					function(cb) {
						app.api.coreapi.uploadFile(null, fileUpload, {}, safe.sure(cb, function(result) {
							resultId = result._id;
							cb();
						}));
					}
				], function(err) {
					if (err) {
						return res.status(413).send(err.message);
					}
					res.status(200).json({
						_id: resultId,
						name: fileUpload.originalname
					});
				});
			});
			var httpDateFormat = ['ddd, DD MMM YYYY HH:mm:ss [GMT]', 'dddd, DD-MMM-YY HH:mm:ss [GMT]', 'ddd MMMM DD HH:mm:ss YYYY'];
			app.express.get("/file/:id",function(req,res,next){
				app.api.coreapi.getFileMeta(null,req.params.id,safe.sure(cb,function(file){
					if(!file)
						return res.status(404).end();
					if (req.header('If-None-Match') == file.md5) {
						res.status(304).end();
						return;
					}
					var oDate = moment.utc(file.uploadDate);
					if (req.header('If-Modified-Since')) {
						var ifDate = moment.utc(req.header('If-Modified-Since'), httpDateFormat); // moment parser not support RFC 2616

						if (ifDate.isAfter(oDate)) {
							res.status(304).end();
							return;
						}
					}
					app.api.coreapi.getFile(null,req.params.id,safe.sure(next,function(data){
						var dateFormatted = moment.utc(file.uploadDate).format(httpDateFormat[0]);
						var expireDateFormatted = moment.utc().add(7, 'day').format(httpDateFormat[0]);
						res.setHeader('Cache-Control', 'public, max-age=' + 60 * 60 * 24 * 7); // 7 days
						res.setHeader('Expires', expireDateFormatted);
						res.setHeader('Content-Type', file.contentType);
						res.setHeader('Date', dateFormatted);
						res.setHeader('Last-Modified', dateFormatted);
						res.setHeader('Etag', file.md5);
						res.setHeader('Content-Disposition', 'attachment; filename="'+file.filename+'"');
						res.write(data);
						res.end();
					}));
				}));

			});

			safe.auto({
				db:function(cb){
					app.api.mongo.getDb({},cb);
				},
				indexes:["db",function(cb,result){
					app.api.mongo.dropUnusedIndexes(result.db,cb);
				}],
				dataentry:["db",function(cb,result){
					if(!argv.resetDataentry)
						return safe.back(cb);
					result.db.listCollections().toArray(safe.sure(cb,function(colls){
						safe.series([
							function(cb){
								safe.eachSeries(colls,function(coll,cb){
									if(coll.name.indexOf("system.") == 0)
										return cb();
									result.db.collection(coll.name,safe.sure(cb,function(coll){
										coll.drop(cb);
									}));
								},cb);
							},
							function(cb){
								var basePath = __dirname+"/dataentry";
								fs.readdir(basePath,safe.sure(cb,function(files){
									var prefixify = app.api.prefixify.datafix;
									safe.eachSeries(files,function(file,cb){
										var collName = path.basename(file,".json");
										var data = require(path.resolve(basePath,file));
										result.db.collection(collName,safe.sure(cb,function(coll){
											coll.insert(prefixify(data),cb);
										}));
									},cb);
								}));
							}
						],cb);
					}));
				}],
				collection:["db",function(cb,result){
					if(argv.resetDataentry)
						return safe.back(cb);
					if(!argv.resetCollection)
						return safe.back(cb);
					var collName = argv.resetCollection;
					safe.series([
						function(cb){
							result.db.collection(collName,safe.sure(cb,function(coll){
								coll.drop(cb);
							}));
						},
						function(cb){
							var basePath = __dirname+"/dataentry";
							var data = require(path.resolve(basePath,collName+".json"));
							result.db.collection(collName,safe.sure(cb,function(coll){
								var prefixify = app.api.prefixify.datafix;
								coll.insert(prefixify(data),cb);
							}));
						}
					],cb);
				}]
			},safe.sure(cb,function(){
				_.each(app.api, function (module, ns) {
					_.each(module, function (func, name) {
						if (!_.isFunction(func)) return;
						// wrap function
						module[name] = function () {
							var cb = arguments[arguments.length - 1];
							if (_.isFunction(cb)) {
								var args = safe.args.apply(0, arguments);
								// redefined callback to one wrapped by new relic
								if (newrelic) {
									cb = newrelic.createTracer("api/api/" + ns + "/" + name, function (err) {
										if (err)
											newrelic.noticeError(err);
										cb.apply(this, arguments);
									});
								}
								func.apply(this, args);
							} else {
								return func.apply(this, arguments);
							}
						};
					});
				});
				console.timeEnd("Live !");
				if (cfg.config.server.ssl_port) {
					try {
						var options = {
							key: fs.readFileSync(path.resolve(__dirname + '/privatekey.pem'), 'utf8'),
							cert: fs.readFileSync(path.resolve(__dirname + '/certificate.pem'), 'utf8'),
							ssl: true,
							plain: false
						};

						var httpsServer = https.createServer(options, app.express);

						httpsServer.listen(cfg.config.server.ssl_port);
					} catch (e) {}
				}

				var httpServer = http.createServer(app.express);

				httpServer.listen(cfg.config.server.port);

				if (cfg.config.automated && process.send) {
					process.send({c: "startapp_repl", data: null});
				}
			}));
		}));
	}
));
