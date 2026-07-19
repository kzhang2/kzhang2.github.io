import * as THREE from "three";

class CurlSphere {

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

        void main() {
            vec3 pos = normalize(v_position);

            vec3 x_offset = vec3(dx, 0.0, 0.0);
            vec3 y_offset = vec3(0.0, dx, 0.0);
            vec3 z_offset = vec3(0.0, 0.0, dx);

            vec3 vx0 = sampleVelocity(velocity, pos - x_offset);
            vec3 vx1 = sampleVelocity(velocity, pos + x_offset);
            vec3 vy0 = sampleVelocity(velocity, pos - y_offset);
            vec3 vy1 = sampleVelocity(velocity, pos + y_offset);
            vec3 vz0 = sampleVelocity(velocity, pos - z_offset);
            vec3 vz1 = sampleVelocity(velocity, pos + z_offset);
            
            float halfrdx = 0.5 / dx;
            
            float dzdy = (vy1.z - vy0.z) * halfrdx;
            float dydz = (vz1.y - vz0.y) * halfrdx;
            float dxdz = (vz1.x - vz0.x) * halfrdx;
            float dzdx = (vx1.z - vx0.z) * halfrdx;
            float dydx = (vx1.y - vx0.y) * halfrdx;
            float dxdy = (vy1.x - vy0.x) * halfrdx;

            vec3 curl = vec3(dzdy - dydz, dxdz - dzdx, dydx - dxdy);
            vec3 surface_curl = project(curl, pos);

            gl_FragColor = vec4(surface_curl, 1.0);
        }
    `;

}

export { CurlSphere };