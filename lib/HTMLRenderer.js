

	var Class = require( "ee-class" );



	module.exports = new Class( {


		render: function( data, request, response, callback ){
			response.setHeader( "Content-Type", "text/html; charset=UTF-8" );
			callback( '<html><head><script>\ndocument.write(JSON.stringify(JSON.parse(\'' + JSON.stringify( data ) + '\'),undefined,4).replace(/\\n/g,"<br>").replace(/\\s/g,"&nbsp;"));\n</script></head><body></body></html>' );
		}

	} );