import * as THREE from "three";
import { Slab } from "./slab.js";
import { Advection } from "./slabops/advection.js"
import { Buoyancy } from "./slabops/buoyancy.js"
import { Curl } from "./slabops/curl.js"
import { Divergence } from "./slabops/divergence.js";
import { ExternalDensity } from "./slabops/external_density.js";
import { ExternalTemperature } from "./slabops/external_temperature.js";
import { ExternalVelocity } from "./slabops/external_velocity.js";
import { GradientSubtraction } from "./slabops/gradient_subtraction.js";
import { Jacobi } from "./slabops/jacobi.js";
import { VorticityConf } from "./slabops/voriticity_conf.js"

class Solver {
    
    constructor(renderer, width, height, wrap, buoyancy, buoyancyDirection) {
        
        this.renderer = renderer;

        this.width = width;
        this.height = height;
        this.wrap = wrap;

        this.dt = 1.0;
        this.dx = 1.0;
        this.dissipation = 0.99;
        
        this.pressure = new Slab(renderer, width, height, wrap);
        this.velocity = new Slab(renderer, width, height, wrap);
        this.velocityDivergence = new Slab(renderer, width, height, wrap);
        this.vorticity = new Slab(renderer, width, height, wrap);
        this.density = new Slab(renderer, width, height, wrap);
        this.temperature = new Slab(renderer, width, height, wrap);

        this.advection = new Advection(renderer, width, height, this.dt, this.dx);
        this.buoyancy = new Buoyancy(renderer, width, height, wrap);
        this.jacobi = new Jacobi(renderer, width, height, 20);
        this.curl = new Curl(renderer, width, height, this.dx);
        this.vorticityConf = new VorticityConf(renderer, width, height, this.dt, this.dx);
        this.divergence = new Divergence(renderer, width, height, this.dx);
        this.gradientSubtraction = new GradientSubtraction(renderer, width, height, this.dx);

        this.externalDensity = new ExternalDensity(renderer, width, height, wrap);
        this.externalVelocity = new ExternalVelocity(renderer, width, height, wrap);
        this.externalTemperature = new ExternalTemperature(renderer, width, height, wrap);

        this.shouldAddBuoyancy = buoyancy;
        this.buoyancyDirection = buoyancyDirection;

        this.vorticityWeight = 0.2;

        this.shouldAddExternalDensity = false;
        this.externalDensityPos = null;
        this.externalDensityRadius = 0.01;
        this.externalDensityColor = null;

        this.shouldAddExternalVelocity = false;
        this.externalVelocityPos = null;
        this.externalVelocityRadius = 0.01;
        this.externalVelocityVelocity = null;

        this.shouldAddExternalTemperature = false;
        this.externalTemperaturePos = null;
        this.externalTemperatureRadius = 0.01;
        this.externalTemperatureTemp = null;

    }

    step(time) {

        // advection of velocity field
        this.advection.compute(this.velocity, this.velocity, this.velocity, 1.0);

        // advection of carried smoke
        this.advection.compute(this.density, this.velocity, this.density, this.dissipation);
        
        this.advection.compute(this.temperature, this.velocity, this.temperature, this.dissipation);

        if (this.shouldAddBuoyancy) {
            this.buoyancy.compute(this.velocity, this.temperature, this.density, this.velocity, this.buoyancyDirection * Math.PI / 180.0);
        }

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

        if (this.shouldAddExternalTemperature) {
            this.externalTemperature.compute(
                this.temperature, this.temperature, 
                this.externalTemperaturePos, this.externalTemperatureTemp, this.externalTemperatureRadius);
        }

        // vorticity confinement for smoke
        this.curl.compute(this.velocity, this.vorticity);
        this.vorticityConf.compute(this.velocity, this.vorticity, this.velocity, this.vorticityWeight);
        
        // projection
        this.divergence.compute(this.velocity, this.velocityDivergence);
        this.pressure.clear();
        this.jacobi.compute(this.pressure, this.velocityDivergence, this.pressure, -this.dx * this.dx, 4.0);
        this.gradientSubtraction.compute(this.velocity, this.pressure, this.velocity);


    }

    addExternalDensity(pos, color, radius) {

        this.externalDensityPos = pos;
        this.externalDensityColor = color;
        this.externalDensityRadius = radius;

        this.shouldAddExternalDensity = true;

    }

    removeExternalDensity() {

        this.shouldAddExternalDensity = false;
    
    }

    addExternalVelocity(pos, vel, radius) {

        this.externalVelocityPos = pos;
        this.externalVelocityRadius = radius;
        this.externalVelocityVelocity = vel;
        
        this.shouldAddExternalVelocity = true;

    }

    removeExternalVelocity() {

        this.shouldAddExternalVelocity = false;
    
    }

    addExternalTemperature(pos, temp, radius) {

        this.externalTemperaturePos = pos;
        this.externalTemperatureTemp = temp;
        this.externalTemperatureRadius = radius;

        this.shouldAddExternalTemperature = true;

    }

    removeExternalTemperature() {

        this.shouldAddExternalTemperature = false;
    
    }

    getTexture() {

        return this.density.read.texture;
        // return this.velocityDivergence.read.texture;
        // return this.velocity.read.texture;
        // return this.temperature.read.texture;

    }

}

export { Solver };
