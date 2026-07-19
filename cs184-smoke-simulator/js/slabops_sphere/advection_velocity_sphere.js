import * as THREE from "three";

class AdvectionVelocitySphere {

    constructor(renderer, dt) {
        
        this.renderer = renderer

        this.uniforms = {
            dt: { value: dt },
            advected: { },
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

    compute(advected, velocity, output) {

        this.uniforms.advected.value = advected.read.texture;
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
    `

    fragmentShader = `
        varying vec3 v_position;

        uniform float dt;

        uniform samplerCube advected; // the output quantity field we are advecting
        uniform samplerCube velocity; 

        vec3 move(vec3 p, vec3 v) { // moves point p on unit circle along v by ||v||
            float theta = length(v);
            if (theta <= 1e-6) {
                return p;
            }
            return normalize(p * cos(theta) + v * (sin(theta) / theta));
            // return normalize(p + v);
        }

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

        vec3 rotate_velocity(vec3 v_, vec3 p_, vec3 p) { // rotate velocity v_ at p_ to be tangent to p
            float cos_theta = dot(p_, p);
            if (cos_theta <= -0.99999999) {
                return -v_;
            }
            vec3 axis = cross(p_, p);
            return v_ * cos_theta - p_ * dot(v_, p) + (axis * dot(axis, v_) / (1.0 + cos_theta));
        }

        void main() {
            vec3 pos = normalize(v_position);

            vec3 delta_pos = dt * sampleVelocity(velocity, pos);
            vec3 pos_prime = move(pos, -delta_pos);

            vec3 vel_prime = sampleVelocity(advected, pos_prime);
            vec3 new_vel = rotate_velocity(vel_prime, pos_prime, pos);

            if (invalidVelocity(new_vel)) {
                new_vel = vec3(0.0, 0.0, 0.0);
            }

            gl_FragColor = vec4(new_vel, 1.0);
        }
    `

}

export { AdvectionVelocitySphere };