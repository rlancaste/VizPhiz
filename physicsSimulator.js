/**
    PhysicsSimulator.js,  part of the VizPhiz Simulator
    Copyright (C) 2020 Robert Lancaster <rlancaste@gmail.com>
    This script is free software; you can redistribute it and/or
    modify it under the terms of the GNU General Public
    License as published by the Free Software Foundation; either
    version 3 of the License, or (at your option) any later version.
**/

/*eslint-env browser*/
/*jslint devel: true */
/* global Matter Chart */
/*eslint curly: ["error", "multi"]*/

var graphWindows = [];
var fixedBodies = [];
var forces = [];

var initialObjectStates = [];
var trackingStates = [];

var timeText = document.getElementById("timeText");

var timeSlider = document.getElementById('slider');
var timeForward = document.getElementById('btn-forward');
var timeBackward = document.getElementById('btn-backward');
var saveButton = document.getElementById('btn-save');
var loadButton = document.getElementById('btn-load');
var aboutButton = document.getElementById('btn-info');
var about = document.getElementById('about');
var mainToolbar = document.getElementById('mainToolbar');
var editToolbar = document.getElementById('editToolbar');


var bodyEditor = document.getElementById("objectEditor");
var bodyName = document.getElementById("title");
var bodyDetails = document.getElementById("objectDetails");

var vizPhizOptions = {
    showLabels: false,
    showGrid: false,
    trackingON: true,
    trackingFrameRate: 3,
    velocityVectorScale: 1,
    velocityVectorColor: "yellow",
    forceVectorScale: 2,
    forceVectorColor: "green",
    numDecimals: 3,
    xCoordFlip: false,
    yCoordFlip: false,
    advancedCalculationOptions: false,
    followObject: "",
    followPadding: 100,
    useDegrees: true
}

var time = 0.0;

var running = false;
var editing = true;
var reset = true;

var currentBody = null;
var currentConstraint = null;
var currentConstraintPoint = null;
var currentForce = null;
var currentGraph = null;

var whichPoint = 0;
var draggingBody = false;
var draggingWorld = false;
var draggingVelocity = false;
var measuringWorld = false;

//Variables for drawing objects
var mouseType = -1;
var newObject = false;
var newX = 0;
var newY = 0;
var newW = 0;
var newH = 0;

var numberOfSides = 0;

var runButton = document.getElementById("btn-run");
var resetButton = document.getElementById("btn-reset");
var editButton = document.getElementById("btn-edit");
var fullButton = document.getElementById("btn-fullscreen");
var graphButton = document.getElementById("btn-makeGraph");
var showObjectDetails = document.getElementById("btn-showObjectDetails");

//These act like an enum for the newButtons array
var moveMouse = 0;
var boxMouse = 1;
var circleMouse = 2;
var polyMouse = 3;
var compMouse = 4;
var carMouse = 5;
var conMouse = 6;
var jointMouse = 7;
var forceMouse = 8;
var measureMouse = 9;

var newButtons = [];
newButtons.push(document.getElementById("btn-move"));
newButtons.push(document.getElementById("btn-box"));
newButtons.push(document.getElementById("btn-circle"));
newButtons.push(document.getElementById("btn-polygon"));
newButtons.push(document.getElementById("btn-comp"));
newButtons.push(document.getElementById("btn-car"));
newButtons.push(document.getElementById("btn-con"));
newButtons.push(document.getElementById("btn-joint"));
newButtons.push(document.getElementById("btn-force"));
newButtons.push(document.getElementById("btn-measure"));

for (var num = 0; num < newButtons.length; num+= 1)
	newButtons[num].addEventListener('click', function(event) {
		var newType = -2;
		for (var i = 0; i < newButtons.length; i+= 1) {
			newButtons[i].style.background = 'rgba(0,0,0,0.1)';
			if (newButtons[i] === event.currentTarget) // May need more checks for other browsers
				newType = i;
		}
		if (newType === mouseType)
			mouseType = -1;
		else{
			newButtons[newType].style.background = "green";
			mouseType = newType;
			
			if (mouseType === polyMouse)
				numberOfSides = prompt("How many sides should the polygon have?", 3);
		}
	});

// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    World = Matter.World,
    Vector = Matter.Vector,
    Bodies = Matter.Bodies,
    Composites = Matter.Composites,
    Bounds = Matter.Bounds,
    Events = Matter.Events,
    MouseConstraint = Matter.MouseConstraint,
    Mouse = Matter.Mouse;

// create an engine
var engine = Engine.create(),
	world = engine.world;

// create a renderer
	var render = Render.create({
        element: document.body,
        engine: engine,
        options: {
            width: window.innerWidth,
            height: window.innerHeight,
            hasBounds: true,
            wireframes: false,
            showAngleIndicator: true,
            showVelocity: true,
            showIds: false
        }
    });

var pen = render.context;

Matter.Resolver._restingThresh = 0.001;

// create ground
var ground = Bodies.rectangle(window.innerWidth / 2, window.innerHeight - 30, window.innerWidth, 60);
ground.isStatic = true;
ground.label = "Ground";
initialObjectStates.push(new createSavedState(ground.id, 0, ground.position.x, ground.position.y, ground.velocity.x, ground.velocity.y, 0, 0, ground.vertices));
trackingStates.push(new createTrackingState(ground.id));
fixedBodies.push(ground);
World.add(engine.world, ground);

//Engine.run(engine);
var runner = Runner.create();
runner.isFixed = true;
runner.delta = 100;
Runner.run(runner, engine);

world.gravity.scale = 1 / 1000000.0 ;
world.gravity.y = 9.8;

// run the renderer
Render.run(render);


//add mouse control
var mouse = Mouse.create(render.canvas),
    mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: {
                visible: false
            }
        }
    });

World.add(world, mouseConstraint);

// keep the mouse in sync with rendering
render.mouse = mouse;


// create the origin
var origin = Bodies.circle(20, window.innerHeight - 60, 15, 15);
origin.render.fillStyle = "yellow";
origin.isStatic = true;
origin.frictionAir = 0;
origin.label = "Origin";
World.add(world, origin);
initialObjectStates.push(new createSavedState(origin.id, 0, origin.position.x, origin.position.y, origin.velocity.x, origin.velocity.y, 0, 0, origin.vertices));
trackingStates.push(new createTrackingState(origin.id));
fixedBodies.push(origin);

//Giving Math the ability to convert to Radians
Math.toRadians = function(degrees) {
	return degrees * Math.PI / 180;
}

//Giving Math the ability to convert to Degrees
Math.toDegrees = function(radians) {
	return radians * 180 / Math.PI;
}


function GridPosVectorToMatter(p){
   var p1 = Matter.Vector.rotate(p, -origin.angle);
    if(vizPhizOptions.xCoordFlip)
        p1.x = -p1.x; 
    if(! vizPhizOptions.yCoordFlip)
        p1.y = -p1.y; //Note that Y is naturally flipped
     var p2 = Matter.Vector.add(p1, origin.position);
    return p2;
}

function GridVectorToMatter(v){
    var v1 = Matter.Vector.rotate(v, -origin.angle);
    if(vizPhizOptions.xCoordFlip)
        v1.x = -v1.x; 
    if(! vizPhizOptions.yCoordFlip)
        v1.y = -v1.y; //Note that Y is naturally flipped
    return v1;
}

function PosVectorToMatter(p){
   var p1 = Matter.Vector.rotate(p, origin.angle);
    if(vizPhizOptions.xCoordFlip)
        p1.x = -p1.x; 
    if(! vizPhizOptions.yCoordFlip)
        p1.y = -p1.y; //Note that Y is naturally flipped
     var p2 = Matter.Vector.add(p1, origin.position);
    return p2;
}

function PosVectorFromMatter(p){
    var p1 = Matter.Vector.sub(p, origin.position);
    var p2 = Matter.Vector.rotate(p1, -origin.angle);
    if(vizPhizOptions.xCoordFlip)
        p2.x = -p2.x; 
    if(! vizPhizOptions.yCoordFlip)
        p2.y = -p2.y; //Note that Y is naturally flipped
    return p2;
}

function VectorToMatter(v){
    var v1 = Matter.Vector.rotate(v, origin.angle);
    if(vizPhizOptions.xCoordFlip)
        v1.x = -v1.x; 
    if(! vizPhizOptions.yCoordFlip)
        v1.y = -v1.y; //Note that Y is naturally flipped
    return v1;
}

function VectorFromMatter(v){
    var v2 = Matter.Vector.rotate(v, -origin.angle);
    if(vizPhizOptions.xCoordFlip)
        v2.x = -v2.x; 
    if(! vizPhizOptions.yCoordFlip)
        v2.y = -v2.y; //Note that Y is naturally flipped
    return v2;
}

function convertToMatterVelocity(v){
    v = VectorToMatter(v);
    v = convertToMatterTimeScale(v);
    return v;
}

function convertFromMatterVelocity(v){
    v = VectorFromMatter(v);
    v = convertFromMatterTimeScale(v);
    return v;
}

function convertToMatterTimeScale(v){
    return Vector.mult(v, (runner.delta / 1000.0));
}

function convertFromMatterTimeScale(v){
    return Vector.div(v, runner.delta / 1000.0);
}

function convertScalarToMatterTimeScale(s){
    return s * (runner.delta / 1000.0);
}

function convertScalarFromMatterTimeScale(s){
    return s / (runner.delta / 1000.0);
}

function PosAngleToMatter(angle){
    if((!vizPhizOptions.xCoordFlip && !vizPhizOptions.yCoordFlip) || (vizPhizOptions.xCoordFlip && vizPhizOptions.yCoordFlip))
         angle = -angle;
    angle += origin.angle;
    return angle;
}

function PosAngleFromMatter(angle){
    angle -= origin.angle;
    if((!vizPhizOptions.xCoordFlip && !vizPhizOptions.yCoordFlip) || (vizPhizOptions.xCoordFlip && vizPhizOptions.yCoordFlip))
         angle = -angle;
    return angle;
}

function AngleToMatter(angle){
    if((!vizPhizOptions.xCoordFlip && !vizPhizOptions.yCoordFlip) || (vizPhizOptions.xCoordFlip && vizPhizOptions.yCoordFlip))
         angle = -angle;
    return angle;
}

function AngleFromMatter(angle){
    if((!vizPhizOptions.xCoordFlip && !vizPhizOptions.yCoordFlip) || (vizPhizOptions.xCoordFlip && vizPhizOptions.yCoordFlip))
         angle = -angle;
    return angle;
}

function AngVToMatter(angle){
    if((!vizPhizOptions.xCoordFlip && !vizPhizOptions.yCoordFlip) || (vizPhizOptions.xCoordFlip && vizPhizOptions.yCoordFlip))
         angle = -angle;
    angle = convertScalarToMatterTimeScale(angle);
    return angle;
}

function AngVFromMatter(angle){
    if((!vizPhizOptions.xCoordFlip && !vizPhizOptions.yCoordFlip) || (vizPhizOptions.xCoordFlip && vizPhizOptions.yCoordFlip))
         angle = -angle;
    angle = convertScalarFromMatterTimeScale(angle);
    return angle;
}


function roundOffDecimals(number){
    return Math.round(number * Math.pow(10, vizPhizOptions.numDecimals))/Math.pow(10, vizPhizOptions.numDecimals);
}


var colorNum = 0;
var numOfColors = 10;
var colorInc = 360 / (numOfColors - 1);

function DataSet(label, units) {
	this.label = label;
	this.borderColor = "black";
	this.backgroundColor =  "hsla(" + colorNum * colorInc + ", 100%, 50%, 60%)";
    colorNum += 1;
    this.units = units;
	this.data = [];
}

function resetDataSets() {
    var datasets = [];
	currentGraph.graph.data.datasets = datasets;
    colorNum = 4;
	if (currentGraph.options.graphX)
        datasets.push(new DataSet('X', 'm'));
	if (currentGraph.options.graphY)
		datasets.push(new DataSet('Y', 'm'));
    if (currentGraph.options.graphdX)
        datasets.push(new DataSet('\u0394 X', 'm'));
	if (currentGraph.options.graphdY)
		datasets.push(new DataSet('\u0394 Y', 'm'));
	if (currentGraph.options.graphVx)
		datasets.push(new DataSet('Vx', 'm/s'));
	if (currentGraph.options.graphVy)
		datasets.push(new DataSet('Vy', 'm/s'));
    if (currentGraph.options.graphV)
		datasets.push(new DataSet('|V|', 'm/s'));
     if (currentGraph.options.graphAx)
		datasets.push(new DataSet('Ax', 'm/s/s'));
     if (currentGraph.options.graphAy)
		datasets.push(new DataSet('Ay', 'm/s/s'));
     if (currentGraph.options.graphA)
		datasets.push(new DataSet('|A|', 'm/s/s'));
     if(vizPhizOptions.useDegrees){
         if (currentGraph.options.graphTheta)
            datasets.push(new DataSet('\u03B8', 'deg'));
         if (currentGraph.options.graphOmega)
            datasets.push(new DataSet('\u03C9', 'deg/s'));
     } else{
         if (currentGraph.options.graphTheta)
            datasets.push(new DataSet('\u03B8', 'rad'));
         if (currentGraph.options.graphOmega)
            datasets.push(new DataSet('\u03C9', 'rad/s'));
     }
     if (currentGraph.options.graphPx)
		datasets.push(new DataSet('px', 'kg*m/s'));
     if (currentGraph.options.graphPy)
		datasets.push(new DataSet('py', 'kg*m/s'));
     if (currentGraph.options.graphP)
		datasets.push(new DataSet('|p|', 'kg*m/s'));
    
    var yAxisTitle = "";
    if(currentGraph.options.graphX || currentGraph.options.graphY)
        yAxisTitle += "Position (m) ";
    if(currentGraph.options.graphdX || currentGraph.options.graphdY)
        yAxisTitle += "Displacement (m) ";
    if(currentGraph.options.graphVx || currentGraph.options.graphVy || currentGraph.options.graphV)
        yAxisTitle += "Velocity (m/s) ";
    if(currentGraph.options.graphAx || currentGraph.options.graphAy || currentGraph.options.graphA)
        yAxisTitle += "Acceleration (m/s/s) ";
    if(vizPhizOptions.useDegrees){
         if (currentGraph.options.graphTheta)
            yAxisTitle += "Angular Position (deg) ";
         if (currentGraph.options.graphOmega)
            yAxisTitle += "Angular Velocity (deg/s) ";
    } else{
         if (currentGraph.options.graphTheta)
            yAxisTitle += "Angular Position (rad) ";
         if (currentGraph.options.graphOmega)
            yAxisTitle += "Angular Velocity (rad/s) ";
    }
    if(currentGraph.options.graphPx || currentGraph.options.graphPy || currentGraph.options.graphP)
        yAxisTitle += "Momentum (kg*m/s) ";
    
    currentGraph.graph.options.scales.yAxes[0].scaleLabel.labelString = yAxisTitle;
    currentGraph.graph.update();
}

