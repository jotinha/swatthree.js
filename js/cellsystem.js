var PROJPORTALS = [];

var CellSystem = function(scn,scnData) {
	var cellsData = scnData.solids[0].cells;

	this.cells = [];

	for (var i=0; i < cellsData.length; i++) {
		this.cells.push(new csCell(i,this,cellsData[i],scn.children[0].children[i]));
	}

	//double link portals
	this.portals = [];
	for (var i=0; i < this.cells.length; i++){
		for (var j=0; j < this.cells[i].portals.length; j++) {
			var portal = this.cells[i].portals[j];
			portal.setNextCell(this.cells[portal.nextCellIdx]);
			this.portals.push(portal);
		}
	}

	//create object3D
	this.obj = new THREE.Object3D();
	for (var i=0; i < this.portals.length; i++) {
		this.obj.add(this.portals[i].polygon);
	};

	this.bsp = new BspTree(scnData.solids[0].nodes,scnData.solids[0].planes);

	this.cellMeshes = scn.children[0].children;

	this.collider = new Collider(scnData.solids[0],scn.children[0]);


};


CellSystem.prototype = {
	getCellAtPos: function(pos,sphereRadius) {
			var node = this.bsp.getNodeAtPos(pos,sphereRadius);  //may return false if checking for collision
			if (node && node.cell >= 0) {
				return this.cells[node.cell];		
			}
		},

	getCellIdxAtPos: function(pos,sphereRadius) {
			var node = this.bsp.getNodeAtPos(pos,sphereRadius);
			return node ? node.cell : -1;
		},

	update: function() {
				
		var viewProjectionMatrix = new THREE.Matrix4();

		return function(cameraPosition,camera) {

			PROJPORTALS = [];

			// first set all cells invisible
			for (var i=0; i < this.cells.length; i++) {
				this.cells[i].setVisible(false);
			}

			var _debugText = 'None';

			//set current cell visible
			var ci = this.getCellIdxAtPos(cameraPosition);
			
			if (ci >= 0) {
				var curCell = this.cells[ci];
				curCell.setVisible(true);
				
				//var frustum = _getUpdatedFrustum(camera);				
				//_updateFrustumMesh(frustum,cameraPosition)
				//curCell.setVisibilityOfNeighborCells(frustum,cameraPosition);
				
				var viewMatrix = camera.matrixWorldInverse.getInverse( camera.matrixWorld );
				viewProjectionMatrix.multiplyMatrices( camera.projectionMatrix, viewMatrix);

				curCell.setVisibilityOfNeighborCells_projMethod(cameraPosition,viewProjectionMatrix)

				_debugText = ci + ': ' + curCell.name + '<br>';
			
			}

			this.isColliding = this.collider.checkCollision(cameraPosition,10,ci);
			this.isCollidingBSP = this.bsp.checkCollision(cameraPosition,10);

			$('#debugInfo').html(_debugText +
							'<br>Is colliding? ' +
							'<br>BVH: ' + this.isColliding + 
							'<br>BSP: ' + this.isCollidingBSP);
 

		};
	}(),

};

var _getUpdatedFrustum = function() {
		var frustum = new THREE.FrustumN();
		var mat = new THREE.Matrix4();

		return function(camera) {
			frustum.setFromMatrix(mat.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );
			frustum.planes[0].constant += 10;
			frustum.planes[1].constant += 10;
			frustum.planes[2].constant += 10;
			frustum.planes[3].constant += 10;
			return frustum;
		}

}(); 

var _updateFrustumMesh = function() {

	var obj = new THREE.Object3D();
	
	for (var i=0; i < 6; i++) {
		var geom = new THREE.Geometry();
		geom.vertices.push(new THREE.Vector3(0,0,0));
		geom.vertices.push(new THREE.Vector3(0,0,0));
		var line = new THREE.Line(geom);
		obj.add(line);
	};

	return function(frustum,origin) {
		for (var i=0; i <6; i++) {
			var g = obj.children[i].geometry;
			g.vertices[0].copy(origin);
			g.vertices[1].copy(frustum.planes[i].coplanarPoint);
		}
	
	}
}();

