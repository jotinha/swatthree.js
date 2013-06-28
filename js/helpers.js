var visControl = {
	worldspawn: true,
	doors: true,
	triggers: false,
	others: true,
	lightmaps: true,
	fpview: function() {},
	about: function() {$('#about').toggle();}
};

function initGUI() {
	var gui = new dat.GUI();
	
	var show = gui.addFolder('Show');
	show.add(visControl,"worldspawn");
	show.add(visControl,"doors");
	show.add(visControl,"triggers");
	show.add(visControl,"others");
	
	show.add(visControl,"lightmaps")
		.onFinishChange(setScnLMapsVisibility);

	var controls = gui.addFolder('Navigation');
	controls.add(visControl,"fpview").name("Start FP View (Esc to quit)");
	controls.add(visControl,"about");

	return gui;
}

var setVisible = function(obj,bool) {
	obj.traverse(function (c) {
		c._visible_old = c.visible;
		c.visible = bool;
	});
};

var setScnVisibility = function() {



	if (scn) {
		for (var c = 0; c < scn.children.length; c++) {
			var solid = scn.children[c];
		
			if (solid._scn_classname === 'worldspawn') {
				// setVisible(solid,visControl.worldspawn);
			
			} else if (solid._scn_classname === 'door') {
				setVisible(solid,visControl.doors);

			} else if (solid._scn_classname === 'trigger') {
				setVisible(solid,visControl.triggers);

			} else {
				setVisible(solid,visControl.others);

			}			

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


