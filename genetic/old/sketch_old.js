
var w;
var columns;
var rows;
var board;
var next;
var strategies = {};
var scores = {};
var num_strategies = 5
var stratLen = 8;

//board entries: color, direction, occupied, moved into, clock
function setup() {
  createCanvas(720, 400);
  w = 20;
	frameRate(60);
  // Calculate columns and rows
  columns = floor(width/w);
  rows = floor(height/w);
  // Wacky way to make a 2D array is JS
  board = new Array(columns);
  for (var i = 0; i < columns; i++) {
    board[i] = new Array(rows);
		for (j = 0; j < rows; j++) {
			board[i][j] = [255, [0, 0], false, false, 0];
		}
  }
  // Going to use multiple 2D arrays and swap them

	for (i = 0; i < num_strategies; i++) {
		createStrategy(stratLen);
	}
	for (var k in strategies) {
   print(k, strategies[k]);
  }
}

function draw() {
  background(255);
	simulate();
  score();
  if (frameCount % 30) {
   	print(scores);
  }
  for ( var i = 0; i < columns;i++) {
    for ( var j = 0; j < rows;j++) {
      fill(board[i][j][0]);
      stroke(0);
      rect(i*w, j*w, w-1, w-1);
			if (board[i][j][2]) {
				fill(255);
				rect(i*w + (w-1)/4, j*w + (w-1)/4, (w-1)/2, (w-1) / 2);
			}
    }
  }

}

// reset board when mouse is pressed
function mousePressed() {
  init();
}

function simulate() {
	var next = new Array(columns);
  for (i = 0; i < columns; i++) {
    next[i] = new Array(rows);
		for (j = 0; j < rows; j++) {
			next[i][j] = [255, [0, 0], false, false, 0];
		}
  }
	for (i = 0; i < columns; i++) {
		for (j = 0; j < rows; j++) {
			var currCell = board[i][j];
			if (currCell[2]) {
				var currStrategy = strategies[currCell[0]];
				var currMove = currStrategy[currCell[4] % currStrategy.length];
				var dir = currCell[1];
				//print(currMove);
        var newX = i + dir[0];
        var newY = j + dir[1];
				if (currMove == 0) {
          if (newX >= 0 && newX < columns && newY >= 0 && newY < rows && !board[newX][newY][2]) {
            next[i + dir[0]][j + dir[1]] = [currCell[0], [dir[0], dir[1]], true, true, currCell[4] + 1];
            if (!next[i][j][3]) {
							next[i][j] = [currCell[0], [0, 0], false, false, 0];
            }
          } else {
            next[i][j] = [currCell[0], [dir[0], dir[1]], true, true, currCell[4] + 1];
          }
				} else if (currMove == 1) {
					if (dir[0] == 0 && dir[1] == -1) {
						dir[0] = -1;
						dir[1] = 0;
					} else if (dir[0] == -1 && dir[1] == 0) {
						dir[0] = 0;
						dir[1] = 1;
					} else if (dir[0] == 0 && dir[1] == 1) {
						dir[0] = 1;
						dir[1] = 0;
					} else if (dir[0] == 1 && dir[1] == 0) {
						dir[0] = 0;
						dir[1] = -1;
					}
					next[i][j] = [currCell[0], [dir[0], dir[1]], true, true, currCell[4] + 1];
				} else if (currMove == 2) {
         	if (dir[0] == 0 && dir[1] == -1) {
           	dir[0] = 1;
            dir[1] = 0;
          } else if (dir[0] == 1 && dir[1] == 0) {
           	dir[0] = 0;
            dir[1] = 1;
          } else if (dir[0] == 0 && dir[1] == 1) {
           	dir[0] = -1;
            dir[1] = 0;
          } else if (dir[0] == -1 && dir[1] == 0) {
           	dir[0] = 0;
            dir[1] = -1;
          }
					next[i][j] = [currCell[0], [dir[0], dir[1]], true, true, currCell[4] + 1];
        } else if (currMove == 3) {
          if (newX >= 0 && newX < columns && newY >= 0 && newY < rows && board[newX][newY][2] == false) {
            next[i + dir[0]][j + dir[1]] = [currCell[0], [dir[0], dir[1]], true, true, 0];
          }
          next[i][j] = [currCell[0], [dir[0], dir[1]], true, true, currCell[4] + 1];
        } else if (currMove == 4) {
          //cannbalistic or not?
          if (newX >= 0 && newX < columns && newY >= 0 && newY < rows && board[newX][newY][2] == true && board[newX][newY][0] != board[i][j][0]) {
            next[i + dir[0]][j + dir[1]] = [board[newX][newY][0], [dir[0], dir[1]], false, false, 0];
          }
          next[i][j] = [currCell[0], [dir[0], dir[1]], true, true, currCell[4] + 1];
        }
			} else {
      	if (next[i][j][0] == 255) {
        	next[i][j] = [currCell[0], [0, 0], false, false, 0];
        }
      }
		}
	}
	board = next;
}

//0: advance, 1: rotate left, 2: rotate right, 3: clone, 4: eat
function createStrategy (length) {
	var result = []
	var cellColor;
	while ((cellColor = [floor(random(255)), floor(random(255)), floor(random(255))]) in strategies) {
	}
	for(var i = 0; i < length; i++) {
		var curr = floor(random(5));
		result.push(curr);
	}
  scores[cellColor] = 1;
	strategies[cellColor] = result;
	board[floor(random(columns/2)) + columns/4][floor(random(rows/2)) + rows/4] = [cellColor, [0, -1], true, true, 0];
}

function score() {
  var newScores = {};
  for (var i = 0; i < columns; i++) {
   	for (var j = 0; j < rows; j++) {
     	var currCell = board[i][j];
      if (currCell[0] != 255) {
       	if(!(currCell[0] in newScores)) {
         	newScores[currCell[0]] = 1;
        } else {
         	newScores[currCell[0]] += 1;
        }
      }
    }
  }
  scores = newScores
}