var _createFrustumThroughPolygon = function(origin,vertices,plane) {

	var n_verts = vertices.length;

	// 1,1,... is a hack so frustum does not init Plane() 6 times
	//we do that in the for loop below
	var frustum =  new THREE.FrustumN(1,1,1,1,1,1); 
	
	frustum.planes = [];
	for (var i=0; i < n_verts; i++) {
		var plane = new THREE.Plane();
		plane.setFromCoplanarPoints(
			vertices[i],
			i < n_verts - 1 ? vertices[i+1] : vertices[0],
			origin)
		//this order only works because polygon is facing AWAY from cell center

		frustum.planes.push(plane);


	}

	//now add near plane (plane of polygon)
	frustum.planes.push( plane );

	//far plane
	frustum.planes.push();
	
	return frustum;
};

//-------------------------------------------------------------------
var csCell = function (idx,parent,cellData,mesh) {
	this.idx = idx;
	this.name = cellData.name || '';
	this.skybox = cellData.skybox || '';
	this.mesh = mesh;
	this.parentCS = parent;
	this.portals = [];
	for (var i=0; i < cellData.portals.length; i++) {
		this.portals.push(new csPortal(this,cellData.portals[i]));
	}
};

csCell.prototype = {
	setVisible: function(bool) {
		this.mesh.visible = bool;
	},

	isVisible: function(bool) {
		return this.mesh.visible;
	},

	setVisibilityOfNeighborCells: function(frustum,origin) {
		for (var i=0; i < this.portals.length; i++) {
			var portal = this.portals[i];
			
			if (portal.nextCellIdx >= 0) {
				
				var nextCell = this.parentCS.cells[portal.nextCellIdx];
				
				//if it is already visible, skip

				if (!nextCell.isVisible() && portal.isFacingIn(origin) && portal.isInsideFrustum(frustum)) {
					nextCell.setVisible(true);
					nextCell.setVisibilityOfNeighborCells(
						_createFrustumThroughPolygon(origin,portal.polygonVertices,portal.polygonPlane),
						origin
					);
				}

/*				if (!nextCell.isVisible()) {
					var newFrustum = clipFrustumByAABB(frustum, origin, portal.aabb);
					if (newFrustum) {
						nextCell.setVisible(true);
						nextCell.setVisibilityOfNeighborCells(newFrustum,origin);
					}

				}*/
			}
		}
	},

	setVisibilityOfNeighborCells_projMethod: function() {

		var stdClipBox = new THREE.Box3( new THREE.Vector3( -1, -1, -1 ), new THREE.Vector3( 1, 1, 1 ) );

		return function (origin,viewProjectionMatrix, clipBox) {

			clipBox = clipBox || stdClipBox;


			for (var i=0; i < this.portals.length; i++) {
				var portal = this.portals[i];

				if (portal.nextCellIdx <0 ) continue;

				var nextCell = this.parentCS.cells[portal.nextCellIdx];

				if (!nextCell.isVisible() && portal.isFacingIn(origin)) {

					var portalBB = portal.projectAndClip(viewProjectionMatrix, clipBox);

					if (portalBB !== null) {

						PROJPORTALS.push({
							box:portalBB.clone(),
							ownerCell: this.name,
							nextCell: nextCell.name,
							});

						nextCell.setVisible(true);

						nextCell.setVisibilityOfNeighborCells_projMethod(origin,viewProjectionMatrix,portalBB);

					}


				}


			}

		};

	}(),

}

