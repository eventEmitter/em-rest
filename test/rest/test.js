

	var Class = require( "ee-class" );



	module.exports = new Class( {


		get: function( request, response, next ){
			response.render( { hi: "ho" } );
		}
	} );