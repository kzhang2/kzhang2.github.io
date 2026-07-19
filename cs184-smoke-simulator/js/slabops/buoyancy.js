import * as THREE from "three";

class Buoyancy {

    constructor(renderer, width, height) {
        
        this.renderer = renderer

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            velocity: { type: "t" },
            temperature: { type: "t"},
            density: { type: "t"},
            ambientTemperature: { value: 0.0 },
            sigma: {value: 0.08 },
            kappa: { value: 0.001 },
            direction: { value: Math.PI / 2.0 },
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

    compute(velocity, temperature, density, output, direction) {

        this.uniforms.velocity.value = velocity.read.texture;
        this.uniforms.temperature.value = temperature.read.texture;
        this.uniforms.density.value = density.read.texture;
        this.uniforms.direction.value = direction;

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

        uniform float sigma;
        uniform float kappa;
        uniform float ambientTemperature;

        uniform float direction;

        uniform sampler2D velocity;
        uniform sampler2D temperature; 
        uniform sampler2D density; 

        void main() {
            float t = texture2D(temperature, v_uv).x;
            vec4 v = texture2D(velocity, v_uv);
            gl_FragColor = v;

            float d = texture2D(density, v_uv).x;

            float amount = sigma * (t - ambientTemperature) - d * kappa;

            gl_FragColor += vec4(amount * cos(direction), amount * sin(direction), 0.0, 1.0);
        }
    `;

}

export { Buoyancy };
