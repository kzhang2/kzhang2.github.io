import * as THREE from "three";

class JacobiSphere {

    constructor(renderer, dx, iterations) {
        
        this.renderer = renderer
        this.iterations = iterations

        this.uniforms = {
            dx: { value: dx },
            x: { },
            b: { },
            alpha: { value: -1.0 },
            beta: { value: 4.0 },
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            side: THREE.BackSide,
            blending: THREE.NoBlending
        });

        this.sphere = new THREE.SphereGeometry(1, 32, 32);
        this.mesh = new THREE.Mesh(this.sphere, this.material);

        this.scene = new THREE.Scene();
        
        this.scene.add(this.mesh);
    
    }

    compute(x, b, output, alpha, beta) {

        for (let i = 0; i < this.iterations; i++) {
            this.uniforms.alpha.value = alpha;
            this.uniforms.beta.value = beta;
            this.uniforms.x.value = x.read.texture;
            this.uniforms.b.value = b.read.texture;
    
            output.write_camera.update(this.renderer, this.scene);
            output.swap();
        }

    }

    vertexShader = `
        varying vec3 v_position;
        void main() {
            v_position = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    fragmentShader = `
        varying vec3 v_position;

        uniform float dx;

        uniform float alpha;
        uniform float beta;

        uniform samplerCube x;
        uniform samplerCube b; 

        void main() {
            vec3 pos = normalize(v_position);

            vec3 x_offset = vec3(dx, 0.0, 0.0);
            vec3 y_offset = vec3(0.0, dx, 0.0);
            vec3 z_offset = vec3(0.0, 0.0, dx);

            float xx0 = textureCube(x, pos - x_offset).x;
            float xx1 = textureCube(x, pos + x_offset).x;
            float xy0 = textureCube(x, pos - y_offset).x;
            float xy1 = textureCube(x, pos + y_offset).x;
            float xz0 = textureCube(x, pos - z_offset).x;
            float xz1 = textureCube(x, pos + z_offset).x;

            float bC = textureCube(b, pos).x;

            gl_FragColor = vec4((xx0 + xx1 + xy0 + xy1 + xz0 + xz1 + alpha * bC) / beta, 0.0, 0.0, 1.0);
        }
    `;

}

export { JacobiSphere };