/* global define */
define([
	'tinybone/base',
	'tinybone/backadapter',
	'safe',
	'lodash',
	'jquery',
	'dustc!views/signup/signin.dust'
], function (tb, api, safe, _, $) {
	var view = tb.View;
	var View = view.extend({
		id: "views/signup/signin",
		errCase: '.err-case',
		events: {
			'submit form': function (e) {
				e.preventDefault();
				var $form = $(e.currentTarget);
				var data = {
					login:$form.find("input[name='login']").val(),
					password:$form.find("input[name='password']").val()
				};
				var self = this;
				self.app.blockLayer(self.$el);
				safe.waterfall([
					function (cb) {
						api("users.login", "public", _.extend({tz:new Date().getTimezoneOffset()},data), cb);
					},
					function (t, cb) {
						$.cookie("token", t, {expires: 7, path: "/"});
						cb();
					},
					function(cb){
						self.app.getDefaultRoute(cb);
					}
				], function (err,route) {
					if(err){
						self.app.unblockLayer(self.$el);
						self.app.clientError(err,self);
					}
					else{
						window.trackEvent({category:'user_actions',action:'sign_in',label:data.login});
						setTimeout(function(){
								window.location.href = route;
						},0);
					}
				});
			}
		}
	});
	View.id = "views/signup/signin";
	return View;
});
