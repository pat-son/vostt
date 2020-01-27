import { WebGLRenderer, Scene, PerspectiveCamera, Clock, MOUSE } from 'three';
import { OrbitControls } from './controls/orbit-controls';

export class Engine {
    public canvas: HTMLCanvasElement;
    public renderer: WebGLRenderer;
    public scene: Scene;
    public camera: PerspectiveCamera;
    public cameraControls: OrbitControls;

    private clock: Clock;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.renderer = new WebGLRenderer({ canvas, antialias: true });
        this.scene = new Scene();

        this.camera = new PerspectiveCamera(
            75,
            this.canvas.offsetWidth / this.canvas.offsetHeight,
            0.1,
            2000
        );

        this.cameraControls = new OrbitControls(this.camera, this.canvas);
        this.cameraControls.enableDamping = true;
        this.cameraControls.dampingFactor = 0.05;
        this.cameraControls.maxPolarAngle = 1.5;
        this.cameraControls.mouseButtons = {
            LEFT: -1,
            MIDDLE: MOUSE.PAN,
            RIGHT: MOUSE.ROTATE,
        };

        this.clock = new Clock();
    }

    public render() {
        requestAnimationFrame(() => {
            this.render();
        });
        this.cameraControls.update();
        this.renderer.render(this.scene, this.camera);
    }

    public updateSize(width: number, height: number) {
        // TODO: Test different device pixel ratios
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
}
