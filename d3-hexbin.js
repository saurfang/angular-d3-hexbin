angular.module('angular-d3-hexbin', []).
    directive('ngHexbin', function () {
        return {
            restrict: 'E',
            scope: {
                data: '=',
                x: '=?',
                y: '=?',
                count: '=?',
                radius: '=?',
                axisLabels: '=?',
                zoom: '=?',
                color: '=?',
                tip: '=?'
            },
            controller: function ($scope) {
                $scope.x = $scope.x || function (d) {
                    return d[0];
                };
                $scope.y = $scope.y || function (d) {
                    return d[1];
                };
                $scope.radius = Math.abs($scope.radius) || 10;
                $scope.zoom = angular.isDefined($scope.zoom) ? $scope.zoom : true;
                $scope.color = $scope.color ||
                    d3.scale.linear()
                        .domain([0, 20])
                        .range(['white', 'steelblue'])
                        .interpolate(d3.interpolateLab);
                $scope.count = $scope.count || function (d) {
                    return d.length;
                };
                $scope.axisLabels = $scope.axisLabels || ['', ''];
            },
            link: function (scope, element, attrs) {
                var margin = {top: 10, right: 20, bottom: 60, left: 50},
                    width = element.width() - margin.left - margin.right,
                    height = element.width() - margin.top - margin.bottom;

                var hexbin = d3.hexbin()
                    .x(function (d) {
                        return x(scope.x(d));
                    })
                    .y(function (d) {
                        return y(scope.y(d));
                    })
                    .size([width, height])
                    .radius(scope.radius);

                var x = d3.scale.linear()
                    .range([0, width]);

                var y = d3.scale.linear()
                    .range([height, 0]);

                var xAxis = d3.svg.axis()
                    .scale(x)
                    .orient('bottom')
                    .tickSize(6, -height);

                var yAxis = d3.svg.axis()
                    .scale(y)
                    .orient('left')
                    .tickSize(6, -width);

                var zoomed = function () {
                    container.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
                    svg.select('.x.axis').call(xAxis);
                    svg.select('.y.axis').call(yAxis);
                };

                var zoom = d3.behavior.zoom()
                    .scaleExtent([1, Infinity])
                    .x(x)
                    .y(y)
                    .on('zoom', zoomed);

                var tooltip = d3.select(element[0]).append('div')
                    .attr('class', 'd3tip hidden');

                var svg = d3.select(element[0]).append('svg')
                    .attr('width', width + margin.left + margin.right)
                    .attr('height', height + margin.top + margin.bottom)
                    .append('g')
                    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

                if (scope.zoom) {
                    svg.call(zoom); //TODO: Avoid zoom on Axis

                    //Add rect so zoom can be activated in empty space
                    svg.append('rect')
                        .attr('class', 'pane')
                        .attr('width', width)
                        .attr('height', height);
                }

                //Use svg to clip to support pan without redraw
                var container = svg.append('svg')
                    .attr('width', width)
                    .attr('height', height)
                    .append('g');

                var hexagon = container
                    .selectAll('.hexagon');

                svg.append('g')
                    .attr('class', 'y axis')
                    .call(yAxis);

                svg.append('g')
                    .attr('class', 'x axis')
                    .attr('transform', 'translate(0,' + height + ')')
                    .call(xAxis);

                var xLab = svg.append('text')
                    .attr('class', 'x label')
                    .attr('text-anchor', 'middle')
                    .attr('x', width / 2)
                    .attr('y', height + 30);

                var yLab = svg.append('text')
                    .attr('class', 'y label')
                    .attr('text-anchor', 'middle')
                    .attr('x', -height / 2)
                    .attr('y', -40)
                    .attr('transform', 'rotate(-90)');

                var redraw = function() {
                    var bins = hexbin(scope.data);
                    //Readjust color domain according to density and cache total count for each bin
                    if (bins.length) {
                        var maxCount = 0;
                        bins.forEach(function (d) {
                            var count = scope.count(d);
                            if (count > maxCount) {
                                maxCount = count;
                            }
                            d.total = count;
                        });
                        scope.color = scope.color.domain([0, maxCount]);
                    }

                    hexagon = hexagon.data(bins, function (d) {
                        return d.i + ',' + d.j;
                    });

                    hexagon.exit().remove();

                    hexagon.enter().append('path')
                        .attr('class', 'hexagon');

                    if(angular.isDefined(scope.tip)){
                        hexagon
                            .on('mousemove', function (d, i) {
                                var mouse = d3.mouse(svg.node()).map(function (d) {
                                    return parseInt(d);
                                });

                                tooltip
                                    .classed('hidden', false)
                                    .attr('style', 'left:' + (mouse[0] + 25) + 'px;top:' + (mouse[1] - 30) + 'px')
                                    .html(scope.tip(d))
                            })
                            .on('mouseout', function (d, i) {
                                tooltip.classed('hidden', true)
                            });
                    }

                    //TODO: Is redrawing every hexagon a significant performance hit when binSize doesn't change?
                    //We can potentially avoid this if we can embed radius in data key properly
                    hexagon
                        .attr('transform', function (d) {
                            return 'translate(' + d.x + ',' + d.y + ')';
                        })
                        .attr('d', hexbin.hexagon())
                        .style('fill', function (d) {
                            return scope.color(d.total);
                        });
                };

                scope.$watch('data', function () {
                    if(scope.data.length){
                        x.domain(d3.extent(scope.data, scope.x));
                        y.domain(d3.extent(scope.data, scope.y));
                    }
                    zoom = zoom.x(x).y(y);
                    container.attr('transform', null);

                    var t = svg.transition().duration(500);
                    t.select('.x.axis').call(xAxis);
                    t.select('.y.axis').call(yAxis);

                    redraw();
                });

                scope.$watch('radius', function () {
                    hexbin = hexbin.radius(scope.radius);

                    redraw();
                });

                scope.$watch('axisLabels', function(){
                    xLab.text(scope.axisLabels[0]);
                    yLab.text(scope.axisLabels[1]);
                });
            }
        };
    }).

    // Making a Heat Map Legend with D3
    // Source: http://bl.ocks.org/nowherenearithaca/4449376
    directive('ngHexbinLegend', function () {
        var margin = {top: 5, right: 20, bottom: 15, left: 5},
            height = 35, numberHues = 100;

        return {
            restrict: 'E',
            scope: {
                color: '='
            },
            link: function (scope, element, attrs) {
                var width = element.width();

                var idGradient = 'legendGradient';

                var svg = d3.select(element[0]).append('svg')
                    .attr('width', '100%')
                    .attr('height', height);

                //create the empty gradient that we're going to populate later
                svg.append('g')
                    .append('defs')
                    .append('linearGradient')
                    .attr('id', idGradient)
                    .attr('x1', '0%')
                    .attr('x2', '100%')
                    .attr('y1', '0%')
                    .attr('y2', '0%');

                svg.append('rect')
                    .attr('fill', 'url(#' + idGradient + ')')
                    .attr('x', margin.left)
                    .attr('y', margin.top)
                    .attr('width', width - margin.left - margin.right)
                    .attr('height', height - margin.top - margin.bottom)
                    .style('stroke', 'black')
                    .style('stroke-width', '0.5px');

                //add text on either side of the bar
                svg.append('text')
                    .attr('class', 'legendText')
                    .attr('text-anchor', 'middle')
                    .attr('x', margin.left)
                    .attr('y', height)
                    .text('0');

                var maxHue = svg.append('text')
                    .attr('class', 'legendText')
                    .attr('text-anchor', 'middle')
                    .attr('x', width - margin.right)
                    .attr('y', height);

                //TODO: $watch doesn't really work on color currently
                scope.$watch('color', function (newVal, oldVal) {
                    var upper = d3.max(scope.color.domain());
                    var stops = d3.select('#' + idGradient).selectAll('stop')
                        .data(d3.range(numberHues).map(function (i) {
                            return {
                                percent: i / numberHues,
                                color: scope.color(i / numberHues * upper)
                            };
                        }));

                    stops.exit().remove();

                    stops.enter().append('stop');

                    stops.attr('offset', function (d) {
                            return d.percent;
                        })
                        .attr('stop-color', function (d) {
                            return d.color;
                        });
                }, true);

                scope.$watch('color.domain()', function (newVal, oldVal) {
                    var upper = d3.max(scope.color.domain());
                    maxHue.text(upper);
                });
            }
        };
    });