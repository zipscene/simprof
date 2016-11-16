// Copyright 2016 Zipscene, LLC
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

const { EventEmitter } = require('events');
const XError = require('xerror');
const Table = require('easy-table');
const _ = require('lodash');

const ProfilerBlock = require('./profiler-block');

global.simpleProfiler = global.simpleProfiler || {};
const isEnabledSymbol = Symbol.for('zs-simple-profiler:isEnabled');

/**
 * Simple code profiler.
 *
 * @constructor
 * @static
 * @param {String} namespace
 */
class Profiler extends EventEmitter {

	constructor(namespace) {
		super();

		this.namespace = namespace;
		this.activeBlocksById = {};
		this.activeBlocksByName = {};
		this.idCounter = 0;

		this.stats = this.constructor.stats[namespace] = {};
		this.events = this.constructor.events[namespace] = Array(10);
		this.warnings = this.constructor.warnings[namespace] = Array(10);

		const disabledBlockName = 'DISABLED';
		const stats = this.stats[disabledBlockName] = { isHidden: true };
		this.disabledBlock = new ProfilerBlock(-1, disabledBlockName, { stats });

		if (global.simpleProfiler[namespace]) {
			return global.simpleProfiler[namespace];
		} else {
			global.simpleProfiler[namespace] = this;
		}
	}

	/**
	 * Enable all profilers.
	 *
	 * @method enable
	 * @static
	 */
	static enable() {
		global.simpleProfiler[isEnabledSymbol] = true;
	}

	/**
	 * Disable all profilers.
	 *
	 * @method disable
	 * @static
	 */
	static disable() {
		global.simpleProfiler[isEnabledSymbol] = false;
	}

	/**
	 * Get whether the profiler is enabled.
	 *
	 * @method isEnabled
	 * @static
	 */
	static isEnabled() {
		return global.simpleProfiler[isEnabledSymbol];
	}

	/**
	 * Get the global profiler event emitter
	 *
	 * @method getEmitter
	 * @static
	 * @returns {EventEmitter}
	 */
	static getEmitter() {
		return this.emitter;
	}

	/**
	 * Get the stats of all profilers.
	 *
	 * @method getStats
	 * @static
	 * @returns {Object}
	 */
	static getStats() {
		return this.stats;
	}

	/**
	 * Get the events of all profilers.
	 *
	 * @method getEvents
	 * @static
	 * @returns {Object}
	 */
	static getEvents() {
		return this.events;
	}

	/**
	 * Get the warnings of all profilers.
	 *
	 * @method getWarnings
	 * @static
	 * @returns {Array}
	 */
	static getWarnings() {
		return this.warnings;
	}

	/**
	 * Get a string table output of the useful stats for all blocks in all profilers.
	 *
	 * @method dumpStats
	 * @static
	 * @returns {String}
	 */
	static dumpStats() {
		let output = '';
		for (let namespace in global.simpleProfiler) {
			output += global.simpleProfiler[namespace].dumpStats();
		}
		return output;
	}

	/**
	 * Register a ProfilerBlock with the Profiler
	 *
	 * @method addBlock
	 * @param {ProfilerBlock} block - the ProfilerBlock to register
	 * @returns {Profiler} - returns `this`
	 */
	addBlock(block) {
		const { id, name } = block;
		this.activeBlocksById[id] = block;
		this.activeBlocksByName[name] = block;

		// deregister the block when it emits 'end'
		block.on('end', (block) => {
			this.removeBlock(block);
			this.emitEnd(block);
		});

		// pass-through warnings
		block.on('warning', this.emitWarning.bind(this));

		return this;
	}

	/**
	 * Deregister a ProfilerBlock with the Profiler
	 *
	 * @method removeBlock
	 * @param {ProfilerBlock} block - the ProfilerBlock to deregister
	 * @returns {Profiler} - returns `this`
	 */
	removeBlock({ id, name }) {
		delete this.activeBlocksById[id];
		delete this.activeBlocksByName[name];
		return this;
	}

