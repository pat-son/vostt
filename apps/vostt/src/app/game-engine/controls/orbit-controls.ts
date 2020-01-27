import {
    EventDispatcher,
    MOUSE,
    Quaternion,
    Spherical,
    TOUCH,
    Vector2,
    Vector3,
    PerspectiveCamera,
    OrthographicCamera
} from 'three';

function isPerspectiveCamera(camera: PerspectiveCamera | OrthographicCamera): camera is PerspectiveCamera {
    return (camera as PerspectiveCamera).isPerspectiveCamera;
}

enum STATE {
    NONE = -1,
    ROTATE = 0,
    DOLLY = 1,
    PAN = 2,
    TOUCH_ROTATE = 3,
    TOUCH_PAN = 4,
    TOUCH_DOLLY_PAN = 5,
    TOUCH_DOLLY_ROTATE = 6
}

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

export class OrbitControls extends EventDispatcher {
    camera: PerspectiveCamera | OrthographicCamera;
    domElement: HTMLElement;

    // Set to false to disable this control
    enabled = true;

    // "target" sets the location of focus, where the object orbits around
    target = new Vector3();

    // How far you can dolly in and out ( PerspectiveCamera only )
    minDistance = 0;
    maxDistance = Infinity;

    // How far you can zoom in and out ( OrthographicCamera only )
    minZoom = 0;
    maxZoom = Infinity;

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    minPolarAngle = 0; // radians
    maxPolarAngle = Math.PI; // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    minAzimuthAngle = - Infinity; // radians
    maxAzimuthAngle = Infinity; // radians

    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    enableDamping = false;
    dampingFactor = 0.05;

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    enableZoom = true;
    zoomSpeed = 1.0;

    // Set to false to disable rotating
    enableRotate = true;
    rotateSpeed = 1.0;

    // Set to false to disable panning
    enablePan = true;
    panSpeed = 1.0;
    screenSpacePanning = false; // if true, pan in screen-space
    keyPanSpeed = 7.0;    // pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    autoRotate = false;
    autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    // Set to false to disable use of the keys
    enableKeys = true;

    // The four arrow keys
    keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

    // Mouse buttons
    mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

    // Touch fingers
    touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

    // for reset
    target0: Vector3;
    position0: Vector3;
    zoom0: number;

    private state = STATE.NONE;

    private EPS = 0.000001;

    // current position in spherical coordinates
    private spherical = new Spherical();
    private sphericalDelta = new Spherical();

    private scale = 1;
    private panOffset = new Vector3();
    private zoomChanged = false;

    private rotateStart = new Vector2();
    private rotateEnd = new Vector2();
    private rotateDelta = new Vector2();

    private panStart = new Vector2();
    private panEnd = new Vector2();
    private panDelta = new Vector2();

    private dollyStart = new Vector2();
    private dollyEnd = new Vector2();
    private dollyDelta = new Vector2();

    private offset = new Vector3();

    // so camera.up is the orbit axis
    private quat: Quaternion;
    private quatInverse: Quaternion;

    private lastPosition = new Vector3();
    private lastQuaternion = new Quaternion();

    private panLeftV = new Vector3();
    private panUpV = new Vector3();
    // tslint:disable-next-line: variable-name
    private _panOffset = new Vector3();


