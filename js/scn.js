function createScn(scndata) {

	var scnObj = new THREE.Object3D();

	var textures = [];
	for (var t=0; t < scndata.textures.length; t++) {
		textures.push(createTexture('./res/' + scndata.textures[t]));
	}

	var lightmaps = [];
	for (var l=0; l < scndata.lightmaps.length; l++) {
		lightmaps.push(createTexture('./res/' + scndata.lightmaps[l]));
	}

	//load solids

	for (var s=0; s < scndata.solids.length; s++) {
		var solidMesh = createSolid(scndata.solids[s],textures,lightmaps);
		scnObj.add(solidMesh);
	}

	scnObj._n_solids = scnObj.children.length;

	return scnObj;

}


function createSolid(data,textures,lightmaps) {

	var geom;
	var n_cells = data.cells.length || 1;

	var solid = new THREE.Object3D();


	//create vertex list
	var vertices = [];
	for (var v=0; v < data.verts.length; v++) {
		vertices.push( new THREE.Vector3(
			data.verts[v][0],
			data.verts[v][1],
			-data.verts[v][2]
			));
	}
	solid._allVertices = vertices;
 
 	//one mesh and geometry per cell
	var geoms = []
	for (var icell=0; icell < n_cells; icell++) {
		geom = new THREE.Geometry();
		geom.vertices = vertices;
		geom.faceVertexUvs = [[],[]];		//2 sets of uv's

		geoms.push(geom);
	}


	//create faces
	solid._allFaces = [];
	for (var f=0; f < data.faces.length; f++) {
		var face = interpretFace(data.faces[f]);
		
		//select the appropriate cell
		var cidx = face.cellIdx >= 0 ? face.cellIdx : 0;

		geom = geoms[cidx];

		var theface =  new THREE.Face3(
			face.vertIdxs[0],
			face.vertIdxs[1],
			face.vertIdxs[2],
			face.normal,
			face.vertexColors,
			face.materialIdx
			);

		solid._allFaces.push(theface);	//keep a reference here too
		
		geom.faces.push(theface);
		geom.faceVertexUvs[0].push(
			[
				createUV(data.uvs,face.uvIdxs[0]),
				createUV(data.uvs,face.uvIdxs[1]),
				createUV(data.uvs,face.uvIdxs[2]),
			]);

		//uv2 for lightmaps
		geom.faceVertexUvs[1].push(
			[
				createUV(data.uvs,face.uvIdxs[0],face.lmapUvMults),
				createUV(data.uvs,face.uvIdxs[1],face.lmapUvMults),
				createUV(data.uvs,face.uvIdxs[2],face.lmapUvMults),
			]);
		geom.uvsNeedUpdate = true;
	}

	var materials = [];
	for (var m=0; m < data.materials.length; m++){
		var options = {
			color:0xffffff,
			map: textures[data.materials[m][0]],
			lightMap: lightmaps[data.materials[m][1]],		//this will return undefined if data.materials[i] is length 1 (no lmap)
			side: THREE.BackSide,
			shading: THREE.FlatShading,
			//transparent: true		//enable for all, so we get alpha channel transparency (does it affect performance? it messes up z-ordering for some transparent surfaces)
		}

		var mat;

		//check if material was tga (ie, contained alpha channel)
		if (options.map.wasTga) {
			options.transparent = true;
		}

		if (data.materials[m][2] < 255) {		//alpha
			options.opacity = data.materials[m][2] / 255;
			//this sort of fixes the problem we had with z-depth sorting 
			//of transparent textures. Sometimes we have almost transparent 
			//(probably invisible) textures which are in fron of alpha-channel
			// textures and these get z sorted wrong due to the way webgl works
			// So we just make these not rendered at all, and hopefully this
			//will work most of the times
			if (options.opacity < 0.01) {
				options.visible = false;
			} else {
				options.transparent = true;
			}

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
	var multipleMaterials = new THREE.MeshFaceMaterial(materials);

	
	//one mesh per cell
	for (var icell=0; icell < n_cells; icell++) {
		geom = geoms[icell];
		geom.computeFaceNormals();
		geom.computeVertexNormals();
		geom.computeCentroids();
		geom.computeBoundingBox()
		solid.add( new THREE.Mesh(geom,multipleMaterials));
	}

	
	//return mesh
	return solid;

}

function interpretFace(f) {
	function makeColor(rgba) {
		return new THREE.Color("rgba(" + rgba.join(',') + ")");
	}
	if (f.length !== 12 && f.length !== 15) {
		throw 'face does not have proper number of elemens. f:' + f;
	}
	//interpret face from json
	return {
		nverts: 3,
	
		vertIdxs: [f[0],f[1],f[2]],

		uvIdxs: [f[3],f[4],f[5]],

		lmapUvMults : [f[6],f[7],f[8],f[9]],
		
		materialIdx: f[10],

		cellIdx: f[11],
		
		vertexColors: f.length > 12 ? 
			[makeColor(f[12]),makeColor(f[13]),makeColor(f[14])] :
			undefined,

		normal: new THREE.Vector3(0,0,0)	//TODO

	}
}

function readVertex(v) {
	return new THREE.Vector3(v[0],v[1],-v[2]);
}

function readPlane(p) {
	return new THREE.Plane(readVertex(p),p[3]);
}

function readBBox(data) {
	var min = readVertex(data[0]);
	var max = readVertex(data[1]);
	//actually, we have to invert swap the z component because we changed signs
	var tmp = min.z;
	min.z = max.z;
	max.z = tmp;
	return new THREE.Box3(min,max);
}

function readPlane(data) {
	return new THREE.Plane(readVertex(data),data[3]);
}


function createTexture(path) {
	//var tex = THREE.ImageUtils.loadTexture()
	var img = new Image();
	img.src = path;
	var tex = new THREE.Texture(img);
	//by default in THREE.js, textures are clamped. We don't want that.
	tex.wrapS = THREE.RepeatWrapping;	
	tex.wrapT = THREE.RepeatWrapping;
	tex.flipY = false;
	tex.wasTga = path.indexOf('.tga') !== -1
	img.onload = function() {
		tex.needsUpdate = true;
	}
	return tex;
}

function createUV(uvlist,uvidx,mults) {
	var u = uvlist[uvidx][0];
	var v = uvlist[uvidx][1];
	if (mults !== undefined) {
		u = u*mults[0] + mults[2];
		v = v*mults[1] + mults[3];
	}

	return new THREE.Vector2(u,v);
}

var _iterateAllScnMaterials = function(callback) {
	
	for (var c=0; c < scn._n_solids; c++) {
		//because the material is shared between all cells in the solid,
		// we must only apply function to one of the cells
		var cell = scn.children[c].children[0];
		if (cell.material instanceof THREE.MeshFaceMaterial) {
			for (var m = 0; m < cell.material.materials.length; m++) {
				var material = cell.material.materials[m];
				callback(material);

				material.needsUpdate = true;
				
			}

		} else {
			throw "expected material of type MeshFaceMaterial";
		}

		
	}
};


function readOriginStr(str) {

	if (typeof str !== "string") {
		throw 'expected string';
	}

	var s = str.split(' ');
	
	if (s.length !== 3) {
		throw 'invalid input string: ' + str;
	}

	var pos = new THREE.Vector3();

	pos.x = readFloatStr(s[0]);
	pos.y = readFloatStr(s[1]);	
	pos.z = readFloatStr(-s[2]);	

	return pos;
}

function readFloatStr(s) {
	var f = parseFloat(s);
	if (isNaN(f)) {
		throw 'error parsing float: ' + f;
	}
	return f;
}


var createDecal = function() {

	var _loadedSprites = {};
	var axis = new THREE.Vector3();
	var a = new THREE.Vector3(0,0,1);
	var plane = new THREE.Plane();

	return function(ent,bsp) {
		//create a simpe square face of side 1 facing positive z
	
		var texname = ent.Sprite;
		if (!texname) return;

		var texture = _loadedSprites[texname];

		if (texture === undefined) {
			//we assume all sprites were .tga
		 	texture = createTexture('./res/pngs/' + texname + '.tga.png');
		 	_loadedSprites[texname] = texture;
		}

		// var mat = new THREE.SpriteMaterial({map:texture, useScreenCoordinates:false});
		// var sprite = new THREE.Sprite( mat );

		var geom = new THREE.PlaneGeometry(1,1,1);		
		for (var i=0; i < geom.vertices.length; i++) {
			geom.vertices[i].z += 0.01;	//prevent z-fighting
		}

		var mat = new THREE.MeshBasicMaterial({map:texture});
		var sprite = new THREE.Mesh(geom,mat);

		var pos = readOriginStr(ent.origin);
		var depth = readFloatStr(ent.Depth);
		var angle = readFloatStr(ent.angle || 0);

		// var sprite = new THREE.Mesh(new THREE.CubeGeometry(depth,depth,depth,1,1,1),new THREE.MeshBasicMaterial({color:0xff0000}));
		
		sprite.scale.set(depth,depth,depth);

		var parent = new THREE.Object3D();
		parent.add(sprite);
		parent.position.copy(pos);

		if (bsp.checkCollision(pos,depth,undefined,plane)) {
			sprite.visible = true;
			// project point into plane
			var projPoint = plane.projectPoint(pos);

			parent.position.copy(projPoint);

			//set rotation of decal to match plane. For this, simply move
			//normal of mesh to be the same as normal of plane.
			var b = plane.normal;
			axis.crossVectors(a,b).normalize();
			var angle = Math.acos(a.dot(b)/a.length()/b.length());

			sprite.rotateOnAxis(axis,angle);
		
		} else {
			console.warn("Couldn't find plane to apply decal!" + sprite);
			//couldn't apply decal to plane
			// sprite.visible = false;
		
		}

		return parent;

	};

}();


function createEntities(ents,bsp) {

	var decals = new THREE.Object3D();


	for (var i= 0; i < ents.length; i++) {
		var ent = ents[i];

		if (ent.classname == 'infodecal') {
			decals.add(createDecal(ent,bsp));
		}

	}

	return decals;
}
