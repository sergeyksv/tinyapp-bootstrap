module.exports = {
	env: "dev",
	app: {
		wrapErrors: 1
	},
	mongo: {
		main: {
			db: "test1",
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
	salt: "Xssv05gmGUFi9Kb9jsMG0x4U9jE3buu1",
	masterpass: "vj2Fd8vKZmISM13efUmnjjkLRQ8xr862",
	upload: {
		fileTypes: ["application/pdf", "image/jpeg", "image/png"]
	},
	restapi:{}
};
