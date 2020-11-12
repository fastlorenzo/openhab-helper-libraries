/**
 *
 *
 * @copyright Copyright (c) 2020
 *
 * @author openHAB Scripters Contributors - Jython libraries
 * @author Michael Murton - port to ES5
 */

(function (context) {
    var BUNDLE = Java.type("org.osgi.framework.FrameworkUtil").getBundle(scriptExtension.class);
    var BUNDLE_CONTEXT = BUNDLE !== null ? BUNDLE.getBundleContext() : null;
    var Hashtable = Java.type("java.util.Hashtable");

    var REGISTERED_SERVICES = {};


    context.get_service = function (class_or_name) {
        if (BUNDLE_CONTEXT) {
            var classname = typeof class_or_name === "string" ? class_or_name : class_or_name.getName();
            var ref = BUNDLE_CONTEXT.getServiceReference(classname);
            return ref ? BUNDLE_CONTEXT.getService(ref) : null;
        }
        return null;
    };

    context.find_services = function (class_name, service_filter) {
        if (BUNDLE_CONTEXT) {
            var references = Java.from(BUNDLE_CONTEXT.getAllServiceReferences(class_name, service_filter));
            if (references) {
                var bundles = [];
                references.forEach(function(ref) {
                    bundles.push(BUNDLE_CONTEXT.getService(ref));
                });
                return bundles;
            }
        }
        return null;
    };

    context.register_service = function (service, interface_names, properties) {
        if (properties) {
            var properties_map = new Hashtable();
            properties.forEach(function (value, key) {
                properties_map.put(key, value);
            });
            properties = properties_map;
        }
        var registered_service = BUNDLE_CONTEXT.registerService(interface_names, service, properties);
        interface_names.forEach(function(name) {
            REGISTERED_SERVICES.set(
                name,
                {
                    service: service,
                    registered_service: registered_service
                }
            );
        });
        return registered_service;
    };

    context.unregister_service = function (service) {
        REGISTERED_SERVICES.forEach(function (key, value) {
            if (service === value.service) {
                REGISTERED_SERVICES.delete(key);
                value.registered_service.unregister();
            }
        });
    };

})(this);
