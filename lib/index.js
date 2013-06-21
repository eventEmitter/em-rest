

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



		// load rest classes
		, loadRestInterface: function( callback ){
			fs.exists( this.path, function( exists ){
				if ( !exists ) {
					log.warn( "REST directory [" + this.path + "] does not exist!" );
					callback();
				}
				else {
					fs.readdir( this.path, function( err, files ){
						if ( err ) {
							log.error( err );
							callback( err );
						}
						else if ( !files  || files.length === 0 ) callback();
						else {
							var waiter = new Waiter();

							files.forEach( function( file ){
								if ( /\.js$/gi.test( file ) ){
									waiter.add( function( cb ){
										try {
											// load base class for resource
											this.controllers[ file.replace( /\.js$/, "" ).toLowerCase() ] = new ( require( this.path + file ) )( this.controllerOptions );											
										} catch ( err ){
											log.warn( "failed to load rest resource [" + file.replace( /\.js$/, "" ).toLowerCase() + "]" );
											log.trace( err );
										}

										cb();
									}.bind( this ) );
								}								
							}.bind( this ) );

							waiter.start( callback );
						}
					}.bind( this ) );
				}
			}.bind( this ) );
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





		, request: function( request, response, next ){
			var call = /^\/([^\/]+)(\/?)(.*)$/gi.exec( request.pathname ), controller;


			// rest call
			if ( call && call.length === 4 ){

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


					// supported method?
					if ( this.methods.indexOf( request.method ) === -1 ) response.render( null, {}, 501 );
					else {
						if ( call[ 2 ] === "" && this.controllers.hasOwnProperty( call[ 1 ].toLowerCase() ) ) controller = this.controllers[ call[ 1 ].toLowerCase() ];
						else if ( this.controllers.hasOwnProperty( call[ 1 ].toLowerCase() + "-resource" ) ) controller = this.controllers[ call[ 1 ].toLowerCase() + "-resource" ];
						else return next();


						// method supported by controller?
						if ( controller[ request.method ] ){

							// invoke the controller
							controller[ request.method ]( request, response, next );
						}
						else {
							if ( request.method === "options" ){
								var allow = [ "options" ].concat( this.methods ).filter( function( method ){
									return !!controller[ method ];
								} );
								response.render( null, { Allow: allow } );
							}
							else response.render( null, {}, 501 );
						}
					}
				}.bind( this ) );
			}

			// root  ( list resources )
			else if ( request.pathname === "/" && this.controllers.root && this.controllers.root.get ){
				this.controllers.root.get( request, response, next );
			}

			else next();
		}
	} );