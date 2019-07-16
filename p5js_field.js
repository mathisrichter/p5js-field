var sampling_points = 120;
var u;
var time_step = 25;
var tau = 500.0;
var resting_level = -50.0;
var noise_strength = 0.2;
var current_input = [];
var previous_input_sum = [];
var current_input_parameters;
var previous_input_parameters;
var kernel;
var selective_kernel;
var selective_kernel_visualization;
var multi_peak_kernel;
var multi_peak_kernel_visualization;
var working_memory_kernel;
var working_memory_kernel_visualization;
var global_inhibition_strength = 0.0;
var selective_global_inhibition = -20.5;
var working_memory_global_inhibition = -2.0;

var KernelStateEnum = Object.freeze({"selective":1, "multi_peak":2, "working_memory":3});
var show_help;

var base01_color = "#586e75";
var base00_color = "#657b83";
var base0_color = "#839496";
var yellow_color = "#b58900";
var orange_color = "#cb4b16";
var red_color = "#dc322f";
var blue_color = "#268bd2";
var cyan_color = "#2aa198";

var stroke_weight = 5;
var distance_per_sample;
var display_threshold_y;
var container_name = "DFTcontainer";
var button_selective;
var button_multi_peak;
var button_working_memory;
var button_help;
var kernel_name_display;
var canvas;


class KernelSelectorButton
{
  constructor(label, width, height)
  {
    this.label = label;
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.selected = false;
    this.hovered = false;
  }

  position(x, y)
  {
    this.x = x;
    this.y = y;
  }

  select(state)
  {
    this.selected = state;
  }

  hover(state)
  {
    this.hovered = state;
  }

  draw()
  {
    push();
    translate(this.x, this.y);

    if (this.selected)
    {
      fill(base01_color);
    }
    else
    {
      noFill();
    }

    if (this.hovered)
    {
      stroke(base0_color);
    }
    else
    {
      stroke(base01_color);
    }
    strokeWeight(stroke_weight);
    rect(0, 0, this.width, this.height);
    pop();
  }

  isMouseOver()
  {
    return mouseX > this.x && mouseX < this.x + this.width && mouseY > this.y && mouseY < this.y + this.height;
  }
}


class HelpButton
{
  constructor(radius)
  {
    this.x = 0;
    this.y = 0;
    this.radius = radius;
    this.hovered = false;
  }

  position(x, y)
  {
    this.x = x;
    this.y = y;
  }

  hover(state)
  {
    this.hovered = state;
  }

  isMouseOver()
  {
    return dist(mouseX, mouseY, this.x, this.y) < button_help.radius;
  }

  draw()
  {
    var color = base01_color;

    if (this.hovered)
    {
      color = base0_color;
    }

    push();

    translate(this.x, this.y);

    textAlign(LEFT, BOTTOM);
    noStroke();
    fill(color);
    text("?", 10 - this.radius, -1 + this.radius);

    stroke(color);
    noFill();
    ellipse(0, 0, this.radius * 2);
    pop();
  }
}


Array.prototype.SumArray = function (arr)
{
  var sum = [];
  if (arr != null && this.length == arr.length)
  {
    for (var i = 0; i < arr.length; i++)
    {
      sum.push(this[i] + arr[i]);
    }
  }

  return sum;
}


