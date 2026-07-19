import * as THREE from "three";

class AdvectionVelocity {

    constructor(renderer, width, height, r, R, dt) {
        
        this.renderer = renderer

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            r: { value: r },
            R: { value: R },
            dt: { value: dt },
            advected: { type: "t" },
            velocity: { type: "t" },
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

    compute(advected, velocity, output) {

        this.uniforms.advected.value = advected.read.texture;
        this.uniforms.velocity.value = velocity.read.texture;

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
    `

    fragmentShader = `
        #define PI 3.1415926538

        varying vec2 v_uv;

        uniform float width;
        uniform float height;

        uniform float r;
        uniform float R;

        uniform float dt;

        uniform float dissipation;

        uniform sampler2D advected; // the output quantity field we are advecting
        uniform sampler2D velocity; 

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

        vec3 rotate_velocity(vec3 v_, vec3 n_, vec3 n) { // rotate velocity v_ at n_ to be tangent to n
            float cos_theta = dot(n_, n);
            if (cos_theta <= -0.99999999) {
                return -v_;
            }
            vec3 axis = cross(n_, n);
            return v_ * cos_theta - n_ * dot(v_, n) + (axis * dot(axis, v_) / (1.0 + cos_theta));
        }

        void main() {
            vec3 pos = uv2xyz(v_uv);
            vec3 n = normal(v_uv);

            vec3 v = sampleVelocity(velocity, v_uv);
            vec2 uv_prime = xyz2uv(pos - v * dt);
            
            vec3 vel_prime = sampleVelocity(advected, uv_prime);
            vec3 new_vel = rotate_velocity(vel_prime, normal(uv_prime), n);

            if (invalidVelocity(new_vel)) {
                new_vel = vec3(0.0, 0.0, 0.0);
            }

            gl_FragColor = vec4(new_vel, 1.0);
        }
    `

}

export { AdvectionVelocity };