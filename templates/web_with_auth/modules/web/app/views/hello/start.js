/* global define */
define([
	'tinybone/base',
	'dustc!views/hello/start.dust'
], function (tb) {
	var view = tb.View;
	var View = view.extend({
		id: "views/hello/start",
		events: {
		}
	});
	View.id = "views/hello/start";
	return View;
});
