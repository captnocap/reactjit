(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // framework/ambient.ts
  function r() {
    return require_react();
  }
  function lazyProp(name) {
    return new Proxy(function() {
    }, {
      get(_t, prop) {
        return r()[name][prop];
      },
      apply(_t, _self, a) {
        return r()[name](...a);
      },
      construct(_t, a) {
        return new (r())[name](...a);
      },
      has(_t, prop) {
        return prop in r()[name];
      },
      ownKeys(_t) {
        return Reflect.ownKeys(r()[name]);
      },
      getOwnPropertyDescriptor(_t, prop) {
        return Object.getOwnPropertyDescriptor(r()[name], prop);
      }
    });
  }
  var Suspense, Children;
  var init_ambient = __esm({
    "framework/ambient.ts"() {
      Suspense = lazyProp("Suspense");
      Children = lazyProp("Children");
    }
  });

  // runtime/primitives_gen/CodeGutter.tsx
  var init_CodeGutter = __esm({
    "runtime/primitives_gen/CodeGutter.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
    }
  });

  // runtime/primitives_gen/Minimap.tsx
  var init_Minimap = __esm({
    "runtime/primitives_gen/Minimap.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
    }
  });

  // runtime/primitives.tsx
  function h(type, props, ...children) {
    return require_react().createElement(type, props, ...children);
  }
  var Box, CanvasBase, GraphBase, Effect;
  var init_primitives = __esm({
    "runtime/primitives.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_CodeGutter();
      init_Minimap();
      Box = (props) => h("View", props, props.children);
      CanvasBase = (props) => h("Canvas", props, props.children);
      CanvasBase.Node = (props) => h("Canvas.Node", props, props.children);
      CanvasBase.Path = (props) => h("Canvas.Path", props, props.children);
      CanvasBase.Clamp = (props) => h("Canvas.Clamp", props, props.children);
      GraphBase = (props) => h("Graph", props, props.children);
      GraphBase.Path = (props) => h("Graph.Path", props, props.children);
      GraphBase.Node = (props) => h("Graph.Node", props, props.children);
      Effect = (props) => h("Effect", props, props.children);
    }
  });

  // framework/ambient_primitives.ts
  var init_ambient_primitives = __esm({
    "framework/ambient_primitives.ts"() {
      init_primitives();
    }
  });

  // node_modules/react/cjs/react.development.js
  var require_react_development = __commonJS({
    "node_modules/react/cjs/react.development.js"(exports, module) {
      "use strict";
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      if (true) {
        (function() {
          "use strict";
          if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
            __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
          }
          var ReactVersion = "18.3.1";
          var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.element");
          var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
          var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
          var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
          var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
          var REACT_PROVIDER_TYPE = /* @__PURE__ */ Symbol.for("react.provider");
          var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
          var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
          var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
          var REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list");
          var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
          var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
          var REACT_OFFSCREEN_TYPE = /* @__PURE__ */ Symbol.for("react.offscreen");
          var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
          var FAUX_ITERATOR_SYMBOL = "@@iterator";
          function getIteratorFn(maybeIterable) {
            if (maybeIterable === null || typeof maybeIterable !== "object") {
              return null;
            }
            var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
            if (typeof maybeIterator === "function") {
              return maybeIterator;
            }
            return null;
          }
          var ReactCurrentDispatcher = {
            /**
             * @internal
             * @type {ReactComponent}
             */
            current: null
          };
          var ReactCurrentBatchConfig = {
            transition: null
          };
          var ReactCurrentActQueue = {
            current: null,
            // Used to reproduce behavior of `batchedUpdates` in legacy mode.
            isBatchingLegacy: false,
            didScheduleLegacyUpdate: false
          };
          var ReactCurrentOwner = {
            /**
             * @internal
             * @type {ReactComponent}
             */
            current: null
          };
          var ReactDebugCurrentFrame = {};
          var currentExtraStackFrame = null;
          function setExtraStackFrame(stack) {
            {
              currentExtraStackFrame = stack;
            }
          }
          {
            ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
              {
                currentExtraStackFrame = stack;
              }
            };
            ReactDebugCurrentFrame.getCurrentStack = null;
            ReactDebugCurrentFrame.getStackAddendum = function() {
              var stack = "";
              if (currentExtraStackFrame) {
                stack += currentExtraStackFrame;
              }
              var impl = ReactDebugCurrentFrame.getCurrentStack;
              if (impl) {
                stack += impl() || "";
              }
              return stack;
            };
          }
          var enableScopeAPI = false;
          var enableCacheElement = false;
          var enableTransitionTracing = false;
          var enableLegacyHidden = false;
          var enableDebugTracing = false;
          var ReactSharedInternals = {
            ReactCurrentDispatcher,
            ReactCurrentBatchConfig,
            ReactCurrentOwner
          };
          {
            ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
            ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
          }
          function warn(format) {
            {
              {
                for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                  args[_key - 1] = arguments[_key];
                }
                printWarning("warn", format, args);
              }
            }
          }
          function error(format) {
            {
              {
                for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                  args[_key2 - 1] = arguments[_key2];
                }
                printWarning("error", format, args);
              }
            }
          }
          function printWarning(level, format, args) {
            {
              var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
              var stack = ReactDebugCurrentFrame2.getStackAddendum();
              if (stack !== "") {
                format += "%s";
                args = args.concat([stack]);
              }
              var argsWithFormat = args.map(function(item) {
                return String(item);
              });
              argsWithFormat.unshift("Warning: " + format);
              Function.prototype.apply.call(console[level], console, argsWithFormat);
            }
          }
          var didWarnStateUpdateForUnmountedComponent = {};
          function warnNoop(publicInstance, callerName) {
            {
              var _constructor = publicInstance.constructor;
              var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
              var warningKey = componentName + "." + callerName;
              if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
                return;
              }
              error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
              didWarnStateUpdateForUnmountedComponent[warningKey] = true;
            }
          }
          var ReactNoopUpdateQueue = {
            /**
             * Checks whether or not this composite component is mounted.
             * @param {ReactClass} publicInstance The instance we want to test.
             * @return {boolean} True if mounted, false otherwise.
             * @protected
             * @final
             */
            isMounted: function(publicInstance) {
              return false;
            },
            /**
             * Forces an update. This should only be invoked when it is known with
             * certainty that we are **not** in a DOM transaction.
             *
             * You may want to call this when you know that some deeper aspect of the
             * component's state has changed but `setState` was not called.
             *
             * This will not invoke `shouldComponentUpdate`, but it will invoke
             * `componentWillUpdate` and `componentDidUpdate`.
             *
             * @param {ReactClass} publicInstance The instance that should rerender.
             * @param {?function} callback Called after component is updated.
             * @param {?string} callerName name of the calling function in the public API.
             * @internal
             */
            enqueueForceUpdate: function(publicInstance, callback, callerName) {
              warnNoop(publicInstance, "forceUpdate");
            },
            /**
             * Replaces all of the state. Always use this or `setState` to mutate state.
             * You should treat `this.state` as immutable.
             *
             * There is no guarantee that `this.state` will be immediately updated, so
             * accessing `this.state` after calling this method may return the old value.
             *
             * @param {ReactClass} publicInstance The instance that should rerender.
             * @param {object} completeState Next state.
             * @param {?function} callback Called after component is updated.
             * @param {?string} callerName name of the calling function in the public API.
             * @internal
             */
            enqueueReplaceState: function(publicInstance, completeState, callback, callerName) {
              warnNoop(publicInstance, "replaceState");
            },
            /**
             * Sets a subset of the state. This only exists because _pendingState is
             * internal. This provides a merging strategy that is not available to deep
             * properties which is confusing. TODO: Expose pendingState or don't use it
             * during the merge.
             *
             * @param {ReactClass} publicInstance The instance that should rerender.
             * @param {object} partialState Next partial state to be merged with state.
             * @param {?function} callback Called after component is updated.
             * @param {?string} Name of the calling function in the public API.
             * @internal
             */
            enqueueSetState: function(publicInstance, partialState, callback, callerName) {
              warnNoop(publicInstance, "setState");
            }
          };
          var assign = Object.assign;
          var emptyObject = {};
          {
            Object.freeze(emptyObject);
          }
          function Component(props, context, updater) {
            this.props = props;
            this.context = context;
            this.refs = emptyObject;
            this.updater = updater || ReactNoopUpdateQueue;
          }
          Component.prototype.isReactComponent = {};
          Component.prototype.setState = function(partialState, callback) {
            if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) {
              throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
            }
            this.updater.enqueueSetState(this, partialState, callback, "setState");
          };
          Component.prototype.forceUpdate = function(callback) {
            this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
          };
          {
            var deprecatedAPIs = {
              isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
              replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
            };
            var defineDeprecationWarning = function(methodName, info) {
              Object.defineProperty(Component.prototype, methodName, {
                get: function() {
                  warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
                  return void 0;
                }
              });
            };
            for (var fnName in deprecatedAPIs) {
              if (deprecatedAPIs.hasOwnProperty(fnName)) {
                defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
              }
            }
          }
          function ComponentDummy() {
          }
          ComponentDummy.prototype = Component.prototype;
          function PureComponent(props, context, updater) {
            this.props = props;
            this.context = context;
            this.refs = emptyObject;
            this.updater = updater || ReactNoopUpdateQueue;
          }
          var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
          pureComponentPrototype.constructor = PureComponent;
          assign(pureComponentPrototype, Component.prototype);
          pureComponentPrototype.isPureReactComponent = true;
          function createRef() {
            var refObject = {
              current: null
            };
            {
              Object.seal(refObject);
            }
            return refObject;
          }
          var isArrayImpl = Array.isArray;
          function isArray(a) {
            return isArrayImpl(a);
          }
          function typeName(value) {
            {
              var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
              var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
              return type;
            }
          }
          function willCoercionThrow(value) {
            {
              try {
                testStringCoercion(value);
                return false;
              } catch (e) {
                return true;
              }
            }
          }
          function testStringCoercion(value) {
            return "" + value;
          }
          function checkKeyStringCoercion(value) {
            {
              if (willCoercionThrow(value)) {
                error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
                return testStringCoercion(value);
              }
            }
          }
          function getWrappedName(outerType, innerType, wrapperName) {
            var displayName = outerType.displayName;
            if (displayName) {
              return displayName;
            }
            var functionName = innerType.displayName || innerType.name || "";
            return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
          }
          function getContextName(type) {
            return type.displayName || "Context";
          }
          function getComponentNameFromType(type) {
            if (type == null) {
              return null;
            }
            {
              if (typeof type.tag === "number") {
                error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
              }
            }
            if (typeof type === "function") {
              return type.displayName || type.name || null;
            }
            if (typeof type === "string") {
              return type;
            }
            switch (type) {
              case REACT_FRAGMENT_TYPE:
                return "Fragment";
              case REACT_PORTAL_TYPE:
                return "Portal";
              case REACT_PROFILER_TYPE:
                return "Profiler";
              case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
              case REACT_SUSPENSE_TYPE:
                return "Suspense";
              case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
            }
            if (typeof type === "object") {
              switch (type.$$typeof) {
                case REACT_CONTEXT_TYPE:
                  var context = type;
                  return getContextName(context) + ".Consumer";
                case REACT_PROVIDER_TYPE:
                  var provider = type;
                  return getContextName(provider._context) + ".Provider";
                case REACT_FORWARD_REF_TYPE:
                  return getWrappedName(type, type.render, "ForwardRef");
                case REACT_MEMO_TYPE:
                  var outerName = type.displayName || null;
                  if (outerName !== null) {
                    return outerName;
                  }
                  return getComponentNameFromType(type.type) || "Memo";
                case REACT_LAZY_TYPE: {
                  var lazyComponent = type;
                  var payload = lazyComponent._payload;
                  var init = lazyComponent._init;
                  try {
                    return getComponentNameFromType(init(payload));
                  } catch (x) {
                    return null;
                  }
                }
              }
            }
            return null;
          }
          var hasOwnProperty = Object.prototype.hasOwnProperty;
          var RESERVED_PROPS = {
            key: true,
            ref: true,
            __self: true,
            __source: true
          };
          var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;
          {
            didWarnAboutStringRefs = {};
          }
          function hasValidRef(config) {
            {
              if (hasOwnProperty.call(config, "ref")) {
                var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
                if (getter && getter.isReactWarning) {
                  return false;
                }
              }
            }
            return config.ref !== void 0;
          }
          function hasValidKey(config) {
            {
              if (hasOwnProperty.call(config, "key")) {
                var getter = Object.getOwnPropertyDescriptor(config, "key").get;
                if (getter && getter.isReactWarning) {
                  return false;
                }
              }
            }
            return config.key !== void 0;
          }
          function defineKeyPropWarningGetter(props, displayName) {
            var warnAboutAccessingKey = function() {
              {
                if (!specialPropKeyWarningShown) {
                  specialPropKeyWarningShown = true;
                  error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
                }
              }
            };
            warnAboutAccessingKey.isReactWarning = true;
            Object.defineProperty(props, "key", {
              get: warnAboutAccessingKey,
              configurable: true
            });
          }
          function defineRefPropWarningGetter(props, displayName) {
            var warnAboutAccessingRef = function() {
              {
                if (!specialPropRefWarningShown) {
                  specialPropRefWarningShown = true;
                  error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
                }
              }
            };
            warnAboutAccessingRef.isReactWarning = true;
            Object.defineProperty(props, "ref", {
              get: warnAboutAccessingRef,
              configurable: true
            });
          }
          function warnIfStringRefCannotBeAutoConverted(config) {
            {
              if (typeof config.ref === "string" && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
                var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
                if (!didWarnAboutStringRefs[componentName]) {
                  error('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, config.ref);
                  didWarnAboutStringRefs[componentName] = true;
                }
              }
            }
          }
          var ReactElement = function(type, key, ref, self, source, owner, props) {
            var element = {
              // This tag allows us to uniquely identify this as a React Element
              $$typeof: REACT_ELEMENT_TYPE,
              // Built-in properties that belong on the element
              type,
              key,
              ref,
              props,
              // Record the component responsible for creating this element.
              _owner: owner
            };
            {
              element._store = {};
              Object.defineProperty(element._store, "validated", {
                configurable: false,
                enumerable: false,
                writable: true,
                value: false
              });
              Object.defineProperty(element, "_self", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: self
              });
              Object.defineProperty(element, "_source", {
                configurable: false,
                enumerable: false,
                writable: false,
                value: source
              });
              if (Object.freeze) {
                Object.freeze(element.props);
                Object.freeze(element);
              }
            }
            return element;
          };
          function createElement2(type, config, children) {
            var propName;
            var props = {};
            var key = null;
            var ref = null;
            var self = null;
            var source = null;
            if (config != null) {
              if (hasValidRef(config)) {
                ref = config.ref;
                {
                  warnIfStringRefCannotBeAutoConverted(config);
                }
              }
              if (hasValidKey(config)) {
                {
                  checkKeyStringCoercion(config.key);
                }
                key = "" + config.key;
              }
              self = config.__self === void 0 ? null : config.__self;
              source = config.__source === void 0 ? null : config.__source;
              for (propName in config) {
                if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                  props[propName] = config[propName];
                }
              }
            }
            var childrenLength = arguments.length - 2;
            if (childrenLength === 1) {
              props.children = children;
            } else if (childrenLength > 1) {
              var childArray = Array(childrenLength);
              for (var i = 0; i < childrenLength; i++) {
                childArray[i] = arguments[i + 2];
              }
              {
                if (Object.freeze) {
                  Object.freeze(childArray);
                }
              }
              props.children = childArray;
            }
            if (type && type.defaultProps) {
              var defaultProps = type.defaultProps;
              for (propName in defaultProps) {
                if (props[propName] === void 0) {
                  props[propName] = defaultProps[propName];
                }
              }
            }
            {
              if (key || ref) {
                var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
                if (key) {
                  defineKeyPropWarningGetter(props, displayName);
                }
                if (ref) {
                  defineRefPropWarningGetter(props, displayName);
                }
              }
            }
            return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
          }
          function cloneAndReplaceKey(oldElement, newKey) {
            var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
            return newElement;
          }
          function cloneElement2(element, config, children) {
            if (element === null || element === void 0) {
              throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
            }
            var propName;
            var props = assign({}, element.props);
            var key = element.key;
            var ref = element.ref;
            var self = element._self;
            var source = element._source;
            var owner = element._owner;
            if (config != null) {
              if (hasValidRef(config)) {
                ref = config.ref;
                owner = ReactCurrentOwner.current;
              }
              if (hasValidKey(config)) {
                {
                  checkKeyStringCoercion(config.key);
                }
                key = "" + config.key;
              }
              var defaultProps;
              if (element.type && element.type.defaultProps) {
                defaultProps = element.type.defaultProps;
              }
              for (propName in config) {
                if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                  if (config[propName] === void 0 && defaultProps !== void 0) {
                    props[propName] = defaultProps[propName];
                  } else {
                    props[propName] = config[propName];
                  }
                }
              }
            }
            var childrenLength = arguments.length - 2;
            if (childrenLength === 1) {
              props.children = children;
            } else if (childrenLength > 1) {
              var childArray = Array(childrenLength);
              for (var i = 0; i < childrenLength; i++) {
                childArray[i] = arguments[i + 2];
              }
              props.children = childArray;
            }
            return ReactElement(element.type, key, ref, self, source, owner, props);
          }
          function isValidElement2(object) {
            return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
          }
          var SEPARATOR = ".";
          var SUBSEPARATOR = ":";
          function escape(key) {
            var escapeRegex = /[=:]/g;
            var escaperLookup = {
              "=": "=0",
              ":": "=2"
            };
            var escapedString = key.replace(escapeRegex, function(match) {
              return escaperLookup[match];
            });
            return "$" + escapedString;
          }
          var didWarnAboutMaps = false;
          var userProvidedKeyEscapeRegex = /\/+/g;
          function escapeUserProvidedKey(text) {
            return text.replace(userProvidedKeyEscapeRegex, "$&/");
          }
          function getElementKey(element, index) {
            if (typeof element === "object" && element !== null && element.key != null) {
              {
                checkKeyStringCoercion(element.key);
              }
              return escape("" + element.key);
            }
            return index.toString(36);
          }
          function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
            var type = typeof children;
            if (type === "undefined" || type === "boolean") {
              children = null;
            }
            var invokeCallback = false;
            if (children === null) {
              invokeCallback = true;
            } else {
              switch (type) {
                case "string":
                case "number":
                  invokeCallback = true;
                  break;
                case "object":
                  switch (children.$$typeof) {
                    case REACT_ELEMENT_TYPE:
                    case REACT_PORTAL_TYPE:
                      invokeCallback = true;
                  }
              }
            }
            if (invokeCallback) {
              var _child = children;
              var mappedChild = callback(_child);
              var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
              if (isArray(mappedChild)) {
                var escapedChildKey = "";
                if (childKey != null) {
                  escapedChildKey = escapeUserProvidedKey(childKey) + "/";
                }
                mapIntoArray(mappedChild, array, escapedChildKey, "", function(c) {
                  return c;
                });
              } else if (mappedChild != null) {
                if (isValidElement2(mappedChild)) {
                  {
                    if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
                      checkKeyStringCoercion(mappedChild.key);
                    }
                  }
                  mappedChild = cloneAndReplaceKey(
                    mappedChild,
                    // Keep both the (mapped) and old keys if they differ, just as
                    // traverseAllChildren used to do for objects as children
                    escapedPrefix + // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
                    (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? (
                      // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
                      // eslint-disable-next-line react-internal/safe-string-coercion
                      escapeUserProvidedKey("" + mappedChild.key) + "/"
                    ) : "") + childKey
                  );
                }
                array.push(mappedChild);
              }
              return 1;
            }
            var child;
            var nextName;
            var subtreeCount = 0;
            var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
            if (isArray(children)) {
              for (var i = 0; i < children.length; i++) {
                child = children[i];
                nextName = nextNamePrefix + getElementKey(child, i);
                subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
              }
            } else {
              var iteratorFn = getIteratorFn(children);
              if (typeof iteratorFn === "function") {
                var iterableChildren = children;
                {
                  if (iteratorFn === iterableChildren.entries) {
                    if (!didWarnAboutMaps) {
                      warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                    }
                    didWarnAboutMaps = true;
                  }
                }
                var iterator = iteratorFn.call(iterableChildren);
                var step;
                var ii = 0;
                while (!(step = iterator.next()).done) {
                  child = step.value;
                  nextName = nextNamePrefix + getElementKey(child, ii++);
                  subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
                }
              } else if (type === "object") {
                var childrenString = String(children);
                throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
              }
            }
            return subtreeCount;
          }
          function mapChildren(children, func, context) {
            if (children == null) {
              return children;
            }
            var result = [];
            var count = 0;
            mapIntoArray(children, result, "", "", function(child) {
              return func.call(context, child, count++);
            });
            return result;
          }
          function countChildren(children) {
            var n = 0;
            mapChildren(children, function() {
              n++;
            });
            return n;
          }
          function forEachChildren(children, forEachFunc, forEachContext) {
            mapChildren(children, function() {
              forEachFunc.apply(this, arguments);
            }, forEachContext);
          }
          function toArray(children) {
            return mapChildren(children, function(child) {
              return child;
            }) || [];
          }
          function onlyChild(children) {
            if (!isValidElement2(children)) {
              throw new Error("React.Children.only expected to receive a single React element child.");
            }
            return children;
          }
          function createContext2(defaultValue) {
            var context = {
              $$typeof: REACT_CONTEXT_TYPE,
              // As a workaround to support multiple concurrent renderers, we categorize
              // some renderers as primary and others as secondary. We only expect
              // there to be two concurrent renderers at most: React Native (primary) and
              // Fabric (secondary); React DOM (primary) and React ART (secondary).
              // Secondary renderers store their context values on separate fields.
              _currentValue: defaultValue,
              _currentValue2: defaultValue,
              // Used to track how many concurrent renderers this context currently
              // supports within in a single renderer. Such as parallel server rendering.
              _threadCount: 0,
              // These are circular
              Provider: null,
              Consumer: null,
              // Add these to use same hidden class in VM as ServerContext
              _defaultValue: null,
              _globalName: null
            };
            context.Provider = {
              $$typeof: REACT_PROVIDER_TYPE,
              _context: context
            };
            var hasWarnedAboutUsingNestedContextConsumers = false;
            var hasWarnedAboutUsingConsumerProvider = false;
            var hasWarnedAboutDisplayNameOnConsumer = false;
            {
              var Consumer = {
                $$typeof: REACT_CONTEXT_TYPE,
                _context: context
              };
              Object.defineProperties(Consumer, {
                Provider: {
                  get: function() {
                    if (!hasWarnedAboutUsingConsumerProvider) {
                      hasWarnedAboutUsingConsumerProvider = true;
                      error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
                    }
                    return context.Provider;
                  },
                  set: function(_Provider) {
                    context.Provider = _Provider;
                  }
                },
                _currentValue: {
                  get: function() {
                    return context._currentValue;
                  },
                  set: function(_currentValue) {
                    context._currentValue = _currentValue;
                  }
                },
                _currentValue2: {
                  get: function() {
                    return context._currentValue2;
                  },
                  set: function(_currentValue2) {
                    context._currentValue2 = _currentValue2;
                  }
                },
                _threadCount: {
                  get: function() {
                    return context._threadCount;
                  },
                  set: function(_threadCount) {
                    context._threadCount = _threadCount;
                  }
                },
                Consumer: {
                  get: function() {
                    if (!hasWarnedAboutUsingNestedContextConsumers) {
                      hasWarnedAboutUsingNestedContextConsumers = true;
                      error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                    }
                    return context.Consumer;
                  }
                },
                displayName: {
                  get: function() {
                    return context.displayName;
                  },
                  set: function(displayName) {
                    if (!hasWarnedAboutDisplayNameOnConsumer) {
                      warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
                      hasWarnedAboutDisplayNameOnConsumer = true;
                    }
                  }
                }
              });
              context.Consumer = Consumer;
            }
            {
              context._currentRenderer = null;
              context._currentRenderer2 = null;
            }
            return context;
          }
          var Uninitialized = -1;
          var Pending = 0;
          var Resolved = 1;
          var Rejected = 2;
          function lazyInitializer(payload) {
            if (payload._status === Uninitialized) {
              var ctor = payload._result;
              var thenable = ctor();
              thenable.then(function(moduleObject2) {
                if (payload._status === Pending || payload._status === Uninitialized) {
                  var resolved = payload;
                  resolved._status = Resolved;
                  resolved._result = moduleObject2;
                }
              }, function(error2) {
                if (payload._status === Pending || payload._status === Uninitialized) {
                  var rejected = payload;
                  rejected._status = Rejected;
                  rejected._result = error2;
                }
              });
              if (payload._status === Uninitialized) {
                var pending = payload;
                pending._status = Pending;
                pending._result = thenable;
              }
            }
            if (payload._status === Resolved) {
              var moduleObject = payload._result;
              {
                if (moduleObject === void 0) {
                  error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
                }
              }
              {
                if (!("default" in moduleObject)) {
                  error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
                }
              }
              return moduleObject.default;
            } else {
              throw payload._result;
            }
          }
          function lazy2(ctor) {
            var payload = {
              // We use these fields to store the result.
              _status: Uninitialized,
              _result: ctor
            };
            var lazyType = {
              $$typeof: REACT_LAZY_TYPE,
              _payload: payload,
              _init: lazyInitializer
            };
            {
              var defaultProps;
              var propTypes;
              Object.defineProperties(lazyType, {
                defaultProps: {
                  configurable: true,
                  get: function() {
                    return defaultProps;
                  },
                  set: function(newDefaultProps) {
                    error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                    defaultProps = newDefaultProps;
                    Object.defineProperty(lazyType, "defaultProps", {
                      enumerable: true
                    });
                  }
                },
                propTypes: {
                  configurable: true,
                  get: function() {
                    return propTypes;
                  },
                  set: function(newPropTypes) {
                    error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                    propTypes = newPropTypes;
                    Object.defineProperty(lazyType, "propTypes", {
                      enumerable: true
                    });
                  }
                }
              });
            }
            return lazyType;
          }
          function forwardRef2(render) {
            {
              if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
                error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
              } else if (typeof render !== "function") {
                error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
              } else {
                if (render.length !== 0 && render.length !== 2) {
                  error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
                }
              }
              if (render != null) {
                if (render.defaultProps != null || render.propTypes != null) {
                  error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
                }
              }
            }
            var elementType = {
              $$typeof: REACT_FORWARD_REF_TYPE,
              render
            };
            {
              var ownName;
              Object.defineProperty(elementType, "displayName", {
                enumerable: false,
                configurable: true,
                get: function() {
                  return ownName;
                },
                set: function(name) {
                  ownName = name;
                  if (!render.name && !render.displayName) {
                    render.displayName = name;
                  }
                }
              });
            }
            return elementType;
          }
          var REACT_MODULE_REFERENCE;
          {
            REACT_MODULE_REFERENCE = /* @__PURE__ */ Symbol.for("react.module.reference");
          }
          function isValidElementType(type) {
            if (typeof type === "string" || typeof type === "function") {
              return true;
            }
            if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
              return true;
            }
            if (typeof type === "object" && type !== null) {
              if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
              // types supported by any Flight configuration anywhere since
              // we don't know which Flight build this will end up being used
              // with.
              type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) {
                return true;
              }
            }
            return false;
          }
          function memo2(type, compare) {
            {
              if (!isValidElementType(type)) {
                error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
              }
            }
            var elementType = {
              $$typeof: REACT_MEMO_TYPE,
              type,
              compare: compare === void 0 ? null : compare
            };
            {
              var ownName;
              Object.defineProperty(elementType, "displayName", {
                enumerable: false,
                configurable: true,
                get: function() {
                  return ownName;
                },
                set: function(name) {
                  ownName = name;
                  if (!type.name && !type.displayName) {
                    type.displayName = name;
                  }
                }
              });
            }
            return elementType;
          }
          function resolveDispatcher() {
            var dispatcher = ReactCurrentDispatcher.current;
            {
              if (dispatcher === null) {
                error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
              }
            }
            return dispatcher;
          }
          function useContext2(Context) {
            var dispatcher = resolveDispatcher();
            {
              if (Context._context !== void 0) {
                var realContext = Context._context;
                if (realContext.Consumer === Context) {
                  error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
                } else if (realContext.Provider === Context) {
                  error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
                }
              }
            }
            return dispatcher.useContext(Context);
          }
          function useState2(initialState) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useState(initialState);
          }
          function useReducer2(reducer, initialArg, init) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useReducer(reducer, initialArg, init);
          }
          function useRef2(initialValue) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useRef(initialValue);
          }
          function useEffect2(create, deps) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useEffect(create, deps);
          }
          function useInsertionEffect(create, deps) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useInsertionEffect(create, deps);
          }
          function useLayoutEffect2(create, deps) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useLayoutEffect(create, deps);
          }
          function useCallback2(callback, deps) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useCallback(callback, deps);
          }
          function useMemo2(create, deps) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useMemo(create, deps);
          }
          function useImperativeHandle2(ref, create, deps) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useImperativeHandle(ref, create, deps);
          }
          function useDebugValue(value, formatterFn) {
            {
              var dispatcher = resolveDispatcher();
              return dispatcher.useDebugValue(value, formatterFn);
            }
          }
          function useTransition2() {
            var dispatcher = resolveDispatcher();
            return dispatcher.useTransition();
          }
          function useDeferredValue2(value) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useDeferredValue(value);
          }
          function useId2() {
            var dispatcher = resolveDispatcher();
            return dispatcher.useId();
          }
          function useSyncExternalStore2(subscribe2, getSnapshot, getServerSnapshot) {
            var dispatcher = resolveDispatcher();
            return dispatcher.useSyncExternalStore(subscribe2, getSnapshot, getServerSnapshot);
          }
          var disabledDepth = 0;
          var prevLog;
          var prevInfo;
          var prevWarn;
          var prevError;
          var prevGroup;
          var prevGroupCollapsed;
          var prevGroupEnd;
          function disabledLog() {
          }
          disabledLog.__reactDisabledLog = true;
          function disableLogs() {
            {
              if (disabledDepth === 0) {
                prevLog = console.log;
                prevInfo = console.info;
                prevWarn = console.warn;
                prevError = console.error;
                prevGroup = console.group;
                prevGroupCollapsed = console.groupCollapsed;
                prevGroupEnd = console.groupEnd;
                var props = {
                  configurable: true,
                  enumerable: true,
                  value: disabledLog,
                  writable: true
                };
                Object.defineProperties(console, {
                  info: props,
                  log: props,
                  warn: props,
                  error: props,
                  group: props,
                  groupCollapsed: props,
                  groupEnd: props
                });
              }
              disabledDepth++;
            }
          }
          function reenableLogs() {
            {
              disabledDepth--;
              if (disabledDepth === 0) {
                var props = {
                  configurable: true,
                  enumerable: true,
                  writable: true
                };
                Object.defineProperties(console, {
                  log: assign({}, props, {
                    value: prevLog
                  }),
                  info: assign({}, props, {
                    value: prevInfo
                  }),
                  warn: assign({}, props, {
                    value: prevWarn
                  }),
                  error: assign({}, props, {
                    value: prevError
                  }),
                  group: assign({}, props, {
                    value: prevGroup
                  }),
                  groupCollapsed: assign({}, props, {
                    value: prevGroupCollapsed
                  }),
                  groupEnd: assign({}, props, {
                    value: prevGroupEnd
                  })
                });
              }
              if (disabledDepth < 0) {
                error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
              }
            }
          }
          var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
          var prefix;
          function describeBuiltInComponentFrame(name, source, ownerFn) {
            {
              if (prefix === void 0) {
                try {
                  throw Error();
                } catch (x) {
                  var match = x.stack.trim().match(/\n( *(at )?)/);
                  prefix = match && match[1] || "";
                }
              }
              return "\n" + prefix + name;
            }
          }
          var reentry = false;
          var componentFrameCache;
          {
            var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
            componentFrameCache = new PossiblyWeakMap();
          }
          function describeNativeComponentFrame(fn, construct) {
            if (!fn || reentry) {
              return "";
            }
            {
              var frame = componentFrameCache.get(fn);
              if (frame !== void 0) {
                return frame;
              }
            }
            var control;
            reentry = true;
            var previousPrepareStackTrace = Error.prepareStackTrace;
            Error.prepareStackTrace = void 0;
            var previousDispatcher;
            {
              previousDispatcher = ReactCurrentDispatcher$1.current;
              ReactCurrentDispatcher$1.current = null;
              disableLogs();
            }
            try {
              if (construct) {
                var Fake = function() {
                  throw Error();
                };
                Object.defineProperty(Fake.prototype, "props", {
                  set: function() {
                    throw Error();
                  }
                });
                if (typeof Reflect === "object" && Reflect.construct) {
                  try {
                    Reflect.construct(Fake, []);
                  } catch (x) {
                    control = x;
                  }
                  Reflect.construct(fn, [], Fake);
                } else {
                  try {
                    Fake.call();
                  } catch (x) {
                    control = x;
                  }
                  fn.call(Fake.prototype);
                }
              } else {
                try {
                  throw Error();
                } catch (x) {
                  control = x;
                }
                fn();
              }
            } catch (sample) {
              if (sample && control && typeof sample.stack === "string") {
                var sampleLines = sample.stack.split("\n");
                var controlLines = control.stack.split("\n");
                var s = sampleLines.length - 1;
                var c = controlLines.length - 1;
                while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
                  c--;
                }
                for (; s >= 1 && c >= 0; s--, c--) {
                  if (sampleLines[s] !== controlLines[c]) {
                    if (s !== 1 || c !== 1) {
                      do {
                        s--;
                        c--;
                        if (c < 0 || sampleLines[s] !== controlLines[c]) {
                          var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
                          if (fn.displayName && _frame.includes("<anonymous>")) {
                            _frame = _frame.replace("<anonymous>", fn.displayName);
                          }
                          {
                            if (typeof fn === "function") {
                              componentFrameCache.set(fn, _frame);
                            }
                          }
                          return _frame;
                        }
                      } while (s >= 1 && c >= 0);
                    }
                    break;
                  }
                }
              }
            } finally {
              reentry = false;
              {
                ReactCurrentDispatcher$1.current = previousDispatcher;
                reenableLogs();
              }
              Error.prepareStackTrace = previousPrepareStackTrace;
            }
            var name = fn ? fn.displayName || fn.name : "";
            var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
            {
              if (typeof fn === "function") {
                componentFrameCache.set(fn, syntheticFrame);
              }
            }
            return syntheticFrame;
          }
          function describeFunctionComponentFrame(fn, source, ownerFn) {
            {
              return describeNativeComponentFrame(fn, false);
            }
          }
          function shouldConstruct(Component2) {
            var prototype = Component2.prototype;
            return !!(prototype && prototype.isReactComponent);
          }
          function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
            if (type == null) {
              return "";
            }
            if (typeof type === "function") {
              {
                return describeNativeComponentFrame(type, shouldConstruct(type));
              }
            }
            if (typeof type === "string") {
              return describeBuiltInComponentFrame(type);
            }
            switch (type) {
              case REACT_SUSPENSE_TYPE:
                return describeBuiltInComponentFrame("Suspense");
              case REACT_SUSPENSE_LIST_TYPE:
                return describeBuiltInComponentFrame("SuspenseList");
            }
            if (typeof type === "object") {
              switch (type.$$typeof) {
                case REACT_FORWARD_REF_TYPE:
                  return describeFunctionComponentFrame(type.render);
                case REACT_MEMO_TYPE:
                  return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
                case REACT_LAZY_TYPE: {
                  var lazyComponent = type;
                  var payload = lazyComponent._payload;
                  var init = lazyComponent._init;
                  try {
                    return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                  } catch (x) {
                  }
                }
              }
            }
            return "";
          }
          var loggedTypeFailures = {};
          var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
          function setCurrentlyValidatingElement(element) {
            {
              if (element) {
                var owner = element._owner;
                var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
                ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
              } else {
                ReactDebugCurrentFrame$1.setExtraStackFrame(null);
              }
            }
          }
          function checkPropTypes(typeSpecs, values, location, componentName, element) {
            {
              var has = Function.call.bind(hasOwnProperty);
              for (var typeSpecName in typeSpecs) {
                if (has(typeSpecs, typeSpecName)) {
                  var error$1 = void 0;
                  try {
                    if (typeof typeSpecs[typeSpecName] !== "function") {
                      var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                      err.name = "Invariant Violation";
                      throw err;
                    }
                    error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                  } catch (ex) {
                    error$1 = ex;
                  }
                  if (error$1 && !(error$1 instanceof Error)) {
                    setCurrentlyValidatingElement(element);
                    error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                    setCurrentlyValidatingElement(null);
                  }
                  if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                    loggedTypeFailures[error$1.message] = true;
                    setCurrentlyValidatingElement(element);
                    error("Failed %s type: %s", location, error$1.message);
                    setCurrentlyValidatingElement(null);
                  }
                }
              }
            }
          }
          function setCurrentlyValidatingElement$1(element) {
            {
              if (element) {
                var owner = element._owner;
                var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
                setExtraStackFrame(stack);
              } else {
                setExtraStackFrame(null);
              }
            }
          }
          var propTypesMisspellWarningShown;
          {
            propTypesMisspellWarningShown = false;
          }
          function getDeclarationErrorAddendum() {
            if (ReactCurrentOwner.current) {
              var name = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (name) {
                return "\n\nCheck the render method of `" + name + "`.";
              }
            }
            return "";
          }
          function getSourceInfoErrorAddendum(source) {
            if (source !== void 0) {
              var fileName = source.fileName.replace(/^.*[\\\/]/, "");
              var lineNumber = source.lineNumber;
              return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
            }
            return "";
          }
          function getSourceInfoErrorAddendumForProps(elementProps) {
            if (elementProps !== null && elementProps !== void 0) {
              return getSourceInfoErrorAddendum(elementProps.__source);
            }
            return "";
          }
          var ownerHasKeyUseWarning = {};
          function getCurrentComponentErrorInfo(parentType) {
            var info = getDeclarationErrorAddendum();
            if (!info) {
              var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
              if (parentName) {
                info = "\n\nCheck the top-level render call using <" + parentName + ">.";
              }
            }
            return info;
          }
          function validateExplicitKey(element, parentType) {
            if (!element._store || element._store.validated || element.key != null) {
              return;
            }
            element._store.validated = true;
            var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
            if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
              return;
            }
            ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
            var childOwner = "";
            if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
              childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
            }
            {
              setCurrentlyValidatingElement$1(element);
              error('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
              setCurrentlyValidatingElement$1(null);
            }
          }
          function validateChildKeys(node, parentType) {
            if (typeof node !== "object") {
              return;
            }
            if (isArray(node)) {
              for (var i = 0; i < node.length; i++) {
                var child = node[i];
                if (isValidElement2(child)) {
                  validateExplicitKey(child, parentType);
                }
              }
            } else if (isValidElement2(node)) {
              if (node._store) {
                node._store.validated = true;
              }
            } else if (node) {
              var iteratorFn = getIteratorFn(node);
              if (typeof iteratorFn === "function") {
                if (iteratorFn !== node.entries) {
                  var iterator = iteratorFn.call(node);
                  var step;
                  while (!(step = iterator.next()).done) {
                    if (isValidElement2(step.value)) {
                      validateExplicitKey(step.value, parentType);
                    }
                  }
                }
              }
            }
          }
          function validatePropTypes(element) {
            {
              var type = element.type;
              if (type === null || type === void 0 || typeof type === "string") {
                return;
              }
              var propTypes;
              if (typeof type === "function") {
                propTypes = type.propTypes;
              } else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
              // Inner props are checked in the reconciler.
              type.$$typeof === REACT_MEMO_TYPE)) {
                propTypes = type.propTypes;
              } else {
                return;
              }
              if (propTypes) {
                var name = getComponentNameFromType(type);
                checkPropTypes(propTypes, element.props, "prop", name, element);
              } else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
                propTypesMisspellWarningShown = true;
                var _name = getComponentNameFromType(type);
                error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
              }
              if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) {
                error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
              }
            }
          }
          function validateFragmentProps(fragment) {
            {
              var keys = Object.keys(fragment.props);
              for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                if (key !== "children" && key !== "key") {
                  setCurrentlyValidatingElement$1(fragment);
                  error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                  setCurrentlyValidatingElement$1(null);
                  break;
                }
              }
              if (fragment.ref !== null) {
                setCurrentlyValidatingElement$1(fragment);
                error("Invalid attribute `ref` supplied to `React.Fragment`.");
                setCurrentlyValidatingElement$1(null);
              }
            }
          }
          function createElementWithValidation(type, props, children) {
            var validType = isValidElementType(type);
            if (!validType) {
              var info = "";
              if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
                info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
              }
              var sourceInfo = getSourceInfoErrorAddendumForProps(props);
              if (sourceInfo) {
                info += sourceInfo;
              } else {
                info += getDeclarationErrorAddendum();
              }
              var typeString;
              if (type === null) {
                typeString = "null";
              } else if (isArray(type)) {
                typeString = "array";
              } else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
                typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
                info = " Did you accidentally export a JSX literal instead of a component?";
              } else {
                typeString = typeof type;
              }
              {
                error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
              }
            }
            var element = createElement2.apply(this, arguments);
            if (element == null) {
              return element;
            }
            if (validType) {
              for (var i = 2; i < arguments.length; i++) {
                validateChildKeys(arguments[i], type);
              }
            }
            if (type === REACT_FRAGMENT_TYPE) {
              validateFragmentProps(element);
            } else {
              validatePropTypes(element);
            }
            return element;
          }
          var didWarnAboutDeprecatedCreateFactory = false;
          function createFactoryWithValidation(type) {
            var validatedFactory = createElementWithValidation.bind(null, type);
            validatedFactory.type = type;
            {
              if (!didWarnAboutDeprecatedCreateFactory) {
                didWarnAboutDeprecatedCreateFactory = true;
                warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
              }
              Object.defineProperty(validatedFactory, "type", {
                enumerable: false,
                get: function() {
                  warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
                  Object.defineProperty(this, "type", {
                    value: type
                  });
                  return type;
                }
              });
            }
            return validatedFactory;
          }
          function cloneElementWithValidation(element, props, children) {
            var newElement = cloneElement2.apply(this, arguments);
            for (var i = 2; i < arguments.length; i++) {
              validateChildKeys(arguments[i], newElement.type);
            }
            validatePropTypes(newElement);
            return newElement;
          }
          function startTransition2(scope, options) {
            var prevTransition = ReactCurrentBatchConfig.transition;
            ReactCurrentBatchConfig.transition = {};
            var currentTransition = ReactCurrentBatchConfig.transition;
            {
              ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
            }
            try {
              scope();
            } finally {
              ReactCurrentBatchConfig.transition = prevTransition;
              {
                if (prevTransition === null && currentTransition._updatedFibers) {
                  var updatedFibersCount = currentTransition._updatedFibers.size;
                  if (updatedFibersCount > 10) {
                    warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                  }
                  currentTransition._updatedFibers.clear();
                }
              }
            }
          }
          var didWarnAboutMessageChannel = false;
          var enqueueTaskImpl = null;
          function enqueueTask(task) {
            if (enqueueTaskImpl === null) {
              try {
                var requireString = ("require" + Math.random()).slice(0, 7);
                var nodeRequire = module && module[requireString];
                enqueueTaskImpl = nodeRequire.call(module, "timers").setImmediate;
              } catch (_err) {
                enqueueTaskImpl = function(callback) {
                  {
                    if (didWarnAboutMessageChannel === false) {
                      didWarnAboutMessageChannel = true;
                      if (typeof MessageChannel === "undefined") {
                        error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
                      }
                    }
                  }
                  var channel = new MessageChannel();
                  channel.port1.onmessage = callback;
                  channel.port2.postMessage(void 0);
                };
              }
            }
            return enqueueTaskImpl(task);
          }
          var actScopeDepth = 0;
          var didWarnNoAwaitAct = false;
          function act(callback) {
            {
              var prevActScopeDepth = actScopeDepth;
              actScopeDepth++;
              if (ReactCurrentActQueue.current === null) {
                ReactCurrentActQueue.current = [];
              }
              var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
              var result;
              try {
                ReactCurrentActQueue.isBatchingLegacy = true;
                result = callback();
                if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
                  var queue = ReactCurrentActQueue.current;
                  if (queue !== null) {
                    ReactCurrentActQueue.didScheduleLegacyUpdate = false;
                    flushActQueue(queue);
                  }
                }
              } catch (error2) {
                popActScope(prevActScopeDepth);
                throw error2;
              } finally {
                ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
              }
              if (result !== null && typeof result === "object" && typeof result.then === "function") {
                var thenableResult = result;
                var wasAwaited = false;
                var thenable = {
                  then: function(resolve, reject) {
                    wasAwaited = true;
                    thenableResult.then(function(returnValue2) {
                      popActScope(prevActScopeDepth);
                      if (actScopeDepth === 0) {
                        recursivelyFlushAsyncActWork(returnValue2, resolve, reject);
                      } else {
                        resolve(returnValue2);
                      }
                    }, function(error2) {
                      popActScope(prevActScopeDepth);
                      reject(error2);
                    });
                  }
                };
                {
                  if (!didWarnNoAwaitAct && typeof Promise !== "undefined") {
                    Promise.resolve().then(function() {
                    }).then(function() {
                      if (!wasAwaited) {
                        didWarnNoAwaitAct = true;
                        error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
                      }
                    });
                  }
                }
                return thenable;
              } else {
                var returnValue = result;
                popActScope(prevActScopeDepth);
                if (actScopeDepth === 0) {
                  var _queue = ReactCurrentActQueue.current;
                  if (_queue !== null) {
                    flushActQueue(_queue);
                    ReactCurrentActQueue.current = null;
                  }
                  var _thenable = {
                    then: function(resolve, reject) {
                      if (ReactCurrentActQueue.current === null) {
                        ReactCurrentActQueue.current = [];
                        recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                      } else {
                        resolve(returnValue);
                      }
                    }
                  };
                  return _thenable;
                } else {
                  var _thenable2 = {
                    then: function(resolve, reject) {
                      resolve(returnValue);
                    }
                  };
                  return _thenable2;
                }
              }
            }
          }
          function popActScope(prevActScopeDepth) {
            {
              if (prevActScopeDepth !== actScopeDepth - 1) {
                error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
              }
              actScopeDepth = prevActScopeDepth;
            }
          }
          function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
            {
              var queue = ReactCurrentActQueue.current;
              if (queue !== null) {
                try {
                  flushActQueue(queue);
                  enqueueTask(function() {
                    if (queue.length === 0) {
                      ReactCurrentActQueue.current = null;
                      resolve(returnValue);
                    } else {
                      recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                    }
                  });
                } catch (error2) {
                  reject(error2);
                }
              } else {
                resolve(returnValue);
              }
            }
          }
          var isFlushing = false;
          function flushActQueue(queue) {
            {
              if (!isFlushing) {
                isFlushing = true;
                var i = 0;
                try {
                  for (; i < queue.length; i++) {
                    var callback = queue[i];
                    do {
                      callback = callback(true);
                    } while (callback !== null);
                  }
                  queue.length = 0;
                } catch (error2) {
                  queue = queue.slice(i + 1);
                  throw error2;
                } finally {
                  isFlushing = false;
                }
              }
            }
          }
          var createElement$1 = createElementWithValidation;
          var cloneElement$1 = cloneElementWithValidation;
          var createFactory = createFactoryWithValidation;
          var Children2 = {
            map: mapChildren,
            forEach: forEachChildren,
            count: countChildren,
            toArray,
            only: onlyChild
          };
          exports.Children = Children2;
          exports.Component = Component;
          exports.Fragment = REACT_FRAGMENT_TYPE;
          exports.Profiler = REACT_PROFILER_TYPE;
          exports.PureComponent = PureComponent;
          exports.StrictMode = REACT_STRICT_MODE_TYPE;
          exports.Suspense = REACT_SUSPENSE_TYPE;
          exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
          exports.act = act;
          exports.cloneElement = cloneElement$1;
          exports.createContext = createContext2;
          exports.createElement = createElement$1;
          exports.createFactory = createFactory;
          exports.createRef = createRef;
          exports.forwardRef = forwardRef2;
          exports.isValidElement = isValidElement2;
          exports.lazy = lazy2;
          exports.memo = memo2;
          exports.startTransition = startTransition2;
          exports.unstable_act = act;
          exports.useCallback = useCallback2;
          exports.useContext = useContext2;
          exports.useDebugValue = useDebugValue;
          exports.useDeferredValue = useDeferredValue2;
          exports.useEffect = useEffect2;
          exports.useId = useId2;
          exports.useImperativeHandle = useImperativeHandle2;
          exports.useInsertionEffect = useInsertionEffect;
          exports.useLayoutEffect = useLayoutEffect2;
          exports.useMemo = useMemo2;
          exports.useReducer = useReducer2;
          exports.useRef = useRef2;
          exports.useState = useState2;
          exports.useSyncExternalStore = useSyncExternalStore2;
          exports.useTransition = useTransition2;
          exports.version = ReactVersion;
          if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
            __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
          }
        })();
      }
    }
  });

  // node_modules/react/index.js
  var require_react = __commonJS({
    "node_modules/react/index.js"(exports, module) {
      "use strict";
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      if (false) {
        module.exports = null;
      } else {
        module.exports = require_react_development();
      }
    }
  });

  // runtime/jsx_shim.ts
  var __jsx;
  var init_jsx_shim = __esm({
    "runtime/jsx_shim.ts"() {
      __jsx = function __jsx2(...a) {
        return require_react().createElement(...a);
      };
    }
  });

  // renderer/errorReporter.ts
  function reportError(e, ctx) {
    const g = globalThis;
    const err = e;
    const msg = err?.stack || err?.message || String(e);
    if (typeof g.console?.error === "function") {
      g.console.error(`[err] ${ctx}: ${msg}`);
    } else if (typeof g.__hostLog === "function") {
      try {
        g.__hostLog(2, `[err] ${ctx}: ${msg}`);
      } catch {
      }
    }
  }
  var init_errorReporter = __esm({
    "renderer/errorReporter.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
    }
  });

  // renderer/debugLog.ts
  var debugLog;
  var init_debugLog = __esm({
    "renderer/debugLog.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      debugLog = { log: (_ch, _msg) => {
      } };
    }
  });

  // runtime/tw.ts
  function spacing(val) {
    if (val.startsWith("[") && val.endsWith("]")) {
      const n = parseFloat(val.slice(1, -1));
      return isNaN(n) ? void 0 : n;
    }
    return SPACING[val];
  }
  function widthValue(val) {
    if (val === "full") return "100%";
    if (val === "screen") return "100%";
    if (val === "auto") return void 0;
    if (val === "min") return void 0;
    if (val === "max") return void 0;
    if (val === "fit") return void 0;
    if (val === "1/2") return "50%";
    if (val === "1/3") return "33.333%";
    if (val === "2/3") return "66.667%";
    if (val === "1/4") return "25%";
    if (val === "2/4") return "50%";
    if (val === "3/4") return "75%";
    if (val === "1/5") return "20%";
    if (val === "2/5") return "40%";
    if (val === "3/5") return "60%";
    if (val === "4/5") return "80%";
    if (val === "1/6") return "16.667%";
    if (val === "5/6") return "83.333%";
    if (val === "1/12") return "8.333%";
    if (val === "2/12") return "16.667%";
    if (val === "3/12") return "25%";
    if (val === "4/12") return "33.333%";
    if (val === "5/12") return "41.667%";
    if (val === "6/12") return "50%";
    if (val === "7/12") return "58.333%";
    if (val === "8/12") return "66.667%";
    if (val === "9/12") return "75%";
    if (val === "10/12") return "83.333%";
    if (val === "11/12") return "91.667%";
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1);
      if (inner.endsWith("%") || inner.endsWith("vw") || inner.endsWith("vh")) return inner;
      const n = parseFloat(inner);
      return isNaN(n) ? void 0 : n;
    }
    return spacing(val);
  }
  function radiusValue(val) {
    if (val === void 0) return RADIUS["DEFAULT"];
    if (val.startsWith("[") && val.endsWith("]")) {
      const n = parseFloat(val.slice(1, -1));
      return isNaN(n) ? void 0 : n;
    }
    return RADIUS[val] ?? void 0;
  }
  function resolveColor(val) {
    if (val === "transparent") return "transparent";
    if (val === "black") return "#000000";
    if (val === "white") return "#ffffff";
    if (val === "inherit" || val === "current") return "inherit";
    if (val.startsWith("[") && val.endsWith("]")) return val.slice(1, -1);
    const dash = val.lastIndexOf("-");
    if (dash === -1) return void 0;
    const family = val.slice(0, dash);
    const shade = val.slice(dash + 1);
    return COLORS[family]?.[shade];
  }
  function parseClass(cls, grad, trans) {
    if (cls.includes(":")) return {};
    if (cls === "flex") return {};
    if (cls === "block") return {};
    if (cls === "inline-block") return {};
    if (cls === "inline") return {};
    if (cls === "inline-flex") return { flexDirection: "row" };
    if (cls === "grid") return { flexDirection: "row", flexWrap: "wrap" };
    if (cls === "hidden") return { display: "none" };
    if (cls === "visible") return { visibility: "visible" };
    if (cls === "invisible") return { visibility: "hidden" };
    if (cls === "relative") return { position: "relative" };
    if (cls === "absolute") return { position: "absolute" };
    if (cls === "sticky") return { position: "relative" };
    if (cls === "fixed") return { position: "absolute" };
    if (cls === "truncate") return { textOverflow: "ellipsis", overflow: "hidden" };
    if (cls === "underline") return { textDecorationLine: "underline" };
    if (cls === "line-through") return { textDecorationLine: "line-through" };
    if (cls === "no-underline") return { textDecorationLine: "none" };
    if (cls === "italic") return {};
    if (cls === "not-italic") return {};
    if (cls === "uppercase") return {};
    if (cls === "lowercase") return {};
    if (cls === "capitalize") return {};
    if (cls === "normal-case") return {};
    if (cls === "break-words") return {};
    if (cls === "break-all") return {};
    if (cls === "whitespace-nowrap") return {};
    if (cls === "whitespace-pre") return {};
    if (cls === "grow") return { flexGrow: 1 };
    if (cls === "grow-0") return { flexGrow: 0 };
    if (cls === "shrink") return { flexShrink: 1 };
    if (cls === "shrink-0") return { flexShrink: 0 };
    if (cls === "group") return {};
    if (cls === "cursor-pointer") return {};
    if (cls === "cursor-default") return {};
    if (cls === "cursor-not-allowed") return {};
    if (cls === "select-none") return {};
    if (cls === "select-text") return {};
    if (cls === "resize-none") return {};
    if (cls === "outline-none") return { outlineWidth: 0 };
    if (cls === "outline-0") return { outlineWidth: 0 };
    if (cls === "backdrop-blur") return {};
    if (cls === "backdrop-blur-sm") return {};
    if (cls === "backdrop-blur-md") return {};
    if (cls === "backdrop-blur-lg") return {};
    if (cls === "backdrop-blur-xl") return {};
    if (cls === "backdrop-blur-2xl") return {};
    if (cls === "backdrop-blur-3xl") return {};
    if (cls === "flex-row") return { flexDirection: "row" };
    if (cls === "flex-col") return { flexDirection: "column" };
    if (cls === "flex-row-reverse") return { flexDirection: "row" };
    if (cls === "flex-col-reverse") return { flexDirection: "column" };
    if (cls === "flex-wrap") return { flexWrap: "wrap" };
    if (cls === "flex-wrap-reverse") return { flexWrap: "wrap" };
    if (cls === "flex-nowrap") return { flexWrap: "nowrap" };
    if (cls === "flex-1") return { flexGrow: 1, flexShrink: 1, flexBasis: 0 };
    if (cls === "flex-auto") return { flexGrow: 1, flexShrink: 1, flexBasis: "auto" };
    if (cls === "flex-initial") return { flexGrow: 0, flexShrink: 1, flexBasis: "auto" };
    if (cls === "flex-none") return { flexGrow: 0, flexShrink: 0, flexBasis: "auto" };
    if (cls === "flex-shrink") return { flexShrink: 1 };
    if (cls === "flex-shrink-0") return { flexShrink: 0 };
    if (cls === "flex-grow") return { flexGrow: 1 };
    if (cls === "flex-grow-0") return { flexGrow: 0 };
    if (cls === "overflow-hidden") return { overflow: "hidden" };
    if (cls === "overflow-visible") return { overflow: "visible" };
    if (cls === "overflow-scroll") return { overflow: "scroll" };
    if (cls === "overflow-auto") return { overflow: "scroll" };
    if (cls === "overflow-x-auto") return { overflow: "scroll" };
    if (cls === "overflow-y-auto") return { overflow: "scroll" };
    if (cls === "overflow-x-hidden") return { overflow: "hidden" };
    if (cls === "overflow-y-hidden") return { overflow: "hidden" };
    if (cls === "overflow-x-scroll") return { overflow: "scroll" };
    if (cls === "overflow-y-scroll") return { overflow: "scroll" };
    if (cls === "items-start") return { alignItems: "start" };
    if (cls === "items-center") return { alignItems: "center" };
    if (cls === "items-end") return { alignItems: "end" };
    if (cls === "items-stretch") return { alignItems: "stretch" };
    if (cls === "justify-start") return { justifyContent: "start" };
    if (cls === "justify-center") return { justifyContent: "center" };
    if (cls === "justify-end") return { justifyContent: "end" };
    if (cls === "justify-between") return { justifyContent: "space-between" };
    if (cls === "justify-around") return { justifyContent: "space-around" };
    if (cls === "justify-evenly") return { justifyContent: "space-evenly" };
    if (cls === "self-auto") return { alignSelf: "auto" };
    if (cls === "self-start") return { alignSelf: "start" };
    if (cls === "self-center") return { alignSelf: "center" };
    if (cls === "self-end") return { alignSelf: "end" };
    if (cls === "self-stretch") return { alignSelf: "stretch" };
    if (cls === "text-left") return { textAlign: "left" };
    if (cls === "text-center") return { textAlign: "center" };
    if (cls === "text-right") return { textAlign: "right" };
    if (cls === "transition" || cls === "transition-all") {
      trans.active = true;
      return void 0;
    }
    if (cls === "transition-colors") {
      trans.active = true;
      return void 0;
    }
    if (cls === "transition-opacity") {
      trans.active = true;
      return void 0;
    }
    if (cls === "transition-transform") {
      trans.active = true;
      return void 0;
    }
    if (cls === "transition-none") {
      trans.active = false;
      return void 0;
    }
    if (cls === "border") return { borderWidth: 1 };
    if (cls === "border-0") return { borderWidth: 0 };
    if (cls === "border-t") return { borderTopWidth: 1 };
    if (cls === "border-r") return { borderRightWidth: 1 };
    if (cls === "border-b") return { borderBottomWidth: 1 };
    if (cls === "border-l") return { borderLeftWidth: 1 };
    if (cls === "rounded") return { borderRadius: RADIUS["DEFAULT"] };
    if (cls === "rounded-none") return { borderRadius: 0 };
    if (cls === "rounded-full") return { borderRadius: 9999 };
    if (cls === "shadow") return { ...SHADOW["DEFAULT"] };
    if (cls === "origin-center") return { transform: { originX: 0.5, originY: 0.5 } };
    if (cls === "origin-top") return { transform: { originX: 0.5, originY: 0 } };
    if (cls === "origin-bottom") return { transform: { originX: 0.5, originY: 1 } };
    if (cls === "origin-left") return { transform: { originX: 0, originY: 0.5 } };
    if (cls === "origin-right") return { transform: { originX: 1, originY: 0.5 } };
    if (cls === "origin-top-left") return { transform: { originX: 0, originY: 0 } };
    if (cls === "origin-top-right") return { transform: { originX: 1, originY: 0 } };
    if (cls === "origin-bottom-left") return { transform: { originX: 0, originY: 1 } };
    if (cls === "origin-bottom-right") return { transform: { originX: 1, originY: 1 } };
    let negative = false;
    let token = cls;
    if (token.startsWith("-") && token.length > 1 && token[1] !== "-") {
      negative = true;
      token = token.slice(1);
    }
    const neg = (n) => n !== void 0 ? negative ? -n : n : void 0;
    if (token.startsWith("p-")) {
      const v = spacing(token.slice(2));
      return v !== void 0 ? { padding: v } : void 0;
    }
    if (token.startsWith("px-")) {
      const v = spacing(token.slice(3));
      return v !== void 0 ? { paddingLeft: v, paddingRight: v } : void 0;
    }
    if (token.startsWith("py-")) {
      const v = spacing(token.slice(3));
      return v !== void 0 ? { paddingTop: v, paddingBottom: v } : void 0;
    }
    if (token.startsWith("pt-")) {
      const v = spacing(token.slice(3));
      return v !== void 0 ? { paddingTop: v } : void 0;
    }
    if (token.startsWith("pr-")) {
      const v = spacing(token.slice(3));
      return v !== void 0 ? { paddingRight: v } : void 0;
    }
    if (token.startsWith("pb-")) {
      const v = spacing(token.slice(3));
      return v !== void 0 ? { paddingBottom: v } : void 0;
    }
    if (token.startsWith("pl-")) {
      const v = spacing(token.slice(3));
      return v !== void 0 ? { paddingLeft: v } : void 0;
    }
    if (token.startsWith("m-")) {
      const val = token.slice(2);
      if (val === "auto") return {};
      const v = neg(spacing(val));
      return v !== void 0 ? { margin: v } : void 0;
    }
    if (token.startsWith("mx-")) {
      const val = token.slice(3);
      if (val === "auto") return { alignSelf: "center" };
      const v = neg(spacing(val));
      return v !== void 0 ? { marginLeft: v, marginRight: v } : void 0;
    }
    if (token.startsWith("my-")) {
      const val = token.slice(3);
      if (val === "auto") return {};
      const v = neg(spacing(val));
      return v !== void 0 ? { marginTop: v, marginBottom: v } : void 0;
    }
    if (token.startsWith("mt-")) {
      const val = token.slice(3);
      if (val === "auto") return {};
      const v = neg(spacing(val));
      return v !== void 0 ? { marginTop: v } : void 0;
    }
    if (token.startsWith("mr-")) {
      const val = token.slice(3);
      if (val === "auto") return {};
      const v = neg(spacing(val));
      return v !== void 0 ? { marginRight: v } : void 0;
    }
    if (token.startsWith("mb-")) {
      const val = token.slice(3);
      if (val === "auto") return {};
      const v = neg(spacing(val));
      return v !== void 0 ? { marginBottom: v } : void 0;
    }
    if (token.startsWith("ml-")) {
      const val = token.slice(3);
      if (val === "auto") return {};
      const v = neg(spacing(val));
      return v !== void 0 ? { marginLeft: v } : void 0;
    }
    if (token.startsWith("gap-")) {
      const v = spacing(token.slice(4));
      return v !== void 0 ? { gap: v } : void 0;
    }
    if (token.startsWith("gap-x-")) {
      const v = spacing(token.slice(6));
      return v !== void 0 ? { gap: v } : void 0;
    }
    if (token.startsWith("gap-y-")) {
      const v = spacing(token.slice(6));
      return v !== void 0 ? { gap: v } : void 0;
    }
    if (token.startsWith("space-y-")) {
      const v = spacing(token.slice(8));
      return v !== void 0 ? { gap: v } : void 0;
    }
    if (token.startsWith("space-x-")) {
      const v = spacing(token.slice(8));
      return v !== void 0 ? { gap: v } : void 0;
    }
    if (token.startsWith("w-")) {
      const v = widthValue(token.slice(2));
      return v !== void 0 ? { width: v } : void 0;
    }
    if (token.startsWith("h-")) {
      const v = widthValue(token.slice(2));
      return v !== void 0 ? { height: v } : void 0;
    }
    if (token.startsWith("size-")) {
      const v = widthValue(token.slice(5));
      return v !== void 0 ? { width: v, height: v } : void 0;
    }
    if (token.startsWith("min-w-")) {
      const v = widthValue(token.slice(6));
      return v !== void 0 ? { minWidth: v } : void 0;
    }
    if (token.startsWith("min-h-")) {
      const v = widthValue(token.slice(6));
      return v !== void 0 ? { minHeight: v } : void 0;
    }
    if (token.startsWith("max-w-")) {
      const val = token.slice(6);
      const named = MAX_WIDTH[val];
      if (named !== void 0) return { maxWidth: named };
      const v = widthValue(val);
      return v !== void 0 ? { maxWidth: v } : void 0;
    }
    if (token.startsWith("max-h-")) {
      const v = widthValue(token.slice(6));
      return v !== void 0 ? { maxHeight: v } : void 0;
    }
    if (token.startsWith("basis-")) {
      const val = token.slice(6);
      if (val === "auto") return { flexBasis: "auto" };
      const v = widthValue(val);
      return v !== void 0 ? { flexBasis: v } : void 0;
    }
    if (token.startsWith("grid-cols-")) {
      const val = token.slice(10);
      const n = parseInt(val, 10);
      if (!isNaN(n)) return { flexDirection: "row", flexWrap: "wrap" };
      return {};
    }
    if (token.startsWith("col-span-")) return {};
    if (token.startsWith("row-span-")) return {};
    if (token.startsWith("bg-opacity-")) {
      const val = token.slice(11);
      const n = parseInt(val, 10);
      return !isNaN(n) ? { opacity: n / 100 } : void 0;
    }
    if (token.startsWith("placeholder-")) return {};
    if (token.startsWith("animate-")) return {};
    if (token.startsWith("line-clamp-")) return {};
    if (token.startsWith("z-")) {
      const val = token.slice(2);
      if (val === "auto") return { zIndex: 0 };
      if (val.startsWith("[") && val.endsWith("]")) {
        const n2 = parseInt(val.slice(1, -1), 10);
        return isNaN(n2) ? void 0 : { zIndex: n2 };
      }
      const n = parseInt(val, 10);
      return isNaN(n) ? void 0 : { zIndex: n };
    }
    if (token.startsWith("opacity-")) {
      const val = token.slice(8);
      if (val.startsWith("[") && val.endsWith("]")) {
        const n2 = parseFloat(val.slice(1, -1));
        return isNaN(n2) ? void 0 : { opacity: n2 };
      }
      const n = parseInt(val, 10);
      return isNaN(n) ? void 0 : { opacity: n / 100 };
    }
    if (token.startsWith("aspect-")) {
      const val = token.slice(7);
      if (val === "square") return { aspectRatio: 1 };
      if (val === "video") return { aspectRatio: 16 / 9 };
      if (val === "auto") return {};
      if (val.startsWith("[") && val.endsWith("]")) {
        const inner = val.slice(1, -1);
        const parts = inner.split("/");
        if (parts.length === 2) {
          const a = parseFloat(parts[0]);
          const b = parseFloat(parts[1]);
          return !isNaN(a) && !isNaN(b) && b !== 0 ? { aspectRatio: a / b } : void 0;
        }
        const n = parseFloat(inner);
        return isNaN(n) ? void 0 : { aspectRatio: n };
      }
      return void 0;
    }
    if (token.startsWith("inset-x-")) {
      const v = neg(spacing(token.slice(8)));
      return v !== void 0 ? { left: v, right: v } : void 0;
    }
    if (token.startsWith("inset-y-")) {
      const v = neg(spacing(token.slice(8)));
      return v !== void 0 ? { top: v, bottom: v } : void 0;
    }
    if (token.startsWith("inset-")) {
      const v = neg(spacing(token.slice(6)));
      return v !== void 0 ? { top: v, right: v, bottom: v, left: v } : void 0;
    }
    if (token.startsWith("top-")) {
      const v = neg(spacing(token.slice(4)));
      return v !== void 0 ? { top: v } : void 0;
    }
    if (token.startsWith("right-")) {
      const v = neg(spacing(token.slice(6)));
      return v !== void 0 ? { right: v } : void 0;
    }
    if (token.startsWith("bottom-")) {
      const v = neg(spacing(token.slice(7)));
      return v !== void 0 ? { bottom: v } : void 0;
    }
    if (token.startsWith("left-")) {
      const v = neg(spacing(token.slice(5)));
      return v !== void 0 ? { left: v } : void 0;
    }
    if (token.startsWith("rounded-")) {
      const rest = token.slice(8);
      if (rest.startsWith("tl-")) {
        const v2 = radiusValue(rest.slice(3));
        return v2 !== void 0 ? { borderTopLeftRadius: v2 } : void 0;
      }
      if (rest.startsWith("tr-")) {
        const v2 = radiusValue(rest.slice(3));
        return v2 !== void 0 ? { borderTopRightRadius: v2 } : void 0;
      }
      if (rest.startsWith("bl-")) {
        const v2 = radiusValue(rest.slice(3));
        return v2 !== void 0 ? { borderBottomLeftRadius: v2 } : void 0;
      }
      if (rest.startsWith("br-")) {
        const v2 = radiusValue(rest.slice(3));
        return v2 !== void 0 ? { borderBottomRightRadius: v2 } : void 0;
      }
      if (rest.startsWith("t-")) {
        const v2 = radiusValue(rest.slice(2));
        return v2 !== void 0 ? { borderTopLeftRadius: v2, borderTopRightRadius: v2 } : void 0;
      }
      if (rest.startsWith("b-")) {
        const v2 = radiusValue(rest.slice(2));
        return v2 !== void 0 ? { borderBottomLeftRadius: v2, borderBottomRightRadius: v2 } : void 0;
      }
      if (rest.startsWith("l-")) {
        const v2 = radiusValue(rest.slice(2));
        return v2 !== void 0 ? { borderTopLeftRadius: v2, borderBottomLeftRadius: v2 } : void 0;
      }
      if (rest.startsWith("r-")) {
        const v2 = radiusValue(rest.slice(2));
        return v2 !== void 0 ? { borderTopRightRadius: v2, borderBottomRightRadius: v2 } : void 0;
      }
      const v = radiusValue(rest);
      return v !== void 0 ? { borderRadius: v } : void 0;
    }
    if (token.startsWith("border-")) {
      const rest = token.slice(7);
      if (rest.startsWith("t-")) {
        const n = parseInt(rest.slice(2), 10);
        return !isNaN(n) ? { borderTopWidth: n } : void 0;
      }
      if (rest.startsWith("r-")) {
        const n = parseInt(rest.slice(2), 10);
        return !isNaN(n) ? { borderRightWidth: n } : void 0;
      }
      if (rest.startsWith("b-")) {
        const n = parseInt(rest.slice(2), 10);
        return !isNaN(n) ? { borderBottomWidth: n } : void 0;
      }
      if (rest.startsWith("l-")) {
        const n = parseInt(rest.slice(2), 10);
        return !isNaN(n) ? { borderLeftWidth: n } : void 0;
      }
      const width = parseInt(rest, 10);
      if (!isNaN(width)) return { borderWidth: width };
      const c = resolveColor(rest);
      if (c) return { borderColor: c };
      return void 0;
    }
    if (token.startsWith("shadow-")) {
      const rest = token.slice(7);
      const preset = SHADOW[rest];
      if (preset) return { ...preset };
      const c = resolveColor(rest);
      if (c) return { shadowColor: c };
      return void 0;
    }
    if (token.startsWith("bg-")) {
      const rest = token.slice(3);
      if (rest === "gradient-to-r") {
        grad.direction = "horizontal";
        return void 0;
      }
      if (rest === "gradient-to-l") {
        grad.direction = "horizontal";
        return void 0;
      }
      if (rest === "gradient-to-b") {
        grad.direction = "vertical";
        return void 0;
      }
      if (rest === "gradient-to-t") {
        grad.direction = "vertical";
        return void 0;
      }
      if (rest === "gradient-to-br" || rest === "gradient-to-tl") {
        grad.direction = "diagonal";
        return void 0;
      }
      if (rest === "gradient-to-bl" || rest === "gradient-to-tr") {
        grad.direction = "diagonal";
        return void 0;
      }
      const c = resolveColor(rest);
      if (c) return { backgroundColor: c };
      return void 0;
    }
    if (token.startsWith("from-")) {
      const c = resolveColor(token.slice(5));
      if (c) {
        grad.from = c;
        return void 0;
      }
      return void 0;
    }
    if (token.startsWith("to-")) {
      const c = resolveColor(token.slice(3));
      if (c) {
        grad.to = c;
        return void 0;
      }
      return void 0;
    }
    if (token.startsWith("text-")) {
      const rest = token.slice(5);
      const fs = FONT_SIZE[rest];
      if (fs !== void 0) return { fontSize: fs };
      if (rest.startsWith("[") && rest.endsWith("]")) {
        const n = parseFloat(rest.slice(1, -1));
        return !isNaN(n) ? { fontSize: n } : void 0;
      }
      const c = resolveColor(rest);
      if (c) return { color: c };
      return void 0;
    }
    if (token.startsWith("font-")) {
      const rest = token.slice(5);
      const fw = FONT_WEIGHT[rest];
      if (fw !== void 0) return { fontWeight: fw };
      return void 0;
    }
    if (token.startsWith("leading-")) {
      const val = token.slice(8);
      if (val.startsWith("[") && val.endsWith("]")) {
        const n = parseFloat(val.slice(1, -1));
        return !isNaN(n) ? { lineHeight: n } : void 0;
      }
      const v = LEADING[val];
      return v !== void 0 ? { lineHeight: v } : void 0;
    }
    if (token.startsWith("tracking-")) {
      const val = token.slice(9);
      if (val.startsWith("[") && val.endsWith("]")) {
        const n = parseFloat(val.slice(1, -1));
        return !isNaN(n) ? { letterSpacing: n } : void 0;
      }
      const v = TRACKING[val];
      return v !== void 0 ? { letterSpacing: v } : void 0;
    }
    if (token.startsWith("duration-")) {
      const val = token.slice(9);
      const n = parseInt(val, 10);
      if (!isNaN(n)) {
        trans.duration = n;
        trans.active = trans.active ?? true;
      }
      return void 0;
    }
    if (token.startsWith("ease-")) {
      const val = token.slice(5);
      const map = {
        "linear": "linear",
        "in": "easeIn",
        "out": "easeOut",
        "in-out": "easeInOut"
      };
      if (map[val]) {
        trans.easing = map[val];
        trans.active = trans.active ?? true;
      }
      return void 0;
    }
    if (token.startsWith("delay-")) {
      const val = token.slice(6);
      const n = parseInt(val, 10);
      if (!isNaN(n)) {
        trans.delay = n;
        trans.active = trans.active ?? true;
      }
      return void 0;
    }
    if (token.startsWith("translate-x-")) {
      const v = neg(spacing(token.slice(12)));
      return v !== void 0 ? { transform: { translateX: v } } : void 0;
    }
    if (token.startsWith("translate-y-")) {
      const v = neg(spacing(token.slice(12)));
      return v !== void 0 ? { transform: { translateY: v } } : void 0;
    }
    if (token.startsWith("rotate-")) {
      const val = token.slice(7);
      if (val.startsWith("[") && val.endsWith("]")) {
        const n2 = parseFloat(val.slice(1, -1));
        return !isNaN(n2) ? { transform: { rotate: negative ? -n2 : n2 } } : void 0;
      }
      const n = parseFloat(val);
      return !isNaN(n) ? { transform: { rotate: negative ? -n : n } } : void 0;
    }
    if (token.startsWith("scale-")) {
      const val = token.slice(6);
      if (val.startsWith("x-")) {
        const n2 = parseFloat(val.slice(2));
        return !isNaN(n2) ? { transform: { scaleX: n2 / 100 } } : void 0;
      }
      if (val.startsWith("y-")) {
        const n2 = parseFloat(val.slice(2));
        return !isNaN(n2) ? { transform: { scaleY: n2 / 100 } } : void 0;
      }
      if (val.startsWith("[") && val.endsWith("]")) {
        const n2 = parseFloat(val.slice(1, -1));
        return !isNaN(n2) ? { transform: { scaleX: n2, scaleY: n2 } } : void 0;
      }
      const n = parseFloat(val);
      return !isNaN(n) ? { transform: { scaleX: n / 100, scaleY: n / 100 } } : void 0;
    }
    if (token.startsWith("ring-")) {
      const rest = token.slice(5);
      const n = parseInt(rest, 10);
      if (!isNaN(n)) return { outlineWidth: n, outlineColor: "#3b82f6", outlineOffset: 2 };
      const c = resolveColor(rest);
      if (c) return { outlineColor: c };
      return void 0;
    }
    if (cls === "ring") return { outlineWidth: 3, outlineColor: "#3b82f6", outlineOffset: 2 };
    if (cls === "ring-0") return { outlineWidth: 0 };
    return void 0;
  }
  function mergeTransform(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;
    return { ...existing, ...incoming };
  }
  function tw(classes) {
    if (!classes) return {};
    const cached = cache.get(classes);
    if (cached) return cached;
    const tokens = classes.trim().split(/\s+/);
    const result = {};
    const grad = {};
    const trans = {};
    for (const token of tokens) {
      const partial = parseClass(token, grad, trans);
      if (partial) {
        if (partial.transform) {
          result.transform = mergeTransform(result.transform, partial.transform);
          for (const key of Object.keys(partial)) {
            if (key !== "transform") result[key] = partial[key];
          }
        } else {
          Object.assign(result, partial);
        }
      }
    }
    if (grad.direction && (grad.from || grad.to)) {
      result.backgroundGradient = {
        direction: grad.direction,
        colors: [
          grad.from ?? "transparent",
          grad.to ?? "transparent"
        ]
      };
    }
    if (trans.active) {
      result.transition = {
        all: {
          duration: trans.duration ?? 150,
          easing: trans.easing ?? "easeInOut",
          ...trans.delay !== void 0 && { delay: trans.delay }
        }
      };
    }
    if (cache.size >= CACHE_MAX) {
      const first = cache.keys().next().value;
      if (first !== void 0) cache.delete(first);
    }
    cache.set(classes, result);
    return result;
  }
  var SPACING, MAX_WIDTH, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOW, TRACKING, LEADING, COLORS, cache, CACHE_MAX;
  var init_tw = __esm({
    "runtime/tw.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      SPACING = {
        "0": 0,
        "px": 1,
        "0.5": 2,
        "1": 4,
        "1.5": 6,
        "2": 8,
        "2.5": 10,
        "3": 12,
        "3.5": 14,
        "4": 16,
        "5": 20,
        "6": 24,
        "7": 28,
        "8": 32,
        "9": 36,
        "10": 40,
        "11": 44,
        "12": 48,
        "14": 56,
        "16": 64,
        "20": 80,
        "24": 96,
        "28": 112,
        "32": 128,
        "36": 144,
        "40": 160,
        "44": 176,
        "48": 192,
        "52": 208,
        "56": 224,
        "60": 240,
        "64": 256,
        "72": 288,
        "80": 320,
        "96": 384
      };
      MAX_WIDTH = {
        "0": 0,
        "none": "none",
        "xs": 320,
        "sm": 384,
        "md": 448,
        "lg": 512,
        "xl": 576,
        "2xl": 672,
        "3xl": 768,
        "4xl": 896,
        "5xl": 1024,
        "6xl": 1152,
        "7xl": 1280,
        "full": "100%",
        "screen": "100%"
      };
      FONT_SIZE = {
        "xs": 12,
        "sm": 14,
        "base": 16,
        "lg": 18,
        "xl": 20,
        "2xl": 24,
        "3xl": 30,
        "4xl": 36,
        "5xl": 48,
        "6xl": 60,
        "7xl": 72,
        "8xl": 96,
        "9xl": 128
      };
      FONT_WEIGHT = {
        "thin": 100,
        "extralight": 200,
        "light": 300,
        "normal": "normal",
        "medium": 500,
        "semibold": 600,
        "bold": "bold",
        "extrabold": 800,
        "black": 900
      };
      RADIUS = {
        "none": 0,
        "sm": 2,
        "DEFAULT": 4,
        "md": 6,
        "lg": 8,
        "xl": 12,
        "2xl": 16,
        "3xl": 24,
        "full": 9999
      };
      SHADOW = {
        "sm": { shadowColor: "rgba(0,0,0,0.05)", shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 2 },
        "DEFAULT": { shadowColor: "rgba(0,0,0,0.1)", shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 3 },
        "md": { shadowColor: "rgba(0,0,0,0.1)", shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 6 },
        "lg": { shadowColor: "rgba(0,0,0,0.1)", shadowOffsetX: 0, shadowOffsetY: 10, shadowBlur: 15 },
        "xl": { shadowColor: "rgba(0,0,0,0.1)", shadowOffsetX: 0, shadowOffsetY: 20, shadowBlur: 25 },
        "2xl": { shadowColor: "rgba(0,0,0,0.25)", shadowOffsetX: 0, shadowOffsetY: 25, shadowBlur: 50 },
        "none": { shadowColor: "transparent", shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 0 }
      };
      TRACKING = {
        "tighter": -0.8,
        "tight": -0.4,
        "normal": 0,
        "wide": 0.4,
        "wider": 0.8,
        "widest": 1.6
      };
      LEADING = {
        "3": 12,
        "4": 16,
        "5": 20,
        "6": 24,
        "7": 28,
        "8": 32,
        "9": 36,
        "10": 40,
        "none": 1,
        "tight": 1.25,
        "snug": 1.375,
        "normal": 1.5,
        "relaxed": 1.625,
        "loose": 2
      };
      COLORS = {
        slate: { "50": "#f8fafc", "100": "#f1f5f9", "200": "#e2e8f0", "300": "#cbd5e1", "400": "#94a3b8", "500": "#64748b", "600": "#475569", "700": "#334155", "800": "#1e293b", "900": "#0f172a", "950": "#020617" },
        gray: { "50": "#f9fafb", "100": "#f3f4f6", "200": "#e5e7eb", "300": "#d1d5db", "400": "#9ca3af", "500": "#6b7280", "600": "#4b5563", "700": "#374151", "800": "#1f2937", "900": "#111827", "950": "#030712" },
        zinc: { "50": "#fafafa", "100": "#f4f4f5", "200": "#e4e4e7", "300": "#d4d4d8", "400": "#a1a1aa", "500": "#71717a", "600": "#52525b", "700": "#3f3f46", "800": "#27272a", "900": "#18181b", "950": "#09090b" },
        neutral: { "50": "#fafafa", "100": "#f5f5f5", "200": "#e5e5e5", "300": "#d4d4d4", "400": "#a3a3a3", "500": "#737373", "600": "#525252", "700": "#404040", "800": "#262626", "900": "#171717", "950": "#0a0a0a" },
        stone: { "50": "#fafaf9", "100": "#f5f5f4", "200": "#e7e5e4", "300": "#d6d3d1", "400": "#a8a29e", "500": "#78716c", "600": "#57534e", "700": "#44403c", "800": "#292524", "900": "#1c1917", "950": "#0c0a09" },
        red: { "50": "#fef2f2", "100": "#fee2e2", "200": "#fecaca", "300": "#fca5a5", "400": "#f87171", "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c", "800": "#991b1b", "900": "#7f1d1d", "950": "#450a0a" },
        orange: { "50": "#fff7ed", "100": "#ffedd5", "200": "#fed7aa", "300": "#fdba74", "400": "#fb923c", "500": "#f97316", "600": "#ea580c", "700": "#c2410c", "800": "#9a3412", "900": "#7c2d12", "950": "#431407" },
        amber: { "50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d", "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309", "800": "#92400e", "900": "#78350f", "950": "#451a03" },
        yellow: { "50": "#fefce8", "100": "#fef9c3", "200": "#fef08a", "300": "#fde047", "400": "#facc15", "500": "#eab308", "600": "#ca8a04", "700": "#a16207", "800": "#854d0e", "900": "#713f12", "950": "#422006" },
        lime: { "50": "#f7fee7", "100": "#ecfccb", "200": "#d9f99d", "300": "#bef264", "400": "#a3e635", "500": "#84cc16", "600": "#65a30d", "700": "#4d7c0f", "800": "#3f6212", "900": "#365314", "950": "#1a2e05" },
        green: { "50": "#f0fdf4", "100": "#dcfce7", "200": "#bbf7d0", "300": "#86efac", "400": "#4ade80", "500": "#22c55e", "600": "#16a34a", "700": "#15803d", "800": "#166534", "900": "#14532d", "950": "#052e16" },
        emerald: { "50": "#ecfdf5", "100": "#d1fae5", "200": "#a7f3d0", "300": "#6ee7b7", "400": "#34d399", "500": "#10b981", "600": "#059669", "700": "#047857", "800": "#065f46", "900": "#064e3b", "950": "#022c22" },
        teal: { "50": "#f0fdfa", "100": "#ccfbf1", "200": "#99f6e4", "300": "#5eead4", "400": "#2dd4bf", "500": "#14b8a6", "600": "#0d9488", "700": "#0f766e", "800": "#115e59", "900": "#134e4a", "950": "#042f2e" },
        cyan: { "50": "#ecfeff", "100": "#cffafe", "200": "#a5f3fc", "300": "#67e8f9", "400": "#22d3ee", "500": "#06b6d4", "600": "#0891b2", "700": "#0e7490", "800": "#155e75", "900": "#164e63", "950": "#083344" },
        sky: { "50": "#f0f9ff", "100": "#e0f2fe", "200": "#bae6fd", "300": "#7dd3fc", "400": "#38bdf8", "500": "#0ea5e9", "600": "#0284c7", "700": "#0369a1", "800": "#075985", "900": "#0c4a6e", "950": "#082f49" },
        blue: { "50": "#eff6ff", "100": "#dbeafe", "200": "#bfdbfe", "300": "#93c5fd", "400": "#60a5fa", "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8", "800": "#1e40af", "900": "#1e3a8a", "950": "#172554" },
        indigo: { "50": "#eef2ff", "100": "#e0e7ff", "200": "#c7d2fe", "300": "#a5b4fc", "400": "#818cf8", "500": "#6366f1", "600": "#4f46e5", "700": "#4338ca", "800": "#3730a3", "900": "#312e81", "950": "#1e1b4b" },
        violet: { "50": "#f5f3ff", "100": "#ede9fe", "200": "#ddd6fe", "300": "#c4b5fd", "400": "#a78bfa", "500": "#8b5cf6", "600": "#7c3aed", "700": "#6d28d9", "800": "#5b21b6", "900": "#4c1d95", "950": "#2e1065" },
        purple: { "50": "#faf5ff", "100": "#f3e8ff", "200": "#e9d5ff", "300": "#d8b4fe", "400": "#c084fc", "500": "#a855f7", "600": "#9333ea", "700": "#7e22ce", "800": "#6b21a8", "900": "#581c87", "950": "#3b0764" },
        fuchsia: { "50": "#fdf4ff", "100": "#fae8ff", "200": "#f5d0fe", "300": "#f0abfc", "400": "#e879f9", "500": "#d946ef", "600": "#c026d3", "700": "#a21caf", "800": "#86198f", "900": "#701a75", "950": "#4a044e" },
        pink: { "50": "#fdf2f8", "100": "#fce7f3", "200": "#fbcfe8", "300": "#f9a8d4", "400": "#f472b6", "500": "#ec4899", "600": "#db2777", "700": "#be185d", "800": "#9d174d", "900": "#831843", "950": "#500724" },
        rose: { "50": "#fff1f2", "100": "#ffe4e6", "200": "#fecdd3", "300": "#fda4af", "400": "#fb7185", "500": "#f43f5e", "600": "#e11d48", "700": "#be123c", "800": "#9f1239", "900": "#881337", "950": "#4c0519" }
      };
      cache = /* @__PURE__ */ new Map();
      CACHE_MAX = 1e3;
    }
  });

  // runtime/core_stub.ts
  var init_core_stub = __esm({
    "runtime/core_stub.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_tw();
    }
  });

  // renderer/subscriptionManager.ts
  function manageSubscription(_id, _key, _eventName, _getHandler, _filter) {
  }
  function cleanupSubscriptionsRecursive(_node) {
  }
  var init_subscriptionManager = __esm({
    "renderer/subscriptionManager.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
    }
  });

  // renderer/hostConfig.ts
  function parseCombo(combo) {
    const parts = combo.toLowerCase().split("+").map((s) => s.trim());
    const result = { ctrl: false, shift: false, alt: false, meta: false, key: "" };
    for (const part of parts) {
      if (part === "ctrl" || part === "control") result.ctrl = true;
      else if (part === "shift") result.shift = true;
      else if (part === "alt") result.alt = true;
      else if (part === "meta" || part === "cmd" || part === "gui") result.meta = true;
      else result.key = part;
    }
    return result;
  }
  function matchesCombo(event, parsed) {
    if (!!event.ctrl !== parsed.ctrl) return false;
    if (!!event.shift !== parsed.shift) return false;
    if (!!event.alt !== parsed.alt) return false;
    if (!!event.meta !== parsed.meta) return false;
    return (event.key ?? "").toLowerCase() === parsed.key;
  }
  function makeComboFilter(combo) {
    const parsed = parseCombo(combo);
    return (payload) => matchesCombo(payload, parsed);
  }
  function resolveHtmlProps(originalType, props) {
    const resolved = {};
    const mergeStyle = (base, patch) => {
      const out = {};
      if (base) {
        for (const key of Object.keys(base)) out[key] = base[key];
      }
      for (const key of Object.keys(patch)) out[key] = patch[key];
      return out;
    };
    for (const key of Object.keys(props)) {
      if (key === "children") continue;
      if (HTML_STRIP_PROPS.has(key)) continue;
      if (key.startsWith("aria-") || key.startsWith("data-")) continue;
      resolved[key] = props[key];
    }
    if (resolved.className && typeof resolved.className === "string") {
      const twStyle = tw(resolved.className);
      resolved.style = resolved.style ? mergeStyle(twStyle, resolved.style) : twStyle;
      delete resolved.className;
    }
    const headingSize = HEADING_FONT_SIZE[originalType];
    if (headingSize) {
      const headingStyle = { fontSize: headingSize, fontWeight: "bold" };
      resolved.style = resolved.style ? mergeStyle(headingStyle, resolved.style) : headingStyle;
    }
    if (originalType === "strong" || originalType === "b") {
      const boldStyle = { fontWeight: "bold" };
      resolved.style = resolved.style ? mergeStyle(boldStyle, resolved.style) : boldStyle;
    }
    if (originalType === "img" && resolved.src) {
      resolved.source = resolved.src;
      delete resolved.src;
    }
    if ((originalType === "input" || originalType === "textarea") && resolved.value != null) {
      resolved.value = String(resolved.value);
    }
    return resolved;
  }
  function hostLog(_msg) {
  }
  function setTransportFlush(fn) {
    transportFlush = fn;
  }
  function emit(cmd) {
    pendingCommands.push(cmd);
  }
  function coalesceCommands(commands) {
    const updateMap = /* @__PURE__ */ new Map();
    const output = [];
    const cloneValue = (value) => {
      if (Array.isArray(value)) {
        const out = [];
        for (let i = 0; i < value.length; i++) out[i] = cloneValue(value[i]);
        return out;
      }
      if (value && typeof value === "object") {
        const out = {};
        for (const key of Object.keys(value)) {
          out[key] = cloneValue(value[key]);
        }
        return out;
      }
      return value;
    };
    const mergePlainObject = (base, patch) => {
      const out = {};
      for (const key of Object.keys(base)) out[key] = cloneValue(base[key]);
      for (const key of Object.keys(patch)) out[key] = cloneValue(patch[key]);
      return out;
    };
    const cloneCommand = (cmd) => {
      const out = {};
      for (const key of Object.keys(cmd)) {
        out[key] = cloneValue(cmd[key]);
      }
      return out;
    };
    for (const cmd of commands) {
      if (cmd.op === "UPDATE" && cmd.id != null) {
        const existingIdx = updateMap.get(cmd.id);
        if (existingIdx !== void 0) {
          const existing = output[existingIdx];
          const prevStyle = existing.props.style;
          existing.props = mergePlainObject(existing.props || {}, cmd.props || {});
          if (prevStyle && cmd.props.style) {
            existing.props.style = mergePlainObject(prevStyle, cmd.props.style);
          }
          if (cmd.removeKeys) {
            existing.removeKeys = [...existing.removeKeys || [], ...cmd.removeKeys];
          }
          if (cmd.removeStyleKeys) {
            existing.removeStyleKeys = [...existing.removeStyleKeys || [], ...cmd.removeStyleKeys];
          }
          if (cmd.hasHandlers !== void 0) {
            existing.hasHandlers = cmd.hasHandlers;
          }
          if (cmd.handlerNames !== void 0) {
            existing.handlerNames = cmd.handlerNames;
          }
          continue;
        }
        updateMap.set(cmd.id, output.length);
      }
      output.push(cloneCommand(cmd));
    }
    return output;
  }
  function flushToHost() {
    if (pendingCommands.length === 0) return;
    if (!transportFlush) {
      if (typeof globalThis.__hostFlush === "function") {
        transportFlush = (cmds) => globalThis.__hostFlush(cmds);
      } else {
        return;
      }
    }
    const t0 = globalThis.performance?.now?.() ?? Date.now();
    const pendingN = pendingCommands.length;
    const coalesced = coalesceCommands(pendingCommands);
    const t1 = globalThis.performance?.now?.() ?? Date.now();
    hostLog(`[hostConfig] flushToHost pending=${pendingCommands.length} coalesced=${coalesced.length}`);
    debugLog.log("recon", `flushToHost pending=${pendingCommands.length} coalesced=${coalesced.length}`);
    try {
      const payload = JSON.stringify(coalesced);
      const t2 = globalThis.performance?.now?.() ?? Date.now();
      transportFlush(payload);
      const t3 = globalThis.performance?.now?.() ?? Date.now();
      if (payload.length > 1e5 || t3 - t0 > 50) {
        const gh = globalThis;
        if (typeof gh.__hostLog === "function") {
          try {
            gh.__hostLog(0, `[flush-timing] pending=${pendingN} coalesced=${coalesced.length} bytes=${payload.length} coalesce=${(t1 - t0).toFixed(1)}ms stringify=${(t2 - t1).toFixed(1)}ms bridge=${(t3 - t2).toFixed(1)}ms total=${(t3 - t0).toFixed(1)}ms`);
          } catch {
          }
        }
      }
    } catch (e) {
      reportError(e, "flushToHost (" + coalesced.length + " commands)");
    }
    pendingCommands.length = 0;
  }
  function scheduleFlush() {
    hostLog(`[hostConfig] scheduleFlush called scheduled=${flushScheduled} pending=${pendingCommands.length}`);
    if (flushScheduled) return;
    flushScheduled = true;
    microtask(() => {
      hostLog(`[hostConfig] scheduleFlush callback pending=${pendingCommands.length}`);
      flushScheduled = false;
      flushToHost();
    });
  }
  function extractHandlers(props) {
    const clean = {};
    const handlers = {};
    for (const key of Object.keys(props)) {
      if (key === "children") continue;
      if (key.startsWith("on") && typeof props[key] === "function") {
        handlers[key] = props[key];
      } else {
        clean[key] = props[key];
      }
    }
    return { clean, handlers };
  }
  function buildHandlerMeta(handlers) {
    const keys = Object.keys(handlers);
    if (keys.length === 0) return void 0;
    const meta = {};
    for (const name of keys) {
      try {
        const src = handlers[name].toString().replace(/\s+/g, " ").trim();
        meta[name] = src.length > 80 ? src.slice(0, 80) + "\u2026" : src;
      } catch {
        meta[name] = "(native)";
      }
    }
    return meta;
  }
  function handlersEqual(a, b) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!(k in b)) return false;
    }
    return true;
  }
  function diffStyleObjects(oldStyle, newStyle) {
    const changed = {};
    const removed = [];
    let hasChanged = false;
    for (const key of Object.keys(newStyle)) {
      if (oldStyle[key] !== newStyle[key]) {
        changed[key] = newStyle[key];
        hasChanged = true;
      }
    }
    for (const key of Object.keys(oldStyle)) {
      if (!(key in newStyle)) {
        removed.push(key);
      }
    }
    return {
      changed: hasChanged ? changed : null,
      removed
    };
  }
  function diffCleanProps(oldClean, newClean) {
    const diff = {};
    const removeKeys = [];
    let removeStyleKeys = [];
    let hasDiff = false;
    for (const key of Object.keys(newClean)) {
      const oldVal = oldClean[key];
      const newVal = newClean[key];
      if (key === "style") {
        const styleDiff = diffStyleObjects(oldVal || {}, newVal || {});
        if (styleDiff.changed) {
          diff.style = styleDiff.changed;
          hasDiff = true;
        }
        removeStyleKeys = styleDiff.removed;
        if (removeStyleKeys.length > 0) hasDiff = true;
      } else if (oldVal !== newVal) {
        diff[key] = newVal;
        hasDiff = true;
      }
    }
    for (const key of Object.keys(oldClean)) {
      if (key === "style") continue;
      if (!(key in newClean)) {
        removeKeys.push(key);
        hasDiff = true;
      }
    }
    return hasDiff ? { diff, removeKeys, removeStyleKeys } : null;
  }
  function cleanupHandlers(node) {
    if ("id" in node) {
      handlerRegistry.delete(node.id);
    }
    if ("children" in node) {
      for (const child of node.children) {
        cleanupHandlers(child);
      }
    }
    cleanupSubscriptionsRecursive(node);
  }
  var HTML_TYPE_MAP, HEADING_FONT_SIZE, HTML_STRIP_PROPS, transportFlush, nodeIdCounter, pendingCommands, rootInstances, handlerRegistry, flushScheduled, microtask, DefaultEventPriority, hostConfig;
  var init_hostConfig = __esm({
    "renderer/hostConfig.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_errorReporter();
      init_debugLog();
      init_core_stub();
      init_subscriptionManager();
      HTML_TYPE_MAP = {
        // Container elements → View
        "div": "View",
        "section": "View",
        "article": "View",
        "aside": "View",
        "main": "View",
        "nav": "View",
        "header": "View",
        "footer": "View",
        "form": "View",
        "fieldset": "View",
        "figure": "View",
        "figcaption": "View",
        "ul": "View",
        "ol": "View",
        "li": "View",
        "dl": "View",
        "dt": "View",
        "dd": "View",
        "table": "View",
        "thead": "View",
        "tbody": "View",
        "tfoot": "View",
        "tr": "View",
        "td": "View",
        "th": "View",
        "caption": "View",
        "a": "View",
        "button": "View",
        "details": "View",
        "summary": "View",
        "dialog": "View",
        "menu": "View",
        // Text elements → Text
        "span": "Text",
        "p": "Text",
        "label": "Text",
        "h1": "Text",
        "h2": "Text",
        "h3": "Text",
        "h4": "Text",
        "h5": "Text",
        "h6": "Text",
        "strong": "Text",
        "b": "Text",
        "em": "Text",
        "i": "Text",
        "code": "Text",
        "small": "Text",
        "mark": "Text",
        "abbr": "Text",
        "cite": "Text",
        "q": "Text",
        "time": "Text",
        "sub": "Text",
        "sup": "Text",
        // Media → native equivalents
        "img": "Image",
        "video": "Video",
        "input": "TextInput",
        "textarea": "TextEditor",
        "pre": "CodeBlock",
        "math": "Math",
        // Ignored structural (map to View so they don't break)
        "html": "View",
        "body": "View",
        "head": "View",
        "br": "View",
        "hr": "View",
        "wbr": "View"
      };
      HEADING_FONT_SIZE = {
        h1: 32,
        h2: 28,
        h3: 24,
        h4: 20,
        h5: 18,
        h6: 16
      };
      HTML_STRIP_PROPS = /* @__PURE__ */ new Set([
        "alt",
        "htmlFor",
        "href",
        "target",
        "rel",
        "method",
        "action",
        "encType",
        "noValidate",
        "autoComplete",
        "role",
        "tabIndex",
        "type",
        "min",
        "max",
        "step",
        "checked",
        "selected",
        "multiple",
        "cols",
        "rows",
        "wrap",
        "spellCheck",
        "inputMode",
        "pattern",
        "required",
        "readOnly",
        "disabled",
        "name",
        "form",
        "list",
        "aria-label",
        "aria-hidden",
        "aria-describedby",
        "aria-labelledby",
        "data-testid",
        "data-cy"
      ]);
      transportFlush = null;
      nodeIdCounter = 0;
      pendingCommands = [];
      rootInstances = [];
      handlerRegistry = /* @__PURE__ */ new Map();
      flushScheduled = false;
      microtask = typeof globalThis.queueMicrotask === "function" ? globalThis.queueMicrotask.bind(globalThis) : (fn) => {
        Promise.resolve().then(fn);
      };
      DefaultEventPriority = 16;
      hostConfig = {
        // ── Feature flags ────────────────────────────────────
        supportsMutation: true,
        supportsPersistence: false,
        supportsHydration: false,
        isPrimaryRenderer: true,
        // ── Context ──────────────────────────────────────────
        getRootHostContext() {
          return {};
        },
        getChildHostContext(_parentContext) {
          return {};
        },
        // ── Instance creation ────────────────────────────────
        createInstance(type, props, _rootContainer, _hostContext, internalHandle) {
          const id = ++nodeIdCounter;
          hostLog(`[hostConfig] createInstance type=${type} id=${id}`);
          const resolvedType = HTML_TYPE_MAP[type] || type;
          const resolvedProps = HTML_TYPE_MAP[type] ? resolveHtmlProps(type, props) : props;
          const { clean, handlers } = extractHandlers(resolvedProps);
          if (handlers.onLayout) {
            clean.__hasOnLayout = true;
          }
          const handlerNames = Object.keys(handlers);
          const hasHandlers = handlerNames.length > 0;
          debugLog.log("recon", `createInstance id=${id} type=${resolvedType} handlers=${hasHandlers}`);
          let debugName;
          let debugSource;
          if (internalHandle) {
            try {
              const PRIMITIVE_NAMES = /* @__PURE__ */ new Set([
                "Box",
                "Text",
                "Image",
                "Pressable",
                "TextInput",
                "ScrollView",
                "Modal",
                "Row",
                "Col",
                "CodeBlock",
                "Markdown",
                "Window",
                "TextEditor"
              ]);
              let fiber = internalHandle;
              while (fiber) {
                if (fiber.type && typeof fiber.type === "function") {
                  const name = fiber.type.displayName || fiber.type.name;
                  if (name && !PRIMITIVE_NAMES.has(name) && !fiber.type.__isClassifier) {
                    debugName = name;
                    break;
                  }
                }
                fiber = fiber.return;
              }
              const isUserFile = (f) => f && !f.includes("/packages/") && !f.includes("/node_modules/") && !f.includes("\\packages\\") && !f.includes("\\node_modules\\");
              let src = internalHandle._debugSource;
              if (src && isUserFile(src.fileName)) {
                debugSource = { fileName: src.fileName, lineNumber: src.lineNumber };
              } else {
                let owner = internalHandle._debugOwner;
                while (owner) {
                  const ownerSrc = owner._debugSource;
                  if (ownerSrc && isUserFile(ownerSrc.fileName)) {
                    debugSource = { fileName: ownerSrc.fileName, lineNumber: ownerSrc.lineNumber };
                    break;
                  }
                  if (ownerSrc && !debugSource) {
                    debugSource = { fileName: ownerSrc.fileName, lineNumber: ownerSrc.lineNumber };
                  }
                  owner = owner._debugOwner;
                }
              }
            } catch (e) {
            }
          }
          if (clean.debugName) {
            debugName = clean.debugName;
          }
          emit({
            op: "CREATE",
            id,
            type: resolvedType,
            props: clean,
            hasHandlers,
            handlerNames,
            handlerMeta: hasHandlers ? buildHandlerMeta(handlers) : void 0,
            debugName,
            debugSource
          });
          if (hasHandlers) {
            handlerRegistry.set(id, handlers);
          }
          if (clean.__subscribe) {
            const nodeHandlers = handlers;
            manageSubscription(id, clean.__subscribe, "onEvent", () => nodeHandlers.onEvent);
          }
          if (clean.__subscribeKey) {
            const nodeHandlers = handlers;
            const comboFilter = clean.combo ? makeComboFilter(clean.combo) : void 0;
            manageSubscription(id, clean.__subscribeKey, "onKeyDown", () => nodeHandlers.onKeyDown, comboFilter);
          }
          return { id, type: resolvedType, props: clean, handlers, children: [], renderCount: 1 };
        },
        createTextInstance(text) {
          const id = ++nodeIdCounter;
          hostLog(`[hostConfig] createTextInstance id=${id} text=${JSON.stringify(text)}`);
          emit({ op: "CREATE_TEXT", id, text });
          return { id, text };
        },
        // ── Tree building (pre-commit) ──────────────────────
        appendInitialChild(parent, child) {
          hostLog(`[hostConfig] appendInitialChild parent=${parent.id} child=${child.id}`);
          parent.children.push(child);
          emit({ op: "APPEND", parentId: parent.id, childId: child.id });
        },
        finalizeInitialChildren() {
          return false;
        },
        // ── Mutations ────────────────────────────────────────
        appendChild(parent, child) {
          hostLog(`[hostConfig] appendChild parent=${parent.id} child=${child.id}`);
          parent.children.push(child);
          emit({ op: "APPEND", parentId: parent.id, childId: child.id });
        },
        appendChildToContainer(container, child) {
          hostLog(`[hostConfig] appendChildToContainer container=${container.id} child=${child.id}`);
          rootInstances.push(child);
          emit({ op: "APPEND_TO_ROOT", childId: child.id });
        },
        removeChild(parent, child) {
          hostLog(`[hostConfig] removeChild parent=${parent.id} child=${child.id}`);
          debugLog.log("recon", `removeChild parent=${parent.id} child=${child.id}`);
          const idx = parent.children.indexOf(child);
          if (idx !== -1) parent.children.splice(idx, 1);
          emit({ op: "REMOVE", parentId: parent.id, childId: child.id });
          cleanupHandlers(child);
        },
        removeChildFromContainer(_container, child) {
          hostLog(`[hostConfig] removeChildFromContainer child=${child.id}`);
          const idx = rootInstances.indexOf(child);
          if (idx !== -1) rootInstances.splice(idx, 1);
          emit({ op: "REMOVE_FROM_ROOT", childId: child.id });
          cleanupHandlers(child);
        },
        insertBefore(parent, child, before) {
          hostLog(`[hostConfig] insertBefore parent=${parent.id} child=${child.id} before=${before.id}`);
          const arr = parent.children;
          const idx = arr.indexOf(before);
          if (idx !== -1) {
            arr.splice(idx, 0, child);
          } else {
            arr.push(child);
          }
          emit({
            op: "INSERT_BEFORE",
            parentId: parent.id,
            childId: child.id,
            beforeId: before.id
          });
        },
        insertInContainerBefore(_container, child, before) {
          hostLog(`[hostConfig] insertInContainerBefore child=${child.id} before=${before.id}`);
          const idx = rootInstances.indexOf(before);
          if (idx !== -1) {
            rootInstances.splice(idx, 0, child);
          } else {
            rootInstances.push(child);
          }
          emit({
            op: "INSERT_BEFORE_ROOT",
            childId: child.id,
            beforeId: before.id
          });
        },
        // ── Updates ──────────────────────────────────────────
        prepareUpdate(_instance, _type, oldProps, newProps) {
          const resolvedOld = HTML_TYPE_MAP[_type] ? resolveHtmlProps(_type, oldProps) : oldProps;
          const resolvedNew = HTML_TYPE_MAP[_type] ? resolveHtmlProps(_type, newProps) : newProps;
          const { clean: oldClean, handlers: oldH } = extractHandlers(resolvedOld);
          const { clean: newClean, handlers: newH } = extractHandlers(resolvedNew);
          if (oldH.onLayout) {
            oldClean.__hasOnLayout = true;
          }
          if (newH.onLayout) {
            newClean.__hasOnLayout = true;
          }
          const handlersChanged = !handlersEqual(oldH, newH);
          const propsDiff = diffCleanProps(oldClean, newClean);
          if (!propsDiff && !handlersChanged) return null;
          if (!propsDiff && handlersChanged) {
            return { __handlersOnly: true };
          }
          return propsDiff;
        },
        commitUpdate(instance, updatePayload, _type, _oldProps, newProps) {
          hostLog(`[hostConfig] commitUpdate id=${instance.id} type=${instance.type}`);
          const resolvedNew = HTML_TYPE_MAP[_type] ? resolveHtmlProps(_type, newProps) : newProps;
          const { clean, handlers } = extractHandlers(resolvedNew);
          if (handlers.onLayout) {
            clean.__hasOnLayout = true;
          }
          if (Object.keys(handlers).length > 0) {
            handlerRegistry.set(instance.id, handlers);
          } else {
            handlerRegistry.delete(instance.id);
          }
          instance.handlers = handlers;
          instance.props = clean;
          instance.renderCount = (instance.renderCount || 0) + 1;
          if (updatePayload && !updatePayload.__handlersOnly) {
            const handlerNames = Object.keys(handlers);
            const hasHandlers = handlerNames.length > 0;
            const payload = updatePayload;
            debugLog.log("recon", `commitUpdate id=${instance.id} type=${instance.type} diffKeys=[${Object.keys(payload.diff).join(",")}] removeStyle=[${payload.removeStyleKeys.join(",")}]`);
            const cmd = {
              op: "UPDATE",
              id: instance.id,
              props: payload.diff,
              hasHandlers,
              handlerNames,
              handlerMeta: hasHandlers ? buildHandlerMeta(handlers) : void 0,
              renderCount: instance.renderCount
            };
            if (payload.removeKeys.length > 0) {
              cmd.removeKeys = payload.removeKeys;
            }
            if (payload.removeStyleKeys.length > 0) {
              cmd.removeStyleKeys = payload.removeStyleKeys;
            }
            emit(cmd);
          } else if (updatePayload && updatePayload.__handlersOnly) {
            const handlerNames = Object.keys(handlers);
            const hasHandlers = handlerNames.length > 0;
            emit({
              op: "UPDATE",
              id: instance.id,
              props: {},
              hasHandlers,
              handlerNames,
              handlerMeta: hasHandlers ? buildHandlerMeta(handlers) : void 0
            });
          }
          if (clean.__subscribe !== void 0) {
            manageSubscription(instance.id, clean.__subscribe, "onEvent", () => {
              const h2 = handlerRegistry.get(instance.id);
              return h2?.onEvent;
            });
          }
          if (clean.__subscribeKey !== void 0) {
            const comboFilter = clean.combo ? makeComboFilter(clean.combo) : void 0;
            manageSubscription(instance.id, clean.__subscribeKey, "onKeyDown", () => {
              const h2 = handlerRegistry.get(instance.id);
              return h2?.onKeyDown;
            }, comboFilter);
          }
        },
        commitTextUpdate(_textInstance, _oldText, newText) {
          hostLog(`[hostConfig] commitTextUpdate id=${_textInstance.id} text=${JSON.stringify(newText)}`);
          _textInstance.text = newText;
          emit({ op: "UPDATE_TEXT", id: _textInstance.id, text: newText });
        },
        // ── Commit lifecycle ─────────────────────────────────
        prepareForCommit() {
          return null;
        },
        resetAfterCommit() {
          hostLog(`[hostConfig] resetAfterCommit`);
          const stampStateUpdate = globalThis.__clickLatencyStampStateUpdate;
          if (typeof stampStateUpdate === "function") {
            try {
              stampStateUpdate();
            } catch {
            }
          }
          scheduleFlush();
        },
        // ── Misc required methods ────────────────────────────
        shouldSetTextContent() {
          return false;
        },
        getPublicInstance(instance) {
          return instance;
        },
        preparePortalMount() {
        },
        scheduleTimeout: setTimeout,
        cancelTimeout: clearTimeout,
        noTimeout: -1,
        getCurrentEventPriority() {
          return DefaultEventPriority;
        },
        getInstanceFromNode() {
          return null;
        },
        beforeActiveInstanceBlur() {
        },
        afterActiveInstanceBlur() {
        },
        prepareScopeUpdate() {
        },
        getInstanceFromScope() {
          return null;
        },
        detachDeletedInstance() {
        },
        clearContainer() {
        }
      };
    }
  });

  // runtime/effectContext.ts
  function hash2(x, y) {
    let h2 = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h2 = Math.imul(h2 ^ h2 >>> 13, 1274126177);
    return ((h2 ^ h2 >>> 16) >>> 0) / 4294967295;
  }
  function hash3(x, y, z) {
    let h2 = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h2 = Math.imul(h2 ^ h2 >>> 13, 1274126177);
    return ((h2 ^ h2 >>> 16) >>> 0) / 4294967295;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    const ab = a + (b - a) * xf;
    const cd = c + (d - c) * xf;
    return (ab + (cd - ab) * yf) * 2 - 1;
  }
  function noise3(x, y, z) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const zf = smooth(z - zi);
    const c000 = hash3(xi, yi, zi);
    const c100 = hash3(xi + 1, yi, zi);
    const c010 = hash3(xi, yi + 1, zi);
    const c110 = hash3(xi + 1, yi + 1, zi);
    const c001 = hash3(xi, yi, zi + 1);
    const c101 = hash3(xi + 1, yi, zi + 1);
    const c011 = hash3(xi, yi + 1, zi + 1);
    const c111 = hash3(xi + 1, yi + 1, zi + 1);
    const x00 = c000 + (c100 - c000) * xf;
    const x10 = c010 + (c110 - c010) * xf;
    const x01 = c001 + (c101 - c001) * xf;
    const x11 = c011 + (c111 - c011) * xf;
    const y0 = x00 + (x10 - x00) * yf;
    const y1 = x01 + (x11 - x01) * yf;
    return (y0 + (y1 - y0) * zf) * 2 - 1;
  }
  function fbm(x, y, octaves) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    const n = Math.max(1, Math.min(8, octaves | 0));
    for (let i = 0; i < n; i++) {
      sum += noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return norm > 0 ? sum / norm : 0;
  }
  function hsv(h2, s, v) {
    const hh = (h2 - Math.floor(h2)) * 6;
    const i = Math.floor(hh);
    const f = hh - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));
    switch (i % 6) {
      case 0:
        return [v, t, p];
      case 1:
        return [q, v, p];
      case 2:
        return [p, v, t];
      case 3:
        return [p, q, v];
      case 4:
        return [t, p, v];
      default:
        return [v, p, q];
    }
  }
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hsl(h2, s, l) {
    if (s === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h2 + 1 / 3), hue2rgb(p, q, h2), hue2rgb(p, q, h2 - 1 / 3)];
  }
  function getOrCreateContext(id) {
    let slot = slots.get(id);
    if (slot) return slot.ctx;
    slot = { ctx: null, buffer: null, pixels: null, stride: 0 };
    const ctx = {
      width: 0,
      height: 0,
      time: 0,
      dt: 0,
      frame: 0,
      mouse_x: 0,
      mouse_y: 0,
      mouse_inside: false,
      setPixel(x, y, r2, g, b, a) {
        const px = slot.pixels;
        if (!px) return;
        const ux = x | 0;
        const uy = y | 0;
        if (ux < 0 || uy < 0 || ux >= ctx.width || uy >= ctx.height) return;
        const idx = uy * slot.stride + ux * 4;
        px[idx] = r2 * 255;
        px[idx + 1] = g * 255;
        px[idx + 2] = b * 255;
        px[idx + 3] = a * 255;
      },
      setPixelRaw(x, y, r2, g, b, a) {
        const px = slot.pixels;
        if (!px) return;
        const ux = x | 0;
        const uy = y | 0;
        if (ux < 0 || uy < 0 || ux >= ctx.width || uy >= ctx.height) return;
        const idx = uy * slot.stride + ux * 4;
        px[idx] = r2;
        px[idx + 1] = g;
        px[idx + 2] = b;
        px[idx + 3] = a;
      },
      getPixel(x, y) {
        const px = slot.pixels;
        if (!px) return [0, 0, 0, 0];
        const ux = x | 0;
        const uy = y | 0;
        if (ux < 0 || uy < 0 || ux >= ctx.width || uy >= ctx.height) return [0, 0, 0, 0];
        const idx = uy * slot.stride + ux * 4;
        return [px[idx] / 255, px[idx + 1] / 255, px[idx + 2] / 255, px[idx + 3] / 255];
      },
      clearColor(r2, g, b, a) {
        const px = slot.pixels;
        if (!px) return;
        const r8 = r2 * 255 | 0;
        const g8 = g * 255 | 0;
        const b8 = b * 255 | 0;
        const a8 = a * 255 | 0;
        for (let i = 0; i < px.length; i += 4) {
          px[i] = r8;
          px[i + 1] = g8;
          px[i + 2] = b8;
          px[i + 3] = a8;
        }
      },
      fade(alpha) {
        const px = slot.pixels;
        if (!px) return;
        const a = Math.max(0, Math.min(1, alpha));
        for (let i = 3; i < px.length; i += 4) {
          px[i] = px[i] * a | 0;
        }
      },
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      atan2: Math.atan2,
      sqrt: Math.sqrt,
      abs: Math.abs,
      floor: Math.floor,
      ceil: Math.ceil,
      pow: Math.pow,
      exp: Math.exp,
      log: Math.log,
      min: Math.min,
      max: Math.max,
      clamp: (x, lo, hi) => x < lo ? lo : x > hi ? hi : x,
      mod: (x, y) => {
        const r2 = x - Math.floor(x / y) * y;
        return r2;
      },
      noise2,
      noise3,
      fbm,
      hsv,
      hsl
    };
    slot.ctx = ctx;
    slots.set(id, slot);
    return ctx;
  }
  function prepareContext(id, buffer, width, height, stride, time, dt, mouse_x, mouse_y, mouse_inside, frame) {
    const ctx = getOrCreateContext(id);
    const slot = slots.get(id);
    if (slot.buffer !== buffer) {
      slot.buffer = buffer;
      slot.pixels = new Uint8ClampedArray(buffer);
    }
    slot.stride = stride;
    ctx.width = width;
    ctx.height = height;
    ctx.time = time;
    ctx.dt = dt;
    ctx.mouse_x = mouse_x;
    ctx.mouse_y = mouse_y;
    ctx.mouse_inside = mouse_inside;
    ctx.frame = frame;
    return ctx;
  }
  function releaseContext(id) {
    slots.delete(id);
  }
  var slots;
  var init_effectContext = __esm({
    "runtime/effectContext.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      slots = /* @__PURE__ */ new Map();
    }
  });

  // runtime/ffi.ts
  function callHost(name, fallback, ...args) {
    const fn = host[name];
    if (typeof fn !== "function") return fallback;
    try {
      return fn(...args);
    } catch {
      return fallback;
    }
  }
  function subscribe(channel, fn) {
    let set = _listeners.get(channel);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      _listeners.set(channel, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }
  var host, _listeners;
  var init_ffi = __esm({
    "runtime/ffi.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      host = globalThis;
      _listeners = /* @__PURE__ */ new Map();
      host.__ffiEmit = (channel, payload) => {
        const set = _listeners.get(channel);
        if (!set || set.size === 0) return;
        setTimeout(() => {
          for (const fn of set) {
            try {
              fn(payload);
            } catch (e) {
              console.error(`[ffi] ${channel} listener error:`, e?.message || e);
            }
          }
        }, 0);
      };
    }
  });

  // runtime/hooks/websocket.ts
  function installWebSocketShim() {
    globalThis.WebSocket = ReactjitWebSocket;
  }
  var _idSeq, ReactjitWebSocket;
  var init_websocket = __esm({
    "runtime/hooks/websocket.ts"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_ffi();
      _idSeq = 1;
      ReactjitWebSocket = class {
        id;
        url;
        onopen = null;
        onmessage = null;
        onclose = null;
        onerror = null;
        _unsubs = [];
        constructor(url) {
          this.id = _idSeq++;
          this.url = url;
          this._unsubs.push(subscribe(`ws:open:${this.id}`, () => {
            this.onopen?.({});
          }));
          this._unsubs.push(subscribe(`ws:message:${this.id}`, (data) => {
            this.onmessage?.({ data });
          }));
          this._unsubs.push(subscribe(`ws:close:${this.id}`, (p) => {
            this.onclose?.(p);
            this._cleanup();
          }));
          this._unsubs.push(subscribe(`ws:error:${this.id}`, (msg) => {
            this.onerror?.({ message: msg });
          }));
          callHost("__ws_open", void 0, this.id, url);
        }
        send(data) {
          callHost("__ws_send", void 0, this.id, data);
        }
        close(code, reason) {
          callHost("__ws_close", void 0, this.id);
          this._cleanup();
        }
        _cleanup() {
          for (const u of this._unsubs) u();
          this._unsubs = [];
        }
      };
    }
  });

  // cart/effects/plasma.tsx
  function Plasma() {
    return /* @__PURE__ */ __jsx(Box, { style: { width: "100%", height: "100%", backgroundColor: "#000000" } }, /* @__PURE__ */ __jsx(Effect, { shader: PLASMA_WGSL, style: { flexGrow: 1 } }));
  }
  var React, PLASMA_WGSL;
  var init_plasma = __esm({
    "cart/effects/plasma.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_primitives();
      React = require_react();
      PLASMA_WGSL = `
@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let x = in.uv.x * U.size_w;
  let y = in.uv.y * U.size_h;
  let t = U.time;
  let fx = x * 0.02;
  let fy = y * 0.02;
  let v1 = sin(fx + t);
  let v2 = sin(fy + t * 0.7);
  let v3 = sin(fx + fy + t * 0.5);
  let v4 = sin(sqrt(fx * fx + fy * fy) + t);
  let v = (v1 + v2 + v3 + v4) * 0.25 + 0.5;
  let r = sin(v * 3.14159) * 0.5 + 0.5;
  let g = sin(v * 3.14159 + 2.094) * 0.5 + 0.5;
  let b = sin(v * 3.14159 + 4.189) * 0.5 + 0.5;
  return vec4f(r, g, b, 1.0);
}
`;
    }
  });

  // node_modules/scheduler/cjs/scheduler.development.js
  var require_scheduler_development = __commonJS({
    "node_modules/scheduler/cjs/scheduler.development.js"(exports) {
      "use strict";
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      if (true) {
        (function() {
          "use strict";
          if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
            __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
          }
          var enableSchedulerDebugging = false;
          var enableProfiling = false;
          var frameYieldMs = 5;
          function push(heap, node) {
            var index = heap.length;
            heap.push(node);
            siftUp(heap, node, index);
          }
          function peek(heap) {
            return heap.length === 0 ? null : heap[0];
          }
          function pop(heap) {
            if (heap.length === 0) {
              return null;
            }
            var first = heap[0];
            var last = heap.pop();
            if (last !== first) {
              heap[0] = last;
              siftDown(heap, last, 0);
            }
            return first;
          }
          function siftUp(heap, node, i) {
            var index = i;
            while (index > 0) {
              var parentIndex = index - 1 >>> 1;
              var parent = heap[parentIndex];
              if (compare(parent, node) > 0) {
                heap[parentIndex] = node;
                heap[index] = parent;
                index = parentIndex;
              } else {
                return;
              }
            }
          }
          function siftDown(heap, node, i) {
            var index = i;
            var length = heap.length;
            var halfLength = length >>> 1;
            while (index < halfLength) {
              var leftIndex = (index + 1) * 2 - 1;
              var left = heap[leftIndex];
              var rightIndex = leftIndex + 1;
              var right = heap[rightIndex];
              if (compare(left, node) < 0) {
                if (rightIndex < length && compare(right, left) < 0) {
                  heap[index] = right;
                  heap[rightIndex] = node;
                  index = rightIndex;
                } else {
                  heap[index] = left;
                  heap[leftIndex] = node;
                  index = leftIndex;
                }
              } else if (rightIndex < length && compare(right, node) < 0) {
                heap[index] = right;
                heap[rightIndex] = node;
                index = rightIndex;
              } else {
                return;
              }
            }
          }
          function compare(a, b) {
            var diff = a.sortIndex - b.sortIndex;
            return diff !== 0 ? diff : a.id - b.id;
          }
          var ImmediatePriority = 1;
          var UserBlockingPriority = 2;
          var NormalPriority = 3;
          var LowPriority = 4;
          var IdlePriority = 5;
          function markTaskErrored(task, ms) {
          }
          var hasPerformanceNow = typeof performance === "object" && typeof performance.now === "function";
          if (hasPerformanceNow) {
            var localPerformance = performance;
            exports.unstable_now = function() {
              return localPerformance.now();
            };
          } else {
            var localDate = Date;
            var initialTime = localDate.now();
            exports.unstable_now = function() {
              return localDate.now() - initialTime;
            };
          }
          var maxSigned31BitInt = 1073741823;
          var IMMEDIATE_PRIORITY_TIMEOUT = -1;
          var USER_BLOCKING_PRIORITY_TIMEOUT = 250;
          var NORMAL_PRIORITY_TIMEOUT = 5e3;
          var LOW_PRIORITY_TIMEOUT = 1e4;
          var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;
          var taskQueue = [];
          var timerQueue = [];
          var taskIdCounter = 1;
          var currentTask = null;
          var currentPriorityLevel = NormalPriority;
          var isPerformingWork = false;
          var isHostCallbackScheduled = false;
          var isHostTimeoutScheduled = false;
          var localSetTimeout = typeof setTimeout === "function" ? setTimeout : null;
          var localClearTimeout = typeof clearTimeout === "function" ? clearTimeout : null;
          var localSetImmediate = typeof setImmediate !== "undefined" ? setImmediate : null;
          var isInputPending = typeof navigator !== "undefined" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 ? navigator.scheduling.isInputPending.bind(navigator.scheduling) : null;
          function advanceTimers(currentTime) {
            var timer = peek(timerQueue);
            while (timer !== null) {
              if (timer.callback === null) {
                pop(timerQueue);
              } else if (timer.startTime <= currentTime) {
                pop(timerQueue);
                timer.sortIndex = timer.expirationTime;
                push(taskQueue, timer);
              } else {
                return;
              }
              timer = peek(timerQueue);
            }
          }
          function handleTimeout(currentTime) {
            isHostTimeoutScheduled = false;
            advanceTimers(currentTime);
            if (!isHostCallbackScheduled) {
              if (peek(taskQueue) !== null) {
                isHostCallbackScheduled = true;
                requestHostCallback(flushWork);
              } else {
                var firstTimer = peek(timerQueue);
                if (firstTimer !== null) {
                  requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
                }
              }
            }
          }
          function flushWork(hasTimeRemaining, initialTime2) {
            isHostCallbackScheduled = false;
            if (isHostTimeoutScheduled) {
              isHostTimeoutScheduled = false;
              cancelHostTimeout();
            }
            isPerformingWork = true;
            var previousPriorityLevel = currentPriorityLevel;
            try {
              if (enableProfiling) {
                try {
                  return workLoop(hasTimeRemaining, initialTime2);
                } catch (error) {
                  if (currentTask !== null) {
                    var currentTime = exports.unstable_now();
                    markTaskErrored(currentTask, currentTime);
                    currentTask.isQueued = false;
                  }
                  throw error;
                }
              } else {
                return workLoop(hasTimeRemaining, initialTime2);
              }
            } finally {
              currentTask = null;
              currentPriorityLevel = previousPriorityLevel;
              isPerformingWork = false;
            }
          }
          function workLoop(hasTimeRemaining, initialTime2) {
            var currentTime = initialTime2;
            advanceTimers(currentTime);
            currentTask = peek(taskQueue);
            while (currentTask !== null && !enableSchedulerDebugging) {
              if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
                break;
              }
              var callback = currentTask.callback;
              if (typeof callback === "function") {
                currentTask.callback = null;
                currentPriorityLevel = currentTask.priorityLevel;
                var didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
                var continuationCallback = callback(didUserCallbackTimeout);
                currentTime = exports.unstable_now();
                if (typeof continuationCallback === "function") {
                  currentTask.callback = continuationCallback;
                } else {
                  if (currentTask === peek(taskQueue)) {
                    pop(taskQueue);
                  }
                }
                advanceTimers(currentTime);
              } else {
                pop(taskQueue);
              }
              currentTask = peek(taskQueue);
            }
            if (currentTask !== null) {
              return true;
            } else {
              var firstTimer = peek(timerQueue);
              if (firstTimer !== null) {
                requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
              }
              return false;
            }
          }
          function unstable_runWithPriority(priorityLevel, eventHandler) {
            switch (priorityLevel) {
              case ImmediatePriority:
              case UserBlockingPriority:
              case NormalPriority:
              case LowPriority:
              case IdlePriority:
                break;
              default:
                priorityLevel = NormalPriority;
            }
            var previousPriorityLevel = currentPriorityLevel;
            currentPriorityLevel = priorityLevel;
            try {
              return eventHandler();
            } finally {
              currentPriorityLevel = previousPriorityLevel;
            }
          }
          function unstable_next(eventHandler) {
            var priorityLevel;
            switch (currentPriorityLevel) {
              case ImmediatePriority:
              case UserBlockingPriority:
              case NormalPriority:
                priorityLevel = NormalPriority;
                break;
              default:
                priorityLevel = currentPriorityLevel;
                break;
            }
            var previousPriorityLevel = currentPriorityLevel;
            currentPriorityLevel = priorityLevel;
            try {
              return eventHandler();
            } finally {
              currentPriorityLevel = previousPriorityLevel;
            }
          }
          function unstable_wrapCallback(callback) {
            var parentPriorityLevel = currentPriorityLevel;
            return function() {
              var previousPriorityLevel = currentPriorityLevel;
              currentPriorityLevel = parentPriorityLevel;
              try {
                return callback.apply(this, arguments);
              } finally {
                currentPriorityLevel = previousPriorityLevel;
              }
            };
          }
          function unstable_scheduleCallback(priorityLevel, callback, options) {
            var currentTime = exports.unstable_now();
            var startTime2;
            if (typeof options === "object" && options !== null) {
              var delay = options.delay;
              if (typeof delay === "number" && delay > 0) {
                startTime2 = currentTime + delay;
              } else {
                startTime2 = currentTime;
              }
            } else {
              startTime2 = currentTime;
            }
            var timeout;
            switch (priorityLevel) {
              case ImmediatePriority:
                timeout = IMMEDIATE_PRIORITY_TIMEOUT;
                break;
              case UserBlockingPriority:
                timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
                break;
              case IdlePriority:
                timeout = IDLE_PRIORITY_TIMEOUT;
                break;
              case LowPriority:
                timeout = LOW_PRIORITY_TIMEOUT;
                break;
              case NormalPriority:
              default:
                timeout = NORMAL_PRIORITY_TIMEOUT;
                break;
            }
            var expirationTime = startTime2 + timeout;
            var newTask = {
              id: taskIdCounter++,
              callback,
              priorityLevel,
              startTime: startTime2,
              expirationTime,
              sortIndex: -1
            };
            if (startTime2 > currentTime) {
              newTask.sortIndex = startTime2;
              push(timerQueue, newTask);
              if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
                if (isHostTimeoutScheduled) {
                  cancelHostTimeout();
                } else {
                  isHostTimeoutScheduled = true;
                }
                requestHostTimeout(handleTimeout, startTime2 - currentTime);
              }
            } else {
              newTask.sortIndex = expirationTime;
              push(taskQueue, newTask);
              if (!isHostCallbackScheduled && !isPerformingWork) {
                isHostCallbackScheduled = true;
                requestHostCallback(flushWork);
              }
            }
            return newTask;
          }
          function unstable_pauseExecution() {
          }
          function unstable_continueExecution() {
            if (!isHostCallbackScheduled && !isPerformingWork) {
              isHostCallbackScheduled = true;
              requestHostCallback(flushWork);
            }
          }
          function unstable_getFirstCallbackNode() {
            return peek(taskQueue);
          }
          function unstable_cancelCallback(task) {
            task.callback = null;
          }
          function unstable_getCurrentPriorityLevel() {
            return currentPriorityLevel;
          }
          var isMessageLoopRunning = false;
          var scheduledHostCallback = null;
          var taskTimeoutID = -1;
          var frameInterval = frameYieldMs;
          var startTime = -1;
          function shouldYieldToHost() {
            var timeElapsed = exports.unstable_now() - startTime;
            if (timeElapsed < frameInterval) {
              return false;
            }
            return true;
          }
          function requestPaint() {
          }
          function forceFrameRate(fps) {
            if (fps < 0 || fps > 125) {
              console["error"]("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported");
              return;
            }
            if (fps > 0) {
              frameInterval = Math.floor(1e3 / fps);
            } else {
              frameInterval = frameYieldMs;
            }
          }
          var performWorkUntilDeadline = function() {
            if (scheduledHostCallback !== null) {
              var currentTime = exports.unstable_now();
              startTime = currentTime;
              var hasTimeRemaining = true;
              var hasMoreWork = true;
              try {
                hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
              } finally {
                if (hasMoreWork) {
                  schedulePerformWorkUntilDeadline();
                } else {
                  isMessageLoopRunning = false;
                  scheduledHostCallback = null;
                }
              }
            } else {
              isMessageLoopRunning = false;
            }
          };
          var schedulePerformWorkUntilDeadline;
          if (typeof localSetImmediate === "function") {
            schedulePerformWorkUntilDeadline = function() {
              localSetImmediate(performWorkUntilDeadline);
            };
          } else if (typeof MessageChannel !== "undefined") {
            var channel = new MessageChannel();
            var port = channel.port2;
            channel.port1.onmessage = performWorkUntilDeadline;
            schedulePerformWorkUntilDeadline = function() {
              port.postMessage(null);
            };
          } else {
            schedulePerformWorkUntilDeadline = function() {
              localSetTimeout(performWorkUntilDeadline, 0);
            };
          }
          function requestHostCallback(callback) {
            scheduledHostCallback = callback;
            if (!isMessageLoopRunning) {
              isMessageLoopRunning = true;
              schedulePerformWorkUntilDeadline();
            }
          }
          function requestHostTimeout(callback, ms) {
            taskTimeoutID = localSetTimeout(function() {
              callback(exports.unstable_now());
            }, ms);
          }
          function cancelHostTimeout() {
            localClearTimeout(taskTimeoutID);
            taskTimeoutID = -1;
          }
          var unstable_requestPaint = requestPaint;
          var unstable_Profiling = null;
          exports.unstable_IdlePriority = IdlePriority;
          exports.unstable_ImmediatePriority = ImmediatePriority;
          exports.unstable_LowPriority = LowPriority;
          exports.unstable_NormalPriority = NormalPriority;
          exports.unstable_Profiling = unstable_Profiling;
          exports.unstable_UserBlockingPriority = UserBlockingPriority;
          exports.unstable_cancelCallback = unstable_cancelCallback;
          exports.unstable_continueExecution = unstable_continueExecution;
          exports.unstable_forceFrameRate = forceFrameRate;
          exports.unstable_getCurrentPriorityLevel = unstable_getCurrentPriorityLevel;
          exports.unstable_getFirstCallbackNode = unstable_getFirstCallbackNode;
          exports.unstable_next = unstable_next;
          exports.unstable_pauseExecution = unstable_pauseExecution;
          exports.unstable_requestPaint = unstable_requestPaint;
          exports.unstable_runWithPriority = unstable_runWithPriority;
          exports.unstable_scheduleCallback = unstable_scheduleCallback;
          exports.unstable_shouldYield = shouldYieldToHost;
          exports.unstable_wrapCallback = unstable_wrapCallback;
          if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
            __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
          }
        })();
      }
    }
  });

  // node_modules/scheduler/index.js
  var require_scheduler = __commonJS({
    "node_modules/scheduler/index.js"(exports, module) {
      "use strict";
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      if (false) {
        module.exports = null;
      } else {
        module.exports = require_scheduler_development();
      }
    }
  });

  // node_modules/react-reconciler/cjs/react-reconciler.development.js
  var require_react_reconciler_development = __commonJS({
    "node_modules/react-reconciler/cjs/react-reconciler.development.js"(exports, module) {
      "use strict";
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      if (true) {
        module.exports = function $$$reconciler($$$hostConfig) {
          var exports2 = {};
          "use strict";
          var React2 = require_react();
          var Scheduler = require_scheduler();
          var ReactSharedInternals = React2.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
          var suppressWarning = false;
          function setSuppressWarning(newSuppressWarning) {
            {
              suppressWarning = newSuppressWarning;
            }
          }
          function warn(format) {
            {
              if (!suppressWarning) {
                for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                  args[_key - 1] = arguments[_key];
                }
                printWarning("warn", format, args);
              }
            }
          }
          function error(format) {
            {
              if (!suppressWarning) {
                for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                  args[_key2 - 1] = arguments[_key2];
                }
                printWarning("error", format, args);
              }
            }
          }
          function printWarning(level, format, args) {
            {
              var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
              var stack = ReactDebugCurrentFrame2.getStackAddendum();
              if (stack !== "") {
                format += "%s";
                args = args.concat([stack]);
              }
              var argsWithFormat = args.map(function(item) {
                return String(item);
              });
              argsWithFormat.unshift("Warning: " + format);
              Function.prototype.apply.call(console[level], console, argsWithFormat);
            }
          }
          var assign = Object.assign;
          function get(key) {
            return key._reactInternals;
          }
          function set(key, value) {
            key._reactInternals = value;
          }
          var enableNewReconciler = false;
          var enableLazyContextPropagation = false;
          var enableLegacyHidden = false;
          var enableSuspenseAvoidThisFallback = false;
          var warnAboutStringRefs = true;
          var enableSchedulingProfiler = true;
          var enableProfilerTimer = true;
          var enableProfilerCommitHooks = true;
          var FunctionComponent = 0;
          var ClassComponent = 1;
          var IndeterminateComponent = 2;
          var HostRoot = 3;
          var HostPortal = 4;
          var HostComponent = 5;
          var HostText = 6;
          var Fragment2 = 7;
          var Mode = 8;
          var ContextConsumer = 9;
          var ContextProvider = 10;
          var ForwardRef = 11;
          var Profiler = 12;
          var SuspenseComponent = 13;
          var MemoComponent = 14;
          var SimpleMemoComponent = 15;
          var LazyComponent = 16;
          var IncompleteClassComponent = 17;
          var DehydratedFragment = 18;
          var SuspenseListComponent = 19;
          var ScopeComponent = 21;
          var OffscreenComponent = 22;
          var LegacyHiddenComponent = 23;
          var CacheComponent = 24;
          var TracingMarkerComponent = 25;
          var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.element");
          var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
          var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
          var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
          var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
          var REACT_PROVIDER_TYPE = /* @__PURE__ */ Symbol.for("react.provider");
          var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
          var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
          var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
          var REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list");
          var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
          var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
          var REACT_SCOPE_TYPE = /* @__PURE__ */ Symbol.for("react.scope");
          var REACT_DEBUG_TRACING_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.debug_trace_mode");
          var REACT_OFFSCREEN_TYPE = /* @__PURE__ */ Symbol.for("react.offscreen");
          var REACT_LEGACY_HIDDEN_TYPE = /* @__PURE__ */ Symbol.for("react.legacy_hidden");
          var REACT_CACHE_TYPE = /* @__PURE__ */ Symbol.for("react.cache");
          var REACT_TRACING_MARKER_TYPE = /* @__PURE__ */ Symbol.for("react.tracing_marker");
          var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
          var FAUX_ITERATOR_SYMBOL = "@@iterator";
          function getIteratorFn(maybeIterable) {
            if (maybeIterable === null || typeof maybeIterable !== "object") {
              return null;
            }
            var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
            if (typeof maybeIterator === "function") {
              return maybeIterator;
            }
            return null;
          }
          function getWrappedName(outerType, innerType, wrapperName) {
            var displayName = outerType.displayName;
            if (displayName) {
              return displayName;
            }
            var functionName = innerType.displayName || innerType.name || "";
            return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
          }
          function getContextName(type) {
            return type.displayName || "Context";
          }
          function getComponentNameFromType(type) {
            if (type == null) {
              return null;
            }
            {
              if (typeof type.tag === "number") {
                error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
              }
            }
            if (typeof type === "function") {
              return type.displayName || type.name || null;
            }
            if (typeof type === "string") {
              return type;
            }
            switch (type) {
              case REACT_FRAGMENT_TYPE:
                return "Fragment";
              case REACT_PORTAL_TYPE:
                return "Portal";
              case REACT_PROFILER_TYPE:
                return "Profiler";
              case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
              case REACT_SUSPENSE_TYPE:
                return "Suspense";
              case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
            }
            if (typeof type === "object") {
              switch (type.$$typeof) {
                case REACT_CONTEXT_TYPE:
                  var context = type;
                  return getContextName(context) + ".Consumer";
                case REACT_PROVIDER_TYPE:
                  var provider = type;
                  return getContextName(provider._context) + ".Provider";
                case REACT_FORWARD_REF_TYPE:
                  return getWrappedName(type, type.render, "ForwardRef");
                case REACT_MEMO_TYPE:
                  var outerName = type.displayName || null;
                  if (outerName !== null) {
                    return outerName;
                  }
                  return getComponentNameFromType(type.type) || "Memo";
                case REACT_LAZY_TYPE: {
                  var lazyComponent = type;
                  var payload = lazyComponent._payload;
                  var init = lazyComponent._init;
                  try {
                    return getComponentNameFromType(init(payload));
                  } catch (x) {
                    return null;
                  }
                }
              }
            }
            return null;
          }
          function getWrappedName$1(outerType, innerType, wrapperName) {
            var functionName = innerType.displayName || innerType.name || "";
            return outerType.displayName || (functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName);
          }
          function getContextName$1(type) {
            return type.displayName || "Context";
          }
          function getComponentNameFromFiber(fiber) {
            var tag = fiber.tag, type = fiber.type;
            switch (tag) {
              case CacheComponent:
                return "Cache";
              case ContextConsumer:
                var context = type;
                return getContextName$1(context) + ".Consumer";
              case ContextProvider:
                var provider = type;
                return getContextName$1(provider._context) + ".Provider";
              case DehydratedFragment:
                return "DehydratedFragment";
              case ForwardRef:
                return getWrappedName$1(type, type.render, "ForwardRef");
              case Fragment2:
                return "Fragment";
              case HostComponent:
                return type;
              case HostPortal:
                return "Portal";
              case HostRoot:
                return "Root";
              case HostText:
                return "Text";
              case LazyComponent:
                return getComponentNameFromType(type);
              case Mode:
                if (type === REACT_STRICT_MODE_TYPE) {
                  return "StrictMode";
                }
                return "Mode";
              case OffscreenComponent:
                return "Offscreen";
              case Profiler:
                return "Profiler";
              case ScopeComponent:
                return "Scope";
              case SuspenseComponent:
                return "Suspense";
              case SuspenseListComponent:
                return "SuspenseList";
              case TracingMarkerComponent:
                return "TracingMarker";
              // The display name for this tags come from the user-provided type:
              case ClassComponent:
              case FunctionComponent:
              case IncompleteClassComponent:
              case IndeterminateComponent:
              case MemoComponent:
              case SimpleMemoComponent:
                if (typeof type === "function") {
                  return type.displayName || type.name || null;
                }
                if (typeof type === "string") {
                  return type;
                }
                break;
            }
            return null;
          }
          var NoFlags = (
            /*                      */
            0
          );
          var PerformedWork = (
            /*                */
            1
          );
          var Placement = (
            /*                    */
            2
          );
          var Update = (
            /*                       */
            4
          );
          var ChildDeletion = (
            /*                */
            16
          );
          var ContentReset = (
            /*                 */
            32
          );
          var Callback = (
            /*                     */
            64
          );
          var DidCapture = (
            /*                   */
            128
          );
          var ForceClientRender = (
            /*            */
            256
          );
          var Ref = (
            /*                          */
            512
          );
          var Snapshot = (
            /*                     */
            1024
          );
          var Passive = (
            /*                      */
            2048
          );
          var Hydrating = (
            /*                    */
            4096
          );
          var Visibility = (
            /*                   */
            8192
          );
          var StoreConsistency = (
            /*             */
            16384
          );
          var LifecycleEffectMask = Passive | Update | Callback | Ref | Snapshot | StoreConsistency;
          var HostEffectMask = (
            /*               */
            32767
          );
          var Incomplete = (
            /*                   */
            32768
          );
          var ShouldCapture = (
            /*                */
            65536
          );
          var ForceUpdateForLegacySuspense = (
            /* */
            131072
          );
          var Forked = (
            /*                       */
            1048576
          );
          var RefStatic = (
            /*                    */
            2097152
          );
          var LayoutStatic = (
            /*                 */
            4194304
          );
          var PassiveStatic = (
            /*                */
            8388608
          );
          var MountLayoutDev = (
            /*               */
            16777216
          );
          var MountPassiveDev = (
            /*              */
            33554432
          );
          var BeforeMutationMask = (
            // TODO: Remove Update flag from before mutation phase by re-landing Visibility
            // flag logic (see #20043)
            Update | Snapshot | 0
          );
          var MutationMask = Placement | Update | ChildDeletion | ContentReset | Ref | Hydrating | Visibility;
          var LayoutMask = Update | Callback | Ref | Visibility;
          var PassiveMask = Passive | ChildDeletion;
          var StaticMask = LayoutStatic | PassiveStatic | RefStatic;
          var ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;
          function getNearestMountedFiber(fiber) {
            var node = fiber;
            var nearestMounted = fiber;
            if (!fiber.alternate) {
              var nextNode = node;
              do {
                node = nextNode;
                if ((node.flags & (Placement | Hydrating)) !== NoFlags) {
                  nearestMounted = node.return;
                }
                nextNode = node.return;
              } while (nextNode);
            } else {
              while (node.return) {
                node = node.return;
              }
            }
            if (node.tag === HostRoot) {
              return nearestMounted;
            }
            return null;
          }
          function isFiberMounted(fiber) {
            return getNearestMountedFiber(fiber) === fiber;
          }
          function isMounted(component) {
            {
              var owner = ReactCurrentOwner.current;
              if (owner !== null && owner.tag === ClassComponent) {
                var ownerFiber = owner;
                var instance = ownerFiber.stateNode;
                if (!instance._warnedAboutRefsInRender) {
                  error("%s is accessing isMounted inside its render() function. render() should be a pure function of props and state. It should never access something that requires stale data from the previous render, such as refs. Move this logic to componentDidMount and componentDidUpdate instead.", getComponentNameFromFiber(ownerFiber) || "A component");
                }
                instance._warnedAboutRefsInRender = true;
              }
            }
            var fiber = get(component);
            if (!fiber) {
              return false;
            }
            return getNearestMountedFiber(fiber) === fiber;
          }
          function assertIsMounted(fiber) {
            if (getNearestMountedFiber(fiber) !== fiber) {
              throw new Error("Unable to find node on an unmounted component.");
            }
          }
          function findCurrentFiberUsingSlowPath(fiber) {
            var alternate = fiber.alternate;
            if (!alternate) {
              var nearestMounted = getNearestMountedFiber(fiber);
              if (nearestMounted === null) {
                throw new Error("Unable to find node on an unmounted component.");
              }
              if (nearestMounted !== fiber) {
                return null;
              }
              return fiber;
            }
            var a = fiber;
            var b = alternate;
            while (true) {
              var parentA = a.return;
              if (parentA === null) {
                break;
              }
              var parentB = parentA.alternate;
              if (parentB === null) {
                var nextParent = parentA.return;
                if (nextParent !== null) {
                  a = b = nextParent;
                  continue;
                }
                break;
              }
              if (parentA.child === parentB.child) {
                var child = parentA.child;
                while (child) {
                  if (child === a) {
                    assertIsMounted(parentA);
                    return fiber;
                  }
                  if (child === b) {
                    assertIsMounted(parentA);
                    return alternate;
                  }
                  child = child.sibling;
                }
                throw new Error("Unable to find node on an unmounted component.");
              }
              if (a.return !== b.return) {
                a = parentA;
                b = parentB;
              } else {
                var didFindChild = false;
                var _child = parentA.child;
                while (_child) {
                  if (_child === a) {
                    didFindChild = true;
                    a = parentA;
                    b = parentB;
                    break;
                  }
                  if (_child === b) {
                    didFindChild = true;
                    b = parentA;
                    a = parentB;
                    break;
                  }
                  _child = _child.sibling;
                }
                if (!didFindChild) {
                  _child = parentB.child;
                  while (_child) {
                    if (_child === a) {
                      didFindChild = true;
                      a = parentB;
                      b = parentA;
                      break;
                    }
                    if (_child === b) {
                      didFindChild = true;
                      b = parentB;
                      a = parentA;
                      break;
                    }
                    _child = _child.sibling;
                  }
                  if (!didFindChild) {
                    throw new Error("Child was not found in either parent set. This indicates a bug in React related to the return pointer. Please file an issue.");
                  }
                }
              }
              if (a.alternate !== b) {
                throw new Error("Return fibers should always be each others' alternates. This error is likely caused by a bug in React. Please file an issue.");
              }
            }
            if (a.tag !== HostRoot) {
              throw new Error("Unable to find node on an unmounted component.");
            }
            if (a.stateNode.current === a) {
              return fiber;
            }
            return alternate;
          }
          function findCurrentHostFiber(parent) {
            var currentParent = findCurrentFiberUsingSlowPath(parent);
            return currentParent !== null ? findCurrentHostFiberImpl(currentParent) : null;
          }
          function findCurrentHostFiberImpl(node) {
            if (node.tag === HostComponent || node.tag === HostText) {
              return node;
            }
            var child = node.child;
            while (child !== null) {
              var match = findCurrentHostFiberImpl(child);
              if (match !== null) {
                return match;
              }
              child = child.sibling;
            }
            return null;
          }
          function findCurrentHostFiberWithNoPortals(parent) {
            var currentParent = findCurrentFiberUsingSlowPath(parent);
            return currentParent !== null ? findCurrentHostFiberWithNoPortalsImpl(currentParent) : null;
          }
          function findCurrentHostFiberWithNoPortalsImpl(node) {
            if (node.tag === HostComponent || node.tag === HostText) {
              return node;
            }
            var child = node.child;
            while (child !== null) {
              if (child.tag !== HostPortal) {
                var match = findCurrentHostFiberWithNoPortalsImpl(child);
                if (match !== null) {
                  return match;
                }
              }
              child = child.sibling;
            }
            return null;
          }
          var isArrayImpl = Array.isArray;
          function isArray(a) {
            return isArrayImpl(a);
          }
          var getPublicInstance = $$$hostConfig.getPublicInstance;
          var getRootHostContext = $$$hostConfig.getRootHostContext;
          var getChildHostContext = $$$hostConfig.getChildHostContext;
          var prepareForCommit = $$$hostConfig.prepareForCommit;
          var resetAfterCommit = $$$hostConfig.resetAfterCommit;
          var createInstance = $$$hostConfig.createInstance;
          var appendInitialChild = $$$hostConfig.appendInitialChild;
          var finalizeInitialChildren = $$$hostConfig.finalizeInitialChildren;
          var prepareUpdate = $$$hostConfig.prepareUpdate;
          var shouldSetTextContent = $$$hostConfig.shouldSetTextContent;
          var createTextInstance = $$$hostConfig.createTextInstance;
          var scheduleTimeout = $$$hostConfig.scheduleTimeout;
          var cancelTimeout = $$$hostConfig.cancelTimeout;
          var noTimeout = $$$hostConfig.noTimeout;
          var isPrimaryRenderer = $$$hostConfig.isPrimaryRenderer;
          var warnsIfNotActing = $$$hostConfig.warnsIfNotActing;
          var supportsMutation = $$$hostConfig.supportsMutation;
          var supportsPersistence = $$$hostConfig.supportsPersistence;
          var supportsHydration = $$$hostConfig.supportsHydration;
          var getInstanceFromNode = $$$hostConfig.getInstanceFromNode;
          var beforeActiveInstanceBlur = $$$hostConfig.beforeActiveInstanceBlur;
          var afterActiveInstanceBlur = $$$hostConfig.afterActiveInstanceBlur;
          var preparePortalMount = $$$hostConfig.preparePortalMount;
          var prepareScopeUpdate = $$$hostConfig.prepareScopeUpdate;
          var getInstanceFromScope = $$$hostConfig.getInstanceFromScope;
          var getCurrentEventPriority = $$$hostConfig.getCurrentEventPriority;
          var detachDeletedInstance = $$$hostConfig.detachDeletedInstance;
          var supportsMicrotasks = $$$hostConfig.supportsMicrotasks;
          var scheduleMicrotask = $$$hostConfig.scheduleMicrotask;
          var supportsTestSelectors = $$$hostConfig.supportsTestSelectors;
          var findFiberRoot = $$$hostConfig.findFiberRoot;
          var getBoundingRect = $$$hostConfig.getBoundingRect;
          var getTextContent = $$$hostConfig.getTextContent;
          var isHiddenSubtree = $$$hostConfig.isHiddenSubtree;
          var matchAccessibilityRole = $$$hostConfig.matchAccessibilityRole;
          var setFocusIfFocusable = $$$hostConfig.setFocusIfFocusable;
          var setupIntersectionObserver = $$$hostConfig.setupIntersectionObserver;
          var appendChild = $$$hostConfig.appendChild;
          var appendChildToContainer = $$$hostConfig.appendChildToContainer;
          var commitTextUpdate = $$$hostConfig.commitTextUpdate;
          var commitMount = $$$hostConfig.commitMount;
          var commitUpdate = $$$hostConfig.commitUpdate;
          var insertBefore = $$$hostConfig.insertBefore;
          var insertInContainerBefore = $$$hostConfig.insertInContainerBefore;
          var removeChild = $$$hostConfig.removeChild;
          var removeChildFromContainer = $$$hostConfig.removeChildFromContainer;
          var resetTextContent = $$$hostConfig.resetTextContent;
          var hideInstance = $$$hostConfig.hideInstance;
          var hideTextInstance = $$$hostConfig.hideTextInstance;
          var unhideInstance = $$$hostConfig.unhideInstance;
          var unhideTextInstance = $$$hostConfig.unhideTextInstance;
          var clearContainer = $$$hostConfig.clearContainer;
          var cloneInstance = $$$hostConfig.cloneInstance;
          var createContainerChildSet = $$$hostConfig.createContainerChildSet;
          var appendChildToContainerChildSet = $$$hostConfig.appendChildToContainerChildSet;
          var finalizeContainerChildren = $$$hostConfig.finalizeContainerChildren;
          var replaceContainerChildren = $$$hostConfig.replaceContainerChildren;
          var cloneHiddenInstance = $$$hostConfig.cloneHiddenInstance;
          var cloneHiddenTextInstance = $$$hostConfig.cloneHiddenTextInstance;
          var canHydrateInstance = $$$hostConfig.canHydrateInstance;
          var canHydrateTextInstance = $$$hostConfig.canHydrateTextInstance;
          var canHydrateSuspenseInstance = $$$hostConfig.canHydrateSuspenseInstance;
          var isSuspenseInstancePending = $$$hostConfig.isSuspenseInstancePending;
          var isSuspenseInstanceFallback = $$$hostConfig.isSuspenseInstanceFallback;
          var getSuspenseInstanceFallbackErrorDetails = $$$hostConfig.getSuspenseInstanceFallbackErrorDetails;
          var registerSuspenseInstanceRetry = $$$hostConfig.registerSuspenseInstanceRetry;
          var getNextHydratableSibling = $$$hostConfig.getNextHydratableSibling;
          var getFirstHydratableChild = $$$hostConfig.getFirstHydratableChild;
          var getFirstHydratableChildWithinContainer = $$$hostConfig.getFirstHydratableChildWithinContainer;
          var getFirstHydratableChildWithinSuspenseInstance = $$$hostConfig.getFirstHydratableChildWithinSuspenseInstance;
          var hydrateInstance = $$$hostConfig.hydrateInstance;
          var hydrateTextInstance = $$$hostConfig.hydrateTextInstance;
          var hydrateSuspenseInstance = $$$hostConfig.hydrateSuspenseInstance;
          var getNextHydratableInstanceAfterSuspenseInstance = $$$hostConfig.getNextHydratableInstanceAfterSuspenseInstance;
          var commitHydratedContainer = $$$hostConfig.commitHydratedContainer;
          var commitHydratedSuspenseInstance = $$$hostConfig.commitHydratedSuspenseInstance;
          var clearSuspenseBoundary = $$$hostConfig.clearSuspenseBoundary;
          var clearSuspenseBoundaryFromContainer = $$$hostConfig.clearSuspenseBoundaryFromContainer;
          var shouldDeleteUnhydratedTailInstances = $$$hostConfig.shouldDeleteUnhydratedTailInstances;
          var didNotMatchHydratedContainerTextInstance = $$$hostConfig.didNotMatchHydratedContainerTextInstance;
          var didNotMatchHydratedTextInstance = $$$hostConfig.didNotMatchHydratedTextInstance;
          var didNotHydrateInstanceWithinContainer = $$$hostConfig.didNotHydrateInstanceWithinContainer;
          var didNotHydrateInstanceWithinSuspenseInstance = $$$hostConfig.didNotHydrateInstanceWithinSuspenseInstance;
          var didNotHydrateInstance = $$$hostConfig.didNotHydrateInstance;
          var didNotFindHydratableInstanceWithinContainer = $$$hostConfig.didNotFindHydratableInstanceWithinContainer;
          var didNotFindHydratableTextInstanceWithinContainer = $$$hostConfig.didNotFindHydratableTextInstanceWithinContainer;
          var didNotFindHydratableSuspenseInstanceWithinContainer = $$$hostConfig.didNotFindHydratableSuspenseInstanceWithinContainer;
          var didNotFindHydratableInstanceWithinSuspenseInstance = $$$hostConfig.didNotFindHydratableInstanceWithinSuspenseInstance;
          var didNotFindHydratableTextInstanceWithinSuspenseInstance = $$$hostConfig.didNotFindHydratableTextInstanceWithinSuspenseInstance;
          var didNotFindHydratableSuspenseInstanceWithinSuspenseInstance = $$$hostConfig.didNotFindHydratableSuspenseInstanceWithinSuspenseInstance;
          var didNotFindHydratableInstance = $$$hostConfig.didNotFindHydratableInstance;
          var didNotFindHydratableTextInstance = $$$hostConfig.didNotFindHydratableTextInstance;
          var didNotFindHydratableSuspenseInstance = $$$hostConfig.didNotFindHydratableSuspenseInstance;
          var errorHydratingContainer = $$$hostConfig.errorHydratingContainer;
          var disabledDepth = 0;
          var prevLog;
          var prevInfo;
          var prevWarn;
          var prevError;
          var prevGroup;
          var prevGroupCollapsed;
          var prevGroupEnd;
          function disabledLog() {
          }
          disabledLog.__reactDisabledLog = true;
          function disableLogs() {
            {
              if (disabledDepth === 0) {
                prevLog = console.log;
                prevInfo = console.info;
                prevWarn = console.warn;
                prevError = console.error;
                prevGroup = console.group;
                prevGroupCollapsed = console.groupCollapsed;
                prevGroupEnd = console.groupEnd;
                var props = {
                  configurable: true,
                  enumerable: true,
                  value: disabledLog,
                  writable: true
                };
                Object.defineProperties(console, {
                  info: props,
                  log: props,
                  warn: props,
                  error: props,
                  group: props,
                  groupCollapsed: props,
                  groupEnd: props
                });
              }
              disabledDepth++;
            }
          }
          function reenableLogs() {
            {
              disabledDepth--;
              if (disabledDepth === 0) {
                var props = {
                  configurable: true,
                  enumerable: true,
                  writable: true
                };
                Object.defineProperties(console, {
                  log: assign({}, props, {
                    value: prevLog
                  }),
                  info: assign({}, props, {
                    value: prevInfo
                  }),
                  warn: assign({}, props, {
                    value: prevWarn
                  }),
                  error: assign({}, props, {
                    value: prevError
                  }),
                  group: assign({}, props, {
                    value: prevGroup
                  }),
                  groupCollapsed: assign({}, props, {
                    value: prevGroupCollapsed
                  }),
                  groupEnd: assign({}, props, {
                    value: prevGroupEnd
                  })
                });
              }
              if (disabledDepth < 0) {
                error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
              }
            }
          }
          var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
          var prefix;
          function describeBuiltInComponentFrame(name, source, ownerFn) {
            {
              if (prefix === void 0) {
                try {
                  throw Error();
                } catch (x) {
                  var match = x.stack.trim().match(/\n( *(at )?)/);
                  prefix = match && match[1] || "";
                }
              }
              return "\n" + prefix + name;
            }
          }
          var reentry = false;
          var componentFrameCache;
          {
            var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
            componentFrameCache = new PossiblyWeakMap();
          }
          function describeNativeComponentFrame(fn, construct) {
            if (!fn || reentry) {
              return "";
            }
            {
              var frame = componentFrameCache.get(fn);
              if (frame !== void 0) {
                return frame;
              }
            }
            var control;
            reentry = true;
            var previousPrepareStackTrace = Error.prepareStackTrace;
            Error.prepareStackTrace = void 0;
            var previousDispatcher;
            {
              previousDispatcher = ReactCurrentDispatcher.current;
              ReactCurrentDispatcher.current = null;
              disableLogs();
            }
            try {
              if (construct) {
                var Fake = function() {
                  throw Error();
                };
                Object.defineProperty(Fake.prototype, "props", {
                  set: function() {
                    throw Error();
                  }
                });
                if (typeof Reflect === "object" && Reflect.construct) {
                  try {
                    Reflect.construct(Fake, []);
                  } catch (x) {
                    control = x;
                  }
                  Reflect.construct(fn, [], Fake);
                } else {
                  try {
                    Fake.call();
                  } catch (x) {
                    control = x;
                  }
                  fn.call(Fake.prototype);
                }
              } else {
                try {
                  throw Error();
                } catch (x) {
                  control = x;
                }
                fn();
              }
            } catch (sample) {
              if (sample && control && typeof sample.stack === "string") {
                var sampleLines = sample.stack.split("\n");
                var controlLines = control.stack.split("\n");
                var s = sampleLines.length - 1;
                var c = controlLines.length - 1;
                while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
                  c--;
                }
                for (; s >= 1 && c >= 0; s--, c--) {
                  if (sampleLines[s] !== controlLines[c]) {
                    if (s !== 1 || c !== 1) {
                      do {
                        s--;
                        c--;
                        if (c < 0 || sampleLines[s] !== controlLines[c]) {
                          var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
                          if (fn.displayName && _frame.includes("<anonymous>")) {
                            _frame = _frame.replace("<anonymous>", fn.displayName);
                          }
                          {
                            if (typeof fn === "function") {
                              componentFrameCache.set(fn, _frame);
                            }
                          }
                          return _frame;
                        }
                      } while (s >= 1 && c >= 0);
                    }
                    break;
                  }
                }
              }
            } finally {
              reentry = false;
              {
                ReactCurrentDispatcher.current = previousDispatcher;
                reenableLogs();
              }
              Error.prepareStackTrace = previousPrepareStackTrace;
            }
            var name = fn ? fn.displayName || fn.name : "";
            var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
            {
              if (typeof fn === "function") {
                componentFrameCache.set(fn, syntheticFrame);
              }
            }
            return syntheticFrame;
          }
          function describeClassComponentFrame(ctor, source, ownerFn) {
            {
              return describeNativeComponentFrame(ctor, true);
            }
          }
          function describeFunctionComponentFrame(fn, source, ownerFn) {
            {
              return describeNativeComponentFrame(fn, false);
            }
          }
          function shouldConstruct(Component) {
            var prototype = Component.prototype;
            return !!(prototype && prototype.isReactComponent);
          }
          function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
            if (type == null) {
              return "";
            }
            if (typeof type === "function") {
              {
                return describeNativeComponentFrame(type, shouldConstruct(type));
              }
            }
            if (typeof type === "string") {
              return describeBuiltInComponentFrame(type);
            }
            switch (type) {
              case REACT_SUSPENSE_TYPE:
                return describeBuiltInComponentFrame("Suspense");
              case REACT_SUSPENSE_LIST_TYPE:
                return describeBuiltInComponentFrame("SuspenseList");
            }
            if (typeof type === "object") {
              switch (type.$$typeof) {
                case REACT_FORWARD_REF_TYPE:
                  return describeFunctionComponentFrame(type.render);
                case REACT_MEMO_TYPE:
                  return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
                case REACT_LAZY_TYPE: {
                  var lazyComponent = type;
                  var payload = lazyComponent._payload;
                  var init = lazyComponent._init;
                  try {
                    return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                  } catch (x) {
                  }
                }
              }
            }
            return "";
          }
          var hasOwnProperty = Object.prototype.hasOwnProperty;
          var loggedTypeFailures = {};
          var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
          function setCurrentlyValidatingElement(element) {
            {
              if (element) {
                var owner = element._owner;
                var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
                ReactDebugCurrentFrame.setExtraStackFrame(stack);
              } else {
                ReactDebugCurrentFrame.setExtraStackFrame(null);
              }
            }
          }
          function checkPropTypes(typeSpecs, values, location, componentName, element) {
            {
              var has = Function.call.bind(hasOwnProperty);
              for (var typeSpecName in typeSpecs) {
                if (has(typeSpecs, typeSpecName)) {
                  var error$1 = void 0;
                  try {
                    if (typeof typeSpecs[typeSpecName] !== "function") {
                      var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                      err.name = "Invariant Violation";
                      throw err;
                    }
                    error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                  } catch (ex) {
                    error$1 = ex;
                  }
                  if (error$1 && !(error$1 instanceof Error)) {
                    setCurrentlyValidatingElement(element);
                    error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                    setCurrentlyValidatingElement(null);
                  }
                  if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                    loggedTypeFailures[error$1.message] = true;
                    setCurrentlyValidatingElement(element);
                    error("Failed %s type: %s", location, error$1.message);
                    setCurrentlyValidatingElement(null);
                  }
                }
              }
            }
          }
          var valueStack = [];
          var fiberStack;
          {
            fiberStack = [];
          }
          var index = -1;
          function createCursor(defaultValue) {
            return {
              current: defaultValue
            };
          }
          function pop(cursor, fiber) {
            if (index < 0) {
              {
                error("Unexpected pop.");
              }
              return;
            }
            {
              if (fiber !== fiberStack[index]) {
                error("Unexpected Fiber popped.");
              }
            }
            cursor.current = valueStack[index];
            valueStack[index] = null;
            {
              fiberStack[index] = null;
            }
            index--;
          }
          function push(cursor, value, fiber) {
            index++;
            valueStack[index] = cursor.current;
            {
              fiberStack[index] = fiber;
            }
            cursor.current = value;
          }
          var warnedAboutMissingGetChildContext;
          {
            warnedAboutMissingGetChildContext = {};
          }
          var emptyContextObject = {};
          {
            Object.freeze(emptyContextObject);
          }
          var contextStackCursor = createCursor(emptyContextObject);
          var didPerformWorkStackCursor = createCursor(false);
          var previousContext = emptyContextObject;
          function getUnmaskedContext(workInProgress2, Component, didPushOwnContextIfProvider) {
            {
              if (didPushOwnContextIfProvider && isContextProvider(Component)) {
                return previousContext;
              }
              return contextStackCursor.current;
            }
          }
          function cacheContext(workInProgress2, unmaskedContext, maskedContext) {
            {
              var instance = workInProgress2.stateNode;
              instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext;
              instance.__reactInternalMemoizedMaskedChildContext = maskedContext;
            }
          }
          function getMaskedContext(workInProgress2, unmaskedContext) {
            {
              var type = workInProgress2.type;
              var contextTypes = type.contextTypes;
              if (!contextTypes) {
                return emptyContextObject;
              }
              var instance = workInProgress2.stateNode;
              if (instance && instance.__reactInternalMemoizedUnmaskedChildContext === unmaskedContext) {
                return instance.__reactInternalMemoizedMaskedChildContext;
              }
              var context = {};
              for (var key in contextTypes) {
                context[key] = unmaskedContext[key];
              }
              {
                var name = getComponentNameFromFiber(workInProgress2) || "Unknown";
                checkPropTypes(contextTypes, context, "context", name);
              }
              if (instance) {
                cacheContext(workInProgress2, unmaskedContext, context);
              }
              return context;
            }
          }
          function hasContextChanged() {
            {
              return didPerformWorkStackCursor.current;
            }
          }
          function isContextProvider(type) {
            {
              var childContextTypes = type.childContextTypes;
              return childContextTypes !== null && childContextTypes !== void 0;
            }
          }
          function popContext(fiber) {
            {
              pop(didPerformWorkStackCursor, fiber);
              pop(contextStackCursor, fiber);
            }
          }
          function popTopLevelContextObject(fiber) {
            {
              pop(didPerformWorkStackCursor, fiber);
              pop(contextStackCursor, fiber);
            }
          }
          function pushTopLevelContextObject(fiber, context, didChange) {
            {
              if (contextStackCursor.current !== emptyContextObject) {
                throw new Error("Unexpected context found on stack. This error is likely caused by a bug in React. Please file an issue.");
              }
              push(contextStackCursor, context, fiber);
              push(didPerformWorkStackCursor, didChange, fiber);
            }
          }
          function processChildContext(fiber, type, parentContext) {
            {
              var instance = fiber.stateNode;
              var childContextTypes = type.childContextTypes;
              if (typeof instance.getChildContext !== "function") {
                {
                  var componentName = getComponentNameFromFiber(fiber) || "Unknown";
                  if (!warnedAboutMissingGetChildContext[componentName]) {
                    warnedAboutMissingGetChildContext[componentName] = true;
                    error("%s.childContextTypes is specified but there is no getChildContext() method on the instance. You can either define getChildContext() on %s or remove childContextTypes from it.", componentName, componentName);
                  }
                }
                return parentContext;
              }
              var childContext = instance.getChildContext();
              for (var contextKey in childContext) {
                if (!(contextKey in childContextTypes)) {
                  throw new Error((getComponentNameFromFiber(fiber) || "Unknown") + '.getChildContext(): key "' + contextKey + '" is not defined in childContextTypes.');
                }
              }
              {
                var name = getComponentNameFromFiber(fiber) || "Unknown";
                checkPropTypes(childContextTypes, childContext, "child context", name);
              }
              return assign({}, parentContext, childContext);
            }
          }
          function pushContextProvider(workInProgress2) {
            {
              var instance = workInProgress2.stateNode;
              var memoizedMergedChildContext = instance && instance.__reactInternalMemoizedMergedChildContext || emptyContextObject;
              previousContext = contextStackCursor.current;
              push(contextStackCursor, memoizedMergedChildContext, workInProgress2);
              push(didPerformWorkStackCursor, didPerformWorkStackCursor.current, workInProgress2);
              return true;
            }
          }
          function invalidateContextProvider(workInProgress2, type, didChange) {
            {
              var instance = workInProgress2.stateNode;
              if (!instance) {
                throw new Error("Expected to have an instance by this point. This error is likely caused by a bug in React. Please file an issue.");
              }
              if (didChange) {
                var mergedContext = processChildContext(workInProgress2, type, previousContext);
                instance.__reactInternalMemoizedMergedChildContext = mergedContext;
                pop(didPerformWorkStackCursor, workInProgress2);
                pop(contextStackCursor, workInProgress2);
                push(contextStackCursor, mergedContext, workInProgress2);
                push(didPerformWorkStackCursor, didChange, workInProgress2);
              } else {
                pop(didPerformWorkStackCursor, workInProgress2);
                push(didPerformWorkStackCursor, didChange, workInProgress2);
              }
            }
          }
          function findCurrentUnmaskedContext(fiber) {
            {
              if (!isFiberMounted(fiber) || fiber.tag !== ClassComponent) {
                throw new Error("Expected subtree parent to be a mounted class component. This error is likely caused by a bug in React. Please file an issue.");
              }
              var node = fiber;
              do {
                switch (node.tag) {
                  case HostRoot:
                    return node.stateNode.context;
                  case ClassComponent: {
                    var Component = node.type;
                    if (isContextProvider(Component)) {
                      return node.stateNode.__reactInternalMemoizedMergedChildContext;
                    }
                    break;
                  }
                }
                node = node.return;
              } while (node !== null);
              throw new Error("Found unexpected detached subtree parent. This error is likely caused by a bug in React. Please file an issue.");
            }
          }
          var LegacyRoot = 0;
          var ConcurrentRoot = 1;
          var NoMode = (
            /*                         */
            0
          );
          var ConcurrentMode = (
            /*                 */
            1
          );
          var ProfileMode = (
            /*                    */
            2
          );
          var StrictLegacyMode = (
            /*               */
            8
          );
          var StrictEffectsMode = (
            /*              */
            16
          );
          var clz32 = Math.clz32 ? Math.clz32 : clz32Fallback;
          var log = Math.log;
          var LN2 = Math.LN2;
          function clz32Fallback(x) {
            var asUint = x >>> 0;
            if (asUint === 0) {
              return 32;
            }
            return 31 - (log(asUint) / LN2 | 0) | 0;
          }
          var TotalLanes = 31;
          var NoLanes = (
            /*                        */
            0
          );
          var NoLane = (
            /*                          */
            0
          );
          var SyncLane = (
            /*                        */
            1
          );
          var InputContinuousHydrationLane = (
            /*    */
            2
          );
          var InputContinuousLane = (
            /*             */
            4
          );
          var DefaultHydrationLane = (
            /*            */
            8
          );
          var DefaultLane = (
            /*                     */
            16
          );
          var TransitionHydrationLane = (
            /*                */
            32
          );
          var TransitionLanes = (
            /*                       */
            4194240
          );
          var TransitionLane1 = (
            /*                        */
            64
          );
          var TransitionLane2 = (
            /*                        */
            128
          );
          var TransitionLane3 = (
            /*                        */
            256
          );
          var TransitionLane4 = (
            /*                        */
            512
          );
          var TransitionLane5 = (
            /*                        */
            1024
          );
          var TransitionLane6 = (
            /*                        */
            2048
          );
          var TransitionLane7 = (
            /*                        */
            4096
          );
          var TransitionLane8 = (
            /*                        */
            8192
          );
          var TransitionLane9 = (
            /*                        */
            16384
          );
          var TransitionLane10 = (
            /*                       */
            32768
          );
          var TransitionLane11 = (
            /*                       */
            65536
          );
          var TransitionLane12 = (
            /*                       */
            131072
          );
          var TransitionLane13 = (
            /*                       */
            262144
          );
          var TransitionLane14 = (
            /*                       */
            524288
          );
          var TransitionLane15 = (
            /*                       */
            1048576
          );
          var TransitionLane16 = (
            /*                       */
            2097152
          );
          var RetryLanes = (
            /*                            */
            130023424
          );
          var RetryLane1 = (
            /*                             */
            4194304
          );
          var RetryLane2 = (
            /*                             */
            8388608
          );
          var RetryLane3 = (
            /*                             */
            16777216
          );
          var RetryLane4 = (
            /*                             */
            33554432
          );
          var RetryLane5 = (
            /*                             */
            67108864
          );
          var SomeRetryLane = RetryLane1;
          var SelectiveHydrationLane = (
            /*          */
            134217728
          );
          var NonIdleLanes = (
            /*                          */
            268435455
          );
          var IdleHydrationLane = (
            /*               */
            268435456
          );
          var IdleLane = (
            /*                        */
            536870912
          );
          var OffscreenLane = (
            /*                   */
            1073741824
          );
          function getLabelForLane(lane) {
            {
              if (lane & SyncLane) {
                return "Sync";
              }
              if (lane & InputContinuousHydrationLane) {
                return "InputContinuousHydration";
              }
              if (lane & InputContinuousLane) {
                return "InputContinuous";
              }
              if (lane & DefaultHydrationLane) {
                return "DefaultHydration";
              }
              if (lane & DefaultLane) {
                return "Default";
              }
              if (lane & TransitionHydrationLane) {
                return "TransitionHydration";
              }
              if (lane & TransitionLanes) {
                return "Transition";
              }
              if (lane & RetryLanes) {
                return "Retry";
              }
              if (lane & SelectiveHydrationLane) {
                return "SelectiveHydration";
              }
              if (lane & IdleHydrationLane) {
                return "IdleHydration";
              }
              if (lane & IdleLane) {
                return "Idle";
              }
              if (lane & OffscreenLane) {
                return "Offscreen";
              }
            }
          }
          var NoTimestamp = -1;
          var nextTransitionLane = TransitionLane1;
          var nextRetryLane = RetryLane1;
          function getHighestPriorityLanes(lanes) {
            switch (getHighestPriorityLane(lanes)) {
              case SyncLane:
                return SyncLane;
              case InputContinuousHydrationLane:
                return InputContinuousHydrationLane;
              case InputContinuousLane:
                return InputContinuousLane;
              case DefaultHydrationLane:
                return DefaultHydrationLane;
              case DefaultLane:
                return DefaultLane;
              case TransitionHydrationLane:
                return TransitionHydrationLane;
              case TransitionLane1:
              case TransitionLane2:
              case TransitionLane3:
              case TransitionLane4:
              case TransitionLane5:
              case TransitionLane6:
              case TransitionLane7:
              case TransitionLane8:
              case TransitionLane9:
              case TransitionLane10:
              case TransitionLane11:
              case TransitionLane12:
              case TransitionLane13:
              case TransitionLane14:
              case TransitionLane15:
              case TransitionLane16:
                return lanes & TransitionLanes;
              case RetryLane1:
              case RetryLane2:
              case RetryLane3:
              case RetryLane4:
              case RetryLane5:
                return lanes & RetryLanes;
              case SelectiveHydrationLane:
                return SelectiveHydrationLane;
              case IdleHydrationLane:
                return IdleHydrationLane;
              case IdleLane:
                return IdleLane;
              case OffscreenLane:
                return OffscreenLane;
              default:
                {
                  error("Should have found matching lanes. This is a bug in React.");
                }
                return lanes;
            }
          }
          function getNextLanes(root, wipLanes) {
            var pendingLanes = root.pendingLanes;
            if (pendingLanes === NoLanes) {
              return NoLanes;
            }
            var nextLanes = NoLanes;
            var suspendedLanes = root.suspendedLanes;
            var pingedLanes = root.pingedLanes;
            var nonIdlePendingLanes = pendingLanes & NonIdleLanes;
            if (nonIdlePendingLanes !== NoLanes) {
              var nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
              if (nonIdleUnblockedLanes !== NoLanes) {
                nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
              } else {
                var nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;
                if (nonIdlePingedLanes !== NoLanes) {
                  nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
                }
              }
            } else {
              var unblockedLanes = pendingLanes & ~suspendedLanes;
              if (unblockedLanes !== NoLanes) {
                nextLanes = getHighestPriorityLanes(unblockedLanes);
              } else {
                if (pingedLanes !== NoLanes) {
                  nextLanes = getHighestPriorityLanes(pingedLanes);
                }
              }
            }
            if (nextLanes === NoLanes) {
              return NoLanes;
            }
            if (wipLanes !== NoLanes && wipLanes !== nextLanes && // If we already suspended with a delay, then interrupting is fine. Don't
            // bother waiting until the root is complete.
            (wipLanes & suspendedLanes) === NoLanes) {
              var nextLane = getHighestPriorityLane(nextLanes);
              var wipLane = getHighestPriorityLane(wipLanes);
              if (
                // Tests whether the next lane is equal or lower priority than the wip
                // one. This works because the bits decrease in priority as you go left.
                nextLane >= wipLane || // Default priority updates should not interrupt transition updates. The
                // only difference between default updates and transition updates is that
                // default updates do not support refresh transitions.
                nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes
              ) {
                return wipLanes;
              }
            }
            if ((nextLanes & InputContinuousLane) !== NoLanes) {
              nextLanes |= pendingLanes & DefaultLane;
            }
            var entangledLanes = root.entangledLanes;
            if (entangledLanes !== NoLanes) {
              var entanglements = root.entanglements;
              var lanes = nextLanes & entangledLanes;
              while (lanes > 0) {
                var index2 = pickArbitraryLaneIndex(lanes);
                var lane = 1 << index2;
                nextLanes |= entanglements[index2];
                lanes &= ~lane;
              }
            }
            return nextLanes;
          }
          function getMostRecentEventTime(root, lanes) {
            var eventTimes = root.eventTimes;
            var mostRecentEventTime = NoTimestamp;
            while (lanes > 0) {
              var index2 = pickArbitraryLaneIndex(lanes);
              var lane = 1 << index2;
              var eventTime = eventTimes[index2];
              if (eventTime > mostRecentEventTime) {
                mostRecentEventTime = eventTime;
              }
              lanes &= ~lane;
            }
            return mostRecentEventTime;
          }
          function computeExpirationTime(lane, currentTime) {
            switch (lane) {
              case SyncLane:
              case InputContinuousHydrationLane:
              case InputContinuousLane:
                return currentTime + 250;
              case DefaultHydrationLane:
              case DefaultLane:
              case TransitionHydrationLane:
              case TransitionLane1:
              case TransitionLane2:
              case TransitionLane3:
              case TransitionLane4:
              case TransitionLane5:
              case TransitionLane6:
              case TransitionLane7:
              case TransitionLane8:
              case TransitionLane9:
              case TransitionLane10:
              case TransitionLane11:
              case TransitionLane12:
              case TransitionLane13:
              case TransitionLane14:
              case TransitionLane15:
              case TransitionLane16:
                return currentTime + 5e3;
              case RetryLane1:
              case RetryLane2:
              case RetryLane3:
              case RetryLane4:
              case RetryLane5:
                return NoTimestamp;
              case SelectiveHydrationLane:
              case IdleHydrationLane:
              case IdleLane:
              case OffscreenLane:
                return NoTimestamp;
              default:
                {
                  error("Should have found matching lanes. This is a bug in React.");
                }
                return NoTimestamp;
            }
          }
          function markStarvedLanesAsExpired(root, currentTime) {
            var pendingLanes = root.pendingLanes;
            var suspendedLanes = root.suspendedLanes;
            var pingedLanes = root.pingedLanes;
            var expirationTimes = root.expirationTimes;
            var lanes = pendingLanes;
            while (lanes > 0) {
              var index2 = pickArbitraryLaneIndex(lanes);
              var lane = 1 << index2;
              var expirationTime = expirationTimes[index2];
              if (expirationTime === NoTimestamp) {
                if ((lane & suspendedLanes) === NoLanes || (lane & pingedLanes) !== NoLanes) {
                  expirationTimes[index2] = computeExpirationTime(lane, currentTime);
                }
              } else if (expirationTime <= currentTime) {
                root.expiredLanes |= lane;
              }
              lanes &= ~lane;
            }
          }
          function getHighestPriorityPendingLanes(root) {
            return getHighestPriorityLanes(root.pendingLanes);
          }
          function getLanesToRetrySynchronouslyOnError(root) {
            var everythingButOffscreen = root.pendingLanes & ~OffscreenLane;
            if (everythingButOffscreen !== NoLanes) {
              return everythingButOffscreen;
            }
            if (everythingButOffscreen & OffscreenLane) {
              return OffscreenLane;
            }
            return NoLanes;
          }
          function includesSyncLane(lanes) {
            return (lanes & SyncLane) !== NoLanes;
          }
          function includesNonIdleWork(lanes) {
            return (lanes & NonIdleLanes) !== NoLanes;
          }
          function includesOnlyRetries(lanes) {
            return (lanes & RetryLanes) === lanes;
          }
          function includesOnlyNonUrgentLanes(lanes) {
            var UrgentLanes = SyncLane | InputContinuousLane | DefaultLane;
            return (lanes & UrgentLanes) === NoLanes;
          }
          function includesOnlyTransitions(lanes) {
            return (lanes & TransitionLanes) === lanes;
          }
          function includesBlockingLane(root, lanes) {
            var SyncDefaultLanes = InputContinuousHydrationLane | InputContinuousLane | DefaultHydrationLane | DefaultLane;
            return (lanes & SyncDefaultLanes) !== NoLanes;
          }
          function includesExpiredLane(root, lanes) {
            return (lanes & root.expiredLanes) !== NoLanes;
          }
          function isTransitionLane(lane) {
            return (lane & TransitionLanes) !== NoLanes;
          }
          function claimNextTransitionLane() {
            var lane = nextTransitionLane;
            nextTransitionLane <<= 1;
            if ((nextTransitionLane & TransitionLanes) === NoLanes) {
              nextTransitionLane = TransitionLane1;
            }
            return lane;
          }
          function claimNextRetryLane() {
            var lane = nextRetryLane;
            nextRetryLane <<= 1;
            if ((nextRetryLane & RetryLanes) === NoLanes) {
              nextRetryLane = RetryLane1;
            }
            return lane;
          }
          function getHighestPriorityLane(lanes) {
            return lanes & -lanes;
          }
          function pickArbitraryLane(lanes) {
            return getHighestPriorityLane(lanes);
          }
          function pickArbitraryLaneIndex(lanes) {
            return 31 - clz32(lanes);
          }
          function laneToIndex(lane) {
            return pickArbitraryLaneIndex(lane);
          }
          function includesSomeLane(a, b) {
            return (a & b) !== NoLanes;
          }
          function isSubsetOfLanes(set2, subset) {
            return (set2 & subset) === subset;
          }
          function mergeLanes(a, b) {
            return a | b;
          }
          function removeLanes(set2, subset) {
            return set2 & ~subset;
          }
          function intersectLanes(a, b) {
            return a & b;
          }
          function laneToLanes(lane) {
            return lane;
          }
          function higherPriorityLane(a, b) {
            return a !== NoLane && a < b ? a : b;
          }
          function createLaneMap(initial) {
            var laneMap = [];
            for (var i = 0; i < TotalLanes; i++) {
              laneMap.push(initial);
            }
            return laneMap;
          }
          function markRootUpdated(root, updateLane, eventTime) {
            root.pendingLanes |= updateLane;
            if (updateLane !== IdleLane) {
              root.suspendedLanes = NoLanes;
              root.pingedLanes = NoLanes;
            }
            var eventTimes = root.eventTimes;
            var index2 = laneToIndex(updateLane);
            eventTimes[index2] = eventTime;
          }
          function markRootSuspended(root, suspendedLanes) {
            root.suspendedLanes |= suspendedLanes;
            root.pingedLanes &= ~suspendedLanes;
            var expirationTimes = root.expirationTimes;
            var lanes = suspendedLanes;
            while (lanes > 0) {
              var index2 = pickArbitraryLaneIndex(lanes);
              var lane = 1 << index2;
              expirationTimes[index2] = NoTimestamp;
              lanes &= ~lane;
            }
          }
          function markRootPinged(root, pingedLanes, eventTime) {
            root.pingedLanes |= root.suspendedLanes & pingedLanes;
          }
          function markRootFinished(root, remainingLanes) {
            var noLongerPendingLanes = root.pendingLanes & ~remainingLanes;
            root.pendingLanes = remainingLanes;
            root.suspendedLanes = NoLanes;
            root.pingedLanes = NoLanes;
            root.expiredLanes &= remainingLanes;
            root.mutableReadLanes &= remainingLanes;
            root.entangledLanes &= remainingLanes;
            var entanglements = root.entanglements;
            var eventTimes = root.eventTimes;
            var expirationTimes = root.expirationTimes;
            var lanes = noLongerPendingLanes;
            while (lanes > 0) {
              var index2 = pickArbitraryLaneIndex(lanes);
              var lane = 1 << index2;
              entanglements[index2] = NoLanes;
              eventTimes[index2] = NoTimestamp;
              expirationTimes[index2] = NoTimestamp;
              lanes &= ~lane;
            }
          }
          function markRootEntangled(root, entangledLanes) {
            var rootEntangledLanes = root.entangledLanes |= entangledLanes;
            var entanglements = root.entanglements;
            var lanes = rootEntangledLanes;
            while (lanes) {
              var index2 = pickArbitraryLaneIndex(lanes);
              var lane = 1 << index2;
              if (
                // Is this one of the newly entangled lanes?
                lane & entangledLanes | // Is this lane transitively entangled with the newly entangled lanes?
                entanglements[index2] & entangledLanes
              ) {
                entanglements[index2] |= entangledLanes;
              }
              lanes &= ~lane;
            }
          }
          function getBumpedLaneForHydration(root, renderLanes2) {
            var renderLane = getHighestPriorityLane(renderLanes2);
            var lane;
            switch (renderLane) {
              case InputContinuousLane:
                lane = InputContinuousHydrationLane;
                break;
              case DefaultLane:
                lane = DefaultHydrationLane;
                break;
              case TransitionLane1:
              case TransitionLane2:
              case TransitionLane3:
              case TransitionLane4:
              case TransitionLane5:
              case TransitionLane6:
              case TransitionLane7:
              case TransitionLane8:
              case TransitionLane9:
              case TransitionLane10:
              case TransitionLane11:
              case TransitionLane12:
              case TransitionLane13:
              case TransitionLane14:
              case TransitionLane15:
              case TransitionLane16:
              case RetryLane1:
              case RetryLane2:
              case RetryLane3:
              case RetryLane4:
              case RetryLane5:
                lane = TransitionHydrationLane;
                break;
              case IdleLane:
                lane = IdleHydrationLane;
                break;
              default:
                lane = NoLane;
                break;
            }
            if ((lane & (root.suspendedLanes | renderLanes2)) !== NoLane) {
              return NoLane;
            }
            return lane;
          }
          function addFiberToLanesMap(root, fiber, lanes) {
            if (!isDevToolsPresent) {
              return;
            }
            var pendingUpdatersLaneMap = root.pendingUpdatersLaneMap;
            while (lanes > 0) {
              var index2 = laneToIndex(lanes);
              var lane = 1 << index2;
              var updaters = pendingUpdatersLaneMap[index2];
              updaters.add(fiber);
              lanes &= ~lane;
            }
          }
          function movePendingFibersToMemoized(root, lanes) {
            if (!isDevToolsPresent) {
              return;
            }
            var pendingUpdatersLaneMap = root.pendingUpdatersLaneMap;
            var memoizedUpdaters = root.memoizedUpdaters;
            while (lanes > 0) {
              var index2 = laneToIndex(lanes);
              var lane = 1 << index2;
              var updaters = pendingUpdatersLaneMap[index2];
              if (updaters.size > 0) {
                updaters.forEach(function(fiber) {
                  var alternate = fiber.alternate;
                  if (alternate === null || !memoizedUpdaters.has(alternate)) {
                    memoizedUpdaters.add(fiber);
                  }
                });
                updaters.clear();
              }
              lanes &= ~lane;
            }
          }
          function getTransitionsForLanes(root, lanes) {
            {
              return null;
            }
          }
          var DiscreteEventPriority = SyncLane;
          var ContinuousEventPriority = InputContinuousLane;
          var DefaultEventPriority2 = DefaultLane;
          var IdleEventPriority = IdleLane;
          var currentUpdatePriority = NoLane;
          function getCurrentUpdatePriority() {
            return currentUpdatePriority;
          }
          function setCurrentUpdatePriority(newPriority) {
            currentUpdatePriority = newPriority;
          }
          function runWithPriority(priority, fn) {
            var previousPriority = currentUpdatePriority;
            try {
              currentUpdatePriority = priority;
              return fn();
            } finally {
              currentUpdatePriority = previousPriority;
            }
          }
          function higherEventPriority(a, b) {
            return a !== 0 && a < b ? a : b;
          }
          function lowerEventPriority(a, b) {
            return a === 0 || a > b ? a : b;
          }
          function isHigherEventPriority(a, b) {
            return a !== 0 && a < b;
          }
          function lanesToEventPriority(lanes) {
            var lane = getHighestPriorityLane(lanes);
            if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
              return DiscreteEventPriority;
            }
            if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
              return ContinuousEventPriority;
            }
            if (includesNonIdleWork(lane)) {
              return DefaultEventPriority2;
            }
            return IdleEventPriority;
          }
          var scheduleCallback = Scheduler.unstable_scheduleCallback;
          var cancelCallback = Scheduler.unstable_cancelCallback;
          var shouldYield = Scheduler.unstable_shouldYield;
          var requestPaint = Scheduler.unstable_requestPaint;
          var now = Scheduler.unstable_now;
          var ImmediatePriority = Scheduler.unstable_ImmediatePriority;
          var UserBlockingPriority = Scheduler.unstable_UserBlockingPriority;
          var NormalPriority = Scheduler.unstable_NormalPriority;
          var IdlePriority = Scheduler.unstable_IdlePriority;
          var unstable_yieldValue = Scheduler.unstable_yieldValue;
          var unstable_setDisableYieldValue = Scheduler.unstable_setDisableYieldValue;
          var rendererID = null;
          var injectedHook = null;
          var injectedProfilingHooks = null;
          var hasLoggedError = false;
          var isDevToolsPresent = typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined";
          function injectInternals(internals) {
            if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined") {
              return false;
            }
            var hook = __REACT_DEVTOOLS_GLOBAL_HOOK__;
            if (hook.isDisabled) {
              return true;
            }
            if (!hook.supportsFiber) {
              {
                error("The installed version of React DevTools is too old and will not work with the current version of React. Please update React DevTools. https://reactjs.org/link/react-devtools");
              }
              return true;
            }
            try {
              if (enableSchedulingProfiler) {
                internals = assign({}, internals, {
                  getLaneLabelMap,
                  injectProfilingHooks
                });
              }
              rendererID = hook.inject(internals);
              injectedHook = hook;
            } catch (err) {
              {
                error("React instrumentation encountered an error: %s.", err);
              }
            }
            if (hook.checkDCE) {
              return true;
            } else {
              return false;
            }
          }
          function onScheduleRoot(root, children) {
            {
              if (injectedHook && typeof injectedHook.onScheduleFiberRoot === "function") {
                try {
                  injectedHook.onScheduleFiberRoot(rendererID, root, children);
                } catch (err) {
                  if (!hasLoggedError) {
                    hasLoggedError = true;
                    error("React instrumentation encountered an error: %s", err);
                  }
                }
              }
            }
          }
          function onCommitRoot(root, eventPriority) {
            if (injectedHook && typeof injectedHook.onCommitFiberRoot === "function") {
              try {
                var didError = (root.current.flags & DidCapture) === DidCapture;
                if (enableProfilerTimer) {
                  var schedulerPriority;
                  switch (eventPriority) {
                    case DiscreteEventPriority:
                      schedulerPriority = ImmediatePriority;
                      break;
                    case ContinuousEventPriority:
                      schedulerPriority = UserBlockingPriority;
                      break;
                    case DefaultEventPriority2:
                      schedulerPriority = NormalPriority;
                      break;
                    case IdleEventPriority:
                      schedulerPriority = IdlePriority;
                      break;
                    default:
                      schedulerPriority = NormalPriority;
                      break;
                  }
                  injectedHook.onCommitFiberRoot(rendererID, root, schedulerPriority, didError);
                } else {
                  injectedHook.onCommitFiberRoot(rendererID, root, void 0, didError);
                }
              } catch (err) {
                {
                  if (!hasLoggedError) {
                    hasLoggedError = true;
                    error("React instrumentation encountered an error: %s", err);
                  }
                }
              }
            }
          }
          function onPostCommitRoot(root) {
            if (injectedHook && typeof injectedHook.onPostCommitFiberRoot === "function") {
              try {
                injectedHook.onPostCommitFiberRoot(rendererID, root);
              } catch (err) {
                {
                  if (!hasLoggedError) {
                    hasLoggedError = true;
                    error("React instrumentation encountered an error: %s", err);
                  }
                }
              }
            }
          }
          function onCommitUnmount(fiber) {
            if (injectedHook && typeof injectedHook.onCommitFiberUnmount === "function") {
              try {
                injectedHook.onCommitFiberUnmount(rendererID, fiber);
              } catch (err) {
                {
                  if (!hasLoggedError) {
                    hasLoggedError = true;
                    error("React instrumentation encountered an error: %s", err);
                  }
                }
              }
            }
          }
          function setIsStrictModeForDevtools(newIsStrictMode) {
            {
              if (typeof unstable_yieldValue === "function") {
                unstable_setDisableYieldValue(newIsStrictMode);
                setSuppressWarning(newIsStrictMode);
              }
              if (injectedHook && typeof injectedHook.setStrictMode === "function") {
                try {
                  injectedHook.setStrictMode(rendererID, newIsStrictMode);
                } catch (err) {
                  {
                    if (!hasLoggedError) {
                      hasLoggedError = true;
                      error("React instrumentation encountered an error: %s", err);
                    }
                  }
                }
              }
            }
          }
          function injectProfilingHooks(profilingHooks) {
            injectedProfilingHooks = profilingHooks;
          }
          function getLaneLabelMap() {
            {
              var map = /* @__PURE__ */ new Map();
              var lane = 1;
              for (var index2 = 0; index2 < TotalLanes; index2++) {
                var label = getLabelForLane(lane);
                map.set(lane, label);
                lane *= 2;
              }
              return map;
            }
          }
          function markCommitStarted(lanes) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markCommitStarted === "function") {
                injectedProfilingHooks.markCommitStarted(lanes);
              }
            }
          }
          function markCommitStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markCommitStopped === "function") {
                injectedProfilingHooks.markCommitStopped();
              }
            }
          }
          function markComponentRenderStarted(fiber) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentRenderStarted === "function") {
                injectedProfilingHooks.markComponentRenderStarted(fiber);
              }
            }
          }
          function markComponentRenderStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentRenderStopped === "function") {
                injectedProfilingHooks.markComponentRenderStopped();
              }
            }
          }
          function markComponentPassiveEffectMountStarted(fiber) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentPassiveEffectMountStarted === "function") {
                injectedProfilingHooks.markComponentPassiveEffectMountStarted(fiber);
              }
            }
          }
          function markComponentPassiveEffectMountStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentPassiveEffectMountStopped === "function") {
                injectedProfilingHooks.markComponentPassiveEffectMountStopped();
              }
            }
          }
          function markComponentPassiveEffectUnmountStarted(fiber) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentPassiveEffectUnmountStarted === "function") {
                injectedProfilingHooks.markComponentPassiveEffectUnmountStarted(fiber);
              }
            }
          }
          function markComponentPassiveEffectUnmountStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentPassiveEffectUnmountStopped === "function") {
                injectedProfilingHooks.markComponentPassiveEffectUnmountStopped();
              }
            }
          }
          function markComponentLayoutEffectMountStarted(fiber) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentLayoutEffectMountStarted === "function") {
                injectedProfilingHooks.markComponentLayoutEffectMountStarted(fiber);
              }
            }
          }
          function markComponentLayoutEffectMountStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentLayoutEffectMountStopped === "function") {
                injectedProfilingHooks.markComponentLayoutEffectMountStopped();
              }
            }
          }
          function markComponentLayoutEffectUnmountStarted(fiber) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentLayoutEffectUnmountStarted === "function") {
                injectedProfilingHooks.markComponentLayoutEffectUnmountStarted(fiber);
              }
            }
          }
          function markComponentLayoutEffectUnmountStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentLayoutEffectUnmountStopped === "function") {
                injectedProfilingHooks.markComponentLayoutEffectUnmountStopped();
              }
            }
          }
          function markComponentErrored(fiber, thrownValue, lanes) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentErrored === "function") {
                injectedProfilingHooks.markComponentErrored(fiber, thrownValue, lanes);
              }
            }
          }
          function markComponentSuspended(fiber, wakeable, lanes) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentSuspended === "function") {
                injectedProfilingHooks.markComponentSuspended(fiber, wakeable, lanes);
              }
            }
          }
          function markLayoutEffectsStarted(lanes) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markLayoutEffectsStarted === "function") {
                injectedProfilingHooks.markLayoutEffectsStarted(lanes);
              }
            }
          }
          function markLayoutEffectsStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markLayoutEffectsStopped === "function") {
                injectedProfilingHooks.markLayoutEffectsStopped();
              }
            }
          }
          function markPassiveEffectsStarted(lanes) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markPassiveEffectsStarted === "function") {
                injectedProfilingHooks.markPassiveEffectsStarted(lanes);
              }
            }
          }
          function markPassiveEffectsStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markPassiveEffectsStopped === "function") {
                injectedProfilingHooks.markPassiveEffectsStopped();
              }
            }
          }
          function markRenderStarted(lanes) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markRenderStarted === "function") {
                injectedProfilingHooks.markRenderStarted(lanes);
              }
            }
          }
          function markRenderYielded() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markRenderYielded === "function") {
                injectedProfilingHooks.markRenderYielded();
              }
            }
          }
          function markRenderStopped() {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markRenderStopped === "function") {
                injectedProfilingHooks.markRenderStopped();
              }
            }
          }
          function markRenderScheduled(lane) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markRenderScheduled === "function") {
                injectedProfilingHooks.markRenderScheduled(lane);
              }
            }
          }
          function markForceUpdateScheduled(fiber, lane) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markForceUpdateScheduled === "function") {
                injectedProfilingHooks.markForceUpdateScheduled(fiber, lane);
              }
            }
          }
          function markStateUpdateScheduled(fiber, lane) {
            {
              if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markStateUpdateScheduled === "function") {
                injectedProfilingHooks.markStateUpdateScheduled(fiber, lane);
              }
            }
          }
          function is(x, y) {
            return x === y && (x !== 0 || 1 / x === 1 / y) || x !== x && y !== y;
          }
          var objectIs = typeof Object.is === "function" ? Object.is : is;
          var syncQueue = null;
          var includesLegacySyncCallbacks = false;
          var isFlushingSyncQueue = false;
          function scheduleSyncCallback(callback) {
            if (syncQueue === null) {
              syncQueue = [callback];
            } else {
              syncQueue.push(callback);
            }
          }
          function scheduleLegacySyncCallback(callback) {
            includesLegacySyncCallbacks = true;
            scheduleSyncCallback(callback);
          }
          function flushSyncCallbacksOnlyInLegacyMode() {
            if (includesLegacySyncCallbacks) {
              flushSyncCallbacks();
            }
          }
          function flushSyncCallbacks() {
            if (!isFlushingSyncQueue && syncQueue !== null) {
              isFlushingSyncQueue = true;
              var i = 0;
              var previousUpdatePriority = getCurrentUpdatePriority();
              try {
                var isSync = true;
                var queue = syncQueue;
                setCurrentUpdatePriority(DiscreteEventPriority);
                for (; i < queue.length; i++) {
                  var callback = queue[i];
                  do {
                    callback = callback(isSync);
                  } while (callback !== null);
                }
                syncQueue = null;
                includesLegacySyncCallbacks = false;
              } catch (error2) {
                if (syncQueue !== null) {
                  syncQueue = syncQueue.slice(i + 1);
                }
                scheduleCallback(ImmediatePriority, flushSyncCallbacks);
                throw error2;
              } finally {
                setCurrentUpdatePriority(previousUpdatePriority);
                isFlushingSyncQueue = false;
              }
            }
            return null;
          }
          function isRootDehydrated(root) {
            var currentState = root.current.memoizedState;
            return currentState.isDehydrated;
          }
          var forkStack = [];
          var forkStackIndex = 0;
          var treeForkProvider = null;
          var treeForkCount = 0;
          var idStack = [];
          var idStackIndex = 0;
          var treeContextProvider = null;
          var treeContextId = 1;
          var treeContextOverflow = "";
          function isForkedChild(workInProgress2) {
            warnIfNotHydrating();
            return (workInProgress2.flags & Forked) !== NoFlags;
          }
          function getForksAtLevel(workInProgress2) {
            warnIfNotHydrating();
            return treeForkCount;
          }
          function getTreeId() {
            var overflow = treeContextOverflow;
            var idWithLeadingBit = treeContextId;
            var id = idWithLeadingBit & ~getLeadingBit(idWithLeadingBit);
            return id.toString(32) + overflow;
          }
          function pushTreeFork(workInProgress2, totalChildren) {
            warnIfNotHydrating();
            forkStack[forkStackIndex++] = treeForkCount;
            forkStack[forkStackIndex++] = treeForkProvider;
            treeForkProvider = workInProgress2;
            treeForkCount = totalChildren;
          }
          function pushTreeId(workInProgress2, totalChildren, index2) {
            warnIfNotHydrating();
            idStack[idStackIndex++] = treeContextId;
            idStack[idStackIndex++] = treeContextOverflow;
            idStack[idStackIndex++] = treeContextProvider;
            treeContextProvider = workInProgress2;
            var baseIdWithLeadingBit = treeContextId;
            var baseOverflow = treeContextOverflow;
            var baseLength = getBitLength(baseIdWithLeadingBit) - 1;
            var baseId = baseIdWithLeadingBit & ~(1 << baseLength);
            var slot = index2 + 1;
            var length = getBitLength(totalChildren) + baseLength;
            if (length > 30) {
              var numberOfOverflowBits = baseLength - baseLength % 5;
              var newOverflowBits = (1 << numberOfOverflowBits) - 1;
              var newOverflow = (baseId & newOverflowBits).toString(32);
              var restOfBaseId = baseId >> numberOfOverflowBits;
              var restOfBaseLength = baseLength - numberOfOverflowBits;
              var restOfLength = getBitLength(totalChildren) + restOfBaseLength;
              var restOfNewBits = slot << restOfBaseLength;
              var id = restOfNewBits | restOfBaseId;
              var overflow = newOverflow + baseOverflow;
              treeContextId = 1 << restOfLength | id;
              treeContextOverflow = overflow;
            } else {
              var newBits = slot << baseLength;
              var _id = newBits | baseId;
              var _overflow = baseOverflow;
              treeContextId = 1 << length | _id;
              treeContextOverflow = _overflow;
            }
          }
          function pushMaterializedTreeId(workInProgress2) {
            warnIfNotHydrating();
            var returnFiber = workInProgress2.return;
            if (returnFiber !== null) {
              var numberOfForks = 1;
              var slotIndex = 0;
              pushTreeFork(workInProgress2, numberOfForks);
              pushTreeId(workInProgress2, numberOfForks, slotIndex);
            }
          }
          function getBitLength(number) {
            return 32 - clz32(number);
          }
          function getLeadingBit(id) {
            return 1 << getBitLength(id) - 1;
          }
          function popTreeContext(workInProgress2) {
            while (workInProgress2 === treeForkProvider) {
              treeForkProvider = forkStack[--forkStackIndex];
              forkStack[forkStackIndex] = null;
              treeForkCount = forkStack[--forkStackIndex];
              forkStack[forkStackIndex] = null;
            }
            while (workInProgress2 === treeContextProvider) {
              treeContextProvider = idStack[--idStackIndex];
              idStack[idStackIndex] = null;
              treeContextOverflow = idStack[--idStackIndex];
              idStack[idStackIndex] = null;
              treeContextId = idStack[--idStackIndex];
              idStack[idStackIndex] = null;
            }
          }
          function getSuspendedTreeContext() {
            warnIfNotHydrating();
            if (treeContextProvider !== null) {
              return {
                id: treeContextId,
                overflow: treeContextOverflow
              };
            } else {
              return null;
            }
          }
          function restoreSuspendedTreeContext(workInProgress2, suspendedContext) {
            warnIfNotHydrating();
            idStack[idStackIndex++] = treeContextId;
            idStack[idStackIndex++] = treeContextOverflow;
            idStack[idStackIndex++] = treeContextProvider;
            treeContextId = suspendedContext.id;
            treeContextOverflow = suspendedContext.overflow;
            treeContextProvider = workInProgress2;
          }
          function warnIfNotHydrating() {
            {
              if (!getIsHydrating()) {
                error("Expected to be hydrating. This is a bug in React. Please file an issue.");
              }
            }
          }
          var hydrationParentFiber = null;
          var nextHydratableInstance = null;
          var isHydrating = false;
          var didSuspendOrErrorDEV = false;
          var hydrationErrors = null;
          function warnIfHydrating() {
            {
              if (isHydrating) {
                error("We should not be hydrating here. This is a bug in React. Please file a bug.");
              }
            }
          }
          function markDidThrowWhileHydratingDEV() {
            {
              didSuspendOrErrorDEV = true;
            }
          }
          function didSuspendOrErrorWhileHydratingDEV() {
            {
              return didSuspendOrErrorDEV;
            }
          }
          function enterHydrationState(fiber) {
            if (!supportsHydration) {
              return false;
            }
            var parentInstance = fiber.stateNode.containerInfo;
            nextHydratableInstance = getFirstHydratableChildWithinContainer(parentInstance);
            hydrationParentFiber = fiber;
            isHydrating = true;
            hydrationErrors = null;
            didSuspendOrErrorDEV = false;
            return true;
          }
          function reenterHydrationStateFromDehydratedSuspenseInstance(fiber, suspenseInstance, treeContext) {
            if (!supportsHydration) {
              return false;
            }
            nextHydratableInstance = getFirstHydratableChildWithinSuspenseInstance(suspenseInstance);
            hydrationParentFiber = fiber;
            isHydrating = true;
            hydrationErrors = null;
            didSuspendOrErrorDEV = false;
            if (treeContext !== null) {
              restoreSuspendedTreeContext(fiber, treeContext);
            }
            return true;
          }
          function warnUnhydratedInstance(returnFiber, instance) {
            {
              switch (returnFiber.tag) {
                case HostRoot: {
                  didNotHydrateInstanceWithinContainer(returnFiber.stateNode.containerInfo, instance);
                  break;
                }
                case HostComponent: {
                  var isConcurrentMode = (returnFiber.mode & ConcurrentMode) !== NoMode;
                  didNotHydrateInstance(
                    returnFiber.type,
                    returnFiber.memoizedProps,
                    returnFiber.stateNode,
                    instance,
                    // TODO: Delete this argument when we remove the legacy root API.
                    isConcurrentMode
                  );
                  break;
                }
                case SuspenseComponent: {
                  var suspenseState = returnFiber.memoizedState;
                  if (suspenseState.dehydrated !== null) didNotHydrateInstanceWithinSuspenseInstance(suspenseState.dehydrated, instance);
                  break;
                }
              }
            }
          }
          function deleteHydratableInstance(returnFiber, instance) {
            warnUnhydratedInstance(returnFiber, instance);
            var childToDelete = createFiberFromHostInstanceForDeletion();
            childToDelete.stateNode = instance;
            childToDelete.return = returnFiber;
            var deletions = returnFiber.deletions;
            if (deletions === null) {
              returnFiber.deletions = [childToDelete];
              returnFiber.flags |= ChildDeletion;
            } else {
              deletions.push(childToDelete);
            }
          }
          function warnNonhydratedInstance(returnFiber, fiber) {
            {
              if (didSuspendOrErrorDEV) {
                return;
              }
              switch (returnFiber.tag) {
                case HostRoot: {
                  var parentContainer = returnFiber.stateNode.containerInfo;
                  switch (fiber.tag) {
                    case HostComponent:
                      var type = fiber.type;
                      var props = fiber.pendingProps;
                      didNotFindHydratableInstanceWithinContainer(parentContainer, type, props);
                      break;
                    case HostText:
                      var text = fiber.pendingProps;
                      didNotFindHydratableTextInstanceWithinContainer(parentContainer, text);
                      break;
                    case SuspenseComponent:
                      didNotFindHydratableSuspenseInstanceWithinContainer(parentContainer);
                      break;
                  }
                  break;
                }
                case HostComponent: {
                  var parentType = returnFiber.type;
                  var parentProps = returnFiber.memoizedProps;
                  var parentInstance = returnFiber.stateNode;
                  switch (fiber.tag) {
                    case HostComponent: {
                      var _type = fiber.type;
                      var _props = fiber.pendingProps;
                      var isConcurrentMode = (returnFiber.mode & ConcurrentMode) !== NoMode;
                      didNotFindHydratableInstance(
                        parentType,
                        parentProps,
                        parentInstance,
                        _type,
                        _props,
                        // TODO: Delete this argument when we remove the legacy root API.
                        isConcurrentMode
                      );
                      break;
                    }
                    case HostText: {
                      var _text = fiber.pendingProps;
                      var _isConcurrentMode = (returnFiber.mode & ConcurrentMode) !== NoMode;
                      didNotFindHydratableTextInstance(
                        parentType,
                        parentProps,
                        parentInstance,
                        _text,
                        // TODO: Delete this argument when we remove the legacy root API.
                        _isConcurrentMode
                      );
                      break;
                    }
                    case SuspenseComponent: {
                      didNotFindHydratableSuspenseInstance(parentType, parentProps, parentInstance);
                      break;
                    }
                  }
                  break;
                }
                case SuspenseComponent: {
                  var suspenseState = returnFiber.memoizedState;
                  var _parentInstance = suspenseState.dehydrated;
                  if (_parentInstance !== null) switch (fiber.tag) {
                    case HostComponent:
                      var _type2 = fiber.type;
                      var _props2 = fiber.pendingProps;
                      didNotFindHydratableInstanceWithinSuspenseInstance(_parentInstance, _type2, _props2);
                      break;
                    case HostText:
                      var _text2 = fiber.pendingProps;
                      didNotFindHydratableTextInstanceWithinSuspenseInstance(_parentInstance, _text2);
                      break;
                    case SuspenseComponent:
                      didNotFindHydratableSuspenseInstanceWithinSuspenseInstance(_parentInstance);
                      break;
                  }
                  break;
                }
                default:
                  return;
              }
            }
          }
          function insertNonHydratedInstance(returnFiber, fiber) {
            fiber.flags = fiber.flags & ~Hydrating | Placement;
            warnNonhydratedInstance(returnFiber, fiber);
          }
          function tryHydrate(fiber, nextInstance) {
            switch (fiber.tag) {
              case HostComponent: {
                var type = fiber.type;
                var props = fiber.pendingProps;
                var instance = canHydrateInstance(nextInstance, type, props);
                if (instance !== null) {
                  fiber.stateNode = instance;
                  hydrationParentFiber = fiber;
                  nextHydratableInstance = getFirstHydratableChild(instance);
                  return true;
                }
                return false;
              }
              case HostText: {
                var text = fiber.pendingProps;
                var textInstance = canHydrateTextInstance(nextInstance, text);
                if (textInstance !== null) {
                  fiber.stateNode = textInstance;
                  hydrationParentFiber = fiber;
                  nextHydratableInstance = null;
                  return true;
                }
                return false;
              }
              case SuspenseComponent: {
                var suspenseInstance = canHydrateSuspenseInstance(nextInstance);
                if (suspenseInstance !== null) {
                  var suspenseState = {
                    dehydrated: suspenseInstance,
                    treeContext: getSuspendedTreeContext(),
                    retryLane: OffscreenLane
                  };
                  fiber.memoizedState = suspenseState;
                  var dehydratedFragment = createFiberFromDehydratedFragment(suspenseInstance);
                  dehydratedFragment.return = fiber;
                  fiber.child = dehydratedFragment;
                  hydrationParentFiber = fiber;
                  nextHydratableInstance = null;
                  return true;
                }
                return false;
              }
              default:
                return false;
            }
          }
          function shouldClientRenderOnMismatch(fiber) {
            return (fiber.mode & ConcurrentMode) !== NoMode && (fiber.flags & DidCapture) === NoFlags;
          }
          function throwOnHydrationMismatch(fiber) {
            throw new Error("Hydration failed because the initial UI does not match what was rendered on the server.");
          }
          function tryToClaimNextHydratableInstance(fiber) {
            if (!isHydrating) {
              return;
            }
            var nextInstance = nextHydratableInstance;
            if (!nextInstance) {
              if (shouldClientRenderOnMismatch(fiber)) {
                warnNonhydratedInstance(hydrationParentFiber, fiber);
                throwOnHydrationMismatch();
              }
              insertNonHydratedInstance(hydrationParentFiber, fiber);
              isHydrating = false;
              hydrationParentFiber = fiber;
              return;
            }
            var firstAttemptedInstance = nextInstance;
            if (!tryHydrate(fiber, nextInstance)) {
              if (shouldClientRenderOnMismatch(fiber)) {
                warnNonhydratedInstance(hydrationParentFiber, fiber);
                throwOnHydrationMismatch();
              }
              nextInstance = getNextHydratableSibling(firstAttemptedInstance);
              var prevHydrationParentFiber = hydrationParentFiber;
              if (!nextInstance || !tryHydrate(fiber, nextInstance)) {
                insertNonHydratedInstance(hydrationParentFiber, fiber);
                isHydrating = false;
                hydrationParentFiber = fiber;
                return;
              }
              deleteHydratableInstance(prevHydrationParentFiber, firstAttemptedInstance);
            }
          }
          function prepareToHydrateHostInstance(fiber, rootContainerInstance, hostContext) {
            if (!supportsHydration) {
              throw new Error("Expected prepareToHydrateHostInstance() to never be called. This error is likely caused by a bug in React. Please file an issue.");
            }
            var instance = fiber.stateNode;
            var shouldWarnIfMismatchDev = !didSuspendOrErrorDEV;
            var updatePayload = hydrateInstance(instance, fiber.type, fiber.memoizedProps, rootContainerInstance, hostContext, fiber, shouldWarnIfMismatchDev);
            fiber.updateQueue = updatePayload;
            if (updatePayload !== null) {
              return true;
            }
            return false;
          }
          function prepareToHydrateHostTextInstance(fiber) {
            if (!supportsHydration) {
              throw new Error("Expected prepareToHydrateHostTextInstance() to never be called. This error is likely caused by a bug in React. Please file an issue.");
            }
            var textInstance = fiber.stateNode;
            var textContent = fiber.memoizedProps;
            var shouldWarnIfMismatchDev = !didSuspendOrErrorDEV;
            var shouldUpdate = hydrateTextInstance(textInstance, textContent, fiber, shouldWarnIfMismatchDev);
            if (shouldUpdate) {
              var returnFiber = hydrationParentFiber;
              if (returnFiber !== null) {
                switch (returnFiber.tag) {
                  case HostRoot: {
                    var parentContainer = returnFiber.stateNode.containerInfo;
                    var isConcurrentMode = (returnFiber.mode & ConcurrentMode) !== NoMode;
                    didNotMatchHydratedContainerTextInstance(
                      parentContainer,
                      textInstance,
                      textContent,
                      // TODO: Delete this argument when we remove the legacy root API.
                      isConcurrentMode
                    );
                    break;
                  }
                  case HostComponent: {
                    var parentType = returnFiber.type;
                    var parentProps = returnFiber.memoizedProps;
                    var parentInstance = returnFiber.stateNode;
                    var _isConcurrentMode2 = (returnFiber.mode & ConcurrentMode) !== NoMode;
                    didNotMatchHydratedTextInstance(
                      parentType,
                      parentProps,
                      parentInstance,
                      textInstance,
                      textContent,
                      // TODO: Delete this argument when we remove the legacy root API.
                      _isConcurrentMode2
                    );
                    break;
                  }
                }
              }
            }
            return shouldUpdate;
          }
          function prepareToHydrateHostSuspenseInstance(fiber) {
            if (!supportsHydration) {
              throw new Error("Expected prepareToHydrateHostSuspenseInstance() to never be called. This error is likely caused by a bug in React. Please file an issue.");
            }
            var suspenseState = fiber.memoizedState;
            var suspenseInstance = suspenseState !== null ? suspenseState.dehydrated : null;
            if (!suspenseInstance) {
              throw new Error("Expected to have a hydrated suspense instance. This error is likely caused by a bug in React. Please file an issue.");
            }
            hydrateSuspenseInstance(suspenseInstance, fiber);
          }
          function skipPastDehydratedSuspenseInstance(fiber) {
            if (!supportsHydration) {
              throw new Error("Expected skipPastDehydratedSuspenseInstance() to never be called. This error is likely caused by a bug in React. Please file an issue.");
            }
            var suspenseState = fiber.memoizedState;
            var suspenseInstance = suspenseState !== null ? suspenseState.dehydrated : null;
            if (!suspenseInstance) {
              throw new Error("Expected to have a hydrated suspense instance. This error is likely caused by a bug in React. Please file an issue.");
            }
            return getNextHydratableInstanceAfterSuspenseInstance(suspenseInstance);
          }
          function popToNextHostParent(fiber) {
            var parent = fiber.return;
            while (parent !== null && parent.tag !== HostComponent && parent.tag !== HostRoot && parent.tag !== SuspenseComponent) {
              parent = parent.return;
            }
            hydrationParentFiber = parent;
          }
          function popHydrationState(fiber) {
            if (!supportsHydration) {
              return false;
            }
            if (fiber !== hydrationParentFiber) {
              return false;
            }
            if (!isHydrating) {
              popToNextHostParent(fiber);
              isHydrating = true;
              return false;
            }
            if (fiber.tag !== HostRoot && (fiber.tag !== HostComponent || shouldDeleteUnhydratedTailInstances(fiber.type) && !shouldSetTextContent(fiber.type, fiber.memoizedProps))) {
              var nextInstance = nextHydratableInstance;
              if (nextInstance) {
                if (shouldClientRenderOnMismatch(fiber)) {
                  warnIfUnhydratedTailNodes(fiber);
                  throwOnHydrationMismatch();
                } else {
                  while (nextInstance) {
                    deleteHydratableInstance(fiber, nextInstance);
                    nextInstance = getNextHydratableSibling(nextInstance);
                  }
                }
              }
            }
            popToNextHostParent(fiber);
            if (fiber.tag === SuspenseComponent) {
              nextHydratableInstance = skipPastDehydratedSuspenseInstance(fiber);
            } else {
              nextHydratableInstance = hydrationParentFiber ? getNextHydratableSibling(fiber.stateNode) : null;
            }
            return true;
          }
          function hasUnhydratedTailNodes() {
            return isHydrating && nextHydratableInstance !== null;
          }
          function warnIfUnhydratedTailNodes(fiber) {
            var nextInstance = nextHydratableInstance;
            while (nextInstance) {
              warnUnhydratedInstance(fiber, nextInstance);
              nextInstance = getNextHydratableSibling(nextInstance);
            }
          }
          function resetHydrationState() {
            if (!supportsHydration) {
              return;
            }
            hydrationParentFiber = null;
            nextHydratableInstance = null;
            isHydrating = false;
            didSuspendOrErrorDEV = false;
          }
          function upgradeHydrationErrorsToRecoverable() {
            if (hydrationErrors !== null) {
              queueRecoverableErrors(hydrationErrors);
              hydrationErrors = null;
            }
          }
          function getIsHydrating() {
            return isHydrating;
          }
          function queueHydrationError(error2) {
            if (hydrationErrors === null) {
              hydrationErrors = [error2];
            } else {
              hydrationErrors.push(error2);
            }
          }
          var ReactCurrentBatchConfig = ReactSharedInternals.ReactCurrentBatchConfig;
          var NoTransition = null;
          function requestCurrentTransition() {
            return ReactCurrentBatchConfig.transition;
          }
          function shallowEqual(objA, objB) {
            if (objectIs(objA, objB)) {
              return true;
            }
            if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
              return false;
            }
            var keysA = Object.keys(objA);
            var keysB = Object.keys(objB);
            if (keysA.length !== keysB.length) {
              return false;
            }
            for (var i = 0; i < keysA.length; i++) {
              var currentKey = keysA[i];
              if (!hasOwnProperty.call(objB, currentKey) || !objectIs(objA[currentKey], objB[currentKey])) {
                return false;
              }
            }
            return true;
          }
          function describeFiber(fiber) {
            var owner = fiber._debugOwner ? fiber._debugOwner.type : null;
            var source = fiber._debugSource;
            switch (fiber.tag) {
              case HostComponent:
                return describeBuiltInComponentFrame(fiber.type);
              case LazyComponent:
                return describeBuiltInComponentFrame("Lazy");
              case SuspenseComponent:
                return describeBuiltInComponentFrame("Suspense");
              case SuspenseListComponent:
                return describeBuiltInComponentFrame("SuspenseList");
              case FunctionComponent:
              case IndeterminateComponent:
              case SimpleMemoComponent:
                return describeFunctionComponentFrame(fiber.type);
              case ForwardRef:
                return describeFunctionComponentFrame(fiber.type.render);
              case ClassComponent:
                return describeClassComponentFrame(fiber.type);
              default:
                return "";
            }
          }
          function getStackByFiberInDevAndProd(workInProgress2) {
            try {
              var info = "";
              var node = workInProgress2;
              do {
                info += describeFiber(node);
                node = node.return;
              } while (node);
              return info;
            } catch (x) {
              return "\nError generating stack: " + x.message + "\n" + x.stack;
            }
          }
          var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
          var current = null;
          var isRendering = false;
          function getCurrentFiberOwnerNameInDevOrNull() {
            {
              if (current === null) {
                return null;
              }
              var owner = current._debugOwner;
              if (owner !== null && typeof owner !== "undefined") {
                return getComponentNameFromFiber(owner);
              }
            }
            return null;
          }
          function getCurrentFiberStackInDev() {
            {
              if (current === null) {
                return "";
              }
              return getStackByFiberInDevAndProd(current);
            }
          }
          function resetCurrentFiber() {
            {
              ReactDebugCurrentFrame$1.getCurrentStack = null;
              current = null;
              isRendering = false;
            }
          }
          function setCurrentFiber(fiber) {
            {
              ReactDebugCurrentFrame$1.getCurrentStack = fiber === null ? null : getCurrentFiberStackInDev;
              current = fiber;
              isRendering = false;
            }
          }
          function getCurrentFiber() {
            {
              return current;
            }
          }
          function setIsRendering(rendering) {
            {
              isRendering = rendering;
            }
          }
          var ReactStrictModeWarnings = {
            recordUnsafeLifecycleWarnings: function(fiber, instance) {
            },
            flushPendingUnsafeLifecycleWarnings: function() {
            },
            recordLegacyContextWarning: function(fiber, instance) {
            },
            flushLegacyContextWarning: function() {
            },
            discardPendingWarnings: function() {
            }
          };
          {
            var findStrictRoot = function(fiber) {
              var maybeStrictRoot = null;
              var node = fiber;
              while (node !== null) {
                if (node.mode & StrictLegacyMode) {
                  maybeStrictRoot = node;
                }
                node = node.return;
              }
              return maybeStrictRoot;
            };
            var setToSortedString = function(set2) {
              var array = [];
              set2.forEach(function(value) {
                array.push(value);
              });
              return array.sort().join(", ");
            };
            var pendingComponentWillMountWarnings = [];
            var pendingUNSAFE_ComponentWillMountWarnings = [];
            var pendingComponentWillReceivePropsWarnings = [];
            var pendingUNSAFE_ComponentWillReceivePropsWarnings = [];
            var pendingComponentWillUpdateWarnings = [];
            var pendingUNSAFE_ComponentWillUpdateWarnings = [];
            var didWarnAboutUnsafeLifecycles = /* @__PURE__ */ new Set();
            ReactStrictModeWarnings.recordUnsafeLifecycleWarnings = function(fiber, instance) {
              if (didWarnAboutUnsafeLifecycles.has(fiber.type)) {
                return;
              }
              if (typeof instance.componentWillMount === "function" && // Don't warn about react-lifecycles-compat polyfilled components.
              instance.componentWillMount.__suppressDeprecationWarning !== true) {
                pendingComponentWillMountWarnings.push(fiber);
              }
              if (fiber.mode & StrictLegacyMode && typeof instance.UNSAFE_componentWillMount === "function") {
                pendingUNSAFE_ComponentWillMountWarnings.push(fiber);
              }
              if (typeof instance.componentWillReceiveProps === "function" && instance.componentWillReceiveProps.__suppressDeprecationWarning !== true) {
                pendingComponentWillReceivePropsWarnings.push(fiber);
              }
              if (fiber.mode & StrictLegacyMode && typeof instance.UNSAFE_componentWillReceiveProps === "function") {
                pendingUNSAFE_ComponentWillReceivePropsWarnings.push(fiber);
              }
              if (typeof instance.componentWillUpdate === "function" && instance.componentWillUpdate.__suppressDeprecationWarning !== true) {
                pendingComponentWillUpdateWarnings.push(fiber);
              }
              if (fiber.mode & StrictLegacyMode && typeof instance.UNSAFE_componentWillUpdate === "function") {
                pendingUNSAFE_ComponentWillUpdateWarnings.push(fiber);
              }
            };
            ReactStrictModeWarnings.flushPendingUnsafeLifecycleWarnings = function() {
              var componentWillMountUniqueNames = /* @__PURE__ */ new Set();
              if (pendingComponentWillMountWarnings.length > 0) {
                pendingComponentWillMountWarnings.forEach(function(fiber) {
                  componentWillMountUniqueNames.add(getComponentNameFromFiber(fiber) || "Component");
                  didWarnAboutUnsafeLifecycles.add(fiber.type);
                });
                pendingComponentWillMountWarnings = [];
              }
              var UNSAFE_componentWillMountUniqueNames = /* @__PURE__ */ new Set();
              if (pendingUNSAFE_ComponentWillMountWarnings.length > 0) {
                pendingUNSAFE_ComponentWillMountWarnings.forEach(function(fiber) {
                  UNSAFE_componentWillMountUniqueNames.add(getComponentNameFromFiber(fiber) || "Component");
                  didWarnAboutUnsafeLifecycles.add(fiber.type);
                });
                pendingUNSAFE_ComponentWillMountWarnings = [];
              }
              var componentWillReceivePropsUniqueNames = /* @__PURE__ */ new Set();
              if (pendingComponentWillReceivePropsWarnings.length > 0) {
                pendingComponentWillReceivePropsWarnings.forEach(function(fiber) {
                  componentWillReceivePropsUniqueNames.add(getComponentNameFromFiber(fiber) || "Component");
                  didWarnAboutUnsafeLifecycles.add(fiber.type);
                });
                pendingComponentWillReceivePropsWarnings = [];
              }
              var UNSAFE_componentWillReceivePropsUniqueNames = /* @__PURE__ */ new Set();
              if (pendingUNSAFE_ComponentWillReceivePropsWarnings.length > 0) {
                pendingUNSAFE_ComponentWillReceivePropsWarnings.forEach(function(fiber) {
                  UNSAFE_componentWillReceivePropsUniqueNames.add(getComponentNameFromFiber(fiber) || "Component");
                  didWarnAboutUnsafeLifecycles.add(fiber.type);
                });
                pendingUNSAFE_ComponentWillReceivePropsWarnings = [];
              }
              var componentWillUpdateUniqueNames = /* @__PURE__ */ new Set();
              if (pendingComponentWillUpdateWarnings.length > 0) {
                pendingComponentWillUpdateWarnings.forEach(function(fiber) {
                  componentWillUpdateUniqueNames.add(getComponentNameFromFiber(fiber) || "Component");
                  didWarnAboutUnsafeLifecycles.add(fiber.type);
                });
                pendingComponentWillUpdateWarnings = [];
              }
              var UNSAFE_componentWillUpdateUniqueNames = /* @__PURE__ */ new Set();
              if (pendingUNSAFE_ComponentWillUpdateWarnings.length > 0) {
                pendingUNSAFE_ComponentWillUpdateWarnings.forEach(function(fiber) {
                  UNSAFE_componentWillUpdateUniqueNames.add(getComponentNameFromFiber(fiber) || "Component");
                  didWarnAboutUnsafeLifecycles.add(fiber.type);
                });
                pendingUNSAFE_ComponentWillUpdateWarnings = [];
              }
              if (UNSAFE_componentWillMountUniqueNames.size > 0) {
                var sortedNames = setToSortedString(UNSAFE_componentWillMountUniqueNames);
                error("Using UNSAFE_componentWillMount in strict mode is not recommended and may indicate bugs in your code. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move code with side effects to componentDidMount, and set initial state in the constructor.\n\nPlease update the following components: %s", sortedNames);
              }
              if (UNSAFE_componentWillReceivePropsUniqueNames.size > 0) {
                var _sortedNames = setToSortedString(UNSAFE_componentWillReceivePropsUniqueNames);
                error("Using UNSAFE_componentWillReceiveProps in strict mode is not recommended and may indicate bugs in your code. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move data fetching code or side effects to componentDidUpdate.\n* If you're updating state whenever props change, refactor your code to use memoization techniques or move it to static getDerivedStateFromProps. Learn more at: https://reactjs.org/link/derived-state\n\nPlease update the following components: %s", _sortedNames);
              }
              if (UNSAFE_componentWillUpdateUniqueNames.size > 0) {
                var _sortedNames2 = setToSortedString(UNSAFE_componentWillUpdateUniqueNames);
                error("Using UNSAFE_componentWillUpdate in strict mode is not recommended and may indicate bugs in your code. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move data fetching code or side effects to componentDidUpdate.\n\nPlease update the following components: %s", _sortedNames2);
              }
              if (componentWillMountUniqueNames.size > 0) {
                var _sortedNames3 = setToSortedString(componentWillMountUniqueNames);
                warn("componentWillMount has been renamed, and is not recommended for use. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move code with side effects to componentDidMount, and set initial state in the constructor.\n* Rename componentWillMount to UNSAFE_componentWillMount to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s", _sortedNames3);
              }
              if (componentWillReceivePropsUniqueNames.size > 0) {
                var _sortedNames4 = setToSortedString(componentWillReceivePropsUniqueNames);
                warn("componentWillReceiveProps has been renamed, and is not recommended for use. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move data fetching code or side effects to componentDidUpdate.\n* If you're updating state whenever props change, refactor your code to use memoization techniques or move it to static getDerivedStateFromProps. Learn more at: https://reactjs.org/link/derived-state\n* Rename componentWillReceiveProps to UNSAFE_componentWillReceiveProps to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s", _sortedNames4);
              }
              if (componentWillUpdateUniqueNames.size > 0) {
                var _sortedNames5 = setToSortedString(componentWillUpdateUniqueNames);
                warn("componentWillUpdate has been renamed, and is not recommended for use. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move data fetching code or side effects to componentDidUpdate.\n* Rename componentWillUpdate to UNSAFE_componentWillUpdate to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s", _sortedNames5);
              }
            };
            var pendingLegacyContextWarning = /* @__PURE__ */ new Map();
            var didWarnAboutLegacyContext = /* @__PURE__ */ new Set();
            ReactStrictModeWarnings.recordLegacyContextWarning = function(fiber, instance) {
              var strictRoot = findStrictRoot(fiber);
              if (strictRoot === null) {
                error("Expected to find a StrictMode component in a strict mode tree. This error is likely caused by a bug in React. Please file an issue.");
                return;
              }
              if (didWarnAboutLegacyContext.has(fiber.type)) {
                return;
              }
              var warningsForRoot = pendingLegacyContextWarning.get(strictRoot);
              if (fiber.type.contextTypes != null || fiber.type.childContextTypes != null || instance !== null && typeof instance.getChildContext === "function") {
                if (warningsForRoot === void 0) {
                  warningsForRoot = [];
                  pendingLegacyContextWarning.set(strictRoot, warningsForRoot);
                }
                warningsForRoot.push(fiber);
              }
            };
            ReactStrictModeWarnings.flushLegacyContextWarning = function() {
              pendingLegacyContextWarning.forEach(function(fiberArray, strictRoot) {
                if (fiberArray.length === 0) {
                  return;
                }
                var firstFiber = fiberArray[0];
                var uniqueNames = /* @__PURE__ */ new Set();
                fiberArray.forEach(function(fiber) {
                  uniqueNames.add(getComponentNameFromFiber(fiber) || "Component");
                  didWarnAboutLegacyContext.add(fiber.type);
                });
                var sortedNames = setToSortedString(uniqueNames);
                try {
                  setCurrentFiber(firstFiber);
                  error("Legacy context API has been detected within a strict-mode tree.\n\nThe old API will be supported in all 16.x releases, but applications using it should migrate to the new version.\n\nPlease update the following components: %s\n\nLearn more about this warning here: https://reactjs.org/link/legacy-context", sortedNames);
                } finally {
                  resetCurrentFiber();
                }
              });
            };
            ReactStrictModeWarnings.discardPendingWarnings = function() {
              pendingComponentWillMountWarnings = [];
              pendingUNSAFE_ComponentWillMountWarnings = [];
              pendingComponentWillReceivePropsWarnings = [];
              pendingUNSAFE_ComponentWillReceivePropsWarnings = [];
              pendingComponentWillUpdateWarnings = [];
              pendingUNSAFE_ComponentWillUpdateWarnings = [];
              pendingLegacyContextWarning = /* @__PURE__ */ new Map();
            };
          }
          function typeName(value) {
            {
              var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
              var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
              return type;
            }
          }
          function willCoercionThrow(value) {
            {
              try {
                testStringCoercion(value);
                return false;
              } catch (e) {
                return true;
              }
            }
          }
          function testStringCoercion(value) {
            return "" + value;
          }
          function checkKeyStringCoercion(value) {
            {
              if (willCoercionThrow(value)) {
                error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
                return testStringCoercion(value);
              }
            }
          }
          function checkPropStringCoercion(value, propName) {
            {
              if (willCoercionThrow(value)) {
                error("The provided `%s` prop is an unsupported type %s. This value must be coerced to a string before before using it here.", propName, typeName(value));
                return testStringCoercion(value);
              }
            }
          }
          var didWarnAboutMaps;
          var didWarnAboutGenerators;
          var didWarnAboutStringRefs;
          var ownerHasKeyUseWarning;
          var ownerHasFunctionTypeWarning;
          var warnForMissingKey = function(child, returnFiber) {
          };
          {
            didWarnAboutMaps = false;
            didWarnAboutGenerators = false;
            didWarnAboutStringRefs = {};
            ownerHasKeyUseWarning = {};
            ownerHasFunctionTypeWarning = {};
            warnForMissingKey = function(child, returnFiber) {
              if (child === null || typeof child !== "object") {
                return;
              }
              if (!child._store || child._store.validated || child.key != null) {
                return;
              }
              if (typeof child._store !== "object") {
                throw new Error("React Component in warnForMissingKey should have a _store. This error is likely caused by a bug in React. Please file an issue.");
              }
              child._store.validated = true;
              var componentName = getComponentNameFromFiber(returnFiber) || "Component";
              if (ownerHasKeyUseWarning[componentName]) {
                return;
              }
              ownerHasKeyUseWarning[componentName] = true;
              error('Each child in a list should have a unique "key" prop. See https://reactjs.org/link/warning-keys for more information.');
            };
          }
          function isReactClass(type) {
            return type.prototype && type.prototype.isReactComponent;
          }
          function coerceRef(returnFiber, current2, element) {
            var mixedRef = element.ref;
            if (mixedRef !== null && typeof mixedRef !== "function" && typeof mixedRef !== "object") {
              {
                if ((returnFiber.mode & StrictLegacyMode || warnAboutStringRefs) && // We warn in ReactElement.js if owner and self are equal for string refs
                // because these cannot be automatically converted to an arrow function
                // using a codemod. Therefore, we don't have to warn about string refs again.
                !(element._owner && element._self && element._owner.stateNode !== element._self) && // Will already throw with "Function components cannot have string refs"
                !(element._owner && element._owner.tag !== ClassComponent) && // Will already warn with "Function components cannot be given refs"
                !(typeof element.type === "function" && !isReactClass(element.type)) && // Will already throw with "Element ref was specified as a string (someStringRef) but no owner was set"
                element._owner) {
                  var componentName = getComponentNameFromFiber(returnFiber) || "Component";
                  if (!didWarnAboutStringRefs[componentName]) {
                    {
                      error('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. We recommend using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, mixedRef);
                    }
                    didWarnAboutStringRefs[componentName] = true;
                  }
                }
              }
              if (element._owner) {
                var owner = element._owner;
                var inst;
                if (owner) {
                  var ownerFiber = owner;
                  if (ownerFiber.tag !== ClassComponent) {
                    throw new Error("Function components cannot have string refs. We recommend using useRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref");
                  }
                  inst = ownerFiber.stateNode;
                }
                if (!inst) {
                  throw new Error("Missing owner for string ref " + mixedRef + ". This error is likely caused by a bug in React. Please file an issue.");
                }
                var resolvedInst = inst;
                {
                  checkPropStringCoercion(mixedRef, "ref");
                }
                var stringRef = "" + mixedRef;
                if (current2 !== null && current2.ref !== null && typeof current2.ref === "function" && current2.ref._stringRef === stringRef) {
                  return current2.ref;
                }
                var ref = function(value) {
                  var refs = resolvedInst.refs;
                  if (value === null) {
                    delete refs[stringRef];
                  } else {
                    refs[stringRef] = value;
                  }
                };
                ref._stringRef = stringRef;
                return ref;
              } else {
                if (typeof mixedRef !== "string") {
                  throw new Error("Expected ref to be a function, a string, an object returned by React.createRef(), or null.");
                }
                if (!element._owner) {
                  throw new Error("Element ref was specified as a string (" + mixedRef + ") but no owner was set. This could happen for one of the following reasons:\n1. You may be adding a ref to a function component\n2. You may be adding a ref to a component that was not created inside a component's render method\n3. You have multiple copies of React loaded\nSee https://reactjs.org/link/refs-must-have-owner for more information.");
                }
              }
            }
            return mixedRef;
          }
          function throwOnInvalidObjectType(returnFiber, newChild) {
            var childString = Object.prototype.toString.call(newChild);
            throw new Error("Objects are not valid as a React child (found: " + (childString === "[object Object]" ? "object with keys {" + Object.keys(newChild).join(", ") + "}" : childString) + "). If you meant to render a collection of children, use an array instead.");
          }
          function warnOnFunctionType(returnFiber) {
            {
              var componentName = getComponentNameFromFiber(returnFiber) || "Component";
              if (ownerHasFunctionTypeWarning[componentName]) {
                return;
              }
              ownerHasFunctionTypeWarning[componentName] = true;
              error("Functions are not valid as a React child. This may happen if you return a Component instead of <Component /> from render. Or maybe you meant to call this function rather than return it.");
            }
          }
          function resolveLazy(lazyType) {
            var payload = lazyType._payload;
            var init = lazyType._init;
            return init(payload);
          }
          function ChildReconciler(shouldTrackSideEffects) {
            function deleteChild(returnFiber, childToDelete) {
              if (!shouldTrackSideEffects) {
                return;
              }
              var deletions = returnFiber.deletions;
              if (deletions === null) {
                returnFiber.deletions = [childToDelete];
                returnFiber.flags |= ChildDeletion;
              } else {
                deletions.push(childToDelete);
              }
            }
            function deleteRemainingChildren(returnFiber, currentFirstChild) {
              if (!shouldTrackSideEffects) {
                return null;
              }
              var childToDelete = currentFirstChild;
              while (childToDelete !== null) {
                deleteChild(returnFiber, childToDelete);
                childToDelete = childToDelete.sibling;
              }
              return null;
            }
            function mapRemainingChildren(returnFiber, currentFirstChild) {
              var existingChildren = /* @__PURE__ */ new Map();
              var existingChild = currentFirstChild;
              while (existingChild !== null) {
                if (existingChild.key !== null) {
                  existingChildren.set(existingChild.key, existingChild);
                } else {
                  existingChildren.set(existingChild.index, existingChild);
                }
                existingChild = existingChild.sibling;
              }
              return existingChildren;
            }
            function useFiber(fiber, pendingProps) {
              var clone = createWorkInProgress(fiber, pendingProps);
              clone.index = 0;
              clone.sibling = null;
              return clone;
            }
            function placeChild(newFiber, lastPlacedIndex, newIndex) {
              newFiber.index = newIndex;
              if (!shouldTrackSideEffects) {
                newFiber.flags |= Forked;
                return lastPlacedIndex;
              }
              var current2 = newFiber.alternate;
              if (current2 !== null) {
                var oldIndex = current2.index;
                if (oldIndex < lastPlacedIndex) {
                  newFiber.flags |= Placement;
                  return lastPlacedIndex;
                } else {
                  return oldIndex;
                }
              } else {
                newFiber.flags |= Placement;
                return lastPlacedIndex;
              }
            }
            function placeSingleChild(newFiber) {
              if (shouldTrackSideEffects && newFiber.alternate === null) {
                newFiber.flags |= Placement;
              }
              return newFiber;
            }
            function updateTextNode(returnFiber, current2, textContent, lanes) {
              if (current2 === null || current2.tag !== HostText) {
                var created = createFiberFromText(textContent, returnFiber.mode, lanes);
                created.return = returnFiber;
                return created;
              } else {
                var existing = useFiber(current2, textContent);
                existing.return = returnFiber;
                return existing;
              }
            }
            function updateElement(returnFiber, current2, element, lanes) {
              var elementType = element.type;
              if (elementType === REACT_FRAGMENT_TYPE) {
                return updateFragment2(returnFiber, current2, element.props.children, lanes, element.key);
              }
              if (current2 !== null) {
                if (current2.elementType === elementType || // Keep this check inline so it only runs on the false path:
                isCompatibleFamilyForHotReloading(current2, element) || // Lazy types should reconcile their resolved type.
                // We need to do this after the Hot Reloading check above,
                // because hot reloading has different semantics than prod because
                // it doesn't resuspend. So we can't let the call below suspend.
                typeof elementType === "object" && elementType !== null && elementType.$$typeof === REACT_LAZY_TYPE && resolveLazy(elementType) === current2.type) {
                  var existing = useFiber(current2, element.props);
                  existing.ref = coerceRef(returnFiber, current2, element);
                  existing.return = returnFiber;
                  {
                    existing._debugSource = element._source;
                    existing._debugOwner = element._owner;
                  }
                  return existing;
                }
              }
              var created = createFiberFromElement(element, returnFiber.mode, lanes);
              created.ref = coerceRef(returnFiber, current2, element);
              created.return = returnFiber;
              return created;
            }
            function updatePortal(returnFiber, current2, portal, lanes) {
              if (current2 === null || current2.tag !== HostPortal || current2.stateNode.containerInfo !== portal.containerInfo || current2.stateNode.implementation !== portal.implementation) {
                var created = createFiberFromPortal(portal, returnFiber.mode, lanes);
                created.return = returnFiber;
                return created;
              } else {
                var existing = useFiber(current2, portal.children || []);
                existing.return = returnFiber;
                return existing;
              }
            }
            function updateFragment2(returnFiber, current2, fragment, lanes, key) {
              if (current2 === null || current2.tag !== Fragment2) {
                var created = createFiberFromFragment(fragment, returnFiber.mode, lanes, key);
                created.return = returnFiber;
                return created;
              } else {
                var existing = useFiber(current2, fragment);
                existing.return = returnFiber;
                return existing;
              }
            }
            function createChild(returnFiber, newChild, lanes) {
              if (typeof newChild === "string" && newChild !== "" || typeof newChild === "number") {
                var created = createFiberFromText("" + newChild, returnFiber.mode, lanes);
                created.return = returnFiber;
                return created;
              }
              if (typeof newChild === "object" && newChild !== null) {
                switch (newChild.$$typeof) {
                  case REACT_ELEMENT_TYPE: {
                    var _created = createFiberFromElement(newChild, returnFiber.mode, lanes);
                    _created.ref = coerceRef(returnFiber, null, newChild);
                    _created.return = returnFiber;
                    return _created;
                  }
                  case REACT_PORTAL_TYPE: {
                    var _created2 = createFiberFromPortal(newChild, returnFiber.mode, lanes);
                    _created2.return = returnFiber;
                    return _created2;
                  }
                  case REACT_LAZY_TYPE: {
                    var payload = newChild._payload;
                    var init = newChild._init;
                    return createChild(returnFiber, init(payload), lanes);
                  }
                }
                if (isArray(newChild) || getIteratorFn(newChild)) {
                  var _created3 = createFiberFromFragment(newChild, returnFiber.mode, lanes, null);
                  _created3.return = returnFiber;
                  return _created3;
                }
                throwOnInvalidObjectType(returnFiber, newChild);
              }
              {
                if (typeof newChild === "function") {
                  warnOnFunctionType(returnFiber);
                }
              }
              return null;
            }
            function updateSlot(returnFiber, oldFiber, newChild, lanes) {
              var key = oldFiber !== null ? oldFiber.key : null;
              if (typeof newChild === "string" && newChild !== "" || typeof newChild === "number") {
                if (key !== null) {
                  return null;
                }
                return updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
              }
              if (typeof newChild === "object" && newChild !== null) {
                switch (newChild.$$typeof) {
                  case REACT_ELEMENT_TYPE: {
                    if (newChild.key === key) {
                      return updateElement(returnFiber, oldFiber, newChild, lanes);
                    } else {
                      return null;
                    }
                  }
                  case REACT_PORTAL_TYPE: {
                    if (newChild.key === key) {
                      return updatePortal(returnFiber, oldFiber, newChild, lanes);
                    } else {
                      return null;
                    }
                  }
                  case REACT_LAZY_TYPE: {
                    var payload = newChild._payload;
                    var init = newChild._init;
                    return updateSlot(returnFiber, oldFiber, init(payload), lanes);
                  }
                }
                if (isArray(newChild) || getIteratorFn(newChild)) {
                  if (key !== null) {
                    return null;
                  }
                  return updateFragment2(returnFiber, oldFiber, newChild, lanes, null);
                }
                throwOnInvalidObjectType(returnFiber, newChild);
              }
              {
                if (typeof newChild === "function") {
                  warnOnFunctionType(returnFiber);
                }
              }
              return null;
            }
            function updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes) {
              if (typeof newChild === "string" && newChild !== "" || typeof newChild === "number") {
                var matchedFiber = existingChildren.get(newIdx) || null;
                return updateTextNode(returnFiber, matchedFiber, "" + newChild, lanes);
              }
              if (typeof newChild === "object" && newChild !== null) {
                switch (newChild.$$typeof) {
                  case REACT_ELEMENT_TYPE: {
                    var _matchedFiber = existingChildren.get(newChild.key === null ? newIdx : newChild.key) || null;
                    return updateElement(returnFiber, _matchedFiber, newChild, lanes);
                  }
                  case REACT_PORTAL_TYPE: {
                    var _matchedFiber2 = existingChildren.get(newChild.key === null ? newIdx : newChild.key) || null;
                    return updatePortal(returnFiber, _matchedFiber2, newChild, lanes);
                  }
                  case REACT_LAZY_TYPE:
                    var payload = newChild._payload;
                    var init = newChild._init;
                    return updateFromMap(existingChildren, returnFiber, newIdx, init(payload), lanes);
                }
                if (isArray(newChild) || getIteratorFn(newChild)) {
                  var _matchedFiber3 = existingChildren.get(newIdx) || null;
                  return updateFragment2(returnFiber, _matchedFiber3, newChild, lanes, null);
                }
                throwOnInvalidObjectType(returnFiber, newChild);
              }
              {
                if (typeof newChild === "function") {
                  warnOnFunctionType(returnFiber);
                }
              }
              return null;
            }
            function warnOnInvalidKey(child, knownKeys, returnFiber) {
              {
                if (typeof child !== "object" || child === null) {
                  return knownKeys;
                }
                switch (child.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    warnForMissingKey(child, returnFiber);
                    var key = child.key;
                    if (typeof key !== "string") {
                      break;
                    }
                    if (knownKeys === null) {
                      knownKeys = /* @__PURE__ */ new Set();
                      knownKeys.add(key);
                      break;
                    }
                    if (!knownKeys.has(key)) {
                      knownKeys.add(key);
                      break;
                    }
                    error("Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted \u2014 the behavior is unsupported and could change in a future version.", key);
                    break;
                  case REACT_LAZY_TYPE:
                    var payload = child._payload;
                    var init = child._init;
                    warnOnInvalidKey(init(payload), knownKeys, returnFiber);
                    break;
                }
              }
              return knownKeys;
            }
            function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
              {
                var knownKeys = null;
                for (var i = 0; i < newChildren.length; i++) {
                  var child = newChildren[i];
                  knownKeys = warnOnInvalidKey(child, knownKeys, returnFiber);
                }
              }
              var resultingFirstChild = null;
              var previousNewFiber = null;
              var oldFiber = currentFirstChild;
              var lastPlacedIndex = 0;
              var newIdx = 0;
              var nextOldFiber = null;
              for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
                if (oldFiber.index > newIdx) {
                  nextOldFiber = oldFiber;
                  oldFiber = null;
                } else {
                  nextOldFiber = oldFiber.sibling;
                }
                var newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);
                if (newFiber === null) {
                  if (oldFiber === null) {
                    oldFiber = nextOldFiber;
                  }
                  break;
                }
                if (shouldTrackSideEffects) {
                  if (oldFiber && newFiber.alternate === null) {
                    deleteChild(returnFiber, oldFiber);
                  }
                }
                lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
                if (previousNewFiber === null) {
                  resultingFirstChild = newFiber;
                } else {
                  previousNewFiber.sibling = newFiber;
                }
                previousNewFiber = newFiber;
                oldFiber = nextOldFiber;
              }
              if (newIdx === newChildren.length) {
                deleteRemainingChildren(returnFiber, oldFiber);
                if (getIsHydrating()) {
                  var numberOfForks = newIdx;
                  pushTreeFork(returnFiber, numberOfForks);
                }
                return resultingFirstChild;
              }
              if (oldFiber === null) {
                for (; newIdx < newChildren.length; newIdx++) {
                  var _newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
                  if (_newFiber === null) {
                    continue;
                  }
                  lastPlacedIndex = placeChild(_newFiber, lastPlacedIndex, newIdx);
                  if (previousNewFiber === null) {
                    resultingFirstChild = _newFiber;
                  } else {
                    previousNewFiber.sibling = _newFiber;
                  }
                  previousNewFiber = _newFiber;
                }
                if (getIsHydrating()) {
                  var _numberOfForks = newIdx;
                  pushTreeFork(returnFiber, _numberOfForks);
                }
                return resultingFirstChild;
              }
              var existingChildren = mapRemainingChildren(returnFiber, oldFiber);
              for (; newIdx < newChildren.length; newIdx++) {
                var _newFiber2 = updateFromMap(existingChildren, returnFiber, newIdx, newChildren[newIdx], lanes);
                if (_newFiber2 !== null) {
                  if (shouldTrackSideEffects) {
                    if (_newFiber2.alternate !== null) {
                      existingChildren.delete(_newFiber2.key === null ? newIdx : _newFiber2.key);
                    }
                  }
                  lastPlacedIndex = placeChild(_newFiber2, lastPlacedIndex, newIdx);
                  if (previousNewFiber === null) {
                    resultingFirstChild = _newFiber2;
                  } else {
                    previousNewFiber.sibling = _newFiber2;
                  }
                  previousNewFiber = _newFiber2;
                }
              }
              if (shouldTrackSideEffects) {
                existingChildren.forEach(function(child2) {
                  return deleteChild(returnFiber, child2);
                });
              }
              if (getIsHydrating()) {
                var _numberOfForks2 = newIdx;
                pushTreeFork(returnFiber, _numberOfForks2);
              }
              return resultingFirstChild;
            }
            function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildrenIterable, lanes) {
              var iteratorFn = getIteratorFn(newChildrenIterable);
              if (typeof iteratorFn !== "function") {
                throw new Error("An object is not an iterable. This error is likely caused by a bug in React. Please file an issue.");
              }
              {
                if (typeof Symbol === "function" && // $FlowFixMe Flow doesn't know about toStringTag
                newChildrenIterable[Symbol.toStringTag] === "Generator") {
                  if (!didWarnAboutGenerators) {
                    error("Using Generators as children is unsupported and will likely yield unexpected results because enumerating a generator mutates it. You may convert it to an array with `Array.from()` or the `[...spread]` operator before rendering. Keep in mind you might need to polyfill these features for older browsers.");
                  }
                  didWarnAboutGenerators = true;
                }
                if (newChildrenIterable.entries === iteratorFn) {
                  if (!didWarnAboutMaps) {
                    error("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                  }
                  didWarnAboutMaps = true;
                }
                var _newChildren = iteratorFn.call(newChildrenIterable);
                if (_newChildren) {
                  var knownKeys = null;
                  var _step = _newChildren.next();
                  for (; !_step.done; _step = _newChildren.next()) {
                    var child = _step.value;
                    knownKeys = warnOnInvalidKey(child, knownKeys, returnFiber);
                  }
                }
              }
              var newChildren = iteratorFn.call(newChildrenIterable);
              if (newChildren == null) {
                throw new Error("An iterable object provided no iterator.");
              }
              var resultingFirstChild = null;
              var previousNewFiber = null;
              var oldFiber = currentFirstChild;
              var lastPlacedIndex = 0;
              var newIdx = 0;
              var nextOldFiber = null;
              var step = newChildren.next();
              for (; oldFiber !== null && !step.done; newIdx++, step = newChildren.next()) {
                if (oldFiber.index > newIdx) {
                  nextOldFiber = oldFiber;
                  oldFiber = null;
                } else {
                  nextOldFiber = oldFiber.sibling;
                }
                var newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes);
                if (newFiber === null) {
                  if (oldFiber === null) {
                    oldFiber = nextOldFiber;
                  }
                  break;
                }
                if (shouldTrackSideEffects) {
                  if (oldFiber && newFiber.alternate === null) {
                    deleteChild(returnFiber, oldFiber);
                  }
                }
                lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
                if (previousNewFiber === null) {
                  resultingFirstChild = newFiber;
                } else {
                  previousNewFiber.sibling = newFiber;
                }
                previousNewFiber = newFiber;
                oldFiber = nextOldFiber;
              }
              if (step.done) {
                deleteRemainingChildren(returnFiber, oldFiber);
                if (getIsHydrating()) {
                  var numberOfForks = newIdx;
                  pushTreeFork(returnFiber, numberOfForks);
                }
                return resultingFirstChild;
              }
              if (oldFiber === null) {
                for (; !step.done; newIdx++, step = newChildren.next()) {
                  var _newFiber3 = createChild(returnFiber, step.value, lanes);
                  if (_newFiber3 === null) {
                    continue;
                  }
                  lastPlacedIndex = placeChild(_newFiber3, lastPlacedIndex, newIdx);
                  if (previousNewFiber === null) {
                    resultingFirstChild = _newFiber3;
                  } else {
                    previousNewFiber.sibling = _newFiber3;
                  }
                  previousNewFiber = _newFiber3;
                }
                if (getIsHydrating()) {
                  var _numberOfForks3 = newIdx;
                  pushTreeFork(returnFiber, _numberOfForks3);
                }
                return resultingFirstChild;
              }
              var existingChildren = mapRemainingChildren(returnFiber, oldFiber);
              for (; !step.done; newIdx++, step = newChildren.next()) {
                var _newFiber4 = updateFromMap(existingChildren, returnFiber, newIdx, step.value, lanes);
                if (_newFiber4 !== null) {
                  if (shouldTrackSideEffects) {
                    if (_newFiber4.alternate !== null) {
                      existingChildren.delete(_newFiber4.key === null ? newIdx : _newFiber4.key);
                    }
                  }
                  lastPlacedIndex = placeChild(_newFiber4, lastPlacedIndex, newIdx);
                  if (previousNewFiber === null) {
                    resultingFirstChild = _newFiber4;
                  } else {
                    previousNewFiber.sibling = _newFiber4;
                  }
                  previousNewFiber = _newFiber4;
                }
              }
              if (shouldTrackSideEffects) {
                existingChildren.forEach(function(child2) {
                  return deleteChild(returnFiber, child2);
                });
              }
              if (getIsHydrating()) {
                var _numberOfForks4 = newIdx;
                pushTreeFork(returnFiber, _numberOfForks4);
              }
              return resultingFirstChild;
            }
            function reconcileSingleTextNode(returnFiber, currentFirstChild, textContent, lanes) {
              if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
                deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
                var existing = useFiber(currentFirstChild, textContent);
                existing.return = returnFiber;
                return existing;
              }
              deleteRemainingChildren(returnFiber, currentFirstChild);
              var created = createFiberFromText(textContent, returnFiber.mode, lanes);
              created.return = returnFiber;
              return created;
            }
            function reconcileSingleElement(returnFiber, currentFirstChild, element, lanes) {
              var key = element.key;
              var child = currentFirstChild;
              while (child !== null) {
                if (child.key === key) {
                  var elementType = element.type;
                  if (elementType === REACT_FRAGMENT_TYPE) {
                    if (child.tag === Fragment2) {
                      deleteRemainingChildren(returnFiber, child.sibling);
                      var existing = useFiber(child, element.props.children);
                      existing.return = returnFiber;
                      {
                        existing._debugSource = element._source;
                        existing._debugOwner = element._owner;
                      }
                      return existing;
                    }
                  } else {
                    if (child.elementType === elementType || // Keep this check inline so it only runs on the false path:
                    isCompatibleFamilyForHotReloading(child, element) || // Lazy types should reconcile their resolved type.
                    // We need to do this after the Hot Reloading check above,
                    // because hot reloading has different semantics than prod because
                    // it doesn't resuspend. So we can't let the call below suspend.
                    typeof elementType === "object" && elementType !== null && elementType.$$typeof === REACT_LAZY_TYPE && resolveLazy(elementType) === child.type) {
                      deleteRemainingChildren(returnFiber, child.sibling);
                      var _existing = useFiber(child, element.props);
                      _existing.ref = coerceRef(returnFiber, child, element);
                      _existing.return = returnFiber;
                      {
                        _existing._debugSource = element._source;
                        _existing._debugOwner = element._owner;
                      }
                      return _existing;
                    }
                  }
                  deleteRemainingChildren(returnFiber, child);
                  break;
                } else {
                  deleteChild(returnFiber, child);
                }
                child = child.sibling;
              }
              if (element.type === REACT_FRAGMENT_TYPE) {
                var created = createFiberFromFragment(element.props.children, returnFiber.mode, lanes, element.key);
                created.return = returnFiber;
                return created;
              } else {
                var _created4 = createFiberFromElement(element, returnFiber.mode, lanes);
                _created4.ref = coerceRef(returnFiber, currentFirstChild, element);
                _created4.return = returnFiber;
                return _created4;
              }
            }
            function reconcileSinglePortal(returnFiber, currentFirstChild, portal, lanes) {
              var key = portal.key;
              var child = currentFirstChild;
              while (child !== null) {
                if (child.key === key) {
                  if (child.tag === HostPortal && child.stateNode.containerInfo === portal.containerInfo && child.stateNode.implementation === portal.implementation) {
                    deleteRemainingChildren(returnFiber, child.sibling);
                    var existing = useFiber(child, portal.children || []);
                    existing.return = returnFiber;
                    return existing;
                  } else {
                    deleteRemainingChildren(returnFiber, child);
                    break;
                  }
                } else {
                  deleteChild(returnFiber, child);
                }
                child = child.sibling;
              }
              var created = createFiberFromPortal(portal, returnFiber.mode, lanes);
              created.return = returnFiber;
              return created;
            }
            function reconcileChildFibers2(returnFiber, currentFirstChild, newChild, lanes) {
              var isUnkeyedTopLevelFragment = typeof newChild === "object" && newChild !== null && newChild.type === REACT_FRAGMENT_TYPE && newChild.key === null;
              if (isUnkeyedTopLevelFragment) {
                newChild = newChild.props.children;
              }
              if (typeof newChild === "object" && newChild !== null) {
                switch (newChild.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                    return placeSingleChild(reconcileSingleElement(returnFiber, currentFirstChild, newChild, lanes));
                  case REACT_PORTAL_TYPE:
                    return placeSingleChild(reconcileSinglePortal(returnFiber, currentFirstChild, newChild, lanes));
                  case REACT_LAZY_TYPE:
                    var payload = newChild._payload;
                    var init = newChild._init;
                    return reconcileChildFibers2(returnFiber, currentFirstChild, init(payload), lanes);
                }
                if (isArray(newChild)) {
                  return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
                }
                if (getIteratorFn(newChild)) {
                  return reconcileChildrenIterator(returnFiber, currentFirstChild, newChild, lanes);
                }
                throwOnInvalidObjectType(returnFiber, newChild);
              }
              if (typeof newChild === "string" && newChild !== "" || typeof newChild === "number") {
                return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFirstChild, "" + newChild, lanes));
              }
              {
                if (typeof newChild === "function") {
                  warnOnFunctionType(returnFiber);
                }
              }
              return deleteRemainingChildren(returnFiber, currentFirstChild);
            }
            return reconcileChildFibers2;
          }
          var reconcileChildFibers = ChildReconciler(true);
          var mountChildFibers = ChildReconciler(false);
          function cloneChildFibers(current2, workInProgress2) {
            if (current2 !== null && workInProgress2.child !== current2.child) {
              throw new Error("Resuming work not yet implemented.");
            }
            if (workInProgress2.child === null) {
              return;
            }
            var currentChild = workInProgress2.child;
            var newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
            workInProgress2.child = newChild;
            newChild.return = workInProgress2;
            while (currentChild.sibling !== null) {
              currentChild = currentChild.sibling;
              newChild = newChild.sibling = createWorkInProgress(currentChild, currentChild.pendingProps);
              newChild.return = workInProgress2;
            }
            newChild.sibling = null;
          }
          function resetChildFibers(workInProgress2, lanes) {
            var child = workInProgress2.child;
            while (child !== null) {
              resetWorkInProgress(child, lanes);
              child = child.sibling;
            }
          }
          var valueCursor = createCursor(null);
          var rendererSigil;
          {
            rendererSigil = {};
          }
          var currentlyRenderingFiber = null;
          var lastContextDependency = null;
          var lastFullyObservedContext = null;
          var isDisallowedContextReadInDEV = false;
          function resetContextDependencies() {
            currentlyRenderingFiber = null;
            lastContextDependency = null;
            lastFullyObservedContext = null;
            {
              isDisallowedContextReadInDEV = false;
            }
          }
          function enterDisallowedContextReadInDEV() {
            {
              isDisallowedContextReadInDEV = true;
            }
          }
          function exitDisallowedContextReadInDEV() {
            {
              isDisallowedContextReadInDEV = false;
            }
          }
          function pushProvider(providerFiber, context, nextValue) {
            if (isPrimaryRenderer) {
              push(valueCursor, context._currentValue, providerFiber);
              context._currentValue = nextValue;
              {
                if (context._currentRenderer !== void 0 && context._currentRenderer !== null && context._currentRenderer !== rendererSigil) {
                  error("Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported.");
                }
                context._currentRenderer = rendererSigil;
              }
            } else {
              push(valueCursor, context._currentValue2, providerFiber);
              context._currentValue2 = nextValue;
              {
                if (context._currentRenderer2 !== void 0 && context._currentRenderer2 !== null && context._currentRenderer2 !== rendererSigil) {
                  error("Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported.");
                }
                context._currentRenderer2 = rendererSigil;
              }
            }
          }
          function popProvider(context, providerFiber) {
            var currentValue = valueCursor.current;
            pop(valueCursor, providerFiber);
            if (isPrimaryRenderer) {
              {
                context._currentValue = currentValue;
              }
            } else {
              {
                context._currentValue2 = currentValue;
              }
            }
          }
          function scheduleContextWorkOnParentPath(parent, renderLanes2, propagationRoot) {
            var node = parent;
            while (node !== null) {
              var alternate = node.alternate;
              if (!isSubsetOfLanes(node.childLanes, renderLanes2)) {
                node.childLanes = mergeLanes(node.childLanes, renderLanes2);
                if (alternate !== null) {
                  alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes2);
                }
              } else if (alternate !== null && !isSubsetOfLanes(alternate.childLanes, renderLanes2)) {
                alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes2);
              }
              if (node === propagationRoot) {
                break;
              }
              node = node.return;
            }
            {
              if (node !== propagationRoot) {
                error("Expected to find the propagation root when scheduling context work. This error is likely caused by a bug in React. Please file an issue.");
              }
            }
          }
          function propagateContextChange(workInProgress2, context, renderLanes2) {
            {
              propagateContextChange_eager(workInProgress2, context, renderLanes2);
            }
          }
          function propagateContextChange_eager(workInProgress2, context, renderLanes2) {
            var fiber = workInProgress2.child;
            if (fiber !== null) {
              fiber.return = workInProgress2;
            }
            while (fiber !== null) {
              var nextFiber = void 0;
              var list = fiber.dependencies;
              if (list !== null) {
                nextFiber = fiber.child;
                var dependency = list.firstContext;
                while (dependency !== null) {
                  if (dependency.context === context) {
                    if (fiber.tag === ClassComponent) {
                      var lane = pickArbitraryLane(renderLanes2);
                      var update = createUpdate(NoTimestamp, lane);
                      update.tag = ForceUpdate;
                      var updateQueue = fiber.updateQueue;
                      if (updateQueue === null) ;
                      else {
                        var sharedQueue = updateQueue.shared;
                        var pending = sharedQueue.pending;
                        if (pending === null) {
                          update.next = update;
                        } else {
                          update.next = pending.next;
                          pending.next = update;
                        }
                        sharedQueue.pending = update;
                      }
                    }
                    fiber.lanes = mergeLanes(fiber.lanes, renderLanes2);
                    var alternate = fiber.alternate;
                    if (alternate !== null) {
                      alternate.lanes = mergeLanes(alternate.lanes, renderLanes2);
                    }
                    scheduleContextWorkOnParentPath(fiber.return, renderLanes2, workInProgress2);
                    list.lanes = mergeLanes(list.lanes, renderLanes2);
                    break;
                  }
                  dependency = dependency.next;
                }
              } else if (fiber.tag === ContextProvider) {
                nextFiber = fiber.type === workInProgress2.type ? null : fiber.child;
              } else if (fiber.tag === DehydratedFragment) {
                var parentSuspense = fiber.return;
                if (parentSuspense === null) {
                  throw new Error("We just came from a parent so we must have had a parent. This is a bug in React.");
                }
                parentSuspense.lanes = mergeLanes(parentSuspense.lanes, renderLanes2);
                var _alternate = parentSuspense.alternate;
                if (_alternate !== null) {
                  _alternate.lanes = mergeLanes(_alternate.lanes, renderLanes2);
                }
                scheduleContextWorkOnParentPath(parentSuspense, renderLanes2, workInProgress2);
                nextFiber = fiber.sibling;
              } else {
                nextFiber = fiber.child;
              }
              if (nextFiber !== null) {
                nextFiber.return = fiber;
              } else {
                nextFiber = fiber;
                while (nextFiber !== null) {
                  if (nextFiber === workInProgress2) {
                    nextFiber = null;
                    break;
                  }
                  var sibling = nextFiber.sibling;
                  if (sibling !== null) {
                    sibling.return = nextFiber.return;
                    nextFiber = sibling;
                    break;
                  }
                  nextFiber = nextFiber.return;
                }
              }
              fiber = nextFiber;
            }
          }
          function prepareToReadContext(workInProgress2, renderLanes2) {
            currentlyRenderingFiber = workInProgress2;
            lastContextDependency = null;
            lastFullyObservedContext = null;
            var dependencies = workInProgress2.dependencies;
            if (dependencies !== null) {
              {
                var firstContext = dependencies.firstContext;
                if (firstContext !== null) {
                  if (includesSomeLane(dependencies.lanes, renderLanes2)) {
                    markWorkInProgressReceivedUpdate();
                  }
                  dependencies.firstContext = null;
                }
              }
            }
          }
          function readContext(context) {
            {
              if (isDisallowedContextReadInDEV) {
                error("Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo().");
              }
            }
            var value = isPrimaryRenderer ? context._currentValue : context._currentValue2;
            if (lastFullyObservedContext === context) ;
            else {
              var contextItem = {
                context,
                memoizedValue: value,
                next: null
              };
              if (lastContextDependency === null) {
                if (currentlyRenderingFiber === null) {
                  throw new Error("Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo().");
                }
                lastContextDependency = contextItem;
                currentlyRenderingFiber.dependencies = {
                  lanes: NoLanes,
                  firstContext: contextItem
                };
              } else {
                lastContextDependency = lastContextDependency.next = contextItem;
              }
            }
            return value;
          }
          var concurrentQueues = null;
          function pushConcurrentUpdateQueue(queue) {
            if (concurrentQueues === null) {
              concurrentQueues = [queue];
            } else {
              concurrentQueues.push(queue);
            }
          }
          function finishQueueingConcurrentUpdates() {
            if (concurrentQueues !== null) {
              for (var i = 0; i < concurrentQueues.length; i++) {
                var queue = concurrentQueues[i];
                var lastInterleavedUpdate = queue.interleaved;
                if (lastInterleavedUpdate !== null) {
                  queue.interleaved = null;
                  var firstInterleavedUpdate = lastInterleavedUpdate.next;
                  var lastPendingUpdate = queue.pending;
                  if (lastPendingUpdate !== null) {
                    var firstPendingUpdate = lastPendingUpdate.next;
                    lastPendingUpdate.next = firstInterleavedUpdate;
                    lastInterleavedUpdate.next = firstPendingUpdate;
                  }
                  queue.pending = lastInterleavedUpdate;
                }
              }
              concurrentQueues = null;
            }
          }
          function enqueueConcurrentHookUpdate(fiber, queue, update, lane) {
            var interleaved = queue.interleaved;
            if (interleaved === null) {
              update.next = update;
              pushConcurrentUpdateQueue(queue);
            } else {
              update.next = interleaved.next;
              interleaved.next = update;
            }
            queue.interleaved = update;
            return markUpdateLaneFromFiberToRoot(fiber, lane);
          }
          function enqueueConcurrentHookUpdateAndEagerlyBailout(fiber, queue, update, lane) {
            var interleaved = queue.interleaved;
            if (interleaved === null) {
              update.next = update;
              pushConcurrentUpdateQueue(queue);
            } else {
              update.next = interleaved.next;
              interleaved.next = update;
            }
            queue.interleaved = update;
          }
          function enqueueConcurrentClassUpdate(fiber, queue, update, lane) {
            var interleaved = queue.interleaved;
            if (interleaved === null) {
              update.next = update;
              pushConcurrentUpdateQueue(queue);
            } else {
              update.next = interleaved.next;
              interleaved.next = update;
            }
            queue.interleaved = update;
            return markUpdateLaneFromFiberToRoot(fiber, lane);
          }
          function enqueueConcurrentRenderForLane(fiber, lane) {
            return markUpdateLaneFromFiberToRoot(fiber, lane);
          }
          var unsafe_markUpdateLaneFromFiberToRoot = markUpdateLaneFromFiberToRoot;
          function markUpdateLaneFromFiberToRoot(sourceFiber, lane) {
            sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
            var alternate = sourceFiber.alternate;
            if (alternate !== null) {
              alternate.lanes = mergeLanes(alternate.lanes, lane);
            }
            {
              if (alternate === null && (sourceFiber.flags & (Placement | Hydrating)) !== NoFlags) {
                warnAboutUpdateOnNotYetMountedFiberInDEV(sourceFiber);
              }
            }
            var node = sourceFiber;
            var parent = sourceFiber.return;
            while (parent !== null) {
              parent.childLanes = mergeLanes(parent.childLanes, lane);
              alternate = parent.alternate;
              if (alternate !== null) {
                alternate.childLanes = mergeLanes(alternate.childLanes, lane);
              } else {
                {
                  if ((parent.flags & (Placement | Hydrating)) !== NoFlags) {
                    warnAboutUpdateOnNotYetMountedFiberInDEV(sourceFiber);
                  }
                }
              }
              node = parent;
              parent = parent.return;
            }
            if (node.tag === HostRoot) {
              var root = node.stateNode;
              return root;
            } else {
              return null;
            }
          }
          var UpdateState = 0;
          var ReplaceState = 1;
          var ForceUpdate = 2;
          var CaptureUpdate = 3;
          var hasForceUpdate = false;
          var didWarnUpdateInsideUpdate;
          var currentlyProcessingQueue;
          {
            didWarnUpdateInsideUpdate = false;
            currentlyProcessingQueue = null;
          }
          function initializeUpdateQueue(fiber) {
            var queue = {
              baseState: fiber.memoizedState,
              firstBaseUpdate: null,
              lastBaseUpdate: null,
              shared: {
                pending: null,
                interleaved: null,
                lanes: NoLanes
              },
              effects: null
            };
            fiber.updateQueue = queue;
          }
          function cloneUpdateQueue(current2, workInProgress2) {
            var queue = workInProgress2.updateQueue;
            var currentQueue = current2.updateQueue;
            if (queue === currentQueue) {
              var clone = {
                baseState: currentQueue.baseState,
                firstBaseUpdate: currentQueue.firstBaseUpdate,
                lastBaseUpdate: currentQueue.lastBaseUpdate,
                shared: currentQueue.shared,
                effects: currentQueue.effects
              };
              workInProgress2.updateQueue = clone;
            }
          }
          function createUpdate(eventTime, lane) {
            var update = {
              eventTime,
              lane,
              tag: UpdateState,
              payload: null,
              callback: null,
              next: null
            };
            return update;
          }
          function enqueueUpdate(fiber, update, lane) {
            var updateQueue = fiber.updateQueue;
            if (updateQueue === null) {
              return null;
            }
            var sharedQueue = updateQueue.shared;
            {
              if (currentlyProcessingQueue === sharedQueue && !didWarnUpdateInsideUpdate) {
                error("An update (setState, replaceState, or forceUpdate) was scheduled from inside an update function. Update functions should be pure, with zero side-effects. Consider using componentDidUpdate or a callback.");
                didWarnUpdateInsideUpdate = true;
              }
            }
            if (isUnsafeClassRenderPhaseUpdate()) {
              var pending = sharedQueue.pending;
              if (pending === null) {
                update.next = update;
              } else {
                update.next = pending.next;
                pending.next = update;
              }
              sharedQueue.pending = update;
              return unsafe_markUpdateLaneFromFiberToRoot(fiber, lane);
            } else {
              return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
            }
          }
          function entangleTransitions(root, fiber, lane) {
            var updateQueue = fiber.updateQueue;
            if (updateQueue === null) {
              return;
            }
            var sharedQueue = updateQueue.shared;
            if (isTransitionLane(lane)) {
              var queueLanes = sharedQueue.lanes;
              queueLanes = intersectLanes(queueLanes, root.pendingLanes);
              var newQueueLanes = mergeLanes(queueLanes, lane);
              sharedQueue.lanes = newQueueLanes;
              markRootEntangled(root, newQueueLanes);
            }
          }
          function enqueueCapturedUpdate(workInProgress2, capturedUpdate) {
            var queue = workInProgress2.updateQueue;
            var current2 = workInProgress2.alternate;
            if (current2 !== null) {
              var currentQueue = current2.updateQueue;
              if (queue === currentQueue) {
                var newFirst = null;
                var newLast = null;
                var firstBaseUpdate = queue.firstBaseUpdate;
                if (firstBaseUpdate !== null) {
                  var update = firstBaseUpdate;
                  do {
                    var clone = {
                      eventTime: update.eventTime,
                      lane: update.lane,
                      tag: update.tag,
                      payload: update.payload,
                      callback: update.callback,
                      next: null
                    };
                    if (newLast === null) {
                      newFirst = newLast = clone;
                    } else {
                      newLast.next = clone;
                      newLast = clone;
                    }
                    update = update.next;
                  } while (update !== null);
                  if (newLast === null) {
                    newFirst = newLast = capturedUpdate;
                  } else {
                    newLast.next = capturedUpdate;
                    newLast = capturedUpdate;
                  }
                } else {
                  newFirst = newLast = capturedUpdate;
                }
                queue = {
                  baseState: currentQueue.baseState,
                  firstBaseUpdate: newFirst,
                  lastBaseUpdate: newLast,
                  shared: currentQueue.shared,
                  effects: currentQueue.effects
                };
                workInProgress2.updateQueue = queue;
                return;
              }
            }
            var lastBaseUpdate = queue.lastBaseUpdate;
            if (lastBaseUpdate === null) {
              queue.firstBaseUpdate = capturedUpdate;
            } else {
              lastBaseUpdate.next = capturedUpdate;
            }
            queue.lastBaseUpdate = capturedUpdate;
          }
          function getStateFromUpdate(workInProgress2, queue, update, prevState, nextProps, instance) {
            switch (update.tag) {
              case ReplaceState: {
                var payload = update.payload;
                if (typeof payload === "function") {
                  {
                    enterDisallowedContextReadInDEV();
                  }
                  var nextState = payload.call(instance, prevState, nextProps);
                  {
                    if (workInProgress2.mode & StrictLegacyMode) {
                      setIsStrictModeForDevtools(true);
                      try {
                        payload.call(instance, prevState, nextProps);
                      } finally {
                        setIsStrictModeForDevtools(false);
                      }
                    }
                    exitDisallowedContextReadInDEV();
                  }
                  return nextState;
                }
                return payload;
              }
              case CaptureUpdate: {
                workInProgress2.flags = workInProgress2.flags & ~ShouldCapture | DidCapture;
              }
              // Intentional fallthrough
              case UpdateState: {
                var _payload = update.payload;
                var partialState;
                if (typeof _payload === "function") {
                  {
                    enterDisallowedContextReadInDEV();
                  }
                  partialState = _payload.call(instance, prevState, nextProps);
                  {
                    if (workInProgress2.mode & StrictLegacyMode) {
                      setIsStrictModeForDevtools(true);
                      try {
                        _payload.call(instance, prevState, nextProps);
                      } finally {
                        setIsStrictModeForDevtools(false);
                      }
                    }
                    exitDisallowedContextReadInDEV();
                  }
                } else {
                  partialState = _payload;
                }
                if (partialState === null || partialState === void 0) {
                  return prevState;
                }
                return assign({}, prevState, partialState);
              }
              case ForceUpdate: {
                hasForceUpdate = true;
                return prevState;
              }
            }
            return prevState;
          }
          function processUpdateQueue(workInProgress2, props, instance, renderLanes2) {
            var queue = workInProgress2.updateQueue;
            hasForceUpdate = false;
            {
              currentlyProcessingQueue = queue.shared;
            }
            var firstBaseUpdate = queue.firstBaseUpdate;
            var lastBaseUpdate = queue.lastBaseUpdate;
            var pendingQueue = queue.shared.pending;
            if (pendingQueue !== null) {
              queue.shared.pending = null;
              var lastPendingUpdate = pendingQueue;
              var firstPendingUpdate = lastPendingUpdate.next;
              lastPendingUpdate.next = null;
              if (lastBaseUpdate === null) {
                firstBaseUpdate = firstPendingUpdate;
              } else {
                lastBaseUpdate.next = firstPendingUpdate;
              }
              lastBaseUpdate = lastPendingUpdate;
              var current2 = workInProgress2.alternate;
              if (current2 !== null) {
                var currentQueue = current2.updateQueue;
                var currentLastBaseUpdate = currentQueue.lastBaseUpdate;
                if (currentLastBaseUpdate !== lastBaseUpdate) {
                  if (currentLastBaseUpdate === null) {
                    currentQueue.firstBaseUpdate = firstPendingUpdate;
                  } else {
                    currentLastBaseUpdate.next = firstPendingUpdate;
                  }
                  currentQueue.lastBaseUpdate = lastPendingUpdate;
                }
              }
            }
            if (firstBaseUpdate !== null) {
              var newState = queue.baseState;
              var newLanes = NoLanes;
              var newBaseState = null;
              var newFirstBaseUpdate = null;
              var newLastBaseUpdate = null;
              var update = firstBaseUpdate;
              do {
                var updateLane = update.lane;
                var updateEventTime = update.eventTime;
                if (!isSubsetOfLanes(renderLanes2, updateLane)) {
                  var clone = {
                    eventTime: updateEventTime,
                    lane: updateLane,
                    tag: update.tag,
                    payload: update.payload,
                    callback: update.callback,
                    next: null
                  };
                  if (newLastBaseUpdate === null) {
                    newFirstBaseUpdate = newLastBaseUpdate = clone;
                    newBaseState = newState;
                  } else {
                    newLastBaseUpdate = newLastBaseUpdate.next = clone;
                  }
                  newLanes = mergeLanes(newLanes, updateLane);
                } else {
                  if (newLastBaseUpdate !== null) {
                    var _clone = {
                      eventTime: updateEventTime,
                      // This update is going to be committed so we never want uncommit
                      // it. Using NoLane works because 0 is a subset of all bitmasks, so
                      // this will never be skipped by the check above.
                      lane: NoLane,
                      tag: update.tag,
                      payload: update.payload,
                      callback: update.callback,
                      next: null
                    };
                    newLastBaseUpdate = newLastBaseUpdate.next = _clone;
                  }
                  newState = getStateFromUpdate(workInProgress2, queue, update, newState, props, instance);
                  var callback = update.callback;
                  if (callback !== null && // If the update was already committed, we should not queue its
                  // callback again.
                  update.lane !== NoLane) {
                    workInProgress2.flags |= Callback;
                    var effects = queue.effects;
                    if (effects === null) {
                      queue.effects = [update];
                    } else {
                      effects.push(update);
                    }
                  }
                }
                update = update.next;
                if (update === null) {
                  pendingQueue = queue.shared.pending;
                  if (pendingQueue === null) {
                    break;
                  } else {
                    var _lastPendingUpdate = pendingQueue;
                    var _firstPendingUpdate = _lastPendingUpdate.next;
                    _lastPendingUpdate.next = null;
                    update = _firstPendingUpdate;
                    queue.lastBaseUpdate = _lastPendingUpdate;
                    queue.shared.pending = null;
                  }
                }
              } while (true);
              if (newLastBaseUpdate === null) {
                newBaseState = newState;
              }
              queue.baseState = newBaseState;
              queue.firstBaseUpdate = newFirstBaseUpdate;
              queue.lastBaseUpdate = newLastBaseUpdate;
              var lastInterleaved = queue.shared.interleaved;
              if (lastInterleaved !== null) {
                var interleaved = lastInterleaved;
                do {
                  newLanes = mergeLanes(newLanes, interleaved.lane);
                  interleaved = interleaved.next;
                } while (interleaved !== lastInterleaved);
              } else if (firstBaseUpdate === null) {
                queue.shared.lanes = NoLanes;
              }
              markSkippedUpdateLanes(newLanes);
              workInProgress2.lanes = newLanes;
              workInProgress2.memoizedState = newState;
            }
            {
              currentlyProcessingQueue = null;
            }
          }
          function callCallback(callback, context) {
            if (typeof callback !== "function") {
              throw new Error("Invalid argument passed as callback. Expected a function. Instead " + ("received: " + callback));
            }
            callback.call(context);
          }
          function resetHasForceUpdateBeforeProcessing() {
            hasForceUpdate = false;
          }
          function checkHasForceUpdateAfterProcessing() {
            return hasForceUpdate;
          }
          function commitUpdateQueue(finishedWork, finishedQueue, instance) {
            var effects = finishedQueue.effects;
            finishedQueue.effects = null;
            if (effects !== null) {
              for (var i = 0; i < effects.length; i++) {
                var effect = effects[i];
                var callback = effect.callback;
                if (callback !== null) {
                  effect.callback = null;
                  callCallback(callback, instance);
                }
              }
            }
          }
          var NO_CONTEXT = {};
          var contextStackCursor$1 = createCursor(NO_CONTEXT);
          var contextFiberStackCursor = createCursor(NO_CONTEXT);
          var rootInstanceStackCursor = createCursor(NO_CONTEXT);
          function requiredContext(c) {
            if (c === NO_CONTEXT) {
              throw new Error("Expected host context to exist. This error is likely caused by a bug in React. Please file an issue.");
            }
            return c;
          }
          function getRootHostContainer() {
            var rootInstance = requiredContext(rootInstanceStackCursor.current);
            return rootInstance;
          }
          function pushHostContainer(fiber, nextRootInstance) {
            push(rootInstanceStackCursor, nextRootInstance, fiber);
            push(contextFiberStackCursor, fiber, fiber);
            push(contextStackCursor$1, NO_CONTEXT, fiber);
            var nextRootContext = getRootHostContext(nextRootInstance);
            pop(contextStackCursor$1, fiber);
            push(contextStackCursor$1, nextRootContext, fiber);
          }
          function popHostContainer(fiber) {
            pop(contextStackCursor$1, fiber);
            pop(contextFiberStackCursor, fiber);
            pop(rootInstanceStackCursor, fiber);
          }
          function getHostContext() {
            var context = requiredContext(contextStackCursor$1.current);
            return context;
          }
          function pushHostContext(fiber) {
            var rootInstance = requiredContext(rootInstanceStackCursor.current);
            var context = requiredContext(contextStackCursor$1.current);
            var nextContext = getChildHostContext(context, fiber.type, rootInstance);
            if (context === nextContext) {
              return;
            }
            push(contextFiberStackCursor, fiber, fiber);
            push(contextStackCursor$1, nextContext, fiber);
          }
          function popHostContext(fiber) {
            if (contextFiberStackCursor.current !== fiber) {
              return;
            }
            pop(contextStackCursor$1, fiber);
            pop(contextFiberStackCursor, fiber);
          }
          var DefaultSuspenseContext = 0;
          var SubtreeSuspenseContextMask = 1;
          var InvisibleParentSuspenseContext = 1;
          var ForceSuspenseFallback = 2;
          var suspenseStackCursor = createCursor(DefaultSuspenseContext);
          function hasSuspenseContext(parentContext, flag) {
            return (parentContext & flag) !== 0;
          }
          function setDefaultShallowSuspenseContext(parentContext) {
            return parentContext & SubtreeSuspenseContextMask;
          }
          function setShallowSuspenseContext(parentContext, shallowContext) {
            return parentContext & SubtreeSuspenseContextMask | shallowContext;
          }
          function addSubtreeSuspenseContext(parentContext, subtreeContext) {
            return parentContext | subtreeContext;
          }
          function pushSuspenseContext(fiber, newContext) {
            push(suspenseStackCursor, newContext, fiber);
          }
          function popSuspenseContext(fiber) {
            pop(suspenseStackCursor, fiber);
          }
          function shouldCaptureSuspense(workInProgress2, hasInvisibleParent) {
            var nextState = workInProgress2.memoizedState;
            if (nextState !== null) {
              if (nextState.dehydrated !== null) {
                return true;
              }
              return false;
            }
            var props = workInProgress2.memoizedProps;
            {
              return true;
            }
          }
          function findFirstSuspended(row) {
            var node = row;
            while (node !== null) {
              if (node.tag === SuspenseComponent) {
                var state = node.memoizedState;
                if (state !== null) {
                  var dehydrated = state.dehydrated;
                  if (dehydrated === null || isSuspenseInstancePending(dehydrated) || isSuspenseInstanceFallback(dehydrated)) {
                    return node;
                  }
                }
              } else if (node.tag === SuspenseListComponent && // revealOrder undefined can't be trusted because it don't
              // keep track of whether it suspended or not.
              node.memoizedProps.revealOrder !== void 0) {
                var didSuspend = (node.flags & DidCapture) !== NoFlags;
                if (didSuspend) {
                  return node;
                }
              } else if (node.child !== null) {
                node.child.return = node;
                node = node.child;
                continue;
              }
              if (node === row) {
                return null;
              }
              while (node.sibling === null) {
                if (node.return === null || node.return === row) {
                  return null;
                }
                node = node.return;
              }
              node.sibling.return = node.return;
              node = node.sibling;
            }
            return null;
          }
          var NoFlags$1 = (
            /*   */
            0
          );
          var HasEffect = (
            /* */
            1
          );
          var Insertion = (
            /*  */
            2
          );
          var Layout = (
            /*    */
            4
          );
          var Passive$1 = (
            /*   */
            8
          );
          var workInProgressSources = [];
          function resetWorkInProgressVersions() {
            for (var i = 0; i < workInProgressSources.length; i++) {
              var mutableSource = workInProgressSources[i];
              if (isPrimaryRenderer) {
                mutableSource._workInProgressVersionPrimary = null;
              } else {
                mutableSource._workInProgressVersionSecondary = null;
              }
            }
            workInProgressSources.length = 0;
          }
          function registerMutableSourceForHydration(root, mutableSource) {
            var getVersion = mutableSource._getVersion;
            var version = getVersion(mutableSource._source);
            if (root.mutableSourceEagerHydrationData == null) {
              root.mutableSourceEagerHydrationData = [mutableSource, version];
            } else {
              root.mutableSourceEagerHydrationData.push(mutableSource, version);
            }
          }
          var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher, ReactCurrentBatchConfig$1 = ReactSharedInternals.ReactCurrentBatchConfig;
          var didWarnAboutMismatchedHooksForComponent;
          var didWarnUncachedGetSnapshot;
          {
            didWarnAboutMismatchedHooksForComponent = /* @__PURE__ */ new Set();
          }
          var renderLanes = NoLanes;
          var currentlyRenderingFiber$1 = null;
          var currentHook = null;
          var workInProgressHook = null;
          var didScheduleRenderPhaseUpdate = false;
          var didScheduleRenderPhaseUpdateDuringThisPass = false;
          var localIdCounter = 0;
          var globalClientIdCounter = 0;
          var RE_RENDER_LIMIT = 25;
          var currentHookNameInDev = null;
          var hookTypesDev = null;
          var hookTypesUpdateIndexDev = -1;
          var ignorePreviousDependencies = false;
          function mountHookTypesDev() {
            {
              var hookName = currentHookNameInDev;
              if (hookTypesDev === null) {
                hookTypesDev = [hookName];
              } else {
                hookTypesDev.push(hookName);
              }
            }
          }
          function updateHookTypesDev() {
            {
              var hookName = currentHookNameInDev;
              if (hookTypesDev !== null) {
                hookTypesUpdateIndexDev++;
                if (hookTypesDev[hookTypesUpdateIndexDev] !== hookName) {
                  warnOnHookMismatchInDev(hookName);
                }
              }
            }
          }
          function checkDepsAreArrayDev(deps) {
            {
              if (deps !== void 0 && deps !== null && !isArray(deps)) {
                error("%s received a final argument that is not an array (instead, received `%s`). When specified, the final argument must be an array.", currentHookNameInDev, typeof deps);
              }
            }
          }
          function warnOnHookMismatchInDev(currentHookName) {
            {
              var componentName = getComponentNameFromFiber(currentlyRenderingFiber$1);
              if (!didWarnAboutMismatchedHooksForComponent.has(componentName)) {
                didWarnAboutMismatchedHooksForComponent.add(componentName);
                if (hookTypesDev !== null) {
                  var table = "";
                  var secondColumnStart = 30;
                  for (var i = 0; i <= hookTypesUpdateIndexDev; i++) {
                    var oldHookName = hookTypesDev[i];
                    var newHookName = i === hookTypesUpdateIndexDev ? currentHookName : oldHookName;
                    var row = i + 1 + ". " + oldHookName;
                    while (row.length < secondColumnStart) {
                      row += " ";
                    }
                    row += newHookName + "\n";
                    table += row;
                  }
                  error("React has detected a change in the order of Hooks called by %s. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://reactjs.org/link/rules-of-hooks\n\n   Previous render            Next render\n   ------------------------------------------------------\n%s   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n", componentName, table);
                }
              }
            }
          }
          function throwInvalidHookError() {
            throw new Error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
          }
          function areHookInputsEqual(nextDeps, prevDeps) {
            {
              if (ignorePreviousDependencies) {
                return false;
              }
            }
            if (prevDeps === null) {
              {
                error("%s received a final argument during this render, but not during the previous render. Even though the final argument is optional, its type cannot change between renders.", currentHookNameInDev);
              }
              return false;
            }
            {
              if (nextDeps.length !== prevDeps.length) {
                error("The final argument passed to %s changed size between renders. The order and size of this array must remain constant.\n\nPrevious: %s\nIncoming: %s", currentHookNameInDev, "[" + prevDeps.join(", ") + "]", "[" + nextDeps.join(", ") + "]");
              }
            }
            for (var i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
              if (objectIs(nextDeps[i], prevDeps[i])) {
                continue;
              }
              return false;
            }
            return true;
          }
          function renderWithHooks(current2, workInProgress2, Component, props, secondArg, nextRenderLanes) {
            renderLanes = nextRenderLanes;
            currentlyRenderingFiber$1 = workInProgress2;
            {
              hookTypesDev = current2 !== null ? current2._debugHookTypes : null;
              hookTypesUpdateIndexDev = -1;
              ignorePreviousDependencies = current2 !== null && current2.type !== workInProgress2.type;
            }
            workInProgress2.memoizedState = null;
            workInProgress2.updateQueue = null;
            workInProgress2.lanes = NoLanes;
            {
              if (current2 !== null && current2.memoizedState !== null) {
                ReactCurrentDispatcher$1.current = HooksDispatcherOnUpdateInDEV;
              } else if (hookTypesDev !== null) {
                ReactCurrentDispatcher$1.current = HooksDispatcherOnMountWithHookTypesInDEV;
              } else {
                ReactCurrentDispatcher$1.current = HooksDispatcherOnMountInDEV;
              }
            }
            var children = Component(props, secondArg);
            if (didScheduleRenderPhaseUpdateDuringThisPass) {
              var numberOfReRenders = 0;
              do {
                didScheduleRenderPhaseUpdateDuringThisPass = false;
                localIdCounter = 0;
                if (numberOfReRenders >= RE_RENDER_LIMIT) {
                  throw new Error("Too many re-renders. React limits the number of renders to prevent an infinite loop.");
                }
                numberOfReRenders += 1;
                {
                  ignorePreviousDependencies = false;
                }
                currentHook = null;
                workInProgressHook = null;
                workInProgress2.updateQueue = null;
                {
                  hookTypesUpdateIndexDev = -1;
                }
                ReactCurrentDispatcher$1.current = HooksDispatcherOnRerenderInDEV;
                children = Component(props, secondArg);
              } while (didScheduleRenderPhaseUpdateDuringThisPass);
            }
            ReactCurrentDispatcher$1.current = ContextOnlyDispatcher;
            {
              workInProgress2._debugHookTypes = hookTypesDev;
            }
            var didRenderTooFewHooks = currentHook !== null && currentHook.next !== null;
            renderLanes = NoLanes;
            currentlyRenderingFiber$1 = null;
            currentHook = null;
            workInProgressHook = null;
            {
              currentHookNameInDev = null;
              hookTypesDev = null;
              hookTypesUpdateIndexDev = -1;
              if (current2 !== null && (current2.flags & StaticMask) !== (workInProgress2.flags & StaticMask) && // Disable this warning in legacy mode, because legacy Suspense is weird
              // and creates false positives. To make this work in legacy mode, we'd
              // need to mark fibers that commit in an incomplete state, somehow. For
              // now I'll disable the warning that most of the bugs that would trigger
              // it are either exclusive to concurrent mode or exist in both.
              (current2.mode & ConcurrentMode) !== NoMode) {
                error("Internal React error: Expected static flag was missing. Please notify the React team.");
              }
            }
            didScheduleRenderPhaseUpdate = false;
            if (didRenderTooFewHooks) {
              throw new Error("Rendered fewer hooks than expected. This may be caused by an accidental early return statement.");
            }
            return children;
          }
          function checkDidRenderIdHook() {
            var didRenderIdHook = localIdCounter !== 0;
            localIdCounter = 0;
            return didRenderIdHook;
          }
          function bailoutHooks(current2, workInProgress2, lanes) {
            workInProgress2.updateQueue = current2.updateQueue;
            if ((workInProgress2.mode & StrictEffectsMode) !== NoMode) {
              workInProgress2.flags &= ~(MountPassiveDev | MountLayoutDev | Passive | Update);
            } else {
              workInProgress2.flags &= ~(Passive | Update);
            }
            current2.lanes = removeLanes(current2.lanes, lanes);
          }
          function resetHooksAfterThrow() {
            ReactCurrentDispatcher$1.current = ContextOnlyDispatcher;
            if (didScheduleRenderPhaseUpdate) {
              var hook = currentlyRenderingFiber$1.memoizedState;
              while (hook !== null) {
                var queue = hook.queue;
                if (queue !== null) {
                  queue.pending = null;
                }
                hook = hook.next;
              }
              didScheduleRenderPhaseUpdate = false;
            }
            renderLanes = NoLanes;
            currentlyRenderingFiber$1 = null;
            currentHook = null;
            workInProgressHook = null;
            {
              hookTypesDev = null;
              hookTypesUpdateIndexDev = -1;
              currentHookNameInDev = null;
              isUpdatingOpaqueValueInRenderPhase = false;
            }
            didScheduleRenderPhaseUpdateDuringThisPass = false;
            localIdCounter = 0;
          }
          function mountWorkInProgressHook() {
            var hook = {
              memoizedState: null,
              baseState: null,
              baseQueue: null,
              queue: null,
              next: null
            };
            if (workInProgressHook === null) {
              currentlyRenderingFiber$1.memoizedState = workInProgressHook = hook;
            } else {
              workInProgressHook = workInProgressHook.next = hook;
            }
            return workInProgressHook;
          }
          function updateWorkInProgressHook() {
            var nextCurrentHook;
            if (currentHook === null) {
              var current2 = currentlyRenderingFiber$1.alternate;
              if (current2 !== null) {
                nextCurrentHook = current2.memoizedState;
              } else {
                nextCurrentHook = null;
              }
            } else {
              nextCurrentHook = currentHook.next;
            }
            var nextWorkInProgressHook;
            if (workInProgressHook === null) {
              nextWorkInProgressHook = currentlyRenderingFiber$1.memoizedState;
            } else {
              nextWorkInProgressHook = workInProgressHook.next;
            }
            if (nextWorkInProgressHook !== null) {
              workInProgressHook = nextWorkInProgressHook;
              nextWorkInProgressHook = workInProgressHook.next;
              currentHook = nextCurrentHook;
            } else {
              if (nextCurrentHook === null) {
                throw new Error("Rendered more hooks than during the previous render.");
              }
              currentHook = nextCurrentHook;
              var newHook = {
                memoizedState: currentHook.memoizedState,
                baseState: currentHook.baseState,
                baseQueue: currentHook.baseQueue,
                queue: currentHook.queue,
                next: null
              };
              if (workInProgressHook === null) {
                currentlyRenderingFiber$1.memoizedState = workInProgressHook = newHook;
              } else {
                workInProgressHook = workInProgressHook.next = newHook;
              }
            }
            return workInProgressHook;
          }
          function createFunctionComponentUpdateQueue() {
            return {
              lastEffect: null,
              stores: null
            };
          }
          function basicStateReducer(state, action) {
            return typeof action === "function" ? action(state) : action;
          }
          function mountReducer(reducer, initialArg, init) {
            var hook = mountWorkInProgressHook();
            var initialState;
            if (init !== void 0) {
              initialState = init(initialArg);
            } else {
              initialState = initialArg;
            }
            hook.memoizedState = hook.baseState = initialState;
            var queue = {
              pending: null,
              interleaved: null,
              lanes: NoLanes,
              dispatch: null,
              lastRenderedReducer: reducer,
              lastRenderedState: initialState
            };
            hook.queue = queue;
            var dispatch = queue.dispatch = dispatchReducerAction.bind(null, currentlyRenderingFiber$1, queue);
            return [hook.memoizedState, dispatch];
          }
          function updateReducer(reducer, initialArg, init) {
            var hook = updateWorkInProgressHook();
            var queue = hook.queue;
            if (queue === null) {
              throw new Error("Should have a queue. This is likely a bug in React. Please file an issue.");
            }
            queue.lastRenderedReducer = reducer;
            var current2 = currentHook;
            var baseQueue = current2.baseQueue;
            var pendingQueue = queue.pending;
            if (pendingQueue !== null) {
              if (baseQueue !== null) {
                var baseFirst = baseQueue.next;
                var pendingFirst = pendingQueue.next;
                baseQueue.next = pendingFirst;
                pendingQueue.next = baseFirst;
              }
              {
                if (current2.baseQueue !== baseQueue) {
                  error("Internal error: Expected work-in-progress queue to be a clone. This is a bug in React.");
                }
              }
              current2.baseQueue = baseQueue = pendingQueue;
              queue.pending = null;
            }
            if (baseQueue !== null) {
              var first = baseQueue.next;
              var newState = current2.baseState;
              var newBaseState = null;
              var newBaseQueueFirst = null;
              var newBaseQueueLast = null;
              var update = first;
              do {
                var updateLane = update.lane;
                if (!isSubsetOfLanes(renderLanes, updateLane)) {
                  var clone = {
                    lane: updateLane,
                    action: update.action,
                    hasEagerState: update.hasEagerState,
                    eagerState: update.eagerState,
                    next: null
                  };
                  if (newBaseQueueLast === null) {
                    newBaseQueueFirst = newBaseQueueLast = clone;
                    newBaseState = newState;
                  } else {
                    newBaseQueueLast = newBaseQueueLast.next = clone;
                  }
                  currentlyRenderingFiber$1.lanes = mergeLanes(currentlyRenderingFiber$1.lanes, updateLane);
                  markSkippedUpdateLanes(updateLane);
                } else {
                  if (newBaseQueueLast !== null) {
                    var _clone = {
                      // This update is going to be committed so we never want uncommit
                      // it. Using NoLane works because 0 is a subset of all bitmasks, so
                      // this will never be skipped by the check above.
                      lane: NoLane,
                      action: update.action,
                      hasEagerState: update.hasEagerState,
                      eagerState: update.eagerState,
                      next: null
                    };
                    newBaseQueueLast = newBaseQueueLast.next = _clone;
                  }
                  if (update.hasEagerState) {
                    newState = update.eagerState;
                  } else {
                    var action = update.action;
                    newState = reducer(newState, action);
                  }
                }
                update = update.next;
              } while (update !== null && update !== first);
              if (newBaseQueueLast === null) {
                newBaseState = newState;
              } else {
                newBaseQueueLast.next = newBaseQueueFirst;
              }
              if (!objectIs(newState, hook.memoizedState)) {
                markWorkInProgressReceivedUpdate();
              }
              hook.memoizedState = newState;
              hook.baseState = newBaseState;
              hook.baseQueue = newBaseQueueLast;
              queue.lastRenderedState = newState;
            }
            var lastInterleaved = queue.interleaved;
            if (lastInterleaved !== null) {
              var interleaved = lastInterleaved;
              do {
                var interleavedLane = interleaved.lane;
                currentlyRenderingFiber$1.lanes = mergeLanes(currentlyRenderingFiber$1.lanes, interleavedLane);
                markSkippedUpdateLanes(interleavedLane);
                interleaved = interleaved.next;
              } while (interleaved !== lastInterleaved);
            } else if (baseQueue === null) {
              queue.lanes = NoLanes;
            }
            var dispatch = queue.dispatch;
            return [hook.memoizedState, dispatch];
          }
          function rerenderReducer(reducer, initialArg, init) {
            var hook = updateWorkInProgressHook();
            var queue = hook.queue;
            if (queue === null) {
              throw new Error("Should have a queue. This is likely a bug in React. Please file an issue.");
            }
            queue.lastRenderedReducer = reducer;
            var dispatch = queue.dispatch;
            var lastRenderPhaseUpdate = queue.pending;
            var newState = hook.memoizedState;
            if (lastRenderPhaseUpdate !== null) {
              queue.pending = null;
              var firstRenderPhaseUpdate = lastRenderPhaseUpdate.next;
              var update = firstRenderPhaseUpdate;
              do {
                var action = update.action;
                newState = reducer(newState, action);
                update = update.next;
              } while (update !== firstRenderPhaseUpdate);
              if (!objectIs(newState, hook.memoizedState)) {
                markWorkInProgressReceivedUpdate();
              }
              hook.memoizedState = newState;
              if (hook.baseQueue === null) {
                hook.baseState = newState;
              }
              queue.lastRenderedState = newState;
            }
            return [newState, dispatch];
          }
          function mountMutableSource(source, getSnapshot, subscribe2) {
            {
              return void 0;
            }
          }
          function updateMutableSource(source, getSnapshot, subscribe2) {
            {
              return void 0;
            }
          }
          function mountSyncExternalStore(subscribe2, getSnapshot, getServerSnapshot) {
            var fiber = currentlyRenderingFiber$1;
            var hook = mountWorkInProgressHook();
            var nextSnapshot;
            var isHydrating2 = getIsHydrating();
            if (isHydrating2) {
              if (getServerSnapshot === void 0) {
                throw new Error("Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering.");
              }
              nextSnapshot = getServerSnapshot();
              {
                if (!didWarnUncachedGetSnapshot) {
                  if (nextSnapshot !== getServerSnapshot()) {
                    error("The result of getServerSnapshot should be cached to avoid an infinite loop");
                    didWarnUncachedGetSnapshot = true;
                  }
                }
              }
            } else {
              nextSnapshot = getSnapshot();
              {
                if (!didWarnUncachedGetSnapshot) {
                  var cachedSnapshot = getSnapshot();
                  if (!objectIs(nextSnapshot, cachedSnapshot)) {
                    error("The result of getSnapshot should be cached to avoid an infinite loop");
                    didWarnUncachedGetSnapshot = true;
                  }
                }
              }
              var root = getWorkInProgressRoot();
              if (root === null) {
                throw new Error("Expected a work-in-progress root. This is a bug in React. Please file an issue.");
              }
              if (!includesBlockingLane(root, renderLanes)) {
                pushStoreConsistencyCheck(fiber, getSnapshot, nextSnapshot);
              }
            }
            hook.memoizedState = nextSnapshot;
            var inst = {
              value: nextSnapshot,
              getSnapshot
            };
            hook.queue = inst;
            mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe2), [subscribe2]);
            fiber.flags |= Passive;
            pushEffect(HasEffect | Passive$1, updateStoreInstance.bind(null, fiber, inst, nextSnapshot, getSnapshot), void 0, null);
            return nextSnapshot;
          }
          function updateSyncExternalStore(subscribe2, getSnapshot, getServerSnapshot) {
            var fiber = currentlyRenderingFiber$1;
            var hook = updateWorkInProgressHook();
            var nextSnapshot = getSnapshot();
            {
              if (!didWarnUncachedGetSnapshot) {
                var cachedSnapshot = getSnapshot();
                if (!objectIs(nextSnapshot, cachedSnapshot)) {
                  error("The result of getSnapshot should be cached to avoid an infinite loop");
                  didWarnUncachedGetSnapshot = true;
                }
              }
            }
            var prevSnapshot = hook.memoizedState;
            var snapshotChanged = !objectIs(prevSnapshot, nextSnapshot);
            if (snapshotChanged) {
              hook.memoizedState = nextSnapshot;
              markWorkInProgressReceivedUpdate();
            }
            var inst = hook.queue;
            updateEffect(subscribeToStore.bind(null, fiber, inst, subscribe2), [subscribe2]);
            if (inst.getSnapshot !== getSnapshot || snapshotChanged || // Check if the susbcribe function changed. We can save some memory by
            // checking whether we scheduled a subscription effect above.
            workInProgressHook !== null && workInProgressHook.memoizedState.tag & HasEffect) {
              fiber.flags |= Passive;
              pushEffect(HasEffect | Passive$1, updateStoreInstance.bind(null, fiber, inst, nextSnapshot, getSnapshot), void 0, null);
              var root = getWorkInProgressRoot();
              if (root === null) {
                throw new Error("Expected a work-in-progress root. This is a bug in React. Please file an issue.");
              }
              if (!includesBlockingLane(root, renderLanes)) {
                pushStoreConsistencyCheck(fiber, getSnapshot, nextSnapshot);
              }
            }
            return nextSnapshot;
          }
          function pushStoreConsistencyCheck(fiber, getSnapshot, renderedSnapshot) {
            fiber.flags |= StoreConsistency;
            var check = {
              getSnapshot,
              value: renderedSnapshot
            };
            var componentUpdateQueue = currentlyRenderingFiber$1.updateQueue;
            if (componentUpdateQueue === null) {
              componentUpdateQueue = createFunctionComponentUpdateQueue();
              currentlyRenderingFiber$1.updateQueue = componentUpdateQueue;
              componentUpdateQueue.stores = [check];
            } else {
              var stores = componentUpdateQueue.stores;
              if (stores === null) {
                componentUpdateQueue.stores = [check];
              } else {
                stores.push(check);
              }
            }
          }
          function updateStoreInstance(fiber, inst, nextSnapshot, getSnapshot) {
            inst.value = nextSnapshot;
            inst.getSnapshot = getSnapshot;
            if (checkIfSnapshotChanged(inst)) {
              forceStoreRerender(fiber);
            }
          }
          function subscribeToStore(fiber, inst, subscribe2) {
            var handleStoreChange = function() {
              if (checkIfSnapshotChanged(inst)) {
                forceStoreRerender(fiber);
              }
            };
            return subscribe2(handleStoreChange);
          }
          function checkIfSnapshotChanged(inst) {
            var latestGetSnapshot = inst.getSnapshot;
            var prevValue = inst.value;
            try {
              var nextValue = latestGetSnapshot();
              return !objectIs(prevValue, nextValue);
            } catch (error2) {
              return true;
            }
          }
          function forceStoreRerender(fiber) {
            var root = enqueueConcurrentRenderForLane(fiber, SyncLane);
            if (root !== null) {
              scheduleUpdateOnFiber(root, fiber, SyncLane, NoTimestamp);
            }
          }
          function mountState(initialState) {
            var hook = mountWorkInProgressHook();
            if (typeof initialState === "function") {
              initialState = initialState();
            }
            hook.memoizedState = hook.baseState = initialState;
            var queue = {
              pending: null,
              interleaved: null,
              lanes: NoLanes,
              dispatch: null,
              lastRenderedReducer: basicStateReducer,
              lastRenderedState: initialState
            };
            hook.queue = queue;
            var dispatch = queue.dispatch = dispatchSetState.bind(null, currentlyRenderingFiber$1, queue);
            return [hook.memoizedState, dispatch];
          }
          function updateState(initialState) {
            return updateReducer(basicStateReducer);
          }
          function rerenderState(initialState) {
            return rerenderReducer(basicStateReducer);
          }
          function pushEffect(tag, create, destroy, deps) {
            var effect = {
              tag,
              create,
              destroy,
              deps,
              // Circular
              next: null
            };
            var componentUpdateQueue = currentlyRenderingFiber$1.updateQueue;
            if (componentUpdateQueue === null) {
              componentUpdateQueue = createFunctionComponentUpdateQueue();
              currentlyRenderingFiber$1.updateQueue = componentUpdateQueue;
              componentUpdateQueue.lastEffect = effect.next = effect;
            } else {
              var lastEffect = componentUpdateQueue.lastEffect;
              if (lastEffect === null) {
                componentUpdateQueue.lastEffect = effect.next = effect;
              } else {
                var firstEffect = lastEffect.next;
                lastEffect.next = effect;
                effect.next = firstEffect;
                componentUpdateQueue.lastEffect = effect;
              }
            }
            return effect;
          }
          function mountRef(initialValue) {
            var hook = mountWorkInProgressHook();
            {
              var _ref2 = {
                current: initialValue
              };
              hook.memoizedState = _ref2;
              return _ref2;
            }
          }
          function updateRef(initialValue) {
            var hook = updateWorkInProgressHook();
            return hook.memoizedState;
          }
          function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
            var hook = mountWorkInProgressHook();
            var nextDeps = deps === void 0 ? null : deps;
            currentlyRenderingFiber$1.flags |= fiberFlags;
            hook.memoizedState = pushEffect(HasEffect | hookFlags, create, void 0, nextDeps);
          }
          function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
            var hook = updateWorkInProgressHook();
            var nextDeps = deps === void 0 ? null : deps;
            var destroy = void 0;
            if (currentHook !== null) {
              var prevEffect = currentHook.memoizedState;
              destroy = prevEffect.destroy;
              if (nextDeps !== null) {
                var prevDeps = prevEffect.deps;
                if (areHookInputsEqual(nextDeps, prevDeps)) {
                  hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps);
                  return;
                }
              }
            }
            currentlyRenderingFiber$1.flags |= fiberFlags;
            hook.memoizedState = pushEffect(HasEffect | hookFlags, create, destroy, nextDeps);
          }
          function mountEffect(create, deps) {
            if ((currentlyRenderingFiber$1.mode & StrictEffectsMode) !== NoMode) {
              return mountEffectImpl(MountPassiveDev | Passive | PassiveStatic, Passive$1, create, deps);
            } else {
              return mountEffectImpl(Passive | PassiveStatic, Passive$1, create, deps);
            }
          }
          function updateEffect(create, deps) {
            return updateEffectImpl(Passive, Passive$1, create, deps);
          }
          function mountInsertionEffect(create, deps) {
            return mountEffectImpl(Update, Insertion, create, deps);
          }
          function updateInsertionEffect(create, deps) {
            return updateEffectImpl(Update, Insertion, create, deps);
          }
          function mountLayoutEffect(create, deps) {
            var fiberFlags = Update;
            {
              fiberFlags |= LayoutStatic;
            }
            if ((currentlyRenderingFiber$1.mode & StrictEffectsMode) !== NoMode) {
              fiberFlags |= MountLayoutDev;
            }
            return mountEffectImpl(fiberFlags, Layout, create, deps);
          }
          function updateLayoutEffect(create, deps) {
            return updateEffectImpl(Update, Layout, create, deps);
          }
          function imperativeHandleEffect(create, ref) {
            if (typeof ref === "function") {
              var refCallback = ref;
              var _inst = create();
              refCallback(_inst);
              return function() {
                refCallback(null);
              };
            } else if (ref !== null && ref !== void 0) {
              var refObject = ref;
              {
                if (!refObject.hasOwnProperty("current")) {
                  error("Expected useImperativeHandle() first argument to either be a ref callback or React.createRef() object. Instead received: %s.", "an object with keys {" + Object.keys(refObject).join(", ") + "}");
                }
              }
              var _inst2 = create();
              refObject.current = _inst2;
              return function() {
                refObject.current = null;
              };
            }
          }
          function mountImperativeHandle(ref, create, deps) {
            {
              if (typeof create !== "function") {
                error("Expected useImperativeHandle() second argument to be a function that creates a handle. Instead received: %s.", create !== null ? typeof create : "null");
              }
            }
            var effectDeps = deps !== null && deps !== void 0 ? deps.concat([ref]) : null;
            var fiberFlags = Update;
            {
              fiberFlags |= LayoutStatic;
            }
            if ((currentlyRenderingFiber$1.mode & StrictEffectsMode) !== NoMode) {
              fiberFlags |= MountLayoutDev;
            }
            return mountEffectImpl(fiberFlags, Layout, imperativeHandleEffect.bind(null, create, ref), effectDeps);
          }
          function updateImperativeHandle(ref, create, deps) {
            {
              if (typeof create !== "function") {
                error("Expected useImperativeHandle() second argument to be a function that creates a handle. Instead received: %s.", create !== null ? typeof create : "null");
              }
            }
            var effectDeps = deps !== null && deps !== void 0 ? deps.concat([ref]) : null;
            return updateEffectImpl(Update, Layout, imperativeHandleEffect.bind(null, create, ref), effectDeps);
          }
          function mountDebugValue(value, formatterFn) {
          }
          var updateDebugValue = mountDebugValue;
          function mountCallback(callback, deps) {
            var hook = mountWorkInProgressHook();
            var nextDeps = deps === void 0 ? null : deps;
            hook.memoizedState = [callback, nextDeps];
            return callback;
          }
          function updateCallback(callback, deps) {
            var hook = updateWorkInProgressHook();
            var nextDeps = deps === void 0 ? null : deps;
            var prevState = hook.memoizedState;
            if (prevState !== null) {
              if (nextDeps !== null) {
                var prevDeps = prevState[1];
                if (areHookInputsEqual(nextDeps, prevDeps)) {
                  return prevState[0];
                }
              }
            }
            hook.memoizedState = [callback, nextDeps];
            return callback;
          }
          function mountMemo(nextCreate, deps) {
            var hook = mountWorkInProgressHook();
            var nextDeps = deps === void 0 ? null : deps;
            var nextValue = nextCreate();
            hook.memoizedState = [nextValue, nextDeps];
            return nextValue;
          }
          function updateMemo(nextCreate, deps) {
            var hook = updateWorkInProgressHook();
            var nextDeps = deps === void 0 ? null : deps;
            var prevState = hook.memoizedState;
            if (prevState !== null) {
              if (nextDeps !== null) {
                var prevDeps = prevState[1];
                if (areHookInputsEqual(nextDeps, prevDeps)) {
                  return prevState[0];
                }
              }
            }
            var nextValue = nextCreate();
            hook.memoizedState = [nextValue, nextDeps];
            return nextValue;
          }
          function mountDeferredValue(value) {
            var hook = mountWorkInProgressHook();
            hook.memoizedState = value;
            return value;
          }
          function updateDeferredValue(value) {
            var hook = updateWorkInProgressHook();
            var resolvedCurrentHook = currentHook;
            var prevValue = resolvedCurrentHook.memoizedState;
            return updateDeferredValueImpl(hook, prevValue, value);
          }
          function rerenderDeferredValue(value) {
            var hook = updateWorkInProgressHook();
            if (currentHook === null) {
              hook.memoizedState = value;
              return value;
            } else {
              var prevValue = currentHook.memoizedState;
              return updateDeferredValueImpl(hook, prevValue, value);
            }
          }
          function updateDeferredValueImpl(hook, prevValue, value) {
            var shouldDeferValue = !includesOnlyNonUrgentLanes(renderLanes);
            if (shouldDeferValue) {
              if (!objectIs(value, prevValue)) {
                var deferredLane = claimNextTransitionLane();
                currentlyRenderingFiber$1.lanes = mergeLanes(currentlyRenderingFiber$1.lanes, deferredLane);
                markSkippedUpdateLanes(deferredLane);
                hook.baseState = true;
              }
              return prevValue;
            } else {
              if (hook.baseState) {
                hook.baseState = false;
                markWorkInProgressReceivedUpdate();
              }
              hook.memoizedState = value;
              return value;
            }
          }
          function startTransition2(setPending, callback, options) {
            var previousPriority = getCurrentUpdatePriority();
            setCurrentUpdatePriority(higherEventPriority(previousPriority, ContinuousEventPriority));
            setPending(true);
            var prevTransition = ReactCurrentBatchConfig$1.transition;
            ReactCurrentBatchConfig$1.transition = {};
            var currentTransition = ReactCurrentBatchConfig$1.transition;
            {
              ReactCurrentBatchConfig$1.transition._updatedFibers = /* @__PURE__ */ new Set();
            }
            try {
              setPending(false);
              callback();
            } finally {
              setCurrentUpdatePriority(previousPriority);
              ReactCurrentBatchConfig$1.transition = prevTransition;
              {
                if (prevTransition === null && currentTransition._updatedFibers) {
                  var updatedFibersCount = currentTransition._updatedFibers.size;
                  if (updatedFibersCount > 10) {
                    warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                  }
                  currentTransition._updatedFibers.clear();
                }
              }
            }
          }
          function mountTransition() {
            var _mountState = mountState(false), isPending = _mountState[0], setPending = _mountState[1];
            var start = startTransition2.bind(null, setPending);
            var hook = mountWorkInProgressHook();
            hook.memoizedState = start;
            return [isPending, start];
          }
          function updateTransition() {
            var _updateState = updateState(), isPending = _updateState[0];
            var hook = updateWorkInProgressHook();
            var start = hook.memoizedState;
            return [isPending, start];
          }
          function rerenderTransition() {
            var _rerenderState = rerenderState(), isPending = _rerenderState[0];
            var hook = updateWorkInProgressHook();
            var start = hook.memoizedState;
            return [isPending, start];
          }
          var isUpdatingOpaqueValueInRenderPhase = false;
          function getIsUpdatingOpaqueValueInRenderPhaseInDEV() {
            {
              return isUpdatingOpaqueValueInRenderPhase;
            }
          }
          function mountId() {
            var hook = mountWorkInProgressHook();
            var root = getWorkInProgressRoot();
            var identifierPrefix = root.identifierPrefix;
            var id;
            if (getIsHydrating()) {
              var treeId = getTreeId();
              id = ":" + identifierPrefix + "R" + treeId;
              var localId = localIdCounter++;
              if (localId > 0) {
                id += "H" + localId.toString(32);
              }
              id += ":";
            } else {
              var globalClientId = globalClientIdCounter++;
              id = ":" + identifierPrefix + "r" + globalClientId.toString(32) + ":";
            }
            hook.memoizedState = id;
            return id;
          }
          function updateId() {
            var hook = updateWorkInProgressHook();
            var id = hook.memoizedState;
            return id;
          }
          function dispatchReducerAction(fiber, queue, action) {
            {
              if (typeof arguments[3] === "function") {
                error("State updates from the useState() and useReducer() Hooks don't support the second callback argument. To execute a side effect after rendering, declare it in the component body with useEffect().");
              }
            }
            var lane = requestUpdateLane(fiber);
            var update = {
              lane,
              action,
              hasEagerState: false,
              eagerState: null,
              next: null
            };
            if (isRenderPhaseUpdate(fiber)) {
              enqueueRenderPhaseUpdate(queue, update);
            } else {
              var root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
              if (root !== null) {
                var eventTime = requestEventTime();
                scheduleUpdateOnFiber(root, fiber, lane, eventTime);
                entangleTransitionUpdate(root, queue, lane);
              }
            }
            markUpdateInDevTools(fiber, lane);
          }
          function dispatchSetState(fiber, queue, action) {
            {
              if (typeof arguments[3] === "function") {
                error("State updates from the useState() and useReducer() Hooks don't support the second callback argument. To execute a side effect after rendering, declare it in the component body with useEffect().");
              }
            }
            var lane = requestUpdateLane(fiber);
            var update = {
              lane,
              action,
              hasEagerState: false,
              eagerState: null,
              next: null
            };
            if (isRenderPhaseUpdate(fiber)) {
              enqueueRenderPhaseUpdate(queue, update);
            } else {
              var alternate = fiber.alternate;
              if (fiber.lanes === NoLanes && (alternate === null || alternate.lanes === NoLanes)) {
                var lastRenderedReducer = queue.lastRenderedReducer;
                if (lastRenderedReducer !== null) {
                  var prevDispatcher;
                  {
                    prevDispatcher = ReactCurrentDispatcher$1.current;
                    ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                  }
                  try {
                    var currentState = queue.lastRenderedState;
                    var eagerState = lastRenderedReducer(currentState, action);
                    update.hasEagerState = true;
                    update.eagerState = eagerState;
                    if (objectIs(eagerState, currentState)) {
                      enqueueConcurrentHookUpdateAndEagerlyBailout(fiber, queue, update, lane);
                      return;
                    }
                  } catch (error2) {
                  } finally {
                    {
                      ReactCurrentDispatcher$1.current = prevDispatcher;
                    }
                  }
                }
              }
              var root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
              if (root !== null) {
                var eventTime = requestEventTime();
                scheduleUpdateOnFiber(root, fiber, lane, eventTime);
                entangleTransitionUpdate(root, queue, lane);
              }
            }
            markUpdateInDevTools(fiber, lane);
          }
          function isRenderPhaseUpdate(fiber) {
            var alternate = fiber.alternate;
            return fiber === currentlyRenderingFiber$1 || alternate !== null && alternate === currentlyRenderingFiber$1;
          }
          function enqueueRenderPhaseUpdate(queue, update) {
            didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
            var pending = queue.pending;
            if (pending === null) {
              update.next = update;
            } else {
              update.next = pending.next;
              pending.next = update;
            }
            queue.pending = update;
          }
          function entangleTransitionUpdate(root, queue, lane) {
            if (isTransitionLane(lane)) {
              var queueLanes = queue.lanes;
              queueLanes = intersectLanes(queueLanes, root.pendingLanes);
              var newQueueLanes = mergeLanes(queueLanes, lane);
              queue.lanes = newQueueLanes;
              markRootEntangled(root, newQueueLanes);
            }
          }
          function markUpdateInDevTools(fiber, lane, action) {
            {
              markStateUpdateScheduled(fiber, lane);
            }
          }
          var ContextOnlyDispatcher = {
            readContext,
            useCallback: throwInvalidHookError,
            useContext: throwInvalidHookError,
            useEffect: throwInvalidHookError,
            useImperativeHandle: throwInvalidHookError,
            useInsertionEffect: throwInvalidHookError,
            useLayoutEffect: throwInvalidHookError,
            useMemo: throwInvalidHookError,
            useReducer: throwInvalidHookError,
            useRef: throwInvalidHookError,
            useState: throwInvalidHookError,
            useDebugValue: throwInvalidHookError,
            useDeferredValue: throwInvalidHookError,
            useTransition: throwInvalidHookError,
            useMutableSource: throwInvalidHookError,
            useSyncExternalStore: throwInvalidHookError,
            useId: throwInvalidHookError,
            unstable_isNewReconciler: enableNewReconciler
          };
          var HooksDispatcherOnMountInDEV = null;
          var HooksDispatcherOnMountWithHookTypesInDEV = null;
          var HooksDispatcherOnUpdateInDEV = null;
          var HooksDispatcherOnRerenderInDEV = null;
          var InvalidNestedHooksDispatcherOnMountInDEV = null;
          var InvalidNestedHooksDispatcherOnUpdateInDEV = null;
          var InvalidNestedHooksDispatcherOnRerenderInDEV = null;
          {
            var warnInvalidContextAccess = function() {
              error("Context can only be read while React is rendering. In classes, you can read it in the render method or getDerivedStateFromProps. In function components, you can read it directly in the function body, but not inside Hooks like useReducer() or useMemo().");
            };
            var warnInvalidHookAccess = function() {
              error("Do not call Hooks inside useEffect(...), useMemo(...), or other built-in Hooks. You can only call Hooks at the top level of your React function. For more information, see https://reactjs.org/link/rules-of-hooks");
            };
            HooksDispatcherOnMountInDEV = {
              readContext: function(context) {
                return readContext(context);
              },
              useCallback: function(callback, deps) {
                currentHookNameInDev = "useCallback";
                mountHookTypesDev();
                checkDepsAreArrayDev(deps);
                return mountCallback(callback, deps);
              },
              useContext: function(context) {
                currentHookNameInDev = "useContext";
                mountHookTypesDev();
                return readContext(context);
              },
              useEffect: function(create, deps) {
                currentHookNameInDev = "useEffect";
                mountHookTypesDev();
                checkDepsAreArrayDev(deps);
                return mountEffect(create, deps);
              },
              useImperativeHandle: function(ref, create, deps) {
                currentHookNameInDev = "useImperativeHandle";
                mountHookTypesDev();
                checkDepsAreArrayDev(deps);
                return mountImperativeHandle(ref, create, deps);
              },
              useInsertionEffect: function(create, deps) {
                currentHookNameInDev = "useInsertionEffect";
                mountHookTypesDev();
                checkDepsAreArrayDev(deps);
                return mountInsertionEffect(create, deps);
              },
              useLayoutEffect: function(create, deps) {
                currentHookNameInDev = "useLayoutEffect";
                mountHookTypesDev();
                checkDepsAreArrayDev(deps);
                return mountLayoutEffect(create, deps);
              },
              useMemo: function(create, deps) {
                currentHookNameInDev = "useMemo";
                mountHookTypesDev();
                checkDepsAreArrayDev(deps);
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountMemo(create, deps);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useReducer: function(reducer, initialArg, init) {
                currentHookNameInDev = "useReducer";
                mountHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountReducer(reducer, initialArg, init);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useRef: function(initialValue) {
                currentHookNameInDev = "useRef";
                mountHookTypesDev();
                return mountRef(initialValue);
              },
              useState: function(initialState) {
                currentHookNameInDev = "useState";
                mountHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountState(initialState);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useDebugValue: function(value, formatterFn) {
                currentHookNameInDev = "useDebugValue";
                mountHookTypesDev();
                return mountDebugValue();
              },
              useDeferredValue: function(value) {
                currentHookNameInDev = "useDeferredValue";
                mountHookTypesDev();
                return mountDeferredValue(value);
              },
              useTransition: function() {
                currentHookNameInDev = "useTransition";
                mountHookTypesDev();
                return mountTransition();
              },
              useMutableSource: function(source, getSnapshot, subscribe2) {
                currentHookNameInDev = "useMutableSource";
                mountHookTypesDev();
                return mountMutableSource();
              },
              useSyncExternalStore: function(subscribe2, getSnapshot, getServerSnapshot) {
                currentHookNameInDev = "useSyncExternalStore";
                mountHookTypesDev();
                return mountSyncExternalStore(subscribe2, getSnapshot, getServerSnapshot);
              },
              useId: function() {
                currentHookNameInDev = "useId";
                mountHookTypesDev();
                return mountId();
              },
              unstable_isNewReconciler: enableNewReconciler
            };
            HooksDispatcherOnMountWithHookTypesInDEV = {
              readContext: function(context) {
                return readContext(context);
              },
              useCallback: function(callback, deps) {
                currentHookNameInDev = "useCallback";
                updateHookTypesDev();
                return mountCallback(callback, deps);
              },
              useContext: function(context) {
                currentHookNameInDev = "useContext";
                updateHookTypesDev();
                return readContext(context);
              },
              useEffect: function(create, deps) {
                currentHookNameInDev = "useEffect";
                updateHookTypesDev();
                return mountEffect(create, deps);
              },
              useImperativeHandle: function(ref, create, deps) {
                currentHookNameInDev = "useImperativeHandle";
                updateHookTypesDev();
                return mountImperativeHandle(ref, create, deps);
              },
              useInsertionEffect: function(create, deps) {
                currentHookNameInDev = "useInsertionEffect";
                updateHookTypesDev();
                return mountInsertionEffect(create, deps);
              },
              useLayoutEffect: function(create, deps) {
                currentHookNameInDev = "useLayoutEffect";
                updateHookTypesDev();
                return mountLayoutEffect(create, deps);
              },
              useMemo: function(create, deps) {
                currentHookNameInDev = "useMemo";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountMemo(create, deps);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useReducer: function(reducer, initialArg, init) {
                currentHookNameInDev = "useReducer";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountReducer(reducer, initialArg, init);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useRef: function(initialValue) {
                currentHookNameInDev = "useRef";
                updateHookTypesDev();
                return mountRef(initialValue);
              },
              useState: function(initialState) {
                currentHookNameInDev = "useState";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountState(initialState);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useDebugValue: function(value, formatterFn) {
                currentHookNameInDev = "useDebugValue";
                updateHookTypesDev();
                return mountDebugValue();
              },
              useDeferredValue: function(value) {
                currentHookNameInDev = "useDeferredValue";
                updateHookTypesDev();
                return mountDeferredValue(value);
              },
              useTransition: function() {
                currentHookNameInDev = "useTransition";
                updateHookTypesDev();
                return mountTransition();
              },
              useMutableSource: function(source, getSnapshot, subscribe2) {
                currentHookNameInDev = "useMutableSource";
                updateHookTypesDev();
                return mountMutableSource();
              },
              useSyncExternalStore: function(subscribe2, getSnapshot, getServerSnapshot) {
                currentHookNameInDev = "useSyncExternalStore";
                updateHookTypesDev();
                return mountSyncExternalStore(subscribe2, getSnapshot, getServerSnapshot);
              },
              useId: function() {
                currentHookNameInDev = "useId";
                updateHookTypesDev();
                return mountId();
              },
              unstable_isNewReconciler: enableNewReconciler
            };
            HooksDispatcherOnUpdateInDEV = {
              readContext: function(context) {
                return readContext(context);
              },
              useCallback: function(callback, deps) {
                currentHookNameInDev = "useCallback";
                updateHookTypesDev();
                return updateCallback(callback, deps);
              },
              useContext: function(context) {
                currentHookNameInDev = "useContext";
                updateHookTypesDev();
                return readContext(context);
              },
              useEffect: function(create, deps) {
                currentHookNameInDev = "useEffect";
                updateHookTypesDev();
                return updateEffect(create, deps);
              },
              useImperativeHandle: function(ref, create, deps) {
                currentHookNameInDev = "useImperativeHandle";
                updateHookTypesDev();
                return updateImperativeHandle(ref, create, deps);
              },
              useInsertionEffect: function(create, deps) {
                currentHookNameInDev = "useInsertionEffect";
                updateHookTypesDev();
                return updateInsertionEffect(create, deps);
              },
              useLayoutEffect: function(create, deps) {
                currentHookNameInDev = "useLayoutEffect";
                updateHookTypesDev();
                return updateLayoutEffect(create, deps);
              },
              useMemo: function(create, deps) {
                currentHookNameInDev = "useMemo";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return updateMemo(create, deps);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useReducer: function(reducer, initialArg, init) {
                currentHookNameInDev = "useReducer";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return updateReducer(reducer, initialArg, init);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useRef: function(initialValue) {
                currentHookNameInDev = "useRef";
                updateHookTypesDev();
                return updateRef();
              },
              useState: function(initialState) {
                currentHookNameInDev = "useState";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return updateState(initialState);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useDebugValue: function(value, formatterFn) {
                currentHookNameInDev = "useDebugValue";
                updateHookTypesDev();
                return updateDebugValue();
              },
              useDeferredValue: function(value) {
                currentHookNameInDev = "useDeferredValue";
                updateHookTypesDev();
                return updateDeferredValue(value);
              },
              useTransition: function() {
                currentHookNameInDev = "useTransition";
                updateHookTypesDev();
                return updateTransition();
              },
              useMutableSource: function(source, getSnapshot, subscribe2) {
                currentHookNameInDev = "useMutableSource";
                updateHookTypesDev();
                return updateMutableSource();
              },
              useSyncExternalStore: function(subscribe2, getSnapshot, getServerSnapshot) {
                currentHookNameInDev = "useSyncExternalStore";
                updateHookTypesDev();
                return updateSyncExternalStore(subscribe2, getSnapshot);
              },
              useId: function() {
                currentHookNameInDev = "useId";
                updateHookTypesDev();
                return updateId();
              },
              unstable_isNewReconciler: enableNewReconciler
            };
            HooksDispatcherOnRerenderInDEV = {
              readContext: function(context) {
                return readContext(context);
              },
              useCallback: function(callback, deps) {
                currentHookNameInDev = "useCallback";
                updateHookTypesDev();
                return updateCallback(callback, deps);
              },
              useContext: function(context) {
                currentHookNameInDev = "useContext";
                updateHookTypesDev();
                return readContext(context);
              },
              useEffect: function(create, deps) {
                currentHookNameInDev = "useEffect";
                updateHookTypesDev();
                return updateEffect(create, deps);
              },
              useImperativeHandle: function(ref, create, deps) {
                currentHookNameInDev = "useImperativeHandle";
                updateHookTypesDev();
                return updateImperativeHandle(ref, create, deps);
              },
              useInsertionEffect: function(create, deps) {
                currentHookNameInDev = "useInsertionEffect";
                updateHookTypesDev();
                return updateInsertionEffect(create, deps);
              },
              useLayoutEffect: function(create, deps) {
                currentHookNameInDev = "useLayoutEffect";
                updateHookTypesDev();
                return updateLayoutEffect(create, deps);
              },
              useMemo: function(create, deps) {
                currentHookNameInDev = "useMemo";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnRerenderInDEV;
                try {
                  return updateMemo(create, deps);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useReducer: function(reducer, initialArg, init) {
                currentHookNameInDev = "useReducer";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnRerenderInDEV;
                try {
                  return rerenderReducer(reducer, initialArg, init);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useRef: function(initialValue) {
                currentHookNameInDev = "useRef";
                updateHookTypesDev();
                return updateRef();
              },
              useState: function(initialState) {
                currentHookNameInDev = "useState";
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnRerenderInDEV;
                try {
                  return rerenderState(initialState);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useDebugValue: function(value, formatterFn) {
                currentHookNameInDev = "useDebugValue";
                updateHookTypesDev();
                return updateDebugValue();
              },
              useDeferredValue: function(value) {
                currentHookNameInDev = "useDeferredValue";
                updateHookTypesDev();
                return rerenderDeferredValue(value);
              },
              useTransition: function() {
                currentHookNameInDev = "useTransition";
                updateHookTypesDev();
                return rerenderTransition();
              },
              useMutableSource: function(source, getSnapshot, subscribe2) {
                currentHookNameInDev = "useMutableSource";
                updateHookTypesDev();
                return updateMutableSource();
              },
              useSyncExternalStore: function(subscribe2, getSnapshot, getServerSnapshot) {
                currentHookNameInDev = "useSyncExternalStore";
                updateHookTypesDev();
                return updateSyncExternalStore(subscribe2, getSnapshot);
              },
              useId: function() {
                currentHookNameInDev = "useId";
                updateHookTypesDev();
                return updateId();
              },
              unstable_isNewReconciler: enableNewReconciler
            };
            InvalidNestedHooksDispatcherOnMountInDEV = {
              readContext: function(context) {
                warnInvalidContextAccess();
                return readContext(context);
              },
              useCallback: function(callback, deps) {
                currentHookNameInDev = "useCallback";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountCallback(callback, deps);
              },
              useContext: function(context) {
                currentHookNameInDev = "useContext";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return readContext(context);
              },
              useEffect: function(create, deps) {
                currentHookNameInDev = "useEffect";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountEffect(create, deps);
              },
              useImperativeHandle: function(ref, create, deps) {
                currentHookNameInDev = "useImperativeHandle";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountImperativeHandle(ref, create, deps);
              },
              useInsertionEffect: function(create, deps) {
                currentHookNameInDev = "useInsertionEffect";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountInsertionEffect(create, deps);
              },
              useLayoutEffect: function(create, deps) {
                currentHookNameInDev = "useLayoutEffect";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountLayoutEffect(create, deps);
              },
              useMemo: function(create, deps) {
                currentHookNameInDev = "useMemo";
                warnInvalidHookAccess();
                mountHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountMemo(create, deps);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useReducer: function(reducer, initialArg, init) {
                currentHookNameInDev = "useReducer";
                warnInvalidHookAccess();
                mountHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountReducer(reducer, initialArg, init);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useRef: function(initialValue) {
                currentHookNameInDev = "useRef";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountRef(initialValue);
              },
              useState: function(initialState) {
                currentHookNameInDev = "useState";
                warnInvalidHookAccess();
                mountHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnMountInDEV;
                try {
                  return mountState(initialState);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useDebugValue: function(value, formatterFn) {
                currentHookNameInDev = "useDebugValue";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountDebugValue();
              },
              useDeferredValue: function(value) {
                currentHookNameInDev = "useDeferredValue";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountDeferredValue(value);
              },
              useTransition: function() {
                currentHookNameInDev = "useTransition";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountTransition();
              },
              useMutableSource: function(source, getSnapshot, subscribe2) {
                currentHookNameInDev = "useMutableSource";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountMutableSource();
              },
              useSyncExternalStore: function(subscribe2, getSnapshot, getServerSnapshot) {
                currentHookNameInDev = "useSyncExternalStore";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountSyncExternalStore(subscribe2, getSnapshot, getServerSnapshot);
              },
              useId: function() {
                currentHookNameInDev = "useId";
                warnInvalidHookAccess();
                mountHookTypesDev();
                return mountId();
              },
              unstable_isNewReconciler: enableNewReconciler
            };
            InvalidNestedHooksDispatcherOnUpdateInDEV = {
              readContext: function(context) {
                warnInvalidContextAccess();
                return readContext(context);
              },
              useCallback: function(callback, deps) {
                currentHookNameInDev = "useCallback";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateCallback(callback, deps);
              },
              useContext: function(context) {
                currentHookNameInDev = "useContext";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return readContext(context);
              },
              useEffect: function(create, deps) {
                currentHookNameInDev = "useEffect";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateEffect(create, deps);
              },
              useImperativeHandle: function(ref, create, deps) {
                currentHookNameInDev = "useImperativeHandle";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateImperativeHandle(ref, create, deps);
              },
              useInsertionEffect: function(create, deps) {
                currentHookNameInDev = "useInsertionEffect";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateInsertionEffect(create, deps);
              },
              useLayoutEffect: function(create, deps) {
                currentHookNameInDev = "useLayoutEffect";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateLayoutEffect(create, deps);
              },
              useMemo: function(create, deps) {
                currentHookNameInDev = "useMemo";
                warnInvalidHookAccess();
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return updateMemo(create, deps);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useReducer: function(reducer, initialArg, init) {
                currentHookNameInDev = "useReducer";
                warnInvalidHookAccess();
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return updateReducer(reducer, initialArg, init);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useRef: function(initialValue) {
                currentHookNameInDev = "useRef";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateRef();
              },
              useState: function(initialState) {
                currentHookNameInDev = "useState";
                warnInvalidHookAccess();
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return updateState(initialState);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useDebugValue: function(value, formatterFn) {
                currentHookNameInDev = "useDebugValue";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateDebugValue();
              },
              useDeferredValue: function(value) {
                currentHookNameInDev = "useDeferredValue";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateDeferredValue(value);
              },
              useTransition: function() {
                currentHookNameInDev = "useTransition";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateTransition();
              },
              useMutableSource: function(source, getSnapshot, subscribe2) {
                currentHookNameInDev = "useMutableSource";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateMutableSource();
              },
              useSyncExternalStore: function(subscribe2, getSnapshot, getServerSnapshot) {
                currentHookNameInDev = "useSyncExternalStore";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateSyncExternalStore(subscribe2, getSnapshot);
              },
              useId: function() {
                currentHookNameInDev = "useId";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateId();
              },
              unstable_isNewReconciler: enableNewReconciler
            };
            InvalidNestedHooksDispatcherOnRerenderInDEV = {
              readContext: function(context) {
                warnInvalidContextAccess();
                return readContext(context);
              },
              useCallback: function(callback, deps) {
                currentHookNameInDev = "useCallback";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateCallback(callback, deps);
              },
              useContext: function(context) {
                currentHookNameInDev = "useContext";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return readContext(context);
              },
              useEffect: function(create, deps) {
                currentHookNameInDev = "useEffect";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateEffect(create, deps);
              },
              useImperativeHandle: function(ref, create, deps) {
                currentHookNameInDev = "useImperativeHandle";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateImperativeHandle(ref, create, deps);
              },
              useInsertionEffect: function(create, deps) {
                currentHookNameInDev = "useInsertionEffect";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateInsertionEffect(create, deps);
              },
              useLayoutEffect: function(create, deps) {
                currentHookNameInDev = "useLayoutEffect";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateLayoutEffect(create, deps);
              },
              useMemo: function(create, deps) {
                currentHookNameInDev = "useMemo";
                warnInvalidHookAccess();
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return updateMemo(create, deps);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useReducer: function(reducer, initialArg, init) {
                currentHookNameInDev = "useReducer";
                warnInvalidHookAccess();
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return rerenderReducer(reducer, initialArg, init);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useRef: function(initialValue) {
                currentHookNameInDev = "useRef";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateRef();
              },
              useState: function(initialState) {
                currentHookNameInDev = "useState";
                warnInvalidHookAccess();
                updateHookTypesDev();
                var prevDispatcher = ReactCurrentDispatcher$1.current;
                ReactCurrentDispatcher$1.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
                try {
                  return rerenderState(initialState);
                } finally {
                  ReactCurrentDispatcher$1.current = prevDispatcher;
                }
              },
              useDebugValue: function(value, formatterFn) {
                currentHookNameInDev = "useDebugValue";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateDebugValue();
              },
              useDeferredValue: function(value) {
                currentHookNameInDev = "useDeferredValue";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return rerenderDeferredValue(value);
              },
              useTransition: function() {
                currentHookNameInDev = "useTransition";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return rerenderTransition();
              },
              useMutableSource: function(source, getSnapshot, subscribe2) {
                currentHookNameInDev = "useMutableSource";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateMutableSource();
              },
              useSyncExternalStore: function(subscribe2, getSnapshot, getServerSnapshot) {
                currentHookNameInDev = "useSyncExternalStore";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateSyncExternalStore(subscribe2, getSnapshot);
              },
              useId: function() {
                currentHookNameInDev = "useId";
                warnInvalidHookAccess();
                updateHookTypesDev();
                return updateId();
              },
              unstable_isNewReconciler: enableNewReconciler
            };
          }
          var now$1 = Scheduler.unstable_now;
          var commitTime = 0;
          var layoutEffectStartTime = -1;
          var profilerStartTime = -1;
          var passiveEffectStartTime = -1;
          var currentUpdateIsNested = false;
          var nestedUpdateScheduled = false;
          function isCurrentUpdateNested() {
            return currentUpdateIsNested;
          }
          function markNestedUpdateScheduled() {
            {
              nestedUpdateScheduled = true;
            }
          }
          function resetNestedUpdateFlag() {
            {
              currentUpdateIsNested = false;
              nestedUpdateScheduled = false;
            }
          }
          function syncNestedUpdateFlag() {
            {
              currentUpdateIsNested = nestedUpdateScheduled;
              nestedUpdateScheduled = false;
            }
          }
          function getCommitTime() {
            return commitTime;
          }
          function recordCommitTime() {
            commitTime = now$1();
          }
          function startProfilerTimer(fiber) {
            profilerStartTime = now$1();
            if (fiber.actualStartTime < 0) {
              fiber.actualStartTime = now$1();
            }
          }
          function stopProfilerTimerIfRunning(fiber) {
            profilerStartTime = -1;
          }
          function stopProfilerTimerIfRunningAndRecordDelta(fiber, overrideBaseTime) {
            if (profilerStartTime >= 0) {
              var elapsedTime = now$1() - profilerStartTime;
              fiber.actualDuration += elapsedTime;
              if (overrideBaseTime) {
                fiber.selfBaseDuration = elapsedTime;
              }
              profilerStartTime = -1;
            }
          }
          function recordLayoutEffectDuration(fiber) {
            if (layoutEffectStartTime >= 0) {
              var elapsedTime = now$1() - layoutEffectStartTime;
              layoutEffectStartTime = -1;
              var parentFiber = fiber.return;
              while (parentFiber !== null) {
                switch (parentFiber.tag) {
                  case HostRoot:
                    var root = parentFiber.stateNode;
                    root.effectDuration += elapsedTime;
                    return;
                  case Profiler:
                    var parentStateNode = parentFiber.stateNode;
                    parentStateNode.effectDuration += elapsedTime;
                    return;
                }
                parentFiber = parentFiber.return;
              }
            }
          }
          function recordPassiveEffectDuration(fiber) {
            if (passiveEffectStartTime >= 0) {
              var elapsedTime = now$1() - passiveEffectStartTime;
              passiveEffectStartTime = -1;
              var parentFiber = fiber.return;
              while (parentFiber !== null) {
                switch (parentFiber.tag) {
                  case HostRoot:
                    var root = parentFiber.stateNode;
                    if (root !== null) {
                      root.passiveEffectDuration += elapsedTime;
                    }
                    return;
                  case Profiler:
                    var parentStateNode = parentFiber.stateNode;
                    if (parentStateNode !== null) {
                      parentStateNode.passiveEffectDuration += elapsedTime;
                    }
                    return;
                }
                parentFiber = parentFiber.return;
              }
            }
          }
          function startLayoutEffectTimer() {
            layoutEffectStartTime = now$1();
          }
          function startPassiveEffectTimer() {
            passiveEffectStartTime = now$1();
          }
          function transferActualDuration(fiber) {
            var child = fiber.child;
            while (child) {
              fiber.actualDuration += child.actualDuration;
              child = child.sibling;
            }
          }
          function resolveDefaultProps(Component, baseProps) {
            if (Component && Component.defaultProps) {
              var props = assign({}, baseProps);
              var defaultProps = Component.defaultProps;
              for (var propName in defaultProps) {
                if (props[propName] === void 0) {
                  props[propName] = defaultProps[propName];
                }
              }
              return props;
            }
            return baseProps;
          }
          var fakeInternalInstance = {};
          var didWarnAboutStateAssignmentForComponent;
          var didWarnAboutUninitializedState;
          var didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate;
          var didWarnAboutLegacyLifecyclesAndDerivedState;
          var didWarnAboutUndefinedDerivedState;
          var warnOnUndefinedDerivedState;
          var warnOnInvalidCallback;
          var didWarnAboutDirectlyAssigningPropsToState;
          var didWarnAboutContextTypeAndContextTypes;
          var didWarnAboutInvalidateContextType;
          var didWarnAboutLegacyContext$1;
          {
            didWarnAboutStateAssignmentForComponent = /* @__PURE__ */ new Set();
            didWarnAboutUninitializedState = /* @__PURE__ */ new Set();
            didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate = /* @__PURE__ */ new Set();
            didWarnAboutLegacyLifecyclesAndDerivedState = /* @__PURE__ */ new Set();
            didWarnAboutDirectlyAssigningPropsToState = /* @__PURE__ */ new Set();
            didWarnAboutUndefinedDerivedState = /* @__PURE__ */ new Set();
            didWarnAboutContextTypeAndContextTypes = /* @__PURE__ */ new Set();
            didWarnAboutInvalidateContextType = /* @__PURE__ */ new Set();
            didWarnAboutLegacyContext$1 = /* @__PURE__ */ new Set();
            var didWarnOnInvalidCallback = /* @__PURE__ */ new Set();
            warnOnInvalidCallback = function(callback, callerName) {
              if (callback === null || typeof callback === "function") {
                return;
              }
              var key = callerName + "_" + callback;
              if (!didWarnOnInvalidCallback.has(key)) {
                didWarnOnInvalidCallback.add(key);
                error("%s(...): Expected the last optional `callback` argument to be a function. Instead received: %s.", callerName, callback);
              }
            };
            warnOnUndefinedDerivedState = function(type, partialState) {
              if (partialState === void 0) {
                var componentName = getComponentNameFromType(type) || "Component";
                if (!didWarnAboutUndefinedDerivedState.has(componentName)) {
                  didWarnAboutUndefinedDerivedState.add(componentName);
                  error("%s.getDerivedStateFromProps(): A valid state object (or null) must be returned. You have returned undefined.", componentName);
                }
              }
            };
            Object.defineProperty(fakeInternalInstance, "_processChildContext", {
              enumerable: false,
              value: function() {
                throw new Error("_processChildContext is not available in React 16+. This likely means you have multiple copies of React and are attempting to nest a React 15 tree inside a React 16 tree using unstable_renderSubtreeIntoContainer, which isn't supported. Try to make sure you have only one copy of React (and ideally, switch to ReactDOM.createPortal).");
              }
            });
            Object.freeze(fakeInternalInstance);
          }
          function applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, nextProps) {
            var prevState = workInProgress2.memoizedState;
            var partialState = getDerivedStateFromProps(nextProps, prevState);
            {
              if (workInProgress2.mode & StrictLegacyMode) {
                setIsStrictModeForDevtools(true);
                try {
                  partialState = getDerivedStateFromProps(nextProps, prevState);
                } finally {
                  setIsStrictModeForDevtools(false);
                }
              }
              warnOnUndefinedDerivedState(ctor, partialState);
            }
            var memoizedState = partialState === null || partialState === void 0 ? prevState : assign({}, prevState, partialState);
            workInProgress2.memoizedState = memoizedState;
            if (workInProgress2.lanes === NoLanes) {
              var updateQueue = workInProgress2.updateQueue;
              updateQueue.baseState = memoizedState;
            }
          }
          var classComponentUpdater = {
            isMounted,
            enqueueSetState: function(inst, payload, callback) {
              var fiber = get(inst);
              var eventTime = requestEventTime();
              var lane = requestUpdateLane(fiber);
              var update = createUpdate(eventTime, lane);
              update.payload = payload;
              if (callback !== void 0 && callback !== null) {
                {
                  warnOnInvalidCallback(callback, "setState");
                }
                update.callback = callback;
              }
              var root = enqueueUpdate(fiber, update, lane);
              if (root !== null) {
                scheduleUpdateOnFiber(root, fiber, lane, eventTime);
                entangleTransitions(root, fiber, lane);
              }
              {
                markStateUpdateScheduled(fiber, lane);
              }
            },
            enqueueReplaceState: function(inst, payload, callback) {
              var fiber = get(inst);
              var eventTime = requestEventTime();
              var lane = requestUpdateLane(fiber);
              var update = createUpdate(eventTime, lane);
              update.tag = ReplaceState;
              update.payload = payload;
              if (callback !== void 0 && callback !== null) {
                {
                  warnOnInvalidCallback(callback, "replaceState");
                }
                update.callback = callback;
              }
              var root = enqueueUpdate(fiber, update, lane);
              if (root !== null) {
                scheduleUpdateOnFiber(root, fiber, lane, eventTime);
                entangleTransitions(root, fiber, lane);
              }
              {
                markStateUpdateScheduled(fiber, lane);
              }
            },
            enqueueForceUpdate: function(inst, callback) {
              var fiber = get(inst);
              var eventTime = requestEventTime();
              var lane = requestUpdateLane(fiber);
              var update = createUpdate(eventTime, lane);
              update.tag = ForceUpdate;
              if (callback !== void 0 && callback !== null) {
                {
                  warnOnInvalidCallback(callback, "forceUpdate");
                }
                update.callback = callback;
              }
              var root = enqueueUpdate(fiber, update, lane);
              if (root !== null) {
                scheduleUpdateOnFiber(root, fiber, lane, eventTime);
                entangleTransitions(root, fiber, lane);
              }
              {
                markForceUpdateScheduled(fiber, lane);
              }
            }
          };
          function checkShouldComponentUpdate(workInProgress2, ctor, oldProps, newProps, oldState, newState, nextContext) {
            var instance = workInProgress2.stateNode;
            if (typeof instance.shouldComponentUpdate === "function") {
              var shouldUpdate = instance.shouldComponentUpdate(newProps, newState, nextContext);
              {
                if (workInProgress2.mode & StrictLegacyMode) {
                  setIsStrictModeForDevtools(true);
                  try {
                    shouldUpdate = instance.shouldComponentUpdate(newProps, newState, nextContext);
                  } finally {
                    setIsStrictModeForDevtools(false);
                  }
                }
                if (shouldUpdate === void 0) {
                  error("%s.shouldComponentUpdate(): Returned undefined instead of a boolean value. Make sure to return true or false.", getComponentNameFromType(ctor) || "Component");
                }
              }
              return shouldUpdate;
            }
            if (ctor.prototype && ctor.prototype.isPureReactComponent) {
              return !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState);
            }
            return true;
          }
          function checkClassInstance(workInProgress2, ctor, newProps) {
            var instance = workInProgress2.stateNode;
            {
              var name = getComponentNameFromType(ctor) || "Component";
              var renderPresent = instance.render;
              if (!renderPresent) {
                if (ctor.prototype && typeof ctor.prototype.render === "function") {
                  error("%s(...): No `render` method found on the returned component instance: did you accidentally return an object from the constructor?", name);
                } else {
                  error("%s(...): No `render` method found on the returned component instance: you may have forgotten to define `render`.", name);
                }
              }
              if (instance.getInitialState && !instance.getInitialState.isReactClassApproved && !instance.state) {
                error("getInitialState was defined on %s, a plain JavaScript class. This is only supported for classes created using React.createClass. Did you mean to define a state property instead?", name);
              }
              if (instance.getDefaultProps && !instance.getDefaultProps.isReactClassApproved) {
                error("getDefaultProps was defined on %s, a plain JavaScript class. This is only supported for classes created using React.createClass. Use a static property to define defaultProps instead.", name);
              }
              if (instance.propTypes) {
                error("propTypes was defined as an instance property on %s. Use a static property to define propTypes instead.", name);
              }
              if (instance.contextType) {
                error("contextType was defined as an instance property on %s. Use a static property to define contextType instead.", name);
              }
              {
                if (ctor.childContextTypes && !didWarnAboutLegacyContext$1.has(ctor) && // Strict Mode has its own warning for legacy context, so we can skip
                // this one.
                (workInProgress2.mode & StrictLegacyMode) === NoMode) {
                  didWarnAboutLegacyContext$1.add(ctor);
                  error("%s uses the legacy childContextTypes API which is no longer supported and will be removed in the next major release. Use React.createContext() instead\n\n.Learn more about this warning here: https://reactjs.org/link/legacy-context", name);
                }
                if (ctor.contextTypes && !didWarnAboutLegacyContext$1.has(ctor) && // Strict Mode has its own warning for legacy context, so we can skip
                // this one.
                (workInProgress2.mode & StrictLegacyMode) === NoMode) {
                  didWarnAboutLegacyContext$1.add(ctor);
                  error("%s uses the legacy contextTypes API which is no longer supported and will be removed in the next major release. Use React.createContext() with static contextType instead.\n\nLearn more about this warning here: https://reactjs.org/link/legacy-context", name);
                }
                if (instance.contextTypes) {
                  error("contextTypes was defined as an instance property on %s. Use a static property to define contextTypes instead.", name);
                }
                if (ctor.contextType && ctor.contextTypes && !didWarnAboutContextTypeAndContextTypes.has(ctor)) {
                  didWarnAboutContextTypeAndContextTypes.add(ctor);
                  error("%s declares both contextTypes and contextType static properties. The legacy contextTypes property will be ignored.", name);
                }
              }
              if (typeof instance.componentShouldUpdate === "function") {
                error("%s has a method called componentShouldUpdate(). Did you mean shouldComponentUpdate()? The name is phrased as a question because the function is expected to return a value.", name);
              }
              if (ctor.prototype && ctor.prototype.isPureReactComponent && typeof instance.shouldComponentUpdate !== "undefined") {
                error("%s has a method called shouldComponentUpdate(). shouldComponentUpdate should not be used when extending React.PureComponent. Please extend React.Component if shouldComponentUpdate is used.", getComponentNameFromType(ctor) || "A pure component");
              }
              if (typeof instance.componentDidUnmount === "function") {
                error("%s has a method called componentDidUnmount(). But there is no such lifecycle method. Did you mean componentWillUnmount()?", name);
              }
              if (typeof instance.componentDidReceiveProps === "function") {
                error("%s has a method called componentDidReceiveProps(). But there is no such lifecycle method. If you meant to update the state in response to changing props, use componentWillReceiveProps(). If you meant to fetch data or run side-effects or mutations after React has updated the UI, use componentDidUpdate().", name);
              }
              if (typeof instance.componentWillRecieveProps === "function") {
                error("%s has a method called componentWillRecieveProps(). Did you mean componentWillReceiveProps()?", name);
              }
              if (typeof instance.UNSAFE_componentWillRecieveProps === "function") {
                error("%s has a method called UNSAFE_componentWillRecieveProps(). Did you mean UNSAFE_componentWillReceiveProps()?", name);
              }
              var hasMutatedProps = instance.props !== newProps;
              if (instance.props !== void 0 && hasMutatedProps) {
                error("%s(...): When calling super() in `%s`, make sure to pass up the same props that your component's constructor was passed.", name, name);
              }
              if (instance.defaultProps) {
                error("Setting defaultProps as an instance property on %s is not supported and will be ignored. Instead, define defaultProps as a static property on %s.", name, name);
              }
              if (typeof instance.getSnapshotBeforeUpdate === "function" && typeof instance.componentDidUpdate !== "function" && !didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate.has(ctor)) {
                didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate.add(ctor);
                error("%s: getSnapshotBeforeUpdate() should be used with componentDidUpdate(). This component defines getSnapshotBeforeUpdate() only.", getComponentNameFromType(ctor));
              }
              if (typeof instance.getDerivedStateFromProps === "function") {
                error("%s: getDerivedStateFromProps() is defined as an instance method and will be ignored. Instead, declare it as a static method.", name);
              }
              if (typeof instance.getDerivedStateFromError === "function") {
                error("%s: getDerivedStateFromError() is defined as an instance method and will be ignored. Instead, declare it as a static method.", name);
              }
              if (typeof ctor.getSnapshotBeforeUpdate === "function") {
                error("%s: getSnapshotBeforeUpdate() is defined as a static method and will be ignored. Instead, declare it as an instance method.", name);
              }
              var _state = instance.state;
              if (_state && (typeof _state !== "object" || isArray(_state))) {
                error("%s.state: must be set to an object or null", name);
              }
              if (typeof instance.getChildContext === "function" && typeof ctor.childContextTypes !== "object") {
                error("%s.getChildContext(): childContextTypes must be defined in order to use getChildContext().", name);
              }
            }
          }
          function adoptClassInstance(workInProgress2, instance) {
            instance.updater = classComponentUpdater;
            workInProgress2.stateNode = instance;
            set(instance, workInProgress2);
            {
              instance._reactInternalInstance = fakeInternalInstance;
            }
          }
          function constructClassInstance(workInProgress2, ctor, props) {
            var isLegacyContextConsumer = false;
            var unmaskedContext = emptyContextObject;
            var context = emptyContextObject;
            var contextType = ctor.contextType;
            {
              if ("contextType" in ctor) {
                var isValid = (
                  // Allow null for conditional declaration
                  contextType === null || contextType !== void 0 && contextType.$$typeof === REACT_CONTEXT_TYPE && contextType._context === void 0
                );
                if (!isValid && !didWarnAboutInvalidateContextType.has(ctor)) {
                  didWarnAboutInvalidateContextType.add(ctor);
                  var addendum = "";
                  if (contextType === void 0) {
                    addendum = " However, it is set to undefined. This can be caused by a typo or by mixing up named and default imports. This can also happen due to a circular dependency, so try moving the createContext() call to a separate file.";
                  } else if (typeof contextType !== "object") {
                    addendum = " However, it is set to a " + typeof contextType + ".";
                  } else if (contextType.$$typeof === REACT_PROVIDER_TYPE) {
                    addendum = " Did you accidentally pass the Context.Provider instead?";
                  } else if (contextType._context !== void 0) {
                    addendum = " Did you accidentally pass the Context.Consumer instead?";
                  } else {
                    addendum = " However, it is set to an object with keys {" + Object.keys(contextType).join(", ") + "}.";
                  }
                  error("%s defines an invalid contextType. contextType should point to the Context object returned by React.createContext().%s", getComponentNameFromType(ctor) || "Component", addendum);
                }
              }
            }
            if (typeof contextType === "object" && contextType !== null) {
              context = readContext(contextType);
            } else {
              unmaskedContext = getUnmaskedContext(workInProgress2, ctor, true);
              var contextTypes = ctor.contextTypes;
              isLegacyContextConsumer = contextTypes !== null && contextTypes !== void 0;
              context = isLegacyContextConsumer ? getMaskedContext(workInProgress2, unmaskedContext) : emptyContextObject;
            }
            var instance = new ctor(props, context);
            {
              if (workInProgress2.mode & StrictLegacyMode) {
                setIsStrictModeForDevtools(true);
                try {
                  instance = new ctor(props, context);
                } finally {
                  setIsStrictModeForDevtools(false);
                }
              }
            }
            var state = workInProgress2.memoizedState = instance.state !== null && instance.state !== void 0 ? instance.state : null;
            adoptClassInstance(workInProgress2, instance);
            {
              if (typeof ctor.getDerivedStateFromProps === "function" && state === null) {
                var componentName = getComponentNameFromType(ctor) || "Component";
                if (!didWarnAboutUninitializedState.has(componentName)) {
                  didWarnAboutUninitializedState.add(componentName);
                  error("`%s` uses `getDerivedStateFromProps` but its initial state is %s. This is not recommended. Instead, define the initial state by assigning an object to `this.state` in the constructor of `%s`. This ensures that `getDerivedStateFromProps` arguments have a consistent shape.", componentName, instance.state === null ? "null" : "undefined", componentName);
                }
              }
              if (typeof ctor.getDerivedStateFromProps === "function" || typeof instance.getSnapshotBeforeUpdate === "function") {
                var foundWillMountName = null;
                var foundWillReceivePropsName = null;
                var foundWillUpdateName = null;
                if (typeof instance.componentWillMount === "function" && instance.componentWillMount.__suppressDeprecationWarning !== true) {
                  foundWillMountName = "componentWillMount";
                } else if (typeof instance.UNSAFE_componentWillMount === "function") {
                  foundWillMountName = "UNSAFE_componentWillMount";
                }
                if (typeof instance.componentWillReceiveProps === "function" && instance.componentWillReceiveProps.__suppressDeprecationWarning !== true) {
                  foundWillReceivePropsName = "componentWillReceiveProps";
                } else if (typeof instance.UNSAFE_componentWillReceiveProps === "function") {
                  foundWillReceivePropsName = "UNSAFE_componentWillReceiveProps";
                }
                if (typeof instance.componentWillUpdate === "function" && instance.componentWillUpdate.__suppressDeprecationWarning !== true) {
                  foundWillUpdateName = "componentWillUpdate";
                } else if (typeof instance.UNSAFE_componentWillUpdate === "function") {
                  foundWillUpdateName = "UNSAFE_componentWillUpdate";
                }
                if (foundWillMountName !== null || foundWillReceivePropsName !== null || foundWillUpdateName !== null) {
                  var _componentName = getComponentNameFromType(ctor) || "Component";
                  var newApiName = typeof ctor.getDerivedStateFromProps === "function" ? "getDerivedStateFromProps()" : "getSnapshotBeforeUpdate()";
                  if (!didWarnAboutLegacyLifecyclesAndDerivedState.has(_componentName)) {
                    didWarnAboutLegacyLifecyclesAndDerivedState.add(_componentName);
                    error("Unsafe legacy lifecycles will not be called for components using new component APIs.\n\n%s uses %s but also contains the following legacy lifecycles:%s%s%s\n\nThe above lifecycles should be removed. Learn more about this warning here:\nhttps://reactjs.org/link/unsafe-component-lifecycles", _componentName, newApiName, foundWillMountName !== null ? "\n  " + foundWillMountName : "", foundWillReceivePropsName !== null ? "\n  " + foundWillReceivePropsName : "", foundWillUpdateName !== null ? "\n  " + foundWillUpdateName : "");
                  }
                }
              }
            }
            if (isLegacyContextConsumer) {
              cacheContext(workInProgress2, unmaskedContext, context);
            }
            return instance;
          }
          function callComponentWillMount(workInProgress2, instance) {
            var oldState = instance.state;
            if (typeof instance.componentWillMount === "function") {
              instance.componentWillMount();
            }
            if (typeof instance.UNSAFE_componentWillMount === "function") {
              instance.UNSAFE_componentWillMount();
            }
            if (oldState !== instance.state) {
              {
                error("%s.componentWillMount(): Assigning directly to this.state is deprecated (except inside a component's constructor). Use setState instead.", getComponentNameFromFiber(workInProgress2) || "Component");
              }
              classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
            }
          }
          function callComponentWillReceiveProps(workInProgress2, instance, newProps, nextContext) {
            var oldState = instance.state;
            if (typeof instance.componentWillReceiveProps === "function") {
              instance.componentWillReceiveProps(newProps, nextContext);
            }
            if (typeof instance.UNSAFE_componentWillReceiveProps === "function") {
              instance.UNSAFE_componentWillReceiveProps(newProps, nextContext);
            }
            if (instance.state !== oldState) {
              {
                var componentName = getComponentNameFromFiber(workInProgress2) || "Component";
                if (!didWarnAboutStateAssignmentForComponent.has(componentName)) {
                  didWarnAboutStateAssignmentForComponent.add(componentName);
                  error("%s.componentWillReceiveProps(): Assigning directly to this.state is deprecated (except inside a component's constructor). Use setState instead.", componentName);
                }
              }
              classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
            }
          }
          function mountClassInstance(workInProgress2, ctor, newProps, renderLanes2) {
            {
              checkClassInstance(workInProgress2, ctor, newProps);
            }
            var instance = workInProgress2.stateNode;
            instance.props = newProps;
            instance.state = workInProgress2.memoizedState;
            instance.refs = {};
            initializeUpdateQueue(workInProgress2);
            var contextType = ctor.contextType;
            if (typeof contextType === "object" && contextType !== null) {
              instance.context = readContext(contextType);
            } else {
              var unmaskedContext = getUnmaskedContext(workInProgress2, ctor, true);
              instance.context = getMaskedContext(workInProgress2, unmaskedContext);
            }
            {
              if (instance.state === newProps) {
                var componentName = getComponentNameFromType(ctor) || "Component";
                if (!didWarnAboutDirectlyAssigningPropsToState.has(componentName)) {
                  didWarnAboutDirectlyAssigningPropsToState.add(componentName);
                  error("%s: It is not recommended to assign props directly to state because updates to props won't be reflected in state. In most cases, it is better to use props directly.", componentName);
                }
              }
              if (workInProgress2.mode & StrictLegacyMode) {
                ReactStrictModeWarnings.recordLegacyContextWarning(workInProgress2, instance);
              }
              {
                ReactStrictModeWarnings.recordUnsafeLifecycleWarnings(workInProgress2, instance);
              }
            }
            instance.state = workInProgress2.memoizedState;
            var getDerivedStateFromProps = ctor.getDerivedStateFromProps;
            if (typeof getDerivedStateFromProps === "function") {
              applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, newProps);
              instance.state = workInProgress2.memoizedState;
            }
            if (typeof ctor.getDerivedStateFromProps !== "function" && typeof instance.getSnapshotBeforeUpdate !== "function" && (typeof instance.UNSAFE_componentWillMount === "function" || typeof instance.componentWillMount === "function")) {
              callComponentWillMount(workInProgress2, instance);
              processUpdateQueue(workInProgress2, newProps, instance, renderLanes2);
              instance.state = workInProgress2.memoizedState;
            }
            if (typeof instance.componentDidMount === "function") {
              var fiberFlags = Update;
              {
                fiberFlags |= LayoutStatic;
              }
              if ((workInProgress2.mode & StrictEffectsMode) !== NoMode) {
                fiberFlags |= MountLayoutDev;
              }
              workInProgress2.flags |= fiberFlags;
            }
          }
          function resumeMountClassInstance(workInProgress2, ctor, newProps, renderLanes2) {
            var instance = workInProgress2.stateNode;
            var oldProps = workInProgress2.memoizedProps;
            instance.props = oldProps;
            var oldContext = instance.context;
            var contextType = ctor.contextType;
            var nextContext = emptyContextObject;
            if (typeof contextType === "object" && contextType !== null) {
              nextContext = readContext(contextType);
            } else {
              var nextLegacyUnmaskedContext = getUnmaskedContext(workInProgress2, ctor, true);
              nextContext = getMaskedContext(workInProgress2, nextLegacyUnmaskedContext);
            }
            var getDerivedStateFromProps = ctor.getDerivedStateFromProps;
            var hasNewLifecycles = typeof getDerivedStateFromProps === "function" || typeof instance.getSnapshotBeforeUpdate === "function";
            if (!hasNewLifecycles && (typeof instance.UNSAFE_componentWillReceiveProps === "function" || typeof instance.componentWillReceiveProps === "function")) {
              if (oldProps !== newProps || oldContext !== nextContext) {
                callComponentWillReceiveProps(workInProgress2, instance, newProps, nextContext);
              }
            }
            resetHasForceUpdateBeforeProcessing();
            var oldState = workInProgress2.memoizedState;
            var newState = instance.state = oldState;
            processUpdateQueue(workInProgress2, newProps, instance, renderLanes2);
            newState = workInProgress2.memoizedState;
            if (oldProps === newProps && oldState === newState && !hasContextChanged() && !checkHasForceUpdateAfterProcessing()) {
              if (typeof instance.componentDidMount === "function") {
                var fiberFlags = Update;
                {
                  fiberFlags |= LayoutStatic;
                }
                if ((workInProgress2.mode & StrictEffectsMode) !== NoMode) {
                  fiberFlags |= MountLayoutDev;
                }
                workInProgress2.flags |= fiberFlags;
              }
              return false;
            }
            if (typeof getDerivedStateFromProps === "function") {
              applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, newProps);
              newState = workInProgress2.memoizedState;
            }
            var shouldUpdate = checkHasForceUpdateAfterProcessing() || checkShouldComponentUpdate(workInProgress2, ctor, oldProps, newProps, oldState, newState, nextContext);
            if (shouldUpdate) {
              if (!hasNewLifecycles && (typeof instance.UNSAFE_componentWillMount === "function" || typeof instance.componentWillMount === "function")) {
                if (typeof instance.componentWillMount === "function") {
                  instance.componentWillMount();
                }
                if (typeof instance.UNSAFE_componentWillMount === "function") {
                  instance.UNSAFE_componentWillMount();
                }
              }
              if (typeof instance.componentDidMount === "function") {
                var _fiberFlags = Update;
                {
                  _fiberFlags |= LayoutStatic;
                }
                if ((workInProgress2.mode & StrictEffectsMode) !== NoMode) {
                  _fiberFlags |= MountLayoutDev;
                }
                workInProgress2.flags |= _fiberFlags;
              }
            } else {
              if (typeof instance.componentDidMount === "function") {
                var _fiberFlags2 = Update;
                {
                  _fiberFlags2 |= LayoutStatic;
                }
                if ((workInProgress2.mode & StrictEffectsMode) !== NoMode) {
                  _fiberFlags2 |= MountLayoutDev;
                }
                workInProgress2.flags |= _fiberFlags2;
              }
              workInProgress2.memoizedProps = newProps;
              workInProgress2.memoizedState = newState;
            }
            instance.props = newProps;
            instance.state = newState;
            instance.context = nextContext;
            return shouldUpdate;
          }
          function updateClassInstance(current2, workInProgress2, ctor, newProps, renderLanes2) {
            var instance = workInProgress2.stateNode;
            cloneUpdateQueue(current2, workInProgress2);
            var unresolvedOldProps = workInProgress2.memoizedProps;
            var oldProps = workInProgress2.type === workInProgress2.elementType ? unresolvedOldProps : resolveDefaultProps(workInProgress2.type, unresolvedOldProps);
            instance.props = oldProps;
            var unresolvedNewProps = workInProgress2.pendingProps;
            var oldContext = instance.context;
            var contextType = ctor.contextType;
            var nextContext = emptyContextObject;
            if (typeof contextType === "object" && contextType !== null) {
              nextContext = readContext(contextType);
            } else {
              var nextUnmaskedContext = getUnmaskedContext(workInProgress2, ctor, true);
              nextContext = getMaskedContext(workInProgress2, nextUnmaskedContext);
            }
            var getDerivedStateFromProps = ctor.getDerivedStateFromProps;
            var hasNewLifecycles = typeof getDerivedStateFromProps === "function" || typeof instance.getSnapshotBeforeUpdate === "function";
            if (!hasNewLifecycles && (typeof instance.UNSAFE_componentWillReceiveProps === "function" || typeof instance.componentWillReceiveProps === "function")) {
              if (unresolvedOldProps !== unresolvedNewProps || oldContext !== nextContext) {
                callComponentWillReceiveProps(workInProgress2, instance, newProps, nextContext);
              }
            }
            resetHasForceUpdateBeforeProcessing();
            var oldState = workInProgress2.memoizedState;
            var newState = instance.state = oldState;
            processUpdateQueue(workInProgress2, newProps, instance, renderLanes2);
            newState = workInProgress2.memoizedState;
            if (unresolvedOldProps === unresolvedNewProps && oldState === newState && !hasContextChanged() && !checkHasForceUpdateAfterProcessing() && !enableLazyContextPropagation) {
              if (typeof instance.componentDidUpdate === "function") {
                if (unresolvedOldProps !== current2.memoizedProps || oldState !== current2.memoizedState) {
                  workInProgress2.flags |= Update;
                }
              }
              if (typeof instance.getSnapshotBeforeUpdate === "function") {
                if (unresolvedOldProps !== current2.memoizedProps || oldState !== current2.memoizedState) {
                  workInProgress2.flags |= Snapshot;
                }
              }
              return false;
            }
            if (typeof getDerivedStateFromProps === "function") {
              applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, newProps);
              newState = workInProgress2.memoizedState;
            }
            var shouldUpdate = checkHasForceUpdateAfterProcessing() || checkShouldComponentUpdate(workInProgress2, ctor, oldProps, newProps, oldState, newState, nextContext) || // TODO: In some cases, we'll end up checking if context has changed twice,
            // both before and after `shouldComponentUpdate` has been called. Not ideal,
            // but I'm loath to refactor this function. This only happens for memoized
            // components so it's not that common.
            enableLazyContextPropagation;
            if (shouldUpdate) {
              if (!hasNewLifecycles && (typeof instance.UNSAFE_componentWillUpdate === "function" || typeof instance.componentWillUpdate === "function")) {
                if (typeof instance.componentWillUpdate === "function") {
                  instance.componentWillUpdate(newProps, newState, nextContext);
                }
                if (typeof instance.UNSAFE_componentWillUpdate === "function") {
                  instance.UNSAFE_componentWillUpdate(newProps, newState, nextContext);
                }
              }
              if (typeof instance.componentDidUpdate === "function") {
                workInProgress2.flags |= Update;
              }
              if (typeof instance.getSnapshotBeforeUpdate === "function") {
                workInProgress2.flags |= Snapshot;
              }
            } else {
              if (typeof instance.componentDidUpdate === "function") {
                if (unresolvedOldProps !== current2.memoizedProps || oldState !== current2.memoizedState) {
                  workInProgress2.flags |= Update;
                }
              }
              if (typeof instance.getSnapshotBeforeUpdate === "function") {
                if (unresolvedOldProps !== current2.memoizedProps || oldState !== current2.memoizedState) {
                  workInProgress2.flags |= Snapshot;
                }
              }
              workInProgress2.memoizedProps = newProps;
              workInProgress2.memoizedState = newState;
            }
            instance.props = newProps;
            instance.state = newState;
            instance.context = nextContext;
            return shouldUpdate;
          }
          function createCapturedValueAtFiber(value, source) {
            return {
              value,
              source,
              stack: getStackByFiberInDevAndProd(source),
              digest: null
            };
          }
          function createCapturedValue(value, digest, stack) {
            return {
              value,
              source: null,
              stack: stack != null ? stack : null,
              digest: digest != null ? digest : null
            };
          }
          function showErrorDialog(boundary, errorInfo) {
            return true;
          }
          function logCapturedError(boundary, errorInfo) {
            try {
              var logError = showErrorDialog(boundary, errorInfo);
              if (logError === false) {
                return;
              }
              var error2 = errorInfo.value;
              if (true) {
                var source = errorInfo.source;
                var stack = errorInfo.stack;
                var componentStack = stack !== null ? stack : "";
                if (error2 != null && error2._suppressLogging) {
                  if (boundary.tag === ClassComponent) {
                    return;
                  }
                  console["error"](error2);
                }
                var componentName = source ? getComponentNameFromFiber(source) : null;
                var componentNameMessage = componentName ? "The above error occurred in the <" + componentName + "> component:" : "The above error occurred in one of your React components:";
                var errorBoundaryMessage;
                if (boundary.tag === HostRoot) {
                  errorBoundaryMessage = "Consider adding an error boundary to your tree to customize error handling behavior.\nVisit https://reactjs.org/link/error-boundaries to learn more about error boundaries.";
                } else {
                  var errorBoundaryName = getComponentNameFromFiber(boundary) || "Anonymous";
                  errorBoundaryMessage = "React will try to recreate this component tree from scratch " + ("using the error boundary you provided, " + errorBoundaryName + ".");
                }
                var combinedMessage = componentNameMessage + "\n" + componentStack + "\n\n" + ("" + errorBoundaryMessage);
                console["error"](combinedMessage);
              } else {
                console["error"](error2);
              }
            } catch (e) {
              setTimeout(function() {
                throw e;
              });
            }
          }
          var PossiblyWeakMap$1 = typeof WeakMap === "function" ? WeakMap : Map;
          function createRootErrorUpdate(fiber, errorInfo, lane) {
            var update = createUpdate(NoTimestamp, lane);
            update.tag = CaptureUpdate;
            update.payload = {
              element: null
            };
            var error2 = errorInfo.value;
            update.callback = function() {
              onUncaughtError(error2);
              logCapturedError(fiber, errorInfo);
            };
            return update;
          }
          function createClassErrorUpdate(fiber, errorInfo, lane) {
            var update = createUpdate(NoTimestamp, lane);
            update.tag = CaptureUpdate;
            var getDerivedStateFromError = fiber.type.getDerivedStateFromError;
            if (typeof getDerivedStateFromError === "function") {
              var error$1 = errorInfo.value;
              update.payload = function() {
                return getDerivedStateFromError(error$1);
              };
              update.callback = function() {
                {
                  markFailedErrorBoundaryForHotReloading(fiber);
                }
                logCapturedError(fiber, errorInfo);
              };
            }
            var inst = fiber.stateNode;
            if (inst !== null && typeof inst.componentDidCatch === "function") {
              update.callback = function callback() {
                {
                  markFailedErrorBoundaryForHotReloading(fiber);
                }
                logCapturedError(fiber, errorInfo);
                if (typeof getDerivedStateFromError !== "function") {
                  markLegacyErrorBoundaryAsFailed(this);
                }
                var error$12 = errorInfo.value;
                var stack = errorInfo.stack;
                this.componentDidCatch(error$12, {
                  componentStack: stack !== null ? stack : ""
                });
                {
                  if (typeof getDerivedStateFromError !== "function") {
                    if (!includesSomeLane(fiber.lanes, SyncLane)) {
                      error("%s: Error boundaries should implement getDerivedStateFromError(). In that method, return a state update to display an error message or fallback UI.", getComponentNameFromFiber(fiber) || "Unknown");
                    }
                  }
                }
              };
            }
            return update;
          }
          function attachPingListener(root, wakeable, lanes) {
            var pingCache = root.pingCache;
            var threadIDs;
            if (pingCache === null) {
              pingCache = root.pingCache = new PossiblyWeakMap$1();
              threadIDs = /* @__PURE__ */ new Set();
              pingCache.set(wakeable, threadIDs);
            } else {
              threadIDs = pingCache.get(wakeable);
              if (threadIDs === void 0) {
                threadIDs = /* @__PURE__ */ new Set();
                pingCache.set(wakeable, threadIDs);
              }
            }
            if (!threadIDs.has(lanes)) {
              threadIDs.add(lanes);
              var ping = pingSuspendedRoot.bind(null, root, wakeable, lanes);
              {
                if (isDevToolsPresent) {
                  restorePendingUpdaters(root, lanes);
                }
              }
              wakeable.then(ping, ping);
            }
          }
          function attachRetryListener(suspenseBoundary, root, wakeable, lanes) {
            var wakeables = suspenseBoundary.updateQueue;
            if (wakeables === null) {
              var updateQueue = /* @__PURE__ */ new Set();
              updateQueue.add(wakeable);
              suspenseBoundary.updateQueue = updateQueue;
            } else {
              wakeables.add(wakeable);
            }
          }
          function resetSuspendedComponent(sourceFiber, rootRenderLanes) {
            var tag = sourceFiber.tag;
            if ((sourceFiber.mode & ConcurrentMode) === NoMode && (tag === FunctionComponent || tag === ForwardRef || tag === SimpleMemoComponent)) {
              var currentSource = sourceFiber.alternate;
              if (currentSource) {
                sourceFiber.updateQueue = currentSource.updateQueue;
                sourceFiber.memoizedState = currentSource.memoizedState;
                sourceFiber.lanes = currentSource.lanes;
              } else {
                sourceFiber.updateQueue = null;
                sourceFiber.memoizedState = null;
              }
            }
          }
          function getNearestSuspenseBoundaryToCapture(returnFiber) {
            var node = returnFiber;
            do {
              if (node.tag === SuspenseComponent && shouldCaptureSuspense(node)) {
                return node;
              }
              node = node.return;
            } while (node !== null);
            return null;
          }
          function markSuspenseBoundaryShouldCapture(suspenseBoundary, returnFiber, sourceFiber, root, rootRenderLanes) {
            if ((suspenseBoundary.mode & ConcurrentMode) === NoMode) {
              if (suspenseBoundary === returnFiber) {
                suspenseBoundary.flags |= ShouldCapture;
              } else {
                suspenseBoundary.flags |= DidCapture;
                sourceFiber.flags |= ForceUpdateForLegacySuspense;
                sourceFiber.flags &= ~(LifecycleEffectMask | Incomplete);
                if (sourceFiber.tag === ClassComponent) {
                  var currentSourceFiber = sourceFiber.alternate;
                  if (currentSourceFiber === null) {
                    sourceFiber.tag = IncompleteClassComponent;
                  } else {
                    var update = createUpdate(NoTimestamp, SyncLane);
                    update.tag = ForceUpdate;
                    enqueueUpdate(sourceFiber, update, SyncLane);
                  }
                }
                sourceFiber.lanes = mergeLanes(sourceFiber.lanes, SyncLane);
              }
              return suspenseBoundary;
            }
            suspenseBoundary.flags |= ShouldCapture;
            suspenseBoundary.lanes = rootRenderLanes;
            return suspenseBoundary;
          }
          function throwException(root, returnFiber, sourceFiber, value, rootRenderLanes) {
            sourceFiber.flags |= Incomplete;
            {
              if (isDevToolsPresent) {
                restorePendingUpdaters(root, rootRenderLanes);
              }
            }
            if (value !== null && typeof value === "object" && typeof value.then === "function") {
              var wakeable = value;
              resetSuspendedComponent(sourceFiber);
              {
                if (getIsHydrating() && sourceFiber.mode & ConcurrentMode) {
                  markDidThrowWhileHydratingDEV();
                }
              }
              var suspenseBoundary = getNearestSuspenseBoundaryToCapture(returnFiber);
              if (suspenseBoundary !== null) {
                suspenseBoundary.flags &= ~ForceClientRender;
                markSuspenseBoundaryShouldCapture(suspenseBoundary, returnFiber, sourceFiber, root, rootRenderLanes);
                if (suspenseBoundary.mode & ConcurrentMode) {
                  attachPingListener(root, wakeable, rootRenderLanes);
                }
                attachRetryListener(suspenseBoundary, root, wakeable);
                return;
              } else {
                if (!includesSyncLane(rootRenderLanes)) {
                  attachPingListener(root, wakeable, rootRenderLanes);
                  renderDidSuspendDelayIfPossible();
                  return;
                }
                var uncaughtSuspenseError = new Error("A component suspended while responding to synchronous input. This will cause the UI to be replaced with a loading indicator. To fix, updates that suspend should be wrapped with startTransition.");
                value = uncaughtSuspenseError;
              }
            } else {
              if (getIsHydrating() && sourceFiber.mode & ConcurrentMode) {
                markDidThrowWhileHydratingDEV();
                var _suspenseBoundary = getNearestSuspenseBoundaryToCapture(returnFiber);
                if (_suspenseBoundary !== null) {
                  if ((_suspenseBoundary.flags & ShouldCapture) === NoFlags) {
                    _suspenseBoundary.flags |= ForceClientRender;
                  }
                  markSuspenseBoundaryShouldCapture(_suspenseBoundary, returnFiber, sourceFiber, root, rootRenderLanes);
                  queueHydrationError(createCapturedValueAtFiber(value, sourceFiber));
                  return;
                }
              }
            }
            value = createCapturedValueAtFiber(value, sourceFiber);
            renderDidError(value);
            var workInProgress2 = returnFiber;
            do {
              switch (workInProgress2.tag) {
                case HostRoot: {
                  var _errorInfo = value;
                  workInProgress2.flags |= ShouldCapture;
                  var lane = pickArbitraryLane(rootRenderLanes);
                  workInProgress2.lanes = mergeLanes(workInProgress2.lanes, lane);
                  var update = createRootErrorUpdate(workInProgress2, _errorInfo, lane);
                  enqueueCapturedUpdate(workInProgress2, update);
                  return;
                }
                case ClassComponent:
                  var errorInfo = value;
                  var ctor = workInProgress2.type;
                  var instance = workInProgress2.stateNode;
                  if ((workInProgress2.flags & DidCapture) === NoFlags && (typeof ctor.getDerivedStateFromError === "function" || instance !== null && typeof instance.componentDidCatch === "function" && !isAlreadyFailedLegacyErrorBoundary(instance))) {
                    workInProgress2.flags |= ShouldCapture;
                    var _lane = pickArbitraryLane(rootRenderLanes);
                    workInProgress2.lanes = mergeLanes(workInProgress2.lanes, _lane);
                    var _update = createClassErrorUpdate(workInProgress2, errorInfo, _lane);
                    enqueueCapturedUpdate(workInProgress2, _update);
                    return;
                  }
                  break;
              }
              workInProgress2 = workInProgress2.return;
            } while (workInProgress2 !== null);
          }
          function getSuspendedCache() {
            {
              return null;
            }
          }
          var ReactCurrentOwner$1 = ReactSharedInternals.ReactCurrentOwner;
          var didReceiveUpdate = false;
          var didWarnAboutBadClass;
          var didWarnAboutModulePatternComponent;
          var didWarnAboutContextTypeOnFunctionComponent;
          var didWarnAboutGetDerivedStateOnFunctionComponent;
          var didWarnAboutFunctionRefs;
          var didWarnAboutReassigningProps;
          var didWarnAboutRevealOrder;
          var didWarnAboutTailOptions;
          var didWarnAboutDefaultPropsOnFunctionComponent;
          {
            didWarnAboutBadClass = {};
            didWarnAboutModulePatternComponent = {};
            didWarnAboutContextTypeOnFunctionComponent = {};
            didWarnAboutGetDerivedStateOnFunctionComponent = {};
            didWarnAboutFunctionRefs = {};
            didWarnAboutReassigningProps = false;
            didWarnAboutRevealOrder = {};
            didWarnAboutTailOptions = {};
            didWarnAboutDefaultPropsOnFunctionComponent = {};
          }
          function reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2) {
            if (current2 === null) {
              workInProgress2.child = mountChildFibers(workInProgress2, null, nextChildren, renderLanes2);
            } else {
              workInProgress2.child = reconcileChildFibers(workInProgress2, current2.child, nextChildren, renderLanes2);
            }
          }
          function forceUnmountCurrentAndReconcile(current2, workInProgress2, nextChildren, renderLanes2) {
            workInProgress2.child = reconcileChildFibers(workInProgress2, current2.child, null, renderLanes2);
            workInProgress2.child = reconcileChildFibers(workInProgress2, null, nextChildren, renderLanes2);
          }
          function updateForwardRef(current2, workInProgress2, Component, nextProps, renderLanes2) {
            {
              if (workInProgress2.type !== workInProgress2.elementType) {
                var innerPropTypes = Component.propTypes;
                if (innerPropTypes) {
                  checkPropTypes(
                    innerPropTypes,
                    nextProps,
                    // Resolved props
                    "prop",
                    getComponentNameFromType(Component)
                  );
                }
              }
            }
            var render = Component.render;
            var ref = workInProgress2.ref;
            var nextChildren;
            var hasId;
            prepareToReadContext(workInProgress2, renderLanes2);
            {
              markComponentRenderStarted(workInProgress2);
            }
            {
              ReactCurrentOwner$1.current = workInProgress2;
              setIsRendering(true);
              nextChildren = renderWithHooks(current2, workInProgress2, render, nextProps, ref, renderLanes2);
              hasId = checkDidRenderIdHook();
              if (workInProgress2.mode & StrictLegacyMode) {
                setIsStrictModeForDevtools(true);
                try {
                  nextChildren = renderWithHooks(current2, workInProgress2, render, nextProps, ref, renderLanes2);
                  hasId = checkDidRenderIdHook();
                } finally {
                  setIsStrictModeForDevtools(false);
                }
              }
              setIsRendering(false);
            }
            {
              markComponentRenderStopped();
            }
            if (current2 !== null && !didReceiveUpdate) {
              bailoutHooks(current2, workInProgress2, renderLanes2);
              return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
            }
            if (getIsHydrating() && hasId) {
              pushMaterializedTreeId(workInProgress2);
            }
            workInProgress2.flags |= PerformedWork;
            reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            return workInProgress2.child;
          }
          function updateMemoComponent(current2, workInProgress2, Component, nextProps, renderLanes2) {
            if (current2 === null) {
              var type = Component.type;
              if (isSimpleFunctionComponent(type) && Component.compare === null && // SimpleMemoComponent codepath doesn't resolve outer props either.
              Component.defaultProps === void 0) {
                var resolvedType = type;
                {
                  resolvedType = resolveFunctionForHotReloading(type);
                }
                workInProgress2.tag = SimpleMemoComponent;
                workInProgress2.type = resolvedType;
                {
                  validateFunctionComponentInDev(workInProgress2, type);
                }
                return updateSimpleMemoComponent(current2, workInProgress2, resolvedType, nextProps, renderLanes2);
              }
              {
                var innerPropTypes = type.propTypes;
                if (innerPropTypes) {
                  checkPropTypes(
                    innerPropTypes,
                    nextProps,
                    // Resolved props
                    "prop",
                    getComponentNameFromType(type)
                  );
                }
                if (Component.defaultProps !== void 0) {
                  var componentName = getComponentNameFromType(type) || "Unknown";
                  if (!didWarnAboutDefaultPropsOnFunctionComponent[componentName]) {
                    error("%s: Support for defaultProps will be removed from memo components in a future major release. Use JavaScript default parameters instead.", componentName);
                    didWarnAboutDefaultPropsOnFunctionComponent[componentName] = true;
                  }
                }
              }
              var child = createFiberFromTypeAndProps(Component.type, null, nextProps, workInProgress2, workInProgress2.mode, renderLanes2);
              child.ref = workInProgress2.ref;
              child.return = workInProgress2;
              workInProgress2.child = child;
              return child;
            }
            {
              var _type = Component.type;
              var _innerPropTypes = _type.propTypes;
              if (_innerPropTypes) {
                checkPropTypes(
                  _innerPropTypes,
                  nextProps,
                  // Resolved props
                  "prop",
                  getComponentNameFromType(_type)
                );
              }
            }
            var currentChild = current2.child;
            var hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current2, renderLanes2);
            if (!hasScheduledUpdateOrContext) {
              var prevProps = currentChild.memoizedProps;
              var compare = Component.compare;
              compare = compare !== null ? compare : shallowEqual;
              if (compare(prevProps, nextProps) && current2.ref === workInProgress2.ref) {
                return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
              }
            }
            workInProgress2.flags |= PerformedWork;
            var newChild = createWorkInProgress(currentChild, nextProps);
            newChild.ref = workInProgress2.ref;
            newChild.return = workInProgress2;
            workInProgress2.child = newChild;
            return newChild;
          }
          function updateSimpleMemoComponent(current2, workInProgress2, Component, nextProps, renderLanes2) {
            {
              if (workInProgress2.type !== workInProgress2.elementType) {
                var outerMemoType = workInProgress2.elementType;
                if (outerMemoType.$$typeof === REACT_LAZY_TYPE) {
                  var lazyComponent = outerMemoType;
                  var payload = lazyComponent._payload;
                  var init = lazyComponent._init;
                  try {
                    outerMemoType = init(payload);
                  } catch (x) {
                    outerMemoType = null;
                  }
                  var outerPropTypes = outerMemoType && outerMemoType.propTypes;
                  if (outerPropTypes) {
                    checkPropTypes(
                      outerPropTypes,
                      nextProps,
                      // Resolved (SimpleMemoComponent has no defaultProps)
                      "prop",
                      getComponentNameFromType(outerMemoType)
                    );
                  }
                }
              }
            }
            if (current2 !== null) {
              var prevProps = current2.memoizedProps;
              if (shallowEqual(prevProps, nextProps) && current2.ref === workInProgress2.ref && // Prevent bailout if the implementation changed due to hot reload.
              workInProgress2.type === current2.type) {
                didReceiveUpdate = false;
                workInProgress2.pendingProps = nextProps = prevProps;
                if (!checkScheduledUpdateOrContext(current2, renderLanes2)) {
                  workInProgress2.lanes = current2.lanes;
                  return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
                } else if ((current2.flags & ForceUpdateForLegacySuspense) !== NoFlags) {
                  didReceiveUpdate = true;
                }
              }
            }
            return updateFunctionComponent(current2, workInProgress2, Component, nextProps, renderLanes2);
          }
          function updateOffscreenComponent(current2, workInProgress2, renderLanes2) {
            var nextProps = workInProgress2.pendingProps;
            var nextChildren = nextProps.children;
            var prevState = current2 !== null ? current2.memoizedState : null;
            if (nextProps.mode === "hidden" || enableLegacyHidden) {
              if ((workInProgress2.mode & ConcurrentMode) === NoMode) {
                var nextState = {
                  baseLanes: NoLanes,
                  cachePool: null,
                  transitions: null
                };
                workInProgress2.memoizedState = nextState;
                pushRenderLanes(workInProgress2, renderLanes2);
              } else if (!includesSomeLane(renderLanes2, OffscreenLane)) {
                var spawnedCachePool = null;
                var nextBaseLanes;
                if (prevState !== null) {
                  var prevBaseLanes = prevState.baseLanes;
                  nextBaseLanes = mergeLanes(prevBaseLanes, renderLanes2);
                } else {
                  nextBaseLanes = renderLanes2;
                }
                workInProgress2.lanes = workInProgress2.childLanes = laneToLanes(OffscreenLane);
                var _nextState = {
                  baseLanes: nextBaseLanes,
                  cachePool: spawnedCachePool,
                  transitions: null
                };
                workInProgress2.memoizedState = _nextState;
                workInProgress2.updateQueue = null;
                pushRenderLanes(workInProgress2, nextBaseLanes);
                return null;
              } else {
                var _nextState2 = {
                  baseLanes: NoLanes,
                  cachePool: null,
                  transitions: null
                };
                workInProgress2.memoizedState = _nextState2;
                var subtreeRenderLanes2 = prevState !== null ? prevState.baseLanes : renderLanes2;
                pushRenderLanes(workInProgress2, subtreeRenderLanes2);
              }
            } else {
              var _subtreeRenderLanes;
              if (prevState !== null) {
                _subtreeRenderLanes = mergeLanes(prevState.baseLanes, renderLanes2);
                workInProgress2.memoizedState = null;
              } else {
                _subtreeRenderLanes = renderLanes2;
              }
              pushRenderLanes(workInProgress2, _subtreeRenderLanes);
            }
            reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            return workInProgress2.child;
          }
          function updateFragment(current2, workInProgress2, renderLanes2) {
            var nextChildren = workInProgress2.pendingProps;
            reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            return workInProgress2.child;
          }
          function updateMode(current2, workInProgress2, renderLanes2) {
            var nextChildren = workInProgress2.pendingProps.children;
            reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            return workInProgress2.child;
          }
          function updateProfiler(current2, workInProgress2, renderLanes2) {
            {
              workInProgress2.flags |= Update;
              {
                var stateNode = workInProgress2.stateNode;
                stateNode.effectDuration = 0;
                stateNode.passiveEffectDuration = 0;
              }
            }
            var nextProps = workInProgress2.pendingProps;
            var nextChildren = nextProps.children;
            reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            return workInProgress2.child;
          }
          function markRef(current2, workInProgress2) {
            var ref = workInProgress2.ref;
            if (current2 === null && ref !== null || current2 !== null && current2.ref !== ref) {
              workInProgress2.flags |= Ref;
              {
                workInProgress2.flags |= RefStatic;
              }
            }
          }
          function updateFunctionComponent(current2, workInProgress2, Component, nextProps, renderLanes2) {
            {
              if (workInProgress2.type !== workInProgress2.elementType) {
                var innerPropTypes = Component.propTypes;
                if (innerPropTypes) {
                  checkPropTypes(
                    innerPropTypes,
                    nextProps,
                    // Resolved props
                    "prop",
                    getComponentNameFromType(Component)
                  );
                }
              }
            }
            var context;
            {
              var unmaskedContext = getUnmaskedContext(workInProgress2, Component, true);
              context = getMaskedContext(workInProgress2, unmaskedContext);
            }
            var nextChildren;
            var hasId;
            prepareToReadContext(workInProgress2, renderLanes2);
            {
              markComponentRenderStarted(workInProgress2);
            }
            {
              ReactCurrentOwner$1.current = workInProgress2;
              setIsRendering(true);
              nextChildren = renderWithHooks(current2, workInProgress2, Component, nextProps, context, renderLanes2);
              hasId = checkDidRenderIdHook();
              if (workInProgress2.mode & StrictLegacyMode) {
                setIsStrictModeForDevtools(true);
                try {
                  nextChildren = renderWithHooks(current2, workInProgress2, Component, nextProps, context, renderLanes2);
                  hasId = checkDidRenderIdHook();
                } finally {
                  setIsStrictModeForDevtools(false);
                }
              }
              setIsRendering(false);
            }
            {
              markComponentRenderStopped();
            }
            if (current2 !== null && !didReceiveUpdate) {
              bailoutHooks(current2, workInProgress2, renderLanes2);
              return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
            }
            if (getIsHydrating() && hasId) {
              pushMaterializedTreeId(workInProgress2);
            }
            workInProgress2.flags |= PerformedWork;
            reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            return workInProgress2.child;
          }
          function updateClassComponent(current2, workInProgress2, Component, nextProps, renderLanes2) {
            {
              switch (shouldError(workInProgress2)) {
                case false: {
                  var _instance = workInProgress2.stateNode;
                  var ctor = workInProgress2.type;
                  var tempInstance = new ctor(workInProgress2.memoizedProps, _instance.context);
                  var state = tempInstance.state;
                  _instance.updater.enqueueSetState(_instance, state, null);
                  break;
                }
                case true: {
                  workInProgress2.flags |= DidCapture;
                  workInProgress2.flags |= ShouldCapture;
                  var error$1 = new Error("Simulated error coming from DevTools");
                  var lane = pickArbitraryLane(renderLanes2);
                  workInProgress2.lanes = mergeLanes(workInProgress2.lanes, lane);
                  var update = createClassErrorUpdate(workInProgress2, createCapturedValueAtFiber(error$1, workInProgress2), lane);
                  enqueueCapturedUpdate(workInProgress2, update);
                  break;
                }
              }
              if (workInProgress2.type !== workInProgress2.elementType) {
                var innerPropTypes = Component.propTypes;
                if (innerPropTypes) {
                  checkPropTypes(
                    innerPropTypes,
                    nextProps,
                    // Resolved props
                    "prop",
                    getComponentNameFromType(Component)
                  );
                }
              }
            }
            var hasContext;
            if (isContextProvider(Component)) {
              hasContext = true;
              pushContextProvider(workInProgress2);
            } else {
              hasContext = false;
            }
            prepareToReadContext(workInProgress2, renderLanes2);
            var instance = workInProgress2.stateNode;
            var shouldUpdate;
            if (instance === null) {
              resetSuspendedCurrentOnMountInLegacyMode(current2, workInProgress2);
              constructClassInstance(workInProgress2, Component, nextProps);
              mountClassInstance(workInProgress2, Component, nextProps, renderLanes2);
              shouldUpdate = true;
            } else if (current2 === null) {
              shouldUpdate = resumeMountClassInstance(workInProgress2, Component, nextProps, renderLanes2);
            } else {
              shouldUpdate = updateClassInstance(current2, workInProgress2, Component, nextProps, renderLanes2);
            }
            var nextUnitOfWork = finishClassComponent(current2, workInProgress2, Component, shouldUpdate, hasContext, renderLanes2);
            {
              var inst = workInProgress2.stateNode;
              if (shouldUpdate && inst.props !== nextProps) {
                if (!didWarnAboutReassigningProps) {
                  error("It looks like %s is reassigning its own `this.props` while rendering. This is not supported and can lead to confusing bugs.", getComponentNameFromFiber(workInProgress2) || "a component");
                }
                didWarnAboutReassigningProps = true;
              }
            }
            return nextUnitOfWork;
          }
          function finishClassComponent(current2, workInProgress2, Component, shouldUpdate, hasContext, renderLanes2) {
            markRef(current2, workInProgress2);
            var didCaptureError = (workInProgress2.flags & DidCapture) !== NoFlags;
            if (!shouldUpdate && !didCaptureError) {
              if (hasContext) {
                invalidateContextProvider(workInProgress2, Component, false);
              }
              return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
            }
            var instance = workInProgress2.stateNode;
            ReactCurrentOwner$1.current = workInProgress2;
            var nextChildren;
            if (didCaptureError && typeof Component.getDerivedStateFromError !== "function") {
              nextChildren = null;
              {
                stopProfilerTimerIfRunning();
              }
            } else {
              {
                markComponentRenderStarted(workInProgress2);
              }
              {
                setIsRendering(true);
                nextChildren = instance.render();
                if (workInProgress2.mode & StrictLegacyMode) {
                  setIsStrictModeForDevtools(true);
                  try {
                    instance.render();
                  } finally {
                    setIsStrictModeForDevtools(false);
                  }
                }
                setIsRendering(false);
              }
              {
                markComponentRenderStopped();
              }
            }
            workInProgress2.flags |= PerformedWork;
            if (current2 !== null && didCaptureError) {
              forceUnmountCurrentAndReconcile(current2, workInProgress2, nextChildren, renderLanes2);
            } else {
              reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            }
            workInProgress2.memoizedState = instance.state;
            if (hasContext) {
              invalidateContextProvider(workInProgress2, Component, true);
            }
            return workInProgress2.child;
          }
          function pushHostRootContext(workInProgress2) {
            var root = workInProgress2.stateNode;
            if (root.pendingContext) {
              pushTopLevelContextObject(workInProgress2, root.pendingContext, root.pendingContext !== root.context);
            } else if (root.context) {
              pushTopLevelContextObject(workInProgress2, root.context, false);
            }
            pushHostContainer(workInProgress2, root.containerInfo);
          }
          function updateHostRoot(current2, workInProgress2, renderLanes2) {
            pushHostRootContext(workInProgress2);
            if (current2 === null) {
              throw new Error("Should have a current fiber. This is a bug in React.");
            }
            var nextProps = workInProgress2.pendingProps;
            var prevState = workInProgress2.memoizedState;
            var prevChildren = prevState.element;
            cloneUpdateQueue(current2, workInProgress2);
            processUpdateQueue(workInProgress2, nextProps, null, renderLanes2);
            var nextState = workInProgress2.memoizedState;
            var root = workInProgress2.stateNode;
            var nextChildren = nextState.element;
            if (supportsHydration && prevState.isDehydrated) {
              var overrideState = {
                element: nextChildren,
                isDehydrated: false,
                cache: nextState.cache,
                pendingSuspenseBoundaries: nextState.pendingSuspenseBoundaries,
                transitions: nextState.transitions
              };
              var updateQueue = workInProgress2.updateQueue;
              updateQueue.baseState = overrideState;
              workInProgress2.memoizedState = overrideState;
              if (workInProgress2.flags & ForceClientRender) {
                var recoverableError = createCapturedValueAtFiber(new Error("There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering."), workInProgress2);
                return mountHostRootWithoutHydrating(current2, workInProgress2, nextChildren, renderLanes2, recoverableError);
              } else if (nextChildren !== prevChildren) {
                var _recoverableError = createCapturedValueAtFiber(new Error("This root received an early update, before anything was able hydrate. Switched the entire root to client rendering."), workInProgress2);
                return mountHostRootWithoutHydrating(current2, workInProgress2, nextChildren, renderLanes2, _recoverableError);
              } else {
                enterHydrationState(workInProgress2);
                var child = mountChildFibers(workInProgress2, null, nextChildren, renderLanes2);
                workInProgress2.child = child;
                var node = child;
                while (node) {
                  node.flags = node.flags & ~Placement | Hydrating;
                  node = node.sibling;
                }
              }
            } else {
              resetHydrationState();
              if (nextChildren === prevChildren) {
                return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
              }
              reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            }
            return workInProgress2.child;
          }
          function mountHostRootWithoutHydrating(current2, workInProgress2, nextChildren, renderLanes2, recoverableError) {
            resetHydrationState();
            queueHydrationError(recoverableError);
            workInProgress2.flags |= ForceClientRender;
            reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            return workInProgress2.child;
          }
          function updateHostComponent(current2, workInProgress2, renderLanes2) {
            pushHostContext(workInProgress2);
            if (current2 === null) {
              tryToClaimNextHydratableInstance(workInProgress2);
            }
            var type = workInProgress2.type;
            var nextProps = workInProgress2.pendingProps;
            var prevProps = current2 !== null ? current2.memoizedProps : null;
            var nextChildren = nextProps.children;
            var isDirectTextChild = shouldSetTextContent(type, nextProps);
            if (isDirectTextChild) {
              nextChildren = null;
            } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
              workInProgress2.flags |= ContentReset;
            }
            markRef(current2, workInProgress2);
            reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            return workInProgress2.child;
          }
          function updateHostText(current2, workInProgress2) {
            if (current2 === null) {
              tryToClaimNextHydratableInstance(workInProgress2);
            }
            return null;
          }
          function mountLazyComponent(_current, workInProgress2, elementType, renderLanes2) {
            resetSuspendedCurrentOnMountInLegacyMode(_current, workInProgress2);
            var props = workInProgress2.pendingProps;
            var lazyComponent = elementType;
            var payload = lazyComponent._payload;
            var init = lazyComponent._init;
            var Component = init(payload);
            workInProgress2.type = Component;
            var resolvedTag = workInProgress2.tag = resolveLazyComponentTag(Component);
            var resolvedProps = resolveDefaultProps(Component, props);
            var child;
            switch (resolvedTag) {
              case FunctionComponent: {
                {
                  validateFunctionComponentInDev(workInProgress2, Component);
                  workInProgress2.type = Component = resolveFunctionForHotReloading(Component);
                }
                child = updateFunctionComponent(null, workInProgress2, Component, resolvedProps, renderLanes2);
                return child;
              }
              case ClassComponent: {
                {
                  workInProgress2.type = Component = resolveClassForHotReloading(Component);
                }
                child = updateClassComponent(null, workInProgress2, Component, resolvedProps, renderLanes2);
                return child;
              }
              case ForwardRef: {
                {
                  workInProgress2.type = Component = resolveForwardRefForHotReloading(Component);
                }
                child = updateForwardRef(null, workInProgress2, Component, resolvedProps, renderLanes2);
                return child;
              }
              case MemoComponent: {
                {
                  if (workInProgress2.type !== workInProgress2.elementType) {
                    var outerPropTypes = Component.propTypes;
                    if (outerPropTypes) {
                      checkPropTypes(
                        outerPropTypes,
                        resolvedProps,
                        // Resolved for outer only
                        "prop",
                        getComponentNameFromType(Component)
                      );
                    }
                  }
                }
                child = updateMemoComponent(
                  null,
                  workInProgress2,
                  Component,
                  resolveDefaultProps(Component.type, resolvedProps),
                  // The inner type can have defaults too
                  renderLanes2
                );
                return child;
              }
            }
            var hint = "";
            {
              if (Component !== null && typeof Component === "object" && Component.$$typeof === REACT_LAZY_TYPE) {
                hint = " Did you wrap a component in React.lazy() more than once?";
              }
            }
            throw new Error("Element type is invalid. Received a promise that resolves to: " + Component + ". " + ("Lazy element type must resolve to a class or function." + hint));
          }
          function mountIncompleteClassComponent(_current, workInProgress2, Component, nextProps, renderLanes2) {
            resetSuspendedCurrentOnMountInLegacyMode(_current, workInProgress2);
            workInProgress2.tag = ClassComponent;
            var hasContext;
            if (isContextProvider(Component)) {
              hasContext = true;
              pushContextProvider(workInProgress2);
            } else {
              hasContext = false;
            }
            prepareToReadContext(workInProgress2, renderLanes2);
            constructClassInstance(workInProgress2, Component, nextProps);
            mountClassInstance(workInProgress2, Component, nextProps, renderLanes2);
            return finishClassComponent(null, workInProgress2, Component, true, hasContext, renderLanes2);
          }
          function mountIndeterminateComponent(_current, workInProgress2, Component, renderLanes2) {
            resetSuspendedCurrentOnMountInLegacyMode(_current, workInProgress2);
            var props = workInProgress2.pendingProps;
            var context;
            {
              var unmaskedContext = getUnmaskedContext(workInProgress2, Component, false);
              context = getMaskedContext(workInProgress2, unmaskedContext);
            }
            prepareToReadContext(workInProgress2, renderLanes2);
            var value;
            var hasId;
            {
              markComponentRenderStarted(workInProgress2);
            }
            {
              if (Component.prototype && typeof Component.prototype.render === "function") {
                var componentName = getComponentNameFromType(Component) || "Unknown";
                if (!didWarnAboutBadClass[componentName]) {
                  error("The <%s /> component appears to have a render method, but doesn't extend React.Component. This is likely to cause errors. Change %s to extend React.Component instead.", componentName, componentName);
                  didWarnAboutBadClass[componentName] = true;
                }
              }
              if (workInProgress2.mode & StrictLegacyMode) {
                ReactStrictModeWarnings.recordLegacyContextWarning(workInProgress2, null);
              }
              setIsRendering(true);
              ReactCurrentOwner$1.current = workInProgress2;
              value = renderWithHooks(null, workInProgress2, Component, props, context, renderLanes2);
              hasId = checkDidRenderIdHook();
              setIsRendering(false);
            }
            {
              markComponentRenderStopped();
            }
            workInProgress2.flags |= PerformedWork;
            {
              if (typeof value === "object" && value !== null && typeof value.render === "function" && value.$$typeof === void 0) {
                var _componentName = getComponentNameFromType(Component) || "Unknown";
                if (!didWarnAboutModulePatternComponent[_componentName]) {
                  error("The <%s /> component appears to be a function component that returns a class instance. Change %s to a class that extends React.Component instead. If you can't use a class try assigning the prototype on the function as a workaround. `%s.prototype = React.Component.prototype`. Don't use an arrow function since it cannot be called with `new` by React.", _componentName, _componentName, _componentName);
                  didWarnAboutModulePatternComponent[_componentName] = true;
                }
              }
            }
            if (
              // Run these checks in production only if the flag is off.
              // Eventually we'll delete this branch altogether.
              typeof value === "object" && value !== null && typeof value.render === "function" && value.$$typeof === void 0
            ) {
              {
                var _componentName2 = getComponentNameFromType(Component) || "Unknown";
                if (!didWarnAboutModulePatternComponent[_componentName2]) {
                  error("The <%s /> component appears to be a function component that returns a class instance. Change %s to a class that extends React.Component instead. If you can't use a class try assigning the prototype on the function as a workaround. `%s.prototype = React.Component.prototype`. Don't use an arrow function since it cannot be called with `new` by React.", _componentName2, _componentName2, _componentName2);
                  didWarnAboutModulePatternComponent[_componentName2] = true;
                }
              }
              workInProgress2.tag = ClassComponent;
              workInProgress2.memoizedState = null;
              workInProgress2.updateQueue = null;
              var hasContext = false;
              if (isContextProvider(Component)) {
                hasContext = true;
                pushContextProvider(workInProgress2);
              } else {
                hasContext = false;
              }
              workInProgress2.memoizedState = value.state !== null && value.state !== void 0 ? value.state : null;
              initializeUpdateQueue(workInProgress2);
              adoptClassInstance(workInProgress2, value);
              mountClassInstance(workInProgress2, Component, props, renderLanes2);
              return finishClassComponent(null, workInProgress2, Component, true, hasContext, renderLanes2);
            } else {
              workInProgress2.tag = FunctionComponent;
              {
                if (workInProgress2.mode & StrictLegacyMode) {
                  setIsStrictModeForDevtools(true);
                  try {
                    value = renderWithHooks(null, workInProgress2, Component, props, context, renderLanes2);
                    hasId = checkDidRenderIdHook();
                  } finally {
                    setIsStrictModeForDevtools(false);
                  }
                }
              }
              if (getIsHydrating() && hasId) {
                pushMaterializedTreeId(workInProgress2);
              }
              reconcileChildren(null, workInProgress2, value, renderLanes2);
              {
                validateFunctionComponentInDev(workInProgress2, Component);
              }
              return workInProgress2.child;
            }
          }
          function validateFunctionComponentInDev(workInProgress2, Component) {
            {
              if (Component) {
                if (Component.childContextTypes) {
                  error("%s(...): childContextTypes cannot be defined on a function component.", Component.displayName || Component.name || "Component");
                }
              }
              if (workInProgress2.ref !== null) {
                var info = "";
                var ownerName = getCurrentFiberOwnerNameInDevOrNull();
                if (ownerName) {
                  info += "\n\nCheck the render method of `" + ownerName + "`.";
                }
                var warningKey = ownerName || "";
                var debugSource = workInProgress2._debugSource;
                if (debugSource) {
                  warningKey = debugSource.fileName + ":" + debugSource.lineNumber;
                }
                if (!didWarnAboutFunctionRefs[warningKey]) {
                  didWarnAboutFunctionRefs[warningKey] = true;
                  error("Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?%s", info);
                }
              }
              if (Component.defaultProps !== void 0) {
                var componentName = getComponentNameFromType(Component) || "Unknown";
                if (!didWarnAboutDefaultPropsOnFunctionComponent[componentName]) {
                  error("%s: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.", componentName);
                  didWarnAboutDefaultPropsOnFunctionComponent[componentName] = true;
                }
              }
              if (typeof Component.getDerivedStateFromProps === "function") {
                var _componentName3 = getComponentNameFromType(Component) || "Unknown";
                if (!didWarnAboutGetDerivedStateOnFunctionComponent[_componentName3]) {
                  error("%s: Function components do not support getDerivedStateFromProps.", _componentName3);
                  didWarnAboutGetDerivedStateOnFunctionComponent[_componentName3] = true;
                }
              }
              if (typeof Component.contextType === "object" && Component.contextType !== null) {
                var _componentName4 = getComponentNameFromType(Component) || "Unknown";
                if (!didWarnAboutContextTypeOnFunctionComponent[_componentName4]) {
                  error("%s: Function components do not support contextType.", _componentName4);
                  didWarnAboutContextTypeOnFunctionComponent[_componentName4] = true;
                }
              }
            }
          }
          var SUSPENDED_MARKER = {
            dehydrated: null,
            treeContext: null,
            retryLane: NoLane
          };
          function mountSuspenseOffscreenState(renderLanes2) {
            return {
              baseLanes: renderLanes2,
              cachePool: getSuspendedCache(),
              transitions: null
            };
          }
          function updateSuspenseOffscreenState(prevOffscreenState, renderLanes2) {
            var cachePool = null;
            return {
              baseLanes: mergeLanes(prevOffscreenState.baseLanes, renderLanes2),
              cachePool,
              transitions: prevOffscreenState.transitions
            };
          }
          function shouldRemainOnFallback(suspenseContext, current2, workInProgress2, renderLanes2) {
            if (current2 !== null) {
              var suspenseState = current2.memoizedState;
              if (suspenseState === null) {
                return false;
              }
            }
            return hasSuspenseContext(suspenseContext, ForceSuspenseFallback);
          }
          function getRemainingWorkInPrimaryTree(current2, renderLanes2) {
            return removeLanes(current2.childLanes, renderLanes2);
          }
          function updateSuspenseComponent(current2, workInProgress2, renderLanes2) {
            var nextProps = workInProgress2.pendingProps;
            {
              if (shouldSuspend(workInProgress2)) {
                workInProgress2.flags |= DidCapture;
              }
            }
            var suspenseContext = suspenseStackCursor.current;
            var showFallback = false;
            var didSuspend = (workInProgress2.flags & DidCapture) !== NoFlags;
            if (didSuspend || shouldRemainOnFallback(suspenseContext, current2)) {
              showFallback = true;
              workInProgress2.flags &= ~DidCapture;
            } else {
              if (current2 === null || current2.memoizedState !== null) {
                {
                  suspenseContext = addSubtreeSuspenseContext(suspenseContext, InvisibleParentSuspenseContext);
                }
              }
            }
            suspenseContext = setDefaultShallowSuspenseContext(suspenseContext);
            pushSuspenseContext(workInProgress2, suspenseContext);
            if (current2 === null) {
              tryToClaimNextHydratableInstance(workInProgress2);
              var suspenseState = workInProgress2.memoizedState;
              if (suspenseState !== null) {
                var dehydrated = suspenseState.dehydrated;
                if (dehydrated !== null) {
                  return mountDehydratedSuspenseComponent(workInProgress2, dehydrated);
                }
              }
              var nextPrimaryChildren = nextProps.children;
              var nextFallbackChildren = nextProps.fallback;
              if (showFallback) {
                var fallbackFragment = mountSuspenseFallbackChildren(workInProgress2, nextPrimaryChildren, nextFallbackChildren, renderLanes2);
                var primaryChildFragment = workInProgress2.child;
                primaryChildFragment.memoizedState = mountSuspenseOffscreenState(renderLanes2);
                workInProgress2.memoizedState = SUSPENDED_MARKER;
                return fallbackFragment;
              } else {
                return mountSuspensePrimaryChildren(workInProgress2, nextPrimaryChildren);
              }
            } else {
              var prevState = current2.memoizedState;
              if (prevState !== null) {
                var _dehydrated = prevState.dehydrated;
                if (_dehydrated !== null) {
                  return updateDehydratedSuspenseComponent(current2, workInProgress2, didSuspend, nextProps, _dehydrated, prevState, renderLanes2);
                }
              }
              if (showFallback) {
                var _nextFallbackChildren = nextProps.fallback;
                var _nextPrimaryChildren = nextProps.children;
                var fallbackChildFragment = updateSuspenseFallbackChildren(current2, workInProgress2, _nextPrimaryChildren, _nextFallbackChildren, renderLanes2);
                var _primaryChildFragment2 = workInProgress2.child;
                var prevOffscreenState = current2.child.memoizedState;
                _primaryChildFragment2.memoizedState = prevOffscreenState === null ? mountSuspenseOffscreenState(renderLanes2) : updateSuspenseOffscreenState(prevOffscreenState, renderLanes2);
                _primaryChildFragment2.childLanes = getRemainingWorkInPrimaryTree(current2, renderLanes2);
                workInProgress2.memoizedState = SUSPENDED_MARKER;
                return fallbackChildFragment;
              } else {
                var _nextPrimaryChildren2 = nextProps.children;
                var _primaryChildFragment3 = updateSuspensePrimaryChildren(current2, workInProgress2, _nextPrimaryChildren2, renderLanes2);
                workInProgress2.memoizedState = null;
                return _primaryChildFragment3;
              }
            }
          }
          function mountSuspensePrimaryChildren(workInProgress2, primaryChildren, renderLanes2) {
            var mode = workInProgress2.mode;
            var primaryChildProps = {
              mode: "visible",
              children: primaryChildren
            };
            var primaryChildFragment = mountWorkInProgressOffscreenFiber(primaryChildProps, mode);
            primaryChildFragment.return = workInProgress2;
            workInProgress2.child = primaryChildFragment;
            return primaryChildFragment;
          }
          function mountSuspenseFallbackChildren(workInProgress2, primaryChildren, fallbackChildren, renderLanes2) {
            var mode = workInProgress2.mode;
            var progressedPrimaryFragment = workInProgress2.child;
            var primaryChildProps = {
              mode: "hidden",
              children: primaryChildren
            };
            var primaryChildFragment;
            var fallbackChildFragment;
            if ((mode & ConcurrentMode) === NoMode && progressedPrimaryFragment !== null) {
              primaryChildFragment = progressedPrimaryFragment;
              primaryChildFragment.childLanes = NoLanes;
              primaryChildFragment.pendingProps = primaryChildProps;
              if (workInProgress2.mode & ProfileMode) {
                primaryChildFragment.actualDuration = 0;
                primaryChildFragment.actualStartTime = -1;
                primaryChildFragment.selfBaseDuration = 0;
                primaryChildFragment.treeBaseDuration = 0;
              }
              fallbackChildFragment = createFiberFromFragment(fallbackChildren, mode, renderLanes2, null);
            } else {
              primaryChildFragment = mountWorkInProgressOffscreenFiber(primaryChildProps, mode);
              fallbackChildFragment = createFiberFromFragment(fallbackChildren, mode, renderLanes2, null);
            }
            primaryChildFragment.return = workInProgress2;
            fallbackChildFragment.return = workInProgress2;
            primaryChildFragment.sibling = fallbackChildFragment;
            workInProgress2.child = primaryChildFragment;
            return fallbackChildFragment;
          }
          function mountWorkInProgressOffscreenFiber(offscreenProps, mode, renderLanes2) {
            return createFiberFromOffscreen(offscreenProps, mode, NoLanes, null);
          }
          function updateWorkInProgressOffscreenFiber(current2, offscreenProps) {
            return createWorkInProgress(current2, offscreenProps);
          }
          function updateSuspensePrimaryChildren(current2, workInProgress2, primaryChildren, renderLanes2) {
            var currentPrimaryChildFragment = current2.child;
            var currentFallbackChildFragment = currentPrimaryChildFragment.sibling;
            var primaryChildFragment = updateWorkInProgressOffscreenFiber(currentPrimaryChildFragment, {
              mode: "visible",
              children: primaryChildren
            });
            if ((workInProgress2.mode & ConcurrentMode) === NoMode) {
              primaryChildFragment.lanes = renderLanes2;
            }
            primaryChildFragment.return = workInProgress2;
            primaryChildFragment.sibling = null;
            if (currentFallbackChildFragment !== null) {
              var deletions = workInProgress2.deletions;
              if (deletions === null) {
                workInProgress2.deletions = [currentFallbackChildFragment];
                workInProgress2.flags |= ChildDeletion;
              } else {
                deletions.push(currentFallbackChildFragment);
              }
            }
            workInProgress2.child = primaryChildFragment;
            return primaryChildFragment;
          }
          function updateSuspenseFallbackChildren(current2, workInProgress2, primaryChildren, fallbackChildren, renderLanes2) {
            var mode = workInProgress2.mode;
            var currentPrimaryChildFragment = current2.child;
            var currentFallbackChildFragment = currentPrimaryChildFragment.sibling;
            var primaryChildProps = {
              mode: "hidden",
              children: primaryChildren
            };
            var primaryChildFragment;
            if (
              // In legacy mode, we commit the primary tree as if it successfully
              // completed, even though it's in an inconsistent state.
              (mode & ConcurrentMode) === NoMode && // Make sure we're on the second pass, i.e. the primary child fragment was
              // already cloned. In legacy mode, the only case where this isn't true is
              // when DevTools forces us to display a fallback; we skip the first render
              // pass entirely and go straight to rendering the fallback. (In Concurrent
              // Mode, SuspenseList can also trigger this scenario, but this is a legacy-
              // only codepath.)
              workInProgress2.child !== currentPrimaryChildFragment
            ) {
              var progressedPrimaryFragment = workInProgress2.child;
              primaryChildFragment = progressedPrimaryFragment;
              primaryChildFragment.childLanes = NoLanes;
              primaryChildFragment.pendingProps = primaryChildProps;
              if (workInProgress2.mode & ProfileMode) {
                primaryChildFragment.actualDuration = 0;
                primaryChildFragment.actualStartTime = -1;
                primaryChildFragment.selfBaseDuration = currentPrimaryChildFragment.selfBaseDuration;
                primaryChildFragment.treeBaseDuration = currentPrimaryChildFragment.treeBaseDuration;
              }
              workInProgress2.deletions = null;
            } else {
              primaryChildFragment = updateWorkInProgressOffscreenFiber(currentPrimaryChildFragment, primaryChildProps);
              primaryChildFragment.subtreeFlags = currentPrimaryChildFragment.subtreeFlags & StaticMask;
            }
            var fallbackChildFragment;
            if (currentFallbackChildFragment !== null) {
              fallbackChildFragment = createWorkInProgress(currentFallbackChildFragment, fallbackChildren);
            } else {
              fallbackChildFragment = createFiberFromFragment(fallbackChildren, mode, renderLanes2, null);
              fallbackChildFragment.flags |= Placement;
            }
            fallbackChildFragment.return = workInProgress2;
            primaryChildFragment.return = workInProgress2;
            primaryChildFragment.sibling = fallbackChildFragment;
            workInProgress2.child = primaryChildFragment;
            return fallbackChildFragment;
          }
          function retrySuspenseComponentWithoutHydrating(current2, workInProgress2, renderLanes2, recoverableError) {
            if (recoverableError !== null) {
              queueHydrationError(recoverableError);
            }
            reconcileChildFibers(workInProgress2, current2.child, null, renderLanes2);
            var nextProps = workInProgress2.pendingProps;
            var primaryChildren = nextProps.children;
            var primaryChildFragment = mountSuspensePrimaryChildren(workInProgress2, primaryChildren);
            primaryChildFragment.flags |= Placement;
            workInProgress2.memoizedState = null;
            return primaryChildFragment;
          }
          function mountSuspenseFallbackAfterRetryWithoutHydrating(current2, workInProgress2, primaryChildren, fallbackChildren, renderLanes2) {
            var fiberMode = workInProgress2.mode;
            var primaryChildProps = {
              mode: "visible",
              children: primaryChildren
            };
            var primaryChildFragment = mountWorkInProgressOffscreenFiber(primaryChildProps, fiberMode);
            var fallbackChildFragment = createFiberFromFragment(fallbackChildren, fiberMode, renderLanes2, null);
            fallbackChildFragment.flags |= Placement;
            primaryChildFragment.return = workInProgress2;
            fallbackChildFragment.return = workInProgress2;
            primaryChildFragment.sibling = fallbackChildFragment;
            workInProgress2.child = primaryChildFragment;
            if ((workInProgress2.mode & ConcurrentMode) !== NoMode) {
              reconcileChildFibers(workInProgress2, current2.child, null, renderLanes2);
            }
            return fallbackChildFragment;
          }
          function mountDehydratedSuspenseComponent(workInProgress2, suspenseInstance, renderLanes2) {
            if ((workInProgress2.mode & ConcurrentMode) === NoMode) {
              {
                error("Cannot hydrate Suspense in legacy mode. Switch from ReactDOM.hydrate(element, container) to ReactDOMClient.hydrateRoot(container, <App />).render(element) or remove the Suspense components from the server rendered components.");
              }
              workInProgress2.lanes = laneToLanes(SyncLane);
            } else if (isSuspenseInstanceFallback(suspenseInstance)) {
              workInProgress2.lanes = laneToLanes(DefaultHydrationLane);
            } else {
              workInProgress2.lanes = laneToLanes(OffscreenLane);
            }
            return null;
          }
          function updateDehydratedSuspenseComponent(current2, workInProgress2, didSuspend, nextProps, suspenseInstance, suspenseState, renderLanes2) {
            if (!didSuspend) {
              warnIfHydrating();
              if ((workInProgress2.mode & ConcurrentMode) === NoMode) {
                return retrySuspenseComponentWithoutHydrating(
                  current2,
                  workInProgress2,
                  renderLanes2,
                  // TODO: When we delete legacy mode, we should make this error argument
                  // required — every concurrent mode path that causes hydration to
                  // de-opt to client rendering should have an error message.
                  null
                );
              }
              if (isSuspenseInstanceFallback(suspenseInstance)) {
                var digest, message, stack;
                {
                  var _getSuspenseInstanceF = getSuspenseInstanceFallbackErrorDetails(suspenseInstance);
                  digest = _getSuspenseInstanceF.digest;
                  message = _getSuspenseInstanceF.message;
                  stack = _getSuspenseInstanceF.stack;
                }
                var error2;
                if (message) {
                  error2 = new Error(message);
                } else {
                  error2 = new Error("The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering.");
                }
                var capturedValue = createCapturedValue(error2, digest, stack);
                return retrySuspenseComponentWithoutHydrating(current2, workInProgress2, renderLanes2, capturedValue);
              }
              var hasContextChanged2 = includesSomeLane(renderLanes2, current2.childLanes);
              if (didReceiveUpdate || hasContextChanged2) {
                var root = getWorkInProgressRoot();
                if (root !== null) {
                  var attemptHydrationAtLane = getBumpedLaneForHydration(root, renderLanes2);
                  if (attemptHydrationAtLane !== NoLane && attemptHydrationAtLane !== suspenseState.retryLane) {
                    suspenseState.retryLane = attemptHydrationAtLane;
                    var eventTime = NoTimestamp;
                    enqueueConcurrentRenderForLane(current2, attemptHydrationAtLane);
                    scheduleUpdateOnFiber(root, current2, attemptHydrationAtLane, eventTime);
                  }
                }
                renderDidSuspendDelayIfPossible();
                var _capturedValue = createCapturedValue(new Error("This Suspense boundary received an update before it finished hydrating. This caused the boundary to switch to client rendering. The usual way to fix this is to wrap the original update in startTransition."));
                return retrySuspenseComponentWithoutHydrating(current2, workInProgress2, renderLanes2, _capturedValue);
              } else if (isSuspenseInstancePending(suspenseInstance)) {
                workInProgress2.flags |= DidCapture;
                workInProgress2.child = current2.child;
                var retry = retryDehydratedSuspenseBoundary.bind(null, current2);
                registerSuspenseInstanceRetry(suspenseInstance, retry);
                return null;
              } else {
                reenterHydrationStateFromDehydratedSuspenseInstance(workInProgress2, suspenseInstance, suspenseState.treeContext);
                var primaryChildren = nextProps.children;
                var primaryChildFragment = mountSuspensePrimaryChildren(workInProgress2, primaryChildren);
                primaryChildFragment.flags |= Hydrating;
                return primaryChildFragment;
              }
            } else {
              if (workInProgress2.flags & ForceClientRender) {
                workInProgress2.flags &= ~ForceClientRender;
                var _capturedValue2 = createCapturedValue(new Error("There was an error while hydrating this Suspense boundary. Switched to client rendering."));
                return retrySuspenseComponentWithoutHydrating(current2, workInProgress2, renderLanes2, _capturedValue2);
              } else if (workInProgress2.memoizedState !== null) {
                workInProgress2.child = current2.child;
                workInProgress2.flags |= DidCapture;
                return null;
              } else {
                var nextPrimaryChildren = nextProps.children;
                var nextFallbackChildren = nextProps.fallback;
                var fallbackChildFragment = mountSuspenseFallbackAfterRetryWithoutHydrating(current2, workInProgress2, nextPrimaryChildren, nextFallbackChildren, renderLanes2);
                var _primaryChildFragment4 = workInProgress2.child;
                _primaryChildFragment4.memoizedState = mountSuspenseOffscreenState(renderLanes2);
                workInProgress2.memoizedState = SUSPENDED_MARKER;
                return fallbackChildFragment;
              }
            }
          }
          function scheduleSuspenseWorkOnFiber(fiber, renderLanes2, propagationRoot) {
            fiber.lanes = mergeLanes(fiber.lanes, renderLanes2);
            var alternate = fiber.alternate;
            if (alternate !== null) {
              alternate.lanes = mergeLanes(alternate.lanes, renderLanes2);
            }
            scheduleContextWorkOnParentPath(fiber.return, renderLanes2, propagationRoot);
          }
          function propagateSuspenseContextChange(workInProgress2, firstChild, renderLanes2) {
            var node = firstChild;
            while (node !== null) {
              if (node.tag === SuspenseComponent) {
                var state = node.memoizedState;
                if (state !== null) {
                  scheduleSuspenseWorkOnFiber(node, renderLanes2, workInProgress2);
                }
              } else if (node.tag === SuspenseListComponent) {
                scheduleSuspenseWorkOnFiber(node, renderLanes2, workInProgress2);
              } else if (node.child !== null) {
                node.child.return = node;
                node = node.child;
                continue;
              }
              if (node === workInProgress2) {
                return;
              }
              while (node.sibling === null) {
                if (node.return === null || node.return === workInProgress2) {
                  return;
                }
                node = node.return;
              }
              node.sibling.return = node.return;
              node = node.sibling;
            }
          }
          function findLastContentRow(firstChild) {
            var row = firstChild;
            var lastContentRow = null;
            while (row !== null) {
              var currentRow = row.alternate;
              if (currentRow !== null && findFirstSuspended(currentRow) === null) {
                lastContentRow = row;
              }
              row = row.sibling;
            }
            return lastContentRow;
          }
          function validateRevealOrder(revealOrder) {
            {
              if (revealOrder !== void 0 && revealOrder !== "forwards" && revealOrder !== "backwards" && revealOrder !== "together" && !didWarnAboutRevealOrder[revealOrder]) {
                didWarnAboutRevealOrder[revealOrder] = true;
                if (typeof revealOrder === "string") {
                  switch (revealOrder.toLowerCase()) {
                    case "together":
                    case "forwards":
                    case "backwards": {
                      error('"%s" is not a valid value for revealOrder on <SuspenseList />. Use lowercase "%s" instead.', revealOrder, revealOrder.toLowerCase());
                      break;
                    }
                    case "forward":
                    case "backward": {
                      error('"%s" is not a valid value for revealOrder on <SuspenseList />. React uses the -s suffix in the spelling. Use "%ss" instead.', revealOrder, revealOrder.toLowerCase());
                      break;
                    }
                    default:
                      error('"%s" is not a supported revealOrder on <SuspenseList />. Did you mean "together", "forwards" or "backwards"?', revealOrder);
                      break;
                  }
                } else {
                  error('%s is not a supported value for revealOrder on <SuspenseList />. Did you mean "together", "forwards" or "backwards"?', revealOrder);
                }
              }
            }
          }
          function validateTailOptions(tailMode, revealOrder) {
            {
              if (tailMode !== void 0 && !didWarnAboutTailOptions[tailMode]) {
                if (tailMode !== "collapsed" && tailMode !== "hidden") {
                  didWarnAboutTailOptions[tailMode] = true;
                  error('"%s" is not a supported value for tail on <SuspenseList />. Did you mean "collapsed" or "hidden"?', tailMode);
                } else if (revealOrder !== "forwards" && revealOrder !== "backwards") {
                  didWarnAboutTailOptions[tailMode] = true;
                  error('<SuspenseList tail="%s" /> is only valid if revealOrder is "forwards" or "backwards". Did you mean to specify revealOrder="forwards"?', tailMode);
                }
              }
            }
          }
          function validateSuspenseListNestedChild(childSlot, index2) {
            {
              var isAnArray = isArray(childSlot);
              var isIterable = !isAnArray && typeof getIteratorFn(childSlot) === "function";
              if (isAnArray || isIterable) {
                var type = isAnArray ? "array" : "iterable";
                error("A nested %s was passed to row #%s in <SuspenseList />. Wrap it in an additional SuspenseList to configure its revealOrder: <SuspenseList revealOrder=...> ... <SuspenseList revealOrder=...>{%s}</SuspenseList> ... </SuspenseList>", type, index2, type);
                return false;
              }
            }
            return true;
          }
          function validateSuspenseListChildren(children, revealOrder) {
            {
              if ((revealOrder === "forwards" || revealOrder === "backwards") && children !== void 0 && children !== null && children !== false) {
                if (isArray(children)) {
                  for (var i = 0; i < children.length; i++) {
                    if (!validateSuspenseListNestedChild(children[i], i)) {
                      return;
                    }
                  }
                } else {
                  var iteratorFn = getIteratorFn(children);
                  if (typeof iteratorFn === "function") {
                    var childrenIterator = iteratorFn.call(children);
                    if (childrenIterator) {
                      var step = childrenIterator.next();
                      var _i = 0;
                      for (; !step.done; step = childrenIterator.next()) {
                        if (!validateSuspenseListNestedChild(step.value, _i)) {
                          return;
                        }
                        _i++;
                      }
                    }
                  } else {
                    error('A single row was passed to a <SuspenseList revealOrder="%s" />. This is not useful since it needs multiple rows. Did you mean to pass multiple children or an array?', revealOrder);
                  }
                }
              }
            }
          }
          function initSuspenseListRenderState(workInProgress2, isBackwards, tail, lastContentRow, tailMode) {
            var renderState = workInProgress2.memoizedState;
            if (renderState === null) {
              workInProgress2.memoizedState = {
                isBackwards,
                rendering: null,
                renderingStartTime: 0,
                last: lastContentRow,
                tail,
                tailMode
              };
            } else {
              renderState.isBackwards = isBackwards;
              renderState.rendering = null;
              renderState.renderingStartTime = 0;
              renderState.last = lastContentRow;
              renderState.tail = tail;
              renderState.tailMode = tailMode;
            }
          }
          function updateSuspenseListComponent(current2, workInProgress2, renderLanes2) {
            var nextProps = workInProgress2.pendingProps;
            var revealOrder = nextProps.revealOrder;
            var tailMode = nextProps.tail;
            var newChildren = nextProps.children;
            validateRevealOrder(revealOrder);
            validateTailOptions(tailMode, revealOrder);
            validateSuspenseListChildren(newChildren, revealOrder);
            reconcileChildren(current2, workInProgress2, newChildren, renderLanes2);
            var suspenseContext = suspenseStackCursor.current;
            var shouldForceFallback = hasSuspenseContext(suspenseContext, ForceSuspenseFallback);
            if (shouldForceFallback) {
              suspenseContext = setShallowSuspenseContext(suspenseContext, ForceSuspenseFallback);
              workInProgress2.flags |= DidCapture;
            } else {
              var didSuspendBefore = current2 !== null && (current2.flags & DidCapture) !== NoFlags;
              if (didSuspendBefore) {
                propagateSuspenseContextChange(workInProgress2, workInProgress2.child, renderLanes2);
              }
              suspenseContext = setDefaultShallowSuspenseContext(suspenseContext);
            }
            pushSuspenseContext(workInProgress2, suspenseContext);
            if ((workInProgress2.mode & ConcurrentMode) === NoMode) {
              workInProgress2.memoizedState = null;
            } else {
              switch (revealOrder) {
                case "forwards": {
                  var lastContentRow = findLastContentRow(workInProgress2.child);
                  var tail;
                  if (lastContentRow === null) {
                    tail = workInProgress2.child;
                    workInProgress2.child = null;
                  } else {
                    tail = lastContentRow.sibling;
                    lastContentRow.sibling = null;
                  }
                  initSuspenseListRenderState(
                    workInProgress2,
                    false,
                    // isBackwards
                    tail,
                    lastContentRow,
                    tailMode
                  );
                  break;
                }
                case "backwards": {
                  var _tail = null;
                  var row = workInProgress2.child;
                  workInProgress2.child = null;
                  while (row !== null) {
                    var currentRow = row.alternate;
                    if (currentRow !== null && findFirstSuspended(currentRow) === null) {
                      workInProgress2.child = row;
                      break;
                    }
                    var nextRow = row.sibling;
                    row.sibling = _tail;
                    _tail = row;
                    row = nextRow;
                  }
                  initSuspenseListRenderState(
                    workInProgress2,
                    true,
                    // isBackwards
                    _tail,
                    null,
                    // last
                    tailMode
                  );
                  break;
                }
                case "together": {
                  initSuspenseListRenderState(
                    workInProgress2,
                    false,
                    // isBackwards
                    null,
                    // tail
                    null,
                    // last
                    void 0
                  );
                  break;
                }
                default: {
                  workInProgress2.memoizedState = null;
                }
              }
            }
            return workInProgress2.child;
          }
          function updatePortalComponent(current2, workInProgress2, renderLanes2) {
            pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
            var nextChildren = workInProgress2.pendingProps;
            if (current2 === null) {
              workInProgress2.child = reconcileChildFibers(workInProgress2, null, nextChildren, renderLanes2);
            } else {
              reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
            }
            return workInProgress2.child;
          }
          var hasWarnedAboutUsingNoValuePropOnContextProvider = false;
          function updateContextProvider(current2, workInProgress2, renderLanes2) {
            var providerType = workInProgress2.type;
            var context = providerType._context;
            var newProps = workInProgress2.pendingProps;
            var oldProps = workInProgress2.memoizedProps;
            var newValue = newProps.value;
            {
              if (!("value" in newProps)) {
                if (!hasWarnedAboutUsingNoValuePropOnContextProvider) {
                  hasWarnedAboutUsingNoValuePropOnContextProvider = true;
                  error("The `value` prop is required for the `<Context.Provider>`. Did you misspell it or forget to pass it?");
                }
              }
              var providerPropTypes = workInProgress2.type.propTypes;
              if (providerPropTypes) {
                checkPropTypes(providerPropTypes, newProps, "prop", "Context.Provider");
              }
            }
            pushProvider(workInProgress2, context, newValue);
            {
              if (oldProps !== null) {
                var oldValue = oldProps.value;
                if (objectIs(oldValue, newValue)) {
                  if (oldProps.children === newProps.children && !hasContextChanged()) {
                    return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
                  }
                } else {
                  propagateContextChange(workInProgress2, context, renderLanes2);
                }
              }
            }
            var newChildren = newProps.children;
            reconcileChildren(current2, workInProgress2, newChildren, renderLanes2);
            return workInProgress2.child;
          }
          var hasWarnedAboutUsingContextAsConsumer = false;
          function updateContextConsumer(current2, workInProgress2, renderLanes2) {
            var context = workInProgress2.type;
            {
              if (context._context === void 0) {
                if (context !== context.Consumer) {
                  if (!hasWarnedAboutUsingContextAsConsumer) {
                    hasWarnedAboutUsingContextAsConsumer = true;
                    error("Rendering <Context> directly is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                  }
                }
              } else {
                context = context._context;
              }
            }
            var newProps = workInProgress2.pendingProps;
            var render = newProps.children;
            {
              if (typeof render !== "function") {
                error("A context consumer was rendered with multiple children, or a child that isn't a function. A context consumer expects a single child that is a function. If you did pass a function, make sure there is no trailing or leading whitespace around it.");
              }
            }
            prepareToReadContext(workInProgress2, renderLanes2);
            var newValue = readContext(context);
            {
              markComponentRenderStarted(workInProgress2);
            }
            var newChildren;
            {
              ReactCurrentOwner$1.current = workInProgress2;
              setIsRendering(true);
              newChildren = render(newValue);
              setIsRendering(false);
            }
            {
              markComponentRenderStopped();
            }
            workInProgress2.flags |= PerformedWork;
            reconcileChildren(current2, workInProgress2, newChildren, renderLanes2);
            return workInProgress2.child;
          }
          function markWorkInProgressReceivedUpdate() {
            didReceiveUpdate = true;
          }
          function resetSuspendedCurrentOnMountInLegacyMode(current2, workInProgress2) {
            if ((workInProgress2.mode & ConcurrentMode) === NoMode) {
              if (current2 !== null) {
                current2.alternate = null;
                workInProgress2.alternate = null;
                workInProgress2.flags |= Placement;
              }
            }
          }
          function bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2) {
            if (current2 !== null) {
              workInProgress2.dependencies = current2.dependencies;
            }
            {
              stopProfilerTimerIfRunning();
            }
            markSkippedUpdateLanes(workInProgress2.lanes);
            if (!includesSomeLane(renderLanes2, workInProgress2.childLanes)) {
              {
                return null;
              }
            }
            cloneChildFibers(current2, workInProgress2);
            return workInProgress2.child;
          }
          function remountFiber(current2, oldWorkInProgress, newWorkInProgress) {
            {
              var returnFiber = oldWorkInProgress.return;
              if (returnFiber === null) {
                throw new Error("Cannot swap the root fiber.");
              }
              current2.alternate = null;
              oldWorkInProgress.alternate = null;
              newWorkInProgress.index = oldWorkInProgress.index;
              newWorkInProgress.sibling = oldWorkInProgress.sibling;
              newWorkInProgress.return = oldWorkInProgress.return;
              newWorkInProgress.ref = oldWorkInProgress.ref;
              if (oldWorkInProgress === returnFiber.child) {
                returnFiber.child = newWorkInProgress;
              } else {
                var prevSibling = returnFiber.child;
                if (prevSibling === null) {
                  throw new Error("Expected parent to have a child.");
                }
                while (prevSibling.sibling !== oldWorkInProgress) {
                  prevSibling = prevSibling.sibling;
                  if (prevSibling === null) {
                    throw new Error("Expected to find the previous sibling.");
                  }
                }
                prevSibling.sibling = newWorkInProgress;
              }
              var deletions = returnFiber.deletions;
              if (deletions === null) {
                returnFiber.deletions = [current2];
                returnFiber.flags |= ChildDeletion;
              } else {
                deletions.push(current2);
              }
              newWorkInProgress.flags |= Placement;
              return newWorkInProgress;
            }
          }
          function checkScheduledUpdateOrContext(current2, renderLanes2) {
            var updateLanes = current2.lanes;
            if (includesSomeLane(updateLanes, renderLanes2)) {
              return true;
            }
            return false;
          }
          function attemptEarlyBailoutIfNoScheduledUpdate(current2, workInProgress2, renderLanes2) {
            switch (workInProgress2.tag) {
              case HostRoot:
                pushHostRootContext(workInProgress2);
                var root = workInProgress2.stateNode;
                resetHydrationState();
                break;
              case HostComponent:
                pushHostContext(workInProgress2);
                break;
              case ClassComponent: {
                var Component = workInProgress2.type;
                if (isContextProvider(Component)) {
                  pushContextProvider(workInProgress2);
                }
                break;
              }
              case HostPortal:
                pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
                break;
              case ContextProvider: {
                var newValue = workInProgress2.memoizedProps.value;
                var context = workInProgress2.type._context;
                pushProvider(workInProgress2, context, newValue);
                break;
              }
              case Profiler:
                {
                  var hasChildWork = includesSomeLane(renderLanes2, workInProgress2.childLanes);
                  if (hasChildWork) {
                    workInProgress2.flags |= Update;
                  }
                  {
                    var stateNode = workInProgress2.stateNode;
                    stateNode.effectDuration = 0;
                    stateNode.passiveEffectDuration = 0;
                  }
                }
                break;
              case SuspenseComponent: {
                var state = workInProgress2.memoizedState;
                if (state !== null) {
                  if (state.dehydrated !== null) {
                    pushSuspenseContext(workInProgress2, setDefaultShallowSuspenseContext(suspenseStackCursor.current));
                    workInProgress2.flags |= DidCapture;
                    return null;
                  }
                  var primaryChildFragment = workInProgress2.child;
                  var primaryChildLanes = primaryChildFragment.childLanes;
                  if (includesSomeLane(renderLanes2, primaryChildLanes)) {
                    return updateSuspenseComponent(current2, workInProgress2, renderLanes2);
                  } else {
                    pushSuspenseContext(workInProgress2, setDefaultShallowSuspenseContext(suspenseStackCursor.current));
                    var child = bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
                    if (child !== null) {
                      return child.sibling;
                    } else {
                      return null;
                    }
                  }
                } else {
                  pushSuspenseContext(workInProgress2, setDefaultShallowSuspenseContext(suspenseStackCursor.current));
                }
                break;
              }
              case SuspenseListComponent: {
                var didSuspendBefore = (current2.flags & DidCapture) !== NoFlags;
                var _hasChildWork = includesSomeLane(renderLanes2, workInProgress2.childLanes);
                if (didSuspendBefore) {
                  if (_hasChildWork) {
                    return updateSuspenseListComponent(current2, workInProgress2, renderLanes2);
                  }
                  workInProgress2.flags |= DidCapture;
                }
                var renderState = workInProgress2.memoizedState;
                if (renderState !== null) {
                  renderState.rendering = null;
                  renderState.tail = null;
                  renderState.lastEffect = null;
                }
                pushSuspenseContext(workInProgress2, suspenseStackCursor.current);
                if (_hasChildWork) {
                  break;
                } else {
                  return null;
                }
              }
              case OffscreenComponent:
              case LegacyHiddenComponent: {
                workInProgress2.lanes = NoLanes;
                return updateOffscreenComponent(current2, workInProgress2, renderLanes2);
              }
            }
            return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
          }
          function beginWork(current2, workInProgress2, renderLanes2) {
            {
              if (workInProgress2._debugNeedsRemount && current2 !== null) {
                return remountFiber(current2, workInProgress2, createFiberFromTypeAndProps(workInProgress2.type, workInProgress2.key, workInProgress2.pendingProps, workInProgress2._debugOwner || null, workInProgress2.mode, workInProgress2.lanes));
              }
            }
            if (current2 !== null) {
              var oldProps = current2.memoizedProps;
              var newProps = workInProgress2.pendingProps;
              if (oldProps !== newProps || hasContextChanged() || // Force a re-render if the implementation changed due to hot reload:
              workInProgress2.type !== current2.type) {
                didReceiveUpdate = true;
              } else {
                var hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current2, renderLanes2);
                if (!hasScheduledUpdateOrContext && // If this is the second pass of an error or suspense boundary, there
                // may not be work scheduled on `current`, so we check for this flag.
                (workInProgress2.flags & DidCapture) === NoFlags) {
                  didReceiveUpdate = false;
                  return attemptEarlyBailoutIfNoScheduledUpdate(current2, workInProgress2, renderLanes2);
                }
                if ((current2.flags & ForceUpdateForLegacySuspense) !== NoFlags) {
                  didReceiveUpdate = true;
                } else {
                  didReceiveUpdate = false;
                }
              }
            } else {
              didReceiveUpdate = false;
              if (getIsHydrating() && isForkedChild(workInProgress2)) {
                var slotIndex = workInProgress2.index;
                var numberOfForks = getForksAtLevel();
                pushTreeId(workInProgress2, numberOfForks, slotIndex);
              }
            }
            workInProgress2.lanes = NoLanes;
            switch (workInProgress2.tag) {
              case IndeterminateComponent: {
                return mountIndeterminateComponent(current2, workInProgress2, workInProgress2.type, renderLanes2);
              }
              case LazyComponent: {
                var elementType = workInProgress2.elementType;
                return mountLazyComponent(current2, workInProgress2, elementType, renderLanes2);
              }
              case FunctionComponent: {
                var Component = workInProgress2.type;
                var unresolvedProps = workInProgress2.pendingProps;
                var resolvedProps = workInProgress2.elementType === Component ? unresolvedProps : resolveDefaultProps(Component, unresolvedProps);
                return updateFunctionComponent(current2, workInProgress2, Component, resolvedProps, renderLanes2);
              }
              case ClassComponent: {
                var _Component = workInProgress2.type;
                var _unresolvedProps = workInProgress2.pendingProps;
                var _resolvedProps = workInProgress2.elementType === _Component ? _unresolvedProps : resolveDefaultProps(_Component, _unresolvedProps);
                return updateClassComponent(current2, workInProgress2, _Component, _resolvedProps, renderLanes2);
              }
              case HostRoot:
                return updateHostRoot(current2, workInProgress2, renderLanes2);
              case HostComponent:
                return updateHostComponent(current2, workInProgress2, renderLanes2);
              case HostText:
                return updateHostText(current2, workInProgress2);
              case SuspenseComponent:
                return updateSuspenseComponent(current2, workInProgress2, renderLanes2);
              case HostPortal:
                return updatePortalComponent(current2, workInProgress2, renderLanes2);
              case ForwardRef: {
                var type = workInProgress2.type;
                var _unresolvedProps2 = workInProgress2.pendingProps;
                var _resolvedProps2 = workInProgress2.elementType === type ? _unresolvedProps2 : resolveDefaultProps(type, _unresolvedProps2);
                return updateForwardRef(current2, workInProgress2, type, _resolvedProps2, renderLanes2);
              }
              case Fragment2:
                return updateFragment(current2, workInProgress2, renderLanes2);
              case Mode:
                return updateMode(current2, workInProgress2, renderLanes2);
              case Profiler:
                return updateProfiler(current2, workInProgress2, renderLanes2);
              case ContextProvider:
                return updateContextProvider(current2, workInProgress2, renderLanes2);
              case ContextConsumer:
                return updateContextConsumer(current2, workInProgress2, renderLanes2);
              case MemoComponent: {
                var _type2 = workInProgress2.type;
                var _unresolvedProps3 = workInProgress2.pendingProps;
                var _resolvedProps3 = resolveDefaultProps(_type2, _unresolvedProps3);
                {
                  if (workInProgress2.type !== workInProgress2.elementType) {
                    var outerPropTypes = _type2.propTypes;
                    if (outerPropTypes) {
                      checkPropTypes(
                        outerPropTypes,
                        _resolvedProps3,
                        // Resolved for outer only
                        "prop",
                        getComponentNameFromType(_type2)
                      );
                    }
                  }
                }
                _resolvedProps3 = resolveDefaultProps(_type2.type, _resolvedProps3);
                return updateMemoComponent(current2, workInProgress2, _type2, _resolvedProps3, renderLanes2);
              }
              case SimpleMemoComponent: {
                return updateSimpleMemoComponent(current2, workInProgress2, workInProgress2.type, workInProgress2.pendingProps, renderLanes2);
              }
              case IncompleteClassComponent: {
                var _Component2 = workInProgress2.type;
                var _unresolvedProps4 = workInProgress2.pendingProps;
                var _resolvedProps4 = workInProgress2.elementType === _Component2 ? _unresolvedProps4 : resolveDefaultProps(_Component2, _unresolvedProps4);
                return mountIncompleteClassComponent(current2, workInProgress2, _Component2, _resolvedProps4, renderLanes2);
              }
              case SuspenseListComponent: {
                return updateSuspenseListComponent(current2, workInProgress2, renderLanes2);
              }
              case ScopeComponent: {
                break;
              }
              case OffscreenComponent: {
                return updateOffscreenComponent(current2, workInProgress2, renderLanes2);
              }
            }
            throw new Error("Unknown unit of work tag (" + workInProgress2.tag + "). This error is likely caused by a bug in React. Please file an issue.");
          }
          function markUpdate(workInProgress2) {
            workInProgress2.flags |= Update;
          }
          function markRef$1(workInProgress2) {
            workInProgress2.flags |= Ref;
            {
              workInProgress2.flags |= RefStatic;
            }
          }
          function hadNoMutationsEffects(current2, completedWork) {
            var didBailout = current2 !== null && current2.child === completedWork.child;
            if (didBailout) {
              return true;
            }
            if ((completedWork.flags & ChildDeletion) !== NoFlags) {
              return false;
            }
            var child = completedWork.child;
            while (child !== null) {
              if ((child.flags & MutationMask) !== NoFlags || (child.subtreeFlags & MutationMask) !== NoFlags) {
                return false;
              }
              child = child.sibling;
            }
            return true;
          }
          var appendAllChildren;
          var updateHostContainer;
          var updateHostComponent$1;
          var updateHostText$1;
          if (supportsMutation) {
            appendAllChildren = function(parent, workInProgress2, needsVisibilityToggle, isHidden) {
              var node = workInProgress2.child;
              while (node !== null) {
                if (node.tag === HostComponent || node.tag === HostText) {
                  appendInitialChild(parent, node.stateNode);
                } else if (node.tag === HostPortal) ;
                else if (node.child !== null) {
                  node.child.return = node;
                  node = node.child;
                  continue;
                }
                if (node === workInProgress2) {
                  return;
                }
                while (node.sibling === null) {
                  if (node.return === null || node.return === workInProgress2) {
                    return;
                  }
                  node = node.return;
                }
                node.sibling.return = node.return;
                node = node.sibling;
              }
            };
            updateHostContainer = function(current2, workInProgress2) {
            };
            updateHostComponent$1 = function(current2, workInProgress2, type, newProps, rootContainerInstance) {
              var oldProps = current2.memoizedProps;
              if (oldProps === newProps) {
                return;
              }
              var instance = workInProgress2.stateNode;
              var currentHostContext = getHostContext();
              var updatePayload = prepareUpdate(instance, type, oldProps, newProps, rootContainerInstance, currentHostContext);
              workInProgress2.updateQueue = updatePayload;
              if (updatePayload) {
                markUpdate(workInProgress2);
              }
            };
            updateHostText$1 = function(current2, workInProgress2, oldText, newText) {
              if (oldText !== newText) {
                markUpdate(workInProgress2);
              }
            };
          } else if (supportsPersistence) {
            appendAllChildren = function(parent, workInProgress2, needsVisibilityToggle, isHidden) {
              var node = workInProgress2.child;
              while (node !== null) {
                if (node.tag === HostComponent) {
                  var instance = node.stateNode;
                  if (needsVisibilityToggle && isHidden) {
                    var props = node.memoizedProps;
                    var type = node.type;
                    instance = cloneHiddenInstance(instance, type, props, node);
                  }
                  appendInitialChild(parent, instance);
                } else if (node.tag === HostText) {
                  var _instance = node.stateNode;
                  if (needsVisibilityToggle && isHidden) {
                    var text = node.memoizedProps;
                    _instance = cloneHiddenTextInstance(_instance, text, node);
                  }
                  appendInitialChild(parent, _instance);
                } else if (node.tag === HostPortal) ;
                else if (node.tag === OffscreenComponent && node.memoizedState !== null) {
                  var child = node.child;
                  if (child !== null) {
                    child.return = node;
                  }
                  appendAllChildren(parent, node, true, true);
                } else if (node.child !== null) {
                  node.child.return = node;
                  node = node.child;
                  continue;
                }
                node = node;
                if (node === workInProgress2) {
                  return;
                }
                while (node.sibling === null) {
                  if (node.return === null || node.return === workInProgress2) {
                    return;
                  }
                  node = node.return;
                }
                node.sibling.return = node.return;
                node = node.sibling;
              }
            };
            var appendAllChildrenToContainer = function(containerChildSet, workInProgress2, needsVisibilityToggle, isHidden) {
              var node = workInProgress2.child;
              while (node !== null) {
                if (node.tag === HostComponent) {
                  var instance = node.stateNode;
                  if (needsVisibilityToggle && isHidden) {
                    var props = node.memoizedProps;
                    var type = node.type;
                    instance = cloneHiddenInstance(instance, type, props, node);
                  }
                  appendChildToContainerChildSet(containerChildSet, instance);
                } else if (node.tag === HostText) {
                  var _instance2 = node.stateNode;
                  if (needsVisibilityToggle && isHidden) {
                    var text = node.memoizedProps;
                    _instance2 = cloneHiddenTextInstance(_instance2, text, node);
                  }
                  appendChildToContainerChildSet(containerChildSet, _instance2);
                } else if (node.tag === HostPortal) ;
                else if (node.tag === OffscreenComponent && node.memoizedState !== null) {
                  var child = node.child;
                  if (child !== null) {
                    child.return = node;
                  }
                  appendAllChildrenToContainer(containerChildSet, node, true, true);
                } else if (node.child !== null) {
                  node.child.return = node;
                  node = node.child;
                  continue;
                }
                node = node;
                if (node === workInProgress2) {
                  return;
                }
                while (node.sibling === null) {
                  if (node.return === null || node.return === workInProgress2) {
                    return;
                  }
                  node = node.return;
                }
                node.sibling.return = node.return;
                node = node.sibling;
              }
            };
            updateHostContainer = function(current2, workInProgress2) {
              var portalOrRoot = workInProgress2.stateNode;
              var childrenUnchanged = hadNoMutationsEffects(current2, workInProgress2);
              if (childrenUnchanged) ;
              else {
                var container = portalOrRoot.containerInfo;
                var newChildSet = createContainerChildSet(container);
                appendAllChildrenToContainer(newChildSet, workInProgress2, false, false);
                portalOrRoot.pendingChildren = newChildSet;
                markUpdate(workInProgress2);
                finalizeContainerChildren(container, newChildSet);
              }
            };
            updateHostComponent$1 = function(current2, workInProgress2, type, newProps, rootContainerInstance) {
              var currentInstance = current2.stateNode;
              var oldProps = current2.memoizedProps;
              var childrenUnchanged = hadNoMutationsEffects(current2, workInProgress2);
              if (childrenUnchanged && oldProps === newProps) {
                workInProgress2.stateNode = currentInstance;
                return;
              }
              var recyclableInstance = workInProgress2.stateNode;
              var currentHostContext = getHostContext();
              var updatePayload = null;
              if (oldProps !== newProps) {
                updatePayload = prepareUpdate(recyclableInstance, type, oldProps, newProps, rootContainerInstance, currentHostContext);
              }
              if (childrenUnchanged && updatePayload === null) {
                workInProgress2.stateNode = currentInstance;
                return;
              }
              var newInstance = cloneInstance(currentInstance, updatePayload, type, oldProps, newProps, workInProgress2, childrenUnchanged, recyclableInstance);
              if (finalizeInitialChildren(newInstance, type, newProps, rootContainerInstance, currentHostContext)) {
                markUpdate(workInProgress2);
              }
              workInProgress2.stateNode = newInstance;
              if (childrenUnchanged) {
                markUpdate(workInProgress2);
              } else {
                appendAllChildren(newInstance, workInProgress2, false, false);
              }
            };
            updateHostText$1 = function(current2, workInProgress2, oldText, newText) {
              if (oldText !== newText) {
                var rootContainerInstance = getRootHostContainer();
                var currentHostContext = getHostContext();
                workInProgress2.stateNode = createTextInstance(newText, rootContainerInstance, currentHostContext, workInProgress2);
                markUpdate(workInProgress2);
              } else {
                workInProgress2.stateNode = current2.stateNode;
              }
            };
          } else {
            updateHostContainer = function(current2, workInProgress2) {
            };
            updateHostComponent$1 = function(current2, workInProgress2, type, newProps, rootContainerInstance) {
            };
            updateHostText$1 = function(current2, workInProgress2, oldText, newText) {
            };
          }
          function cutOffTailIfNeeded(renderState, hasRenderedATailFallback) {
            if (getIsHydrating()) {
              return;
            }
            switch (renderState.tailMode) {
              case "hidden": {
                var tailNode = renderState.tail;
                var lastTailNode = null;
                while (tailNode !== null) {
                  if (tailNode.alternate !== null) {
                    lastTailNode = tailNode;
                  }
                  tailNode = tailNode.sibling;
                }
                if (lastTailNode === null) {
                  renderState.tail = null;
                } else {
                  lastTailNode.sibling = null;
                }
                break;
              }
              case "collapsed": {
                var _tailNode = renderState.tail;
                var _lastTailNode = null;
                while (_tailNode !== null) {
                  if (_tailNode.alternate !== null) {
                    _lastTailNode = _tailNode;
                  }
                  _tailNode = _tailNode.sibling;
                }
                if (_lastTailNode === null) {
                  if (!hasRenderedATailFallback && renderState.tail !== null) {
                    renderState.tail.sibling = null;
                  } else {
                    renderState.tail = null;
                  }
                } else {
                  _lastTailNode.sibling = null;
                }
                break;
              }
            }
          }
          function bubbleProperties(completedWork) {
            var didBailout = completedWork.alternate !== null && completedWork.alternate.child === completedWork.child;
            var newChildLanes = NoLanes;
            var subtreeFlags = NoFlags;
            if (!didBailout) {
              if ((completedWork.mode & ProfileMode) !== NoMode) {
                var actualDuration = completedWork.actualDuration;
                var treeBaseDuration = completedWork.selfBaseDuration;
                var child = completedWork.child;
                while (child !== null) {
                  newChildLanes = mergeLanes(newChildLanes, mergeLanes(child.lanes, child.childLanes));
                  subtreeFlags |= child.subtreeFlags;
                  subtreeFlags |= child.flags;
                  actualDuration += child.actualDuration;
                  treeBaseDuration += child.treeBaseDuration;
                  child = child.sibling;
                }
                completedWork.actualDuration = actualDuration;
                completedWork.treeBaseDuration = treeBaseDuration;
              } else {
                var _child = completedWork.child;
                while (_child !== null) {
                  newChildLanes = mergeLanes(newChildLanes, mergeLanes(_child.lanes, _child.childLanes));
                  subtreeFlags |= _child.subtreeFlags;
                  subtreeFlags |= _child.flags;
                  _child.return = completedWork;
                  _child = _child.sibling;
                }
              }
              completedWork.subtreeFlags |= subtreeFlags;
            } else {
              if ((completedWork.mode & ProfileMode) !== NoMode) {
                var _treeBaseDuration = completedWork.selfBaseDuration;
                var _child2 = completedWork.child;
                while (_child2 !== null) {
                  newChildLanes = mergeLanes(newChildLanes, mergeLanes(_child2.lanes, _child2.childLanes));
                  subtreeFlags |= _child2.subtreeFlags & StaticMask;
                  subtreeFlags |= _child2.flags & StaticMask;
                  _treeBaseDuration += _child2.treeBaseDuration;
                  _child2 = _child2.sibling;
                }
                completedWork.treeBaseDuration = _treeBaseDuration;
              } else {
                var _child3 = completedWork.child;
                while (_child3 !== null) {
                  newChildLanes = mergeLanes(newChildLanes, mergeLanes(_child3.lanes, _child3.childLanes));
                  subtreeFlags |= _child3.subtreeFlags & StaticMask;
                  subtreeFlags |= _child3.flags & StaticMask;
                  _child3.return = completedWork;
                  _child3 = _child3.sibling;
                }
              }
              completedWork.subtreeFlags |= subtreeFlags;
            }
            completedWork.childLanes = newChildLanes;
            return didBailout;
          }
          function completeDehydratedSuspenseBoundary(current2, workInProgress2, nextState) {
            if (hasUnhydratedTailNodes() && (workInProgress2.mode & ConcurrentMode) !== NoMode && (workInProgress2.flags & DidCapture) === NoFlags) {
              warnIfUnhydratedTailNodes(workInProgress2);
              resetHydrationState();
              workInProgress2.flags |= ForceClientRender | Incomplete | ShouldCapture;
              return false;
            }
            var wasHydrated = popHydrationState(workInProgress2);
            if (nextState !== null && nextState.dehydrated !== null) {
              if (current2 === null) {
                if (!wasHydrated) {
                  throw new Error("A dehydrated suspense component was completed without a hydrated node. This is probably a bug in React.");
                }
                prepareToHydrateHostSuspenseInstance(workInProgress2);
                bubbleProperties(workInProgress2);
                {
                  if ((workInProgress2.mode & ProfileMode) !== NoMode) {
                    var isTimedOutSuspense = nextState !== null;
                    if (isTimedOutSuspense) {
                      var primaryChildFragment = workInProgress2.child;
                      if (primaryChildFragment !== null) {
                        workInProgress2.treeBaseDuration -= primaryChildFragment.treeBaseDuration;
                      }
                    }
                  }
                }
                return false;
              } else {
                resetHydrationState();
                if ((workInProgress2.flags & DidCapture) === NoFlags) {
                  workInProgress2.memoizedState = null;
                }
                workInProgress2.flags |= Update;
                bubbleProperties(workInProgress2);
                {
                  if ((workInProgress2.mode & ProfileMode) !== NoMode) {
                    var _isTimedOutSuspense = nextState !== null;
                    if (_isTimedOutSuspense) {
                      var _primaryChildFragment = workInProgress2.child;
                      if (_primaryChildFragment !== null) {
                        workInProgress2.treeBaseDuration -= _primaryChildFragment.treeBaseDuration;
                      }
                    }
                  }
                }
                return false;
              }
            } else {
              upgradeHydrationErrorsToRecoverable();
              return true;
            }
          }
          function completeWork(current2, workInProgress2, renderLanes2) {
            var newProps = workInProgress2.pendingProps;
            popTreeContext(workInProgress2);
            switch (workInProgress2.tag) {
              case IndeterminateComponent:
              case LazyComponent:
              case SimpleMemoComponent:
              case FunctionComponent:
              case ForwardRef:
              case Fragment2:
              case Mode:
              case Profiler:
              case ContextConsumer:
              case MemoComponent:
                bubbleProperties(workInProgress2);
                return null;
              case ClassComponent: {
                var Component = workInProgress2.type;
                if (isContextProvider(Component)) {
                  popContext(workInProgress2);
                }
                bubbleProperties(workInProgress2);
                return null;
              }
              case HostRoot: {
                var fiberRoot = workInProgress2.stateNode;
                popHostContainer(workInProgress2);
                popTopLevelContextObject(workInProgress2);
                resetWorkInProgressVersions();
                if (fiberRoot.pendingContext) {
                  fiberRoot.context = fiberRoot.pendingContext;
                  fiberRoot.pendingContext = null;
                }
                if (current2 === null || current2.child === null) {
                  var wasHydrated = popHydrationState(workInProgress2);
                  if (wasHydrated) {
                    markUpdate(workInProgress2);
                  } else {
                    if (current2 !== null) {
                      var prevState = current2.memoizedState;
                      if (
                        // Check if this is a client root
                        !prevState.isDehydrated || // Check if we reverted to client rendering (e.g. due to an error)
                        (workInProgress2.flags & ForceClientRender) !== NoFlags
                      ) {
                        workInProgress2.flags |= Snapshot;
                        upgradeHydrationErrorsToRecoverable();
                      }
                    }
                  }
                }
                updateHostContainer(current2, workInProgress2);
                bubbleProperties(workInProgress2);
                return null;
              }
              case HostComponent: {
                popHostContext(workInProgress2);
                var rootContainerInstance = getRootHostContainer();
                var type = workInProgress2.type;
                if (current2 !== null && workInProgress2.stateNode != null) {
                  updateHostComponent$1(current2, workInProgress2, type, newProps, rootContainerInstance);
                  if (current2.ref !== workInProgress2.ref) {
                    markRef$1(workInProgress2);
                  }
                } else {
                  if (!newProps) {
                    if (workInProgress2.stateNode === null) {
                      throw new Error("We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.");
                    }
                    bubbleProperties(workInProgress2);
                    return null;
                  }
                  var currentHostContext = getHostContext();
                  var _wasHydrated = popHydrationState(workInProgress2);
                  if (_wasHydrated) {
                    if (prepareToHydrateHostInstance(workInProgress2, rootContainerInstance, currentHostContext)) {
                      markUpdate(workInProgress2);
                    }
                  } else {
                    var instance = createInstance(type, newProps, rootContainerInstance, currentHostContext, workInProgress2);
                    appendAllChildren(instance, workInProgress2, false, false);
                    workInProgress2.stateNode = instance;
                    if (finalizeInitialChildren(instance, type, newProps, rootContainerInstance, currentHostContext)) {
                      markUpdate(workInProgress2);
                    }
                  }
                  if (workInProgress2.ref !== null) {
                    markRef$1(workInProgress2);
                  }
                }
                bubbleProperties(workInProgress2);
                return null;
              }
              case HostText: {
                var newText = newProps;
                if (current2 && workInProgress2.stateNode != null) {
                  var oldText = current2.memoizedProps;
                  updateHostText$1(current2, workInProgress2, oldText, newText);
                } else {
                  if (typeof newText !== "string") {
                    if (workInProgress2.stateNode === null) {
                      throw new Error("We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.");
                    }
                  }
                  var _rootContainerInstance = getRootHostContainer();
                  var _currentHostContext = getHostContext();
                  var _wasHydrated2 = popHydrationState(workInProgress2);
                  if (_wasHydrated2) {
                    if (prepareToHydrateHostTextInstance(workInProgress2)) {
                      markUpdate(workInProgress2);
                    }
                  } else {
                    workInProgress2.stateNode = createTextInstance(newText, _rootContainerInstance, _currentHostContext, workInProgress2);
                  }
                }
                bubbleProperties(workInProgress2);
                return null;
              }
              case SuspenseComponent: {
                popSuspenseContext(workInProgress2);
                var nextState = workInProgress2.memoizedState;
                if (current2 === null || current2.memoizedState !== null && current2.memoizedState.dehydrated !== null) {
                  var fallthroughToNormalSuspensePath = completeDehydratedSuspenseBoundary(current2, workInProgress2, nextState);
                  if (!fallthroughToNormalSuspensePath) {
                    if (workInProgress2.flags & ShouldCapture) {
                      return workInProgress2;
                    } else {
                      return null;
                    }
                  }
                }
                if ((workInProgress2.flags & DidCapture) !== NoFlags) {
                  workInProgress2.lanes = renderLanes2;
                  if ((workInProgress2.mode & ProfileMode) !== NoMode) {
                    transferActualDuration(workInProgress2);
                  }
                  return workInProgress2;
                }
                var nextDidTimeout = nextState !== null;
                var prevDidTimeout = current2 !== null && current2.memoizedState !== null;
                if (nextDidTimeout !== prevDidTimeout) {
                  if (nextDidTimeout) {
                    var _offscreenFiber2 = workInProgress2.child;
                    _offscreenFiber2.flags |= Visibility;
                    if ((workInProgress2.mode & ConcurrentMode) !== NoMode) {
                      var hasInvisibleChildContext = current2 === null && (workInProgress2.memoizedProps.unstable_avoidThisFallback !== true || !enableSuspenseAvoidThisFallback);
                      if (hasInvisibleChildContext || hasSuspenseContext(suspenseStackCursor.current, InvisibleParentSuspenseContext)) {
                        renderDidSuspend();
                      } else {
                        renderDidSuspendDelayIfPossible();
                      }
                    }
                  }
                }
                var wakeables = workInProgress2.updateQueue;
                if (wakeables !== null) {
                  workInProgress2.flags |= Update;
                }
                bubbleProperties(workInProgress2);
                {
                  if ((workInProgress2.mode & ProfileMode) !== NoMode) {
                    if (nextDidTimeout) {
                      var primaryChildFragment = workInProgress2.child;
                      if (primaryChildFragment !== null) {
                        workInProgress2.treeBaseDuration -= primaryChildFragment.treeBaseDuration;
                      }
                    }
                  }
                }
                return null;
              }
              case HostPortal:
                popHostContainer(workInProgress2);
                updateHostContainer(current2, workInProgress2);
                if (current2 === null) {
                  preparePortalMount(workInProgress2.stateNode.containerInfo);
                }
                bubbleProperties(workInProgress2);
                return null;
              case ContextProvider:
                var context = workInProgress2.type._context;
                popProvider(context, workInProgress2);
                bubbleProperties(workInProgress2);
                return null;
              case IncompleteClassComponent: {
                var _Component = workInProgress2.type;
                if (isContextProvider(_Component)) {
                  popContext(workInProgress2);
                }
                bubbleProperties(workInProgress2);
                return null;
              }
              case SuspenseListComponent: {
                popSuspenseContext(workInProgress2);
                var renderState = workInProgress2.memoizedState;
                if (renderState === null) {
                  bubbleProperties(workInProgress2);
                  return null;
                }
                var didSuspendAlready = (workInProgress2.flags & DidCapture) !== NoFlags;
                var renderedTail = renderState.rendering;
                if (renderedTail === null) {
                  if (!didSuspendAlready) {
                    var cannotBeSuspended = renderHasNotSuspendedYet() && (current2 === null || (current2.flags & DidCapture) === NoFlags);
                    if (!cannotBeSuspended) {
                      var row = workInProgress2.child;
                      while (row !== null) {
                        var suspended = findFirstSuspended(row);
                        if (suspended !== null) {
                          didSuspendAlready = true;
                          workInProgress2.flags |= DidCapture;
                          cutOffTailIfNeeded(renderState, false);
                          var newThenables = suspended.updateQueue;
                          if (newThenables !== null) {
                            workInProgress2.updateQueue = newThenables;
                            workInProgress2.flags |= Update;
                          }
                          workInProgress2.subtreeFlags = NoFlags;
                          resetChildFibers(workInProgress2, renderLanes2);
                          pushSuspenseContext(workInProgress2, setShallowSuspenseContext(suspenseStackCursor.current, ForceSuspenseFallback));
                          return workInProgress2.child;
                        }
                        row = row.sibling;
                      }
                    }
                    if (renderState.tail !== null && now() > getRenderTargetTime()) {
                      workInProgress2.flags |= DidCapture;
                      didSuspendAlready = true;
                      cutOffTailIfNeeded(renderState, false);
                      workInProgress2.lanes = SomeRetryLane;
                    }
                  } else {
                    cutOffTailIfNeeded(renderState, false);
                  }
                } else {
                  if (!didSuspendAlready) {
                    var _suspended = findFirstSuspended(renderedTail);
                    if (_suspended !== null) {
                      workInProgress2.flags |= DidCapture;
                      didSuspendAlready = true;
                      var _newThenables = _suspended.updateQueue;
                      if (_newThenables !== null) {
                        workInProgress2.updateQueue = _newThenables;
                        workInProgress2.flags |= Update;
                      }
                      cutOffTailIfNeeded(renderState, true);
                      if (renderState.tail === null && renderState.tailMode === "hidden" && !renderedTail.alternate && !getIsHydrating()) {
                        bubbleProperties(workInProgress2);
                        return null;
                      }
                    } else if (
                      // The time it took to render last row is greater than the remaining
                      // time we have to render. So rendering one more row would likely
                      // exceed it.
                      now() * 2 - renderState.renderingStartTime > getRenderTargetTime() && renderLanes2 !== OffscreenLane
                    ) {
                      workInProgress2.flags |= DidCapture;
                      didSuspendAlready = true;
                      cutOffTailIfNeeded(renderState, false);
                      workInProgress2.lanes = SomeRetryLane;
                    }
                  }
                  if (renderState.isBackwards) {
                    renderedTail.sibling = workInProgress2.child;
                    workInProgress2.child = renderedTail;
                  } else {
                    var previousSibling = renderState.last;
                    if (previousSibling !== null) {
                      previousSibling.sibling = renderedTail;
                    } else {
                      workInProgress2.child = renderedTail;
                    }
                    renderState.last = renderedTail;
                  }
                }
                if (renderState.tail !== null) {
                  var next = renderState.tail;
                  renderState.rendering = next;
                  renderState.tail = next.sibling;
                  renderState.renderingStartTime = now();
                  next.sibling = null;
                  var suspenseContext = suspenseStackCursor.current;
                  if (didSuspendAlready) {
                    suspenseContext = setShallowSuspenseContext(suspenseContext, ForceSuspenseFallback);
                  } else {
                    suspenseContext = setDefaultShallowSuspenseContext(suspenseContext);
                  }
                  pushSuspenseContext(workInProgress2, suspenseContext);
                  return next;
                }
                bubbleProperties(workInProgress2);
                return null;
              }
              case ScopeComponent: {
                break;
              }
              case OffscreenComponent:
              case LegacyHiddenComponent: {
                popRenderLanes(workInProgress2);
                var _nextState = workInProgress2.memoizedState;
                var nextIsHidden = _nextState !== null;
                if (current2 !== null) {
                  var _prevState = current2.memoizedState;
                  var prevIsHidden = _prevState !== null;
                  if (prevIsHidden !== nextIsHidden && // LegacyHidden doesn't do any hiding — it only pre-renders.
                  !enableLegacyHidden) {
                    workInProgress2.flags |= Visibility;
                  }
                }
                if (!nextIsHidden || (workInProgress2.mode & ConcurrentMode) === NoMode) {
                  bubbleProperties(workInProgress2);
                } else {
                  if (includesSomeLane(subtreeRenderLanes, OffscreenLane)) {
                    bubbleProperties(workInProgress2);
                    if (supportsMutation) {
                      if (workInProgress2.subtreeFlags & (Placement | Update)) {
                        workInProgress2.flags |= Visibility;
                      }
                    }
                  }
                }
                return null;
              }
              case CacheComponent: {
                return null;
              }
              case TracingMarkerComponent: {
                return null;
              }
            }
            throw new Error("Unknown unit of work tag (" + workInProgress2.tag + "). This error is likely caused by a bug in React. Please file an issue.");
          }
          function unwindWork(current2, workInProgress2, renderLanes2) {
            popTreeContext(workInProgress2);
            switch (workInProgress2.tag) {
              case ClassComponent: {
                var Component = workInProgress2.type;
                if (isContextProvider(Component)) {
                  popContext(workInProgress2);
                }
                var flags = workInProgress2.flags;
                if (flags & ShouldCapture) {
                  workInProgress2.flags = flags & ~ShouldCapture | DidCapture;
                  if ((workInProgress2.mode & ProfileMode) !== NoMode) {
                    transferActualDuration(workInProgress2);
                  }
                  return workInProgress2;
                }
                return null;
              }
              case HostRoot: {
                var root = workInProgress2.stateNode;
                popHostContainer(workInProgress2);
                popTopLevelContextObject(workInProgress2);
                resetWorkInProgressVersions();
                var _flags = workInProgress2.flags;
                if ((_flags & ShouldCapture) !== NoFlags && (_flags & DidCapture) === NoFlags) {
                  workInProgress2.flags = _flags & ~ShouldCapture | DidCapture;
                  return workInProgress2;
                }
                return null;
              }
              case HostComponent: {
                popHostContext(workInProgress2);
                return null;
              }
              case SuspenseComponent: {
                popSuspenseContext(workInProgress2);
                var suspenseState = workInProgress2.memoizedState;
                if (suspenseState !== null && suspenseState.dehydrated !== null) {
                  if (workInProgress2.alternate === null) {
                    throw new Error("Threw in newly mounted dehydrated component. This is likely a bug in React. Please file an issue.");
                  }
                  resetHydrationState();
                }
                var _flags2 = workInProgress2.flags;
                if (_flags2 & ShouldCapture) {
                  workInProgress2.flags = _flags2 & ~ShouldCapture | DidCapture;
                  if ((workInProgress2.mode & ProfileMode) !== NoMode) {
                    transferActualDuration(workInProgress2);
                  }
                  return workInProgress2;
                }
                return null;
              }
              case SuspenseListComponent: {
                popSuspenseContext(workInProgress2);
                return null;
              }
              case HostPortal:
                popHostContainer(workInProgress2);
                return null;
              case ContextProvider:
                var context = workInProgress2.type._context;
                popProvider(context, workInProgress2);
                return null;
              case OffscreenComponent:
              case LegacyHiddenComponent:
                popRenderLanes(workInProgress2);
                return null;
              case CacheComponent:
                return null;
              default:
                return null;
            }
          }
          function unwindInterruptedWork(current2, interruptedWork, renderLanes2) {
            popTreeContext(interruptedWork);
            switch (interruptedWork.tag) {
              case ClassComponent: {
                var childContextTypes = interruptedWork.type.childContextTypes;
                if (childContextTypes !== null && childContextTypes !== void 0) {
                  popContext(interruptedWork);
                }
                break;
              }
              case HostRoot: {
                var root = interruptedWork.stateNode;
                popHostContainer(interruptedWork);
                popTopLevelContextObject(interruptedWork);
                resetWorkInProgressVersions();
                break;
              }
              case HostComponent: {
                popHostContext(interruptedWork);
                break;
              }
              case HostPortal:
                popHostContainer(interruptedWork);
                break;
              case SuspenseComponent:
                popSuspenseContext(interruptedWork);
                break;
              case SuspenseListComponent:
                popSuspenseContext(interruptedWork);
                break;
              case ContextProvider:
                var context = interruptedWork.type._context;
                popProvider(context, interruptedWork);
                break;
              case OffscreenComponent:
              case LegacyHiddenComponent:
                popRenderLanes(interruptedWork);
                break;
            }
          }
          function invokeGuardedCallbackProd(name, func, context, a, b, c, d, e, f) {
            var funcArgs = Array.prototype.slice.call(arguments, 3);
            try {
              func.apply(context, funcArgs);
            } catch (error2) {
              this.onError(error2);
            }
          }
          var invokeGuardedCallbackImpl = invokeGuardedCallbackProd;
          {
            if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof document !== "undefined" && typeof document.createEvent === "function") {
              var fakeNode = document.createElement("react");
              invokeGuardedCallbackImpl = function invokeGuardedCallbackDev(name, func, context, a, b, c, d, e, f) {
                if (typeof document === "undefined" || document === null) {
                  throw new Error("The `document` global was defined when React was initialized, but is not defined anymore. This can happen in a test environment if a component schedules an update from an asynchronous callback, but the test has already finished running. To solve this, you can either unmount the component at the end of your test (and ensure that any asynchronous operations get canceled in `componentWillUnmount`), or you can change the test itself to be asynchronous.");
                }
                var evt = document.createEvent("Event");
                var didCall = false;
                var didError = true;
                var windowEvent = window.event;
                var windowEventDescriptor = Object.getOwnPropertyDescriptor(window, "event");
                function restoreAfterDispatch() {
                  fakeNode.removeEventListener(evtType, callCallback2, false);
                  if (typeof window.event !== "undefined" && window.hasOwnProperty("event")) {
                    window.event = windowEvent;
                  }
                }
                var funcArgs = Array.prototype.slice.call(arguments, 3);
                function callCallback2() {
                  didCall = true;
                  restoreAfterDispatch();
                  func.apply(context, funcArgs);
                  didError = false;
                }
                var error2;
                var didSetError = false;
                var isCrossOriginError = false;
                function handleWindowError(event) {
                  error2 = event.error;
                  didSetError = true;
                  if (error2 === null && event.colno === 0 && event.lineno === 0) {
                    isCrossOriginError = true;
                  }
                  if (event.defaultPrevented) {
                    if (error2 != null && typeof error2 === "object") {
                      try {
                        error2._suppressLogging = true;
                      } catch (inner) {
                      }
                    }
                  }
                }
                var evtType = "react-" + (name ? name : "invokeguardedcallback");
                window.addEventListener("error", handleWindowError);
                fakeNode.addEventListener(evtType, callCallback2, false);
                evt.initEvent(evtType, false, false);
                fakeNode.dispatchEvent(evt);
                if (windowEventDescriptor) {
                  Object.defineProperty(window, "event", windowEventDescriptor);
                }
                if (didCall && didError) {
                  if (!didSetError) {
                    error2 = new Error(`An error was thrown inside one of your components, but React doesn't know what it was. This is likely due to browser flakiness. React does its best to preserve the "Pause on exceptions" behavior of the DevTools, which requires some DEV-mode only tricks. It's possible that these don't work in your browser. Try triggering the error in production mode, or switching to a modern browser. If you suspect that this is actually an issue with React, please file an issue.`);
                  } else if (isCrossOriginError) {
                    error2 = new Error("A cross-origin error was thrown. React doesn't have access to the actual error object in development. See https://reactjs.org/link/crossorigin-error for more information.");
                  }
                  this.onError(error2);
                }
                window.removeEventListener("error", handleWindowError);
                if (!didCall) {
                  restoreAfterDispatch();
                  return invokeGuardedCallbackProd.apply(this, arguments);
                }
              };
            }
          }
          var invokeGuardedCallbackImpl$1 = invokeGuardedCallbackImpl;
          var hasError = false;
          var caughtError = null;
          var reporter = {
            onError: function(error2) {
              hasError = true;
              caughtError = error2;
            }
          };
          function invokeGuardedCallback(name, func, context, a, b, c, d, e, f) {
            hasError = false;
            caughtError = null;
            invokeGuardedCallbackImpl$1.apply(reporter, arguments);
          }
          function hasCaughtError() {
            return hasError;
          }
          function clearCaughtError() {
            if (hasError) {
              var error2 = caughtError;
              hasError = false;
              caughtError = null;
              return error2;
            } else {
              throw new Error("clearCaughtError was called but no error was captured. This error is likely caused by a bug in React. Please file an issue.");
            }
          }
          var didWarnAboutUndefinedSnapshotBeforeUpdate = null;
          {
            didWarnAboutUndefinedSnapshotBeforeUpdate = /* @__PURE__ */ new Set();
          }
          var offscreenSubtreeIsHidden = false;
          var offscreenSubtreeWasHidden = false;
          var PossiblyWeakSet = typeof WeakSet === "function" ? WeakSet : Set;
          var nextEffect = null;
          var inProgressLanes = null;
          var inProgressRoot = null;
          function reportUncaughtErrorInDEV(error2) {
            {
              invokeGuardedCallback(null, function() {
                throw error2;
              });
              clearCaughtError();
            }
          }
          var callComponentWillUnmountWithTimer = function(current2, instance) {
            instance.props = current2.memoizedProps;
            instance.state = current2.memoizedState;
            if (current2.mode & ProfileMode) {
              try {
                startLayoutEffectTimer();
                instance.componentWillUnmount();
              } finally {
                recordLayoutEffectDuration(current2);
              }
            } else {
              instance.componentWillUnmount();
            }
          };
          function safelyCallCommitHookLayoutEffectListMount(current2, nearestMountedAncestor) {
            try {
              commitHookEffectListMount(Layout, current2);
            } catch (error2) {
              captureCommitPhaseError(current2, nearestMountedAncestor, error2);
            }
          }
          function safelyCallComponentWillUnmount(current2, nearestMountedAncestor, instance) {
            try {
              callComponentWillUnmountWithTimer(current2, instance);
            } catch (error2) {
              captureCommitPhaseError(current2, nearestMountedAncestor, error2);
            }
          }
          function safelyCallComponentDidMount(current2, nearestMountedAncestor, instance) {
            try {
              instance.componentDidMount();
            } catch (error2) {
              captureCommitPhaseError(current2, nearestMountedAncestor, error2);
            }
          }
          function safelyAttachRef(current2, nearestMountedAncestor) {
            try {
              commitAttachRef(current2);
            } catch (error2) {
              captureCommitPhaseError(current2, nearestMountedAncestor, error2);
            }
          }
          function safelyDetachRef(current2, nearestMountedAncestor) {
            var ref = current2.ref;
            if (ref !== null) {
              if (typeof ref === "function") {
                var retVal;
                try {
                  if (enableProfilerTimer && enableProfilerCommitHooks && current2.mode & ProfileMode) {
                    try {
                      startLayoutEffectTimer();
                      retVal = ref(null);
                    } finally {
                      recordLayoutEffectDuration(current2);
                    }
                  } else {
                    retVal = ref(null);
                  }
                } catch (error2) {
                  captureCommitPhaseError(current2, nearestMountedAncestor, error2);
                }
                {
                  if (typeof retVal === "function") {
                    error("Unexpected return value from a callback ref in %s. A callback ref should not return a function.", getComponentNameFromFiber(current2));
                  }
                }
              } else {
                ref.current = null;
              }
            }
          }
          function safelyCallDestroy(current2, nearestMountedAncestor, destroy) {
            try {
              destroy();
            } catch (error2) {
              captureCommitPhaseError(current2, nearestMountedAncestor, error2);
            }
          }
          var focusedInstanceHandle = null;
          var shouldFireAfterActiveInstanceBlur = false;
          function commitBeforeMutationEffects(root, firstChild) {
            focusedInstanceHandle = prepareForCommit(root.containerInfo);
            nextEffect = firstChild;
            commitBeforeMutationEffects_begin();
            var shouldFire = shouldFireAfterActiveInstanceBlur;
            shouldFireAfterActiveInstanceBlur = false;
            focusedInstanceHandle = null;
            return shouldFire;
          }
          function commitBeforeMutationEffects_begin() {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              var child = fiber.child;
              if ((fiber.subtreeFlags & BeforeMutationMask) !== NoFlags && child !== null) {
                child.return = fiber;
                nextEffect = child;
              } else {
                commitBeforeMutationEffects_complete();
              }
            }
          }
          function commitBeforeMutationEffects_complete() {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              setCurrentFiber(fiber);
              try {
                commitBeforeMutationEffectsOnFiber(fiber);
              } catch (error2) {
                captureCommitPhaseError(fiber, fiber.return, error2);
              }
              resetCurrentFiber();
              var sibling = fiber.sibling;
              if (sibling !== null) {
                sibling.return = fiber.return;
                nextEffect = sibling;
                return;
              }
              nextEffect = fiber.return;
            }
          }
          function commitBeforeMutationEffectsOnFiber(finishedWork) {
            var current2 = finishedWork.alternate;
            var flags = finishedWork.flags;
            if ((flags & Snapshot) !== NoFlags) {
              setCurrentFiber(finishedWork);
              switch (finishedWork.tag) {
                case FunctionComponent:
                case ForwardRef:
                case SimpleMemoComponent: {
                  break;
                }
                case ClassComponent: {
                  if (current2 !== null) {
                    var prevProps = current2.memoizedProps;
                    var prevState = current2.memoizedState;
                    var instance = finishedWork.stateNode;
                    {
                      if (finishedWork.type === finishedWork.elementType && !didWarnAboutReassigningProps) {
                        if (instance.props !== finishedWork.memoizedProps) {
                          error("Expected %s props to match memoized props before getSnapshotBeforeUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.", getComponentNameFromFiber(finishedWork) || "instance");
                        }
                        if (instance.state !== finishedWork.memoizedState) {
                          error("Expected %s state to match memoized state before getSnapshotBeforeUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.", getComponentNameFromFiber(finishedWork) || "instance");
                        }
                      }
                    }
                    var snapshot = instance.getSnapshotBeforeUpdate(finishedWork.elementType === finishedWork.type ? prevProps : resolveDefaultProps(finishedWork.type, prevProps), prevState);
                    {
                      var didWarnSet = didWarnAboutUndefinedSnapshotBeforeUpdate;
                      if (snapshot === void 0 && !didWarnSet.has(finishedWork.type)) {
                        didWarnSet.add(finishedWork.type);
                        error("%s.getSnapshotBeforeUpdate(): A snapshot value (or null) must be returned. You have returned undefined.", getComponentNameFromFiber(finishedWork));
                      }
                    }
                    instance.__reactInternalSnapshotBeforeUpdate = snapshot;
                  }
                  break;
                }
                case HostRoot: {
                  if (supportsMutation) {
                    var root = finishedWork.stateNode;
                    clearContainer(root.containerInfo);
                  }
                  break;
                }
                case HostComponent:
                case HostText:
                case HostPortal:
                case IncompleteClassComponent:
                  break;
                default: {
                  throw new Error("This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.");
                }
              }
              resetCurrentFiber();
            }
          }
          function commitHookEffectListUnmount(flags, finishedWork, nearestMountedAncestor) {
            var updateQueue = finishedWork.updateQueue;
            var lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
            if (lastEffect !== null) {
              var firstEffect = lastEffect.next;
              var effect = firstEffect;
              do {
                if ((effect.tag & flags) === flags) {
                  var destroy = effect.destroy;
                  effect.destroy = void 0;
                  if (destroy !== void 0) {
                    {
                      if ((flags & Passive$1) !== NoFlags$1) {
                        markComponentPassiveEffectUnmountStarted(finishedWork);
                      } else if ((flags & Layout) !== NoFlags$1) {
                        markComponentLayoutEffectUnmountStarted(finishedWork);
                      }
                    }
                    {
                      if ((flags & Insertion) !== NoFlags$1) {
                        setIsRunningInsertionEffect(true);
                      }
                    }
                    safelyCallDestroy(finishedWork, nearestMountedAncestor, destroy);
                    {
                      if ((flags & Insertion) !== NoFlags$1) {
                        setIsRunningInsertionEffect(false);
                      }
                    }
                    {
                      if ((flags & Passive$1) !== NoFlags$1) {
                        markComponentPassiveEffectUnmountStopped();
                      } else if ((flags & Layout) !== NoFlags$1) {
                        markComponentLayoutEffectUnmountStopped();
                      }
                    }
                  }
                }
                effect = effect.next;
              } while (effect !== firstEffect);
            }
          }
          function commitHookEffectListMount(flags, finishedWork) {
            var updateQueue = finishedWork.updateQueue;
            var lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
            if (lastEffect !== null) {
              var firstEffect = lastEffect.next;
              var effect = firstEffect;
              do {
                if ((effect.tag & flags) === flags) {
                  {
                    if ((flags & Passive$1) !== NoFlags$1) {
                      markComponentPassiveEffectMountStarted(finishedWork);
                    } else if ((flags & Layout) !== NoFlags$1) {
                      markComponentLayoutEffectMountStarted(finishedWork);
                    }
                  }
                  var create = effect.create;
                  {
                    if ((flags & Insertion) !== NoFlags$1) {
                      setIsRunningInsertionEffect(true);
                    }
                  }
                  effect.destroy = create();
                  {
                    if ((flags & Insertion) !== NoFlags$1) {
                      setIsRunningInsertionEffect(false);
                    }
                  }
                  {
                    if ((flags & Passive$1) !== NoFlags$1) {
                      markComponentPassiveEffectMountStopped();
                    } else if ((flags & Layout) !== NoFlags$1) {
                      markComponentLayoutEffectMountStopped();
                    }
                  }
                  {
                    var destroy = effect.destroy;
                    if (destroy !== void 0 && typeof destroy !== "function") {
                      var hookName = void 0;
                      if ((effect.tag & Layout) !== NoFlags) {
                        hookName = "useLayoutEffect";
                      } else if ((effect.tag & Insertion) !== NoFlags) {
                        hookName = "useInsertionEffect";
                      } else {
                        hookName = "useEffect";
                      }
                      var addendum = void 0;
                      if (destroy === null) {
                        addendum = " You returned null. If your effect does not require clean up, return undefined (or nothing).";
                      } else if (typeof destroy.then === "function") {
                        addendum = "\n\nIt looks like you wrote " + hookName + "(async () => ...) or returned a Promise. Instead, write the async function inside your effect and call it immediately:\n\n" + hookName + "(() => {\n  async function fetchData() {\n    // You can await here\n    const response = await MyAPI.getData(someId);\n    // ...\n  }\n  fetchData();\n}, [someId]); // Or [] if effect doesn't need props or state\n\nLearn more about data fetching with Hooks: https://reactjs.org/link/hooks-data-fetching";
                      } else {
                        addendum = " You returned: " + destroy;
                      }
                      error("%s must not return anything besides a function, which is used for clean-up.%s", hookName, addendum);
                    }
                  }
                }
                effect = effect.next;
              } while (effect !== firstEffect);
            }
          }
          function commitPassiveEffectDurations(finishedRoot, finishedWork) {
            {
              if ((finishedWork.flags & Update) !== NoFlags) {
                switch (finishedWork.tag) {
                  case Profiler: {
                    var passiveEffectDuration = finishedWork.stateNode.passiveEffectDuration;
                    var _finishedWork$memoize = finishedWork.memoizedProps, id = _finishedWork$memoize.id, onPostCommit = _finishedWork$memoize.onPostCommit;
                    var commitTime2 = getCommitTime();
                    var phase = finishedWork.alternate === null ? "mount" : "update";
                    {
                      if (isCurrentUpdateNested()) {
                        phase = "nested-update";
                      }
                    }
                    if (typeof onPostCommit === "function") {
                      onPostCommit(id, phase, passiveEffectDuration, commitTime2);
                    }
                    var parentFiber = finishedWork.return;
                    outer: while (parentFiber !== null) {
                      switch (parentFiber.tag) {
                        case HostRoot:
                          var root = parentFiber.stateNode;
                          root.passiveEffectDuration += passiveEffectDuration;
                          break outer;
                        case Profiler:
                          var parentStateNode = parentFiber.stateNode;
                          parentStateNode.passiveEffectDuration += passiveEffectDuration;
                          break outer;
                      }
                      parentFiber = parentFiber.return;
                    }
                    break;
                  }
                }
              }
            }
          }
          function commitLayoutEffectOnFiber(finishedRoot, current2, finishedWork, committedLanes) {
            if ((finishedWork.flags & LayoutMask) !== NoFlags) {
              switch (finishedWork.tag) {
                case FunctionComponent:
                case ForwardRef:
                case SimpleMemoComponent: {
                  if (!offscreenSubtreeWasHidden) {
                    if (finishedWork.mode & ProfileMode) {
                      try {
                        startLayoutEffectTimer();
                        commitHookEffectListMount(Layout | HasEffect, finishedWork);
                      } finally {
                        recordLayoutEffectDuration(finishedWork);
                      }
                    } else {
                      commitHookEffectListMount(Layout | HasEffect, finishedWork);
                    }
                  }
                  break;
                }
                case ClassComponent: {
                  var instance = finishedWork.stateNode;
                  if (finishedWork.flags & Update) {
                    if (!offscreenSubtreeWasHidden) {
                      if (current2 === null) {
                        {
                          if (finishedWork.type === finishedWork.elementType && !didWarnAboutReassigningProps) {
                            if (instance.props !== finishedWork.memoizedProps) {
                              error("Expected %s props to match memoized props before componentDidMount. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.", getComponentNameFromFiber(finishedWork) || "instance");
                            }
                            if (instance.state !== finishedWork.memoizedState) {
                              error("Expected %s state to match memoized state before componentDidMount. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.", getComponentNameFromFiber(finishedWork) || "instance");
                            }
                          }
                        }
                        if (finishedWork.mode & ProfileMode) {
                          try {
                            startLayoutEffectTimer();
                            instance.componentDidMount();
                          } finally {
                            recordLayoutEffectDuration(finishedWork);
                          }
                        } else {
                          instance.componentDidMount();
                        }
                      } else {
                        var prevProps = finishedWork.elementType === finishedWork.type ? current2.memoizedProps : resolveDefaultProps(finishedWork.type, current2.memoizedProps);
                        var prevState = current2.memoizedState;
                        {
                          if (finishedWork.type === finishedWork.elementType && !didWarnAboutReassigningProps) {
                            if (instance.props !== finishedWork.memoizedProps) {
                              error("Expected %s props to match memoized props before componentDidUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.", getComponentNameFromFiber(finishedWork) || "instance");
                            }
                            if (instance.state !== finishedWork.memoizedState) {
                              error("Expected %s state to match memoized state before componentDidUpdate. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.", getComponentNameFromFiber(finishedWork) || "instance");
                            }
                          }
                        }
                        if (finishedWork.mode & ProfileMode) {
                          try {
                            startLayoutEffectTimer();
                            instance.componentDidUpdate(prevProps, prevState, instance.__reactInternalSnapshotBeforeUpdate);
                          } finally {
                            recordLayoutEffectDuration(finishedWork);
                          }
                        } else {
                          instance.componentDidUpdate(prevProps, prevState, instance.__reactInternalSnapshotBeforeUpdate);
                        }
                      }
                    }
                  }
                  var updateQueue = finishedWork.updateQueue;
                  if (updateQueue !== null) {
                    {
                      if (finishedWork.type === finishedWork.elementType && !didWarnAboutReassigningProps) {
                        if (instance.props !== finishedWork.memoizedProps) {
                          error("Expected %s props to match memoized props before processing the update queue. This might either be because of a bug in React, or because a component reassigns its own `this.props`. Please file an issue.", getComponentNameFromFiber(finishedWork) || "instance");
                        }
                        if (instance.state !== finishedWork.memoizedState) {
                          error("Expected %s state to match memoized state before processing the update queue. This might either be because of a bug in React, or because a component reassigns its own `this.state`. Please file an issue.", getComponentNameFromFiber(finishedWork) || "instance");
                        }
                      }
                    }
                    commitUpdateQueue(finishedWork, updateQueue, instance);
                  }
                  break;
                }
                case HostRoot: {
                  var _updateQueue = finishedWork.updateQueue;
                  if (_updateQueue !== null) {
                    var _instance = null;
                    if (finishedWork.child !== null) {
                      switch (finishedWork.child.tag) {
                        case HostComponent:
                          _instance = getPublicInstance(finishedWork.child.stateNode);
                          break;
                        case ClassComponent:
                          _instance = finishedWork.child.stateNode;
                          break;
                      }
                    }
                    commitUpdateQueue(finishedWork, _updateQueue, _instance);
                  }
                  break;
                }
                case HostComponent: {
                  var _instance2 = finishedWork.stateNode;
                  if (current2 === null && finishedWork.flags & Update) {
                    var type = finishedWork.type;
                    var props = finishedWork.memoizedProps;
                    commitMount(_instance2, type, props, finishedWork);
                  }
                  break;
                }
                case HostText: {
                  break;
                }
                case HostPortal: {
                  break;
                }
                case Profiler: {
                  {
                    var _finishedWork$memoize2 = finishedWork.memoizedProps, onCommit = _finishedWork$memoize2.onCommit, onRender = _finishedWork$memoize2.onRender;
                    var effectDuration = finishedWork.stateNode.effectDuration;
                    var commitTime2 = getCommitTime();
                    var phase = current2 === null ? "mount" : "update";
                    {
                      if (isCurrentUpdateNested()) {
                        phase = "nested-update";
                      }
                    }
                    if (typeof onRender === "function") {
                      onRender(finishedWork.memoizedProps.id, phase, finishedWork.actualDuration, finishedWork.treeBaseDuration, finishedWork.actualStartTime, commitTime2);
                    }
                    {
                      if (typeof onCommit === "function") {
                        onCommit(finishedWork.memoizedProps.id, phase, effectDuration, commitTime2);
                      }
                      enqueuePendingPassiveProfilerEffect(finishedWork);
                      var parentFiber = finishedWork.return;
                      outer: while (parentFiber !== null) {
                        switch (parentFiber.tag) {
                          case HostRoot:
                            var root = parentFiber.stateNode;
                            root.effectDuration += effectDuration;
                            break outer;
                          case Profiler:
                            var parentStateNode = parentFiber.stateNode;
                            parentStateNode.effectDuration += effectDuration;
                            break outer;
                        }
                        parentFiber = parentFiber.return;
                      }
                    }
                  }
                  break;
                }
                case SuspenseComponent: {
                  commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
                  break;
                }
                case SuspenseListComponent:
                case IncompleteClassComponent:
                case ScopeComponent:
                case OffscreenComponent:
                case LegacyHiddenComponent:
                case TracingMarkerComponent: {
                  break;
                }
                default:
                  throw new Error("This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.");
              }
            }
            if (!offscreenSubtreeWasHidden) {
              {
                if (finishedWork.flags & Ref) {
                  commitAttachRef(finishedWork);
                }
              }
            }
          }
          function reappearLayoutEffectsOnFiber(node) {
            switch (node.tag) {
              case FunctionComponent:
              case ForwardRef:
              case SimpleMemoComponent: {
                if (node.mode & ProfileMode) {
                  try {
                    startLayoutEffectTimer();
                    safelyCallCommitHookLayoutEffectListMount(node, node.return);
                  } finally {
                    recordLayoutEffectDuration(node);
                  }
                } else {
                  safelyCallCommitHookLayoutEffectListMount(node, node.return);
                }
                break;
              }
              case ClassComponent: {
                var instance = node.stateNode;
                if (typeof instance.componentDidMount === "function") {
                  safelyCallComponentDidMount(node, node.return, instance);
                }
                safelyAttachRef(node, node.return);
                break;
              }
              case HostComponent: {
                safelyAttachRef(node, node.return);
                break;
              }
            }
          }
          function hideOrUnhideAllChildren(finishedWork, isHidden) {
            var hostSubtreeRoot = null;
            if (supportsMutation) {
              var node = finishedWork;
              while (true) {
                if (node.tag === HostComponent) {
                  if (hostSubtreeRoot === null) {
                    hostSubtreeRoot = node;
                    try {
                      var instance = node.stateNode;
                      if (isHidden) {
                        hideInstance(instance);
                      } else {
                        unhideInstance(node.stateNode, node.memoizedProps);
                      }
                    } catch (error2) {
                      captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                    }
                  }
                } else if (node.tag === HostText) {
                  if (hostSubtreeRoot === null) {
                    try {
                      var _instance3 = node.stateNode;
                      if (isHidden) {
                        hideTextInstance(_instance3);
                      } else {
                        unhideTextInstance(_instance3, node.memoizedProps);
                      }
                    } catch (error2) {
                      captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                    }
                  }
                } else if ((node.tag === OffscreenComponent || node.tag === LegacyHiddenComponent) && node.memoizedState !== null && node !== finishedWork) ;
                else if (node.child !== null) {
                  node.child.return = node;
                  node = node.child;
                  continue;
                }
                if (node === finishedWork) {
                  return;
                }
                while (node.sibling === null) {
                  if (node.return === null || node.return === finishedWork) {
                    return;
                  }
                  if (hostSubtreeRoot === node) {
                    hostSubtreeRoot = null;
                  }
                  node = node.return;
                }
                if (hostSubtreeRoot === node) {
                  hostSubtreeRoot = null;
                }
                node.sibling.return = node.return;
                node = node.sibling;
              }
            }
          }
          function commitAttachRef(finishedWork) {
            var ref = finishedWork.ref;
            if (ref !== null) {
              var instance = finishedWork.stateNode;
              var instanceToUse;
              switch (finishedWork.tag) {
                case HostComponent:
                  instanceToUse = getPublicInstance(instance);
                  break;
                default:
                  instanceToUse = instance;
              }
              if (typeof ref === "function") {
                var retVal;
                if (finishedWork.mode & ProfileMode) {
                  try {
                    startLayoutEffectTimer();
                    retVal = ref(instanceToUse);
                  } finally {
                    recordLayoutEffectDuration(finishedWork);
                  }
                } else {
                  retVal = ref(instanceToUse);
                }
                {
                  if (typeof retVal === "function") {
                    error("Unexpected return value from a callback ref in %s. A callback ref should not return a function.", getComponentNameFromFiber(finishedWork));
                  }
                }
              } else {
                {
                  if (!ref.hasOwnProperty("current")) {
                    error("Unexpected ref object provided for %s. Use either a ref-setter function or React.createRef().", getComponentNameFromFiber(finishedWork));
                  }
                }
                ref.current = instanceToUse;
              }
            }
          }
          function detachFiberMutation(fiber) {
            var alternate = fiber.alternate;
            if (alternate !== null) {
              alternate.return = null;
            }
            fiber.return = null;
          }
          function detachFiberAfterEffects(fiber) {
            var alternate = fiber.alternate;
            if (alternate !== null) {
              fiber.alternate = null;
              detachFiberAfterEffects(alternate);
            }
            {
              fiber.child = null;
              fiber.deletions = null;
              fiber.sibling = null;
              if (fiber.tag === HostComponent) {
                var hostInstance = fiber.stateNode;
                if (hostInstance !== null) {
                  detachDeletedInstance(hostInstance);
                }
              }
              fiber.stateNode = null;
              {
                fiber._debugOwner = null;
              }
              {
                fiber.return = null;
                fiber.dependencies = null;
                fiber.memoizedProps = null;
                fiber.memoizedState = null;
                fiber.pendingProps = null;
                fiber.stateNode = null;
                fiber.updateQueue = null;
              }
            }
          }
          function emptyPortalContainer(current2) {
            if (!supportsPersistence) {
              return;
            }
            var portal = current2.stateNode;
            var containerInfo = portal.containerInfo;
            var emptyChildSet = createContainerChildSet(containerInfo);
            replaceContainerChildren(containerInfo, emptyChildSet);
          }
          function getHostParentFiber(fiber) {
            var parent = fiber.return;
            while (parent !== null) {
              if (isHostParent(parent)) {
                return parent;
              }
              parent = parent.return;
            }
            throw new Error("Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.");
          }
          function isHostParent(fiber) {
            return fiber.tag === HostComponent || fiber.tag === HostRoot || fiber.tag === HostPortal;
          }
          function getHostSibling(fiber) {
            var node = fiber;
            siblings: while (true) {
              while (node.sibling === null) {
                if (node.return === null || isHostParent(node.return)) {
                  return null;
                }
                node = node.return;
              }
              node.sibling.return = node.return;
              node = node.sibling;
              while (node.tag !== HostComponent && node.tag !== HostText && node.tag !== DehydratedFragment) {
                if (node.flags & Placement) {
                  continue siblings;
                }
                if (node.child === null || node.tag === HostPortal) {
                  continue siblings;
                } else {
                  node.child.return = node;
                  node = node.child;
                }
              }
              if (!(node.flags & Placement)) {
                return node.stateNode;
              }
            }
          }
          function commitPlacement(finishedWork) {
            if (!supportsMutation) {
              return;
            }
            var parentFiber = getHostParentFiber(finishedWork);
            switch (parentFiber.tag) {
              case HostComponent: {
                var parent = parentFiber.stateNode;
                if (parentFiber.flags & ContentReset) {
                  resetTextContent(parent);
                  parentFiber.flags &= ~ContentReset;
                }
                var before = getHostSibling(finishedWork);
                insertOrAppendPlacementNode(finishedWork, before, parent);
                break;
              }
              case HostRoot:
              case HostPortal: {
                var _parent = parentFiber.stateNode.containerInfo;
                var _before = getHostSibling(finishedWork);
                insertOrAppendPlacementNodeIntoContainer(finishedWork, _before, _parent);
                break;
              }
              // eslint-disable-next-line-no-fallthrough
              default:
                throw new Error("Invalid host parent fiber. This error is likely caused by a bug in React. Please file an issue.");
            }
          }
          function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
            var tag = node.tag;
            var isHost = tag === HostComponent || tag === HostText;
            if (isHost) {
              var stateNode = node.stateNode;
              if (before) {
                insertInContainerBefore(parent, stateNode, before);
              } else {
                appendChildToContainer(parent, stateNode);
              }
            } else if (tag === HostPortal) ;
            else {
              var child = node.child;
              if (child !== null) {
                insertOrAppendPlacementNodeIntoContainer(child, before, parent);
                var sibling = child.sibling;
                while (sibling !== null) {
                  insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
                  sibling = sibling.sibling;
                }
              }
            }
          }
          function insertOrAppendPlacementNode(node, before, parent) {
            var tag = node.tag;
            var isHost = tag === HostComponent || tag === HostText;
            if (isHost) {
              var stateNode = node.stateNode;
              if (before) {
                insertBefore(parent, stateNode, before);
              } else {
                appendChild(parent, stateNode);
              }
            } else if (tag === HostPortal) ;
            else {
              var child = node.child;
              if (child !== null) {
                insertOrAppendPlacementNode(child, before, parent);
                var sibling = child.sibling;
                while (sibling !== null) {
                  insertOrAppendPlacementNode(sibling, before, parent);
                  sibling = sibling.sibling;
                }
              }
            }
          }
          var hostParent = null;
          var hostParentIsContainer = false;
          function commitDeletionEffects(root, returnFiber, deletedFiber) {
            if (supportsMutation) {
              var parent = returnFiber;
              findParent: while (parent !== null) {
                switch (parent.tag) {
                  case HostComponent: {
                    hostParent = parent.stateNode;
                    hostParentIsContainer = false;
                    break findParent;
                  }
                  case HostRoot: {
                    hostParent = parent.stateNode.containerInfo;
                    hostParentIsContainer = true;
                    break findParent;
                  }
                  case HostPortal: {
                    hostParent = parent.stateNode.containerInfo;
                    hostParentIsContainer = true;
                    break findParent;
                  }
                }
                parent = parent.return;
              }
              if (hostParent === null) {
                throw new Error("Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.");
              }
              commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
              hostParent = null;
              hostParentIsContainer = false;
            } else {
              commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
            }
            detachFiberMutation(deletedFiber);
          }
          function recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, parent) {
            var child = parent.child;
            while (child !== null) {
              commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, child);
              child = child.sibling;
            }
          }
          function commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, deletedFiber) {
            onCommitUnmount(deletedFiber);
            switch (deletedFiber.tag) {
              case HostComponent: {
                if (!offscreenSubtreeWasHidden) {
                  safelyDetachRef(deletedFiber, nearestMountedAncestor);
                }
              }
              // eslint-disable-next-line-no-fallthrough
              case HostText: {
                if (supportsMutation) {
                  var prevHostParent = hostParent;
                  var prevHostParentIsContainer = hostParentIsContainer;
                  hostParent = null;
                  recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                  hostParent = prevHostParent;
                  hostParentIsContainer = prevHostParentIsContainer;
                  if (hostParent !== null) {
                    if (hostParentIsContainer) {
                      removeChildFromContainer(hostParent, deletedFiber.stateNode);
                    } else {
                      removeChild(hostParent, deletedFiber.stateNode);
                    }
                  }
                } else {
                  recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                }
                return;
              }
              case DehydratedFragment: {
                if (supportsMutation) {
                  if (hostParent !== null) {
                    if (hostParentIsContainer) {
                      clearSuspenseBoundaryFromContainer(hostParent, deletedFiber.stateNode);
                    } else {
                      clearSuspenseBoundary(hostParent, deletedFiber.stateNode);
                    }
                  }
                }
                return;
              }
              case HostPortal: {
                if (supportsMutation) {
                  var _prevHostParent = hostParent;
                  var _prevHostParentIsContainer = hostParentIsContainer;
                  hostParent = deletedFiber.stateNode.containerInfo;
                  hostParentIsContainer = true;
                  recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                  hostParent = _prevHostParent;
                  hostParentIsContainer = _prevHostParentIsContainer;
                } else {
                  emptyPortalContainer(deletedFiber);
                  recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                }
                return;
              }
              case FunctionComponent:
              case ForwardRef:
              case MemoComponent:
              case SimpleMemoComponent: {
                if (!offscreenSubtreeWasHidden) {
                  var updateQueue = deletedFiber.updateQueue;
                  if (updateQueue !== null) {
                    var lastEffect = updateQueue.lastEffect;
                    if (lastEffect !== null) {
                      var firstEffect = lastEffect.next;
                      var effect = firstEffect;
                      do {
                        var _effect = effect, destroy = _effect.destroy, tag = _effect.tag;
                        if (destroy !== void 0) {
                          if ((tag & Insertion) !== NoFlags$1) {
                            safelyCallDestroy(deletedFiber, nearestMountedAncestor, destroy);
                          } else if ((tag & Layout) !== NoFlags$1) {
                            {
                              markComponentLayoutEffectUnmountStarted(deletedFiber);
                            }
                            if (deletedFiber.mode & ProfileMode) {
                              startLayoutEffectTimer();
                              safelyCallDestroy(deletedFiber, nearestMountedAncestor, destroy);
                              recordLayoutEffectDuration(deletedFiber);
                            } else {
                              safelyCallDestroy(deletedFiber, nearestMountedAncestor, destroy);
                            }
                            {
                              markComponentLayoutEffectUnmountStopped();
                            }
                          }
                        }
                        effect = effect.next;
                      } while (effect !== firstEffect);
                    }
                  }
                }
                recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                return;
              }
              case ClassComponent: {
                if (!offscreenSubtreeWasHidden) {
                  safelyDetachRef(deletedFiber, nearestMountedAncestor);
                  var instance = deletedFiber.stateNode;
                  if (typeof instance.componentWillUnmount === "function") {
                    safelyCallComponentWillUnmount(deletedFiber, nearestMountedAncestor, instance);
                  }
                }
                recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                return;
              }
              case ScopeComponent: {
                recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                return;
              }
              case OffscreenComponent: {
                if (
                  // TODO: Remove this dead flag
                  deletedFiber.mode & ConcurrentMode
                ) {
                  var prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
                  offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || deletedFiber.memoizedState !== null;
                  recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                  offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
                } else {
                  recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                }
                break;
              }
              default: {
                recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
                return;
              }
            }
          }
          function commitSuspenseCallback(finishedWork) {
            var newState = finishedWork.memoizedState;
          }
          function commitSuspenseHydrationCallbacks(finishedRoot, finishedWork) {
            if (!supportsHydration) {
              return;
            }
            var newState = finishedWork.memoizedState;
            if (newState === null) {
              var current2 = finishedWork.alternate;
              if (current2 !== null) {
                var prevState = current2.memoizedState;
                if (prevState !== null) {
                  var suspenseInstance = prevState.dehydrated;
                  if (suspenseInstance !== null) {
                    commitHydratedSuspenseInstance(suspenseInstance);
                  }
                }
              }
            }
          }
          function attachSuspenseRetryListeners(finishedWork) {
            var wakeables = finishedWork.updateQueue;
            if (wakeables !== null) {
              finishedWork.updateQueue = null;
              var retryCache = finishedWork.stateNode;
              if (retryCache === null) {
                retryCache = finishedWork.stateNode = new PossiblyWeakSet();
              }
              wakeables.forEach(function(wakeable) {
                var retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
                if (!retryCache.has(wakeable)) {
                  retryCache.add(wakeable);
                  {
                    if (isDevToolsPresent) {
                      if (inProgressLanes !== null && inProgressRoot !== null) {
                        restorePendingUpdaters(inProgressRoot, inProgressLanes);
                      } else {
                        throw Error("Expected finished root and lanes to be set. This is a bug in React.");
                      }
                    }
                  }
                  wakeable.then(retry, retry);
                }
              });
            }
          }
          function commitMutationEffects(root, finishedWork, committedLanes) {
            inProgressLanes = committedLanes;
            inProgressRoot = root;
            setCurrentFiber(finishedWork);
            commitMutationEffectsOnFiber(finishedWork, root);
            setCurrentFiber(finishedWork);
            inProgressLanes = null;
            inProgressRoot = null;
          }
          function recursivelyTraverseMutationEffects(root, parentFiber, lanes) {
            var deletions = parentFiber.deletions;
            if (deletions !== null) {
              for (var i = 0; i < deletions.length; i++) {
                var childToDelete = deletions[i];
                try {
                  commitDeletionEffects(root, parentFiber, childToDelete);
                } catch (error2) {
                  captureCommitPhaseError(childToDelete, parentFiber, error2);
                }
              }
            }
            var prevDebugFiber = getCurrentFiber();
            if (parentFiber.subtreeFlags & MutationMask) {
              var child = parentFiber.child;
              while (child !== null) {
                setCurrentFiber(child);
                commitMutationEffectsOnFiber(child, root);
                child = child.sibling;
              }
            }
            setCurrentFiber(prevDebugFiber);
          }
          function commitMutationEffectsOnFiber(finishedWork, root, lanes) {
            var current2 = finishedWork.alternate;
            var flags = finishedWork.flags;
            switch (finishedWork.tag) {
              case FunctionComponent:
              case ForwardRef:
              case MemoComponent:
              case SimpleMemoComponent: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                if (flags & Update) {
                  try {
                    commitHookEffectListUnmount(Insertion | HasEffect, finishedWork, finishedWork.return);
                    commitHookEffectListMount(Insertion | HasEffect, finishedWork);
                  } catch (error2) {
                    captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                  }
                  if (finishedWork.mode & ProfileMode) {
                    try {
                      startLayoutEffectTimer();
                      commitHookEffectListUnmount(Layout | HasEffect, finishedWork, finishedWork.return);
                    } catch (error2) {
                      captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                    }
                    recordLayoutEffectDuration(finishedWork);
                  } else {
                    try {
                      commitHookEffectListUnmount(Layout | HasEffect, finishedWork, finishedWork.return);
                    } catch (error2) {
                      captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                    }
                  }
                }
                return;
              }
              case ClassComponent: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                if (flags & Ref) {
                  if (current2 !== null) {
                    safelyDetachRef(current2, current2.return);
                  }
                }
                return;
              }
              case HostComponent: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                if (flags & Ref) {
                  if (current2 !== null) {
                    safelyDetachRef(current2, current2.return);
                  }
                }
                if (supportsMutation) {
                  if (finishedWork.flags & ContentReset) {
                    var instance = finishedWork.stateNode;
                    try {
                      resetTextContent(instance);
                    } catch (error2) {
                      captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                    }
                  }
                  if (flags & Update) {
                    var _instance4 = finishedWork.stateNode;
                    if (_instance4 != null) {
                      var newProps = finishedWork.memoizedProps;
                      var oldProps = current2 !== null ? current2.memoizedProps : newProps;
                      var type = finishedWork.type;
                      var updatePayload = finishedWork.updateQueue;
                      finishedWork.updateQueue = null;
                      if (updatePayload !== null) {
                        try {
                          commitUpdate(_instance4, updatePayload, type, oldProps, newProps, finishedWork);
                        } catch (error2) {
                          captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                        }
                      }
                    }
                  }
                }
                return;
              }
              case HostText: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                if (flags & Update) {
                  if (supportsMutation) {
                    if (finishedWork.stateNode === null) {
                      throw new Error("This should have a text node initialized. This error is likely caused by a bug in React. Please file an issue.");
                    }
                    var textInstance = finishedWork.stateNode;
                    var newText = finishedWork.memoizedProps;
                    var oldText = current2 !== null ? current2.memoizedProps : newText;
                    try {
                      commitTextUpdate(textInstance, oldText, newText);
                    } catch (error2) {
                      captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                    }
                  }
                }
                return;
              }
              case HostRoot: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                if (flags & Update) {
                  if (supportsMutation && supportsHydration) {
                    if (current2 !== null) {
                      var prevRootState = current2.memoizedState;
                      if (prevRootState.isDehydrated) {
                        try {
                          commitHydratedContainer(root.containerInfo);
                        } catch (error2) {
                          captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                        }
                      }
                    }
                  }
                  if (supportsPersistence) {
                    var containerInfo = root.containerInfo;
                    var pendingChildren = root.pendingChildren;
                    try {
                      replaceContainerChildren(containerInfo, pendingChildren);
                    } catch (error2) {
                      captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                    }
                  }
                }
                return;
              }
              case HostPortal: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                if (flags & Update) {
                  if (supportsPersistence) {
                    var portal = finishedWork.stateNode;
                    var _containerInfo = portal.containerInfo;
                    var _pendingChildren = portal.pendingChildren;
                    try {
                      replaceContainerChildren(_containerInfo, _pendingChildren);
                    } catch (error2) {
                      captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                    }
                  }
                }
                return;
              }
              case SuspenseComponent: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                var offscreenFiber = finishedWork.child;
                if (offscreenFiber.flags & Visibility) {
                  var offscreenInstance = offscreenFiber.stateNode;
                  var newState = offscreenFiber.memoizedState;
                  var isHidden = newState !== null;
                  offscreenInstance.isHidden = isHidden;
                  if (isHidden) {
                    var wasHidden = offscreenFiber.alternate !== null && offscreenFiber.alternate.memoizedState !== null;
                    if (!wasHidden) {
                      markCommitTimeOfFallback();
                    }
                  }
                }
                if (flags & Update) {
                  try {
                    commitSuspenseCallback(finishedWork);
                  } catch (error2) {
                    captureCommitPhaseError(finishedWork, finishedWork.return, error2);
                  }
                  attachSuspenseRetryListeners(finishedWork);
                }
                return;
              }
              case OffscreenComponent: {
                var _wasHidden = current2 !== null && current2.memoizedState !== null;
                if (
                  // TODO: Remove this dead flag
                  finishedWork.mode & ConcurrentMode
                ) {
                  var prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
                  offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || _wasHidden;
                  recursivelyTraverseMutationEffects(root, finishedWork);
                  offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
                } else {
                  recursivelyTraverseMutationEffects(root, finishedWork);
                }
                commitReconciliationEffects(finishedWork);
                if (flags & Visibility) {
                  var _offscreenInstance = finishedWork.stateNode;
                  var _newState = finishedWork.memoizedState;
                  var _isHidden = _newState !== null;
                  var offscreenBoundary = finishedWork;
                  _offscreenInstance.isHidden = _isHidden;
                  {
                    if (_isHidden) {
                      if (!_wasHidden) {
                        if ((offscreenBoundary.mode & ConcurrentMode) !== NoMode) {
                          nextEffect = offscreenBoundary;
                          var offscreenChild = offscreenBoundary.child;
                          while (offscreenChild !== null) {
                            nextEffect = offscreenChild;
                            disappearLayoutEffects_begin(offscreenChild);
                            offscreenChild = offscreenChild.sibling;
                          }
                        }
                      }
                    }
                  }
                  if (supportsMutation) {
                    hideOrUnhideAllChildren(offscreenBoundary, _isHidden);
                  }
                }
                return;
              }
              case SuspenseListComponent: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                if (flags & Update) {
                  attachSuspenseRetryListeners(finishedWork);
                }
                return;
              }
              case ScopeComponent: {
                return;
              }
              default: {
                recursivelyTraverseMutationEffects(root, finishedWork);
                commitReconciliationEffects(finishedWork);
                return;
              }
            }
          }
          function commitReconciliationEffects(finishedWork) {
            var flags = finishedWork.flags;
            if (flags & Placement) {
              try {
                commitPlacement(finishedWork);
              } catch (error2) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error2);
              }
              finishedWork.flags &= ~Placement;
            }
            if (flags & Hydrating) {
              finishedWork.flags &= ~Hydrating;
            }
          }
          function commitLayoutEffects(finishedWork, root, committedLanes) {
            inProgressLanes = committedLanes;
            inProgressRoot = root;
            nextEffect = finishedWork;
            commitLayoutEffects_begin(finishedWork, root, committedLanes);
            inProgressLanes = null;
            inProgressRoot = null;
          }
          function commitLayoutEffects_begin(subtreeRoot, root, committedLanes) {
            var isModernRoot = (subtreeRoot.mode & ConcurrentMode) !== NoMode;
            while (nextEffect !== null) {
              var fiber = nextEffect;
              var firstChild = fiber.child;
              if (fiber.tag === OffscreenComponent && isModernRoot) {
                var isHidden = fiber.memoizedState !== null;
                var newOffscreenSubtreeIsHidden = isHidden || offscreenSubtreeIsHidden;
                if (newOffscreenSubtreeIsHidden) {
                  commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
                  continue;
                } else {
                  var current2 = fiber.alternate;
                  var wasHidden = current2 !== null && current2.memoizedState !== null;
                  var newOffscreenSubtreeWasHidden = wasHidden || offscreenSubtreeWasHidden;
                  var prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden;
                  var prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
                  offscreenSubtreeIsHidden = newOffscreenSubtreeIsHidden;
                  offscreenSubtreeWasHidden = newOffscreenSubtreeWasHidden;
                  if (offscreenSubtreeWasHidden && !prevOffscreenSubtreeWasHidden) {
                    nextEffect = fiber;
                    reappearLayoutEffects_begin(fiber);
                  }
                  var child = firstChild;
                  while (child !== null) {
                    nextEffect = child;
                    commitLayoutEffects_begin(
                      child,
                      // New root; bubble back up to here and stop.
                      root,
                      committedLanes
                    );
                    child = child.sibling;
                  }
                  nextEffect = fiber;
                  offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
                  offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
                  commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
                  continue;
                }
              }
              if ((fiber.subtreeFlags & LayoutMask) !== NoFlags && firstChild !== null) {
                firstChild.return = fiber;
                nextEffect = firstChild;
              } else {
                commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
              }
            }
          }
          function commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              if ((fiber.flags & LayoutMask) !== NoFlags) {
                var current2 = fiber.alternate;
                setCurrentFiber(fiber);
                try {
                  commitLayoutEffectOnFiber(root, current2, fiber, committedLanes);
                } catch (error2) {
                  captureCommitPhaseError(fiber, fiber.return, error2);
                }
                resetCurrentFiber();
              }
              if (fiber === subtreeRoot) {
                nextEffect = null;
                return;
              }
              var sibling = fiber.sibling;
              if (sibling !== null) {
                sibling.return = fiber.return;
                nextEffect = sibling;
                return;
              }
              nextEffect = fiber.return;
            }
          }
          function disappearLayoutEffects_begin(subtreeRoot) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              var firstChild = fiber.child;
              switch (fiber.tag) {
                case FunctionComponent:
                case ForwardRef:
                case MemoComponent:
                case SimpleMemoComponent: {
                  if (fiber.mode & ProfileMode) {
                    try {
                      startLayoutEffectTimer();
                      commitHookEffectListUnmount(Layout, fiber, fiber.return);
                    } finally {
                      recordLayoutEffectDuration(fiber);
                    }
                  } else {
                    commitHookEffectListUnmount(Layout, fiber, fiber.return);
                  }
                  break;
                }
                case ClassComponent: {
                  safelyDetachRef(fiber, fiber.return);
                  var instance = fiber.stateNode;
                  if (typeof instance.componentWillUnmount === "function") {
                    safelyCallComponentWillUnmount(fiber, fiber.return, instance);
                  }
                  break;
                }
                case HostComponent: {
                  safelyDetachRef(fiber, fiber.return);
                  break;
                }
                case OffscreenComponent: {
                  var isHidden = fiber.memoizedState !== null;
                  if (isHidden) {
                    disappearLayoutEffects_complete(subtreeRoot);
                    continue;
                  }
                  break;
                }
              }
              if (firstChild !== null) {
                firstChild.return = fiber;
                nextEffect = firstChild;
              } else {
                disappearLayoutEffects_complete(subtreeRoot);
              }
            }
          }
          function disappearLayoutEffects_complete(subtreeRoot) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              if (fiber === subtreeRoot) {
                nextEffect = null;
                return;
              }
              var sibling = fiber.sibling;
              if (sibling !== null) {
                sibling.return = fiber.return;
                nextEffect = sibling;
                return;
              }
              nextEffect = fiber.return;
            }
          }
          function reappearLayoutEffects_begin(subtreeRoot) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              var firstChild = fiber.child;
              if (fiber.tag === OffscreenComponent) {
                var isHidden = fiber.memoizedState !== null;
                if (isHidden) {
                  reappearLayoutEffects_complete(subtreeRoot);
                  continue;
                }
              }
              if (firstChild !== null) {
                firstChild.return = fiber;
                nextEffect = firstChild;
              } else {
                reappearLayoutEffects_complete(subtreeRoot);
              }
            }
          }
          function reappearLayoutEffects_complete(subtreeRoot) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              setCurrentFiber(fiber);
              try {
                reappearLayoutEffectsOnFiber(fiber);
              } catch (error2) {
                captureCommitPhaseError(fiber, fiber.return, error2);
              }
              resetCurrentFiber();
              if (fiber === subtreeRoot) {
                nextEffect = null;
                return;
              }
              var sibling = fiber.sibling;
              if (sibling !== null) {
                sibling.return = fiber.return;
                nextEffect = sibling;
                return;
              }
              nextEffect = fiber.return;
            }
          }
          function commitPassiveMountEffects(root, finishedWork, committedLanes, committedTransitions) {
            nextEffect = finishedWork;
            commitPassiveMountEffects_begin(finishedWork, root, committedLanes, committedTransitions);
          }
          function commitPassiveMountEffects_begin(subtreeRoot, root, committedLanes, committedTransitions) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              var firstChild = fiber.child;
              if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && firstChild !== null) {
                firstChild.return = fiber;
                nextEffect = firstChild;
              } else {
                commitPassiveMountEffects_complete(subtreeRoot, root, committedLanes, committedTransitions);
              }
            }
          }
          function commitPassiveMountEffects_complete(subtreeRoot, root, committedLanes, committedTransitions) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              if ((fiber.flags & Passive) !== NoFlags) {
                setCurrentFiber(fiber);
                try {
                  commitPassiveMountOnFiber(root, fiber, committedLanes, committedTransitions);
                } catch (error2) {
                  captureCommitPhaseError(fiber, fiber.return, error2);
                }
                resetCurrentFiber();
              }
              if (fiber === subtreeRoot) {
                nextEffect = null;
                return;
              }
              var sibling = fiber.sibling;
              if (sibling !== null) {
                sibling.return = fiber.return;
                nextEffect = sibling;
                return;
              }
              nextEffect = fiber.return;
            }
          }
          function commitPassiveMountOnFiber(finishedRoot, finishedWork, committedLanes, committedTransitions) {
            switch (finishedWork.tag) {
              case FunctionComponent:
              case ForwardRef:
              case SimpleMemoComponent: {
                if (finishedWork.mode & ProfileMode) {
                  startPassiveEffectTimer();
                  try {
                    commitHookEffectListMount(Passive$1 | HasEffect, finishedWork);
                  } finally {
                    recordPassiveEffectDuration(finishedWork);
                  }
                } else {
                  commitHookEffectListMount(Passive$1 | HasEffect, finishedWork);
                }
                break;
              }
            }
          }
          function commitPassiveUnmountEffects(firstChild) {
            nextEffect = firstChild;
            commitPassiveUnmountEffects_begin();
          }
          function commitPassiveUnmountEffects_begin() {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              var child = fiber.child;
              if ((nextEffect.flags & ChildDeletion) !== NoFlags) {
                var deletions = fiber.deletions;
                if (deletions !== null) {
                  for (var i = 0; i < deletions.length; i++) {
                    var fiberToDelete = deletions[i];
                    nextEffect = fiberToDelete;
                    commitPassiveUnmountEffectsInsideOfDeletedTree_begin(fiberToDelete, fiber);
                  }
                  {
                    var previousFiber = fiber.alternate;
                    if (previousFiber !== null) {
                      var detachedChild = previousFiber.child;
                      if (detachedChild !== null) {
                        previousFiber.child = null;
                        do {
                          var detachedSibling = detachedChild.sibling;
                          detachedChild.sibling = null;
                          detachedChild = detachedSibling;
                        } while (detachedChild !== null);
                      }
                    }
                  }
                  nextEffect = fiber;
                }
              }
              if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && child !== null) {
                child.return = fiber;
                nextEffect = child;
              } else {
                commitPassiveUnmountEffects_complete();
              }
            }
          }
          function commitPassiveUnmountEffects_complete() {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              if ((fiber.flags & Passive) !== NoFlags) {
                setCurrentFiber(fiber);
                commitPassiveUnmountOnFiber(fiber);
                resetCurrentFiber();
              }
              var sibling = fiber.sibling;
              if (sibling !== null) {
                sibling.return = fiber.return;
                nextEffect = sibling;
                return;
              }
              nextEffect = fiber.return;
            }
          }
          function commitPassiveUnmountOnFiber(finishedWork) {
            switch (finishedWork.tag) {
              case FunctionComponent:
              case ForwardRef:
              case SimpleMemoComponent: {
                if (finishedWork.mode & ProfileMode) {
                  startPassiveEffectTimer();
                  commitHookEffectListUnmount(Passive$1 | HasEffect, finishedWork, finishedWork.return);
                  recordPassiveEffectDuration(finishedWork);
                } else {
                  commitHookEffectListUnmount(Passive$1 | HasEffect, finishedWork, finishedWork.return);
                }
                break;
              }
            }
          }
          function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(deletedSubtreeRoot, nearestMountedAncestor) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              setCurrentFiber(fiber);
              commitPassiveUnmountInsideDeletedTreeOnFiber(fiber, nearestMountedAncestor);
              resetCurrentFiber();
              var child = fiber.child;
              if (child !== null) {
                child.return = fiber;
                nextEffect = child;
              } else {
                commitPassiveUnmountEffectsInsideOfDeletedTree_complete(deletedSubtreeRoot);
              }
            }
          }
          function commitPassiveUnmountEffectsInsideOfDeletedTree_complete(deletedSubtreeRoot) {
            while (nextEffect !== null) {
              var fiber = nextEffect;
              var sibling = fiber.sibling;
              var returnFiber = fiber.return;
              {
                detachFiberAfterEffects(fiber);
                if (fiber === deletedSubtreeRoot) {
                  nextEffect = null;
                  return;
                }
              }
              if (sibling !== null) {
                sibling.return = returnFiber;
                nextEffect = sibling;
                return;
              }
              nextEffect = returnFiber;
            }
          }
          function commitPassiveUnmountInsideDeletedTreeOnFiber(current2, nearestMountedAncestor) {
            switch (current2.tag) {
              case FunctionComponent:
              case ForwardRef:
              case SimpleMemoComponent: {
                if (current2.mode & ProfileMode) {
                  startPassiveEffectTimer();
                  commitHookEffectListUnmount(Passive$1, current2, nearestMountedAncestor);
                  recordPassiveEffectDuration(current2);
                } else {
                  commitHookEffectListUnmount(Passive$1, current2, nearestMountedAncestor);
                }
                break;
              }
            }
          }
          function invokeLayoutEffectMountInDEV(fiber) {
            {
              switch (fiber.tag) {
                case FunctionComponent:
                case ForwardRef:
                case SimpleMemoComponent: {
                  try {
                    commitHookEffectListMount(Layout | HasEffect, fiber);
                  } catch (error2) {
                    captureCommitPhaseError(fiber, fiber.return, error2);
                  }
                  break;
                }
                case ClassComponent: {
                  var instance = fiber.stateNode;
                  try {
                    instance.componentDidMount();
                  } catch (error2) {
                    captureCommitPhaseError(fiber, fiber.return, error2);
                  }
                  break;
                }
              }
            }
          }
          function invokePassiveEffectMountInDEV(fiber) {
            {
              switch (fiber.tag) {
                case FunctionComponent:
                case ForwardRef:
                case SimpleMemoComponent: {
                  try {
                    commitHookEffectListMount(Passive$1 | HasEffect, fiber);
                  } catch (error2) {
                    captureCommitPhaseError(fiber, fiber.return, error2);
                  }
                  break;
                }
              }
            }
          }
          function invokeLayoutEffectUnmountInDEV(fiber) {
            {
              switch (fiber.tag) {
                case FunctionComponent:
                case ForwardRef:
                case SimpleMemoComponent: {
                  try {
                    commitHookEffectListUnmount(Layout | HasEffect, fiber, fiber.return);
                  } catch (error2) {
                    captureCommitPhaseError(fiber, fiber.return, error2);
                  }
                  break;
                }
                case ClassComponent: {
                  var instance = fiber.stateNode;
                  if (typeof instance.componentWillUnmount === "function") {
                    safelyCallComponentWillUnmount(fiber, fiber.return, instance);
                  }
                  break;
                }
              }
            }
          }
          function invokePassiveEffectUnmountInDEV(fiber) {
            {
              switch (fiber.tag) {
                case FunctionComponent:
                case ForwardRef:
                case SimpleMemoComponent: {
                  try {
                    commitHookEffectListUnmount(Passive$1 | HasEffect, fiber, fiber.return);
                  } catch (error2) {
                    captureCommitPhaseError(fiber, fiber.return, error2);
                  }
                }
              }
            }
          }
          var COMPONENT_TYPE = 0;
          var HAS_PSEUDO_CLASS_TYPE = 1;
          var ROLE_TYPE = 2;
          var TEST_NAME_TYPE = 3;
          var TEXT_TYPE = 4;
          if (typeof Symbol === "function" && Symbol.for) {
            var symbolFor = Symbol.for;
            COMPONENT_TYPE = symbolFor("selector.component");
            HAS_PSEUDO_CLASS_TYPE = symbolFor("selector.has_pseudo_class");
            ROLE_TYPE = symbolFor("selector.role");
            TEST_NAME_TYPE = symbolFor("selector.test_id");
            TEXT_TYPE = symbolFor("selector.text");
          }
          function createComponentSelector(component) {
            return {
              $$typeof: COMPONENT_TYPE,
              value: component
            };
          }
          function createHasPseudoClassSelector(selectors) {
            return {
              $$typeof: HAS_PSEUDO_CLASS_TYPE,
              value: selectors
            };
          }
          function createRoleSelector(role) {
            return {
              $$typeof: ROLE_TYPE,
              value: role
            };
          }
          function createTextSelector(text) {
            return {
              $$typeof: TEXT_TYPE,
              value: text
            };
          }
          function createTestNameSelector(id) {
            return {
              $$typeof: TEST_NAME_TYPE,
              value: id
            };
          }
          function findFiberRootForHostRoot(hostRoot) {
            var maybeFiber = getInstanceFromNode(hostRoot);
            if (maybeFiber != null) {
              if (typeof maybeFiber.memoizedProps["data-testname"] !== "string") {
                throw new Error("Invalid host root specified. Should be either a React container or a node with a testname attribute.");
              }
              return maybeFiber;
            } else {
              var fiberRoot = findFiberRoot(hostRoot);
              if (fiberRoot === null) {
                throw new Error("Could not find React container within specified host subtree.");
              }
              return fiberRoot.stateNode.current;
            }
          }
          function matchSelector(fiber, selector) {
            switch (selector.$$typeof) {
              case COMPONENT_TYPE:
                if (fiber.type === selector.value) {
                  return true;
                }
                break;
              case HAS_PSEUDO_CLASS_TYPE:
                return hasMatchingPaths(fiber, selector.value);
              case ROLE_TYPE:
                if (fiber.tag === HostComponent) {
                  var node = fiber.stateNode;
                  if (matchAccessibilityRole(node, selector.value)) {
                    return true;
                  }
                }
                break;
              case TEXT_TYPE:
                if (fiber.tag === HostComponent || fiber.tag === HostText) {
                  var textContent = getTextContent(fiber);
                  if (textContent !== null && textContent.indexOf(selector.value) >= 0) {
                    return true;
                  }
                }
                break;
              case TEST_NAME_TYPE:
                if (fiber.tag === HostComponent) {
                  var dataTestID = fiber.memoizedProps["data-testname"];
                  if (typeof dataTestID === "string" && dataTestID.toLowerCase() === selector.value.toLowerCase()) {
                    return true;
                  }
                }
                break;
              default:
                throw new Error("Invalid selector type specified.");
            }
            return false;
          }
          function selectorToString(selector) {
            switch (selector.$$typeof) {
              case COMPONENT_TYPE:
                var displayName = getComponentNameFromType(selector.value) || "Unknown";
                return "<" + displayName + ">";
              case HAS_PSEUDO_CLASS_TYPE:
                return ":has(" + (selectorToString(selector) || "") + ")";
              case ROLE_TYPE:
                return '[role="' + selector.value + '"]';
              case TEXT_TYPE:
                return '"' + selector.value + '"';
              case TEST_NAME_TYPE:
                return '[data-testname="' + selector.value + '"]';
              default:
                throw new Error("Invalid selector type specified.");
            }
          }
          function findPaths(root, selectors) {
            var matchingFibers = [];
            var stack = [root, 0];
            var index2 = 0;
            while (index2 < stack.length) {
              var fiber = stack[index2++];
              var selectorIndex = stack[index2++];
              var selector = selectors[selectorIndex];
              if (fiber.tag === HostComponent && isHiddenSubtree(fiber)) {
                continue;
              } else {
                while (selector != null && matchSelector(fiber, selector)) {
                  selectorIndex++;
                  selector = selectors[selectorIndex];
                }
              }
              if (selectorIndex === selectors.length) {
                matchingFibers.push(fiber);
              } else {
                var child = fiber.child;
                while (child !== null) {
                  stack.push(child, selectorIndex);
                  child = child.sibling;
                }
              }
            }
            return matchingFibers;
          }
          function hasMatchingPaths(root, selectors) {
            var stack = [root, 0];
            var index2 = 0;
            while (index2 < stack.length) {
              var fiber = stack[index2++];
              var selectorIndex = stack[index2++];
              var selector = selectors[selectorIndex];
              if (fiber.tag === HostComponent && isHiddenSubtree(fiber)) {
                continue;
              } else {
                while (selector != null && matchSelector(fiber, selector)) {
                  selectorIndex++;
                  selector = selectors[selectorIndex];
                }
              }
              if (selectorIndex === selectors.length) {
                return true;
              } else {
                var child = fiber.child;
                while (child !== null) {
                  stack.push(child, selectorIndex);
                  child = child.sibling;
                }
              }
            }
            return false;
          }
          function findAllNodes(hostRoot, selectors) {
            if (!supportsTestSelectors) {
              throw new Error("Test selector API is not supported by this renderer.");
            }
            var root = findFiberRootForHostRoot(hostRoot);
            var matchingFibers = findPaths(root, selectors);
            var instanceRoots = [];
            var stack = Array.from(matchingFibers);
            var index2 = 0;
            while (index2 < stack.length) {
              var node = stack[index2++];
              if (node.tag === HostComponent) {
                if (isHiddenSubtree(node)) {
                  continue;
                }
                instanceRoots.push(node.stateNode);
              } else {
                var child = node.child;
                while (child !== null) {
                  stack.push(child);
                  child = child.sibling;
                }
              }
            }
            return instanceRoots;
          }
          function getFindAllNodesFailureDescription(hostRoot, selectors) {
            if (!supportsTestSelectors) {
              throw new Error("Test selector API is not supported by this renderer.");
            }
            var root = findFiberRootForHostRoot(hostRoot);
            var maxSelectorIndex = 0;
            var matchedNames = [];
            var stack = [root, 0];
            var index2 = 0;
            while (index2 < stack.length) {
              var fiber = stack[index2++];
              var selectorIndex = stack[index2++];
              var selector = selectors[selectorIndex];
              if (fiber.tag === HostComponent && isHiddenSubtree(fiber)) {
                continue;
              } else if (matchSelector(fiber, selector)) {
                matchedNames.push(selectorToString(selector));
                selectorIndex++;
                if (selectorIndex > maxSelectorIndex) {
                  maxSelectorIndex = selectorIndex;
                }
              }
              if (selectorIndex < selectors.length) {
                var child = fiber.child;
                while (child !== null) {
                  stack.push(child, selectorIndex);
                  child = child.sibling;
                }
              }
            }
            if (maxSelectorIndex < selectors.length) {
              var unmatchedNames = [];
              for (var i = maxSelectorIndex; i < selectors.length; i++) {
                unmatchedNames.push(selectorToString(selectors[i]));
              }
              return "findAllNodes was able to match part of the selector:\n" + ("  " + matchedNames.join(" > ") + "\n\n") + "No matching component was found for:\n" + ("  " + unmatchedNames.join(" > "));
            }
            return null;
          }
          function findBoundingRects(hostRoot, selectors) {
            if (!supportsTestSelectors) {
              throw new Error("Test selector API is not supported by this renderer.");
            }
            var instanceRoots = findAllNodes(hostRoot, selectors);
            var boundingRects = [];
            for (var i = 0; i < instanceRoots.length; i++) {
              boundingRects.push(getBoundingRect(instanceRoots[i]));
            }
            for (var _i = boundingRects.length - 1; _i > 0; _i--) {
              var targetRect = boundingRects[_i];
              var targetLeft = targetRect.x;
              var targetRight = targetLeft + targetRect.width;
              var targetTop = targetRect.y;
              var targetBottom = targetTop + targetRect.height;
              for (var j = _i - 1; j >= 0; j--) {
                if (_i !== j) {
                  var otherRect = boundingRects[j];
                  var otherLeft = otherRect.x;
                  var otherRight = otherLeft + otherRect.width;
                  var otherTop = otherRect.y;
                  var otherBottom = otherTop + otherRect.height;
                  if (targetLeft >= otherLeft && targetTop >= otherTop && targetRight <= otherRight && targetBottom <= otherBottom) {
                    boundingRects.splice(_i, 1);
                    break;
                  } else if (targetLeft === otherLeft && targetRect.width === otherRect.width && !(otherBottom < targetTop) && !(otherTop > targetBottom)) {
                    if (otherTop > targetTop) {
                      otherRect.height += otherTop - targetTop;
                      otherRect.y = targetTop;
                    }
                    if (otherBottom < targetBottom) {
                      otherRect.height = targetBottom - otherTop;
                    }
                    boundingRects.splice(_i, 1);
                    break;
                  } else if (targetTop === otherTop && targetRect.height === otherRect.height && !(otherRight < targetLeft) && !(otherLeft > targetRight)) {
                    if (otherLeft > targetLeft) {
                      otherRect.width += otherLeft - targetLeft;
                      otherRect.x = targetLeft;
                    }
                    if (otherRight < targetRight) {
                      otherRect.width = targetRight - otherLeft;
                    }
                    boundingRects.splice(_i, 1);
                    break;
                  }
                }
              }
            }
            return boundingRects;
          }
          function focusWithin(hostRoot, selectors) {
            if (!supportsTestSelectors) {
              throw new Error("Test selector API is not supported by this renderer.");
            }
            var root = findFiberRootForHostRoot(hostRoot);
            var matchingFibers = findPaths(root, selectors);
            var stack = Array.from(matchingFibers);
            var index2 = 0;
            while (index2 < stack.length) {
              var fiber = stack[index2++];
              if (isHiddenSubtree(fiber)) {
                continue;
              }
              if (fiber.tag === HostComponent) {
                var node = fiber.stateNode;
                if (setFocusIfFocusable(node)) {
                  return true;
                }
              }
              var child = fiber.child;
              while (child !== null) {
                stack.push(child);
                child = child.sibling;
              }
            }
            return false;
          }
          var commitHooks = [];
          function onCommitRoot$1() {
            if (supportsTestSelectors) {
              commitHooks.forEach(function(commitHook) {
                return commitHook();
              });
            }
          }
          function observeVisibleRects(hostRoot, selectors, callback, options) {
            if (!supportsTestSelectors) {
              throw new Error("Test selector API is not supported by this renderer.");
            }
            var instanceRoots = findAllNodes(hostRoot, selectors);
            var _setupIntersectionObs = setupIntersectionObserver(instanceRoots, callback, options), disconnect = _setupIntersectionObs.disconnect, observe = _setupIntersectionObs.observe, unobserve = _setupIntersectionObs.unobserve;
            var commitHook = function() {
              var nextInstanceRoots = findAllNodes(hostRoot, selectors);
              instanceRoots.forEach(function(target) {
                if (nextInstanceRoots.indexOf(target) < 0) {
                  unobserve(target);
                }
              });
              nextInstanceRoots.forEach(function(target) {
                if (instanceRoots.indexOf(target) < 0) {
                  observe(target);
                }
              });
            };
            commitHooks.push(commitHook);
            return {
              disconnect: function() {
                var index2 = commitHooks.indexOf(commitHook);
                if (index2 >= 0) {
                  commitHooks.splice(index2, 1);
                }
                disconnect();
              }
            };
          }
          var ReactCurrentActQueue = ReactSharedInternals.ReactCurrentActQueue;
          function isLegacyActEnvironment(fiber) {
            {
              var isReactActEnvironmentGlobal = (
                // $FlowExpectedError – Flow doesn't know about IS_REACT_ACT_ENVIRONMENT global
                typeof IS_REACT_ACT_ENVIRONMENT !== "undefined" ? IS_REACT_ACT_ENVIRONMENT : void 0
              );
              var jestIsDefined = typeof jest !== "undefined";
              return warnsIfNotActing && jestIsDefined && isReactActEnvironmentGlobal !== false;
            }
          }
          function isConcurrentActEnvironment() {
            {
              var isReactActEnvironmentGlobal = (
                // $FlowExpectedError – Flow doesn't know about IS_REACT_ACT_ENVIRONMENT global
                typeof IS_REACT_ACT_ENVIRONMENT !== "undefined" ? IS_REACT_ACT_ENVIRONMENT : void 0
              );
              if (!isReactActEnvironmentGlobal && ReactCurrentActQueue.current !== null) {
                error("The current testing environment is not configured to support act(...)");
              }
              return isReactActEnvironmentGlobal;
            }
          }
          var ceil = Math.ceil;
          var ReactCurrentDispatcher$2 = ReactSharedInternals.ReactCurrentDispatcher, ReactCurrentOwner$2 = ReactSharedInternals.ReactCurrentOwner, ReactCurrentBatchConfig$2 = ReactSharedInternals.ReactCurrentBatchConfig, ReactCurrentActQueue$1 = ReactSharedInternals.ReactCurrentActQueue;
          var NoContext = (
            /*             */
            0
          );
          var BatchedContext = (
            /*               */
            1
          );
          var RenderContext = (
            /*                */
            2
          );
          var CommitContext = (
            /*                */
            4
          );
          var RootInProgress = 0;
          var RootFatalErrored = 1;
          var RootErrored = 2;
          var RootSuspended = 3;
          var RootSuspendedWithDelay = 4;
          var RootCompleted = 5;
          var RootDidNotComplete = 6;
          var executionContext = NoContext;
          var workInProgressRoot = null;
          var workInProgress = null;
          var workInProgressRootRenderLanes = NoLanes;
          var subtreeRenderLanes = NoLanes;
          var subtreeRenderLanesCursor = createCursor(NoLanes);
          var workInProgressRootExitStatus = RootInProgress;
          var workInProgressRootFatalError = null;
          var workInProgressRootIncludedLanes = NoLanes;
          var workInProgressRootSkippedLanes = NoLanes;
          var workInProgressRootInterleavedUpdatedLanes = NoLanes;
          var workInProgressRootPingedLanes = NoLanes;
          var workInProgressRootConcurrentErrors = null;
          var workInProgressRootRecoverableErrors = null;
          var globalMostRecentFallbackTime = 0;
          var FALLBACK_THROTTLE_MS = 500;
          var workInProgressRootRenderTargetTime = Infinity;
          var RENDER_TIMEOUT_MS = 500;
          var workInProgressTransitions = null;
          function resetRenderTimer() {
            workInProgressRootRenderTargetTime = now() + RENDER_TIMEOUT_MS;
          }
          function getRenderTargetTime() {
            return workInProgressRootRenderTargetTime;
          }
          var hasUncaughtError = false;
          var firstUncaughtError = null;
          var legacyErrorBoundariesThatAlreadyFailed = null;
          var rootDoesHavePassiveEffects = false;
          var rootWithPendingPassiveEffects = null;
          var pendingPassiveEffectsLanes = NoLanes;
          var pendingPassiveProfilerEffects = [];
          var pendingPassiveTransitions = null;
          var NESTED_UPDATE_LIMIT = 50;
          var nestedUpdateCount = 0;
          var rootWithNestedUpdates = null;
          var isFlushingPassiveEffects = false;
          var didScheduleUpdateDuringPassiveEffects = false;
          var NESTED_PASSIVE_UPDATE_LIMIT = 50;
          var nestedPassiveUpdateCount = 0;
          var rootWithPassiveNestedUpdates = null;
          var currentEventTime = NoTimestamp;
          var currentEventTransitionLane = NoLanes;
          var isRunningInsertionEffect = false;
          function getWorkInProgressRoot() {
            return workInProgressRoot;
          }
          function requestEventTime() {
            if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
              return now();
            }
            if (currentEventTime !== NoTimestamp) {
              return currentEventTime;
            }
            currentEventTime = now();
            return currentEventTime;
          }
          function requestUpdateLane(fiber) {
            var mode = fiber.mode;
            if ((mode & ConcurrentMode) === NoMode) {
              return SyncLane;
            } else if ((executionContext & RenderContext) !== NoContext && workInProgressRootRenderLanes !== NoLanes) {
              return pickArbitraryLane(workInProgressRootRenderLanes);
            }
            var isTransition = requestCurrentTransition() !== NoTransition;
            if (isTransition) {
              if (ReactCurrentBatchConfig$2.transition !== null) {
                var transition = ReactCurrentBatchConfig$2.transition;
                if (!transition._updatedFibers) {
                  transition._updatedFibers = /* @__PURE__ */ new Set();
                }
                transition._updatedFibers.add(fiber);
              }
              if (currentEventTransitionLane === NoLane) {
                currentEventTransitionLane = claimNextTransitionLane();
              }
              return currentEventTransitionLane;
            }
            var updateLane = getCurrentUpdatePriority();
            if (updateLane !== NoLane) {
              return updateLane;
            }
            var eventLane = getCurrentEventPriority();
            return eventLane;
          }
          function requestRetryLane(fiber) {
            var mode = fiber.mode;
            if ((mode & ConcurrentMode) === NoMode) {
              return SyncLane;
            }
            return claimNextRetryLane();
          }
          function scheduleUpdateOnFiber(root, fiber, lane, eventTime) {
            checkForNestedUpdates();
            {
              if (isRunningInsertionEffect) {
                error("useInsertionEffect must not schedule updates.");
              }
            }
            {
              if (isFlushingPassiveEffects) {
                didScheduleUpdateDuringPassiveEffects = true;
              }
            }
            markRootUpdated(root, lane, eventTime);
            if ((executionContext & RenderContext) !== NoLanes && root === workInProgressRoot) {
              warnAboutRenderPhaseUpdatesInDEV(fiber);
            } else {
              {
                if (isDevToolsPresent) {
                  addFiberToLanesMap(root, fiber, lane);
                }
              }
              warnIfUpdatesNotWrappedWithActDEV(fiber);
              if (root === workInProgressRoot) {
                if ((executionContext & RenderContext) === NoContext) {
                  workInProgressRootInterleavedUpdatedLanes = mergeLanes(workInProgressRootInterleavedUpdatedLanes, lane);
                }
                if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
                  markRootSuspended$1(root, workInProgressRootRenderLanes);
                }
              }
              ensureRootIsScheduled(root, eventTime);
              if (lane === SyncLane && executionContext === NoContext && (fiber.mode & ConcurrentMode) === NoMode && // Treat `act` as if it's inside `batchedUpdates`, even in legacy mode.
              !ReactCurrentActQueue$1.isBatchingLegacy) {
                resetRenderTimer();
                flushSyncCallbacksOnlyInLegacyMode();
              }
            }
          }
          function scheduleInitialHydrationOnRoot(root, lane, eventTime) {
            var current2 = root.current;
            current2.lanes = lane;
            markRootUpdated(root, lane, eventTime);
            ensureRootIsScheduled(root, eventTime);
          }
          function isUnsafeClassRenderPhaseUpdate(fiber) {
            return (
              // TODO: Remove outdated deferRenderPhaseUpdateToNextBatch experiment. We
              // decided not to enable it.
              (executionContext & RenderContext) !== NoContext
            );
          }
          function ensureRootIsScheduled(root, currentTime) {
            var existingCallbackNode = root.callbackNode;
            markStarvedLanesAsExpired(root, currentTime);
            var nextLanes = getNextLanes(root, root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes);
            if (nextLanes === NoLanes) {
              if (existingCallbackNode !== null) {
                cancelCallback$1(existingCallbackNode);
              }
              root.callbackNode = null;
              root.callbackPriority = NoLane;
              return;
            }
            var newCallbackPriority = getHighestPriorityLane(nextLanes);
            var existingCallbackPriority = root.callbackPriority;
            if (existingCallbackPriority === newCallbackPriority && // Special case related to `act`. If the currently scheduled task is a
            // Scheduler task, rather than an `act` task, cancel it and re-scheduled
            // on the `act` queue.
            !(ReactCurrentActQueue$1.current !== null && existingCallbackNode !== fakeActCallbackNode)) {
              {
                if (existingCallbackNode == null && existingCallbackPriority !== SyncLane) {
                  error("Expected scheduled callback to exist. This error is likely caused by a bug in React. Please file an issue.");
                }
              }
              return;
            }
            if (existingCallbackNode != null) {
              cancelCallback$1(existingCallbackNode);
            }
            var newCallbackNode;
            if (newCallbackPriority === SyncLane) {
              if (root.tag === LegacyRoot) {
                if (ReactCurrentActQueue$1.isBatchingLegacy !== null) {
                  ReactCurrentActQueue$1.didScheduleLegacyUpdate = true;
                }
                scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));
              } else {
                scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
              }
              if (supportsMicrotasks) {
                if (ReactCurrentActQueue$1.current !== null) {
                  ReactCurrentActQueue$1.current.push(flushSyncCallbacks);
                } else {
                  scheduleMicrotask(function() {
                    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
                      flushSyncCallbacks();
                    }
                  });
                }
              } else {
                scheduleCallback$1(ImmediatePriority, flushSyncCallbacks);
              }
              newCallbackNode = null;
            } else {
              var schedulerPriorityLevel;
              switch (lanesToEventPriority(nextLanes)) {
                case DiscreteEventPriority:
                  schedulerPriorityLevel = ImmediatePriority;
                  break;
                case ContinuousEventPriority:
                  schedulerPriorityLevel = UserBlockingPriority;
                  break;
                case DefaultEventPriority2:
                  schedulerPriorityLevel = NormalPriority;
                  break;
                case IdleEventPriority:
                  schedulerPriorityLevel = IdlePriority;
                  break;
                default:
                  schedulerPriorityLevel = NormalPriority;
                  break;
              }
              newCallbackNode = scheduleCallback$1(schedulerPriorityLevel, performConcurrentWorkOnRoot.bind(null, root));
            }
            root.callbackPriority = newCallbackPriority;
            root.callbackNode = newCallbackNode;
          }
          function performConcurrentWorkOnRoot(root, didTimeout) {
            {
              resetNestedUpdateFlag();
            }
            currentEventTime = NoTimestamp;
            currentEventTransitionLane = NoLanes;
            if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
              throw new Error("Should not already be working.");
            }
            var originalCallbackNode = root.callbackNode;
            var didFlushPassiveEffects = flushPassiveEffects();
            if (didFlushPassiveEffects) {
              if (root.callbackNode !== originalCallbackNode) {
                return null;
              }
            }
            var lanes = getNextLanes(root, root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes);
            if (lanes === NoLanes) {
              return null;
            }
            var shouldTimeSlice = !includesBlockingLane(root, lanes) && !includesExpiredLane(root, lanes) && !didTimeout;
            var exitStatus = shouldTimeSlice ? renderRootConcurrent(root, lanes) : renderRootSync(root, lanes);
            if (exitStatus !== RootInProgress) {
              if (exitStatus === RootErrored) {
                var errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
                if (errorRetryLanes !== NoLanes) {
                  lanes = errorRetryLanes;
                  exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
                }
              }
              if (exitStatus === RootFatalErrored) {
                var fatalError = workInProgressRootFatalError;
                prepareFreshStack(root, NoLanes);
                markRootSuspended$1(root, lanes);
                ensureRootIsScheduled(root, now());
                throw fatalError;
              }
              if (exitStatus === RootDidNotComplete) {
                markRootSuspended$1(root, lanes);
              } else {
                var renderWasConcurrent = !includesBlockingLane(root, lanes);
                var finishedWork = root.current.alternate;
                if (renderWasConcurrent && !isRenderConsistentWithExternalStores(finishedWork)) {
                  exitStatus = renderRootSync(root, lanes);
                  if (exitStatus === RootErrored) {
                    var _errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
                    if (_errorRetryLanes !== NoLanes) {
                      lanes = _errorRetryLanes;
                      exitStatus = recoverFromConcurrentError(root, _errorRetryLanes);
                    }
                  }
                  if (exitStatus === RootFatalErrored) {
                    var _fatalError = workInProgressRootFatalError;
                    prepareFreshStack(root, NoLanes);
                    markRootSuspended$1(root, lanes);
                    ensureRootIsScheduled(root, now());
                    throw _fatalError;
                  }
                }
                root.finishedWork = finishedWork;
                root.finishedLanes = lanes;
                finishConcurrentRender(root, exitStatus, lanes);
              }
            }
            ensureRootIsScheduled(root, now());
            if (root.callbackNode === originalCallbackNode) {
              return performConcurrentWorkOnRoot.bind(null, root);
            }
            return null;
          }
          function recoverFromConcurrentError(root, errorRetryLanes) {
            var errorsFromFirstAttempt = workInProgressRootConcurrentErrors;
            if (isRootDehydrated(root)) {
              var rootWorkInProgress = prepareFreshStack(root, errorRetryLanes);
              rootWorkInProgress.flags |= ForceClientRender;
              {
                errorHydratingContainer(root.containerInfo);
              }
            }
            var exitStatus = renderRootSync(root, errorRetryLanes);
            if (exitStatus !== RootErrored) {
              var errorsFromSecondAttempt = workInProgressRootRecoverableErrors;
              workInProgressRootRecoverableErrors = errorsFromFirstAttempt;
              if (errorsFromSecondAttempt !== null) {
                queueRecoverableErrors(errorsFromSecondAttempt);
              }
            }
            return exitStatus;
          }
          function queueRecoverableErrors(errors) {
            if (workInProgressRootRecoverableErrors === null) {
              workInProgressRootRecoverableErrors = errors;
            } else {
              workInProgressRootRecoverableErrors.push.apply(workInProgressRootRecoverableErrors, errors);
            }
          }
          function finishConcurrentRender(root, exitStatus, lanes) {
            switch (exitStatus) {
              case RootInProgress:
              case RootFatalErrored: {
                throw new Error("Root did not complete. This is a bug in React.");
              }
              // Flow knows about invariant, so it complains if I add a break
              // statement, but eslint doesn't know about invariant, so it complains
              // if I do. eslint-disable-next-line no-fallthrough
              case RootErrored: {
                commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
                break;
              }
              case RootSuspended: {
                markRootSuspended$1(root, lanes);
                if (includesOnlyRetries(lanes) && // do not delay if we're inside an act() scope
                !shouldForceFlushFallbacksInDEV()) {
                  var msUntilTimeout = globalMostRecentFallbackTime + FALLBACK_THROTTLE_MS - now();
                  if (msUntilTimeout > 10) {
                    var nextLanes = getNextLanes(root, NoLanes);
                    if (nextLanes !== NoLanes) {
                      break;
                    }
                    var suspendedLanes = root.suspendedLanes;
                    if (!isSubsetOfLanes(suspendedLanes, lanes)) {
                      var eventTime = requestEventTime();
                      markRootPinged(root, suspendedLanes);
                      break;
                    }
                    root.timeoutHandle = scheduleTimeout(commitRoot.bind(null, root, workInProgressRootRecoverableErrors, workInProgressTransitions), msUntilTimeout);
                    break;
                  }
                }
                commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
                break;
              }
              case RootSuspendedWithDelay: {
                markRootSuspended$1(root, lanes);
                if (includesOnlyTransitions(lanes)) {
                  break;
                }
                if (!shouldForceFlushFallbacksInDEV()) {
                  var mostRecentEventTime = getMostRecentEventTime(root, lanes);
                  var eventTimeMs = mostRecentEventTime;
                  var timeElapsedMs = now() - eventTimeMs;
                  var _msUntilTimeout = jnd(timeElapsedMs) - timeElapsedMs;
                  if (_msUntilTimeout > 10) {
                    root.timeoutHandle = scheduleTimeout(commitRoot.bind(null, root, workInProgressRootRecoverableErrors, workInProgressTransitions), _msUntilTimeout);
                    break;
                  }
                }
                commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
                break;
              }
              case RootCompleted: {
                commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
                break;
              }
              default: {
                throw new Error("Unknown root exit status.");
              }
            }
          }
          function isRenderConsistentWithExternalStores(finishedWork) {
            var node = finishedWork;
            while (true) {
              if (node.flags & StoreConsistency) {
                var updateQueue = node.updateQueue;
                if (updateQueue !== null) {
                  var checks = updateQueue.stores;
                  if (checks !== null) {
                    for (var i = 0; i < checks.length; i++) {
                      var check = checks[i];
                      var getSnapshot = check.getSnapshot;
                      var renderedValue = check.value;
                      try {
                        if (!objectIs(getSnapshot(), renderedValue)) {
                          return false;
                        }
                      } catch (error2) {
                        return false;
                      }
                    }
                  }
                }
              }
              var child = node.child;
              if (node.subtreeFlags & StoreConsistency && child !== null) {
                child.return = node;
                node = child;
                continue;
              }
              if (node === finishedWork) {
                return true;
              }
              while (node.sibling === null) {
                if (node.return === null || node.return === finishedWork) {
                  return true;
                }
                node = node.return;
              }
              node.sibling.return = node.return;
              node = node.sibling;
            }
            return true;
          }
          function markRootSuspended$1(root, suspendedLanes) {
            suspendedLanes = removeLanes(suspendedLanes, workInProgressRootPingedLanes);
            suspendedLanes = removeLanes(suspendedLanes, workInProgressRootInterleavedUpdatedLanes);
            markRootSuspended(root, suspendedLanes);
          }
          function performSyncWorkOnRoot(root) {
            {
              syncNestedUpdateFlag();
            }
            if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
              throw new Error("Should not already be working.");
            }
            flushPassiveEffects();
            var lanes = getNextLanes(root, NoLanes);
            if (!includesSomeLane(lanes, SyncLane)) {
              ensureRootIsScheduled(root, now());
              return null;
            }
            var exitStatus = renderRootSync(root, lanes);
            if (root.tag !== LegacyRoot && exitStatus === RootErrored) {
              var errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
              if (errorRetryLanes !== NoLanes) {
                lanes = errorRetryLanes;
                exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
              }
            }
            if (exitStatus === RootFatalErrored) {
              var fatalError = workInProgressRootFatalError;
              prepareFreshStack(root, NoLanes);
              markRootSuspended$1(root, lanes);
              ensureRootIsScheduled(root, now());
              throw fatalError;
            }
            if (exitStatus === RootDidNotComplete) {
              throw new Error("Root did not complete. This is a bug in React.");
            }
            var finishedWork = root.current.alternate;
            root.finishedWork = finishedWork;
            root.finishedLanes = lanes;
            commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
            ensureRootIsScheduled(root, now());
            return null;
          }
          function flushRoot(root, lanes) {
            if (lanes !== NoLanes) {
              markRootEntangled(root, mergeLanes(lanes, SyncLane));
              ensureRootIsScheduled(root, now());
              if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
                resetRenderTimer();
                flushSyncCallbacks();
              }
            }
          }
          function deferredUpdates(fn) {
            var previousPriority = getCurrentUpdatePriority();
            var prevTransition = ReactCurrentBatchConfig$2.transition;
            try {
              ReactCurrentBatchConfig$2.transition = null;
              setCurrentUpdatePriority(DefaultEventPriority2);
              return fn();
            } finally {
              setCurrentUpdatePriority(previousPriority);
              ReactCurrentBatchConfig$2.transition = prevTransition;
            }
          }
          function batchedUpdates(fn, a) {
            var prevExecutionContext = executionContext;
            executionContext |= BatchedContext;
            try {
              return fn(a);
            } finally {
              executionContext = prevExecutionContext;
              if (executionContext === NoContext && // Treat `act` as if it's inside `batchedUpdates`, even in legacy mode.
              !ReactCurrentActQueue$1.isBatchingLegacy) {
                resetRenderTimer();
                flushSyncCallbacksOnlyInLegacyMode();
              }
            }
          }
          function discreteUpdates(fn, a, b, c, d) {
            var previousPriority = getCurrentUpdatePriority();
            var prevTransition = ReactCurrentBatchConfig$2.transition;
            try {
              ReactCurrentBatchConfig$2.transition = null;
              setCurrentUpdatePriority(DiscreteEventPriority);
              return fn(a, b, c, d);
            } finally {
              setCurrentUpdatePriority(previousPriority);
              ReactCurrentBatchConfig$2.transition = prevTransition;
              if (executionContext === NoContext) {
                resetRenderTimer();
              }
            }
          }
          function flushSync(fn) {
            if (rootWithPendingPassiveEffects !== null && rootWithPendingPassiveEffects.tag === LegacyRoot && (executionContext & (RenderContext | CommitContext)) === NoContext) {
              flushPassiveEffects();
            }
            var prevExecutionContext = executionContext;
            executionContext |= BatchedContext;
            var prevTransition = ReactCurrentBatchConfig$2.transition;
            var previousPriority = getCurrentUpdatePriority();
            try {
              ReactCurrentBatchConfig$2.transition = null;
              setCurrentUpdatePriority(DiscreteEventPriority);
              if (fn) {
                return fn();
              } else {
                return void 0;
              }
            } finally {
              setCurrentUpdatePriority(previousPriority);
              ReactCurrentBatchConfig$2.transition = prevTransition;
              executionContext = prevExecutionContext;
              if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
                flushSyncCallbacks();
              }
            }
          }
          function isAlreadyRendering() {
            return (executionContext & (RenderContext | CommitContext)) !== NoContext;
          }
          function flushControlled(fn) {
            var prevExecutionContext = executionContext;
            executionContext |= BatchedContext;
            var prevTransition = ReactCurrentBatchConfig$2.transition;
            var previousPriority = getCurrentUpdatePriority();
            try {
              ReactCurrentBatchConfig$2.transition = null;
              setCurrentUpdatePriority(DiscreteEventPriority);
              fn();
            } finally {
              setCurrentUpdatePriority(previousPriority);
              ReactCurrentBatchConfig$2.transition = prevTransition;
              executionContext = prevExecutionContext;
              if (executionContext === NoContext) {
                resetRenderTimer();
                flushSyncCallbacks();
              }
            }
          }
          function pushRenderLanes(fiber, lanes) {
            push(subtreeRenderLanesCursor, subtreeRenderLanes, fiber);
            subtreeRenderLanes = mergeLanes(subtreeRenderLanes, lanes);
            workInProgressRootIncludedLanes = mergeLanes(workInProgressRootIncludedLanes, lanes);
          }
          function popRenderLanes(fiber) {
            subtreeRenderLanes = subtreeRenderLanesCursor.current;
            pop(subtreeRenderLanesCursor, fiber);
          }
          function prepareFreshStack(root, lanes) {
            root.finishedWork = null;
            root.finishedLanes = NoLanes;
            var timeoutHandle = root.timeoutHandle;
            if (timeoutHandle !== noTimeout) {
              root.timeoutHandle = noTimeout;
              cancelTimeout(timeoutHandle);
            }
            if (workInProgress !== null) {
              var interruptedWork = workInProgress.return;
              while (interruptedWork !== null) {
                var current2 = interruptedWork.alternate;
                unwindInterruptedWork(current2, interruptedWork);
                interruptedWork = interruptedWork.return;
              }
            }
            workInProgressRoot = root;
            var rootWorkInProgress = createWorkInProgress(root.current, null);
            workInProgress = rootWorkInProgress;
            workInProgressRootRenderLanes = subtreeRenderLanes = workInProgressRootIncludedLanes = lanes;
            workInProgressRootExitStatus = RootInProgress;
            workInProgressRootFatalError = null;
            workInProgressRootSkippedLanes = NoLanes;
            workInProgressRootInterleavedUpdatedLanes = NoLanes;
            workInProgressRootPingedLanes = NoLanes;
            workInProgressRootConcurrentErrors = null;
            workInProgressRootRecoverableErrors = null;
            finishQueueingConcurrentUpdates();
            {
              ReactStrictModeWarnings.discardPendingWarnings();
            }
            return rootWorkInProgress;
          }
          function handleError(root, thrownValue) {
            do {
              var erroredWork = workInProgress;
              try {
                resetContextDependencies();
                resetHooksAfterThrow();
                resetCurrentFiber();
                ReactCurrentOwner$2.current = null;
                if (erroredWork === null || erroredWork.return === null) {
                  workInProgressRootExitStatus = RootFatalErrored;
                  workInProgressRootFatalError = thrownValue;
                  workInProgress = null;
                  return;
                }
                if (enableProfilerTimer && erroredWork.mode & ProfileMode) {
                  stopProfilerTimerIfRunningAndRecordDelta(erroredWork, true);
                }
                if (enableSchedulingProfiler) {
                  markComponentRenderStopped();
                  if (thrownValue !== null && typeof thrownValue === "object" && typeof thrownValue.then === "function") {
                    var wakeable = thrownValue;
                    markComponentSuspended(erroredWork, wakeable, workInProgressRootRenderLanes);
                  } else {
                    markComponentErrored(erroredWork, thrownValue, workInProgressRootRenderLanes);
                  }
                }
                throwException(root, erroredWork.return, erroredWork, thrownValue, workInProgressRootRenderLanes);
                completeUnitOfWork(erroredWork);
              } catch (yetAnotherThrownValue) {
                thrownValue = yetAnotherThrownValue;
                if (workInProgress === erroredWork && erroredWork !== null) {
                  erroredWork = erroredWork.return;
                  workInProgress = erroredWork;
                } else {
                  erroredWork = workInProgress;
                }
                continue;
              }
              return;
            } while (true);
          }
          function pushDispatcher() {
            var prevDispatcher = ReactCurrentDispatcher$2.current;
            ReactCurrentDispatcher$2.current = ContextOnlyDispatcher;
            if (prevDispatcher === null) {
              return ContextOnlyDispatcher;
            } else {
              return prevDispatcher;
            }
          }
          function popDispatcher(prevDispatcher) {
            ReactCurrentDispatcher$2.current = prevDispatcher;
          }
          function markCommitTimeOfFallback() {
            globalMostRecentFallbackTime = now();
          }
          function markSkippedUpdateLanes(lane) {
            workInProgressRootSkippedLanes = mergeLanes(lane, workInProgressRootSkippedLanes);
          }
          function renderDidSuspend() {
            if (workInProgressRootExitStatus === RootInProgress) {
              workInProgressRootExitStatus = RootSuspended;
            }
          }
          function renderDidSuspendDelayIfPossible() {
            if (workInProgressRootExitStatus === RootInProgress || workInProgressRootExitStatus === RootSuspended || workInProgressRootExitStatus === RootErrored) {
              workInProgressRootExitStatus = RootSuspendedWithDelay;
            }
            if (workInProgressRoot !== null && (includesNonIdleWork(workInProgressRootSkippedLanes) || includesNonIdleWork(workInProgressRootInterleavedUpdatedLanes))) {
              markRootSuspended$1(workInProgressRoot, workInProgressRootRenderLanes);
            }
          }
          function renderDidError(error2) {
            if (workInProgressRootExitStatus !== RootSuspendedWithDelay) {
              workInProgressRootExitStatus = RootErrored;
            }
            if (workInProgressRootConcurrentErrors === null) {
              workInProgressRootConcurrentErrors = [error2];
            } else {
              workInProgressRootConcurrentErrors.push(error2);
            }
          }
          function renderHasNotSuspendedYet() {
            return workInProgressRootExitStatus === RootInProgress;
          }
          function renderRootSync(root, lanes) {
            var prevExecutionContext = executionContext;
            executionContext |= RenderContext;
            var prevDispatcher = pushDispatcher();
            if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
              {
                if (isDevToolsPresent) {
                  var memoizedUpdaters = root.memoizedUpdaters;
                  if (memoizedUpdaters.size > 0) {
                    restorePendingUpdaters(root, workInProgressRootRenderLanes);
                    memoizedUpdaters.clear();
                  }
                  movePendingFibersToMemoized(root, lanes);
                }
              }
              workInProgressTransitions = getTransitionsForLanes();
              prepareFreshStack(root, lanes);
            }
            {
              markRenderStarted(lanes);
            }
            do {
              try {
                workLoopSync();
                break;
              } catch (thrownValue) {
                handleError(root, thrownValue);
              }
            } while (true);
            resetContextDependencies();
            executionContext = prevExecutionContext;
            popDispatcher(prevDispatcher);
            if (workInProgress !== null) {
              throw new Error("Cannot commit an incomplete root. This error is likely caused by a bug in React. Please file an issue.");
            }
            {
              markRenderStopped();
            }
            workInProgressRoot = null;
            workInProgressRootRenderLanes = NoLanes;
            return workInProgressRootExitStatus;
          }
          function workLoopSync() {
            while (workInProgress !== null) {
              performUnitOfWork(workInProgress);
            }
          }
          function renderRootConcurrent(root, lanes) {
            var prevExecutionContext = executionContext;
            executionContext |= RenderContext;
            var prevDispatcher = pushDispatcher();
            if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
              {
                if (isDevToolsPresent) {
                  var memoizedUpdaters = root.memoizedUpdaters;
                  if (memoizedUpdaters.size > 0) {
                    restorePendingUpdaters(root, workInProgressRootRenderLanes);
                    memoizedUpdaters.clear();
                  }
                  movePendingFibersToMemoized(root, lanes);
                }
              }
              workInProgressTransitions = getTransitionsForLanes();
              resetRenderTimer();
              prepareFreshStack(root, lanes);
            }
            {
              markRenderStarted(lanes);
            }
            do {
              try {
                workLoopConcurrent();
                break;
              } catch (thrownValue) {
                handleError(root, thrownValue);
              }
            } while (true);
            resetContextDependencies();
            popDispatcher(prevDispatcher);
            executionContext = prevExecutionContext;
            if (workInProgress !== null) {
              {
                markRenderYielded();
              }
              return RootInProgress;
            } else {
              {
                markRenderStopped();
              }
              workInProgressRoot = null;
              workInProgressRootRenderLanes = NoLanes;
              return workInProgressRootExitStatus;
            }
          }
          function workLoopConcurrent() {
            while (workInProgress !== null && !shouldYield()) {
              performUnitOfWork(workInProgress);
            }
          }
          function performUnitOfWork(unitOfWork) {
            var current2 = unitOfWork.alternate;
            setCurrentFiber(unitOfWork);
            var next;
            if ((unitOfWork.mode & ProfileMode) !== NoMode) {
              startProfilerTimer(unitOfWork);
              next = beginWork$1(current2, unitOfWork, subtreeRenderLanes);
              stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
            } else {
              next = beginWork$1(current2, unitOfWork, subtreeRenderLanes);
            }
            resetCurrentFiber();
            unitOfWork.memoizedProps = unitOfWork.pendingProps;
            if (next === null) {
              completeUnitOfWork(unitOfWork);
            } else {
              workInProgress = next;
            }
            ReactCurrentOwner$2.current = null;
          }
          function completeUnitOfWork(unitOfWork) {
            var completedWork = unitOfWork;
            do {
              var current2 = completedWork.alternate;
              var returnFiber = completedWork.return;
              if ((completedWork.flags & Incomplete) === NoFlags) {
                setCurrentFiber(completedWork);
                var next = void 0;
                if ((completedWork.mode & ProfileMode) === NoMode) {
                  next = completeWork(current2, completedWork, subtreeRenderLanes);
                } else {
                  startProfilerTimer(completedWork);
                  next = completeWork(current2, completedWork, subtreeRenderLanes);
                  stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);
                }
                resetCurrentFiber();
                if (next !== null) {
                  workInProgress = next;
                  return;
                }
              } else {
                var _next = unwindWork(current2, completedWork);
                if (_next !== null) {
                  _next.flags &= HostEffectMask;
                  workInProgress = _next;
                  return;
                }
                if ((completedWork.mode & ProfileMode) !== NoMode) {
                  stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);
                  var actualDuration = completedWork.actualDuration;
                  var child = completedWork.child;
                  while (child !== null) {
                    actualDuration += child.actualDuration;
                    child = child.sibling;
                  }
                  completedWork.actualDuration = actualDuration;
                }
                if (returnFiber !== null) {
                  returnFiber.flags |= Incomplete;
                  returnFiber.subtreeFlags = NoFlags;
                  returnFiber.deletions = null;
                } else {
                  workInProgressRootExitStatus = RootDidNotComplete;
                  workInProgress = null;
                  return;
                }
              }
              var siblingFiber = completedWork.sibling;
              if (siblingFiber !== null) {
                workInProgress = siblingFiber;
                return;
              }
              completedWork = returnFiber;
              workInProgress = completedWork;
            } while (completedWork !== null);
            if (workInProgressRootExitStatus === RootInProgress) {
              workInProgressRootExitStatus = RootCompleted;
            }
          }
          function commitRoot(root, recoverableErrors, transitions) {
            var previousUpdateLanePriority = getCurrentUpdatePriority();
            var prevTransition = ReactCurrentBatchConfig$2.transition;
            try {
              ReactCurrentBatchConfig$2.transition = null;
              setCurrentUpdatePriority(DiscreteEventPriority);
              commitRootImpl(root, recoverableErrors, transitions, previousUpdateLanePriority);
            } finally {
              ReactCurrentBatchConfig$2.transition = prevTransition;
              setCurrentUpdatePriority(previousUpdateLanePriority);
            }
            return null;
          }
          function commitRootImpl(root, recoverableErrors, transitions, renderPriorityLevel) {
            do {
              flushPassiveEffects();
            } while (rootWithPendingPassiveEffects !== null);
            flushRenderPhaseStrictModeWarningsInDEV();
            if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
              throw new Error("Should not already be working.");
            }
            var finishedWork = root.finishedWork;
            var lanes = root.finishedLanes;
            {
              markCommitStarted(lanes);
            }
            if (finishedWork === null) {
              {
                markCommitStopped();
              }
              return null;
            } else {
              {
                if (lanes === NoLanes) {
                  error("root.finishedLanes should not be empty during a commit. This is a bug in React.");
                }
              }
            }
            root.finishedWork = null;
            root.finishedLanes = NoLanes;
            if (finishedWork === root.current) {
              throw new Error("Cannot commit the same tree as before. This error is likely caused by a bug in React. Please file an issue.");
            }
            root.callbackNode = null;
            root.callbackPriority = NoLane;
            var remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes);
            markRootFinished(root, remainingLanes);
            if (root === workInProgressRoot) {
              workInProgressRoot = null;
              workInProgress = null;
              workInProgressRootRenderLanes = NoLanes;
            }
            if ((finishedWork.subtreeFlags & PassiveMask) !== NoFlags || (finishedWork.flags & PassiveMask) !== NoFlags) {
              if (!rootDoesHavePassiveEffects) {
                rootDoesHavePassiveEffects = true;
                pendingPassiveTransitions = transitions;
                scheduleCallback$1(NormalPriority, function() {
                  flushPassiveEffects();
                  return null;
                });
              }
            }
            var subtreeHasEffects = (finishedWork.subtreeFlags & (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !== NoFlags;
            var rootHasEffect = (finishedWork.flags & (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !== NoFlags;
            if (subtreeHasEffects || rootHasEffect) {
              var prevTransition = ReactCurrentBatchConfig$2.transition;
              ReactCurrentBatchConfig$2.transition = null;
              var previousPriority = getCurrentUpdatePriority();
              setCurrentUpdatePriority(DiscreteEventPriority);
              var prevExecutionContext = executionContext;
              executionContext |= CommitContext;
              ReactCurrentOwner$2.current = null;
              var shouldFireAfterActiveInstanceBlur2 = commitBeforeMutationEffects(root, finishedWork);
              {
                recordCommitTime();
              }
              commitMutationEffects(root, finishedWork, lanes);
              resetAfterCommit(root.containerInfo);
              root.current = finishedWork;
              {
                markLayoutEffectsStarted(lanes);
              }
              commitLayoutEffects(finishedWork, root, lanes);
              {
                markLayoutEffectsStopped();
              }
              requestPaint();
              executionContext = prevExecutionContext;
              setCurrentUpdatePriority(previousPriority);
              ReactCurrentBatchConfig$2.transition = prevTransition;
            } else {
              root.current = finishedWork;
              {
                recordCommitTime();
              }
            }
            var rootDidHavePassiveEffects = rootDoesHavePassiveEffects;
            if (rootDoesHavePassiveEffects) {
              rootDoesHavePassiveEffects = false;
              rootWithPendingPassiveEffects = root;
              pendingPassiveEffectsLanes = lanes;
            } else {
              {
                nestedPassiveUpdateCount = 0;
                rootWithPassiveNestedUpdates = null;
              }
            }
            remainingLanes = root.pendingLanes;
            if (remainingLanes === NoLanes) {
              legacyErrorBoundariesThatAlreadyFailed = null;
            }
            {
              if (!rootDidHavePassiveEffects) {
                commitDoubleInvokeEffectsInDEV(root.current, false);
              }
            }
            onCommitRoot(finishedWork.stateNode, renderPriorityLevel);
            {
              if (isDevToolsPresent) {
                root.memoizedUpdaters.clear();
              }
            }
            {
              onCommitRoot$1();
            }
            ensureRootIsScheduled(root, now());
            if (recoverableErrors !== null) {
              var onRecoverableError = root.onRecoverableError;
              for (var i = 0; i < recoverableErrors.length; i++) {
                var recoverableError = recoverableErrors[i];
                var componentStack = recoverableError.stack;
                var digest = recoverableError.digest;
                onRecoverableError(recoverableError.value, {
                  componentStack,
                  digest
                });
              }
            }
            if (hasUncaughtError) {
              hasUncaughtError = false;
              var error$1 = firstUncaughtError;
              firstUncaughtError = null;
              throw error$1;
            }
            if (includesSomeLane(pendingPassiveEffectsLanes, SyncLane) && root.tag !== LegacyRoot) {
              flushPassiveEffects();
            }
            remainingLanes = root.pendingLanes;
            if (includesSomeLane(remainingLanes, SyncLane)) {
              {
                markNestedUpdateScheduled();
              }
              if (root === rootWithNestedUpdates) {
                nestedUpdateCount++;
              } else {
                nestedUpdateCount = 0;
                rootWithNestedUpdates = root;
              }
            } else {
              nestedUpdateCount = 0;
            }
            flushSyncCallbacks();
            {
              markCommitStopped();
            }
            return null;
          }
          function flushPassiveEffects() {
            if (rootWithPendingPassiveEffects !== null) {
              var renderPriority = lanesToEventPriority(pendingPassiveEffectsLanes);
              var priority = lowerEventPriority(DefaultEventPriority2, renderPriority);
              var prevTransition = ReactCurrentBatchConfig$2.transition;
              var previousPriority = getCurrentUpdatePriority();
              try {
                ReactCurrentBatchConfig$2.transition = null;
                setCurrentUpdatePriority(priority);
                return flushPassiveEffectsImpl();
              } finally {
                setCurrentUpdatePriority(previousPriority);
                ReactCurrentBatchConfig$2.transition = prevTransition;
              }
            }
            return false;
          }
          function enqueuePendingPassiveProfilerEffect(fiber) {
            {
              pendingPassiveProfilerEffects.push(fiber);
              if (!rootDoesHavePassiveEffects) {
                rootDoesHavePassiveEffects = true;
                scheduleCallback$1(NormalPriority, function() {
                  flushPassiveEffects();
                  return null;
                });
              }
            }
          }
          function flushPassiveEffectsImpl() {
            if (rootWithPendingPassiveEffects === null) {
              return false;
            }
            var transitions = pendingPassiveTransitions;
            pendingPassiveTransitions = null;
            var root = rootWithPendingPassiveEffects;
            var lanes = pendingPassiveEffectsLanes;
            rootWithPendingPassiveEffects = null;
            pendingPassiveEffectsLanes = NoLanes;
            if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
              throw new Error("Cannot flush passive effects while already rendering.");
            }
            {
              isFlushingPassiveEffects = true;
              didScheduleUpdateDuringPassiveEffects = false;
            }
            {
              markPassiveEffectsStarted(lanes);
            }
            var prevExecutionContext = executionContext;
            executionContext |= CommitContext;
            commitPassiveUnmountEffects(root.current);
            commitPassiveMountEffects(root, root.current, lanes, transitions);
            {
              var profilerEffects = pendingPassiveProfilerEffects;
              pendingPassiveProfilerEffects = [];
              for (var i = 0; i < profilerEffects.length; i++) {
                var _fiber = profilerEffects[i];
                commitPassiveEffectDurations(root, _fiber);
              }
            }
            {
              markPassiveEffectsStopped();
            }
            {
              commitDoubleInvokeEffectsInDEV(root.current, true);
            }
            executionContext = prevExecutionContext;
            flushSyncCallbacks();
            {
              if (didScheduleUpdateDuringPassiveEffects) {
                if (root === rootWithPassiveNestedUpdates) {
                  nestedPassiveUpdateCount++;
                } else {
                  nestedPassiveUpdateCount = 0;
                  rootWithPassiveNestedUpdates = root;
                }
              } else {
                nestedPassiveUpdateCount = 0;
              }
              isFlushingPassiveEffects = false;
              didScheduleUpdateDuringPassiveEffects = false;
            }
            onPostCommitRoot(root);
            {
              var stateNode = root.current.stateNode;
              stateNode.effectDuration = 0;
              stateNode.passiveEffectDuration = 0;
            }
            return true;
          }
          function isAlreadyFailedLegacyErrorBoundary(instance) {
            return legacyErrorBoundariesThatAlreadyFailed !== null && legacyErrorBoundariesThatAlreadyFailed.has(instance);
          }
          function markLegacyErrorBoundaryAsFailed(instance) {
            if (legacyErrorBoundariesThatAlreadyFailed === null) {
              legacyErrorBoundariesThatAlreadyFailed = /* @__PURE__ */ new Set([instance]);
            } else {
              legacyErrorBoundariesThatAlreadyFailed.add(instance);
            }
          }
          function prepareToThrowUncaughtError(error2) {
            if (!hasUncaughtError) {
              hasUncaughtError = true;
              firstUncaughtError = error2;
            }
          }
          var onUncaughtError = prepareToThrowUncaughtError;
          function captureCommitPhaseErrorOnRoot(rootFiber, sourceFiber, error2) {
            var errorInfo = createCapturedValueAtFiber(error2, sourceFiber);
            var update = createRootErrorUpdate(rootFiber, errorInfo, SyncLane);
            var root = enqueueUpdate(rootFiber, update, SyncLane);
            var eventTime = requestEventTime();
            if (root !== null) {
              markRootUpdated(root, SyncLane, eventTime);
              ensureRootIsScheduled(root, eventTime);
            }
          }
          function captureCommitPhaseError(sourceFiber, nearestMountedAncestor, error$1) {
            {
              reportUncaughtErrorInDEV(error$1);
              setIsRunningInsertionEffect(false);
            }
            if (sourceFiber.tag === HostRoot) {
              captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error$1);
              return;
            }
            var fiber = null;
            {
              fiber = nearestMountedAncestor;
            }
            while (fiber !== null) {
              if (fiber.tag === HostRoot) {
                captureCommitPhaseErrorOnRoot(fiber, sourceFiber, error$1);
                return;
              } else if (fiber.tag === ClassComponent) {
                var ctor = fiber.type;
                var instance = fiber.stateNode;
                if (typeof ctor.getDerivedStateFromError === "function" || typeof instance.componentDidCatch === "function" && !isAlreadyFailedLegacyErrorBoundary(instance)) {
                  var errorInfo = createCapturedValueAtFiber(error$1, sourceFiber);
                  var update = createClassErrorUpdate(fiber, errorInfo, SyncLane);
                  var root = enqueueUpdate(fiber, update, SyncLane);
                  var eventTime = requestEventTime();
                  if (root !== null) {
                    markRootUpdated(root, SyncLane, eventTime);
                    ensureRootIsScheduled(root, eventTime);
                  }
                  return;
                }
              }
              fiber = fiber.return;
            }
            {
              error("Internal React error: Attempted to capture a commit phase error inside a detached tree. This indicates a bug in React. Likely causes include deleting the same fiber more than once, committing an already-finished tree, or an inconsistent return pointer.\n\nError message:\n\n%s", error$1);
            }
          }
          function pingSuspendedRoot(root, wakeable, pingedLanes) {
            var pingCache = root.pingCache;
            if (pingCache !== null) {
              pingCache.delete(wakeable);
            }
            var eventTime = requestEventTime();
            markRootPinged(root, pingedLanes);
            warnIfSuspenseResolutionNotWrappedWithActDEV(root);
            if (workInProgressRoot === root && isSubsetOfLanes(workInProgressRootRenderLanes, pingedLanes)) {
              if (workInProgressRootExitStatus === RootSuspendedWithDelay || workInProgressRootExitStatus === RootSuspended && includesOnlyRetries(workInProgressRootRenderLanes) && now() - globalMostRecentFallbackTime < FALLBACK_THROTTLE_MS) {
                prepareFreshStack(root, NoLanes);
              } else {
                workInProgressRootPingedLanes = mergeLanes(workInProgressRootPingedLanes, pingedLanes);
              }
            }
            ensureRootIsScheduled(root, eventTime);
          }
          function retryTimedOutBoundary(boundaryFiber, retryLane) {
            if (retryLane === NoLane) {
              retryLane = requestRetryLane(boundaryFiber);
            }
            var eventTime = requestEventTime();
            var root = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
            if (root !== null) {
              markRootUpdated(root, retryLane, eventTime);
              ensureRootIsScheduled(root, eventTime);
            }
          }
          function retryDehydratedSuspenseBoundary(boundaryFiber) {
            var suspenseState = boundaryFiber.memoizedState;
            var retryLane = NoLane;
            if (suspenseState !== null) {
              retryLane = suspenseState.retryLane;
            }
            retryTimedOutBoundary(boundaryFiber, retryLane);
          }
          function resolveRetryWakeable(boundaryFiber, wakeable) {
            var retryLane = NoLane;
            var retryCache;
            switch (boundaryFiber.tag) {
              case SuspenseComponent:
                retryCache = boundaryFiber.stateNode;
                var suspenseState = boundaryFiber.memoizedState;
                if (suspenseState !== null) {
                  retryLane = suspenseState.retryLane;
                }
                break;
              case SuspenseListComponent:
                retryCache = boundaryFiber.stateNode;
                break;
              default:
                throw new Error("Pinged unknown suspense boundary type. This is probably a bug in React.");
            }
            if (retryCache !== null) {
              retryCache.delete(wakeable);
            }
            retryTimedOutBoundary(boundaryFiber, retryLane);
          }
          function jnd(timeElapsed) {
            return timeElapsed < 120 ? 120 : timeElapsed < 480 ? 480 : timeElapsed < 1080 ? 1080 : timeElapsed < 1920 ? 1920 : timeElapsed < 3e3 ? 3e3 : timeElapsed < 4320 ? 4320 : ceil(timeElapsed / 1960) * 1960;
          }
          function checkForNestedUpdates() {
            if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
              nestedUpdateCount = 0;
              rootWithNestedUpdates = null;
              throw new Error("Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.");
            }
            {
              if (nestedPassiveUpdateCount > NESTED_PASSIVE_UPDATE_LIMIT) {
                nestedPassiveUpdateCount = 0;
                rootWithPassiveNestedUpdates = null;
                error("Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.");
              }
            }
          }
          function flushRenderPhaseStrictModeWarningsInDEV() {
            {
              ReactStrictModeWarnings.flushLegacyContextWarning();
              {
                ReactStrictModeWarnings.flushPendingUnsafeLifecycleWarnings();
              }
            }
          }
          function commitDoubleInvokeEffectsInDEV(fiber, hasPassiveEffects) {
            {
              setCurrentFiber(fiber);
              invokeEffectsInDev(fiber, MountLayoutDev, invokeLayoutEffectUnmountInDEV);
              if (hasPassiveEffects) {
                invokeEffectsInDev(fiber, MountPassiveDev, invokePassiveEffectUnmountInDEV);
              }
              invokeEffectsInDev(fiber, MountLayoutDev, invokeLayoutEffectMountInDEV);
              if (hasPassiveEffects) {
                invokeEffectsInDev(fiber, MountPassiveDev, invokePassiveEffectMountInDEV);
              }
              resetCurrentFiber();
            }
          }
          function invokeEffectsInDev(firstChild, fiberFlags, invokeEffectFn) {
            {
              var current2 = firstChild;
              var subtreeRoot = null;
              while (current2 !== null) {
                var primarySubtreeFlag = current2.subtreeFlags & fiberFlags;
                if (current2 !== subtreeRoot && current2.child !== null && primarySubtreeFlag !== NoFlags) {
                  current2 = current2.child;
                } else {
                  if ((current2.flags & fiberFlags) !== NoFlags) {
                    invokeEffectFn(current2);
                  }
                  if (current2.sibling !== null) {
                    current2 = current2.sibling;
                  } else {
                    current2 = subtreeRoot = current2.return;
                  }
                }
              }
            }
          }
          var didWarnStateUpdateForNotYetMountedComponent = null;
          function warnAboutUpdateOnNotYetMountedFiberInDEV(fiber) {
            {
              if ((executionContext & RenderContext) !== NoContext) {
                return;
              }
              if (!(fiber.mode & ConcurrentMode)) {
                return;
              }
              var tag = fiber.tag;
              if (tag !== IndeterminateComponent && tag !== HostRoot && tag !== ClassComponent && tag !== FunctionComponent && tag !== ForwardRef && tag !== MemoComponent && tag !== SimpleMemoComponent) {
                return;
              }
              var componentName = getComponentNameFromFiber(fiber) || "ReactComponent";
              if (didWarnStateUpdateForNotYetMountedComponent !== null) {
                if (didWarnStateUpdateForNotYetMountedComponent.has(componentName)) {
                  return;
                }
                didWarnStateUpdateForNotYetMountedComponent.add(componentName);
              } else {
                didWarnStateUpdateForNotYetMountedComponent = /* @__PURE__ */ new Set([componentName]);
              }
              var previousFiber = current;
              try {
                setCurrentFiber(fiber);
                error("Can't perform a React state update on a component that hasn't mounted yet. This indicates that you have a side-effect in your render function that asynchronously later calls tries to update the component. Move this work to useEffect instead.");
              } finally {
                if (previousFiber) {
                  setCurrentFiber(fiber);
                } else {
                  resetCurrentFiber();
                }
              }
            }
          }
          var beginWork$1;
          {
            var dummyFiber = null;
            beginWork$1 = function(current2, unitOfWork, lanes) {
              var originalWorkInProgressCopy = assignFiberPropertiesInDEV(dummyFiber, unitOfWork);
              try {
                return beginWork(current2, unitOfWork, lanes);
              } catch (originalError) {
                if (didSuspendOrErrorWhileHydratingDEV() || originalError !== null && typeof originalError === "object" && typeof originalError.then === "function") {
                  throw originalError;
                }
                resetContextDependencies();
                resetHooksAfterThrow();
                unwindInterruptedWork(current2, unitOfWork);
                assignFiberPropertiesInDEV(unitOfWork, originalWorkInProgressCopy);
                if (unitOfWork.mode & ProfileMode) {
                  startProfilerTimer(unitOfWork);
                }
                invokeGuardedCallback(null, beginWork, null, current2, unitOfWork, lanes);
                if (hasCaughtError()) {
                  var replayError = clearCaughtError();
                  if (typeof replayError === "object" && replayError !== null && replayError._suppressLogging && typeof originalError === "object" && originalError !== null && !originalError._suppressLogging) {
                    originalError._suppressLogging = true;
                  }
                }
                throw originalError;
              }
            };
          }
          var didWarnAboutUpdateInRender = false;
          var didWarnAboutUpdateInRenderForAnotherComponent;
          {
            didWarnAboutUpdateInRenderForAnotherComponent = /* @__PURE__ */ new Set();
          }
          function warnAboutRenderPhaseUpdatesInDEV(fiber) {
            {
              if (isRendering && !getIsUpdatingOpaqueValueInRenderPhaseInDEV()) {
                switch (fiber.tag) {
                  case FunctionComponent:
                  case ForwardRef:
                  case SimpleMemoComponent: {
                    var renderingComponentName = workInProgress && getComponentNameFromFiber(workInProgress) || "Unknown";
                    var dedupeKey = renderingComponentName;
                    if (!didWarnAboutUpdateInRenderForAnotherComponent.has(dedupeKey)) {
                      didWarnAboutUpdateInRenderForAnotherComponent.add(dedupeKey);
                      var setStateComponentName = getComponentNameFromFiber(fiber) || "Unknown";
                      error("Cannot update a component (`%s`) while rendering a different component (`%s`). To locate the bad setState() call inside `%s`, follow the stack trace as described in https://reactjs.org/link/setstate-in-render", setStateComponentName, renderingComponentName, renderingComponentName);
                    }
                    break;
                  }
                  case ClassComponent: {
                    if (!didWarnAboutUpdateInRender) {
                      error("Cannot update during an existing state transition (such as within `render`). Render methods should be a pure function of props and state.");
                      didWarnAboutUpdateInRender = true;
                    }
                    break;
                  }
                }
              }
            }
          }
          function restorePendingUpdaters(root, lanes) {
            {
              if (isDevToolsPresent) {
                var memoizedUpdaters = root.memoizedUpdaters;
                memoizedUpdaters.forEach(function(schedulingFiber) {
                  addFiberToLanesMap(root, schedulingFiber, lanes);
                });
              }
            }
          }
          var fakeActCallbackNode = {};
          function scheduleCallback$1(priorityLevel, callback) {
            {
              var actQueue = ReactCurrentActQueue$1.current;
              if (actQueue !== null) {
                actQueue.push(callback);
                return fakeActCallbackNode;
              } else {
                return scheduleCallback(priorityLevel, callback);
              }
            }
          }
          function cancelCallback$1(callbackNode) {
            if (callbackNode === fakeActCallbackNode) {
              return;
            }
            return cancelCallback(callbackNode);
          }
          function shouldForceFlushFallbacksInDEV() {
            return ReactCurrentActQueue$1.current !== null;
          }
          function warnIfUpdatesNotWrappedWithActDEV(fiber) {
            {
              if (fiber.mode & ConcurrentMode) {
                if (!isConcurrentActEnvironment()) {
                  return;
                }
              } else {
                if (!isLegacyActEnvironment()) {
                  return;
                }
                if (executionContext !== NoContext) {
                  return;
                }
                if (fiber.tag !== FunctionComponent && fiber.tag !== ForwardRef && fiber.tag !== SimpleMemoComponent) {
                  return;
                }
              }
              if (ReactCurrentActQueue$1.current === null) {
                var previousFiber = current;
                try {
                  setCurrentFiber(fiber);
                  error("An update to %s inside a test was not wrapped in act(...).\n\nWhen testing, code that causes React state updates should be wrapped into act(...):\n\nact(() => {\n  /* fire events that update state */\n});\n/* assert on the output */\n\nThis ensures that you're testing the behavior the user would see in the browser. Learn more at https://reactjs.org/link/wrap-tests-with-act", getComponentNameFromFiber(fiber));
                } finally {
                  if (previousFiber) {
                    setCurrentFiber(fiber);
                  } else {
                    resetCurrentFiber();
                  }
                }
              }
            }
          }
          function warnIfSuspenseResolutionNotWrappedWithActDEV(root) {
            {
              if (root.tag !== LegacyRoot && isConcurrentActEnvironment() && ReactCurrentActQueue$1.current === null) {
                error("A suspended resource finished loading inside a test, but the event was not wrapped in act(...).\n\nWhen testing, code that resolves suspended data should be wrapped into act(...):\n\nact(() => {\n  /* finish loading suspended data */\n});\n/* assert on the output */\n\nThis ensures that you're testing the behavior the user would see in the browser. Learn more at https://reactjs.org/link/wrap-tests-with-act");
              }
            }
          }
          function setIsRunningInsertionEffect(isRunning) {
            {
              isRunningInsertionEffect = isRunning;
            }
          }
          var resolveFamily = null;
          var failedBoundaries = null;
          var setRefreshHandler = function(handler) {
            {
              resolveFamily = handler;
            }
          };
          function resolveFunctionForHotReloading(type) {
            {
              if (resolveFamily === null) {
                return type;
              }
              var family = resolveFamily(type);
              if (family === void 0) {
                return type;
              }
              return family.current;
            }
          }
          function resolveClassForHotReloading(type) {
            return resolveFunctionForHotReloading(type);
          }
          function resolveForwardRefForHotReloading(type) {
            {
              if (resolveFamily === null) {
                return type;
              }
              var family = resolveFamily(type);
              if (family === void 0) {
                if (type !== null && type !== void 0 && typeof type.render === "function") {
                  var currentRender = resolveFunctionForHotReloading(type.render);
                  if (type.render !== currentRender) {
                    var syntheticType = {
                      $$typeof: REACT_FORWARD_REF_TYPE,
                      render: currentRender
                    };
                    if (type.displayName !== void 0) {
                      syntheticType.displayName = type.displayName;
                    }
                    return syntheticType;
                  }
                }
                return type;
              }
              return family.current;
            }
          }
          function isCompatibleFamilyForHotReloading(fiber, element) {
            {
              if (resolveFamily === null) {
                return false;
              }
              var prevType = fiber.elementType;
              var nextType = element.type;
              var needsCompareFamilies = false;
              var $$typeofNextType = typeof nextType === "object" && nextType !== null ? nextType.$$typeof : null;
              switch (fiber.tag) {
                case ClassComponent: {
                  if (typeof nextType === "function") {
                    needsCompareFamilies = true;
                  }
                  break;
                }
                case FunctionComponent: {
                  if (typeof nextType === "function") {
                    needsCompareFamilies = true;
                  } else if ($$typeofNextType === REACT_LAZY_TYPE) {
                    needsCompareFamilies = true;
                  }
                  break;
                }
                case ForwardRef: {
                  if ($$typeofNextType === REACT_FORWARD_REF_TYPE) {
                    needsCompareFamilies = true;
                  } else if ($$typeofNextType === REACT_LAZY_TYPE) {
                    needsCompareFamilies = true;
                  }
                  break;
                }
                case MemoComponent:
                case SimpleMemoComponent: {
                  if ($$typeofNextType === REACT_MEMO_TYPE) {
                    needsCompareFamilies = true;
                  } else if ($$typeofNextType === REACT_LAZY_TYPE) {
                    needsCompareFamilies = true;
                  }
                  break;
                }
                default:
                  return false;
              }
              if (needsCompareFamilies) {
                var prevFamily = resolveFamily(prevType);
                if (prevFamily !== void 0 && prevFamily === resolveFamily(nextType)) {
                  return true;
                }
              }
              return false;
            }
          }
          function markFailedErrorBoundaryForHotReloading(fiber) {
            {
              if (resolveFamily === null) {
                return;
              }
              if (typeof WeakSet !== "function") {
                return;
              }
              if (failedBoundaries === null) {
                failedBoundaries = /* @__PURE__ */ new WeakSet();
              }
              failedBoundaries.add(fiber);
            }
          }
          var scheduleRefresh = function(root, update) {
            {
              if (resolveFamily === null) {
                return;
              }
              var staleFamilies = update.staleFamilies, updatedFamilies = update.updatedFamilies;
              flushPassiveEffects();
              flushSync(function() {
                scheduleFibersWithFamiliesRecursively(root.current, updatedFamilies, staleFamilies);
              });
            }
          };
          var scheduleRoot = function(root, element) {
            {
              if (root.context !== emptyContextObject) {
                return;
              }
              flushPassiveEffects();
              flushSync(function() {
                updateContainer(element, root, null, null);
              });
            }
          };
          function scheduleFibersWithFamiliesRecursively(fiber, updatedFamilies, staleFamilies) {
            {
              var alternate = fiber.alternate, child = fiber.child, sibling = fiber.sibling, tag = fiber.tag, type = fiber.type;
              var candidateType = null;
              switch (tag) {
                case FunctionComponent:
                case SimpleMemoComponent:
                case ClassComponent:
                  candidateType = type;
                  break;
                case ForwardRef:
                  candidateType = type.render;
                  break;
              }
              if (resolveFamily === null) {
                throw new Error("Expected resolveFamily to be set during hot reload.");
              }
              var needsRender = false;
              var needsRemount = false;
              if (candidateType !== null) {
                var family = resolveFamily(candidateType);
                if (family !== void 0) {
                  if (staleFamilies.has(family)) {
                    needsRemount = true;
                  } else if (updatedFamilies.has(family)) {
                    if (tag === ClassComponent) {
                      needsRemount = true;
                    } else {
                      needsRender = true;
                    }
                  }
                }
              }
              if (failedBoundaries !== null) {
                if (failedBoundaries.has(fiber) || alternate !== null && failedBoundaries.has(alternate)) {
                  needsRemount = true;
                }
              }
              if (needsRemount) {
                fiber._debugNeedsRemount = true;
              }
              if (needsRemount || needsRender) {
                var _root = enqueueConcurrentRenderForLane(fiber, SyncLane);
                if (_root !== null) {
                  scheduleUpdateOnFiber(_root, fiber, SyncLane, NoTimestamp);
                }
              }
              if (child !== null && !needsRemount) {
                scheduleFibersWithFamiliesRecursively(child, updatedFamilies, staleFamilies);
              }
              if (sibling !== null) {
                scheduleFibersWithFamiliesRecursively(sibling, updatedFamilies, staleFamilies);
              }
            }
          }
          var findHostInstancesForRefresh = function(root, families) {
            {
              var hostInstances = /* @__PURE__ */ new Set();
              var types = new Set(families.map(function(family) {
                return family.current;
              }));
              findHostInstancesForMatchingFibersRecursively(root.current, types, hostInstances);
              return hostInstances;
            }
          };
          function findHostInstancesForMatchingFibersRecursively(fiber, types, hostInstances) {
            {
              var child = fiber.child, sibling = fiber.sibling, tag = fiber.tag, type = fiber.type;
              var candidateType = null;
              switch (tag) {
                case FunctionComponent:
                case SimpleMemoComponent:
                case ClassComponent:
                  candidateType = type;
                  break;
                case ForwardRef:
                  candidateType = type.render;
                  break;
              }
              var didMatch = false;
              if (candidateType !== null) {
                if (types.has(candidateType)) {
                  didMatch = true;
                }
              }
              if (didMatch) {
                findHostInstancesForFiberShallowly(fiber, hostInstances);
              } else {
                if (child !== null) {
                  findHostInstancesForMatchingFibersRecursively(child, types, hostInstances);
                }
              }
              if (sibling !== null) {
                findHostInstancesForMatchingFibersRecursively(sibling, types, hostInstances);
              }
            }
          }
          function findHostInstancesForFiberShallowly(fiber, hostInstances) {
            {
              var foundHostInstances = findChildHostInstancesForFiberShallowly(fiber, hostInstances);
              if (foundHostInstances) {
                return;
              }
              var node = fiber;
              while (true) {
                switch (node.tag) {
                  case HostComponent:
                    hostInstances.add(node.stateNode);
                    return;
                  case HostPortal:
                    hostInstances.add(node.stateNode.containerInfo);
                    return;
                  case HostRoot:
                    hostInstances.add(node.stateNode.containerInfo);
                    return;
                }
                if (node.return === null) {
                  throw new Error("Expected to reach root first.");
                }
                node = node.return;
              }
            }
          }
          function findChildHostInstancesForFiberShallowly(fiber, hostInstances) {
            {
              var node = fiber;
              var foundHostInstances = false;
              while (true) {
                if (node.tag === HostComponent) {
                  foundHostInstances = true;
                  hostInstances.add(node.stateNode);
                } else if (node.child !== null) {
                  node.child.return = node;
                  node = node.child;
                  continue;
                }
                if (node === fiber) {
                  return foundHostInstances;
                }
                while (node.sibling === null) {
                  if (node.return === null || node.return === fiber) {
                    return foundHostInstances;
                  }
                  node = node.return;
                }
                node.sibling.return = node.return;
                node = node.sibling;
              }
            }
            return false;
          }
          var hasBadMapPolyfill;
          {
            hasBadMapPolyfill = false;
            try {
              var nonExtensibleObject = Object.preventExtensions({});
              /* @__PURE__ */ new Map([[nonExtensibleObject, null]]);
              /* @__PURE__ */ new Set([nonExtensibleObject]);
            } catch (e) {
              hasBadMapPolyfill = true;
            }
          }
          function FiberNode(tag, pendingProps, key, mode) {
            this.tag = tag;
            this.key = key;
            this.elementType = null;
            this.type = null;
            this.stateNode = null;
            this.return = null;
            this.child = null;
            this.sibling = null;
            this.index = 0;
            this.ref = null;
            this.pendingProps = pendingProps;
            this.memoizedProps = null;
            this.updateQueue = null;
            this.memoizedState = null;
            this.dependencies = null;
            this.mode = mode;
            this.flags = NoFlags;
            this.subtreeFlags = NoFlags;
            this.deletions = null;
            this.lanes = NoLanes;
            this.childLanes = NoLanes;
            this.alternate = null;
            {
              this.actualDuration = Number.NaN;
              this.actualStartTime = Number.NaN;
              this.selfBaseDuration = Number.NaN;
              this.treeBaseDuration = Number.NaN;
              this.actualDuration = 0;
              this.actualStartTime = -1;
              this.selfBaseDuration = 0;
              this.treeBaseDuration = 0;
            }
            {
              this._debugSource = null;
              this._debugOwner = null;
              this._debugNeedsRemount = false;
              this._debugHookTypes = null;
              if (!hasBadMapPolyfill && typeof Object.preventExtensions === "function") {
                Object.preventExtensions(this);
              }
            }
          }
          var createFiber = function(tag, pendingProps, key, mode) {
            return new FiberNode(tag, pendingProps, key, mode);
          };
          function shouldConstruct$1(Component) {
            var prototype = Component.prototype;
            return !!(prototype && prototype.isReactComponent);
          }
          function isSimpleFunctionComponent(type) {
            return typeof type === "function" && !shouldConstruct$1(type) && type.defaultProps === void 0;
          }
          function resolveLazyComponentTag(Component) {
            if (typeof Component === "function") {
              return shouldConstruct$1(Component) ? ClassComponent : FunctionComponent;
            } else if (Component !== void 0 && Component !== null) {
              var $$typeof = Component.$$typeof;
              if ($$typeof === REACT_FORWARD_REF_TYPE) {
                return ForwardRef;
              }
              if ($$typeof === REACT_MEMO_TYPE) {
                return MemoComponent;
              }
            }
            return IndeterminateComponent;
          }
          function createWorkInProgress(current2, pendingProps) {
            var workInProgress2 = current2.alternate;
            if (workInProgress2 === null) {
              workInProgress2 = createFiber(current2.tag, pendingProps, current2.key, current2.mode);
              workInProgress2.elementType = current2.elementType;
              workInProgress2.type = current2.type;
              workInProgress2.stateNode = current2.stateNode;
              {
                workInProgress2._debugSource = current2._debugSource;
                workInProgress2._debugOwner = current2._debugOwner;
                workInProgress2._debugHookTypes = current2._debugHookTypes;
              }
              workInProgress2.alternate = current2;
              current2.alternate = workInProgress2;
            } else {
              workInProgress2.pendingProps = pendingProps;
              workInProgress2.type = current2.type;
              workInProgress2.flags = NoFlags;
              workInProgress2.subtreeFlags = NoFlags;
              workInProgress2.deletions = null;
              {
                workInProgress2.actualDuration = 0;
                workInProgress2.actualStartTime = -1;
              }
            }
            workInProgress2.flags = current2.flags & StaticMask;
            workInProgress2.childLanes = current2.childLanes;
            workInProgress2.lanes = current2.lanes;
            workInProgress2.child = current2.child;
            workInProgress2.memoizedProps = current2.memoizedProps;
            workInProgress2.memoizedState = current2.memoizedState;
            workInProgress2.updateQueue = current2.updateQueue;
            var currentDependencies = current2.dependencies;
            workInProgress2.dependencies = currentDependencies === null ? null : {
              lanes: currentDependencies.lanes,
              firstContext: currentDependencies.firstContext
            };
            workInProgress2.sibling = current2.sibling;
            workInProgress2.index = current2.index;
            workInProgress2.ref = current2.ref;
            {
              workInProgress2.selfBaseDuration = current2.selfBaseDuration;
              workInProgress2.treeBaseDuration = current2.treeBaseDuration;
            }
            {
              workInProgress2._debugNeedsRemount = current2._debugNeedsRemount;
              switch (workInProgress2.tag) {
                case IndeterminateComponent:
                case FunctionComponent:
                case SimpleMemoComponent:
                  workInProgress2.type = resolveFunctionForHotReloading(current2.type);
                  break;
                case ClassComponent:
                  workInProgress2.type = resolveClassForHotReloading(current2.type);
                  break;
                case ForwardRef:
                  workInProgress2.type = resolveForwardRefForHotReloading(current2.type);
                  break;
              }
            }
            return workInProgress2;
          }
          function resetWorkInProgress(workInProgress2, renderLanes2) {
            workInProgress2.flags &= StaticMask | Placement;
            var current2 = workInProgress2.alternate;
            if (current2 === null) {
              workInProgress2.childLanes = NoLanes;
              workInProgress2.lanes = renderLanes2;
              workInProgress2.child = null;
              workInProgress2.subtreeFlags = NoFlags;
              workInProgress2.memoizedProps = null;
              workInProgress2.memoizedState = null;
              workInProgress2.updateQueue = null;
              workInProgress2.dependencies = null;
              workInProgress2.stateNode = null;
              {
                workInProgress2.selfBaseDuration = 0;
                workInProgress2.treeBaseDuration = 0;
              }
            } else {
              workInProgress2.childLanes = current2.childLanes;
              workInProgress2.lanes = current2.lanes;
              workInProgress2.child = current2.child;
              workInProgress2.subtreeFlags = NoFlags;
              workInProgress2.deletions = null;
              workInProgress2.memoizedProps = current2.memoizedProps;
              workInProgress2.memoizedState = current2.memoizedState;
              workInProgress2.updateQueue = current2.updateQueue;
              workInProgress2.type = current2.type;
              var currentDependencies = current2.dependencies;
              workInProgress2.dependencies = currentDependencies === null ? null : {
                lanes: currentDependencies.lanes,
                firstContext: currentDependencies.firstContext
              };
              {
                workInProgress2.selfBaseDuration = current2.selfBaseDuration;
                workInProgress2.treeBaseDuration = current2.treeBaseDuration;
              }
            }
            return workInProgress2;
          }
          function createHostRootFiber(tag, isStrictMode, concurrentUpdatesByDefaultOverride) {
            var mode;
            if (tag === ConcurrentRoot) {
              mode = ConcurrentMode;
              if (isStrictMode === true) {
                mode |= StrictLegacyMode;
                {
                  mode |= StrictEffectsMode;
                }
              }
            } else {
              mode = NoMode;
            }
            if (isDevToolsPresent) {
              mode |= ProfileMode;
            }
            return createFiber(HostRoot, null, null, mode);
          }
          function createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes) {
            var fiberTag = IndeterminateComponent;
            var resolvedType = type;
            if (typeof type === "function") {
              if (shouldConstruct$1(type)) {
                fiberTag = ClassComponent;
                {
                  resolvedType = resolveClassForHotReloading(resolvedType);
                }
              } else {
                {
                  resolvedType = resolveFunctionForHotReloading(resolvedType);
                }
              }
            } else if (typeof type === "string") {
              fiberTag = HostComponent;
            } else {
              getTag: switch (type) {
                case REACT_FRAGMENT_TYPE:
                  return createFiberFromFragment(pendingProps.children, mode, lanes, key);
                case REACT_STRICT_MODE_TYPE:
                  fiberTag = Mode;
                  mode |= StrictLegacyMode;
                  if ((mode & ConcurrentMode) !== NoMode) {
                    mode |= StrictEffectsMode;
                  }
                  break;
                case REACT_PROFILER_TYPE:
                  return createFiberFromProfiler(pendingProps, mode, lanes, key);
                case REACT_SUSPENSE_TYPE:
                  return createFiberFromSuspense(pendingProps, mode, lanes, key);
                case REACT_SUSPENSE_LIST_TYPE:
                  return createFiberFromSuspenseList(pendingProps, mode, lanes, key);
                case REACT_OFFSCREEN_TYPE:
                  return createFiberFromOffscreen(pendingProps, mode, lanes, key);
                case REACT_LEGACY_HIDDEN_TYPE:
                // eslint-disable-next-line no-fallthrough
                case REACT_SCOPE_TYPE:
                // eslint-disable-next-line no-fallthrough
                case REACT_CACHE_TYPE:
                // eslint-disable-next-line no-fallthrough
                case REACT_TRACING_MARKER_TYPE:
                // eslint-disable-next-line no-fallthrough
                case REACT_DEBUG_TRACING_MODE_TYPE:
                // eslint-disable-next-line no-fallthrough
                default: {
                  if (typeof type === "object" && type !== null) {
                    switch (type.$$typeof) {
                      case REACT_PROVIDER_TYPE:
                        fiberTag = ContextProvider;
                        break getTag;
                      case REACT_CONTEXT_TYPE:
                        fiberTag = ContextConsumer;
                        break getTag;
                      case REACT_FORWARD_REF_TYPE:
                        fiberTag = ForwardRef;
                        {
                          resolvedType = resolveForwardRefForHotReloading(resolvedType);
                        }
                        break getTag;
                      case REACT_MEMO_TYPE:
                        fiberTag = MemoComponent;
                        break getTag;
                      case REACT_LAZY_TYPE:
                        fiberTag = LazyComponent;
                        resolvedType = null;
                        break getTag;
                    }
                  }
                  var info = "";
                  {
                    if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
                      info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
                    }
                    var ownerName = owner ? getComponentNameFromFiber(owner) : null;
                    if (ownerName) {
                      info += "\n\nCheck the render method of `" + ownerName + "`.";
                    }
                  }
                  throw new Error("Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) " + ("but got: " + (type == null ? type : typeof type) + "." + info));
                }
              }
            }
            var fiber = createFiber(fiberTag, pendingProps, key, mode);
            fiber.elementType = type;
            fiber.type = resolvedType;
            fiber.lanes = lanes;
            {
              fiber._debugOwner = owner;
            }
            return fiber;
          }
          function createFiberFromElement(element, mode, lanes) {
            var owner = null;
            {
              owner = element._owner;
            }
            var type = element.type;
            var key = element.key;
            var pendingProps = element.props;
            var fiber = createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes);
            {
              fiber._debugSource = element._source;
              fiber._debugOwner = element._owner;
            }
            return fiber;
          }
          function createFiberFromFragment(elements, mode, lanes, key) {
            var fiber = createFiber(Fragment2, elements, key, mode);
            fiber.lanes = lanes;
            return fiber;
          }
          function createFiberFromProfiler(pendingProps, mode, lanes, key) {
            {
              if (typeof pendingProps.id !== "string") {
                error('Profiler must specify an "id" of type `string` as a prop. Received the type `%s` instead.', typeof pendingProps.id);
              }
            }
            var fiber = createFiber(Profiler, pendingProps, key, mode | ProfileMode);
            fiber.elementType = REACT_PROFILER_TYPE;
            fiber.lanes = lanes;
            {
              fiber.stateNode = {
                effectDuration: 0,
                passiveEffectDuration: 0
              };
            }
            return fiber;
          }
          function createFiberFromSuspense(pendingProps, mode, lanes, key) {
            var fiber = createFiber(SuspenseComponent, pendingProps, key, mode);
            fiber.elementType = REACT_SUSPENSE_TYPE;
            fiber.lanes = lanes;
            return fiber;
          }
          function createFiberFromSuspenseList(pendingProps, mode, lanes, key) {
            var fiber = createFiber(SuspenseListComponent, pendingProps, key, mode);
            fiber.elementType = REACT_SUSPENSE_LIST_TYPE;
            fiber.lanes = lanes;
            return fiber;
          }
          function createFiberFromOffscreen(pendingProps, mode, lanes, key) {
            var fiber = createFiber(OffscreenComponent, pendingProps, key, mode);
            fiber.elementType = REACT_OFFSCREEN_TYPE;
            fiber.lanes = lanes;
            var primaryChildInstance = {
              isHidden: false
            };
            fiber.stateNode = primaryChildInstance;
            return fiber;
          }
          function createFiberFromText(content, mode, lanes) {
            var fiber = createFiber(HostText, content, null, mode);
            fiber.lanes = lanes;
            return fiber;
          }
          function createFiberFromHostInstanceForDeletion() {
            var fiber = createFiber(HostComponent, null, null, NoMode);
            fiber.elementType = "DELETED";
            return fiber;
          }
          function createFiberFromDehydratedFragment(dehydratedNode) {
            var fiber = createFiber(DehydratedFragment, null, null, NoMode);
            fiber.stateNode = dehydratedNode;
            return fiber;
          }
          function createFiberFromPortal(portal, mode, lanes) {
            var pendingProps = portal.children !== null ? portal.children : [];
            var fiber = createFiber(HostPortal, pendingProps, portal.key, mode);
            fiber.lanes = lanes;
            fiber.stateNode = {
              containerInfo: portal.containerInfo,
              pendingChildren: null,
              // Used by persistent updates
              implementation: portal.implementation
            };
            return fiber;
          }
          function assignFiberPropertiesInDEV(target, source) {
            if (target === null) {
              target = createFiber(IndeterminateComponent, null, null, NoMode);
            }
            target.tag = source.tag;
            target.key = source.key;
            target.elementType = source.elementType;
            target.type = source.type;
            target.stateNode = source.stateNode;
            target.return = source.return;
            target.child = source.child;
            target.sibling = source.sibling;
            target.index = source.index;
            target.ref = source.ref;
            target.pendingProps = source.pendingProps;
            target.memoizedProps = source.memoizedProps;
            target.updateQueue = source.updateQueue;
            target.memoizedState = source.memoizedState;
            target.dependencies = source.dependencies;
            target.mode = source.mode;
            target.flags = source.flags;
            target.subtreeFlags = source.subtreeFlags;
            target.deletions = source.deletions;
            target.lanes = source.lanes;
            target.childLanes = source.childLanes;
            target.alternate = source.alternate;
            {
              target.actualDuration = source.actualDuration;
              target.actualStartTime = source.actualStartTime;
              target.selfBaseDuration = source.selfBaseDuration;
              target.treeBaseDuration = source.treeBaseDuration;
            }
            target._debugSource = source._debugSource;
            target._debugOwner = source._debugOwner;
            target._debugNeedsRemount = source._debugNeedsRemount;
            target._debugHookTypes = source._debugHookTypes;
            return target;
          }
          function FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onRecoverableError) {
            this.tag = tag;
            this.containerInfo = containerInfo;
            this.pendingChildren = null;
            this.current = null;
            this.pingCache = null;
            this.finishedWork = null;
            this.timeoutHandle = noTimeout;
            this.context = null;
            this.pendingContext = null;
            this.callbackNode = null;
            this.callbackPriority = NoLane;
            this.eventTimes = createLaneMap(NoLanes);
            this.expirationTimes = createLaneMap(NoTimestamp);
            this.pendingLanes = NoLanes;
            this.suspendedLanes = NoLanes;
            this.pingedLanes = NoLanes;
            this.expiredLanes = NoLanes;
            this.mutableReadLanes = NoLanes;
            this.finishedLanes = NoLanes;
            this.entangledLanes = NoLanes;
            this.entanglements = createLaneMap(NoLanes);
            this.identifierPrefix = identifierPrefix;
            this.onRecoverableError = onRecoverableError;
            if (supportsHydration) {
              this.mutableSourceEagerHydrationData = null;
            }
            {
              this.effectDuration = 0;
              this.passiveEffectDuration = 0;
            }
            {
              this.memoizedUpdaters = /* @__PURE__ */ new Set();
              var pendingUpdatersLaneMap = this.pendingUpdatersLaneMap = [];
              for (var _i = 0; _i < TotalLanes; _i++) {
                pendingUpdatersLaneMap.push(/* @__PURE__ */ new Set());
              }
            }
            {
              switch (tag) {
                case ConcurrentRoot:
                  this._debugRootType = hydrate ? "hydrateRoot()" : "createRoot()";
                  break;
                case LegacyRoot:
                  this._debugRootType = hydrate ? "hydrate()" : "render()";
                  break;
              }
            }
          }
          function createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, concurrentUpdatesByDefaultOverride, identifierPrefix, onRecoverableError, transitionCallbacks) {
            var root = new FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onRecoverableError);
            var uninitializedFiber = createHostRootFiber(tag, isStrictMode);
            root.current = uninitializedFiber;
            uninitializedFiber.stateNode = root;
            {
              var _initialState = {
                element: initialChildren,
                isDehydrated: hydrate,
                cache: null,
                // not enabled yet
                transitions: null,
                pendingSuspenseBoundaries: null
              };
              uninitializedFiber.memoizedState = _initialState;
            }
            initializeUpdateQueue(uninitializedFiber);
            return root;
          }
          var ReactVersion = "18.3.1";
          function createPortal(children, containerInfo, implementation) {
            var key = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : null;
            {
              checkKeyStringCoercion(key);
            }
            return {
              // This tag allow us to uniquely identify this as a React Portal
              $$typeof: REACT_PORTAL_TYPE,
              key: key == null ? null : "" + key,
              children,
              containerInfo,
              implementation
            };
          }
          var didWarnAboutNestedUpdates;
          var didWarnAboutFindNodeInStrictMode;
          {
            didWarnAboutNestedUpdates = false;
            didWarnAboutFindNodeInStrictMode = {};
          }
          function getContextForSubtree(parentComponent) {
            if (!parentComponent) {
              return emptyContextObject;
            }
            var fiber = get(parentComponent);
            var parentContext = findCurrentUnmaskedContext(fiber);
            if (fiber.tag === ClassComponent) {
              var Component = fiber.type;
              if (isContextProvider(Component)) {
                return processChildContext(fiber, Component, parentContext);
              }
            }
            return parentContext;
          }
          function findHostInstance(component) {
            var fiber = get(component);
            if (fiber === void 0) {
              if (typeof component.render === "function") {
                throw new Error("Unable to find node on an unmounted component.");
              } else {
                var keys = Object.keys(component).join(",");
                throw new Error("Argument appears to not be a ReactComponent. Keys: " + keys);
              }
            }
            var hostFiber = findCurrentHostFiber(fiber);
            if (hostFiber === null) {
              return null;
            }
            return hostFiber.stateNode;
          }
          function findHostInstanceWithWarning(component, methodName) {
            {
              var fiber = get(component);
              if (fiber === void 0) {
                if (typeof component.render === "function") {
                  throw new Error("Unable to find node on an unmounted component.");
                } else {
                  var keys = Object.keys(component).join(",");
                  throw new Error("Argument appears to not be a ReactComponent. Keys: " + keys);
                }
              }
              var hostFiber = findCurrentHostFiber(fiber);
              if (hostFiber === null) {
                return null;
              }
              if (hostFiber.mode & StrictLegacyMode) {
                var componentName = getComponentNameFromFiber(fiber) || "Component";
                if (!didWarnAboutFindNodeInStrictMode[componentName]) {
                  didWarnAboutFindNodeInStrictMode[componentName] = true;
                  var previousFiber = current;
                  try {
                    setCurrentFiber(hostFiber);
                    if (fiber.mode & StrictLegacyMode) {
                      error("%s is deprecated in StrictMode. %s was passed an instance of %s which is inside StrictMode. Instead, add a ref directly to the element you want to reference. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-find-node", methodName, methodName, componentName);
                    } else {
                      error("%s is deprecated in StrictMode. %s was passed an instance of %s which renders StrictMode children. Instead, add a ref directly to the element you want to reference. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-find-node", methodName, methodName, componentName);
                    }
                  } finally {
                    if (previousFiber) {
                      setCurrentFiber(previousFiber);
                    } else {
                      resetCurrentFiber();
                    }
                  }
                }
              }
              return hostFiber.stateNode;
            }
          }
          function createContainer(containerInfo, tag, hydrationCallbacks, isStrictMode, concurrentUpdatesByDefaultOverride, identifierPrefix, onRecoverableError, transitionCallbacks) {
            var hydrate = false;
            var initialChildren = null;
            return createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, concurrentUpdatesByDefaultOverride, identifierPrefix, onRecoverableError);
          }
          function createHydrationContainer(initialChildren, callback, containerInfo, tag, hydrationCallbacks, isStrictMode, concurrentUpdatesByDefaultOverride, identifierPrefix, onRecoverableError, transitionCallbacks) {
            var hydrate = true;
            var root = createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, concurrentUpdatesByDefaultOverride, identifierPrefix, onRecoverableError);
            root.context = getContextForSubtree(null);
            var current2 = root.current;
            var eventTime = requestEventTime();
            var lane = requestUpdateLane(current2);
            var update = createUpdate(eventTime, lane);
            update.callback = callback !== void 0 && callback !== null ? callback : null;
            enqueueUpdate(current2, update, lane);
            scheduleInitialHydrationOnRoot(root, lane, eventTime);
            return root;
          }
          function updateContainer(element, container, parentComponent, callback) {
            {
              onScheduleRoot(container, element);
            }
            var current$1 = container.current;
            var eventTime = requestEventTime();
            var lane = requestUpdateLane(current$1);
            {
              markRenderScheduled(lane);
            }
            var context = getContextForSubtree(parentComponent);
            if (container.context === null) {
              container.context = context;
            } else {
              container.pendingContext = context;
            }
            {
              if (isRendering && current !== null && !didWarnAboutNestedUpdates) {
                didWarnAboutNestedUpdates = true;
                error("Render methods should be a pure function of props and state; triggering nested component updates from render is not allowed. If necessary, trigger nested updates in componentDidUpdate.\n\nCheck the render method of %s.", getComponentNameFromFiber(current) || "Unknown");
              }
            }
            var update = createUpdate(eventTime, lane);
            update.payload = {
              element
            };
            callback = callback === void 0 ? null : callback;
            if (callback !== null) {
              {
                if (typeof callback !== "function") {
                  error("render(...): Expected the last optional `callback` argument to be a function. Instead received: %s.", callback);
                }
              }
              update.callback = callback;
            }
            var root = enqueueUpdate(current$1, update, lane);
            if (root !== null) {
              scheduleUpdateOnFiber(root, current$1, lane, eventTime);
              entangleTransitions(root, current$1, lane);
            }
            return lane;
          }
          function getPublicRootInstance(container) {
            var containerFiber = container.current;
            if (!containerFiber.child) {
              return null;
            }
            switch (containerFiber.child.tag) {
              case HostComponent:
                return getPublicInstance(containerFiber.child.stateNode);
              default:
                return containerFiber.child.stateNode;
            }
          }
          function attemptSynchronousHydration(fiber) {
            switch (fiber.tag) {
              case HostRoot: {
                var root = fiber.stateNode;
                if (isRootDehydrated(root)) {
                  var lanes = getHighestPriorityPendingLanes(root);
                  flushRoot(root, lanes);
                }
                break;
              }
              case SuspenseComponent: {
                flushSync(function() {
                  var root2 = enqueueConcurrentRenderForLane(fiber, SyncLane);
                  if (root2 !== null) {
                    var eventTime = requestEventTime();
                    scheduleUpdateOnFiber(root2, fiber, SyncLane, eventTime);
                  }
                });
                var retryLane = SyncLane;
                markRetryLaneIfNotHydrated(fiber, retryLane);
                break;
              }
            }
          }
          function markRetryLaneImpl(fiber, retryLane) {
            var suspenseState = fiber.memoizedState;
            if (suspenseState !== null && suspenseState.dehydrated !== null) {
              suspenseState.retryLane = higherPriorityLane(suspenseState.retryLane, retryLane);
            }
          }
          function markRetryLaneIfNotHydrated(fiber, retryLane) {
            markRetryLaneImpl(fiber, retryLane);
            var alternate = fiber.alternate;
            if (alternate) {
              markRetryLaneImpl(alternate, retryLane);
            }
          }
          function attemptDiscreteHydration(fiber) {
            if (fiber.tag !== SuspenseComponent) {
              return;
            }
            var lane = SyncLane;
            var root = enqueueConcurrentRenderForLane(fiber, lane);
            if (root !== null) {
              var eventTime = requestEventTime();
              scheduleUpdateOnFiber(root, fiber, lane, eventTime);
            }
            markRetryLaneIfNotHydrated(fiber, lane);
          }
          function attemptContinuousHydration(fiber) {
            if (fiber.tag !== SuspenseComponent) {
              return;
            }
            var lane = SelectiveHydrationLane;
            var root = enqueueConcurrentRenderForLane(fiber, lane);
            if (root !== null) {
              var eventTime = requestEventTime();
              scheduleUpdateOnFiber(root, fiber, lane, eventTime);
            }
            markRetryLaneIfNotHydrated(fiber, lane);
          }
          function attemptHydrationAtCurrentPriority(fiber) {
            if (fiber.tag !== SuspenseComponent) {
              return;
            }
            var lane = requestUpdateLane(fiber);
            var root = enqueueConcurrentRenderForLane(fiber, lane);
            if (root !== null) {
              var eventTime = requestEventTime();
              scheduleUpdateOnFiber(root, fiber, lane, eventTime);
            }
            markRetryLaneIfNotHydrated(fiber, lane);
          }
          function findHostInstanceWithNoPortals(fiber) {
            var hostFiber = findCurrentHostFiberWithNoPortals(fiber);
            if (hostFiber === null) {
              return null;
            }
            return hostFiber.stateNode;
          }
          var shouldErrorImpl = function(fiber) {
            return null;
          };
          function shouldError(fiber) {
            return shouldErrorImpl(fiber);
          }
          var shouldSuspendImpl = function(fiber) {
            return false;
          };
          function shouldSuspend(fiber) {
            return shouldSuspendImpl(fiber);
          }
          var overrideHookState = null;
          var overrideHookStateDeletePath = null;
          var overrideHookStateRenamePath = null;
          var overrideProps = null;
          var overridePropsDeletePath = null;
          var overridePropsRenamePath = null;
          var scheduleUpdate = null;
          var setErrorHandler = null;
          var setSuspenseHandler = null;
          {
            var copyWithDeleteImpl = function(obj, path, index2) {
              var key = path[index2];
              var updated = isArray(obj) ? obj.slice() : assign({}, obj);
              if (index2 + 1 === path.length) {
                if (isArray(updated)) {
                  updated.splice(key, 1);
                } else {
                  delete updated[key];
                }
                return updated;
              }
              updated[key] = copyWithDeleteImpl(obj[key], path, index2 + 1);
              return updated;
            };
            var copyWithDelete = function(obj, path) {
              return copyWithDeleteImpl(obj, path, 0);
            };
            var copyWithRenameImpl = function(obj, oldPath, newPath, index2) {
              var oldKey = oldPath[index2];
              var updated = isArray(obj) ? obj.slice() : assign({}, obj);
              if (index2 + 1 === oldPath.length) {
                var newKey = newPath[index2];
                updated[newKey] = updated[oldKey];
                if (isArray(updated)) {
                  updated.splice(oldKey, 1);
                } else {
                  delete updated[oldKey];
                }
              } else {
                updated[oldKey] = copyWithRenameImpl(
                  // $FlowFixMe number or string is fine here
                  obj[oldKey],
                  oldPath,
                  newPath,
                  index2 + 1
                );
              }
              return updated;
            };
            var copyWithRename = function(obj, oldPath, newPath) {
              if (oldPath.length !== newPath.length) {
                warn("copyWithRename() expects paths of the same length");
                return;
              } else {
                for (var i = 0; i < newPath.length - 1; i++) {
                  if (oldPath[i] !== newPath[i]) {
                    warn("copyWithRename() expects paths to be the same except for the deepest key");
                    return;
                  }
                }
              }
              return copyWithRenameImpl(obj, oldPath, newPath, 0);
            };
            var copyWithSetImpl = function(obj, path, index2, value) {
              if (index2 >= path.length) {
                return value;
              }
              var key = path[index2];
              var updated = isArray(obj) ? obj.slice() : assign({}, obj);
              updated[key] = copyWithSetImpl(obj[key], path, index2 + 1, value);
              return updated;
            };
            var copyWithSet = function(obj, path, value) {
              return copyWithSetImpl(obj, path, 0, value);
            };
            var findHook = function(fiber, id) {
              var currentHook2 = fiber.memoizedState;
              while (currentHook2 !== null && id > 0) {
                currentHook2 = currentHook2.next;
                id--;
              }
              return currentHook2;
            };
            overrideHookState = function(fiber, id, path, value) {
              var hook = findHook(fiber, id);
              if (hook !== null) {
                var newState = copyWithSet(hook.memoizedState, path, value);
                hook.memoizedState = newState;
                hook.baseState = newState;
                fiber.memoizedProps = assign({}, fiber.memoizedProps);
                var root = enqueueConcurrentRenderForLane(fiber, SyncLane);
                if (root !== null) {
                  scheduleUpdateOnFiber(root, fiber, SyncLane, NoTimestamp);
                }
              }
            };
            overrideHookStateDeletePath = function(fiber, id, path) {
              var hook = findHook(fiber, id);
              if (hook !== null) {
                var newState = copyWithDelete(hook.memoizedState, path);
                hook.memoizedState = newState;
                hook.baseState = newState;
                fiber.memoizedProps = assign({}, fiber.memoizedProps);
                var root = enqueueConcurrentRenderForLane(fiber, SyncLane);
                if (root !== null) {
                  scheduleUpdateOnFiber(root, fiber, SyncLane, NoTimestamp);
                }
              }
            };
            overrideHookStateRenamePath = function(fiber, id, oldPath, newPath) {
              var hook = findHook(fiber, id);
              if (hook !== null) {
                var newState = copyWithRename(hook.memoizedState, oldPath, newPath);
                hook.memoizedState = newState;
                hook.baseState = newState;
                fiber.memoizedProps = assign({}, fiber.memoizedProps);
                var root = enqueueConcurrentRenderForLane(fiber, SyncLane);
                if (root !== null) {
                  scheduleUpdateOnFiber(root, fiber, SyncLane, NoTimestamp);
                }
              }
            };
            overrideProps = function(fiber, path, value) {
              fiber.pendingProps = copyWithSet(fiber.memoizedProps, path, value);
              if (fiber.alternate) {
                fiber.alternate.pendingProps = fiber.pendingProps;
              }
              var root = enqueueConcurrentRenderForLane(fiber, SyncLane);
              if (root !== null) {
                scheduleUpdateOnFiber(root, fiber, SyncLane, NoTimestamp);
              }
            };
            overridePropsDeletePath = function(fiber, path) {
              fiber.pendingProps = copyWithDelete(fiber.memoizedProps, path);
              if (fiber.alternate) {
                fiber.alternate.pendingProps = fiber.pendingProps;
              }
              var root = enqueueConcurrentRenderForLane(fiber, SyncLane);
              if (root !== null) {
                scheduleUpdateOnFiber(root, fiber, SyncLane, NoTimestamp);
              }
            };
            overridePropsRenamePath = function(fiber, oldPath, newPath) {
              fiber.pendingProps = copyWithRename(fiber.memoizedProps, oldPath, newPath);
              if (fiber.alternate) {
                fiber.alternate.pendingProps = fiber.pendingProps;
              }
              var root = enqueueConcurrentRenderForLane(fiber, SyncLane);
              if (root !== null) {
                scheduleUpdateOnFiber(root, fiber, SyncLane, NoTimestamp);
              }
            };
            scheduleUpdate = function(fiber) {
              var root = enqueueConcurrentRenderForLane(fiber, SyncLane);
              if (root !== null) {
                scheduleUpdateOnFiber(root, fiber, SyncLane, NoTimestamp);
              }
            };
            setErrorHandler = function(newShouldErrorImpl) {
              shouldErrorImpl = newShouldErrorImpl;
            };
            setSuspenseHandler = function(newShouldSuspendImpl) {
              shouldSuspendImpl = newShouldSuspendImpl;
            };
          }
          function findHostInstanceByFiber(fiber) {
            var hostFiber = findCurrentHostFiber(fiber);
            if (hostFiber === null) {
              return null;
            }
            return hostFiber.stateNode;
          }
          function emptyFindFiberByHostInstance(instance) {
            return null;
          }
          function getCurrentFiberForDevTools() {
            return current;
          }
          function injectIntoDevTools(devToolsConfig) {
            var findFiberByHostInstance = devToolsConfig.findFiberByHostInstance;
            var ReactCurrentDispatcher2 = ReactSharedInternals.ReactCurrentDispatcher;
            return injectInternals({
              bundleType: devToolsConfig.bundleType,
              version: devToolsConfig.version,
              rendererPackageName: devToolsConfig.rendererPackageName,
              rendererConfig: devToolsConfig.rendererConfig,
              overrideHookState,
              overrideHookStateDeletePath,
              overrideHookStateRenamePath,
              overrideProps,
              overridePropsDeletePath,
              overridePropsRenamePath,
              setErrorHandler,
              setSuspenseHandler,
              scheduleUpdate,
              currentDispatcherRef: ReactCurrentDispatcher2,
              findHostInstanceByFiber,
              findFiberByHostInstance: findFiberByHostInstance || emptyFindFiberByHostInstance,
              // React Refresh
              findHostInstancesForRefresh,
              scheduleRefresh,
              scheduleRoot,
              setRefreshHandler,
              // Enables DevTools to append owner stacks to error messages in DEV mode.
              getCurrentFiber: getCurrentFiberForDevTools,
              // Enables DevTools to detect reconciler version rather than renderer version
              // which may not match for third party renderers.
              reconcilerVersion: ReactVersion
            });
          }
          exports2.attemptContinuousHydration = attemptContinuousHydration;
          exports2.attemptDiscreteHydration = attemptDiscreteHydration;
          exports2.attemptHydrationAtCurrentPriority = attemptHydrationAtCurrentPriority;
          exports2.attemptSynchronousHydration = attemptSynchronousHydration;
          exports2.batchedUpdates = batchedUpdates;
          exports2.createComponentSelector = createComponentSelector;
          exports2.createContainer = createContainer;
          exports2.createHasPseudoClassSelector = createHasPseudoClassSelector;
          exports2.createHydrationContainer = createHydrationContainer;
          exports2.createPortal = createPortal;
          exports2.createRoleSelector = createRoleSelector;
          exports2.createTestNameSelector = createTestNameSelector;
          exports2.createTextSelector = createTextSelector;
          exports2.deferredUpdates = deferredUpdates;
          exports2.discreteUpdates = discreteUpdates;
          exports2.findAllNodes = findAllNodes;
          exports2.findBoundingRects = findBoundingRects;
          exports2.findHostInstance = findHostInstance;
          exports2.findHostInstanceWithNoPortals = findHostInstanceWithNoPortals;
          exports2.findHostInstanceWithWarning = findHostInstanceWithWarning;
          exports2.flushControlled = flushControlled;
          exports2.flushPassiveEffects = flushPassiveEffects;
          exports2.flushSync = flushSync;
          exports2.focusWithin = focusWithin;
          exports2.getCurrentUpdatePriority = getCurrentUpdatePriority;
          exports2.getFindAllNodesFailureDescription = getFindAllNodesFailureDescription;
          exports2.getPublicRootInstance = getPublicRootInstance;
          exports2.injectIntoDevTools = injectIntoDevTools;
          exports2.isAlreadyRendering = isAlreadyRendering;
          exports2.observeVisibleRects = observeVisibleRects;
          exports2.registerMutableSourceForHydration = registerMutableSourceForHydration;
          exports2.runWithPriority = runWithPriority;
          exports2.shouldError = shouldError;
          exports2.shouldSuspend = shouldSuspend;
          exports2.updateContainer = updateContainer;
          return exports2;
        };
      }
    }
  });

  // node_modules/react-reconciler/index.js
  var require_react_reconciler = __commonJS({
    "node_modules/react-reconciler/index.js"(exports, module) {
      "use strict";
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      if (false) {
        module.exports = null;
      } else {
        module.exports = require_react_reconciler_development();
      }
    }
  });

  // runtime/index.tsx
  var require_index = __commonJS({
    "runtime/index.tsx"() {
      init_jsx_shim();
      init_ambient();
      init_ambient_primitives();
      init_hostConfig();
      init_effectContext();
      init_websocket();
      init_plasma();
      var _globalListeners = {};
      function addEventListenerShim(type, fn) {
        (_globalListeners[type] ||= []).push(fn);
      }
      function removeEventListenerShim(type, fn) {
        const list = _globalListeners[type];
        if (!list) return;
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      }
      globalThis.window = globalThis;
      globalThis.self = globalThis;
      globalThis.addEventListener = addEventListenerShim;
      globalThis.removeEventListener = removeEventListenerShim;
      globalThis.document = {
        addEventListener: addEventListenerShim,
        removeEventListener: removeEventListenerShim,
        createElement: (_tag) => ({ style: {}, addEventListener: addEventListenerShim, removeEventListener: removeEventListenerShim }),
        querySelector: (_sel) => null,
        querySelectorAll: (_sel) => [],
        getElementById: (_id) => null,
        body: null,
        documentElement: null,
        hidden: false,
        visibilityState: "visible"
      };
      globalThis.__fireDomEvent = (type, payload) => {
        const list = _globalListeners[type];
        if (!list || list.length === 0) return;
        for (const fn of list.slice()) {
          try {
            fn(payload);
          } catch (e) {
            console.error(`[dom-event] ${type} listener error:`, e?.message || e, e?.stack || "");
          }
        }
      };
      (function installConsole() {
        const host2 = globalThis;
        const log = typeof host2.__hostLog === "function" ? host2.__hostLog : null;
        function stringifyOne(a) {
          if (a === null) return "null";
          if (a === void 0) return "undefined";
          if (typeof a === "string") return a;
          if (typeof a === "number" || typeof a === "boolean" || typeof a === "bigint") return String(a);
          if (a instanceof Error) return a.stack || `${a.name}: ${a.message}`;
          try {
            const json = JSON.stringify(a);
            if (typeof json === "string") return json;
          } catch {
          }
          try {
            return String(a);
          } catch {
          }
          return "[unprintable]";
        }
        function stringify(args) {
          const parts = [];
          for (const a of args) parts.push(stringifyOne(a));
          return parts.join(" ");
        }
        const emit2 = (level, args) => {
          const msg = stringify(args);
          if (log) {
            try {
              log(level, msg);
            } catch {
            }
          }
        };
        globalThis.console = {
          log: (...a) => emit2("log", a),
          info: (...a) => emit2("info", a),
          warn: (...a) => emit2("warn", a),
          error: (...a) => emit2("error", a),
          debug: (...a) => emit2("debug", a),
          trace: (...a) => emit2("trace", a)
        };
      })();
      if (!globalThis.__zigOS_tick) {
        const _timers = [];
        let _timerSeq = 1;
        let _nowMs = 0;
        globalThis.performance = globalThis.performance || { now: () => _nowMs };
        globalThis.setTimeout = (fn, ms) => {
          if (typeof fn !== "function") {
            console.error("[timer] setTimeout got non-function:", typeof fn, fn);
          }
          const id = _timerSeq++;
          _timers.push({ id, due: _nowMs + (ms ?? 0), fn, interval: 0, cleared: false });
          return id;
        };
        globalThis.setInterval = (fn, ms) => {
          if (typeof fn !== "function") {
            console.error("[timer] setInterval got non-function:", typeof fn, fn);
          }
          const id = _timerSeq++;
          const period = Math.max(1, ms ?? 0);
          _timers.push({ id, due: _nowMs + period, fn, interval: period, cleared: false });
          return id;
        };
        globalThis.clearTimeout = (id) => {
          for (const t of _timers) if (t.id === id) {
            t.cleared = true;
            return;
          }
        };
        globalThis.clearInterval = globalThis.clearTimeout;
        let _tickCount = 0;
        let _lastDbgPrint = 0;
        const _tickDbgIntervalMs = (() => {
          try {
            const envGet = globalThis.__env_get;
            if (typeof envGet === "function" && envGet("ZIGOS_VERBOSE_TICK")) return 1e3;
          } catch {
          }
          return 1e4;
        })();
        globalThis.__jsTick = (now) => {
          _nowMs = now;
          _tickCount++;
          if (now - _lastDbgPrint > _tickDbgIntervalMs) {
            _lastDbgPrint = now;
            const nextDue = _timers.length > 0 ? Math.min(..._timers.filter((t) => !t.cleared).map((t) => t.due - now)) : -1;
            console.log(`[tick] count=${_tickCount} now=${now} timers=${_timers.length} nextDue=${nextDue}ms`);
          }
          const due = [];
          for (const t of _timers) {
            if (!t.cleared && t.due <= now) due.push(t);
          }
          for (const t of due) {
            if (t.cleared) continue;
            if (typeof t.fn !== "function") {
              console.error("[timer] firing non-function callback:", t.id, typeof t.fn, t.fn);
            }
            try {
              t.fn();
            } catch (e) {
              let desc = "(no details)";
              try {
                if (e == null) desc = `threw ${e === null ? "null" : "undefined"}`;
                else if (typeof e === "string") desc = e;
                else if (e.stack) desc = String(e.stack);
                else if (e.message) desc = String(e.message);
                else {
                  try {
                    desc = JSON.stringify(e);
                  } catch {
                    desc = String(e);
                  }
                }
              } catch {
              }
              console.error(`[timer] error id=${t.id} interval=${t.interval}ms: ${desc}`);
            }
            if (t.interval > 0 && !t.cleared) {
              t.due = now + t.interval;
            } else {
              t.cleared = true;
            }
          }
          for (let i = _timers.length - 1; i >= 0; i--) {
            if (_timers[i].cleared) _timers.splice(i, 1);
          }
        };
      }
      var React2 = require_react();
      var Reconciler = require_react_reconciler();
      (function installAutoHotState() {
        if (React2.__sw_useStateAutoPatched) return;
        const realUseState = React2.useState;
        const realUseId = React2.useId;
        const realUseCallback = React2.useCallback;
        if (typeof realUseState !== "function" || typeof realUseId !== "function" || typeof realUseCallback !== "function") return;
        React2.useState = function useStateAutoHot(initial) {
          const id = realUseId.call(React2);
          const [value, setValue] = realUseState.call(React2, () => {
            const hg = globalThis.__hot_get;
            if (typeof hg === "function") {
              try {
                const raw = hg(id);
                if (raw != null) return JSON.parse(raw);
              } catch {
              }
            }
            const init = typeof initial === "function" ? initial() : initial;
            const hs = globalThis.__hot_set;
            if (typeof hs === "function") {
              try {
                hs(id, JSON.stringify(init));
              } catch {
              }
            }
            return init;
          });
          const set = realUseCallback.call(React2, (updater) => {
            setValue((prev) => {
              const next = typeof updater === "function" ? updater(prev) : updater;
              const hs = globalThis.__hot_set;
              if (typeof hs === "function") {
                try {
                  hs(id, JSON.stringify(next));
                } catch {
                }
              }
              return next;
            });
          }, [id]);
          return [value, set];
        };
        React2.__sw_useStateAutoPatched = true;
      })();
      installWebSocketShim();
      setTransportFlush((cmds) => {
        const payload = typeof cmds === "string" ? cmds : JSON.stringify(cmds);
        const host2 = globalThis;
        const hf = host2.__hostFlush;
        if (typeof hf === "function") {
          hf(payload);
          return;
        }
        const printer = host2.print;
        if (typeof printer === "function") {
          printer(`CMD ${payload}`);
        }
      });
      function getInputTextForNode(id) {
        const host2 = globalThis;
        const getter = host2.__getInputTextForNode;
        if (typeof getter !== "function") return "";
        const value = getter(id);
        return typeof value === "string" ? value : value == null ? "" : String(value);
      }
      function getPreparedRightClickPayload() {
        const host2 = globalThis;
        const getter = host2.__getPreparedRightClick;
        if (typeof getter !== "function") return {};
        const payload = getter();
        return payload && typeof payload === "object" ? payload : {};
      }
      function getPreparedScrollPayload() {
        const host2 = globalThis;
        const getter = host2.__getPreparedScroll;
        if (typeof getter !== "function") return {};
        const payload = getter();
        return payload && typeof payload === "object" ? payload : {};
      }
      function dispatchAliases(id, aliases, ...args) {
        const h2 = handlerRegistry.get(id);
        if (!h2) return;
        const host2 = globalThis;
        const stampHandler = host2.__clickLatencyStampHandler;
        for (const name of aliases) {
          const fn = h2[name];
          if (typeof fn === "function") {
            if (typeof stampHandler === "function") {
              try {
                stampHandler();
              } catch {
              }
            }
            fn(...args);
            break;
          }
        }
      }
      function eventAliases(type) {
        if (type === "onClick") return ["onClick", "onPress"];
        if (type === "onPress") return ["onPress", "onClick"];
        if (type === "onMouseDown") return ["onMouseDown"];
        if (type === "onMouseUp") return ["onMouseUp"];
        if (type === "onHoverEnter") return ["onHoverEnter", "onMouseEnter"];
        if (type === "onHoverExit") return ["onHoverExit", "onMouseLeave"];
        return [type];
      }
      globalThis.__beginJsEvent = () => {
      };
      globalThis.__endJsEvent = () => {
      };
      globalThis.__dispatchEvent = (id, type) => {
        const host2 = globalThis;
        const stampDispatch = host2.__clickLatencyStampDispatch;
        if (typeof stampDispatch === "function") {
          try {
            stampDispatch();
          } catch {
          }
        }
        const hl = host2.__hostLog;
        const h2 = handlerRegistry.get(id);
        const keys = h2 ? Object.keys(h2).join(",") : "(no-entry)";
        if (typeof hl === "function") {
          try {
            hl(0, `[dispatch] id=${id} type=${type} handlers=${keys}`);
          } catch {
          }
        }
        const dT0 = globalThis.performance?.now?.() ?? Date.now();
        try {
          const payload = { targetId: id };
          dispatchAliases(id, eventAliases(type), payload);
        } catch (e) {
          if (typeof hl === "function") {
            try {
              hl(2, `[dispatch] error id=${id} type=${type}: ${e?.message || e} ${e?.stack || ""}`);
            } catch {
            }
          }
        }
        const dT1 = globalThis.performance?.now?.() ?? Date.now();
        if (dT1 - dT0 > 50) {
          try {
            hl(0, `[dispatch-timing] id=${id} type=${type} handler=${(dT1 - dT0).toFixed(1)}ms`);
          } catch {
          }
        }
      };
      var registerDispatch = globalThis.__registerDispatch;
      if (typeof registerDispatch === "function") {
        try {
          registerDispatch((id, type) => {
            return globalThis.__dispatchEvent(id, type);
          });
        } catch {
        }
      }
      globalThis.__dispatchInputChange = (id, inputSlot) => {
        try {
          const text = getInputTextForNode(typeof inputSlot === "number" ? inputSlot : id);
          const payload = { targetId: id, text };
          dispatchAliases(id, ["onChangeText", "onChange", "onInput"], text, payload);
        } catch (e) {
        }
      };
      globalThis.__dispatchInputSubmit = (id, inputSlot) => {
        try {
          const text = getInputTextForNode(typeof inputSlot === "number" ? inputSlot : id);
          const payload = { targetId: id, text };
          dispatchAliases(id, ["onSubmit", "onSubmitEditing"], text, payload);
        } catch (e) {
        }
      };
      globalThis.__dispatchInputFocus = (id) => {
        try {
          dispatchAliases(id, ["onFocus"], { targetId: id });
        } catch (e) {
        }
      };
      globalThis.__dispatchInputBlur = (id) => {
        try {
          dispatchAliases(id, ["onBlur"], { targetId: id });
        } catch (e) {
        }
      };
      globalThis.__dispatchInputKey = (id, keyCode, mods) => {
        try {
          dispatchAliases(id, ["onKeyDown"], { targetId: id, keyCode, mods });
        } catch (e) {
        }
      };
      globalThis.__dispatchRightClick = (id) => {
        try {
          const payload = { targetId: id, ...getPreparedRightClickPayload() };
          dispatchAliases(id, ["onRightClick", "onContextMenu"], payload);
        } catch (e) {
        }
      };
      globalThis.__dispatchScroll = (id) => {
        try {
          const payload = { targetId: id, ...getPreparedScrollPayload() };
          dispatchAliases(id, ["onScroll"], payload);
        } catch (e) {
        }
      };
      globalThis.__dispatchCanvasMove = (id, gx, gy) => {
        try {
          dispatchAliases(id, ["onMove"], { targetId: id, gx, gy });
        } catch (e) {
        }
      };
      globalThis.__dispatchEffectRender = (id, buffer, width, height, stride, time, dt, mouse_x, mouse_y, mouse_inside, frame) => {
        const h2 = handlerRegistry.get(id);
        const fn = h2?.onRender;
        if (typeof fn !== "function") return;
        try {
          const ctx = prepareContext(id, buffer, width, height, stride, time, dt, mouse_x, mouse_y, mouse_inside, frame);
          fn(ctx);
        } catch (e) {
          const host2 = globalThis;
          const hl = host2.__hostLog;
          if (typeof hl === "function") {
            try {
              hl(2, `[effect] id=${id} error: ${e?.message || e} ${e?.stack || ""}`);
            } catch {
            }
          }
        }
      };
      globalThis.__releaseEffectContext = (id) => {
        try {
          releaseContext(id);
        } catch {
        }
      };
      var reconciler = Reconciler(hostConfig);
      var container = reconciler.createContainer({ id: 0 }, 0, null, false, null, "", (_e) => {
      }, null);
      reconciler.updateContainer(React2.createElement(Plasma, {}), container, null, null);
    }
  });
  require_index();
})();
/*! Bundled license information:

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.development.js:
  (**
   * @license React
   * scheduler.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-reconciler/cjs/react-reconciler.development.js:
  (**
   * @license React
   * react-reconciler.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