function setup()
{
  u = new Array(sampling_points);
  reinitializeActivation();

  current_input = new Array(sampling_points);
  current_input_parameters = new GaussianParameterSet(0.0, 0.0, 0.0);
  previous_input_sum = new Array(sampling_points);
  previous_input_parameters = new GaussianParameterSetManager();
  reinitializeInput();

  var kernel_size = 25;
  var kernel_center = floor(kernel_size/2);
  // selective kernel
  selective_kernel = gaussianArray(40.0, kernel_center, 3.0, kernel_size);
  selective_kernel_visualization = new Array(sampling_points).fill(selective_global_inhibition);
  {
    var i = floor(sampling_points/2) - floor(selective_kernel.length/2);
    for (var j = 0; j < selective_kernel.length; j++)
    {
      selective_kernel_visualization[i+j] += selective_kernel[j];
    }
  }

  // multi peak kernel
  var multi_peak_exc = gaussianArray(70.0, kernel_center, 6.0, kernel_size);
  var multi_peak_inh = gaussianArray(-50.0, kernel_center, 12.0, kernel_size);
  multi_peak_kernel = multi_peak_exc.SumArray(multi_peak_inh);
  multi_peak_kernel_visualization = new Array(sampling_points).fill(0);
  {
    var i = floor(sampling_points/2) - floor(multi_peak_kernel.length/2);
    for (var j = 0; j < multi_peak_kernel.length; j++)
    {
      multi_peak_kernel_visualization[i+j] = multi_peak_kernel[j];
    }
  }

  // working memory kernel
  var working_memory_exc = gaussianArray(130.0, kernel_center, 6.0, kernel_size);
  var working_memory_inh = gaussianArray(-90.0, kernel_center, 12.0, kernel_size);
  working_memory_kernel = working_memory_exc.SumArray(working_memory_inh);
  working_memory_kernel_visualization = new Array(sampling_points).fill(working_memory_global_inhibition);
  {
    var i = floor(sampling_points/2) - floor(working_memory_kernel.length/2);
    for (var j = 0; j < working_memory_kernel.length; j++)
    {
      working_memory_kernel_visualization[i+j] += working_memory_kernel[j];
    }
  }

  button_selective = new KernelSelectorButton("selective field", 30, 30);
  button_multi_peak = new KernelSelectorButton("multi-peak field", 30, 30);
  button_working_memory = new KernelSelectorButton("working memory field", 30, 30);

  // the selective kernel is the default
  button_selective.select(true);
  changeKernel(KernelStateEnum.selective);
  kernel_name_display = button_selective.label;

  button_help = new HelpButton(20);
  show_help = false;

  canvas = createCanvas(100, 100);
  canvas.parent(container_name);
  resize();
}


function resize()
{
  var container_width = document.getElementById(container_name).offsetWidth;
  var container_height = document.getElementById(container_name).offsetHeight;

  resizeCanvas(container_width, container_height);

  distance_per_sample = container_width / (sampling_points - 1);
  display_threshold_y = container_height / 2.0;
}


function draw()
{
  background("#002b36");
  textFont("Helvetica", 35);

  euler();

  noFill();
  strokeWeight(stroke_weight);

  // draw threshold --------------------------------------
  push();
  stroke(base01_color);
  translate(0, display_threshold_y);
  line(0, 0, width, 0);
  pop();

  // draw input ------------------------------------------
  push();
  stroke(yellow_color);
  translate(0, display_threshold_y);
  beginShape();
  for (let i = 0; i < u.length; i++)
  {
    vertex(distance_per_sample * i, -1.0 * (previous_input_sum[i] + current_input[i]));
  }
  endShape();

  if (show_help)
  {
    noStroke();
    fill(yellow_color);
    text("input", width - 100, -20);
  }

  pop();

  // draw activation -------------------------------------
  push();
  translate(0, display_threshold_y);
  stroke(orange_color);
  beginShape();
  for (let i = 0; i < u.length; i++)
  {
    vertex(distance_per_sample * i, -1.0 * u[i]);
  }
  endShape();

  if (show_help)
  {
    noStroke();
    fill(orange_color);
    text("activation", width - 170, 90);
  }
  pop();

  // draw kernel -----------------------------------------
  if (button_selective.hovered || button_multi_peak.hovered || button_working_memory.hovered)
  {
    push();
    translate(0, display_threshold_y);
    stroke(blue_color);
    beginShape();

    var visualization_data;
    if (button_selective.hovered)
    {
      visualization_data = selective_kernel_visualization;
    }
    else if (button_multi_peak.hovered)
    {
      visualization_data = multi_peak_kernel_visualization;
    }
    else
    {
      visualization_data = working_memory_kernel_visualization;
    }

    for (let i = 0; i < visualization_data.length; i++)
    {
      vertex(distance_per_sample * i, -1.0 * visualization_data[i]);
    }
    endShape();
    pop();
  }

  // draw resting level marker ---------------------------
  push();
  stroke(cyan_color);
  translate(0, display_threshold_y - resting_level);
  strokeWeight(2.0 * stroke_weight);
  line(0, 0, width/50., 0);

  if (show_help)
  {
    noStroke();
    fill(cyan_color);
    text("resting level", 40, 40);
  }

  pop();

  // draw manual -----------------------------------------
  if (show_help)
  {
    push();
    noStroke();
    fill(blue_color);

    var manual_text = "Control input with your mouse.\nClick to fix current input.\nScroll to change resting level.\nPress Escape to reset field.";

    text(manual_text, 20, 20, width - 50, height);

    pop();
  }

  // draw buttons ----------------------------------------
  var margin = 30;
  var separator = 10;
  button_working_memory.position(width - (button_working_memory.width + margin), height - button_working_memory.height - margin);
  button_working_memory.draw();

  button_multi_peak.position(button_working_memory.x - separator - button_multi_peak.width, height - button_multi_peak.height - margin);
  button_multi_peak.draw();

  button_selective.position(button_multi_peak.x - separator - button_selective.width, height - button_selective.height - margin);
  button_selective.draw();

  push();
  if (button_selective.hovered || button_multi_peak.hovered || button_working_memory.hovered)
  {
    fill(blue_color);
  }
  else
  {
    fill(base01_color);
  }
  textAlign(RIGHT, BOTTOM);
  text(kernel_name_display, button_selective.x - margin, height - margin + 4);
  pop();

  // draw help -------------------------------------------
  button_help.position(margin + button_help.radius, height - margin - button_help.radius);
  button_help.draw();
}


