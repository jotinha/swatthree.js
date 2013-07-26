var CONFIG = {
	debug: {
		portalsProj: false,
		tests: true,
	}
}

if (CONFIG.debug.tests) { tests(); }


var MAP = 'missiona'
var startPoint = {
	x:89,
	y:60,
	z:308,
}

var scn, cameraControls, renderer, scncs;
var clock = new THREE.Clock();

if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

// RENDERER
renderer = new THREE.WebGLRenderer( { 
	antialias: false,
	//?? premultipliedAlpha: false, //pngs are not premultiplieds 
});

renderer.gammaInput = true;
renderer.gammaOutput = true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColorHex( 0xffffff, 1.0 );
// renderer.autoClear = false;		//for multiple viewports


var scene = new THREE.Scene();

// CONTROLS 1
var camera1 = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 10, 100000 );
camera1.position.set(startPoint.x,startPoint.y,startPoint.z);

var cameraOPControls = new THREE.OrbitAndPanControls(camera1, renderer.domElement);
cameraOPControls.target.set(0,0,0);

// // CONTROLS 2
var camera2 = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 10, 100000 );


camera2.position.set(0,0,0);

var cameraPLControls = new THREE.PointerLockControls_noClip( camera2 );
cameraPLControls.getObject().position.set(startPoint.x,startPoint.y,startPoint.z);
scene.add( cameraPLControls.getObject() );

cameraControls = cameraOPControls;
camera = camera1;

var camera3 = new THREE.OrthographicCamera( -500, 500,500,-500, 50, 10000 );
camera3.position.set(0,100,0);
camera3.lookAt(new THREE.Vector3(0,0,0));

// LIGHTS
var ambientLight = new THREE.AmbientLight( 0xffffff );
scene.add(ambientLight);

function animate() {
	window.requestAnimationFrame(animate);

	

	render();

	stats.update();
}

var _previous_cell,_cur_cell;

function render() {
	var delta = clock.getDelta();
	cameraControls.update(delta);
	//cameraControls.isOnObject( true );

	// _cur_cell = scncs.getCellIdxAtPos(camera.position);

	// if (_cur_cell >= 0 && _cur_cell !== _previous_cell) {
	// 	console.log('Location: ' + scncs.cells[_cur_cell].name);
	// 	_previous_cell = _cur_cell;
	// }

	setScnVisibility();
	if (camera === camera2) {
		scncs.update(cameraPLControls.getObject().position,camera2);
	}
	// if (camera === camera2) {
	// 	if (scncs.isColliding) {
	// 		cameraControls.update(-delta);
	// 	}
	// }

	camera3.position.copy(cameraPLControls.getObject().position);
	camera3.position.y += 60;


	// cameraCull();
	// renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.render(scene, camera);

	if (CONFIG.debug.portalsProj) {
		if (camera === camera2) guiDrawPortalsProj();
	}

	// renderer.setViewport(0,0,200, 200);
	// renderer.render(scene, camera3);
	
}

var frustum = new THREE.Frustum();


$.getJSON("./res/" + MAP + ".json", function(scndata) {

	scn = createScn(scndata);

	//assign classname to each solid for 
	for (var e=0; e < scndata.ents.length; e++) {
		var ent =  scndata.ents[e];
		if (ent.srefidx !== -1) {
			scn.children[ent.srefidx]._scn_classname = ent.classname.toLowerCase();
		}
	}

	scene.add(scn);

	scncs = new CellSystem(scn,scndata);

	scene.add(scncs.obj);

	scene.add(BVHMESHES);

	//scene.add(drawAllCellsBBoxes(scndata));

	//create skybox
	scene.add(
	 	createSkyBox('a_Porch','./res/pngs')
	);

	animate();
});

// GUI CONTROLLER ------------------------------

var gui = initGUI();

function startFPV() {
	gui.close();
	cameraControls = cameraPLControls;
	camera = camera2;

	// $('#hud').show();
}

function stopFPV() {
	gui.open();
	cameraControls = cameraOPControls;
	camera = camera1;

	// $('#hud').hide();
}

var fpstart = initPL( startFPV, stopFPV);

visControl.fpview = fpstart;

// STATS ----------------------------------------

var stats = new Stats();
stats.setMode(0); // 0: fps, 1: ms

// Align top-left
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';

document.body.appendChild( stats.domElement );

// RENDER ELEMENT ---------------------------------------

document.getElementById('3dview').appendChild( renderer.domElement );

function handleResize() {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera1.aspect	= window.innerWidth / window.innerHeight;
	camera1.updateProjectionMatrix();	

	camera2.aspect	= window.innerWidth / window.innerHeight;
	camera2.updateProjectionMatrix();	
}

window.addEventListener('resize', handleResize, false);


