(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-quadtree'), require('d3-collection'), require('d3-dispatch'), require('d3-timer')) :
  typeof define === 'function' && define.amd ? define(['exports', 'd3-quadtree', 'd3-collection', 'd3-dispatch', 'd3-timer'], factory) :
  (factory((global.d3_force = global.d3_force || {}),global.d3_quadtree,global.d3_collection,global.d3_dispatch,global.d3_timer));
}(this, function (exports,d3Quadtree,d3Collection,d3Dispatch,d3Timer) { 'use strict';

  var version = "0.3.0";

  function center(x, y) {
    var nodes;

    if (x == null) x = 0;
    if (y == null) y = 0;

    function force() {
      var i,
          n = nodes.length,
          node,
          sx = 0,
          sy = 0;

      for (i = 0; i < n; ++i) {
        node = nodes[i], sx += node.x, sy += node.y;
      }

      for (sx = sx / n - x, sy = sy / n - y, i = 0; i < n; ++i) {
        node = nodes[i], node.x -= sx, node.y -= sy;
      }
    }

    force.initialize = function(_) {
      nodes = _;
    };

    force.x = function(_) {
      return arguments.length ? (x = +_, force) : x;
    };

    force.y = function(_) {
      return arguments.length ? (y = +_, force) : y;
    };

    return force;
  }

  function constant(x) {
    return function() {
      return x;
    };
  }

  function x(d) {
    return d.x + d.vx;
  }

  function y(d) {
    return d.y + d.vy;
  }

  function collide(radius) {
    var nodes,
        radii,
        radiusMax,
        strength = 0.7,
        iterations = 1;

    if (typeof radius !== "function") radius = constant(radius == null ? 1 : +radius);

    function force() {
      var i, n = nodes.length,
          tree = d3Quadtree.quadtree(nodes, x, y),
          node,
          nx,
          ny,
          nr,
          vx,
          vy,
          nx0,
          ny0,
          nx1,
          ny1;

      for (var k = 0; k < iterations; ++k) {
        for (i = 0; i < n; ++i) {
          node = nodes[i], nr = radii[i] + radiusMax, vx = vy = 0;
          nx = node.x + node.vx, nx0 = nx - nr, nx1 = nx + nr;
          ny = node.y + node.vy, ny0 = ny - nr, ny1 = ny + nr;
          tree.remove(node).visit(apply);
          node.vx += vx * strength, node.vy += vy * strength;
          tree.add(node);
        }
      }

      function apply(quad, x0, y0, x1, y1) {
        if (x0 > nx1 || x1 < nx0 || y0 > ny1 || y1 < ny0) return true;
        if (quad.length) return;
        var x = nx - quad.data.x - quad.data.vx,
            y = ny - quad.data.y - quad.data.vy,
            l = x * x + y * y,
            r = radii[i] + radii[quad.data.index];
        if (l < r * r) {
          l = (r - (l = Math.sqrt(l))) / l;
          vx += x * l, vy += y * l;
        }
      }
    }

    force.initialize = function(_) {
      var i, n = (nodes = _).length, r;
      radii = new Array(n);
      radiusMax = 0;
      for (i = 0; i < n; ++i) {
        if ((radii[i] = r = +radius(nodes[i], i, nodes)) > radiusMax) {
          radiusMax = r;
        }
      }
    };

    force.iterations = function(_) {
      return arguments.length ? (iterations = +_, force) : iterations;
    };

    force.strength = function(_) {
      return arguments.length ? (strength = +_, force) : strength;
    };

    force.radius = function(_) {
      return arguments.length ? (radius = typeof _ === "function" ? _ : constant(+_), force) : radius;
    };

    return force;
  }

  function contain(radius, x, y) {
    var nodes,
        rz,
        xz,
        yz;

    if (typeof radius !== "function") radius = constant(radius == null ? 100 : +radius);
    if (typeof x !== "function") x = constant(x == null ? 0 : +x);
    if (typeof y !== "function") y = constant(y == null ? 0 : +y);

    function force() {
      for (var i = 0, n = nodes.length, node, x, y, l, r; i < n; ++i) {
        node = nodes[i];
        x = node.x - xz[i];
        y = node.y - yz[i];
        if ((l = x * x + y * y) > (r = rz[i]) * r) {
          l = Math.sqrt(l), l = (l - r) / l;
          node.vx -= x * l;
          node.vy -= y * l;
        }
      }
    }

    function initialize() {
      if (!nodes) return;
      var i, n = nodes.length;
      rz = new Array(n);
      xz = new Array(n);
      yz = new Array(n);
      for (i = 0; i < n; ++i) {
        rz[i] = +radius(nodes[i], i, nodes);
        xz[i] = +x(nodes[i], i, nodes);
        yz[i] = +y(nodes[i], i, nodes);
      }
    }

    force.initialize = function(_) {
      nodes = _;
      initialize();
    };

    force.radius = function(_) {
      return arguments.length ? (radius = typeof _ === "function" ? _ : constant(+_), initialize(), force) : radius;
    };

    force.x = function(_) {
      return arguments.length ? (x = typeof _ === "function" ? _ : constant(+_), initialize(), force) : x;
    };

    force.y = function(_) {
      return arguments.length ? (y = typeof _ === "function" ? _ : constant(+_), initialize(), force) : y;
    };

    return force;
  }

  var tau = 2 * Math.PI;

  function index(d, i) {
    return i;
  }

  function link(links) {
    var id = index,
        strength = constant(0.7),
        strengths,
        distance = constant(30),
        distances,
        nodes,
        bias,
        iterations = 1;

    if (links == null) links = [];

    function force(alpha) {
      for (var k = 0, n = links.length; k < iterations; ++k) {
        for (var i = 0, link, source, target, x, y, l, b; i < n; ++i) {
          link = links[i], source = link.source, target = link.target;
          x = target.x + target.vx - source.x - source.vx;
          y = target.y + target.vy - source.y - source.vy;
          if (l = x * x + y * y) l = Math.sqrt(l), l = (l - distances[i]) / l;
          else l = Math.random() * tau, x = Math.cos(l), y = Math.sin(l), l = distances[i];
          l *= alpha * strengths[i], x *= l, y *= l;
          target.vx -= x * (b = bias[i]);
          target.vy -= y * b;
          source.vx += x * (b = 1 - b);
          source.vy += y * b;
        }
      }
    }

    function initialize() {
      if (!nodes || !links) return;

      var i,
          n = nodes.length,
          m = links.length,
          count = new Array(n),
          nodeById = d3Collection.map(nodes, id),
          link;

      for (i = 0; i < n; ++i) {
        count[i] = 0;
      }

      for (i = 0, bias = new Array(m); i < m; ++i) {
        link = links[i], link.index = i;
        if (typeof link.source !== "object") link.source = nodeById.get(link.source);
        if (typeof link.target !== "object") link.target = nodeById.get(link.target);
        ++count[link.source.index], ++count[link.target.index];
      }

      for (i = 0; i < m; ++i) {
        link = links[i], bias[i] = count[link.source.index] / (count[link.source.index] + count[link.target.index]);
      }

      if (!strengths) for (i = 0, strengths = new Array(m); i < m; ++i) {
        strengths[i] = +strength(links[i]);
      }

      if (!distances) for (i = 0, distances = new Array(m); i < m; ++i) {
        distances[i] = +distance(links[i]);
      }
    }

    force.initialize = function(_) {
      nodes = _;
      initialize();
    };

    force.links = function(_) {
      return arguments.length ? (links = _, strengths = distances = null, initialize(), force) : links;
    };

    force.id = function(_) {
      return arguments.length ? (id = _, initialize(), force) : id;
    };

    force.iterations = function(_) {
      return arguments.length ? (iterations = +_, force) : iterations;
    };

    force.strength = function(_) {
      return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), strengths = null, initialize(), force) : strength;
    };

    force.distance = function(_) {
      return arguments.length ? (distance = typeof _ === "function" ? _ : constant(+_), distances = null, initialize(), force) : distance;
    };

    return force;
  }

  function x$1(d) {
    return d.x;
  }

  function y$1(d) {
    return d.y;
  }

  var initialRadius = 10;
  var initialAngle = Math.PI * (3 - Math.sqrt(5));
  function simulation(nodes) {
    var simulation,
        iteration = 0,
        alphaMin = 0.0001,
        alphaDecay = -0.02,
        drag = 0.6,
        forces = d3Collection.map(),
        stepper = d3Timer.timer(step),
        event = d3Dispatch.dispatch("tick", "end");

    if (nodes == null) nodes = [];

    function restart() {
      iteration = 0;
      stepper.restart(step);
      return simulation;
    }

    function stop() {
      stepper.stop();
      return simulation;
    }

    function step() {
      var stop = tick();
      event.call("tick", simulation);
      if (stop) {
        stepper.stop();
        event.call("end", simulation);
      }
    }

    function tick() {
      var alpha = Math.exp(++iteration * alphaDecay);

      forces.each(function(force) {
        force(alpha);
      });

      for (var i = 0, n = nodes.length, node; i < n; ++i) {
        node = nodes[i];
        node.x += node.vx *= drag;
        node.y += node.vy *= drag;
      }

      return alpha < alphaMin;
    }

    function initializeNodes() {
      for (var i = 0, n = nodes.length, node; i < n; ++i) {
        node = nodes[i], node.index = i;
        if (isNaN(node.x) || isNaN(node.y)) {
          var radius = initialRadius * Math.sqrt(i), angle = i * initialAngle;
          node.x = radius * Math.cos(angle);
          node.y = radius * Math.sin(angle);
        }
        if (isNaN(node.vx) || isNaN(node.vy)) {
          node.vx = node.vy = 0;
        }
      }
    }

    function initializeForce(force) {
      if (force.initialize) force.initialize(nodes);
      return force;
    }

    initializeNodes();

    return simulation = {
      restart: restart,
      stop: stop,
      tick: tick,

      nodes: function(_) {
        return arguments.length ? (nodes = _, initializeNodes(), forces.each(initializeForce), simulation) : nodes;
      },

      alphaMin: function(_) {
        return arguments.length ? (alphaMin = _, simulation) : alphaMin;
      },

      alphaDecay: function(_) {
        return arguments.length ? (iteration = +_ ? Math.round(iteration * alphaDecay / -_) : 0, alphaDecay = -_, simulation) : -alphaDecay;
      },

      drag: function(_) {
        return arguments.length ? (drag = 1 - _, simulation) : 1 - drag;
      },

      force: function(name, _) {
        return arguments.length > 1 ? ((_ == null ? forces.remove(name) : forces.set(name, initializeForce(_))), simulation) : forces.get(name);
      },

      on: function(name, _) {
        return arguments.length > 1 ? (event.on(name, _), simulation) : event.on(name);
      }
    };
  }

  var tau$1 = 2 * Math.PI;

  function manyBody() {
    var nodes,
        node,
        alpha,
        strength = constant(-100),
        strengths,
        distanceMin2 = 1,
        distanceMax2 = Infinity,
        theta2 = 0.81;

    function force(_) {
      var i, n = nodes.length, tree = d3Quadtree.quadtree(nodes, x$1, y$1).visitAfter(accumulate);
      for (alpha = _, i = 0; i < n; ++i) node = nodes[i], tree.visit(apply);
    }

    function initialize() {
      if (!nodes) return;
      var i, n = nodes.length;
      strengths = new Array(n);
      for (i = 0; i < n; ++i) strengths[i] = +strength(nodes[i], i, nodes);
    }

    function accumulate(quad) {
      var strength = 0, q, c, x, y, i;

      // For internal nodes, accumulate forces from child quadrants.
      if (quad.length) {
        for (x = y = i = 0; i < 4; ++i) {
          if ((q = quad[i]) && (c = q.value)) {
            strength += c, x += c * q.x, y += c * q.y;
          }
        }
        quad.x = x / strength;
        quad.y = y / strength;
      }

      // For leaf nodes, accumulate forces from coincident quadrants.
      else {
        q = quad;
        q.x = q.data.x;
        q.y = q.data.y;
        do strength += strengths[q.data.index];
        while (q = q.next);
      }

      quad.value = strength;
    }

    function apply(quad, x1, _, x2) {
      if (!quad.value) return true;

      var x = quad.x - node.x,
          y = quad.y - node.y,
          w = x2 - x1,
          l = x * x + y * y;

      // Apply the Barnes-Hut approximation if possible.
      // Limit forces for very close nodes.
      if (w * w / theta2 < l) {
        if (l < distanceMax2) {
          if (l < distanceMin2) l = Math.sqrt(l / distanceMin2), x /= l, y /= l, l = distanceMin2;
          l = quad.value * alpha / l;
          node.vx += x * l;
          node.vy += y * l;
        }
        return true;
      }

      // Otherwise, process points directly.
      else if (quad.length || l >= distanceMax2) return;

      // Limit forces for very close nodes.
      // Randomize direction for exactly-coincident nodes.
      if (l < distanceMin2) {
        if (!l) l = Math.random() * tau$1, x = Math.cos(l), y = Math.sin(l), l = 1;
        l = Math.sqrt(l / distanceMin2), x /= l, y /= l, l = distanceMin2;
      }

      do if (quad.data !== node) {
        w = strengths[quad.data.index] * alpha / l;
        node.vx += x * w;
        node.vy += y * w;
      } while (quad = quad.next);
    }

    force.initialize = function(_) {
      nodes = _;
      initialize();
    };

    force.strength = function(_) {
      return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), initialize(), force) : strength;
    };

    force.distanceMin = function(_) {
      return arguments.length ? (distanceMin2 = _ * _, force) : Math.sqrt(distanceMin2);
    };

    force.distanceMax = function(_) {
      return arguments.length ? (distanceMax2 = _ * _, force) : Math.sqrt(distanceMax2);
    };

    force.theta = function(_) {
      return arguments.length ? (theta2 = _ * _, force) : Math.sqrt(theta2);
    };

    return force;
  }

  function position(x, y) {
    var strength = constant(0.1),
        nodes,
        strengths,
        xz,
        yz;

    if (typeof x !== "function") x = constant(x == null ? 0 : +x);
    if (typeof y !== "function") y = constant(y == null ? 0 : +y);

    function force(alpha) {
      for (var i = 0, n = nodes.length, node, k; i < n; ++i) {
        node = nodes[i];
        k = strengths[i] * alpha;
        node.vx += (xz[i] - node.x) * k;
        node.vy += (yz[i] - node.y) * k;
      }
    }

    function initialize() {
      if (!nodes) return;
      var i, n = nodes.length;
      strengths = new Array(n);
      xz = new Array(n);
      yz = new Array(n);
      for (i = 0; i < n; ++i) {
        strengths[i] = +strength(nodes[i], i, nodes);
        xz[i] = +x(nodes[i], i, nodes);
        yz[i] = +y(nodes[i], i, nodes);
      }
    }

    force.initialize = function(_) {
      nodes = _;
      initialize();
    };

    force.strength = function(_) {
      return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), initialize(), force) : strength;
    };

    force.x = function(_) {
      return arguments.length ? (x = typeof _ === "function" ? _ : constant(+_), initialize(), force) : x;
    };

    force.y = function(_) {
      return arguments.length ? (y = typeof _ === "function" ? _ : constant(+_), initialize(), force) : y;
    };

    return force;
  }

  exports.version = version;
  exports.forceCenter = center;
  exports.forceCollide = collide;
  exports.forceContain = contain;
  exports.forceLink = link;
  exports.forceManyBody = manyBody;
  exports.forcePosition = position;
  exports.forceSimulation = simulation;

}));