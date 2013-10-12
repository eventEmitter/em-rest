


	var   Class  	= require( "ee-class" )
		, type 		= require( "ee-types" )
		, log 		= require( "ee-log" );




	module.exports = new Class( {


		init: function( options ){
			this.request 		= options.request;
			this.response 		= options.response;
			this.next 			= options.next;
			this.parentClass 	= options.parent;
			this.controller 	= options.controller;

			// prepare
			this.prepare();
		}



		, prepare: function(){
			var renderer = this.parentClass.contentTypeNegation( this.request, this.response );

			if ( !renderer ) this.response.send( 406 );
			else {
				this.renderer = renderer;
				this.response.render = this.render.bind( this );
				
				// method supported by controller?
				if ( typeof this.controller[ this.request.method ] === "function" ){

					// invoke the controller
					this.controller[ this.request.method ]( this.request, this.response, this.next );
				}
				else {
					var allow = [ "options" ].concat( this.parentClass.methods ).filter( function( method ){
						return typeof this.controller[ method ] === "function";
					} ).join( ", " ).toUpperCase();

					this.response.render( { Allow: allow }, request.method === "options" ? 200 : 405 );
				}
			}
		}



		, render: function(){
			var data;

			Array.prototype.slice.call( arguments, 0 ).forEach( function( arg ){
				switch ( type( arg ) ){
					case "number":
						this.statusCode = arg;
						break;
					case "array":
						if ( !data ) data = arg;
						else throw new Error( "invalid argument!" );
					case "object":
						if ( !data ) data = arg;
						else this.headers = arg;
						break;
					default:
						throw new Error( "invalid argument!" );
				}
			}.bind( this ) );


			if ( !this.statusCode ) this.statusCode = 200;
			if ( !data ) data = {};

			this.renderer.render( data, this.request, this.response, this._send.bind( this ) );
		}



		, _send: function( renderedData ){
			this.response.send( renderedData, this.headers, this.statusCode );
		}
	} );