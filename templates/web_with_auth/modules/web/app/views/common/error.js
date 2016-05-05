define([
	'tinybone/base',
		
	'dustc!views/common/error.dust'
], function (tb) {
	var View = tb.View.extend({
		rctx:'/teacher',
		id: 'views/common/error'
	});
	View.id = 'views/common/error';
	return View;
});