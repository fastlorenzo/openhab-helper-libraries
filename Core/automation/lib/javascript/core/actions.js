/**
 * This module discovers action services registered from openHAB bundles or
 * add-ons. The specific actions that are available will depend on the which
 * add-ons are installed.
 *
 * @copyright Copyright (c) 2020
 *
 * @author openHAB Scripters Contributors - Jython libraries
 * @author Michael Murton - port to ES5
 */

(function (context) {
    var OPENHAB_CONF = Java.type("java.lang.System").getProperty("openhab.conf");
    var JS_PATH = OPENHAB_CONF + "/automation/lib/javascript";

    load(JS_PATH + "/core/osgi.js");

    load(JS_PATH + "/core/log.js");
    var LOG = getLogger(LOG_PREFIX + ".core.actions");

    var ACTIONS = {};

    function add_action(action) {
        LOG.debug("Added '{}'", action);
        ACTIONS[String(action.actionClass.getSimpleName())] = action.actionClass;
    }

    // OH1 Actions
    try {
        (find_services("org.openhab.core.scriptengine.action.ActionService", null) || []).
            forEach(add_action);
    } catch (e) { /* */ }

    // OH2 Actions in Eclipse SmartHome namespace
    try {
        (find_services("org.eclipse.smarthome.core.script.engine.action.ActionService", null) || []).
            forEach(add_action);
    } catch (e) { /* */ }

    // OH2+OH3 Actions in openHAB Core namespace
    try {
        (find_services("org.openhab.core.script.engine.action.ActionService", null) || []).
            forEach(add_action);
    } catch (e) { /* */ }

    try {
        ACTIONS.Exec = Java.type("org.openhab.core.model.script.actions.Exec");
    } catch (e) {
        ACTIONS.Exec = Java.type("org.eclipse.smarthome.core.model.script.actions.Exec");
    }
    try {
        ACTIONS.HTTP = Java.type("org.openhab.core.model.script.actions.HTTP");
    } catch (e) {
        ACTIONS.HTTP = Java.type("org.eclipse.smarthome.core.model.script.actions.HTTP");
    }
    try {
        ACTIONS.Log = Java.type("org.openhab.core.model.script.actions.Log");
    } catch (e) {
        try {
            ACTIONS.LogAction = Java.type("org.openhab.core.model.script.actions.LogAction");
        } catch (e) {
            ACTIONS.LogAction = Java.type("org.eclipse.smarthome.core.model.script.actions.LogAction");
        }
    }
    try {
        ACTIONS.Ping = Java.type("org.openhab.core.model.script.actions.Ping");
    } catch (e) {
        ACTIONS.Ping = Java.type("org.eclipse.smarthome.core.model.script.actions.Ping");
    }
    try {
        ACTIONS.ScriptExecution = Java.type("org.openhab.core.model.script.actions.ScriptExecution");
    } catch (e) {
        ACTIONS.ScriptExecution = Java.type("org.eclipse.smarthome.core.model.script.actions.ScriptExecution");
    }

    context.action = ACTIONS;
})(this);
