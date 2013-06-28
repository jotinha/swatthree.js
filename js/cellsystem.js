var CellSystem = function(scn,scnData) {
	var cellsData = scnData.solids[0].cells;

	this.cells = [];
	for (var i=0; i < cellsData.length; i++) {
		this.cells.push(new csCell(i,this,cellsData[i]));
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

CellSystem.prototype.getCellAtPos = function(pos) {
	var ci = this.bsp.getNodeAtPos(pos).cell;
	return this.cells[ci];
};

CellSystem.prototype.getCellIdxAtPos = function(pos) {
	return this.bsp.getNodeAtPos(pos).cell;
};

CellSystem.prototype.setCellVisible = function(idx,bool) {
	if (idx != -1) this.cellMeshes[idx].visible = bool;
};

CellSystem.prototype.update = function(cameraPosition) {
	var ci = this.getCellIdxAtPos(cameraPosition);
	for (var i=0; i < this.cells.length; i++) {
		this.setCellVisible(i,i==ci);
	}
};

//-------------------------------------------------------------------
var csCell = function (idx,parent,cellData) {
	this.idx = idx;
	this.name = cellData.name || '';
	this.skybox = cellData.skybox || '';
	this.portals = [];
	for (var i=0; i < cellData.portals.length; i++) {
		this.portals.push(new csPortal(this,cellData.portals[i]));
	}
};


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

	this.parentCell = parent;
	this.nextCellIdx = portalData.nextcell;
	

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
	return frustum.intersectsObject( this.mesh );
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

