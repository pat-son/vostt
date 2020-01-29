import { Component, AfterViewInit, ElementRef, ViewChild, NgZone, OnDestroy } from '@angular/core';
import { MeshBasicMaterial, Mesh, TextureLoader, PlaneBufferGeometry, BoxGeometry, Color, MeshPhongMaterial, HemisphereLight } from 'three';
import ResizeObserver from 'resize-observer-polyfill';
import { Engine } from '../../../game-engine/engine';
import { loadTexture } from '../../../game-engine/loaders';
import { GroundEntity } from '../../../game-engine/entities/ground';
import { CubeEntity } from '../../../game-engine/entities/cube';
import { Vec3 } from 'cannon';

@Component({
    selector: 'vostt-game-view',
    templateUrl: './game-view.component.html',
    styleUrls: ['./game-view.component.scss']
})
export class GameViewComponent implements AfterViewInit, OnDestroy {
    @ViewChild('renderTarget', { static: true }) canvas: ElementRef<HTMLCanvasElement>;
    private engine: Engine;

    private resizeObserver: ResizeObserver;

    constructor(private ngZone: NgZone) { }

    ngOnDestroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }

    ngAfterViewInit(): void {
        this.engine = new Engine(this.canvas.nativeElement);
        this.initializeEngine();
        this.observeResize();
    }

    async initializeEngine() {
        this.ngZone.runOutsideAngular(async () => {
            const scene = this.engine.scene;
            const camera = this.engine.camera;

            const mapTexture = await loadTexture('https://s3.amazonaws.com/files.d20.io/images/62023364/rYcPCpvkAW1Jz1MZefsipg/original.png?153612345955');
            this.engine.addEntity(new GroundEntity(mapTexture));
            const cube = new CubeEntity();
            this.engine.addEntity(cube);
            cube.setPosition(0, 1, 0);
            cube.setRotation(Math.PI / 4, Math.PI / 4, 0);
            cube.rigidBody.applyImpulse(new Vec3(70, -100, 25), new Vec3(0, 0, 0));

            const light = new HemisphereLight('white', 'brown');
            scene.add(light);

            camera.position.set(1, 1, 1);
            this.engine.render();
        });
    }

    observeResize() {
        this.resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            this.engine.updateSize(width, height);
        });

        this.resizeObserver.observe(this.canvas.nativeElement);
    }
}
