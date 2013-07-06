var loadPortals = function(scnData) {
	var obj = new THREE.Object3D();


	for (var i=0; i < scnData.solids[0].cells.length; i++) {
		
		var cell = scnData.solids[0].cells[i];
		
		for (var j=0; j < cell.portals.length; j++) {

			var portal = cell.portals[j];

			var geom = new THREE.Geometry();

			geom.vertices = readVertices(portal.verts);

			for (var v=1; v < geom.vertices.length - 1; v++) {
				geom.faces.push( new THREE.Face3(0,v,v+1));
			}


			//the portal polygons are actually looking AWAY from the cell, but there is the portal on the 
			//other side as well
			var mesh = new THREE.Mesh(
				geom,
				new THREE.MeshBasicMaterial({
					color: 0x00ff00,
					transparent: true,
					opacity: 0.5,
					side: THREE.BackSide,
				})		
			);
			
			
			obj.add(mesh);
		}
	}

	obj.name = 'portals';
	return obj;

}