//--------------------------------------------------------------------
var csPortal = function(parent,portalData) {
	
	var a = portalData.bbox[0];
	var b = portalData.bbox[1];
	var w = b[0]-a[0],
		h = b[1]-a[1],
		d = b[2]-a[2];

	this.mesh = new THREE.Mesh(
		new THREE.CubeGeometry(w,h,d,1,1,1),
		new THREE.MeshBasicMaterial({
			color: 0x00ff00,
		})
	);
	this.mesh.geometry.computeBoundingBox();
	this.mesh.position.set(a[0] + w/2,a[1] + h/2, -( a[2] + d/2 ) );
	this.mesh.visible = false;
	this.mesh.frustumCulled = false; //we do this ourselves
	this.mesh.updateMatrixWorld(); // we need to update this before using mesh.localToWorld

	this.parentCell = parent;
	this.nextCellIdx = portalData.nextcell;

	//this aabb is in world coordinates. If we change bounding box locations (unlikely), we have to update
	this.aabb = {
		min: new THREE.Vector3(),
		max: new THREE.Vector3(),
	}

	this.aabb.min.copy(this.mesh.geometry.boundingBox.min);
	this.aabb.max.copy(this.mesh.geometry.boundingBox.max);

	this.mesh.localToWorld(this.aabb.min);
	this.mesh.localToWorld(this.aabb.max);

	//add portal polygon (not bbox) vertices
	//in world coordinates
	this.polygonVertices = [];
	for (var i = 0; i < portalData.verts.length; i++) {
		this.polygonVertices.push( readVertex(portalData.verts[i]));
	}

	this.polygonPlane = readPlane(portalData.plane);

	var geom = new THREE.Geometry();
	geom.vertices = this.polygonVertices;
	geom.faces.push( new THREE.Face4(0,1,2,3));
	
	//the portal polygons are actually looking away, fix that
	this.polygon = new THREE.Mesh(
		geom,
		new THREE.MeshBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0.5,
			side: THREE.BackSide,
		})		
		);

	//this.polygon.visible = false;

	this.plane = readPlane(portalData.plane);

	this.screenCoords = [];
	for (var i = 0; i < this.polygonVertices.length; i++) {
		this.screenCoords.push( new THREE.Vector4() );
	}

};

csPortal.prototype = {

	setNextCell: function(cell) {
		if (this.nextCellIdx == -1) { //means what?
			this.nextCell = undefined;
		}
		else if (cell.idx !== this.nextCellIdx) {
			throw ("cell.idx doesn't match. Are you sure its the actual nextCell?");
		}
		else {
			this.nextCell = cell;
		}
	},

	isInsideFrustum : function(frustum) {
		//TODO: patch frustrum with intersectsAABB
		return frustrumIntersectsAABB( frustum, this.aabb );
	},

	isFacingIn : function(origin)  { 
		//the portal plane faces INTO the cell they belong to
		// (I think the polygon faces AWAY but I must check)
		return this.plane.distanceToPoint(origin) >= 0;

	},

	projectAndClip: function() {

		var BB = new THREE.Box3();

		return function (projMatrix,clipBox) {

			var portal = this;
			var v1,v2,v3;
			var polyVisible = false;

			for ( var j = 0; j < portal.polygonVertices.length; j ++ ) {

				var pp = projectPoint(portal.polygonVertices[j], projMatrix, portal.screenCoords[j] );

				// var w = pp.w;
				// polyVisible = polyVisible || !(pp.x  < -w || pp.x > w || pp.y < -w || pp.y > w || pp.z < -w || pp.z > w);

				// if ( j == 0) { v1 = pp; }
				// else if (j == 1) { v2 = pp; }
				// else { 
				// 	v3 = pp;
				// 	polyVisible = polyVisible || ((v3.x - v1.x)*(v2.y - v1.y) - (v3.y - v1.y)*(v2.x - v1.x)) > 0;
				// }

			}

			// if (!polyVisible) return null;

			BB.setFromPoints(portal.screenCoords);
		
			if (clipBox.isIntersectionBox( BB )) {
				
				BB.intersect( clipBox );

				//but keep z coordinates
				BB.min.z = clipBox.min.z;	//which should be -1
				BB.max.z = clipBox.max.z;	//which should be 1

				return BB.clone();

			} else {

				return null;

			}

		};

	}(),

};
	

