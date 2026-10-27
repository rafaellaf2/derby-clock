let lastMinute = -1;
let horseGround, horseAir, grassImg, cardImg, labelFont;  // labelFont is used for the card numbers and lane numbers
let fieldLayer;         // the green board: board green with the grass photo pressed into it, drawn once
let paperLayer;         // colored-pencil grain and ink speckle, laid over the board, drawn once
let tracks;             // the three lanes
let band;               // how wide each lane is (worked out from the window size)
let lastSec = -1;       // for smooth timing of the seconds horse
let secStartMs = 0;

// Colors: flat board-game inks
const FIELD = '#5E9C4B';       // board green
const GRASS_STRENGTH = 0.65;   // how much the grass photo shows through the board green (0 = flat green, 1 = all grass)
const GRASS_SCALE = 800;       // size of each grass tile (smaller = finer grass)
const PAPER_TILE = 300;        // size of the repeating speckle/pencil tile
const CREAM = '#F3EBD3';       // paper cream: borders and lane edges
const INK = '#2B2420';         // dark keylines, ticks and lane numbers
const FRAME_RED = '#D8432E';   // thin red rule in the border
const BRASS = '#B8862B';       // ring around the lit lamps
const PEN_RED = '#C8261E';     // red pen circle around am / pm
const LANE_HOURS = '#5DA6D6';   // inner lane: blue
const LANE_MINUTES = '#F3CE3D'; // middle lane: yellow
const LANE_SECONDS = '#F2A497'; // outer lane: pink
const CORD = '#F0148C';        // bright magenta cords
const DARK_BAY = '#2E1A12';    // dark bay, almost black → seconds
const BROWN = '#7A3F22';       // mid brown horse → minutes
const CHESTNUT = '#C2692E';    // golden copper horse → hours

// Board layout
const FRAME = 30;              // width of the cream border around the board
const BAND_SIZE = 0.07;        // lane width, as a fraction of the window's shorter side
const BAND_MIN = 34, BAND_MAX = 64;
const LANE_GAP = 8;            // strip of green between lanes
const MISREGISTER = 1.6;       // how far the lane color is knocked out of line with its keylines (riso)
// Roundness of each lane: 2 = oval; bigger numbers = boxier
const OUTER_ROUNDNESS = 5, MIDDLE_ROUNDNESS = 3.4, INNER_ROUNDNESS = 2.4;
// The inner lane never gets smaller than this, so the cards always fit inside it
const INNER_MIN_W = 160, INNER_MIN_H = 72;

// Wonkiness: all lanes share one gentle lumpy shape (in pixels), so they stay close together.
// The inner lane also gets pinched inward, making the green center patch wonky.
const WOBBLE = 14;
const INNER_PINCH = 22;

// Warping: the lanes slowly morph together. The warp grows exponentially through each hour.
const WARP_BASE = 3;           // pixels of warp at the start of the hour
const WARP_GROWTH = 1.035;     // multiplied in every minute (≈ 8x by the end of the hour)
const WARP_MAX = 26;           // the most it can warp, in pixels
const WARP_SPEED = 0.00004;    // how fast the shapes drift

// Cords
const CORD_SAMPLES = 160;      // how smooth each cord is
const MAX_KNOTS = 18;          // knots across all three cords by the end of the day (11:59pm)
const O_FOR_EVERY_ZERO = false; // false: only the leading zero of the hour becomes "o"; true: every 0 does

// Horse sizes (in pixels): seconds smallest, hours largest
const SECONDS_SIZE = 52;
const MINUTES_SIZE = 62;
const HOURS_SIZE = 72;

// Seconds horse trail (like Muybridge's frames)
const TRAIL_COUNT = 5;         // most horses visible at once (the leader plus its ghosts)
const FRAMES_PER_SECOND = 2;   // a new frame every half second

// Center: show the time cards, or let the cords meet in a knot instead
const SHOW_CARDS = false;      // true = cards in the center; false = a braided knot of cords
const KNOT_MIN = 1;           // size of the center knot just after midnight
const KNOT_MAX = 24;           // size of the center knot by the end of the day

// Card size and spacing
const CARD_W = 40;
const CARD_H = 60;
const CARD_GAP = 5;    // space between two cards in a pair (like the 3 and 5 in 35)
const GROUP_GAP = 18;  // space between the hour, minute and second pairs
const DIGIT_SIZE = 32;
const DIGIT_NUDGE = -4; // moves the numbers up (negative) or down (positive) on the cards

