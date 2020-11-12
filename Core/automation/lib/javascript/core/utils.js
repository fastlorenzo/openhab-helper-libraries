/**
 *
 *
 * @copyright Copyright (c) 2020
 *
 * @author openHAB Scripters Contributors - Jython libraries
 * @author Michael Murton - port to ES5
 */

/**
 * Inject a format method to the ``String`` prototype to allow formatting
 * like ``"{0} is {1}".format("this", "formatted");`` or with named keys like
 * ``"{key1} is {key2}".format({key1: "this", key2: "formatted"});``.
 */
String.prototype.format = function() {
    var args = arguments;
    if (args[0] instanceof Object && args.length === 1) {
        // only 1 arg and it's an Object, assume named keys on an Object
        args = args[0];
    }
    return this.replace(/{(\w+)}/g, function(match, key) {
        return typeof args[key] !== 'undefined' ? args[key] : match;
    });
};

(function (context) {
    var OPENHAB_CONF = Java.type("java.lang.System").getProperty("openhab.conf");
    var JS_PATH = OPENHAB_CONF + "/automation/lib/javascript";

    load(JS_PATH + "/core/log.js");

    var UUID = Packages.java.util.UUID;

    try{
        var ChannelUID = Java.type("org.openhab.core.thing.ChannelUID");
    } catch(e) {
        /* eslint-disable no-redeclare */
        var ChannelUID = Java.type("org.eclipse.smarthome.core.thing.ChannelUID");
        /* eslint-enable no-redeclare */
    }

    var LOG = getLogger(LOG_PREFIX + ".core.utils");


    /**
     * This function validates whether an Item exists or if an Item name is valid.
     *
     * @param {*} item_or_item_name - Item or name
     *
     * @returns {*} ``null`` if the Item does not exist or the Item name is not
     *     in a valid format, otherwise returns the Item
     */
    context.validate_item = function(item_or_item_name) {
        var item = item_or_item_name;
        if (typeof item === "string") {
            if (itemRegistry.getItems(item) === []) {
                LOG.warn("'{}' is not in the itemRegistry", item);
                return null;
            } else {
                item = itemRegistry.getItem(item_or_item_name);
            }
        } else if (item.name === undefined) {
            LOG.warn("'{}' is not and Item or string", item);
            return null;
        }
        if (itemRegistry.getItems(item.name) === []) {
            LOG.warn("'{}' is not in the itemRegistry", item.name);
            return null;
        }
        return item;
    };

    /**
     * This function validates whether a ChannelUID exists or if a ChannelUID
     * is valid.
     *
     * @param {*} channel_uid_or_string - the ChannelUID
     *
     * @returns {*} ``null`` if the ChannelUID does not exist or the ChannelUID
     *     is not in a valid format, otherwise the validated ChannelUID
     */
    context.validate_channel_uid = function(channel_uid_or_string) {
        var channel_uid = channel_uid_or_string;
        if (typeof channel_uid === "string") {
            channel_uid = new ChannelUID(channel_uid);
        } else if (!(channel_uid instanceof ChannelUID)) {
            LOG.warn("'{}' is not a string or ChannelUID", channel_uid);
            return null;
        }
        if (things.getChannel(channel_uid)) {
            LOG.warn("'{}' is not a valid channel", channel_uid);
            return null;
        }
        return channel_uid;
    };

    /**
     * This function validates UIDs.
     *
     * @param {string=} uid - the UID to validate
     *
     * @returns {string} a valid UID
     */
    context.validate_uid = function (uid) {
        if (!uid) {
            uid = UUID.randomUUID().toString();
        } else {
            while (uid.match(/[^A-Za-z0-9_-]/)) {
                uid = uid.replace(/[^A-Za-z0-9_-]/, "_");
            }
            uid = uid + UUID.randomUUID().toString();
        }
        if (!uid.match(/^[A-Za-z0-9]/)) {
            uid = "javascript" + uid;
        }
        while (uid.match(/__+/)) {
            uid = uid.replace(/__+/, "_");
        }
        return uid;
    };

})(this);