function getBody(id, bodies){
    for (var i=0; i<bodies.length; i += 1)
		if(bodies[i].id === id)
            return bodies[i];
    return null;
}

function Force(body, x, y, fx, fy, tstart, tend){
    this.bodyID = body.id;
    this.position = Matter.Vector.create(x, y);
    this.force = Matter.Vector.create(fx, fy);
    this.tstart = tstart;
    this.tend = tend;
}

function mouseNearPoint(mousePosition, point){
    if(mousePosition.x > point.x - 5 && mousePosition.x < point.x + 5)
        if(mousePosition.y > point.y - 5 && mousePosition.y < point.y + 5)
            return true;
    return false;
    
}

function getPointALocation(constraint){
    var point = {x:0,y:0};
    if(constraint.bodyA){
        point.x = constraint.bodyA.position.x + constraint.pointA.x;
        point.y = constraint.bodyA.position.y + constraint.pointA.y;
    } else
        point = constraint.pointA;
    return point;
}

function getPointBLocation(constraint){
    var point = {x:0,y:0};
    if(constraint.bodyB){
        point.x = constraint.bodyB.position.x + constraint.pointB.x;
        point.y = constraint.bodyB.position.y + constraint.pointB.y;
    } else
        point = constraint.pointB;
    return point;
}

function setConstraintPointLocation(point){
    if(whichPoint == 1)
        if(currentConstraint.bodyA){
            currentConstraint.pointA.x = point.x - currentConstraint.bodyA.position.x;
            currentConstraint.pointA.y = point.y - currentConstraint.bodyA.position.y;
            currentConstraintPoint.x = point.x;
            currentConstraintPoint.y = point.y;
        }
        else {
            currentConstraint.pointA.x = point.x;
            currentConstraint.pointA.y = point.y;
        }
    else if(whichPoint == 2)
        if(currentConstraint.bodyB){
            currentConstraint.pointB.x = point.x - currentConstraint.bodyB.position.x;
            currentConstraint.pointB.y = point.y - currentConstraint.bodyB.position.y;
            currentConstraintPoint.x = point.x;
            currentConstraintPoint.y = point.y;
        }
        else {
            currentConstraint.pointB.x = point.x;
            currentConstraint.pointB.y = point.y;
        }  
}

function getClickedConstraintPoint(mousePosition, constraint){
    var pointA = getPointALocation(constraint);
    var pointB = getPointBLocation(constraint);
    if(mouseNearPoint(mousePosition, pointA)){
        whichPoint = 1;
        return pointA;
    } else if(mouseNearPoint(mousePosition, pointB)){
        whichPoint = 2;
        return pointB;
    } else{
        whichPoint = 0;
        return null;
    }
}

function plotData(graphWindow) {
	var set = 0,
	datasets = graphWindow.graph.data.datasets,
	body = getBody(graphWindow.options.bodyID, Matter.Composite.allBodies(world)),
	t = roundOffDecimals(time);
    
    if(body === null)
        return;

    if (graphWindow.options.graphX || graphWindow.options.graphY){
        var displayPos = PosVectorFromMatter(body.position);
        if (graphWindow.options.graphX) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayPos.x)});
            set += 1;
        }
        if (graphWindow.options.graphY) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayPos.y)});
            set += 1;
        }
    }
    if (graphWindow.options.graphdX || graphWindow.options.graphdY){
        var state = getInitialState(body.id);
        var displayDisp = Matter.Vector.sub(PosVectorFromMatter(body.position), PosVectorFromMatter(Matter.Vector.create(state.x, state.y)));
    
        if (graphWindow.options.graphdX) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayDisp.x)});
            set += 1;
        }
        if (graphWindow.options.graphdY) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayDisp.y)});
            set += 1;
        }
    }
    if (graphWindow.options.graphTheta){
        var display = PosAngleFromMatter(body.angle);
        if(vizPhizOptions.useDegrees)
            display = Math.toDegrees(display);
        datasets[set].data.push({x: t, y: roundOffDecimals(display)});
        set += 1;
    }
    if (graphWindow.options.graphOmega){
        var display = AngVFromMatter(body.angularVelocity);
        if(vizPhizOptions.useDegrees)
            display = Math.toDegrees(display);
        datasets[set].data.push({x: t, y: roundOffDecimals(display)});
        set += 1;
    }
    if (graphWindow.options.graphVx || graphWindow.options.graphVy || graphWindow.options.graphV){
        var displayVel = convertFromMatterVelocity(body.velocity);
        if (graphWindow.options.graphVx) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayVel.x)});
            set += 1;
        }
        if (graphWindow.options.graphVy) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayVel.y)});
            set += 1;
        }
        if (graphWindow.options.graphV) {
            datasets[set].data.push({x: t, y: roundOffDecimals(Math.hypot(displayVel.x,displayVel.y))});
            set += 1;
        }
    }
    if (graphWindow.options.graphAx || graphWindow.options.graphAy || graphWindow.options.graphA){
        
        if(t === 0)
            var previousVelocity = body.velocity;
        else{
            var state = getSavedObjectState(body.id, timeSlider.value - 1);
            var previousVelocity = Matter.Vector.create(state.Vx, state.Vy);
        }
        
        var deltaV = Matter.Vector.sub(convertFromMatterVelocity(body.velocity), convertFromMatterVelocity(previousVelocity));
        var displayAccel = Matter.Vector.div(deltaV, runner.delta / 1000);
        
        if (graphWindow.options.graphAx) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayAccel.x)});
            set += 1;
        }
        if (graphWindow.options.graphAy) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayAccel.y)});
            set += 1;
        }
        if (graphWindow.options.graphA) {
            datasets[set].data.push({x: t, y: roundOffDecimals(Math.hypot(displayAccel.x,displayAccel.y))});
            set += 1;
        }
    }
    if (graphWindow.options.graphPx || graphWindow.options.graphPy || graphWindow.options.graphP){
        var displayMom = Matter.Vector.mult(convertFromMatterVelocity(body.velocity), body.mass);
        if (graphWindow.options.graphPx) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayMom.x)});
            set += 1;
        }
        if (graphWindow.options.graphPy) {
            datasets[set].data.push({x: t, y: roundOffDecimals(displayMom.y)});
            set += 1;
        }
        if (graphWindow.options.graphP) {
            datasets[set].data.push({x: t, y: roundOffDecimals(Math.hypot(displayMom.x,displayMom.y))});
            set += 1;
        }
    }
    
	graphWindow.graph.options.annotation.annotations[0].value = t;
    graphWindow.graph.options.annotation.annotations[0].label.content = "time: " + t;
	graphWindow.graph.update();
    
}

function GraphOptions(bodyID){
    this.bodyID = bodyID;
    this.graphX = true;
    this.graphY = true;
    this.graphdX = false;
    this.graphdY = false;
    this.graphVx = false;
    this.graphVy = false;
    this.graphV = false;
    this.graphAx = false;
    this.graphAy = false;
    this.graphA = false;
    this.graphTheta = false;
    this.graphOmega = false;
    this.graphPx = false;
    this.graphPy = false;
    this.graphP = false;
}

function GraphWindow(bodyID) {
    this.myChart = document.createElement("div");
    var myChartHeader = document.createElement("div"),
    myChartTitle = document.createElement("div"),
    closeButton = document.createElement("button"),
    floatClear = document.createElement("div"),
    chartCanvas = document.createElement("canvas"),
    ctx = chartCanvas.getContext('2d');
    
	var self = this;
	
    this.options = new GraphOptions(bodyID);
    
	this.myChart.style.display = "block";
	this.myChart.className = "graphView";
	this.myChart.style.left = 300 + "px";
	this.myChart.style.top = 300 + "px";
	this.myChart.style.zIndex = 15;
    
    myChartHeader.id = "graphViewheader";
    myChartHeader.zIndex = 16;
    this.myChart.appendChild(myChartHeader);
    
    myChartTitle.innerHTML = "Object: " + bodyID;
    myChartTitle.style.float = "left";
    myChartHeader.appendChild(myChartTitle);
    
    var editGraph = document.createElement("button");
	editGraph.innerHTML = "Options";
    myChartHeader.appendChild(editGraph);
    editGraph.addEventListener('click', function() {
        if(running)
            return;
        if( !reset ){
            alert("Please hit the reset button before trying to edit properties.");
            return;
        }
        currentGraph = self;
        loadGraphDetails();
        bodyEditor.style.left = event.clientX + "px";
        bodyEditor.style.top = event.clientY + "px";
        bodyEditor.style.display = "block";
    });
    
	var exportData = document.createElement("button");
	exportData.innerHTML = "Export Data";
	myChartHeader.appendChild(exportData);
	
	exportData.addEventListener('click', function() {
		var numSets = self.graph.data.datasets.length;
		if (numSets < 1)
			return;
		var csvContent = "time (s)";
        self.graph.data.datasets.forEach(function(dataset) {
            csvContent += ", " + dataset.label + " (" + dataset.units + ")";
        });

		var dataSet0 = self.graph.data.datasets[0];
		var numPoints = dataSet0.data.length;
		for (var t = 0;  t < numPoints; t+= 1)
		{
			var row = "\r\n" + dataSet0.data[t].x;
			self.graph.data.datasets.forEach(function(dataset) {
				var point = dataset.data[t];
				row += "," + point.y;
			});
			csvContent += row;
		}
        download(csvContent, "GraphData.csv");
	});
	
	closeButton.style.color = "red";
	closeButton.innerHTML = "X";
    closeButton.style.float = "right";
	closeButton.addEventListener('click', function () {
		for (var i =0; i<graphWindows.length; i += 1)
			if (self === graphWindows[i]) {
				graphWindows.splice(i,1);
				self.myChart.style.display = "none";
			}
	});
	myChartHeader.appendChild(closeButton);
    
    
	floatClear.style.clear = "both";
	myChartHeader.appendChild(floatClear);
	
	
	chartCanvas.style.width = 500 + "px";
	chartCanvas.style.height = 250 + "px";
	this.myChart.appendChild(chartCanvas);
    
    this.myChart.addEventListener('mousedown', function () {
        if (bodyEditor.style.display === "block"){
            currentGraph = self;
            loadGraphDetails();
        }
    });
    
    this.myChart.addEventListener('touchstart', function () {
        if (bodyEditor.style.display === "block"){
            currentGraph = self;
            loadGraphDetails();
        }
    });
    
    this.myChart.addEventListener('dblclick', function (event) {
        event.stopPropagation();
        if(running)
            return;
        if( !reset ){
            alert("Please hit the reset button before trying to edit properties.");
            return;
        }
        measuringWorld = false;
        if(!editing)
            editButton.click();
        if (mouseType != moveMouse)
            newButtons[0].click();
        currentGraph = self;
        bodyDetails.style.width = "100%";
        bodyEditor.style.textAlign = "left";
        bodyEditor.style.left = event.clientX + "px";
        bodyEditor.style.top = event.clientY + "px";
        bodyEditor.style.display = "block";
        
        
        loadGraphDetails();
    });
	
	this.graph = Chart.Scatter(ctx, {
		data: {datasets:[]},
		options: {
			title: {
				display: false,
				text:"Object: " + bodyID
			},
            scales: {
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: "time (s)"
                    }
                }],
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: "Position"
                    }
                }]
            },
            tooltips: {
                callbacks: {
                    label: function(tooltipItem, data) {
                        var dataset = data.datasets[tooltipItem.datasetIndex];
                        return "" + dataset.label + ": " + Number(tooltipItem.yLabel) + " (" + dataset.units + ")";
                    }
                }
            },
			annotation: {
				annotations: [{
					type: 'line',
					mode: 'vertical',
					scaleID: 'x-axis-1',
					value: 0,
					borderColor: 'rgba(255, 0, 0, 0.3)',
					borderWidth: 4,
					label: {
						enabled: true,
						content: 'time',
                        position: "bottom",
						rotation: 90
					}
                }]
			} 
		}
	});
    
	window.document.body.appendChild(this.myChart);
	dragElement(this.myChart);
}

function createSavedState(id, t, x, y, Vx, Vy, theta, omega, vertices) {
    this.id = id;
    this.t = t;
    this.x = x;
    this.y = y;
    this.Vx = Vx;
    this.Vy = Vy;
    this.theta = theta;
    this.omega = omega;
    this.vertices = copyVertices(vertices);
}

function copyVertices(vertices) {
	var newVertices = [];
	for (var v = 0; v < vertices.length; v+= 1)
		newVertices.push(Matter.Vector.clone(vertices[v]));
	return newVertices;
}

function getInitialState(id) {
	for (var i=0;i<initialObjectStates.length;i+= 1)
	{
		var state = initialObjectStates[i];
		if (state.id === id)
			return state;
	}
	return null;
}

function deleteInitialState(id) {
	for (var i=0;i<initialObjectStates.length;i+= 1)
	{
		var state = initialObjectStates[i];
		if (state.id === id)
            initialObjectStates.splice(i,1);
	}
}

function createTrackingState(id) {
    this.id= id;
    this.savedObjectStates = [];
}

function getTrackingState(id) {
	for (var i=0;i<trackingStates.length;i+= 1)
	{
		var state = trackingStates[i];
		if (state.id === id)
            return state;
	}
	return null;
}

