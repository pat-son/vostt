import { Component, AfterViewInit, ElementRef, ViewChild, NgZone, OnDestroy } from '@angular/core';
import { MeshBasicMaterial, Mesh, TextureLoader, PlaneBufferGeometry, BoxGeometry, Color, MeshPhongMaterial, HemisphereLight } from 'three';
import ResizeObserver from 'resize-observer-polyfill';
import { Engine } from '../../../game-engine/engine';

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
        const scene = this.engine.scene;
        const camera = this.engine.camera;

        const loader = new TextureLoader();

        const mapMaterial = new MeshBasicMaterial({
            map: loader.load('https://s3.amazonaws.com/files.d20.io/images/62023364/rYcPCpvkAW1Jz1MZefsipg/original.png?153612345955',
            (texture) => {
                const mapGeometry = new PlaneBufferGeometry(texture.image.width, texture.image.height);
                const mapMesh = new Mesh(mapGeometry, mapMaterial);
                mapMesh.rotation.set(-(Math.PI) / 2, 0, 0);
                scene.add(mapMesh);
            }),
        });

        const die = new Mesh(new BoxGeometry(10, 10, 10), new MeshPhongMaterial({ color: new Color('red')}));
        die.position.set(0, 20, 0);
        die.rotation.set(Math.PI / 4, 0, 0);
        scene.add(die);

        const light = new HemisphereLight('white', 'brown');
        scene.add(light);

        camera.position.set(0, 400, 200);
        this.ngZone.runOutsideAngular(() => {
            this.engine.render();
        });

        this.observeResize();
    }

    observeResize() {
        this.resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            this.engine.updateSize(width, height);
        });

        this.resizeObserver.observe(this.canvas.nativeElement);
    }
}
