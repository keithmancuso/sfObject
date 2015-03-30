module.exports = function(grunt) {

  grunt.initConfig({
    connect: {
      server: {
        options: {
          protocol: 'https',
          port: 8443,
          hostname: 'localhost',
          keepalive: true,
          base: 'demo',
          key: grunt.file.read('../../ssl/server.key').toString(),
          cert: grunt.file.read('../../ssl/server.crt').toString(),
          ca: grunt.file.read('../../ssl/ca.crt').toString()
        }
      }
    },
    concat: {
      dist: {
        src: 'src/**/*.js',
        dest: 'dist/sfobject.js'
      }
    },
    uglify: {
      my_target: {
        files: {
          'dist/sfobject.min.js': ['dist/sfobject.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('default', ['connect']);
  grunt.registerTask('serve', ['connect']);

  grunt.registerTask('build', [
    'concat',
    'uglify',
  ]);
};