function clearSavedStatesAfterFrame(fr)
{
	for (var i=0;i<trackingStates.length;i+= 1)
	{
		var trackState = trackingStates[i];
		trackState.savedObjectStates.length = fr;
	}
}

function clearGraphDataAfterFrame(fr)
{
    graphWindows.forEach(function(graphWindow){
		var datasets = graphWindow.graph.data.datasets;
		if (datasets != null)
			for (var s =0; s<datasets.length; s += 1)
				datasets[s].data.length = fr;
		graphWindow.graph.update();
	});
}

function saveObjectState(id, savedObjectState) {
	var trackingState = getTrackingState(id);
	if (trackingState === null)
		return;
	trackingState.savedObjectStates.push(savedObjectState);
}

function getSavedObjectState(id, fr) {
	var trackingState = getTrackingState(id);
	if (trackingState === null)
		return;
	
	var savedState = trackingState.savedObjectStates[fr];
	return  savedState;
}


dragElement(bodyEditor);

function updateConstraintReferenceAngles(){
    var constraints = Matter.Composite.allConstraints(world);
    constraints.forEach(function(constraint){
        var bodyA = constraint.bodyA,
            bodyB = constraint.bodyB,
            pointA = constraint.pointA,
            pointB = constraint.pointB;
        
        if (bodyA && !isFixed(bodyA)) {
            Vector.rotate(pointA, bodyA.angle - constraint.angleA, pointA);
            constraint.angleA = bodyA.angle;
        }
        
        if (bodyB && !isFixed(bodyB)) {
            Vector.rotate(pointB, bodyB.angle - constraint.angleB, pointB);
            constraint.angleB = bodyB.angle;
        }

    });
}

function getMousePos(evt) {
	var rect = render.canvas.getBoundingClientRect();
	return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
	};
}

function dragElement(elmnt) {
    var x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    var touch = false;
    var header = document.getElementById(elmnt.id + "header");
    if (header){
        header.onmousedown = dragDown;
        header.ontouchstart = touchDown;
    }else{
        elmnt.onmousedown = dragDown;
        elmnt.ontouchstart = touchDown;
    }
    
    function touchDown(e) {
        touch = true;
        dragDown(e);
    }

    function dragDown(e) {
        e = e || window.event;
        //e.preventDefault();
        if(touch){
            x2 = e.touches[0].clientX;
            y2 = e.touches[0].clientY;
            document.ontouchend = closeDragElement;
            document.ontouchmove = elementDrag;
        } else{
            x2 = e.clientX;
            y2 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }   
    }

    function elementDrag(e) {
        e = e || window.event;
        //e.preventDefault();
        // calculate the new cursor position:
        var x,y;
          if(touch){
              x = e.touches[0].clientX;
              y = e.touches[0].clientY;
          }else{
              x = e.clientX;
              y = e.clientY;
          }
        x1 = x2 - x;
        y1 = y2 - y;
        x2 = x;
        y2 = y;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - y1) + "px";
        elmnt.style.left = (elmnt.offsetLeft - x1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchmove = null;
        document.ontouchend  = null;
        touch = false;
    }
}

function isFixed(body)
{
	for (var i =0; i<fixedBodies.length; i += 1)
		if (fixedBodies[i] === body)
			return true;
	return false;
}

showObjectDetails.addEventListener('click', function() {
    if(!reset){
        alert("Please hit reset before trying to edit.");
        return;
    }
    if(currentBody !== null){
        bodyEditor.style.left = currentBody.position.x + "px";
        bodyEditor.style.top = currentBody.position.y + "px";
        bodyEditor.style.display = "block";
        loadBodyDetails(currentBody);
    } else if(currentConstraintPoint !== null && currentConstraint !== null){
        bodyEditor.style.left = currentConstraintPoint.x + "px";
        bodyEditor.style.top = currentConstraintPoint.y + "px";
        bodyEditor.style.display = "block";
        loadConstraintDetails(currentConstraint);
    } else if(currentForce !== null){
        var body = getBody(currentForce.bodyID, Matter.Composite.allBodies(world));
        bodyEditor.style.left = currentForce.position.x + body.position.x + "px";
        bodyEditor.style.top = currentForce.position.y + body.position.y + "px";
        bodyEditor.style.display = "block";
        loadForceDetails(currentForce);
    } else{
        bodyEditor.style.left = "400px";
        bodyEditor.style.top = "200px";
        bodyEditor.style.display = "block";
        loadWorldDetails();
    }
});

saveButton.addEventListener('click', function() {
    if(!reset){
        alert("Please hit reset before saving the simulation");
        return;
    }
    
    //Storing some important variables
    vizPhizOptions.gravity = world.gravity;
    vizPhizOptions.background = render.options.background;
    vizPhizOptions.delta = runner.delta;
    vizPhizOptions.positionIterations = engine.positionIterations;
    vizPhizOptions.velocityIterations = engine.velocityIterations;
    vizPhizOptions.constraintIterations = engine.constraintIterations;
    vizPhizOptions.wireframes = render.options.wireframes;
    vizPhizOptions.showIds = render.options.showIds;
    vizPhizOptions.showVelocity = render.options.showVelocity;
    
    var optionsString = JSON.stringify(vizPhizOptions);
    //var graphString = JSON.stringify(graphWindows);
    
    var bodies = Matter.Composite.allBodies(world);
    var bodyString = "["
    for (var i=0; i<bodies.length; i+= 1)
	{
		var body = bodies[i];
        //We have to remove all circular references before turning it into a string.
        //So I am replacing any circular reference to the same object as the string "itself"
        bodyString += JSON.stringify(body, function(key, value) {
            if(key === "parent")
                if(body.parent)
                    return body.parent.id
            if(key === "vertices"){
                var newVertices = copyVertices(body.vertices);
                return newVertices;
            }
            //For now, I am not including parts.  This will NEED to be changed.
            if (key === "parts")
                return "itself";
            return value;
        });
        if( i < bodies.length - 1 )
            bodyString += ",";  
    }
    bodyString += "]";
    
    var fixedBodyList = [];
    fixedBodies.forEach(function(body){
        fixedBodyList.push(body.id);
    });
    
    var constraints = Matter.Composite.allConstraints(world);
    var constraintsString = "[";
    for (i=0; i<constraints.length; i+= 1)
	{
		var constraint = constraints[i];
        constraintsString += JSON.stringify(constraint, function(key, value) {
            if(key === "bodyA" && constraint.bodyA)
                return constraint.bodyA.id;
            if(key === "bodyB" && constraint.bodyB)
                return constraint.bodyB.id;
            return value;
        });
        if( i < constraints.length - 1 )
            constraintsString += ",";  
    }
    constraintsString += "]";
    var forcesString = JSON.stringify(forces);
    
    var graphsString = "[";
    for (i=0; i<graphWindows.length; i+= 1){
        var graphWindow = graphWindows[i];
        var options = graphWindow.options;
        options.x = graphWindow.myChart.style.left;
        options.y = graphWindow.myChart.style.top;
        graphsString += JSON.stringify(options);
        if( i < graphWindows.length - 1 )
            graphsString += ",";  
    }
    graphsString += "]";

    download("options=" + optionsString + 
             "\nbodies=" + bodyString +
             "\nfixedBodies=" + fixedBodyList.join(",") +
             "\nconstraints=" + constraintsString +
             "\nforces=" + forcesString +
             "\ngraphs=" + graphsString +
             "", "Saved World.txt");
    
});

function download(content, filename) {
    var fileName = prompt("Please enter a filename", filename);
    if(fileName == null)
        return;
    var a = document.createElement("a");
    var file = new Blob([content], {type: 'text/plain'});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

loadButton.addEventListener('click', function() {
    var button = document.createElement("input");
    button.type = "file";
    button.onchange= function(event) {
        var input = event.target;
        var reader = new FileReader();
        reader.onload = function(){
            var dataURL = reader.result;
            createObjectsFromFile(dataURL);
        };
        reader.readAsText(input.files[0]);
    };
    button.click();
});

function createObjectsFromFile(fileString){
    Matter.World.clear(world, false);
    fixedBodies = [];
    initialObjectStates = [];
    trackingStates = [];
    graphWindows.forEach(function(graphWindow){
        graphWindow.myChart.style.display = "none";
        //graphWindow.remove();
    });
    graphWindows = [];
    forces = [];
    
    var lines = fileString.split("\n");
    var bodies;
    lines.forEach(function(line){
        var lineDetails = line.split("=");
        if(lineDetails[0] == "options"){
            vizPhizOptions = JSON.parse(lineDetails[1]);
             //Setting some important variables
            if(vizPhizOptions.gravity !== undefined)
                world.gravity = vizPhizOptions.gravity;
            if(vizPhizOptions.background !== undefined)
                render.options.background = vizPhizOptions.background;
            if(vizPhizOptions.delta !== undefined)
                runner.delta = vizPhizOptions.delta;
            if(vizPhizOptions.positionIterations !== undefined)
                engine.positionIterations = vizPhizOptions.positionIterations;
            if(vizPhizOptions.velocityIterations !== undefined)
                engine.velocityIterations = vizPhizOptions.velocityIterations;
            if(vizPhizOptions.constraintIterations !== undefined)
                engine.constraintIterations = vizPhizOptions.constraintIterations;
            if(vizPhizOptions.wireframes !== undefined)
                render.options.wireframes = vizPhizOptions.wireframes;
            if(vizPhizOptions.showIds !== undefined)
                render.options.showIds = vizPhizOptions.showIds;
            if(vizPhizOptions.showVelocity !== undefined)
                render.options.showVelocity = vizPhizOptions.showVelocity;
        }
        if(lineDetails[0] == "forces")
            forces = JSON.parse(lineDetails[1]);
        if(lineDetails[0] == "bodies"){
            bodies=JSON.parse(lineDetails[1]);
            bodies.forEach(function(body){
                if(body.parent)
                    body.parent = getBody(body.parent, bodies);
                if(body.parts === "itself"){
                    body.parts = [];
                    body.parts[0] = body;
                }
                World.add(engine.world, body);
                initialObjectStates.push(new createSavedState(body.id, 0, body.position.x, body.position.y, body.velocity.x, body.velocity.y, body.angle, body.angularVelocity, body.vertices));
                trackingStates.push(new createTrackingState(body.id));
                body.isStatic = true;
                Matter.Body.setVertices(body, body.vertices);
                if(body.label == "Origin")
                    origin = body;
            });
        }
        if(lineDetails[0] == "fixedBodies"){
            var fixedBodyList = lineDetails[1].split(",");
            for(var i = 0; i< fixedBodyList.length; i++){
                var fixedNum = Number(fixedBodyList[i]);
                fixedBodies.push(getBody(fixedNum, bodies));
            }
        }
        if(lineDetails[0] == "constraints"){
            var constraints=JSON.parse(lineDetails[1]);
            constraints.forEach(function(constraint){
                if(constraint.bodyA)
                    constraint.bodyA = getBody(constraint.bodyA, bodies);
                if(constraint.bodyB)
                    constraint.bodyB = getBody(constraint.bodyB, bodies);
                World.add(engine.world, constraint);
            });
        }
        if(lineDetails[0] == "graphs"){
            var optionsList = JSON.parse(lineDetails[1]);
            optionsList.forEach(function(options){
                var graphWindow = new GraphWindow(options.bodyID);
                graphWindow.options = options;
                graphWindow.myChart.style.left = options.x;
                graphWindow.myChart.style.top = options.y;
                graphWindows.push(graphWindow);
                currentGraph = graphWindow;
                resetDataSets();
            });
        }       
    });
}

aboutButton.addEventListener('click', function() {
    about.style.display = "block"
    about.style.left = 200 + "px";
    about.style.top = 200 + "px";
});

dragElement(about);

editButton.addEventListener('click', function() {
    if(running)
        return;
    if( !reset ){
        alert("Please hit the reset button before trying to edit.");
        return;
    }
    editing = !editing;
    if(editing){
        editButton.style.background = "green";
        editToolbar.style.display = "block";
    } else{
        editButton.style.background = 'rgba(0,0,0,0.1)';
        editToolbar.style.display = "none";
    }
});
    

resetButton.addEventListener('click', function() {
	if (running){
		alert("Please pause the simulation first.");
        return;
    }
	var bodies = Matter.Composite.allBodies(world);
	for (var i=0; i<bodies.length; i+= 1)
	{
		var body = bodies[i];
		var state = getInitialState(body.id);
		if (state != null) {
			Matter.Body.setPosition(body, Matter.Vector.create(state.x, state.y));
			Matter.Body.setVelocity(body, Matter.Vector.create(state.Vx, state.Vy));
			Matter.Body.setAngle(body, state.theta);
			Matter.Body.setAngularVelocity(body, state.omega);
		}
	}
    updateConstraintReferenceAngles();
    graphWindows.forEach(function(graphWindow){
        graphWindow.graph.data.datasets.forEach(function(dataset) {
			dataset.data = [];
            graphWindow.graph.options.annotation.annotations[0].value = 0;
            graphWindow.graph.options.annotation.annotations[0].label.content = "time";
		});
		graphWindow.graph.update();
    });
    
	trackingStates.forEach(function(trackingState){
		trackingState.savedObjectStates = [];
	});
	
	time = 0.0;
	timeSlider.value = 0;
	timeSlider.max = 0;
	timeText.innerHTML = 0 + "s";
	frame = 0;
    reset = true;
    measuringWorld = false;
    if(!editing)
        editButton.click();
    if(mouseType != moveMouse)
        newButtons[0].click();
    if(vizPhizOptions.followObject)
            Matter.Render.lookAt(render, world, {x:vizPhizOptions.followPadding, y:vizPhizOptions.followPadding}, true);
});

window.addEventListener("resize", function(){
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
});

fullButton.addEventListener('click', function() {
	var elem = document.documentElement;
	if ( window.innerHeight === screen.height) {
		// browser is fullscreen
		if (document.exitFullscreen)
            document.exitFullscreen();
        else if (document.mozCancelFullScreen) /* Firefox */
            document.mozCancelFullScreen();
        else if (document.webkitExitFullscreen) /* Chrome, Safari and Opera */
            document.webkitExitFullscreen();
        else if (document.msExitFullscreen) /* IE/Edge */
            document.msExitFullscreen();
	}else
        if (elem.requestFullscreen)
            elem.requestFullscreen();
        else if (elem.mozRequestFullScreen) /* Firefox */
            elem.mozRequestFullScreen();
        else if (elem.webkitRequestFullscreen) /* Chrome, Safari & Opera */
            elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) /* IE/Edge */
            elem.msRequestFullscreen();	  
});

