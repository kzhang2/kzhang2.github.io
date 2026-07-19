import * as THREE from "three";

class ExternalTemperature {

    constructor(renderer, width, height, wrap) {
        
        this.renderer = renderer;

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            width: { value: width },
            height: { value: height },
            w: { type: "t" },
            pos: { value: new THREE.Vector2() },
            temp: { type: "f" },
            radius: { value: 0.01 },
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: wrap ? this.fragmentShaderWrap : this.fragmentShader
        });

        this.plane = new THREE.PlaneGeometry(2, 2);
        this.quad = new THREE.Mesh(this.plane, this.material);

        this.scene = new THREE.Scene();
        
        this.scene.add(this.quad);
    
    }

    compute(input, output, pos, temp, radius) {

        this.uniforms.w.value = input.read.texture;
        this.uniforms.pos.value = pos;
        this.uniforms.temp.value = temp;
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
        varying vec2 v_uv;

        uniform float width;
        uniform float height;
        
        uniform sampler2D w;
        
        uniform vec2 pos;
        uniform float temp;
        uniform float radius;

        float gauss(vec2 p, float r) {
            return exp(-dot(p, p) / r);
        }

        void main() {
            float original = texture2D(w, v_uv).x;
            
            float r = radius * width;
            vec2 p = (v_uv - pos) * vec2(width, height);
            
            float factor = gauss(p, r);

            float added = temp * factor;

            gl_FragColor = vec4(original + added, 0.0, 0.0, 1.0);
        }
    `;

    fragmentShaderWrap = `
        varying vec2 v_uv;

        uniform float width;
        uniform float height;
        
        uniform sampler2D w;
        
        uniform vec2 pos;
        uniform float temp;
        uniform float radius;

        float gauss(vec2 p, float r) {
            return exp(-dot(p, p) / r);
        }

        void main() {
            float original = texture2D(w, v_uv).x;
            
            float r = radius * width;
            
            vec2 ad = abs(v_uv - pos);
            vec2 wd = 0.5 - abs(ad - 0.5);

            vec2 p = wd * vec2(width, height);

            float factor = gauss(p, r);

            float added = temp * factor;

            gl_FragColor = vec4(original + added, 0.0, 0.0, 1.0);
        }
    `;

}

export { ExternalTemperature };