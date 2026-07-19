import * as THREE from "three";
import { Slab } from "./slab.js";
import { Advection } from "./slabops_parametric/advection_parametric.js"
import { AdvectionVelocity } from "./slabops_parametric/advection_velocity_parametric.js";
import { Curl } from "./slabops_parametric/curl_parametric.js"
import { Divergence } from "./slabops_parametric/divergence_parametric.js";
import { ExternalDensity } from "./slabops_parametric/external_density_parametric.js";
import { ExternalVelocity } from "./slabops_parametric/external_velocity_parametric.js";
import { GradientSubtraction } from "./slabops_parametric/gradient_subtraction_parametric.js";
import { Jacobi } from "./slabops_parametric/jacobi_parametric.js";
import { VorticityConf } from "./slabops_parametric/voriticity_conf_parametric.js"

class SolverParametric {
    
    constructor(renderer, width, height) {
        
        this.renderer = renderer;

        this.width = 12 * 50;
        this.height = 5 * 50;

        width = this.width;
        height = this.height;

        this.dt = 1.0 / 10.0;
        this.dx = 1.0 / 50.0;
        this.dissipation = 0.99;

        this.r = 5.0;
        this.R = 12.0;
        
        this.pressure = new Slab(renderer, width, height, true);
        this.velocity = new Slab(renderer, width, height, true);
        this.velocityDivergence = new Slab(renderer, width, height, true);
        this.vorticity = new Slab(renderer, width, height, true);
        this.density = new Slab(renderer, width, height, true);

        this.advection = new Advection(renderer, width, height, this.r, this.R, this.dt);
        this.advectionVelocity = new AdvectionVelocity(renderer, width, height, this.r, this.R, this.dt);
        this.jacobi = new Jacobi(renderer, width, height, this.r, this.R, this.dx, 30);
        // this.curl = new Curl(renderer, width, height, this.dx);
        // this.vorticityConf = new VorticityConf(renderer, width, height, this.dt, this.dx);
        this.divergence = new Divergence(renderer, width, height, this.r, this.R, this.dx);
        this.gradientSubtraction = new GradientSubtraction(renderer, width, height, this.r, this.R, this.dx);

        this.externalDensity = new ExternalDensity(renderer, width, height, this.R, this.R);
        this.externalVelocity = new ExternalVelocity(renderer, width, height, this.r, this.R);

        this.vorticityWeight = 0.2;

        this.shouldAddExternalDensity = false;
        this.externalDensityPos = null;
        this.externalDensityRadius = 0.01;
        this.externalDensityColor = null;

        this.shouldAddExternalVelocity = false;
        this.externalVelocityPos = null;
        this.externalVelocityRadius = 0.01;
        this.externalVelocityVelocity = null;

    }

    step(time) {

        // advection of velocity field
        this.advectionVelocity.compute(this.velocity, this.velocity, this.velocity);

        // advection of carried smoke
        this.advection.compute(this.density, this.velocity, this.density, this.dissipation);
        
        // external forces
        if (this.shouldAddExternalDensity) {
            this.externalDensity.compute(
                this.density, this.density, 
                this.externalDensityPos, this.externalDensityColor, this.externalDensityRadius);
        }
        if (this.shouldAddExternalVelocity) {
            this.externalVelocity.compute(
                this.velocity, this.velocity, 
                this.externalVelocityPos, this.externalVelocityVelocity, this.externalVelocityRadius);
        }

        // vorticity confinement for smoke
        // this.curl.compute(this.velocity, this.vorticity);
        // this.vorticityConf.compute(this.velocity, this.vorticity, this.velocity, this.vorticityWeight);
        
        // projection
        this.divergence.compute(this.velocity, this.velocityDivergence);
        this.pressure.clear();
        this.jacobi.compute(this.pressure, this.velocityDivergence, this.pressure, -this.dx * this.dx, 6.0);
        this.gradientSubtraction.compute(this.velocity, this.pressure, this.velocity);


    }

    addExternalDensity(pos, color, radius) {

        this.externalDensityPos = pos;
        this.externalDensityColor = color;
        this.externalDensityRadius = radius * 8.0;

        this.shouldAddExternalDensity = true;

    }

    removeExternalDensity() {

        this.shouldAddExternalDensity = false;
    
    }

    addExternalVelocity(pos, vel, radius) {

        this.externalVelocityPos = pos;
        this.externalVelocityVelocity = vel;
        this.externalVelocityRadius = radius * 8.0;
        
        this.shouldAddExternalVelocity = true;

    }

    removeExternalVelocity() {

        this.shouldAddExternalVelocity = false;
    
    }

    addExternalTemperature(pos, temp, radius) {


    }

    removeExternalTemperature() {

    
    }

    getTexture() {

        return this.density.read.texture;
        // return this.velocityDivergence.read.texture;
        // return this.velocity.read.texture;
        // return this.temperature.read.texture;

    }

}

export { SolverParametric };
