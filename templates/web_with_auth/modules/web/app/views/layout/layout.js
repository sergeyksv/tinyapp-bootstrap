define([
	'tinybone/base',
		
	'dustc!views/layout/layout.dust',
	'dustc!views/base.dust'
], function (tb) {
	var view = tb.View;
	var View = view.extend({
		rctx: '/teacher',
		id: 'views/layout/layout',
		render: function (cb) {
			view.prototype.render.call(this, cb);
		},
		events: {
			"click a": function (e) {
				e.preventDefault();
				var href = $(e.currentTarget).attr('href');
				if (href && href.length)
					this.app.router.navigateTo($(e.currentTarget).attr('href'), this.app.errHandler);
			}
		}
	});
	View.id = 'views/layout/layout';
	return View;
});
