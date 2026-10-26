let lastMinute = -1;
let horseImg;


const PREVIEW_SIGN = false;

// Colors (hex codes picked from your reference images)
const TRACK_GREEN = '#3DAA3F'; // green from the toy track
const DARK_BAY = '#2E1A12';    // dark bay, almost black → seconds
const BROWN = '#7A3F22';       // mid brown horse → minutes
const CHESTNUT = '#C2692E';    // golden copper horse → hours
const BG_GREEN = '#429255';    // deep green background

// Hour signs: position 0 is for 1 o'clock, position 11 is for 12 o'clock
const HOUR_SIGNS = [
  '𓂭', '𓂮', '𓂯', '𓂰', '𓂱', '𓂲', '𓂳', '𓂴', '𓂵', // 1–9: fingers
  '𓎆',   // 10
  '𓎆𓂭', // 11
  '𓎆𓂮'  // 12
];

async function setup() {
  createCanvas(windowWidth, windowHeight);
  horseImg = await loadImage('horse.png');
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(BG_GREEN);
  translate((width - 800) / 2, (height - 600) / 2);

  // Required: log the minute when it changes
  let m = minute();
  if (m !== lastMinute) {
    console.log(m);
    lastMinute = m;
  }

  // Draw the three oval tracks as thick green lanes
  noFill();
  stroke(TRACK_GREEN);
  strokeWeight(14);
  ellipse(400, 300, 660, 480); // outer: seconds
  ellipse(400, 300, 460, 320); // middle: minutes
  ellipse(400, 300, 280, 180); // inner: hours

  // Turn each time value into a position around its track
  let sAngle = map(second(), 0, 60, 0, TWO_PI) - HALF_PI;
  let mAngle = map(minute(), 0, 60, 0, TWO_PI) - HALF_PI;
  let hAngle = map(hour() % 12, 0, 12, 0, TWO_PI) - HALF_PI;

  // Place a horse on each track
  drawRunner(140, 90, hAngle, CHESTNUT);
  drawRunner(230, 160, mAngle, BROWN);
  drawRunner(330, 240, sAngle, DARK_BAY);

  // Center sign: only during the first minute of each hour
  if (minute() === 0 || PREVIEW_SIGN) {
    drawHourSign();
  }
}

function drawHourSign() {
  let h = hour() % 12;
  if (h === 0) {
    h = 12; // midnight and noon show 12, not 0
  }
  noStroke();
  fill(DARK_BAY);
  textSize(80);
  textAlign(CENTER, CENTER);
  text(HOUR_SIGNS[h - 1], 400, 300);
}

function drawRunner(rx, ry, angle, col) {
  let x = 400 + rx * cos(angle);
  let y = 300 + ry * sin(angle);
  // Top half of the oval: moving right. Bottom half: moving left.
  let facingRight = sin(angle) < 0;
  drawHorse(x, y, facingRight, col);
}

function drawHorse(x, y, facingRight, col) {
  push();
  translate(x, y);
  // The horse image faces left, so mirror it when running right
  if (facingRight) {
    scale(-1, 1);
  }
  tint(col);              // recolor the white silhouette
  imageMode(CENTER);
  image(horseImg, 0, -22, 50, 50); // hooves sit on the track
  pop();
}