const XError = require('xerror');
const _ = require('lodash');
const { EventEmitter } = require('events');

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

	updateStats() {
		const { duration, stats } = this;
		stats.count += 1;
		stats.sum += this.duration;
		stats.sumSq += this.duration * this.duration;
		stats.avg = stats.sum / stats.count;
		stats.std = (stats.sumSq / stats.count) - (stats.avg * stats.avg);
		if (duration < stats.min) stats.min = duration;
		if (duration > stats.max) stats.max = duration;
		return stats;
	}

	wrappedEnd() {
		return (param) => {
			this.end();
			return param;
		};
	}
}
module.exports = ProfilerBlock;
