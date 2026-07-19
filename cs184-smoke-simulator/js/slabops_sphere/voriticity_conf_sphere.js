import * as THREE from "three";

class VorticityConfSphere {

    constructor(renderer, dt, dx) {
        
        this.renderer = renderer

        this.uniforms = {
            velocity: { },
            curl: { },
            dt: { value: dt },
            dx: { value: dx },
            eps: { value: 0.05 },
            weight: { value: 1.5 },
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

    compute(velocity, curl, output, weight) {

        this.uniforms.velocity.value = velocity.read.texture;
        this.uniforms.curl.value = curl.read.texture;
        this.uniforms.weight.value = weight;
        
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

        uniform float eps;
        uniform float dt;
        uniform float dx;
        uniform float weight;

        uniform samplerCube velocity;
        uniform samplerCube curl;

        vec3 tangentize(vec3 v, vec3 p) {
            return v - dot(v, p) * p;
        }

        vec3 project(vec3 v, vec3 p) {
            return dot(v, p) * p;
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

        vec3 sampleCurl(samplerCube tex, vec3 pos) {
            pos = normalize(pos);
            vec3 c = project(textureCube(tex, pos).xyz, pos);
            if (invalidVelocity(c)) {
                return vec3(0.0, 0.0, 0.0);
            } else {
                return c;
            }
        }

        void main() {
            vec3 pos = normalize(v_position);

            vec3 x_offset = vec3(dx, 0.0, 0.0);
            vec3 y_offset = vec3(0.0, dx, 0.0);
            vec3 z_offset = vec3(0.0, 0.0, dx);

            float cx0 = length(sampleCurl(curl, pos - x_offset));
            float cx1 = length(sampleCurl(curl, pos + x_offset));
            float cy0 = length(sampleCurl(curl, pos - y_offset));
            float cy1 = length(sampleCurl(curl, pos + y_offset));
            float cz0 = length(sampleCurl(curl, pos - z_offset));
            float cz1 = length(sampleCurl(curl, pos + z_offset));
            
            float halfrdx = 0.5 / dx;

            vec3 eta = tangentize(vec3(cx1 - cx0, cy1 - cy0, cz1 - cz0) * halfrdx, pos);

            vec3 force = vec3(0.0, 0.0, 0.0);

            if (length(eta) > eps) {
                vec3 psi = normalize(eta);
                vec3 vorticity = sampleCurl(curl, pos);
                vec3 cp = cross(psi, vorticity);
                force = cp * dx;
            }

            vec3 vel = sampleVelocity(velocity, pos);
            vec3 new_vel = tangentize(vel + weight * force * dt, pos);

            gl_FragColor = vec4(new_vel, 1.0);

        }

        // void main() {
        //     vec3 pos = normalize(v_position);

        //     vec3 x_offset = vec3(dx, 0.0, 0.0);
        //     vec3 y_offset = vec3(0.0, dx, 0.0);
        //     vec3 z_offset = vec3(0.0, 0.0, dx);

        //     float cx0 = abs(sampleVelocity(curl, pos - x_offset).x);
        //     float cx1 = abs(sampleVelocity(curl, pos + x_offset).x);
        //     float cy0 = abs(sampleVelocity(curl, pos - y_offset).y);
        //     float cy1 = abs(sampleVelocity(curl, pos + y_offset).y);
        //     float cz0 = abs(sampleVelocity(curl, pos - z_offset).z);
        //     float cz1 = abs(sampleVelocity(curl, pos + z_offset).z);
            
        //     float halfrdx = 0.5 / dx;

        //     vec3 eta = vec3(cx1 - cx0, cy1 - cy0, cz1 - cz0) * halfrdx;

        //     vec3 force = vec3(0.0, 0.0, 0.0);

        //     if (abs(eta.x) > eps && abs(eta.y) > eps && abs(eta.z) > eps) {
        //         vec3 psi = vec3(eta.x / abs(eta.x), eta.y / abs(eta.y), eta.z / abs(eta.z));
        //         vec3 vorticity = sampleVelocity(curl, pos);
        //         vec3 cp = cross(psi, vorticity);
        //         force = cp * dx;
        //     }

        //     vec3 vel = sampleVelocity(velocity, pos);
        //     vec3 new_vel = tangentize(vel + weight * force, pos);

        //     gl_FragColor = vec4(new_vel, 1.0);

        // }
    `;

}

export { VorticityConfSphere };