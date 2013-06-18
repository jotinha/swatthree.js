var MAP = 'missiona'

var clock = new THREE.Clock();

// RENDERER
var renderer = new THREE.WebGLRenderer( { antialias: false } );
renderer.gammaInput = true;
renderer.gammaOutput = true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColorHex( 0xffffff, 1.0 );

document.getElementById('3dview').appendChild( renderer.domElement );

// CAMERA
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 10, 100000 );
camera.position.set(-100,0,0);

// CONTROLS
var cameraControls = new THREE.OrbitAndPanControls(camera, renderer.domElement);
//var cameraControls = new THREE.PointerLockControls(camera);

cameraControls.target.set(0,0,0);
// cameraControls.movementSpeed = 100.0;
// cameraControls.lookSpeed = 1;

	
var scene = new THREE.Scene();
GLOBALSCENE = scene;
    
// LIGHTS
var ambientLight = new THREE.AmbientLight( 0xffffff );

scene.add(ambientLight);
// scene.add(light);
// scene.add(light2);

// //simulation box
// var box = new THREE.Mesh(
// 	new THREE.CubeGeometry(1,1,1,1,1,1),
// 	new THREE.MeshBasicMaterial({
// 		color: 0xaaaaaa,
// 		shading: THREE.FlatShading,
// 		wireframe: true,
// 		wireframeLinewidth: 5.0,
// 	}));
// box.position.set(0.5,0.5,0.5);
// scene.add(box);


function animate() {
	window.requestAnimationFrame(animate);
/*	c60.rotation.y += 0.01;
	c60.rotation.z += 0.015;
	c60.rotation.x += 0.005;*/
	render();
}

function render() {
	var delta = clock.getDelta();
	cameraControls.update(delta);
/*
	if ( effectController.newGridX !== gridX || effectController.newGridY !== gridY || effectController.newGridZ !== gridZ || effectController.newGround !== ground || effectController.newAxes !== axes)
	{
		gridX = effectController.newGridX;
		gridY = effectController.newGridY;
		gridZ = effectController.newGridZ;
		ground = effectController.newGround;
		axes = effectController.newAxes;

		fillScene();
	}*/
	
	renderer.render(scene, camera);
}

var ws = new THREE.Object3D();
	
var material = new THREE.MeshBasicMaterial({
	color: 0xaaaaaa,
	shading: THREE.SmoothShading,
	wireframe: false,
	wireframeLinewidth: 5.0,
	specular : 0xffffff,
	shininess: 100,
});

var wsgeom = new THREE.Geometry()

function interpretFace(f) {
	function makeColor(rgba) {
		return new THREE.Color("rgba(" + rgba.join(',') + ")");
	}
	if (f.length !== 7 && f.length !== 10) {
		throw 'face does not proper number of elemens. f:' + f;
	}
	//interpret face from json
	return {
		nverts: 3,
	
		vertIdxs: [f[0],f[1],f[2]],

		uvIdxs: [f[3],f[4],f[5]],

		materialIdx: f[6],
		
		vertexColors: f.length > 7 ? 
			[makeColor(f[7]),makeColor(f[8]),makeColor(f[9])] :
			undefined,

		normal: new THREE.Vector3(0,0,0)	//TODO

	}
}

$.getJSON("./" + MAP + ".json", function(data) {
	for (var v=0; v < data.verts.length; v++) {
		wsgeom.vertices.push( new THREE.Vector3(
			data.verts[v][0],
			data.verts[v][1],
			-data.verts[v][2]
			));
	}
	wsgeom.faceVertexUvs = [[],[]];
	
	for (var f=0; f < data.faces.length; f++) {
		face = interpretFace(data.faces[f]);

		wsgeom.faces.push( new THREE.Face3(
			face.vertIdxs[0],
			face.vertIdxs[1],
			face.vertIdxs[2],
			face.normal,
			face.vertexColors,
			face.materialIdx
			//data.materialIdxs[f] >= 0 ? data.materialIdxs[f] : undefined
			//data.face2surf[f]		//use this one when there is one material for each surface (when using lightmaptextures)
			));
		function createUV(uvidx) {
			return new THREE.Vector2(data.uvs[uvidx][0],data.uvs[uvidx][1]);
		}

		function createUV2(uvidx,floats,floats2) {
			return new THREE.Vector2(data.uvs[uvidx][0]*floats[0]+floats[2],
									 data.uvs[uvidx][1]*floats[1]+floats[3]
									 );
		/*return new THREE.Vector2(floats2[0]*(floats[0]+floats[2]),
								 floats2[1]*(floats[1]+floats[3])
									 );*/
/*			return new THREE.Vector2(data.uvs[uvidx][0],
									 data.uvs[uvidx][1]
									 );
*/
		}


		//wsgeom.faceVertexUvs[0] = [];	//reset
		wsgeom.faceVertexUvs[0].push(
			[
				createUV(face.uvIdxs[0]),
				createUV(face.uvIdxs[1]),
				createUV(face.uvIdxs[2]),
			]);

		// wsgeom.faceVertexUvs[0].push(data.faceVertexUvs[f]);
		//uv2 for lightmaps
		wsgeom.faceVertexUvs[1].push(
			[
				createUV2(face.uvIdxs[0],data.surf_lmap_floats[data.face2surf[f]],data.surf_unk_floats[data.face2surf[f]]),
				createUV2(face.uvIdxs[1],data.surf_lmap_floats[data.face2surf[f]],data.surf_unk_floats[data.face2surf[f]]),
				createUV2(face.uvIdxs[2],data.surf_lmap_floats[data.face2surf[f]],data.surf_unk_floats[data.face2surf[f]]),
			]);
		wsgeom.uvsNeedUpdate = true;
	}

	function createTexture(path) {
		var img = new Image();
		img.src = path;
		var tex = new THREE.Texture(img);
		//by default in THREE.js, textures are scamgled. We don't want that.
		tex.wrapS = THREE.RepeatWrapping;	
		tex.wrapT = THREE.RepeatWrapping;
		tex.flipY = false;
		img.onload = function() {
			tex.needsUpdate = true;
		}
		return tex;
	}

	var textures = [];
	for (var t=0; t < data.textures.length; t++) {
		textures.push(createTexture(data.textures[t]));
	}

	var materials = []
	for (var m=0; m < data.materials.length; m++){
		options = {
			color:0xffffff,
			map: textures[data.materials[m][0]],
			lightMap: textures[data.materials[m][1]],		//this will return undefined if data.materials[i] is length 1 (no lmap)
			side: THREE.BackSide,
			shading: THREE.FlatShading,
		}
		var mat;
		if (data.materials[m][2] < 255) {		//alpha
			options.opacity = data.materials[m][2] / 255;
			options.transparent = true;
		}

		if (data.materials[m][3]) { //use vertex colors or not
			options.vertexColors = true;

		} 

		if (options.vertexColors === undefined) {
			mat = new THREE.MeshBasicMaterial(options);
		} else {
			options.ambient = 0x404040;		//this is multiplied by ambientLight (which is white)
			mat = new THREE.MeshLambertMaterial(options);
		}
		materials.push(mat);
	}

	wsgeom.computeFaceNormals();
	wsgeom.computeVertexNormals()
	wsgeom.computeCentroids();
	wsgeom.computeVertexNormals();
	multipleMaterials = new THREE.MeshFaceMaterial(materials);
	wsmesh = new THREE.Mesh(wsgeom,multipleMaterials);
	scene.add(wsmesh);
	animate();
});

