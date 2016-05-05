define([
	'tinybone/base',
	'dustc!views/common/404.dust'
], function (tb) {
	var view = tb.View;
	var View = view.extend({
		id: "views/common/404",
		postRender:function(){
			setTimeout(function(){
				this.app.router.navigateTo(this.app.prefix,{replace:true});
			}.bind(this),800);
		}
	});
	View.id = "views/common/404";
	return View;
});