//---------------------------------------------------------------------------
var BspTree = function(nodesData,planesData) {
	var planes = [];
	for (var i=0; i < planesData.length; i++) {
		var p = planesData[i]
		planes.push(new THREE.Plane(new THREE.Vector3(p[0],p[1],-p[2]),p[3]));
	}	

	this.nodes = [];
	for (var i=0; i < nodesData.length; i++) {
		var n = nodesData[i];
		this.nodes.push( {
			nodep : n[0],
			node1 : n[1],
			node2 : n[2],
			cell : n[3],
			plane : n[4] >= 0 ? planes[n[4]] : undefined,
			isLeaf: n[4] < 0,
			isSolid: n[4] < 0 && n[3] === -1,
		})
	}
	this.n_nodes = this.nodes.length;
	this.root = this.nodes[0];
	
}	

BspTree.prototype.getNodeAtPos = function(pos,startNode) {
	var node = startNode || this.root ;

	if (node.isLeaf) {
		
		return node;

	} else {
		
		var d = node.plane.distanceToPoint(pos);

		var nextNode = this.nodes[ d >= 0 ? node.node1 : node.node2 ];

		return this.getNodeAtPos(pos, nextNode);
	}
};

BspTree.prototype.checkCollision = function(pos,sphereRadius,startNode) {
	var node = startNode || this.root ;
	var radius = sphereRadius || 0;
	
	if (node.isLeaf) {

		return node.isSolid;

	} else {
	
		var d = node.plane.distanceToPoint(pos);

		var n1 = this.nodes[node.node1];
		var n2 = this.nodes[node.node2];

		if ( d >= radius) {
			return this.checkCollision(pos, sphereRadius, n1);
		} else if ( d < -radius) {
			return this.checkCollision(pos, sphereRadius, n2);
		} else {
			return this.checkCollision(pos, sphereRadius, n1) || 
				   this.checkCollision(pos, sphereRadius, n2);
		}
	}
};


var frustrumIntersectsAABB = function() {
	//based on http://stackoverflow.com/questions/9187871/frustum-culling-when-bounding-box-is-really-big?rq=1
	var p1 = new THREE.Vector3(),
		p2 = new THREE.Vector3();

	return function(frustum,aabb) {

		for ( var i = 0; i < frustum.planes.length; i ++ ) {
			var plane = frustum.planes[i];
			p1.x = plane.normal.x > 0 ? aabb.min.x : aabb.max.x;
			p2.x = plane.normal.x > 0 ? aabb.max.x : aabb.min.x;
			p1.y = plane.normal.y > 0 ? aabb.min.y : aabb.max.y;
			p2.y = plane.normal.y > 0 ? aabb.max.y : aabb.min.y;
			p1.z = plane.normal.z > 0 ? aabb.min.z : aabb.max.z;
			p2.z = plane.normal.z > 0 ? aabb.max.z : aabb.min.z;

			var p1in = frustum.planes[ i ].distanceToPoint( p1 ) > 0;
			var p2in = frustum.planes[ i ].distanceToPoint( p2 ) > 0;

			if ( !p1in && !p2in) {		//if both outside plane, no intersection
			
				return false;
	
			}//if both p1in ^ p2in we know it is intersecting this plane, but it's not important.
			//So we keep iterating until we hit a both outside condition and break to a false
			//or go through all planes and return a true
		}
		return true;
	}
}();


//returns false if aabb is not inside or intersects frustum
// return true otherwise
// a new frustum will be return that is adjusted to the region of the aabb inside the frustum

