import { WebGLRenderer, Scene, PerspectiveCamera, Clock, MOUSE } from 'three';
import { OrbitControls } from './controls/orbit-controls';
import { Entity } from './entity';
import { World, NaiveBroadphase } from 'cannon';

export class Engine {
    public canvas: HTMLCanvasElement;
    public renderer: WebGLRenderer;
    public scene: Scene;
    public camera: PerspectiveCamera;
    public cameraControls: OrbitControls;
    public physicsWorld: World;

    private entities: Entity[] = [];
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

        this.physicsWorld = new World();
        this.physicsWorld.gravity.set(0, -9.82, 0);
        this.physicsWorld.broadphase = new NaiveBroadphase();

        this.clock = new Clock();
    }

    public render() {
        const deltaTime = this.clock.getDelta();
        this.physicsWorld.step(1 / 60, deltaTime, 10);

        for (const entity of this.entities) {
            const position = entity.rigidBody.position;
            const rotation = entity.rigidBody.quaternion;
            entity.mesh.position.set(position.x, position.y, position.z);
            entity.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }

        this.cameraControls.update();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => {
            this.render();
        });
    }

    public updateSize(width: number, height: number) {
        // TODO: Test different device pixel ratios
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    public addEntity(entity: Entity) {
        entity.initialize();
        this.physicsWorld.addBody(entity.rigidBody);
        this.scene.add(entity.mesh);
        this.entities.push(entity);
    }
}
