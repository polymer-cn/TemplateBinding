// Copyright 2013 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(global) {
  'use strict';

  var createObject = ('__proto__' in {}) ?
    function(obj) { return obj; } :
    function(obj) {
      var proto = obj.__proto__;
      if (!proto)
        return obj;
      var newObject = Object.create(proto);
      Object.getOwnPropertyNames(obj).forEach(function(name) {
        Object.defineProperty(newObject, name,
                             Object.getOwnPropertyDescriptor(obj, name));
      });
      return newObject;
    };

  var attrNames = [
    'foo',
    'bar',
    'baz',
    'bat',
    'boo',
    'cat',
    'dog',
    'fog',
    'hat',
    'pig'
  ];
  attrNames.next = 0;
  function getNextAttrName() {
    if (attrNames.next == attrNames.length)
      attrNames.next = 0;
    return attrNames[attrNames.next++];
  }

  var propNames = [
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j'
  ];
  propNames.next = 0;
  function getNextPropName() {
    if (propNames.next == propNames.length)
      propNames.next = 0;
    return propNames[propNames.next++];
  }

  var elementTypes = [
    'div',
    'p',
    'span',
    'h1',
    'h2'
  ];
  elementTypes.next = 0;
  function getNextElementType() {
    if (elementTypes.next == elementTypes.length)
      elementTypes.next = 0;
    return elementTypes[elementTypes.next++];
  }

  function nextBindingText(isStatic, expression) {
    if (isStatic)
      return 'I am Text!';

    if (expression) {
      return '{{ ' + getNextPropName() + ' + ' +
                     getNextPropName() + ' }}';
    }

    return '{{ ' + getNextPropName() + ' }}';
  }

  function nextBinding(isStatic, compound, expression) {
    if (isStatic)
      return nextBindingText(isStatic);
    if (compound) {
      return nextBindingText(false, expression) + ' ' +
             nextBindingText(false, expression);
    }

    return nextBindingText(false, expression);
  }

  function MDVBenchmark(testDiv, width, depth, decoration, instanceCount,
                        compoundBindings, expressions) {
    Benchmark.call(this);
    this.testDiv = testDiv;
    this.width = width;
    this.depth = depth;
    this.decoration = decoration;
    this.compoundBindings = compoundBindings;
    this.expressions = expressions;

    this.valueCounter = 1;
    this.ping = this.objectArray(instanceCount);
    this.pong = this.objectArray(instanceCount);
    this.flip = true;
  }

  MDVBenchmark.prototype = createObject({
    __proto__: Benchmark.prototype,

    dataObject: function() {
      var obj = {};
      propNames.forEach(function(prop) {
        obj[prop] = 'value' + (this.valueCounter++);
      }, this);
      return obj;
    },

    objectArray: function(count) {
      var array = [];

      for (var i = 0; i < count; i++)
        array.push(this.dataObject());

      return array;
    },

    getBindingText: function() {
      return nextBinding(this.bindingCounter++ > this.bindingCount,
                         this.compoundBindings, this.expressions);
    },

    decorate: function(element) {
      if (!this.decoration)
        return;

      if (element.nodeType === Node.TEXT_NODE) {
        element.textContent = this.getBindingText();
        return;
      }

      for (var i = 0; i < this.decoration; i++) {
        element.setAttribute(getNextAttrName(), this.getBindingText());
      }
    },

    buildFragment: function(parent, width, depth) {
      if (!depth)
        return;

      var text = parent.appendChild(document.createTextNode('I am text!'));
      this.decorate(text);

      for (var i = 0; i < width; i++) {
        var el = document.createElement(getNextElementType());
        var div = parent.appendChild(el);
        this.buildFragment(div, width, depth - 1);
        this.decorate(div);
      }
    },

    setupTest: function(density) {
      // |decoration| attributes on each element in each depth
      var bindingCount = this.decoration *
          (Math.pow(this.width, this.depth) - 1) * this.width;
      // if |decoration| >= 1, one binding for each text node at each depth.
      if (this.decoration > 0)
        bindingCount += Math.pow(this.width, this.depth) - 1;

      this.bindingCount = Math.round(bindingCount * density);
      this.bindingCounter = 0;
      this.propNameCounter = 0;
      this.fragment = document.createDocumentFragment();
      this.buildFragment(this.fragment, this.width, this.depth, this.decoration,
                         density);
    },

    teardownTest: function(density) {
      this.fragment = undefined;
    },

    setupMDVVariant: function() {
      if (testDiv.childNodes.length > 1)
        alert('Failed to cleanup last test');

      testDiv.innerHTML = '';
      this.template = testDiv.appendChild(document.createElement('template'));
      HTMLTemplateElement.decorate(this.template);
      if (this.expressions)
        this.template.bindingDelegate = new PolymerExpressions;

      this.template.content.appendChild(this.fragment.cloneNode(true));
      this.template.setAttribute('repeat', '');
    },

    runMDV: function() {
      this.template.model = this.flip ? this.ping : this.pong;
      this.flip = !this.flip;
    },

    teardownMDVVariant: function() {
      this.template.model = undefined;
    },

    setupHandlebarsVariant: function() {
      testDiv.innerHTML = '';
      var div = document.createElement('div');
      div.appendChild(this.fragment.cloneNode(true));
      this.handlebarsTemplate = '{{#each this}}' + div.innerHTML + '{{/each}}';
      this.compiledTemplate = Handlebars.compile(this.handlebarsTemplate);
    },

    runHandlebars: function() {
      testDiv.innerHTML = '';
      testDiv.innerHTML = this.compiledTemplate(this.flip ?
          this.ping : this.pong);
      if (!testDiv.querySelectorAll('div').length)
        console.error('Foo');
      this.flip = !this.flip;
    },

    teardownHandlebarsVariant: function() {
      testDiv.innerHTML = '';
    },

    setupVariant: function(testType) {
      switch (testType) {
        case 'MDV':
          this.setupMDVVariant();
          break;
        case 'Handlebars':
          this.setupHandlebarsVariant();
          break;
      }
    },

    run: function(testType) {
      switch (testType) {
        case 'MDV':
          this.runMDV();
          break;
        case 'Handlebars':
          this.runHandlebars();
          break;
      }
    },

    teardownVariant: function(testType) {
      switch (testType) {
        case 'MDV':
          this.teardownMDVVariant();
          break;
        case 'Handlebars':
          this.teardownHandlebarsVariant();
          break;
      }
    },

    destroy: function() {}
  });

  global.MDVBenchmark = MDVBenchmark;

})(this);
