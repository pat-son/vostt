import { Entity } from '../entity';
import { BoxBufferGeometry, MeshPhongMaterial, Mesh } from 'three';
import { Box, Vec3, Body } from 'cannon';

interface Position {
    x: number;
    y: number;
    z: number;
}

export class CubeEntity extends Entity {
    size = .1;
    mass = 100;

    createMesh() {
        const geometry = new BoxBufferGeometry(this.size, this.size, this.size);
        const material = new MeshPhongMaterial({ color: 0xff0000 });
        const mesh = new Mesh(geometry, material);


        return mesh;
    }

    createRigidBody() {
        const shape = new Box(new Vec3(this.size, this.size, this.size));
        const rigidBody = new Body({ mass: this.mass, shape });
        return rigidBody;
    }
}