function mouseMoved()
{
  updateCurrentInput();

  // if mouse is over one of the buttons, mark it for hovering
  if (button_selective.isMouseOver())
  {
    button_selective.hover(true);
    button_multi_peak.hover(false);
    button_working_memory.hover(false);
    kernel_name_display = button_selective.label;
  }
  else if (button_multi_peak.isMouseOver())
  {
    button_selective.hover(false);
    button_multi_peak.hover(true);
    button_working_memory.hover(false);
    kernel_name_display = button_multi_peak.label;
  }
  else if (button_working_memory.isMouseOver())
  {
    button_selective.hover(false);
    button_multi_peak.hover(false);
    button_working_memory.hover(true);
    kernel_name_display = button_working_memory.label;
  }
  else
  {
    button_selective.hover(false);
    button_multi_peak.hover(false);
    button_working_memory.hover(false);

    if (button_selective.selected)
    {
      kernel_name_display = button_selective.label;
    }
    else if (button_multi_peak.selected)
    {
      kernel_name_display = button_multi_peak.label;
    }
    else if (button_working_memory.selected)
    {
      kernel_name_display = button_working_memory.label;
    }
  }

  if (button_help.isMouseOver())
  {
    button_help.hover(true);
    show_help = true;
  }
  else
  {
    button_help.hover(false);
    show_help = false;
  }
}

function mouseClicked()
{
  if (mouseY < display_threshold_y)
  {
    previous_input_sum = previous_input_sum.SumArray(current_input);
    previous_input_parameters.addParameterSetObj(current_input_parameters);
    updateCurrentInput();
  }

  if (button_selective.isMouseOver())
  {
    button_selective.select(true);
    button_multi_peak.select(false);
    button_working_memory.select(false);
    changeKernel(KernelStateEnum.selective);
  }
  else if (button_multi_peak.isMouseOver())
  {
    button_selective.select(false);
    button_multi_peak.select(true);
    button_working_memory.select(false);
    changeKernel(KernelStateEnum.multi_peak);
  }
  else if (button_working_memory.isMouseOver())
  {
    button_selective.select(false);
    button_multi_peak.select(false);
    button_working_memory.select(true);
    changeKernel(KernelStateEnum.working_memory);
  }
}


function mouseWheel(event)
{
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height)
  {
    resting_level += event.delta

    var padding = 10;
 
    if (resting_level > height/2. - padding)
    {
      resting_level = height/2. - padding;
    }
    else if (resting_level < -height/2. + padding)
    {
      resting_level = -height/2. + padding;
    }
    
    return false;
  }
  
  return true;
}


function keyPressed()
{
  if (keyCode == ESCAPE)
  {
    reinitializeInput();
    reinitializeActivation();
  }
}


function windowResized()
{
  resize();
}


