/* global define */
define([
	'require',
	'safe',
	'lodash',
	'moment',
	'tinybone/backadapter'
], function (requirejs, safe, _, moment, api) {
	return {
		index: function (req, res, cb) {
			safe.parallel({
				view: function (cb) {
					requirejs(['views/hello/start'], function (view) {
						safe.back(cb, null, view);
					}, cb);
				}
			}, safe.sure(cb, function (r) {
				res.renderX({
					view: r.view,
					data: {
						title: 'Hello World'
					}
				});
			}));
		},
	};
});
