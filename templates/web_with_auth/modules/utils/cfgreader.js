"use strict";

var path = require('path'),
	_ = require('lodash');

module.exports.readConfig = function(cb) {
	var dirPath = __dirname + "/../../",
		mcfg = require(path.resolve(dirPath, "config.js")),
		lcfg = require(path.resolve(dirPath, "local-config.js"));

	mcfg =  _.merge({}, mcfg, lcfg);
	if(mcfg.monitoring.tinelic.enable && !mcfg.app.autotest){
		process.env['NEW_RELIC_HOME'] = path.resolve(dirPath + 'config/', "nr");
		process.env['NEW_RELIC_APP_NAME'] = mcfg.monitoring.tinelic.id;
		process.env['NEW_RELIC_HOST'] = mcfg.monitoring.tinelic.host;
		mcfg.__newrelic = require('newrelic');
	}

	if (mcfg.app.production) {
		process.env['NODE_ENV'] = "production";
	} else if (mcfg.app.test) {
		process.env['NODE_ENV'] = "test";
	} else {
		process.env['NODE_ENV'] = "development";
	}
	if (cb) // async call
		cb(null, mcfg);
	else // sync call
		return mcfg;
};
