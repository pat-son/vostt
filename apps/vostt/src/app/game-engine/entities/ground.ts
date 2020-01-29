import { Entity } from '../entity';
import { Texture, MeshBasicMaterial, PlaneBufferGeometry, Mesh } from 'three';
import { Plane, Body } from 'cannon';

export class GroundEntity extends Entity {
    texture: Texture;
    constructor(texture: Texture) {
        super();
        this.texture = texture;
    }

    createMesh() {
        const aspectRatio = this.texture.image.width / this.texture.image.height
        const geometry = new PlaneBufferGeometry(10 * aspectRatio, 10);
        const material = new MeshBasicMaterial({ map: this.texture });
        const mesh = new Mesh(geometry, material);
        mesh.rotateX(-(Math.PI) / 2);

        return mesh;
    }

    createRigidBody() {
        const shape = new Plane();
        const rigidBody = new Body({ mass: 0, shape });
        rigidBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        return rigidBody;
    }
}
