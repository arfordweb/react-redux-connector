import { combineReducers } from 'redux'
import { connect } from 'react-redux'


/**
 * @description
 * For use in the reducer file of a model or component.  Creates a reducer function that has a
 * namespace that can be used with `combineNamespacedReducers` to create a single reducer to
 * pass to `createStore`.
 *
 * Example:
 * ```
 *  export default createNamespacedReducer(
 *      'models/puppy', // namespace string
 *      Map({ puppyRecords: List() }), // initial state
 *      // reducer functions, indexed by Redux action types
 *      {
 *          // Note the second parameter I'm destructuring here is the `action`
 *          'models/puppy/BEGIN_LOADING_PUPPY': (state, { puppyName }) => {
 *              // return modified state
 *          },
 *          'models/puppy/PUPPY_QUERY_FAILURE': (state, { puppyName }) => {
 *              // return modified state
 *          },
 *          'models/puppy/PUPPY_QUERY_SUCCESS': (state, { puppyName, puppyRecord }) => {
 *              // return modified state
 *          },
 *      } // no need to handle the default case
 *  );
 * ```
 *
 * @param {string} namespace The namespace string that separates this part of the Redux
 *  store from those stored by other models or components
 * @param {Map} initialState The starting state for this namespace
 * @param {object} reducerFunctions An object, indexed by Redux action type strings, containing
 *  functions that perform the needed changes to this redux namespace in response to a
 *  dispatched action.  Each reducer function should take two paramters.  The first is the
 *  current namespaced state from the Redux store.  The second is the action that was dispatched.
 *  Note that these functions can ignore the action's type since each function should only be
 *  reducing the state for a predefined action type rather than handling more than one.
 *
 * @return {function} The reducer, which can be passed into the `combineNamespacedReducers`
 *  function to create a single combined reducer
 */
export const createNamespacedReducer = (
  namespace, initialState, reducerFunctions,
) => {
  const reducer = (state = initialState, action) => (reducerFunctions[action.type]
    ? reducerFunctions[action.type](state, action)
    : state
  )
  reducer.reduxNamespace = namespace
  return reducer
}


/**
* @description
* For use when creating the Redux store.  Combines namespaced reducers into a single reducer.
* But, does so by adding each to the Redux store indexed at the value of the reducer's
* `reduxNamespace` property.  This allows the index to be delcared at the level of
* the module containing the individual reducers rather than being hard-coded and
* repeated here and in the module.
*
* Example:
* ```
*  import { createStore } from 'redux';
*  import { combineNamespacedReducers } from 'utils/react-redux-connector';
*  import PuppyModelReducer from 'models/puppy/reducer';
*  import PuppyGeneratorReducer from 'components/page/PuppyGenerator/reducer';
*  import PuppyGeneratorTable
*      from 'components/page/PuppyGenerator/PuppyGeneratorTable/reducer';
*  export default createStore(combineNamespacedReducers(
*      PuppyModelsReducer,
*      PuppyGeneratorReducer,
*      PuppyGeneratorTable
*  ));
*
* @param {function} reducers Accepts multiple reducers, each having a property called
*  `reduxNamespace`, to be combined into a single reducer
*
* @return {function} The combined reducer
*/
export const combineNamespacedReducers = (...reduxReducers) => combineReducers(
  reduxReducers.reduce(
    (indexedReduxReducers, reduxReducer) => {
      const outIndexedReduxReducers = indexedReduxReducers
      outIndexedReduxReducers[reduxReducer.reduxNamespace] = reduxReducer
      return outIndexedReduxReducers
    },
    {},
  ),
)


/**
* You can use this in an override function to check if prerequisite config values were specified
* by the developer using the connector.  This function assists the developer in identifying their
* mistake rather than being given a meaningless error with little context.
*
* @param {string} connectorName The name of the connector being connected.  Note that this param
*  isn't checked against anything.  So, if you're connecting the same overridden prop in more than
*  one place, you can add garbage to the end of this param to narrow down which connector call is
*  missing the config value.
* @param {string} propName The name of the overridden prop the user wishes to connect
* @param {string} requiredConfigName The name of the required config field
* @param {object} config The config object that is missing the property
*
* @throws {Error} If there is an issue, short-circuits execution with an Exception.  The errors
*  this function might throw should only occur during development, so if you're not seeing them,
*  no need to attempt to catch errors thrown by this function.
*/
export const checkConfigPrerequisiteSatisfied = (
  connectorName,
  propName,
  requiredConfigName,
  config,
) => {
  const missingParams = []
  if (!connectorName) {
    missingParams.concat('connectorName')
  }
  if (!propName) {
    missingParams.concat('propName')
  }
  if (!requiredConfigName) {
    missingParams.concat('requiredConfigName')
  }
  if (missingParams.length) {
    const errorStart = 'Invalid call to react-redux-connector\'s '
            + 'isConfigPrerequisiteSatisfied function.'
    throw new Error(`${errorStart}  No value specified for param(s): `
            + `${missingParams.join(', ')}`)
  }
  if (typeof config !== 'object' || typeof config[requiredConfigName] !== 'string') {
    const errorStart = `In \`${propName}\` override in \`connectProductListProductsModel\`.`
    throw new Error(`${errorStart}  Config property `
            + `\`${requiredConfigName}\` is required but not specified`)
  }
}


