import * as THREE from "three";

class Jacobi {

    constructor(renderer, width, height, r, R, dx, iterations) {
        
        this.renderer = renderer
        this.iterations = iterations

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            r: { value: r },
            R: { value: R },
            dx: { value: dx},
            x: { type: "t" },
            b: { type: "t" },
            alpha: { value: -1.0 },
            beta: { value: 4.0 },
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

    compute(x, b, output, alpha, beta) {

        for (let i = 0; i < this.iterations; i++) {

            this.uniforms.alpha.value = alpha;
            this.uniforms.beta.value = beta;
            this.uniforms.x.value = x.read.texture;
            this.uniforms.b.value = b.read.texture;
    
            this.renderer.setRenderTarget(output.write);
            this.renderer.render(this.scene, this.camera);
            output.swap()
        }

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

        uniform float dx;

        uniform float alpha;
        uniform float beta;

        uniform sampler2D x;
        uniform sampler2D b; 

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

        void main() {
            vec3 pos = uv2xyz(v_uv);
            vec3 n = normal(v_uv);

            vec3 x_offset = vec3(dx, 0.0, 0.0);
            vec3 y_offset = vec3(0.0, dx, 0.0);
            vec3 z_offset = vec3(0.0, 0.0, dx);

            float xx0 = texture2D(x, xyz2uv(tangentize(pos - x_offset, n))).x;
            float xx1 = texture2D(x, xyz2uv(tangentize(pos + x_offset, n))).x;
            float xy0 = texture2D(x, xyz2uv(tangentize(pos - y_offset, n))).x;
            float xy1 = texture2D(x, xyz2uv(tangentize(pos + y_offset, n))).x;
            float xz0 = texture2D(x, xyz2uv(tangentize(pos - z_offset, n))).x;
            float xz1 = texture2D(x, xyz2uv(tangentize(pos + z_offset, n))).x;

            float bC = texture2D(b, v_uv).x;

            gl_FragColor = vec4((xx0 + xx1 + xy0 + xy1 + xz0 + xz1 + alpha * bC) / beta, 0.0, 0.0, 1.0);
        }
    `;

}

export { Jacobi };