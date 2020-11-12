/**
 * This module provides functions for manipulating Item Metadata.
 *
 * @copyright Copyright (c) 2019-2020
 *
 * @author openHAB Scripters Contributors - initial contribution
 * @author Michael Murton - cleanup
 */

(function(context) {
    var OPENHAB_CONF = Java.type("java.lang.System").getProperty("openhab.conf");
    var JS_PATH = OPENHAB_CONF + "/automation/lib/javascript";

    load(JS_PATH + "/core/osgi.js");
    load(JS_PATH + "/core/log.js");

    var MetadataRegistry = (
        get_service("org.openhab.core.items.MetadataRegistry")
        || get_service("org.eclipse.smarthome.core.items.MetadataRegistry")
    );

    try {
        var Metadata = Java.type("org.openhab.core.items.Metadata");
        var MetadataKey = Java.type("org.openhab.core.items.MetadataKey");
    } catch(e) {
        /* eslint-disable no-redeclare */
        var Metadata = Java.type("org.eclipse.smarthome.core.items.Metadata");
        var MetadataKey = Java.type("org.eclipse.smarthome.core.items.MetadataKey");
        /* eslint-enable no-redeclare */
    }

    var LOG = getLogger(LOG_PREFIX + ".core.metadata");


    function merge_configuration(metadata_configuration, new_configuration) {
        var old_configuration = {};
        metadata_configuration.forEach(function(key, value) {
            old_configuration[key] = value;
        });
        new_configuration.forEach(function(key, value) {
            old_configuration[key] = value;
        });
        return old_configuration;
    }

    /**
     * This function will return a list of Metadata namespaces for an Item.
     *
     * @param {string} item_name - name of the Item to retrieve namespace names from
     *
     * @returns {string[]} array of strings representing the namespace names
     *     found for the specified Item
     */
    context.get_all_namespaces = function(item_name) {
        var namespace_names = [];
        LOG.trace("get_all_namespaces: Item [{}]", item_name);
        MetadataRegistry.getAll()
            .stream()
            .filter(function(metadata) {
                return metadata.UID.itemName === item_name;
            })
            .forEach(function(metadata) {
                namespace_names.push(metadata.UID.namespace);
            });

        return namespace_names;
    };

    /**
     * This function will return the Metadata object associated with the
     * specified Item and namespace.
     *
     * @param {string} item_name - name of the Item
     * @param {string} namespace - name of the namespace
     *
     * @returns {*} Metadata object containing the namespace ``value`` and
     *     ``configuration`` dictionary or ``null`` if the namespace or Item
     *     do not exist
     */
    context.get_metadata = function(item_name, namespace) {
        LOG.trace("get_metadata: Item [{}], namespace [{}]", item_name, namespace);
        return MetadataRegistry.get(new MetadataKey(namespace, item_name));
    };

    /**
     * This function removes the Item metadata for the specified namespace or
     * all namespaces if omitted.
     *
     * @param {string} item_name - name of the item
     * @param {string=} namespace - name of the namespace or all if omitted
     */
    context.remove_metadata = function(item_name, namespace) {
        if (namespace) {
            LOG.trace("remove_metadata: Item [{}], namespace [{}]", item_name, namespace);
            MetadataRegistry.remove(new MetadataKey(namespace, item_name));
        } else {
            LOG.trace("remove_metadata (all): Item [{}]", item_name);
            MetadataRegistry.removeItemMetadata(item_name);
        }
    };

    /**
     * This function creates or modifies Item metadata, optionally overwriting
     * the existing data. If not overwriting, the provided keys and values will
     * be overlaid on top of the existing keys and values.
     *
     * @param {string} item_name - name of the Item
     * @param {string} namespace - name of the namespace
     * @param {object} configuration - dictionary style object containing the configuration
     * @param {string=} value - new namespace value
     * @param {boolean=} overwrite - if ``true`` existing namespace data will be discarded
     */
    context.set_metadata = function(item_name, namespace, configuration, value, overwrite) {
        overwrite = overwrite || false;
        value = (value !== undefined && value !== null) ? value : null;
        if (overwrite) {
            context.remove_metadata(item_name, namespace);
        }
        var metadata = context.get_metadata(item_name, namespace);
        if (metadata === null || overwrite) {
            LOG.trace(
                "set_metadata: adding or overwriting metadata namespace with "
                + "[value: {}, configuration: {}]: Item [{}], namespace [{}]",
                [value, JSON.stringify(configuration), item_name, namespace]
            );
            MetadataRegistry.add(new Metadata(
                new MetadataKey(namespace, item_name), value, configuration
            ));
        } else {
            if (value === null) {
                value = metadata.value;
            }
            var new_configuration = merge_configuration(metadata.configuration, configuration);
            LOG.trace(
                "set_metadata: setting metadata namespace to "
                + "[value: {}, configuration: {}]: Item [{}], namespace [{}]",
                [value, JSON.stringify(new_configuration), item_name, namespace]
            );
            MetadataRegistry.update(new Metadata(
                new MetadataKey(namespace, item_name), value, new_configuration
            ));
        }
    };

    /**
     * This function will return the Item metadata ``value`` for the specified
     * namespace.
     *
     * @param {string} item_name - name of the Item
     * @param {string} namespace - name of the namespace
     *
     * @returns {string|undefined} namespace value or ``undefined`` if namespace
     *     or Item do not exist
     */
    context.get_value = function(item_name, namespace) {
        LOG.trace("get_value: Item [{}], namespace [{}]", item_name, namespace);
        var metadata = context.get_metadata(item_name, namespace);
        if (metadata) {
            return metadata.value;
        } else {
            return undefined;
        }
    };

    /**
     * This function creates or updates the Item metadata ``value`` for the
     * specified namespace.
     *
     * @param {string} item_name - name of the Item
     * @param {string} namespace - name of the namespace
     * @param {string} value - new or updated value for the namespace
     */
    context.set_value = function(item_name, namespace, value) {
        LOG.trace(
            "set_value: Item [{}], namespace [{}], value [{}]",
            [item_name, namespace, value]
        );
        var metadata = context.get_metadata(item_name, namespace);
        if (metadata) {
            context.set_metadata(item_name, namespace, metadata.configuration, value, true);
        } else {
            context.set_metadata(item_name, namespace, {}, value);
        }
    };

    /**
     * This function returns the ``configuration`` value for the specified key.
     *
     * @param {string} item_name - name of the Item
     * @param {string} namespace - name of the namespace
     * @param {string} key - ``configuration`` key to return the value of
     *
     * @returns {*|undefined} ``configuration`` key value or ``undefined`` if
     *     key, metadata, or Item do not exist
     */
    context.get_key_value = function(item_name, namespace, key) {
        LOG.trace(
            "get_key_value: Item [{}], namespace [{}], key [{}]",
            [item_name, namespace, key]
        );
        var metadata = context.get_metadata(item_name, namespace);
        if (metadata) {
            return metadata.configuration[key];
        } else {
            return undefined;
        }
    };

    /**
     * This function creates or updates a ``configuration`` value in the
     * specified namespace.
     *
     * @param {string} item_name - name of the Item
     * @param {string} namespace - name of the namespace
     * @param {string} key - ``configuration`` key to create or update
     * @param {*} value - value to set for ``configuration`` key
     */
    context.set_key_value = function(item_name, namespace, key, value) {
        LOG.trace(
            "set_key_value: Item [{}], namespace [{}], key [{}], value [{}]",
            [item_name, namespace, key, value]
        );
        var metadata = context.get_metadata(item_name, namespace);
        var new_configuration = {};
        new_configuration[key] = value;
        if (metadata) {
            new_configuration = merge_configuration(metadata.configuration, new_configuration);
        }
        context.set_metadata(item_name, namespace, new_configuration);
    };

    /**
     * This function removes a ``configuration`` key and its value from the
     * specified namespace.
     *
     * @param {string} item_name - name of the Item
     * @param {string} namespace - name of the namespace
     * @param {string} key - ``configuration`` key to remove
     */
    context.remove_key_value = function(item_name, namespace, key) {
        LOG.trace(
            "remove_key_value: Item [{}], namespace [{}], key [{}]",
            [item_name, namespace, key]
        );
        var metadata = context.get_metadata(item_name, namespace);
        if (metadata) {
            var new_configuration = merge_configuration(metadata.configuration, {});
            new_configuration.delete(key);
            context.set_metadata(item_name, namespace, new_configuration, metadata.value, true);
        } else {
            LOG.trace(
                "remove_key_value: metadata does not exist: Item [{}], namespace [{}]",
                [item_name, namespace]
            );
        }
    };

})(this);