	/**
	 * Get a block by name or id, or pass through if called w/ a block
	 *
	 * @method getBlock
	 * @param {Number|String|Object} block - Either the `id` or `name` of a block to end, or the block itself.
	 * @return {ProfilerBlock} - the ProfilerBlock
	 * @throws {XError} - throws if the block is not found
	 */
	getBlock(block) {
		if (typeof block === 'number') block = this.activeBlocksById[block];
		if (typeof block === 'string') block = this.activeBlocksByName[block];
		if (block instanceof ProfilerBlock) return block;

		const msg = 'Profiler#getBlock must be called w/ a ProfilerBlock or the name or id of a block';
		throw new XError(XError.INTERNAL_ERROR, msg);
	}

	/**
	 * Begin profiling a single block.
	 *
	 * @method begin
	 * @param {String} name - The human-readable name of the block.
	 * @param {Number} [warnThreshold] - The threshold above which to warn of blocks taking too long.
	 * @returns {ProfilerBlock} - A block representing a single profiling segment.
	 */
	begin(name, warnThreshold) {
		if (!this.constructor.isEnabled()) return this.disabledBlock;

		const id = ++this.idCounter;

		let stats = this.stats[name];
		if (!_.isObject(stats)) {
			stats = {};
			this.stats[name] = stats;
		}

		const block = new ProfilerBlock(id, name, { warnThreshold, stats });

		this.addBlock(block);
		this.emitBegin(block);

		return block;
	}

	/**
	 * End profiling a given block.
	 *
	 * @method end
	 * @param {Number|String|Object} block - Either the `id` or `name` of a block to end, or the block itself.
	 * @returns {Object} - The aggregate data for the ended block.
	 */
	end(block) {
		if (!this.constructor.isEnabled()) return;
		return this.getBlock(block).end();
	}

	/**
	 * Profile a given function.  Returns a function equivalent to the given function, but with
	 * the profiler wrapped around it.  Handles synchronous functions and functions that return
	 * promises.
	 *
	 * If a promise is supplied instead of a function, this profiles the amount of time from
	 * when this is called until the promise resolves, and returns the promise.
	 *
	 * If a scalar is supplied instead of a function, this returns the scalar immediately
	 * without profiling.
	 *
	 * @method wrap
	 * @param {Function|Promise} fn - The function or promise to wrap.
	 * @param {String} name - The human-readable name of the block.
	 * @param {Number} [warnThreshold] - The threshold above which to warn of blocks taking too long.
	 * @returns {Function} - The wrapped function.
	 */
	wrap(fn, name, warnThreshold) {
		name = name || fn.name || 'function';
		let profiler = this;

		if (fn && typeof fn.then === 'function') {
			let block = profiler.begin(name, warnThreshold);
			fn.then(() => block.end());
			return fn;
		}

		if (typeof fn !== 'function') {
			return fn;
		}

		return function(...args) {
			if (!profiler.constructor.isEnabled()) {
				return fn.apply(this, args);
			}
			let block = profiler.begin(name, warnThreshold);
			let output = fn.apply(this, args);
			if (output && typeof output.then === 'function') {
				output.then(() => block.end());
			} else {
				block.end();
			}
			return output;
		};
	}

	/**
	 * Returns a function which begins a specified profile and returns the input argument.
	 * Especially useful inside a promise chain, as it preserves the previous return.
	 *
	 * @method wrappedBegin
	 * @param {String} name - The human-readable name of the block.
	 * @param {Number} [warnThreshold] - The threshold above which to warn of blocks taking too long.
	 * @returns {Function} - Function begining the specified profile.
	 */
	wrappedBegin(name, warnThreshold) {
		return (param) => {
			this.begin(name, warnThreshold);
			return param;
		};
	}

	/**
	 * Returns a function which ends a specified profile and returns the input argument.
	 * Especially useful inside a promise chain, as it preserves the previous return.
	 *
	 * @method wrappedEnd
	 * @param {Number|String|Object} block - Either the `id` or `name` of a block to end, or the block itself.
	 * @returns {Function} - Function ending the specified profile.
	 */
	wrappedEnd(block) {
		// TODO: deprecate
		return (param) => {
			this.getBlock(block).end();
			return param;
		};
	}

