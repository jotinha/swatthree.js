var visControl = {
	worldspawn: true,
	doors: true,
	triggers: false,
	others: true,
	lightmaps: true,
	portals: false,
	fpview: function() {},
	about: function() {$('#about').toggle();}
};

function initGUI() {
	var gui = new dat.GUI();
	
	var show = gui.addFolder('Show');
	show.add(visControl,"worldspawn");
	show.add(visControl,"doors");
	show.add(visControl,"triggers");
	show.add(visControl,"portals");
	show.add(visControl,"others");
	
	show.add(visControl,"lightmaps")
		.onFinishChange(setScnLMapsVisibility);

	var controls = gui.addFolder('Navigation');
	controls.add(visControl,"fpview").name("Start FP View (Esc to quit)");
	controls.add(visControl,"about");

	return gui;
}

var setScnVisibility = function() {

	if (scn) {
		for (var c = 0; c < scn.children.length; c++) {
			var solid = scn.children[c];
			
			var isVisible;
			if (solid._scn_classname === 'worldspawn') {
				isVisible = visControl.worldspawn;
			
			} else if (solid._scn_classname === 'door') {
				isVisible = visControl.doors;

			} else if (solid._scn_classname === 'trigger') {
				isVisible = visControl.triggers;

			} else if (solid.name === 'portals') {
				isVisible = visControl.portals;

			} else {
				isVisible = visControl.others;

			}			

			solid.visible = isVisible;		// it does not descend down into the children
			solid.traverse( function(child) { child.visible = isVisible; })	//we must use this
		}
		
	}
}

var setScnLMapsVisibility = function(visible) {
	_iterateAllScnMaterials(function (material) {
		if (!visible) {
				material._lightMapBackup = material.lightMap;
				material.lightMap = null;
		} else {
			if (material._lightMapBackup) {
				material.lightMap = material._lightMapBackup;	
			}
		}
	});
}


