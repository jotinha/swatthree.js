function drawCellBBoxes(celldata) {
	var obj = new THREE.Object3D();
	for (var i=0; i < celldata.bboxes.length; i++) {
		var bbox = celldata.bboxes[i];

		var a = bbox[0];
		var b = bbox[1];
		var w = b[0]-a[0],
			h = b[1]-a[1],
			d = b[2]-a[2];

		var mesh = new THREE.Mesh(
			new THREE.CubeGeometry(w,h,d,1,1,1),
			new THREE.MeshBasicMaterial({
				color: Math.random() * 0xffffff,
			})
		);
		mesh.position.set(a[0] + w/2,a[1] + h/2, -( a[2] + d/2 ) );

		obj.add(mesh);
	}

	return obj;

}

function drawAllCellsBBoxes(scndata) {

	var obj = new THREE.Object3D();
	for (var i=0; i < scndata.solids[0].cells.length; i++) {
		obj.add(drawCellBBoxes(scndata.solids[0].cells[i]));
	}
	return obj;

}