async function setup() {
  createCanvas(windowWidth, windowHeight);
  horseGround = await loadImage('horse_ground_riso.png'); // canter pose 1: hooves on the ground
  horseAir = await loadImage('horse_air_riso.png');       // canter pose 2: all hooves in the air
  grassImg = await loadImage('grass.jpg');
  cardImg = await loadImage('card.png');
  labelFont = await loadFont('MaziusDisplay-Extraitalic.otf');
  buildLayers();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildLayers();
}

// Makes the two textures that never change: the grassy green field, and the pencil/riso grain.
// This only happens at the start and when the window changes size.
function buildLayers() {
  for (let layer of [fieldLayer, paperLayer]) {
    if (layer) {
      layer.remove();
    }
  }
  band = constrain(min(width, height) * BAND_SIZE, BAND_MIN, BAND_MAX);

  // The green field: flat board green, with the grass photo pressed into it.
  // The grass is tinted so its average lands on the board green.
  fieldLayer = createGraphics(width, height);
  fieldLayer.pixelDensity(1);
  fieldLayer.background(FIELD);
  let f = color(FIELD);
  let grassTint = color(min(255, red(f) * 2.1), min(255, green(f) * 1.75), min(255, blue(f) * 2.4), GRASS_STRENGTH * 255);
  fieldLayer.tint(grassTint);
  for (let x = 0; x < width; x += GRASS_SCALE) {
    for (let y = 0; y < height; y += GRASS_SCALE) {
      fieldLayer.image(grassImg, x, y, GRASS_SCALE, GRASS_SCALE);
    }
  }
  fieldLayer.noTint();

  // The paper grain: diagonal colored-pencil strokes where the paper shows through,
  // plus a fine speckle of ink, like a riso print.
  // It's made as one small square tile, then repeated across the screen (much faster than the whole screen).
  let tile = createGraphics(PAPER_TILE, PAPER_TILE);
  tile.pixelDensity(1);
  tile.loadPixels();
  for (let y = 0; y < PAPER_TILE; y++) {
    for (let x = 0; x < PAPER_TILE; x++) {
      let i = 4 * (y * PAPER_TILE + x);
      let along = (x + y) * 0.05;    // slowly changing along each pencil stroke
      let across = (x - y) * 0.45;   // quickly changing across the strokes
      let pencil = noise(across, along);
      let r = random();
      let rgb = 255, a = 0;
      if (r < 0.035) {
        rgb = 40; a = 70;                       // dark ink speck
      } else if (r > 0.985) {
        rgb = 255; a = 120;                     // pale fleck where ink didn't take
      } else if (pencil > 0.64) {
        rgb = 255; a = (pencil - 0.64) * 170;   // paper showing between pencil strokes
      }
      tile.pixels[i] = rgb;
      tile.pixels[i + 1] = rgb;
      tile.pixels[i + 2] = rgb;
      tile.pixels[i + 3] = a;
    }
  }
  tile.updatePixels();

  paperLayer = createGraphics(width, height);
  paperLayer.pixelDensity(1);
  for (let x = 0; x < width; x += PAPER_TILE) {
    for (let y = 0; y < height; y += PAPER_TILE) {
      paperLayer.image(tile, x, y);
    }
  }
  tile.remove();

  tracks = makeTracks();
}

