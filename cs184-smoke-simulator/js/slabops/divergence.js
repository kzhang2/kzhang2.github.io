import * as THREE from "three";

class Divergence {

    constructor(renderer, width, height, dx) {
        
        this.renderer = renderer

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            dx: { value: dx },
            w: { type: "t" }, 
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader
        });

        this.plane = new THREE.PlaneGeometry(2, 2);
        this.quad = new THREE.Mesh(this.plane, this.material);

        this.scene = new THREE.Scene();
        
        this.scene.add(this.quad);
    
    }

    compute(w, output) {
        
        this.uniforms.w.value = w.read.texture;

        this.renderer.setRenderTarget(output.write);
        this.renderer.render(this.scene, this.camera);
        output.swap()

    }

    vertexShader = `
        varying vec2 v_uv;
        void main() {
            v_uv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    fragmentShader = `
        varying vec2 v_uv;

        uniform float width;
        uniform float height;
        
        uniform float dx;

        uniform sampler2D w;

        void main() {
            vec2 u_offset = vec2(1.0 / width, 0.0);
            vec2 v_offset = vec2(0.0, 1.0 / height);

            float wL = texture2D(w, v_uv - u_offset).x;
            float wR = texture2D(w, v_uv + u_offset).x;
            float wB = texture2D(w, v_uv - v_offset).y;
            float wT = texture2D(w, v_uv + v_offset).y;

            float halfrdx = 0.5 / dx;

            gl_FragColor = vec4(halfrdx * ((wR - wL) + (wT - wB)), 0.0, 0.0, 1.0);
        }
    `;

}

export { Divergence };