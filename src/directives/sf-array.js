angular.module('sfObject')
  .directive('sfArray', function() {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function(scope, element, attrs, controller) {

        function toView(val) {
          if (val) return val.split(';');
        }

        function toModel(val) {
          if (val) return val.join(';');
        }

        controller.$formatters.push(toView);
        controller.$parsers.push(toModel);
      }
    };
  });
