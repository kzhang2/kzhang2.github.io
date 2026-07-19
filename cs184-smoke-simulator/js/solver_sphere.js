import * as THREE from "three";
import { SlabSphere } from "./slab_sphere.js";
import { AdvectionSphere } from "./slabops_sphere/advection_sphere.js";
import { AdvectionVelocitySphere } from "./slabops_sphere/advection_velocity_sphere.js";
import { DivergenceSphere } from "./slabops_sphere/divergence_sphere.js";
import { ExternalDensitySphere } from "./slabops_sphere/external_density_sphere.js";
import { ExternalVelocitySphere } from "./slabops_sphere/external_velocity_sphere.js";
import { GradientSubtractionSphere } from "./slabops_sphere/gradient_subtraction_sphere.js";
import { JacobiSphere } from "./slabops_sphere/jacobi_sphere.js";
import { CurlSphere } from "./slabops_sphere/curl_sphere.js";
import { VorticityConfSphere } from "./slabops_sphere/voriticity_conf_sphere.js";

class SolverSphere {
    
    constructor(renderer, size) {
        
        this.renderer = renderer;

        this.size = size;

        this.dt = 1.0 / 10.0;
        this.dx = 1.0 / (size * 0.5);
        this.dissipation = 0.99;
        // this.dissipation = 1.0;
        
        this.pressure = new SlabSphere(renderer, size);
        this.velocity = new SlabSphere(renderer, size);
        this.velocityDivergence = new SlabSphere(renderer, size);
        this.density = new SlabSphere(renderer, size);
        this.vorticity = new SlabSphere(renderer, size);

        this.advection = new AdvectionSphere(renderer, this.dt);
        this.advectionVelocity = new AdvectionVelocitySphere(renderer, this.dt);
        this.jacobi = new JacobiSphere(renderer, this.dx, 30);
        this.divergence = new DivergenceSphere(renderer, this.dx);
        this.gradientSubtraction = new GradientSubtractionSphere(renderer, this.dx);
        this.curl = new CurlSphere(renderer, this.dx);
        this.vorticityConf = new VorticityConfSphere(renderer, this.dt, this.dx);

        this.vorticityWeight = 0.2;

        this.externalDensity = new ExternalDensitySphere(renderer);
        this.externalVelocity = new ExternalVelocitySphere(renderer);

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
        this.curl.compute(this.velocity, this.vorticity);
        this.vorticityConf.compute(this.velocity, this.vorticity, this.velocity, this.vorticityWeight * 7.5);

        // projection
        this.divergence.compute(this.velocity, this.velocityDivergence);
        this.pressure.clear();
        this.jacobi.compute(this.pressure, this.velocityDivergence, this.pressure, -this.dx * this.dx, 6.0);
        this.gradientSubtraction.compute(this.velocity, this.pressure, this.velocity);

    }

    addExternalDensity(pos, color, radius) {

        this.externalDensityPos = pos;
        this.externalDensityColor = color;
        this.externalDensityRadius = radius * 0.02;

        this.shouldAddExternalDensity = true;

    }

    removeExternalDensity() {

        this.shouldAddExternalDensity = false;
    
    }

    addExternalVelocity(pos, vel, radius) {

        this.externalVelocityPos = pos;
        this.externalVelocityRadius = radius * 0.02;
        this.externalVelocityVelocity = vel;
        
        this.shouldAddExternalVelocity = true;

    }

    removeExternalVelocity() {

        this.shouldAddExternalVelocity = false;
    
    }

    addExternalTemperature(pos, temp, radius) {

        // this.externalTemperaturePos = pos;
        // this.externalTemperatureTemp = temp;
        // this.externalTemperatureRadius = radius;

        // this.shouldAddExternalTemperature = true;

    }

    removeExternalTemperature() {

        // this.shouldAddExternalTemperature = false;
    
    }

    getTexture() {

        return this.density.read.texture;
        // return this.velocityDivergence.read.texture;
        // return this.velocity.read.texture;

    }

}

export { SolverSphere };
