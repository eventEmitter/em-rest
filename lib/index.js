

	var   Class 	= require( "ee-class" )
		, log 		= require( "ee-log" )
		, Events 	= require( "ee-event" )
		, Waiter 	= require( "ee-waiter" );

	var   fs 		= require( "fs" );


	var   JSONRenderer 	= require( "./JSONRenderer" )
		, HTMLRenderer	= require( "./HTMLRenderer" )
		, Responder 	= require( "./Responder" );




	module.exports = new Class( {
		inherits: Events

		, methods: [ "put", "get", "options", "head", "post", "patch", "delete" ]
		, controllers: {}
		, renderers: {}
		, contentTypes: []
		, contentTypeReg: new RegExp( "a{99}", "gi" )
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
			if ( isDefault ) {
				if ( this.defaultRenderer ) this.defaultRenderer.isDefault = false;
				this.defaultRenderer = renderer;
				renderer.isDefault = true;
			}

			this.contentTypes.push( contentType );
			this.contentTypeReg = new RegExp( "(" + this.contentTypes.join( "|" ) + ")", "gi" );

			this.renderers[ contentType.toLowerCase() ] = renderer;
		}



		, contentTypeNegation: function( request, response ){			
			var result;
			
			if ( result = this.contentTypeReg.exec( request.getHeader( "accept" ) || "" ) ){
				this.contentTypeReg.lastIndex = 0;
				return this.renderers[ result[ 1 ].toLowerCase() ];
			}		
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
				if ( this.methods.indexOf( request.method ) === -1 ) response.send( 501 );
				else {

					new Responder( { 
						  request		: request
						, response 		: response
						, next 			: next
						, parent 		: this
						, controller 	: controller 
					} );
				}
			}

			else next();
		}
	} );