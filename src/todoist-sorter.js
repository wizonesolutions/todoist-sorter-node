var async = require('async');
var _ = require('underscore');
var _s = require('underscore.string');

// Mix Underscore.string into Underscore
_.mixin(_s.exports());

var TodoistSorter = {};
var api;

TodoistSorter.setApi = function (localApi) {
  // TERRIBLE. TODO: Make this a class property.
  api = localApi;
}

function processTask(matches, data2, item, callback) {
  // @todo: Lowercase all names in data2 so the later findWhere calls can match
  // case-insensitively. Store todoistSorterOriginalName with the original case for when
  // we display messages later.

  // What word actually matched?
  projectName = matches[2];
  console.log("Project name: " + projectName)

  // OK great, now try to find a project with this name.
  var project = _.findWhere(data2, { name: projectName });

  if (_.isEmpty(project)) {
    // See if we have a partial match with exactly one project.
    var projectNames = _.pluck(data2, 'name');
    var matchingProjects = _.filter(projectNames, function (value) {
      return _s.include(value, projectName);
    });

    console.log('Might mean: ');
    console.log(matchingProjects);

    if (! _.isEmpty(matchingProjects)) {
      if (matchingProjects.length == 1) {
        project = _.findWhere(data2, { name: _.first(matchingProjects) });
      }
      else {
        console.log('Using closest match...');
        // Compile array of Levenshtein distances
        var matchDistances = [];
        _.each(matchingProjects, function (match) {
          matchDistances.push({ name: match, distance: _.levenshtein(projectName, match), length: match.length });
        });

        // console.log(matchDistances);

        // Use the name from the object having the lowest Levenshtein distance.
        var sortedMatches = _.sortBy(matchDistances, 'distance');
        // console.log(sortedMatches);
        var firstMatch = _.first(sortedMatches);
        // console.log(firstMatch);

        // Are there other elements with the same distance?
        var contenders = _.where(sortedMatches, { distance: firstMatch.distance });

        if (contenders.length == 1) {
          project = _.findWhere(data2, { name: firstMatch.name });
        }
        else {
          console.log("Still multiple matches, going with the one sorted higher in Todoist...")
          // If we have multiple matches, go with the shorter name.
          // If they are the same length, _.min() will return the first one.
          // We'll sort by project name length to make sure.
          var shortest = _.min(_.sortBy(contenders, 'length'), function (contender) {
            return contender.length;
          });

          project = _.findWhere(data2, { name: shortest.name });
        }

        // Partial matching ain't easy.
      }
    }
  }

  if (project) {
    var projectId = project.id;

    console.log("Matched project name: " + project.name);
    // console.log("Project ID: " + projectId)

    // Finally, move the item to this project. Then we are done.
    var projectMapping = {};
    projectMapping[item.project_id] = [item.id.toString()];
    api.request('moveItems', { project_items: JSON.stringify(projectMapping), to_project: projectId.toString() }, function (err3, res3, data3) {
      if (err3) {
        console.log("Problem moving task");
        console.log(err3);
        callback(true);
      }
      else {
        console.log('Task "' + item.content + '" moved to project "' + project.name + '"');

        api.request('updateItem', { id: item.id, content: (matches[1] + matches[3]).trim() }, function (err4, res4, data4) {
          if (err4) {
            console.log("Couldn't fix task name");
            console.log(err4);
            callback(true);
          }
          else {
            // Silence.
            callback();
          }
        });
      }
    });
  }
  else {
    console.log("No matching project for " + matches[2])
    callback();
  }
}

TodoistSorter.checkForNewTasks = function () {
  api.request('getUncompletedItems', { project_id: api.user.inbox_project }, function (err, res, data) {
    if (err) {
      console.log('Error checking for new tasks:');
      console.log(err);
    }
    else {
      if (! _.isEmpty(data)) {
        console.log("Scanning Todoist inbox for projects to move...")

        var cachedProjects;

        async.each(data, function (item, callback) {
          var matches;
          var search = /(.*)##([^\s]+)(.*)/;
          if (matches = search.exec(item.content)) {
            // console.log(item);

            console.log("Moving task \"" + item.content + "\"...");

            // Only populate projects if we actually have any tasks to process.
            if (_.isEmpty(cachedProjects)) {
              api.request('getProjects', {}, function (err2, res2, data2) {
                cachedProjects = data2;
                if (err2) {
                  console.log("Error getting projects");
                }
                else {
                  processTask(matches, cachedProjects, item, callback);
                }
              });
            }
            else {
              processTask(matches, cachedProjects, item, callback);
            }
          }
        }
          // End callback.
          , function () {
          console.log("Done checking tasks.");
        });
      }
      else {
        console.log("No data");
      }
    }
  });
}

module.exports = TodoistSorter;