function draw() {
  // Required: log the minute when it changes
  let m = minute();
  if (m !== lastMinute) {
    console.log(m);
    lastMinute = m;
  }

  let digits = timeDigits();

  // Keep track of when the current second began, so the seconds horse can step every half second
  if (second() !== lastSec) {
    lastSec = second();
    secStartMs = millis();
  }

  // The lanes slowly warp, so re-shape them every frame
  tracks = makeTracks();

  // 1. The green field
  image(fieldLayer, 0, 0, width, height);

  // 2. The three lanes, outer first
  drawLane(tracks[2], LANE_SECONDS, 60, 5, 10);
  drawLane(tracks[1], LANE_MINUTES, 60, 5, 10);
  drawLane(tracks[0], LANE_HOURS, 12, 1, 3);

  // 3. Pencil and riso grain over the whole board, then the cream border
  image(paperLayer, 0, 0, width, height);
  drawFrame();

  // 3b. Pinball lamps on the lanes: the current hour, and the last circled minute and second passed.
  //     Plus am / pm circled in red pen, and the time zone printed small.
  drawLaneLamps();
  drawAmPm();
  drawTimeZone();

  // 4. Where each horse is right now
  let hourSpot = trackSpot(tracks[0], (hour() % 12) / 12);
  let minuteSpot = trackSpot(tracks[1], minute() / 60);
  let secondsFrame = currentSecondsFrame();
  let secondSpot = trackSpot(tracks[2], secondsFrame / (60 * FRAMES_PER_SECOND));

  // 5. The magenta cords from the center (the cards, or the knot) to each horse
  drawCords([
    { pair: 0, horse: hourSpot, size: HOURS_SIZE },
    { pair: 1, horse: minuteSpot, size: MINUTES_SIZE },
    { pair: 2, horse: secondSpot, size: SECONDS_SIZE }
  ]);

  // 6. The horses
  let canter = floor(millis() / 250) % 2; // the hour and minute horses canter in place
  drawHorse(hourSpot.x, hourSpot.y, hourSpot.facingRight, CHESTNUT, 255, 0, 0, HOURS_SIZE, canter);
  drawHorse(minuteSpot.x, minuteSpot.y, minuteSpot.facingRight, BROWN, 255, 0, 0, MINUTES_SIZE, 1 - canter);
  drawSecondsTrail(secondsFrame);

  // 7. The time cards, fixed in the center, on top of everything (if they're switched on)
  if (SHOW_CARDS) {
    drawCards(digits);
  }
}

// ---------- The board ----------

// A cream border with thin keylines, like the edge of a printed game board
function drawFrame() {
  push();
  noFill();
  stroke(CREAM);
  strokeWeight(FRAME * 2);
  rect(0, 0, width, height);
  stroke(INK);
  strokeWeight(2);
  rect(FRAME, FRAME, width - FRAME * 2, height - FRAME * 2);
  stroke(FRAME_RED);
  strokeWeight(1.5);
  rect(FRAME - 6, FRAME - 6, width - (FRAME - 6) * 2, height - (FRAME - 6) * 2);
  pop();
}

// One lane: dark keylines, a cream edge, the flat color (knocked slightly out of line, like riso),
// cell divisions across the lane, and printed numbers.
// cells = how many divisions, numberEvery = which cells get a number, circleEvery = which numbers get circled
function drawLane(track, col, cells, numberEvery, circleEvery) {
  push();
  noFill();
  strokeJoin(ROUND);
  // dark keylines (the outer edges of a slightly wider dark band)
  stroke(INK);
  strokeWeight(band + 4);
  tracePath(track.points, true);
  // cream edge
  stroke(CREAM);
  strokeWeight(band + 0.5);
  tracePath(track.points, true);
  // the lane color, nudged out of line
  translate(MISREGISTER, MISREGISTER * 0.6);
  stroke(col);
  strokeWeight(band - 7);
  tracePath(track.points, true);
  pop();

  // cell divisions and numbers
  push();
  let half = band / 2 - 3;
  for (let k = 0; k < cells; k++) {
    let spot = trackSpot(track, k / cells);
    stroke(INK);
    strokeWeight(0.9);
    let c = color(INK);
    c.setAlpha(150);
    stroke(c);
    line(spot.x - spot.nx * half, spot.y - spot.ny * half, spot.x + spot.nx * half, spot.y + spot.ny * half);
  }
  textFont(labelFont);
  textAlign(CENTER, CENTER);
  let size = constrain(band * 0.26, 9, 14);
  textSize(size);
  for (let k = 0; k < cells; k++) {
    let n = k + 1; // the number belongs to the cell that ends here
    if (n % numberEvery !== 0) {
      continue;
    }
    let spot = trackSpot(track, (k + 0.5) / cells); // middle of the cell
    // print the number near the lane's outer edge
    let px = spot.x + spot.nx * (band / 2 - size * 0.9);
    let py = spot.y + spot.ny * (band / 2 - size * 0.9);
    noStroke();
    fill(INK);
    text(n, px, py - 1);
    if (n % circleEvery === 0) {
      noFill();
      stroke(INK);
      strokeWeight(0.8);
      circle(px, py, size * 1.55);
    }
  }
  pop();
}

// ---------- Lamps and print ----------

