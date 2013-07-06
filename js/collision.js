
var BVHMESHES = new THREE.Object3D();

var BVHNode = function(nodeData) {
	this.bbox = readBBox(nodeData.bbox);
	this.faceIdxs = nodeData.faceIdxs;
	this.children = [];
	for (var i=0; i < nodeData.children.length; i++) {
		this.children.push(
			new BVHNode(nodeData.children[i]));
	}

	//create mesh
	var a = this.bbox.min;
	var b = this.bbox.max;
	var w = b.x-a.x,
		h = b.y-a.y,
		d = b.z-a.z;

	this.mesh = new THREE.Mesh(
		new THREE.CubeGeometry(w,h,d,1,1,1),
		new THREE.MeshBasicMaterial({
			color: Math.random() * 0xffffff,
		})
	);
	this.mesh.position.set(a.x + w/2,a.y + h/2,  a.z + d/2 );
	this.mesh.visible = false;
	BVHMESHES.add(this.mesh);
}

var Collider = function(solidData,solidObj) {
	
	var faceList = solidObj._allFaces;
	var vertexList = solidObj._allVertices;
	
	var roots = [];
	for (i = 0; i < solidData.cells.length; i++) {
		roots.push(
			new BVHNode(solidData.cells[i].bvh));
	}

	this.roots = roots;
	
	this.checkCollision = function(pos,radius,cellIdx,startNode) {
		//TODO: use sphere equation instead of this shortcut
		if (!(cellIdx >= 0)) return true;
			
		var node = startNode || roots[cellIdx];

		if (checkCollision_BBox_Cube(node.bbox,pos,radius)) {
			// if (node.faceIdxs.length > 0 && 
			// 	sphereIntersectsFaceList(pos,radius,node.faceIdxs,faceList,vertexList)) {
			// 	return true;
			// } 
			if (node.children.length == 0) { 
				// node.mesh.visible = true;
				return true;
			}

			for (var i = 0; i < node.children.length; i++) {
				if (this.checkCollision(pos,radius,cellIdx,node.children[i])) {
					return true;
				}
			}

		}
		// node.mesh.visible = false;
		return false;

	}
}

function checkCollision_BBox_BBox(a,b) {
	return !(a.min.x > b.max.x || a.max.x < b.min.x ||
		     a.min.y > b.max.y || a.max.y < b.min.y ||
		     a.min.z > b.max.z || a.max.z < b.min.z);
}

function checkCollision_BBox_Cube(bbox,cubeCenter,cubeHalfSize) {
	var b = {
		min: {x : cubeCenter.x - cubeHalfSize, y: cubeCenter.y - cubeHalfSize, z:  cubeCenter.z - cubeHalfSize },
		max: {x : cubeCenter.x + cubeHalfSize, y: cubeCenter.y + cubeHalfSize, z:  cubeCenter.z + cubeHalfSize },
	};
	return checkCollision_BBox_BBox(bbox,b);
}

var sphereIntersectsFaces = function(pos,radius,faceIdxs,faces,vertices) {
	//expecting faces in faceList as Face3
	var a,b,c;

	var intersectPoint;

	for (var i=0; i < faceIdxs.length; i++) {
		
		var face = faces[faceIdxs[i]];

		//intersectPoint = ...; TODO

		if ( face instanceof THREE.Face3 ) {

			a = vertices[ face.a ];
			b = vertices[ face.b ];
			c = vertices[ face.c ];

		if ( THREE.Triangle.containsPoint( intersectPoint, a, b, c ) ) return true;

		} else if ( face instanceof THREE.Face4 ) {

			a = vertices[ face.a ];
			b = vertices[ face.b ];
			c = vertices[ face.c ];
			d = vertices[ face.d ];

			if ( ( THREE.Triangle.containsPoint( intersectPoint, a, b, d ) ) ||
				 (THREE.Triangle.containsPoint( intersectPoint, b, c, d ) ) ) return true;

		} else {

			// This is added because if we call out of this if/else group when none of the cases
			//    match it will add a point to the intersection list erroneously.
			throw Error( "face type not supported" );

		}
	}
	return false;
};