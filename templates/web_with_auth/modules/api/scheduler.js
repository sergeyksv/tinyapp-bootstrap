var safe = require('safe');
var moment = require('moment');
var colors = require('colors');
var cronJob = require('cron').CronJob;

var api = {};
var ctx;

module.exports.deps = [];

module.exports.init = function (_ctx, cb) {
	ctx = _ctx;
	cb(null, {api: api});
};

var lastDate = null;
function _appError(err, name) {
	if (err) {
		if (ctx.locals.newrelic)
			ctx.locals.newrelic.noticeError(err);

		if (!lastDate || lastDate !== moment().format('YYYY-MM-DD')) {
			lastDate = moment().format('YYYY-MM-DD');
			console.log(('--------- ' + lastDate + ' ---------').bold);
		}

		if (name)
			console.log(moment().format('HH:mm:ss'), name, colors.red(err.message || err));
		else
			console.log(moment().format('HH:mm:ss'), colors.red(err.message || err));
	}
};

function _appLog(name, time) {
	if (time < 1500)
		time = time.toString();
	else if (time < 3000)
		time = time.toString().yellow;
	else
		time = time.toString().red;

	if (!lastDate || lastDate !== moment().format('YYYY-MM-DD')) {
		lastDate = moment().format('YYYY-MM-DD');
		console.log(('--------- ' + lastDate + ' ---------').bold);
	}

	console.log(moment().format('HH:mm:ss'), name.green, time + 'ms');
};

var queue = safe.queue(function(task, cb) {
	var fn = function() {
		if (ctx.locals.newrelic) {
			var _cb = cb;
			cb = function() {
				ctx.locals.newrelic.endTransaction();
				_cb.apply(this, arguments);
			};
		}

		var startTime = Date.now();
		var timer = setTimeout(function() {
			var fn = cb;
			cb = null;
			_appError(new Error("Warning! '" + task.name + "' not respond more than two minutes!"), task.name);
			fn();
		}, 120000);

		task.cmd(function(err, arg) {
			clearTimeout(timer);
			if (err)
				_appError(err, task.name);
			else if (arg != 'ofttimes')
				_appLog(task.name, Date.now() - startTime);

			if (cb)
				cb();
		});
	};

	if (ctx.locals.newrelic)
		fn = ctx.locals.newrelic.createBackgroundTransaction(task.name, fn);

	fn.apply(this, arguments);
}, 1);

api.addJob = function(name,p){
	var job = new cronJob(p.cronTime, safe.sure(_appError, function() {
		queue.push({
			cmd: p.func,
			name: name
		});
	}));
	job.start();
}