// A pinball-style lamp: a warm glow, a lit disc with a brass ring, and the label dark on top.
// When it's off, just the label and a faint ring.
function drawLamp(x, y, label, size, lit) {
  let ctx = drawingContext;
  let discW = max(size * 1.7, textWidthAt(label, size) + size * 0.9);
  if (lit) {
    let flicker = 0.85 + 0.15 * noise(x, millis() * 0.004); // a warm bulb never burns perfectly steady
    // the glow spilling out around it
    let r = discW * 1.15;
    let glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, 'rgba(255, 236, 170, ' + 0.95 * flicker + ')');
    glow.addColorStop(0.4, 'rgba(255, 196, 90, ' + 0.55 * flicker + ')');
    glow.addColorStop(1, 'rgba(255, 150, 40, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
  }
  push();
  // the disc (lit) and its ring
  if (lit) {
    noStroke();
    fill(255, 246, 214);
    ellipse(x, y, discW, size * 1.7);
    stroke(BRASS);
    strokeWeight(1.4);
  } else {
    let c = color(INK);
    c.setAlpha(110);
    stroke(c);
    strokeWeight(0.8);
  }
  noFill();
  ellipse(x, y, discW, size * 1.7);
  // the label
  noStroke();
  fill(INK);
  textFont(labelFont);
  textSize(size);
  textAlign(CENTER, CENTER);
  text(label, x, y - 1);
  pop();
}

function textWidthAt(label, size) {
  push();
  textFont(labelFont);
  textSize(size);
  let w = textWidth(label);
  pop();
  return w;
}

// Finds where a lane's printed number sits (the same spot drawLane prints it)
function numberSpot(track, cells, n) {
  let size = constrain(band * 0.26, 9, 14);
  let spot = trackSpot(track, (n - 0.5) / cells);
  return {
    x: spot.x + spot.nx * (band / 2 - size * 0.9),
    y: spot.y + spot.ny * (band / 2 - size * 0.9),
    size: size
  };
}

// Lights up: the current hour on the hours lane, and the last circled number passed
// on the minutes and seconds lanes (so 3:25:11 lights 3, 20 and 10)
function drawLaneLamps() {
  let h = hour() % 12;
  if (h === 0) {
    h = 12;
  }
  let lastTen = (value) => {
    let n = floor(value / 10) * 10;
    return n === 0 ? 60 : n;   // 0 to 9 past → the 60 at the top
  };
  let lamps = [
    { track: tracks[0], cells: 12, n: h },
    { track: tracks[1], cells: 60, n: lastTen(minute()) },
    { track: tracks[2], cells: 60, n: lastTen(second()) }
  ];
  for (let lamp of lamps) {
    let at = numberSpot(lamp.track, lamp.cells, lamp.n);
    drawLamp(at.x, at.y, String(lamp.n), at.size * 1.15, true);
  }
}

// am in the bottom-left corner, pm in the bottom-right; the current one is circled in red pen
function drawAmPm() {
  let isAM = hour() < 12;
  let y = height - FRAME / 2 + 1;
  let leftX = FRAME + 26;
  let rightX = width - FRAME - 26;
  push();
  noStroke();
  fill(INK);
  textFont(labelFont);
  textSize(14);
  textAlign(CENTER, CENTER);
  text('am', leftX, y - 2);
  text('pm', rightX, y - 2);
  pop();
  if (isAM) {
    drawPenCircle(leftX, y - 1, 34, 20);
  } else {
    drawPenCircle(rightX, y - 1, 34, 20);
  }
}

// A quick hand-drawn pen loop: slightly lopsided, tilted, and overshooting where it closes
function drawPenCircle(x, y, w, h) {
  push();
  translate(x, y);
  rotate(-0.12);
  noFill();
  stroke(PEN_RED);
  strokeWeight(1.6);
  strokeCap(ROUND);
  beginShape();
  for (let a = 0; a <= TWO_PI * 1.12; a += 0.08) {
    let wobble = 1 + 0.06 * sin(a * 3 + 1.1) + 0.04 * sin(a * 5 + 0.3);
    let grow = 1 + 0.05 * (a / TWO_PI);   // the second pass drifts a little wider
    vertex(cos(a) * w / 2 * wobble * grow, sin(a) * h / 2 * wobble * grow);
  }
  endShape();
  pop();
}

// The viewer's time zone, printed small along the bottom border like a board game's copyright line.
// It uses whatever time zone the viewer's computer is set to (EDT, EST, PST, GMT+1...).
function drawTimeZone() {
  let shortName = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
    .formatToParts(new Date()).find(part => part.type === 'timeZoneName').value;
  let longName = new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' })
    .formatToParts(new Date()).find(part => part.type === 'timeZoneName').value;
  push();
  noStroke();
  fill(INK);
  textFont(labelFont);
  textSize(11);
  textAlign(CENTER, CENTER);
  drawingContext.letterSpacing = '1.5px';
  text(shortName + '.  ' + longName.toUpperCase(), width / 2, height - FRAME / 2 + 1);
  drawingContext.letterSpacing = '0px';
  pop();
}

