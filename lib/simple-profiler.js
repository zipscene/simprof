const EventEmitter = require('events');
const XError = require('xerror');

global.simpleProfiler = global.simpleProfiler || {};

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
		this.stats = this.constructor.stats[namespace] = {};
		this.events = this.constructor.events[namespace] = Array(10);
		this.warnings = this.constructor.warnings[namespace] = Array(10);
		this.idCounter = 0;

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
		this.isEnabled = true;
	}

	/**
	 * Disable all profilers.
	 *
	 * @method disable
	 * @static
	 */
	static disable() {
		this.isEnabled = false;
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
	 * Begin profiling a single block.
	 *
	 * @method begin
	 * @param {String} name - The human-readable name of the block.
	 * @param {Number} [warnThreshold] - The threshold above which to warn of blocks taking too long.
	 * @returns {Object} - A block representing a single profiling segment.
	 *   Contains an `end` method, which may be used as a shorthand for ending the current block.
	 */
	begin(name, warnThreshold) {
		if (!this.constructor.isEnabled) return;

		const id = ++this.idCounter;

		const block = {
			id,
			name,
			warnThreshold,
			startedOn: new Date(),
			end: () => this.end(id)
		};

		this.activeBlocksById[id] = this.activeBlocksByName[name] = block;

		this.emitBegin(block);

		return block;
	}

	/**
	 * End profiling a given block.
	 *
	 * @method end
	 * @param {Number|String} id - Either the `id` or `name` of a block to end.
	 * @returns {Object} - The aggregate data for the ended block.
	 */
	end(id) {
		if (!this.constructor.isEnabled) return;

		const endedOn = new Date();
		const block = (typeof id === 'number') ? this.activeBlocksById[id] : this.activeBlocksByName[id];

		if (typeof block !== 'object') return;

		const duration = endedOn - block.startedOn;
		block.endedOn = endedOn;
		block.duration = duration;

		delete this.activeBlocksById[block.id];
		delete this.activeBlocksByName[block.name];

		if (!this.stats[block.name]) {
			this.stats[block.name] = {
				count: 0,
				sum: 0,
				sumSq: 0,
				avg: 0,
				std: 0,
				min: Infinity,
				max: -Infinity
			};
		}

		const aggregate = this.stats[block.name];
		aggregate.count += 1;

		let warnThreshold = block.warnThreshold;
		if (typeof warnThreshold !== 'number') warnThreshold = 2 * aggregate.avg + aggregate.std;
		if (aggregate.count >= 100 && duration > warnThreshold) {
			let warnMessage = `Block ${block.name} took longer than the acceptable threshold.`;
			this.emitWarning(new XError(XError.LIMIT_EXCEEDED, warnMessage));
		}

		aggregate.sum += duration;
		aggregate.sumSq += duration * duration;
		aggregate.avg = aggregate.sum / aggregate.count;
		aggregate.std = (aggregate.sumSq / aggregate.count) - (aggregate.avg * aggregate.avg);

		if (duration < aggregate.min) aggregate.min = duration;
		if (duration > aggregate.max) aggregate.max = duration;

		this.emitEnd(block, aggregate);

		return aggregate;
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
	emitEnd(block, aggregate) {
		this.events.push(`end '${block.name}' (${block.duration})`);
		this.events.shift();
		this.emit('end', block, aggregate);
		this.constructor.emitter.emit('end', this.namespace, block, aggregate);

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

}

Profiler.emitter = new EventEmitter();
Profiler.stats = {};
Profiler.events = {};
Profiler.warnings = {};
Profiler.isEnabled = false;

module.exports = Profiler;
