if (!(document.register || {}).__polyfill__){

  (function(){
    
    var win = window,
      doc = document,
      tags = {},
      tokens = [],
      domready = false,
      mutation = win.MutationObserver || win.WebKitMutationObserver ||  win.MozMutationObserver,
      _createElement = doc.createElement,
      register = function(name, options){
        if (!tags[name]) tokens.push(name);
        options = options || {};
        if (options.prototype && !('setAttribute' in options.prototype)) {
          throw new TypeError("Unexpected prototype for " + name + " element - custom element prototypes must inherit from the Element interface");
        }
        var _prototype = options.prototype || Object.create((win.HTMLSpanElement || win.HTMLElement).prototype),
            lifecycle = options.lifecycle || {},
            tag = tags[name] = {
              'constructor': function(){
                return doc.createElement(name);
              },
              _prototype: doc.__proto__ ? null : unwrapPrototype(_prototype),
              'prototype': _prototype,
              'fragment': options.fragment || doc.createDocumentFragment(),
              'lifecycle': {
                created: lifecycle.created || function(){},
                removed: lifecycle.removed || function(){},
                inserted: lifecycle.inserted || function(){},
                attributeChanged: lifecycle.attributeChanged || function(){}
              }
            };
        tag.constructor.prototype = tag.prototype;
        if (domready) query(doc, name).forEach(function(element){
          upgrade(element, true);
        });
        return tag.constructor;
      };
    
    function unwrapPrototype(proto){
      var definition = {},
          names = Object.getOwnPropertyNames(proto),
          index = names.length;
      if (index) while (index--) {
        definition[names[index]] = Object.getOwnPropertyDescriptor(proto, names[index]);
      }
      return definition;
    }
    
    function typeOf(obj) {
      return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
    }
    
    function clone(item, type){
      var fn = clone[type || typeOf(item)];
      return fn ? fn(item) : item;
    }
      clone.object = function(src){
        var obj = {};
        for (var key in src) obj[key] = clone(src[key]);
        return obj;
      };
      clone.array = function(src){
        var i = src.length, array = new Array(i);
        while (i--) array[i] = clone(src[i]);
        return array;
      };
    
    var unsliceable = ['number', 'boolean', 'string', 'function'];
    function toArray(obj){
      return unsliceable.indexOf(typeof obj) == -1 ? 
      Array.prototype.slice.call(obj, 0) :
      [obj];
    }
    
    function query(element, selector){
      return element && selector && selector.length ? toArray(element.querySelectorAll(selector)) : [];
    }
    
    function getTag(element){
      return element.nodeName ? tags[element.nodeName.toLowerCase()] : false;
    }
    
    function manipulate(element, fn){
      var next = element.nextSibling,
        parent = element.parentNode,
        frag = doc.createDocumentFragment(),
        returned = fn.call(frag.appendChild(element), frag) || element;
      if (next){
        parent.insertBefore(returned, next);
      }
      else{
        parent.appendChild(returned);
      }
    }
    
    function upgrade(element, replace){
      if (!element._elementupgraded && !element._suppressObservers) {
        var tag = getTag(element);
        if (tag) {
          var upgraded = element;
          if (replace) {
            element._suppressObservers = true;
            manipulate(element, function(){
              upgraded = _createElement.call(doc, element.nodeName);
              upgraded._suppressObservers = true;
              while (element.firstChild) upgraded.appendChild(element.firstChild);
              var index = element.attributes.length;
              while (index--) {
                var attr = element.attributes[index];
                upgraded.setAttribute(attr.name, attr.value);
              }
              return upgraded;
            });
          }
          if (doc.__proto__) upgraded.__proto__ = tag.prototype;
          else Object.defineProperties(upgraded, tag._prototype);
          upgraded.constructor = tag.constructor;
          upgraded._elementupgraded = true;
          if (!mutation) delete upgraded._suppressObservers;
          tag.lifecycle.created.call(upgraded, tag.prototype);
          if (replace) fireEvent(element, 'elementreplace', { upgrade: upgraded }, { bubbles: false });
          fireEvent(upgraded, 'elementupgrade');
        }
      }
    }
    
    function inserted(element, event){
      var tag = getTag(element);
      if (tag){
        if (!element._elementupgraded) upgrade(element, true);
        else {
          if (element._suppressObservers) {
            delete element._suppressObservers;
            return element;
          }
          if (!element._suppressObservers && doc.documentElement.contains(element)) {
            tag.lifecycle.inserted.call(element);
          }
          insertChildren(element);
        }
      }
      else insertChildren(element);
    }

    function insertChildren(element){
      if (element.childNodes.length) query(element, tokens).forEach(function(el){
        if (!el._elementupgraded) upgrade(el, true);
        getTag(el).lifecycle.inserted.call(el);
      });
    }
    
    function removed(element){
      if (element._elementupgraded) {
        if (element._suppressObservers) delete element._suppressObservers;
        else {
          getTag(element).lifecycle.removed.call(element);
          if (element.childNodes.length) query(element, tokens).forEach(function(el){
            removed(el);
          });
        }
      }
    }
    
    function addObserver(element, type, fn){
      if (!element._records) {
        element._records = { inserted: [], removed: [] };
        if (mutation){
          element._observer = new mutation(function(mutations) {
            parseMutations(element, mutations);
          });
          element._observer.observe(element, {
            subtree: true,
            childList: true,
            attributes: !true,
            characterData: false
          });
        }
        else ['Inserted', 'Removed'].forEach(function(type){
          element.addEventListener('DOMNode' + type, function(event){
            event._mutation = true;
            element._records[type.toLowerCase()].forEach(function(fn){
              fn(event.target, event);
            });
          }, false);
        });
      }
      if (element._records[type].indexOf(fn) == -1) element._records[type].push(fn);
    }
    
    function removeObserver(element, type, fn){
      var obj = element._records;
      if (obj && fn){
        obj[type].splice(obj[type].indexOf(fn), 1);
      }
      else{
        obj[type] = [];
      }
    }
      
    function parseMutations(element, mutations) {
      var diff = { added: [], removed: [] };
      mutations.forEach(function(record){
        record._mutation = true;
        for (var z in diff) {
          var type = element._records[(z == 'added') ? 'inserted' : 'removed'],
            nodes = record[z + 'Nodes'], length = nodes.length;
          for (var i = 0; i < length && diff[z].indexOf(nodes[i]) == -1; i++){
            diff[z].push(nodes[i]);
            type.forEach(function(fn){
              fn(nodes[i], record);
            });
          }
        }
      });
    }
      
    function fireEvent(element, type, data, options){
      options = options || {};
      var event = doc.createEvent('Event');
      event.initEvent(type, 'bubbles' in options ? options.bubbles : true, 'cancelable' in options ? options.cancelable : true);
      for (var z in data) event[z] = data[z];
      element.dispatchEvent(event);
    }

    var polyfill = !doc.register;
    if (polyfill) {
      doc.register = register;
      
      doc.createElement = function createElement(tag){
        var element = _createElement.call(doc, tag);
        upgrade(element);
        return element;
      };
      
      var _setAttribute = Element.prototype.setAttribute;   
      Element.prototype.setAttribute = function(attr, value, skip){
        var tag = getTag(this),
            last = this.getAttribute(attr);
        _setAttribute.call(this, attr, value);
        if (tag && last != this.getAttribute(attr)) {
          tag.lifecycle.attributeChanged.call(this, attr, value, last, skip);
        } 
      };
      
      var initialize = function (){
        addObserver(doc.documentElement, 'inserted', inserted);
        addObserver(doc.documentElement, 'removed', removed);
        
        if (tokens.length) query(doc, tokens).forEach(function(element){
          upgrade(element, true);
        });
        
        domready = true;
        fireEvent(doc, 'DOMComponentsLoaded');
        fireEvent(doc, '__DOMComponentsLoaded__');
      };
      
      if (doc.readyState == 'complete') initialize();
      else doc.addEventListener(doc.readyState == 'interactive' ? 'readystatechange' : 'DOMContentLoaded', initialize); 
    }
    
    doc.register.__polyfill__ = {
      query: query,
      clone: clone,
      typeOf: typeOf,
      toArray: toArray,
      fireEvent: fireEvent,
      manipulate: manipulate,
      addObserver: addObserver,
      removeObserver: removeObserver,
      observerElement: doc.documentElement,
      parseMutations: parseMutations,
      _inserted: inserted,
      _createElement: _createElement,
      _polyfilled: polyfill
    };

  })();

}

