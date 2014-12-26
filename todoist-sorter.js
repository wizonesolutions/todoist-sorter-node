#!/usr/bin/env node
var fs = require('fs')
  , persist = require('node-persist')
  , async = require('async')
  , Todoist = require('node-todoist-api')
  , TodoistSorter = require('./src/todoist-sorter');

var api;

//var interval;
//var frequency = (+settings.todoistCheckFrequency * 60000) || 300000;

// Read settings.json
var settingsFileName = './settings.json';
var settingsFound = fs.existsSync(settingsFileName);
var settings;

if (settingsFound) {
  var settingsText = fs.readFileSync(settingsFileName);
  try {
    settings = JSON.parse(settingsText);
  }
  catch (e) {
    console.log("Error!", e);
    return;
  }
}

if (settings && settings.todoistEmail && settings.todoistPassword) {
  console.log("Logging in...")
  try {
    // TODO: Persist the Todoist user object somehow.
    api = new Todoist(settings.todoistEmail, settings.todoistPassword, function (err, resp, user) {
      if (typeof user !== undefined) {
//      console.log("Checking for new tasks now and every " + (frequency / 1000 / 60) + " minutes...");
//      TodoistSorter.checkForNewTasks();
//      interval = setInterval(TodoistSorter.checkForNewTasks, frequency); // every 5 minutes
        console.log("Logged in")
        TodoistSorter.setApi(this);
        TodoistSorter.checkForNewTasks();
      }
      else {
        console.log("Couldn't log in. Incorrect username/password?");
      }
    });
  }
  catch (err) {
    console.log("Error");
    console.log(err)
  }
}
