'use strict';

var path = require('path');

var gulp = require('gulp');
var runSequence = require('run-sequence');
var del = require('del');
var named = require('vinyl-named');
var webpack = require('gulp-webpack');

// webpack entries
var ENTRIES = [
  'background/background.js',
  'contentscript/contentscript.js',
  'options/options.js',
  'popup/popup.js'
];

gulp.task('clean', function (done) {
  del(['build/**'], done);
});

gulp.task('bundle', function () {
  return gulp.src(ENTRIES, {cwd: 'app', cwdbase: true})
    .pipe(named(function (file) {
      // Name relative to `cwd` above
      var r = file.relative;
      return path.join(path.dirname(r), path.basename(r, path.extname(r)));
    }))
    .pipe(webpack({
      devtool: 'source-map'
    }))
    .pipe(gulp.dest('build/'));
});

gulp.task('copy', function () {
  return gulp.src(['**', '!**/*.js'], {cwd: 'app'})
    .pipe(gulp.dest('build/'));
});

gulp.task('build', function (done) {
  runSequence('clean', ['bundle', 'copy'], done);
});
