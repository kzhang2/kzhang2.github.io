import * as THREE from "three";

class Jacobi {

    constructor(renderer, width, height, iterations) {
        
        this.renderer = renderer
        this.iterations = iterations

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            x: { type: "t" },
            b: { type: "t" },
            alpha: { value: -1.0 },
            beta: { value: 4.0 },
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

    compute(x, b, output, alpha, beta) {

        for (let i = 0; i < this.iterations; i++) {
            this.uniforms.alpha.value = alpha;
            this.uniforms.beta.value = beta;
            this.uniforms.x.value = x.read.texture;
            this.uniforms.b.value = b.read.texture;
    
            this.renderer.setRenderTarget(output.write);
            this.renderer.render(this.scene, this.camera);
            output.swap()
        }

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

        uniform float alpha;
        uniform float beta;

        uniform sampler2D x;
        uniform sampler2D b; 

        void main() {
            vec2 u_offset = vec2(1.0 / width, 0.0);
            vec2 v_offset = vec2(0.0, 1.0 / height);

            float xL = texture2D(x, v_uv - u_offset).x;
            float xR = texture2D(x, v_uv + u_offset).x;
            float xB = texture2D(x, v_uv - v_offset).x;
            float xT = texture2D(x, v_uv + v_offset).x;

            float bC = texture2D(b, v_uv).x;

            gl_FragColor = vec4((xL + xR + xB + xT + alpha * bC) / beta, 0.0, 0.0, 1.0);
        }
    `;

}

export { Jacobi };