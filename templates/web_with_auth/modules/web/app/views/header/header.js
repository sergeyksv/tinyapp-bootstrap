/* global define */
define([
	'lodash',
	'tinybone/base',
	'tinybone/backadapter',
	'safe',
	'jquery',
	'bootstrap',
	'dustc!views/header/header.dust'
], function (_, tb, api, safe, $) {
	var view = tb.View;
	var View = view.extend({
		id: 'views/header/header',
		postRender: function () {
			view.prototype.postRender.call(this);
		},
		render: function (cb) {
			view.prototype.render.call(this, cb);
		},
		events: {
			// go to the roster
			'click .logout': function () {
				var self = this;
				api("users.logout",  self.app.getToken(), {}, safe.sure(self.app.errHandler,function(){
					self.app.clearToken();
					api.invalidate();
					setTimeout(function () {
						window.location.reload();
					}, 0);
				}));
				return false;
			}
		}
	});
	View.id = 'views/header/header';
	return View;
});
