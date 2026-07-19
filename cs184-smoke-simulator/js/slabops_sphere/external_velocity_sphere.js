import * as THREE from "three";

class ExternalVelocitySphere {

    constructor(renderer) {
        
        this.renderer = renderer;

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            velocity: { },
            external_pos: { value: new THREE.Vector3() },
            external_vel: { value: new THREE.Vector3() },
            radius: { value: 0.01 },
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

    compute(velocity, output, pos, vel, radius) {

        // if (length > 0.1) {
        //     vel = new THREE.Vector3(vel.x / length * 0.1, vel.y / length * 0.1, vel.z / length * 0.1);
        // }

        this.uniforms.velocity.value = velocity.read.texture;
        this.uniforms.external_pos.value = pos;
        this.uniforms.external_vel.value = vel;
        this.uniforms.radius.value = radius;
        
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

        uniform samplerCube velocity;
        
        uniform vec3 external_pos;
        uniform vec3 external_vel;
        uniform float radius;

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

        float dist(vec3 x, vec3 y) {
            return acos(dot(x, y));
        }

        void main() {
            vec3 pos = normalize(v_position);

            vec3 original = sampleVelocity(velocity, pos);
            
            vec3 external_pos_n = normalize(external_pos);
            float d = dist(pos, external_pos_n);
            float factor = exp(-d * d / radius);

            vec3 tvel = tangentize(external_vel, pos);
            vec3 added = tvel * factor * 2.0;
            
            vec3 new_vel = tangentize(original + added, pos);

            if (invalidVelocity(new_vel)) {
                new_vel = vec3(0.0, 0.0, 0.0);
            }

            gl_FragColor = vec4(new_vel, 1.0);
        }
    `;

}

export { ExternalVelocitySphere };