function timeChanged() {
	if (running)
		return;
	var fram = timeSlider.value;
	time = timeSlider.value * (runner.delta / 1000.0);
	timeText.innerHTML = roundOffDecimals(time) + "s";
	var bodies = Matter.Composite.allBodies(world);
	for (var i=0; i<bodies.length; i+= 1) {
		var body = bodies[i];
		var state = getSavedObjectState(body.id, fram);
		if (state != null) {
			Matter.Body.setPosition(body, Matter.Vector.create(state.x, state.y));
			Matter.Body.setVelocity(body, Matter.Vector.create(state.Vx, state.Vy));
			Matter.Body.setAngle(body, state.theta);
			Matter.Body.setAngularVelocity(body, state.omega);
		}
	}
    updateConstraintReferenceAngles();
	graphWindows.forEach(function(graphWindow){
		var graph = graphWindow.graph;
		graph.options.annotation.annotations[0].value = roundOffDecimals(time);

        graphWindow.graph.options.annotation.annotations[0].label.content = "time: " + roundOffDecimals(time) + " s";
		graph.options.annotation.annotations[0].label.enabled = true;
        
        
        graph.update();
        
        var active = [];
        
        for(var i=0; i< graphWindow.graph.data.datasets.length; i++){
            var segment = graph.getDatasetMeta(i).data[fram];
            active.push(segment);
        }
        graph.tooltip._active = active;
        graph.tooltip.update();
		graph.draw();
	});
}

timeSlider.addEventListener('input', timeChanged);

timeForward.addEventListener('click', function() {
	timeSlider.value = Number(timeSlider.value) + 1;
	timeChanged();
});

timeBackward.addEventListener('click', function() {
	timeSlider.value = Number(timeSlider.value) - 1;
	timeChanged();
});


function untack(body)
{
	for (var i =0;i<fixedBodies.length;i+= 1)
		if (fixedBodies[i] === body)
			return;
	body.isStatic = false;
}

function tack(body)
{
	body.isStatic = true;
}

runButton.addEventListener('click', function() {
    if(editing)
        editButton.click();
	running = !running;
	var bodies = Matter.Composite.allBodies(world);
	if (running)
	{  
        reset = false;
		currentBody = null;
        currentConstraint = null;
        currentConstraintPoint = null;
        currentForce = null;
        bodyEditor.style.display = "none";
		bodies.forEach(untack);
		if (timeSlider.value < timeSlider.max) {
			clearSavedStatesAfterFrame(timeSlider.value);
			clearGraphDataAfterFrame(timeSlider.value);
			time = timeSlider.value * (runner.delta / 1000.0);
			frame = timeSlider.value;
		}
		engine.timing.timestamp = time * 1000.0;
        graphWindows.forEach(function(graphWindow){
			graphWindow.graph.options.annotation.annotations[0].label.enabled = false;
        });
		runButton.innerHTML = '<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"> \
									<line id="svg_1" y2="18" x2="9" y1="6" x1="9" stroke-width="2" stroke="white" fill="none"/> \
									<line id="svg_2" y2="18" x2="15" y1="6" x1="15" stroke-width="2" stroke="white" fill="none"/> \
								</svg>';
		
	}
	else{
		time = engine.timing.timestamp / 1000.0;
		bodies.forEach(tack);
		runButton.innerHTML = '<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"> \
									<line id="svg_1" y2="12" x2="20" y1="6" x1="6" stroke-width="2" stroke="white" fill="none"/> \
									<line id="svg_2" y2="12" x2="20" y1="18" x1="6" stroke-width="2" stroke="white" fill="none"/> \
									<line id="svg_3" y2="6" x2="6" y1="18" x1="6" stroke-width="2" stroke="white" fill="none"/> \
								</svg>';
	}

});

graphButton.addEventListener('click', function() {
	if (running)
		return;
    if(currentBody == null){
        alert("Please select and object first");
        return;
    }
	var graphWindow = new GraphWindow(currentBody.id);
    if(graphWindow == null)
        return;
	graphWindows.push(graphWindow);
    currentGraph = graphWindow;
	resetDataSets();
    
});


var rightClicking = false;
// an example of using mouse events on a mouse
Events.on(mouseConstraint, 'mousedown', function(event) {
    var mousePosition = event.mouse.position;
    if(mouseType == measureMouse){
        newX = mousePosition.x;
        newY = mousePosition.y;
        newW = mousePosition.x;
        newH = mousePosition.y;
        measuringWorld = true;
        return;
    }
    if(ctrlPressed){
        newW = mousePosition.x;
        newH = mousePosition.y;
        draggingWorld = true;
        return;
    }
	if (running)
		return;
    if( !reset ){
        //alert("Please hit the reset button before trying to edit.");
        return;
    }
    if (event.mouse.button === 2)
        rightClicking = true;
    if (mouseType > 0) {
        if(mouseType == forceMouse && currentBody == null){
            alert("Please select an object first");
            newButtons[0].click();
            return;
        }
        newObject = true;
        newX = mousePosition.x;
        newY = mousePosition.y;
        if (mouseType === conMouse) {
            newW = mousePosition.x;
            newH = mousePosition.y;
        } else{
            newW = 0;
            newH = 0;
        }
    } else if (mouseType === moveMouse) {
        var bodies = Matter.Composite.allBodies(world);
        draggingVelocity = false;
        bodies.forEach(function(body){
            var bodyvel = convertFromMatterTimeScale(body.velocity);
            bodyvel = Vector.mult(bodyvel, vizPhizOptions.velocityVectorScale);
            if(mouseNearPoint(mousePosition,  Matter.Vector.create(body.position.x + bodyvel.x, body.position.y + bodyvel.y))){
                currentBody = body;
                draggingVelocity = true;
                currentForce = null;
                currentConstraint = null;
                currentConstraintPoint = null;
            }
        });
        if(draggingVelocity)
            return;
        for(var f = 0; f < forces.length; f++){
            var force = forces[f];
            var body = getBody(force.bodyID, bodies);
            if(mouseNearPoint(mousePosition, Matter.Vector.create(force.position.x + body.position.x + force.force.x * vizPhizOptions.forceVectorScale, force.position.y + body.position.y + force.force.y * vizPhizOptions.forceVectorScale))){
                currentForce = force;
                draggingBody = true;
                currentBody = null;
                currentConstraint = null;
                currentConstraintPoint = null;
                if (bodyEditor.style.display === "block")
                    loadForceDetails(force);
                return;
            }
        }
        var constraints = Matter.Composite.allConstraints(world);
        if(constraints.length > 1){
            for(var c = 1; c < constraints.length; c++){
                var constraint = constraints[c];
                if(mouseConstraint != constraint){
                    var clickedPoint = getClickedConstraintPoint(mousePosition, constraint);
                    if(clickedPoint){
                        c = constraints.length;
                        currentConstraint = constraint;
                        currentConstraintPoint = clickedPoint;
                        currentBody = null;
                        draggingBody = true;
                        currentForce = null;
                        if (bodyEditor.style.display === "block")
                            loadConstraintDetails(constraint);
                        return;
                    }
                }
            }
        }
        bodies = Matter.Query.point(Matter.Composite.allBodies(world), mousePosition);
        if (bodies.length > 0) {
            currentBody = bodies[0];
            draggingBody = true;
            currentConstraint = null;
            currentConstraintPoint = null;
            currentForce = null;
            newX = mousePosition.x - currentBody.position.x;
            newY = mousePosition.y - currentBody.position.y;
            if (shiftPressed || rightClicking) {
                newW= mousePosition.x - currentBody.position.x;
                newH = mousePosition.y - currentBody.position.y;
            } else{
                newW = 0;
                newH = 0;
            }
            if (bodyEditor.style.display === "block")
                loadBodyDetails(currentBody);
        } else {
            currentBody = null;
            if (bodyEditor.style.display === "block")
                loadWorldDetails();
        }
    }
});


// an example of using mouse events on a mouse
Events.on(mouseConstraint, 'mouseup', function(event) {
    if(mouseType == measureMouse){
        measuringWorld = false;
        return;
    }
    if(ctrlPressed){
        draggingWorld = false;
        return;
    }
	if (running || mouseType < 0)
		return;
    if( !reset ){
        return;
    }

    var mousePosition = event.mouse.position;
	if (mouseType === moveMouse)
	{
		draggingBody = false;
        draggingVelocity = false;
		if (rightClicking) {
			rightClicking = false;
			newX = Math.abs(newX);
			newY = Math.abs(newY);
			newW = Math.abs(mousePosition.x - currentBody.position.x);
			newH = Math.abs(mousePosition.y - currentBody.position.y);
            var parentComposite = getParentComposite(currentBody);
            if(parentComposite){
                Matter.Composite.scale(parentComposite, newW/newX, newH/newY, currentBody.position);
                saveChildrensStates(parentComposite);
            }
            else
                Matter.Body.scale(currentBody, newW/newX, newH/newY, currentBody.position);
		}
		return;
	}
    newObject = false;
    var w = Math.abs(newW);
    var h = Math.abs(newH);
    
    var x = (newW > 0)? newX + newW/2 : newX - newW/2 ;
	var y = (newH > 0)? newY + newH/2 : newY - newH/2 ;
	var body;
    if (mouseType === boxMouse)
        body = Bodies.rectangle(x, y, w, h);
    if (mouseType === circleMouse)
    {
        var r = Math.sqrt(Math.pow(w, 2)+ Math.pow(h, 2));
        body = Bodies.circle(newX, newY, r, r);
    }
    if (mouseType === polyMouse) {
        r = Math.sqrt(Math.pow(w, 2)+ Math.pow(h, 2));
        body = Bodies.polygon(newX, newY, numberOfSides, r);
    }
    if (mouseType === compMouse) {
        var particleOptions = { 
            friction: 0.05,
            frictionStatic: 0.1
        };
        var constraintOptions = {
            stiffness: 1,
            damping: 0.1
        };
        body = Composites.softBody(x - w/4, y - h/4, w / 40, h / 40, 20, 20, true, 10, particleOptions, constraintOptions);
    }
    if (mouseType === carMouse)
        body = Matter.Composites.car(x, y, w, h, h * 0.75 );
    if (mouseType === conMouse) {
        var firstSpot = Matter.Vector.create(newX, newY);
        var secondSpot = Matter.Vector.clone(mousePosition);
        var bodiesA = Matter.Query.point(Matter.Composite.allBodies(world), firstSpot);
        var bodiesB = Matter.Query.point(Matter.Composite.allBodies(world), secondSpot);
        var options = new Object();
        if (bodiesA.length > 0)
            options.bodyA = bodiesA[0];
        else
            options.pointA = firstSpot;
        if (bodiesB.length > 0)
            options.bodyB = bodiesB[0];
        else
            options.pointB = secondSpot;
        var constraint = Matter.Constraint.create(options);
        World.add(engine.world, constraint);
        newButtons[0].click();
        return;
    }
    if (mouseType === forceMouse) {
        forces.push(new Force(currentBody, newX - currentBody.position.x, newY - currentBody.position.y, newW / vizPhizOptions.forceVectorScale, newH / vizPhizOptions.forceVectorScale ));
        newButtons[0].click();
        return;
    }
    if (mouseType === jointMouse) {
        var spot = Matter.Vector.create(newX, newY);
        var bodies = Matter.Query.point(Matter.Composite.allBodies(world), spot);
        options = new Object();
        if(bodies.length >= 1){
            options.bodyA = bodies[0];
            options.pointA = Matter.Vector.sub(spot, options.bodyA.position);
        } else{
            newButtons[0].click();
            return;
        }
        if(bodies.length >= 2){
            options.bodyB = bodies[1];
            options.pointB = Matter.Vector.sub(spot, options.bodyB.position);
        } else
            options.pointB = spot;
        constraint = Matter.Constraint.create(options);
        World.add(engine.world, constraint);
        newButtons[0].click();
        return;
    }
    
    body.frictionAir = 0;
    World.add(engine.world, body);
    
    if (mouseType === compMouse || mouseType === carMouse) {

        var bodyParts = Matter.Composite.allBodies(body);
        for (var i = 0; i < bodyParts.length; i += 1) {
            var bodyPart = bodyParts[i];
            initialObjectStates.push(new createSavedState(bodyPart.id, 0, bodyPart.position.x, bodyPart.position.y, bodyPart.velocity.x, bodyPart.velocity.y, 0, 0, bodyPart.vertices));
            trackingStates.push(new createTrackingState(bodyPart.id));
            bodyPart.isStatic = true;
        }
	} else{
        initialObjectStates.push(new createSavedState(body.id, 0, body.position.x, body.position.y, body.velocity.x, body.velocity.y, 0, 0, body.vertices));
        trackingStates.push(new createTrackingState(body.id));
        body.isStatic = true;
    }
    newButtons[0].click();
});

