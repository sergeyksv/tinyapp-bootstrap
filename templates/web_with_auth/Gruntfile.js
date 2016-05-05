/*jslint node: true */
'use strict';
var _ = require('lodash');
var requirejs = require('requirejs');
requirejs.define.amd.dust = true;

module.exports = function (grunt) {

	grunt.event.once('git-describe', function (rev) {
		grunt.option('buildrev', rev);
	});

	var buildOptions = {
		baseUrl: ".",
		findNestedDependencies: true,
		removeCombined: true,
		skipDirOptimize: false,
		modules: [{
			name: "app"
		}, {
			name: "routes/main",
			exclude: [
				"app"
			]
		}],
		paths: {
			"tson": "../../tinyback/tson",
			"prefixify": "../../tinyback/prefixify",
			"tinybone": "../../tinybone",
			"lodash": "../public/js/lodash",
			"dust.core": "../public/js/dust",
			"dust.parse": "../public/js/parser",
			"dust.compile": "../public/js/compiler",
			"dustc": "../../tinybone/dustc",
			"text": "../../../node_modules/requirejs-text/text",
			"safe": "../public/js/safe",
			"moment": "../public/js/moment/moment",
			"backctx": "empty:",
			"jquery": "empty:",
			"jquery-cookie": "../public/js/jquery.cookie",
			"jquery.blockUI": "../public/js/jquery.blockUI",
			"bootstrap": "../public/js/bootstrap",
			"dust-helpers": "../public/js/dust-helpers",
			"md5": "../public/js/md5"
		},
		include: ["../views"],
		done: function (done, output) {
			console.log(output);
			done();
		}
	};
	var mBuildOptions = _.merge({}, buildOptions, {
		appDir: "./modules/web/app",
		dir: "./modules/web/public/js/build",
		config: {
			ctx: '/'
		},
		paths: {
		}
	});

	grunt.initConfig({
		requirejs: {
			compile_main: {
				options: mBuildOptions
			}
		},
		clean: {
			build: ["./modules/main/public/js/build"]
		},
		"git-describe": {
			"options": {},
			"main": {}
		},
		uglify: {}
	});

	grunt.registerTask('ensureLocalConfig', function () {
		var config = {};
		if (grunt.file.exists('local-config.js'))
			config = require("./local-config.js");
		var rev = grunt.option('buildrev').toString();
		if (config.rev != rev) {
			config.rev = rev;
			grunt.file.write('local-config.js', "module.exports=" + JSON.stringify(config, null, "\t"));
		}
	});

	grunt.registerTask('default', []);
	grunt.registerTask('build', ['git-describe', 'ensureLocalConfig', 'clean', 'requirejs:compile_main']);

	grunt.loadNpmTasks('grunt-contrib-requirejs');
	grunt.loadNpmTasks('grunt-git-describe');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-clean');
};
