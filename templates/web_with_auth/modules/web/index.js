var requirejs = require('requirejs');
var _ = require('lodash');
var safe = require('safe');
var path = require('path');
var sstatic = require('serve-static');
var lessMiddleware = require('less-middleware');

module.exports.deps = ['users'];
module.exports.reqs = {router:true, globalUse:true};

var mName = "web",
	MODULE_PREFIX = '/'+mName;

module.exports.init = function (ctx, cb) {
	var cfg = ctx.cfg;

	var r = requirejs.config({
		context: MODULE_PREFIX,
		baseUrl: __dirname + "/app",
		paths: {
			"tson": path.resolve(__dirname, "../tinyback/tson"),
			"prefixify": path.resolve(__dirname, "../tinyback/prefixify"),
			"tinybone": path.resolve(__dirname, "../tinybone"),
			'dustc': path.resolve(__dirname, '../tinybone/dustc'),
			'text': path.resolve(__dirname, '../../node_modules/requirejs-text/text'),
			'dust.core': path.resolve(__dirname, '../../node_modules/dustjs-linkedin/lib/dust'),
			'dust.parse': path.resolve(__dirname, '../../node_modules/dustjs-linkedin/lib/parser'),
			'dust.compile': path.resolve(__dirname, '../../node_modules/dustjs-linkedin/lib/compiler'),
			'dust-helpers': path.resolve(__dirname, '../../node_modules/dustjs-helpers/lib/dust-helpers'),
			"md5": "../public/js/md5"
		},
		config: {
			"text": {
				env: "node"
			},
			"tinybone/base": {
				debug: cfg.env != "production"
			},
			"tinybone/backadapter": {
				_t_son: "out",
				debug: cfg.env != "production"
			},
			'dustc': {
				debug: cfg.env != 'production'
			}
		}
	});

	requirejs.onError = function (err) {
		console.error(err);
	};

	// server stubs
	requirejs.define.amd.dust = true;
	requirejs.define("jquery", true);
	requirejs.define("bootstrap", true);
	requirejs.define("bootstrap-datepicker", true);
	requirejs.define("jquery-cookie", true);
	requirejs.define("jquery.blockUI", true);
	requirejs.define("jquery.form", true);
	requirejs.define("moment-pt_BR", true);
	requirejs.define("backctx", ctx);
	requirejs.define("filesaver", true);

	ctx.router.use("/css", lessMiddleware(__dirname + '/style', {dest: __dirname + "/public/css"}));
	ctx.router.use(sstatic(__dirname + "/public", {maxAge: 600000}));
	ctx.router.get("/app/wire/:id", function (req, res, next) {
		ctx.api.cache.get("web_wires_" + mName, req.params.id, safe.sure(next, function (wire) {
			if (wire) {
				res.json(wire);
			} else
				res.send(404);
		}));
	});
	r(['require', 'app'], function (requirejs, App) {
		var app = new App({prefix: MODULE_PREFIX});
		// reuse express router as is
		app.router = ctx.router;
		// register render function
		ctx.router.get('*', function (req, res, next) {
			res.renderX = function (route, callback) {
				var req = this.req;
				var cb = callback || function (err) {
							req.next(err);
						};
				var view = app.getView({empty:_.get(route.data,"layout") == false});
				view.data = route.data || {};
				view.locals = res.locals;
				var populateTplCtx = view.populateTplCtx;
				var uniqueId = _.uniqueId("w");
				view.populateTplCtx = function (ctx, cb) {
					ctx = ctx.push({
						_t_main_view: route.view.id,
						_t_prefix: MODULE_PREFIX,
						_t_tinelic: cfg.monitoring.tinelic,
						_t_route: res.req.route.path,
						_t_unique: uniqueId,
						_t_env_production: cfg.env == "production",
						_t_rev: cfg.rev,
						_t_GA:cfg.monitoring.ga
					});
					populateTplCtx.call(this, ctx, cb);
				};

				view.render(safe.sure(next, function (text) {
					var wv = view.getWire();
					wv.prefix = app.prefix;
					wv.wrapErrors = cfg.app.wrapErrors;
					wv._t_cfgData = app._t_cfgData;
					// make wire available for download for 30s
					ctx.api.cache.set("web_wires_" + mName, uniqueId, ctx.api.tson.encode(wv), safe.sure(next, function () {
						if(callback)
							return callback(null,text);
						res.send(text);
					}));
				}));

			};
			next();
		});

		safe.series([
			function (cb) {
				ctx.api.cache.register("web_wires_" + mName, {maxAge: 1}, cb);
			},
			function (cb) {
				app.initRoutes(cb);
			}
		], safe.sure(cb, function () {
			cb(null, {api: {}});
		}));
	}, cb);
};
