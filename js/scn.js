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
		scnObj.add(solidMesh);s
	}

	return scnObj;

}


function createSolid(data,textures,lightmaps) {

	var geom;
	var n_cells = data.cells.length || 1;

	//create vertex list
	var vertices = [];
	for (var v=0; v < data.verts.length; v++) {
		vertices.push( new THREE.Vector3(
			data.verts[v][0],
			data.verts[v][1],
			-data.verts[v][2]
			));
	}

	//one mesh and geometry per cell
	var geoms = []
	for (var icell=0; icell < n_cells; icell++) {
		geom = new THREE.Geometry();
		geom.vertices = vertices;
		geom.faceVertexUvs = [[],[]];		//2 sets of uv's

		geoms.push(geom);
	}


	//create faces
	for (var f=0; f < data.faces.length; f++) {
		var face = interpretFace(data.faces[f]);
		
		//select the appropriate cell
		var cidx = face.cellIdx >= 0 ? face.cellIdx : 0;

		geom = geoms[cidx];

		geom.faces.push( new THREE.Face3(
			face.vertIdxs[0],
			face.vertIdxs[1],
			face.vertIdxs[2],
			face.normal,
			face.vertexColors,
			face.materialIdx
			));

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
	var solid = new THREE.Object3D();
	for (var icell=0; icell < n_cells; icell++) {
		geom = geoms[icell];
		geom.computeFaceNormals();
		geom.computeVertexNormals();
		geom.computeCentroids();
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
	
	for (var c=0; c < scn.children.length; c++) {
		var solid = scn.children[c];
		if (solid.material instanceof THREE.MeshFaceMaterial) {
			for (var m = 0; m < solid.material.materials.length; m++) {
				var material = solid.material.materials[m];
				callback(material);

				material.needsUpdate = true;
				
			}

		} else {
			throw ("expected material of type MeshFaceMaterial");
		}

		
	}
};