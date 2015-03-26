angular.module('sfObject')
  .directive('sfDate', function() {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function(element, scope, attrs, dateCtrl) {
        function dateFromSF(val) {
          if (val) return new Date(val)
        }

        function dateToSF(val) {
          if (val) return val.getTime();
        }

        dateCtrl.$formatters.push(dateFromSF);
        dateCtrl.$parsers.push(dateToSF);
      }
    };
  });