// Helper class for `createNamespaceConnector` and `propAs`
class AsPropRenamer {
  constructor(actionOrStateIndex, propName) {
    this.actionOrStateIndex = actionOrStateIndex
    this.propName = propName
  }
}


// Helper for `createNamespaceConnector`
const createMapStateToPropsFunc = (
  reduxNamespace, propOverrides, propsToConnect, config,
) => (
  { [reduxNamespace]: state }, ownProps,
) => {
  if (!state) {
    throw new Error(`Unable to find state namespace '${reduxNamespace}'; Perhaps you `
            + 'forgot to add the namespaced reducer to your call to '
            + '\'combineNamespacedReducers\'?')
  }
  if (!(propsToConnect instanceof Array)) {
    return {}
  }
  return propsToConnect.reduce(
    (newPropsObj, propName) => {
      const outNewPropsObj = newPropsObj // makes ESLint happy
      if (typeof propOverrides[propName] === 'function') {
        outNewPropsObj[propName] = propOverrides[propName](state, ownProps, config)
      } else if (typeof propName === 'string' && state.has(propName)) {
        outNewPropsObj[propName] = state.get(propName)
      } else if (propName instanceof AsPropRenamer
                    && state.has(propName.actionOrStateIndex)) {
        outNewPropsObj[propName.propName] = state.get(propName.actionOrStateIndex)
      } else if (propName instanceof AsPropRenamer
                    && Object.keys(propOverrides).includes(propName.actionOrStateIndex)) {
        outNewPropsObj[propName.propName] = propOverrides[propName.actionOrStateIndex](
          state, ownProps, config,
        )
      } else {
        const propNameStr = propName instanceof AsPropRenamer
          ? propName.actionOrStateIndex
          : propName
        // eslint-disable-next-line no-console
        console.warn(`Warning: Attempted to map invalid state key name ${propNameStr}`)
      }
      return outNewPropsObj
    },
    {},
  )
}

// Helper for `createNamespaceConnector`
const createMapDispatchToPropsObj = (
  allActionsObj, actionsToConnect,
) => actionsToConnect.reduce((newState, actionName) => {
  const outState = newState
  if (typeof actionName === 'string' && allActionsObj[actionName]) {
    outState[actionName] = allActionsObj[actionName]
  } else if (actionName instanceof AsPropRenamer
            && allActionsObj[actionName.actionOrStateIndex]) {
    outState[actionName.propName] = allActionsObj[actionName.actionOrStateIndex]
  } else {
    // eslint-disable-next-line no-console
    console.warn(`Warning: Attempted to map invalid action name ${actionName}`)
  }
  return outState
}, {})

