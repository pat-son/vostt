import { TextureLoader, Texture } from 'three'

export function loadTexture(url: string): Promise<Texture> {
    return new Promise((resolve) => {
        new TextureLoader().load(url, resolve);
    });
}
