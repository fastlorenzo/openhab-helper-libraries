/**
 * This module provides easy access to the slf4j logging library used in
 * openHAB. The ``configuration`` module provides a ``LOG_PREFIX`` variable
 * that is used as the default logger throughout the core modules.
 *
 * @copyright Copyright (c) 2020
 *
 * @author Michael Murton - initial contribution
 */

(function (context) {
    var OPENHAB_CONF = Java.type("java.lang.System").getProperty("openhab.conf");
    var JS_PATH = OPENHAB_CONF + "/automation/lib/javascript";

    var LoggerFactory = Java.type("org.slf4j.LoggerFactory");

    try {
        load(JS_PATH + "/configuration.js");
        context.LOG_PREFIX = LOG_PREFIX;
    } catch (e) {
        context.LOG_PREFIX = "jsr223.javascript.NOCONFIG";
    }

    /**
     * Gets an slf4j logger instance
     *
     * @param {string} name - Log name
     *
     * @returns {*} A logger instance
     */
    context.getLogger = function (name) {
        return LoggerFactory.getLogger(name);
    };

    /**
     * Returns a string that can be logged containing a stack trace of
     * the passed Error
     *
     * @param {Error} e - error to get a stack trace from
     * @param {string=} func_name - function name where the error occurred
     * @param {number=} splice_start - splice start to cut stack frames
     * @param {number=} splice_count - splice count to cut stack frames
     *
     * @returns {string} a string of the compiled stack trace
     */
    context.get_stacktrace = function (e, func_name, splice_start, splice_count) {
        var message = "\nError during the evaluation of '" + (func_name || "{anonymous}") + "'";
        var stack = [];
        if (e.stack) { // JavaScript error
            stack = e.stack.split("\n");
            if (splice_start !== undefined && splice_count !== undefined) {
                stack.splice(splice_start, splice_count);
            }
            message += (
                " at line " + e.lineNumber + " at column " + e.columnNumber
                + " in " + e.fileName
                + "\n  JavaScript traceback (most recent call first):\n    "
                + stack.join("\n    ")
            );
        } else { // Java error
            var stacktrace = e.getStackTrace();
            for (var i = 0, size = stacktrace.length; i < size; i++) {
                //for each(var element in e.getStackTrace()) {
                stack.push(stacktrace[i].toString());
            }
            message += (
                "\n  Java traceback (most recent call first):\n    "
                + e.message + "\n      "
                + stack.join("\n      ")
            );
        }
        return message;
    };

    /**
     * A decorator to provide stack traces for any function
     *
     * @param {function} func - function to wrap
     *
     * @returns {function} the decorated function
     */
    context.log_traceback = function (func) {
        var log = func.log || context.log || LoggerFactory.getLogger(LOG_PREFIX);

        return function wrapper() {
            try {
                var result = func.apply(func, Array.prototype.slice.call(arguments));
            } catch (e) {
                log.error(context.get_stacktrace(e, func.name, -2, 1));
                throw Error("log_traceback caught an error (see the stack trace for details)");
            }
            return result;
        };
    };
})(this);
