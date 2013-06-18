//define skybox shader
var skyboxShader = {
		uniforms: { "tCube": { type: "t", value: null },
					"tFlip": { type: "f", value: -1 } },

		vertexShader: [

			"varying vec3 vWorldPosition;",

			"void main() {",

				"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
				"vWorldPosition = worldPosition.xyz;",

				"gl_Position = projectionMatrix * modelViewMatrix * vec4( position + cameraPosition, 1.0 );",

			"}"

		].join("\n"),

		fragmentShader: [

			"uniform samplerCube tCube;",
			"uniform float tFlip;",

			"varying vec3 vWorldPosition;",

			"void main() {",

				"gl_FragColor = textureCube( tCube, vec3( tFlip * vWorldPosition.x, vWorldPosition.yz ) );",

			"}"

		].join("\n")
}

function createSkyBox(skyboxname,skyboxdir) {
	//ref: http://learningthreejs.com/blog/2011/08/15/lets-do-a-sky/

	var prefix = (skyboxdir || '.')  + '/' + skyboxname + '_';
	var fmt = '.png';
	var directions = ['lf','rt','up','dn','fr','bk'];

	var urls = [];
	for (var i=0; i < directions.length; i++) {
		urls.push(prefix + directions[i] + fmt);
	}
		
	var textureCube = THREE.ImageUtils.loadTextureCube(urls);

	var shader = skyboxShader;
	shader.uniforms[ "tCube" ].value = textureCube;

	var material = new THREE.ShaderMaterial( {
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: shader.uniforms,
		depthWrite: false,
		side: THREE.BackSide

	} );

	// var mesh = new THREE.Mesh( new THREE.CubeGeometry( 100, 100, 100 ), material );

	// build the skybox Mesh 
	var skyboxMesh  = new THREE.Mesh( new THREE.CubeGeometry( 100000, 100000, 100000, 1, 1, 1, null, true ), material );
	// add it to the scene
	return skyboxMesh;
}
