/**
 * This component implements the openHAB extension provider interfaces and
 * be used to provide symbols to a script namespace.
 *
 * @copyright Copyright (c) 2019-2020
 *
 * @author openHAB Scripters Contributors - Jython libraries
 * @author Michael Murton - port to ES5
 */

(function (context) {
    var OPENHAB_CONF = Java.type("java.lang.System").getProperty("openhab.conf");
    var JS_PATH = OPENHAB_CONF + "/automation/lib/javascript";

    load(JS_PATH + "/core/log.js");

    var Set = Java.type("java.util.HashSet");
    var Map = Java.type("java.util.HashMap");

    var LOG = getLogger(LOG_PREFIX + ".core.providers");

    try {
        var ScriptExtensionProvider = Java.type("org.openhab.core.automation.module.script.ScriptExtensionProvider");
    } catch (e) {
        /* eslint-disable no-redeclare */
        var ScriptExtensionProvider = Java.type("org.eclipse.smarthome.core.automation.module.script.ScriptExtensionProvider");
        /* eslint-enable no-redeclare */
    }

    function JavascriptExtensionProvider(name) {
        this.name = name;
        this.default_presets = new Set();
        this.presets = new Set();
        this.preset_values = new Map();
        this.values = new Map();
        this.provider;
    }
    JavascriptExtensionProvider.prototype.register = function () {
        try {
            var self = this; // using `this` directly in the Java class doesn't work
            this.provider = new ScriptExtensionProvider(
                {
                    getDefaultPresets: function () {
                        return self.default_presets;
                    },
                    getPresets: function () {
                        return self.presets;
                    },
                    getTypes: function () {
                        return self.values.keySet();
                    },
                    get: function (scriptIdentifier, name) {
                        return self.values.get(name);
                    },
                    importPreset: function (scriptIdentifier, preset) {
                        var export_values = new Map();
                        (self.preset_values.get(preset) || []).forEach(
                            function (name) {
                                export_values.put(name, self.values.get(name));
                            }
                        );
                        return export_values;
                    },
                    unload: function (scriptIdentifier) { }
                }
            );
        } catch (e) {
            this.provider = null;
            LOG.warn(get_stacktrace(e, "ExtensionProvider: " + this.name));
        }
        if (this.provider) {
            scriptExtension.addScriptExtensionProvider(this.provider);
            LOG.debug("ScriptExtensionProvider: added '{}'", this.name);
            return true;
        }
        return false;
    };
    JavascriptExtensionProvider.prototype.unregister = function () {
        if (this.provider) {
            scriptExtension.removeScriptExtensionProvider(this.provider);
            LOG.debug("ScriptExtensionProvider: removed '{}'", this.name);
        }
    };
    JavascriptExtensionProvider.prototype.addValue = function (name, value) {
        this.values.put(name, value);
    };
    JavascriptExtensionProvider.prototype.addPreset = function (preset_name, value_names, is_default) {
        this.presets.add(preset_name);
        this.preset_values.put(preset_name, new Set(value_names));
        if (is_default) {
            this.default_presets.add(preset_name);
        }
    };

    context.createExtensionProvider = function (name) {
        var extensionProvider = new JavascriptExtensionProvider(name);
        return extensionProvider.register() ? extensionProvider : null;
    };
})(this);
