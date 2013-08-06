

	var   Class 	= require( "ee-class" )
		, log 		= require( "ee-log" )
		, Events 	= require( "ee-event" )
		, Waiter 	= require( "ee-waiter" );

	var   fs 		= require( "fs" );


	var   JSONRenderer 	= require( "./JSONRenderer" )
		, HTMLRenderer	= require( "./HTMLRenderer" );




	module.exports = new Class( {
		inherits: Events

		, methods: [ "put", "get", "options", "head", "post", "patch", "delete" ]


		
		, status: {
			  100: "Continue"
			, 101: "Switching Protocols"
			, 102: "Processing"
			, 200: "OK"
			, 201: "Created"
			, 202: "Accepted"
			, 203: "Non-Authoritative Information"
			, 204: "No Content"
			, 205: "Reset Content"
			, 204: "response"
			, 206: "Partial Content"
			, 207: "Multi-Status"
			, 208: "Already Reported"
			, 226: "IM Used"
			, 300: "Multiple Choices"
			, 301: "Moved Permanently"
			, 302: "Found"
			, 303: "See Other"
			, 304: "Not Modified"
			, 305: "Use Proxy"
			, 306: "Switch Proxy"
			, 307: "Temporary Redirect"
			, 308: "Permanent Redirect"
			, 400: "Bad Request"
			, 401: "Unauthorized"
			, 403: "Forbidden"
			, 402: "Payment Required"
			, 403: "Forbidden"
			, 404: "Not Found"
			, 405: "Method Not Allowed"
			, 406: "Not Acceptable"
			, 407: "Proxy Authentication Required"
			, 408: "Request Timeout"
			, 409: "Conflict"
			, 410: "Gone"
			, 411: "Length Required"
			, 412: "Precondition Failed"
			, 413: "Request Entity Too Large"
			, 414: "Request-URI Too Long"
			, 415: "Unsupported Media Type"
			, 416: "Requested Range Not Satisfiable"
			, 417: "Expectation Failed"
			, 418: "I'm a teapot"
			, 420: "Enhance Your Calm"
			, 422: "Unprocessable Entity"
			, 423: "Locked"
			, 424: "Method Failure"
			, 425: "Unordered Collection"
			, 426: "Upgrade Required"
			, 428: "Precondition Required"
			, 429: "Too Many Requests"
			, 431: "Request Header Fields Too Large"
			, 444: "No Response"
			, 451: "Unavailable For Legal Reasons"
			, 494: "Request Header Too Large"
			, 495: "Cert Error"
			, 496: "No Cert"
			, 497: "HTTP to HTTPS"
			, 499: "Client Closed Request"
			, 500: "Internal Server Error"
			, 501: "Not Implemented"
			, 502: "Bad Gateway"
			, 503: "Service Unavailable"
			, 504: "Gateway Timeout"
			, 505: "HTTP Version Not Supported"
			, 506: "Variant Also Negotiates"
			, 507: "Insufficient Storage "
			, 508: "Loop Detected"
			, 509: "Bandwidth Limit Exceeded"
			, 510: "Not Extended"
			, 511: "Network Authentication Required"
			, 598: "Network read timeout error"
			, 599: "Network connect timeout error"
		}


		, controllers: {}
		, renderers: {}
		, defaultRenderer: null


		, init: function( options ){
			this.path = options.path || "";
			this.controllerOptions = options.options || {};
			this.controllerOptions.controllers = this.controllers;

			// add trailing slash
			if ( this.path.length > 0 && this.path[ this.path.length -1 ] !== "/" ) this.path += "/";

			// add a default renderer
			this.addRenderer( "Application/JSON", new JSONRenderer(), true );
			this.addRenderer( "Text/HTML", new HTMLRenderer() );

			// load rest entites from filesystem
			this.load( function(){
				log.info( "REST controllers [" + this.path + "] loaded ..." );
				this.emit( "load" );
			}.bind( this ) );
		}





		, load: function( callback ){
			this.loadRestInterface( callback );
		}




		, loadDir: function( path, subtree, callback ){
			fs.exists( path, function( exists ){
				if ( !exists ) {
					log.warn( "REST directory [" + path + "] does not exist!" );
					callback();
				}
				else {
					fs.readdir( path, function( err, files ){
						if ( err ) {
							log.error( err );
							callback( err );
						}
						else if ( !files  || files.length === 0 ) callback();
						else {
							var waiter = new Waiter();

							files.forEach( function( file ){								
								waiter.add( function( cb ){
									fs.stat( path + file, function( err, stats ){ 
										if ( err ) {
											log.warn( "failed to stat [" + path + "]!" );
											cb();
										}
										else {
											if ( stats.isDirectory() ){
												subtree[ file ] = {};
												this.loadDir( path + file, subtree[ file ], cb );
											}
											else {
												if ( /\.js$/gi.test( file ) ){
													try { 
														// load base class for resource
														subtree[ file.replace( /\.js$/, "" ).toLowerCase() ] = new ( require( path + file ) )( this.controllerOptions );											
													} catch ( err ){
														log.warn( "failed to load rest resource [" + file.replace( /\.js$/, "" ).toLowerCase() + "]" );
														log.trace( err );
													}
												}					
											}
										}
									}.bind( this ) );
								}.bind( this ) );											
							}.bind( this ) );

							waiter.start( callback );
						}
					}.bind( this ) );
				}
			}.bind( this ) );
		}




		// load rest classes
		, loadRestInterface: function( callback ){
			this.loadDir( this.path, this.controllers, callback );
		}



		, addRenderer: function( contentType, renderer, isDefault ){
			if ( isDefault ) this.defaultRenderer = renderer;
			this.renderers[ contentType.toLowerCase() ] = renderer;
		}



		, contentTypeNegation: function( request, response, callback ){
			var accept = request.getHeader( "accept", true ), contentType;

			if ( accept ){
				for( var i = 0, l = accept.length; i < l; i++ ){
					contentType = accept[ i ].key.toLowerCase() + "/" + accept[ i ].value.toLowerCase();

					if ( contentType === "*/*" ) break;
					else if ( this.renderers[ contentType ] ){
						callback( this.renderers[ contentType ], false );
						return;
					}
				}
			}			

			callback( this.defaultRenderer, true );
		}



		, findController: function( parts, query, tree ){
			if ( parts.length === 0 ) return null;
			else {
				if ( tree.hasOwnProperty( parts[ 0 ] ) ){
					// controller exists
					
					if ( parts.length === 1 ){
						// entity without id
						return tree[ parts[ 0 ] ];
					}
					else if ( parts.length === 2 ){
						// entity with id
						if ( tree.hasOwnProperty( parts[ 0 ] + "-resource" ) ){
							query.id = parts[ 1 ];
							return tree[ parts[ 0 ] + "-resource" ];
						}
						else return null;
					}
					else {
						// subentity
						query[ parts[ 0 ] ] = parts[ 1 ];
						this.findController( parts.slice( 2 ), query, tree[ parts[ 0 ] ] );
					}
				}
			}
		}



		, request: function( request, response, next ){		
			var   parts 		= request.pathname.split( "/" ).filter( function( p ){ return p.length > 0; } )
				, query 		= request.query
				, controller 	= this.findController( parts, query, this.controllers );


			if ( !controller && this.controllers[ "root" ] ) controller = this.controllers[ "root" ];


			// rest call
			if ( controller ){

				// supported method
				if ( this.methods.indexOf( request.method ) === -1 ) response.render( null, {}, 501 );
				else {

					// get renderer 
					this.contentTypeNegation( request, response, function( renderer, isDefaultRenderer ){

						// attach render hook
						response.render = function( data, headers, statusCode ){
							if ( !isDefaultRenderer ) {
								if ( !statusCode ) statusCode = 200;
								if ( !data ) data = {};

								renderer.render( data, request, response, function( renderedData ){
									response.sendUncompressed( renderedData, headers, statusCode );
								} );
							}
							else response.send( "", {}, 406 );
						}.bind( this );


						// method supported by controller?
						if ( typeof controller[ request.method ] === "function" ){

							// invoke the controller
							controller[ request.method ]( request, response, next );
						}
						else {
							var allow = [ "options" ].concat( this.methods ).filter( function( method ){
								return typeof controller[ method ] === "function";
							} ).join( ", " ).toUpperCase();

							response.render( null, { Allow: allow }, request.method === "options" ? 200 : 405 );
						}
					}.bind( this ) );
				}
			}

			else next();
		}
	} );