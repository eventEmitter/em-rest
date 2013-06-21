

	var Class = require( "ee-class" );



	module.exports = new Class( {


		render: function( data, request, response, callback ){
			response.setHeader( "Content-Type", "Application/JSON" );
			callback( JSON.stringify( data ) );
		}

	} );