/**
 * @description
 * For use at the model level.  Creates a connection function that can be customized to
 * connect any Redux model, including all or a subset of that model's props and actions
 * to a component.  Use this instead of connecting the props and actions directly with a
 * `connect` call to make more clear and explicit which props and actions a component needs
 * from which namespaces.
 *
 * Note that this connector creator assumes you are using the default `mergeProps` and `options`
 * when calling `connect`.
 *
 * Example:
 * ```
 *  import { createNamespaceConnector } from 'utils/react-redux-connector';
 *  import actions from './actions'; // Make sure your actions are exporting a default object
 *
 *  const connectPuppyModel = createNamespaceConnector(
 *      'models/puppy/',
 *      actions,
 *      {
 *          puppyRecords: (state, ownProps, config) => { // override function for `puppyRecords`
 *              // If `max` is specified in config for the `puppyRecords` field when this
 *              // connector function is called by the component author, only returns the
 *              // amount specified as the `max`, otherwise returns entire List
 *              const records = state.get('puppyRecords');
 *              return (config.puppyRecords
 *                      && config.puppyRecords.max
 *                      && records.size > config.puppyRecords.max)
 *                  ? records.setSize(config.puppyRecords.max)
 *                  : records;
 *          },
 *      }
 *  );
 *  export default connectPuppyModel;
 * ```
 *
 * @param {string} reduxNamespace The namespace string for a portion of the Redux state.  By
 *  convention, this namespace can be kept in the model's `constants.js` file and be exported as
 *  `REDUX_NAMESPACE`.
 * @param {[string]:function} actionsObj An object containing all the action functions for the
 *  namespace.  By convention, this actions object can be exported from the model's `actions.js`
 *  as `actions`.
 * @param {[string]:function} propOverrides An object containing override functions for props.
 *  Use this when you want to derive a prop's value instead of transferring it straight from
 *  the Redux namespace's Map.  The functions should be indexed by the name of the prop and
 *  can accept 3 parameters in the following order:
 *  - {Map} state The current state of the Redux namespace
 *  - {object} ownProps The props that were passed in to the component (rather than being connected
 *    from Redux)
 *  - {object} config The config object specified in the call to the connector this function returns
 *
 *  It's worth noting you are not restricted to specifying props and prop override functions that
 *  are indexes of this Redux namespace Map.  You can derive custom values simply by specifying
 *  the prop name and override function that derives that prop's value in the call to the function
 *  returned by a call to the `createNamespaceConnector` function.
 *
 * @returns {function} A function that can be used to connect a model to a component.
 *  This returned function can be re-exported by the model so that component authors can use
 *  it to attach props and actions from the Redux namespace to it as they might otherwise do
 *  using the `connect` function from `react-redux` directly.  This function takes three
 *  parameters:
 *  - {array} propsToConnect The names of props to be connected.  These can be indexes
 *    of the Redux namespace state -or- custom props derived from functions that were specified in
 *    the `propOverrides` object
 *  - {array} actionsToConnect The names of actions to be connected to the component.  This
 *    parameter is optional, but either it or `propsToConnect` should be specified.
 *  - {object} config A config object that can be used by functions in `propOverrides` so
 *    the Component's author can specify how they want derived props to be calculated before
 *    they are connected
 *  The result is a function you can call with the component as its sole parameter, which returns
 *  a HOC of the component with the Redux props and actions being supplied to it.
 */
export const createNamespaceConnector = (
  reduxNamespace,
  allActionsObj = {},
  propOverrides = {},
) => {
  const connector = (propsToConnect = [], actionsToConnect, config = {}) => connect(
    createMapStateToPropsFunc(reduxNamespace, propOverrides, propsToConnect, config),
    createMapDispatchToPropsObj(allActionsObj, actionsToConnect || []),
  )

  // The following are for use in `applyConnectors`, not to be called directly
  // by component developer
  connector.curriedCreateMapStateToProps = (propsToConnect, config) => createMapStateToPropsFunc(
    reduxNamespace,
    propOverrides,
    propsToConnect,
    config,
  )
  connector.curriedCreateMapDispatchToProps = actionsToConnect => createMapDispatchToPropsObj(
    allActionsObj,
    actionsToConnect || [],
  )

  return connector
}


/**
* @description
* Use this instead of a prop name when calling a connector function if you'd like to rename a
* value from state to a different prop name.
*
* @prop {string} actionOrStateIndex The index of the property in the Redux namespace
* @prop {string} propName   The name of the prop to connect to the Component
*
* @return {AsPropRenamer}
*/
export const propAs = (actionOrStateIndex, propName) => {
  if (typeof actionOrStateIndex !== 'string' || typeof propName !== 'string') {
    // eslint-disable-next-line no-console
    console.warn('Warning: reduxHelper `propAs` requires a state index and prop name. '
            + `Received actionOrStateIndex: '${actionOrStateIndex}', propName: '${propName}'`)
  }
  return new AsPropRenamer(actionOrStateIndex, propName)
}


