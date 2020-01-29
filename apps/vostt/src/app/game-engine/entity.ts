import { Mesh } from 'three';
import { Body } from 'cannon';

export abstract class Entity {
    public mesh: Mesh;
    public rigidBody: Body;

    constructor() {
        //
    }

    abstract createMesh(): Mesh;

    abstract createRigidBody(): Body;

    initialize() {
        this.mesh = this.createMesh();
        this.rigidBody = this.createRigidBody();
    }

    setPosition(x: number, y: number, z: number) {
        this.mesh.position.set(x, y, z);
        this.rigidBody.position.set(x, y, z);
    }

    setRotation(x: number, y: number, z: number) {
        this.mesh.rotation.set(x, y, z);
        this.rigidBody.quaternion.setFromEuler(x, y, z);
    }
}
