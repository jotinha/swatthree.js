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



function tests() {

	var p000 = new THREE.Vector3();
	var curTest;

	var TOL = 0.0001;
	
	var ok = function(test,testName,msgFail) {

		if (!test) {
			throw curTest + ': ' + msgFail;
		}

	};

	var _p = function (x,y,z) {
		return new THREE.Vector3(x,y,z);
	}


	var units = {

		'bspCollisionVector': function() {

			var planeData = [ 
				[ -1, 0, 0, 10],
				[  0, 1, 0, -10],
				[ 1, 0,0,-20],
			];

			var nodeData = [
				[ -1, 1, 2, -1, 0],	 // root
				[0, -1, -1, 1, -1],  // (1) leaf
				[0, 4, 3, -1, 1],   // (2) node
				[2, 6, 5,-1, 2],	// (3) node
				[2, -1,-1, 4, -1],	// (4) leaf empty
				[3, -1,-1,-1,-1], 	// (5) leaf solid
				[3, -1, -1,6, -1],	// (6) leaf empty
			];
			
			var bsp = new BspTree(nodeData,planeData);

			ok( bsp.getNodeAtPos( p000 ).cell  === 1);
			ok( bsp.getNodeAtPos( _p(15,15,0) ).cell  === 4);

			var point = new THREE.Vector3();
			 
			ok( bsp.checkCollisionVector(_p(0,0,0),_p(19,0,0),5,point) === true);
			ok( point.distanceTo(_p(5,0,0)) < TOL);

			ok( bsp.checkCollisionVector(_p(15,15,0),_p(15,0,0),0,point) === true);
			ok( point.distanceTo(_p(15,10,0)) < TOL);

			ok( bsp.checkCollisionVector(_p(5,20,0),_p(20,5,0),0,point) === true);
			ok( point.distanceTo(_p(15,10,0)) < TOL);

			ok( bsp.checkCollisionVector(_p(25,20,0),_p(0,-5,0),0,point) === true);
			ok( point.distanceTo(_p(15,10,0)) < TOL);

			// ok( bsp.checkCollisionVector(_p(15,5,0),_p(5,5,0),0,point) === true);
			// ok( point.distanceTo(_p(10,5,0)) < TOL);



		},

	};

	console.log('Running unit tests');

	for (curTest in units) {
		units[curTest]();
	}
	
}


