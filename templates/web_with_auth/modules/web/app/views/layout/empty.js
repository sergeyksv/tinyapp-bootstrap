/* global define */
define([
	'tinybone/base',
	'dustc!views/layout/empty.dust'
], function (tb) {
	var view = tb.View;
	var View = view.extend({
		id: 'views/layout/empty'		
	});
	View.id = 'views/layout/empty';
	return View;
});