/**
 * @description
 * Combines connectors created with `createNamespaceConnector` so that state and actions can
 * be connected from multiple models and from the optional component-specific Redux state.
 * This function can be called with Arrays containing the connectors and their
 * parameters as laid out below.
 *
 * Or it can be called with no connectors and you can push the connectors by chaining call to
 * `push` on the result of this call to this function.
 *
 * Optionally, if you want to connect any part of the Redux namespace like you normally
 * would if you were just using the `connect` function from `react-redux`, you can do
 * so while also combining connectors by calling `connect` on the result of your call
 * to `combineConnectors`.  This can also be chained after calls to `push`.
 *
 * Examples:
 * ```
 *  combineConnectors(
 *      [
 *          connectFooModel,
 *          ['myFooProp'],
 *          ['requestFooAction', 'deleteFooAction'],
 *      ],
 *      [
 *          connectBarModel,
 *          ['myBarProp1', 'myBarProp2'],
 *          ['requestBarPropsAction']
 *      ]
 *  )(MyComponent);
 * ```
 *  ...is the same as...
 * ```
 *  combineConnectors()
 *      .push(
 *          connectFooModel,
 *          ['myFooProp'],
 *          ['requestFooAction', 'deleteFooAction'],
 *      ).push(
 *          connectBarModel,
 *          ['myBarProp1', 'myBarProp2'],
 *          ['requestBarPropsAction']
 *      )(MyComponent);
 * ```
 *
 * And if you also want to connect a portion of state without using a connector to do it:
 * ```
 *  combineConnectors(
 *      // ...
 *  ).connect(
 *      (state, ownProps) => ({ thing: state.someNamespace.thing }),
 *      {
 *          requestAThingAction,
 *      }
 *      // The `mergeProps` function parameter is also supported
 *      // The `options` object parameter is also supported
 *  )(MyComponent);
 * ```
 *
 * Note that you should only call `.connect` one time or you'll overwrite `mergeProps` and
 * `options` from a previous call.  Whatever you feel is necessary to do in multiple chained
 * `connect` calls should be achievable in one, or in `mergeProps`.  Though, I'd just stick
 * to using `createNamespaceConnector` to generator connectors to be used instead of chaining
 * a call to `connect`.
 *
 * @param {...Array} ...connectorsAndParams Specify as many arrays as you like that contain
 *  the connector and parameters to be passed to the connector in this order:
 *  [0] - connector
 *  [1] - propsToConnect
 *  [2] - actionsToConnect
 *  [3] - config
 *
 * @return {function} The returned function accepts a single parameter: the Component you
 *  wish to connect Redux state to.  The result of a call to this returned function is
 *  a Higher Order Component (HOC) with some props updated every time the analagous
 *  values are updated in the Redux state, and/or having props that dispatch Redux actions.
 *
 *  Also, you can chain calls to `push` and/or chain a call to `connect` to the result of
 *  this function rather than calling it immediately on the Component.  The result of
 *  all chained calls is the same result as the original call to `combineConnectors`
 *  (which is why the calls are chainable).  See description above for examples.
 */
export const combineConnectors = (...connectorsAndParams) => {
  const stateMappers = []
  const mappedDispatches = [{}]
  let mergeProps
  let options

  if (connectorsAndParams[0] instanceof Array && connectorsAndParams[0][0] instanceof Array) {
    throw new Error('Invalid first argument in call to `combineConnectors`; Use multiple '
            + 'arguments instead of two-dimensional Array')
  }

  const combinedConnectors = (TargetComponent) => {
    // Go ahead and run the functions to produce the combined state and a combined object
    // full of action functions
    const combinedMapStateToPropsFuncs = (state, ownProps) => {
      const mappedStates = [{}]
      stateMappers.forEach((stateMapper) => {
        mappedStates.push(stateMapper(state, ownProps))
      })
      return Object.assign(...mappedStates)
    }
    const combinedMapDispatchToPropsObjects = Object.assign(...mappedDispatches)

    // Now connect as we normally would
    return connect(
      combinedMapStateToPropsFuncs,
      combinedMapDispatchToPropsObjects,
      mergeProps,
      options,
    )(TargetComponent)
  }

  const pushFunc = (connector, propsToConnect, actionsToConnect, config) => {
    if (propsToConnect) {
      stateMappers.push(connector.curriedCreateMapStateToProps(propsToConnect, config))
    }
    if (actionsToConnect) {
      mappedDispatches.push(connector.curriedCreateMapDispatchToProps(actionsToConnect))
    }
    return combinedConnectors
  }

  const connectFunc = (
    customMapStateToProps,
    customMapDispatchToProps,
    customMergeProps,
    customOptions,
  ) => {
    if (customMapStateToProps) {
      stateMappers.push(customMapStateToProps)
    }
    if (customMapDispatchToProps) {
      mappedDispatches.push(customMapDispatchToProps)
    }
    mergeProps = customMergeProps
    options = customOptions
    return combinedConnectors
  }

  connectorsAndParams.forEach(([connector, propsToConnect, actionsToConnect, config]) => {
    pushFunc(connector, propsToConnect, actionsToConnect, config)
  })

  combinedConnectors.push = pushFunc
  combinedConnectors.connect = connectFunc
  return combinedConnectors
}
