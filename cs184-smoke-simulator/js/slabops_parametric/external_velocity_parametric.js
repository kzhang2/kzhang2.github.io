import * as THREE from "three";

class ExternalVelocity {

    constructor(renderer, width, height, r, R) {
        
        this.renderer = renderer;

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            r: { value: r },
            R: { value: R },
            velocity: { type: "t" },
            external_uv: { value: new THREE.Vector2() },
            vel_uv: { value: new THREE.Vector2() },
            radius: { value: 0.01 },
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

    compute(velocity, output, pos, vel, radius) {

        this.uniforms.velocity.value = velocity.read.texture;
        this.uniforms.external_uv.value = pos;
        this.uniforms.vel_uv.value = vel;
        this.uniforms.radius.value = radius;

        this.renderer.setRenderTarget(output.write);
        this.renderer.render(this.scene, this.camera);
        output.swap();

    }

    vertexShader = `
        varying vec2 v_uv;
        void main() {
            v_uv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    fragmentShader = `
        #define PI 3.1415926538

        varying vec2 v_uv;

        uniform float width;
        uniform float height;

        uniform float r;
        uniform float R;
        
        uniform sampler2D velocity;
        
        uniform vec2 external_uv;
        uniform vec2 vel_uv;
        uniform float radius;

        vec3 uv2xyz(vec2 uv) {
            float u = uv.x * 2.0 * PI;
            float v = uv.y * 2.0 * PI;
            return vec3(r * sin(v), (R + r * cos(v)) * cos(u), (R + r * cos(v)) * sin(u));
        }

        vec2 xyz2uv(vec3 xyz) {
            float u = atan(xyz.z, xyz.y) / (2.0 * PI);
            float v = atan(xyz.x, xyz.y / cos(2.0 * PI * u) - R) / (2.0 * PI);
            return vec2(u, v);
        }

        vec3 normal(vec2 uv) {
            float u = 2.0 * PI * uv.x;
            float v = 2.0 * PI * uv.y;
            float dxdu = 0.0;
            float dydu = -2.0 * PI * (R + r * cos(v)) * sin(u);
            float dzdu = 2.0 * PI * (R + r * cos(v)) * cos(u);
            float dxdv = 2.0 * PI * r * cos(v);
            float dydv = -2.0 * PI * r * sin(v) * cos(u);
            float dzdv = -2.0 * PI * r * sin(u) * sin(v);
            vec3 ru = vec3(dxdu, dydu, dzdu);
            vec3 rv = vec3(dxdv, dydv, dzdv);
            vec3 n = cross(ru, rv);
            return normalize(n);
        }

        vec3 tangentize(vec3 v, vec3 n) {
            return v - dot(v, n) * n;
        }

        bool invalidVelocity(vec3 vel) {
            return isnan(vel.x) || isnan(vel.y) || isnan(vel.z) || isinf(vel.x) || isinf(vel.y) || isinf(vel.z);
        }

        vec3 sampleVelocity(sampler2D tex, vec2 uv) {
            vec3 vel = tangentize(texture2D(tex, uv).xyz, normal(uv));
            if (invalidVelocity(vel)) {
                return vec3(0.0, 0.0, 0.0);
            } else {
                return vel;
            }
        }

        void main() {
            vec3 pos = uv2xyz(v_uv);
            vec3 n = normal(v_uv);

            vec3 original = sampleVelocity(velocity, v_uv);
            
            vec3 external_pos = uv2xyz(external_uv);
            float d = distance(pos, external_pos);
            float factor = exp(-d * d / radius);

            vec3 tvel = tangentize(uv2xyz(v_uv + vel_uv * 0.1) - pos, n);
            vec3 added = tvel * factor * 3.0;
            
            vec3 new_vel = tangentize(original + added, n);

            if (invalidVelocity(new_vel)) {
                new_vel = vec3(0.0, 0.0, 0.0);
            }

            gl_FragColor = vec4(new_vel, 1.0);
        }
    `;

}

export { ExternalVelocity };