document.addEventListener('dblclick', function(event) {
	if (running)
		return;
    var mousePosition = mouse.position;
    if (event.target === bodyEditor || bodyEditor.contains(event.target))
        return;
    if (event.target === mainToolbar || mainToolbar.contains(event.target))
        return;
    if (event.target ===editToolbar || editToolbar.contains(event.target))
        return;
    if( !reset ){
        alert("Please hit the reset button before trying to edit properties.");
        return;
    }
    measuringWorld = false;
    if(!editing)
        editButton.click();
	if (mouseType != moveMouse)
		newButtons[0].click();
	
	bodyDetails.style.width = "100%";
	bodyEditor.style.textAlign = "left";
    
    for(var f = 0; f < forces.length; f++){
            var force = forces[f];
            var body = getBody(force.bodyID, Matter.Composite.allBodies(world));
            if(mouseNearPoint(mousePosition, Matter.Vector.create(force.position.x + body.position.x + force.force.x * vizPhizOptions.forceVectorScale, force.position.y + body.position.y + force.force.y * vizPhizOptions.forceVectorScale))){
                loadForceDetails(force);
                bodyEditor.style.left = event.clientX + "px";
                bodyEditor.style.top = event.clientY + "px";
                bodyEditor.style.display = "block";
                return;
            }
        }
    
    var constraints = Matter.Composite.allConstraints(world);
    if(constraints.length > 1){
        for(var c = 1; c < constraints.length; c++){
            var constraint = constraints[c];
            if(mouseConstraint != constraint){
                var clickedPoint = getClickedConstraintPoint(mousePosition, constraint);
                if(clickedPoint){
                    loadConstraintDetails();
                    bodyEditor.style.left = event.clientX + "px";
                    bodyEditor.style.top = event.clientY + "px";
                    bodyEditor.style.display = "block";
                    return;
                }
            }
        }
    }
	
	var bodies = Matter.Query.point(Matter.Composite.allBodies(world), mousePosition);
	if (bodies.length === 0) {
		loadWorldDetails();
		bodyEditor.style.left = event.clientX + "px";
		bodyEditor.style.top = event.clientY + "px";
		bodyEditor.style.display = "block";
	}
	if (bodies.length >= 1) {
		currentBody = bodies[0];
		loadBodyDetails(currentBody);
		bodyEditor.style.left = event.clientX + "px";
		bodyEditor.style.top = event.clientY + "px";
		bodyEditor.style.display = "block";
	}
});

var propertyEditors = [];
var editorNum = -1;
var editorEvent = null;

var propertyCheckBoxes = [];
var checkBoxNum = -1;

function isItNextEditor() {
	editorNum += 1;
	return (editorEvent.currentTarget === propertyEditors[editorNum]);
}
function getEditorValue() {
	return propertyEditors[editorNum].value;
}

function isItNextCheckBox() {
	checkBoxNum += 1;
	return (editorEvent.currentTarget === propertyCheckBoxes[checkBoxNum]);
}
function isCheckBoxChecked() {
	return propertyCheckBoxes[checkBoxNum].checked;
}

function addTextToDetails(text) {
	var textDisplay = document.createElement("div");
	textDisplay.style.width = "200px";
    textDisplay.style.textAlign = "center";
    textDisplay.style.background = "lightblue";
    textDisplay.innerHTML = text;
	bodyDetails.appendChild(textDisplay);
}

function addInputToDetails(property, value, onchange) {
	var propertyDisplay = document.createElement("div");
	propertyDisplay.style.width = "200px";
	
	var propertyTitle = document.createElement("span");
	propertyTitle.innerHTML = property + ": ";
	propertyTitle.style.float = "left";
	bodyDetails.appendChild(propertyTitle);
	
	var propertyEditor = document.createElement("input");
	propertyEditors.push(propertyEditor);
	propertyEditor.setAttribute('type', 'text');
	propertyEditor.style.width = "100px";
	propertyEditor.style.float = "right";
	propertyEditor.value = value;
	propertyDisplay.appendChild(propertyEditor);
	
	var floatClear = document.createElement("div");
	floatClear.style.clear = "both";
	propertyDisplay.appendChild(floatClear);
	
	bodyDetails.appendChild(propertyDisplay);
	
	propertyEditor.onchange = onchange;
}

function addCheckBoxToDetails(property, value, onchange) {
	var propertyDisplay = document.createElement("div");
	propertyDisplay.style.width = "200px";
	
	var propertyTitle = document.createElement("span");
	propertyTitle.innerHTML = property + ": ";
	propertyTitle.style.float = "left";
	bodyDetails.appendChild(propertyTitle);
	
	var propertyCheckBox = document.createElement("input");
	propertyCheckBoxes.push(propertyCheckBox);
	propertyCheckBox.setAttribute('type', 'checkbox');
	propertyCheckBox.style.float = "right";
	propertyCheckBox.checked = value;
	propertyDisplay.appendChild(propertyCheckBox);
	
	var floatClear = document.createElement("div");
	floatClear.style.clear = "both";
	propertyDisplay.appendChild(floatClear);
	
	bodyDetails.appendChild(propertyDisplay);
	
	propertyCheckBox.onchange = onchange;
}


function loadBodyDetails(body) {
    if(body == origin)
        bodyName.innerHTML = "The Origin";
    else
        bodyName.innerHTML = "Object: " + body.id;
	bodyDetails.innerHTML = "";
	propertyEditors = [];
    propertyCheckBoxes = [];
    addInputToBodyDetails("label", body.label);
    addTextToDetails("Position:");
    if(body == origin){
        addInputToBodyDetails("X (pix)", roundOffDecimals(body.position.x));
        addInputToBodyDetails("Y (pix)", roundOffDecimals(body.position.y));
    } else{
        var displayPos = PosVectorFromMatter(body.position);
        addInputToBodyDetails("X (m)", roundOffDecimals(displayPos.x));
        addInputToBodyDetails("Y (m)", roundOffDecimals(displayPos.y));
    }
    addTextToDetails("Size:");
    var bounds = currentBody.bounds;
    addInputToBodyDetails("width (m)", roundOffDecimals(bounds.max.x - bounds.min.x));
    addInputToBodyDetails("height (m)", roundOffDecimals(bounds.max.y - bounds.min.y));
    addTextToDetails("Velocity:");
	var displayVel = convertFromMatterVelocity(body.velocity);
	addInputToBodyDetails("Vx (m/s)", roundOffDecimals(displayVel.x));
	addInputToBodyDetails("Vy (m/s)", roundOffDecimals(displayVel.y));
    addInputToBodyDetails("Speed (m/s)", roundOffDecimals(Math.hypot(displayVel.x,displayVel.y)));
    if(vizPhizOptions.useDegrees)
        addInputToBodyDetails("\u03B8 (deg)", roundOffDecimals(Math.toDegrees(Math.atan2(displayVel.y,displayVel.x))));
    else
        addInputToBodyDetails("\u03B8 (rad)", roundOffDecimals(Math.atan2(displayVel.y,displayVel.x)));
    if(body == origin)
        var angle = AngleFromMatter(body.angle);
    else
        var angle = PosAngleFromMatter(body.angle);
    var angularVel =  AngVFromMatter(body.angularVelocity);
    addTextToDetails("Rotation:");
    if(vizPhizOptions.useDegrees){
        addInputToBodyDetails("" + '\u03B8' + " (deg)", roundOffDecimals(Math.toDegrees(angle)));
        addInputToBodyDetails("" + '\u03C9'+ " (deg/s)", roundOffDecimals(Math.toDegrees(angularVel)));
    }else{
        addInputToBodyDetails("" + '\u03B8' + " (rad)", roundOffDecimals(angle));
        addInputToBodyDetails("" + '\u03C9'+ " (rad/s)", roundOffDecimals(angularVel));
    }
	
    addInputToBodyDetails("Rot Inertia", roundOffDecimals(body.inertia));
    addTextToDetails("Internal Properties:")
    addInputToBodyDetails("m (kg)", roundOffDecimals(body.mass));
    addInputToBodyDetails("density", roundOffDecimals(body.density));
	addInputToBodyDetails("restitution", roundOffDecimals(body.restitution));
    addCheckBoxToBodyDetails("fixed", isFixed(body));
    addTextToDetails("Friction:");
	addInputToBodyDetails('\u03BC'+"-kin", roundOffDecimals(body.friction));
	addInputToBodyDetails('\u03BC'+"-stat", roundOffDecimals(body.frictionStatic));
	addInputToBodyDetails("drag", roundOffDecimals(body.frictionAir));
    addTextToDetails("Object Looks:");
	addInputToBodyDetails("fill Color", body.render.fillStyle);
	addInputToBodyDetails("image", body.render.sprite.texture);
	addInputToBodyDetails("image xscale", roundOffDecimals(body.render.sprite.xScale));
	addInputToBodyDetails("image yscale", roundOffDecimals(body.render.sprite.yScale));
    
    if(body == origin){
        addTextToDetails("Origin Options:");
        addCheckBoxToBodyDetails("X Flip", vizPhizOptions.xCoordFlip);
        addCheckBoxToBodyDetails("Y Flip", vizPhizOptions.yCoordFlip);
    }
}

function addInputToBodyDetails(property, value) {
	addInputToDetails(property, value, function(event) {
		
		var state = getInitialState(currentBody.id);
        editorNum = -1;
		editorEvent = event;
        
        if (isItNextEditor()) //label
			currentBody.label = getEditorValue();
		
        var xEdit = propertyEditors[1];
        var yEdit = propertyEditors[2];
		if (event.currentTarget === xEdit || event.currentTarget === yEdit) { //Position
            if(currentBody == origin)
                var matterPos = Matter.Vector.create(Number(xEdit.value), Number(yEdit.value));
            else
                matterPos = PosVectorToMatter(Matter.Vector.create(Number(xEdit.value), Number(yEdit.value)));
			Matter.Body.setPosition(currentBody, matterPos);
			state.x = matterPos.x;
			state.y = matterPos.y;
		}
        
        var widthEdit = propertyEditors[3];
        var heightEdit = propertyEditors[4];
        
		if (event.currentTarget === widthEdit || event.currentTarget ===  heightEdit) { //Size
            var bounds = currentBody.bounds;
            var xScale = Number(widthEdit.value)/(bounds.max.x - bounds.min.x);
            var yScale = Number(heightEdit.value)/(bounds.max.y - bounds.min.y);
           Matter.Body.scale(currentBody,xScale, yScale, currentBody.position);
		}
        
        var vxEdit = propertyEditors[5];
        var vyEdit = propertyEditors[6];
        
		if (event.currentTarget === vxEdit || event.currentTarget === vyEdit) { //Velocity
            var matterVel = convertToMatterVelocity(Matter.Vector.create(Number(vxEdit.value), Number(vyEdit.value)));
			Matter.Body.setVelocity(currentBody, matterVel);
			state.Vx = matterVel.x;
			state.Vy = matterVel.y;
		}
        
        var speedEdit = propertyEditors[7];
        var thetaEdit = propertyEditors[8];
        
		if (event.currentTarget === speedEdit || event.currentTarget === thetaEdit) { //Velocity
            var speed = Number(speedEdit.value);
            var theta;
            if(vizPhizOptions.useDegrees)
                theta = Math.toRadians(Number(thetaEdit.value));
            else
                theta = Number(thetaEdit.value);
            var matterVel = convertToMatterVelocity(Matter.Vector.create(speed * Math.cos(theta), speed * Math.sin(theta)));
			Matter.Body.setVelocity(currentBody, matterVel);
			state.Vx = matterVel.x;
			state.Vy = matterVel.y;
		}
		
		editorNum = 8;   
		
		if (isItNextEditor()) { //Theta
            var angle;
            if(vizPhizOptions.useDegrees)
                angle = Math.toRadians(Number(getEditorValue()));
            else
                angle = Number(getEditorValue());
            if( currentBody == origin)
                var angle = AngleToMatter(angle);
            else
                var angle = PosAngleToMatter(angle);
			Matter.Body.setAngle(currentBody, angle);
			state.theta = angle;
		}
		if (isItNextEditor()) { //Omega
            var angularVel;
            if(vizPhizOptions.useDegrees)
                angularVel = AngVToMatter(Math.toRadians(Number(getEditorValue())));
            else
                angularVel = AngVToMatter(Number(getEditorValue()));
			Matter.Body.setAngularVelocity(currentBody, angularVel);
			state.omega = angularVel;
		}
        if (isItNextEditor()) //Moment of Inertia
            if(Number(getEditorValue()) > 0)
                Matter.Body.setInertia(currentBody, Number(getEditorValue()));
        if (isItNextEditor()) //Mass
			Matter.Body.setMass(currentBody, Number(getEditorValue()));
        if (isItNextEditor()) //Mass
			Matter.Body.setDensity(currentBody, Number(getEditorValue()));
		if (isItNextEditor()) //Restitution
			currentBody.restitution = Number(getEditorValue());
		if (isItNextEditor()) //Kinetic friction
			currentBody.friction =  Number(getEditorValue());
		if (isItNextEditor()) //Static Friction
			currentBody.frictionStatic =  Number(getEditorValue());
		if (isItNextEditor()) //Air resistance
			currentBody.frictionAir =  Number(getEditorValue());
		if (isItNextEditor()) //FillStyle
			currentBody.render.fillStyle = getEditorValue();
		if (isItNextEditor()) //sprite image
			currentBody.render.sprite.texture = getEditorValue();
		if (isItNextEditor()) //image scale x
			currentBody.render.sprite.xScale=  Number(getEditorValue());
		if (isItNextEditor()) //image scale y
			currentBody.render.sprite.yScale =  Number(getEditorValue());
        
        loadBodyDetails(currentBody);
	});
}

function addCheckBoxToBodyDetails(property, value) {
	addCheckBoxToDetails(property, value, function(event) {
		
		checkBoxNum = -1;
		editorEvent = event;
		
		if (isItNextCheckBox()) //fixed
			if (isCheckBoxChecked())
				fixedBodies.push(currentBody);
			else
				for (var i=0;i<fixedBodies.length;i+= 1)
					if (currentBody === fixedBodies[i])
                        fixedBodies.splice(i,1);
        
        if(currentBody === origin){
            if (isItNextCheckBox()) //Flip the X coordinate system
                vizPhizOptions.xCoordFlip = isCheckBoxChecked();
            if (isItNextCheckBox()) //Flip the Y coordinate system
                vizPhizOptions.yCoordFlip = isCheckBoxChecked();
        }
	});
}

