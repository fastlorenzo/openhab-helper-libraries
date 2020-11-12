/**
 * This module allows runtime creation and removal of items. It will also
 * remove any links from an Item before it is removed.
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

    var ItemBuilderFactory = (
        get_service("org.openhab.core.items.ItemBuilderFactory")
        || get_service("org.eclipse.smarthome.core.items.ItemBuilderFactory")
    );

    var ManagedItemProvider = (
        get_service("org.openhab.core.items.ManagedItemProvider")
        || get_service("org.eclipse.smarthome.core.items.ManagedItemProvider")
    );

    try {
        var GenericItem = Java.type("org.openhab.core.items.GenericItem");
    } catch(e) {
        /* eslint-disable no-redeclare */
        var GenericItem = Java.type("org.eclipse.smarthome.core.items.GenericItem");
        /* eslint-enable no-redeclare */
    }

    var Set = Java.type("java.util.HashSet");

    var LOG = getLogger(LOG_PREFIX + ".core.items");


    /**
     * Adds an Item using a ManagedItemProvider
     *
     * @param {*} item_or_item_name - Item object or name for the Item to create
     * @param {string?} item_type - the type of the item, optional if an Item
     *   object is given for ``item_or_item_name``
     * @param {string?} category - the category (icon) for the Item
     * @param {string[]?} groups - a list of groups the Item is a member of
     * @param {string?} label - the label for the Item
     * @param {string[]?} tags - a list of tags for the Item
     * @param {string?} gi_base_type - the group Item base type for the Item
     * @param {*?} group_function - the group function used be the Item
     *
     * @returns the Item that was created or null
     *
     * @throws {TypeError} if ``item_or_item_name`` is not a string or Item,
     *   or if ``item_or_item_name`` is not an Item and ``item_type`` is not
     *   provided
     */
    context.add_item = function (
        item_or_item_name,
        item_type,
        category,
        groups,
        label,
        tags,
        gi_base_type,
        group_function
    ){
        try {
            if (!(typeof item_or_item_name === "string") && !(item_or_item_name instanceof GenericItem)) {
                throw TypeError("'" + item_or_item_name + "' is not a string or Item");
            }
            var item = item_or_item_name;
            if (typeof item_or_item_name === "string") {
                var item_name = item_or_item_name;
                if (!item_type) {
                    throw TypeError("Must provide 'item_type' when creating an Item by name");
                }
                var base_item = item_type !== "Group" || !gi_base_type
                    ? null
                    : ItemBuilderFactory.newItemBuilder(
                        gi_base_type, item_name + "_baseItem"
                    ).build();
                group_function = item_type !== "Group" ? null : group_function;
                item = ItemBuilderFactory.newItemBuilder(item_type, item_name)
                    .withCategory(category || null)
                    .withGroups(groups || null)
                    .withLabel(label || null)
                    .withBaseItem(base_item || null)
                    .withGroupFunction(group_function || null)
                    .withTags(tags ? new Set(tags) : null)
                    .build();
            }

            ManagedItemProvider.add(item);
            LOG.debug("Item added: [{}]", item);
            return item;
        } catch(e) {
            LOG.error(get_stacktrace(e, "add_item"));
            return null;
        }
    };
})(this);