function tracePath(pts, closed) {
  beginShape();
  for (let p of pts) {
    vertex(p.x, p.y);
  }
  if (closed) {
    endShape(CLOSE);
  } else {
    endShape();
  }
}

// ---------- Tracks ----------

// Builds the three lanes (inner, middle, outer) for the current window size.
// They nest closely: each one sits one lane-width plus a thin green gap inside the last.
function makeTracks() {
  let laneStep = band + LANE_GAP;
  let outerW = width / 2 - FRAME - band / 2 - 10 - WOBBLE;
  let outerH = height / 2 - FRAME - band / 2 - 10 - WOBBLE;
  // keep the inner lane big enough to hold the cards; on small screens the outer lane grows past the edge instead
  outerW = max(outerW, INNER_MIN_W + 2 * laneStep);
  outerH = max(outerH, INNER_MIN_H + 2 * laneStep);

  // how warped the lanes are right now: grows exponentially through the hour
  let minutesIn = minute() + second() / 60;
  let warp = min(WARP_BASE * pow(WARP_GROWTH, minutesIn), WARP_MAX);
  let time = millis() * WARP_SPEED;
  return [
    makeTrack(outerW - 2 * laneStep, outerH - 2 * laneStep, INNER_ROUNDNESS, warp, time, INNER_PINCH),
    makeTrack(outerW - laneStep, outerH - laneStep, MIDDLE_ROUNDNESS, warp, time, 0),
    makeTrack(outerW, outerH, OUTER_ROUNDNESS, warp, time, 0)
  ];
}

// Traces one lane's center line as a list of points, starting at the top and going clockwise,
// and measures how far along the lane each point is.
function makeTrack(halfW, halfH, roundness, warp, time, pinch) {
  let points = [];
  let distances = [0];
  let steps = 400;
  for (let i = 0; i <= steps; i++) {
    let a = -HALF_PI + TWO_PI * i / steps;
    let c = cos(a);
    let s = sin(a);
    let waves = 0.6 * sin(2 * a + 1.3) + 0.4 * sin(3 * a + 0.4) + 0.3 * sin(5 * a + 2.1);
    // shared lumps and warp (in pixels), so neighbouring lanes bend together
    let push = WOBBLE * waves + warp * 2 * (noise(1.2 * c + 1.2, 1.2 * s + 1.2, time) - 0.5);
    // the inner lane only ever pinches inward, so it never bumps into the middle lane
    push -= pinch * abs(sin(3 * a + 0.7)) * abs(sin(2 * a + 2.0));
    let x = width / 2 + (halfW + push) * Math.sign(c) * pow(abs(c), 2 / roundness);
    let y = height / 2 + (halfH + push) * Math.sign(s) * pow(abs(s), 2 / roundness);
    points.push({ x: x, y: y });
    if (i > 0) {
      let prev = points[i - 1];
      distances.push(distances[i - 1] + dist(prev.x, prev.y, x, y));
    }
  }
  return { points: points, distances: distances, length: distances[steps] };
}

// Finds the spot a fraction of the way around a lane (0 = top, 0.5 = halfway),
// which way a horse there would be facing, and the direction pointing out of the lane (nx, ny)
function trackSpot(track, fraction) {
  let target = fraction * track.length;
  let i = 1;
  while (i < track.distances.length - 1 && track.distances[i] < target) {
    i++;
  }
  let a = track.points[i - 1];
  let b = track.points[i];
  let segment = track.distances[i] - track.distances[i - 1];
  let k = segment > 0 ? (target - track.distances[i - 1]) / segment : 0;
  let dx = b.x - a.x, dy = b.y - a.y;
  let len = max(sqrt(dx * dx + dy * dy), 0.0001);
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    facingRight: dx > 0,
    nx: dy / len,     // points outward, away from the center
    ny: -dx / len
  };
}

// Which half-second frame of the minute we're on (0 to 119)
function currentSecondsFrame() {
  let secFraction = constrain((millis() - secStartMs) / 1000, 0, 0.999);
  return floor((second() + secFraction) * FRAMES_PER_SECOND);
}