(function () {

/*** Internal Variables ***/

  var win = window,
    doc = document,
    regexPseudoSplit = /(\w+(?:\([^\)]+\))?)/g,
    regexPseudoReplace = /(\w*)(?:\(([^\)]*)\))?/,
    regexDigits = /(\d+)/g,
    keypseudo = {
      action: function (pseudo, event) {
        return pseudo.value.match(regexDigits).indexOf(String(event.keyCode)) > -1 == (pseudo.name == 'keypass');
      }
    },
    touchFilter = function (custom, event) {
      if (custom.listener.touched) return custom.listener.touched = false;
      else {
        if (event.type.match('touch')) custom.listener.touched = true;
      }
    },
    createFlowEvent = function (type) {
      var flow = type == 'over';
      return {
        base: 'OverflowEvent' in win ? 'overflowchanged' : type + 'flow',
        condition: function (custom, event) {
          event.flow = type;
          return event.type == (type + 'flow') ||
          ((event.orient === 0 && event.horizontalOverflow == flow) ||
          (event.orient == 1 && event.verticalOverflow == flow) ||
          (event.orient == 2 && event.horizontalOverflow == flow && event.verticalOverflow == flow));
        }
      };
    },
    prefix = (function () {
      var styles = win.getComputedStyle(doc.documentElement, ''),
        pre = (Array.prototype.slice
          .call(styles)
          .join('') 
          .match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
        )[1],
        dom = ('WebKit|Moz|MS|O').match(new RegExp('(' + pre + ')', 'i'))[1];
      return {
        dom: dom,
        lowercase: pre,
        css: '-' + pre + '-',
        js: pre[0].toUpperCase() + pre.substr(1)
      };

    })(),
    matchSelector = Element.prototype.matchesSelector || Element.prototype[prefix.lowercase + 'MatchesSelector'];
  
