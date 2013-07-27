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

BspTree.prototype.checkCollision = function(pos,sphereRadius,startNode,impactPlane) {
	var node = startNode || this.root ;
	var radius = sphereRadius || 0;
	
	if (node.isLeaf) {

		if (node.isSolid) {
			if (impactPlane) {
				impactPlane.copy(this.nodes[node.nodep].plane);
			}
			return true;
		} else {
			return false;
		}

	} else {
	
		var d = node.plane.distanceToPoint(pos);

		var n1 = this.nodes[node.node1];
		var n2 = this.nodes[node.node2];

		if ( d >= radius) {
			return this.checkCollision(pos, sphereRadius, n1, impactPlane);
		} else if ( d < -radius) {
			return this.checkCollision(pos, sphereRadius, n2, impactPlane);
		} else {
			return this.checkCollision(pos, sphereRadius, n2, impactPlane) ||
				   this.checkCollision(pos, sphereRadius, n1, impactPlane);
				   
		}
	}
};

BspTree.prototype.collideRay = function() {

	var timpact = null;
	var nodeList;
	var _ray;
	var planeImpact;

	var collide = function(t0,t1,node) {

		var hit = false;

		if (node.isLeaf) {
			
			hit = node.isSolid;
			if (hit) {
				timpact = t0;
				planeImpact = nodeList[node.nodep].plane;
			}
			return hit;

		}

		var plane = node.plane;

		var isFwd = plane.normal.dot(_ray.direction) < 0;

		var outNode = nodeList[node.node1];
		var inNode = nodeList[node.node2];
		
		var ti = _ray.distanceToPlane_allowNegative(plane);

		if (ti === null) {
			//ray is parallel to plane
			return collide(t0,t1,plane.distanceToPoint(_ray.origin) < 0 ? inNode : outNode);
		}

		if (isFwd) {
			
			if (ti >= t1) {	//both outside

				return collide(t0,t1,outNode);

			} else if (ti <= t0) { // both inside
				
				return collide(t0,t1,inNode);
			
			} else {	

				return collide(t0,ti,outNode) || collide(ti,t1,inNode);

			}
			
		} else {

			if (ti >= t1) {	//both inside

				return collide(t0,t1,inNode);

			} else if (ti <= t0) { // both outside
				
				return collide(t0,t1,outNode);
			
			} else {	

				return collide(ti,t1,outNode) || collide(t0,ti,inNode);

			}
		}

	};

	return function(ray,t0,t1,impactTarget) {

		nodeList = this.nodes;

		_ray = ray;

		var hit = collide(t0,t1,this.root);

		if (hit) {
			if (impactTarget) ray.at(timpact,impactTarget);
			return timpact;
		} else {
			return null;
		}

	}

}();

BspTree.prototype.checkCollisionVector = function() {

	var ray = new THREE.Ray();
	
	var timpact; var impactDir;

	var localPlane = new THREE.Plane();

	var nodeList;
	var radius;

	var localRay = new THREE.Ray();
	
	var clipLineInside = function(plane,shift,ray,t0,t1,tout,isFwd) {

		tout.t0 = t0;
		tout.t1 = t1;
		
		localPlane.copy(plane);
		localPlane.constant -= shift;

		var d = ray.distanceToPlane_allowNegative(localPlane);

		if ( d === null ) {	//ray is parallel to plane

			return plane.distanceToPoint(ray.origin) < 0;
		}

		if (isFwd) {

			if ( d < t0) {
				return true;
			} else if ( d > t1) {
				return false;
			} else {
				tout.t0 = d;
				return true;
			}
		
		} else {

			if ( d < t0 ) {
				return false;
			} else if ( d > t1) {
				return true;
			} else {
				tout.t1 = d;
				return true;
			}

		}

	};


	var clipLineOutside = function(plane,shift,ray,t0,t1,tout,isFwd) {

		tout.t0 = t0;
		tout.t1 = t1;

		localPlane.copy(plane);
		localPlane.constant += shift;		//shift in

		var d = ray.distanceToPlane_allowNegative(localPlane);
		
		if ( d === null ) {	//ray is parallel to plane

			return !(plane.distanceToPoint(ray.origin) < 0);
		}

		if (isFwd) {

			if (d < t0) {
				return false;
			} else if ( d > t1) {
				return true;
			} else {
				tout.t1 = d;
				return true;
			}
		} else {

			if ( d < t0) {
				return true;
			} else if ( d > t1) {
				return false;
			} else {
				tout.t0 = d;
				return true;
			}
		}

	};

	var checkCollisionRay = function(node,t0,t1) {

		var hit = false;

		if (node.isLeaf) {
			
			hit = node.isSolid;
			if (hit) timpact = t0;
			return hit;

		}
		
		var plane = node.plane;

		var tout = {};

		var isFwd = plane.normal.dot(ray.direction) < 0;


		if (clipLineInside(plane,radius,ray,t0,t1,tout,isFwd)) {

			//go into negative node
			hit = checkCollisionRay(nodeList[node.node2],tout.t0,tout.t1);

			// if (hit) t1 = tout.t0;

		}


		if (clipLineOutside(plane,radius,ray,t0,t1,tout,isFwd)) {

			//go into positive node as well because we may have hit a plane sooner

			hit = checkCollisionRay(nodeList[node.node1],tout.t0,tout.t1) || hit;

		}
		
		return hit;

	};


	return function (p0,p1,sphereRadius,impactTarget,startNode) {
	
		var node = startNode || this.root ;

		//setup globals
		radius = sphereRadius || 0;
		nodeList = this.nodes;

		// setup ray

		ray.origin.copy(p0);
		ray.direction.subVectors(p1,p0);
		
		var dist = ray.direction.length();

		//p0 == p1
		if (dist === 0) {

			// return false; //TEMP

			// use point checkCollision
			if (this.checkCollision(p0,radius, node)) {
				impactTarget.copy(p0);
				return true;
			} else {
				return false;
			}

		}

		ray.direction.normalize();

		if (checkCollisionRay(node,0,dist)) {
			
			ray.at(timpact,impactTarget);
			
			return true;
		
		} else {
		
			return false;
		
		}

	};

}();