var clipFrustumByAABB = function() {
	var p1 = new THREE.Vector3(),
		p2 = new THREE.Vector3();
		newNormal = new THREE.Vector3();
		v = new THREE.Vector3();

	var adjustPlane = function(plane,origin,point) {
		//change plane in place to contain both origin and point by rotating
		// in the direction of the plane normal
		// eq: 
		// 		n' = n - (v.n)*v
		// where:
		//		v = origin - point

		v.subVectors(origin,point);
		v.multiplyScalar(v.dot(plane.normal))
		
		newNormal.subVectors(plane.normal,v).normalize();

		//now we recreate the plane

		plane.setFromNormalAndCoplanarPoint(newNormal,origin);
		//if we did this right, this plane should contain point

	}

	return function (frustum, origin, aabb){

		var newFrustum = frustum.clone();

		for ( var i = 0; i < frustum.planes.length; i ++ ) {

			var plane = newFrustum.planes[i];

			p1.x = plane.normal.x > 0 ? aabb.min.x : aabb.max.x;
			p2.x = plane.normal.x > 0 ? aabb.max.x : aabb.min.x;
			p1.y = plane.normal.y > 0 ? aabb.min.y : aabb.max.y;
			p2.y = plane.normal.y > 0 ? aabb.max.y : aabb.min.y;
			p1.z = plane.normal.z > 0 ? aabb.min.z : aabb.max.z;
			p2.z = plane.normal.z > 0 ? aabb.max.z : aabb.min.z;

			var d1 = plane.distanceToPoint( p1 );
			var d2 = plane.distanceToPoint( p2 );

			if ( d1 < 0 && d2 < 0) {		//if both outside plane, no intersection
			
				return false;
	
			} else if ( d1 >=0  &&  d2 >=0  ) { //both in front of plane (inside)

				if (d1 > d2) {
					throw "expected d1 < d2";
				}
				if (i < 5) {		//last plane is the far plane (i hope), do NOT CHANGE THIS ONE
					
					adjustPlane(plane, origin, p1);		//by design, p1 is always the closest to the plane
				}
			
			} else {
				// plane splits aabb, plane does not change
				
			}

		}
		return newFrustum;
	};
}();


/*var clipPortals = function() {

	var viewProjectionMatrix = new THREE.Matrix4();

	var BB = new THREE.Box3();

	var clipBox = new THREE.Box3( new THREE.Vector3( -1, -1, -1 ), new THREE.Vector3( 1, 1, 1 ) );

	var clippings = [];

	return function ( cell, viewProjectionMatrix, recurse ) {

		var graph = {};

		var viewMatrix = camera.matrixWorldInverse.getInverse( camera.MatrixWorld );

		viewProjectionMatrix.multiplyMatrices( projectionMatrix, viewMatrix);

		for (var i = 0; i < cell.portals.length; i++) {

			var portal = cell.portals[ i ];

			for ( var j = 0; j < portal.polygonVertices.length; j ++ ) {

				projectPoint(vertex, viewProjectionMatrix, portal.screenCoords[j] );
			
			}
			
			BB.setFromPoints(portal.screenCoords);

			if clipBox.isIntersectionBox( BB ) {

				BB.intersect( clipBox );

				graph.push({
					cell: cell.name;
				})

			}
		}


	}
	

}
*/

//vertex -- Vector3
//target -- Vector4
//projectionMatrix -- Matrix4
var projectPoint = function(vertex, projectionMatrix, target) {

	target.copy(vertex).applyMatrix4( projectionMatrix );

	//var invW = 1 / target.w;

	//target.x *= invW;
	//target.y *= invW;
	//target.z *= invW;

	
	//Limit w > 0 has solve a few problems I had with portal clipping.
	// At some point I have to understand why. TODO: that
	// See: http://stackoverflow.com/questions/13731133/opengl-clip-space-frustum-culling-wrong-results
	var w = target.w;
	if (w > 0) {
		// perspective divide
		var invw = 1/w;
		target.x *= invw;
		target.y *= invw;
		target.z *= invw;
	}

	return target;
}