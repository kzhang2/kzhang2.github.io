import * as THREE from "three";

class Slab {

    constructor(renderer, width, height, wrap) {

        this.renderer = renderer;

        this.read = new THREE.WebGLRenderTarget(width, height, {
            wrapS: wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
            wrapT: wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
            // magFilter: THREE.NearestFilter,
            magFilter: THREE.LinearFilter,
            // minFilter: THREE.NearestFilter,
            minFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
        });

        this.write = this.read.clone();

    }

    clear() {

        this.renderer.setRenderTarget(this.write);
        this.renderer.clear();
        this.swap();

    }

    swap() {

        let tmp = this.read;
        this.read = this.write;
        this.write = tmp;

    }

}

export { Slab };