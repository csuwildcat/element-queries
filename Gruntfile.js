module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    
    'smush-components': {
      options: {
        fileMap: {
          js: 'demo/x-tag-components.js',
          css: 'demo/x-tag-components.css'
        }
      }
    },
    bumpup: ['component.json', 'package.json', 'xtag.json'],
    tagrelease: {
      file: 'package.json',
      prefix: 'xtag-v',
      commit: true
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-bumpup');
  grunt.loadNpmTasks('grunt-tagrelease');
  grunt.loadNpmTasks('grunt-smush-components');

  grunt.registerTask('build', ['smush-components']);
  grunt.registerTask('bump:patch', ['bumpup:patch', 'tagrelease']);


};