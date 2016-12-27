module.exports = {
	env: "dev",
	app: {
		wrapErrors: 1
	},
	mongo: {
		main: {
			db: "__NAME__",
			host: "localhost",
			port: 27017,
			scfg: {auto_reconnect: true, poolSize: 100},
			ccfg: {native_parser: true, w: 1}
		}
	},
	server: {
		port: 3000,
		ssl_port: false
	},
	monitoring: {
		tinelic: {
			enable: false,
			protocol: "https",
			host: "errbit.pushok.com",
			id: "",
			mode:"prod"
		},
		ga: {
			enable: false,
			id: ""
		}
	},
	salt: "__SALT__",
	masterpass: "__MASTERPASS__",
	upload: {
		fileTypes: ["application/pdf", "image/jpeg", "image/png"]
	},
	restapi:{}
};
