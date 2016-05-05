/* global define */
define([
	'require',
	'views/layout/layout',
	'views/layout/empty',
	'module',
	'safe',
	'dust.core',
	'tinybone/base',
	'lodash',
	'tson',
	'tinybone/backadapter',
	'jquery',
	'jquery.blockUI',
	'dust-helpers'
], function (require,Layout,EmptyLayout, module, safe, dust, tb, _, tson, api,$) {
	// Make sure dust.helpers is an object before adding a new helper.
	if (!dust.helpers)
		dust.helpers = {};

	Date.nowUTC = function() {
		return Date.now() - (new Date().getTimezoneOffset() * 60000);
	};

	dust.helpers.formatdate = function (chunk, context, bodies, params) {
		var m = moment(params.date),
				defFormat = 'MM/DD/YYYY HH:mm';
		return chunk.write(m.format(params.format || defFormat));
	};
	dust.helpers.formatdateUTC = function (chunk, context, bodies, params) {
		var m = moment.utc(params.date),
				defFormat = 'MM/DD/YYYY HH:mm';
		return chunk.write(m.format(params.format || defFormat));
	};

	dust.helpers.formattime = function (chunk, context, bodies, params) {
		var d = moment().startOf("day").minutes(params.time),
			str = "";
		var h = d.hours();
		if(h){
			str += h + " HORA" + (h > 1 ? "S" : "");
		}
		var m = d.minutes();
		if(m){
			str += (h ? " E " : "") + m + " MIN";
		}
		return chunk.write(str);
	};

	return tb.Application.extend({
		getLocalPath: function () {
			return module.uri.replace("app.js", "");
		},
		getView: function (opts) {
			if(opts && opts.empty)
				return new EmptyLayout({app:this});
			return new Layout({app: this});
		},
		errHandler: function (err) {
			if (err){
				console.error(err);
			}
		},
		clientError: function (error, view) {
			if (!error || !(error instanceof Error))
				return;
			var self = this;
			require(['views/common/error'], function (Error) {
				var err = new Error({app: self, data: {subject: error.subject, message: error.message}});
				err.render(safe.sure(self.errHandler, function (text) {
					var $errcase = view.$el.find('.err-case-'+view.cid);
					if(!$errcase.length)
						$errcase =  view.$el.find('.err-case');
					if($errcase.length)
						$errcase.append(text);
				}));
			}, self.errHandler);
		},
		blockLayer: function($el){
			var self = this;
			if(!$el){
				$el = $("body");
			}
			$el.block({
				message:"<img style='width:32px; height:32px;' src='"+self.prefix+"/img/loader.gif'>",
				css: {
					textAlign:	'center',
					cursor:		'wait',
					border:"none",
					background:"transparent"
				},
				themedCSS: {
					width:	'30%',
					top:	'40%',
					left:	'35%'
				},
				overlayCSS:  {
					backgroundColor:	'#000',
					opacity:			0.1,
					cursor:				'wait'
				}
			});
		},
		unblockLayer: function($el){
			if(!$el){
				$el = $("body");
			}
			$el.unblock();
		},
		isServer: function () {
			return (typeof window === 'undefined');
		},
		getToken: function(){
			return $.cookie("token");
		},
		clearToken: function(){
			$.removeCookie('token', {path: '/'});
			$.removeCookie('_t_refresh', {path: '/'});
		},
		initRoutes: function (cb) {
			var self = this;
			var router = self.router;
			var routes = ['routes/main'];
			require(routes, function (main) {
				// some standard locals grabber
				router.use(function (req, res, next) {
					res.locals.token = req.cookies.token || "public";
					res.locals._t_req = _.pick(req, ['path', 'query', 'baseUrl']);
					next();
				});
				function checkAuth(req,res,next){
					api('users.getCurrentUserPublic', res.locals.token, {}, safe.sure(next,function (u) {
						if (u) {
							res.locals.currentUser = u;
						}
						next();
					}));
				}
				// routes goes first
				router.get("/", checkAuth,main.index);

				// error handler after that
				router.use(function (err, req, res, cb) {
					if (err.subject) {
						if (err.subject == "Unauthorized") {
							require(["views/signup/signin"], safe.trap(cb, function (view) {
								res.status(401);
								res.renderX({view: view, route: req.route.path, data: {title: "Sign In",loginForm:1}});
							}), cb);
						} else if (err.subject == "Access forbidden") {
							require(["views/common/403"], safe.trap(cb, function (view) {
								res.status(403);
								res.renderX({view: view, route: req.route.path, data: {title: "Access forbidden"}});
							}), cb);
						} else if (err.subject == "NotFound") {
							require(["views/common/404"], safe.trap(cb, function (view) {
								res.status(404);
								res.renderX({view: view, route: req.route.path, data: {title: "Page Not Found"}});
							}), cb);
						}
						else
							cb(err);
					}
					else
						cb(err);
				});
				router.use(function (err, req, res, cb) {
					self.errHandler(err);
					cb(err);
				});
				cb();
			}, cb);
		},
		getDefaultRoute:function(cb){
			cb(null,this.prefix);
		},
		init: function (wire, cb) {
			var self = this;
			wire = tson.decode(wire);

			if (!cb)
				cb = this.clientHardError;

			$.blockUI.defaults.message = "<h4>Loading ...</h4>";
			$.blockUI.defaults.overlayCSS = {
				backgroundColor: '#FFF',
				opacity: 0,
				cursor: 'wait'
			};

			this.prefix = wire.prefix;
			this.wrapErrors = wire.wrapErrors;
			this._t_cfgData = wire._t_cfgData;
			this.router = new tb.Router({
				prefix: module.uri.replace("/app/app.js", "")
			});
			this.router.on("start", function (route) {
				$.blockUI();
				self._pageLoad = {start: new Date(), route: route.route};
			});

			if (!this.mainView)
				this.mainView = new Layout({app: this});

			var mainView = this.mainView;

			this.router.use(function (req, res, next) {
				res.status = function () {};
				res.redirect = function (path, cb) {
					var req = this.req;
					cb = cb || function (err) {
								req._t_done(err);
							};
					self.router.navigateTo(path, {replace: true}, cb);
				};
				res.renderX = function (route, cb) {
					var req = this.req;
					cb = cb || function (err) {
								req._t_done(err);
							};
					self.clientRender(this, route, cb);
				};
				next();
			});
// init routes
			this.initRoutes(safe.sure(cb, function () {
				// register last chance error handler
				self.router.use(function (err, res, req, next) {
					self.clientHardError(err);
					cb(null);
				});
				// make app alive
				mainView.bindWire(wire, null, null, safe.sure(cb, function () {
					$('body').attr('data-id', (new Date()).valueOf());
				}));
			}));
		},
		clientHardError: function (err) {
			var self = this;
			if (err) {
				if (self.wrapErrors) {
					$('body').html('<div class="container signin-container"><div class="row"><div class="col-md-4 col-md-offset-4 cols-xs-12" id="signinf"><div class="signin-title">Emote!</div><form role="form"> <div class="err-case active">Oops... Something happens...<br>Please navigate to <a href="' + self.prefix + '">home</a> or contact<br> <a href="mailto:accounts@emotenow.com">accounts@emotenow.com</a> for support. </div></form></div></div></div>');
				}
				else {
					$('body').html("<div class='hard-client-error'><h1>Oops, looks like somethething went wrong.</h1><br>" +
							"We've get notified and looking on it. <b>Meanwhile try to refresh page or go back</b>.<br><br>" +
							"<pre>" + err + "\n" + err.stack + "</pre></div>");
				}
			}
		},
		clientRender: function (res, route, cb) {
			var self = this;

			// tickmark for data ready time
			this._pageLoad.data = new Date();

			// create new view, bind data to it
			var mainView = this.mainView;
			var view = new route.view({app: self});
			view.data = route.data;
			view.locals = res.locals;

			// render
			view.render(safe.sure(cb, function (text) {
				// render dom nodes and bind view
				var exViews = _.filter(mainView.views, function (v) { return v.cid != view.cid; });
				var oldView = exViews.length == 1 ? exViews[0] : undefined;
				var $dom = $(text);
				mainView.$el.append($dom);
				view.bindDom($dom, oldView);

				// remove all root views except new one and hard error (if any)
				$(".hard-client-error").remove();
				_.each(exViews, function (v) {
					v.remove();
				});

				mainView.attachSubView(view);


				// view is actually ready, finalizing
				document.title = route.data.title;
				$.unblockUI();
				$('body').attr('data-id', (new Date()).valueOf());
				if (window.Tinelic) {
					// do analytics
					self._pageLoad.dom = new Date();
					var m = {
						_i_nt: self._pageLoad.data.valueOf() - self._pageLoad.start.valueOf(),
						_i_dt: self._pageLoad.dom.valueOf() - self._pageLoad.data.valueOf(),
						_i_lt: 0,
						r: self._pageLoad.route
					};
					window.Tinelic.pageLoad(m);
				}
				window.trackPageView(window.location.pathname);
				cb(null);
			}));
		}
	});
});