function changeKernel(kernel_state)
{
  if (kernel_state == KernelStateEnum.selective)
  {
    kernel = selective_kernel;
    global_inhibition_strength = selective_global_inhibition;

  }
  else if (kernel_state == KernelStateEnum.multi_peak)
  {
    kernel = multi_peak_kernel;
    global_inhibition_strength = 0.0;
  }
  else if (kernel_state == KernelStateEnum.working_memory)
  {
    kernel = working_memory_kernel;
    global_inhibition_strength = working_memory_global_inhibition;
  }
}

function updateCurrentInput()
{
  var mousePosition = [constrain(mouseX, 0, width), constrain(mouseY, 0, height)];
  var amplitude = 0.0;
  if (mousePosition[0] > 0 && mousePosition[0] < width && mousePosition[1] < display_threshold_y && mousePosition[1] > 0)
  {
    var previous_input_sum = previous_input_parameters.computeSum(mousePosition[0]/distance_per_sample);
    amplitude = -1.0 * (mousePosition[1] - display_threshold_y) - previous_input_sum;

    if (amplitude < 0)
    {
      amplitude = 0;
    }
  }
  mu = mousePosition[0]/distance_per_sample;
  sigma = 8.0;
  current_input = gaussianArray(amplitude, mu, sigma, sampling_points);
  current_input_parameters.setParameters(amplitude, mu, sigma);
}

function euler()
{
  var global_inhibition = 0;
  for (var i = 0; i < u.length; i++)
  {
    global_inhibition += sigmoid(u[i]);
  }

  for (var i = 0; i < u.length; i++)
  {
    // compute lateral interaction
    var interaction = 0;
    for (var k = 0; k < kernel.length; k++)
    {
      neighbor_index = i + k - (Math.floor(kernel.length / 2.0));
      if (neighbor_index < 0 || neighbor_index >= u.length)
      {
        interaction_contribution = 0;
      }
      else
      {
        interaction_contribution = kernel[k] * sigmoid(u[neighbor_index]);
      }

      interaction += interaction_contribution;
    }

    var du = -u[i] + resting_level + current_input[i] + previous_input_sum[i] + interaction + global_inhibition_strength * global_inhibition;
    u[i] = u[i] + (time_step / tau) * du + Math.sqrt(time_step) * noise_strength * getRandom(-1, 1);
  }
}

class GaussianParameterSet
{
  constructor(amplitude, mu, sigma)
  {
    this.amplitude = amplitude;
    this.mu = mu;
    this.sigma = sigma;
  }

  setParameters(amplitude, mu, sigma)
  {
    this.amplitude = amplitude;
    this.mu = mu;
    this.sigma = sigma;
  }

  clear()
  {
    this.amplitude = 0;
    this.mu = 0;
    this.sigma = 0;
  }
}

class GaussianParameterSetManager
{
  constructor()
  {
    this.parameter_sets = [];
  }

  length()
  {
    return this.parameter_sets.length;
  }

  addParameterSet(amplitude, mu, sigma)
  {
    var set = new GaussianParameterSet(amplitude, mu, sigma);
    this.parameter_sets.push(set);
  }

  addParameterSetObj(set)
  {
    var set_copy = new GaussianParameterSet(set.amplitude, set.mu, set.sigma);
    this.parameter_sets.push(set_copy);
  }

  computeSum(position)
  {
    var sum = 0.0;

    for (var i = 0; i < this.parameter_sets.length; i++)
    {
      var item = this.parameter_sets[i];
      sum += gaussian(item.amplitude, item.mu, item.sigma, position);
    }

    return sum;
  }

  clear()
  {
    this.parameter_sets = [];
  }
}

function gaussianArray(amplitude, mu, sigma, size)
{
  var gaussian_values = new Array(size);

  for (var i = 0; i < gaussian_values.length; i++)
  {
    gaussian_values[i] = gaussian(amplitude, mu, sigma, i);
  }

  return gaussian_values;
}

function gaussian(amplitude, mu, sigma, position)
{
  return amplitude * Math.exp(-(Math.pow(position - mu, 2)) / (2 * sigma)); 
}

function sigmoid(x)
{
  return 1.0 / (1 + Math.exp(-1.0 * x));
}

function getRandom(min, max)
{
  return Math.random() * (max - min) + min;
}

function reinitializeInput()
{
  current_input.fill(0);
  current_input_parameters.clear();
  previous_input_sum.fill(0);
  previous_input_parameters.clear();
}

function reinitializeActivation()
{
  u.fill(resting_level);
}
