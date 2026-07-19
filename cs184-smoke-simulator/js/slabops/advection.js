import * as THREE from "three";

class Advection {

    constructor(renderer, width, height, dt, dx) {
        
        this.renderer = renderer

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            dt: { value: dt },
            dx: { value: dx },
            dissipation: { value: 1.0 },
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

    compute(advected, velocity, output, dissipation) {

        this.uniforms.advected.value = advected.read.texture;
        this.uniforms.velocity.value = velocity.read.texture;
        this.uniforms.dissipation.value = dissipation;

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
        varying vec2 v_uv;

        uniform float width;
        uniform float height;

        uniform float dt;
        uniform float dx;

        uniform float dissipation;

        uniform sampler2D advected; // the output quantity field we are advecting
        uniform sampler2D velocity; 

        vec3 bilerp(sampler2D d, vec2 p) {
            vec4 ij; // i0, j0, i1, j1
            ij.xy = floor(p - 0.5) + 0.5;
            ij.zw = ij.xy + 1.0;

            vec4 uv = ij / vec4(width, height, width, height);
            vec3 d11 = texture2D(d, uv.xy).xyz;
            vec3 d21 = texture2D(d, uv.zy).xyz;
            vec3 d12 = texture2D(d, uv.xw).xyz;
            vec3 d22 = texture2D(d, uv.zw).xyz;

            vec2 a = p - ij.xy;

            return mix(mix(d11, d21, a.x), mix(d12, d22, a.x), a.y);
        }

        void main() {
            float rdx = 1.0 / dx;
            vec2 pos = v_uv * vec2(width, height) - dt * rdx * texture2D(velocity, v_uv).xy;
            gl_FragColor = vec4(dissipation * bilerp(advected, pos), 1.0);
        }
    `

}

// vec2 bilerp(sampler2D d, vec2 p) {
//     vec4 ij; // i0, j0, i1, j1
//     ij.xy = floor(p - 0.5) + 0.5;
//     ij.zw = ij.xy + 1.0;

//     vec4 uv = ij / vec4(width, height, width, height);
//     vec2 d11 = texture2D(d, uv.xy).xy;
//     vec2 d21 = texture2D(d, uv.zy).xy;
//     vec2 d12 = texture2D(d, uv.xw).xy;
//     vec2 d22 = texture2D(d, uv.zw).xy;

//     vec2 a = p - ij.xy;

//     return mix(mix(d11, d21, a.x), mix(d12, d22, a.x), a.y);
// }

// vec2 bilerp(sampler2D w, vec2 p)
// {
//     // add 0.5 for center of pixel
//     float s = p.x - (floor(p.x - 0.5) + 0.5);
//     float t = p.y - (floor(p.y - 0.5) + 0.5);

//     vec2 res = vec2(width, height);

//     vec4 uv;
//     uv.xy = (floor(p - 0.5) + 0.5) / res.xy;
//     uv.zw = (floor(p - 0.5) + 1.5) / res.xy;

//     vec2 u00 = texture2D(w, uv.xy).xy;
//     vec2 u10 = texture2D(w, uv.zy).xy;

//     vec2 u0 = mix(u00, u10, s);

//     vec2 u01 = texture2D(w, uv.xw).xy;
//     vec2 u11 = texture2D(w, uv.zw).xy;

//     vec2 u1 =  mix(u01, u11, s);

//     return mix(u0, u1, t);
// }

// vec2 bilerp(sampler2D field, vec2 uv) {
//     float x = uv.x * width;
//     float y = uv.y * height;

//     float tx1 = round(x);
//     float ty1 = round(y);
//     float tx0 = tx1 - 1.0;
//     float ty0 = ty1 - 1.0;

//     float vx0 = tx0 + 0.5;
//     float vy0 = ty0 + 0.5;

//     tx1 = clamp(tx1 / width, 0.0, 1.0);
//     ty1 = clamp(ty1 / height, 0.0, 1.0);
//     tx0 = clamp(tx0 / width, 0.0, 1.0);
//     ty0 = clamp(ty0 / height, 0.0, 1.0);

//     vec2 u00 = texture2D(field, vec2(tx0, ty0));
//     vec2 u01 = texture2D(field, vec2(tx0, ty1));
//     vec2 u10 = texture2D(field, vec2(tx1, ty0));
//     vec2 u11 = texture2D(field, vec2(tx1, ty1));
    
//     float s = x - vx0;
//     vec2 u0 = (1.0f - s) * u00 + s * u10;
//     vec2 u1 = (1.0f - s) * u01 + s * u11;

//     float t = y - vy0;
//     vec2 f = (1.0f - t) * u0 + t * u1;

//     return f;
// }

export { Advection };