function loadWorldDetails() {
	bodyName.innerHTML = "World";
	bodyDetails.innerHTML = "";
	propertyEditors = [];
    propertyCheckBoxes = [];
    addTextToDetails("Gravity:");
	addInputToWorldDetails("gX (m/s/s)", world.gravity.x);
	addInputToWorldDetails("gY (m/s/s)", world.gravity.y);
	
	addTextToDetails("Calculations:")
	addInputToWorldDetails("timestep (s)", (runner.delta / 1000.0));
    addCheckBoxToWorldDetails("advanced", vizPhizOptions.advancedCalculationOptions);
    if(vizPhizOptions.advancedCalculationOptions){
        addInputToWorldDetails("position Iter", engine.positionIterations);
        addInputToWorldDetails("velocity Iter", engine.velocityIterations);
        addInputToWorldDetails("constraint Iter", engine.constraintIterations);
        addInputToWorldDetails("Resting Thr", Matter.Resolver._restingThresh);
    }
	addTextToDetails("Vectors:")
    addCheckBoxToWorldDetails("Show V Vectors", render.options.showVelocity);
    addInputToWorldDetails("V Scale", vizPhizOptions.velocityVectorScale);
    addInputToWorldDetails("V Color", vizPhizOptions.velocityVectorColor);
    addInputToWorldDetails("F Scale", vizPhizOptions.forceVectorScale);
    addInputToWorldDetails("F Color", vizPhizOptions.forceVectorColor);
    addTextToDetails("Tracking:");
	addCheckBoxToWorldDetails("Show Track", vizPhizOptions.trackingON);
	addInputToWorldDetails("track rate", vizPhizOptions.trackingFrameRate);
    addInputToWorldDetails("Follow Object", vizPhizOptions.followObject);
    addInputToWorldDetails("View Padding", vizPhizOptions.followPadding);
    addTextToDetails("World Looks:");
    addInputToWorldDetails("background", render.options.background);
    addCheckBoxToWorldDetails("wireframe", render.options.wireframes);
    addCheckBoxToWorldDetails("show IDs", render.options.showIds);
	addCheckBoxToWorldDetails("show grid", vizPhizOptions.showGrid);
    addCheckBoxToWorldDetails("show labels", vizPhizOptions.showLabels);
    addCheckBoxToWorldDetails("Use Degrees", vizPhizOptions.useDegrees);
	
}

function addInputToWorldDetails(property, value) {
	addInputToDetails(property, value, function(event) {
		
		editorNum = -1;
		editorEvent = event;
		
		if (isItNextEditor()) //Gravity in the X Direction
			world.gravity.x = Number(getEditorValue());
		if (isItNextEditor()) //Gravity in the Y Direction
			world.gravity.y = Number(getEditorValue());
		
		if (isItNextEditor()){ //The timestep in the world animation
            if(Number(getEditorValue()) <= 0){
                loadWorldDetails();
                return;
            }
            var oldDelta = runner.delta;
			runner.delta = Number(getEditorValue() * 1000.0);
            var changeDelta = runner.delta / oldDelta;
            world.gravity.scale =  1 / 1000000.0; //This is necessary or gravity won't be calculated correctly
            //All the velocities need to be converted for the different timescale?
            var bodies = Matter.Composite.allBodies(world);
            bodies.forEach(function(body){
                Matter.Body.setVelocity(body, Matter.Vector.mult(body.velocity, changeDelta));
                Matter.Body.setAngularVelocity(body, body.angularVelocity * changeDelta);
                var state = getInitialState(body.id);
                state.Vx = body.velocity.x;
                state.Vy = body.velocity.y;
                state.omega = body.omega;
            });
        }
        if(vizPhizOptions.advancedCalculationOptions){
            if (isItNextEditor()) //The number of times position is calculated per frame
                engine.positionIterations = Number(getEditorValue());
            if (isItNextEditor()) //The number of times velocity is calculated per frame
                engine.velocityIterations = Number(getEditorValue());
            if (isItNextEditor()) //The number of times velocity is calculated per frame
                engine.constraintIterations = Number(getEditorValue());
            if (isItNextEditor()) //A threshhold value used to calculate resting
                Matter.Resolver._restingThresh = Number(getEditorValue());
        }
        if (isItNextEditor()) //Scale Factor for Displaying Velocity Vectors
			vizPhizOptions.velocityVectorScale = Number(getEditorValue());
        if (isItNextEditor()) //Color of Velocity Vectors
			vizPhizOptions.velocityVectorColor = getEditorValue();
        if (isItNextEditor()) //Scale Factor for Displaying Force Vectors
			vizPhizOptions.forceVectorScale = Number(getEditorValue());
        if (isItNextEditor()) //Color of Force Vectors
			vizPhizOptions.forceVectorColor = getEditorValue();
        if (isItNextEditor()) //Tracking rate, 1 is every frame, 3 does every 3rd frame, etc
			vizPhizOptions.trackingFrameRate = Number(getEditorValue());
        if (isItNextEditor()) //Object to follow with the view
			vizPhizOptions.followObject = Number(getEditorValue());
        if (isItNextEditor()) //Padding around the Object being followed
			vizPhizOptions.followPadding = Number(getEditorValue());
        if (isItNextEditor()) //The background color for the world
			render.options.background = getEditorValue();
		
	});
}

function addCheckBoxToWorldDetails(property, value) {
	addCheckBoxToDetails(property, value, function(event) {
		
		checkBoxNum = -1;
		editorEvent = event;
        if (isItNextCheckBox()){ //Toggles more advanced options
			vizPhizOptions.advancedCalculationOptions = isCheckBoxChecked();
            loadWorldDetails();
        }
        if (isItNextCheckBox()) //Showing Velocity Vectors on objects
			render.options.showVelocity = isCheckBoxChecked();
        if (isItNextCheckBox()) //If tracking gets displayed for objects
			vizPhizOptions.trackingON = isCheckBoxChecked();
        if (isItNextCheckBox()) //Rendering the wireframes for objects or the colors and sprites
			render.options.wireframes = isCheckBoxChecked();
        if (isItNextCheckBox()) //Showing ID numbers on objects
			render.options.showIds = isCheckBoxChecked();
		if (isItNextCheckBox()) //Shows gridlines for clarity
			vizPhizOptions.showGrid = isCheckBoxChecked();
        if (isItNextCheckBox()) //Shows gridlines for clarity
			vizPhizOptions.showLabels = isCheckBoxChecked();
         if (isItNextCheckBox()) //Toggles using Radians and Degrees
			vizPhizOptions.useDegrees = isCheckBoxChecked();
	});
}

function loadConstraintDetails() {
	bodyName.innerHTML = "Constraint " + currentConstraint.id;
	bodyDetails.innerHTML = "";
	propertyEditors = [];
    propertyCheckBoxes = [];
    addInputToConstraintDetails("label", currentConstraint.label);
    addTextToDetails("Constraint lengths:");
	addInputToConstraintDetails("eq. length", roundOffDecimals(currentConstraint.length));
    var pointA = getPointALocation(currentConstraint);
    var pointB = getPointBLocation(currentConstraint);
    addInputToConstraintDetails("cur. length", roundOffDecimals(Matter.Vector.magnitude(Matter.Vector.sub(pointA,pointB))));
    addTextToDetails("Point A:");
    var textA = "none";
    if(currentConstraint.bodyA)
        textA = currentConstraint.bodyA.id
    var textB = "none";
    if(currentConstraint.bodyB)
        textB = currentConstraint.bodyB.id
    addInputToConstraintDetails("object A", textA);
    addInputToConstraintDetails("Pt A x", roundOffDecimals(currentConstraint.pointA.x));
    addInputToConstraintDetails("Pt A y", roundOffDecimals(currentConstraint.pointA.y));
    addTextToDetails("Point B:");
    addInputToConstraintDetails("object B", textB);
    addInputToConstraintDetails("Pt B x", roundOffDecimals(currentConstraint.pointB.x));
    addInputToConstraintDetails("Pt B y", roundOffDecimals(currentConstraint.pointB.y));
    addTextToDetails("Internal Properties:");
    addInputToConstraintDetails("damping", currentConstraint.damping);
    addInputToConstraintDetails("stiffness", currentConstraint.stiffness);
	
}

function addInputToConstraintDetails(property, value) {
	addInputToDetails(property, value, function(event) {
		
		editorNum = -1;
		editorEvent = event;
		
        if (isItNextEditor()) //The Label
			currentConstraint.label = getEditorValue();
		if (isItNextEditor()) //The Equilibrium Length
			currentConstraint.length = Number(getEditorValue());
        if (isItNextEditor()) //The Current Length
			alert("Please move the anchor points to change the current length.");
        if (isItNextEditor()){ //Object A
            var oldObjectA = currentConstraint.bodyA;
			var newObjectA = getBody(Number(getEditorValue()),Matter.Composite.allBodies(world));
            if(!newObjectA && oldObjectA) //There was an old body and now there is a not one
                currentConstraint.pointA = Matter.Vector.add(currentConstraint.pointA, oldObjectA.position);
            if(newObjectA && !oldObjectA) //There was not an old body and now there is one
                currentConstraint.pointA = Matter.Vector.sub(currentConstraint.pointA, newObjectA.position);
            currentConstraint.bodyA = newObjectA;
        }
        if (isItNextEditor()) //Pt A x
			currentConstraint.pointA.x = Number(getEditorValue());
        if (isItNextEditor()) //Pt A y
			currentConstraint.pointA.y = Number(getEditorValue());
        if (isItNextEditor()){ //Object B
            var oldObjectB = currentConstraint.bodyB;
			var newObjectB = getBody(Number(getEditorValue()),Matter.Composite.allBodies(world));
            if(!newObjectB && oldObjectB) //There was an old body and now there is a not one
                currentConstraint.pointB = Matter.Vector.add(currentConstraint.pointB, oldObjectB.position);
            if(newObjectB && !oldObjectB) //There was not an old body and now there is one
                currentConstraint.pointB = Matter.Vector.sub(currentConstraint.pointB, newObjectB.position);
            currentConstraint.bodyB = newObjectB;
        }
        if (isItNextEditor()) //Pt B x
			currentConstraint.pointB.x = Number(getEditorValue());
        if (isItNextEditor()) //Pt B y
			currentConstraint.pointB.y = Number(getEditorValue());
        if (isItNextEditor()) //The Damping
			currentConstraint.damping = Number(getEditorValue());
        if (isItNextEditor()) //The Stiffness
			currentConstraint.stiffness = Number(getEditorValue());
        loadConstraintDetails();
		
	});
}

function loadForceDetails() {
	bodyName.innerHTML = "Force on " + currentForce.bodyID;
	bodyDetails.innerHTML = "";
	propertyEditors = [];
    propertyCheckBoxes = [];
    var displayPos = VectorFromMatter(currentForce.position);
    var displayForce = VectorFromMatter(currentForce.force);
    addTextToDetails("Position of Force:");
    addInputToForceDetails("x", displayPos.x);
    addInputToForceDetails("y", displayPos.y);
    addTextToDetails("Force:");
    addInputToForceDetails("Fx", displayForce.x);
    addInputToForceDetails("Fy", displayForce.y);
	
}

function addInputToForceDetails(property, value) {
	addInputToDetails(property, value, function(event) {
		if (event.currentTarget === propertyEditors[0] || event.currentTarget === propertyEditors[1]) //Position
            currentForce.position = VectorToMatter(Matter.Vector.create(Number(propertyEditors[0].value), Number(propertyEditors[1].value)));
		if (event.currentTarget === propertyEditors[2] || event.currentTarget === propertyEditors[3])  //Force
            currentForce.force = VectorToMatter(Matter.Vector.create(Number(propertyEditors[2].value), Number(propertyEditors[3].value)));
	});
}

function loadGraphDetails() {
	bodyName.innerHTML = "Graph for Object: " + currentGraph.options.bodyID;
	bodyDetails.innerHTML = "";
	propertyEditors = [];
    propertyCheckBoxes = [];
    addTextToDetails("Position:");
    addCheckBoxToGraphDetails("Graph X Pos", currentGraph.options.graphX);
    addCheckBoxToGraphDetails("Graph Y Pos", currentGraph.options.graphY);
    addTextToDetails("Displacement:");
    addCheckBoxToGraphDetails("Graph \u0394 X", currentGraph.options.graphdX);
    addCheckBoxToGraphDetails("Graph \u0394 Y ", currentGraph.options.graphdY);
    addTextToDetails("Velocity:");
    addCheckBoxToGraphDetails("Graph Vx", currentGraph.options.graphVx);
    addCheckBoxToGraphDetails("Graph Vy", currentGraph.options.graphVy);
    addCheckBoxToGraphDetails("Graph |V|", currentGraph.options.graphV);
    addTextToDetails("Acceleration:");
    addCheckBoxToGraphDetails("Graph Ax", currentGraph.options.graphAx);
    addCheckBoxToGraphDetails("Graph Ay", currentGraph.options.graphAy);
    addCheckBoxToGraphDetails("Graph |A|", currentGraph.options.graphA);
    addTextToDetails("Rotation:");
    addCheckBoxToGraphDetails("Graph \u03B8", currentGraph.options.graphTheta);
    addCheckBoxToGraphDetails("Graph \u03C9", currentGraph.options.graphOmega);
    addTextToDetails("Momentum:");
    addCheckBoxToGraphDetails("Graph px", currentGraph.options.graphPx);
    addCheckBoxToGraphDetails("Graph py", currentGraph.options.graphPy);
    addCheckBoxToGraphDetails("Graph |p|", currentGraph.options.graphP);
	
}

function addCheckBoxToGraphDetails(property, value) {
	addCheckBoxToDetails(property, value, function(event) {
		
		checkBoxNum = -1;
		editorEvent = event;
        
        if (isItNextCheckBox()) 
			currentGraph.options.graphX = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphY = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphdX = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphdY = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphVx = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphVy = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphV = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphAx = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphAy = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphA = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphTheta = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphOmega = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphPx = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphPy = isCheckBoxChecked();
        if (isItNextCheckBox()) 
			currentGraph.options.graphP = isCheckBoxChecked();
        
        resetDataSets();
	});
}

function getParentComposite(ofBody){
    var comps = Matter.Composite.allComposites(world);
    var parentComposite = null;
    comps.forEach(function(comp){
        var bodies = Matter.Composite.allBodies(comp);
        bodies.forEach(function(body){
            if(body === ofBody)
                parentComposite = comp;
        });
    });
    return parentComposite;
}

