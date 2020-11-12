/**
 * The rules module contains some utility functions and a decorator that can
 * decorate a JavaScript function after adding triggers to create a ``SimpleRule``
 *
 * @copyright Copyright (c) 2020
 *
 * @author openHAB Scripters Contributors - Jython libraries
 * @author Michael Murton - port to ES5
 */

(function (context) {
    var OPENHAB_CONF = Java.type("java.lang.System").getProperty("openhab.conf");
    var JS_PATH = OPENHAB_CONF + "/automation/lib/javascript";

    load(JS_PATH + "/core/log.js");
    scriptExtension.importPreset("RuleSimple");
    scriptExtension.importPreset("RuleSupport");

    var HashSet = Java.type("java.util.HashSet");

    var LOG = getLogger(LOG_PREFIX + ".core.rules");

    /**
     * Returns a SimpleRule instance that calls a function when triggered
     *
     * @param {function} callback
     * @param {array} triggers
     * @param {string} name
     * @param {string} description
     * @param {string[]} tags
     * @param {boolean} visible
     *
     * @returns {*} a SimpleRule instance or null
     */
    function function_rule(callback, triggers, name, description, tags, visible) {
        try {
            callback.log = getLogger(LOG_PREFIX + "." + (name || callback.name));
            var rule_execute = function (module, inputs) {
                try {
                    callback.apply(callback, [inputs.event]);
                } catch (e) {
                    callback.log.error(
                        get_stacktrace(e, "rule: " + (name || callback.name), -1, 1)
                    );
                    throw Error(
                        "An error occured while running rule " + (name || callback.name)
                        + "(see the stack trace for details)"
                    );
                }
            };
            var simple_rule = new SimpleRule({ execute: rule_execute });
            simple_rule.setName(name || callback.name || "JSR223-JavaScript");
            simple_rule.setDescription(description || callback.description || "");
            simple_rule.setTags(new HashSet(tags || callback.tags || []));
            simple_rule.setVisibility(visible ? Visibility.EXPERT : Visibility.VISIBLE);
            simple_rule.setTriggers(triggers);
            return simple_rule;
        } catch (e) {
            LOG.error(get_stacktrace(e, "function_rule"));
            return null;
        }
    }

    /**
     * Adds a Rule to openHAB
     *
     * @param {*} rule - a valid Rule instance
     */
    context.addRule = function (rule) {
        LOG.debug("Added rule [{}]", rule.getName());
        return automationManager.addRule(rule);
    };

    /**
     * This decorator function can turn a function decorated by ``when`` into
     * a rule.
     *
     * Examples:
     *     .. code-block:: javascript
     *
     *       rule("name", "description", ["tag1", "tag2"])(target_func);
     *       rule("name", null, ["tag1", "tag2"])(target_func);
     *       rule("name")(target_func);
     *
     * @param {string} name
     * @param {string} description
     * @param {string[]} tags
     * @param {boolean} visible
     *
     * @returns {function} the decorator function
     */
    context.rule = function (name, description, tags, visible) {
        function decorator(object) {
            name = name || object.name;
            //if isclass --> can't have real classes in ES5
            if (object instanceof Function) {
                if (
                    object.triggers
                    && object.triggers instanceof Array
                    && object.triggers.length
                ) {
                    if (!~object.triggers.indexOf(null)) {
                        var simple_rule = function_rule(
                            object,
                            object.triggers,
                            name,
                            description,
                            tags,
                            visible
                        );
                        if (simple_rule) {
                            var new_rule = context.addRule(simple_rule);
                            object.UID = new_rule.UID;
                            object.triggers = null;
                            return object;
                        } else {
                            return null;
                        }
                    } else {
                        LOG.warn(
                            "rule: not creating rule [{}] due to an invalid trigger definition",
                            name
                        );
                    }
                } else {
                    LOG.warn(
                        "rule: not creating rule [{}] due to no triggers being defined",
                        name
                    );
                }
            } else {
                LOG.error(
                    "rule: not creating rule [{}] because it is not a function",
                    name
                );
            }
            return null;
        }

        return decorator;
    };
})(this);
