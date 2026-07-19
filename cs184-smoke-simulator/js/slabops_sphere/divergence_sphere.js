import * as THREE from "three";

class DivergenceSphere {

    constructor(renderer, dx) {
        
        this.renderer = renderer

        this.uniforms = {
            dx: { value: dx },
            velocity: { },
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

    compute(velocity, output) {
        
        this.uniforms.velocity.value = velocity.read.texture;

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

        uniform samplerCube velocity;

        vec3 tangentize(vec3 v, vec3 p) {
            return v - dot(v, p) * p;
        }

        bool invalidVelocity(vec3 vel) {
            return isnan(vel.x) || isnan(vel.y) || isnan(vel.z) || isinf(vel.x) || isinf(vel.y) || isinf(vel.z);
        }

        vec3 sampleVelocity(samplerCube tex, vec3 pos) {
            pos = normalize(pos);
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

            float vx0 = sampleVelocity(velocity, pos - x_offset).x;
            float vx1 = sampleVelocity(velocity, pos + x_offset).x;
            float vy0 = sampleVelocity(velocity, pos - y_offset).y;
            float vy1 = sampleVelocity(velocity, pos + y_offset).y;
            float vz0 = sampleVelocity(velocity, pos - z_offset).z;
            float vz1 = sampleVelocity(velocity, pos + z_offset).z;

            float halfrdx = 0.5 / dx;

            gl_FragColor = vec4(halfrdx * ((vx1 - vx0) + (vy1 - vy0) + (vz1 - vz0)), 0.0, 0.0, 1.0);
        }
    `;

}

export { DivergenceSphere };