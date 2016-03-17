const { EventEmitter } = require('events');
const XError = require('xerror');
const Table = require('easy-table');

const ProfilerBlock = require('./profiler-block');

global.simpleProfiler = global.simpleProfiler || {};
const isEnabledSymbol = Symbol('isEnabled');

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

		this.disabledBlock = new ProfilerBlock(-1, 'DISABLED', { profiler: this, isActive: false });

		if (global.simpleProfiler[namespace]) {
			setImmediate(() => {
				this.emitWarning(new XError(XError.ALREADY_EXISTS, `Profiler '${namespace}' already exists.`));
			});
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
		return this;
	}

	/**
	 * Deregister a ProfilerBlock with the Profiler
	 *
	 * @method addBlock
	 * @param {ProfilerBlock} block - the ProfilerBlock to register
	 * @returns {Profiler} - returns `this`
	 */
	removeBlock({ id, name }) {
		delete this.activeBlocksById[id];
		delete this.activeBlocksByName[name];
		return this;
	}

	/**
	 * Get a block by name or id, or pass through if called w/ a block
	 * @param {Number|String|Object} block - Either the `id` or `name` of a block to end, or the block itself.
	 * @return {ProfilerBlock} - the ProfilerBlock
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
	 * @returns {Object} - A block representing a single profiling segment.
	 *   Contains an `end` method, which may be used as a shorthand for ending the current block.
	 *   Contains an `wrappedEnd` method, which may be used inside promise chains while preserving the param flow.
	 */
	begin(name, warnThreshold) {
		if (!this.constructor.isEnabled()) return this.disabledBlock;

		const id = ++this.idCounter;

		const block = new ProfilerBlock(id, name, { warnThreshold, profiler: this });

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
		if (!this.constructor.isEnabled) return;
		return this.getBlock(block).end();
	}

	/**
	 * Profile a given function.
	 *
	 * @method wrap
	 * @param {Function|Promise} fn - The function or promise to wrap.
	 * @param {String} name - The human-readable name of the block.
	 * @param {Number} [warnThreshold] - The threshold above which to warn of blocks taking too long.
	 * @returns {*} - Preserves the wrapped function's return
	 */
	wrap(fn, name, warnThreshold) {
		if (!this.constructor.isEnabled) return;

		let block = this.begin(name, warnThreshold);

		// Handle promises
		if (typeof fn.then === 'function') {
			return fn
				.then((output) => {
					return block.end().then(() => output);
				});
		}

		// Handle native functions
		let output = fn();
		block.end();

		return output;
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
		this.events.shift();
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
		return this.events;
	}

	/**
	 * Get all warnings of the profiler.
	 *
	 * @method getWarnings
	 * @returns {Array}
	 */
	getWarnings() {
		return this.warnings;
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
		for (let statName in stats) {
			const stat = stats[statName];
			table.cell('name', statName);
			table.cell('average', stat.avg);
			table.cell('std. dev.', stat.std);
			table.cell('min', stat.min);
			table.cell('max', stat.max);
			table.cell('range', stat.max - stat.min);
			table.cell('count', stat.count);
			table.newRow();
		}

		return `================================\n${this.namespace}:\n\n${table}`;
	}

}

Profiler.emitter = new EventEmitter();
Profiler.stats = {};
Profiler.events = {};
Profiler.warnings = {};
Profiler.disable();

module.exports = Profiler;
