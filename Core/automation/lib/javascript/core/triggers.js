/**
 * This module provides trigger builders and the ``when`` decorator to
 * simplify making JavaScript rules.
 *
 * - **CronTrigger** - fires based on cron expression
 * - **ItemStateChangeTrigger** - fires when the specified Item's State changes
 * - **ItemStateUpdateTrigger** - fires when the specified Item's State is updated
 * - **ItemCommandTrigger** - fires when the specified Item receives a Command
 * - **GenericEventTrigger** - fires when the specified Event occurs
 * - **ItemEventTrigger** - fires when an Item reports an Event (based on ``GenericEventTrigger``)
 * - **ThingEventTrigger** - fires when a Thing reports an Event (based on ``GenericEventTrigger``)
 * - **ThingStatusChangeTrigger** - fires when the specified Thing's status changes **(requires S1636, 2.5M2 or newer)**
 * - **ThingStatusUpdateTrigger** - fires when the specified Thing's status is updated **(requires S1636, 2.5M2 or newer)**
 * - **ChannelEventTrigger** - fires when a Channel reports an Event
 * - **DirectoryEventTrigger** - fires when a directory's contents changes
 * - **ItemRegistryTrigger** - fires when the specified Item registry Event occurs
 * - **ItemAddedTrigger** - fires when an Item is added (based on ``ItemRegistryTrigger``)
 * - **ItemRemovedTrigger** - fires when an Item is removed (based on ``ItemRegistryTrigger``)
 * - **ItemUpdatedTrigger** - fires when an Item is updated (based on ``ItemRegistryTrigger``)
 * - **StartupTrigger** - fires when the rule is activated **(not working at the moment)**
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
    load(JS_PATH + "/core/osgi.js");
    load(JS_PATH + "/core/utils.js");
    scriptExtension.importPreset("RuleSupport");

    var HashMap = Java.type("java.util.HashMap");
    var ENTRY_CREATE = Java.type("java.nio.file.StandardWatchEventKinds").ENTRY_CREATE;
    var ENTRY_DELETE = Java.type("java.nio.file.StandardWatchEventKinds").ENTRY_DELETE;
    var ENTRY_MODIFY = Java.type("java.nio.file.StandardWatchEventKinds").ENTRY_MODIFY;

    try {
        var isValidExpression = Java.type("org.quartz.CronExpression").isValidExpression;
    } catch(e) {
        /* eslint-disable no-redeclare */
        // Quartz is not used in OH3.0 but trigger builder will fail on invalid expr
        var isValidExpression = function() { return true; };
        /* eslint-enable no-redeclare */
    }

    try{
        var ChannelUID = Java.type("org.openhab.core.thing.ChannelUID");
        var ThingUID = Java.type("org.openhab.core.thing.ThingUID");
        var ThingStatus = Java.type("org.openhab.core.thing.ThingStatus");
        var ChannelKind = Java.type("org.openhab.core.thing.type.ChannelKind");
    } catch(e) {
        /* eslint-disable no-redeclare */
        var ChannelUID = Java.type("org.eclipse.smarthome.core.thing.ChannelUID");
        var ThingUID = Java.type("org.eclipse.smarthome.core.thing.ThingUID");
        var ThingStatus = Java.type("org.eclipse.smarthome.core.thing.ThingStatus");
        var ChannelKind = Java.type("org.eclipse.smarthome.core.thing.type.ChannelKind");
        /* eslint-enable no-redeclare */
    }

    try{
        var TypeParser = Java.type("org.eclipse.smarthome.core.types.TypeParser");
    } catch(e) {
        /* eslint-disable no-redeclare */
        var TypeParser = Java.type("org.openhab.core.types.TypeParser");
        /* eslint-enable no-redeclare */
    }

    var LOG = getLogger(LOG_PREFIX + ".core.triggers");


    /**
     * This builder returns an ItemStateUpdateTrigger Module to be used when
     * creating a Rule.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ItemStateUpdateTrigger("MyItem", "ON", "MyItem-received-update-ON")];
     *       MyRule.triggers.push(ItemStateUpdateTrigger("MyOtherItem", "OFF", "MyOtherItem-received-update-ON"));
     *
     * @param {string} item_name - name of item to watch for updates
     * @param {string=} state - trigger only when updated TO this state
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} ItemStateUpdateTrigger Module instance
     */
    context.ItemStateUpdateTrigger = function (item_name, state, trigger_name) {
        var configuration = new HashMap();
        configuration.put("itemName", item_name);
        if (state !== null) {
            configuration.put("state", state);
        }
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("core.ItemStateUpdateTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This builder returns an ItemStateChangeTrigger Module to be used when
     * creating a Rule.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ItemStateChangeTrigger("MyItem", "OFF", "ON", "MyItem-changed-from-OFF-to-ON")];
     *       MyRule.triggers.push(ItemStateChangeTrigger("MyOtherItem", "ON", "OFF", "MyOtherItem-changed-from-ON-to-OFF"));
     *
     * @param {string} item_name - name of item to watch for changes
     * @param {string=} previous_state - trigger only when changing FROM this
     * @param {string=} state - trigger only when changing TO this state
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} ItemStateChangeTrigger Module instance
     */
    context.ItemStateChangeTrigger = function (item_name, previous_state, state, trigger_name) {
        var configuration = new HashMap();
        configuration.put("itemName", item_name);
        if (previous_state !== null) {
            configuration.put("previousState", previous_state);
        }
        if (state !== null) {
            configuration.put("state", state);
        }
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("core.ItemStateChangeTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This builder returns an ItemCommandTrigger Module to be used when
     * creating a Rule.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ItemCommandTrigger("MyItem", "ON", "MyItem-received-command-ON")];
     *       MyRule.triggers.push(ItemCommandTrigger("MyOtherItem", "OFF", "MyOtherItem-received-command-ON"));
     *
     * @param {string} item_name - name of item to watch for commands
     * @param {string=} command - trigger only when this command is received
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} ItemCommandTrigger Module instance
     */
    context.ItemCommandTrigger = function (item_name, command, trigger_name) {
        var configuration = new HashMap();
        configuration.put("itemName", item_name);
        if (command !== null) {
            configuration.put("command", command);
        }
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("core.ItemCommandTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This builder returns a ThingStatusUpdateTrigger Module to be used when
     * creating a Rule.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ThingStatusUpdateTrigger("kodi:kodi:familyroom", "ONLINE")];
     *       MyRule.triggers.push(ThingStatusUpdateTrigger("kodi:kodi:familyroom", "ONLINE"));
     *
     * @param {string} thing_uid - name of the Thing to watch for status updates
     * @param {string=} status - trigger only when Thing is updated to this status
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} ThingStatusUpdateTrigger Module instance
     */
    context.ThingStatusUpdateTrigger = function (thing_uid, status, trigger_name) {
        var configuration = new HashMap();
        configuration.put("thingUID", thing_uid);
        if (status !== null) {
            configuration.put("status", status);
        }
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("core.ThingStatusUpdateTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This builder returns a ThingStatusChangeTrigger Module to be used when
     * creating a Rule.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ThingStatusChangeTrigger("kodi:kodi:familyroom", "ONLINE", "OFFLINE")];
     *       MyRule.triggers.push(ThingStatusChangeTrigger("kodi:kodi:familyroom", "OFFLINE", "ONLINE"));
     *
     * @param {string} thing_uid - name of the Thing to watch for status changes
     * @param {string=} previous_status - trigger only when Thing is changed
     *      from this status
     * @param {string=} status - trigger only when Thing is changed to this status
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} ThingStatusChangeTrigger Module instance
     */
    context.ThingStatusChangeTrigger = function (thing_uid, previous_status, status, trigger_name) {
        var configuration = new HashMap();
        configuration.put("thingUID", thing_uid);
        if (previous_status !== null) {
            configuration.put("previousStatus", previous_status);
        }
        if (status !== null) {
            configuration.put("status", status);
        }
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("core.ThingStatusChangeTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This builder returns a ChannelEventTrigger Module to be used when
     * creating a Rule.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ChannelEventTrigger("astro:sun:local:eclipse#event", "START", "solar-eclipse-event-start")];
     *       MyRule.triggers.push(ChannelEventTrigger("astro:sun:local:eclipse#event", "START", "solar-eclipse-event-start"));
     *
     * @param {string} channel_uid - name of the Channel to watch for events
     * @param {string=} event - trigger only when Channel triggers this event
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} ChannelEventTrigger Module instance
     */
    context.ChannelEventTrigger = function (channel_uid, event, trigger_name) {
        var configuration = new HashMap();
        configuration.put("channelUID", channel_uid);
        if (event !== null) {
            configuration.put("event", event);
        }
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("core.ChannelEventTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This builder returns a GenericEventTrigger Module to be used when
     * creating a Rule. It allows you to trigger on any event that comes
     * through the Event Bus. It's one of the most powerful triggers, but it
     * is also the most complicated to configure.
     *
     * @param {string} event_source - source to watch for trigger events
     * @param {string|string[]} event_types - types of events to watch
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} GenericEventTrigger Module instance
     *
     * @author Michael Murton - fix event triggers (ESH merge or OH3 change broke them)
     */
    context.GenericEventTrigger = function (event_source, event_types, trigger_name) {
        var configuration = new HashMap();
        configuration.put("eventTopic", "openhab/*");
        configuration.put("eventSource", "openhab/" + event_source + "/");
        configuration.put("eventTypes", event_types instanceof Array ? event_types.join(",") : event_types);
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("core.GenericEventTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This builder returns a GenericEventTrigger but simplifies it a bit for
     * use with Items. The available Item ``eventTypes`` are:
     *
     * - ItemStateEvent
     * - ItemStatePredictedEvent
     * - ItemCommandEvent
     * - ItemStateChangedEvent
     * - GroupItemStateChangedEvent
     * - ItemAddedEvent
     * - ItemUpdatedEvent
     * - ItemRemovedEvent
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ItemEventTrigger("MyItem", "ItemStateEvent")];
     *       MyRule.triggers.push(ItemEventTrigger("MyItem", "ItemStateEvent"));
     *
     * @param {string|string[]} event_types - types of events to watch for
     * @param {string=} item_name - item name to filter events for
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} GenericEventTrigger Module instance
     */
    context.ItemEventTrigger = function (event_types, item_name, trigger_name) {
        return context.GenericEventTrigger(
            "items" + (item_name ? "/" + item_name : ""),
            event_types,
            trigger_name
        );
    };

    /**
     * This builder returns a GenericEventTrigger pre-configured for
     * ItemAddedEvents, you can optionally filter by Item name.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ItemAddedTrigger()];
     *       MyRule.triggers.push(ItemAddedTrigger());
     *
     * @param {string=} item_name - item name to filter events for
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} GenericEventTrigger Module instance
     *
     * @author Michael Murton - initial contribution
     */
    context.ItemAddedTrigger = function (item_name, trigger_name) {
        // event.topic = "openhab/items/{ITEM_NAME}/added"
        // event.payload = Item properties as JSON
        // event.item = org.openhab.core.items.dto.ItemDTO instance
        // event.getItem() -> returns item instance from ItemDTO
        return context.ItemEventTrigger(
            "ItemAddedEvent",
            item_name,
            trigger_name
        );
    };

    /**
     * This builder returns a GenericEventTrigger pre-configured for
     * ItemRemovedEvents, you can optionally filter by Item name.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ItemRemovedTrigger()];
     *       MyRule.triggers.push(ItemRemovedTrigger());
     *
     * @param {string=} item_name - item name to filter events for
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} GenericEventTrigger Module instance
     *
     * @author Michael Murton - initial contribution
     */
    context.ItemRemovedTrigger = function (item_name, trigger_name) {
        // event.topic = "openhab/items/{ITEM_NAME}/removed"
        // event.payload = Item properties as JSON
        // event.item = org.openhab.core.items.dto.ItemDTO instance
        // event.getItem() -> returns item instance from ItemDTO
        return context.ItemEventTrigger(
            "ItemRemovedEvent",
            item_name,
            trigger_name
        );
    };

    /**
     * This builder returns a GenericEventTrigger pre-configured for
     * ItemUpdatedEvents, you can optionally filter by Item name.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ItemUpdatedTrigger()];
     *       MyRule.triggers.push(ItemUpdatedTrigger());
     *
     * @param {string=} item_name - item name to filter events for
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} GenericEventTrigger Module instance
     *
     * @author Michael Murton - initial contribution
     */
    context.ItemUpdatedTrigger = function (item_name, trigger_name) {
        // event.topic = "openhab/items/{ITEM_NAME}/updated"
        // event.payload = Array of [JSON{new properties}, JSON{old properties}]
        // event.item = org.openhab.core.items.dto.ItemDTO instance
        // event.getItem() -> returns item instance from ItemDTO
        return context.ItemEventTrigger(
            "ItemUpdatedEvent",
            item_name,
            trigger_name
        );
    };

    /**
     * This builder returns a GenericEventTrigger but simplifies it a bit for
     * use with Things. The available Thing ``eventTypes`` are:
     *
     * - ThingStatusInfoChangedEvent
     * - ThingStatusInfoEvent
     * - ThingAddedEvent
     * - ThingUpdatedEvent
     * - ThingRemovedEvent
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [ThingEventTrigger("kodi:kodi:familyroom", "ThingStatusInfoEvent")];
     *       MyRule.triggers.push(ThingEventTrigger("kodi:kodi:familyroom", "ThingStatusInfoEvent"));
     *
     * @param {string|string[]} event_types - types of events to watch for
     * @param {string=} thing_uid - name of Thing to filter events for
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} GenericEventTrigger Module instance
     */
    context.ThingEventTrigger = function (event_types, thing_uid, trigger_name) {
        return context.GenericEventTrigger(
            "things" + (thing_uid ? "/" + thing_uid : ""),
            event_types,
            trigger_name
        );
    };

    /**
     * This builder returns a GenericCronTrigger Module to be used when
     * creating a Rule.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [CronTrigger("0 55 17 * * ?")];
     *       MyRule.triggers.push(CronTrigger("0 55 17 * * ?"));
     *
     * @param {string} cron_expression - a valid `cron expression <http://www.quartz-scheduler.org/documentation/quartz-2.2.2/tutorials/tutorial-lesson-06.html>`_
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} GenericCronTrigger Module instance
     */
    context.CronTrigger = function (cron_expression, trigger_name) {
        var configuration = new HashMap();
        configuration.put("cronExpression", cron_expression);
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("timer.GenericCronTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This builder returns a StartupTrigger Module to be used when
     * creating a Rule.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       MyRule.triggers = [StartupTrigger()];
     *       MyRule.triggers.push(StartupTrigger());
     *
     * @param {string=} trigger_name - name of this trigger
     *
     * @returns {*} StartupTrigger Module instance
     *
     * @author Michael Murton - fixed in OH3 (not working for a long time)
     */
    context.StartupTrigger = function (trigger_name) {
        var configuration = new HashMap();
        configuration.put("startlevel", 20); // 20 is rules
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("core.SystemStartlevelTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     *
     * @param {*} path
     * @param {*} event_kinds
     * @param {*} watch_subdirectories
     */
    context.DirectoryEventTrigger = function (path, event_kinds, watch_subdirectories, trigger_name) {
        var configuration = new HashMap();
        configuration.put("path", path);
        configuration.put("event_kinds", String(event_kinds) || ([ENTRY_CREATE, ENTRY_DELETE, ENTRY_MODIFY]));
        configuration.put("watch_subdirectories", watch_subdirectories);
        return TriggerBuilder.create()
            .withId(validate_uid(trigger_name))
            .withTypeUID("jsr223.DirectoryTrigger")
            .withConfiguration(new Configuration(configuration))
            .build();
    };

    /**
     * This decorator creates a ``triggers`` attribute in the decorated
     * function that is used by the ``rule`` decorator when creating a rule.
     *
     * The ``when`` decorator simplifies the use of many of the triggers in
     * this modules and allows for them to be used with natural language
     * similar to what is used in the rules DSL.
     *
     * @example
     *     .. code-block:: javascript
     *
     *       when("Time cron 55 55 5 * * ?")(MyRule);
     *       when("Item Test_String_1 changed from 'old test string' to 'new test string'")(MyRule);
     *       when("Item gMotion_Sensors changed")(MyRule);
     *       when("Member of gMotion_Sensors changed from ON to OFF")(MyRule);
     *       when("Descendent of gContact_Sensors changed from OPEN to CLOSED")(MyRule);
     *       when("Item Test_Switch_2 received updated ON")(MyRule);
     *       when("Item Test_Switch_1 received command OFF")(MyRule);
     *       when("Item added")(MyRule);
     *       when("Item Test_Switch_2 modified")(MyRule);
     *       when("Thing kodi:kodi:familyroom changed")(MyRule);
     *       when("Thing kodi:kodi:familyroom changed from ONLINE to OFFLINE")(MyRule);
     *       when("Thing kodi:kodi:familyroom received update ONLINE")(MyRule);
     *       when("Thing added")(MyRule);
     *       when("Thing kodi:kodi:familyroom modified")(MyRule);
     *       when("Channel astro:sun:local:eclipse#event triggered START")(MyRule);
     *       when("System started")(MyRule);
     *
     * @param {string} expr - the rules DSL-like formatted trigger expression to parse
     *
     * @author Scott Rushworth - initial contribution
     * @author Michael Murton - update Item+Thing Added-Updated-Removed expressions
     */
    context.when = function (expr) {
        function add_trigger(func, trigger) {
            if (!func.triggers) {
                func.triggers = [];
            }
            func.triggers.push(trigger);
            return func;
        }

        try {
            // eslint-disable-next-line no-inner-declarations
            function item_trigger(func) {
                var item = itemRegistry.getItem(trigger_target);
                var group_members = [];
                if (target_type === "Member of") {
                    group_members = Java.from(item.getMembers());
                } else if (target_type === "Descendent of") {
                    group_members = Java.from(item.getAllMembers());
                } else {
                    group_members.push(item);
                }
                group_members.forEach(function(member) {
                    var trigger;
                    trigger_name = (
                        "Item-" + member.name + "-" + trigger_type.replace(" ", "-")
                        + (old_state !== null ? ("-from-" + old_state) : "")
                        + (new_state !== null && trigger_type === "changed" ? "-to-" : "")
                        + (new_state !== null && trigger_type === "received update" ? "-" : "")
                        + (new_state !== null ? new_state : "")
                    );
                    trigger_name = validate_uid(trigger_name);
                    if (trigger_type === "received update") {
                        trigger = context.ItemStateUpdateTrigger(
                            member.name, new_state, trigger_name
                        );
                    } else if (trigger_type === "received command") {
                        trigger = context.ItemCommandTrigger(
                            member.name, new_state, trigger_name
                        );
                    } else {
                        trigger = context.ItemStateChangeTrigger(
                            member.name, old_state, new_state, trigger_name
                        );
                    }
                    LOG.trace("when: Created item_trigger: '{}'", trigger_name);
                    func = add_trigger(func, trigger);
                });
                return func;
            }

            // eslint-disable-next-line no-inner-declarations
            function item_event_trigger(func) {
                var event_names = {
                    "added": "ItemAddedEvent",
                    "removed": "ItemRemovedEvent",
                    "modified": "ItemUpdatedEvent"
                };
                var trigger = context.ItemEventTrigger(
                    event_names[trigger_type],
                    trigger_target || null,
                    trigger_name
                );
                LOG.trace("when: Created item_event_trigger: '{}'", trigger_name);
                return add_trigger(func, trigger);
            }

            // eslint-disable-next-line no-inner-declarations
            function cron_trigger(func) {
                var trigger = context.CronTrigger(trigger_type, trigger_name);
                LOG.trace("when: Created cron_trigger: '{}'", trigger_name);
                return add_trigger(func, trigger);
            }

            // eslint-disable-next-line no-inner-declarations
            function system_trigger(func) {
                var trigger = context.StartupTrigger(trigger_name);
                LOG.trace("when: Created system_trigger: '{}'", trigger_name);
                return add_trigger(func, trigger);
            }

            // eslint-disable-next-line no-inner-declarations
            function thing_trigger(func) {
                var trigger;
                if (new_state !== null || old_state !== null) {
                    if (trigger_type === "changed") {
                        trigger = context.ThingStatusChangeTrigger(
                            trigger_target, old_state, new_state, trigger_name
                        );
                    } else {
                        trigger = context.ThingStatusUpdateTrigger(
                            trigger_target, new_state, trigger_name
                        );
                    }
                } else {
                    trigger = context.ThingEventTrigger(
                        trigger_type === "changed" ? "ThingStatusInfoChangedEvent" : "ThingStatusInfoEvent",
                        trigger_target,
                        trigger_name
                    );
                }
                LOG.trace("when: Created thing_trigger: '{}'", trigger_name);
                return add_trigger(func, trigger);
            }

            // eslint-disable-next-line no-inner-declarations
            function thing_event_trigger(func) {
                var event_names = {
                    "added": "ThingAddedEvent",
                    "removed": "ThingRemovedEvent",
                    "modified": "ThingUpdatedEvent"
                };
                var trigger = context.ThingEventTrigger(
                    event_names[trigger_type],
                    trigger_target || null,
                    trigger_name
                );
                LOG.trace("when: Created thing_event_trigger: '{}'", trigger_name);
                return add_trigger(func, trigger);
            }

            // eslint-disable-next-line no-inner-declarations
            function channel_trigger(func) {
                var trigger = context.ChannelEventTrigger(
                    trigger_target, new_state, trigger_name
                );
                LOG.trace("when: Created channel_trigger: '{}'", trigger_name);
                return add_trigger(func, trigger);
            }

            var target_type = null;
            var trigger_target = null;
            var trigger_type = null;
            var trigger_name = null;
            var old_state = null;
            var new_state = null;

            var input_list = expr.split(" ");
            if (input_list.length > 1) {
                // target_type trigger_target [trigger_type] [from] [old_state] [to] [new_state]
                while (input_list.length) {
                    if (target_type === null) {
                        if (~["Member of", "Descendent of"].indexOf(input_list.slice(0, 2).join(" "))) {
                            target_type = input_list.splice(0, 2).join(" ");
                        } else {
                            target_type = input_list.splice(0, 1).join("");
                        }
                    } else if (trigger_target === null) {
                        if (target_type === "System" && input_list.length > 1) {
                            if (input_list.slice(0, 2).join(" ") === "shuts down") {
                                trigger_target = input_list.splice(0, 2).join(" ");
                            } else {
                                trigger_target = input_list.splice(0, 1).join("");
                            }
                        } else if (~["Item", "Thing"].indexOf(target_type) && input_list.length === 1) {
                            trigger_target = "";
                        } else {
                            trigger_target = input_list.splice(0, 1).join("");
                        }
                    } else if (trigger_type === null) {
                        if (input_list.slice(0, 2).join(" ") === "received update") {
                            if (~["Item", "Thing", "Member of", "Descendent of"].indexOf(target_type)) {
                                trigger_type = input_list.splice(0, 2).join(" ");
                            } else {
                                throw RangeError(
                                    "when: '" + expr + "' could not be parsed. "
                                    + "'received update' is invalid for target_type '"
                                    + trigger_type + "'"
                                );
                            }
                        } else if (input_list.slice(0, 2).join(" ") === "received command") {
                            if (~["Item", "Member of", "Descendent of"].indexOf(target_type)) {
                                trigger_type = input_list.splice(0, 2).join(" ");
                            } else {
                                throw RangeError(
                                    "when: '" + expr + "' could not be parsed. "
                                    + "'received command' is invalid for target_type '"
                                    + target_type + "'"
                                );
                            }
                        } else if (input_list[0] === "changed") {
                            if (~["Item", "Thing", "Member of", "Descendent of"].indexOf(target_type)) {
                                trigger_type = input_list.splice(0, 1).join("");
                            } else {
                                throw RangeError(
                                    "when: '" + expr + "' could not be parsed. "
                                    + "'changed' is invalid for target_type '"
                                    + target_type + "'"
                                );
                            }
                        } else if (input_list[0] === "triggered") {
                            if (target_type === "Channel") {
                                trigger_type = input_list.splice(0, 1).join("");
                            } else {
                                throw RangeError(
                                    "when: '" + expr + "' could not be parsed. "
                                    + "'triggered' is invalid for target_type '"
                                    + target_type + "'"
                                );
                            }
                        } else if (trigger_target === "cron") {
                            if (target_type === "Time") {
                                trigger_type = input_list.splice(0, input_list.length).join(" ");
                                if (!isValidExpression(trigger_type)) {
                                    throw RangeError(
                                        "when: '" + expr + "' could not be parsed. "
                                        + "'" + trigger_type + "' is not a valid "
                                        + "cron expression. See "
                                        + "http://www.quartz-scheduler.org/documentation/quartz-2.1.x/tutorials/tutorial-lesson-06"
                                    );
                                }
                            } else {
                                throw RangeError(
                                    "when: '" + expr + "' could not be parsed. "
                                    + "'cron' is invalid for target_type '"
                                    + target_type + "'"
                                );
                            }
                        } else if (~["added", "removed", "modified"].indexOf(input_list[0])) {
                            if (~["Item", "Thing"].indexOf(target_type)) {
                                trigger_type = input_list.splice(0, 1).join("");
                            } else {
                                throw RangeError(
                                    "when: '" + expr + "' could not be parsed. "
                                    + "'" + input_list[0] +  "' is invalid for "
                                    + "target_type '" + target_type + "'"
                                );
                            }
                        } else {
                            throw RangeError(
                                "when: '" + expr + "' could not be parsed because the trigger_type "
                                + (input_list[0] === null ? "is missing" : "'" + input_list[0] + "' is invalid")
                            );
                        }
                    } else {
                        if (old_state === null && trigger_type === "changed" && input_list[0] === "from") {
                            input_list.splice(0, 1);
                            old_state = input_list.splice(0, 1).join("");
                        } else if (new_state === null && trigger_type === "changed" && input_list[0] === "to") {
                            input_list.splice(0, 1);
                            new_state = input_list.splice(0, 1).join("");
                        } else if (new_state === null && ~["received update", "received command"].indexOf(trigger_type)) {
                            new_state = input_list.splice(0, 1).join("");
                        } else if (new_state === null && target_type === "Channel") {
                            new_state = input_list.splice(0, 1).join("");
                        } else if (input_list.length) {
                            // there are no more possible combinations, but there is more data
                            throw RangeError(
                                "when: '" + expr + "' could not be parsed. '"
                                + input_list.join(" ") + "' is invalid for '"
                                + target_type + " " + trigger_target + " "
                                + trigger_type + "'"
                            );
                        }
                    }
                }
            } else {
                // a simple Item target was used (just an item name),
                // so add a default target_type and trigger_type (Item XXXXX changed)
                target_type = "Item";
                trigger_target = expr;
                trigger_type = "changed";
            }

            // validate the inputs, and if anything isn't populated correctly throw an exception
            if (
                target_type === null
                || !(~[
                    "Item", "Member of", "Descendent of", "Thing", "Channel", "System", "Time", "Item Event"
                ].indexOf(target_type))
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed. "
                    + "target_type is missing or invalid. Valid target_type values are: "
                    + "Item, Member of, Descendent of, Thing, Channel, System, and Time."
                );
            } else if (
                target_type !== "System"
                && !(~["added", "removed", "modified"].indexOf(trigger_type))
                && trigger_type === null
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because trigger_type cannot be null"
                );
            } else if (
                ~["Item", "Member of", "Descendent of"].indexOf(target_type)
                && !(~["added", "removed", "modified"].indexOf(trigger_type))
                && itemRegistry.getItems(trigger_target) === []
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because Item '"
                    + trigger_target + "' is not in the ItemRegistry"
                );
            } else if (
                ~["Member of", "Descendent of"].indexOf(target_type)
                && itemRegistry.getItem(trigger_target).type !== "Group"
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because '"
                    + target_type + "' was specified, but '"
                    + trigger_target + "' is not a group"
                );
            } else if (
                target_type === "Item"
                && !(~["added", "removed", "modified"].indexOf(trigger_type))
                && old_state !== null
                && trigger_type === "changed"
                && TypeParser.parseState(
                    itemRegistry.getItem(trigger_target).acceptedDataTypes, old_state
                ) === null
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because '"
                    + old_state + "' is not a valid state for '"
                    + trigger_target + "'"
                );
            } else if (
                target_type === "Item"
                && !(~["added", "removed", "modified"].indexOf(trigger_type))
                && new_state !== null
                && ~["changed", "received update"].indexOf(trigger_type)
                && TypeParser.parseState(
                    itemRegistry.getItem(trigger_target).acceptedDataTypes, new_state
                ) === null
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because '"
                    + new_state + "' is not a valid state for '"
                    + trigger_target + "'"
                );
            } else if (
                target_type === "Item"
                && !(~["added", "removed", "modified"].indexOf(trigger_type))
                && new_state !== null
                && trigger_type === "received command"
                && TypeParser.parseCommand(
                    itemRegistry.getItem(trigger_target).acceptedCommandTypes, new_state
                ) !== null
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because '"
                    + new_state + "' is not a valid command for '"
                    + trigger_target + "'"
                );
            } else if (
                target_type === "Thing"
                && !(~["added", "removed", "modified"].indexOf(trigger_type))
                && things.get(new ThingUID(trigger_target)) === null // returns null if Thing does not exist
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because Thing '"
                    + trigger_target + "' is not in the ThingRegistry"
                );
            } else if (
                target_type === "Thing"
                && !(~["added", "removed", "modified"].indexOf(trigger_type))
                && old_state !== null
                && ThingStatus.old_state === undefined
            ) {
                throw RangeError("when: '" + old_state + "' is not a valid Thing status");
            } else if (
                target_type === "Thing"
                && !(~["added", "removed", "modified"].indexOf(trigger_type))
                && new_state !== null
                && ThingStatus.new_state === undefined
            ) {
                throw RangeError("when: '" + new_state + "' is not a valid Thing status");
            } else if (
                target_type === "Channel"
                && things.getChannel(new ChannelUID(trigger_target)) === null // returns null if Channel does not exist
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because Channel '"
                    + trigger_target + "' does not exist"
                );
            } else if (
                target_type === "Channel"
                && things.getChannel(new ChannelUID(trigger_target)).kind !== ChannelKind.TRIGGER
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed because '"
                    + trigger_target + "' is not a trigger Channel"
                );
            } else if (
                target_type === "System"
                && trigger_target !== "started"
                // && trigger_target != "shuts down"
            ) {
                throw RangeError(
                    "when: '" + expr + "' could not be parsed. trigger_target '"
                    + trigger_target + "' is invalid for target_type 'System'. "
                    + "The only valid trigger_type value is 'started'"
                );
            }

            LOG.trace(
                "when: expr='{}', target_type='{}', trigger_target='{}', "
                + "trigger_type='{}', old_state='{}', new_state='{}'",
                [expr, target_type, trigger_target, trigger_type, old_state, new_state]
            );

            trigger_name = validate_uid(trigger_name || expr);
            if (~["Item", "Member of", "Descendent of"].indexOf(target_type)) {
                if (~["added", "removed", "modified"].indexOf(trigger_type)) {
                    return item_event_trigger;
                } else {
                    return item_trigger;
                }
            } else if (target_type === "Thing") {
                if (~["added", "removed", "modified"].indexOf(trigger_type)) {
                    return thing_event_trigger;
                } else {
                    return thing_trigger;
                }
            } else if (target_type === "Channel") {
                return channel_trigger;
            } else if (target_type === "System") {
                return system_trigger;
            } else if (target_type === "Time") {
                return cron_trigger;
            }

        } catch (e) {
            if (e instanceof RangeError) {
                // eslint-disable-next-line no-inner-declarations
                function bad_trigger(func) {
                    return add_trigger(func, null);
                }

                /* If there was a problem with a trigger configuration then add null
                *  to the triggers attribute of the callback function so that
                *  core.rules.rule can identify that there was a problem and not start
                *  the rule.
                */
                LOG.warn(e.message);
                return bad_trigger;
            } else {
                LOG.error(get_stacktrace(e, "when"));
                throw Error("log_traceback caught an error (see the stack trace for details)");
            }
        }
    };
})(this);
