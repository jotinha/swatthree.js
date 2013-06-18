/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.PointerLockControls_noClip = function ( camera, options ) {

	options = options || {};
	var rotationSpeed = options.rotationSpeed || 0.005;
	var moveSpeed = options.moveSpeed || 100.0;
	var gravitySpeed = options.gravitySpeed || 25;
	var fallDown = options.fallDown || false;
	var height = options.height || 50;

	var scope = this;

	var pitchObject = new THREE.Object3D();
	pitchObject.add( camera );

	var yawObject = new THREE.Object3D();
	if (fallDown) {
		yawObject.position.y = height;
	}
	yawObject.add( pitchObject );

	var moveForward = false;
	var moveBackward = false;
	var moveLeft = false;
	var moveRight = false;

	var isOnObject = false;
	var canJump = false;

	var velocity = new THREE.Vector3();

	var PI_2 = Math.PI / 2;

	var xplus = new THREE.Vector3(1,0,0);

	var onMouseMove = function ( event ) {

		// if ( scope.enabled === false ) return;

		var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
		var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

		yawObject.rotation.y -= movementX * rotationSpeed;
		pitchObject.rotation.x -= movementY * rotationSpeed;

		pitchObject.rotation.x = Math.max( - PI_2, Math.min( PI_2, pitchObject.rotation.x ) );

	};

	var onKeyDown = function ( event ) {

		switch ( event.keyCode ) {

			case 38: // up
			case 87: // w
				moveForward = true;
				break;

			case 37: // left
			case 65: // a
				moveLeft = true; break;

			case 40: // down
			case 83: // s
				moveBackward = true;
				break;

			case 39: // right
			case 68: // d
				moveRight = true;
				break;

			case 32: // space
				if ( canJump === true ) velocity.y += 10;
				canJump = false;
				break;

		}

	};

	var onKeyUp = function ( event ) {

		switch( event.keyCode ) {

			case 38: // up
			case 87: // w
				moveForward = false;
				break;

			case 37: // left
			case 65: // a
				moveLeft = false;
				break;

			case 40: // down
			case 83: // a
				moveBackward = false;
				break;

			case 39: // right
			case 68: // d
				moveRight = false;
				break;

		}

	};

	document.addEventListener( 'mousemove', onMouseMove, false );
	document.addEventListener( 'keydown', onKeyDown, false );
	document.addEventListener( 'keyup', onKeyUp, false );

	// this.enabled = false;

	this.getObject = function () {

		return yawObject;

	};

	this.isOnObject = function ( boolean ) {

		isOnObject = boolean;
		canJump = boolean;

	};

	this.update = function ( delta ) {

		// if ( scope.enabled === false ) return;

		//don't use soft slowing down, just reset velocity
		//velocity.x += ( - velocity.x ) * 0.08 * delta;
		//velocity.z += ( - velocity.z ) * 0.08 * delta;

		velocity.x = 0;
		velocity.z = 0;

		if ( moveForward ) velocity.z -= moveSpeed * delta;
		if ( moveBackward ) velocity.z += moveSpeed * delta;

		if ( moveLeft ) velocity.x -= moveSpeed * delta;
		if ( moveRight ) velocity.x += moveSpeed * delta;


		if (fallDown) {
			velocity.y -= gravitySpeed * delta;
			if ( isOnObject === true ) {
				velocity.y = Math.max( 0, velocity.y );
			}
		} else {
			velocity.y = 0;
			//velocity vector is defined for the yawObject, which does not pitch.
			// If we are in flying mode, we must set translation to follow pitch direction as well
			if (velocity.x !== 0 || velocity.z !== 0) {
				velocity.applyAxisAngle(xplus,pitchObject.rotation.x);
			}
		}

		yawObject.translateX( velocity.x );
		yawObject.translateY( velocity.y ); 
		yawObject.translateZ( velocity.z );

		if (fallDown) {
			if ( yawObject.position.y < height ) {

				velocity.y = 0;
				yawObject.position.y = height;

				canJump = true;

			}
		}

	};

};