// The seconds horse moves in half-second "frames", like Muybridge's photographs.
// At the start of each minute it's alone; each half second adds one more ghost behind it,
// up to TRAIL_COUNT. The ghosts are layered with MULTIPLY, so where they overlap they darken,
// like stacked photographic negatives.
function drawSecondsTrail(frame) {
  let framesInMinute = 60 * FRAMES_PER_SECOND;
  let count = min(TRAIL_COUNT, frame + 1); // the trail grows from 1 at the start of each minute

  // a little galloping bob and tilt that cycles through 4 poses
  let bobs = [0, -5, -7, -2];
  let tilts = [0, -0.06, 0.02, 0.07];

  // oldest ghost first, so the leader is drawn on top
  for (let k = count - 1; k >= 0; k--) {
    let f = frame - k;
    let spot = trackSpot(tracks[2], f / framesInMinute);
    let pose = f % 4;
    if (k === 0) {
      blendMode(BLEND);
      drawHorse(spot.x, spot.y, spot.facingRight, DARK_BAY, 255, bobs[pose], tilts[pose], SECONDS_SIZE, f % 2);
    } else {
      blendMode(MULTIPLY);
      let fade = map(k, 1, TRAIL_COUNT - 1, 170, 45); // older ghosts are fainter
      drawHorse(spot.x, spot.y, spot.facingRight, DARK_BAY, fade, bobs[pose], tilts[pose], SECONDS_SIZE, f % 2);
    }
  }
  blendMode(BLEND);
}

// pose 0 = hooves on the ground, pose 1 = in the air (drawn a little higher)
function drawHorse(x, y, facingRight, col, alpha, bob, tilt, size, pose) {
  let img = pose === 1 ? horseAir : horseGround;
  let w = size * 1.35;                 // these horses are wider than they are tall
  let h = w * img.height / img.width;
  let lift = pose === 1 ? size * 0.12 : 0;
  push();
  translate(x, y + bob - lift);
  // The Muybridge horse faces right, so mirror it when running left
  if (!facingRight) {
    scale(-1, 1);
  }
  rotate(tilt);
  let c = color(col);
  c.setAlpha(alpha);
  tint(c);                // recolor the white silhouette (and fade it)
  imageMode(CORNER);
  image(img, -w / 2, -h + band * 0.22, w, h); // hooves sit in the lane
  pop();
}

// ---------- Cards ----------

// The current time as 6 digits, e.g. 12:35:08 → "123508"
function timeDigits() {
  let h = hour() % 12;
  if (h === 0) {
    h = 12; // midnight and noon show 12, not 00
  }
  let digits = twoDigits(h) + twoDigits(minute()) + twoDigits(second());
  if (O_FOR_EVERY_ZERO) {
    digits = digits.replaceAll('0', 'o');
  } else if (digits[0] === '0') {
    digits = 'o' + digits.substring(1); // single-digit hours: o1 to o9
  }
  return digits;
}

// Adds a leading zero: 8 → "08"
function twoDigits(n) {
  return String(n).padStart(2, '0');
}

// Where each of the 6 cards sits, left to right
function cardXs() {
  let total = 6 * CARD_W + 3 * CARD_GAP + 2 * GROUP_GAP;
  let x = width / 2 - total / 2 + CARD_W / 2;
  let xs = [];
  for (let i = 0; i < 6; i++) {
    xs.push(x);
    if (i === 1 || i === 3) {
      x += CARD_W + GROUP_GAP;
    } else {
      x += CARD_W + CARD_GAP;
    }
  }
  return xs;
}

// The six cards, side by side in the center
function drawCards(digits) {
  let xs = cardXs();
  for (let i = 0; i < 6; i++) {
    drawCard(xs[i], height / 2, 0, digits[i]);
  }
}

function drawCard(x, y, angle, digit) {
  push();
  translate(x, y);
  rotate(angle);
  imageMode(CENTER);
  image(cardImg, 0, 0, CARD_W, CARD_H);
  noStroke();
  fill(0);
  textFont(labelFont);
  textSize(DIGIT_SIZE);
  textAlign(CENTER, CENTER);
  text(digit, 0, DIGIT_NUDGE);
  pop();
}

// ---------- Cords ----------

