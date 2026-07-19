import * as THREE from "three";

class ExternalDensitySphere {

    constructor(renderer) {
        
        this.renderer = renderer;

        this.uniforms = {
            w: { },
            external_pos: { value: new THREE.Vector3() },
            color: { value: new THREE.Vector3() },
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

    compute(input, output, pos, color, radius) {

        this.uniforms.w.value = input.read.texture;
        this.uniforms.external_pos.value = pos;
        this.uniforms.color.value = color;
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

        uniform samplerCube w;
        
        uniform vec3 external_pos;
        uniform vec3 color;
        uniform float radius;

        float dist(vec3 x, vec3 y) {
            return acos(dot(x, y));
        }

        bool invalidVelocity(vec3 vel) {
            return isnan(vel.x) || isnan(vel.y) || isnan(vel.z) || isinf(vel.x) || isinf(vel.y) || isinf(vel.z);
        }

        void main() {
            vec3 pos = normalize(v_position);

            vec3 original = textureCube(w, pos).xyz;
            
            vec3 external_pos_n = normalize(external_pos);
            float d = dist(pos, external_pos_n);
            float factor = exp(-d * d / radius);

            vec3 added = color * factor;
            
            vec3 new_color = original + added;

            if (invalidVelocity(new_color)) {
                new_color = vec3(0.0, 0.0, 0.0);
            }

            // gl_FragColor = vec4(normal, 1.0);
            // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
            gl_FragColor = vec4(new_color, 1.0);
        }
    `;

}

export { ExternalDensitySphere };