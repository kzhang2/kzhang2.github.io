# Code Summary

## Overview

This project is a browser-based cellular automata / artificial life simulation built with ES modules and p5.js. A user assembles a repeating action sequence ("strategy" or genome), starts the simulation, and watches that strategy compete against several randomly generated organisms on a food-producing grid.

The simulation is not classic Conway's Game of Life. Each occupied grid cell contains an organism cell with state such as direction, satiety, lifespan, and a looping action program.

## File Roles

### `index.html`

- Loads p5 from a CDN.
- Loads `index.mjs` as the application entry point.
- Defines three key containers:
  - `#space`
  - `#strategy-select`
  - `#sketch-holder`

### `index.mjs`

- Builds the pre-game UI for creating a custom strategy.
- Hides or reveals UI sections as the user moves between setup and simulation.
- Maintains the current user-authored strategy as an array of move indices.
- Starts the p5 sketch by dynamically importing `sketch.mjs` and passing the chosen strategy into `sketch_creator(...)`.

Available actions are encoded as:

- `0`: advance
- `1`: rotate left
- `2`: rotate right
- `3`: clone
- `4`: eat

### `sketch.mjs`

- Owns the p5 sketch lifecycle (`setup`, `draw`, `mousePressed`).
- Creates the `Grid` instance that contains the full simulation state.
- Seeds the simulation with:
  - the player's strategy
  - one hardcoded test strategy (`[0,3,2,4,3,0,1,0]`)
  - five random strategies of length 8
- Renders:
  - the background food level per tile as a filled rectangle
  - organism trails/colors as ellipses
  - occupied live cells as small white circles
- Builds a dashboard listing each strategy's color and move sequence.
- Adds a reset button that destroys the sketch and restores the strategy-building UI.
- Clicking inside the canvas re-runs `setup()` and regenerates the world.

### `classes.mjs`

Contains the main simulation model:

- `Cell`: an organism unit with behavior and internal stats.
- `GridState`: a single tile on the board, including food and occupancy.
- `Grid`: the whole simulation board plus update logic.

### `utils.mjs`

Helper utilities:

- random hex color generation
- random strategy generation
- pretty-printing strategies as text labels

### `style.css`

Simple page styling for layout, text, and color swatches in the dashboard.

## Simulation Model

### Cell

Each live organism cell tracks:

- `color`: species/team identifier
- `strategy`: looping genome of move indices
- `satiety`: current stored energy
- `lifespan`: remaining life
- `direction`: current facing vector, initially up (`[0, -1]`)
- `clock`: instruction pointer into the strategy loop
- `digesting`: one-tick cooldown after an eat action
- `consumption_rate`, `growth_rate`, `max_satiety`: feeding parameters

Rotation changes the direction vector in 90-degree steps.

Eating food does two things:

- consumes tile food each tick for upkeep
- increases satiety when enough food is available, capped by the growth/max-satiety logic

### GridState

Each board tile stores:

- `color`
- `occupied`
- `cell`
- `food`
- `food_rate`
- `max_food`

`process_food()` grows food up to the tile max, then lets any occupying cell consume from that tile.

### Grid

The grid is a 2D array of `GridState` objects.

Constructor inputs define:

- grid dimensions
- starting satiety
- starting lifespan
- decay factor
- number of food sources
- food source radius
- maximum food growth rate

Food sources are placed near the center of the board. Each source creates a diamond-shaped gradient where `food_rate` is highest near the center and decreases outward.

## Simulation Step

`Grid.simulate()` performs one frame update in roughly three phases:

1. Create `next_board` as a copy of the current board.
2. Grow/process food on every tile in `next_board`.
3. Iterate through current occupied cells and apply one strategy action each.

For each occupied cell:

- The next move is chosen by `strategy[clock % strategy.length]`.
- The forward tile is computed from the current direction.
- Lifespan is reduced every step based on crowding:
  - neighbors are counted in the surrounding 3x3 area
  - lifespan loss is `decay ^ neighbors`
  - if satiety is `<= 0`, lifespan loss is doubled

If the cell is still alive and not digesting, the action runs:

- `advance`
  - moves forward if the destination is in bounds and unoccupied in both the current and next board
- `rotate left` / `rotate right`
  - changes facing direction in place
- `clone`
  - only allowed when satiety is at least 90% of max
  - creates a copy in front of the cell if that tile is free
  - parent and clone split satiety
  - clone resets `clock` to `0` and `lifespan` to `100`
- `eat`
  - if the forward tile contains an enemy cell, the acting cell moves into that tile
  - the attacker gains energy based on 75% of the defeated cell's satiety
  - the attacker enters a one-step `digesting` state

If a cell is digesting, it skips actions for one step and then resumes.

If lifespan reaches zero or below, the cell is removed.

At the end of the update, `states` is replaced with `next_board`.

## User Flow

1. The page loads and shows buttons for each possible move.
2. The user builds a custom strategy by clicking moves.
3. The strategy text is displayed as both move names and raw numeric encoding.
4. Pressing `Start` hides the setup UI and launches the p5 sketch.
5. The simulation runs continuously at 60 FPS.
6. The sidebar/dashboard lists every spawned strategy with its display color.
7. The user can:
   - click the canvas to regenerate the simulation with the same strategy
   - click `Make new strategy` to destroy the sketch and return to setup mode

## Important Implementation Notes

- Species identity is color-based. `cell_data` uses the random color string as the key.
- The code uses both the current board and next board when checking movement conflicts, which prevents multiple cells from claiming the same destination during a tick.
- Food is visualized directly as grayscale fill values.
- The player's strategy is labeled `"My Strategy:"` in the dashboard.
- A hardcoded extra strategy is always added in `setup()`, so the simulation is not only user strategy versus random organisms.

## Rough Edges / Caveats

- `random_color()` can produce short hex strings, so some generated colors may not be full 6-digit CSS colors.
- `copy_cell()` reuses the original `direction` array reference instead of cloning it, so cloned/copied cells may share direction state unintentionally.
- `copy_state()` reuses the original `cell` reference until a new cell is assigned, so updates depend on the current copying scheme being used carefully.
- `get_num_neighbors()` counts the current cell itself as a neighbor.
- `GridState.remove_cell()` clears `occupied` but does not clear `cell` or reset `color`.
- There is some leftover test/debug code, such as unused variables, commented experiments, and `console.log("asdf")`.
- `score()` in `sketch.mjs` is legacy code and references out-of-scope variables.

## Running Locally

Serve the repository from a local web server rather than opening `index.html` directly. For example:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.
