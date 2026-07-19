import * as THREE from "three";

class VorticityConf {

    constructor(renderer, width, height, dt, dx) {
        
        this.renderer = renderer

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            velocity: { type: "t" },
            curl: { type: "t"},
            dt: { value: dt },
            dx: { value: dx },
            eps: { value: 0.01 },
            weight: { value: 0.2 }, // todo: make this adjustable later
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

    compute(velocity, curl, output, weight) {

        this.uniforms.velocity.value = velocity.read.texture;
        this.uniforms.curl.value = curl.read.texture;
        this.uniforms.weight.value = weight;
        
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

        uniform float eps;
        uniform float dt;
        uniform float dx;
        uniform float weight;

        uniform sampler2D velocity;
        uniform sampler2D curl; 

        void main() {
            vec2 u_offset = vec2(1.0 / width, 0.0);
            vec2 v_offset = vec2(0.0, 1.0 / height);

            float xL = abs(texture2D(curl, v_uv - u_offset).x);
            float xR = abs(texture2D(curl, v_uv + u_offset).x);
            float xB = abs(texture2D(curl, v_uv - v_offset).x);
            float xT = abs(texture2D(curl, v_uv + v_offset).x);

            float halfrdx = 0.5 / dx;

            vec2 eta = vec2(xR - xL, xT - xB) * halfrdx;
            vec2 force = vec2(0.0, 0.0);

            if (length(eta) > eps) {
                vec3 psi = vec3(normalize(eta), 0.0);
                vec3 vorticity = vec3(0.0, 0.0, texture2D(curl, v_uv).x);
                vec2 cp = cross(psi, vorticity).xy;
                force = cp * dt;
            }

            vec2 vel = texture2D(velocity, v_uv).xy;
            gl_FragColor = vec4(vel + weight * force, 0.0, 1.0);

        }
    `;

}

export { VorticityConf };