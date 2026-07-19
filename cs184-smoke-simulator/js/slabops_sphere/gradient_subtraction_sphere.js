import * as THREE from "three";

class GradientSubtractionSphere {

    constructor(renderer, dx) {
        
        this.renderer = renderer

        this.uniforms = {
            dx: { value: dx },
            velocity: { },
            pressure: { },
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

    compute(velocity, pressure, output) {
        
        this.uniforms.velocity.value = velocity.read.texture;
        this.uniforms.pressure.value = pressure.read.texture;

        output.write_camera.update(this.renderer, this.scene);
        output.swap();

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

        uniform samplerCube pressure;
        uniform samplerCube velocity;

        vec3 tangentize(vec3 v, vec3 p) {
            return v - dot(v, p) * p;
        }

        bool invalidVelocity(vec3 vel) {
            return isnan(vel.x) || isnan(vel.y) || isnan(vel.z) || isinf(vel.x) || isinf(vel.y) || isinf(vel.z);
        }

        vec3 sampleVelocity(samplerCube tex, vec3 pos) {
            vec3 vel = tangentize(textureCube(tex, pos).xyz, pos);
            if (invalidVelocity(vel)) {
                return vec3(0.0, 0.0, 0.0);
            } else {
                return vel;
            }
        }

        void main() {
            vec3 pos = normalize(v_position);

            vec3 x_offset = vec3(dx, 0.0, 0.0);
            vec3 y_offset = vec3(0.0, dx, 0.0);
            vec3 z_offset = vec3(0.0, 0.0, dx);

            float px0 = textureCube(pressure, pos - x_offset).x;
            float px1 = textureCube(pressure, pos + x_offset).x;
            float py0 = textureCube(pressure, pos - y_offset).x;
            float py1 = textureCube(pressure, pos + y_offset).x;
            float pz0 = textureCube(pressure, pos - z_offset).x;
            float pz1 = textureCube(pressure, pos + z_offset).x;

            float halfrdx = 0.5 / dx;
            vec3 gradient = halfrdx * vec3(px1 - px0, py1 - py0, pz1 - pz0);

            vec3 surface_grad = tangentize(gradient, pos);

            vec3 subtracted = sampleVelocity(velocity, pos) - surface_grad;

            if (invalidVelocity(subtracted)) {
                subtracted = vec3(0.0, 0.0, 0.0);
            }

            gl_FragColor = vec4(subtracted, 1.0);
        }
    `;

}

export { GradientSubtractionSphere };