/*** Internal Functions ***/

  // Mixins
  
  function mergeOne(source, key, current){
    var type = xtag.typeOf(current);
    if (type == 'object' && xtag.typeOf(source[key]) == 'object') xtag.merge(source[key], current);
    else source[key] = xtag.clone(current, type);
    return source;
  }
  
  function mergeMixin(type, mixin, option) {
    var original = {};
    for (var o in option) original[o.split(':')[0]] = true;
    for (var x in mixin) if (!original[x.split(':')[0]]) option[x] = mixin[x];
  }

  function applyMixins(tag) {
    tag.mixins.forEach(function (name) {
      var mixin = xtag.mixins[name];
      for (var type in mixin) {
        switch (type) {
          case 'lifecycle': case 'methods':
            mergeMixin(type, mixin[type], tag[type]);
            break;
          case 'accessors': case 'prototype':
            for (var z in mixin[type]) mergeMixin(z, mixin[type], tag.accessors);
            break;
          case 'events':
            break;
        }
      }
    });
    return tag;
  }
  
/*** X-Tag Object Definition ***/

  var xtag = {
    tags: {},
    defaultOptions: {
      pseudos: [],
      mixins: [],
      events: {},
      methods: {},
      accessors: {},
      lifecycle: {},
      'prototype': {
        xtag: {
          get: function(){
            return this.__xtag__ ? this.__xtag__ : (this.__xtag__ = { data: {} });
          }
        }
      }
    },
    register: function (name, options) {
      var _name = name.toLowerCase();
      var tag = xtag.tags[_name] = applyMixins(xtag.merge({}, xtag.defaultOptions, options));
      xtag.attributeSetters[_name] = {};
      
      for (var z in tag.events) tag.events[z] = xtag.parseEvent(z, tag.events[z]);
      for (var z in tag.lifecycle) tag.lifecycle[z.split(':')[0]] = xtag.applyPseudos(z, tag.lifecycle[z], tag.pseudos);
      for (var z in tag.methods) tag.prototype[z.split(':')[0]] = { value: xtag.applyPseudos(z, tag.methods[z], tag.pseudos) };
      
      for (var prop in tag.accessors) {
        tag.prototype[prop] = {};
        var accessor = tag.accessors[prop];
        for (var z in accessor) {
          var key = z.split(':'), type = key[0];
          if (type == 'get' || type == 'set') {
            key[0] = prop;
            tag.prototype[prop][type] = xtag.applyPseudos(key.join(':'), accessor[z], tag.pseudos);
          }
          else tag.prototype[prop][z] = accessor[z];
        }
      }
  
      var attributeChanged = tag.lifecycle.attributeChanged;
      tag.lifecycle.attributeChanged = function (attr, value, last, skip) {
        var setter = xtag.attributeSetters[_name][attr.toLowerCase()];
        if (!skip && setter) this[setter] = value;
        return attributeChanged ? attributeChanged.apply(this, xtag.toArray(arguments)) : null;
      };

      var created = tag.lifecycle.created;
      tag.lifecycle.created = function () {
        var element = this;
        tag.pseudos.forEach(function(obj){
          obj.onAdd.call(element, obj);
        });
        xtag.addEvents(this, tag.events);
        tag.mixins.forEach(function(mixin){
          if (xtag.mixins[mixin].events) xtag.addEvents(element, xtag.mixins[mixin].events);
        });
        return created ? created.apply(this, xtag.toArray(arguments)) : null;
      };
      
      var proto = doc.register(_name, {
        'prototype': 'nodeName' in tag.prototype ? tag.prototype : Object.create((win.HTMLSpanElement || win.HTMLElement).prototype, tag.prototype),
        'lifecycle':  tag.lifecycle
      });
      
      return proto;
    },

  /*** Exposed Variables ***/
    mixins: {},
    prefix: prefix,
    attributeSetters: {},
    captureEvents: ['focus', 'blur'],
    customEvents: {
      overflow: createFlowEvent('over'),
      underflow: createFlowEvent('under'),
      animationstart: {
        base: [
          'animationstart',
          'oAnimationStart',
          'MSAnimationStart',
          'webkitAnimationStart'
        ]
      },
      transitionend: {
        base: [
          'transitionend',
          'oTransitionEnd',
          'MSTransitionEnd',
          'webkitTransitionEnd'
        ]
      },
      tap: {
        base: ['click', 'touchend'],
        condition: touchFilter
      },
      tapstart: {
        base: ['mousedown', 'touchstart'],
        condition: touchFilter
      },
      tapend: {
        base: ['mouseup', 'touchend'],
        condition: touchFilter
      },
      tapenter: {
        base: ['mouseover', 'touchenter'],
        condition: touchFilter
      },
      tapleave: {
        base: ['mouseout', 'touchleave'],
        condition: touchFilter
      },
      tapmove: {
        base: ['mousemove', 'touchmove'],
        condition: touchFilter
      }
    },
    pseudos: {
      keypass: keypseudo,
      keyfail: keypseudo,
      delegate: {
        action: function (pseudo, event) {
          var target = xtag.query(this, pseudo.value).filter(function (node) {
            return node == event.target || node.contains ? node.contains(event.target) : false;
          })[0];
          return target ? pseudo.listener = pseudo.listener.bind(target) : false;
        }
      },
      preventable: {
        action: function (pseudo, event) {
          return !event.defaultPrevented;
        }
      },
      attribute: {
        onAdd: function(pseudo){
          var key = (pseudo.value || pseudo.key.split(':')[0]).toLowerCase();
          xtag.attributeSetters[this.nodeName.toLowerCase()][key] = pseudo.key.split(':')[0];
        },
        action: function (pseudo, value) {
          this.setAttribute(pseudo.value || pseudo.key.split(':')[0], value, true);
        }
      }
    },

  /*** Utilities ***/

    // JS Types
    
    wrap: function (original, fn) {
      return function () {
        var args = xtag.toArray(arguments),
          returned = original.apply(this, args);
        return returned === false ? false : fn.apply(this, typeof returned != 'undefined' ? xtag.toArray(returned) : args);
      };
    },
    
    merge: function(source, k, v){
      if (xtag.typeOf(k) == 'string') return mergeOne(source, k, v);
      for (var i = 1, l = arguments.length; i < l; i++){
        var object = arguments[i];
        for (var key in object) mergeOne(source, key, object[key]);
      }
      return source;
    },

    skipTransition: function(element, fn, bind){
      var duration = prefix.js + 'TransitionDuration';
      element.style[duration] = '0.001s';
      fn.call(bind);
      xtag.addEvent(element, 'transitionend', function(){
        element.style[duration] = '';
      });
    },

    matchSelector: function (element, selector) {
      return matchSelector.call(element, selector);
    },
    
    innerHTML: function (element, html) {
      element.innerHTML = html;
      if (xtag._polyfilled) {
        if (xtag.observerElement._observer) {
          xtag.parseMutations(xtag.observerElement, xtag.observerElement._observer.takeRecords());
        }
        else xtag._inserted(element);
      }
    },

    hasClass: function (element, klass) {
      return element.className.split(' ').indexOf(klass.trim())>-1;
    },

    addClass: function (element, klass) {
      var list = element.className.trim().split(' ');
      klass.trim().split(' ').forEach(function (name) {
        if (!~list.indexOf(name)) list.push(name);
      });
      element.className = list.join(' ').trim();
      return element;
    },

    removeClass: function (element, klass) {
      var classes = klass.trim().split(' ');
      element.className = element.className.trim().split(' ').filter(function (name) {
        return name && !~classes.indexOf(name);
      }).join(' ');
      return element;
    },
    toggleClass: function (element, klass) {
      return xtag[xtag.hasClass(element, klass) ? 'removeClass' : 'addClass'].call(null, element, klass);

    },
    query: function (element, selector) {
      return xtag.toArray(element.querySelectorAll(selector));
    },

    queryChildren: function (element, selector) {
      var id = element.id,
        guid = element.id = id || 'x_' + new Date().getTime(),
        attr = '#' + guid + ' > ';
      selector = attr + (selector + '').replace(',', ',' + attr, 'g');
      var result = element.parentNode.querySelectorAll(selector);
      if (!id) element.removeAttribute('id');
      return xtag.toArray(result);
    },

    createFragment: function (content) {
      var frag = doc.createDocumentFragment();
      if (content) {
        var div = frag.appendChild(doc.createElement('div')),
          nodes = xtag.toArray(content.nodeName ? arguments : !(div.innerHTML = content) || div.children),
          index = nodes.length;
        while (index--) frag.insertBefore(nodes[index], div);
        frag.removeChild(div);
      }
      return frag;
    },

  /*** Pseudos ***/

    applyPseudos: function(key, fn, element) {
      var listener = fn,
          pseudos = {};
      if (key.match(':')) {
        var split = key.match(regexPseudoSplit),
            i = split.length;
        while (--i) {
          split[i].replace(regexPseudoReplace, function (match, name, value) {
            var pseudo = pseudos[i] = Object.create(xtag.pseudos[name]);
                pseudo.key = key;
                pseudo.name = name;
                pseudo.value = value;
            if (!pseudo) throw "pseudo not found: " + name;
            var last = listener;
            listener = function(){
              var args = xtag.toArray(arguments),
                  obj = {
                    key: key,
                    name: name,
                    value: value,
                    listener: last
                  };
              if (pseudo.action && pseudo.action.apply(this, [obj].concat(args)) === false) return false;
              return obj.listener.apply(this, args);
            };
            if (element && pseudo.onAdd) {
              element.getAttribute ? pseudo.onAdd.call(element, pseudo) : element.push(pseudo);
            }
          });
        }
      }
      for (var z in pseudos) {
        if (pseudos[z].onCompiled) listener = pseudos[z].onCompiled(listener, pseudos[z]);
      }
      return listener;
    },

  /*** Events ***/

    parseEvent: function(type, fn) {
      var pseudos = type.split(':'),
        noop = function(){},
        key = pseudos.shift(),
        event = xtag.merge({
          base: key,
          pseudos: '',
          _pseudos: [],
          onAdd: noop,
          onRemove: noop,
          condition: noop
        }, xtag.customEvents[key] || {});
      event.type = key + (event.pseudos.length ? ':' + event.pseudos : '') + (pseudos.length ? ':' + pseudos.join(':') : '');
      if (fn) {
        var chained = xtag.applyPseudos(event.type, fn, event._pseudos);
        event.listener = function(){
          var args = xtag.toArray(arguments);
          if (event.condition.apply(this, [event].concat(args)) === false) return false;
          return chained.apply(this, args);
        };
      }
      return event;
    },

    addEvent: function (element, type, fn) {
      var event = (typeof fn == 'function') ? xtag.parseEvent(type, fn) : fn;
      event._pseudos.forEach(function(obj){
        obj.onAdd.call(element, obj);
      });
      event.onAdd.call(element, event, event.listener);
      xtag.toArray(event.base).forEach(function (name) {
        element.addEventListener(name, event.listener, xtag.captureEvents.indexOf(name) > -1);
      });
      return event.listener;
    },

    addEvents: function (element, events) {
      var listeners = {};
      for (var z in events) {
        listeners[z] = xtag.addEvent(element, z, events[z]);
      }
      return listeners;
    },

    removeEvent: function (element, type, fn) {
      var event = xtag.parseEvent(type);
      event.onRemove.call(element, event, fn);
      xtag.removePseudos(element, event.type, fn);
      xtag.toArray(event.base).forEach(function (name) {
        element.removeEventListener(name, fn);
      });
    },
    
    removeEvents: function(element, listeners){
      for (var z in listeners) xtag.removeEvent(element, z, listeners[z]);
    }
    
  };
  
  xtag.typeOf = doc.register.__polyfill__.typeOf;
  xtag.clone = doc.register.__polyfill__.clone;
  xtag.merge(xtag, doc.register.__polyfill__);

  if (typeof define == 'function' && define.amd) define(xtag);
  else win.xtag = xtag;

})();