	/**
	 * Emit and store a 'begin' event for a given block.
	 *
	 * @method emitBegin
	 * @private
	 * @param {Object} block - The block to emit the event for.
	 * @returns {Profiler}
	 */
	emitBegin(block) {
		this.events.push(`begin '${block.name}'`);
		this.events.shift();
		this.emit('begin', block);
		this.constructor.emitter.emit('begin', this.namespace, block);

		return this;
	}

	/**
	 * Emit and store a 'end' event for a given block.
	 *
	 * @method emitEnd
	 * @private
	 * @param {Object} block - The block to emit the event for.
	 * @param {Object} aggregate - The aggregate data of the ended profile segment.
	 * @returns {Profiler}
	 */
	emitEnd(block) {
		this.events.push(`end '${block.name}' (${block.duration})`);
		this.events.shift();
		this.emit('end', block, block.stats);
		this.constructor.emitter.emit('end', this.namespace, block, block.stats);

		return this;
	}

	/**
	 * Emit and store a 'warning' event for a given block.
	 *
	 * @method emitWarning
	 * @private
	 * @param {XError} warning - The warning to emit
	 * @returns {Profiler}
	 */
	emitWarning(warning) {
		this.warnings.push(warning);
		this.warnings.shift();
		this.emit('warning', warning);
		this.constructor.emitter.emit('warning', this.namespace, warning);

		return this;
	}

	/**
	 * Get all stats of the profiler, or optionally stats of a given block.
	 *
	 * @method getStats
	 * @param {String} [name] - The block for which to retrieve stats.
	 * @returns {Object}
	 */
	getStats(name) {
		if (typeof name === 'number') name = this.activeBlocksById[name].name;
		if (name) return this.stats[name];
		return this.stats;
	}

	/**
	 * Get all events of the profiler.
	 *
	 * @method getEvents
	 * @returns {Array}
	 */
	getEvents() {
		return _.filter(this.events);
	}

	/**
	 * Get all warnings of the profiler.
	 *
	 * @method getWarnings
	 * @returns {Array}
	 */
	getWarnings() {
		return _.filter(this.warnings);
	}

	/**
	 * Get a string table output of the useful stats for all blocks in the profiler.
	 *
	 * @method dumpStats
	 * @returns {String}
	 */
	dumpStats() {
		let table = new Table();

		let stats = this.getStats();
		for (let statName of _.keys(stats).sort()) {
			const stat = stats[statName];

			if (stat.isHidden) continue;

			table.cell('name', statName);
			table.cell('sum', stat.sum, displayDuration);
			table.cell('average', stat.avg, displayDuration);
			table.cell('std. dev.', stat.std, displayDuration);
			table.cell('min', stat.min, displayDuration);
			table.cell('max', stat.max, displayDuration);
			table.cell('range', stat.max - stat.min, displayDuration);
			table.cell('count', stat.count, Table.number());
			table.newRow();
		}

		table.sort([ 'sum|des' ]);

		let tableOutput = `${table}`;

		let eventOutput = this.getEvents().join('\n');
		if (eventOutput) eventOutput = `recent events:\n${eventOutput}`;

		let output = `\n================================\n${this.namespace}:\n\n`;
		if (tableOutput) output += `${tableOutput}\n`;
		if (eventOutput) output += `${eventOutput}\n`;
		return output;
	}

}

function displayDuration(value) {
	if (!Number.isFinite(value)) return `${value}`;

	if (value < 1000) return `${Math.round(value)}ms`;
	if (value < 60000) {
		let secs = value / 1000;
		return `${secs.toFixed(2)}s`;
	}

	let mins = Math.floor(value / 60000);
	let secs = Math.floor((value - mins * 60000) / 1000);
	if (secs < 10) secs = `0${secs}`;

	return `${mins}:${secs}`;
}

Profiler.emitter = new EventEmitter();
Profiler.stats = {};
Profiler.events = {};
Profiler.warnings = {};
Profiler.disable();

module.exports = Profiler;
