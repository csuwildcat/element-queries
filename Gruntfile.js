module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    connect: {
      demo: {
        options:{
          port: 3001,
          base: '',
          keepalive: true
        }
      }
    },
    jshint:{
      all: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js']
    },
    'smush-components': {
      options: {
        fileMap: {
          js: 'demo/x-tag-components.js',
          css: 'demo/x-tag-components.css'
        }
      }
    },
    bumpup: ['bower.json', 'package.json', 'xtag.json'],
    tagrelease: {
      file: 'package.json',
      prefix: '',
      commit: true
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-bumpup');
  grunt.loadNpmTasks('grunt-tagrelease');
  grunt.loadNpmTasks('grunt-smush-components');

  grunt.registerTask('build', ['jshint','smush-components']);
  grunt.registerTask('bump:patch', ['bumpup:patch', 'tagrelease']);

};