    constructor(object: PerspectiveCamera | OrthographicCamera, domElement: HTMLElement) {
        super();
        this.camera = object;
        this.domElement = domElement;

        // for reset
        this.target0 = this.target.clone();
        this.position0 = this.camera.position.clone();
        this.zoom0 = this.camera.zoom;

        this.quat = new Quaternion().setFromUnitVectors(this.camera.up, new Vector3(0, 1, 0));
        this.quatInverse = this.quat.clone().inverse();

        this.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this), false);

        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), false);

        this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), false);
        this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), false);
        this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), false);

        this.domElement.addEventListener('keydown', this.onKeyDown.bind(this), false);

        // make sure element can receive keys.

        if (this.domElement.tabIndex === - 1) {

            this.domElement.tabIndex = 0;

        }

        this.update();
    }

    //
    // public methods
    //

    getPolarAngle() {

        return this.spherical.phi;

    }

    getAzimuthalAngle() {

        return this.spherical.theta;

    }

    saveState() {

        this.target0.copy(this.target);
        this.position0.copy(this.camera.position);
        this.zoom0 = this.camera.zoom;

    }

    reset() {

        this.target.copy(this.target0);
        this.camera.position.copy(this.position0);
        this.camera.zoom = this.zoom0;

        this.camera.updateProjectionMatrix();
        this.dispatchEvent(new Event('change'));

        this.update();

        this.state = STATE.NONE;

    }

    // this method is exposed, but perhaps it would be better if we can make it private...
    update() {
        const position = this.camera.position;

        this.offset.copy(position).sub(this.target);

        // rotate offset to "y-axis-is-up" space
        this.offset.applyQuaternion(this.quat);

        // angle from z-axis around y-axis
        this.spherical.setFromVector3(this.offset);

        if (this.autoRotate && this.state === STATE.NONE) {

            this.rotateLeft(this.getAutoRotationAngle());

        }

        if (this.enableDamping) {

            this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
            this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;

        } else {

            this.spherical.theta += this.sphericalDelta.theta;
            this.spherical.phi += this.sphericalDelta.phi;

        }

        // restrict theta to be between desired limits
        this.spherical.theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, this.spherical.theta));

        // restrict phi to be between desired limits
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));

        this.spherical.makeSafe();


        this.spherical.radius *= this.scale;

        // restrict radius to be between desired limits
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

        // move target to panned location

        if (this.enableDamping === true) {

            this.target.addScaledVector(this.panOffset, this.dampingFactor);

        } else {

            this.target.add(this.panOffset);

        }

        this.offset.setFromSpherical(this.spherical);

        // rotate offset back to "camera-up-vector-is-up" space
        this.offset.applyQuaternion(this.quatInverse);

        position.copy(this.target).add(this.offset);

        this.camera.lookAt(this.target);

        if (this.enableDamping === true) {

            this.sphericalDelta.theta *= (1 - this.dampingFactor);
            this.sphericalDelta.phi *= (1 - this.dampingFactor);

            this.panOffset.multiplyScalar(1 - this.dampingFactor);

        } else {

            this.sphericalDelta.set(0, 0, 0);

            this.panOffset.set(0, 0, 0);

        }

        this.scale = 1;

        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8

        if (this.zoomChanged ||
            this.lastPosition.distanceToSquared(this.camera.position) > this.EPS ||
            8 * (1 - this.lastQuaternion.dot(this.camera.quaternion)) > this.EPS) {

            this.dispatchEvent(new Event('change'));

            this.lastPosition.copy(this.camera.position);
            this.lastQuaternion.copy(this.camera.quaternion);
            this.zoomChanged = false;

            return true;

        }

        return false;
    }

    dispose() {

        this.domElement.removeEventListener('contextmenu', this.onContextMenu, false);
        this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
        this.domElement.removeEventListener('wheel', this.onMouseWheel, false);

        this.domElement.removeEventListener('touchstart', this.onTouchStart, false);
        this.domElement.removeEventListener('touchend', this.onTouchEnd, false);
        this.domElement.removeEventListener('touchmove', this.onTouchMove, false);

        document.removeEventListener('mousemove', this.onMouseMove, false);
        document.removeEventListener('mouseup', this.onMouseUp, false);

        this.domElement.removeEventListener('keydown', this.onKeyDown, false);

        // this.dispatchEvent( { type: 'dispose' } ); // should this be added here?

    }

    private getAutoRotationAngle() {

        return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;

    }

    private getZoomScale() {

        return Math.pow(0.95, this.zoomSpeed);

    }

    private rotateLeft(angle) {

        this.sphericalDelta.theta -= angle;

    }

    private rotateUp(angle) {

        this.sphericalDelta.phi -= angle;

    }

    panLeft(distance, objectMatrix) {
        this.panLeftV.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
        this.panLeftV.multiplyScalar(- distance);

        this.panOffset.add(this.panLeftV);
    }

    panUp(distance, objectMatrix) {

        if (this.screenSpacePanning === true) {

            this.panUpV.setFromMatrixColumn(objectMatrix, 1);

        } else {

            this.panUpV.setFromMatrixColumn(objectMatrix, 0);
            this.panUpV.crossVectors(this.camera.up, this.panUpV);

        }

        this.panUpV.multiplyScalar(distance);

        this.panOffset.add(this.panUpV);

    }

    pan(deltaX, deltaY) {

        const element = this.domElement;

        if (isPerspectiveCamera(this.camera)) {

            // perspective
            const position = this.camera.position;
            this._panOffset.copy(position).sub(this.target);
            let targetDistance = this._panOffset.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan((this.camera.fov / 2) * Math.PI / 180.0);

            // we use only clientHeight here so aspect ratio does not distort speed
            this.panLeft(2 * deltaX * targetDistance / element.clientHeight, this.camera.matrix);
            this.panUp(2 * deltaY * targetDistance / element.clientHeight, this.camera.matrix);

        } else if (this.camera.isOrthographicCamera) {

            // orthographic
            this.panLeft(deltaX * (this.camera.right - this.camera.left) / this.camera.zoom / element.clientWidth, this.camera.matrix);
            this.panUp(deltaY * (this.camera.top - this.camera.bottom) / this.camera.zoom / element.clientHeight, this.camera.matrix);

        } else {

            // camera neither orthographic nor perspective
            console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
            this.enablePan = false;

        }

    }


    private dollyIn(dollyScale) {

        if (isPerspectiveCamera(this.camera)) {

            this.scale /= dollyScale;

        } else if (this.camera.isOrthographicCamera) {

            this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom * dollyScale));
            this.camera.updateProjectionMatrix();
            this.zoomChanged = true;

        } else {

            console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
            this.enableZoom = false;

        }

    }

    private dollyOut(dollyScale) {

        if (isPerspectiveCamera(this.camera)) {

            this.scale *= dollyScale;

        } else if (this.camera.isOrthographicCamera) {

            this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom / dollyScale));
            this.camera.updateProjectionMatrix();
            this.zoomChanged = true;

        } else {

            console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
            this.enableZoom = false;

        }

    }

    //
    // event callbacks - update the object state
    //

    private handleMouseDownRotate(event) {

        this.rotateStart.set(event.clientX, event.clientY);

    }

    private handleMouseDownDolly(event) {

        this.dollyStart.set(event.clientX, event.clientY);

    }

    private handleMouseDownPan(event) {

        this.panStart.set(event.clientX, event.clientY);

    }

    private handleMouseMoveRotate(event) {

        this.rotateEnd.set(event.clientX, event.clientY);

        this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);

        const element = this.domElement;

        this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight); // yes, height

        this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);

        this.rotateStart.copy(this.rotateEnd);

        this.update();

    }

    private handleMouseMoveDolly(event) {

        this.dollyEnd.set(event.clientX, event.clientY);

        this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

        if (this.dollyDelta.y > 0) {

            this.dollyIn(this.getZoomScale());

        } else if (this.dollyDelta.y < 0) {

            this.dollyOut(this.getZoomScale());

        }

        this.dollyStart.copy(this.dollyEnd);

        this.update();

    }

    private handleMouseMovePan(event) {

        this.panEnd.set(event.clientX, event.clientY);

        this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);

        this.pan(this.panDelta.x, this.panDelta.y);

        this.panStart.copy(this.panEnd);

        this.update();

    }

    private handleMouseWheel(event) {

        if (event.deltaY < 0) {

            this.dollyOut(this.getZoomScale());

        } else if (event.deltaY > 0) {

            this.dollyIn(this.getZoomScale());

        }

        this.update();

    }

    private handleKeyDown(event) {

        let needsUpdate = false;

        switch (event.keyCode) {

            case this.keys.UP:
                this.pan(0, this.keyPanSpeed);
                needsUpdate = true;
                break;

            case this.keys.BOTTOM:
                this.pan(0, - this.keyPanSpeed);
                needsUpdate = true;
                break;

            case this.keys.LEFT:
                this.pan(this.keyPanSpeed, 0);
                needsUpdate = true;
                break;

            case this.keys.RIGHT:
                this.pan(- this.keyPanSpeed, 0);
                needsUpdate = true;
                break;

        }

        if (needsUpdate) {

            // prevent the browser from scrolling on cursor keys
            event.preventDefault();

            this.update();

        }


    }

    private handleTouchStartRotate(event) {

        if (event.touches.length === 1) {

            this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);

        } else {

            const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
            const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

            this.rotateStart.set(x, y);

        }

    }

    private handleTouchStartPan(event) {

        if (event.touches.length === 1) {

            this.panStart.set(event.touches[0].pageX, event.touches[0].pageY);

        } else {

            const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
            const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

            this.panStart.set(x, y);

        }

    }

    private handleTouchStartDolly(event) {

        const dx = event.touches[0].pageX - event.touches[1].pageX;
        const dy = event.touches[0].pageY - event.touches[1].pageY;

        const distance = Math.sqrt(dx * dx + dy * dy);

        this.dollyStart.set(0, distance);

    }

    private handleTouchStartDollyPan(event) {

        if (this.enableZoom) { this.handleTouchStartDolly(event); }

        if (this.enablePan) { this.handleTouchStartPan(event); }

    }

    private handleTouchStartDollyRotate(event) {

        if (this.enableZoom) { this.handleTouchStartDolly(event); }

        if (this.enableRotate) { this.handleTouchStartRotate(event); }

    }

    private handleTouchMoveRotate(event) {

        if (event.touches.length === 1) {

            this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);

        } else {

            const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
            const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

            this.rotateEnd.set(x, y);

        }

        this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);

        const element = this.domElement;

        this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight); // yes, height

        this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);

        this.rotateStart.copy(this.rotateEnd);

    }

    private handleTouchMovePan(event) {

        if (event.touches.length === 1) {

            this.panEnd.set(event.touches[0].pageX, event.touches[0].pageY);

        } else {

            const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
            const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

            this.panEnd.set(x, y);

        }

        this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);

        this.pan(this.panDelta.x, this.panDelta.y);

        this.panStart.copy(this.panEnd);

    }

    private handleTouchMoveDolly(event) {

        const dx = event.touches[0].pageX - event.touches[1].pageX;
        const dy = event.touches[0].pageY - event.touches[1].pageY;

        const distance = Math.sqrt(dx * dx + dy * dy);

        this.dollyEnd.set(0, distance);

        this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));

        this.dollyIn(this.dollyDelta.y);

        this.dollyStart.copy(this.dollyEnd);

    }

    private handleTouchMoveDollyPan(event) {

        if (this.enableZoom) { this.handleTouchMoveDolly(event); }

        if (this.enablePan) { this.handleTouchMovePan(event); }

    }

    private handleTouchMoveDollyRotate(event) {

        if (this.enableZoom) { this.handleTouchMoveDolly(event); }

        if (this.enableRotate) { this.handleTouchMoveRotate(event); }

    }

    //
    // event handlers - FSM: listen for events and reset state
    //

    private onMouseDown(event) {

        if (this.enabled === false) { return; }

        // Prevent the browser from scrolling.

        event.preventDefault();

        // Manually set the focus since calling preventDefault above
        // prevents the browser from setting it automatically.

        this.domElement.focus ? this.domElement.focus() : window.focus();

        switch (event.button) {

            case 0:

                switch (this.mouseButtons.LEFT) {

                    case MOUSE.ROTATE:

                        if (event.ctrlKey || event.metaKey || event.shiftKey) {

                            if (this.enablePan === false) { return; }

                            this.handleMouseDownPan(event);

                            this.state = STATE.PAN;

                        } else {

                            if (this.enableRotate === false) { return; }

                            this.handleMouseDownRotate(event);

                            this.state = STATE.ROTATE;

                        }

                        break;

                    case MOUSE.DOLLY:

                        if (this.enableZoom === false) { return; }

                        this.handleMouseDownDolly(event);

                        this.state = STATE.DOLLY;

                        break;

                    case MOUSE.PAN:

                        if (event.ctrlKey || event.metaKey || event.shiftKey) {

                            if (this.enableRotate === false) { return; }

                            this.handleMouseDownRotate(event);

                            this.state = STATE.ROTATE;

                        } else {

                            if (this.enablePan === false) { return; }

                            this.handleMouseDownPan(event);

                            this.state = STATE.PAN;

                        }

                        break;

                    default:

                        this.state = STATE.NONE;

                }

                break;


            case 1:

                switch (this.mouseButtons.MIDDLE) {

                    case MOUSE.DOLLY:

                        if (this.enableZoom === false) { return; }

                        this.handleMouseDownDolly(event);

                        this.state = STATE.DOLLY;

                        break;

                    case MOUSE.ROTATE:

                        if (event.ctrlKey || event.metaKey || event.shiftKey) {

                            if (this.enablePan === false) { return; }

                            this.handleMouseDownPan(event);

                            this.state = STATE.PAN;

                        } else {

                            if (this.enableRotate === false) { return; }

                            this.handleMouseDownRotate(event);

                            this.state = STATE.ROTATE;

                        }

                        break;

                    case MOUSE.PAN:

                        if (event.ctrlKey || event.metaKey || event.shiftKey) {

                            if (this.enableRotate === false) { return; }

                            this.handleMouseDownRotate(event);

                            this.state = STATE.ROTATE;

                        } else {

                            if (this.enablePan === false) { return; }

                            this.handleMouseDownPan(event);

                            this.state = STATE.PAN;

                        }

                        break;


                    default:

                        this.state = STATE.NONE;

                }

                break;

            case 2:

                switch (this.mouseButtons.RIGHT) {

                    case MOUSE.ROTATE:

                        if (event.ctrlKey || event.metaKey || event.shiftKey) {

                            if (this.enablePan === false) { return; }

                            this.handleMouseDownPan(event);

                            this.state = STATE.PAN;

                        } else {

                            if (this.enableRotate === false) { return; }

                            this.handleMouseDownRotate(event);

                            this.state = STATE.ROTATE;

                        }

                        break;

                    case MOUSE.PAN:

                        if (this.enablePan === false) { return; }

                        this.handleMouseDownPan(event);

                        this.state = STATE.PAN;

                        break;

                    case MOUSE.DOLLY:

                        if (this.enableZoom === false) { return; }

                        this.handleMouseDownDolly(event);

                        this.state = STATE.DOLLY;

                        break;

                    default:

                        this.state = STATE.NONE;

                }

                break;

        }

        if (this.state !== STATE.NONE) {

            document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
            document.addEventListener('mouseup', this.onMouseUp.bind(this), false);

            this.dispatchEvent(new Event('start'));

        }

    }

    private onMouseMove(event) {

        if (this.enabled === false) { return; }

        event.preventDefault();

        switch (this.state) {

            case STATE.ROTATE:

                if (this.enableRotate === false) { return; }

                this.handleMouseMoveRotate(event);

                break;

            case STATE.DOLLY:

                if (this.enableZoom === false) { return; }

                this.handleMouseMoveDolly(event);

                break;

            case STATE.PAN:

                if (this.enablePan === false) { return; }

                this.handleMouseMovePan(event);

                break;

        }

    }

    private onMouseUp(event) {

        if (this.enabled === false) { return; }

        document.removeEventListener('mousemove', this.onMouseMove, false);
        document.removeEventListener('mouseup', this.onMouseUp, false);

        this.dispatchEvent(new Event('end'));

        this.state = STATE.NONE;

    }

    private onMouseWheel(event) {

        if (this.enabled === false || this.enableZoom === false || (this.state !== STATE.NONE && this.state !== STATE.ROTATE)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.dispatchEvent(new Event('start'));

        this.handleMouseWheel(event);

        this.dispatchEvent(new Event('end'));

    }

    private onKeyDown(event) {

        if (this.enabled === false || this.enableKeys === false || this.enablePan === false) { return; }

        this.handleKeyDown(event);

    }

    private onTouchStart(event) {

        if (this.enabled === false) { return; }

        event.preventDefault();

        switch (event.touches.length) {

            case 1:

                switch (this.touches.ONE) {

                    case TOUCH.ROTATE:

                        if (this.enableRotate === false) { return; }

                        this.handleTouchStartRotate(event);

                        this.state = STATE.TOUCH_ROTATE;

                        break;

                    case TOUCH.PAN:

                        if (this.enablePan === false) { return; }

                        this.handleTouchStartPan(event);

                        this.state = STATE.TOUCH_PAN;

                        break;

                    default:

                        this.state = STATE.NONE;

                }

                break;

            case 2:

                switch (this.touches.TWO) {

                    case TOUCH.DOLLY_PAN:

                        if (this.enableZoom === false && this.enablePan === false) { return; }

                        this.handleTouchStartDollyPan(event);

                        this.state = STATE.TOUCH_DOLLY_PAN;

                        break;

                    case TOUCH.DOLLY_ROTATE:

                        if (this.enableZoom === false && this.enableRotate === false) { return; }

                        this.handleTouchStartDollyRotate(event);

                        this.state = STATE.TOUCH_DOLLY_ROTATE;

                        break;

                    default:

                        this.state = STATE.NONE;

                }

                break;

            default:

                this.state = STATE.NONE;

        }

        if (this.state !== STATE.NONE) {

            this.dispatchEvent(new Event('start'));

        }

    }

    private onTouchMove(event) {

        if (this.enabled === false) { return; }

        event.preventDefault();
        event.stopPropagation();

        switch (this.state) {

            case STATE.TOUCH_ROTATE:

                if (this.enableRotate === false) { return; }

                this.handleTouchMoveRotate(event);

                this.update();

                break;

            case STATE.TOUCH_PAN:

                if (this.enablePan === false) { return; }

                this.handleTouchMovePan(event);

                this.update();

                break;

            case STATE.TOUCH_DOLLY_PAN:

                if (this.enableZoom === false && this.enablePan === false) { return; }

                this.handleTouchMoveDollyPan(event);

                this.update();

                break;

            case STATE.TOUCH_DOLLY_ROTATE:

                if (this.enableZoom === false && this.enableRotate === false) { return; }

                this.handleTouchMoveDollyRotate(event);

                this.update();

                break;

            default:

                this.state = STATE.NONE;

        }

    }

    private onTouchEnd(event) {

        if (this.enabled === false) { return; }

        this.dispatchEvent(new Event('end'));

        this.state = STATE.NONE;

    }

    private onContextMenu(event) {

        if (this.enabled === false) { return; }

        event.preventDefault();

    }
}
