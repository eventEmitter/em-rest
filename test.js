


	var   Webservice 	= require( "../ee-webservice" )
		, Rest 			= require( "./" );



	var service = new Webservice( {
		webserver: {
			http: {
				  interface: 	Webservice.Webserver.IF_ANY 
				, port: 		12001
			}
		}
	} );


	service.use( new Rest( {
		path: __dirname + "/test/rest"
	} ) );


	service.listen();