function deleteComposite(comp){
    var bodies = Matter.Composite.allBodies(comp);
    bodies.forEach(function(body){
        deleteBody(body);
    });
    World.remove(world, comp);
}

function deleteBody(body){
    deleteInitialState(body.id);
    for (var i=0;i<fixedBodies.length;i+= 1)
        if (body === fixedBodies[i])
            fixedBodies.splice(i,1);
    World.remove(world, body);
    for(var f = 0; f<forces.length; f++){
        var force = forces[f];
        if(force.bodyID == body.id){
            forces.splice(f,1);
            f--;
        }
    }
}

function saveChildrensStates(parentComposite){
    var bodies = Matter.Composite.allBodies(parentComposite);
    bodies.forEach(function(body){
        var state = getInitialState(body.id);
        state.x = body.position.x;
        state.y = body.position.y;
        state.theta = body.angle;
        state.omega = body.angularVelocity;
    });
}

//an example of using mouse events on a mouse
Events.on(mouseConstraint, 'mousemove', function(event) {
    var mousePosition = event.mouse.position;
    if(mouseType == measureMouse && measuringWorld){
        newW = mousePosition.x;
        newH = mousePosition.y;
        return;
    }
    if(ctrlPressed && draggingWorld){
        var translate = Matter.Vector.sub({x:newW, y:newH}, mousePosition);
        Bounds.translate(render.bounds, translate);
        Mouse.setOffset(mouse, render.bounds.min);
        return;
    }
	if (running)
		return;
	if (mouseType === moveMouse && draggingBody)
	{
        if(currentForce){
            var body = getBody(currentForce.bodyID, Matter.Composite.allBodies(world));
            currentForce.force.x = (mousePosition.x - (body.position.x + currentForce.position.x)) / vizPhizOptions.forceVectorScale;
            currentForce.force.y = (mousePosition.y - (body.position.y + currentForce.position.y)) / vizPhizOptions.forceVectorScale;
        }
       else if(currentConstraintPoint)
            setConstraintPointLocation(mousePosition);
        else if (shiftPressed) {
			newW = mousePosition.x - currentBody.position.x;
			newH = mousePosition.y - currentBody.position.y;
            
            var parentComposite = getParentComposite(currentBody);
            var rotationAngle = Math.atan2(newH, newW) - Math.atan2(newY, newX);
            if(parentComposite){
                Matter.Composite.rotate(parentComposite, rotationAngle, currentBody.position);
                saveChildrensStates(parentComposite);
            } else{
                Matter.Body.rotate (currentBody, rotationAngle, currentBody.position);
                var state = getInitialState(currentBody.id);
                state.theta = currentBody.angle;
            }
            newX = newW;
			newY = newH;
			
		} else if (event.mouse.button === 2) {
			newX = Math.abs(newX);
			newY = Math.abs(newY);
			newW = Math.abs(mousePosition.x - currentBody.position.x);
			newH = Math.abs(mousePosition.y - currentBody.position.y);
		} else if(currentBody){
            var parentComposite = getParentComposite(currentBody);
            if(parentComposite){
                var xDifference = (mousePosition.x - currentBody.position.x) - newX;
                var yDifference = (mousePosition.y - currentBody.position.y) - newY;
                Matter.Composite.translate(parentComposite, Matter.Vector.create(xDifference,yDifference));
                saveChildrensStates(parentComposite);
            } else{
                var newCurrentBodyx = mousePosition.x - newX;
                var newCurrentBodyy = mousePosition.y - newY;
                Matter.Body.setPosition(currentBody, Matter.Vector.create(newCurrentBodyx, newCurrentBodyy));
                var state = getInitialState(currentBody.id);
                state.x = currentBody.position.x;
                state.y = currentBody.position.y;
            }
		}
		return;
	} else if (mouseType === moveMouse && draggingVelocity){
        var drawVel = Vector.div(Vector.sub(mousePosition, currentBody.position), vizPhizOptions.velocityVectorScale);
        drawVel = convertToMatterTimeScale(drawVel);
        Matter.Body.setVelocity(currentBody, drawVel);
			state = getInitialState(currentBody.id);
			state.Vx = drawVel.x;
			state.Vy = drawVel.y;
    }
	if (mouseType === conMouse) {
		newW = mousePosition.x;
		newH = mousePosition.y;
	}
	else{
		newW = mousePosition.x - newX;
		newH = mousePosition.y - newY;
	}
});

var shiftPressed = false;
var ctrlPressed = false;

document.addEventListener('keydown', function (event) {
    var ctrlKey = 17;
    if (event.keyCode === ctrlKey)
		ctrlPressed = true;
	if (running)
		return;
	var deleteKey = 46,
		backspace = 8,
		shiftKey = 16,
		vKey = 86;
	
	if (event.keyCode === shiftKey)
		shiftPressed = true;
    
	if ((event.keyCode === backspace || event.keyCode === deleteKey ) && bodyEditor.style.display === "none")
	{
        if(currentBody){
            if(currentBody == origin){
                alert("You cannot delete the origin!");
                return;
            }
            var parentComp = getParentComposite(currentBody);
            if(parentComp)
                deleteComposite(parentComp);
            else
                deleteBody(currentBody);
            currentBody = null;
        }
        if(currentConstraint){
            World.remove(world, currentConstraint);
            currentConstraint = null;
            currentConstraintPoint = null;
        }
        if(currentForce){
            for(var f = 0; f<forces.length; f++){
                var force = forces[f];
                if(currentForce == force){
                    forces.splice(f,1);
                    f = forces.length;
                } 
            }
            currentForce = null;
        }
    }
	if ((event.keyCode === vKey) && (event.ctrlKey || event.metaKey) && currentBody) {
		
		//var copy = Matter.Common.clone(currentBody, true); //Why did this NOT work??
		var body = Bodies.rectangle(currentBody.position.x + 50, currentBody.position.y + 50, 10, 10);
		Matter.Body.setVertices(body, currentBody.vertices);
		Matter.Body.setVelocity(body, Matter.Vector.create(currentBody.velocity.x,currentBody.velocity.y));
		body.angle = currentBody.angle; //if you use setAngle it will rotate it more
		Matter.Body.setAngularVelocity(body, currentBody.angularVelocity);
		body.mass = currentBody.mass;
		body.friction = currentBody.friction;
		body.frictionStatic = currentBody.frictionStatic;
		body.frictionAir = currentBody.frictionAir;
		body.restitution = currentBody.restitution;
		body.render.fillStyle = currentBody.render.fillStyle;
		initialObjectStates.push(new createSavedState(body.id, 0, body.position.x, body.position.y, body.velocity.x, body.velocity.y, body.angle, body.angularVelocity, body.vertices));
		trackingStates.push(new createTrackingState(body.id));
		body.isStatic = currentBody.isStatic;
		if (isFixed(currentBody))
			fixedBodies.push(body);
		World.add(engine.world, body);
		currentBody = body;
		
	}
	
});

document.addEventListener('keyup', function (event) {
    var ctrlKey = 17;
    if (event.keyCode === ctrlKey){
		ctrlPressed = false;
        draggingWorld = false;
    }
	if (running)
		return;
	var shiftKey = 16;
	
	if (event.keyCode === shiftKey)
		shiftPressed = false;
    
});
	
var frame = 0;
Events.on(runner, 'beforeTick', function() {
	if (running) {
		time = engine.timing.timestamp / 1000.0;
		timeText.innerHTML = roundOffDecimals(time) + "s";
		var bodies = Matter.Composite.allBodies(world);
		if (bodies.length > 1) {
			for (var i=0; i<bodies.length; i+= 1)
			{
				var body = bodies[i];
				var savedState = new createSavedState(body.id, time, body.position.x, body.position.y, body.velocity.x, body.velocity.y, body.angle, body.angularVelocity, body.vertices);
				saveObjectState(body.id, savedState);
			}
			timeSlider.max = frame;
			timeSlider.value = frame;
            graphWindows.forEach(function(graphWindow){
				plotData(graphWindow);
            });
			frame++;
		}
        forces.forEach(function(force){
            var body = getBody(force.bodyID, bodies);
            Matter.Body.applyForce(body, Matter.Vector.add(force.position, body.position), Matter.Vector.create(force.force.x / (1000 * runner.delta), force.force.y / (1000 * runner.delta)));
        });
	}
});

function drawVector(x, y, Vx, Vy, color){
            pen.lineWidth = 2;
            pen.beginPath();
            pen.fillStyle = color;

            var x1 = x;
            var y1 = y;
            var x2 = x1 + (Vx);
            var y2 = y1 + (Vy);
            var length = Math.hypot(y2 - y1 , x2 - x1 ) * 0.7;
            var ang = Math.atan2( y2 - y1 , x2 - x1 );
            var ang1 = ang - Math.PI / 7;
            var ang2 = ang + Math.PI / 7;
            var x3 = x1 + length * Math.cos(ang1);
            var y3 = y1 + length * Math.sin(ang1);
            var x4 = x1 + length * Math.cos(ang2);
            var y4 = y1 + length * Math.sin(ang2);

            pen.moveTo(x1, y1);
            pen.lineTo(x2, y2);
            pen.lineTo(x3, y3);
            pen.lineTo(x4, y4);
            pen.lineTo(x2, y2);
            pen.stroke();
            pen.fill();    
}

function drawFatVector(x, y, Vx, Vy, color){
            pen.lineWidth = 2;
            pen.beginPath();
            pen.fillStyle = color;

            var x1 = x;
            var y1 = y;
            var x2 = x1 + (Vx);
            var y2 = y1 + (Vy);
            var length = Math.hypot(y2 - y1 , x2 - x1 ) * 0.7;
            var ang = Math.atan2( y2 - y1 , x2 - x1 );
            var ang1 = ang - Math.PI / 7;
            var ang2 = ang + Math.PI / 7;
            var x3 = x1 + length * Math.cos(ang1);
            var y3 = y1 + length * Math.sin(ang1);
            var x4 = x1 + length * Math.cos(ang2);
            var y4 = y1 + length * Math.sin(ang2);
    
            var ang3 = ang - Math.PI / 14;
            var ang4 = ang + Math.PI / 14;
            var x5 = x1 + length * Math.cos(ang3);
            var y5 = y1 + length * Math.sin(ang3);
            var x6 = x1 + length * Math.cos(ang4);
            var y6 = y1 + length * Math.sin(ang4);

            pen.moveTo(x1, y1);
            pen.lineTo(x5, y5);
            pen.lineTo(x6, y6);
            pen.moveTo(x1, y1);
    
            pen.lineTo(x2, y2);
            pen.lineTo(x3, y3);
            pen.lineTo(x4, y4);
            pen.lineTo(x2, y2);
            pen.stroke();
            pen.fill();    
}
/**
Events.on(engine, 'collisionStart', function() {
    var bodies = Matter.Composite.allBodies(world);
    bodies.forEach(function(body){
        if(body.force.x !=0 || body.force.y !=0)
            alert("Force: x:" + body.force.x * (1000 * runner.delta) + ", y:" + body.force.y * (1000 * runner.delta));
    });
    
});
**/
Events.on(render, 'beforeRender', function() {
    if(running && vizPhizOptions.followObject){
        var bodies = Matter.Composite.allBodies(world);
        var objectToFollow = getBody(vizPhizOptions.followObject, bodies);
        if(objectToFollow)
            Matter.Render.lookAt(render, objectToFollow, {x:vizPhizOptions.followPadding, y:vizPhizOptions.followPadding}, true);
    }
});