// Draws a loose magenta cord from each pair of cards to its horse.
// Each cord is a bundle of thin strands (one dotted, like Muybridge's hoof-path diagrams).
// Knots (little loops) pile up as the day goes on, and wherever cords cross, a small "clot" forms.
function drawCords(links) {
  let xs = cardXs();
  let cx = width / 2;
  let cy = height / 2;
  let time = millis() / 1000;

  // how many knots right now: 0 at midnight, MAX_KNOTS by the end of the day
  let dayFraction = (hour() + minute() / 60) / 24;
  let knotCount = floor(dayFraction * MAX_KNOTS);
  let knotR = lerp(KNOT_MIN, KNOT_MAX, dayFraction);   // size of the center knot right now

  let cordPaths = [];
  for (let c = 0; c < links.length; c++) {
    let link = links[c];
    let endX = link.horse.x;
    let endY = link.horse.y - link.size * 0.4;
    let startX, startY;
    if (SHOW_CARDS) {
      // start at the middle of this pair of cards, on the edge facing the horse
      startX = (xs[link.pair * 2] + xs[link.pair * 2 + 1]) / 2;
      startY = cy + (endY > cy ? CARD_H / 2 : -CARD_H / 2);
    } else {
      // start inside the center knot, on the side facing the horse
      let toward = atan2(endY - cy, endX - cx);
      startX = cx + cos(toward) * knotR * 0.5;
      startY = cy + sin(toward) * knotR * 0.5;
    }

    // this cord's knots: knots are dealt out to the three cords in turn
    let knots = [];
    for (let k = c; k < knotCount; k += links.length) {
      knots.push({ at: 0.12 + 0.76 * fract(sin(k * 91.7 + 3.1) * 4375.5), size: 7 + 7 * fract(sin(k * 12.9) * 9123.1), turn: k % 2 === 0 ? 1 : -1 });
    }

    // three strands, each swaying a little differently
    let strands = [];
    for (let st = 0; st < 3; st++) {
      strands.push(cordPath(startX, startY, endX, endY, knots, c * 7 + st * 1.7, time, st));
    }
    cordPaths.push(strands[0]);

    let ctx = drawingContext;
    noFill();
    let col = color(CORD);
    // main strand
    col.setAlpha(255);
    stroke(col);
    strokeWeight(1.6);
    drawPath(strands[0]);
    // thinner strand
    col.setAlpha(190);
    stroke(col);
    strokeWeight(0.8);
    drawPath(strands[1]);
    // dotted strand
    ctx.setLineDash([2, 4]);
    col.setAlpha(230);
    stroke(col);
    strokeWeight(1.1);
    drawPath(strands[2]);
    ctx.setLineDash([]);

    // a clot where each knot loop crosses itself
    for (let kn of knots) {
      let i = floor(kn.at * CORD_SAMPLES);
      drawClot(strands[0][i].x, strands[0][i].y, 3 + dayFraction * 3);
    }
  }

  // the braided knot in the center, where the cords meet
  if (!SHOW_CARDS) {
    drawCenterKnot(cx, cy, knotR, dayFraction, time);
  }

  // clots where different cords cross each other
  for (let a = 0; a < cordPaths.length; a++) {
    for (let b = a + 1; b < cordPaths.length; b++) {
      for (let hit of crossings(cordPaths[a], cordPaths[b])) {
        drawClot(hit.x, hit.y, 3 + dayFraction * 4);
      }
    }
  }
}

// The points along one strand of a cord: a loose sagging line from start to end,
// swaying with smooth noise, with a little loop curled in at each knot.
function cordPath(x1, y1, x2, y2, knots, seed, time, strand) {
  let len = dist(x1, y1, x2, y2);
  let tx = (x2 - x1) / max(len, 1);   // direction along the cord
  let ty = (y2 - y1) / max(len, 1);
  let nx = -ty;                        // direction across the cord
  let ny = tx;
  let slack = min(len * 0.25, 120);    // how loose and wandering it is
  let pts = [];
  for (let i = 0; i <= CORD_SAMPLES; i++) {
    let u = i / CORD_SAMPLES;
    let ends = sin(PI * u);            // 0 at both ends, so the cord stays attached
    let sway = (noise(seed, u * 2.2, time * 0.15) - 0.5) * 2 * slack * ends;
    let fuzz = strand * 2.5 * ends * sin(u * 40 + seed);  // strands drift apart a little in the middle
    let x = lerp(x1, x2, u) + nx * (sway + fuzz);
    let y = lerp(y1, y2, u) + ny * (sway + fuzz) + ends * 25; // a little gravity sag
    // knots: curl backward and around in a small loop
    for (let kn of knots) {
      let w = (kn.size * 1.4) / max(len, 1); // how much of the cord each loop uses
      if (abs(u - kn.at) < w) {
        let q = (u - kn.at + w) / (2 * w);  // 0 to 1 through the loop
        let r = kn.size;
        let back = -sin(TWO_PI * q) * r * 1.6;
        let side = (1 - cos(TWO_PI * q)) * r * kn.turn;
        x += tx * back + nx * side;
        y += ty * back + ny * side;
      }
    }
    pts.push({ x: x, y: y });
  }
  return pts;
}

