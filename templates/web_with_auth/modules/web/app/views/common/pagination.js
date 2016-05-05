/* global define */
define([
	'tinybone/base',
	'lodash',
	'dustc!views/common/pagination.dust'
], function (tb, _) {
	var view = tb.View;
	var View = view.extend({
		id: "views/common/pagination",
		preRender:function(){
			this.data = {};
			var cnt = _.get(this.locals,"cnt",0);
			var pages = Math.ceil(cnt / _.get(this.locals,"per_page",10));
			if(pages > 1){
				this.data.pagination = getPagination(_.get(this.locals,"page",0),pages,cnt);
				var queryString = param(_.omit(this.locals.req.query,"page"));
				this.data.pagination.baseUrlWithQueryString = this.locals.req.baseUrl + this.locals.req.path + "?"+ (queryString ? queryString + "&" : "");
			}
			view.prototype.preRender.call(this);
		},
		events:{
			"click .disabled a":function(e){
				e.preventDefault();
				e.stopPropagation();
			}
		}
	});
	View.id = "views/common/pagination";
	return View;

	function getPagination(page, pages, count) {
		page = parseInt(page, 10) || 0;
		pages = parseInt(pages, 10) || 0;

		if (pages < 2)
			return false;

		var limit = 7,
			middle = 4,
			start = 0,
			end = pages,
			i,
			pg = {pages: [], count: count};

		if (page === 0)
			pg.first = 1;
		else
			pg.prev = page - 1;

		if (page === (pages - 1))
			pg.last = 1;
		else
			pg.next = page + 1;

		if (pages <= limit) {
			for (i = 0; i < pages; i++) {
				pg.pages.push({ page: i, label: (i + 1), active: (i === page)});
			}

			return pg;
		}

		start = page - middle;
		end = page + middle;

		if (end - start < limit) {
			start = end - limit;
		}

		if (start < 0) {
			start = 0;
			end = start + limit;
		}

		if (end > pages) {
			end = pages;
			start = end - limit;
			if (start < 0)
				start = 0;
		}

		pg.pages.push({page: 0, label: 1, active: (0 === page)});

		if (pages > limit && page > middle) {
			pg.pages.push({ page: start, label: '...', active: false, delimiter: 1 });
			start++;
		}

		for (i = start + 1; i < end - 1; i++) {
			pg.pages.push({ page: i, label: (i + 1), active: (i === page) });
		}

		if (pages > limit && page < pages - middle) {
			if (i === pages - 2)
				pg.pages.push({ page: i, label: (i + 1), active: (i === page)});
			else
				pg.pages.push({ page: pages - 2, label: '...', active: false, delimiter: 1 });
		}

		pg.pages.push({ page: pages - 1, label: pages, active: (pages - 1 === page)});

		if (pages > limit) {
			if (pg.pages[1].delimiter)
				pg.pages[2].xshid = 1;

			if (pg.pages[pg.pages.length - 2].delimiter)
				pg.pages[pg.pages.length - 3].xshid = 1;
		}

		return pg;
	};
	var r20 = /%20/g,
		rbracket = /\[\]$/;

	function param( a, traditional) {
		var prefix,
			s = [],
			add = function( key, value ) {
				// If value is a function, invoke it and return its value
				value = _.isFunction( value ) ? value() : ( value == null ? "" : value );
				s[ s.length ] = encodeURIComponent( key ) + "=" + encodeURIComponent( value );
			};
		// If an array was passed in, assume that it is an array of form elements.
		if ( _.isArray( a )) {
			// Serialize the form elements
			_.each( a, function(v,k) {
				add( k,v);
			});

		} else {
			// If traditional, encode the "old" way (the way 1.3.2 or older
			// did it), otherwise encode params recursively.
			for ( prefix in a ) {
				buildParams( prefix, a[ prefix ], traditional, add );
			}
		}

		// Return the resulting serialization
		return s.join( "&" ).replace( r20, "+" );
	};
	function buildParams( prefix, obj, traditional, add ) {
		var name;

		if ( _.isArray( obj ) ) {
			// Serialize array item.
			_.each( obj, function( v, i ) {
				if ( traditional || rbracket.test( prefix ) ) {
					// Treat each array item as a scalar.
					add( prefix, v );

				} else {
					// Item is non-scalar (array or object), encode its numeric index.
					buildParams( prefix + "[" + ( typeof v === "object" ? i : "" ) + "]", v, traditional, add );
				}
			});

		} else if ( !traditional && _.isPlainObject(obj) ) {
			// Serialize object item.
			for ( name in obj ) {
				buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
			}

		} else {
			// Serialize scalar item.
			add( prefix, obj );
		}
	}
});
