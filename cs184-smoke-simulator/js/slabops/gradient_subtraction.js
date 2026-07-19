import * as THREE from "three";

class GradientSubtraction {

    constructor(renderer, width, height, dx) {
        
        this.renderer = renderer

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            dx: { value: dx },
            velocity: { type: "t" },
            pressure: { type: "t" },
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

    compute(velocity, pressure, output) {
        
        this.uniforms.velocity.value = velocity.read.texture;
        this.uniforms.pressure.value = pressure.read.texture;

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

        uniform sampler2D pressure;
        uniform sampler2D velocity;

        void main() {
            vec2 u_offset = vec2(1.0 / width, 0.0);
            vec2 v_offset = vec2(0.0, 1.0 / height);

            float pL = texture2D(pressure, v_uv - u_offset).x;
            float pR = texture2D(pressure, v_uv + u_offset).x;
            float pB = texture2D(pressure, v_uv - v_offset).x;
            float pT = texture2D(pressure, v_uv + v_offset).x;

            float halfrdx = 0.5 / dx;
            vec2 gradient = halfrdx * vec2(pR - pL, pT - pB);

            gl_FragColor = vec4(texture2D(velocity, v_uv).xy - gradient, 0.0, 1.0);
        }
    `;

}

export { GradientSubtraction };