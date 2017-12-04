// Copyright 2016 Zipscene, LLC
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

const XError = require('xerror');
const _ = require('lodash');
const { EventEmitter } = require('events');

/**
 * A utility used by Profiler to represent a single execution of a code path under test
 *
 * @constructor
 * @static
 * @param {Number} id - a numeric ID used by Profiler to uniquely identify the block
 * @param {String} name - the name used by Profiler to represent the code path under test
 * @param {Object} options
 *   @param {Number} warnThreshold - the duration in ms above which to emit a warning
 *   @param {Object} stats - the stats object to be updated on #end
 */
class ProfilerBlock extends EventEmitter {
	constructor(id, name, { warnThreshold, stats }) {
		super();

		if (!_.isObject(stats)) {
			throw new XError(XError.INTERNAL_ERROR, 'ProfilerBlock called w/o `stats` object');
		}

		_.defaults(stats, {
			count: 0,
			sum: 0,
			sumSq: 0,
			avg: 0,
			std: 0,
			min: Infinity,
			max: -Infinity
		});

		_.extend(this, { id, name, stats, warnThreshold, startedOn: new Date() });
	}

	/**
	 * End the current run of the code path under test and update stats
	 *
	 * @method end
	 * @returns {Object} - returns the updated stats object
	 */
	end() {
		this.endedOn = new Date();
		this.duration = this.endedOn - this.startedOn;

		this.updateStats();

		let { warnThreshold } = this;
		if (typeof warnThreshold !== 'number') warnThreshold = 2 * this.stats.avg + this.stats.std;
		if (this.stats.count >= 100 && this.duration > warnThreshold) {
			let warnMessage = `Block ${this.name} took longer than the acceptable threshold.`;
			this.emit('warning', new XError(XError.LIMIT_EXCEEDED, warnMessage));
		}

		this.emit('end', this);

		return this.stats;
	}

	/**
	 * update the stats object to include this run's results
	 *
	 * @method updateStats
	 * @private
	 * @returns {Object} - returns the updated stats object
	 */
	updateStats() {
		const { duration, stats } = this;
		stats.count += 1;
		stats.sum += this.duration;
		stats.sumSq += this.duration * this.duration;
		stats.avg = stats.sum / stats.count;
		stats.std = Math.sqrt((stats.sumSq / stats.count) - (stats.avg * stats.avg));
		if (duration < stats.min) stats.min = duration;
		if (duration > stats.max) stats.max = duration;
		return stats;
	}

	/**
	 * Create a function that calls #end and passes through its argument
	 *
	 * @method wrappedEnd
	 * @returns {Function} - returns a function that calls #end and passes through its argument
	 */
	wrappedEnd() {
		return (param) => {
			this.end();
			return param;
		};
	}

	/**
	 * Create a function that calls #end and throws its argument
	 *
	 * @method wrappedEndError
	 * @returns {Function}
	 */
	wrappedEndError() {
		return (err) => {
			this.end();
			throw err;
		};
	}
}
module.exports = ProfilerBlock;
