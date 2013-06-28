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
		this.obj.add(this.portals[i].mesh);
	};

	this.bsp = new BspTree(scnData.solids[0].nodes,scnData.solids[0].planes);

	this.cellMeshes = scn.children[0].children;


};


CellSystem.prototype = {
	getCellAtPos: function(pos) {
			var ci = this.bsp.getNodeAtPos(pos).cell;
			return this.cells[ci];
		},

	getCellIdxAtPos: function(pos) {
			return this.bsp.getNodeAtPos(pos).cell;
		},

	update: function(cameraPosition,camera) {
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
				
				var frustum = _getUpdatedFrustum(camera);				
				
				curCell.setVisibilityOfNeighborCells(frustum);

				_debugText = ci + ': ' + curCell.name + '<br>';
			}

			$('#debugInfo').html(_debugText);	
		},

};

var _getUpdatedFrustum = function() {
		var frustum = new THREE.Frustum();
		var mat = new THREE.Matrix4();

		return function(camera) {
			frustum.setFromMatrix(mat.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );
			return frustum;
		}

}(); 

var _createFrustumPassingPortal = function(camera,portal) {
}(); 


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

	setVisibilityOfNeighborCells: function(frustum) {
		for (var i=0; i < this.portals.length; i++) {
			var portal = this.portals[i];
			
			if (portal.nextCellIdx >= 0) {
				
				var nextCell = this.parentCS.cells[portal.nextCellIdx];
				
				//if it is already visible, skip
				if (!nextCell.isVisible() && portal.isInsideFrustum(frustum)) {
					nextCell.setVisible(true);
					//nextCell.setVisibilityOfNeighborCells(!!!!);
				}
			}
		}
	},

	computeFrustumPassingPortal: function(camera,portal) {

	},

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

	

};

csPortal.prototype.setNextCell = function(cell) {
	if (this.nextCellIdx == -1) { //means what?
		this.nextCell = undefined;
	}
	else if (cell.idx !== this.nextCellIdx) {
		throw ("cell.idx doesn't match. Are you sure its the actual nextCell?");
	}
	else {
		this.nextCell = cell;
	}
};

csPortal.prototype.isInsideFrustum = function(frustum) {
	//TODO: patch frustrum with intersectsAABB
	return frustrumIntersectsAABB( frustum, this.aabb );
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
		});
	}
	this.n_nodes = this.nodes.length;
	this.root = this.nodes[0];
	
}	

BspTree.prototype.getNodeAtPos = function(pos,startNode) {
	var node = startNode || this.root ;

	if (node.plane === undefined) {
		return node;
	} else {
		var nextNode = this.nodes[ node.plane.distanceToPoint(pos) >= 0 ? 
									node.node1 :
									node.node2 ];
		return this.getNodeAtPos(pos, nextNode);
	}
};


var frustrumIntersectsAABB = function() {
	//based on http://stackoverflow.com/questions/9187871/frustum-culling-when-bounding-box-is-really-big?rq=1
	var p1 = new THREE.Vector3(),
		p2 = new THREE.Vector3();

	return function(frustum,aabb) {

		for ( var i = 0; i < 6; i ++ ) {
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