// The center knot: loops of cord wound around each other, more of them as the day goes on.
// Wherever two neighbouring loops cross, a small clot forms, and a bigger one sits in the middle.
function drawCenterKnot(cx, cy, r, dayFraction, time) {
  let loopCount = 4 + floor(dayFraction * 22);
  let loops = [];
  for (let j = 0; j < loopCount; j++) {
    // each loop has its own fixed size, squash, tilt and offset, and turns slowly
    let rx = r * (0.45 + 0.55 * fract(sin(j * 12.9 + 1.7) * 4375.5));
    let ry = rx * (0.35 + 0.55 * fract(sin(j * 78.2 + 0.4) * 9123.1));
    let tilt = j * 2.39 + time * 0.04 * (j % 2 === 0 ? 1 : -1);
    let ox = r * 0.3 * (fract(sin(j * 3.7) * 1234.5) - 0.5);
    let oy = r * 0.3 * (fract(sin(j * 5.3) * 5432.1) - 0.5);
    let pts = [];
    for (let i = 0; i <= 48; i++) {
      let a = TWO_PI * i / 48;
      let wobble = 1 + 0.12 * (noise(j * 3.1, cos(a) + 1, sin(a) + 1) - 0.5);
      let lx = cos(a) * rx * wobble;
      let ly = sin(a) * ry * wobble;
      pts.push({
        x: cx + ox + lx * cos(tilt) - ly * sin(tilt),
        y: cy + oy + lx * sin(tilt) + ly * cos(tilt)
      });
    }
    loops.push(pts);
  }

  let ctx = drawingContext;
  push();
  noFill();
  for (let j = 0; j < loops.length; j++) {
    let col = color(CORD);
    if (j % 3 === 2) {
      ctx.setLineDash([2, 4]);   // every third loop dotted, like the cords' dotted strand
      col.setAlpha(230);
      strokeWeight(1.1);
    } else {
      col.setAlpha(j % 3 === 0 ? 255 : 190);
      strokeWeight(j % 3 === 0 ? 1.6 : 0.8);
    }
    stroke(col);
    drawPath(loops[j]);
    ctx.setLineDash([]);
  }
  pop();

  // clots where neighbouring loops cross
  for (let j = 0; j + 1 < loops.length; j += 2) {
    let hits = crossings(loops[j], loops[j + 1]);
    for (let hit of hits.slice(0, 3)) {
      drawClot(hit.x, hit.y, 2.5 + dayFraction * 2.5);
    }
  }
  // the heart of the knot
  drawClot(cx, cy, 4 + dayFraction * 7);
}

function drawPath(pts) {
  beginShape();
  for (let p of pts) {
    vertex(p.x, p.y);
  }
  endShape();
}

// A small knot of paint with inward-curving sides, like where soap bubbles meet.
// (Drawn with the browser's canvas commands, which make curves easily.)
function drawClot(x, y, r) {
  let ctx = drawingContext;
  let tip = r * 1.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.4);
  ctx.fillStyle = CORD;
  ctx.beginPath();
  ctx.moveTo(tip, 0);
  for (let i = 1; i <= 4; i++) {
    let a = i * HALF_PI;
    // curve to the next point, pulled in toward the middle so the sides bow inward
    ctx.quadraticCurveTo(0, 0, cos(a) * tip, sin(a) * tip);
  }
  ctx.closePath();
  ctx.fill();
  // a soft round heart so it reads as a clot, not a star
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

// Finds where two cords cross (checking every few points to stay fast)
function crossings(p, q) {
  let hits = [];
  let gap = 4;
  for (let i = 0; i + gap < p.length; i += gap) {
    let a = p[i], b = p[i + gap];
    for (let j = 0; j + gap < q.length; j += gap) {
      let c = q[j], d = q[j + gap];
      let den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      if (den === 0) {
        continue;
      }
      let t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
      let u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        hits.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    }
  }
  return hits;
}