Events.on(render, 'afterRender', function() {
    Render.startViewTransform(render);
    var constraints = Matter.Composite.allConstraints(world);
    var bodies = Matter.Composite.allBodies(world);
    
	//Draw Origin
    
    pen.fillStyle = "white";
    pen.strokeStyle = "white";
    pen.font = "15px Arial";
    var xAxis = GridVectorToMatter(Matter.Vector.create(40, 0));
    var yAxis = GridVectorToMatter(Matter.Vector.create(0, 40));
    var xLabelPos = Matter.Vector.add(origin.position, GridVectorToMatter(Matter.Vector.create(50, 0)));
    var yLabelPos = Matter.Vector.add(origin.position, GridVectorToMatter(Matter.Vector.create(0, 50)));
    drawVector(origin.position.x, origin.position.y, xAxis.x, xAxis.y, "white");
    pen.strokeText("X", xLabelPos.x, xLabelPos.y );
    drawVector(origin.position.x, origin.position.y, yAxis.x, yAxis.y, "white");
    pen.strokeText("Y", yLabelPos.x, yLabelPos.y);
    pen.stroke();
    pen.fill();
    
	if (vizPhizOptions.showGrid) {
		pen.globalAlpha = 0.1;
		pen.beginPath();
		pen.strokeStyle = "white";
        var maxSize = Math.hypot(render.options.width, render.options.height);
		for (var x = 0; x < maxSize; x += 100) {
            var pt1 = GridPosVectorToMatter(Matter.Vector.create(x, -maxSize));
			pen.moveTo(pt1.x, pt1.y);
            var pt2 = GridPosVectorToMatter(Matter.Vector.create(x, maxSize));
			pen.lineTo(pt2.x, pt2.y);
            pt1 = GridPosVectorToMatter(Matter.Vector.create(-x, -maxSize));
			pen.moveTo(pt1.x, pt1.y);
            pt2 = GridPosVectorToMatter(Matter.Vector.create(-x, maxSize));
			pen.lineTo(pt2.x, pt2.y);
		}
		
		for (var y = 0; y < maxSize; y += 100) {
            pt1 = GridPosVectorToMatter(Matter.Vector.create(-maxSize, y));
            pen.moveTo(pt1.x, pt1.y);
            pt2 = GridPosVectorToMatter(Matter.Vector.create(maxSize, y));
            pen.lineTo(pt2.x, pt2.y);
            pt1 = GridPosVectorToMatter(Matter.Vector.create(-maxSize, -y));
            pen.moveTo(pt1.x, pt1.y);
            pt2 = GridPosVectorToMatter(Matter.Vector.create(maxSize, -y));
            pen.lineTo(pt2.x, pt2.y);
		}
		pen.stroke();
		pen.globalAlpha = 1;
	}
	
	if (vizPhizOptions.trackingON) {
		var tmax = timeSlider.value;
		for (var i=0; i<bodies.length; i+= 1) {
			var body = bodies[i];
            if(!isFixed(body)){
                var image = null;
                if(body.render.sprite.texture){
                    var sprite = body.render.sprite;
                    image = new Image();
                    image.src = sprite.texture;
                }

                for (var fram = 0; fram < tmax - 1; fram += vizPhizOptions.trackingFrameRate) {
                    var state = getSavedObjectState(body.id, fram);
                    if (state != null) {
                        if(image){
                            pen.translate(state.x, state.y);
                            pen.rotate(state.theta);
                            pen.drawImage(image, image.width * -sprite.xOffset * sprite.xScale, image.height * -sprite.yOffset * sprite.yScale, image.width * sprite.xScale, image.height * sprite.yScale)
                            pen.translate(-state.x, -state.y);
                            pen.rotate(-state.theta);
                        } else{
                            pen.lineWidth = 1;
                            pen.beginPath();
                            pen.fillStyle = body.render.fillStyle;
                            pen.strokeStyle = "white";
                            var vertices = state.vertices;
                            for (var vertex = 0; vertex < vertices.length; vertex+= 1) {
                                var v = vertices[vertex];
                                if (vertex === 0)
                                    pen.moveTo(v.x, v.y);
                                else
                                    pen.lineTo(v.x, v.y);
                                if (vertex === vertices.length - 1)
                                    pen.lineTo(vertices[0].x, vertices[0].y);
                            }
                            pen.stroke();
                            pen.globalAlpha = 0.2;
                            pen.fill();
                        }

                        pen.globalAlpha = 0.2;
                        pen.strokeStyle = "white";
                        if(render.options.showVelocity){
                            var displayVel = Vector.create(state.Vx, state.Vy);
                            displayVel = convertFromMatterTimeScale(displayVel);
                            displayVel = Vector.mult(displayVel, vizPhizOptions.velocityVectorScale);
                            drawVector(state.x,state.y, displayVel.x, displayVel.y, vizPhizOptions.velocityVectorColor);
                        }
                        pen.globalAlpha = 1;
                    }
                }	
            }
		}
        
        //We have to draw these things because they should be in front of tracking
        Render.bodies(render, bodies, pen);
        Render.bodyAxes(render, bodies, pen);
    
        if (render.options.showIds)
            Render.bodyIds(render, bodies, pen);
        Render.constraints(constraints, pen);
	}
    if(vizPhizOptions.showLabels)
        bodies.forEach(function(body){
            pen.beginPath();
            pen.strokeStyle = "green";
            pen.font = "20px Georgia";
            pen.strokeText(body.label, body.position.x + 5, body.bounds.min.y - 10);
            pen.stroke();   
        });
    
    forces.forEach(function(force){
            var body = getBody(force.bodyID, bodies);
            drawFatVector(force.position.x + body.position.x, force.position.y + body.position.y, force.force.x * vizPhizOptions.forceVectorScale, force.force.y * vizPhizOptions.forceVectorScale, vizPhizOptions.forceVectorColor);      
    });
    if(render.options.showVelocity)
        bodies.forEach(function(body){
            var displayVel = convertFromMatterTimeScale(body.velocity);
            displayVel = Vector.mult(displayVel, vizPhizOptions.velocityVectorScale);
            drawVector(body.position.x, body.position.y, displayVel.x, displayVel.y, vizPhizOptions.velocityVectorColor);     
        });
    
    fixedBodies.forEach(function(fixedBody){
        
		pen.beginPath();
		pen.strokeStyle = "red";
		pen.font = "8px Georgia";
		pen.strokeText("X", fixedBody.position.x - 3, fixedBody.position.y + 4);
		pen.rect(fixedBody.position.x - 7, fixedBody.position.y - 7, 15, 15);
		pen.stroke();
	});
	if (draggingBody) 
        if (currentForce) {
            pen.beginPath();
            pen.strokeStyle = "red";
            body = getBody(currentForce.bodyID, bodies);
            pen.strokeStyle = "red";
            pen.font = "20px Georgia";
            var displayForce = VectorFromMatter(currentForce.force);
            pen.strokeText("Force: " + roundOffDecimals(displayForce.x) + " N x, " + roundOffDecimals(displayForce.y) + " N y", currentForce.position.x + body.position.x + 5, currentForce.position.y + body.bounds.max.y + 20);
            drawFatVector(currentForce.position.x + body.position.x, currentForce.position.y + body.position.y, currentForce.force.x * vizPhizOptions.forceVectorScale, currentForce.force.y * vizPhizOptions.forceVectorScale, vizPhizOptions.forceVectorColor); 
            pen.stroke();
        } else if (shiftPressed) {
			pen.fillStyle = currentBody.render.fillStyle;
			pen.strokeStyle = "white";
			pen.lineWidth = 2;
			pen.beginPath();
			vertices = copyVertices(currentBody.vertices);
			var rotationAngle = Math.atan2(newH, newW) - Math.atan2(newY, newX);
			Matter.Vertices.rotate (vertices, rotationAngle, currentBody.position);
			vertices.forEach(function(v){
				if (v === vertices[0])
					pen.moveTo(v.x, v.y);
				else
					pen.lineTo(v.x, v.y);
				if (vertex === vertices.length - 1)
					pen.lineTo(vertices[0].x, vertices[0].y);
			});
			pen.strokeStyle = "red";
			pen.font = "20px Georgia";
            var angle = PosAngleFromMatter(currentBody.angle + rotationAngle);
            if(vizPhizOptions.useDegrees)
                pen.strokeText("Angle: " + roundOffDecimals(Math.toDegrees(angle)) + " deg", currentBody.position.x + 5, currentBody.bounds.max.y + 20);
            else 
                pen.strokeText("Angle: " + roundOffDecimals(angle) + " rad", currentBody.position.x + 5, currentBody.bounds.max.y + 20);
			pen.stroke();
			pen.globalAlpha = 0.2;
			pen.fill();
			pen.globalAlpha = 1;
		} else if (rightClicking) {
			pen.fillStyle = currentBody.render.fillStyle;
			pen.strokeStyle = "white";
			pen.lineWidth = 2;
			pen.beginPath();
			vertices = copyVertices(currentBody.vertices);
			Matter.Vertices.scale(vertices, newW/newX, newH/newY, currentBody.position);
            vertices.forEach(function(v){
				if (v === vertices[0])
					pen.moveTo(v.x, v.y);
				else
					pen.lineTo(v.x, v.y);
				if (vertex === vertices.length - 1)
					pen.lineTo(vertices[0].x, vertices[0].y);
			});
			pen.strokeStyle = "red";
			pen.font = "20px Georgia";
			var w = (currentBody.bounds.max.x - currentBody.bounds.min.x) * newW/newX;
			var h = (currentBody.bounds.max.y - currentBody.bounds.min.y) * newH/newY;
			
			pen.stroke();
			pen.globalAlpha = 0.2;
			pen.fill();
			pen.globalAlpha = 1;
            pen.strokeText("Size: " + roundOffDecimals(w) + " m, " + roundOffDecimals(h) + " m", currentBody.position.x + 5, currentBody.bounds.max.y + 20);
		} else if(currentBody){
			pen.lineWidth = 2;
			pen.beginPath();
			pen.strokeStyle = "red";
			pen.font = "20px Georgia";
            var displayPos = PosVectorFromMatter(currentBody.position);
			pen.strokeText("Position: " + roundOffDecimals(displayPos.x) + " m x, " + roundOffDecimals(displayPos.y) + " m y", currentBody.position.x + 5, currentBody.bounds.max.y + 20);
			pen.stroke();
		} else if(currentConstraintPoint){
			pen.lineWidth = 2;
			pen.beginPath();
			pen.strokeStyle = "red";
			pen.font = "20px Georgia";
            displayPos = PosVectorFromMatter(currentConstraintPoint);
			pen.strokeText("Position: " + roundOffDecimals(displayPos.x) + " m x, " + roundOffDecimals(displayPos.y) + " m y", currentConstraintPoint.x + 5, currentConstraintPoint.y + 20);
			pen.stroke();
		}
	//end draggingbody
    if(draggingVelocity){
        pen.lineWidth = 2;
        pen.beginPath();
        pen.strokeStyle = "red";
        pen.font = "20px Georgia";
        var displayVel = convertFromMatterVelocity(currentBody.velocity);
        pen.strokeText("Velocity: " + roundOffDecimals(displayVel.x) + " m/s x, " + roundOffDecimals(displayVel.y) + " m/s y", currentBody.position.x + 5, currentBody.bounds.max.y + 20);
        pen.stroke();
    }
	if (newObject) {
        pen.lineWidth = 2;
		pen.fillStyle = "yellow";
		pen.strokeStyle = "yellow";
		pen.beginPath();
		if (mouseType === boxMouse)
			pen.rect(newX, newY, newW, newH);
		if (mouseType === circleMouse)
		{
			//pen.ellipse(newX + newW / 2, newY + newH / 2, newW / 2,newH / 2, 0, 2 * Math.PI, false);
			var r = Math.sqrt(Math.pow(newW, 2)+ Math.pow(newH, 2));
			pen.ellipse(newX, newY, r,r, 0, 2 * Math.PI, false);
		}
		if (mouseType === polyMouse) {
			r = Math.sqrt(Math.pow(newW, 2)+ Math.pow(newH, 2));
			pen.ellipse(newX, newY, r,r, 0, 2 * Math.PI, false);
		}
		if (mouseType === compMouse)
			pen.rect(newX, newY, newW, newH);
		if (mouseType === carMouse)
			pen.rect(newX, newY, newW, newH);
		if (mouseType === conMouse) {
			pen.moveTo(newX, newY);
			pen.lineTo(newW, newH);
		}
        if (mouseType === forceMouse){
            drawFatVector(newX,newY, newW, newH, vizPhizOptions.forceVectorColor);
            pen.strokeStyle = "red";
            pen.font = "20px Georgia";
            displayForce = VectorFromMatter(Matter.Vector.create(newW / vizPhizOptions.forceVectorScale, newH / vizPhizOptions.forceVectorScale));
            pen.strokeText("Force: " + roundOffDecimals(displayForce.x) + "N x, " + roundOffDecimals(displayForce.y) + "N y", newX + 5, currentBody.bounds.max.y + 20);
        }
        pen.globalAlpha = 0.3;
		pen.stroke();
		pen.fill();
		pen.globalAlpha = 1;
    }
    if (currentConstraint && currentConstraintPoint) {
		pen.beginPath();
		pen.strokeStyle = "yellow";
        pen.rect(currentConstraintPoint.x - 5, currentConstraintPoint.y - 5, 10, 10);
        var pointA = getPointALocation(currentConstraint);
        var pointB = getPointBLocation(currentConstraint);
        pen.moveTo(pointA.x, pointA.y);
        pen.lineTo(pointB.x, pointB.y)
		pen.stroke();
	}
	if (currentBody) {
		pen.beginPath();
		pen.strokeStyle = "yellow";
		var bounds = currentBody.bounds;
		w = bounds.max.x - bounds.min.x;
		h = bounds.max.y - bounds.min.y;
		pen.rect(currentBody.position.x - w/2, currentBody.position.y - h/2, w, h);
		pen.stroke();
	}
    if (currentForce) {
		pen.beginPath();
		pen.strokeStyle = "yellow";
        body = getBody(currentForce.bodyID, bodies);
        drawFatVector(currentForce.position.x + body.position.x, currentForce.position.y + body.position.y, currentForce.force.x * vizPhizOptions.forceVectorScale, currentForce.force.y * vizPhizOptions.forceVectorScale, vizPhizOptions.forceVectorColor); 
		pen.stroke();
	}
    if (measuringWorld){
        pen.beginPath();
		pen.strokeStyle = "blue";
        pen.font = "20px Georgia";
        pen.moveTo(newX, newY);
        pen.lineTo(newW, newH);
        var distance = VectorFromMatter(Matter.Vector.create(newW - newX, newH - newY));
        pen.strokeText("Distance: " + roundOffDecimals(Vector.magnitude(distance)) + " m", (newX + newW) / 2, (newY + newH) / 2);
        pen.stroke();
    }
    
     Render.endViewTransform(render);

});

 // get the centre of the viewport
    var viewportCentre = {
        x: render.options.width * 0.5,
        y: render.options.height * 0.5
    };


    // keep track of current bounds scale (view zoom)
    var boundsScaleTarget = 1,
        boundsScale = {
            x: 1,
            y: 1
        };


// use the engine tick event to control our view
    Events.on(engine, 'beforeTick', function() {
        var world = engine.world,
            mouse = mouseConstraint.mouse,
            translate;

        // mouse wheel controls zoom
        var scaleFactor = mouse.wheelDelta * -0.1;
        if (scaleFactor !== 0) {
            if ((scaleFactor < 0 && boundsScale.x >= 0.6) || (scaleFactor > 0 && boundsScale.x <= 1.4)) {
                boundsScaleTarget += scaleFactor;
            }
        }

        // if scale has changed
        if (Math.abs(boundsScale.x - boundsScaleTarget) > 0.01) {
            // smoothly tween scale factor
            scaleFactor = (boundsScaleTarget - boundsScale.x) * 0.2;
            boundsScale.x += scaleFactor;
            boundsScale.y += scaleFactor;

            // scale the render bounds
            render.bounds.max.x = render.bounds.min.x + render.options.width * boundsScale.x;
            render.bounds.max.y = render.bounds.min.y + render.options.height * boundsScale.y;

             // get vector from mouse relative to centre of viewport
            var deltaCentre = Vector.sub(mouse.absolute, viewportCentre);
            
            // translate so zoom is from centre of mouse position
            translate = {
                x: (render.options.width * 0.5 + deltaCentre.x)  * -scaleFactor,
                y: (render.options.height * 0.5 + deltaCentre.y)  * -scaleFactor
            };

            Bounds.translate(render.bounds, translate);

            // update mouse
            Mouse.setScale(mouse, boundsScale);
            Mouse.setOffset(mouse, render.bounds.min);
        }
    });

