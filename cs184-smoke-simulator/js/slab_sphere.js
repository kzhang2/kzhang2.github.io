import * as THREE from "three";

class SlabSphere {

    constructor(renderer, size) {

        this.renderer = renderer;

        this.read = new THREE.WebGLCubeRenderTarget(size, {
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            // magFilter: THREE.NearestFilter,
            // generateMipmaps: true,
            magFilter: THREE.LinearFilter,
            // minFilter: THREE.LinearMipmapLinearFilter,
            minFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false
            // encoding: THREE.sRGBEncoding
        });
        this.read_camera = new THREE.CubeCamera(0.01, 1000, this.read);

        this.write = this.read.clone();
        this.write_camera = new THREE.CubeCamera(0.01, 1000, this.write);

    }

    clear() {

        this.write.clear(this.renderer);
        this.swap();

    }

    swap() {

        let tmp = this.read;
        this.read = this.write;
        this.write = tmp;

        let tmp_camera = this.read_camera;
        this.read_camera = this.write_camera;
        this.write_camera = tmp_camera;

    }

}

export { SlabSphere };